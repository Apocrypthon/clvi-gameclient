# CHANGELOG

Newest first. One entry per session: date · what · why · files · verify result.

---

## 2026-09-23 — Godot track: world shell, in-memory session, TLS transport

**What.** A new `godot/` track: `paradise_world.gd` composes a blue
`ProceduralSkyMaterial` sky, a 512 m white baseplate with matching collision, and
fog — all in code, served behind a session check. Plus `session.gd` (in memory,
never persisted) and `strata_client.gd` (https enforced, plaintext refused).
`docs/GODOT.md` documents the track.

**Why.** Asked for directly. `docs/ARCHITECTURE.md` has named Godot
scene-streaming as the north star since the bootstrap, so this is the first code
on that road rather than a new direction. The browser client in `src/` is
untouched and its frozen stack rules still hold — worth noting that the repo is
now two stacks, which CLAUDE.md's rules did not previously contemplate.

**Notable decisions.**

- **Fog lives on `Camera3D.environment`, and so does the sky.** A camera
  environment *replaces* a `WorldEnvironment` rather than layering with it, so
  "sky on the world, fog on the camera" is not expressible — the sky would
  vanish. Both are in one resource, and GODOT.md explains why before someone
  tries to split them.
- **`fog_mode` and `fog_sky_affect` are probed, not assumed** — they are 4.3+
  only, so `_has_property()` skips them on 4.0-4.2 instead of erroring.
- **No session persistence, and honest about the limit.** No `FileAccess`, no
  `user://`, no remember-me. The file also says what it *cannot* do: GDScript
  strings are immutable and GC'd, so dropping the reference is not scrubbing
  memory.
- **No client-side encryption envelope — resolved against the contracts, not
  guessed.** The request specified sealing "via the strata backend bootstrap
  brands". That string exists in no CLVI repo, so `clvi-architecture` and
  `clvi-backend` were read directly: ADR-002 says *"no key material is
  generated, stored, or asked for on the device in the MVP"*, which forbids a
  client-side seal outright. The real model is TLS in transit, a Supabase OTP
  bearer for identity (ADR-002), and server-side HMAC-SHA256 for ledger
  integrity (ADR-004). `strata_client.gd` enforces TLS and documents that;
  the speculative `require_sealed`/`_seal()` seam was removed rather than left
  implying something was coming.

- **The auth header came off too.** The backend's bootstrap branch sets
  `access-control-allow-headers: content-type` and puts no auth on any endpoint
  — identity is `playerId` in the body, abuse is handled by per-player and
  per-IP rate limits. So `session.gd` holds a player id and a `GRD-xxxxxx`
  display id rather than a bearer token that nothing would have read, and
  `strata_client.gd` sends a deliberately bare header set. Still never
  persisted, which was the original requirement.

- **Two contract problems surfaced while reading those repos** and are recorded
  under Blocked in STATE.md, not fixed here. (a) ADR-001 defers the Godot stack
  and says moving to it *"requires a superseding ADR, not a session's judgment
  call"* — so this track is written but unratified, and needs a human decision.
  (b) `src/mockLedger.ts` does not match the live backend
  (`clvi-backend@claude/strata-ledger-bootstrap-csa88x`, read directly):
  difficulty start 17 vs 18 and floor 8 vs 12, the client picks a difficulty the
  server actually owns and auto-tunes, `/challenge` takes only `playerId`, the
  TTL is 90 s not 120 s, and `nonce` is a **string** server-side where
  `src/contracts.ts` types it `number` — which alone would get every submit
  rejected. Latent while the client talks to the mock; a wall of 400s the day
  the URL is switched. Recorded as the top housekeeping item.

**Files.** `godot/project.godot`, `godot/world/paradise_world.{gd,tscn}`,
`godot/net/{session,strata_client}.gd`, `docs/GODOT.md` (new); `CLAUDE.md`,
`docs/STATE.md` (layout, Blocked, G1, Next).

**Verify.** `npm run build` green and `npm run verify` 30/30 — the browser client
is untouched and still passes, which is the only thing CI covers. **The GDScript
is unrun.** No Godot binary was present and downloads.tuxfamily.org and the
GitHub releases API are both blocked by the egress proxy, so verification was
limited to what can be checked statically: tab-consistent indentation (mixed
indentation is a hard GDScript error), balanced delimiters, and no unindented
function bodies — all clean across the three scripts. Behaviour is unverified;
expect to fix something on first open.

---

## 2026-09-03 — CI enforces build + verify

**What.** `.github/workflows/ci.yml`: `npm ci`, `npm run build`, `npm run verify`
on every pull request and every push to `main`, across a Node 20 / 22 matrix.

**Why.** The housekeeping item from the previous entry. The bootstrap merged with
zero check runs on it — nothing but hand-running the gates stood between an
increment and a red `main`, which is exactly the thing a relay of context-free
sessions cannot be trusted to do consistently. LOOP.md already requires these two
commands; this makes the requirement enforceable rather than aspirational.

**Notable decisions.**

- **Node 20 *and* 22, not one.** 20 is what `netlify.toml` deploys with; 22 is what
  the dev containers run and the only version reachable from this environment. A
  single pin would have meant shipping an untested version constraint either way,
  and a divergence between build and deploy should surface in CI rather than in a
  failed deploy.
- **The browser smoke test is not in CI.** `npm run smoke` needs Playwright, which
  is deliberately not a committed dependency, so wiring it in is a real decision
  about `npm ci` cost rather than a line of YAML. Left as the top housekeeping
  item in STATE.md with the two options written out. This means CI does **not**
  cover the dig, the reveal, or anything a player can see — worth knowing before
  trusting a green check.
- **`fail-fast: false`** so a break on one Node version still reports the other,
  and `cancel-in-progress` concurrency so superseded pushes stop burning runners.

**Files.** `.github/workflows/ci.yml` (new), `CLAUDE.md` (layout), `docs/STATE.md`
(Verify section, housekeeping, and the branch note now that PR #1 has merged).

**Verify.** Ran the workflow's exact steps against a clean `git archive` checkout
rather than the warm working tree: `npm ci` (13 packages), `npm run build` green,
`npm run verify` 30/30 — local hash rate 28 576 h/s that run, implying a 4.6 s
median at 17 bits on this container. The YAML was parsed to confirm the job,
matrix and step structure. The Node 20 leg is unexercised locally — only Node 22
is installed here — but every dependency's `engines` range admits it (vite
`^18 || >=20`, typescript `>=14.17`, esbuild `>=12`) and the first CI run on the
PR is the real check.

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
