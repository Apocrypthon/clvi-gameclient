# CHANGELOG

Newest first. One entry per session: date · what · why · files · verify result.

---

## 2026-09-03 — bootstrap M0, and M1–M5 / A1–A6

**What.** Brought the repo up from empty to the run's definition of done, and
past it: the whole MAP track except LOD (M1–M5) and the whole FIND track
(A1–A6). On an iPhone-sized viewport you can pinch around Paradise, press-hold a
cell, watch a heat shimmer report the hash rate, get a Holi burst and an artifact
card with an energy estimate, and see the cell bloom outward into its neighbours.

**Why.** The repo held only a LICENSE and a stale README, so SEED.md's bootstrap
branch applied. The seed's definition of done (M1–M3, A1–A4, plus a debug button
that blooms a cell) transitively requires M4 for the bloom, A5 for the card's
provenance and A6 for its energy line, so those landed too. M5 was one small step
past that and closes the map's input path. M6 is the remaining MAP work.

**Notable decisions.**

- **The boundary is `PROVISIONAL`.** Overpass and Nominatim are both blocked from
  this environment (`CONNECT tunnel failed, response 403`), so the polygon is a
  hand-authored 12-vertex outline from the published CDP extent — 41.6 sq mi
  against a published ~46.6, with the Winchester notch included. The exact
  Overpass query to replace it is in `docs/DATA.md`; replacing it renumbers every
  cell.
- **Difficulty is 17 bits.** Measured, not guessed — though the measurement is
  noisy: 20 000–33 000 h/s in Node and **41 000–105 000 h/s** in headless Chromium
  across repeated runs on this container, the spread being CPU contention rather
  than anything in the code. Against a median of `ln(2) * 2^17 ≈ 90 900` hashes
  that is a 0.9–2.3 s median here, which lands in the seed's 3–6 s band on a phone
  a few times slower. 16 bits would be trivial on anything modern; 18 would risk
  8 s+ on a slow phone. **No real-device measurement was possible from this
  environment** — that is the top FIND item in STATE.md#Next. Re-measure before
  changing; `npm run verify` prints the local rate.
- **Batch size is 512.** Also measured: `subtle.digest` throughput was 29.8k at
  batch 32, 32.7k at 256, 33.2k at 512, and fell to 30.1k at 2048.
- **Bloom halos adopt the seeding cell's pigment.** The first render assigned each
  cell an independent random pigment, which was correct and looked like rainbow
  static. A screenshot caught it. Now a neighbour still under 0.15 bloom takes the
  pigment of whatever is blooming it, so each find heals in one coherent colour.
- **The registry excludes Indigenous material** on purpose. Reasoning in
  `docs/ARTIFACTS.md`.
- **Branch.** SEED.md says push to `loop`; this session's harness designated
  `claude/strata-client-bootstrap-60ptvl` and that is where it shipped. Noted at
  the top of STATE.md.

**Files.** Everything. Notably `src/` (18 modules), `data/paradise-boundary.geojson`,
`public/mock/map-events.json`, `scripts/verify.mjs`, `scripts/smoke.mjs`,
`netlify.toml`, and all of `docs/`.

**Verify.**

- `npm run build` — green (tsc clean, 29 kB js + 1 kB worker + 3 kB css).
- `npm run verify` — 30/30 checks pass. Grid 85x83, 4 793 cells inside; one find
  blooms 113 cells (2.4 % of Paradise) and stops; 20 artifacts, all reachable,
  commons 12 579 to legendaries 224 over 20 000 draws; a 12-bit solve verifies at
  exactly its bit count and fails one bit higher.
- `npm run smoke` — 13/13 pass in headless Chromium at iPhone 13 size. A real
  press-and-hold produced *Plastic Swizzle Stick* from `P-42-41` in 1.7 s /
  67 584 hashes / 40 659 h/s at 17 bits, card printing `Est. 0.001 Wh`. No console
  or page errors.
