# Engine-fit audit — Nalati Grasslands branch (E45)

Repo: `/Users/raynos/projects/games/wildshard-nalati-grasslands`, branch `nalati-grasslands`. Read-only audit, 2026-09-23.

## 1. What Nalati adds on top of main

- **69 commits** `main..HEAD` (2026-09-22 → 09-23, two days); main is 90 commits ahead of the merge base (`614f447`).
- **Committed:** `git diff --stat <mb> HEAD -- src` = **124 files, +21 053 / −175**. 77 new src files.
- **Uncommitted WIP in the worktree** (the whole riding / taming / elites / night-enemy wave): 36 untracked src files =
  **5 328 lines** (`src/player/Mount.ts` 409, `src/game/Taming.ts` 273, `src/nalati/ride.ts` 87, `src/ui/RideHUD.ts` 211,
  `src/nalati/ghostRiders.ts` 412, `src/nalati/elites.ts` 829, `src/game/Elite.ts`, `src/nalati/stealth.ts` 247,
  species `ghostRider / balbal / eagle / leopard / kokbori`, `PaintedBackdrop.ts`, `PainterlyRange.ts`, `nalatiTextures.ts`)
  plus 26 modified tracked files (+720 / −364). **Horse riding (B7) and taming (B8) exist only as uncommitted WIP.**
- No deploys: the plan forbids pushing from the worktree (`docs/plans/NALATI.md` "Deploy — none from this worktree"); a
  279 MB checkpoint push held the shared lock 80+ min and was killed. A prepared merge had **11 conflicts**.
- Plan: `docs/plans/NALATI.md` (152 lines; waves B0–B16 + look pass L1–L8). Design: `docs/design/nalati/*.md`
  (1 717 lines: geography, combat, wolves-horses-taming, stealth-and-storms, elites-and-bosses, controls, look-pass).

Biggest committed files: `player/Bow.ts` 942, `world/nalati/KurganDungeon.ts` 927, `nalati/kurganBoss.ts` 795,
`player/Spear.ts` 727, `world/WeatherFX.ts` 678, `entities/species/horse.ts` 573, `world/nalati/dressing/place.ts` 543,
`world/DayNight.ts` 533, `world/GrassPainterly.ts` 531, `entities/Herd.ts` 505, `chunks/nalati-grasslands.ts` 450,
`entities/Pack.ts` 427, `entities/Flock.ts` 411. World POIs + dressing: 20 files / 5 561 lines under `src/world/nalati/`.

## 2. Engine-ish systems Nalati had to build or bend (no physics engine anywhere)

### Mounts / riding — `src/player/Mount.ts` (409, uncommitted)
- **Hijack pattern, not a vehicle abstraction.** `Player.ride: { drive(dt) } | null` (`Player.ts:148`); `Player.update`
  early-returns into `ride.drive(dt)` (`Player.ts:272`). Mount then writes `player.position / velocity / onGround /
  sprinting / crouching / speedFactor` directly and owns the camera (`Mount.ts:206–323`).
- The horse is an ordinary `Animal`; riding flips `mem['ridden']=1` / `HorseHerd.setRidden` so the herd AI lets go, then
  calls `a.setMotion(heading, speed, 50)` **and** overwrites `a.yaw / a.speed / a.state` so mesh and camera agree
  (`Mount.ts:253–255`) — two integrators kept in lockstep by hand.
- Gaits, STEED stamina, turn rate by speed, slope cap (`normalAt(...)[1] < 0.72` → walk, `Mount.ts:246`), chunk-edge
  stop, jump as a scripted `sin(u·π)·1.05 m` arc on `a.yOffset`, auto-jump by probing 2.4 / 3.4 m ahead for a low OBB or
  a ditch (`obstacleAhead`, ~`Mount.ts:355`), rider bob / rock / roll / lean-low, mount swing camera lerp, ±170° free
  look (Parthian shot), bolt-at-20 %-hp → gallop to rail → rest 180 s, whistle-to-come. All hand-rolled.
- **Collision = a copy of `Player.collide`** (`Mount.ts:326` vs `Player.ts:564–587`): circle-vs-tree-cylinder push-out
  via `forest.nearby`, circle-vs-OBB (`Collider {x,z,hw,hd,rot,yTop,yBottom}`, `Player.ts:11`) push-out along the
  shallow axis, "airborne clears low boxes" hack. Radius 0.75 m circle for a 2.4 m horse — no capsule, no sweep, no
  step-up; tunnelling at 13 m/s gallop is only avoided because boxes are fat.
- Terrain following: `heightAt(x,z)` + an exponential ease of `eyeY` (`dt·12`). No suspension, no pitch to slope for
  the rider (the horse mesh tilts itself in `Animal`'s pose code, `Animal.ts:647`).
- Input read raw: `k.has('KeyW'|'ShiftLeft'|'Space')`, `p.touchMove`, `p.touchJump`, `this.touchGallop` (set by
  RideHUD), plus its own `document.addEventListener('keydown')` for X-whistle (`Mount.ts:110`).

### Herds / packs / flocks — `Herd.ts` 505, `Pack.ts` 427, `Flock.ts` 413, `Wildlife.ts` 236, `wildEnv.ts` 92
- All ride on the pre-existing `AnimalManager` (1 006 lines) via its "self-thinking species" escape hatch
  (`SpeciesDef.think`, 10 Hz staggered tick, `AnimalManager.ts:467–525`). Per-animal state is `mem: Record<string,number>`
  (`Animal.ts:115`) — an untyped component bag used by Mount, Taming, Herd, Pack (`ridden`, `owned`, `whistle`, `rear`,
  `buck`, `kick`, `toss`, `hidden`, `low`…).
- Steering is hand-written boids: horse cohesion > 12 m / separation < 2.5 m / alignment < 8 m, lead mare, stallion
  guard state machine (watch/warn/display/charge/wheel/lead/beaten/ridden); wolf ring-slot encircle with an attack
  token; sheep boids (O(n²) ≤ 60 at 10 Hz). Destination picking = rejection sampling on `inChunk && normalAt().y > 0.72..0.85`
  (`Herd.ts:252, 280`, `Pack.ts:144, 303`, `Flock.ts:195`).
- **Obstacle avoidance = trees only.** `AnimalManager.steer` (`:773`) repels from `forest.nearby` trunks and bends away
  from steep / wet / edge; `confine` (`:797`) pushes out of trunks and clamps to the slab. **No animal reads
  `player.colliders`** (grep: zero hits in `src/entities`, `src/nalati`) — horses, wolves, sheep and ghost riders walk
  through yurts, fences, the corral and carts that the player and the ridden horse collide with.
- Cross-system coupling through a module-global mutable bag `wildEnv` (grass height, trample, wind, light, storm,
  player look / crouch / mounted, `onEvent`, `onKnockdown`) wired imperatively in `nalati/index.ts:185–230`.
- Sheep = one InstancedMesh with vertex-shader legs (`Flock.ts`), a good perf pattern no engine gives for free.

### Ghost riders — `src/nalati/ghostRiders.ts` 412 (uncommitted)
- Horse `Animal` + a separate rider mesh glued on, driven by `steerLine` (`:348`) in a circle 34 m out; own arrow pool
  (`Projectiles` with `hurtsPlayer`), own fresnel material. Spawn / hold / dissolve API hand-built for the elite system.
  Same no-collider steering; `heightAt` only.

### Terrain at steppe scale
- Still the one **500 m slab** heightfield (`CHUNK_HALF`); "steppe scale" is faked: stepped climb (−10 → +36 → +75),
  `Horizon.ts` ring (+110 lines), a 360° painted matte `PaintedBackdrop.ts` (152, uncommitted), `PainterlyRange.ts`,
  aerial perspective in `Atmosphere.ts`. **No streaming**: everything is built at boot; the dressing layer
  (`world/nalati/dressing/layer.ts`) buckets instances into 24 m cells and CPU-culls them per view change.
- Painterly ground is a separate branch of `Terrain.ts` (`:47` `if (style==='painterly') return this.buildPainterly()`)
  with per-pixel detail injected from `nalati/terrainSurface.ts`.
- **Interiors are impossible on a heightfield-only ground model:** `Player.groundAt = max(terrain, platforms)`, so the
  kurgan dungeon cannot sit under its mound. It is a sealed volume **floating at y = 140** over flat plateau, entered by
  a fade-to-black teleport (`KurganDungeon.ts:8–14`); commit `6e92d53` needed a "floor snap … a shove into a drift
  never drops you to the terrain" fix.

### Grass — `GrassPainterly.ts` 531, `GrassField.ts` 196, `GrassTrample.ts` 239, `Wind.ts` 157
- Two instanced draws around the player (near clumps ≤ 20 m / 10 m phone, far field), a trample render-target map fed
  by every mover each frame, `grassHeightAt()` as the gameplay query for stealth. Pure custom GPU work — no engine has
  this; it would be rewritten on any engine anyway.

### Camp props / POIs — `world/nalati/*` (NomadCamp 196, Yurt 279, KurganField 177, Bridge 136, …)
- Each POI is a builder function returning `PoiPiece { object, colliders, platforms, tris }`; colliders are pushed by
  hand next to each mesh, e.g. `NomadCamp.ts:79, 96, 108, 137, 143, 170, 183` — ~15 hand-sized OBBs in one file,
  numbers typed twice (mesh dims and collider dims). Placement coordinates live in code; `clearings.ts` was edited 4× as
  POIs moved (`5323fd1`, `6551055`, `90585af`).

### Camera
- No camera rig abstraction: Player owns the FPS camera, Mount overwrites `cam.position / rotation` while riding, the
  Boss intro eases the camera to the boss, Taming tilts it with the balance (`breakRoll/breakShake` read by Mount).
  Three systems write the same camera with no priority stack.

### Touch controls while riding — `RideHUD.ts` 211, `TouchControls.ts` (+25), `touch.css` (+32)
- No input-context / action-map layer. RideHUD **injects buttons into TouchControls' DOM** and hides the foot discs with
  inline `style.visibility / display` (`RideHUD.ts:87–134`: GALLOP where JUMP is, LEAN L/R where AIM/GALLOP were, OFFER
  where AIM is, USE relabelled DISMOUNT). Stealth fakes a crouch by writing `'KeyC'` into `player.keys`
  (`stealth.ts:22, 162`). Mount reads raw key codes. Every mode switch = hand-edited DOM + key-code conventions.

### Particles / FX
- Hand-rolled per system: `WeatherFX.ts` 678 (rain curtains, bolt, storm deck, rainbow), `Smoke.ts` 117,
  `Flutter.ts` 176 (ribbons), `dressing/life.ts` 312 (pollen, butterflies, kites), `nightFx.ts` 124, the kurgan's
  `fxMaterial(mode)` shader, ghost-rider mist `Points`. ~1 400 lines of emitters, each with its own pool/program.

### Animation
- Fully procedural rigs (`horse.ts` lofts + bones; `Animal.ts` blends idle/graze/walk/trot/gallop pose generators with
  `mem` knobs rear/buck/kick/stamp/toss). No clips, no GLTF. An animation state machine would add little; the
  procedural generator *is* the state machine and it was reused unchanged for riding (the gait follows `setMotion`).

## 3. Shard abstraction — how forked is it?

- **There is a data abstraction but no behaviour abstraction.** `ChunkDef` (309 lines, `src/chunks/ChunkDef.ts`) covers
  terrain function, splat, trees, fauna list, sky / fog / grade numbers, `style`, `weapon`, `ocean?`, `horizon?`. A
  `_template.ts` + `registry.ts` makes a *terrain-and-lighting* shard a copy-and-fill job.
- Everything else is **identity checks on three different signals**:
  - Driftwood = `chunk.ocean !== undefined` → ~20 `isOcean ? new X : null` lines in `main.ts:104–243` (hut, lookout,
    wreck, shrine, boat, palms, cove, bridge, seabed, enemies — imported by name from `chunks/driftwood-isle`).
  - Nalati = `chunk.style === 'painterly'` → `wireNalati()` inside main's `props` step (`main.ts:105, 227`); Terrain,
    Grass, AnimalFactory, Atmosphere, Game, Hands branch on the style (19 files, e.g. `AnimalFactory.ts` ×5, `Game.ts` ×3).
  - and `chunk.slug === 'nalati-grasslands'` for the weapon kit (`main.ts:256`) and grass field (`GrassField.ts:78`,
    which also **imports `RIVER` from the Nalati chunk file** into a shared module, `GrassField.ts:5`).
  "Painterly" therefore means "Nalati"; a 4th painterly shard would inherit Nalati's grass field, kit and world.
- `nalati/index.ts` (297 lines) is the one good seam: a `Nalati` interface with `update`, `attachAnimals`, `bindPlay`,
  `weather.bind`, `boss.bind`, `elites.bind`, `sound.bind`. But main still calls ~12 `nalatiNow()?.x` hooks
  (`main.ts:241–540`: sheep raycast, `onShot`, `onImpact`, sound override of fire/impact, boss death handoff…).
  Driftwood has no equivalent module at all.
- **Merge cost is the proof:** 24 shared src files were changed on *both* branches since the merge base (`main.ts`,
  `Game.ts`, `Sky.ts`, `Terrain.ts`, `Atmosphere.ts`, `Player.ts`, `Animal*.ts`, `Weapons.ts`, `HUD.ts`, `Menu.ts`,
  `Settings.ts`, `Minimap.ts`, `Audio.ts`, …). `Sky.ts` +178, `Terrain.ts` +142, `Horizon.ts` +110,
  `Atmosphere.ts` +110, `Grade.ts` +84, `Game.ts` +55, `Weapons.ts` +54, `main.ts` +47 — shard code living in engine
  files.
- **Adding a 3rd shard today:** copy `_template.ts` (terrain/lighting data) — easy. Then invent a new identity flag,
  add `if (flag)` branches to main.ts's dressing / props / animals / weapon steps, a `wireX()` module, per-style
  branches in Terrain / Grass / AnimalFactory / Atmosphere, and hand-place colliders per POI builder. Generic pieces
  that *are* reusable: `Boss.ts` (328, generic state machine + `BossScript`), `Elite.ts` (+ `EliteScript`),
  `Projectiles.ts`, `Weather` / `DayNight`, `Wind`, the `think` species hook, `PoiPiece`.
- What a component / prefab system would have paid for: (a) a shard = a scene file listing prefabs (Yurt, Corral,
  HitchingRail with `Mountable`, Flock, Pack spawner) instead of `main.ts` branches; (b) collider + mesh + interactable
  in one prefab instead of dims typed twice; (c) `Mountable`, `Herd member`, `Target`, `Stealth observer` as components
  instead of `mem['…']` strings and `wildEnv` globals; (d) per-shard systems registered, not `nalatiNow()?.` hooks.

## 4. Pain points (git log + plan docs)

1. **The look pass dwarfs everything** — 17 of 69 commit subjects are "look pass" (+ L1–L8 rows); the user called the
   mockups "a hundred times better"; a whole strategy change (painted textures, matte backdrop, paint-over targets,
   `look-pass.md` "Strategy change 2026-09-23") after procedural vertex colour stalled. A 237-line parity harness
   (`scripts/nalati-parity.mjs`) plus 8 dev harness pages (`dev/nalati-*.html`, 921 lines of `src/dev/nalati-*.ts`)
   stand in for an editor viewport. **No engine fixes this** — it is art direction + custom shaders.
2. **Shared-file integration churn** — `nalati/index.ts` touched in 11 commits, `chunks/nalati-grasslands.ts` 7,
   `painterly.ts` 6, `Game.ts` 5, `main.ts` 5; commits `6feb6ae` "Tests follow the Nalati data", `eead556` "un-commit the
   dressing agent's line … HEAD failed tsc", 4 "integration" commits, 11 merge conflicts on the prepared merge.
3. **World layout by coordinates in code** — POIs moved and re-cleared repeatedly (balbal knoll moved "clear of the
   S-road valley", Eagle Rock "a broad +40 granite shoulder after the W-road valley, which cut it", spruce margin round
   POIs, "no spruce in the POI clearings", `dressingCover(x,z)` so grass skips boulders). Each move = edit terrain fn +
   clearings + mask + dressing in 3–4 files. A scene format / placement tool would have made these one-edit moves.
4. **Ground model limits** — the dungeon at y = 140 + teleport + floor-snap fix; weather needing `indoors: () =>
   boss.inside` (`1a0ce8d`) because the "interior" is really outdoors in the sky.
5. **Riding + taming + elites still uncommitted** after ~5 300 lines — the most coupled wave (Mount ↔ Player ↔ Herd ↔
   Taming ↔ RideHUD ↔ TouchControls ↔ Bow.setMount ↔ Stealth) is the one not yet landed.

## 5. Judgement — which engine features would have saved the most Nalati work

Ranked by Nalati hours saved (not by engine marketing):

| # | feature | saving | why |
|---|---|---|---|
| 1 | **Collision world + character controller (Rapier KCC)** | **High** | Would replace `Player.collide` + its copy in `Mount.collide`, the "airborne clears low boxes" hack, the hand-typed OBBs per POI (`NomadCamp.ts` ~15), the slope caps, and — critically — allow a real interior under the kurgan (trimesh floor + heightfield hole) instead of the y = 140 teleport. The horse = a second KCC capsule (bigger radius, autostep for ditches). Animals could finally collide with yurts / fences via shape casts. **The physics branch's PHYSICS.md covers only Pine Hollow + Driftwood ("both shards") — Nalati's mount, herds and kurgan are not in it; add them.** |
| 2 | **Navmesh + crowd steering (navcat, already P6b in PHYSICS.md)** | **High** | Fixes the biggest correctness hole (no animal avoids a collider), replaces rejection-sampled destinations, and gives stampedes / pack rings paths around the camp. Boids / pack tactics stay custom — keep Herd/Pack/Flock as the *decision* layer, use the navmesh + crowd for locomotion. P6b's species list must add wolf / horse / sheep / dog / ghost rider. |
| 3 | **Input action map with contexts (incl. touch layouts)** | **Medium-high** | Riding / taming / crouch / dungeon each swap the control set. Today that is RideHUD DOM surgery, fake `'KeyC'` presses and raw `KeyW`/`ShiftLeft` reads in Mount. A small action layer (`move`, `gallop`, `jump`, `dismount`, `lean`; contexts foot / mounted / breaking / crouched; per-context touch disc layout) is a ~300-line borrow, no engine needed. |
| 4 | **Components / prefab + scene data** | **Medium-high** (grows per shard) | Would remove main.ts identity branches, the `mem` string bag, `wildEnv` globals, twice-typed collider dims, and the 3–4-file edit for each POI move. Doesn't need a full ECS: a typed `Prefab = { mesh builder, colliders, interactables, components }` + a per-shard `ShardModule` interface (generalise `nalati/index.ts`, give Driftwood one) + a JSON/TS placement list. This is the key enabler for shard #3. |
| 5 | **Camera rig with priorities** | Medium-low | Player / Mount / Boss intro / Taming all write the camera. A tiny stack (base FPS, mounted offset, shake, cinematic override) is cheap to write in-house. |
| 6 | **Particle system** | Medium-low | ~1 400 lines of bespoke emitters (WeatherFX, Smoke, Flutter, life, nightFx, kurgan fx). A shared GPU particle/emitter module (three.quarks-style) would dedupe, but each effect's look is custom and phone budgets demand one-program tricks anyway. |
| 7 | **Vehicle / mount component from an engine** | Low | Engine "vehicles" are wheeled raycast cars; a horse with gaits, stamina, auto-jump, Parthian look and a procedural rig is game logic. With #1 + #3 in place, Mount.ts shrinks to gait/stamina/camera (~250 lines). |
| 8 | **Animation state machine** | Low | Rigs and gaits are procedural and already blend by speed; there are no clips to state-machine. |
| 9 | **Editor / inspector** | Low for agents, some for humans | Agents don't use a visual editor; the parity + dev harness pages already fill the "viewport" role. A lil-gui/tweakpane inspector over `window.__painterly`-style knobs is the useful slice. |

**Verdict for Nalati:** the work that consumed the branch (look pass, grass, painterly shading, procedural creatures,
herd/pack AI, boss/elite scripting) is exactly the part no three.js engine provides. What an engine *would* have saved
is the plumbing: collisions + character/mount controller, navmesh locomotion, input contexts, and a prefab/shard-module
seam. All four are available as borrowable parts (Rapier KCC, navcat, a small action map, a typed prefab/ShardModule
pattern) — option (b), not a migration. Priority for the physics branch: extend PHYSICS.md to Nalati (horse capsule,
animal shape casts vs OBBs, kurgan interior under a heightfield hole) before the Nalati merge lands, or the Mount /
Player collision copies get a third fork.
