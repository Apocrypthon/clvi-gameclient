# GODOT

The 3D client track. `docs/ARCHITECTURE.md` has always named Godot scene-streaming
as the north star; this is the first code on that road. It is a **separate track**
from the browser client in `src/`, which stays TypeScript + Vite + Canvas 2D under
the frozen stack rules in CLAUDE.md. Nothing in `godot/` imports from `src/`, and
nothing in `src/` knows this directory exists.

## Status: out of contract with ADR-001, pending a human decision

`clvi-architecture` ADR-001 defers the Godot stack and is explicit about who may
un-defer it:

> The Godot/Rust/Nakama stack is not rejected — it is deferred and recorded.
> **Moving to it requires a superseding ADR, not a session's judgment call.**

This track was added on request, and the code is here and coherent — but that
sentence means a loop session cannot ratify it. ADR-001 also requires that loop
sessions verify work with `npm run build` plus browser tests on an iPhone-profile
viewport, and *"a stack that cannot be checked that way from a phone is out of
contract with how this project is operated"* — which is precisely the problem
this track hit: none of the GDScript below has ever been run.

Resolving it is a human action in `clvi-architecture`: merge a superseding ADR
that moves Godot from graduation path to current stack, or decide this track
belongs in its own repo, or drop it. Until then, treat `godot/` as unratified.

## What is here

```
godot/project.godot              autoloads Session and StrataClient
godot/world/paradise_world.gd    blue sky, white baseplate, fog on the camera
godot/world/paradise_world.tscn  a one-node shell that attaches the script
godot/net/session.gd             the signed-in session, in memory only
godot/net/strata_client.gd       TLS-enforced transport to the backend
```

Open `godot/` in Godot 4 and press play. The whole world is composed in
`_ready()` — there is nothing authored in the editor to drift out of sync with
the script.

## The scene

- **Sky.** A `ProceduralSkyMaterial` on an `Environment` in `BG_SKY` mode, with
  ambient light sourced from the sky so the baseplate is lit by it.
- **Baseplate.** A 512 m `PlaneMesh`, white `StandardMaterial3D`, plus a
  `StaticBody3D` with a matching box collider — a baseplate you fall through is
  a bug, not a look.
- **Fog on the camera.** The `Environment` is assigned to `Camera3D.environment`
  rather than to a `WorldEnvironment`.

  One Godot behaviour worth knowing before editing this: **a `Camera3D`
  environment replaces a `WorldEnvironment` rather than layering with it.** So
  "sky on the world, fog on the camera" is not a thing you can express — the
  camera environment would win and the sky would vanish. Both live in the same
  resource for that reason.

  Two fog properties (`fog_mode`, `fog_sky_affect`) only exist in Godot 4.3+, so
  they are probed via `_has_property()` and skipped on 4.0–4.2.

## Login

`paradise_world.gd` is what sits behind the login wall. `_ready()` checks
`Session.is_active()` and, if there is no session, emits `entry_denied` and
builds **nothing** — the world is not composed and then hidden, it is not
composed at all. A login flow that obtains a session calls `build()` directly.

**There is no login UI, and no auth backend, in this repo yet.** `Session.open()`
is the seam a login flow calls. What issues that token is undecided — see the
open question below.

## Session persistence: none, deliberately

`session.gd` contains no persistence at all. No `FileAccess`, no `ConfigFile`,
nothing under `user://`, no "remember me", no cached last-username. Quitting or
crashing loses the session and the next launch starts at login.

The honest limit, stated in the file too: GDScript strings are immutable and
garbage-collected, so dropping the reference on `close()` releases it but cannot
scrub the bytes from process memory. *Not saving* it is enforceable here;
*zeroing* it is not. If the threat model needs the second thing, that is a
different design (native buffer, or never holding a bearer token client-side).

## Transport: TLS, and no client-side envelope (by contract)

`strata_client.gd` guarantees, before any socket opens:

1. the resolved URL is `https://` — an `http://` URL is **refused**, never
   silently upgraded or downgraded;
2. TLS options are the verifying defaults (bundled CA chain, hostname checked),
   and nothing in the file can switch verification off.

There is deliberately **no application-layer encryption envelope**, and that is
a contract decision rather than an omission. From `clvi-architecture`
ADR-002: *"No key material is generated, stored, or asked for on the device in
the MVP."* An app-layer seal needs a client-side key, so adding one would put
this client out of contract.

The actual security model of the system, read out of `clvi-architecture` and
`clvi-backend`:

| concern | mechanism | where |
| --- | --- | --- |
| confidentiality in transit | TLS | here, enforced |
| identity | Supabase email OTP → bearer token, display id `GRD-xxxxxx` | ADR-002 |
| ledger integrity | HMAC-SHA256 over canonical JSON, `prev_hash` chain | ADR-004, server-side only |
| secrets | `SUPABASE_SERVICE_ROLE_KEY`, `LEDGER_SECRET` | server env only, never the client |

**Origin of this section.** The request that started this track asked for calls
encrypted "via the strata backend bootstrap brands". The string `brand` does not
appear in `clvi-gameclient`, `clvi-architecture`, or `clvi-backend`. The nearest
real things are the row above — plus, possibly, the backend's own bootstrap
*branch* (`claude/strata-ledger-bootstrap-csa88x`). Nothing was invented to fill
the gap; if a sealing scheme is later ratified, it arrives as a CONTRACTS.md
amendment and a superseding ADR, not as a client-side guess.

## Not done

- No player controller — the camera is static. The baseplate has collision
  ready for one.
- No cell streaming. The 150 m `P-<col>-<row>` grid the browser client draws is
  the unit a Godot `Node3D` scene would load (`docs/ARCHITECTURE.md`); none of
  that is wired up.
- **Nothing here has been run.** No Godot binary was available in the session
  that wrote it and no route to fetch one, so this is unexercised code checked
  against the Godot 4 API by reading. Indentation and delimiter balance were
  checked mechanically; behaviour was not. Expect to fix something on first open.
