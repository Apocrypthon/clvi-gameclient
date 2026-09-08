# GODOT-CLIENT — `Paradise Reclaimed/`

A Godot 3.6.2 (GLES2) client tree, added on branch
`claude/paradise-reclaimed-client`. It is **not** part of this repo's Vite build
and nothing in `src/` imports it.

## Read this before building on it

**This tree conflicts with `SEED.md`'s frozen stack rules**, which say
TypeScript + Vite, Canvas 2D. Godot appears in `docs/ARCHITECTURE.md` only as a
*north star* ("Godot scene-streaming these cells"), not as the current stack.
This directory was added on explicit instruction, on a branch, with that conflict
understood. **It needs a recorded decision in clvi-architecture before it merges.**

It is also a **different game from the one this repo implements**. The tree
mirrors `clvi.cc/Clean Ascension` — a litter-sorting loop against the clvi.cc
axum server (`/action/collect`, `/player/state`, `/remediation/process`) with
Nakama realtime. It does *not* use STRATA's `P-<col>-<row>` cell ids, the
Challenge/Submission/MapEvent contracts in `src/contracts.ts`, or the boundary
file in `data/`. Aligning the two is unstarted work.

## What it is

| Path | Role |
| --- | --- |
| `Paradise Reclaimed/project.godot` | GLES2, ETC1, four autoloads, input map |
| `game/src/app/` | session, transport, routing — `AppState`, `Services`, `HttpService`, `NetService`, `SceneRouter`, `Bootstrap`, `FadeLayer` |
| `game/src/ui/` | presentation only — `DebugHUD`, `LoginPresenter`, `HudPresenter` |
| `game/src/world/` | simulation — `WorldController`, `SortingController`, `CellController`, `LitterSpawner`, `PlayerController`, `DollyController` |
| `game/scenes/{app,ui,world}/` | one scene per script, same layer, same name |
| `tests/run_tests.gd` | headless `SceneTree` gate, no framework, no network |
| `addons/com.heroiclabs.nakama/` | vendored Nakama client, tag `v3.3.1` (the Godot 3 line) |

Layering rule: a scene at `game/scenes/<layer>/X.tscn` has its script at
`game/src/<layer>/X.gd`; UI screens nest in `game/src/ui/screens/`. The `world`
layer never reaches `ui` directly — it emits signals that `WorldController` binds.

## Commands

```
make check        # parses every script (needs Godot 3.6.2 on PATH)
make test         # offline unit gate
make export-web   # HTML5 -> build/web/
make serve        # serves build/web on :8080
```

## Provenance and deviations from clvi.cc

`clvi.cc` targets Godot 3 (`config_version=4`, `format=2` scenes, GLES2) but most
of its GDScript is Godot 4 syntax and does not compile on 3.6.2. Only
`DollyController.gd`, `player_unlit.shader`, the scenes and `project.godot` were
already correct. Everything here is written in the 3.6 dialect. Specific changes:

- `NakamaClient.gd` → `game/src/app/NetService.gd`: dialect port. Op codes 1 and
  2 preserved.
- `SortingLogic.gd` → `game/src/world/SortingController.gd`: dialect port, and it
  now emits `token_progress_earned` instead of walking `get_parent()` to find a
  Nakama node.
- `LoginPresenter.gd`: the source mixed both dialects in one body. It also posted
  to `/auth/login`, which is not in `server/src/routes/mod.rs` and would 404 —
  auth now goes through Nakama device auth, and the returned `user_id` becomes the
  `x-player-id` the axum `session_middleware` actually reads.
- `SceneRouter.gd`: `emit_signal()` for the Godot 4 `.emit()`; return type dropped
  from `_load_scene_async` (a coroutine returns `GDScriptFunctionState`).
- `Main.gd` and `Spatial.tscn` were **not** ported. `Spatial.tscn` is a single
  empty node and `Main.gd` addresses five children that do not exist in it.
  `Bootstrap`, `SceneRouter` and `WorldController` split its responsibilities.
- `World_Main.tscn` is referenced by the source's `SceneRouter` but absent there;
  it is authored here.
- `UIViewport.tscn`'s missing `assets/ui/ui_backdrop_atlas.png` reference was
  dropped rather than faked.

## Server-side blockers (all in clvi.cc, none fixable from this repo)

1. **No CORS layer.** `server/src/main.rs` mounts only `session_middleware`; there
   is no `CorsLayer` and `tower-http` is not a dependency. Every request from the
   HTML5 build is cross-origin and fails preflight. Either add `CorsLayer` or serve
   `build/web/` same-origin with the API (`make serve` is set up for the latter).
2. **`docs/godot-client.md` has the wrong base URL.** It says
   `http://localhost:3001/api`; `routes::router()` is merged at the root and
   `AppConfig::from_env` defaults the port to 3000. This tree uses
   `http://127.0.0.1:3000`.
3. **`/auth/login` does not exist.** See the `LoginPresenter` note above.
4. **`Idempotency-Key` is documented but not implemented.** `handle_action` inserts
   into `player_actions` unconditionally, so the retry the docs recommend
   double-counts. This client sends the header regardless.

## Verification status

**Godot is not installed in the environment this tree was authored in, so
`make check`, `make test` and `make export-web` have never been run.** What *was*
verified is static and recorded in the commit: every `ext_resource` and `preload`
path resolves, every autoload target exists, every `$NodePath` a script addresses
is present in its scene, and no Godot 4 construct survives in any `.gd` file.

Running the three make targets on a machine with Godot 3.6.2 is the first job for
whoever picks this up.
