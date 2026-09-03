# SEED — clvi-game-client

You are one session in a relay building **STRATA** (browser MMO-tycoon; players
restore Paradise, NV; verified finds mint Guardian tokens). This repo is the
**playable world**, two tracks in one codebase:

- **MAP track (M)** — the Paradise service area, gridded into cells, stylized,
  **regeneratively updated**: restored cells bloom with color and the bloom
  diffuses outward.
- **FIND track (A)** — the dig interaction, artifact registry, the client-side
  **hash puzzle** that makes a find real, the **Holi color-burst reveal**, and the
  honest energy estimate attached to every solve.

Scope is Paradise, NV **only** (the unincorporated Clark County town holding most
of the Strip, UNLV, and Harry Reid Intl). Design stance, non-negotiable: the puzzle
is a **disclosed game mechanic, not a miner** — capped, battery-aware, rate-limited,
its estimated energy printed on the token it helps mint.

No memory between sessions; docs are the memory.

## Stack rules (frozen)

- TypeScript + Vite, Canvas 2D (no map SDKs, no tile servers); WebCrypto
  (`crypto.subtle.digest`) for SHA-256 — no wasm miners, at most ONE Web Worker.
- iPhone Safari first: pinch-zoom + one-finger pan via Pointer Events,
  `touch-action: none` on the canvas only, page never rubber-bands, 60 fps at
  default zoom, solving UI never blocks a frame.
- North star in docs/ARCHITECTURE.md: Godot scene-streaming these cells (CLVI doc).
- No secrets in this repo.

## If this repo is empty → BOOTSTRAP (M0)

1. Save this entire prompt verbatim as `SEED.md`.
2. Scaffold Vite vanilla-ts + `netlify.toml` (build `npm run build`, publish
   `dist`) + index page "clvi-game-client · <build timestamp>".
3. Create CLAUDE.md + docs/ (VISION, ARCHITECTURE, DATA, ARTIFACTS, ENERGY, STATE
   with both tracks' milestones as Next, CHANGELOG, LOOP = protocol below).
   Build green, commit "loop: bootstrap M0", push `origin loop`.

## The Loop Protocol (identical in all CLVI repos)

- BOOT: read CLAUDE.md → docs/LOOP.md → docs/STATE.md → last 3 CHANGELOG entries.
- WORK: take the single smallest next improvement across EITHER track (alternate
  tracks when tied). Implement it completely. One increment per session.
- VERIFY: `npm run build` passes; run the smoke checks in STATE.md#Verify.
- RECORD: rewrite STATE.md so a stranger could continue; append one CHANGELOG entry
  (date · what · why · files · verify result). If you learned a better way to run
  this loop, revise LOOP.md itself — **LOOP.md governs its own revision**. The docs
  must never describe a repo that no longer exists.
- SHIP: `git add -A && git commit -m "loop: <summary>" && git push origin loop`.
- STOP: leave the repo green. If blocked > 2 attempts, write the blocker at the top
  of STATE.md and improve tests or docs instead.

## MAP track

- **M1 — Boundary.** Commit `data/paradise-boundary.geojson`. Preferred: the OSM
  administrative boundary for Paradise (record the exact Overpass query in
  docs/DATA.md). If the session has no network, hand-author a reasonable polygon
  from the published CDP extent, mark `PROVISIONAL: true`, add a Next item to
  replace it. Render the outline.
- **M2 — Cell grid.** ~150 m square cells clipped to the boundary, id
  `P-<col>-<row>` from the bbox NW corner, deterministic. States: `littered`
  (desaturated sand/ash) → `restoring` → `restored` (saturated). Flat typed array;
  equirectangular projection around 36.09 N documented in docs/DATA.md.
- **M3 — Touch camera.** Pinch 0.5×–8×, pan, inertial glide. 60 fps default zoom.
- **M4 — Regeneration.** `window.StrataMap.applyEvent({cellId, ts, kind:"restored"})`
  saturates the cell in the player palette; over subsequent ticks a fraction
  diffuses to neighbors (littered → restoring). Restoration is contagious; the map
  heals outward. Persist applied events to localStorage.
- **M5 — Event feed.** Poll `GET /map-events?since=<ts>` every 20 s
  (mock `public/mock/map-events.json` until backend live; note the mock in
  STATE.md). Dedupe by cellId+ts.
- **M6 — LOD + polish.** Below 1× zoom merge 2×2 cells into superblocks (the CLVI
  doc's LOD principle); day/dusk tint; boundary glow.

## FIND track

- **A1 — Registry.** docs/ARTIFACTS.md + src/registry.ts: 15–20 Vegas-archaeology
  strata finds (pull-tab stratum, neon tube shard, clay chip fragment, keno pencil,
  atomic-era bottle glass, showgirl sequin cluster, motor-court key fob…) with id,
  era, rarity weight; weighted draw with seeded RNG for testability.
- **A2 — Dig.** Press-and-hold (600 ms) a cell → ring fill → request Challenge
  (src/mockLedger.ts until backend live) → SOLVING state.
- **A3 — The solve.** Rule: `SHA-256(salt + ":" + nonce + ":" + playerId)` needs
  `difficultyBits` leading zero bits. Iterate nonces in batches inside ONE worker;
  show hashes/sec as a heat shimmer. Median phone target **3–6 s**. Hard cap
  **30 s** → request fresh challenge at `difficultyBits − 4`; never brick the dig.
  Battery < 0.2 → ask `−2` bits up front. Courtesy cap: 60 solves/day client-side.
- **A4 — Holi reveal.** On solve: procedural color-burst — radial pigment clouds in
  the player palette, canvas particles, additive blending, ~1.2 s — artifact card
  rises out of it, showing est. Wh (A6). No video files (iOS alpha-video is
  unreliable); a `playsinline` skin is a future option, note in ARCHITECTURE.md.
- **A5 — Submission.** Emit Contracts `Submission` (real `hashes` and `ms`) to the
  ledger (mock first). On ack, dispatch the returned MapEvent on `window` so the
  MAP track consumes it.
- **A6 — Energy honesty.** docs/ENERGY.md + src/energy.ts:
  `estKwh = (ms / 3.6e9) × WATTS[deviceClass]`, WATTS {phone 3, tablet 5,
  laptop 15, desktop 45}; deviceClass from UA/screen heuristics; documented as an
  estimate with assumptions stated.

## Contracts v1 (frozen; change only via clvi-architecture)

```
Challenge  { challengeId, salt, difficultyBits, expiresAt }
Submission { challengeId, playerId, cellId, artifactId, nonce, hashes, ms, deviceClass }
MapEvent   { cellId, ts, kind:"restored" }
Cell id "P-<col>-<row>", 150 m grid from boundary bbox NW corner.
Solve rule: sha256(salt + ":" + nonce + ":" + playerId) leading zero bits >= difficultyBits.
```

## Definition of done for this run

M1–M3 and A1–A4 on the `loop` deploy: on an iPhone I can pinch around Paradise,
press-hold a cell, watch the heat readout solve in single-digit seconds, get a Holi
burst and an artifact card — and a debug button blooms the cell.
