# clvi-game-client

**STRATA** — the playable world. A browser client where players restore
Paradise, Nevada one 150 m cell at a time.

Canvas 2D, TypeScript, Vite. No map SDK, no tile server, one Web Worker.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit && vite build
npm run verify    # headless checks
```

Two tracks share this codebase: **MAP** renders and regenerates the valley,
**FIND** is the dig, the hash puzzle, and the reveal.

The hash puzzle is a **disclosed game mechanic, not a miner** — capped at 60
solves a day, battery-aware, hard-bounded at 30 seconds, and every artifact card
prints the estimated watt-hours the solve cost. The reasoning is in
[docs/ENERGY.md](docs/ENERGY.md).

Start with [CLAUDE.md](CLAUDE.md), then [docs/STATE.md](docs/STATE.md).
