# Engine-fit audit — the Rapier physics effort (E22) vs main

Sources: `/Users/raynos/projects/games/wildshard-physics` (branch `physics`, merge-base `9c975f2`),
`docs/plans/PHYSICS.md` (243 lines, read in full); main checkout at `b4abd3f`; Nalati worktree
`wildshard-nalati-grasslands` (branch `nalati-grasslands`, 69 commits ahead of main). Read-only; nothing touched.

## 1. What the plan is

State (PHYSICS.md:3): `in progress` 2026-09-23, "P0 (baseline) building now". Branch never pushed; merged to main
at P9 on the user's word. Order: P0 → P1 → P2 → P4 → P3 → P5 → P6 → P6b → P7 → P8 → P9.

| Row | Delivers | Deletes |
|---|---|---|
| P0 | baseline: bench phone tier, 7 poses, per-updater JS ms, walk clips of a fixed route | — |
| P1 | `src/physics/` skeleton, streamed WASM, fixed-step loop in `Game.ts`, terrain heightfield, chunk walls, `?physics=debug` | `Player.ts:513` `lim` clamp |
| P2 | player on Rapier KCC (`Character.ts`): autostep 0.35 m, 40° slope, snap, dodge/lunge, pushes ITEM/DEBRIS | `groundAt()`, `collide()`, slope constants |
| P4 | Driftwood static world: pier, **kinematic boat on heave/pitch/roll**, hut, lookout, wreck trimesh, cave trimesh, shrine, palms, trailside, bridge, rocks, interactables' static bodies | every Driftwood `Collider` + `floorHeightAt`, **`player.colliders` / `platforms`**, `Adventure.floorAt`, foam list, SurfaceMap deck floors |
| P3 | Pine Hollow: 1 770 trunk capsules, 3 cabins, **kinematic hinge doors**, 380 boulder hulls, 70 stumps + 55 logs | Cabin/Props/Boulders/Forest colliders |
| P5 | one query API: bolts `castShape`, rifle `castRay`, sword blade `castShape`, interact/pickup LOS, plates as sensors, `Surface`-driven FX | `segmentCylinder`, `MeleeSweep`, 9-ray sweep, distance-only interact, y=−1e6 door park |
| P6 | every creature = KCC capsule + HITBOX colliders (head ball + body capsule / per bone); charge/pinch as contact events; stagger through KCC | `AnimalManager.raycast`/`raySphere`, `confine`, `CHARGE_HIT_DIST` |
| P6b | **navmesh** (navcat, pure JS) baked per shard by `scripts/bake-chunk.mjs` from the P3/P4 colliders; per-species agent radius; crowd avoidance | `steer`'s bending, wander sampling |
| P7 | coconuts, puzzle barrel, loot, pickups as dynamic bodies (sleep + per-tier cap); brass/blood/debris ray-landed | hand integrators, `pushBarrel`, fake floors |
| P8 | **ragdolls** per species (bone capsules + limited joints), freeze when asleep; phone 2 live / desktop 6 | keyframed death + `settleCorpse` IK (`Animal.ts:480-569`) |
| P9 | re-baseline, merge, deploy, archive | leftovers |

Picks already made (PHYSICS.md:8-38): `@dimforge/rapier3d-simd` single-threaded, SIMD only; **no toggle / no fallback,
each phase deletes the old code**; both Pine Hollow + Driftwood; "everything collides"; phone gates = headless
`?tier=phone` p50 ≤ 18 ms; Driftwood first; straight-through, no review stops.

### What it already decides in "engine" territory

| Engine concern | Plan's answer | Where |
|---|---|---|
| Character controller | Rapier `KinematicCharacterController` capsule in `src/physics/Character.ts`, game feel (hover, swim, double jump, dash) stays game code on top | :122, :127 |
| Collider authoring per model | **separate** `src/physics/colliders/<structure>.ts` per builder, reading anchors/dimensions the builder exports; primitive → hull → treads → trimesh (cheapest first); bake to `colliders.bin` only if the build busts 100 ms | :119, :140-144, :205 |
| Fixed timestep | `Physics.ts` 60 Hz accumulator, max 3 substeps, fed the **scaled** dt (hit-stop freezes bodies), render interpolates dynamic bodies | :116, :130 |
| World / body ownership | `src/physics/` is the only Rapier importer; one `World` per shard, `dispose()` on shard change; collision groups table | :112-118 |
| Gameplay object → body | **not specified as a mechanism.** `query.ts` promises an `owner` ("the animal / door / pickup / plate behind the collider", :121) but no handle→owner map, no attach/detach lifecycle, no transform-sync rule. Bodies are bolted per class, phase by phase (player in P2, doors in P3/P5, animals in P6, items in P7, ragdolls in P8) | :121, rows |
| Navmesh | P6b navcat, baked offline from the P3/P4 colliders | :167 |
| Ragdolls | P8, capped, frozen when asleep | :169 |
| Surface/material | `Surface` tag per collider reusing `src/audio/Surface.ts`'s union | :120 |
| Update ordering | implicit — "wired into `Game.ts`" (P1). No pre-/post-physics phase named | :161 |

No entity / component layer is planned. The word "component" / "entity" / "registry" does not appear in PHYSICS.md.

## 2. What is built on the branch

- `git log main..physics`: **2 commits, both docs only** — `d5aa6ae` (plan re-survey) and `504d988` (the go).
  Diff stat vs main: `docs/plans/PHYSICS.md` +149/−69, `docs/tasks/asks/E22.md` 1 line.
- Uncommitted in the worktree: PHYSICS.md +16 (P0 route findings, "straight through" pick), and two **untracked**
  files: `scripts/physics-baseline.mjs` (241 lines — Playwright P0 ruler: poses + walk autopilot + webm + compare)
  and `scripts/physics-route.json` (445 lines, the walk route). `progress/physics/` does not exist yet.
- **No `src/physics/`, no Rapier dependency in `package.json`, no Rapier code.** P0 is mid-build; P1–P9 are zero %.
- Useful P0 finding already (uncommitted PHYSICS.md +93-106): today's controller is **frame-rate dependent** (at a
  50 ms frame the wreck-hold and shrine stairs jam); the terrain pokes through the sea-cave floor; shrine causeway lip
  0.61 m. These are arguments *for* a fixed step regardless of the library.

## 3. The seams in main's `src/`

- `grep -rn "new THREE.Mesh\|InstancedMesh" src | wc -l` = **282 sites in 52 files**. Top: `Crossbow.ts` 30,
  `Cabin.ts` 21, `TreeFactory.ts` 18, `Rifle.ts` 13, `Hoverboard.ts` 12, `Undergrowth`/`Forest`/`Boundary` 10 each.
  Most are visuals (sky, grass, FX, viewmodels); the Driftwood builders build through `lowpolyKit.ts` so their
  mesh counts are low (Hut 2, Lookout 1) while their collider counts are high.
- **Builders that produce hittable colliders today** (export `colliders: Collider[]` and usually
  `floorHeightAt(x,z)`): `Cabin`, `Pier` (+ jetties), `Boat`, `Hut`, `Lookout`, `Wreck`, `Cove`, `Shrine`, `Palms`,
  `Trailside`, `RopeBridge`, `Boulders`, `Props`, `entities/npc/Castaway`, `world/interact/Interactables`, plus
  `Forest`'s trunk circles → **16 sources on main**. The Nalati branch adds ~10 more (`nalati/Yurt`, `NomadCamp`,
  `KurganField`, `KurganDungeon`, `Balbals`, `Bridge`, `Cairn`, `Crags`, `EagleRock`, `RoadFurniture` …).
- **Readers of the box list** besides the player: `MeleeSweep.ts:53,67`, `Ocean.foamAround` (`main.ts:~208`),
  `Adventure.floorAt`, `audio/Surface.ts`, `Enemies.ts`, `IronSword.ts`, footsteps in `main.ts:468`.
- **The wiring is copy-pasted.** Every builder is hooked up by hand, `scene.add` + `player.colliders.push(...)` +
  `player.platforms.push((x,z)=>b.floorHeightAt(x,z))`, in `main.ts` (17 push lines, 14 `floorHeightAt` refs,
  `main.ts:130-241`) **and again in six dev scenes**: `dev/driftwood.ts` (18 push), `dev/dive.ts` (15),
  `dev/ambient.ts` (14), `dev/loot.ts` (9), `dev/enemies.ts` (9), `dev/cabins.ts` (2). PHYSICS.md never mentions
  `src/dev/`. P4 deletes `player.colliders`/`platforms`, so each of those files has to be rewired too, or tsc goes red.
- **The same builder list is kept a third and fourth time**: `explore/catalog.ts` (`CatalogHandles`, :46-54, a
  hand-listed `hut? lookout? wreck? shrine? pier? boat? cove? jetties? bridge?`), and project/archive/2026-09-23-explore-world.md X10 (:103)
  plans `registerModel({id, name, file, object, anchor})` so "models self-register as their builders build them".
  PHYSICS.md adds a fifth, `src/physics/colliders/<structure>.ts`, one per builder. **Two agents plan two parallel
  per-builder registries over the same ~16–26 builders, and neither mentions the other.**
- Existing registry-shaped code to build on: `src/chunks/registry.ts` (shards), `world/interact/types.ts:100`
  (`InteractDef` union: a data table of kinds, the nearest thing to components the game has), `Game.onUpdate`
  (`Game.ts:129`, a flat closure list run in registration order, `Game.ts:220`).

### Would a small registry make Rapier cleaner? Yes.

One call per built thing, in the builder (or its one call site), feeds every consumer:

```ts
world.add({ id: 'hut', name: 'Hut', file: 'src/world/Hut.ts', category: 'buildings',
            object: hut.group, anchor, colliders: hut.colliderDescs(), surface: 'planks',
            motion: 'static' | 'kinematic' | 'dynamic', owner?, tick? });
```

→ scene.add, physics bodies (`src/physics/` turns the descs into Rapier colliders, keeps handle→owner), the
Explore catalog (X10), the minimap POI, the foam ring list, the navmesh bake (`bake-chunk.mjs` already runs builders
in node, and the P0 work replayed `Player.ts` on the real builders in node), the footstep surface. `main.ts` and the
6 dev scenes shrink to `world.add(new Hut(sky).build())`. `ColliderDesc` stays engine-neutral data
(`box | capsule | ball | hull | treads | trimesh` + `Surface`), so builders never import Rapier and the model agent's
rebuilds keep their colliders beside the geometry that draws them, instead of drifting in a separate folder the
physics agent re-authors at every rebase (PHYSICS.md risk 4 / :205-207).

## 4. Risks

**WASM bytes** (measured today from the npm tarballs, v0.20.0, brotli q11 / gzip -9):

| Build | wasm raw | wasm br | wasm gz | JS glue br |
|---|---|---|---|---|
| `rapier3d-simd` (the pick) | 2 196 730 | **537 065** | 731 911 | 19 907 |
| `rapier3d-compat` (base64 in JS) | 2 021 200 inlined → `rapier.mjs` 2 857 590 | — | — | **796 209** (whole) |

The plan's 537 KB + 25 KB (:185) is right, and so is dropping `-compat` (+48 % on the wire, and a synchronous decode).
If Vercel falls back to gzip for `.wasm`, it is 732 KB. navcat 0.4.1 is 2.2 MB unpacked on npm; the plan's
~96 KB wire figure needs checking at P6b.
Against `bench.budget.json`: first launch ≤ 12 MB (12 582 912 B), requests ≤ 20, long task ≤ 100 ms. Driftwood
cold 2.38 MB (plan :185) has room. The working-tree `progress/bench/latest.md` run (uncommitted, Pine Hollow steps
`forest`/`cabins`) is **10.62 MB cold and 11 requests, with a 150 ms longest task already over the 100 ms gate**.
+0.56 MB puts Pine Hollow at ~11.2 MB, 93 % of budget before navmesh (≤150 KB) and any collider bake. The
long-task gate is already red there, so it can't separate a Rapier regression from what is already failing.
`instantiateStreaming` compiles off the main thread, but `World` build + 1 770 capsules + 380 `convexHull`
computations run on it: slice per the plan's ≤ 30 ms rule, or bake.

**Phone step cost.** Static colliders are nearly free (BVH broadphase). The cost is in the KCC moves. The player is
1 KCC × up to 3 substeps. **P6 puts every creature on a KCC**, and Pine Hollow's fauna plan is **~140 animals**
(`chunks/pine-hollow.ts:109`), Driftwood ~16. 140 KCC `computeColliderMovement` calls per step is several ms at 4× CPU,
over the 1.5 ms p50 budget on its own. The plan has no creature-physics LOD. It needs one: only animals within ~40–60 m
(or on screen and near) get a KCC and hitboxes, and the rest stay on `heightAt` + navmesh, the way
`animalHideDist` / `SHELL_MAX` already tier the rendering (`core/tier.ts:21`, `AnimalManager.ts:184`). Per-bone HITBOX
colliders on 140 skinned animals also need per-frame kinematic pose sync. Limit them to the near set too.

**Determinism.** The SIMD build is not bit-deterministic across platforms (only `@dimforge/rapier3d-deterministic`,
non-SIMD, is). It doesn't matter for a single-player game with no netcode or replays. It does matter for the plan's
evidence method: P0/P2 compare walk traces, and a headless M-series trace will not match an iPhone's bit for bit, so
comparisons need tolerances (the plan already judges by clips and numbers). The fixed step makes the walk
frame-rate independent, which fixes the stair jam P0 found. Risk 7 (hit-stop ×0.04 → one step per ~25 frames)
stands. Interpolating the player/KCC, not only dynamic bodies, is needed or the camera judders during hit-stop.

**Scope gaps.**
- **Nalati is not in the plan** (zero mentions). Nalati's `player/Mount.ts` (409 lines) has its own `collide()` over
  `player.colliders` (`Mount.ts:258,326-335`) plus ~10 new collider builders. P4 deleting `player.colliders` breaks the
  Nalati branch at its next rebase, and the horse needs its own KCC capsule (a second character motor).
- `src/dev/*` scenes: 6 files to rewire (above).
- Merge drift: weeks on a branch while 5 remaster agents rewrite the same builders (risk 4). Co-located descriptors
  (section 3) shrink that surface to one `colliderDescs()` per builder.

## 5. Conclusion — engine, or 1–5 components?

The plan is a sound physics plan: library choice, fixed step, groups, query API, KCC, authoring cost ladder, WASM
loading, budgets. What it lacks is the thin **object-model layer** an engine would provide:
- how a game thing gets a body,
- who owns that body,
- how its transform syncs,
- where in the frame it runs,
- how the same builder list reaches physics, Explore, the navmesh bake and dev scenes.

Needle / Rogue fill this through an editor and GLB-authored components. That doesn't fit code-first procedural
builders written by agents. enable3d's physics is Ammo, which the plan already ruled out as dead. So a real engine
would fill the gap, but at full migration cost for ~5 small pieces the game can own. They are small enough to own,
and each maps to a plan row:

1. **`WorldRegistry.add(piece)`**. One registration per built thing: `{id, name, file, category, object, anchor,
   colliders, surface, motion, owner, tick}`. It feeds the scene, physics, the Explore catalog, the minimap, foam, the
   navmesh bake and the dev scenes. **Merge it with EXPLORE-WORLD X10's `registerModel`**: same builders, same fields.
   Land it on main *before* P4, so the physics branch rewires one list instead of main.ts + 6 dev scenes + catalog.
2. **`ColliderDesc`**. Engine-neutral collider data (`box | capsule | ball | hull | treads | trimesh` + `Surface`),
   emitted by each builder beside its geometry. `src/physics/` is its only Rapier consumer; `bake-chunk.mjs` reads it
   in node for the navmesh and the optional `colliders.bin`. This replaces the separate `colliders/<structure>.ts` folder.
3. **`Body` handle + owner map**. `attachBody(object3d, desc, owner) → handle` and `detach(handle)`, a
   `Map<ColliderHandle, Owner>` with a typed `Owner` union (piece / animal / door / pickup / plate / player), and a sync
   rule per motion type (kinematic: object → body; dynamic: body → object, interpolated). The plan's `owner` field
   (:121) and every spawn/despawn in P5–P8 (animals, pickups, coconuts, ragdolls) rest on this.
4. **Frame phases on `Game`**. Replace the flat `onUpdate` list (`Game.ts:129,220`) with ordered phases:
   `input → prePhysics (KCC desired moves, kinematic poses) → fixedStep × n → postPhysics (sync + interpolate,
   contact events) → late (camera, audio) → render`. It is ~40 lines, and it removes the implicit "registration order
   in main.ts" dependency physics will otherwise lean on.
5. **`CharacterMotor`**. One KCC wrapper `{radius, height, step, slope, groups, carry}` used by the player (P2), each
   *near* creature (P6, with a distance LOD so ~140 Pine Hollow animals don't all step), and Nalati's horse
   (`Mount.ts`). Without it, P6 and Nalati re-implement `Character.ts` twice.

Recommendation: **(b) keep three.js + Rapier as planned, and add components 1–5.** 1 and 2 go on main now, shared with
Explore X10. 3–5 go in the physics branch's P1/P2. Also add Nalati and `src/dev/*` to PHYSICS.md's scope.
