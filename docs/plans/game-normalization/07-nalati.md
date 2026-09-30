# GAME-NORMALIZATION v2 · 07 — Nalati Grasslands becomes a plugin (S3.1–S3.5, milestone M3)

Nalati Grasslands (`nalati-grasslands`) plugs into the engine today through one call and eighteen binds: `main.ts`
calls `wireNalati` inside its `props` step when `chunk.style === 'painterly'`, then reaches back into the returned
object through `nalatiNow()` for its creatures, its riding, its sound, its weather, its bosses, its elites and its
skins. Its look is spread over `Game.ts`, `Terrain.ts`, `Grass.ts`, `Atmosphere.ts`, `Sky.ts` and the minimap, and
~10k lines of its code live in engine folders. This spec moves all of it behind a manifest + plugin on
[01-architecture.md](01-architecture.md), makes the painterly look a `ShardRender` (S3.2), puts the Nalati weapons on
the kit families (S3.3), its bosses and elites on the encounter runtime (S3.4), and finishes the engine audio (S3.5).
It ends at M3.

Weapon, species, strike, boss and elite internals (profiles, numbers, StrikeSpecs, damage rules) are in
[09-combat-ai.md](09-combat-ai.md) and are referenced here by their ids (W4–W9, W12, S10–S28, B2, B3). This file owns
the shard side and every engine line that branches on Nalati.

## 0. How to read this spec

[05-nine-dragon.md](05-nine-dragon.md) §0 applies unchanged: line references are at `3f83fd2e` (no `src/` change up to
`0b6aa045`), every row carries a **grep key** that survives F6's moves, paths after F6 are written
`src/engine/…` / `src/kit/…`, and `shard:x` here means `src/shards/nalati-grasslands/x`. Every commit runs
`node scripts/parity.mjs --shards <changed> --tier phone,desktop` (all four shards on any engine edit), `pnpm test`,
a pathspec commit `E357 S3.<n>: …` and `scripts/push-main.sh` (12-process §5).

**At S3 start** S1 and S2 are done. That means these exist and are used here without being rebuilt:
- the plugin verbs, the staged boot, tier resolution, `bootTrace`, `ctx.debug.expose` (05 §5);
- the Equipment / Weapon / Tool contracts, the Melee family (Sword, Sabre, Spear + Thrown) with the B1 / B2 wall
  fixes, the damage pipeline and the effects core with player health in the engine (S1.2–S1.3);
- the input service, the context stack and disc relabels (S1.4);
- the audio slice: `ScoreSource`, `SetScore` (Nalati's `SteppeScore` is already `new SetScore({ dir:
  '/assets/music/nalati/', manifestKey: 'nalati', pick: steppePick })`, 05 §6.5 A.2), `AmbienceBeds`, per-shard SFX
  sets, cue maps (S1.5);
- the Bow, Crossbow and Firearm families (the `BOW` and `AR15` rows are the Bow / Firearm family defaults, 09 §1.4),
  the projectile, ADS and brass blocks (S2.2);
- the AI runtime (HFSM, `StrikeRunner`, the director, `BossBrain`, one `EliteBrain`, `GroupBrain`, weighted spawn and
  loot tables, `canReach` on every shard) (S2.3);
- `DayCycle` and `Weather`: Nalati's `DayClock` is a `DayCycle` with `DEFAULT_SCHEDULE` and elevation keys, its storm
  is `class SteppeStorm extends Weather` at `src/engine/world/…`'s old path, the rain curtain is `#kit/weather/
  rainCurtain.ts` (06 §6.4). Their **keyframe application** and **file moves** are left to this phase;
- the quest runtime on `quest/core`, the starter effects, `#kit/npc/npcRig.ts` seeded with Pine's rig (S2.5);
- the scheduler (S2.6) with decision 85's bands (01 §12): **near 0–60 m brain 20 Hz + body every frame, mid 60–160 m
  brain 10 Hz + body every 2nd frame, far 160 m+ paused**, instant interrupts, pinned bosses / elites / quest actors,
  strike phases on the body clock (13-lead-resolutions 09#4).

**Order inside S3:** S3.1 → S3.2 → S3.3 → S3.4 → S3.5. S3.2 (the look: `src/engine/render/**`, `shard:look/**`) and
S3.4 (encounters: `shard:combat/**`, `shard:creatures/**`) may run as two subagent lanes after S3.1 lands; S3.3
touches `src/kit/weapons/**` and `shard:weapons/**`, `shard:ride/**`, `shard:stealth/**`, so it runs after S3.4 or in
the lane S3.2 finished. S3.5 is one lane of its own (`src/engine/audio/**`, every shard's `audio/`): it edits all four
shards' audio and runs parity on all four.

## 1. Inventory (a): every file of Nalati's code today and where it goes

"F6" in the *When* column means F6's codemod already did the move; the S3 row then restructures the file in place.

### 1.1 The def and `src/chunks/nalati-grasslands/`

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `src/chunks/nalati-grasslands.ts` (661) | `shard:manifest.ts` (data, §3) + `shard:world/terrain.ts` (every pure function and constant of `:41-576`: `SEED`, `RIVER`, `BRIDGE`, `SPAWN`, `riverMask`, `rimZAt`, `brookMask`, `bowlQ`, `ringMass`, `glacierNear`, `zoneAt`, `ridgedMF`, `ribs`, `crags`, `upland`, `padY`, `gateValley`, `landscape`, `glacierMask`, `kokparMask`, `outcropAt`, `ringGround`, `edgeBermAt`, `TERRAIN`, `loneSpruceMask`, moved verbatim) + `shard:look/ground.ts` (`C`, `mixInto`, `groundColor` `:485-564`, `surfaceAt` `:566-573`) | F6 rename; S3.1 split; S3.2 `look/ground.ts` | The manifest imports `world/terrain.ts` (node-safe: `bake-chunk.mjs`, `bake-navmesh.mjs` read it today). `groundColor` / `surfaceAt` stop being def fields: the terrain painter reads them (S3.2) |
| `src/chunks/nalatiLayout.ts` (161), `nalatiEdge.ts` (105) | `shard:layout.ts`, `shard:world/edge.ts` | F6 | Every coordinate (`+z north, −x east`); `edgeRise`, `edgeSpruceMask` |
| `src/chunks/nalati-grasslands/roster.ts` (44) | `shard:roster.ts` | F6 | The `roster` thunk |
| `src/chunks/nalati-grasslands/models/*.ts` (32 files, 3,989 lines: `ambientLife` 119, `balbal` 184, `campGenerated` 95, `campProps` 518, `cragLedge` 41, `cragRock` 201, `creatures` 135, `dressing` 480, `dressingProps` 291, `eagleRock` 132, `fence` 85, `fieldstone` 47, `gear` 152, `glacierSnout` 72, `herdHorse` 15, `kokparGoal` 27, `kokparPost` 21, `kokparRider` 15, `kunesBridge` 158, `kurganEntrance` 148, `kurganKerb` 36, `leopardCave` 102, `outcrop` 115, `people` 87, `reins` 42, `saddledHorse` 15, `signpost` 148, `snowLotus` 15, `stoneStep` 36, `watchtower` 25, `windCairn` 121, `yurt` 311) | same names under `shard:models/` | F6 | Content on the model contract. `check-models.mjs` folder rules are re-pointed by F6 (TP10) |
| `src/chunks/thumbs/nalati-grasslands*.jpg` | `shard:thumbs/` | F6 | `manifest.card` |

### 1.2 `src/nalati/` (36 files, 9,463 lines)

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `index.ts` (427) | `shard:plugin.ts` (the install order, §4) + `shard:runtime.ts` (`NalatiRuntime`: the fields of today's `Nalati` interface `:66-127`) | S3.1 | `wireNalati` is deleted; its body becomes `install(ctx)` in the same order. The `updates` array (`:124`, 14 pushes) becomes 14 systems (§4). The hand-chained wrappers of `attachAnimals` (`:343`, `:375`), `bindPlay` (`:332`, `:344`, `:381`, `:406`), `sheepTarget` (`:345`), `onImpact` (`:386`) and `onShot` (`:333`) disappear: each part subscribes to events itself. `new URLSearchParams(location.search).get('ride')` (`:384`) → `ctx.app.params.get('ride')` (harness param, `lint/url-params.json` has `ride`) |
| `ride.ts` (178) | `shard:ride/ride.ts` | S3.3 | Riding + taming wiring. `ctx.animals.onCharge?.(a, d)` (`:76`) → `combat.hit({ source: 'env.ride', tags: ['env.ride'], amount: d, cause: 'Thrown from the saddle' })` (09 §3.3 *Ride*) |
| `stealth.ts` (270) | `shard:stealth/stealth.ts` | S3.3 | Stops writing `player.keys` (`:164-180`): answers `ask('player.crouch')` (§6.3 C). Its `document` / `window` key listeners (`:136-141`) go (the `crouch` action). `hudSlots.disc` / `statusRow` (`:123-133`) → `ctx.hud.disc` / `ctx.hud.widget` (band from `ROW.stealth`, `ROW.grass`). `player.preUpdate` chaining (`:143-144`) → a system `shard.nalati.stealth.crouch` in `input`, `before: ['engine.player.input']`. `Object.assign(window, { __stealth })` (`:145`) → `ctx.debug.expose('nalati.stealth', …)` |
| `sound.ts` (222) | `shard:audio/sound.ts` | S3.5 | The kit voices `fire(id)` / `impact(…)` (`:164-178`) become Nalati's CueMap entries; the creature calls and hooves stay here as the shard's voice table; `bind(audio, music)` becomes plugin wiring; `window.__nalatiSound` (`:220`) → `ctx.debug.expose('nalati.sound')` |
| `weather.ts` (307) | `shard:world/weather.ts` | S3.1 | Constructs `SteppeStorm` (engine `Weather` subclass since S2.4) and Nalati's `DayCycle`. `qs.get('time')` / `qs.get('clock')` (`:171-179`) → `ctx.app.params` (both harness params). Its `bind({ audio, hurt })` lightning hurt → `combat.hit({ source: 'env.lightning', amount: 60, tags: ['env.lightning', 'through.walls'] })`; `window.__weather` (`:305`) → `ctx.debug.expose('nalati.weather')`; the `ws:weather` DOM event (`HUD.ts:55`) → `ctx.app.events.emit('weather.changed')` |
| `kurganBoss.ts` (802) | `shard:combat/goldenKing.ts` | S3.4 | `class GoldenKing extends BossBrain` (§6.4). `play.animals.onCharge` wrap (`:656-657`) → R0b (09 §2.2), the `hurt` route (`:663`) → `combat.hit` (`boss.golden-king`). `window.addEventListener('pointerdown'…)` (`:690-692`) → `ctx.scope.listen` until X1's `cutscene.skip`. `player.keys.has('Space' \| 'KeyE' \| 'Enter')` (`:681`) → `input.held('jump') \|\| input.held('use') \|\| input.held('confirm')`. `window.__boss` (`:700`) → `ctx.debug.expose('nalati.boss')` |
| `stormTitan.ts` (1,116), `stormTitanLook.ts` (304) | `shard:combat/stormTitan.ts`, `shard:combat/stormTitanLook.ts` | S3.4 | `class StormTitan extends BossBrain` (§6.4); every `hurt` → `combat.hit` tagged `boss.storm-titan` (bug B3 fixed by the tag); intro-skip listeners `:1031-1033` and `player.keys` `:1021` as the King's; `window.__titan` (`:1043`) → `ctx.debug.expose` |
| `elites.ts` (896) | `shard:combat/elites.ts` | S3.4 | The five on the engine `EliteBrain` (09 §5.4). `hurt: (a, dmg) => { play.animals.onCharge?.(a, dmg) }` (`:861`) → `combat.hit` with `from` (bug §7.2's Nalati half). `window.__elites` (`:888`) → `ctx.debug.expose` |
| `nightEnemies.ts` (65), `balbalWarriors.ts` (269), `ghostRiders.ts` (431), `nightFx.ts` (124) | `shard:combat/night.ts`, `balbalWarriors.ts`, `ghostRiders.ts`, `shard:combat/nightFx.ts` | S3.4 | Spawn tables with a `when` on the day cycle (09 §5.4). `animals.onCharge?.(a, damage)` (`nightEnemies.ts:59`) → `combat.hit`. `window.__balbals` / `__ghosts` (`balbalWarriors.ts:130`, `ghostRiders.ts:195`) → `ctx.debug.expose`. `nightFx.ts`'s pool merges into the one particle pool at X5. Every `Math.random()` in these four files → `app.rng.stream('ai' \| 'cosmetic')` (list in §6.4) |
| `adventure.ts` (252), `campPeople.ts` (376), `campPeopleModels.ts` (265), `kokpar.ts` (122), `sheepRaid.ts` (265), `bag.ts` (91) | `shard:quest/adventure.ts`, `shard:quest/campPeople.ts`, `shard:quest/campPeopleModels.ts`, `shard:quest/kokpar.ts`, `shard:creatures/sheepRaid.ts`, folded into `shard:bag.ts` | S3.1 (wiring), S3.3 (`campPeople` rig onto `#kit/npc`) | `adventure.ts`: `an.onKill` chaining (`:222-223`) → `ctx.on('actor.died')`; its read of `'ws.elites.v1'` (`:94-102`) → the encounter service's `elites.felled(id)` (the store is SaveStore key `elites`, scope shard, since S2.3); `window.__nalatiQuest` (`:250`) → `ctx.debug.expose`. `bag.ts`: `kitName` (`:55-56`, the golden / naizagai names) is deleted (the replaced weapon's row name, 09 §1.5); `nalatiFinds` and `skinRows` become `ctx.bag` fragments |
| `water.ts` (243), `wet.ts` (33), `outcrops.ts` (183), `cragRock.ts` (180), `terrainSurface.ts` (276) | `shard:world/water.ts`, `wet.ts`, `outcrops.ts`, `cragRock.ts`, `shard:look/terrainSurface.ts` | S3.1; `terrainSurface` S3.2 | `NalatiWater` implements `WaterBody` at X5 |
| `look/*.ts` (11 files, 1,535 lines: `bake` 231, `cloudSea` 80, `fog` 97, `grade` 133, `grass` 697, `horizon` 39, `index` 87, `light` 66, `panoramaData` 9, `sky` 221, `tint` 66, `zones` 40) | `shard:look/…` (same names; `index.ts` → `shard:look/install.ts`) | S3.2 | The painterly `ShardRender` (§6.2). `window.__gradeV2` / `__grassV2` / `__skyV2` / `__bake` (`grade.ts:27`, `grass.ts:80`, `sky.ts:160`, `bake.ts:143`) → `ctx.debug.expose('nalati.look.*')`. `TIER` / `TIER_CONFIG` reads in `grade.ts`, `bake.ts` (`PHONE_STATIC_OFF_CSM`) → `app.tiers.current` passed in by `compose` |

### 1.3 `src/world/nalati/` (31 files, 5,762 lines)

| Files (lines) | Destination | When | Why |
|---|---|---|---|
| `index.ts` (146, `NalatiPOIs`), `types.ts` (49), `layout.ts` (65), `places.ts` (106), `props.ts` (73), `solid.ts` (119), `granite.ts` (24), `clearings.ts` (44) | `shard:world/pois/…` | F6 | Only Nalati builds them (`nalati/index.ts:164`) |
| `NomadCamp.ts` (165), `SummerCamp.ts` (71), `Yard.ts` (78), `Bowl.ts` (328), `Bridge.ts` (23), `Cairn.ts` (25), `Crags.ts` (65), `EagleRock.ts` (22), `Stair.ts` (73), `RoadFurniture.ts` (75), `Balbals.ts` (100), `KurganField.ts` (86), `Smoke.ts` (119), `Flutter.ts` (176) | `shard:world/pois/…` | F6 | POI builders |
| `KurganDungeon.ts` (970) | `shard:combat/kurganDungeon.ts` | S3.1 (step 0 first, §6.1) | The Golden King's chamber. `fxMaterial`, `annulus`, `FX` are imported by the **engine** `game/Elite.ts:4` today: they move to `src/engine/fx/groundFx.ts` before the file moves (§6.1 step 0) |
| `dressing/index.ts` (263), `layer.ts` (138), `life.ts` (267), `place.ts` (736), `statics.ts` (139) | `shard:world/dressing/…` | F6 | `window.__nalatiDressing` (`index.ts:213`, dev only) → `ctx.debug.expose`. Nalati's `DressLayer` merges with the engine culler at X5 (01 §17 *Culling*) |
| `paint.ts` (504), `painted.ts` (312), `glbPaint.ts` (401) | `shard:look/paint.ts`, `painted.ts`, `glbPaint.ts` | F6; X5 | Painterly geometry and materials. `painted.ts:141` `document.dispatchEvent(new CustomEvent('ws:model-ready'…))` → `app.events.emit('model.ready', { id })`. `paint.ts`'s geometry helpers merge into the engine geometry kit at X5 (10-sweeps X5) |

### 1.4 Nalati code in other engine folders

| Today | Lines | Destination | When | Why |
|---|---|---|---|---|
| `src/world/painterly.ts` | 325 | `shard:look/painterly.ts` | S3.2 | The painterly material; engine readers (`Terrain.ts:10`, `DayClock.ts`) are gone after S3.2 |
| `src/world/PainterlySky.ts` | 273 | deleted | S3.2 | `buildPainterlyClouds` is built by `Sky.ts:450-458` and then hidden by `look/index.ts:48` (`sky.clouds.visible = false`); Nalati's backdrop (the panorama dome) replaces it. Nine Dragon's hidden build goes at X5 (05 §2.4) — see §6.2 step 5 |
| `src/world/nalatiTextures.ts` | 132 | `shard:look/textures.ts` | S3.1 | `boot/manifest.ts:16, 38-46` → `manifest.boot.files` |
| `src/world/Spruce.ts` (266), `spruceMask.ts` (79, unimported) | 345 | `shard:world/spruce.ts`; `spruceMask.ts` deleted | S3.1 | `bootstrap.ts:35` `spruce:` factory → `manifest.trees.factory` thunk (as Pine's, 06 §6.1 step 3). `spruceMask.ts` has no importer in `src/` (question Q8) |
| `src/world/steppeWind.ts` | 157 | merged into the engine `WindField` (`#engine/world/wind`, with `world/wind.ts`); its parameters become `manifest.wind` data | S3.1 | Read by `Sky.ts:8` and the **kit** Bow family (`Bow.ts:8, 687` `this.arrows.wind = worldWind`). The Bow family reads `app.world.wind`, one field per page fed by the running shard's `manifest.wind` (01 §17; 13-lead-resolutions 07/08#3). A shard whose manifest sets no gusts gives the arrows still air, today's `bow.wind = null` path |
| `src/world/GrassField.ts` | 201 | `src/kit/looks/grassField.ts` | F6 | `GrassTrample.ts:2` (kit, Pine + Nalati, 06 §1.3) imports `grassBaseHeightAt`; a kit file cannot import a shard, so the field it reads moves with it |
| `src/world/Weather.ts` (`SteppeStorm` since S2.4) | 349 | `shard:world/storm.ts` | S3.1 | Nalati's storm profile + lightning; `ask('weather.damage')` answered there (06 §6.4 B) |
| `src/world/WeatherFX.ts` | 678 | `shard:world/weatherFx.ts` (the deck, curtains, bolt, smoke, puddles, rainbow; `buildRain` is the kit curtain since S2.4) | S3.1 | Rule of two (06 Q3) |
| `src/world/DayClock.ts` | 533 | the clock half is the engine `DayCycle` since S2.4; `makeLook`, `SkyRig`, `copyLook`, `lightLevel`, `SkyLook` (`:195-533`) → `shard:look/skyRig.ts` (Nalati's `backdrop` keyframe application); `compassDir` (`:55`) → `src/engine/math/compass.ts` | S3.2 | 06 §6.4 A: "their keyframe application stays in their current files until S3.2" |
| `src/entities/Wildlife.ts` (239), `wildEnv.ts` (101), `Herd.ts` (532), `Flock.ts` (484), `Pack.ts` (459), `Marmots.ts` (160), `painterlyAnimals.ts` (17) | 1,992 | `shard:creatures/wildlife.ts`, `env.ts`, `herd.ts`, `flock.ts`, `pack.ts`, `marmots.ts`; `painterlyAnimals.ts` → `shard:look/creatureMaterial.ts` | S3.4 | Only Nalati. `Herd` / `Flock` / `Pack` become `GroupBrain` subclasses (09 §5.1). `AnimalFactory.ts:12, 89` imports `painterlyAnimalMaterial` for `style === 'painterly'`: the factory takes a `creatureLook` from `manifest.kitLook` resolved to a material factory the shard registers (`ctx.rows.creatureLook('painterly', factory)`) |
| `src/entities/eliteBrain.ts` | 16 | the engine `EliteBrain` (S2.3) | S2.3 | Already merged at S2.3; its Nalati importers are rewired in S3.4 |
| `src/entities/species/wolf.ts` (385), `sheep.ts` (187), `sheepdog.ts` (25), `horse.ts` (614), `balbal.ts` (485), `kurganBalbal.ts` (12), `goldenKing.ts` (441), `leopard.ts` (239), `eagle.ts` (159), `ghostRider.ts` (130), `kokbori.ts` (40) | 2,717 | `shard:species/…` (same names) | S3.4 | One shard each. **The horse stays in Nalati** (the lead's answer to 09 Q5: its second user, the horse playground, moves into this folder, so the rule of two keeps it here; 09 §5.2's "kit" row is overridden) |
| `src/player/Sabre.ts` (258), `Naizagai.ts` (264), `Spear.ts` (758), `GoldenBow.ts` (233) | 1,513 | `shard:weapons/sabre.ts`, `naizagai.ts`, `spear.ts`, `goldenBow.ts` | S3.3 | Class files per 09 §1.5 (`Sabre extends Melee`, `Naizagai extends Sabre`, `Spear extends Melee` composing the kit `Thrown` javelin, `GoldenBow extends Bow`) |
| `src/player/nalatiKit.ts` | 58 | deleted | S3.3 | The loadout rows (§3 `loadout`) replace it; its `refill` becomes `player.respawned` listeners on the rows' ammo blocks |
| `src/player/nalatiArms.ts` | 390 | `src/kit/viewmodel/steppeArms.ts` | F6 | Rule of two: Pine's `Longbow.ts` and `hunterHands.ts` import it too. Export names unchanged |
| `src/player/nalatiSkins.ts` | 233 | `shard:loadout/skins.ts` (rows) + `#game/cosmetics` (the locker, X5) | S3.3 | `STORE = 'ws.nalati.skins.v1'` (`:42`) is SaveStore key `skins` (scope shard, F10); `NalatiSkinLocker` merges into the one cosmetics service at X5 (10-sweeps X5) |
| `src/player/Mount.ts` (794), `Reins.ts` (183), `rideAssist.ts` (117), `riding.ts` (~20), `horseNames.ts` (52), `src/game/Taming.ts` (306) | 1,472 | `shard:ride/mount.ts`, `reins.ts`, `rideAssist.ts`, `horseNames.ts`, `taming.ts`; `riding.ts` deleted | S3.3 | Riding and taming are a shard mechanism (rule of two). `riding.horse` / `pastRidden` (read by `main.ts:522, 1150`, `ui/Combat.ts:7, 171, 194`) → the engine field `app.player.mountedOn: Actor \| null` that Mount sets; the creature raycast and the Combat floats skip it. `Mount.ts:209-212` `KeyX` / Shift and `Taming.ts:88-89` `KeyG` listeners → the `ride` context's actions (§6.3). `ws.nalati.tulpar` (`Taming.ts:55`) and `ws.nalati.horseNames` (`horseNames.ts:14`) are SaveStore keys `tulpar` / `horseNames` (scope shard) |
| `src/ui/RideHUD.ts` (232), `HorseNamePrompt.ts` (71) | 303 | `shard:ride/rideHud.ts`, `shard:ride/namePrompt.ts` | S3.3 | `hudSlots.disc` / `statusRow` → `ctx.hud.disc` / `ctx.hud.widget`; `HorseNamePrompt` appends to `#hud` (`:57`) → `ctx.hud.widget` now, the `modal` layer at X2 (10-sweeps X2 step 1) |
| `src/audio/SteppeAmbience.ts` (187) | — | `shard:audio/ambience.ts` (an `AmbienceZones` profile) | S3.5 | §6.5 |
| `src/audio/SteppeScore.ts` (154) | — | engine `SetScore` since S1.5; the Nalati parts left (`STEPPE_DIR`, `steppeFiles`, `steppeBootFiles`, `SteppeScene`, `steppePick`) → `shard:audio/score.ts` | S3.5 | §6.5 |
| `src/game/quest/nalati.ts` | 328 | `shard:quest/line.ts` | S3.1 | Pure data on the quest runtime (S2.5). `world/nalati/places.ts`, `world/nalati/index.ts`, `roster.ts`, `campPeople.ts`, `adventure.ts`, `index.ts`, `bag.ts` import it — all in this shard |
| `src/playgrounds/HorsePlayground.ts` (322), `horseCourse.ts` | — | `shard:playground/horse.ts`, `shard:playground/horseCourse.ts` | S3.3 | `ctx.playground(...)` (EI22). `PlaygroundHost.ride` (`Playground.ts:21, 37-38`) is deleted: the shard's playground reads its own runtime. `ws:practice-active` dispatches (`:155, 175`) → `app.events.emit('practice.active', …)` |
| `src/explore/img/{practice,world,models,sets}-nalati-grasslands.webp`, `playground-horse.webp` | — | `shard:explore/…` | S3.1 | `manifest.explore.art`; the playground card's art with the playground row |
| `src/game/achievements.ts:58-80, 99` (`NALATI`) | ~23 | `shard:feats.ts`, `ctx.rows.feat` | S3.1 | Feats per shard (decision 76) |
| `src/core/practiceRoom.ts` | 14 | engine (`app.practice.open`) | F8 | Generic; its comment names the horse track |
| `test/nalati-*.test.ts`, the Nalati parts of `test/*` | — | `test/shards/nalati-grasslands/` (TP11) | F6 | — |
| `scripts/nalati-*.mjs`, `nalati_score.py` | — | F7's liveness rule; `nalati-boot-check.mjs` is a harness block (F2) and ported to the probe; `nalati_score.py` is `own_score.py --set nalati` since S1.5 | F7 | — |
| `public/assets/nalati/**`, `public/assets/music/nalati/**`, the `shard: 'nalati'` entries of `public/assets/sfx/*/sfx.json` | — | **not moved** (TP §5) | — | — |

## 2. (b) Every engine line that branches on or wires Nalati, and what replaces it

### 2.1 `src/main.ts`

The 18 lines holding a `nalatiNow()` call (20 calls) are marked **N1–N18**; `wireNalati` and the three direct
`nalati?.` reads follow.

| # | Line(s) | Grep key | Today | Replaced by |
|---|---|---|---|---|
| — | 127, 286, 473 | `import { wireNalati, type Nalati }` / `let nalati: Nalati \| null = null` / `if (painterly) { nalati = await wireNalati({ game, sky, player, forest, chunk }); addPaths(); return null; }` | builds the whole Nalati world inside the `props` step, then lays the paths | `plugin.install` in `shard.world` (§4), which ends with `ctx.app.world.addPaths()` (the engine verb `addPaths` in `main.ts:416-418`, moved to `src/engine/world/paths.ts` at S3.1; its registry piece id `paths` unchanged). The step key `props` still receives the progress (`ctx.progress`) |
| N1 | 495 | `const wildlife = nalatiNow()?.attachAnimals(animals) ?? null` | Wildlife over the AnimalManager after the `animals` step | the plugin's `shard.play` stage: `rt.wildlife = new Wildlife(ctx.app.creatures, …)` (§4; the creature service exists in `shard.play`, 01 §8) |
| N2 | 496-497 | `const ride = nalatiNow()?.ride ?? null` / `if (ride) interactables.push(ride.interactable)` | riding + the one horse prompt | `shard:ride/ride.ts` built in `shard.play`; its interactable registered with `ctx.piece`'s interactable list (the registry's interactables, 01 §7 `piece`) |
| N3 | 510-513 | `const nalatiClock = nalatiNow()?.weather.clock` / `dayClockClock(nalatiClock, params.has('time') ? 'live' : setting('time'))` | Nalati's clock behind `WorldClock` | gone at S2.4 (06 §6.4 A): `app.world.dayCycle`. S3.1 deletes the line if S2.4 left it |
| N4 | 524 | `return wildlife ? nalatiNow()?.sheepTarget(origin, dir, maxDist, hit) ?? hit : hit` | the sheep flock, the night enemies and the Titan's heart as ray targets (chained, `nalati/index.ts:330`) | `ctx.answer('combat.targets.ray', (q) => …)`: the ask the engine's `Targets.raycast` runs after the creature raycast (§6.1 step 6). Nalati answers three times (sheep, night riders, the heart), in today's chain order |
| N5 | 623 | `const nl = nalatiNow(); return { id: w.id, name: nl ? nalatiKitName(w.id, w.name, { golden: …, naizagai: … })` | the Bag names of the golden bow / Naizagai | the replaced weapon's row name (09 §1.5, `equipment.replace`) — S3.3 |
| N6, N7 | 630 | `skins: () => { const nl = nalatiNow(); return nl ? nalatiSkinRows(nl.skins) : []; }, onWearSkin: (id: string) => { nalatiNow()?.skins.toggle(id); }` | GEAR's SKINS row | `ctx.bag.skins({ title: 'Skins', rows: () => skinRows(rt.skins), wear: (id) => rt.skins.toggle(id) })` (S3.3) |
| N8 | 694 | `if (nalatiNow()?.sound?.fire(weapons.current.id) === true) { /* voiced */ }` … `nalatiNow()?.onShot();` | Nalati's kit voices before the generic synth; a shot reveals you | the cue `cue.weapon.fire` (tags `weapon.<id>`) mapped by Nalati's CueMap (S3.5); `onShot` → `ctx.on('weapon.fired', …)` in stealth (`noteShot`) and wildlife (`lastShotT`) — S3.1 |
| N9 | 703 | `if (nalatiNow()?.sound?.impact(weapons.current.id, surface, pan, gain) === true)` | arrow / javelin / sabre impact voices | `cue.weapon.impact.<surface>` in Nalati's CueMap (S3.5) |
| N10 | 704 | `nalatiNow()?.onImpact(surface, point)` | a landing arrow spooks a herd; TRUST −30 near a stallion | `ctx.on('weapon.impact', …)` in wildlife (`disturb`) and ride (`noteShot`), in today's order (`index.ts:398-402`) — S3.1 |
| N11 | 752-753 | `installNalatiAdventure({ …, nalati: nalatiNow(), params })` / `menu.setFinds(() => nalatiFinds(nalatiAdventure.flags))` | the quest line, the camp's people, FINDS | the plugin's `installQuest(ctx, rt)` (S3.1); FINDS → `ctx.bag.finds(() => nalatiFinds(rt.quest.flags))` |
| N12 | 901-904 | `nalatiNow()?.bindPlay({ kit: nalatiKit, health01: () => health / maxHealth, …, hurt: (dmg) => { killer = { cause: 'Thrown from the saddle' }; health = …` | the kit, health, toasts and the ride's damage path handed to the wiring | deleted: the parts read `app.equipment`, `app.player.attributes.health`, `ctx.app.ui.toast`, and hurt through `combat.hit` (`env.ride`, S1.3's pipeline); the wolves' "alpha joins when you're hurt" reads `health / maxHealth` from the attribute |
| N13 | 906 | `nalatiNow()?.sound?.bind(audio, music)` | the steppe bed, hooves, the music's steppe scene | the plugin's `installAudio(ctx, rt)` (S3.1 moves the call; S3.5 rebuilds it on the engine audio) |
| N14 | 907 | `nalatiNow()?.weather.bind({ audio, hurt: (dmg, why) => { killer = { cause: 'Struck by lightning' }; …` | the storm's beds + thunder, the lightning's 60 | `rt.weather` built in `shard.world`; lightning → `combat.hit({ source: 'env.lightning', amount: 60, toast: why, cause: 'Struck by lightning' })` (09 §3.3) |
| N15 | 908-912 | `nalatiNow()?.boss.bind({ animals, setWeaponsEnabled: …, bow: nalatiKit?.bow ?? null, refill: …` | the Golden King's fight | `EncounterService.boss(GOLDEN_KING_DEF, new GoldenKing(...))` in the plugin (S3.4); weapons disabled through `equipment.enabled`; `refill` → `player.respawned`; `music` stings → cues `cue.boss.*` |
| N16 | 914-919 | `nalatiNow()?.elites.bind({ animals, wildlife, taming: ride?.taming ?? null, …` | the five elites | `EncounterService.elite(def)` × 5 (S3.4); `record` → `ctx.on('actor.died')` in feats; `taming` read from `rt.ride` |
| N17, N18 | 921-926 | `nalatiNow()?.titan.bind({ animals, wildlife, ride, sabre: nalatiKit?.sabre ?? null, …, hurt: (dmg, why) => { killer = { kind: 'storm-titan'` / `ownSkin: (id) => { nalatiNow()?.skins.own(id); }` | the Titan's fight, the Naizagai grant, the saddle skin | `EncounterService.boss(STORM_TITAN_DEF, new StormTitan(...))` (S3.4); `hurt` → `combat.hit` tagged `boss.storm-titan` (bug B3); `ownSkin` → `rt.skins.own(id)` inside the shard |
| — | 1296 | `const handle = { …, wildlife, nalati: nalatiNow(), ride, …` | `window.__world.nalati` / `.wildlife` / `.ride` for scripts | `ctx.debug.expose('nalati', rt)` + the `__world` alias keeps the three keys until the scripts are ported (01 §5, F7) |
| — | 1144 | `nalati?.update(dt, t)` | the 14 updaters, in one call | the 14 systems of §4 in the same order |
| — | 1150 | `if (painterly) { aimList.length = 0; for (const a of animals.animals) if (a.mem['hidden'] !== 1 && a.mem['owned'] !== 1 && a !== riding.horse) aimList.push(a); const heart = nalati?.titan.lockTarget() …` | aim assist and lock-on skip hidden wolves, owned horses, the ridden horse; add the Titan's heart | `ctx.answer('combat.aimTargets', (list) => …)`: the engine builds the list each frame from the creature service and asks it; Nalati filters (`hidden`, `owned`, `app.player.mountedOn`) and appends the heart. `setAimTargets(painterly ? aimList : animals.animals)` (`:716`, `:1016`) → one engine call with the asked list |
| — | 1194-1197 | `if (ride?.mounted === true) ride.mount.dismount();` / `nalati?.boss.onPlayerDeath() !== true && nalati?.titan.onPlayerDeath() !== true` / `nalatiKit?.refill()` | dismount on death; the bosses' checkpoint deaths; refill the quiver and javelins | `ctx.on('player.died', () => rt.ride.dismount())`; `death.checkpoint` answered by the boss runtime (09 §3.3 step 4); `refill` → each row's `player.respawned` listener |
| — | 283, 418, 434, 444, 716, 1016, 1108 | `const painterly = chunk.style === 'painterly'` / `if (!painterly && built === undefined) addPaths()` / `const under = bare \|\| painterly ? null` / `if (isOcean \|\| painterly \|\| built !== undefined) return { cabins: null` / `const steppeMusic = chunk.style === 'painterly'` | Nalati has no undergrowth, cabins or props, lays paths after its decks, only hostile animals lift its score | the grass / cabins / props builders are Pine's since S2.1 (06 §6.1 step 2), so the engine steps no longer exist; `addPaths` is the plugin's; `steppeMusic` → `manifest.audio.alertOnlyHostile: true` (the music poll's filter, `:1122`) |
| — | 529, 552, 692 | `const nalatiKit = chunk.slug === 'nalati-grasslands' ? buildNalatiKit(…) : null` / `nalatiKit?.install(weapons)` / `nalatiKit?.melee(weapons.current.id) === true` | the bow / sabre / spear kit, the AR-15 practice loan | `manifest.loadout` (§3) built by the equipment service (S3.3); `meleeHeld` → `current.row.ui.melee` (09 §1.6). Fixes plan §7.5 (`ChunkDef.weapon: 'nalati'` was ignored) |
| — | 571 | `if (chunk.hud?.dayBadge === true) minimap.showDayBadge()` | the sun / moon on the minimap rim | `manifest.hud.dayBadge: true` (01 §6 keeps `hud` as data the HUD reads; the minimap reads it) |
| — | 587 | `const mood = chunk.ocean ? 'island' : chunk.style === 'painterly' ? 'steppe' : 'pine'` | the score's shard | gone at S2.1 for Pine; S3.1 makes Nalati's `manifest.audio.score: 'score.nalati'` the only source; `'steppe'` leaves `Music.Shard` |
| — | 686 | `CAPTIONED_EVENTS.has(d.event)` | a Nalati chapter's own caption replaces the achievement toast | `ctx.answer('feat.toast', (e) => …)`: the quest vetoes the toast for its captioned events |
| — | 898 | `const hoof = audio.hoofSurfaceAt?.(p.x, p.z); audio.footstep(sprinting, hoof !== undefined ? (hoof === 'wood' ? 'planks' : hoof) : …` | footsteps on the steppe use the hoof ground map | `cue.step.<surface>` with the surface from `ctx.answer('player.stepSurface', …)` (Nalati answers with its hoof ground) — S3.5 |
| — | 928-929 | `ride.taming.onBreaking = (on) => { weapons.visible = !on; weapons.setEnabled(!on); }` / `ride.taming.onBonded = () => { progress.recordEvent('tame'); }` | hands on the mane while he bucks; the Horse Sense feat | `app.equipment.stowed = on` from the `ride.break` context push / pop (09 §4.3); `ctx.app.events.emit('feat.event', { id: 'tame' })` |
| — | 1030 | `loadPlayground(id, { …, ride, animals })` | the horse playground needs the ride | the playground is registered by the plugin with its runtime (§4) |
| — | 1252 | `if (banks.steppe) music.steppe.useBank(banks.steppe)` | Nalati's first score slot at the bar | the score source's own bank from `manifest.boot.audio` (S1.5 wiring for every `SetScore`) |

### 2.2 The look: `src/core/Game.ts`, `src/world/*`, `src/ui/Minimap.ts`

| File:line | Grep key | Today | Replaced by (S3.2) |
|---|---|---|---|
| `Game.ts:17, 207` | `installAtmosphere(getActiveChunk().style === 'painterly')` | the painted air (aerial perspective, cloud shadows) instead of the default fog maths | `ShardRender.fog = { install: installPaintedAir, order: 300 }` (01 §13.1, §13.2): the engine calls `installAtmosphere()` with no argument and then the shard's fog install. `painted` / `isPaintedAir()` (`Atmosphere.ts:69-86, 164, 174, 238, 248`) move to `shard:look/air.ts`; `patchCloudShadows` (`Sky.ts:135`) is called by that install |
| `Game.ts:18, 208` | `if (getActiveChunk().style === 'painterly') installLookV2Fog()` | the panorama-coloured fog | the same `fog.install` (after the painted air, as today) |
| `Game.ts:274` | `if (getActiveChunk().style === 'painterly') { this._composer = buildLookV2Chain(this.renderer, this.scene, this.camera); return; }` | Nalati's own composer (MSAA → one grade, bloom on desktop) | `ShardRender.compose` returns `{ replace: buildLookV2Chain(ctx.renderer, ctx.scene, ctx.camera) }`: a composition may replace the engine chain whole. `game.post` stays null as today (question Q2) |
| `Terrain.ts:11-13, 188, 248-420` | `if (getActiveChunk().style === 'painterly') return this.buildPainterly()` | the painted terrain, its geometry and slab | `ShardRender.terrainPainter` (01 §13.1): `buildPainterly`, `buildPainterlyGeometry`, `buildPainterlySlab` and the `zone` attribute move to `shard:look/terrainPainter.ts` with `groundColor` / `surfaceAt` (§1.1). `Terrain.build()` calls `render.terrainPainter?.build(this)` before its default path |
| `Grass.ts:14, 99-100, 129` | `if (getActiveChunk().style === 'painterly') { this.v2 = new GrassV2(this.sky, this.forest).build(); …` | the GPU blade rings instead of the carpet | `ShardRender.grass` (`GrassDriver`): Nalati's plugin builds `GrassV2` in `shard.world` itself; the engine's `grass` step is gone (06 §6.1 step 2 took Pine's carpet) |
| `Sky.ts:7, 8, 218-221, 346, 405-410, 450-464, 548, 623` | `const painted = S.painted ?? null` / `if (getActiveChunk().sky.painted && isPaintedAir())` / `halo.scale.setScalar(getActiveChunk().sky.painted ? 250 : 420)` / `if (getActiveChunk().sky.painted) { this.giantUniforms.uHazeAmt.value = 0.22` | the painted gradient sky texture, the painterly clouds (built, then hidden by `look/index.ts:48`), the tighter sun halo, the far planet | `ShardRender.backdrop` (Nalati's `SkyDomeV2` + `skyRig.ts`, §6.2): `paintSky` (`Sky.ts:753`) runs from the backdrop's `environment()` hook (the IBL still needs the painted texture); the halo scale and the planet uniforms are backdrop options. `buildPainterlyClouds` is not built at all (the dome replaces it): `PainterlySky.ts` is deleted |
| `Sky.ts:8` | `import { wind } from './steppeWind'` | the painterly clouds drift with the steppe wind | gone with the clouds |
| `Horizon.ts:42, 138, 286` | `if (own)` (the def's `horizon`) / `const P = getActiveChunk().sky.painted` / `this.cloudSea.name = 'cloud-sea'` | the Nalati ring profile, the painted haze colour, the cloud sea look v2 restyles | data-driven today (`manifest.horizon`); the `sky.painted` read becomes `manifest.sky.painted` passed in (unchanged value). No branch remains |
| `Minimap.ts:43-45, 81-119, 166-183, 517-568` | `import * as NALATI_DEF from '../chunks/nalati-grasslands'` / `if (getActiveChunk().style === 'painterly')` / `nalatiGround(` / `const painted = chunk.style === 'painterly'` | the painted palette, the names read from the def by name, the herd marker | `manifest.mapDraw.palette` (a thunk to `shard:look/minimap.ts`'s `nalatiGround`, `nalatiWetAt`), `manifest.pois` for the names, `mapDraw.markers` for the herd (EI16, 10-sweeps X2 step 5). S3.2 moves Nalati's; X2 moves the rest |
| `AnimalFactory.ts:12, 88-89, 100-113` | `painterlyAnimalMaterial` / `'painterly' Nalati (smooth, vertex colour, ONE draw)` | the painterly creature material | the creature look registry (§1.4, `painterlyAnimals.ts` row) |
| `Hands.ts:130` | `getActiveChunk().style === 'lowpoly' ? 'lowpoly' : 'pbr'; // painterly (Nalati): the smooth hands` | swim hands style | `manifest.kitLook` (05 Q1); Nalati resolves to the smooth hands as today |
| `Explore.ts:269` | `catalogEntries(host.world.sky, host.creatures ?? [], chunk.style ?? 'pbr', chunk.spawn)` | the catalog's creature style | `manifest.kitLook` |

### 2.3 Boot: `src/core/bootstrap.ts`, `src/boot/*`

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `bootstrap.ts:35` | `spruce: (renderer: THREE.WebGLRenderer, _def: ChunkDef, sky: Sky) => new SpruceFactory(renderer, sky).build()` | the painterly spruce factory | `manifest.trees.factory: () => import('./world/spruce').then((m) => m.spruceFactory)` (S3.1) |
| `boot/manifest.ts:16, 33-46, 75-77, 83-86, 101` | `const painterlyBoot = (): string[] =>` / `def.sky.painted \|\| def.style === 'lowpoly'` / `def.style === 'painterly' ? painterlyBoot()` | Nalati's boot reads (ground tiles, cards, panorama, 14 GLBs, far LODs), no HDRI, no cabins | `manifest.boot.files(tier)` returns today's `chunkFiles(NALATI_GRASSLANDS, tier)` literally (§3; the node test compares) |
| `boot/prefetch.ts:37-41` | `const painted = def.style === 'lowpoly' \|\| def.style === 'painterly'` / `const homestead = def.style === 'painterly' ? files.props` | prefetch order | reads `manifest.boot.files`; order unchanged |
| `boot/steps.ts:86-100` | `'nalati-grasslands': { steps: { renderer: { weight: 0.3 }, sky: { label: 'Sky · the painted panorama'` | Nalati's loading labels and weights | `manifest.boot.steps` (§3) |
| `boot/extras.ts:40, 75-76, 223-233, 265, 279` | `if (def.style === 'painterly') audio.music.push(...steppeFiles())` / `const ocean = def.ocean !== undefined, steppe = def.style === 'painterly'` / `decodeSteppe(['steppe-grass']` | the steppe score's files, its first slot + stings decoded at the bar, the `steppe` bed | `manifest.boot.audio` (S3.1 declares it; S3.5 removes the last `steppe` names from `extras.ts`) |
| `boot/audioFiles.ts:14-16, 70-80` | `tagged for another shard (\`shard: 'nalati'\`)` | the one SFX set's Nalati entries decoded on the steppe only | Nalati's SFX move to its own set folder `public/assets/sfx/nalati-grasslands/` at S3.5 (§6.5 D), like Pine's and Nine Dragon's; the `shard` tag and `otherShardFiles` go |
| `audio/preload.ts:17, 64-69, 97-99` | `STEPPE_LOOPS` / `v['shard'] !== 'nalati' \|\| bed === 'steppe'` | the steppe beds decoded on the steppe only | the same set move (S3.5) |
| `boot/shardPrefetch.ts:49, 90` | `import { PERSON_FILE, peopleModelUrl, type PersonKey } from '../nalati/campPeopleModels'` / `if (def.style === 'painterly') out.push(…peopleModelUrl)` | the camp people's GLBs as late reads | `manifest.boot.lateReads(tier)` |
| `boot/timing.ts:15` | comment | — | — |
| `chunks/registry.ts` | `import { NALATI_GRASSLANDS }` | the hand list | gone at F9 |

### 2.4 Audio: `src/audio/*`

| File:line | Grep key | Today | Replaced by (S3.5) |
|---|---|---|---|
| `Audio.ts:67-102` | `export type AmbientBed = 'forest' \| 'island' \| 'steppe'` / `export type HoofSurface` / `export type NalatiShot` / `export type SteppeLoop` | Nalati's names in the engine's types | the shard's voice table declares its sounds (`shard:audio/voices.ts`); the engine types are `string` ids in a typed `SoundMap` extended by merging (01 §0 names) |
| `Audio.ts:146` | `this.bed = def.ocean ? 'island' : def.style === 'painterly' ? 'steppe' : 'forest'` | the bed by style | `manifest.audio.ambience` (the profile id) |
| `Audio.ts:562, 826-827, 864, 975-1072 (the Nalati creature calls), 1108-1183, 1184-1357, 1358-1458` | `the steppe (Nalati): a soft swish` / `if (!(kind === 'hoofsteps' && this.hoofSurfaceAt !== undefined)` / `// ── Nalati: the steppe's creatures ──` / `setStorm(` / `// ─────────────── Nalati: hooves, the stampede, the steppe weapons` / `// ─────────────── Nalati: the steppe bed` | Nalati's synth voices in the engine class | `shard:audio/synth.ts` (a voice table: `stampede`, `bowTwang`, `arrowWhoosh`, `bowDraw`, `bowFullDraw`, `bowLetDown`, `arrowImpact`, `javelinThrow`, `javelinImpact`, `sabreSwing`, `sabreHit`, `spearThrust`, `hooves`, `setStorm`, `thunder`, `lightningCrackle`, `startSteppe`, `setSteppe`, `sampledSteppe`, the creature calls `wolf_*`, `horse_*`, `dog_*`, `sheep_bleat`, `marmot_whistle`, `eagle_cry`, `leopard_growl`, `king_*`), code moved verbatim onto the engine mixer's building blocks (`Audio.ts:299-348` → `src/engine/audio/synth.ts`) |
| `Music.ts:44-62, 530-534, 619-630, 690-716, 861` | `export type Shard = 'pine' \| 'island' \| 'steppe'` / `readonly steppe: SteppeScore` / `setSteppe(scene: Partial<SteppeScene>)` / `if (s.mode !== 'menu' && s.shard === 'steppe') return this.steppe.target()` / `isSteppeSlot(` | Nalati's score inside Music | the `ScoreSource` interface (S1.5): the music engine holds `source: ScoreSource \| null` from the manifest; `setSteppe` → `rt.score.setScene(…)` on Nalati's `SetScore`; `isSteppeSlot` → `source.owns(slot)` |
| `Stems.ts:28-34, 49` | `export type SteppeSlot = 'steppe-grass' \| …` / `const SLOTS: SlotName[] = ['pine', 'island', 'title', 'night', 'boss', ...STEPPE_SLOTS]` | the slot names | a `ScoreSource` declares its own `slots` (S1.5); `SlotName` becomes `string` |

### 2.5 `src/ui/*`, `src/explore/*`, `src/playgrounds/*`, `src/game/*`, `src/entities/*`, `src/player/*`

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `ui/debugOptions.ts:69, 138, 158, 160-161` | `const nalati: When = (c) => c.chunk.slug === 'nalati-grasslands'` / `opt('clockSpeed'` / `opt('balbals'` / `opt('ghosts'` | Nalati's Debug rows; `creatures` shown on Pine or Nalati | engine row `clockSpeed` shown when `uses` has `dayCycle` (it drives `DayCycle.scale`, every clock's); shard rows `balbals`, `ghosts` through `ctx.debugRow` (group `creatures`); `creatures` shown when a species row has a procedural fallback (06 §2.2) |
| `ui/Settings.ts:126-132` | `balbals: ['auto', 'wake', 'off']` / `ghosts:` / `clockSpeed:` | the option keys | `clockSpeed` stays an engine key; `balbals`, `ghosts` are declared by the shard (06 Q4) |
| `ui/hudSlots.ts:28, 40` | `export const ROW = { vitals: 0, ammo: 1, steed: 2, stealth: 3, grass: 4, pill: 10 }` | Nalati's rows in the base | S3.3 registers `steed`, `stealth`, `grass` as widgets at today's order numbers 2 / 3 / 4 with `ctx.hud.widget('status', el, n, scope)`; the `ROW` constant loses the three names; X2 turns the numbers into bands |
| `ui/Combat.ts:7, 171-172, 194` | `import { riding, pastRidden } from '../player/riding'` / `a === riding.horse` | the floats skip the ridden horse | `app.player.mountedOn` (§1.4 Mount row) |
| `ui/HurtArc.ts:76, 90` | `wolf: 'Torn down by', kokbori: …, horse: 'Trampled by', argymaq: 'Trampled by'` / `if (def.slug === 'nalati-grasslands') return 'respawning on the north road'` | Nalati's death card verbs and respawn text | the species rows' `killVerb` string; `strings['respawn.default'] = 'respawning on the north road'` (the shard string table, 05 B4's mechanism) |
| `ui/titleDeck.ts:24-26, 50` | `{ slug: 'nalati-grasslands', name: 'Nalati Grasslands', label: 'Alpine steppe', badge: 'Early access'` | the card | the generated registry (F9): `manifest.status: 'earlyAccess'` gives the badge |
| `ui/Menu.ts:230, 300, 332, 475` | `a BAG without FINDS (Nalati, Nine Dragon)` / `no pack (Nalati, …)` / `Nalati's bow draws none` | tab layout, tracers | `manifest.bag.tabs` (X2; until X2 the Menu reads `bag.tabs`); tracers from `row.ui.tracers` (09 §1.6) |
| `game/Inventory.ts:87-88, 104, 110, 133` | `const isNoPackChunk = (chunkId: string): boolean => chunkId.endsWith('/nalati-grasslands') \|\| …` | no pack on Nalati | `manifest.bag.pack: { slots: 0 }` |
| `game/achievements.ts:58-80, 99` | `const NALATI: AchievementDef[]` / `'chunk://local/nalati-grasslands': NALATI` | Nalati's feats | `ctx.rows.feat(NALATI_FEATS)` |
| `game/Elite.ts:4` | `import { fxMaterial, annulus, FX, type FxMaterial } from '../world/nalati/KurganDungeon'` | the engine elite runtime imports Nalati's dungeon FX | `src/engine/fx/groundFx.ts` (§6.1 step 0) |
| `game/quest/Complete.ts:26` | `const NEXT_SHARD = 'nalati-grasslands'` | Driftwood's complete card points at Nalati | `manifest.next: 'nalati-grasslands'` in Driftwood's manifest (08 §3) |
| `explore/Explore.ts:46, 50, 54, 57, 60, 66-79` | `import practiceNalati from './img/practice-nalati-grasslands.webp'` / `PLAYGROUND_ART … horse: playgroundHorse` | hub art; the horse playground card | `manifest.explore.art`; the playground row's `art` |
| `explore/Compare.ts:23-27` | `'nalati-grasslands': [ pair('camp'` | compare pairs | `manifest.explore.compare` |
| `explore/ModelExplorer.ts:41` | `Driftwood's DayNight or Nalati's DayClock` | presets | `app.world.dayCycle` (S2.4) |
| `playgrounds/catalog.ts:10, 25-30`, `load.ts:15`, `Playground.ts:21, 37-38` | `export type PlaygroundId = 'grapple' \| 'horse'` / `{ id: 'horse', shard: 'nalati-grasslands'` / `import('./HorsePlayground')` / `ride: Ride \| null` | the horse room | `ctx.playground(...)` (§4); `PlaygroundId` becomes `string` once both rows are gone (grapple left at S1.4) |
| `entities/AnimalManager.ts:117-118, 399, 435, 495-508` | `'eagle_cry' \| 'leopard_growl'` / `const TRAMPLE_R: … wolf: 0.45, horse: 0.8` / `private readonly melee = meleeShard(getActiveChunk())` / `wetAt?:` | Nalati's sound names, trample radii, the melee test for `canReach`, the river as water | sound names → the shard's voice table; `TRAMPLE_R` → a species row field `trampleR` (wolf 0.45, horse 0.8 in Nalati's rows); `melee` is gone at S2.3 (`canReach` everywhere); `wetAt` → `app.world.water.inside(x, z)` (Nalati's `NalatiWater` + `wet.ts` implement `WaterBody`, X5; until X5 the plugin sets `app.creatures.wetAt = nalatiWetAt`) |
| `entities/Animal.ts:148-162` | `the ridden horse: Mount steps it on its own CharacterMotor` / `MeshLambertMaterial \| null = null; // Lambert: the painterly shard's creatures` | generic fields (`carried`, `levelGround`) | unchanged (engine fields, no shard word after the comments are edited) |
| `player/TouchControls.ts:99-137, 206-247` | `MELEE … 'sabre'` / `private wasRiding = false; // in Nalati's saddle MOVE steers the horse` | the sabre in the melee set; the riding layout | `row.ui.touch` (09 §1.6, S3.3 for the sabre / spear rows); `riding` reads `player.ride !== null` (generic, kept) |
| `player/LockOnTarget.ts:50-57` | `every Nalati hostile (NALATI-MERGE H3)` / `LOCK_WEAPONS` | what may be locked | `row.ui.lockOn` + the species rows' `lockable` tag |
| `player/Weapons.ts:68-91` | `Nalati (nalatiKit.ts): the base weapon's kit id` | the Nalati options | gone with `Weapons.ts` at S1.2 (09 §6 step 2) |
| `player/Player.ts:174-186, 396` | `riding (Nalati B7, src/player/Mount.ts)` / `this.crouching = !hover && !swim && (k.has('ControlLeft') \|\| k.has('KeyC'))` | the ride hook; crouch from raw keys | `ride` stays (generic motor hand-off); crouch → `input.held('crouch')` passed through `ask('player.crouch')` (§6.3 C) |

## 3. (c) The manifest, in full

`src/shards/nalati-grasslands/manifest.ts`, node-safe. Values are today's (`nalati-grasslands.ts:582-661`,
`steps.ts:86-100`, `titleDeck.ts:50`). Every `ChunkDef` field is carried over under 01 §6's names
(13-lead-resolutions 05/06#1, 07/08#1). **Q1** marks this spec's additions that 01 §6 still lacks; §10 Q1 keeps them
open.

```ts
import { defineShard } from '#game';
import { SEED, SPAWN, TERRAIN, edgeBermAt, loneSpruceMask } from './world/terrain';
import { NALATI_MAP } from './layout';
import { inSpruceClearing } from './world/pois/clearings';
import { edgeSpruceMask } from './world/edge';
import { NALATI_HORIZON_V2 } from './look/horizon';                      // data only (look/horizon.ts imports types)
import { STEPPE_WIND } from './world/windData';                         // steppeWind.ts's parameters as data (01 §17; the field itself is the engine's)
import { bootFiles, lateReads } from './boot/files';                     // boot/manifest.ts:38-46 (painterlyBoot) + shardPrefetch.ts:90
import thumb from './thumbs/nalati-grasslands.jpg';
import portrait from './thumbs/nalati-grasslands-portrait.jpg';
import landscape from './thumbs/nalati-grasslands-landscape.jpg';

export default defineShard({
  api: 1,
  slug: 'nalati-grasslands',
  name: 'Nalati Grasslands',
  label: '(+4, −2)',                                                       // gridCoords (01 §6)
  biome: 'Alpine steppe',                                                  // the title deck's card line (titleDeck.ts:50)
  blurb: 'SUPER EXPERIMENTAL — the Tian Shan steppe, painted: cross the braided Kunes, tame a steppe horse and hunt wolves from the saddle across the golden bowl of the Sky Grassland, break the Golden King in his kurgan, and ride out a storm to face the Storm Titan. Snow Lotus Valley waits in the snow ring. Built live, rough edges everywhere.',
  order: 3,                                                                // titleDeck.ts:47-51
  status: 'earlyAccess',                                                   // def.earlyAccess (NALATI-MERGE E1)
  card: { thumb, portrait, landscape },
  placement: { grid: [4, -2], size: [500, 500, 500] },                     // gridCoords '(+4, −2)'
  seed: SEED,                                                              // 01 §6 — 0x4a1a
  treeCount: 1400,                                                         // carried as data
  style: 'painterly',
  kitLook: 'painterly',                                                    // Q1 (open, 05 Q1): creatures, swim hands, the catalog
  uses: ['weather', 'dayCycle', 'elites', 'bosses', 'quests', 'trample'],
  ground: { terrain: TERRAIN },                                            // pondMask = river + brook, waterLevel = RIVER.level (the def's :472)
  assets: {                                                                // carried as data — unused by the painted terrain; kept for the PBR contract (nalati-grasslands.ts:611-616)
    groundLayers: ['leafy_grass', 'stony_dirt_path', 'rock_ground', 'forest_ground_04'],
    groundTints: [[0.7, 0.85, 0.5], [0.9, 0.84, 0.66], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
    slabRock: 'rock_ground',
  },
  trees: {                                                                 // carried as data — :618 + bootstrap.ts:35
    factory: () => import('./world/spruce').then((m) => m.spruceFactory),
    bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces',
  },
  forest: {                                                                // carried as data — :619-628
    spacing: 4.2, densityFreq: 0.01, clearings: [-2, -1.5], maxSlope: 0.6,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95], largeVariantChance: 0.15,
    mask: (x, z) => (inSpruceClearing(x, z) ? 0 : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z)))),
  },
  spawn: SPAWN,                                                            // { x: 0, z: 232, yaw: 0 }
  sky: {                                                                   // :630-643
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    painted: { zenith: [0.1, 0.28, 0.85], horizon: [0.62, 0.78, 0.98], ground: [0.3, 0.36, 0.3], glow: [0.5, 0.4, 0.25] },
    sun: { azimuth: 250, elevation: 26 },
    sunColor: [1.0, 0.85, 0.64], sunIntensity: 2.8, envIntensity: 0.6, bgIntensity: 1.0,
    fogSunColor: [1.0, 0.88, 0.7], cloudSunColor: [1.0, 0.93, 0.82],
    hemiSky: 0x9cc4ff, hemiGround: 0x7a7436, hemiIntensity: 0.5,
    planet: { azimuth: 205, elevation: 23, size: 26, tilt: 2, roll: -20 },
  },
  atmosphere: {                                                            // :644-652
    fogHeight: -30.0, fogHeightFalloff: 0.05, fogHeightDensity: 0.0006, fogDistDensity: 0.002, volumetricSunColor: [1.0, 0.9, 0.72],
    volumetric: { height: -30, falloff: 0.06, density: 0.0009, strength: 0.35 },
  },
  grade: {                                                                 // :653-659
    saturation: 0.1, brightness: 0.0, contrast: 0.15, bloomIntensity: 0.35, bloomThreshold: 0.86,
    shadowTint: [0.9, 0.96, 1.1], highTint: [1.05, 1.01, 0.94], lift: [0.0, 0.004, 0.018], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  horizon: NALATI_HORIZON_V2,                                              // carried as data
  minimap: {                                                               // today's ChunkDef.map, renamed (01 §6) — Minimap.ts:101-119, 166-183, 294, 517-568
    palette: () => import('./look/minimap').then((m) => m.PALETTE),        // nalatiGround + nalatiWetAt + the spruce mask
    markers: () => import('./look/minimap').then((m) => m.MARKERS),        // the herd marker (Minimap.ts:119)
  },
  hud: { dayBadge: true },                                                 // def.hud, as is (01 §6: data the HUD reads; the minimap draws the badge)
  wind: STEPPE_WIND,                                                       // 01 §17: steppeWind.ts's parameters (direction, gust period and strength) as data for the engine WindField
  dayCycle: () => import('./look/dayKeys').then((m) => m.NALATI_DAY),      // S2.4: DEFAULT_SCHEDULE + elevation keys; Debug ▸ Clock speed
  weather: () => import('./world/storm').then((m) => m.STEPPE_STORM),      // S2.4 profile; the SteppeStorm class
  render: () => import('./look/render').then((m) => m.shardRender()),      // S3.2
  tiers: {},                                                               // no engine knob overridden: the look reads the tier itself (bake.ts, grade.ts)
  budgets: {
    phone: { fps: 30, lanes: 'default' },
    desktop: { fps: 60, lanes: 'default' },
    load: { coldPlay4G: 35.5 },                                            // budget-design §6.6
  },
  fight: { attackers: Infinity },                                          // no fightRules; the wolves' own pack policy (09 §5.5)
  loadout: {                                                               // 09 §1.5 (nalatiKit.ts:42-52)
    weapons: ['weapon.bow', 'weapon.sabre', 'weapon.spear', 'weapon.rifle'],
    tools: [],
    start: ['weapon.bow', 'weapon.sabre', 'weapon.spear'],                 // all three owned, the bow held
    held: 'weapon.bow',                                                    // Q1
    loans: [{ id: 'weapon.rifle', in: 'practice' }],                       // Q1 — the AR-15 is the practice room's loan only
    grants: [
      { id: 'weapon.golden-bow', replaces: 'weapon.bow', by: 'boss.golden-king' },   // Q1 (06 Q1) — equipment.replace (09 §1.5)
      { id: 'weapon.naizagai', replaces: 'weapon.sabre', by: 'boss.storm-titan' },
    ],
    ammo: ['ammo.arrow', 'ammo.javelin'],                                  // the quiver; 3 javelins (the lead's answer to 09 Q12)
  },
  bag: {                                                                   // Q1 — E314 pick C
    tabs: ['map', 'gear', 'finds', 'feats'],
    pack: { slots: 0 },                                                    // Inventory.ts:88 (no pack, no PACK tab)
    skinsTitle: 'Skins',
  },
  species: [                                                               // 09 §5.2 rows, all Nalati's (the horse too: the lead's rule-of-two answer)
    'creature.wolf', 'creature.sheep', 'creature.sheepdog', 'creature.marmot', 'creature.horse', 'creature.argymaq',
    'creature.balbal', 'creature.kurgan-balbal', 'creature.ghost-rider', 'creature.golden-king',
    'creature.leopard', 'creature.eagle', 'creature.kokbori', 'creature.storm-rider',
  ],
  encounters: [
    'elite.aqbars', 'elite.kokbori', 'elite.qyran', 'elite.qara-batyr', 'elite.argymaq',   // elites.ts (09 §5.4)
    'boss.golden-king', 'boss.storm-titan',
  ],
  spawns: [                                                                // 01 §6 (was fauna) — 09 §5.6 `spawn.nalati.*`
    'spawn.nalati.wildlife',                                               // Wildlife.ts: packs, herds, the flock, marmots, camp horses
    'spawn.nalati.balbals',                                                // when: dusk (balbalWarriors.ts)
    'spawn.nalati.ghost-riders',                                           // when: night (ghostRiders.ts:65-66)
  ],
  audio: {
    ambience: 'ambience.nalati',                                           // S3.5: the AmbienceZones profile (SteppeAmbience)
    score: 'score.nalati',                                                 // SetScore over /assets/music/nalati/ (S1.5)
    cues: () => import('./audio/cues').then((m) => m.CUES),
    alertOnlyHostile: true,                                                // Q1 — main.ts:1108, 1122
  },
  input: ['ride', 'ride.break', 'stealth'],                                // S3.3
  pois: NALATI_MAP.pois.map((p) => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })),   // :599
  boot: {
    steps: {                                                               // steps.ts:86-100
      renderer: { weight: 0.3 }, sky: { label: 'Sky · the painted panorama', weight: 2.5 },
      terrain: { label: 'Steppe · the bowl · the snow ring', weight: 1.8 }, cards: { label: 'Spruce cards', weight: 0.1 },
      forest: { label: 'Lone spruces', weight: 0.15 }, edge: { label: 'Kunes river · cloud sea · horizon', weight: 0.15 },
      grass: { label: 'Grass rings · painted clumps', weight: 0.5 }, cabins: { label: 'Yurts', weight: 0.05 },
      props: { label: 'Camp · kurgans · herds · the Storm Titan', weight: 8.5 },
      animals: { label: 'Wolves · horses · sheep', weight: 0.1 }, weapon: { label: 'Recurve bow · HUD', weight: 0.05 },
      shaders: { weight: 2.2 }, firstFrame: { weight: 0.5 },
    },                                                                     // (the remaining keys of steps.ts:86-110 copied literally)
    files: bootFiles,                                                      // (tier) => today's chunkFiles(NALATI_GRASSLANDS, tier), literally
    audio: () => import('./audio/files').then((m) => m.BOOT_AUDIO),        // extras.ts:75-76, 223-233: steppeBootFiles + the steppe bed + Nalati's SFX
    lateReads,                                                             // shardPrefetch.ts:90 (the camp people's GLBs)
    explore: { art: ['practice', 'world', 'models', 'sets'] },             // honoured from X3
    precache: [],
  },
  roster: () => import('./roster').then((m) => m.ROSTER),
  explore: {
    art: { practice: './explore/practice-nalati-grasslands.webp', world: './explore/world-nalati-grasslands.webp',
      models: './explore/models-nalati-grasslands.webp', sets: './explore/sets-nalati-grasslands.webp' },   // Explore.ts:46-60
    compare: [                                                             // Compare.ts:23-27
      { id: 'camp', label: 'Camp', model: 'nalati-camp', target: 'art/nalati-grasslands/round-5-paintover/camp-po-phone.jpg' },
      { id: 'rail', label: 'River rail', model: 'nalati-rail', target: 'art/nalati-grasslands/round-5-paintover/rail-po-phone.jpg' },
      { id: 'gully', label: 'Gully', model: 'nalati-gully', target: 'art/nalati-grasslands/round-5-paintover/gully-po-phone.jpg' },
    ],
  },
  load: () => import('./plugin'),
});
```

Fields that disappear: `id`, `displayName`, `gridCoords`, `biome` (→ `label`), `earlyAccess` (→ `status`),
`thumbnail` / `heroPortrait` / `heroLandscape` (→ `card`), `fauna: []` (→ `species` + `spawns`), `weapon: 'nalati'`
(→ `loadout`), `hud.dayBadge` (kept: `hud`, 01 §6), `groundColor` / `surfaceAt` (→ the terrain painter, S3.2),
`explore: true` (every shard has Explore), `terrain` (→ `ground.terrain`).

## 4. (d) The plugin

`src/shards/nalati-grasslands/plugin.ts`. The install order is `wireNalati`'s order (`nalati/index.ts:127-427`, preceded by the `grass` step's `GrassV2` build), then
`main.ts`'s later Nalati calls (`:495-497`, `:752`, `:901-929`), so every registry id, system and scene object is added
in the same sequence:

```ts
export default class NalatiPlugin extends ShardPlugin {
  async install(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);                                     // 'respawn.default', the toasts of index.ts:258-262, weapon / tool names
    const rt = new NalatiRuntime(ctx.scope);                  // shard:runtime.ts — replaces the Nalati interface
    // ── shard.world: main.ts's grass step first (it ran before props), then wireNalati :127-216 in order ──
    // the wind: no call — the engine's WindField (app.world.wind) reads manifest.wind (01 §17); the Bow family and the grass read it
    rt.grass = buildGrass(ctx);                               // GrassV2 (Grass.ts:129 today; progress into the `grass` key)
    installPainterly(ctx);                                    // syncPainterlySun, setPainterlyLook, system shard.nalati.painterly (:127-134)
    rt.water = buildWater(ctx);                               // :136-141
    rt.rocks = await buildRocks(ctx);                         // outcrops + crag rock, registered drawnInto (:143-158)
    rt.pois = await buildPois(ctx);                           // NalatiPOIs.place (:164-169)
    rt.dressing = await buildDressing(ctx, rt);               // NalatiDressing + reseedGrassV2 + registerNalatiPlaces (:171-181)
    rt.weather = installWeather(ctx, rt);                     // SteppeStorm + DayCycle (engine, S2.4) + Nalati's sky rig (:183-186)
    rt.titan = installTitan(ctx, rt);                         // :188-192 (the arena, the cairn prompt; the fight registers in shard.play)
    await installLook(ctx, rt);                               // wireLookV2 (:194-196): the panorama dome, tint, light cheat, static bake
    rt.elites = installElites(ctx, rt);                       // lairs (:198-205)
    rt.boss = installKurgan(ctx, rt);                         // the dungeon + doors (:211-216)
    ctx.app.world.addPaths();                                 // main.ts:473 — after the decks registered (NALATI-MERGE P1)
    // ── shard.kit ──
    ctx.rows.weapon(BOW_ROW); ctx.rows.weapon(SABRE_ROW); ctx.rows.weapon(SPEAR_ROW); ctx.rows.weapon(RIFLE_ROW);
    ctx.rows.weapon(GOLDEN_BOW_ROW); ctx.rows.weapon(NAIZAGAI_ROW);                        // S3.3 (granted by replace)
    ctx.rows.ammo(ARROW_ROWS); ctx.rows.species(NALATI_SPECIES); ctx.rows.encounter(NALATI_ELITES);
    ctx.rows.encounter(GOLDEN_KING); ctx.rows.encounter(STORM_TITAN); ctx.rows.spawn(NALATI_SPAWNS);
    ctx.rows.item(NALATI_ITEMS); ctx.rows.feat(NALATI_FEATS); ctx.rows.creatureLook('painterly', painterlyAnimalMaterial);
    // ── shard.play (main.ts :495-497, :752, :901-929, then index.ts's wrappers, in order) ──
    rt.wildlife = installWildlife(ctx, rt);                   // attachAnimals (:311-316), wildEnv, braceKills, toasts (:216-306)
    installNight(ctx, rt);                                    // nightEnemies (:338-346): balbals at dusk, ghost riders at night
    rt.ride = installRide(ctx, rt);                           // wireRide + Mount + Taming + Reins + RideHUD (:365-392); contexts ride, ride.break
    rt.stealth = installStealth(ctx, rt);                     // Stealth (:309, :324-327); context stealth
    rt.skins = installSkins(ctx, rt);                         // NalatiSkinPainter (:407-424) + the Bag's SKINS
    installEncounters(ctx, rt);                               // boss(GOLDEN_KING), boss(STORM_TITAN), elite × 5 (main.ts:908-926)
    installQuest(ctx, rt);                                    // installNalatiAdventure (main.ts:752) + FINDS
    installAudio(ctx, rt);                                    // wireSound (:427) — S3.5 rebuilds it on the engine audio
    installTargets(ctx, rt);                                  // the ray targets + aim list asks (main.ts:524, 1150)
    ctx.playground(HORSE_PLAYGROUND);                         // playgrounds/catalog.ts:30
    installDebug(ctx, rt);                                    // rows balbals, ghosts; the debug handles
  }
}
```

| Kind | Id | Phase / order | Source today |
|---|---|---|---|
| System | `shard.nalati.painterly` | `update` | `index.ts:130-138` (`updatePainterly`, the sway wind) |
| System | `shard.nalati.water` | `update` | `:140` |
| System | `shard.nalati.pois` | `update` | `:168` |
| System | `shard.nalati.dressing` | `update`; `after: ['engine.player.update']` | `:180` |
| System | `shard.nalati.weather.state` | `update`; `tick: 'weather'` | `:186` (the storm state half, S2.6's split) |
| System | `shard.nalati.weather.fx` | `update` | `:186` (uniforms, the rain round the camera, the sky rig every frame) |
| System | `shard.nalati.titan` | `update`; `tick: 'always'` while engaged, else `'ai'` | `:192` |
| System | `shard.nalati.look` | `update`; `after: ['shard.nalati.weather.fx']` | `look/index.ts:67-86` (tint, light cheat, bake sweep every 2 s) |
| System | `shard.nalati.elites` | `update`; `tick: 'ai'` | `:200-205` (stands down while the Titan fights or in a practice room) |
| System | `shard.nalati.boss` | `update` | `:214` |
| System | `shard.nalati.wildlife` | `update`; `tick: 'ai'` for the group brains, per-frame half for the grass trample | `:270-281` |
| System | `shard.nalati.stealth` | `update` | `:330` |
| System | `shard.nalati.stealth.crouch` | `input`; `before: ['engine.player.input']` | `stealth.ts:142-144` (`player.preUpdate` chain) |
| System | `shard.nalati.night` | `update`; `tick: 'ai'`; `when: !app.practice.open` | `:340` |
| System | `shard.nalati.ride` | `update` | `:392-399` (+ the dev `?ride=` follow-up) |
| System | `shard.nalati.reins` | `late` | `:391` `game.onLate(… 'nalati-reins')` |
| System | `shard.nalati.skins` | `update` | `:414-420` |
| System | `shard.nalati.sound` | `update` | `:424` |
| System | `shard.nalati.quest` | `update` | `adventure.ts` updaters |
| System | `shard.nalati.npc` | `update`; `tick: 'npc'` | `campPeople.ts` idle |
| Events listened | `weapon.fired` (stealth reveal, wildlife `lastShotT`), `weapon.impact` (herd disturb, stallion TRUST), `actor.died` (quest clues, feats), `player.died` (dismount), `player.respawned` (quiver / javelins refill), `practice.active`, `app.ready` | — | `main.ts:694, 704, 1194-1197`, `adventure.ts:222`, `index.ts:398-402` |
| Asks answered | `combat.targets.ray` × 3 (sheep, night riders, the heart), `combat.aimTargets`, `player.crouch`, `player.stepSurface`, `feat.toast`, `weather.damage`, `death.checkpoint` (via the boss runtime), `damage.modify` (the species rules: balbal, ghost rider, horse, 09 §5.4) | — | `index.ts:330`, `main.ts:1150, 898, 686`, `stealth.ts:164-180` |
| Pieces | every id today: the POI pieces (`NalatiPOIs.place`), the rock models, the dressing, the dungeon pieces (`nalati-kurgan-seal` …), the camp people (`nalati-camp-child` …), the balbal statues, the paths | `shard.world` / `shard.play` | `index.ts:150-181`, `KurganDungeon.ts:808`, `campPeople.ts:291`, `Balbals.ts:43` |
| Input contexts | `stealth`, `ride`, `ride.break` | §6.3 | `stealth.ts:136-141`, `Mount.ts:209-212`, `Taming.ts:88-89` |
| HUD | the stealth row + grass meter + CROUCH disc (`ROW.stealth` / `ROW.grass`, spot `up0`), the steed row + GALLOP / HORSE / LEAN L / LEAN R / OFFER discs (`ROW.steed`, spots `r0`, `edge-l`, `lean-l`, `lean-r`, `aim`), the elite bar, the boss bar (engine encounter widgets), the weather chip (`ws:weather`) | `ctx.hud.widget` / `ctx.hud.disc` | `stealth.ts:123-133`, `RideHUD.ts:96-108` |
| Bag | SKINS (rows + wear), FINDS (the elites, their prizes, the places) | `ctx.bag` | `main.ts:630, 753` |
| Debug rows | `balbals`, `ghosts` (group Creatures & NPCs) | `ctx.debugRow` | `debugOptions.ts:160-161` |
| Debug handles | `nalati` (the runtime), `nalati.weather`, `nalati.boss`, `nalati.titan`, `nalati.elites`, `nalati.balbals`, `nalati.ghosts`, `nalati.stealth`, `nalati.quest`, `nalati.sound`, `nalati.look.grade`, `nalati.look.grass`, `nalati.look.sky`, `nalati.look.bake`, `nalati.dressing` | `ctx.debug.expose` | the 15 `window.__*` of §1.2–§1.3 |
| Playground | `horse` (title "Horse playground", blurb "Oval track · jumps · lap timer", icon `HORSE` from `catalog.ts:26`, art `playground-horse.webp`) | `ctx.playground` | `catalog.ts:30` |

## 5. (e) Engine systems this phase pulls in

| System | What S3 needs of it | Must exist first | Row |
|---|---|---|---|
| `ctx.app.world.addPaths()` | the paths piece laid after a shard's decks | S1.1 world build | S3.1 |
| `combat.targets.ray` / `combat.aimTargets` asks | the engine's target ray and aim list take shard additions and filters | S1.3 pipeline | S3.1 |
| `app.player.mountedOn` | the ridden actor is not a target, not a float | S1.3 player service | S3.3 |
| `ShardRender.mode: 'replace'`, `fog.install`, `terrainPainter`, `backdrop.apply` (01 §13.1) | §6.2 | S1.1 render service | S3.2 |
| `app.world.wind` (the one `WindField`, 01 §17) fed by `manifest.wind` | the Bow family's arrow drift, the grass, the trees' sway | S2.2 Bow family | S3.1 (13-lead-resolutions 07/08#3) |
| `ask('player.crouch')` in the motor | stealth's toggle and grass gate | S1.4 input service | S3.3 |
| Creature look registry (`ctx.rows.creatureLook`) | the painterly creature material | S2.3 creature runtime | S3.1 |
| `src/engine/fx/groundFx.ts` | the elite / boss ring FX without a Nalati import | S2.3 encounter runtime | S3.1 |
| `equipment.replace` | the golden bow, Naizagai | S1.2 contracts | S3.3 |
| `GroupBrain` | packs, herds, the flock | S2.3 | S3.4 |
| `VoicePool`, `AmbienceZones`, one SFX routing, the Audio.ts split | §6.5 | S1.5 slice | S3.5 |

## 6. The rows, step by step

### 6.1 S3.1 — the manifest and the plugin

0. **Unhook the engine from Nalati's dungeon.** Move `fxMaterial`, `annulus`, `FX`, `FxMaterial`
   (`KurganDungeon.ts`, grep `export function fxMaterial`, `export function annulus`, `export const FX`) to
   `src/engine/fx/groundFx.ts`; `game/Elite.ts:4` and `KurganDungeon.ts` import them from there. Its own commit; parity
   identical on 4 shards (skip if S2.3 already did it: `grep -n "world/nalati" src/engine` returns nothing).
1. **Manifest** as §3. `test/shards/nalati-grasslands/manifest.test.ts` imports it in node and compares every data
   value, `boot.files('phone' | 'desktop')` and `boot.steps` with frozen copies of today's `chunkFiles` and
   `SHARD_STEPS['nalati-grasslands']`.
2. **Runtime + plugin.** `shard:runtime.ts` holds every field of today's `Nalati` interface; `plugin.ts` as §4.
   `wireNalati` is deleted. Each of `index.ts`'s wrapper chains becomes the listener or ask registration named in §4,
   **in the same order** (the chains ran attach → night.attach → ride; bindPlay → stealth → night → ride → skins;
   sheepTarget → night → titan; onImpact → ride; onShot → stealth first): the event listeners register in that order,
   and `order` values keep it where two listeners of one event exist.
3. **World build in `shard.world`.** The engine's `props` step no longer branches: `main.ts:473` is deleted; the
   engine calls `plugin.install` in `shard.world` (S1.1's stage) and the plugin reports progress into the `props`,
   `edge` and `grass` keys through `ctx.progress` (the loading bar's labels and weights are identical). `addPaths`
   moves to `src/engine/world/paths.ts` and is called by the plugin after its decks; for the other shards the engine
   calls it after `shard.world` unless the manifest says `ground.paths: 'plugin'` (Nalati's value, Q1).
4. **The kit calls.** `buildNalatiKit` (`main.ts:529`) keeps working until S3.3 through a plugin-owned bridge:
   `shard:loadout/legacyKit.ts` builds it in `shard.kit` and hands it to the equipment service's `legacy(kit)` hook
   S1.2 left for Nalati (09 §6 step 2 moved Driftwood / ND / Pine; Nalati's kit is the last `Weapons` user). S3.3
   deletes both.
5. **The 18 binds** (§2.1 N1–N18): each replaced as its row says. `bindPlay`'s `health01` reads
   `app.player.attributes.health`; its `hurt` is `combat.hit`; `toast` / `flash` are `ctx.app.ui`.
6. **Targets.** `main.ts:517-526`'s `targets.raycast` moves to `src/engine/combat/targets.ts` with
   `ask('combat.targets.ray', { origin, dir, maxDist, hit })`; `main.ts:713-716, 1016, 1150`'s aim list becomes the
   engine system `engine.combat.aimTargets` (phase `update`, `after: ['engine.creatures.update']`) with
   `ask('combat.aimTargets', list)`.
7. **Content rows and Bag**: feats (`achievements.ts:58-80`), FINDS, SKINS, `bag.pack.slots: 0`.
8. **Clock, weather, spruce, wind, textures** moved (§1.4 rows). `bootstrap.ts:35` loses `spruce`.
9. **Debug**: the two rows and the fifteen handles (§4).
10. **Strings**: `respawn.default`, the wildlife toasts (`index.ts:258-262`), the Nalati weapon names, the quest's.
11. **Tests**: `test/shards/nalati-grasslands/plugin.test.ts` (fake Game, stub builders): the system ids and phases of
    §4 in order; the listener order of step 2; scope dispose removes every piece, system, listener, ask answer, debug
    row and handle. The moved Nalati tests (`test/nalati-*.test.ts`) unchanged.

**Done when:** `grep -rn "nalati\|painterly\|steppe\|NALATI\|nalatiNow\|wireNalati" src --include=*.ts` outside
`src/shards/nalati-grasslands/` returns only the generated registry, the S3.2 look lines (§2.2), the S3.5 audio lines
(§2.4, `boot/extras.ts`, `boot/audioFiles.ts`, `audio/preload.ts`) and comments; `wildshard/no-shard-branch` fell by
the count of §2.1 + §2.3 + §2.5; parity green on 4 shards × 2 tiers.

### 6.2 S3.2 — the painterly look as a `ShardRender`

`shard:look/render.ts` exports `shardRender(): ShardRender`:

```ts
export const shardRender = (): ShardRender => ({
  mode: 'replace',                                                                   // 01 §13.1: this compose builds the whole chain
  compose: (c) => buildLookV2Chain(c.renderer, c.scene, c.camera),                   // Game.ts:274
  fog: { order: 300, install: () => { installPaintedAir(); installLookV2Fog(); } },  // Game.ts:207-208, Atmosphere.ts:164
  terrainPainter: NALATI_TERRAIN_PAINTER,                                           // Terrain.ts:248-420 + groundColor / surfaceAt
  backdrop: NALATI_BACKDROP,                                                         // SkyDomeV2 + skyRig.ts + paintSky
  frame: undefined,                                                                  // the look's per-frame work is the system shard.nalati.look
});
```

1. **Fog.** `installAtmosphere(painterly)` loses its argument; `painted`, `paintedAir`, `installPaintedAir`,
   `isPaintedAir`, the painted `fog_fragment` chunks (`Atmosphere.ts:69-86, 164, 174, 179-248`) move to
   `shard:look/air.ts`. The engine calls `render.fog.install()` right after `installAtmosphere()`, in the Game
   constructor as today (before anything compiles). The shader-patch order (engine fog 100, stylize 200, shard 300)
   is the order they install in today: the program sources stay byte-identical (the parity `programs` check).
   `Atmosphere.ts:287`'s `shardSlot('atmosphere', …)` loses `painted` (F11 retired `shardSlot`; if a line survives, it
   is deleted here).
2. **Composer.** With `mode: 'replace'` (01 §13.1; 13-lead-resolutions 07/08#2) `compose` builds the whole chain.
   `buildComposer` uses it and returns,
   as `Game.ts:274` does; the engine's chain is not built, `game.post` stays null (the day rig leaves it alone, as today).
3. **Terrain.** `TerrainPainter { build(t: TerrainHost): Promise<THREE.Group> }`: `buildPainterly`,
   `buildPainterlyGeometry`, `buildPainterlySlab` move with `loadNalatiTextures`, `applyTerrainSurface`, `zoneWeights`
   and `painterlyMaterial` (`Terrain.ts:10-13`). `Terrain.build()` calls `render.terrainPainter?.build(this)` and uses
   its group. `groundColor` / `surfaceAt` are read from `shard:look/ground.ts`, not the def.
4. **Grass.** `Grass.ts:14, 99-100, 129` are deleted; the plugin builds `GrassV2` (§4). After S2.1 and S3.1 no shard
   uses the engine `Grass` class: `Grass.ts` moves whole to Pine here, at S3.1's end (06 §1.3; 13-lead-resolutions 04#4).
5. **Sky.** `SkyBackdrop { environment?(sun): THREE.Texture \| Promise<THREE.Texture>; build(sky): Promise<void>;
   update?(dt): void; halo?: number; planet?: { hazeAmt: number; gain: number; far: boolean } }`. Nalati's:
   `environment` = `paintSky(manifest.sky.painted, sunDir)` (`Sky.ts:218-219, 748-790` moved), `build` = today's
   `wireLookV2` dome part (`look/index.ts:44-55`), `halo: 250`, `planet: { hazeAmt: 0.22, gain: 1.5, far: true }`.
   `Sky.ts:450-464`'s painterly clouds are **not built** for a shard with a backdrop that says `clouds: false`
   (Nalati's): the dome replaced them and they were hidden (`look/index.ts:48`). `sky.clouds` becomes `null` there
   and `look/index.ts:48` is deleted; `sky.planet.visible = false` (`:49`) stays in the backdrop's `build`.
   `PainterlySky.ts` is deleted. **Expected difference**: a hidden mesh and its program leave the scene (the census
   and the program count drop by the clouds' one draw-less mesh and program; §8).
6. **Keyframe application.** `DayClock.ts:195-533` (`makeLook`, `SkyRig`, `copyLook`, `lightLevel`) → the backdrop's
   `apply(key)` (06 §6.4 A: "the shard's backdrop for its own fields"); `nalati/weather.ts:185`'s `new SkyRig(game,
   sky)` builds it from there.
7. **Minimap.** `Minimap.ts:43-45, 81-119, 166-183, 517-568` → `manifest.minimap.palette` / `markers`; the minimap
   paints with `palette.ground(x, z, h, slope, spruce, out)` when a manifest gives one.
8. **Creature material and hands**: `AnimalFactory.ts:12, 89` → the creature look registry; `Hands.ts:130` →
   `manifest.kitLook`.

**Tests:** `test/engine/render-compose.test.ts` (a `replace` composition skips the engine chain; `fog.install` runs
after `installAtmosphere`), `test/shards/nalati-grasslands/look.test.ts` (the painted terrain's vertex colours at 20
seeded points equal today's `groundColor`; the fog LUT bytes equal `fogLut`'s).
**Done when:** `grep -n "painterly\|painted\|nalati" src/engine/render src/engine/world/{Terrain,Grass,Atmosphere,Sky,Horizon}.ts src/engine/ui/Minimap.ts`
is empty; parity: Nalati's poses identical within noise, draws / triangles identical, programs identical except the
removed clouds program.

### 6.3 S3.3 — the Nalati weapons on the families; riding, taming and stealth as shard mechanisms

**A. Weapons** (09 §1.4–§1.6 have every number; this is the shard side):

| Row | Family / class | File (after) | Nalati-specific data |
|---|---|---|---|
| `weapon.bow` | Bow (the family default row `BOW`) | `shard:weapons/bow.ts` | held first; the steppe wind from `app.world.wind`; mount data (09 profile field `mounted`) |
| `weapon.golden-bow` | `class GoldenBow extends Bow` | `shard:weapons/goldenBow.ts` | granted by the Golden King: `equipment.replace('weapon.bow', new GoldenBow(GOLDEN_BOW))`, keeps the quiver |
| `weapon.sabre` | `class Sabre extends Melee` (09 W4) | `shard:weapons/sabre.ts` | the mounted pass (`Mount.ts` reads the sabre through `app.equipment.current` instead of the kit field) |
| `weapon.naizagai` | `class Naizagai extends Sabre` | `shard:weapons/naizagai.ts` | granted by the Storm Titan (`replace`); the crescent's wall fix (B2) already landed at S1.2 |
| `weapon.spear` + `weapon.javelin` | `class Spear extends Melee` composing kit `Thrown` (`JAVELIN`) | `shard:weapons/spear.ts` | **3 javelins** (the lead's answer to 09 Q12); the comment `Spear.ts:37` promising 5 "with the camp upgrade" is deleted (no code implements it) |
| `weapon.rifle` | Firearm (family default `AR15`) | kit row, listed in Nalati's loadout | the practice room's loan only (`loans`) |

Steps: the rows; `nalatiKit.ts` and `shard:loadout/legacyKit.ts` (§6.1 step 4) deleted; the equipment service's
`legacy` hook deleted (the last `Weapons.ts` user is gone); `nalati/bag.ts:55-56` names deleted;
`nalatiSkins.ts` rows on `#game` cosmetics' interface (the locker merge is X5); `braceKills`
(`nalati/index.ts:228-244`: the braced spear kills a lunging wolf) stays in the shard, reading
`app.equipment.current` for the spear's `bracing` state.

**B. Riding and taming** (a shard mechanism: rule of two). The files of §1.4's Mount row move to `shard:ride/`.

| Context | Pushed / popped | Actions (keyboard · touch) | Replaces |
|---|---|---|---|
| `ride` | pushed by `Mount.mount()`, popped by `dismount()` | `move` (steer), `ride.gallop` (Shift · GALLOP disc at `r0`), `ride.whistle` (X · reserved `verb.1` from X1), `use` (dismount E · the prompt), `ride.horseTab` (the HORSE disc at `edge-l`) | `Mount.ts:209-212` keydown X / Shift; `RideHUD.ts:96-100` discs |
| `ride.break` | pushed while Taming breaks a stallion, over `ride` | `lean.left` / `lean.right` (A / D · LEAN L / LEAN R at `lean-l` / `lean-r`), `ride.offer` (G · OFFER at `aim`, reserved `verb.2` from X1); `blocks: ['attack', 'aim', 'swap']` | `Taming.ts:88-89` keydown / keyup G; `RideHUD.ts:101-103`; `ride.taming.onBreaking` (`main.ts:928`: weapons hidden and off) → `app.equipment.stowed` while the context is on top |

- The touch discs keep their spots (`r0`, `edge-l`, `lean-l`, `lean-r`, `aim`) through `ctx.hud.disc` until X1 moves
  whistle and offer to `verb.1` / `verb.2` (10-sweeps X1 step 4). The context declares `touch.verbs: { 'verb.1':
  'ride.whistle', 'verb.2': 'ride.offer' }` now, so X1 needs no Nalati edit.
- `riding.ts` is deleted: `Mount` sets `app.player.mountedOn = horse` on mount and `null` on dismount; the creature
  raycast (`creatures.raycast`) skips it (today's `pastRidden`), `Combat.ts:194` reads it.
- Saves: `tulpar`, `horseNames`, `skins` are SaveStore keys, scope shard (F10 renamed them; this row only moves the
  definitions into `shard:ride/saves.ts` and `shard:loadout/saves.ts`).

**C. Stealth** (a shard mechanism). The engine motor crouches on the `crouch` action (C toggles, Ctrl holds: the
engine keys; 01 §10), asking `ask('player.crouch', { held, toggled }) → boolean` first. Nalati's stealth answers:
the crouch is allowed only in long grass, on foot, not swimming, not mounted, not in a practice room, and it keeps
today's toggle latch (`stealth.ts:164-180`, moved verbatim onto the answer). Other shards have no answerer: the motor
crouches while `held` (today's raw-key behaviour, identical). The `stealth` context (pushed on foot on Nalati) adds no
action; it owns the CROUCH disc at `up0` and the stealth / grass status rows. `stealth.ts`'s three raw listeners go
(`wildshard/no-raw-input` −3), as do Mount's (−1) and Taming's (−2).

**D. The horse playground** moves to `shard:playground/` and registers with `ctx.playground` (§4). `PlaygroundHost`
loses `ride`; the playground reads `rt.ride` from the runtime it is constructed with.

**E. The camp's people on the kit NPC rig** (the lead: *NPC rigs merge into `#kit/npc`*). `campPeople.ts`
(`CampPerson` figures, idle, talk facing) and `campPeopleModels.ts` (the GLB people, `PERSON_FILE`) become rows on
`#kit/npc/npcRig.ts` (seeded by Pine at S2.5): each person is `{ id, model: peopleModelUrl(key), idle: …, talk: …,
collider: capsule }` and the rig's idle / look-at / talk-turn replace `campPeople.ts`'s own. Where Nalati's idle
differs from Pine's rig (a per-person breathing phase, the elder's pipe), it is a row field the rig gains, not a
Nalati branch. Parity: each person's pose at the three harness times identical (the NPC pose check of 03-harness-gate).

**Tests:** `weapon-profiles` (Nalati rows), the `replace` test (golden bow, Naizagai keep the quiver),
`test/shards/nalati-grasslands/ride.test.ts` (mount pushes `ride`; a stallion break pushes `ride.break`, stows the
weapon, `ride.offer` on G; dismount pops both; `mountedOn` set and cleared), `stealth.test.ts` (crouch in long grass
latches; out of grass it does not; mounted stands up), `test/engine/input-context.test.ts` gains the `blocks` case.
**Done when:** `grep -rn "nalatiKit\|riding\.\|pastRidden\|player\.keys" src` outside `src/shards/nalati-grasslands/`
finds only the engine's own `Player` key set; the harness's mount → gallop → dismount run, a taming break and a crouch
in the grass are identical; `no-raw-input` fell by 6.

### 6.4 S3.4 — bosses and elites on the encounter runtime

1. **The Golden King.** `class GoldenKing extends BossBrain` (`shard:combat/goldenKing.ts`, from `GoldenKingFight`
   `kurganBoss.ts:75, 668`). Phases 0.6 "PHASE II" The Kurgan Wakes (two kurgan-balbal adds) and 0.3 "PHASE III" The
   Gold Burns; the shield / coffin / rising cycle is a goal script on the brain, run in today's order (09 §5.4). The
   dungeon, doors and intro (4.2 s, short 1.4) are the arena. Strikes S19–S22 (09 §5.3). Damage rule R7 as
   `kurganBoss.ts:343-360`. Reward: the golden bow via `replace` (§6.3 A). The `bossGod` harness param keeps its R0b
   veto. `Math.random()` at `:136, 172, 276, 479, 481` → `app.rng.stream('ai')`; `:504` (the sand roll) → `'ai'`.
2. **The Storm Titan.** `class StormTitan extends BossBrain` (`StormTitanFight`, `stormTitan.ts:341, 1004`): phases
   0.6 "PHASE II · THE THREE WINDS", 0.3 "PHASE III · THE GRASS FIRE"; the rider waves a goal script; arena r 68;
   heart 2600, riders 250. Strikes S23–S28. **Bug B3**: every Titan hurt carries `boss.storm-titan`, so the hit cap and
   the dodge guard answer it (invisible today: Nalati sets no cap and has no tusk; the test proves it, 09 §3.4). The
   `weather.bind({ stormHold: () => titan.engaged })` (`nalati/index.ts:190`) → `ctx.answer('weather.hold', …)`.
   `Math.random()` at `:651, 742, 763, 767, 771-772, 802, 805, 824, 849` → `'ai'` (the fire spread, cooldowns) or
   `'cosmetic'` (`:767-772`, `:824`, and `stormTitanLook.ts:271-274`).
3. **The elites.** Aqbars, Kokbori, Qyran, Qara Batyr, Argymaq on the one `EliteBrain` (S2.3 merged Nalati's `Base`):
   rows with today's aware / engage / leash, conditions (always / dusk / storm / night after 5 riders), phase-2 beats,
   drops and damage rules (09 §5.4). Strikes S13–S18. `hurt` → `combat.hit` with `from` = the attacker (bug §7.2's
   Nalati half: `canReach`). Argymaq's "the horse is the prize" (`Elite.ts:272-278`) stays a row flag `once`,
   `reward: 'tame'`. Qyran's stoop interval (`elites.ts:496`) and Kokbori's howl (`:399`) → `'ai'`.
4. **Night enemies.** The balbal warriors (dusk wake, ring 9) and the ghost riders (night lines, spacing 11, respawn
   60 s) become spawn tables `spawn.nalati.balbals` / `spawn.nalati.ghost-riders` with `when: ['dusk']` /
   `['night']` read from the day cycle; Debug ▸ Balbal warriors / Ghost riders force `when` (wake / line / off) as
   the rows do today. Strikes S11 (balbal slam, a `wedge` `GroundTell`: X5 moves the telegraph), S12 (ghost-rider
   arrows through the Bow family's projectile block). `ghostRiders.ts:232, 245, 352, 415` → `'ai'`; `:336-347` →
   `'cosmetic'`; `balbalWarriors.ts:226-235` → `'cosmetic'`.
5. **Wildlife.** Packs (`Pack.ts`: roam → shadow → encircle ⇄ regroup → break; roles alpha / flank / scout; its own
   1-token policy, 2 when you ride), herds (`Herd.ts`: graze · flee · stampede; the stallion's watch · warn · display
   · charge · wheel · lead · beaten · ridden, S18), the flock (`Flock.ts`) as `GroupBrain` subclasses in
   `shard:creatures/`; marmots (`fx` tick). `sheepRaid.ts:59, 236` → `'ai'`. The pack policy reads the director
   (09 §5.5).
6. **Tick classes**: every Nalati brain declares `tick: 'ai'` (20 Hz near / 5 Hz from 60 m / paused from 160 m);
   engaged elites and bosses `'always'` while engaged or in an arena (09 §5.7).

**Tests:** `test/ai/boss-phases.test.ts` (both bosses enter their phases at the listed fractions; `death.checkpoint`
true inside the kurgan and the arena), the strike table S10–S28, `test/combat/damage-pipeline.test.ts` B3,
`test/ai/can-reach.test.ts` (Aqbars' swipe through a yurt wall deals 0).
**Done when:** the harness's scripted King and Titan runs (`?boss=king|titan&bossPhase=1|2|3`) reach the same phase
changes at the same health and grant the same rewards; the five elites' scripted encounters (`?elite=<id>`) are
identical except the wall fixes; `grep -rn "onCharge" src/shards/nalati-grasslands` is empty.

### 6.5 S3.5 — the engine audio (D12–D14), and Nalati's audio on it

S3.5 starts from S1.5's slice (the lead's answer to 05 Q6): `ScoreSource` + `SetScore`, `AmbienceBeds`, per-shard SFX
sets, cue maps. It finishes the audio engine of 01 §15 and moves Nalati onto it; Pine's and Nine Dragon's audio move
onto the finished pieces in the same row (their parity is part of this row's done-when); Driftwood's moves at S4.3.

**A. One voice engine** (`src/engine/audio/voices.ts`, `VoicePool`):
1. Merge `audio/Voices.ts` (153: generated families, render-on-demand, prewarm, positional play) and Pine's
   `shard:audio/sfx.ts` (from `PineHollowSfx.ts`, 291: sampled one-shots from a sprite, distance roll-off) into one
   pool: `play(id, { at?, gain?, rate?, bus? })`, `prewarm(ids)`, `buffer(id)`, `setListener(x, y, z, yaw)`. A voice
   is either **generated** (a `gen.ts` family) or **sampled** (a sprite region or a decoded buffer from a set).
2. Voice tables are data a shard registers: `ctx.app.audio.voice().register(table)`. The generic families every
   shard's player uses stay in the engine table (`hurt`, `death`, `plunge-*`, `bubble-bed`, `noise-white`, the reverb
   `ir-*` rooms, `step-*` for the kinds a non-Driftwood caller plays); the families only `IslandSfx` /
   `IslandAmbience` play (the enemy `vocal-*`, `windup-*`, `impact-shell`) are Driftwood's table from S4.3 — until
   then they stay in the engine table, marked `// driftwood, S4.3` (a counted `no-shard-branch`-free comment; they are
   names, not branches). Step 1 of the row greps `voices.play(` and `voices.buffer(` callers and records the split in
   the commit message.
3. `Audio.ts`'s synth voices are split by owner (§2.4): Nalati's → `shard:audio/synth.ts`; Pine's sampled bank
   already in its folder; the player, water, feedback and lock voices → `src/engine/audio/playerVoices.ts`; the
   crossbow / rifle / sword synth → the families' default cues in `#kit/weapons/*/sounds.ts`; the gulls and the island
   bed → Driftwood at S4.3.
4. The helpers become one each (01 §15, audit D14): **pan-from-yaw** → `src/engine/audio/util.ts#panFromYaw(dx, dz,
   yaw, spread)`, replacing the listener-right-vector pans at `main.ts:701-702` (`const rx = Math.cos(player.yaw), rz
   = -Math.sin(player.yaw)`), `main.ts:840`, `Audio.ts:820`, `Audio.ts:1103`, `Voices.ts:137`, Pine's `sfx.ts` (from
   `PineHollowSfx.ts:236`), `nalati/weather.ts:241` and `nalati/sound.ts:88` (the audit's "×6" was counted before the
   last two; each copy keeps its own `spread`, 0.7 or 0.8); **loop-at-offset** → `loopAt(src, buf, loop?)`, replacing
   `Audio.ts:266`, `ForestAmbience.ts:134`, `SteppeAmbience.ts:131`, `IslandAmbience.ts:140` (S4.3) and
   `Audio.ts:312`. The random offsets draw from `app.rng.stream('cosmetic')`. `HurtArc.ts:64` and `WindupWarn.ts:89`
   are screen-space arcs, not audio pans: they stay.

**B. Ambience zones** (`src/engine/audio/ambience.ts`, `AmbienceZones`):
1. A **profile** = `{ beds: BedDef[]; zones(pos, t): Record<string, number>; hold?: number; tau?: number; spots?:
   ZoneSpot[]; rooms?: RoomDef[]; scatter?: ScatterDef[] }` — the union of what S1.5's `AmbienceBeds`,
   `SteppeAmbience` (zones, 3 s hold, τ 0.35, panned beds, silent-stop after 8 s, far calls), `ForestAmbience` (zones
   + spots + `stepSurface`) and `IslandAmbience` (zones + reverb rooms + scattered waves / birds) each do.
2. Nalati's profile (`shard:audio/ambience.ts`): the ten beds (`steppe-wind`, `steppe-larks`, `steppe-night`, `river`,
   `meltwater`, `camp`, `highwind`, `coldwind`, `rain`, `stormwind`), zones from `zoneAt` (grass / sky / snow), the
   panned river / camp / meltwater, `out` = 0 inside the kurgan, the far herd and eagle calls; `onZone` → the score
   scene. The synth steppe bed (`Audio.startSteppe`) is the profile's fallback when no bed decoded (`sampledSteppe`).
3. Pine's profile (from `ForestAmbience`, 06 §1.3) and Nine Dragon's (S1.5's `AmbienceBeds`) move onto the same
   class. Driftwood's (`IslandAmbience`) at S4.3.

**C. One SFX routing.** The three routings (01 §15) become the cue path: weapons, creatures and the world emit
`cue.*`; the running shard's CueMap maps each to a voice id (+ gain, rate, `at`). After S3.5:
- `main.ts:691-706` (the weapon hooks' sound branches) are deleted: `cue.weapon.fire`, `cue.weapon.impact.<surface>`,
  `cue.weapon.reload`, `cue.weapon.dry`, `cue.weapon.swap`, `cue.weapon.charge.heavy` are mapped per shard (Nalati:
  the bow / javelin / sabre / spear voices of `sound.ts:164-178`; Pine: its S2.2 map; Nine Dragon: its S1.5 map;
  Driftwood: the island map, S4.3 — until then Driftwood's map is today's `if (!isOcean)` synth branch inverted, i.e.
  no swing / hit synth, since `swordEvents` voices it).
- `nalati/sound.ts`'s `fire` / `impact` / creature call routing → Nalati's CueMap; `audio.animal(kind, …)`
  (`AnimalManager.onSound`, `main.ts:846`) → `cue.creature.<call>` mapped per shard.
- `audio.hoofSurfaceAt` → the `player.stepSurface` ask (§2.1) and `cue.step.<surface>`.

**D. Nalati's SFX set folder.** The entries of the shared set tagged `shard: 'nalati'` (the creature calls, hooves,
stampede, the steppe weapons, thunder, crackle and the ten beds) are copied into `public/assets/sfx/nalati-grasslands/`
with their own `sfx.json` (the same files, byte for byte; `scripts/music/gen/sfx_merge.py --set nalati-grasslands`
from S1.5's `--set` edit writes it from the existing merge decisions with no model run). The shared set drops the
tagged entries; `audioFiles.ts:70-80` (`otherShardFiles`) and `preload.ts:97-99` (the `shard` filter) are deleted.
**No new generation**: Nalati's sounds are today's (MiniMax / MOSS / Stable Audio takes already chosen, credits
unchanged). The boot audio byte total for Nalati is identical; for Pine and Driftwood it drops by the Nalati entries
they no longer list (they were never decoded; expected, §8).

**E. `Audio.ts` split.** What stays in `src/engine/audio/mixer.ts`: the context, master, the buses (`music`,
`ambience`, `sfx`, `voice`, `ui`), `park` / `evict`, `shadeAmbient`, `useSamples`, `resume`, `worldMuted`, the
underwater filter (`setUnderwater`, `:698-748`) and the building blocks (`:299-348` → `synth.ts`). What leaves: §2.4's
Nalati sections, the forest bed (`startForest` → Pine's profile), the island bed and gulls (→ Driftwood at S4.3;
until S4.3 in `src/engine/audio/legacyIsland.ts`, a file S4.3 deletes). `AmbientBed`, `SteppeLoop`, `NalatiShot`,
`HoofSurface`, `SteppeLevels` leave the engine types.

**F. The music engine.** `Music.ts`: `Shard` type, `steppe` field, `setSteppe`, `isSteppeSlot` go; the engine holds
the manifest's `ScoreSource`; Nalati's `SetScore` gets its scene from `shard:audio/score.ts` (`zone` from the
ambience's `onZone`, `night` from the day cycle, `storm` from `SteppeStorm`, `boss: 'king'` from the King's fight).
`Stems.ts` `SlotName` / `SLOTS` / `STEPPE_SLOTS` become each source's own list.

**Tests:** `test/engine/audio/voices.test.ts` (a generated and a sampled voice through one `play`; `at` pans with
`panFromYaw`), `ambience.test.ts` (Nalati's zone weights and bed gains at 12 fixed points equal `SteppeAmbience`'s;
Pine's at its 9 zones equal `ForestAmbience`'s), `cue-map.test.ts` (every `cue.*` the engine emits is mapped or
explicitly silent on each shard), `test/audio-scripts.test.ts` (the `--set nalati-grasslands` merge writes the same
files byte for byte).
**Done when:** `grep -rn "steppe\|nalati\|Steppe\|NALATI\|'forest'\|ForestAmbience" src/engine/audio` is empty
(Driftwood's `legacyIsland.ts` is the only shard-named leftover, deleted at S4.3); the harness's audio fingerprint
(beds, score slots, voices played in the scripted walk + swing + shot) is identical on Nalati, Pine and Nine Dragon;
the mixer has one voice engine.

## 7. (f) Bugs fixed inline in this phase (each with a test)

| # | Bug | Where | Fix, row | Test |
|---|---|---|---|---|
| §7.2 (Nalati half) | Nalati's elites, the Golden King and the night enemies hurt through `onCharge` directly, so `canReach` never runs for them: Aqbars' swipe, Kokbori's bite, Qyran's stoop, Qara Batyr's charge and the King's cuts land through walls | `nalati/elites.ts:861`, `kurganBoss.ts:663`, `nightEnemies.ts:59` | `combat.hit` with `from` = the attacker; occlusion on (S3.4) | `can-reach.test.ts`: Aqbars' swipe through a yurt wall deals 0; the King's cut through a dungeon pillar deals 0 |
| §7.3 (B3) | The Storm Titan skips the hit cap and the dodge guard | `stormTitan.ts:639, 722, 831, 865, 903, 972, 1097` → `main.ts:923` | tagged `boss.storm-titan` (S3.4) | 09 §3.4 B3 |
| §7.5 | `ChunkDef.weapon: 'nalati'` is ignored; `main.ts:529` picks the kit by slug | `main.ts:529` | `manifest.loadout` (S3.3) | `weapon-profiles` loadout rows |
| §7.6 (Nalati half) | `adventure.ts:94-102` reads the global `ws.elites.v1` store raw | `nalati/adventure.ts` | the encounter service's `elites.felled(id)` over the shard-scoped key (S3.1) | the save round-trip keeps Pine's and Nalati's elites apart (06 §7) |
| N1 | Javelin "camp upgrade → 5" promised in a comment, never implemented | `Spear.ts:37` | comment deleted; 3 stays (the lead, 09 Q12) (S3.3) | `weapon-profiles`: javelins 3 |
| N2 | The engine elite runtime imports Nalati's dungeon (`game/Elite.ts:4`) | `game/Elite.ts:4` | `#engine/fx/groundFx.ts` (S3.1 step 0) | `wildshard/layer`: no `src/engine` → shard import |
| N3 | The painterly clouds are built and then hidden (a wasted build, its mesh and program kept) | `Sky.ts:450-458`, `look/index.ts:48` | not built when the backdrop replaces them (S3.2) | the census test: no `painterly-clouds` mesh on Nalati |
| N4 | Nalati's SFX live in the shared set, tagged, and every other shard's boot has to filter them out | `audioFiles.ts:70-80`, `preload.ts:97-99` | Nalati's own set folder (S3.5 D) | the boot-files test per shard |
| N5 | Six `Math.random()` gameplay rolls in the bosses / elites / night enemies outside the seeded RNG | §6.4 lists | `app.rng.stream('ai')` (S3.4) | seeded King / Titan runs repeat frame for frame |

## 8. (g) Parity expectations

**Identical** (`scripts/parity.mjs --shards nalati-grasslands --tier phone,desktop`; all four on engine edits): the
systems list (new ids per 03's id map), the registry (sorted), the scene census except N3, programs except N3,
draws and triangles at the three harness poses at pinned `time` and `weather` (`?time=` and `?weather=` are harness
params), the walk and `--trails` routes (0 stuck, the Nalati legs of `physics-route.json`), a shot to a kill with the
bow, a sabre kill, a javelin kill, the mount → gallop → dismount run, a taming break, a crouch in the grass, the King
and Titan scripted runs, the elites' scripted encounters, the quest beats (`?quest=`, `?questflags=`), the audio
beds and score slots, the HUD slots, the save keys.

**Expected to differ:**

| Difference | Row | Where it is shown |
|---|---|---|
| Elite / King / night-enemy strikes no longer land through walls | S3.4 | the creatures board (Nalati clips) |
| The painterly clouds mesh and program gone (never drawn) | S3.2 | M3 summary (census, programs −1, build ms) |
| Nalati brains think at 20 Hz near / 5 Hz past 60 m / paused past 160 m (S2.6's rates reach Nalati's own brains now) | S3.4 | the creatures board (a pack at 40 / 100 / 200 m) |
| Strikes sampled on the fixed step, not the brain tick (hits up to one tick earlier) | S3.4 | the creatures board (09 §7 "strike sampling") |
| Pine's and Driftwood's boot audio lists lose the Nalati entries they never decoded | S3.5 | M3 summary (bytes) |
| B3: none visible (Nalati sets no cap) | S3.4 | the test output on the board |

## 9. (h) Milestone M3

| Step | Detail |
|---|---|
| Gate | `gpu-gate` green on HEAD; parity green on 4 shards; `pnpm test` green with the ratchets lower than at M2 (`no-shard-branch`, `no-raw-input` −6 + the X-less ones, `no-raw-save`, `no-raw-random-time`) |
| Pin | HEAD into `deploy/pin`, `gh workflow run deploy`, `version.json` confirmed, the build id in E357 |
| Summary | What moved (§1: ~10.2k lines from engine folders, 9.5k from `src/nalati`, 5.8k from `src/world/nalati`), lines deleted (`wireNalati` + its wrappers, `PainterlySky.ts`, `nalatiKit.ts`, `riding.ts`, the Nalati halves of `Audio.ts` / `Music.ts` / `Stems.ts`), the ratchets before / after, Nalati's derived budgets and ceilings, the engine audio's shape (one voice pool, one ambience class, one routing) |
| Boards | **Creatures** (Nalati's wall fixes, the tick rates on packs and herds, strike sampling, the B3 test output) and the **audio** check (a one-line table: every shard's audio fingerprint identical; no listening page, nothing new was generated). iPhone portrait, clips ≤ 10 s |
| Jake plays | Nalati on the pinned build: the camp, a ride to the bowl, a taming break, a crouch-stalk in the long grass, a wolf pack, the Golden King if he wants, a storm |
| Decision asked | AskUserQuestion: "Nalati M3: go?" (recommended: yes), with the summary and the board |
| Reopening | On Jake's go: `src/shards/nalati-grasslands/` (+ `test/shards/nalati-grasslands/`, `art/nalati-grasslands/`, `public/assets/nalati/`, `public/assets/music/nalati/`, `public/assets/sfx/nalati-grasslands/`) reopens to content agents (12-process §2) |

## 10. Questions for the lead

Answered in [13-lead-resolutions.md](13-lead-resolutions.md) (07 / 08 table unless named) unless marked open; the
body above follows each answer.

1. **Manifest fields not in 01 §6; a URL-param reader.** **Resolved → 13-lead-resolutions 07/08#1:** every carried-over
   `ChunkDef` field is on the manifest (`map` → `minimap`, `hud` kept as is, so the day badge is `hud.dayBadge`);
   `app.params` is the only URL-param reader (the `harness` allowlist: `?ride=`, `?time=`, `?clock=`). **Still open,
   sent to the lead:** this spec's sub-fields that 01 §6's types don't declare yet — `loadout.held`, `loadout.loans`,
   `loadout.grants[].replaces`, `minimap.palette` / `markers`, `audio.alertOnlyHostile`, `ground.paths: 'plugin'`,
   `bag.skinsTitle`, and `kitLook` (05 Q1).
2. **`ShardRender` chain replacement.** **Resolved → 13-lead-resolutions 07/08#2:** `mode: 'replace'` (01 §13.1); the
   shard's `compose` builds the whole chain (S3.2 step 2).
3. **The world wind.** **Resolved → 13-lead-resolutions 07/08#3:** one `WindField` (`app.world.wind`, 01 §17) with
   per-shard `manifest.wind` data; `steppeWind.ts` and `world/wind.ts` merge into it (§1.4, §3, §4).
4. **The horse.** **Resolved → 13-lead-resolutions 07/08#4 and 09#5:** Nalati; 01 §21 and 09 §5.2 follow.
5. **S3.5 edits every shard's audio.** **Resolved → 13-lead-resolutions 07/08#5:** in scope, one implementation at
   once, parity identical on Pine and Nine Dragon.
6. **Driftwood's audio between S3.5 and S4.3.** **Resolved → 13-lead-resolutions 07/08#6:** parked in
   `src/engine/audio/legacyIsland.ts` from S3.5; S4.3 moves it into Driftwood's folder and deletes the park.
7. **The camp people's rig differences.** **Resolved → 13-lead-resolutions 05/06#14:** the camp people join `#kit/npc`
   in S3.3, so the lead grows the kit rig there (per-person breathing phase, the elder's pipe prop as row fields);
   the kit stays locked to content agents only.
8. **`src/world/spruceMask.ts`** (79 lines) has no importer. **Open (not in 13), sent to the lead:** this spec deletes
   it in S3.1.
9. **Crouch semantics** (`ask('player.crouch')` for Nalati's toggle and grass gate). **Open (not in 13), sent to the
   lead:** 01 §10 names only the `crouch` action; this spec adds the ask.
10. **`creatureLook` registry** (`ctx.rows.creatureLook`, a shard registering its style's creature material factory;
    Driftwood's toon path registers from Driftwood at S4.2). **Open (not in 13), sent to the lead.**
