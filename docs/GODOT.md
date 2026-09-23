# GODOT

The 3D client track. `docs/ARCHITECTURE.md` has always named Godot scene-streaming
as the north star; this is the first code on that road. It is a **separate track**
from the browser client in `src/`, which stays TypeScript + Vite + Canvas 2D under
the frozen stack rules in CLAUDE.md. Nothing in `godot/` imports from `src/`, and
nothing in `src/` knows this directory exists.

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

## Transport: TLS enforced, payload sealing NOT implemented

`strata_client.gd` guarantees, before any socket opens:

1. the resolved URL is `https://` — an `http://` URL is **refused**, never
   silently upgraded or downgraded;
2. TLS options are the verifying defaults (bundled CA chain, hostname checked),
   and nothing in the file can switch verification off.

That is the whole of "every call is encrypted" in the ordinary sense.

**What is not implemented is application-layer sealing of the payload itself.**
The request that prompted this track asked for calls encrypted "via the strata
backend bootstrap brands". No such component exists anywhere in this repo — the
string `brand` appears only as a CSS class in `src/style.css`, and there is no
backend, no key exchange, and no envelope format defined in any doc here.

Rather than invent one, the client ships the guarantee it can make and marks the
gap:

- `_seal()` / `_open()` are identity functions and say so.
- `require_sealed` defaults to `false` so the client works over TLS today.
  Setting it `true` makes **every call fail** until `_seal()` is real — the
  switch exists so the gap can be made loud rather than forgotten.

Guessing at a crypto envelope would produce something that looks like security
without being any, which is worse than a documented absence. **Open question for
whoever knows the answer: what is "bootstrap brands"?** Likely candidates are a
term from another CLVI repo (`clvi-architecture`?), a name for a per-tenant key
bundle fetched at bootstrap, or simply TLS restated. Until it is answered, this
file is TLS-only and honest about it.

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
