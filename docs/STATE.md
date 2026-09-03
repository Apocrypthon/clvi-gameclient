# STATE

**Last session: 2026-09-03. Repo is green: build, verify, and smoke all pass.**

> **Branch divergence, read this first.** SEED.md and LOOP.md say ship to `loop`.
> This session's harness designated `claude/strata-client-bootstrap-60ptvl`, so
> that is where the work is. If your harness gives you a branch, use it and note
> it here; if it does not, `loop` is the default. `main` holds only the original
> LICENSE and README.

## Where the world is

The bootstrap (M0) is done and so is everything the run's definition of done
asked for, plus the milestones it transitively needed:

| milestone | state |
| --- | --- |
| M1 boundary + outline | **done** — but the polygon is `PROVISIONAL`, see below |
| M2 150 m cell grid | **done** — 85 x 83, 4 793 cells inside |
| M3 touch camera | **done** — pinch 0.5x–8x, pan, inertial glide |
| M4 regeneration | **done** — diffusing bloom field, persisted to localStorage |
| M5 event feed | **done** — polls `/map-events`, falls back to the mock |
| M6 LOD + polish | **not started** — this is the next MAP increment |
| A1 registry | **done** — 20 finds, seeded weighted draw |
| A2 dig | **done** — 600 ms press-and-hold, ring fill |
| A3 the solve | **done** — one worker, 17 bits, 30 s cap, backoff, battery relief |
| A4 Holi reveal | **done** — procedural burst, card rises out of it |
| A5 submission | **done** — Submission to the mock ledger, ack dispatched on window |
| A6 energy honesty | **done** — estimate on every card, assumptions in docs/ENERGY.md |

On an iPhone-sized viewport: pinch around Paradise, press and hold a cell for
600 ms, the ring fills, a heat shimmer reports the live hash rate, pigment bursts
after a second or two, and the artifact card rises carrying its energy estimate.
The cell blooms and the bloom spreads. The **Bloom cell** button does the same to
the nearest un-bloomed cell at the centre of the view, without a solve.

## The two things a new session most needs to know

**1. The boundary is hand-authored and wrong at street resolution.** Overpass and
Nominatim are both blocked from this environment (`CONNECT tunnel failed,
response 403`). `data/paradise-boundary.geojson` is a 12-vertex stylized outline
carrying `"PROVISIONAL": true`. The exact Overpass query that replaces it is in
`docs/DATA.md`. **Replacing it renumbers every cell** — `P-<col>-<row>` is derived
from the bbox — so the mock feed and any persisted localStorage events have to be
regenerated in the same increment.

**2. Difficulty is 17 bits, measured but not yet on a phone.** Observed
20 000–33 000 h/s in Node and 41 000–105 000 h/s in headless Chromium across runs
on this container — the spread is CPU contention, not the code. Against a median
of `ln(2) * 2^17 ≈ 90 900` hashes that is a 0.9–2.3 s median here, which lands in
the seed's 3–6 s band on a phone a few times slower. **That last step is an
inference, not a measurement**: no iPhone was reachable from this environment. The
first FIND item below closes that gap. `npm run verify` prints the local rate and
what it implies. **Do not raise the difficulty because solves feel fast on your
machine** — each bit also doubles the energy estimate (docs/ENERGY.md).

## Verify

Run all three. The first two are cheap and have no external dependency.

```bash
npm run build     # tsc --noEmit && vite build — must stay green
npm run verify    # 30 headless checks, ~10 s
```

`npm run verify` covers: the boundary parses and is flagged provisional; grid
dimensions and inside-cell count; cell-id round-trips and rejection of malformed
and off-grid ids; projection round-trip and the 36.09 N anchor; `applyEvent`
accept / dedupe / reject; that bloom diffuses, stays bounded at 1.0, and that one
find does **not** saturate the valley; registry size, uniqueness, weights, tier
coverage, draw reproducibility and rarity distribution over 20 000 draws; a real
12-bit solve that verifies at exactly its bit count and fails one bit higher; and
the energy formula.

### Browser smoke

```bash
npm run build && npm run preview &      # serves dist on :4173
npm i -D playwright                     # optional, not a committed dependency
npm run smoke
```

13 checks at iPhone 13 size: the canvas paints more than one colour, `StrataMap`
is exposed, the mock feed lands, a real press-and-hold reaches SOLVING and then
produces a visible artifact card with solve stats and an energy line, the debug
button blooms a cell, and there are no unexpected console errors.

Two environment notes. Playwright is **not** in `package.json` — the browsers ship
with the image but the driver does not, so install it unsaved when you need it. If
the installed driver expects a different browser revision than the image has, set
`SMOKE_CHROME` to the binary on disk:

```bash
SMOKE_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run smoke
SMOKE_SHOT=/tmp/reveal.png npm run smoke      # and then look at it
```

**Look at the screenshot.** The bootstrap session shipped a bloom that passed
every test and looked like rainbow static; one screenshot caught it.

## Next

MAP and FIND alternate. The top item of each is sized for one session.

### MAP

1. **M6a — LOD superblocks.** Below 1x zoom, merge 2x2 cells into one drawn
   superblock (the CLVI doc's LOD principle). `render.ts` already merges
   horizontal runs, so this is a second sampling stride, not a rewrite. Measure
   the frame time before and after at 0.5x and put both numbers in the CHANGELOG.
2. **M6b — day/dusk tint and boundary glow.** Tint the palette LUT by time of day
   and give the outline a soft outer glow. Cheap, and the map currently reads flat.
3. **M1' — replace the provisional boundary.** Needs a session with Overpass
   reachable. See docs/DATA.md; renumbers every cell, so regenerate
   `public/mock/map-events.json` in the same increment and say so in STATE.md.
4. **Restored-cell texture.** At high zoom a restored cell is a flat rectangle.
   Some per-cell grain keyed off the cell id would give the bloom material.

### FIND

1. **A3'' — measure the solve on a real phone.** Everything about the 3–6 s target
   currently rests on an inference from a build container. Open the deploy on an
   iPhone, read the `h/s` from the card, and write the number into ENERGY.md and
   this file. If the median is outside 3–6 s, change `DEFAULT_DIFFICULTY_BITS` in
   `src/mockLedger.ts` by one bit and re-measure — not more than one bit per
   session, since each bit doubles both the time and the energy estimate.
2. **A4' — reveal polish.** The burst is screen-space and the card is a fixed
   panel. Anchor the burst to the cell's world position for its full 1.2 s so
   panning during the reveal does not detach it, and let the card carry the
   pigment of the cell it came from.
3. **A7 — the find log.** Twenty artifacts and no way to see what you have found.
   A localStorage-backed list, opened from the HUD, showing each find with its
   cell, its time, and its energy — and a running total of estimated watt-hours,
   which is the honest counterpart to the per-card number.
4. **A3' — verify the nonce client-side before submitting.** `hash.ts` already
   exports `verifySolve`; the dig does not call it. Cheap, and it means a worker
   bug surfaces as a rejected solve rather than a bad Submission.
5. **A2' — dig affordance.** Nothing on the map suggests which cells are diggable
   or that press-and-hold is the verb. First-run hint, or a subtle treatment on
   un-dug cells.

### Both / housekeeping

- **A CI check.** `npm run build && npm run verify` on push would catch the class
  of thing this loop currently catches by hand.
- **Netlify deploy is configured but unverified.** `netlify.toml` builds and
  publishes `dist`; nobody has watched it deploy. `base: './'` in the Vite config
  means the bundle is path-agnostic, so a subdirectory deploy is fine too.

## Known rough edges

- Cells are clipped by **centre point**, so the grid edge stair-steps against the
  smooth outline stroke. Correct for a cell grid; would look better with M6b's
  glow softening the seam.
- The daily cap is localStorage and trivially clearable. Deliberate — it is a
  courtesy, not a boundary, and the real cap belongs on the ledger.
- `/map-events` 404s until the backend exists. Handled: after two misses the
  client re-probes only every tenth poll (~3.3 min) and runs off the mock in
  between. The smoke test allowlists those 404s specifically.
- The energy estimate is deliberately biased high (whole-device power against
  wall-clock time). docs/ENERGY.md argues why that is the right direction.
