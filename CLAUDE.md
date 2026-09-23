# CLAUDE.md — clvi-game-client

STRATA's playable world: a browser client where players restore Paradise, NV one
150 m cell at a time. Two tracks share this codebase — **MAP (M)** renders and
regenerates the valley, **FIND (A)** is the dig, the hash puzzle, and the reveal.

## Boot order (every session)

1. This file.
2. `docs/LOOP.md` — the protocol you are running.
3. `docs/STATE.md` — where the last session left it, and what is next.
4. The last three entries of `docs/CHANGELOG.md`.

Then take **one** increment, verify it, record it, ship it. Never two.

## Stack rules (frozen — do not renegotiate)

- TypeScript + Vite. Canvas 2D only: **no map SDKs, no tile servers**.
- SHA-256 via WebCrypto `crypto.subtle.digest`. **No wasm miners. At most ONE
  Web Worker**, and it lives in `src/solver.worker.ts`.
- iPhone Safari first: Pointer Events, `touch-action: none` on the canvas *only*,
  the page itself never rubber-bands, 60 fps at default zoom, and the solve never
  blocks a frame.
- **No secrets in this repo.** Not in code, not in docs, not in `.env`.

## The stance that is not negotiable

The hash puzzle is a **disclosed game mechanic, not a miner**. It is capped
(60 solves/day), battery-aware (under 20 % it asks for an easier challenge),
bounded (30 s hard cap, then it backs off rather than grinding), and every
artifact card prints the estimated watt-hours the solve cost. If a change makes
the puzzle cheaper to disclose than to justify, it is the wrong change.

## Layout

```
.github/workflows/ci.yml        build + verify on every PR and push to main
data/paradise-boundary.geojson  the service area (PROVISIONAL — see docs/DATA.md)
public/mock/map-events.json     stand-in for GET /map-events
scripts/verify.mjs              headless checks  → npm run verify
scripts/smoke.mjs               browser checks   → npm run smoke (needs playwright)
src/
  contracts.ts   Contracts v1, frozen. Change only via clvi-architecture.
  geo.ts grid.ts boundary.ts     projection, 150 m cells, the outline
  camera.ts render.ts palette.ts pan/pinch/glide, the draw pass, pigments
  regen.ts feed.ts               M4 bloom diffusion, M5 event polling
  registry.ts dig.ts solver.ts solver.worker.ts hash.ts   the FIND track
  holi.ts energy.ts ui.ts main.ts
godot/                           the 3D client track — separate from src/,
                                 see docs/GODOT.md
docs/                            VISION ARCHITECTURE DATA ARTIFACTS ENERGY
                                 GODOT STATE CHANGELOG LOOP
```

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit && vite build` — must stay green |
| `npm run verify` | headless checks: grid, projection, diffusion, registry, solve rule, energy |
| `npm run preview` | serve `dist/` on :4173 |
| `npm run smoke` | drives a real dig in headless Chromium (see docs/STATE.md#Verify) |

## Conventions

- Everything the player sees comes from a typed array or a pure function of one.
  No per-frame allocation in `render.ts`, `camera.ts`, or `regen.ts`.
- Contracts v1 types live in `src/contracts.ts` and are mirrored in SEED.md. If a
  contract must change, that is a `clvi-architecture` decision, not a local one.
- Docs are the memory. A doc that describes a repo that no longer exists is a bug
  as real as a failing build.
