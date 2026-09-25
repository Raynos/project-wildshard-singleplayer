# Nalati merge review: the engine / systems side

2026-09-24 · for ask N16 · branch `nalati-grasslands` at `2627594` (main merged in by `1a0f1ef` + `deddcb9`) · read-only
review, nothing built. The player-facing side (HUD, audio, quests, the remaster's look techniques) is in
`review-experience.md` next to this file.

**How it was checked.** The code on the merged branch, main's plans and asks (`project/archive/2026-09-23-physics.md`,
`…-explore-world.md`, `…-preload-offline.md`, `…-lock-on.md`, `docs/plans/ENGINE-FIT.md`, `PHYSICS-POLISH.md`,
`EXPLORE-V2.md`, E54–E98), and nine muted headless probes against the dev server on :5188 (Nalati, desktop tier,
`?skipintro&nolock&mute=1`; every browser closed). Evidence images are in `img/`:

- `img/engine-ride-frozen.jpg`: `?ride=gallop` with W + Shift held; STEED reads GALLOP, the horse hasn't moved,
  and the view sits in its neck.
- `img/engine-physics-debug-bridge.jpg`: `?physics=debug` at the Kunes bridge. The rails are boxes, the deck has no
  collider, and the terrain is the heightfield.
- `img/engine-explore-nalati-by-hand.jpg`: Explore opened by hand on Nalati, where it is switched off. The catalog
  has five creatures in the wrong style and no buildings.
- `img/engine-webgpu-black.jpg`: `?gpu=webgpu` on Nalati draws nothing: 0 calls, 0 tris.

## Three things main's merge broke that nobody has seen yet

1. **Riding is dead on the merged branch.** With W + Shift held for 3.5 s, the gait climbs walk → trot → canter →
   gallop and STEED drains, but the horse moves **2 cm**. The camera stays at on-foot eye height (1.66–1.71 m over the
   ground; the saddle eye is 2.3 m × the horse's scale). There are two causes, both confirmed in the page:
   - **The rider's own capsule blocks the horse.** The ridden horse is within 45 m of the player, so P6 gives it a
     creature `CharacterMotor`. That motor is blocked by `PLAYER` (`src/physics/creatures.ts:91`). Meanwhile the
     player's capsule stays enabled, standing at the horse's feet: bootstrap's `post` slot calls
     `setBodyEnabled(on)` and `player.step(dt)` whatever `player.ride` is (`src/core/bootstrap.ts:135`). With the
     player's body switched off while mounted, the same probe gallops 30 m in 3.5 s (13 m/s).
   - **The frame phases undo the saddle camera.** `Mount.drive` runs from `Player.input()` (`Player.ts:349`, the
     render-rate input phase). `Player.step()` then still runs in the fixed step with stale intents, and
     `Player.update()` re-poses the camera from the feet at 1.7 m (`bootstrap.ts:138`). So every one of Mount's
     camera effects is overwritten: the saddle eye, the gait bob, the lean, the mount swing, the bucking shake.
2. **Your arrows hit your own horse.** `pastRidden()` (`src/player/riding.ts`) hides the horse by setting
   `animal.hidden` for the length of one ray. Since P6, `AnimalManager.raycast` casts against Rapier hitboxes
   (`AnimalManager.ts:970`), and those are only switched on or off in `CreatureBodies.sync()`, never during the call.
   So the bow's ray and the arrows' ray hit the horse under you: the aim readout shows **"HORSE · 1 M"**
   (`review-experience.md` item 13 saw the label; this is the cause). A bolting horse throws you at 20 % hp, so a few
   forward shots end the ride.
3. **WebGPU draws a black screen on Nalati.** `Game.buildComposer()` returns early for look v2 (the Nalati default,
   `Game.ts:127`) and for the painterly chain (`Game.ts:182–188`), before `this.gpu?.build(…)` (`Game.ts:198`). So
   the WebGPU path never builds: 0 calls on both `webgpu` and `webgpu-gl`, while Driftwood draws 307 calls on the
   same browser. The renderer is a **saved** main-menu option (E55), so a player who picked WebGPU and then launches
   Nalati gets black.

Fixes 1 and 2 are small (S) and belong ahead of the N17 riding rework. That agent is editing `Mount.ts` right now, on
a physics that freezes the horse. Fix 3 is an S fallback (see D6).

## Summary

| Feature | Main has | Nalati today (verified) | Work | Size |
|---|---|---|---|---|
| Rapier world, fixed 60 Hz step, player on the KCC | Every shard, `src/physics/*`, frame phases on `Game` | Inherited: the player walks on the heightfield with step 0.35 m and climb 40° | None. Decide the climb limit (D2): **27 % of Nalati's land is over 40°** (Driftwood 8 %) | — |
| Static colliders via the world registry (`registry.add` + `ColliderDesc`) | Every Driftwood and Pine Hollow builder; one `add` = drawn + collides + in Explore | **None registered.** 1 834 hand-made boxes pushed into `player.colliders`, mirrored by the legacy P2 `ColliderBridge` as cuboids, all tagged `wood`; 13 floor functions in `player.platforms` (the bridge deck, Eagle Rock, the kurgans, the crag ledges, the dungeon floor); registry = `forest` (32 trunks) + `paths` (111 walkway boards) | Every Nalati builder emits `colliderDescs()` and registers a piece, with floors as real geometry and stairs as treads | **L** |
| Horse on its own motor (E3 / P10 / E72) | Designed for it (`CharacterMotor`, "the Nalati horse in P10") | Hand-rolled `Mount.collide` / `groundAt` / `obstacleAhead` over `player.colliders` + `forest.nearby` + `player.platforms`, driven at render rate; plus the three breakages above | Hotfix (S) now, then the horse on a motor in the fixed step (M) | **S + M** |
| Weapons on physics queries (P5) | Crossbow, rifle and sword on `sweepBall` / `castSegment` / `lineOfSight`; the material picks stick / glance / clang | Sabre ✓ (it extends `Sword`, so it uses `MeleeSweep`). **Bow arrows, javelins, Naizagai** hand-roll trunk cylinders, OBB boxes and a terrain bisect (`Projectiles.ts:27–30, 344–392`, `Spear.ts:406–487`, `Naizagai.ts:256`): the code P5 deleted from the crossbow | Port `Projectiles` + `Spear` to `src/physics/query.ts` | **M** |
| Creature hitboxes, near-creature motors, ragdolls (P6, P8) | Every AnimalManager creature | Inherited. Probe: a wolf and a horse both ragdoll. Hitboxes work, apart from the ridden horse. **The sheep flock (`Flock.ts`), the kokpar riders and the far herds are not in physics**: sheep are hit by `raycastSheep`, their own ray | Sheep hitboxes if they stay targets; decide the stampede (D8) | S |
| Navmesh (P6b) | Baked per shard (`public/assets/baked/<slug>/navmesh.bin`) | **None.** `navmeshUrl('nalati-grasslands')` is null, so AnimalManager falls back to the old `steer`. `bake-navmesh.mjs` has no Nalati branch: it would bake Pine Hollow's cabins and props | A Nalati branch in the bake (POIs, dressing, crags), layers for wolf / leopard and horse | **M** |
| Items as bodies, drops settle (P7) | `Bodies`, `Drop`, `floorBelow` | Inherited, but `floorBelow` finds no Nalati deck (they're floor functions), so blood and drops fall to the terrain under the bridge / Eagle Rock / the floating dungeon (y 140) | Comes with the registry work | — |
| World Explorer + Model Explorer | Driftwood + Pine Hollow (`ChunkDef.explore`, `pois`, registered models) | **Off.** No `explore`, no `pois`, no registered models. Opened by hand: the catalog is 5 creatures in the **PBR fur style** (`Explore.ts:148` maps anything not `lowpoly` to `pbr`), no buildings, no nature, no map | `explore: true` + `pois` + register the POIs with `model` + the style fix + light presets on the Nalati clock | **M** |
| Model pipeline | `lowpolyKit` + builders emitting descs; the Blender cove bake; img2mesh (TRELLIS / Hunyuan) → `driftwood_post` → GLB; CC0 kit | Generated GLBs → painterly material (`glbPaint.ts`), rigged hulls baked onto the species' skeletons (`nalati-rig-bake.mjs`); **no colliders from any model**; the phone copy picked by the `TIER` const | Adopt the registry / collider / tier conventions, not the Blender bake (D5) | M (inside the L above) |
| WebGPU path (X5, opt-in) | Driftwood-first TSL ports | **Black screen** (above) | Fall back to WebGL on Nalati (S), or port the painterly materials (L) | S / L |
| Boot packs, preload-offline (E44), SW | Every declared file counted and cached; nothing after the bar | Pack ✓ (2.7 MB phone). **6 rigged creature GLBs (4.1 MB desktop + phone) are fetched during boot but not declared** (`manifest.ts:30`). The SW's `STATIC_RE` (`src/pwa/sw.js:71`) doesn't match `/assets/nalati/`, so all 26 MB of it goes **network-first**, not cache-first. Vercel marks `/assets/nalati/*` as `immutable` for a year, though the files are unhashed | Declare the rigs; add `nalati` to `STATIC_RE` and a 30-day `vercel.json` rule | **S** |
| Perf budgets / bench | `bench.budget.json`, `pnpm bench:ci`, `physics-baseline.mjs` poses + walk route per shard | Nalati was measured before the merge (phone 52–95 calls, 0.77–1.4 M tris); **no bench / physics-baseline run with physics**; no Nalati route in `physics-route.json` | Add Nalati to `physics-baseline` (poses + walk + ride legs) and bench it | S–M |
| GPU recovery / resume (E54, E61, E96, E98) | Generic; `markGpuOnly` for runtime bakes | Works (the reload path). `PainterlyRange` (`:100`) and look v2's shadow / contact bake (`nalati/look/bake.ts`) render into targets once and don't `markGpuOnly`, so an in-place restore brings them back empty. The resume `?at=` drops "mounted" / "inside the kurgan" | `markGpuOnly` or re-bake in `rebuild`; resume state (the other review) | S |
| Settings (E55) | Main-menu boot options + pause live options | Renderer / tier / touch apply. **Time of day drives only Driftwood's `DayNight`** (`main.ts:338`); Nalati runs its own `DayClock`. Nalati's look flags (`?look=v1`, `?backdrop=0`, `?models=0`, `?creatures=`) stay URL-only | Wire Time of day to `DayClock` (S); decide the one clock (D7) | S |
| Lock-on (E50) | Melee lock on hostile kinds | **Inert**: `MELEE = sword / sword-iron`, `HOSTILE` has no Nalati kind (`LockOnTarget.ts:47–48`). The LOCK disc shows with the sabre but can never lock | Sabre + spear + the Nalati hostiles (S); the mounted and bow cases are D4 | S |
| Dodge (E60 / E63 T) | One dodge, on foot | Works on foot. No dodge in the saddle (`input()` returns into `drive`) | None | — |
| Feedback inbox | F8 / ✎, context, `?at=` repro | Works; the context lacks mounted / gait / clock / storm / kurgan (the other review, §5) | S | S |
| Native apps (Capacitor) | Shells, native saves (`ws.*` keys), OTA | Every Nalati save key is `ws.*` (`ws.nalati.skins.v1`, `ws.nalati.tulpar`, `ws.elites.v1`, `ws.boss.v1`), so they are mirrored. 26 MB of Nalati assets ship in the web bundle the shell loads | None now; app size is a store-time question | — |
| Rotate gate (E38) | `frameGate` | Applies to every shard | None | — |
| Shard gating in `main.ts` | 38 `isOcean` / `painterly` / `chunk.weapon === 'sword'` branches | Nalati's `weapon: 'sword'` (`nalati-grasslands.ts:564`) makes island-only gates true: the unused **iron sword is built** (`main.ts:359`), and the hurt arc / trauma shake (`main.ts:547`) run on Nalati | A Nalati `ChunkWeapon`, or gate those three lines on the slug (S); ENGINE-FIT E5 is D9 | S |

## 1. Physics (Rapier)

### What main has

`src/physics/` is the only code that imports Rapier (AGENTS.md "Physics"). The parts:

- `Physics.ts` / `rapier.ts`: the world. The WASM is a declared boot file, compiled in the `physics` SETUP step.
- `terrain.ts`: a heightfield at the mesh vertices, 4 edge walls, and `cutTerrain` for caves.
- `CharacterMotor.ts`: Rapier's KCC capsule. Step 0.35 m, climb 40°, snap. It carries you on a kinematic or
  `rideable` body.
- `pieces.ts`: `ColliderDesc` → Rapier, tagged `{ material, owner }`.
- `query.ts`: `castRay`, `castSegment`, `lineOfSight`, `sweepBall`, `floorBelow`.
- `creatures.ts`: head + body hitboxes for every shown animal, and a motor for each one within 45 m.
- `navmesh.ts`: a navcat navmesh baked per shard.
- `bodies.ts`: dynamic items, capped per tier (phone 40 awake).
- `ragdoll.ts`: quadruped / rigid / upright, phone 2 live.
- `ropeChain.ts`: the rope bridge's jointed planks.
- `paths.ts`: walkway boards where a trail is steep.
- `bridge.ts`: the legacy P2 `ColliderBridge` for hand-made moving boxes. PHYSICS-POLISH F3 wants it gone.

Game code runs in `game.onFixed('pre' | 'step' | 'post')` at 60 Hz and is drawn interpolated with `game.alpha`.

**How Pine Hollow and Driftwood did it (the pattern to copy).** Every builder grew a `colliderDescs()` beside its
geometry, and main.ts registers it once: `registry.add({ id, name, category, file, object, colliders, surface,
floor?, solidFloor: true, model? })` (`main.ts:140` `addBuilt`). The descs are authored cheapest first:

- boxes for walls, rails and posts;
- capsules for trunks and palms (following their lean);
- hulls from the drawn vertices for rocks: 91 shore rocks, 353 Pine Hollow rocks cut to 162 directions;
- `treads` for every stair: rise ≤ 0.35 m, depth ≥ 0.36 m, never a ramp;
- a trimesh only where you walk inside: the heeled wreck, the sea cave.

Floors are geometry (`solidFloor`); the floor function stays for placement and footsteps only. Moving pieces use
`follows` (the boat, the cabin doors with `active`). The checks:

- `physics-baseline.mjs --mode=walk` (a fixed route per shard, 0 stuck is the bar) and `--trails`;
- `?physics=debug` screenshots;
- floors ≤ 5 cm off the old floor functions;
- `bake-navmesh.mjs` re-run, with `--check` for staleness.

Driftwood ended with 1 793 colliders built in ~15 ms at 4× CPU, spread across the builders' tasks.

### What a shard must provide to opt in

1. **Terrain**: nothing. `addTerrain` builds the heightfield for every shard. A cave or overhang cuts it
   (`cutTerrain`). A path up a crag is graded (`TerrainSpec.graded`) or gets walkways (`paths.ts`, already laid for
   Nalati's 9 trails: 111 boards).
2. **Static colliders**: `colliderDescs()` per builder + one `registry.add` each. No `player.colliders` / `platforms`.
3. **Moving things**: a `follows` piece (a kinematic body posed from the object each `pre` step), with `active()` if it
   must let the player through. Nalati has one: the kurgan dungeon's seal (`KurganDungeon.ts:772`).
4. **Surfaces**: a `Material` per piece or desc (`ground`, `rock`, `stone`, `wood`, `planks`, `metal`, `flesh`…). It
   drives bolt sticking, the sword's clang, impact puffs, and later footsteps.
5. **Navmesh**: a branch in `scripts/bake-navmesh.mjs` `shardColliders()` building the shard's statics in node, plus
   `SHARD_LAYERS[slug]`, then commit `navmesh.bin`. The byte source, SW caching and boot step come for free.
6. **Water**: not a fluid. Swim / wade read `waterSurfaceAt` (ocean or pond). Nalati's river and brook are
   `wildEnv.wetAt` / `NalatiWater`, which the player and `Bodies` buoyancy don't know. A drop in the Kunes sinks.
7. **Evidence**: a route in `physics-route.json`, poses in `physics-baseline.mjs`, and the phone gate (headless p50
   ≤ 18 ms).

### Nalati today (probed on the merged build)

- The world has **2 051 colliders**: 1 949 cuboids, 67 capsules, 34 balls, 1 heightfield. `player.colliders` holds
  **1 834** hand-made boxes and `player.platforms` holds **13** floor functions. The registry has two pieces: `forest`
  (32 spruce capsules) and `paths` (111 boards). `physics.step()` costs 0.007 ms when nothing is awake.
- Who pushes boxes and floors the old way:
  - `src/nalati/index.ts:140,147` (outcrops, crag rock);
  - `src/world/nalati/index.ts:95–96`, for every POI: camp + yurts, bridge, road furniture, summer camp, kurgan field,
    balbals, Eagle Rock, cairn, crags, watchtower / kokpar / far herds / snow lotus / glacier (`Bowl.ts`);
  - `dressing/index.ts:173` (boulders, logs, camp clutter, as boxes: `dressing/place.ts:258,538,577`);
  - `kurganBoss.ts:634–635` (the dungeon's walls + its floor function).
- What that costs:
  - **Every box is `wood`** (`bridge.ts:39`), so a sabre on a granite outcrop thuds like a plank.
  - **Floors aren't colliders.** The player stands on them through the P2 floor-function bridge, with the old 0.5 m
    step-up. `floorBelow` (drops, blood, the swim climb-out, the dash's deck probe) and every creature motor don't see
    them. `img/engine-physics-debug-bridge.jpg` shows the bridge's rails as boxes and no deck.
  - Rocks are boxes, not hulls, so arrows stop on the air round a boulder's corners.
  - Nothing is in the registry, so nothing is in Explore and nothing is in a navmesh.
- Hand-rolled collision against AGENTS.md's rule ("nothing else hand-rolls a collision test"):
  - `Mount.ts` `collide()` (`:326`), `groundAt()`, `obstacleAhead()`;
  - `Projectiles.ts`: the arrows, the drop-arc preview, recovering stuck arrows;
  - `Spear.ts`: javelins, the terrain bisect;
  - `Naizagai.ts:256`: the lightning call's terrain march;
  - `Flock.ts` `raycastSheep`: sheep aren't in physics.
- **Slopes:** 27.1 % of Nalati's land is steeper than 40° (17.5 % over 50°), against Driftwood's 8.2 %. On foot the
  motor treats all of it as wall. The 9 roads are fine: 5 of 1 340 m are over 40°. The horse ignores slopes entirely:
  its motor moves with `ignoreTerrain`, `Animal.ts:435` follows the ground, and Mount only caps the gait at a walk.

### Work items (E72 / PHYSICS P10, broken down)

| # | Item | Files | Size |
|---|---|---|---|
| P-1 | **Riding hotfix** (before N17 lands): while `player.ride` is set, the rider's body is off and `step()` / `update()`'s camera are skipped (bootstrap's `post` slot + `Player.update`). The ridden horse's hitboxes are excluded from casts: switch them off while ridden, or give `CreatureBodies.cast` an exclude. A `?ride=gallop` smoke test in `nalati-boot-check.mjs` that asserts the horse moves | `core/bootstrap.ts`, `player/Player.ts`, `physics/creatures.ts`, `player/riding.ts`, the boot-check script | S |
| P-2 | **The horse on the fixed step**: `Mount` drives in `onFixed('post')` through the horse's `CharacterMotor`. The capsule is a horse-sized one, or two balls along the body (D1). Its climb / step are its own. The jump is real vertical motion over fences, not `yOffset` plus skipped boxes. The camera is posed in `update` from the interpolated saddle (`game.alpha`). Delete `collide` / `groundAt` / `obstacleAhead`; "a low box ahead" becomes a `castShape` probe. Fording stays game code | `player/Mount.ts`, `game/Taming.ts` (bucking), `entities/Animal.ts` (ridden: the motor's move is Mount's) | M |
| P-3 | **Nalati builders emit `ColliderDesc`**, registered as pieces with `solidFloor`: yurts as capsule / cylinder hulls, fences and rails as boxes, the bridge deck as slabs with end treads, Eagle Rock + the crag ledges + the cave porch as hulls / slabs, kurgans as hulls (walkable crowns), balbals as boxes, outcrops / crag rock / boulders as hulls from the drawn vertices, logs as capsules, camp clutter as boxes. The dungeon: floor slabs + walls + the stair as treads, the seal as a `follows` / `active` piece. Delete every `player.colliders` / `platforms` push in Nalati. Split into several pieces with a `macrotask()` between them (the 30 ms task rule) | `world/nalati/*`, `nalati/outcrops.ts`, `nalati/cragRock.ts`, `world/nalati/dressing/*`, `nalati/kurganBoss.ts`, `world/nalati/KurganDungeon.ts` | L |
| P-4 | **Arrows and javelins on queries**: `Projectiles` sweeps a small ball with `sweepBall` per substep (the drop-arc preview uses the same call), sticks by `sticksIn(material)`, and glances off stone. `Spear` javelins likewise. Naizagai's strike point is a `castRay` down. The wind drift and gravity stay game code | `player/Projectiles.ts`, `player/Spear.ts`, `player/Naizagai.ts` | M |
| P-5 | **Navmesh**: a Nalati branch in `bake-navmesh.mjs` (build `NalatiPOIs` + dressing + crags in node; the loader already stubs the DOM and reads GLBs from `public/`). Layers ~0.3 m (wolf, dog, leopard) and ~0.6 m (horse). Budget ≤ 150 KB br. The wolves' and herds' own steering (`Pack`, `Herd`) then asks `findPath` / `randomPointNear` | `scripts/bake-navmesh.mjs`, `entities/Pack.ts`, `entities/Herd.ts` | M |
| P-6 | **Surfaces for footsteps + hooves**: `material` on each piece (grass / gravel / snow / planks on the bridge / felt in a yurt / stone in the dungeon). The footstep ask A1 in the other review can read `floorBelow`'s owner tag instead of a Nalati-only surface map | with P-3 | S |
| P-7 | **Evidence**: Nalati poses in `physics-baseline.mjs` (camp, bridge, plateau, Eagle Rock, kokpar, the dungeon); a walk route (road → camp → bridge → switchbacks → plateau → Eagle Rock summit → kurgan crown → dungeon stair); **ride legs** (gallop the road, jump a fence, ford the river, cross the bridge); the phone gate p50 ≤ 18 ms | `scripts/physics-baseline.mjs`, `scripts/physics-route.json` | S–M |

**Risks.**

- Nalati was tuned for the 0.5 m step-up and no slope limit. Eagle Rock's platform, the crag ledges, the kurgan
  crowns and the leopard's cave porch are all floor functions today, and each needs a real way up (treads, a graded
  path) or they become unreachable at 0.35 m / 40°. Walk each one in node before deleting its floor function, the way
  P4's builder agents did.
- Wolves and herd horses near you now collide with yurts, fences and each other, which they never did. Pack flanking
  and herd flight may pile up at the camp fence. A stampede can no longer run through the player (D8).
- The floating dungeon (y 140) needs its floor as colliders or drops and blood fall 140 m.
- Kurgan hulls of the mounds may fight the painted terrain the mounds are drawn on (they are terrain bumps plus a
  mesh). Check with `?physics=debug`.

## 2. Riding, taming and mounted combat on the physics

- Riding lives in `src/player/Mount.ts` (driven from `Player.input` through `player.ride`), `src/nalati/ride.ts` (the
  one prompt, the dev `?ride=`), `src/game/Taming.ts` (the bucking rounds own the horse), `src/player/riding.ts`
  (`riding.horse`, `pastRidden`), and `nalatiKit.setMount` (the sabre pass, the couched spear, the bow's mounted draw).
- **What breaks with main's engine:** the three breakages at the top (P-1). Also:
  - The horse's capsule is `min(bodyRadius, bodyHalfLen) × scale`, upright (`creatures.ts:89`): a thin post under a
    long body, so its head and rump pass through fences.
  - `Mount.collide` pushes the horse out of boxes a second time after the motor.
  - Taming's bucking moves the horse with no rider capsule and no collision.
- **What works:** the sabre's pass slash is a `Sword` sweep, so it already respects walls through `MeleeSweep`. Being
  thrown / dismounting sets `player.position`, and the motor picks it up (no teleport issue: `CharacterMotor` places
  from the feet every move).
- **Target design (P-2):** one horse body, stepped at 60 Hz, interpolated like the player. The camera comes from
  Mount in the `update` phase, never from `Player.update`. Mounted weapons read the horse's velocity as the carrier
  velocity; the bow already does.

## 3. World Explorer and Model Explorer

- **What they are:** the title's EXPLORE WORLD, a lazy chunk (`src/explore/*`), with three modes:
  - the **hub**;
  - the **World Explorer** (`FreeCam` / `TouchFly` god mode in the real scene, with the player parked at
    (0, −600, −3000); tap-to-select from registered models and picks; a map sheet of `ChunkDef.pois`; COMPARE for
    shards that have mockup targets);
  - the **Model Explorer** (`ModelExplorer.ts`): every registered model plus one creature per AnimalManager species on
    a turntable, in the live renderer. Views: solid / wire / facets / paint / tiers. Light presets, tris / calls, VIEW
    IN WORLD.
- **How a shard opts in** (E66 did Pine Hollow in two steps, "no Explore code needed"):
  1. `ChunkDef.explore: true` + `pois: ChunkPoi[]` (the map pins).
  2. Its built things registered once with `model` (the same `registry.add` as the colliders; `addBuilt(…, model)` in
     `main.ts`). A one-of-a-batch model goes through `registerModel({ live: false, object, buildAt })`, and a tap on a
     batch mesh through `registerPick`.
- **Nalati today:** no `explore`, no `pois`, nothing registered (`main.ts:334` registers only Driftwood / Pine
  Hollow). EXPLORE-V2 V7 holds it back on the user's "pine hollow only". Opened by hand
  (`img/engine-explore-nalati-by-hand.jpg`): the catalog is wolf / wild horse / sheepdog / snow leopard / Argymaq,
  **drawn in the PBR fur style**.
- **What Nalati needs** (M):
  1. `explore: true` + `pois` in `nalati-grasslands.ts`. The pins exist already as `mapPois()`'s Nalati list
     (`src/ui/Minimap.ts:81`); lift it into the def.
  2. The POI builders register with `model` as part of P-3 (camp, yurt, bridge, summer camp, the great kurgan, a
     balbal, Eagle Rock, the cairn, the watchtower, the glacier snout, the dungeon). Batch models (a boulder, a spruce,
     a snow lotus, the kokpar rider, a far-herd horse) go through `registerModel` with `buildAt`.
  3. The creature style: `Explore.ts:148` should pass `chunk.style` (`'painterly'` exists in `AnimalStyle`). The
     sheep, the eagle, the balbal warriors, the ghost riders, the Golden King and Jel Ata aren't AnimalManager species,
     so each needs a `registerModel` builder.
  4. The light presets pin Driftwood's `DayNight` (`ModelExplorer.ts:143`). Nalati's clock is `DayClock`
     (`weather.clock`), so give the presets a clock interface both implement.
  5. DETAIL TIERS: `glbPaint.ts` picks `.phone.glb` from the module-level `TIER` constant, so `withTier()` can't switch
     it. `loadNalatiModel` needs a tier argument for `buildAt`.
  6. Small: hub art (Driftwood-only; Nalati gets its picker art), `overhead` should list Nalati's near-eye layers for
     the map shot, and the dressing's `life` (butterflies, pollen) follows the parked player (`dressing/index.ts:191`).
- **Risk:** none for play; Explore is a lazy chunk. Doing it before P-3 means a second, throwaway registration list,
  which is exactly what ENGINE-FIT E1 set out to avoid (D3).

## 4. The 3D model pipelines, side by side

| | Driftwood (main) | Nalati |
|---|---|---|
| Procedural models | `lowpolyKit` (E8/M1): one merged non-indexed faceted mesh per model on one shared material, voxel AO baked per face | `PaintKit` (`world/nalati/paint.ts`) on the one painterly Lambert |
| Generated models | `scripts/img2mesh/`: TRELLIS.2 / Hunyuan3D-2 → `driftwood_post.py` (decimate, 14 colours, AO) → GLB (the Drowned Captain, `captain.glb`, bound per vertex to the rig at load); a CC0 kit recoloured | TRELLIS / Hunyuan GLBs with a base-colour atlas, `.phone.glb` 512² copies, `.far.glb` LODs; the rigged hulls baked offline onto the species' skeletons (`scripts/nalati-rig-bake.mjs`, `creatureRigBake.ts`, `glbCreatures.ts`). **Further along than Driftwood's V-M1** (creatures from image-to-3D is still an open Driftwood row) |
| Scene bake | The Blender cove (`scripts/blender/*`, `BlenderIsland.ts`, `blenderArea.ts`): terrain tiles, ~13 k placements, Cycles AO + bounce lightmaps, meshopt, tiles per tier; the day clock stays live | Look v2's runtime bake: a shadow + contact map of the static casters, re-baked when the sun swings 1.5° (`nalati/look/bake.ts`) |
| Collision | `colliderDescs()` beside the geometry of every builder; hulls from the drawn vertices; treads | Hand boxes + floor functions; **no model has colliders** (`modelProps.ts` "keeps the procedural piece's colliders") |
| Registry / Explore | Every piece registered once with `model` | None |
| Tiers | `TIER_CONFIG` read inside `build()`, so `withTier` works | The `TIER` constant, so it doesn't |

**What Nalati should adopt:**

- builders emit `ColliderDesc` beside their geometry: hulls from the GLB's own vertices for rocks, balbals and the
  cairn, primitives for yurts and fences;
- one `registry.add` per built thing, with `model`;
- tier-aware builders;
- the NaN clamp (the other review, §2 row 6).

**What it should not adopt yet:** the Blender bake (D5). It exists because Driftwood's day clock rules out baking the
sun, and look v2 already bakes the one term the Nalati mockups rely on (contact shade). The one idea worth taking is
`driftwood_post`-style decimation and AO for the procedural-only leftovers (the Golden King, the collie, Qara Batyr's
horse: N12). The licence ruling D12 (Hunyuan is fine in the Americas) covers Nalati too.

## 5. Everything else engine-level

- **WebGPU (`src/gpu/*`, X5, opt-in):** TSL ports exist for Driftwood's patched materials only. Nalati's painterly
  Lambert (a GLSL patch), look v2's dome / fog / grade and the grass rings have no ports, and the composer early-returns
  before `gpu.build`, so the screen is black. Fix: `GPU_MODE` reads null when the active chunk is painterly (S), or
  port (L). See D6.
- **Boot / packs / preload-offline (E44):** Nalati has its pack (2.7 MB phone) and a `props` step with its own
  nouns. Three gaps:
  - **Undeclared rigs.** The 6 `*.rigged.glb` files (`glbCreatures.ts:78`) load during the animals step but aren't in
    `painterlyBoot()`, so DOWNLOAD under-reports and the SW doesn't precache them for offline. Add the six to
    `manifest.ts:30`, tiered.
  - **The SW routes `/assets/nalati/**` network-first** (`sw.js:71` `STATIC_RE`). That is the "B-SLOW" case the SW
    header warns about: a flapping radio holds the boot behind 26 MB it already has.
  - **`vercel.json` gives those unhashed files `immutable, max-age=1y`**, so an edited GLB never reaches a returning
    player. Add `nalati` to `STATIC_RE` and a `/assets/nalati/(.*)` rule with 30 days, like `tex` / `models`. S.
- **Perf budgets:** PLAY-PERF's phone ≤ 150 calls / ≤ 2 M tris and LOAD-PERF's `bench.budget.json` rows (≤ 20 MB,
  ≤ 180 requests, warm play ≤ 4 s, longest task ≤ 100 ms) apply to every shard, but Nalati has never been run through
  `pnpm bench:ci`. Its archived numbers (52–95 calls, 0.77–1.4 M tris phone) predate physics and main's HUD. The
  1 834 bridge boxes are created in one `pre` step on the first frame, so watch that frame's long task. Run the bench
  with P-7.
- **GPU recovery / resume (E54, E61, E96, E98):** generic, and the reload path is right for Nalati. Two gaps: runtime
  bakes that don't `markGpuOnly` (`PainterlyRange.ts:100`, look v2's bake), so an in-place restore shows them empty
  (S); and the resume state lacks mounted / inside-kurgan (the other review, §5).
- **Settings (E55):** the renderer is a saved boot option, hence the WebGPU risk. Time of day doesn't reach Nalati's
  clock (`main.ts:338`), so wire `DayClock.set()` to it (S). Island / lighting / sky / post are Driftwood axes and
  don't apply.
- **Native apps (Capacitor):** nothing shard-specific. Nalati's saves are all `ws.*` keys, which `native/saves.ts`
  mirrors to Preferences.
- **Rotate gate (E38), dodge (E60 / T), feedback inbox:** shard-agnostic. They work on Nalati on foot.
- **Lock-on (E50):** `LockOnTarget.ts:47–48`: `HOSTILE` lacks wolf / kokbori / leopard (aqbars) / balbal warriors /
  ghost riders / the Golden King, and `MELEE` lacks `sabre` / `spear`. Hence the dead LOCK button. Adding them is S.
  Mounted lock and the bow's lock (E75) are D4. When the lock orbits, `Player.step`'s orbit MOVE is on-foot only.
- **Quest / Adventure hooks:** `installAdventure` is Driftwood-only (`main.ts:496`). What a shard wires is covered in
  `review-experience.md` §4. The engine hooks it relies on that Nalati lacks are `registry.floorAt` (placement on Nalati
  decks: undefined until P-3) and LOS-checked prompts (`pickInteractable`, which already works against the bridge
  boxes).
- **Gating by proxy:** Nalati's `weapon: 'sword'` is left over from "the Driftwood sword until the bow / sabre land".
  It builds the iron sword viewmodel for nothing (`main.ts:359`) and turns on the island-only hurt arc and trauma shake
  (`main.ts:547–548`). Give `ChunkWeapon` a `'nalati'` value, or key those lines on the slug. S.

## Decisions for the user

**D1. The horse's body.**
(a) A capsule lying along the horse's body, on its own `CharacterMotor` in the fixed step, with the rider's capsule
off. · (b) Keep Mount's hand-rolled collision; only switch the rider's capsule off and hide the horse from your own
shots (the hotfix, nothing more). · (c) A compound body (two balls, withers + rump) on a kinematic body.
**Recommend (a) after the hotfix (b).** (b) makes riding work today. (a) is what E3 / P10 planned. It deletes the
second copy of collision code and gives real fence jumps and bridge carrying.

**D2. The climb limit on Nalati** (27 % of the land is over 40°).
(a) Keep main's 0.35 m / 40° on foot. Mountains are walls, and roads, treads and graded paths reach every POI. ·
(b) Loosen it on Nalati only (e.g. 45°). · (c) Keep 40° on foot and give the horse its own limit (~35° at a gallop,
steeper at a walk).
**Recommend (a) + (c).** It is the user's own rule from PHYSICS. The horse needs a limit anyway: today it rides up
anything.

**D3. When Explore turns on for Nalati.**
(a) With the merge, as E66 did it (flag + pins + a `registerNalatiModels` list). · (b) In the same change as P-3, so
every POI registers once with `model`, drawn, colliding and explorable. · (c) Keep it off (V7's "pine hollow only").
**Recommend (b).** (a) builds a second list that P-3 throws away; (b) costs almost nothing extra.

**D4. Lock-on on Nalati.**
(a) Sabre + spear lock on foot, on the Nalati hostiles, like the sword. · (b) (a) plus a mounted lock (the camera
tracks the target, the horse steers freely). · (c) Wait for E75's ranged lock, since the bow is Nalati's main weapon.
**Recommend (a) now, (b) with N17.** (a) turns a dead button into a working one for an S.

**D5. The Blender pipeline for Nalati.**
(a) No. Keep the generated GLBs and look v2's runtime bake; adopt only the registry / collider / tier conventions. ·
(b) A Blender pass for the valley and camp (terrain tiles + Cycles AO), like Driftwood's V-B1. · (c) Both, (b) later.
**Recommend (a).** The Blender bake answers Driftwood's problem (a live day clock, a faceted beach). Nalati's look
already has its own bake.

**D6. WebGPU on Nalati.**
(a) Nalati always runs WebGL, whatever the saved renderer pick. · (b) Port the painterly material, look v2 and the
grass to TSL. · (c) Leave it (black screen).
**Recommend (a).** WebGPU is parked on main; (b) is L for an opt-in experiment.

**D7. One day clock or two.** Main has `DayNight` (Driftwood); Nalati has `DayClock` (whose header says "Driftwood D38
wants the same clock").
(a) `DayClock` becomes the engine clock, and Driftwood moves onto it. · (b) Keep both; Settings ▸ Time of day and
Explore's light presets drive either through one small interface. · (c) Leave as is.
**Recommend (b) for the merge, (a) as a later ask.** It doesn't touch the remaster's tuned look.

**D8. Herds and the player's body.** With physics, near horses can't pass through you.
(a) As physics has it: herds flow round the player, and a knockdown needs contact. · (b) Stampeding horses and the
stallion's charge ignore the `PLAYER` group, so they run through and bowl you over (the knockdown shove is the hit). ·
(c) (b) only while you're on foot. Mounted, they collide with the horse.
**Recommend (c).** A stampede should knock a walker down, not pile up against him. A rider in the herd should ride with
it (that is also the "riding with the stampede" Phase D wish).

**D9. ENGINE-FIT E5 (a shard module) with this merge?**
(a) Yes: Nalati becomes `src/shards/nalati` with `{config, buildWorld(registry), species, pois, hooks}`, and main.ts
loses its 38 shard branches. · (b) No: keep `wireNalati`, but put all the new registry / collider work inside
`src/nalati` and `src/world/nalati` so main.ts stays untouched. · (c) Do E5 after both merges settle.
**Recommend (b) now, (c) later.** E5 is 1–2 days of refactor across three shards, and it would collide with the riding
and HUD work in flight.

## Suggested order (for N16)

1. **P-1** riding hotfix + the smoke test (S), handed to the N17 agent before they tune feel on a frozen horse.
2. The S fixes: the WebGPU fallback, the SW / `vercel.json` / rig declarations, lock-on sabre + spear, `ChunkWeapon`,
   Time of day → `DayClock`, `markGpuOnly`.
3. **P-3** colliders + registry, with **Explore** on in the same change (D3), then **P-6** surfaces.
4. **P-2** the horse on its motor, then **P-4** arrows / javelins on queries.
5. **P-5** the navmesh, then **P-7** the baseline, walk route, ride legs, bench and phone gate. Close E72 with that
   evidence.
