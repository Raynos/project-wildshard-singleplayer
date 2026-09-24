# Driftwood (wildshard-singleplayer): engine-layer audit (E45)

Repo: `/Users/raynos/projects/games/wildshard-singleplayer` @ `b4abd3f`, 536 commits. Read-only audit, 2026-09-23.

## 0. Size and dependencies

| src/ dir | files | lines | what it is |
|---|---|---|---|
| world/ | 46 | 13 270 | procedural world builders (Cabin 1454, Wreck 724, TreeFactory 587, Sky 573, Grass 554, Undergrowth 529, Gulls 523, lowpolyKit 513, Interactables 490, Shrine 466…) + engine bits (Heightfield 57, Culling 168, Atmosphere 117, stylize 207, placement 250) |
| entities/ | 17 | 6 096 | AnimalManager 1070, Animal 806, AnimalFactory 427, 10 species files (226–361 each), Enemies 305, npc/Castaway 227 |
| player/ | 20 | 6 042 | Crossbow 1194, Sword 881, Rifle 604, Player 584, WeaponPickup 404, TouchControls 316, IronSword 314, AimAssist 215 |
| audio/ | 13 | 3 871 | Audio 978 (WebAudio graph + synth), Music 748, gen 597, IslandAmbience 388 |
| ui/ | 18 | 3 075 | DOM HUD 562, Menu 378, Minimap 369 (canvas2d), Feedback 315, Combat 257 (+1 010 lines CSS in ui/styles) |
| boot/ | 20 | 2 758 | boot plan, byte accounting, pack streaming, shader precompile, SW (607 + 377 lines are generated tables) |
| explore/ | 6 | 1 400 | god-mode FreeCam / TouchFly, Model Explorer, select |
| game/ | 12 | 1 224 | quest spine, inventory, progress, achievements |
| chunks/ | 8 | 1 139 | ChunkDef schema 267, driftwood-isle 218, pine-hollow 156, terrain compiler 133 |
| dev/ | 11 | 1 041 | per-feature harness pages (`dev/*.html`: animals, sword, enemies, grass, dive…) |
| core/ | 12 | 948 | Game loop 233, Volumetrics 197, assets 144, bootstrap 90, tier 84 |
| native/ | 6 | 663 | Capacitor OTA updates 441, save mirror 62 |
| fx/ | 2 | 206 | Impacts 137, LightPool 69 |
| main.ts | 1 | 640 | composition root |
| **total TS** | ~212 | **~42 400** | + pwa/sw.js 300, tests 2 094 (vitest, 17 files), scripts/*.mjs 2 129 |

Runtime deps (`package.json`): **three ^0.186**, **postprocessing ^6.39**, **n8ao ^2.0**, Capacitor 8 (core/app/ios/android/preferences),
@capgo/capacitor-updater, @vercel/blob, 2 fontsource fonts. Dev: gltf-transform, playwright, vitest 5, vite 8, TS 7, oxlint+tsgolint.
No physics, no ECS, no animation lib, no UI framework, no input lib, no audio lib, no navmesh. Only three/examples used: CSM, GLTFLoader, HDRLoader, BufferGeometryUtils.

Roughly **~8–9 k lines are "engine"** (core, boot, chunks framework, Heightfield/Culling/Atmosphere/stylize/placement, Player
controller, input, precompile, tier) and **~33 k are content** (models-in-code, species, weapons, quests, HUD screens, audio design).

## 1. Game loop and update ordering — thin, hand-rolled

- `src/core/Game.ts:208-231`: one rAF loop, **variable timestep only**. `realDt = min(0.1, clock.getDelta())`; hit-stop scales dt
  by 0.04 (`Game.ts:217`, `core/time.ts` `worldTime.realDt` for things that must keep moving). `THREE.Clock` (deprecated, oxlint-disabled `Game.ts:27`).
- `game.onUpdate(fn)` pushes into a flat array (`Game.ts:129`); order = registration order. 49 `onUpdate(` call sites. The real
  order lives in `bootstrap.ts:83` (player → forest) then one giant closure in `main.ts:556-615` calling ~30 `x?.update(dt…)` by hand
  (boundary, water, ocean, boat, palms, gulls, … animals, weapons, drops, HUD, minimap).
- `frameGate` (`Game.ts:38`, `main.ts:524`) skips whole frames under menus / rotate gate / review composer.
- Sub-rates are ad hoc: animal AI at **10 Hz staggered** with its own accumulator (`AnimalManager.ts:307,487`); `Player.update`
  clamps dt to 0.05 (`Player.ts:266`); no fixed physics step anywhere (PHYSICS.md plans a 60 Hz accumulator in `src/physics/Physics.ts`).
- No systems/phases (input → sim → late → render), no pause-aware time domains beyond hit-stop, no entity destroy lifecycle
  (34 `dispose()` calls across src; objects are mostly built once for the chunk's life).
- Quality: small and fine, but ordering bugs are "who registered first". An engine gives phases for free; this is cheap to write yourself.

## 2. Entity / object model — ad hoc classes + callbacks, no ECS

- Every thing is a class with `build()` → `{ group/mesh, colliders, floorHeightAt }` and `update(dt, …)`; wired by hand in
  `main.ts:117-210` (e.g. `player.colliders.push(...hut.colliders); player.platforms.push((x,z)=>hut.floorHeightAt(x,z))` repeated for
  hut, lookout, wreck, shrine, jetties, bridge, cove — `main.ts:149-201`).
- **Creatures** are the one real "entity system": `AnimalManager` owns every animal/enemy (list, 10 Hz think, per-frame animate,
  raycast, damage, onKill/onCharge/onSound hooks). Species are a plug-in registry — `import.meta.glob('./species/*.ts')`
  (`AnimalFactory.ts:12`), each file `registerSpecies({ build, variants, think?, animate? })`. Enemies (crab/monkey/sailor/captain)
  ride the same manager with `rig:'custom'` + own `think` (`Enemies.ts:13-30`). This is a good, agent-friendly pattern.
- **Interactables** are pure data: `InteractTable` rows (chest/key/door/lever/plate/barrel/pickup/beacon/bench/altar) talking only through
  string FLAGS + `Cond {all,any,none}` (`world/interact/types.ts:1-60`), statically validated (`validate.ts`, `test/interact.test.ts`).
  Placement is POI-local (`poi:'wreck', x, z, yaw` or model `anchor`). Strong, bespoke, engine-independent.
- Pickups: `WeaponPickup.ts` (404) / `IronSword.ts` classes with `onNear/onPickup` callbacks. Quests: `game/quest/*` (Adventure, Spine, Finale, Feats).
- Events are single-slot callbacks (`animals.onKill = …`, `player.onSubmerge = …`, `weapons.onFire = …`) — one listener each, `main.ts` is
  the only bus (`main.ts:354-480`). No event system, no scene graph queries, no tags/components.

## 3. World description, chunks, streaming, authoring

- **One 500 m chunk per shard, no streaming.** `ChunkDef` (`chunks/ChunkDef.ts`, 267) = plain data + pure fns (terrain field, assets,
  trees, fauna HerdPlans, sky, atmosphere, grade, spawn, ocean, `style:'pbr'|'lowpoly'`, weapon). Registry swaps defs; a shard switch
  is a page reload. Live `let` rebinding of `heightAt`/`normalAt` in `world/Heightfield.ts:14-43` (module-global state).
- Terrain: analytic noise functions **baked at build time** (`scripts/bake-chunk.mjs` → `public/assets/baked/<slug>/terrain.bin`,
  fingerprinted by `landscapeHash`), installed as bilinear lookups (`BakedTerrain.ts`, `Heightfield.ts:51`). Sky/cards/textures also baked.
- Levels are **code, not files**: POI constants (`WRECK`, `SHRINE`, `HUT`, `JETTIES`, `BRIDGE` in `chunks/driftwood-isle.ts`) + builder
  classes that generate geometry in TS (`lowpolyKit.ts`: `kit.add(box/log/rope/rock)` → one merged non-indexed mesh with baked AO,
  one shared material). Scatter = seeded RNG (`Bushes.scatterIsland(seed…)`, `Palms`, `placement.ts`). No prefab/scene file format,
  no editor. For code-writing agents this is a feature (diffable, typed, reviewable); an editor-centric engine would fight it.

## 4. Input and HUD/UI

- **No input layer.** Raw `keydown`/`mousemove`/`pointerlockchange` in `Player.ts:166-180` (`keys: Set<string>`), plus keydown/pointer
  listeners in ~25 files (Menu 7, TouchControls 5, FreeCam 4, HUD 3, Feedback 3, main.ts 4…). Touch writes straight into
  `player.touchMove/touchSprint/touchJump/touchDive…` and `weapons.tryFire()/adsHeld` (`TouchControls.ts:1-60`). No action map, no
  rebinding, **no gamepad** (0 hits for `getGamepads`). Pointer lock handled per call site.
- TouchControls (316) + AimAssist (215, friction/snap/tracking) + HUD-REFINEMENTS plan (115 lines of layout decisions, 5 rounds of mockups,
  E10/E11/E26/E27/E37/E42) — touch is the most-iterated UX surface (31 commits mention touch).
- HUD/UI: **DOM overlay** (`HUD.ts` "call setState every frame, it diffs"), CSS with a per-screen class prefix checked by
  `scripts/check-css.mjs` (a CI gate); Minimap/Map are canvas2d; world-space labels/health bars projected to DOM (`Combat.ts`, `LockOn.ts`).
  Hand-written `createElement`/`innerHTML`, no framework. Works and is cheap on phone; an engine UI would not be better for this.

## 5. Collision, movement, raycasts (pre-Rapier) — thin, the weakest subsystem

- 2.5D only (~800 lines per `project/archive/2026-09-23-physics.md:48-70`). Player: gravity/jump/double-jump, `groundAt` = `heightAt` + `platforms[]`
  callbacks (step-up ≤ 0.5 m), slope walk/slide via `normalAt` probes, wade/swim/dive with spring buoyancy, hoverboard spring
  (`Player.ts:1-60` constants, 584 lines). Horizontal collision `Player.collide()` (`Player.ts:560-583`): circle vs tree cylinders from a
  16 m grid (`Forest.nearby`) + circle vs Y-rotated boxes (`Collider {x,z,hw,hd,rot,yTop,yBottom}`). No capsule, no ceilings, no
  sweep (tunnelling possible at dash speed), no dynamic bodies.
- `Collider[]` is read by the player **only** (and by `MeleeSweep.segmentBlocked`, added later to stop sword hits through walls — B5,
  `Sword.ts:535-561`, `9cb21fa`). Animals: terrain follow + trunk repulsion + slope avoidance (`AnimalManager.ts:829-863`), **walk
  through every building and each other**, never stand on platforms. Bolts/bullets/coconuts go through walls, rocks and palms
  (PHYSICS.md:66-70).
- Weapon rays: `animals.raycast` = analytic ray vs head sphere + body capsule per animal with a sphere broad phase
  (`AnimalManager.ts:888-918`); bolt ballistics + trunk cylinder + terrain bisection in `Crossbow.ts:1184-1270`; rifle hitscan
  `Rifle.ts:249`. Only `explore/Select.ts` uses `THREE.Raycaster`. Hand integrators for coconuts, brass, blood, motes.
- Every new structure (hut, wreck, shrine, cove, bridge, jetty) hand-writes a `colliders` list + `floorHeightAt()` — duplicated effort per
  POI and a recurring bug source (B4 pick-up through the hull, B5 sword through walls, cove cave = solid box).
- **This is exactly what Rapier (already chosen, `project/archive/2026-09-23-physics.md`, `draft`, not started) replaces.** An engine would only
  give it via its own bundled physics (usually ammo/cannon/Rapier), i.e. no advantage over the plan.

## 6. Animation, models, materials, post, LOD

- **Skeletal but procedural.** Animals: bones generated in code per species (`species/*.ts` build → `BoneDef`s, `loft.ts` lofted
  bodies), `SkinnedMesh`, animation = weighted blend of procedural gait generators idle/graze/walk/trot/gallop with phase, foot-plant
  IK-ish terrain offsets (`Animal.ts:8,139,688-707`), attack/flinch/death params; custom species `animate(ctx)`. No `AnimationMixer`,
  no clips, no GLB characters. Sword: keyframed swing poses in code (`SwordMoves.ts`), camera kick/shake/hit-stop (C2/C3).
- **Models:** Driftwood is ~100 % procedural TS geometry (lowpolyKit, TreeFactory, Cabin 1454 lines…); only Pine Hollow loads GLB props
  (`core/assets.ts` GLTFLoader, 9 Poly Haven models, 19 MB) and PBR textures (66 MB source, tiered by `scripts/tex-tiers.mjs`).
- **Materials:** stock MeshStandard/Physical **patched globally via ShaderChunk overrides** — `Atmosphere.ts` (height+distance fog on
  every fogged material), `stylize.ts` (toon 2-band ramp + rim patched into `lights_physical_pars_fragment`), CSM chunk patch (`Sky.ts:74`);
  plus ~60 `onBeforeCompile`/ShaderMaterial sites (TreeFactory 8, Sky 7, Cabin 7, Sword 6…). Deeply tied to three's WebGLRenderer
  internals and r186 program cache keys. Would not survive a move to an engine with its own material system without a rewrite.
- **Post:** `postprocessing` EffectComposer, one merged EffectPass (god rays, bloom, vignette, AGX tone map, HSL, contrast, custom
  `GradeEffect`, custom `VolumetricsEffect` 197), optional N8AO, SMAA (`Game.ts:78-127`). Tiered.
- **LOD/instancing:** custom per-instance frustum+distance culling for InstancedMesh (`Culling.ts` `CulledInstances`), BatchedMesh forest
  with own LOD bucketing (`Forest.ts:38,80`), hi/lo/far tree cards, animal draw-LOD 3→2→1 draws, fur shells within range, ring-buffered
  grass/ground cover around the player; 15 files use InstancedMesh. No `THREE.LOD`. Pooled point lights (never add/remove, `fx/LightPool.ts`).
  These are mature and hard-won (PLAY-PERF: phone ≤ 150 calls / ≤ 2 M tris at all poses).

## 7. Asset loading, boot, caching

- **Strong and bespoke.** `boot/plan.ts` (241): typed step plan with two monotone progress tracks (setup vs bytes), per-device learned step
  durations (`timing.ts`), `Plan<Remaining>` makes a dropped step a compile error. `pack.ts`: one content-addressed per-tier boot pack
  (`public/assets/packs/driftwood-isle.phone-*.bin`) streamed and sliced, answering `fetch()` of packed paths. `precompile.ts` (315):
  builds every program (scene × object flags, shadow-depth variants, background, post) before frame 1 with KHR_parallel_shader_compile
  polling, then `firstFrame()` — solving 10–17 s iOS Metal compile stalls. Boot steps sliced into ≤ 30 ms tasks. `pwa/sw.js` + `boot/sw.ts`
  offline SW; PRELOAD-OFFLINE plan in progress. Budgets met: title 0.46 s, 2.38 MB, 17 requests, cold 4G 4.29 s (archive load-perf).
- Engines add their own loaders/asset DB; none of the three.js-layer engines matches this boot pipeline on phone. Keep.

## 8. Audio, save, settings, dev tools, native

- Audio: own WebAudio graph (`Audio.ts` 978: buses, muffle filter, synth fallbacks), sample banks (Stable Audio 3 sets, `preload.ts`),
  stem music with states (`Music.ts`, `Stems.ts`), zoned ambience emitters, reverb rooms, underwater (`IslandAmbience.ts`). Manual pan
  by `(pos, playerPos, yaw)` rather than PannerNode/listener. Bespoke content; an engine's audio would be a thin wrapper at best.
- Save: localStorage `ws.*` keys per system (Progress, Inventory, Skins, Settings, flags, gfx prefs, boot timings), mirrored to Capacitor
  Preferences in native (`native/saves.ts`). No versioned save schema/slots. Settings: `ui/Settings.ts` typed get/set/on with clamps.
- Dev tools: 11 `dev/*.html` harness pages reuse `bootstrap()`; `?explore=` god mode (FreeCam/TouchFly), Model Explorer turntable
  rendered through the real composer (`explore/ModelExplorer.ts`); URL params (`?x,z,yaw`, `?tier`, `?touch`, `?nolock`, `?perfload`,
  `?nopost`, `?nopack`); in-game review inbox with frame capture → Vercel Blob (`ui/Feedback.ts`, `pnpm inbox:pull`). Very good for agents.
- Native: Capacitor shells + signed OTA channel (`native/updates.ts` 441).

## 9. Perf tooling and budgets

- `bench.budget.json` (8 load rows, CI via `scripts/bench-load.mjs --ci`), `progress/bench/latest.md`, `boot/perflog.ts` (per-phase
  program lists, `?perfload=1`), on-screen `ui/Perf.ts` meter (p50/p95 from `Game.frameMs` ring, calls, tris, GL context-loss counts),
  `core/tier.ts` phone/desktop knob table (every value measured in PLAY-PERF). Program count tracked like a budget (103 → 73 on phone).

## 10. Recurring pain points (git log, plans, asks)

- **Shader programs / compile stalls** — 29 commits; a whole plan (LOAD-PERF) spent on program dedupe (uniforms not defines, shared map
  slots, fogless clearers, one viewmodel program), precompile, r186 `PCFSoftShadowMap` cache-key doubling (`Game.ts:145-149`), point lights
  added mid-play recompiling everything (B7, programs 75→137, fixed by LightPool `c282abe`). This is WebGL/three internals, and an engine on
  three.js inherits it rather than solves it.
- **Load time / boot** — 71 commits (packs, baking, slicing, SW). Solved to budget; would be at risk in a migration.
- **Perf / draw calls** — 58 commits (PLAY-PERF): merging, batching, culling, tier knobs.
- **Deploy/CI hygiene** — 85 commits (Vercel quota, `.vercelignore` dropping `src/explore/art`, pre-push tree gate). Not engine-related.
- **Touch HUD / controls** — 31 commits + 5 mockup rounds; UX churn, not engine churn.
- **Collisions** — few commits by name but the E7 audit's bug list is collision-shaped: B4 pickup through hull, B5 sword through walls,
  animals through buildings, projectiles through everything; each new POI re-writes colliders + floorHeightAt. PHYSICS plan exists.
- **Wiring sprawl** — `main.ts` 640 lines of hand wiring; single-slot callbacks force every cross-system hook through it; concurrent
  agents collide there.

## 11. Verdict: strong/bespoke vs thin/free-from-an-engine

**Strong, bespoke, hard to replace (keep):**
1. Boot pipeline: plan/progress, packs, bake scripts, shader precompile, SW/offline (~3 k lines + scripts) — beats any engine's loader on phone.
2. Render tuning: global ShaderChunk patches (fog, toon), CSM, merged post chain, per-instance culling, BatchedMesh forest LOD, tier table.
3. Procedural content kits: lowpolyKit + builders, species registry + procedural rigs/gaits, TreeFactory — code-first, agent-friendly.
4. Data-driven interactables + flags + validator; ChunkDef schema; quest spine.
5. Dev/review tooling: dev harness pages, Explore/Model Explorer, feedback inbox, perf meter, bench budgets.

**Thin or missing (an engine would give these; most are also small libraries):**
1. Physics/collision/character controller/navmesh — biggest gap; Rapier plan (`PHYSICS.md`) covers it.
2. Game loop phases + fixed timestep + interpolation — ~150 lines, planned inside Physics.ts.
3. Entity/component + event bus to shrink `main.ts` wiring (a lightweight ECS like miniplex/bitECS, or a typed event emitter).
4. Input action map (keyboard/mouse/touch/gamepad → actions, rebinding) — none today, listeners in ~25 files, no gamepad.
5. Animation clips/state machine (only if GLB characters ever arrive; procedural rigs don't need it). Spatial audio via PannerNode.

Engine migration would discard (1)–(5) of the strong list (they hook three's WebGLRenderer internals directly) to gain items that are
each a library or a few hundred lines. Evidence favours **option (b): three.js + Rapier + borrow components** (fixed-step loop,
ECS/event bus, input action map, navmesh via the planned navcat).
