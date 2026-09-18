# Wildshard singleplayer demo — engineering brief for feature agents

Read this fully before writing code. Several agents work in parallel **in the same checkout on
`main`** (no worktrees, no branches). Stay inside the files assigned to you.

## What we are building

A first-person, AAA-looking (PS5 / Skyrim SE / Conan Exiles quality bar) playtest of one
500 m × 500 m Wildshard *chunk*: a pine forest on a floating rock slab, three log cabins,
boars and deer to hunt with a crossbow. The frame is "you are playtesting your chunk before
uploading it": the HUD carries the Wildshard identity (dark glass panels, cyan `#8fe3ff`
accent lines, Rajdhani display font + JetBrains Mono labels, "PROJECT WILDSHARD" wordmark —
see `sources/progress.mp4` / `sources/citadel.mp4` frames). A ringed gas giant hangs in the sky.

Stack: Vite + TypeScript (strict) + three.js r186 + `postprocessing` + `n8ao`. 60 FPS is a hard
requirement: instance everything repeated, keep draw calls low, no per-frame allocations in hot
loops.

## Existing modules (do not modify unless told)

- `src/core/config.ts` — `CHUNK_SIZE=500`, `CHUNK_HALF`, `CHUNK_DEPTH` (fixed) and `SEED`, `TREE_COUNT`, `CHUNK_ID`,
  `CHUNK_COORDS` (live bindings of the active shard). Per-shard data lives in `src/chunks/*.ts` — see `docs/SHARDS.md`;
  `getActiveChunk()` from `src/chunks/registry.ts` gives you the whole def.
- `src/core/rng.ts` — `Rng(seed)`: `.next() .range(a,b) .int(a,b) .pick(arr)`; deterministic. Use it, not Math.random.
- `src/core/noise.ts` — `Noise2D(seed)`: `.get(x,y)` [-1,1], `.fbm(x,y,oct)`, `.ridged()`; `smoothstep, clamp, lerp`.
- `src/core/assets.ts` — `loadPBR(id, repeat)` → `{map, normalMap, armMap}` from `public/assets/tex/<id>/`
  (Poly Haven sets: diffuse.jpg / nor_gl.jpg / arm.jpg). `pbrMaterial(set, extra)` → MeshStandardMaterial
  wired for ARM. `loadGLTF(id)` from `public/assets/models/<id>/`. `loadTexture(url, srgb, repeat)`.
  Available texture ids: forest_ground_04, forest_leaves_02, leafy_grass, rock_ground, stony_dirt_path,
  pine_bark, wood_trunk_wall (log wall!), roof_planks, wood_planks_dirt, rough_pine_door, stone_wall,
  wood_planks_grey. Models: rock_moss_set_01, tree_stump_01, dead_tree_trunk, stone_fire_pit.
  You may add more CC0 Poly Haven assets by editing `scripts/fetch-assets.mjs` and running `pnpm assets`
  (only add to the lists; the script is idempotent).
- `src/world/Heightfield.ts` — **the terrain is a pure function**: `heightAt(x,z)`, `normalAt(x,z)`,
  `trailDistance(x,z)` (metres to nearest dirt trail centreline), `cabinMask(x,z)` (1 on cabin pads),
  `inChunk(x,z,margin)`, `CABIN_SITES` (`{x,z,rot}` ×3, pads are flattened), `TRAILS`.
  World is Y-up, XZ ground, origin at chunk centre, chunk spans ±250.
- `src/world/Sky.ts` — `sky.sunDir`, `sky.sunColor`, `sky.setupMaterial(mat)`.
  **Every lit material you create MUST go through `sky.setupMaterial(mat)`** (cascaded shadow maps
  patch the shader; a material that skips this gets lit three times over and looks blown out).
  Unlit materials (MeshBasicMaterial, ShaderMaterial, sprites) don't need it.
- `src/world/Atmosphere.ts` — global fog is injected through three's fog chunks. If your material has
  its own `onBeforeCompile`, call `attachFogUniforms(shader)` inside it, and set
  `mat.customProgramCacheKey = () => '<unique-name>'`.
- `src/world/TreeFactory.ts` — `windUniforms.uTime` (seconds), `patchWind(shader)` if you want the same sway.
- `src/world/Forest.ts` — `forest.trees` (`{x,y,z,r,height,…}`), `forest.nearby(x,z,radius)` for
  collision/placement avoidance.
- `src/player/Player.ts` — `player.position` (feet, world), `player.yaw/pitch`, `player.camera`,
  `player.forward`, `player.colliders: Collider[]` (push oriented boxes `{x,z,hw,hd,rot,yTop,yBottom}`
  to block walking), `player.onStep / onJump / onLand` callbacks, `player.keys` (Set of KeyboardEvent.code),
  `player.locked` (pointer lock). Eye height 1.68 m.
- `src/core/Game.ts` — `game.scene`, `game.camera`, `game.renderer`, `game.onUpdate((dt, t) => …)`,
  `game.stats.fps`. Post chain (N8AO, god rays, bloom, AgX tone map, SMAA) is built in `game.buildComposer()`.
- `src/core/bootstrap.ts` — `await bootstrap()` builds the base world and returns
  `{ game, sky, terrain, forest, player, params, num }`.

## Dev workflow

- The Vite dev server is **already running at http://localhost:5173** (HMR). Do not start another.
- Build your own entry to test in isolation: `dev/<feature>.html` (copy `index.html`, point the
  script at `/src/dev/<feature>.ts`) and `src/dev/<feature>.ts`:
  ```ts
  import { bootstrap } from '../core/bootstrap';
  const world = await bootstrap();
  // … add your feature to world.game.scene, register world.game.onUpdate(...)
  world.game.buildComposer(); world.game.start();
  ```
  Open it at `http://localhost:5173/dev/<feature>.html?x=..&z=..&yaw=..&pitch=..&nolock=1`.
- Screenshots are **headless only** (never `--headed`) via agent-browser, with your own session name:
  ```bash
  S=<feature>-agent
  agent-browser --session $S open "http://localhost:5173/dev/<feature>.html?nolock=1&x=0&z=-20&yaw=0&pitch=0"
  agent-browser --session $S set viewport 1600 900
  sleep 9   # let assets load
  agent-browser --session $S console | grep -v "vite\|deprecated\|PCFSoft" | tail
  agent-browser --session $S screenshot progress/<NNN>-<feature>-<what>.png
  agent-browser --session $S close   # when completely done
  ```
  You can drive the world from the console with `agent-browser --session $S eval --stdin` (the
  world object is exposed as `window.__world` by your dev entry — do that).
  Look at every screenshot you take (Read tool) and iterate until it genuinely looks AAA.
  Save milestone screenshots to `progress/` (numbered with your feature name); the main agent
  makes a timelapse from that folder.
- `npx tsc --noEmit` must pass before you commit.
- Git: commit early and often, **only your own files**: `git add <paths>` then `git commit`
  (never `git add -A`, never `git stash`, never rebase/reset/checkout other files). End commit messages
  with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. If a commit races with another agent's,
  just retry.
- Do **not** edit `src/main.ts`, `src/core/bootstrap.ts`, or files owned by other agents; the main
  agent integrates. Export a clean API and document it at the top of your module in a doc comment
  (constructor args, `build()`, `update(dt, playerPos)`, events).

## Quality bar

Photoreal PBR, correct scale (a boar is ~0.9 m at the shoulder, a cabin door 2.1 m), colour in
sRGB textures only (`colorSpace = SRGBColorSpace` for albedo, linear for data maps), shadows cast and
received on everything that matters, subtle motion everywhere (wind, breathing, flicker). If it looks
like a tech demo from 2010, keep going.
