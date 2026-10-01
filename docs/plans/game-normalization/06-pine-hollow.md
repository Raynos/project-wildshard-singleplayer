# GAME-NORMALIZATION v2 · 06 — Pine Hollow becomes a plugin (S2.1–S2.6, milestone M2)

Pine Hollow (`pine-hollow`) is the engine's default shard today: `main.ts` builds its forest carpet, cabins and props
when no other shard claims the step, seven `install*` calls wire its fights, loadout, quest, weather, life and audio,
and its clock, tier override and look live in engine files. This spec moves all of it behind a manifest + plugin on
[01-architecture.md](01-architecture.md), and builds the engine systems Pine Hollow is the first to need: the ranged
families (S2.2), the creature AI runtime (S2.3), `DayCycle` and `Weather` (S2.4), the quest runtime and the starter
effects (S2.5) and the tick-rate scheduler (S2.6). It ends at M2.

Weapon, species, brain, boss and effect internals are in [09-combat-ai.md](09-combat-ai.md); this file owns the
shard side and every engine line that branches on Pine Hollow. [05-nine-dragon.md](05-nine-dragon.md) §0's rules
(line references at `3f83fd2e`, grep keys, paths after F6, every-commit parity) apply here unchanged; `shard:x` here
means `src/shards/pine-hollow/x`.

**At S2 start** S1 is done: the plugin verbs, the render-tier resolution, the generic boot trace, the Equipment /
Weapon / Tool contracts with the Melee family, the damage pipeline and effects core, the input service with its first
context, the audio slice (`ScoreSource`, `SetScore`, `AmbienceBeds`, per-shard SFX sets, cue maps) and the budget
formula exist (05 §5).

**Order inside S2:** S2.1 → S2.2 → S2.3 → S2.4 → S2.5 → S2.6. S2.2 and S2.3 may run as two subagent lanes on
disjoint files (the ranged families in `src/kit/weapons/**` and Pine's `loadout/`; the AI runtime in
`src/engine/ai/**` and Pine's `combat/`), after S2.1 lands.

## 1. Inventory (a): every file of Pine Hollow's code today and where it goes

### 1.1 `src/chunks/pine-hollow.ts`, `pineHollowLayout.ts`, `fauna-layout.ts`, `src/chunks/pine-hollow/`

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `src/chunks/pine-hollow.ts` (333) | `shard:manifest.ts` (data, §3) + `shard:world/terrain.ts` (the pure functions `smin`, `smax`, `oldGrowthMask`, `ridgeWeight`, `denWallWeight`, `rawLandscape`, `padHeight`, `landscape`, `TRAILS`, `TERRAIN`, `ziplineDistance`, `FOREST_KEEP`, `forestDensity`, `mixW`, the five mixes, `speciesMix`: `:23-216`, moved verbatim) | F6 rename; S2.1 split | The manifest imports `world/terrain.ts`; both stay node-safe (`bake-chunk.mjs` and `bake-navmesh.mjs` import them today) |
| `src/chunks/pineHollowLayout.ts` (296) | `shard:layout.ts` | F6 | Every coordinate (`+z north, +x WEST`) |
| `src/chunks/fauna-layout.ts` (122) | `src/engine/world/faunaLayout.ts` | F6 | A placement primitive (grid of cells, one weighted group per cell) with no Pine word; 01 §17 *Placement* |
| `roster.ts` (40) | `shard:roster.ts` | F6 | The `roster` thunk |
| `models/*.ts` (48 files, 5,026 lines: `antlerKing` 275, `beaverDam`, `birds` 64, `canoe`, `caveArch` 81, `contractBoard`, `cragBoulder`, `cragCliff`, `creatures`, `creekFootbridge` 68, `fallenLog` 68, `fern`, `fireLookout` 223, `forestTree` 78, `gear` 103, `hamletShed`, `hatchet`, `hollowLog` 93, `huntingLodge`, `logCabin` 1,544, `millersHouse`, `moss`, `mossyBoulder` 67, `needleLitter`, `pebbles`, `people` 300, `porchLantern`, `reeds`, `scree`, `shrub`, `skinningKnife` 220, `standingStone`, `stoneFirePit`, `tokenShelf` 44, `traderStall`, `treeStump`, `watermill`, `waystone`, `wildlife` 497, `wineBarrel`, `woodenBucket`, `woodenCrate`, `zipCable`, `ziplineLanding` 90) | same names under `shard:models/` | F6 | Content on the model contract. `logCabin.ts` exports `CabinSpec` that `world/Cabin.ts:19, 48` re-exports (moves with `Cabin.ts`, §1.3). `skinningKnife.ts:54` listens for `ws:ready` → `ctx.on('app.ready')` (S2.1) |
| `world/cabinKit.ts` (37), `cabins.ts` (111), `context.ts` (19), `cragKit.ts` (50), `drawnModels.ts` (66), `hero.ts` (52), `places.ts` (57), `props.ts` (204), `timber.ts` (175), `undergrowthKit.ts` (45) | same names under `shard:world/` | F6; S2.1 wiring | `placeCabins`, `Props`, `placePineHollowSets`, `placeDrawnModels` are called by the plugin's world build instead of `main.ts` |

### 1.2 `src/pinehollow/` (37 files, 6,991 lines)

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `index.ts` (156) | `shard:combat/install.ts` | F6; S2.3 | `installPineCombat(host)` becomes `installCombat(ctx, rt)`: the elites through the engine elite runtime, the Antler King through the boss runtime. `Object.assign(window, { __pineElites, __antlerKing })` (:147) → `ctx.debug.expose` (01 §7). `BOSS_NAMES.set(KING_KIND, …)` (:113) → the boss row's display name (EI23). `animals.onCharge?.(a, dmg)` in `ctx.hurt` (:85) → `combat.hit` |
| `elites.ts` (473) | `shard:combat/elites.ts` (the four rows + their scripts) | S2.3 | `PineElite` (:120) merges with Nalati's `Base` into the engine elite script base (plan S2.3; 09-combat-ai). The four elites stay here as rows + subclasses |
| `antlerKing.ts` (687), `kingRig.ts` (497), `combatMath.ts` (97) | `shard:combat/antlerKing.ts`, `kingRig.ts`, `combatMath.ts` | S2.3 | `class AntlerKing extends BossBrain` (01 §19), the fight unchanged. `window.addEventListener('pointerdown' / 'pointerup' / 'pointercancel')` (:646-648, the intro's touch-skip) → the `menu`-less `cutscene.skip` action at X1; S2.3 keeps the three listeners behind `ctx.scope.listen` (counted by `no-raw-input`, gone at X1). `scene.onBeforeRender` chaining (:189-190) → a `render`-phase system `shard.pine.king.atmosphere`. `a.onDamaged` chaining (:235) → `ctx.answer('damage.modify')` for the King |
| `ctx.ts` (134) | `shard:combat/ctx.ts` | S2.3 | `LaneCharge` (:79, 17 uses) becomes StrikeSpec `lane` rows (09-combat-ai). `a.onDamaged` chaining (:52-54) → `ctx.on('damage.dealt')` |
| `feel.ts` (83) | deleted | S2.2 | Its `weapons.onHit` / `onImpact` monkey-patches (:41-50) become the ranged profiles' hit-stop / kick / trauma cue fields (09-combat-ai: today's Pine values: 35 / 55 / 75 ms) |
| `fxKit.ts` (116) | `shard:combat/fxKit.ts` | F6; X5 | Its `Puffs` (:17) merges into the one particle pool at X5 |
| `loadout.ts` (241), `ammo.ts` (83), `finishes.ts` (44) | `shard:loadout/loadout.ts`, `ammo.ts`, `finishes.ts` | S2.2 | The ammo kinds (iron / pitch / broadhead bolts, arrows, cartridges) become AmmoRows; the chained `weapons.onFire / onReloadStart / onDry / onImpact` (:169-186) and `rifle.onCycle / onRoundIn`, `longbow.onDrawStart / onRecover` (:178-191) become cue-map entries and `weapon.*` events. The `KeyB` listener (:157-160) becomes the action `bolt.cycle` in the `crossbow.bolts` context; the ammo-strip `pointerdown` (:161-165) stays until X1 moves it to `verb.1` (10-sweeps X1). `STORE = 'ws.ph.loadout.v1'` (:66) → SaveStore key `loadout` (scope shard). `window.__loadout / __lever / __longbow` (:239) → `ctx.debug.expose` |
| `weather.ts` (208) | `shard:world/weather.ts` | S2.4 | `installPineWeather` becomes `installWeather(ctx, rt)` over the engine `Weather` with Pine's profile (§6.4). `window.__pineWeather` (:194) → `ctx.debug.expose('pine.weather', …)`. `h.animals.wanderGoal = …` (:130) → `ctx.answer('creature.wander-goal')` |
| `audioWiring.ts` (131) | `shard:audio/wiring.ts` | S2.1 | `installPineAudio` becomes a plugin system; `window.__pineAudio` (:130) → `ctx.debug.expose` |
| `perfLapHost.ts` (59) | `shard:dev/perfLap.ts` | S2.1 | The fps panel's PERF LAP route, registered with `ctx.debugRow` (group `perf`) instead of `registerPineLap` |
| `life/index.ts` (761), `birdFix.ts` (201), `birdModels.ts` (202), `lifeMath.ts` (61), `trunks.ts` (81) | `shard:life/…` | F6; S2.1 wiring | `animals.onKill` chaining (`index.ts:276`) → `ctx.on('actor.died')`; `document.addEventListener('ws:ready')` (:131) → `ctx.on('app.ready')`; `window.__pineLife` (:734) → `ctx.debug.expose` |
| `quest/index.ts` (605), `beats.ts` (42), `contracts.ts` (190), `hollowLog.ts` (38), `nightThralls.ts` (142), `npcModels.ts` (138), `rides.ts` (162), `stagLead.ts` (108), `table.ts` (79), `tokenShelf.ts` (53), `trades.ts` (70), `ui.ts` (145), `wardensHollow.ts` (166) | `shard:quest/…` | F6; S2.5 | On the engine quest runtime (S2.5). `animals.onKill` chaining (`index.ts:385`) → `ctx.on('actor.died')`. `BOARD_STORE = 'ws.lodge.v1'` (`contracts.ts:164`) → SaveStore key `lodge` (shard). `window.__pineQuest` (`index.ts:602`) → `ctx.debug.expose`. `ui.ts` (the board / trade panels) mounts with `ctx.hud` now and moves onto the UI layers at X2; its `KeyE` / Escape listener (:50-53) goes at X1 / X2 |
| `quest/npcRig.ts` (578) | `src/kit/npc/npcRig.ts` | S2.5 | The seed of the kit NPC rig (01 §21, D9: Castaway ≈ Trader ≈ campPeople ≈ Pine `npcRig`). Nalati's camp people join it in S3.3, Driftwood's Castaway and Trader in S4.3 (13-lead-resolutions 05/06#14) |

### 1.3 Pine Hollow code in engine folders

| Today | Lines | Destination | When | Why |
|---|---|---|---|---|
| `src/world/PineLandmarks.ts` | 422 | `shard:world/landmarks.ts` | S2.1 | Only Pine builds it (`main.ts:465`) |
| `src/world/PineCrags.ts` | 1,019 | `shard:world/crags.ts` | S2.1 | Imported by `PineLandmarks` only |
| `src/world/PineStreams.ts` | 278 | `shard:world/streams.ts` | S2.1 | `main.ts:297`; its water body implements `WaterBody` at X5 |
| `src/world/BeaverPool.ts` | 196 | `shard:world/beaverPool.ts` | S2.1 | Imported by Pine's quest; `pondClip` (manifest) cuts the pond around it |
| `src/world/pineHero.ts` | 18 | `shard:world/heroFiles.ts` | S2.1 | File lists for `boot.files` |
| `src/world/pineSkyKeys.ts` | 39 | `shard:look/skyKeys.ts` | S2.4 | The seven photographic keys of the sky backdrop |
| `src/world/PineDayNight.ts` | 609 | split: the clock → `src/engine/world/dayCycle.ts` (generic, §6.4); the presets `P` (:84-120) → `shard:look/dayKeys.ts` (keyframe data); the key-blend dome, the stepped IBL refresh and the sky-key residency (:206-609) → `shard:look/skyBackdrop.ts` (Pine's `LookStrategy.backdrop`) | S2.4 | §6.4 |
| `src/world/PineWeather.ts` | 153 | the state machine → `src/engine/world/weather.ts` (generic `Weather`); `PINE_WEATHER_LEN`, `FIRST_CLEAR`, `SOAK_S`, `DRY_S`, `dawnFogAt` → `shard:world/weatherProfile.ts` | S2.4 | §6.4 |
| `src/world/PineWeatherFX.ts` | 527 | the rain curtain (`buildRain`, :164-236) → `src/kit/weather/rainCurtain.ts` (shared with Nalati's `WeatherFX.buildRain`); the cover map, puddles, splashes, lens drops (:136-163, :237-527) → `shard:world/weatherFx.ts` | S2.4 | Rule of two: only the curtain is shared (question Q3) |
| `src/world/Cabin.ts` | 642 | the `Interactable` type and `setSight` users stay engine: `src/engine/world/interact/types.ts`; the `Cabins` class (the homestead) → `shard:world/homestead.ts` | S2.1 | `Cabins` is built only on Pine (`main.ts:444-445`); `Interactable` is imported by 30 files on every shard |
| `src/world/TrophyWall.ts` | 315 | `shard:world/trophyWall.ts` | S2.1 | Built by the compendium install for Pine's compendium only |
| `src/world/pointLightSkip.ts` | 31 | `src/engine/render/pointLightSkip.ts`, on by the tier knob `pointLightSkip` | S2.1 | `Sky.ts:134` slug gate |
| `src/audio/ForestAmbience.ts` | 288 | `shard:audio/ambience.ts` | S2.1 | Built only on Pine (`main.ts:863`); becomes an `AmbienceBeds` profile at S3.5 |
| `src/audio/PineHollowSfx.ts` | 291 | `shard:audio/sfx.ts` | S2.1 | Pine's voice engine; merged with `Voices.ts` into the engine voice pool at S3.5 (01 §15) |
| `src/entities/pineCreatures.ts` (361), `pineCoats.ts` (533), `pineCreatureRigs.ts` (17), `bearFix.ts` (112) | 1,023 | `shard:species/hulls.ts`, `coats.ts`, `rigs.ts`, `bearFix.ts` | S2.3 | The Pine look of its species (the TRELLIS hulls and coats). `pineCreatureRigs.ts` is also read by `boot/manifest.ts:24` → `boot.files` |
| `src/player/Crossbow.ts` (1,307), `LeverRifle.ts` (929), `Longbow.ts` (792), `hunterHands.ts` (435) | 3,463 | `src/kit/weapons/crossbow/`, `bow/` (Longbow as a Bow profile), `src/kit/viewmodel/hunterHands.ts`; `LeverRifle.ts` → `shard:weapons/LeverRifle.ts` at F6 (`class LeverRifle extends Firearm`, rule of two: only Pine uses it; 13-lead-resolutions 04#3) | S2.2 | Families live in the kit (01 §18); 09-combat-ai has every field |
| `src/player/Skins.ts` | 299 | `SkinLocker` → `#game/cosmetics` (X5 "one skin locker"); `SKINS` (the seven legendary finishes) → `shard:loadout/skins.ts` | S2.2 | The legendary skins are Pine's (`main.ts:793`, E318 row 4 / E333) |
| `src/ui/compendium/shards/pine-hollow.ts` | 145 | `shard:compendium.ts`, registered with `ctx.rows.compendium(…)` | S2.1 | `compendium/install.ts:14, 48` |
| `src/game/achievements.ts:35-97` (the `PINE_HOLLOW` list), `:98` | ~63 | `shard:feats.ts`, `ctx.rows.feat(…)` | S2.1 | #game feats per shard (decision 76) |
| `src/game/Inventory.ts:12-29, 52, 79-86, 110-134` (`PINE_PACK_KINDS`, `PINE_PACK_SLOTS`, `isPineItem`, `isPineChunk`, Pine's item rows) | ~30 | Pine's item rows → `shard:items.ts`; the pack rule → `manifest.bag.pack` | S2.1 | E314 pick C |
| `src/core/perfLap.ts` (36), `src/ui/perfLap.ts` (197) | 233 | `src/engine/debug/perfLap.ts` (the panel's lap runner, no route of its own) | S2.1 | The route is Pine's (`shard:dev/perfLap.ts`) |
| `src/world/blenderArea.ts:32` (`'pine-hollow': { x0: 87, x1: 168, z0: 66, z1: 148 }`) | 1 | `level.blender.area` | S2.1 | Data |
| `src/world/HorizonMatte.ts:55-57` (the Pine strips) | 3 | `level.horizon.matte` | S2.1 | Data |
| `src/world/TreeFactory.ts` (768) | 768 | `shard:world/treeFactory.ts` | S2.1 | `trees.factory: 'pine'` is Pine's only (Nalati: `spruce`, the others `none`); the template's comment (`_template.ts:98`) is the template's to change at Z1 |
| `src/world/Grass.ts` (the non-painterly carpet, 614 in all), `Undergrowth.ts` (539) | 1,153 | `shard:world/grass.ts`, `undergrowth.ts` | S2.1 (`Undergrowth.ts`); `Grass.ts` at S3.1, once S3.1 takes Nalati's `GrassV2` dispatch out (`Grass.ts:129`; 13-lead-resolutions 04#4) | Only Pine draws the carpet and the undergrowth |
| `src/world/Particles.ts` (423), `src/world/GrassTrample.ts` | — | `src/kit/looks/particles.ts`, `src/kit/looks/trample.ts` | F6 | Pine + Nalati (rule of two; 01 §21 names the trample) |
| `src/world/Forest.ts` (351), `placement.ts` (323), `treeSpecies.ts`, `treeSet.ts` | — | `src/engine/world/forest/` | F6 | Placement + drawing of any forest (Pine, Nalati); the species names are data the shard's set declares |
| `scripts/pine-hollow-*.mjs` (17 files), `e314-pine-bag-capture.mjs` | — | F7's liveness rule; `pine-hollow-perf-lap.mjs` is live (a harness block) and is ported to the probe | F7 | — |
| `test/pine-*.test.ts` (13), `token-shelf.test.ts`, `models-pine-hollow.test.ts` | — | `test/shards/pine-hollow/` (TP11); `pine-day-night.test.ts` and `pine-weather.test.ts` become `test/engine/day-cycle.test.ts` + `test/engine/weather.test.ts` with Pine's profile as one fixture | F6; S2.4 | — |
| `public/assets/pine-hollow/**`, `public/assets/models/pine-hollow-*`, `public/assets/gpu/pine-hollow/**`, `public/assets/music/pine-hollow-*`, `public/assets/sfx/pine-hollow/` | — | **not moved** (TP §5) | — | — |

## 2. (b) Every engine line that branches on or wires Pine Hollow, and what replaces it

### 2.1 `src/main.ts`

| Line(s) | Grep key | Today | Replaced by |
|---|---|---|---|
| 9, 297-298 | `const streams = chunk.slug === 'pine-hollow' ? new PineStreams(sky).build()` | the creek, waterfall, foam, spray | the plugin's world build (`level.world`) |
| 48, 445, 465-468 | `new Cabins(sky, chunk.slug === 'pine-hollow' ? pineHamletBuildings() : [])` / `installPineLandmarks(` / `cutTerrain(world.physics, landmarks.crags.terrainCuts())` | the homestead + hamlet, the landmarks, the cave's terrain cut and punch | the plugin's world build, same calls in the same order: `placeCabins`, the door pieces (`main.ts:453-463`, moved verbatim), `installLandmarks`, the cut and the punch (`world.terrain.punch` stays an engine terrain verb) |
| 49, 481-486 | `const propsBuilt = new Props(sky, forest, game.renderer)` | the boulders, stumps, logs (the default branch of the `props` step) | the plugin's world build |
| 51-54, 251-252, 517, 532-549 | `startViewmodelTextures(…=== 'crossbow')` / `if (getActiveChunk().slug === 'pine-hollow') void preloadLeverModel()` / `new Crossbow(` / `const isPine = chunk.slug === 'pine-hollow'` / `new LeverRifle(` / `new Longbow(` / `longbow ? [{ weapon: longbow, id: 'bow', name: "Warden's longbow" }]` | the default crossbow, the lever-action in the rifle slot, the Longbow in the extras; the texture worker and the lever model fetched while the world builds | `level.loadout` (S2.2): rows `weapon.crossbow` (start), `weapon.lever` (slot 2, pickup), `weapon.longbow` (slot 3, locked until granted), registered by the plugin in `level.kit`. **No row and no weapon model in `level.data`** (R3-03, R4-06): today only `preloadLeverModel()` (`main.ts:252`) fetches the lever GLB `LEVER_MODEL_URL` while the world builds (`lateReads`, `shardPrefetch.ts:86-89`, feeds only the service worker's background prefetch, which starts after the build, `main.ts:1295`, + 4 s). After S2.2 the GLB is fetched where the model is built, in `level.kit` (from the service-worker cache once the app is installed, decision 29; the phone file is 253 KB). Each family row declares `preload` (the texture worker for the crossbow and the lever; the lever model fetched and built from that GLB), and the engine runs those preloads in `level.kit`, after the rows exist: when `hooks.kit` returns it resolves `level.loadout` against the registered rows, builds the weapons and preloads their models before `level.play` (R2-05). No row registers in `level.data`. The texture worker, the GLB's fetch and the model decode so start after the world build instead of beside it: a boot-order change, listed in §8 |
| 59-61, 619-630, 754-795 | `import { finishPick, pineFinishes }` / `import { mottLine }` / `let pineFinish` / `...(isPine ? { skins: () => pineFinishes(skins), …, pack: { note: "Everything here trades at Mott's stall"` / `if (isPine) pineFinish = (id) =>` / `const skin = isPine ? skinFor(a.kind, a.variant) : null` / `spawnSkinDrop` | the Bag's FINISHES and Mott's pack lines; the legendary skin drops on a kill | the finishes are skin rows, `ctx.rows.skin(PINE_FINISHES)` in `level.kit` (R3-F5, R4-07; one cosmetics path with Nalati's), listed under `manifest.bag.skinsTitle: 'Finishes'` (today's heading, `main.ts:627`); `ctx.bag` fragments registered by the plugin (S2.2): the pack note / hint / gear hint / line (strings + `mottLine`); the kill drop → `ctx.on('actor.died')` in `shard:loadout/skins.ts` with today's code (`spawnSkinDrop`, `toss` from `app.rng.stream('loot')` in place of `Math.random()` at :771) |
| 76 | `import { Inventory, ITEMS, isPineItem` | Pine's pack rule | `manifest.bag.pack` + Pine's item rows |
| 111, 863-868, 885 | `new ForestAmbience(audio, { heightAt, cabins })` / `pineFights?.useSfx(ambience.sfx)` / `installPineAudio(` / `ambience.addSpot({ zone: 'cave'` | the forest's zoned ambience and its one-shots, the A-rows' wiring, the cave's reverb spots | the plugin (S2.1): it builds the ambience, hands its `sfx` to its own combat / quest / loadout (no host plumbing), runs `shard.pine.audio` (from `audioWiring.ts`) and adds the cave spots |
| 117, 118, 800 | `import { placeCabins }` / `import { placePineHollowSets }` / `if (chunk.slug === 'pine-hollow') placePineHollowSets(registry)` | the Sets | the plugin, after its quest has placed its props (same order) |
| 137-141, 786-789, 799, 887-893 | `installPineCombat` / `installPineQuest` / `installPineWeather` / `installPineLoadout` / `installPineLife` | the seven install calls (with landmarks and audio) | the plugin's `install` (§4) |
| 252, 517 | `preloadLeverModel()` | see above | the lever row's `preload`, run in `level.kit` (R3-03; the GLB itself prefetched in `level.data`) |
| 435, 431-439 | `const bare = isOcean \|\| built !== undefined` / `new Grass(sky, forest).build()` / `new Undergrowth(sky, forest)` / `new Particles(sky, forest)` | Pine's grass carpet, undergrowth, mist | the plugin builds grass (Pine's carpet), undergrowth and particles (the kit's) in `level.world`; the engine's `grass` step runs only for Nalati until S3.1 (the engine reads no slug: Nalati's plugin takes the step at S3.1) |
| 503-504, 253 | `const fieldModels = getActiveChunk().fieldModels?.()` / `if (fieldModels) (await fieldModels)({ sky, renderer…, forest, under, registry })` | the forest's trees and floor kinds drawn as models (E349) | the plugin's world build calls `placeDrawnModels({ … })` itself after its props (same point in the boot). `ChunkDef.fieldModels` is deleted |
| 511-514 | `// Pine Hollow's clock (PineDayNight) keeps its own Settings` / `dayNight instanceof DayNight ? dayNightClock(dayNight) : nalatiClock ? …` | Pine's clock is outside `WorldClock` | `app.world.dayCycle` (S2.4): one clock service for every shard with `uses: ['dayCycle']`; `setActiveClock` and the two adapters are deleted |
| 587 | `const mood = … : 'pine'` | Pine's theme | `level.audio.score: 'score.pine'` (S2.1: Pine's `ScoreSource`, §6.1 step 7) |
| 623 | `name: … (w.id === 'crossbow' ? 'Hunting crossbow' : w.name)` / `ammoLabel: w.id === 'crossbow' ? … 'Iron bolts'` / `icon: w.id === 'rifle' ? (isPine ? 'lever' : 'rifle') : w.id === 'bow' ? 'longbow'` | the Bag's names, ammo labels, icons | the weapon rows' `name`, `ammo.label`, `icon` (S2.2) |
| 719-729 | `const rifleDrop = (() => { const site = CABIN_SITES[0]; if (!site \|\| !cabins \|\| rifle === null) return null;` … `prompt: isPine ? 'Take the lever-action' : 'Take AR-15', ...(isPine ? { scale: 1.3 } : {})` | the lever-action's pickup in cabin 1 | the lever row's `pickup: { at: 'cabin-1', local: [1.5, -1.6], prompt: 'loadout.lever.take', scale: 1.3, toast: 'loadout.lever.got' }`, placed by the plugin (S2.2). Only Pine ever builds it: Nalati and Driftwood have no cabins |
| 787 | `if (pineLoadout?.hasRifle === true) rifleDrop?.dispose()` | the lever is kept once taken | the equipment service's `owned` check on the row (S2.2) |
| 836-837 | `if (meleeShard(chunk) \|\| pineFights !== null) hurtArc.hit(` | the hurt arc on Pine | the damage pipeline's subscriber on every shard (S1.3) |
| 878, 882 | `(a.state === 'sidestep' && d < 80)` / `elite: pineFights?.eliteEngaged() === true ? 1 : 0` | the perf panel's counts | the creature runtime's counts (`scripted` state) and the encounter service's `engaged` count |
| 898 | `ambience instanceof ForestAmbience ? ambience.stepSurface(p.x, p.z, p.y)` | Pine's footsteps | the cue map: `cue.step.<surface>` with the surface from Pine's ambience's `stepSurface` (S2.1) |
| 1094-1102, 1169 | `else if (carcass && pineLife?.busy !== true)` / `if (pineLife) pineLife.harvest(carcass, give)` | the skinning beat before the drops | `ctx.answer('harvest.begin', …)`: Pine's life answers with its skinning beat; the default answer gives at once and fades the carcass |
| 1135 | `if (sky.pine && ambience instanceof ForestAmbience) ambience.dawn = sky.pine.dawn` | the dawn chorus | Pine's audio system reads `app.world.dayCycle.dawn` |
| 1153 | `pineLoadout?.update(dt)` | the loadout's tick | the plugin system `shard.pine.loadout` (`update`, `after: ['engine.weapons.update']`) |
| 1195-1197 | `if (pineFights?.onPlayerDeath() !== true && …) die(killer);` / `pineLoadout?.onPlayerDeath()` | the King's checkpoint death; the loadout back to iron bolts | `ctx.answer('player.death', …)`: the boss runtime answers "handled" while a fight holds its checkpoint (S2.3); the loadout listens to `player.died` (S2.2) |
| 1296 | `pineLife` in the `__world` handle | debug | `window.__wildshard` + the alias (01 §5) |

### 2.2 `src/core/*`, `src/boot/*`, `src/world/*`, `src/audio/*`, `src/entities/*`, `src/ui/*`, `src/explore/*`

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `core/tier.ts:101-115` | `export const PINE_HOLLOW_PHONE = { treeHiDist: 60, shadowFar: 60, animalShadowDist: 60, grassSlots: 40 }` / `applyShardTier` / `if (TIER === 'phone' && tierShard === 'pine-hollow')` | Pine's phone knobs | `level.tiers.phone` (§3). `PINE_HOLLOW_PHONE`, `applyShardTier`, `ROW_BASE`, `tierShard` are deleted at S2.1 (question Q2: X7 step 1 lists the same deletion) |
| `core/tier.ts:123-125` | `export function pinePhoneCuts()` | the stepped IBL refresh | `tiers.phone.envSteps: true`, read by Pine's sky backdrop |
| `core/tier.ts:132-134` | `return TIER === 'phone' && (tierShard === 'pine-hollow' \|\| tierShard === 'driftwood-isle')` | the depth slices and the off-screen god rays | tier knobs `slices` and `skipRaysOffscreen`; Pine's manifest sets both on the phone. Driftwood's half stays in `phonePictureCuts()` until S4.1 sets them in Driftwood's manifest |
| `core/Game.ts:283, 356` | `const slices = R?.slices ?? phonePictureCuts()` / `if (phonePictureCuts()) skipRaysOffscreen(` | as above | the render service's tier resolution (05 §2.2) |
| `core/Game.ts:369` | `this.sky.attachPost({ vol, rays: godRays, hueSat: grade })` | Pine's clock grips the post chain | `app.world.dayCycle` hands the post handles to the active backdrop (S2.4) |
| `core/bootstrap.ts:34, 86` | `pine: (renderer, def, _sky) => new TreeFactory(renderer, { …bark…twigAtlas })` / `TREE_FACTORIES[def.trees.factory]` | the pine tree factory | `level.trees.factory: () => import('./world/treeFactory').then((m) => m.pineFactory)`, awaited at the same `cards` step (same boot order) |
| `world/Sky.ts:24, 101-103, 170-180, 187-205, 278, 391-392` | `const pineClock = !stylizedSky && getActiveChunk().slug === 'pine-hollow'` / `setupPine()` / `pine.bind({` / `this.pine?.update(dt, this.camera)` / `get lamps()` | Pine's key-blend sky and clock | `uses: ['dayCycle']` + `render.backdrop` (Pine's `skyBackdrop`) (S2.4). `Sky.setupPine`, `Sky.pine`, `attachPost`, the `lamps` getter's Pine branch go; `lamps`, `night`, `dusk`, `dawn` are `app.world.dayCycle` fields |
| `world/Sky.ts:134` | `if (getActiveChunk().slug === 'pine-hollow') patchPointLightSkip()` | the far point-light skip (E142) | the tier knob `pointLightSkip` (both tiers in Pine's manifest) |
| `world/Atmosphere.ts:83-85, 173` | `const edge = getActiveChunk().slug === 'pine-hollow'; pineWeather = edge;` | the slab-edge haze and the weather uniforms compiled into Pine's shaders only | `level.atmosphere.edgeHaze: true` and `level.atmosphere.wetSurfaces: true` (question Q1). Program sources stay byte-identical per shard |
| `world/Grass.ts:117, 131` | `groundSet(getActiveChunk()).boreal?.grassTint` / `this.trampleAble = getActiveChunk().slug === 'pine-hollow'` | the boreal tint; the trample | the carpet is Pine's (§1.3): the trample is a constructor option the plugin passes |
| `world/Terrain.ts:34-46, 519-595` | `ground.boreal` | the boreal ground shader | unchanged mechanism (data-driven: `assets.boreal`); `boreal` stays a manifest field |
| `world/Particles.ts:106` | `const lowSun = this.sky.pine?.dusk ?? 1` | the mist's low-sun term | `app.world.dayCycle?.dusk ?? 1` |
| `world/HorizonMatte.ts:55-57` | `'pine-hollow': { day: '/assets/horizon/pine-hollow-day.webp'` | the painted horizon strips | `level.horizon.matte` |
| `world/Cabin.ts:19, 48, 365` | `from '../chunks/pine-hollow/models/logCabin'` | the homestead | moves to Pine (§1.3) |
| `world/WorldClock.ts` (103), `world/DayNight.ts:118-127` (`export interface DayClock`) | — | the adapters; the misnamed interface | deleted at S2.4 (§6.4) |
| `entities/AnimalManager.ts:439` | `private readonly trampling = getActiveChunk().slug === 'pine-hollow'` | animals push trample movers on Pine | the runtime pushes movers when `app.world.trample` exists (Pine's plugin installs the kit trample field) |
| `entities/AnimalFactory.ts:10, 294, 363` and `entities/pineCreatures.ts:41` | `this.style === 'pbr' ? preloadPineCreatures()` / `if (getActiveChunk().slug !== 'pine-hollow') return false` | the TRELLIS hulls, gated by slug | Pine's `SpeciesLook` rows carry `mesh` / `rig` (the hulls) and a `preload` (S2.3), registered apart from the simulation `SpeciesRow`s (R1-27); the `creatures` Debug row switches them (`models` / `proc`) |
| `boot/manifest.ts:19, 23-24, 78-79, 98-101` | `pineHeroUrls()` / `pineSkyKeyUrls()` / `PINE_CREATURE_RIGS` / `def.slug === 'pine-hollow' ? [...props, ...pineHeroUrls()` | Pine's sky keys, hero props, creature rigs in the bar | `level.boot.files(tier)` (§3) |
| `boot/extras.ts:35, 82, 231-232, 264` | `decodePineShots, pineShotFiles` / `const pineShots = !ocean && !steppe && shardSfxSets(def.slug).length > 0` | Pine's one-shots decoded at the bar | `level.boot.audio` (Pine's sprite in the decode list) |
| `boot/audioFiles.ts:50-59, 70-80, 94-101` | `const PINE = 'pine-hollow'` / `shardMusicSets` / `shardSfxSets` / `unplayed` / `otherShardFiles` | Pine's own sets; no `island` slot; no other shard's SFX | `level.boot.audio` (music: the base styles minus `island` + `pine-hollow-<style>`; sfx: the base sets minus other shards' tagged files + `pine-hollow`) |
| `boot/shardPrefetch.ts:45-48, 86-89` | `import { KNIFE_MODEL_URL }` … `if (def.slug === 'pine-hollow') { out.push(tierUrl(LEVER_MODEL_URL…` | the late reads | `level.boot.lateReads(tier)` |
| `boot/bakedTextures.ts:37` | `const UNREAD = { 'pine-hollow': /\/fur-[^/]*$/ }` | baked fur maps Pine never reads | `level.boot.bakedUnread: /\/fur-[^/]*$/` |
| `boot/steps.ts:63-84` | `'pine-hollow': { steps: { sky: { label: 'Sky · dawn to moonlight' }` | Pine's loading labels | `level.boot.steps` (§3) |
| `boot/prefetch.ts:37-41` | `const homestead = def.style === 'painterly' ? files.props : …` | the prefetch order | reads `level.boot.files`; Pine's order unchanged |
| `audio/Music.ts:27-43, 61-68, 114, 500, 518-760, 805` | `export type PineScene` / `setPineScene` / `prefetchPine` / `preparePine` / `setting('pineScore')` / `this.state.shard === 'pine'` | Pine's night / boss / dawn slots | Pine's `ScoreSource` (`shard:audio/score.ts`, §6.1 step 7): the base style's `pine` theme + the `pine-hollow-<style>` set's night / boss phases / dawn sting, the scene from the day cycle and the King's fight. Music.ts keeps no Pine name |
| `audio/Stems.ts:33-37, 49, 88-89` | `export type MusicSet = 'base' \| 'pine-hollow'` / `musicSetDir` | the Pine set's folder | a `ScoreSource` names its own set folder; `MusicSet` becomes `string` |
| `audio/Audio.ts:87, 146, 213, 826` | `'litter' = pine needles (Pine Hollow's default)` / `this.bed = … : 'forest'` | the default bed is Pine's | `level.audio.ambience: 'ambience.pine'` (the bed name `forest` stays Pine's ambience profile) |
| `ui/debugOptions.ts:68, 136-137, 152, 158-159, 177` | `const pineHollow: When = (c) => c.chunk.slug === 'pine-hollow'` / `opt('weather'` / `opt('pineScore'` / `opt('pineLife'` / `opt('cragView'` | Pine's Debug rows | engine rows shown by mechanism: `time` when `uses` has `dayCycle`, `weather` when it has `weather`, `creatures` when a species row has a procedural fallback. Shard rows through `ctx.debugRow`: `pineScore`, `pineLife`, `cragView` (question Q4: shard-declared option keys) |
| `ui/compendium/install.ts:14, 48` | `for (const def of [PINE_HOLLOW_COMPENDIUM]) registerCompendium(def)` | Pine's journal | `ctx.rows.compendium(…)` |
| `ui/Menu.ts`, `ui/bag.ts` | Pine's FINISHES / pack comments | — | the Bag fragments (above); X2 finishes the tabs |
| `ui/titleDeck.ts:21-23, 49` | `pineThumb` | the card | the generated registry (F9) |
| `game/Inventory.ts:86, 111, 134` | `const isPineChunk = (chunkId) => chunkId.endsWith('/pine-hollow')` | the pack rule | `manifest.bag.pack` |
| `game/achievements.ts:98` | `'chunk://local/pine-hollow': PINE_HOLLOW` | Pine's feats | `ctx.rows.feat` |
| `explore/Explore.ts:45-75` | `'pine-hollow': practicePine` | the hub art | `level.explore.art` |
| `explore/Compare.ts:28-31` | `'pine-hollow': [ pair('ridge'` | compare pairs | `level.explore.compare` |
| `explore/MiniMap.ts:131` | `const ph = this.world.game.sky.pine?.phase` | the Explore map's day key | `app.world.dayCycle?.phase` |
| `world/blenderArea.ts:32` | `'pine-hollow': { x0: 87, x1: 168, z0: 66, z1: 148 }` | the Blender-built area | `level.blender.area` |
| `chunks/registry.ts:15, 26` | `import { PINE_HOLLOW }` | the hand list | the generated registry (F9) |

## 3. (c) The manifest, in full

`src/shards/pine-hollow/manifest.ts`, node-safe. Function values are the functions `pine-hollow.ts` defines today,
moved verbatim to `world/terrain.ts` (§1.1). Every `ChunkDef` field is carried over under 01 §6's names
(13-lead-resolutions 05/06#1). **Q1** marks this spec's sub-fields; each is a declared manifest field
(13-lead-resolutions still-open 05#1: "all are declared manifest fields", 01 §6 "Declared sub-fields"; §10 Q1 lists them).

```ts
import { defineShard } from '#game';
import { WORLD_WIND } from '#kit';                                          // today's world/wind.ts values as data (Driftwood and Pine share them: kit by the rule of two)
import { layoutFauna } from '#engine';                                    // engine/world/faunaLayout.ts
import { CHUNK_HALF } from '#engine';
import { TERRAIN, forestDensity, oldGrowthMask, speciesMix } from './world/terrain';
import { SPAWN, CABIN_SITES, POND, HAMLET, KINGS_CLEARING, DEN, ridgeFootZ, PINE_HOLLOW_POIS, inBeaverPool } from './layout';
import { bootFiles, lateReads } from './boot/files';                     // from boot/manifest.ts:78-101, shardPrefetch.ts:86-89, pineHero.ts, pineSkyKeys.ts, pineCreatureRigs.ts
import thumb from './thumbs/pine-hollow.jpg';
import portrait from './thumbs/pine-hollow-portrait.jpg';
import landscape from './thumbs/pine-hollow-landscape.jpg';

export default defineShard({
  api: 1,
  slug: 'pine-hollow',
  name: 'Pine Hollow',
  label: '(+3, −2)',                                                      // gridCoords (01 §6)
  biome: 'Boreal pine forest',                                            // the title deck's card line (titleDeck.ts:49)
  blurb: "A photoreal boreal forest, from dawn fog to lantern-lit night. Hunt deer, boar, elk and bear through the pines, relight the ranger's three dark waystone lanterns and face the Antler King in the old-growth — his thralls walk the fog until dawn.",
  order: 2,                                                               // after Driftwood (PH-U19)
  status: 'live',                                                         // PH-S2 graduated
  card: { thumb, portrait, landscape },
  placement: { grid: [3, -2], size: [500, 500, 500] },                    // gridCoords '(+3, −2)'; config.ts:2 CHUNK_SIZE 500
  seed: 1337,                                                             // 01 §6
  treeCount: 2600,                                                        // carried as data (the forest's cap)
  style: 'pbr',
  kitLook: 'pbr',                                                         // Q1, declared (01 §6): the look shared kit pieces render in
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice',
    'loot', 'compendium', 'feats', 'bag.pack'],                           // R1-02: exactly what it runs today (swim: the pond and the creek; loot: the harvest yields and the elites' / King's drops, 09 §5.6); no coins. The grass trample is a kit look piece (#kit/looks, in buildCarpet), not a mechanism
  ground: { terrain: TERRAIN },                                           // pine-hollow.ts:117-161 (buildTerrain(1337, { landscape, trails, cabinSites, pond, pondFill, graded, streamAt, finish, splat }))
  pondClip: inBeaverPool,                                                 // carried as data — pine-hollow.ts:332
  assets: {                                                               // carried as data — pine-hollow.ts:239-250: today's flat ChunkAssets (R3-09), copied to level.assets
    groundLayers: ['forrest_ground_03', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[0.86, 0.78, 0.68], [0.72, 0.8, 0.6], [1.0, 0.98, 0.94], [0.95, 0.8, 0.6]],
    slabRock: 'rock_ground',
    boreal: { normalK: [1.2, 1.0, 1.4, 1.1], trailDust: [1.25, 1.02, 0.7, 0.6], grassTint: [0.8, 0.74, 0.55] },
  },
  assetGlobs: [                                                           // R3-09: the extra asset folders by their real names; game data read by
    'public/assets/models/pine-hollow-crags/**', 'public/assets/models/pine-hollow-hero/**',   // check-lock (02 F0's allowlist, §9), never on
    'public/assets/models/pine-hollow-trees/**', 'public/assets/gpu/models/pine-hollow-hero/**', // LevelSpec. public/assets/pine-hollow/** and
    'public/assets/gpu/models/pine-hollow-trees/**', 'public/assets/gpu/pine-hollow/**',         // public/assets/baked/pine-hollow/** are
    'public/assets/gpu/baked/pine-hollow/**', 'public/assets/music/pine-hollow-folk/**',         // on the allowlist already
    'public/assets/music/pine-hollow-orchestral/**', 'public/assets/music/pine-hollow-piano/**',
    'public/assets/sfx/pine-hollow/**', 'public/assets/horizon/pine-hollow-*', 'public/assets/gpu/horizon/pine-hollow-*',
    'public/assets/lut/pine-hollow.bin', 'public/assets/title/pine-hollow-portrait.jpg'],
  trees: {                                                                // carried as data — pine-hollow.ts:251 + the factory thunk (bootstrap.ts:34)
    factory: () => import('./world/treeFactory').then((m) => m.pineFactory),
    bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'trees', set: 'pine-hollow-trees', drawnBy: 'model',
  },
  forest: {                                                               // carried as data — pine-hollow.ts:252-267
    spacing: 8.5, densityFreq: 0.008, clearings: [-0.45, 0.35], maxSlope: 0.72,
    tintHue: 0.25, tintHueJitter: [-0.04, 0.03], tintSat: [0.25, 0.5], tintLight: [0.5, 0.68], largeVariantChance: 0.1,
    density: forestDensity, scale: (x, z) => 1 + oldGrowthMask(x, z) * 0.25, species: speciesMix,
    understory: { ferns: 1, shrubs: 2.5, fernCanopy: false },
  },
  spawn: SPAWN,
  sky: {                                                                  // pine-hollow.ts:300-309 (the pre-clock fixed look; the day cycle's `sunset` key reuses it)
    hdri: 'qwantani_sunset_puresky', sunColor: [1.0, 0.76, 0.5], sunIntensity: 3.8, envIntensity: 1.1, bgIntensity: 0.95,
    fogSunColor: [1.0, 0.78, 0.5], cloudSunColor: [1.0, 0.82, 0.62], hemiSky: 0x8fa8d0, hemiGround: 0x4a3a28, hemiIntensity: 0.45,
  },
  atmosphere: {                                                           // pine-hollow.ts:310-316 + the two Atmosphere.ts:84 switches
    fogHeight: -14.0, fogHeightFalloff: 0.12, fogHeightDensity: 0.005, fogDistDensity: 0.00045, volumetricSunColor: [1.0, 0.72, 0.42],
    edgeHaze: true, wetSurfaces: true,                                    // Q1
  },
  grade: {                                                                // pine-hollow.ts:317-322
    saturation: 0.18, brightness: -0.015, contrast: 0.2, bloomIntensity: 0.55, bloomThreshold: 0.85,
    shadowTint: [0.9, 0.95, 1.08], highTint: [1.06, 1.0, 0.92], lift: [-0.01, -0.008, 0.0], gain: [1.03, 1.02, 1.0], gamma: 1.0,
  },
  look: {                                                                 // carried as data — pine-hollow.ts:326-329 (the look loop's layer)
    grade: { shadowTint: [0.95, 0.97, 1.03] },
    curve: 0.2, vibrance: 0.2, vol: 0.5, fogDist: 0.55, sat: 0.04, dayMist: 0.25, ambient: 1.3, sky: 1.18,
  },
  horizon: { matte: {                                                     // carried as data — HorizonMatte.ts:55-57
    day: '/assets/horizon/pine-hollow-day.webp', night: '/assets/horizon/pine-hollow-night.webp', elMin: -30, elMax: 14, scale: 4,
    phone: { day: '/assets/horizon/pine-hollow-day-phone.webp', night: '/assets/horizon/pine-hollow-night-phone.webp' } } },
  world: { blenderArea: { x0: 87, x1: 168, z0: 66, z1: 148 } },           // Q1, declared (01 §6) — blenderArea.ts:32
  wind: WORLD_WIND,                                                       // 01 §17: today's world/wind.ts values (sway, gusts) as data for the engine WindField
  dayCycle: () => import('./look/dayKeys').then((m) => m.PINE_DAY),       // S2.4: 24-min cycle, day = [0, 20/24), keys by phase (§6.4)
  weather: () => import('./world/weatherProfile').then((m) => m.PINE_WEATHER),   // S2.4
  render: () => import('./look/render').then((m) => m.shardRender()),     // S2.1: the engine chain as is (compose returns {}); S2.4 adds the sky backdrop
  tiers: {
    phone: { treeHiDist: 60, shadowFar: 60, animalShadowDist: 60, grassSlots: 40,   // tier.ts:101 PINE_HOLLOW_PHONE
      slices: true, skipRaysOffscreen: true, envSteps: true, pointLightSkip: true },  // tier.ts:123-134; Sky.ts:134
    desktop: { pointLightSkip: true },                                    // Sky.ts:134 (every tier)
  },
  budgets: {                                                              // inputs only; S2.6 derives the numbers, its F2-baseline ceilings until then (R1-14)
    phone: { fps: 30, lanes: 'default' },
    desktop: { fps: 60, lanes: 'default' },
    load: { coldPlay4G: 40 },                                             // budget-design §6.6 (Jake's cap)
  },
  fight: { attackers: Infinity },                                         // no fightRules (Driftwood only), no hit cap
  ktx2: () => import('./ktx2.generated'),                                  // R3-08 / R3-F1: top-level, the shard's committed KTX2 table (R2-04)
  loadout: {                                                              // S2.2 (09-combat-ai has the rows)
    weapons: ['weapon.crossbow', 'weapon.lever', 'weapon.longbow'],
    tools: [],
    start: ['weapon.crossbow'],
    pickups: [{ id: 'weapon.lever', at: 'cabin-1' }],                // main.ts:719-728
    grants: [{ id: 'weapon.longbow', by: 'boss.antler-king' }],            // Q1 — the King's orb (installPineLoadout grantLongbow); also in `weapons`: built at load today (main.ts:544), locked until granted (R4-16)
    ammo: ['ammo.bolt.iron', 'ammo.bolt.pitch', 'ammo.bolt.broadhead', 'ammo.arrow', 'ammo.cartridge'],
  },
  bag: {                                                                  // Q1 — E314 pick C
    tabs: ['map', 'gear', 'finds', 'pack', 'feats'],
    pack: { slots: 7, keeps: ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'] },   // Inventory.ts:80-83
    skinsTitle: 'Finishes',                                               // R4-07: today's heading (main.ts:627; Menu.ts:84's default is SKINS)
  },
  species: ['creature.deer', 'creature.elk', 'kit:creature.boar', 'kit:creature.bear', 'creature.thrall'],   // 09-combat-ai rows
  encounters: [
    'elite.ironhide', 'elite.ghost-stag', 'elite.blackpaw', 'elite.imperial-bull',                            // elites.ts:64-90
    'boss.antler-king',
  ],
  spawns: [                                                               // 01 §6 (was fauna) — pine-hollow.ts:274-299, evaluated at import as today
    ...layoutFauna({
      seed: 1337, half: CHUNK_HALF, margin: 25, spacing: 56, jitter: 15, ring: 20, trailDistance: TERRAIN.trailDistance,
      avoid: [
        { x: POND.x, z: POND.z, r: POND.r + 12 }, ...CABIN_SITES.map((c) => ({ x: c.x, z: c.z, r: 35 })),
        { x: SPAWN.x, z: SPAWN.z - 5, r: 60 }, { x: HAMLET.x, z: HAMLET.z, r: HAMLET.blend },
        { x: KINGS_CLEARING.x, z: KINGS_CLEARING.z, r: KINGS_CLEARING.blend }, { x: DEN.x, z: DEN.z, r: 55 },
        ...[-215, -155, -95, -35, 25, 85, 135].map((x) => ({ x, z: ridgeFootZ(x) + 52, r: 34 })),
      ],
      emptyWeight: 10,
      groups: [
        { kind: 'deer', weight: 36, count: [3, 4], canopy: false, trailBand: [10, 25] },
        { kind: 'boar', weight: 32, count: [2, 3], canopy: true, trailBand: [12, 40] },
        { kind: 'elk', weight: 18, count: [2, 4], canopy: false, trailBand: [15, 40], prefer: (td) => (td >= 15 && td <= 40 ? 1.8 : 0.8) },
      ],
    }),
    { kind: 'bear', count: 2, anchor: { x: DEN.x + 6, z: DEN.z + 6, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['black', 'black-blaze', 'black-old'] },
    { kind: 'bear', count: 1, anchor: { x: DEN.x - 8, z: DEN.z - 14, rMin: 0, rMax: 10 }, canopy: false, trailBand: [18, 220], variants: ['brown', 'brown-old'] },
  ],
  audio: {
    ambience: 'ambience.pine',                                            // ForestAmbience's zones (S2.1; S3.5 profile)
    score: 'score.pine',                                                  // §6.1 step 7
    cues: () => import('./audio/cues').then((m) => m.CUES),
  },
  input: ['crossbow.bolts'],                                              // S2.2
  pois: PINE_HOLLOW_POIS.map(({ id, name, x, z, r }) => ({ id, name, x, z, r })),   // carried as data — pine-hollow.ts:235
  boot: {
    steps: {                                                              // steps.ts:63-84
      sky: { label: 'Sky · dawn to moonlight' }, terrain: { label: 'Terrain · boreal ground' },
      cards: { label: 'Tree species · pine · fir · birch' }, forest: { label: 'Forest · pines · old-growth giants' },
      edge: { label: 'Pond · creek · waterfall · far country' }, grass: { label: 'Grass · ferns · bilberry' },
      cabins: { label: 'Cabins · hamlet · lookout · crags · cave' }, props: { label: 'Rocks · logs' },
      animals: { label: 'Herds · deer · boar · elk · bears' }, weapon: { label: 'Crossbow · lever-action · longbow' },
      audio: { label: 'Audio · score · forest sound' },
    },
    bytes: {                                                              // steps.ts:75-82
      sky: 'sky keys · dawn to moonlight', trees: 'tree species · bark · needles', cabins: 'cabin timber · stone · props',
      props: 'landmarks · crags · creatures', music: 'score · day · night · the King · dawn', sfx: 'forest beds · rain · calls · barks',
    },
    files: bootFiles,                                                     // (tier) => today's chunkFiles(PINE_HOLLOW, tier) lists, literally
    audio: () => import('./audio/files').then((m) => m.BOOT_AUDIO),       // audioFiles.ts's Pine branch + extras.ts:232 (pineShots)
    lateReads,                                                            // shardPrefetch.ts:86-89
    bakedUnread: /\/fur-[^/]*$/,                                          // bakedTextures.ts:37
    explore: { art: ['practice', 'world', 'models', 'sets'] },            // honoured from X3
    precache: [],
  },
  roster: () => import('./roster').then((m) => m.ROSTER),
  explore: {
    art: { practice: './explore/practice-pine-hollow.webp', world: './explore/world-pine-hollow.webp',
      models: './explore/models-pine-hollow.webp', sets: './explore/sets-pine-hollow.webp' },   // Explore.ts:45-75 (imported as URLs)
    compare: [                                                            // Compare.ts:28-31
      { id: 'ridge', label: 'The ridge', model: 'pine-ridge', target: 'art/pine-hollow/round-17-look-loop-3/ridge/mockup-1-fp-front.jpg' },
      { id: 'den', label: 'The den', model: 'pine-den', target: 'art/pine-hollow/round-17-look-loop-3/den/mockup-1-fp-front.jpg' },
      { id: 'hamlet', label: 'Mill hamlet', model: 'pine-hamlet', target: 'art/pine-hollow/round-17-look-loop-3/hamlet/mockup-1-fp-front.jpg' },
    ],
  },
  load: () => import('./plugin'),
});
```

Fields that disappear: `id`, `displayName`, `gridCoords` (→ `label`, `placement.grid`), `thumbnail` / `heroPortrait` /
`heroLandscape` (→ `card`), `fauna` (→ `spawns`, then `species` + spawn tables), `fieldModels` (→ the plugin), `terrain` (→
`ground.terrain`), `weapon` (was omitted = `'crossbow'` → `loadout`).

## 4. (d) The plugin

`src/shards/pine-hollow/plugin.ts` — the install order is `main.ts`'s order today, so every registry id, system and
scene object is added in the same sequence:

```ts
export default class PineHollowPlugin extends ShardPlugin {   // staged hooks, each awaited in its boot stage (R1-24); every ctx verb is bound to ctx.scope (R1-25)
  private rt: PineRuntime | null = null;                   // made in world(); kit() and play() run after it, in stage order
  private runtime(): PineRuntime { if (this.rt === null) throw new Error('pine-hollow: world() has not run'); return this.rt; }
  async world(ctx: ShardContext): Promise<void> {          // ── level.world (main.ts:289-504's Pine parts, in order) ──
    ctx.strings(STRINGS);
    const rt = new PineRuntime(ctx.scope);
    this.rt = rt;
    rt.streams = buildStreams(ctx);                          // edge step: PineStreams (main.ts:297)
    rt.carpet = await buildCarpet(ctx);                      // grass step: Grass (+ trample), Undergrowth, Particles (main.ts:429-440)
    rt.home = await buildHomestead(ctx);                     // cabins step: Cabins + hamlet, placeCabins, door pieces, landmarks, the cave cut + punch (main.ts:443-470)
    rt.props = await buildProps(ctx);                        // props step: Props (main.ts:481-486)
    await placeDrawnModels(ctx, rt);                         // after the animals step's position today (main.ts:504): the forest's trees + floor kinds as models
  }
  kit(ctx: ShardContext): void {                           // ── level.kit ──
    ctx.rows.weapon(CROSSBOW_ROW); ctx.rows.weapon(LEVER_ROW); ctx.rows.weapon(LONGBOW_ROW);   // S2.2; each row's `meta` feeds the Bag (R1-26)
    ctx.rows.ammo(AMMO_ROWS); ctx.rows.species(PINE_SPECIES); ctx.rows.encounter(PINE_ELITES); ctx.rows.encounter(ANTLER_KING);
    ctx.rows.speciesLook(PINE_LOOKS);                        // R1-27: the SpeciesRows are simulation only; the hulls, coats and rigs are SpeciesLooks, registered apart
    ctx.rows.item(PINE_ITEMS); ctx.rows.feat(PINE_FEATS); ctx.rows.compendium(PINE_COMPENDIUM);
    ctx.rows.skin(PINE_FINISHES);                            // R3-F5, R4-07: the finishes are skin rows (wear: pineFinish, read at wear time)
  }
  play(ctx: ShardContext): void {                          // ── level.play (main.ts:786-893's Pine calls, in order) ──
    const rt = this.runtime();
    installLoadout(ctx, rt);                                 // S2.2: ammo, bolt cycle, the lever pickup, the Longbow grant, the finish drop on a kill and the wear wiring
    installCombat(ctx, rt);                                  // S2.3: elites, the Antler King
    installQuest(ctx, rt);                                   // S2.5: the lantern quest, hamlet, night thralls, collectibles, the contract board, trades
    placePineHollowSets(ctx.app.registry);                   // main.ts:800
    installAudio(ctx, rt);                                   // ForestAmbience, cave spots, audioWiring (main.ts:863-868, 885)
    installWeather(ctx, rt);                                 // S2.4 (main.ts:887-888)
    installLife(ctx, rt);                                    // main.ts:891-893
    installDebug(ctx, rt);                                   // rows + handles + the perf lap
  }
}
```

| Kind | Id | Phase / order | Source today |
|---|---|---|---|
| System | `shard.pine.streams` | `update` | `PineStreams` update (wind clock) |
| System | `shard.pine.carpet` | `update`; `after: ['engine.player.update']` | `main.ts:1140-1142` (grass, under, particles by the viewer) |
| System | `shard.pine.homestead` | `update` | `main.ts:1143` `cabins?.update(dt, t)` |
| System | `shard.pine.landmarks` | `update` | `installPineLandmarks`'s `onUpdate` (`main.ts:465`) |
| System | `shard.pine.loadout` | `update`; `after: ['engine.weapons.update']` | `main.ts:1153` |
| System | `shard.pine.elites` | `update`; `tick: 'ai'` (S2.6) | `pinehollow/index.ts:140-146` (`'elites'`: the stun timer, feel, elites, King) — split: `shard.pine.stun`, `shard.pine.elites`, `shard.pine.king` |
| System | `shard.pine.king.atmosphere` | `render`, before the composer | `antlerKing.ts:189-190` |
| System | `shard.pine.quest` | `update` | `installPineQuest`'s updaters |
| System | `shard.pine.npc` | `update`; `tick: 'npc'` (S2.6) | the quest NPC rigs' idle |
| System | `shard.pine.audio` | `update` | `audioWiring.ts` + `main.ts:1135, 1160` |
| System | `shard.pine.weather.state` | `update`; `tick: 'weather'` (S2.6) | `weather.ts:161` `weather.update` + `:189` `shelterHerds` |
| System | `shard.pine.weather.fx` | `update` (every frame) | `weather.ts:162-190` (uniforms, fx, stag fog) |
| System | `shard.pine.life` | `update`; `tick: 'fx'` (S2.6) | `installPineLife`'s updater |
| Events listened | `actor.died` (skin drops, life's ravens, quest), `damage.dealt` (elite / King bookkeeping), `player.died` (loadout → iron bolts), `app.ready` (bird and knife swaps), `practice.active` (weather out of practice rooms) | — | `main.ts:790-795`, `life/index.ts:276`, `quest/index.ts:385`, `ctx.ts:52`, `life/index.ts:131`, `skinningKnife.ts:54`, `practiceRoom.open` reads |
| Asks answered | `player.death` (the King's checkpoint), `harvest.begin` (the skinning beat), `creature.wander-goal` (rain shelter), `damage.modify` (the King's phase guards) | — | `main.ts:1195`, `main.ts:1102`, `weather.ts:130`, `antlerKing.ts:235` |
| Pieces | every id today: the cabin pieces and `Cabin door`s, the landmark pieces (lookout, zipline, footbridge, stones, waystones, dam, canoe, board, cave), props, the drawn tree / floor models, Sets | `level.world` | `placeCabins`, `installPineLandmarks`, `Props.build`, `placeDrawnModels`, `placePineHollowSets` |
| Input context | `crossbow.bolts` (`bolt.cycle` on `KeyB`) | pushed while the crossbow is held | `loadout.ts:157-160` |
| HUD | the elite bar, the boss bar (engine encounter widgets, S2.3), the quest's board / trade panels (`ctx.hud.widget` until X2), the ammo strip (the weapon strip's, engine) | — | `EliteBar`, `BossBar`, `quest/ui.ts` |
| Bag | FINISHES: the skin rows (`ctx.rows.skin`, in `level.kit`) under `bag.skinsTitle: 'Finishes'` (R4-07); the pack's Mott lines and FINDS (Pine's journal) as `ctx.bag` fragments | — | `main.ts:623-630` |
| Debug rows | `pineScore` (Audio), `pineLife` (Creatures & NPCs), `cragView` (Developer tools), the PERF LAP (Performance) | existing groups only | `debugOptions.ts:152, 159, 177`; `perfLapHost.ts` |
| Debug handles | `pine.elites`, `pine.king`, `pine.quest`, `pine.weather`, `pine.audio`, `pine.life`, `pine.loadout` | `ctx.debug.expose` (01 §7) | the seven `window.__pine*` / `__loadout` / `__lever` / `__longbow` assignments |
| Playgrounds | none | — | catalog.ts:7 |

## 5. (e) Engine systems this phase pulls in

| System | What S2 needs of it | Must exist first | Row |
|---|---|---|---|
| Plugin world build in `level.world` for a landscape shard | the engine builds the terrain (from `ground.terrain`), the Forest (factory from `level.trees`), then awaits `plugin.world(ctx)` (R1-24) | S1.1's staged boot | S2.1 |
| Tier knobs as data | `treeHiDist`, `shadowFar`, `animalShadowDist`, `grassSlots`, `slices`, `skipRaysOffscreen`, `envSteps`, `pointLightSkip` from `level.tiers` | S1.1's tier resolution | S2.1 |
| Skin rows, Bag fragments, item / feat / compendium rows | the finishes as `ctx.rows.skin(rows)` (R3-F5: one cosmetics path with Nalati's skins, X5); the pack lines as `ctx.bag` fragments; `ctx.rows.item / feat / compendium` | F9, #game Bag | S2.1 |
| `ScoreSource` for a style-bound score | Pine's source over the base style bank + its own set | S1.5 | S2.1 |
| Ranged families: Bow, Crossbow, Firearm; projectile, drop arc, ADS, brass blocks; AmmoRows | 09-combat-ai | S1.2 contracts | S2.2 |
| AI runtime: HFSM, StrikeSpec, utility picks, the aggression director, `canReach` everywhere, the boss runtime, one elite runtime, weighted spawn / loot tables, the AI debug overlay, boss display names from rows (`BOSS_NAMES` gone), `TargetHit` in the engine combat types | 09-combat-ai; §6.3 steps 7–9 | S1.3 pipeline | S2.3 |
| `DayCycle`, `Weather`, the kit rain curtain, the sky backdrop slot | §6.4 | S1.1 render service | S2.4 |
| The quest runtime on `quest/core`, the kit starter effects, `#kit/npc` | 09-combat-ai (effects), §6.5 | S1.3 effects core | S2.5 |
| The scheduler | 01 §12 | F8 | S2.6 |

## 6. The rows, step by step

### 6.1 S2.1 — the manifest and the plugin

1. **Manifest** as §3; `test/shards/pine-hollow/manifest.test.ts` imports it in node and compares every data value
   and `boot.files('phone' | 'desktop')` with a frozen copy of today's `chunkFiles(PINE_HOLLOW, tier)` output.
2. **World build** (`shard:world/build.ts`): `buildStreams`, `buildCarpet`, `buildHomestead`, `buildProps`,
   `placeDrawnModels` from `main.ts`'s Pine lines (§2.1), with the same arguments. `main.ts` keeps its `edge` / `grass`
   / `cabins` / `props` steps only for Nalati and Driftwood; the Pine branches (`chunk.slug === 'pine-hollow'`, the
   default `Props` branch, `fieldModels`) are deleted. The boot's step keys and their order stay (the plugin's calls
   report progress into the same keys through `ctx.progress`).
3. **The forest factory**: `bootstrap.ts:34` `TREE_FACTORIES.pine` is deleted; the `cards` step awaits
   `level.trees.factory()` (Pine's `pineFactory`: `new TreeFactory(renderer, { bark, twigAtlas })` as today).
4. **Tier data**: §2.2's `core/tier.ts`, `Game.ts`, `Sky.ts:134` rows. `PINE_HOLLOW_PHONE`, `applyShardTier`,
   `pinePhoneCuts` are deleted; `phonePictureCuts()` keeps only Driftwood (`tierShard === 'driftwood-isle'`) until S4.1.
5. **Atmosphere**: `Atmosphere.ts:83-85` reads `level.atmosphere.edgeHaze / wetSurfaces`.
6. **Content rows and Bag**: items, feats, compendium, pack rule, the finishes as `ctx.rows.skin` rows (R3-F5), Mott's lines (§2.1, §2.2).
7. **Pine's score source** (`shard:audio/score.ts`): the Pine half of `Music.ts` (`PineScene`, `setPineScene`,
   `prefetchPine`, `preparePine`, the dawn sting, `setting('pineScore')`) moves here behind `ScoreSource`: `target()`
   returns `night` / `boss` (with its phase) / the base `pine` slot as `wantSlot()` does today (`Music.ts:690-696`).
   The music engine asks it in place of `state.shard === 'pine'`. The scene is set by Pine's audio system from the day
   cycle and by the King's fight.
8. **Audio**: `ForestAmbience`, `PineHollowSfx`, `audioWiring.ts` move (§1.3); the plugin builds them where
   `main.ts:863-868` did and hands `sfx` to its own modules. `Audio.ts:146`'s `'forest'` default becomes
   `level.audio.ambience`, the ambience id Pine's manifest declares.
9. **Debug**: the four rows and the seven handles (§4); `perfLap` becomes engine + Pine's route.
10. **Events**: the seven `onKill` / `onDamaged` / `onHit` chains in Pine's files become `ctx.on` (§1.2); the three
    `ws:ready` listeners become `ctx.on('app.ready')`.
11. **Tests**: `test/shards/pine-hollow/plugin.test.ts` (fake Game, stub builders: the system ids and phases of §4, in
    order; scope dispose removes every piece, system, listener and debug handle), plus the moved Pine tests.

**Done when:** `grep -rn "pine-hollow\|isPine\|PINE_HOLLOW\|pinePhone\|sky\.pine\|PineDayNight\|installPine"
src --include=*.ts` outside `src/shards/pine-hollow/` returns only the generated registry and the S2.4 files still to
move (`Sky.ts` backdrop, `PineWeather*`); parity green on 4 shards × 2 tiers.

### 6.2 S2.2 — the ranged families (the shard side)

The families, blocks and every per-weapon number are 09-combat-ai's. Pine's rows:

| Row | Family | Today (file) | Pine-specific data |
|---|---|---|---|
| `weapon.crossbow` | Crossbow | `Crossbow.ts:768` (the default `ChunkDef.weapon`) | name "Hunting crossbow" (`main.ts:623`), ammo label "Iron bolts", icon `crossbow`, bolt AmmoRows (iron, pitch, broadhead: `BoltMod`), the rain's effect on wet bolts (`pineLoadout.useRain`, `main.ts:888`) as an `ask('projectile.modify')` answered by Pine's weather |
| `weapon.lever` | Firearm (lever action) | `LeverRifle.ts:268` | slot 2, icon `lever`, pickup in cabin 1 (`main.ts:719-728`: local (1.5, −1.6), scale 1.3, prompt "Take the lever-action", toast "Lever-action rifle acquired · 1/2 to switch, Q to swap, R feeds the tube"), `woodFrom` the crossbow's walnut |
| `weapon.longbow` | Bow (a profile with a parent, not a fork) | `Longbow.ts:454` | slot 3, name "Warden's longbow", locked until the Antler King's orb grants it |
| skins | cosmetics rows | `Skins.ts:46-119` | seven legendary finishes (ghost-stag, hollow-ash, ironhide, blackpaw, imperial, warden, scarback-furnace) with today's drop rules (`skinFor(kind, variant)`) |

Pine-side steps: the rows (each row's name, icon and blurb are its `meta`, which `#game`'s Bag reads, R1-26); `installLoadout` without the chained `weapons.on*` (cues and events); the `crossbow.bolts`
context; `feel.ts` deleted (its numbers are the three rows' hit-stop / kick / trauma fields: 09-combat-ai B4 / F4);
`instanceof Crossbow` / `instanceof LeverRifle` in `main.ts:540, 758, 767, 786` deleted. **Done when:** the harness's
shot to a kill with each of the three weapons (the trajectory snapshots, 09-combat-ai) is identical, and the lever
pickup and the Longbow grant work in the scripted run.

### 6.3 S2.3 — the AI runtime (the shard side)

1. **Species rows** (09-combat-ai has the numbers): deer, elk, thrall (the herd brain on `thrall` variants,
   `quest/nightThralls.ts:30`) in `shard:species/`; boar and bear from `#kit/species/` with Pine's look (the hulls,
   coats, rigs of §1.3). The `SpeciesRow`s are simulation only; the look is a `SpeciesLook` registered apart with
   `ctx.rows.speciesLook`, e.g. `{ species: 'kit:creature.bear', mesh: pineHull('bear'), rig: … }`
   (R1-27).
2. **Elites**: the four rows (`elites.ts:64-90`: ids, names, epithets, lairs, the rolled-elite swap
   `swapRolledElites`, drops, trophies) on the engine elite runtime; `condition` (always / dusk / night) reads
   `app.world.dayCycle`. Their state saves under SaveStore key `elites`, **scope shard** (bug §7.6).
3. **The Antler King**: `class AntlerKing extends BossBrain`, phases 0.6 / 0.3 (`combatMath.ts:13`), sweep ring,
   stomp, lanes, thrall lanes, lantern fire, the arena seal and fog hold (`weatherHold.k` → an `ask('weather.hold')`
   the King answers), the checkpoint death (`player.death` ask), the Longbow orb.
4. **Strikes**: every `LaneCharge` use (17) and the elites' / King's attacks become StrikeSpec rows; the herd charge
   of boar and bear gets `canReach` on Pine (bug §7.2).
5. **Spawns**: `spawns` (§3) → the weighted spawn table; the night thralls and the rolled elites → spawn tables with
   `when` tags (`night`, the King's call).
6. **Damage in**: `ctx.hurt` / `ctx.stun` (`pinehollow/index.ts:85-86`) → `combat.hit` with `creature.*` / `boss.*`
   tags; the stun is an effect (`effect.stun` from the kit starter set, same 0 … n seconds as `stunT`).
7. **`BOSS_NAMES` → a content registry fed by boss rows** (EI23; 13-lead-resolutions G17). Today `src/ui/Combat.ts:40`
   exports a mutable `Map` that Pine (`pinehollow/index.ts:121`, the King) and the practice arena
   (`practice/TrainingArena.ts:24`, the dummy) write into, and the head bar / aim readout (`Combat.ts:44, 194`) read.
   S2.3 deletes the map:
   - every `BossDef` row carries `name` (a string-table key) and `showHeadBar: false`, and the encounter runtime
     registers it with `app.rows` when the row is added (`ctx.rows.encounter(ANTLER_KING)`);
   - the engine's practice dummy is a row too (`#engine/practice`: `{ kind: 'training-dummy', name, showHeadBar: true }`);
   - the readout asks `app.rows.displayName(kind)` and skips a head bar where the row says `showHeadBar: false`.
   Nalati's Kurgan Boss and Storm Titan and Driftwood's Captain join the same way in S3.4 / S4.2. `grep -rn
   "BOSS_NAMES" src` prints nothing after S2.3.
8. **`TargetHit` → the engine combat types** (EI23; G17). `TargetHit`, `TargetAnimal` and `Targets`
   (`player/Crossbow.ts:48-63` today, imported by 13 files across the engine, the families and Nalati) move to
   `src/engine/combat/types.ts`, exported from `#engine`. The kit Crossbow family (S2.2) keeps no copy and re-exports
   nothing; every importer is rewritten to `#engine` in the S2.3 commit. Pure types, so `sim-no-render` (F4) holds.
9. **The AI debug overlay** (aaa AA10 "a brain debug overlay"; 13-lead-resolutions G16). A Debug row `aiOverlay` under
   **Developer tools** (`src/engine/ai/debugOverlay.ts`, the drawing in `src/engine/fx/aiOverlay.ts`; `opt('aiOverlay',
   'Developer tools', 'AI overlay', ['off', 'on'], { note: 'E357 S2.3: per-creature brain state' })`). When on, every
   live creature within 60 m shows a world-anchored label (`hud.pin`, 01 §11) with its HFSM state path
   (`fight/strike.charge`), the top three utility scores of its last pick, its tick band (`near` / `mid` / `far`; before
   S2.6 every creature reads `10 Hz`), and `pinned` when it is a boss, an elite or a quest actor. It reads the `ai.state`
   events (09 §4.1) and the brain's last pick. It costs nothing when off (no system is added) and is never on in the
   harness.
10. **Simulation apart from visuals** (02 F4 `wildshard/sim-no-render`; decision 56). `Boss.ts` and `Elite.ts` reach
    their final `src/engine/ai/` home here (04) as the runtime only; their arena, seal and fog-hold visuals go to
    `src/engine/fx/encounter/`, driven by the runtime's events. The rule's count for `src/engine/ai/**` stays 0.

**Tests:** `test/engine/ai-overlay.test.ts` (node: a fake brain's transitions and picks produce the label text; off
adds no system); `test/engine/display-names.test.ts` (a boss row's name reaches the readout; a dummy row shows a head
bar, a boss row doesn't).

**Done when:** `test/strike-table.test.ts` rows for Pine are green unchanged; the harness's scripted elite and King
encounters play the same phase changes at the same health; a boar charge at a cabin wall does not land (the new test);
`grep -rn "BOSS_NAMES" src` prints nothing, and `grep -rn "interface TargetHit\|interface Targets\b\|interface
TargetAnimal" src` prints only `src/engine/combat/types.ts`;
the Debug ▸ Developer tools ▸ AI overlay row shows the labels on Pine (a portrait screenshot recorded in E357).

### 6.4 S2.4 — Weather and the day cycle as engine mechanisms

**A. `DayCycle`** (`src/engine/world/dayCycle.ts`; replaces `PineDayNight`'s clock, `DayNight`'s clock, `DayClock`,
`WorldClock` and the misnamed `interface DayClock` in `DayNight.ts:118`):

```ts
export interface DayCycleSpec {
  schedule: readonly { phase: DayPhase; from: number; to: number; minutes: number }[];  // hours; Pine: day 6→18 over 20 min, night 18→30 over 4 min
  start: number | { setting: 'time' };        // the start hour, or Settings ▸ Time of day
  keys: DayKeys;                              // keyframes as data, keyed by 'phase' (Pine, Driftwood) or 'elevation' (Nalati)
  sun: { maxElevation: number; azimuthOffset: number } | { path: (p: number, out: Vector3) => Vector3 };   // Pine: pineSunAt / pineMoonAt (PineDayNight.ts:132-141), exact
  fixed: Record<'midday' | 'golden' | 'sunset' | 'night', number>;   // Settings picks (Pine: FIXED_PHASE)
  presets: Record<'dawn' | 'noon' | 'dusk' | 'night', number>;      // Explore's light presets
}
export interface DayCycle {
  readonly hour: number; readonly phase: number; readonly dayPhase: DayPhase;
  readonly night: number; readonly dusk: number; readonly dawn: number; readonly lamps: number;
  readonly body: 'sun' | 'moon'; readonly sunDir: Vector3;
  key<T>(out: T): T;                          // the interpolated keyframe for now
  setTime(t: TimePick): void; pin(p: LightPreset | null): void; set(hourOrPhase: number): Promise<void>;
  scale: number; paused: boolean;
}
```

- Pine's numbers: cycle 24 min (`?clock=` s stays a harness param), day `[0, 20/24)`, `PINE_PHASES` (:52), the
  presets `P` (:84-120) as `shard:look/dayKeys.ts`, `pineNightAt` (:142) as the `night` curve, `lamps`, `dusk`, `dawn`
  as today. `?tod=` stays a harness param.
- **The look is the shard's.** `DayCycle.key()` gives the interpolated keyframe; applying it to the lights, fog, hemi,
  disc, clouds and far haze is the engine `SkyRig.apply` for the fields every shard shares (sun direction / colour /
  intensity in 0.25° shadow steps, hemi, fog colour and densities, the sun disc), and the shard's `backdrop` for its own
  (Pine: the two-key dome blend, `uMix`, rotations, gains, grey, the IBL refresh every 2 s and its phone-stepped
  version when `tiers.phone.envSteps`). `PineTargets.cloud` / `.far` go to the backdrop too.
- Driftwood's `DayNight` and Nalati's `DayClock` become `DayCycle` instances with their own schedules (Driftwood:
  48 min, day `[0, 20/24)`, `FIXED_PHASE`; Nalati: `DEFAULT_SCHEDULE`, elevation keys, `clockSpeed`); their
  keyframe application stays in their current files until S3.2 / S4.3. `WorldClock.ts` is deleted; `Minimap.ts:306`
  and `ModelExplorer.ts:242` read `app.world.dayCycle`. Parity on both: identical (13-lead-resolutions 05/06#13).

**B. `Weather`** (`src/engine/world/weather.ts`; replaces `PineWeather` and the state machine of Nalati's `Weather`):

```ts
export interface WeatherProfile {
  states: readonly string[]; next: Record<string, string>;
  length: Record<string, readonly [number, number]>; firstLength?: Record<string, readonly [number, number]>;
  soak: number; dry: number;                                  // seconds (Pine: SOAK_S 50, DRY_S 150)
  numbers: (state: string, t01: number, prev: WeatherNumbers) => WeatherNumbers;   // overcast, rain, wet, wind, fog, …
  modes: Record<string, { hold?: string; at?: number } | 'none'>;                    // Pine: live | clear | fog | rain
  fog?: (clock: DayCycle) => number;                          // Pine: dawnFogAt(phase) (PineWeather.ts:39)
}
export class Weather { constructor(p: WeatherProfile, rng: Rng); update(dt: number, clock: DayCycle | null): void; setMode(m: string, at?: number): void; force(s: string, at?: number): void; hold: boolean; readonly state: string; readonly n: WeatherNumbers; onPhase(fn, scope): void }
```

- Pine's profile: clear 15–25 min → overcast 75–105 s → rain 3–6 min → clearing 70–100 s, the first clear 7–12 min,
  the dawn fog from the day cycle, seeded from `app.rng.stream('gameplay').fork('weather')` with today's seed
  (`SEED`, `weather.ts:84`) so a seeded run is repeatable and identical to today.
- Nalati's storm (`world/Weather.ts`) becomes `class SteppeStorm extends Weather` with its profile and its lightning
  logic (telegraph, strike, `LightningWorld`, `getLow`, 60 damage via `combat.hit` tagged `env.lightning`), staying at
  its path until S3.1 moves it into Nalati's folder. Its `ask('weather.damage')` (01 §17) is answered there.
- **FX**: the rain curtain (`PineWeatherFX.buildRain` ≈ `WeatherFX.buildRain`) becomes `#kit/weather/rainCurtain.ts`
  with an optional cover map (Pine passes its crowns + roofs + cave box; Nalati passes none). Each shard's program
  source stays byte-identical (the cover code behind a define). Pine's puddles, splashes and lens drops stay Pine's;
  Nalati's deck, curtains, bolt, smoke, puddles and rainbow stay Nalati's (rule of two; 13-lead-resolutions 05/06#11).
- Pine's wiring (`weather.ts`) keeps every number: the sky `mod` (overcast, fogDist `1 + fog·(2 + 26·og) + 0.4·haze`,
  fogHeight, mist), the fog floor and falloff, the veil, the mist opacity, `uWet` (0 in a practice room), the rain
  rings, the wind boost, the ambience's rain, the herds' shelter, the Ghost Stag's fog bank.
- The Debug row `weather` (engine, shown when `uses` has `weather`) drives `Weather.setMode`.

**C. Files touched in S2.4:** `src/world/PineDayNight.ts`, `PineWeather.ts`, `PineWeatherFX.ts`,
`pinehollow/weather.ts`, `world/Sky.ts` (`setupPine`, `pine`, `attachPost`, `lamps`, update), `core/Game.ts:369`,
`world/DayNight.ts`, `world/DayClock.ts`, `world/WorldClock.ts`, `world/Weather.ts`, `world/WeatherFX.ts`,
`nalati/weather.ts` (constructs the engine classes), `world/Particles.ts:106`, `explore/MiniMap.ts:131`,
`ui/Minimap.ts:306`, `explore/ModelExplorer.ts:242`, `main.ts:506-514, 1134-1135`, and the Pine files reading
`sky.pine`, each moved to `app.world.dayCycle` (or to Pine's own backdrop where it touches the dome):
`pinehollow/index.ts:94` (dusk / night), `audioWiring.ts:103`, `life/index.ts:722`, `weather.ts:81`,
`quest/index.ts:281` (night), `:444-466` and `:537-541` (the porch fast-forward: writes the phase every frame, then
`setPhase`) → `dayCycle.set()` with the same easing, `:580-581` (the dev beats' `setPhase`), `antlerKing.ts:573`
(the sky dome's material → `rt.backdrop.dome`), `:652` (`setPhase(PINE_PHASES.night)` → `dayCycle.set(night)`).
`DayCycle.set` stays async (it waits for the two sky keys to decode, `PineDayNight.ts:326-335`) so the King's intro and
the porch hand-off behave as today.

**Tests:** `test/engine/day-cycle.test.ts` (Pine, Driftwood and Nalati fixtures: hour, phase, night, dusk, dawn,
lamps and the sun direction over a whole day equal today's classes to 1e-9), `test/engine/weather.test.ts` (Pine's
seeded sequence of states and lengths for 3 simulated hours equals `PineWeather`'s; Nalati's likewise).

**Done when:** the harness's Pine poses at the pinned `time` and `weather` are identical; a 3-minute capture-mode run
at 60× clock speed produces the same sky key sequence; `WorldClock.ts`, `PineDayNight.ts`, `PineWeather.ts` are gone.

### 6.5 S2.5 — the quest runtime and the starter effects (the shard side)

1. Pine's quest (`quest/index.ts`: the Warden's Hollow line, `beats.ts`, `stagLead.ts`, `rides.ts`, `hollowLog.ts`,
   `tokenShelf.ts`, `wardensHollow.ts`) runs on the engine quest runtime (today's `game/quest/core.ts`, generalised:
   steps, flags per shard in SaveStore key `flags`, `quest.step` events). Its hand-rolled step bookkeeping around
   `core.ts` goes (D10).
2. The contract board (`contracts.ts`, SaveStore key `lodge`) and the trades (`trades.ts`) are quest content rows.
3. The NPC rig (`npcRig.ts`) moves to `#kit/npc/` as the seed rig; Pine's NPCs (`npcModels.ts`) are rows on it.
4. The kit's starter effects (poison, burn, bleed, slow, stun; 09-combat-ai) land here; Pine uses `effect.stun` for
   the roar and the stomp (S2.3) and the finishes as permanent effects (09-combat-ai).

**Done when:** the harness's quest script (`?quest=ranger|pond|ridge|zip|den|stag|king|dawn|done` beats, driven
through `window.__wildshard`) reaches the same flags at the same beats.

### 6.6 S2.6 — the tick-rate scheduler

1. `src/engine/app/scheduler.ts` implements 01 §12 with decision 85's defaults (13-lead-resolutions 09#4), for `ai`
   and `npc` alike: **near** 0–60 m brain 20 Hz + body every frame (30 Hz phone, 60 desktop); **mid** 60–160 m brain
   10 Hz + body every 2nd frame; **far** 160 m+ paused (brain and body). `fx`: 30 Hz near, paused from 120 m;
   `weather`: 10 Hz. `brainDue(id, actor)` / `bodyDue(id, actor)` compare the distance to the player (not the free
   camera: the AI is the player's, E125), accumulate each subject's `dt` since its last tick and hand it to the system.
   **Interrupts** in every band: `scheduler.interrupt(actor, 'hit' | 'target.attack' | 'target.dodge' | 'lost.sight')`
   re-thinks that brain the same frame. **Pinned** (never paused): an active boss or elite (the Antler King, Pine's four
   elites while engaged) and quest actors (`scheduler.pin`). **Strike phases** (wind-up → active → recover) run on the
   body clock, never the brain tick. Until this row every brain keeps today's 10 Hz (parity).
2. **Who declares a tick in S2.6:** the creature runtime's think pass (per animal: `AnimalManager.update`'s AI half,
   `AnimalManager.ts:680-751`, split from its drawing half, which stays every frame), Pine's `shard.pine.elites` and
   `shard.pine.king` (`ai`), `shard.pine.npc` (`npc`), `shard.pine.life` (`fx`), `shard.pine.weather.state`
   (`weather`). The weather's per-frame half (uniforms, the rain around the camera, the stag's fog bank) stays every
   frame, and the stag-fog lerp (`weather.ts:152`, 0.2 per frame) becomes `1 − 0.8^(dt·60)` so it moves the same.
   Nalati's own brains declare theirs at S3.x, Driftwood's `Enemies` at S4.2.
3. Pine's manifest may override a rate in `tiers`; it overrides none.
4. **Pine's derived budgets** (R1-14; M2 is Pine's milestone). The gate derives Pine's per-pose numbers from the
   budget formula (S1.6) at its three harness poses; until this row Pine's check used its F2-baseline ceilings. A pose
   over its derived number keeps its current worst as a ceiling in `lint/ratchet.json` (may only go down), with the
   derived number printed as its target (the desktop's 8.3 M tris and 1,377 GPU MB, budget-design §6.4).

**Tests:** `test/engine/scheduler.test.ts` (the three bands, distances, accumulated dt, paused beyond 160 m, an
interrupt re-thinks the same frame, a pinned actor never pauses, a strike's phases advance on the body clock).
**Done when:** the harness's near-player fights (the elites, the King, a boar charge) are identical; the creatures
board shows the herds' before / after (10 Hz everywhere → 20 Hz near, 10 Hz mid with the body every 2nd frame, still
past 160 m), and Driftwood's far boars and bears with them (13-lead-resolutions 05/06#15); the gate prints Pine's
derived numbers and enforces its ceilings (R1-14).

## 7. (f) Bugs fixed inline in this phase (each with a test)

| # | Bug | Where | Fix, row | Test |
|---|---|---|---|---|
| §7.2 | `canReach` runs only on melee shards: Pine's boar / bear charges, `c.hurt`, `LaneCharge`, the elites and the King hit through walls | `AnimalManager.ts:435, 944, 1020`; `pinehollow/ctx.ts:79` | the runtime's `canReach` on every shard (S2.3) | a charge at a cabin wall does not land (`test/damage-pipeline.test.ts`) |
| §7.6 | `ws.elites.v1` is one global store for Nalati and Pine | `game/Elite.ts` | SaveStore key `elites`, scope shard (S2.3) | the save round-trip keeps Pine's and Nalati's apart |
| P1 | Pine's clock is outside `WorldClock` ("Pine Hollow has no clock", `WorldClock.ts:12`): the Model Explorer hides its light presets on Pine (`ModelExplorer.ts:342`) and the minimap has no day glyph there | `WorldClock.ts`, `main.ts:511-513` | one `DayCycle` (S2.4) | the Model Explorer's preset row shows on Pine; `pin('dusk')` moves Pine's sun |
| P2 | The skin drop's toss angle uses `Math.random()` (a gameplay roll outside the seeded RNG) | `main.ts:771` | `app.rng.stream('loot')` (S2.2) | seeded drops land at the same spot twice |

## 8. (g) Parity expectations

**Identical** (`scripts/parity.mjs --export=<sha> --shards=pine-hollow --tiers=phone` on every commit, `--tiers=phone,desktop`
before a push; all four shards on engine edits; R1-10): the
systems list (new ids per 03's id map), the registry (sorted ids, categories, surfaces, colliders; 03 compares it
sorted: the plugin adds its pieces in today's order, but the engine's own pieces may now register in a different boot
stage, 01 §8), the scene census, programs
(byte-identical shader sources: the edge haze and the wet surfaces stay Pine-only), draws and triangles at the three
harness poses at pinned time / weather, the walk and `--trails` routes (0 stuck), a shot to a kill with each weapon,
the lever pickup, the scripted elite and King encounters, the quest beats, the audio beds and score slots, the HUD
slots, the save keys (renamed by F10, then identical).

**Expected to differ.** Each row is a pending item (05 §8, R1-13, R2-18): the change commit adds it to
`reviews/pending.json` with `expect: null`; `parity --pending-fill=<ids> --export=<sha>` on that commit's SHA fills
`expect` per tier in a follow-up commit; the gate shows it yellow; and only after Jake's OK at the milestone does
`parity --accept=<ids>` re-baseline it and remove the entry. Otherwise it is fixed or reverted before the pin moves.

| Difference | Row | Where it is shown |
|---|---|---|
| Charges and elite / King strikes no longer land through walls | S2.3 | the creatures board |
| Creatures think at 20 Hz near (0–60 m), 10 Hz mid (60–160 m, body every 2nd frame) and hold still past 160 m, instead of 10 Hz everywhere (Pine and Driftwood, whose herds share the runtime) | S2.6 | the creatures board (clips from the fire lookout) |
| The starter effects (stun on the roar and stomp now the kit effect, same length) | S2.5 | the creatures board (tuning) |
| The Model Explorer's light presets on Pine | S2.4 (P1) | M2 summary |
| Weather phase changes up to 0.1 s later (the 10 Hz state tick) | S2.6 | M2 summary (not visible) |
| The crossbow / rifle texture worker, the lever GLB's fetch and the lever model's build start in `level.kit`, after the world build, instead of beside it (`main.ts:251-252`; R3-03, R4-06): the boot steps' order and timings only (the load time is in the gate's `boot` fields) | S2.2 | M2 summary (not visible) |
| Any ranged-family spot a profile could not match | S2.2 | the weapons board's ranged additions (12-process §6) |

## 9. (h) Milestone M2

| Step | Detail |
|---|---|
| Flow | As M1 (05 §9, R1-15): gate green on the candidate → boards to Jake → Jake OKs the board items (or they are fixed / reverted) → the fix and revert commits land first → **`parity --accept=<ids>` runs last**, re-recording the OKed ones over 3 runs (R3-14) → the pin moves to **the newest `gpu-gate`-green SHA after that step, with `reviews/pending.json` empty** (R2-27) → deploy → Jake plays it live → **Jake's go starts S3**. The go is not a ship gate (R1-15); a "no" holds S3 (Decision asked) |
| Gate | `gpu-gate` green on the candidate SHA: Nine Dragon's and Pine Hollow's budget checks on their derived budgets (S1.6, S2.6), Nalati's and Driftwood's on their F2-baseline ceilings (R1-14); parity green on 4 shards; `pnpm test` green with the ratchets lower than at M1 |
| Pin | After step 3 (Jake's OKs, then any fix or revert commits, then the `--accept` commit last, R3-14), with `reviews/pending.json` empty (R1-13, R1-15): the pin moves to the newest SHA after step 3 whose `gpu-gate` is green (R2-27), never to the pre-accept candidate: `node scripts/deploy-pin.mjs set <that sha> --milestone M2 --go "<where>"` writes `.github/deploy-pin.json` (committed alone; 13-lead-resolutions G7), then `gh workflow run deploy`, confirm `version.json`, record the build id in E357 (12-process §3, 03 §13.4) |
| Summary | What moved (§1), lines deleted (Longbow's fork, `feel.ts`, `WorldClock.ts`, the Pine branches of §2), ratchets before / after, Pine's derived budgets and ceilings (desktop: 8.3 M tris and 1,377 GPU MB as ceilings, budget-design §6.4), the scheduler's CPU saving at the lookout pose |
| Boards | **Creatures** (the wall fixes, the tick rates, the starter effects) and the **weapons** board's ranged additions. iPhone portrait, clips ≤ 10 s, from the harness's capture of the candidate SHA (R1-15). Each item stays pending until Jake OKs it (re-baselined) or it is fixed / reverted (R1-13) |
| Jake plays | Pine Hollow **live** on the pinned build, after the deploy (R1-15): a hunt with the crossbow, the lever-action from cabin 1, an elite, a rain shower (Debug ▸ Weather ▸ Rain), the dawn fog, the Antler King if he wants. To play before the pin moves: a Vercel preview deployment of the candidate (`vercel deploy --prebuilt`, which keeps `/api`), not `release-url.sh` (R1-15) |
| Milestone checks | Recorded in E357 by the lead; **no physical-iPhone reading** (decision 98, R3-11′). **Memory** (12 §3, §8): the memory evidence is the nightly Simulator memory run (03 §14.1) plus the budgets (the Gate row): **a reading of the pin's own SHA** (or of a runtime-equal ancestor; R4-15, 03 §13.2: the lead runs `scripts/gpu-perf/nightly.sh --memory-only --sha=<sha>` when there is none) reads Pine Hollow at ≤ 1.8 GB loading and ≤ 1.0 GB in world (decimal), with `gpu-perf/memory` `success` on it. Over a limit means **stop the line** (R1-53): the pin doesn't move (`deploy-pin.mjs set` refuses a SHA without that `success`), the next commit fixes or reverts, and S3 waits. The accepted risk, stated in 12 §8: an iPhone-only memory death (the E271 class) can reach Jake's phone undetected |
| Decision asked | Two AskUserQuestions (R1-15): the summary + boards first (each item OK / fix / revert), whose OKs move the pin; then, after he has played it live, "Pine Hollow M2: go?" (recommended: yes). **A "no"** (R2-29, 12 §3): S3 waits. Jake's reasons become rows in this milestone, each fixed on main, gated, boarded if visible, and then the go is asked again. The pinned build stays live unless it is broken (then Rollback) |
| Rollback | If the pinned M2 build breaks on Jake's phone: `node scripts/deploy-pin.mjs rollback <sha> --go "<Jake's words>"` to a SHA in the pin history (M1 or earlier), with no gate check (03 §13.2). M0 is past F10, so it can't read the v2 saves; this is accepted (the saves reset is OK'd, decision 13) and stated on the rollback (R1-16) |
| Reopening | On Jake's go, `src/shards/pine-hollow/` reopens to content agents (12-process §2). The lock check is `scripts/check-lock.mjs`, the `commit-msg` hook F0 builds (R1-09): a commit without the lead's `E357-Lead: yes` trailer passes only when every path is on the reopened-shard allowlist, **the one definition in 02 F0 step 5** (R2-19), referenced here and not copied. Pine Hollow's extra asset folders are its manifest's `assetGlobs` (§3, R3-09), which the lead's `lock.json`-only commit on Jake's go copies into `.github/lock.json` `reopened` (02 F0, 12 §2). Generated files are built, not committed (R1-11), except the shard's own `ktx2.generated.ts`, which needs `basisu` and is committed by its lane (R2-04). From then on Pine Hollow's lane owns its baselines: a content commit re-records them in a follow-up commit that names the SHA they were recorded on (`parity --rebaseline=pine-hollow --export=<sha>`; R1-12, R2-25), and every other shard must stay identical, the cross-shard proof. |

## 10. Questions for the lead

Answered in [13-lead-resolutions.md](13-lead-resolutions.md) (the 05 / 06 table, the still-open table and G16 / G17);
none is open, and the body above follows each answer.

1. **Manifest fields not in 01 §6.** **Resolved → 13-lead-resolutions 05/06#1** for the `ChunkDef` fields: `treeCount`,
   `assets`, `trees`, `forest`, `pondClip`, `look`, `horizon`, `pois`, `spawns` (was `fauna`) are carried as data;
   `dayCycle` / `weather` are 01 §6's data for the opt-in mechanisms. This spec's sub-fields: **Resolved →
   13-lead-resolutions still-open 05#1** ("all are declared manifest fields"): `kitLook` and `world.blenderArea` are on
   01 §6's declared list by name; by the same answer `atmosphere.edgeHaze` / `wetSurfaces`, `loadout.grants[].by` /
   `loadout.ammo`, `bag.pack.keeps` and `boot.bytes` / `lateReads` / `bakedUnread` are declared fields too, typed in
   `#game/shard/manifest.ts` at the row that first uses each (S2.1, S2.2). §3 follows.
2. **Who deletes `PINE_HOLLOW_PHONE`.** **Resolved → 13-lead-resolutions 05/06#10:** S2.1 deletes it (with
   `pinePhoneCuts` and `applyShardTier`); X7 deletes whatever shard-named knobs are left.
3. **Weather FX in the kit.** **Resolved → 13-lead-resolutions 05/06#11:** only the rain curtain goes to
   `#kit/weather/`; the puddles stay per shard (two techniques) and lightning is Nalati's (S2.4).
4. **Shard-declared option keys** (`pineScore`, `pineLife`, `cragView`). **Resolved → 13-lead-resolutions 05/06#12:**
   the shard declares its own keys through `ctx.debugRow`; AGENTS.md's Settings.ts rule is rewritten in Z2 (11).
5. **S2.4's reach.** **Resolved → 13-lead-resolutions 05/06#13:** S2.4 also swaps Driftwood's and Nalati's clocks and
   Nalati's storm, one implementation at once, parity identical on all three shards.
6. **The kit NPC rig (D9).** **Resolved → 13-lead-resolutions 05/06#14:** `#kit/npc` is seeded from Pine's rig in
   S2.5; Nalati's camp people join in S3.3, Driftwood's Castaway and Trader in S4.3.
7. **Scheduler scope.** **Resolved → 13-lead-resolutions 05/06#15:** S2.6 also changes Driftwood's far boars and bears
   (decision 85's bands), shown on M2's creatures board (S2.6, §8).
