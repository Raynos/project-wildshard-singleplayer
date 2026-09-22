# Plan: Rapier physics — one collision world for everything in both shards

**State:** `draft` 2026-09-22 — the user's picks are in (E21): **Rapier 3D, committed, no switch**; both shards;
every model / weapon / item / enemy collides. Waiting on the user's go (and the 3 picks under Decisions) before P0.
Nothing built.

## Decisions made (the user, 2026-09-22)

- **Engine: Rapier 3D** (`@dimforge/rapier3d-simd`, single-threaded). Research: E20 (below, §Why Rapier).
- **Commit to it — not switchable.** No `?physics=` toggle and no custom fallback: each phase **deletes** the
  hand-rolled code it replaces in the same commit. The **P0 baseline** is the comparison instead of a live switch.
- **Both worlds** — Pine Hollow and Driftwood Isle.
- **Everything collides** — terrain, every structure and prop, the player, every weapon and projectile, every
  item and pickup, every animal and enemy.

## Where we start (surveyed 2026-09-22)

No physics library. ~800 lines of hand-rolled 2.5D physics — circles and Y-rotated boxes in XZ, plus
`heightAt()` sampling of the baked 256² grid (500 m chunk, ~2 m cells):

| Hand-rolled today | Where |
|---|---|
| Player controller: gravity, jumps, `groundAt()` + `platforms` callbacks, `collide()` circle-vs-trunk / circle-vs-box | `src/player/Player.ts:10,218,469` |
| `Collider` boxes typed as numbers + `floorHeightAt` per structure | `Cabin.ts:545,1338` · `Pier.ts` · `Boat.ts` · `Wreck.ts` · `Hut.ts` · `Lookout.ts` · `Shrine.ts` · `Cove.ts` · `Palms.ts` · `Trailside.ts` · `RopeBridge.ts` · `Boulders.ts` · `Props.ts` |
| Animal ground-follow, steer / confine / wander, stagger, keyframed death + corpse IK | `Animal.ts:279-519,611` · `AnimalManager.ts:682-807` |
| Ray vs animal sphere + capsule | `AnimalManager.ts:824-981` |
| Bolt ballistics, rifle hitscan, trunk cylinder + terrain bisection | `Crossbow.ts:1184-1270` · `Rifle.ts:280-320` |
| Coconuts, brass, blood, pickup motes (hand integrators) | `Enemies.ts:191-262` · `Rifle.ts:489` · `AnimalManager.ts:185` · `WeaponPickup.ts:388` |

`Collider[]` is read by `Player.collide()` **only**, so today bolts / bullets / coconuts / the sword go through
walls, rocks and palms; doors and pickups work through walls; animals walk through every building and each
other and never stand on a platform; the cove cave is a solid box; stumps and logs aren't solid; the boat
bobs but its floor doesn't; deaths are canned poses.

## Architecture (the contract every phase builds on)

**`src/physics/`** — the only module that imports Rapier:

| File | Owns |
|---|---|
| `Physics.ts` | `initPhysics()` (async, once, at boot), the `World`, a **fixed 60 Hz step** with an accumulator (max 3 substeps; render interpolates dynamic bodies), `dispose()` on shard change |
| `groups.ts` | collision groups: `WORLD` · `PLAYER` · `CREATURE` · `HITBOX` · `PROJECTILE` · `ITEM` · `DEBRIS` · `SENSOR` and who hits whom (debris never hits the player; projectiles hit world + hitboxes; creatures hit world + player + each other) |
| `shapes.ts` | builders: `heightfieldFromBaked(grid)`, `cuboid`, `capsule`, `convexHull(geometry)`, `trimesh(geometry)`, and `fromMesh(object3d, kind)` for the procedural builders |
| `surface.ts` | a `Surface` tag on every collider (`wood` · `stone` · `sand` · `dirt` · `flesh` · `metal` · `water` …) — drives bolt sticking, impact FX, footstep sounds |
| `query.ts` | the game's one query API: `castRay`, `castShape` (sword arc, bolts), `overlap` (interact, blast), `lineOfSight`, each with a group mask, returning `{ point, normal, distance, surface, owner }` — `owner` is the animal / door / pickup behind the collider |
| `Character.ts` | the player's `KinematicCharacterController` capsule (autostep, snap-to-ground, slope limits, platform carry) |
| `debug.ts` | `?physics=debug` draws `world.debugRender()` lines — the authoring tool for every collider below |

Rules:

- **Game feel stays ours; collision is Rapier's.** Hover spring, swim buoyancy, wade hysteresis, double jump,
  landing impulse, stagger curves stay game code on top of the controller's move. Nothing re-hand-rolls a
  collision test outside `src/physics/`.
- **`heightAt()` stays for placement and rendering** (trees, grass, props, decals). It stops being physics.
- **Water isn't a fluid.** `waterLevel` / `pondMask` keep driving swim / wade; floating items get a small
  buoyancy force from them.
- **Collider authoring, cheapest first:** a primitive where the shape is a box / capsule / ball; a convex hull
  where it's a solid rock or crate; a trimesh only where you walk *inside or over* irregular geometry (wreck
  hull and deck, cove cave, shrine dais, hut stairs). Built in `slicer()` slices like the meshes; if a shard's
  collider build busts the 100 ms long-task budget, P9 bakes them into `public/assets/baked/<slug>/colliders.bin`.
- **Loading:** the plain `.wasm` (not the base64 `-compat` build: +33 % bytes and a blocking decode), streamed with
  `WebAssembly.instantiateStreaming` during the title screen, `application/wasm` in `vercel.json`, in the
  service worker's asset index and the boot plan's byte counter; non-SIMD build only if P1 finds an
  iOS < 16.4 device we support.
- **Single-threaded forever**: Capacitor never gets `crossOriginIsolated` (iOS `capacitor://`, Android WebView),
  so no WASM threads and no physics worker — the controller needs synchronous answers each frame anyway.

## Phases

Each phase ships on its own: commit → CI green → live → evidence in the row. **Budgets gate every phase**
(below); a phase that busts one doesn't land until it's back under.

| # | Phase | Delivers | Deletes | Evidence it landed |
|---|---|---|---|---|
| **P0** | **Baseline** (before a line of Rapier) | `pnpm bench:ci` phone tier both shards (cold/warm, wifi/4G), PLAY-PERF counts at every §0 + Driftwood pose, per-frame JS ms of `Player.update` + weapons + `AnimalManager.update` (4× CPU), JS / total bytes, and **walk clips** of the fixed route per shard (pier → hut stairs → bridge → lookout → wreck deck; gate → cabin porch → pond) | — | `docs/plans/PHYSICS.md` §Baseline table + `progress/physics/p0-*.webm`; the numbers every later row is measured against |
| **P1** | **Engine in** | `src/physics/` skeleton; streamed WASM load at the title; fixed-step loop wired into `Game.ts`; terrain **heightfield** from the baked grid; 4 chunk-edge walls; `?physics=debug` | the invisible-wall clamp (`Player.ts` `lim`) | WASM bytes + init ms in the bench (phone tier); heightfield vs rendered mesh ≤ 2 cm over 10 k samples (the triangle diagonal must match `PlaneGeometry`'s); debug screenshot per shard |
| **P2** | **Player on the controller** | `Character.ts` capsule; walk / sprint / crouch / jump / double-jump / land on the KCC; hover + swim branches drive the KCC's desired move | `groundAt()`, `collide()`, the trunk-circle + OBB code | P0 walk route replayed: same speeds, jump height, landing impulse; no stuck spots; clip beside the P0 clip |
| **P3** | **Pine Hollow static world** | 1 770 trunk capsules (from `Forest`), 3 cabins (walls, chimneys, rails, furniture, porch + floors as colliders, **doors as kinematic bodies** that swing), 380 boulders (hulls), 70 stumps + 55 logs (capsules / hulls — solid for the first time), ferns / grass none | every `Collider` + `floorHeightAt` in `Cabin.ts`, `Props.ts`, `Boulders.ts`; `Player.colliders` / `platforms` | debug-draw screenshots at gate / cabin / pond; a door that blocks shut and swings open; can't walk through a stump |
| **P4** | **Driftwood static world** | pier + 3 jetties, **boat as a kinematic body** on its bob (floor moves with it), hut (deck, stairs, walls), lookout (platform, ramp), wreck (hull + tilted deck trimesh), shrine dais, **cove cave as a trimesh you can walk into**, palms (capsules), trailside posts / fences / signs, rope bridge (static walk surface; sway stays visual), shore rocks (hulls), coral heads the swimmer bumps | every `Collider` + `floorHeightAt` in the 11 Driftwood world files | debug screenshots at the 4 Driftwood poses; stand in the boat while it bobs; walk into the cave |
| **P5** | **Weapons and queries** | crossbow bolts `castShape` per substep against world + hitboxes (stick in wood by `Surface`, glance off stone), rifle hitscan `castRay`, **sword + iron sword swing as a shape sweep** (walls stop it), aim assist + interact + pickup gated by `lineOfSight`, impact FX / sounds by `Surface` | `segmentCylinder`, terrain bisection in `Crossbow.ts` / `Rifle.ts`, distance-only interact in `main.ts:436` | a bolt stuck in a cabin wall and in a palm; no hit through a wall; no door opened through a wall; clips |
| **P6** | **Creatures collide** | every animal and enemy (deer, boar, crab, monkey, drowned sailor) = a kinematic capsule moved by the KCC (walls, rocks, platforms, each other, the player); **hitboxes** (head ball + body capsule, per bone where rigged) as `HITBOX` colliders; boar charge + crab pinch as contact events against the player capsule; knockback / stagger through the KCC so it stops at walls | `AnimalManager.raycast` sphere / capsule math, `confine`'s trunk push-out, `CHARGE_HIT_DIST` check | a boar that charges into a cabin wall and stops; crabs walking round rocks; headshot rate unchanged vs P0 on the dev showcase |
| **P7** | **Items and debris are bodies** | coconuts (thrown, bounce, roll down the beach, float), rifle brass, loot / carcass drops, weapon pickups settle on what's under them, blood droplets ray-land on any surface; sleeping + a per-tier cap on live dynamic bodies | the hand integrators in `Enemies.ts`, `Rifle.ts`, `WeaponPickup.ts`, `AnimalManager.ts` BloodFX landing | a coconut rolling down the dune into the water (clip); brass on the pier deck, not under it |
| **P8** | **Ragdolls** | per-species ragdoll (capsules on the rig's bones, spherical / revolute joints with limits), blended in from the death pose, frozen to a static pose once asleep; the hit's impulse throws it; tier cap (phone: 2 live ragdolls) | the keyframed death blend + `settleCorpse` IK in `Animal.ts:440-519` | clip per species: a deer dying down a slope, a crab flipped by the sword, the sailor falling off the wreck deck |
| **P9** | **Re-baseline and close** | P0's measurements re-run on the final build; `progress/bench/latest.md` and PLAY-PERF / LOAD-PERF numbers updated to the physics build; collider bake if P3 / P4 busted the long-task budget; README / AGENTS note that `src/physics/` owns collision | anything left of the old code | the §Baseline table's "after" column filled; plan archived |

Later, not in this plan (open ASKS rows when it finishes): **navcat navmesh** for animal pathing (Rapier
stops them walking through walls; a navmesh makes them route *around* the hut instead of sliding along it),
**Rapier soft-body rope** for the bridge once it's released (unreleased on 0.20.0).

## Budgets (phone tier, 4× CPU; measured against P0)

| What | Budget |
|---|---|
| Rapier on the wire | ≤ 600 KB brotli (measured 537 KB wasm + 25 KB JS) — counted in cold bytes, never hidden by a JS-only gate |
| WASM compile + instantiate | off the critical path (title screen); any single task ≤ 100 ms (`bench.budget.json`) |
| Collider build per shard | sliced ≤ 30 ms per task; total reported in the boot plan |
| Physics per frame (step + controller + queries) | ≤ 1.5 ms p50 / 3 ms p95 on the phone tier; desktop unchanged from P0 |
| Live bodies | phone: ≤ 40 dynamic awake, ≤ 2 ragdolls; desktop: ≤ 150 / 6 |
| Draw calls / tris | unchanged — the debug view is dev-only |
| iPhone | the PLAY-PERF meter still ≥ 55 fps in both shards after P6 and after P8 |

## Why Rapier (E20 research, 2026-09-22)

| | Rapier 0.20 | crashcat 0.0.5 | Jolt 1.1 |
|---|---|---|---|
| wire | ~560 KB br | ~46 KB | ~880 KB |
| controller | built-in KCC (autostep, snap, slopes, push) | Jolt-style KCC | `CharacterVirtual` |
| heightfield | yes | no (trimesh) | yes |
| types / memory | strict, no `any`, GC-friendly handles | native TS | some `any`, manual `destroy()` |
| maturity | years in production, very active (pushed 2026-09-20) | pre-1.0, one maintainer | mature C++, small JS port |

Havok (Babylon-first), PhysX (1.6 MB), Ammo (dead since 2016), cannon-es (no releases since 2022), Oimo — out.
Known Rapier risk: the KCC can dip into a **vertically moving** platform ([#488](https://github.com/dimforge/rapier/issues/488))
— the bobbing boat is the one place we have one; P4 carries the player with the boat's delta explicitly.

**From the trials-gauntlet** (`~/projects/game-demos/trials-gauntlet-demo/docs/plans/USE_A_REAL_PHYSICS_LIBRARY.md`,
parked, never started; a 2D bike game, so its Rapier-2D / Planck picks and its replay-determinism contract don't
port). Kept: count WASM bytes and startup separately; async init at boot, never inside a tick; the library owns
collision, the game owns feel; judge by **played clips**, not stills. Dropped by the user: the side-by-side
switch — P0's baseline is the control instead.

## Risks

1. **WASM compile on an iPhone** — unmeasured anywhere; P1 measures it first, before anything else depends on it.
2. **Feel regressions** in the walk / jump / hover / swim loop once the controller changes — P0 clips + numbers are the guard; the user's thumbs are the judge.
3. **Frame time on the phone** while PLAY-PERF is still short of 55 fps — P6 (creatures) and P8 (ragdolls) are the expensive phases, each gated on the iPhone meter.
4. **Shared tree** — `Player.ts`, the world builders and `main.ts` are touched by other agents (HUD, model, perf). Each phase names its files in its commit and goes in small commits.
5. **The rope bridge and boat** are the moving-surface edge cases (#488); both have a named fallback above.

## Decisions (the user's)

1. **Go** — and start now, in parallel with LOAD-PERF / PLAY-PERF (they fight over the same bytes and ms; physics
   touches different files), or queue it after them?
2. **"Update the baseline"** — read here as *measure everything before (P0) and re-baseline the bench on the
   physics build at the end (P9)*. Right, or did you mean something else?
3. **Ragdolls (P8) and navmesh** — ragdolls in v1 as written, and navmesh as a follow-up plan; or pull navmesh in
   (P6b) now?
