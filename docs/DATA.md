# DATA

## The boundary — `data/paradise-boundary.geojson`

**Status: `PROVISIONAL: true`. This is hand-authored and must be replaced.**

Paradise is a census-designated place, not an incorporated town, so its boundary
is a Census/OSM census relation rather than an administrative one. The session
that bootstrapped this repo had no route to Overpass — `overpass-api.de:443`
returned `CONNECT tunnel failed, response 403` from the egress proxy, and
`nominatim.openstreetmap.org` the same — so the polygon in the repo is a stylized
12-vertex outline drawn from the published CDP extent.

What it gets right: the bbox, the Winchester notch in the north-east (Winchester
is a *separate* CDP and is not part of Paradise), the Sahara Avenue north edge
west of Paradise Road, and roughly the right area — 41.6 km²·... 41.6 sq mi
against a published ~46.6 sq mi, so it under-covers by about 11 %.

What it gets wrong: everything at street resolution. The real CDP edge is ragged.

### Replace it with this

```
[out:json][timeout:90];
area["boundary"="administrative"]["admin_level"="6"]["name"="Clark County"]
    ["is_in:state_code"="NV"]->.county;
(
  relation(area.county)["name"="Paradise"]["boundary"="census"];
  relation(area.county)["name"="Paradise"]["place"="census-designated place"];
);
out geom;
```

Then: `osmtogeojson` the result, keep the outer ring(s), drop everything but the
geometry, simplify to roughly 300–600 points (finer than that costs a slower
point-in-polygon at grid build with no visible gain at 150 m), set
`"PROVISIONAL": false`, and re-run `npm run verify` — the grid dimensions and the
inside-cell count will change, and that is expected. Cell ids are derived from the
bbox, so **replacing the boundary renumbers every cell**; any persisted
localStorage events and the mock feed have to be regenerated with it.

## Projection

Equirectangular, anchored at **36.09 N**, which is the middle of the CDP. Over a
~13 km span the distortion against a proper conformal projection is well under a
metre — irrelevant at 150 m cells, and it keeps the whole pipeline to two
multiplications.

```
R_MEAN        = 6 371 008.8 m          (IUGG mean Earth radius)
M_PER_DEG_LAT = pi/180 * R_MEAN        = 111 195.08 m
M_PER_DEG_LON = M_PER_DEG_LAT * cos(36.09°) = 89 855.93 m

x = (lon - bbox.minLon) * M_PER_DEG_LON     world metres, +x east
y = (bbox.maxLat - lat) * M_PER_DEG_LAT     world metres, +y south
```

Origin is the **bbox NW corner**, y grows southward, which matches canvas
coordinates and makes `col = floor(x / 150)`, `row = floor(y / 150)` direct.

## The grid

| property | value (with the provisional boundary) |
| --- | --- |
| cell edge | 150 m (Contracts v1, frozen) |
| bbox | -115.2030, 36.0330 → -115.0620, 36.1447 |
| dimensions | 85 cols x 83 rows = 7 055 cells |
| inside the boundary | 4 793 cells (68 %) |
| id | `P-<col>-<row>`, e.g. `P-42-41` |

A cell is *inside* if its **centre** passes an even-odd point-in-rings test.
Even-odd across every ring means interior rings punch holes for free, which is how
a future OSM boundary with an excluded enclave will just work.

Storage is three flat arrays indexed `row * cols + col`:

- `state: Uint8Array` — `0 OUTSIDE | 1 LITTERED | 2 RESTORING | 3 RESTORED`
- `bloom: Float32Array` — 0..1, saturation toward the cell's pigment
- `pigment: Uint8Array` — index into `PIGMENTS`; seeded per cell by FNV-1a over
  its column and row, then overwritten by whichever find blooms it (below)

## The bloom field (M4)

Restoration is a diffusing field on a fixed 250 ms tick, not an animation:

- A find seeds its cell: `state = RESTORED`, and `bloom` ramps to 1.0 at 0.25/tick.
- Every blooming cell lifts its four neighbours toward `bloom * 0.62`
  (`SPREAD_CEIL`), approaching at 0.18 per tick.
- A littered neighbour crossing 0.02 becomes `RESTORING`; anything crossing 0.90
  becomes `RESTORED`.
- A neighbour still below 0.15 **adopts the pigment of the cell blooming it**, so
  each find heals in one coherent colour instead of a field of confetti.

Because each ring is capped at 62 % of the one inside it, bloom decays
geometrically with distance and falls under the 0.02 threshold at about nine
cells. One find therefore heals a bounded halo — measured at ~2.4 % of Paradise —
rather than eventually saturating the valley. That bound is asserted in
`npm run verify`.

Only cells that actually moved stay in the active set, so a settled map costs
nothing per tick.

## Persistence

`localStorage` key `strata.map.events.v1` holds the applied `MapEvent[]`. On boot,
`Regen.restore()` replays them and runs 80 catch-up ticks so a returning player
finds the valley settled rather than watching it re-bloom from scratch. All reads
and writes are wrapped — private mode and quota failures degrade to a working map
that simply does not persist.

Other keys: `strata.playerId.v1` (a random per-browser id, not an account) and
`strata.solves.v1` (the daily courtesy counter).

## The event feed (M5)

`GET /map-events?since=<ts>` every 20 s. Until that endpoint exists the client
falls back to `public/mock/map-events.json` — **10 events along the Strip corridor
and near the airport**, generated from real in-boundary cell ids. The HUD shows
`feed · mock` when it is running off the mock, `feed · live` when the real endpoint
answers.

After two consecutive misses the client stops probing the live URL on every poll
and re-probes every tenth poll (~3.3 min), so a not-yet-deployed backend is not
hammered and the console is not flooded — while a real go-live is still noticed
within a few minutes.

Regenerate the mock after any boundary change; its cell ids are only valid for the
grid that produced them.
