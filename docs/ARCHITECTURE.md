# ARCHITECTURE

One page, one canvas, one worker, one frame loop.

```
                        ┌───────────────────────────────┐
  data/*.geojson  ──▶   │ boundary.ts → geo.ts → grid.ts │  85 x 83 cells, 4793 inside
                        └───────────────┬───────────────┘
                                        │  state[]  bloom[]  pigment[]   (typed arrays)
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   camera.ts                       regen.ts  ◀── feed.ts (GET /map-events)
   (pointer events)                 (M4)     ◀── window 'strata:map-event'  ◀── dig.ts (A5)
        │                               │                               │
        └────────────▶  render.ts  ◀────┘                          solver.ts
                            │                                     └─ solver.worker.ts
                       one canvas                                    (the ONLY worker)
                            ▲
                    dig.drawOverlay + holi.draw
```

## The frame loop

`main.ts` runs a single `requestAnimationFrame` loop. Every frame, in order:

1. `camera.step(dt)` — inertial glide only; pointer handling is event-driven.
2. `regen.step(dt)` — accumulates into fixed 250 ms diffusion ticks, so bloom
   spreads at the same rate on a 60 Hz phone and a 120 Hz one.
3. `dig.update(dt)` — advances the hold ring and the shimmer clock.
4. `holi.update(dt)` — particles.
5. `render.draw` → `dig.drawOverlay` → `holi.draw`, all onto the same context.

Nothing in the loop allocates per cell. `render.ts` merges horizontal runs of
identical colour into one `fillRect`, and colours come from a pre-baked LUT in
`palette.ts`, so the littered ground costs a handful of fills per row rather than
one per cell.

## Why the solve cannot block a frame

`crypto.subtle.digest` is async, but a tight nonce loop on the main thread would
still starve rAF. So the whole search lives in `src/solver.worker.ts` — the single
Web Worker the stack rules allow. It batches 512 concurrent digests, posts a
progress message every 200 ms, and the main thread only ever renders those
numbers. `solver.ts` owns exactly one worker instance for the lifetime of the page.

The batch size is a measured plateau, not a guess: `subtle.digest`'s per-call
boundary cost dominates, and throughput flattens above ~512 in-flight digests.
See `docs/STATE.md#Verify` for how to re-measure it.

## Why the reveal is procedural

No video files. iOS Safari's alpha-video support is unreliable enough that a
transparent-background clip is not a thing you can ship to an iPhone with
confidence, and a hard-edged rectangle over the map would be worse than nothing.
So `holi.ts` draws the burst: seven expanding radial-gradient pigment clouds and
150 particles, all under `globalCompositeOperation = 'lighter'`, over ~1.2 s.

A `playsinline` video *skin* over the procedural burst remains a future option —
if it ever lands, it layers on top and the procedural burst stays as the floor,
never the other way around.

## Touch, and the page that must not move

`touch-action: none` is on `#stage` **only**. `html, body` get
`overscroll-behavior: none`, `overflow: hidden`, and `position: fixed`, so the page
itself cannot rubber-band while the canvas is being dragged. The camera tracks
pointers in a `Map` keyed by `pointerId`: one pointer pans and records a short
sample ring for the release fling, two pointers pinch with the world point under
the midpoint held fixed.

A press is a gesture the camera arbitrates: `onPressStart` fires on the first
pointerdown, and the camera cancels it if the finger travels more than 12 px
(`HOLD_SLOP_PX`) or a second pointer arrives. `dig.ts` only owns the 600 ms timer;
it never fights the camera for the gesture.

## Contracts, and the boundary with the ledger

`src/contracts.ts` is Contracts v1, frozen, mirrored from SEED.md. `mockLedger.ts`
stands in for the backend and issues **real** challenges — real salts, real
difficulty — so the client path is honest; only the transport and the ack are
faked. When the backend lands, `mockLedger.ts` is the only file that changes shape.

`hash.ts` holds the solve rule on its own, outside the worker, so the same
function that finds a nonce can verify one — `scripts/verify.mjs` runs the exact
check the ledger will run server-side.

The FIND track hands work to the MAP track over the window, not over an import:

```
dig.ts  ──▶  window 'strata:map-event'  ──▶  main.ts  ──▶  regen.applyEvent
feed.ts ─────────────────────────────────────────────────▶  regen.applyEvent
window.StrataMap.applyEvent  ────────────────────────────▶  regen.applyEvent
```

Three producers, one sink, deduped by `cellId + ts`. That is deliberate: the MAP
track must not care whether a restoration came from this player, from the feed, or
from a debug button — which is exactly the seam a server-authoritative feed will
plug into.

## North star: Godot scene-streaming

The 150 m grid, the `P-<col>-<row>` ids derived from the bbox NW corner, and the
flat typed arrays are all chosen so a Godot client can stream the same cells this
canvas draws. A cell id is a pure function of the boundary file, so both clients
derive identical ids without coordinating. MapEvents are the only thing that
crosses the wire. When the LOD work in M6 merges 2x2 cells into superblocks below
1x zoom, that superblock is the same unit a Godot `Node3D` scene would load.
