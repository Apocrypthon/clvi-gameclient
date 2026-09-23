# STATE

**Last session: 2026-09-23. Repo is green: build, verify, and smoke all pass, and
CI enforces the first two.**

> **A second track now exists, and it is unratified.** `godot/` is the start of
> the 3D client (`docs/GODOT.md`). The browser client in `src/` is unchanged.
> **None of the Godot code has been run** — no engine was available in the
> session that wrote it. It is also out of contract with ADR-001, and this repo
> has drifted from the frozen Contracts v1 block. Both are under "Blocked".

## Blocked — two things need a human, not a session

**1. The Godot track is out of contract with ADR-001.** `clvi-architecture`
ADR-001 defers the Godot/Rust/Nakama stack and says moving to it *"requires a
superseding ADR, not a session's judgment call."* It also requires loop sessions
to verify with `npm run build` plus iPhone-viewport browser tests, and says a
stack that cannot be checked that way is out of contract with how the project is
operated — which is exactly why none of `godot/` has been run. The code is
written and documented; it is **not ratified**. Resolution is a human-merged ADR
in `clvi-architecture` (adopt, move to its own repo, or drop). See docs/GODOT.md.

**2. The browser client will not interoperate with the real backend.** The
live backend is `clvi-backend@claude/strata-ledger-bootstrap-csa88x` (Netlify
Functions + Supabase). Its source was read directly, and `src/mockLedger.ts`
does not match it. None of this is live yet — the client still talks to the mock
— so these are latent, but every one of them is a 400 the day the URL is
switched:

| | real backend | here |
| --- | --- | --- |
| difficulty start | **18** (`src/lib/difficulty.ts`) | `DEFAULT_DIFFICULTY_BITS = 17` |
| difficulty floor | **12** | `MIN_DIFFICULTY_BITS = 8` |
| difficulty ceiling | **24** | absent |
| who picks difficulty | **the server**, per player, auto-tuned ±1 toward a 3–6 s median | the client asks for a value |
| `POST /challenge` body | **`{playerId}`** only | sends `cellId` and `difficultyBits` too |
| challenge TTL | **90 s** | `CHALLENGE_TTL_MS = 120_000` |
| `nonce` in `Submission` | **string**, 1–64/128 chars, rejected if not | `number` in `src/contracts.ts` |

The `nonce` row is the sharpest: `requireNonce()` fails anything that is not a
string, so today's client would be rejected outright on every submit.

Caps do match (30 s per attempt, 60 solves/day). And A5's shape is right — the
real `/submit` returns a `mapEvent` exactly as the client already expects.

Note the 17 was not arbitrary; the bootstrap session measured it. But
CONTRACTS.md is explicit that canonical wins — *"a repo whose copy differs from
this block is out of contract, and reconciling it is that repo's next loop
item"* — and the client should not be picking difficulty at all, since the
server tunes it. Reconciling changes solve feel and the energy estimate, so it
wants its own increment with fresh measurements.

Also unreconciled: SEED.md's frozen block omits the canonical `Difficulty`,
`Caps`, `Integrity` and `Energy` lines and the `Account`, `LedgerEntry` and
`AuditReport` types; `src/contracts.ts` carries a local `SubmissionAck` that is
not a contract type.

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
| G1 world shell | **done, unrun** — sky, baseplate, camera fog (`docs/GODOT.md`) |
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

Run all three. The first two are cheap, have no external dependency, and are
**enforced by CI** (`.github/workflows/ci.yml`) on every pull request and every
push to `main`, on Node 20 and 22. The third is still manual — that gap is the
first housekeeping item below.

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

### GODOT (new track, see docs/GODOT.md)

1. **Open it in Godot 4 and fix what breaks.** The highest-value next step by a
   distance: the track is unexercised code. Everything below is speculative
   until someone has pressed play once.
2. **Resolved:** there is no client-side encryption envelope, by ADR-002 ("no
   key material on the device in the MVP"). `strata_client.gd` enforces TLS and
   documents the real model — Supabase OTP bearer for identity, server-side
   HMAC for ledger integrity. Nothing further to build here.
3. **A login flow.** `Session.open()` is the seam and the world already refuses
   to build without a session; nothing calls it yet.
4. **A player controller.** The camera is static and the baseplate already has
   collision waiting for one.

### Both / housekeeping

- **Reconcile with the real backend** (see Blocked #2) — the single highest-value
  item in this list. Take `nonce` → string first: it is a one-line type change
  and without it every submit is rejected. Then difficulty (stop choosing it
  client-side; the server tunes it), the `/challenge` body, and the 90 s TTL.
  Re-measure solve times after, since 17 → 18 doubles the work per solve.

- **Extend CI to the browser smoke test.** CI runs build and verify; nothing
  automated exercises the browser path, so an increment that breaks the dig or
  the reveal reaches `main` green. Blocked on a decision rather than on work:
  `npm run smoke` needs Playwright, which is deliberately *not* a committed
  dependency (docs/STATE.md#Verify explains why). Either add it as a devDependency
  and accept the install cost on every `npm ci`, or install it unsaved in a
  separate CI job that is allowed to be slower than the fast gate. Prefer the
  second — it keeps `npm ci` cheap for contributors — and keep the two jobs
  separate so a browser flake never blocks a typecheck.
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
