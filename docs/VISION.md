# VISION

## The premise

Paradise, Nevada is the unincorporated town that holds most of the Strip, UNLV,
and Harry Reid International. Four million-odd visitors a month pass over ground
that is, archaeologically speaking, one of the fastest-accreting sites in North
America. A pull-tab stratum dates to a decade. A cancelled die dates to a house.
Casino carpet fibre outlasts the casino.

STRATA is a browser MMO-tycoon where players restore that ground. You dig a cell,
you solve a small puzzle that makes the find *real*, and the cell blooms — and the
bloom spreads to its neighbours. Verified finds mint Guardian tokens.

## What this repo is

The playable world. Two tracks, one codebase:

**MAP** — Paradise rendered as ~4,800 cells of 150 m each, drawn in Canvas 2D with
no map SDK and no tile server. Littered ground is desaturated sand and ash. A
restored cell saturates into a Holi pigment and pushes a fraction of that colour
into the cells around it, every tick, forever. Restoration is contagious. The map
heals outward from every find, and you can see the shape of where people have been.

**FIND** — press and hold a cell for 600 ms, the ring fills, the ledger issues a
challenge, and one Web Worker looks for a nonce whose SHA-256 has enough leading
zero bits. The screen shimmers at the rate you are hashing. When it lands, pigment
bursts and the artifact card rises out of it, carrying the estimated watt-hours the
solve cost.

## Why the puzzle exists

Not for security, and emphatically not for yield. It exists so a find has a cost
that the player feels and can point at. A tap is free; a solve is not. The token
minted from a find carries the number of hashes and the milliseconds that produced
it, and the card says what that probably cost in watt-hours.

Which is exactly why the mechanic has to stay honest:

- **Disclosed.** Every card prints its energy estimate and links to the assumptions.
- **Capped.** 60 solves a day, client-side, as a courtesy rather than a wall.
- **Battery-aware.** Under 20 %, the client asks for a two-bit-easier challenge
  before it starts, not after it has drained you.
- **Bounded.** 30 seconds is a hard cap. On the cap the client asks for a fresh
  challenge four bits easier. The dig never bricks and never grinds.
- **Small.** One worker. WebCrypto only. No wasm. The ceiling is deliberate.

If STRATA ever reads as a miner wearing a game's clothes, the design has failed,
regardless of what the code does.

## Scope discipline

Paradise, NV only. Not Las Vegas the city, not Clark County, not "the Strip" as a
vibe — the CDP boundary, which notches around Winchester and stops at Sahara. The
whole point of a service area is that it has an edge.

## North star

These cells are meant to stream. The 150 m grid, the flat typed arrays, and the
`P-<col>-<row>` id scheme exist so that a Godot client can one day scene-stream the
same cells this canvas draws, from the same ids, over the same MapEvents. See
`docs/ARCHITECTURE.md`.
