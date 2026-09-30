# GAME-NORMALIZATION v2 · 08 — Driftwood Isle becomes a plugin, and `main.ts` becomes the composition root + `engine/boot.ts` (S4.1–S4.4, milestone M4)

Driftwood Isle (`driftwood-isle`) is built inline in `main.ts`: ~15 `isOcean ? new X(…) : null` builders in the
`edge` step (`main.ts:289-408`), then the rope bridge's chain, the Blender island, the enemies, the shrine hum, the
island SFX and ambience, the adventure, the places, the keepsakes, the loot, the first minutes and a dozen calls in
the `'main'` updater. Its look branches in `Game.ts`, `Sky.ts`, `Terrain.ts` and `stylize.ts`, and ~12k lines of its
code live in engine folders. This spec moves all of it behind a manifest + plugin on
[01-architecture.md](01-architecture.md) (S4.1), puts the crab, monkey, sailor and the Drowned Captain on the AI and
boss runtimes with his fight unchanged (S4.2), moves the adventure, keepsakes, first minutes, shrine hum, island audio
and the toon look (S4.3), and then turns what is left of `main.ts` into `src/engine/boot.ts` of at most 150 lines, leaving `src/main.ts` as the
≤ 20-line composition root (01 §0), with every shard-branch ratchet at 0 (S4.4). It ends at M4.

Species, strikes, the Captain's numbers and the loot rows are in [09-combat-ai.md](09-combat-ai.md) (S1–S8, §5.4
*The Drowned Captain*, §5.6 `spawn.driftwood.*` / `loot.driftwood.*`); this file owns the shard side and every engine
line that branches on Driftwood, plus `main.ts`'s last lines.

## 0. How to read this spec

[05-nine-dragon.md](05-nine-dragon.md) §0 applies unchanged: line references are at `3f83fd2e` (no `src/` change up to
`0b6aa045`), every row has a **grep key**, paths after F6 are `src/engine/…` / `src/game/…` / `src/kit/…`, and
`shard:x` means `src/shards/driftwood-isle/x`. `src/main.ts` keeps its path until S4.4. Every commit (12-process §5,
R1-10): a pathspec commit `E357 S4.<n>: …`; on it, `node scripts/parity.mjs --export=HEAD --shards=<changed>
--tiers=phone` green against the lane's baselines (all four shards on an engine edit) and `pnpm test` green; before
every push, `node scripts/parity.mjs --export=HEAD --shards=all --tiers=phone,desktop` green, then
`scripts/push-main.sh`. A subagent runs only the per-commit phone lane for its shard (< 4 min); anything longer is
"queued: <command>" for the lead.

**At S4 start** S1–S3 are done: the plugin verbs, staged boot, tier resolution, the combat core and all five weapon
families, player health in the engine, the input service with the `grapple`, `crossbow.bolts`, `ride`, `ride.break`
and `stealth` contexts, the AI runtime (HFSM, `StrikeRunner`, the director, `BossBrain`, `EliteBrain`, `GroupBrain`,
weighted tables), `DayCycle` (Driftwood's `DayNight` clock is a `DayCycle` instance since S2.4, its keyframe
application still in `DayNight.ts`), `Weather`, the quest runtime, the scheduler (decision 85's bands: `ai` brain 20 Hz near,
10 Hz from 60 m, paused from 160 m, with interrupts), `#kit/npc/npcRig.ts` (Pine's rig + Nalati's camp people), the finished audio
engine (`VoicePool`, `AmbienceZones`, one cue routing, the `Audio.ts` split) with Driftwood's leftovers parked in
`src/engine/audio/legacyIsland.ts` (07 §6.5), `app.world.wind`, `app.player.mountedOn`, the creature look registry,
`LookStrategy.{compose, fog, terrainPainter, backdrop}` (07 §6.2).

**Order inside S4:** S4.1 → S4.2 → S4.3 → S4.4. S4.2 (`shard:species/**`, `shard:combat/**`, `shard:quest/finale.ts`)
and S4.3's look half (`src/engine/render/**`, `shard:look/**`) may run as two subagent lanes after S4.1 lands; S4.3's
adventure / audio half and S4.4 are the lead's (they touch `main.ts`, which one agent edits at a time).

## 1. Inventory (a): every file of Driftwood's code today and where it goes

### 1.1 The def and `src/chunks/driftwood-isle/` (31 files, 5,491 lines)

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `src/chunks/driftwood-isle.ts` (281) | `shard:manifest.ts` (data, §3) + `shard:layout.ts` (`OCEAN`, `PIER`, `JETTIES`, `PATHS`, `PIER_PATH_BED`, `ISLAND`, `PLATEAU`, `HUT`, `HEADLAND`, `COVE`, `WRECK`, `SHRINE`, `GULLY`, `BRIDGE`, `LOOKOUT`, `SPAWN`, `BOAT_MOOR`, `PIER_PENNANT_AT`, `PRACTICE_CRAB`, `ISLAND_BOARS`: `:18-86`) + `shard:world/terrain.ts` (`TERRAIN` = today's `buildTerrain(SEED, { oceanLevel, landscape, graded, trails, cabinSites })` `:152-241`, moved verbatim) | F6 rename; S4.1 split | The manifest imports `world/terrain.ts` and `layout.ts` (node-safe: the bakers read them today) |
| `firstMinutes.ts` (67) | `shard:onboarding/firstMinutes.ts` | S4.3 | `installFirstMinutes` → `ctx.system('shard.driftwood.firstMinutes')` + `ctx.on('ai.windup', …)` in place of the hand-chained `onWindup` (`main.ts:984`) |
| `fpArms.ts` (201) | `shard:vm/castawayArms.ts` | S4.1 | The castaway rig: the wooden and iron swords' arms and the swimming hands. `ChunkDef.sword` (`driftwood-isle.ts:98-105`) → the `weapon.sword` / `weapon.sword-iron` rows' `viewmodel` factory in Driftwood's loadout (child rows of the kit's, 09 §1.5) + `manifest.swimArms` (Q1) |
| `models/*.ts` (27 files, 4,947 lines: `boat` 285, `captainHat` 108, `cargo` 99, `cove` 106, `creatures` 34, `driftLog` 44, `gear` 38, `hibiscusBush` 201, `hut` 387, `lookout` 395, `palm` 184, `people` 22, `pier` 341, `reef` 237, `reefFish` 33, `reefRock` 33, `ropeBridge` 294, `sailclothCape` 96, `seaGlassChime` 121, `shipwreck` 802, `shoreBoulder` 35, `shrine` 526, `smallRock` 35, `trader` 125, `trailside` 167, `trophyPlaques` 245, `zipline` 117) | same names under `shard:models/` | F6 | Content on the model contract |
| `roster.ts` (32) | `shard:roster.ts` | F6 | The `roster` thunk |
| `world/places.ts` (81) | `shard:world/places.ts` | F6 | `placeDriftwoodPlaces` (the Sets), called by the plugin |
| `src/chunks/thumbs/driftwood-isle*.jpg` | `shard:thumbs/` | F6 | `manifest.card` |

### 1.2 Driftwood code in engine folders

| Today | Lines | Destination | When | Why |
|---|---|---|---|---|
| `src/world/Hut.ts` (79), `Pier.ts` (145), `Palms.ts` (105), `Boat.ts` (181), `Boulders.ts` (102), `Bushes.ts` (82), `Lookout.ts` (83), `Wreck.ts` (235), `Shrine.ts` (148), `RopeBridge.ts` (74), `Seabed.ts` (176), `Trailside.ts` (333), `Cove.ts` (481), `Waterfall.ts` (334, imported by `Cove.ts` only), `Gulls.ts` (603), `GroundCover.ts` (830), `coverTint.ts` (165) | 4,136 | `shard:world/…` (same names, lower-case first letter) | S4.1 | Only `main.ts:289-408` builds them (and Driftwood's models / quest import them) |
| `src/world/Zipline.ts` | 143 | `shard:world/zipline.ts` | S4.3 | Built by `Adventure.ts` only |
| `src/world/Ocean.ts` (282), `waves.ts` (90) | 372 | `Ocean.ts` → `shard:world/ocean.ts` (a `WaterBody`); `waves.ts` → `src/engine/world/water/waves.ts` | S4.1 | `waveHeight` is read by `Boat.ts`, `Enemies.ts`, `Player.ts:549` (swim bob) through `app.world.water.surfaceAt(x, z)` (§6.1 step 4); the Gerstner function is a generic water primitive |
| `src/world/BlenderIsland.ts` (618), `blenderArea.ts` (57) | 675 | `shard:world/blenderIsland.ts`; `blenderArea.ts`'s `DRIFTWOOD` entry → `manifest.world.blenderArea`, `MODEL_DIRS` → `manifest.world.blenderModels` | S4.1 | `blenderArea.ts:30, 47` (Pine's entry moved at S2.1) |
| `src/world/HorizonMatte.ts:53` | 1 | `manifest.horizon.matte` | S4.1 | Data (Pine's moved at S2.1) |
| `src/world/DayNight.ts` | 242 | the clock is the engine `DayCycle` since S2.4; `KEYS`, the keyframe application (lights, fog, toon uniforms, sky palette, disc, planet, shadow-step crossfade) → `shard:look/dayKeys.ts` + the backdrop's `apply(key)` | S4.3 | 06 §6.4 A: "their keyframe application stays in their current files until … S4.3" |
| `src/world/StylizedSky.ts` (188), `stylize.ts` (216) | 404 | `shard:look/stylizedSky.ts` (the backdrop), `shard:look/toon.ts` (the toon lighting + ramp fog) | S4.3 | §6.3 B |
| `src/world/lowpolyKit.ts` | 557 | `src/engine/world/geometry/lowpolyKit.ts` | F6; X5 | Imported by the engine's `interact/Interactables.ts`, `interact/models.ts`, `models/interact.ts`, Pine's `tokenShelf.ts` and Driftwood's builders: 2+ users. X5 merges it into the one geometry kit |
| `src/world/rockKit.ts` | 352 | `src/engine/world/rockKit.ts` (04: rule F, a geometry primitive with no shard data) | F6 | Used only by Driftwood today (`GroundCover`, `Wreck`, `Cove`, three rock models); 04's import analysis keeps it in the engine (13-lead-resolutions 07/08#10), and X5 folds its generic primitives into the engine geometry toolkit |
| `src/world/driftwood.ts` (83, `addDriftLog`) | 83 | `shard:look/driftLog.ts` | S4.1 | Driftwood's log painter |
| `src/world/interact/driftwood.ts` | 84 | `shard:quest/interact.ts` | S4.3 | The interactables table (data) |
| `src/world/interact/Interactables.ts` (753), `flags.ts` (76), `models.ts` (290), `types.ts` (146) | — | `src/engine/world/interact/` | F6 | 2+ shards (Pine's quest, Nalati's adventure). `flags.ts`'s `ws.flags.v1` is SaveStore key `flags` (shard) since F10 |
| `src/world/interact/validate.ts` | 67 | `src/engine/world/interact/validate.ts` (kept) | F7 check; F6 move | On F7's one dead list for review (02 F7 step 3; 13-lead-resolutions still-open 08#8). The review keeps it: `test/interact.test.ts:5` and `test/pine-quest.test.ts:6` import `validateTable`, the pure validator of Driftwood's and Pine's interactable tables, so it is live and follows 04's row (engine, rule F) |
| `src/entities/Enemies.ts` | 374 | `shard:creatures/enemies.ts` | S4.2 | The crab sites, monkey troops, coconuts, the sailor, the practice crab: spawn tables + the coconut projectile (§6.2) |
| `src/entities/species/crab.ts` (307), `monkey.ts` (366), `sailor.ts` (371), `captain.ts` (332), `captainMesh.ts` (142) | 1,518 | `shard:species/…` | S4.2 | One shard each |
| `src/entities/lowpoly.ts` | 263 | `shard:look/lowpolyCreatures.ts`, registered with `ctx.rows.creatureLook('toon', …)` (01 §7, §19; 13-lead-resolutions still-open 07#10) | S4.2 | `AnimalFactory.ts:305-354`'s `lowPoly` path is Driftwood's look of the kit boar / bear, chosen by `manifest.kitLook: 'toon'`. `deer.ts`, `elk.ts`, `boar.ts`, `bear.ts` import it for their low-poly builders: those builder functions move with it and the species' `SpeciesLook` rows (rig + mesh, registered apart from the simulation `SpeciesRow`s, R1-27) reference them by the look id |
| `src/entities/fightRules.ts` | 128 | `src/engine/ai/director.ts` (S2.3) | S2.3 | The director is engine (09 §5.5); `ChunkDef.fightRules` → `manifest.fight.attackers: 2` |
| `src/entities/npc/Castaway.ts` (314), `Trader.ts` (261) | 575 | rows on `#kit/npc/npcRig.ts` in `shard:quest/people.ts` | S4.3 | The lead: *NPC rigs merge into `#kit/npc`*. §6.3 D |
| `src/world/faceHeads.ts` | 60 | `#kit/npc/faceHeads.ts` | S4.3 | Imported by `Castaway.ts` and `sailor.ts`; the face rig is an NPC-rig piece (Pine's rig can use it) |
| `src/audio/IslandAmbience.ts` (387), `IslandSfx.ts` (97), `ShrineHum.ts` (91), `Surface.ts` (54) | 629 | `shard:audio/ambience.ts` (an `AmbienceZones` profile), `shard:audio/sfx.ts` (the island voice table), `shard:audio/shrineHum.ts`, `shard:audio/surface.ts` | S4.3 | §6.3 C. `physics/surface.ts` imports `Surface`'s type: the type moves to `src/engine/audio/surface.ts` (`StepSurface` union extended by merging) |
| `src/engine/audio/legacyIsland.ts` (made by S3.5: the island bed, gulls, the island voice families) | — | deleted; its code → `shard:audio/` | S4.3 | 07 §6.5 A.2, E |
| `src/game/quest/Adventure.ts` (266), `Spine.ts` (98), `driftwood.ts` (97), `Finale.ts` (112), `Complete.ts` (162), `Ecology.ts` (90), `Feats.ts` (42), `gullGuide.ts` (89), `guards.ts` (15), `Places.ts` (33), `TraderStall.ts` (81) | 1,085 | `shard:quest/adventure.ts`, `spine.ts`, `line.ts`, `finale.ts`, `complete.ts`, `ecology.ts`, `feats.ts`, `gullGuide.ts`, `guards.ts`, `places.ts`, `trader.ts` | S4.3 (Finale's fight half at S4.2) | Driftwood's quest content on the quest runtime. The `ADVENTURES` registry and `installAdventure` / `hasAdventure` (`Adventure.ts:250-266`) are deleted. `Feats.ts`'s `ProgressSink` type (imported by `nalati/adventure.ts`) → `src/engine/quest/types.ts` first |
| `src/game/quest/QuestUI.ts` (186), `quest.ts` (151), `core.ts` (173) | — | `src/engine/quest/` (S2.5) | S2.5 | 2+ shards |
| `src/game/loot/keepsakes.ts` (235), `finds.ts` (69), `shop.ts` (73), `coins.ts` (38), `perks.ts` (43) | 458 | `shard:loot/keepsakes.ts`, `finds.ts`, `shop.ts` (the goods and prices), `coins.ts` (the `loot.driftwood.coins` rows, 09 §5.6); `perks.ts` → the effect rows (the boar-tusk dodge guard is `rule.dodge-guard`, the charms E-rows, 09 §2.2) | S4.3 | Driftwood's content |
| `src/game/loot/install.ts` (196), `Purse.ts` (65), `Owned.ts` (105), `Bounty.ts` (50), `CoinBurst.ts` (138), `store.ts` (21) | 575 | `#game/loot/` (the purse per shard, owned items, bounty, the coin burst and chip: decisions 74, 75); `store.ts` deleted (F10) | S4.3 | Mechanism: any shard with `manifest.loot.coins` gets it. `coinsOn(h.chunk)` (`install.ts:77`) reads the manifest |
| `src/game/LastPlace.ts` | 69 | `#game/respawn/lastPlace.ts` | S4.4 | Generic (places with points); today only Driftwood feeds it |
| `src/player/IronSword.ts` | 318 | `shard:loadout/ironSword.ts` (the pickup model and site) | S4.1 | The iron sword row is the kit's (09 §1.5); its pickup on the wreck is Driftwood's |
| `src/player/BodyShadow.ts` (148), `Cosmetics.ts` (119) | 267 | `#game/cosmetics/bodyShadow.ts`, `cosmetics.ts` | S4.3 | `ChunkDef.bodyShadow` → `manifest.bodyShadow: true`; a game-layer feature any shard may switch on |
| `src/ui/WindupWarn.ts` (112) | 112 | `src/engine/ai/windupWarn.ts` | S2.3 | On when the director is on (`manifest.fight.attackers` finite), as `chunk.fightRules !== undefined` today (`main.ts:861`) |
| `src/ui/ShopPanel.ts` (178), `CoinChip.ts` (67) | 245 | `#game/loot/ui/` | S4.3 | With the loot mechanism |
| `src/ui/FirstHints.ts` | 243 | `src/engine/ui/firstHints.ts` | S4.4 | Every shard's system; Driftwood feeds its triggers (`firstMinutes`) |
| `src/physics/ropeChain.ts` | 119 | `src/engine/physics/ropeChain.ts` | F6 | A physics primitive (the only code that imports Rapier stays `src/engine/physics/`); the bridge's chain spec is Driftwood's |
| `src/game/achievements.ts:83-100` (`DRIFTWOOD`) | ~17 | `shard:feats.ts`, `ctx.rows.feat` | S4.3 | Feats per shard |
| `src/game/Inventory.ts:44-…` (Driftwood's item rows) | — | `shard:items.ts`, `ctx.rows.item` | S4.3 | Items self-contained (decision 75) |
| `src/explore/img/*-driftwood-isle.webp` | — | `shard:explore/` | S4.1 | `manifest.explore.art` |
| `scripts/blender/driftwood-isle/**` | — | unchanged (the Blender sources); `targets.json` paths re-pointed by F6 | F6 | — |
| `public/assets/driftwood-*/**`, `public/assets/models/driftwood-*`, `public/assets/sfx/*` island families | — | **not moved** (TP §5) | — | — |

## 2. (b) Every engine line that branches on or wires Driftwood, and what replaces it

### 2.1 `src/main.ts`

| Line(s) | Grep key | Today | Replaced by |
|---|---|---|---|
| 10-37 (22 imports) | `import { Ocean }` … `import { installAdventure }` | the Driftwood builders and installers | the plugin's imports (§4) |
| 282 | `const sea = chunk.ocean, isOcean = sea !== undefined` | the gate | deleted: `sea` → `app.world.water.sea` (a `WaterBody` or null) where a generic reader needs the level |
| 294 | `const water = !isOcean && hasPond() ? new Water(sky, forest.trees).build() : null` | a pond only off the sea | `hasPond()` alone (Driftwood's terrain has no `pond`: identical); the pond is Pine's since S2.1 |
| 299-300 | `const ocean = isOcean ? new Ocean(sky).build() : null` | the sea | `buildOcean(ctx)` in the plugin's world build (§4); registers as the `sea` water body |
| 301-306 | `const pier = sea ? new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: sea.level + 1.2, landing: true, pennantAt: PIER_PENNANT_AT }).place(registry, 'pier')` / `player.position.y = y` | the pier; the player stands on its deck | the plugin, same arguments; the spawn height → `manifest.spawn.floor: 'registry'` (the engine's `toSpawn` asks the registry floor under the spawn: today's `pier.floorHeightAt`, `:593`) |
| 307-316 | `const boat = pier && sea ? new Boat(sky, { x: BOAT_MOOR.x, z: BOAT_MOOR.z, heading: 0, waterY: sea.level, moorTo: pier.mooringsFor(` | the moored boat, its ropes | the plugin |
| 317-322 | `const rockSpecs = isOcean ? Boulders.scatterShore(chunk.seed) : []` / `new Boulders(sky).place(rockSpecs, registry)` | shore boulders | the plugin |
| 323-327 | `const hut = isOcean ? new Hut(sky, HUT).place(registry) : null` | the hut | the plugin |
| 328-331 | `const lookout = isOcean ? new Lookout(sky, LOOKOUT).place(registry) : null` | the lookout | the plugin |
| 332-336 | `const wreck = isOcean ? new Wreck(sky, WRECK).place(registry) : null` | the wreck | the plugin |
| 337-342 | `const shrine = isOcean ? new Shrine(sky, SHRINE).place(registry) : null` | the ring shrine | the plugin |
| 343-346 | `if (sea) for (const [i, j] of JETTIES.entries()) { const jetty = new Pier(` | the three jetties `jetty-0..2` | the plugin |
| 347-350 | `const AVOID = [{ x: HUT.x` / `const bushes = isOcean ? new Bushes(sky).place(Bushes.scatterIsland(chunk.seed, undefined, AVOID), registry)` | hibiscus bushes | the plugin |
| 351-363 | `const gulls = pier && boat && rocks && sea ? new Gulls(sky).build({ perches: [` | gulls on posts, bollards, the boat, rocks, sand | the plugin |
| 364-368 | `const trailside = isOcean ? new Trailside(sky).build(Trailside.forIsland())` | fences, signposts, plank steps | the plugin |
| 369-373 | `const bridge = isOcean ? new RopeBridge(sky, BRIDGE).place(registry) : null` | the rope bridge | the plugin |
| 374-378 | `const seabed = isOcean ? new Seabed(sky).build(Seabed.scatterLagoon(chunk.seed, 360,` | coral, kelp, fish | the plugin |
| 379-381 | `const palmSpecs = isOcean ? Palms.scatterIsland(chunk.seed, undefined, AVOID) : []` | palm placement | the plugin |
| 382-388 | `const cove = isOcean ? new Cove(sky).place(registry, Cove.forIsland()) : null` / `cutTerrain(world.physics, cove.terrainCuts())` | Wreck Cove, the cascade, the sea-cave cut | the plugin (`cutTerrain` stays an engine physics verb) |
| 389-392 | `const palms = isOcean ? new Palms(sky).place(palmSpecs, registry) : null` | palms | the plugin |
| 393-395 | `const cover = sea ? new GroundCover(sky, { sea: sea.level, palms: palmSpecs }).build() : null` / `tintTerrain(world.terrain.mesh)` | ground cover near the player; the terrain tint | the plugin; system `shard.driftwood.cover` (`update`, reads `app.scene.viewer`) |
| 396 | `ocean?.foamAround(statics)` | foam rings round every pile, rock, hull | the plugin, over its own pieces' legacy boxes (after F11: over the registry pieces' colliders in the sea, same set: `test` compares the ring list) |
| 400-406 | `const matte = sea ? new HorizonMatte(sky, sea.level).build() : null` / `document.addEventListener('ws:ready', () => { setTimeout(() => { void matte.load(horizon.group); }, 250); }, { once: true })` | the painted 360° horizon, loaded after boot | the engine's `HorizonMatte` built from `manifest.horizon.matte` for any shard that has one (Pine since S2.1); the load on `app.ready` + 250 ms |
| 407-409 | `return { boundary, water, streams, ocean, pier, jetties, boat, palms, palmSpecs, cove, hut, lookout, wreck, shrine, bushes, gulls, bridge, seabed, horizon, rocks, cover, trailside }` | the dressing handle | `rt.world` in the plugin's runtime (`shard:runtime.ts`) |
| 410-412 | `const bridgeDeck = bridge ? new RopeChain(world.physics, bridge.chainSpec()) : null` / `game.onFixed('post', () => { bridgeDeck.capture(); })` | the jointed deck | the plugin: system `shard.driftwood.bridge.capture` (`fixed.post`); `bridge.setPoses(bridgeDeck, game.alpha)` (`:1131`) → system `shard.driftwood.bridge.pose` (`update`) |
| 419-427 | `const blenderIsland = isOcean ? await import('./world/BlenderIsland').then(({ BlenderIsland: B }) => B.install({` / `dressing.cover?.excludeArea(islandArea)` | the Blender spawn cove over the procedural one (the fallback on a load error) | the plugin, same order (after the dressing, before the `grass` key); system `shard.driftwood.blenderIsland` |
| 431, 444, 474 | `const bare = isOcean \|\| built !== undefined` / `if (isOcean \|\| painterly \|\| built !== undefined) return { cabins: null` / `if (isOcean) return null` | no carpet, cabins or props on the sea | gone: those steps are Pine's since S2.1 |
| 498-500 | `const enemies = isOcean ? new Enemies(animals, { scene: game.scene, sky, palms: palmSpecs, wreck, crabSites: cove?.crabSites ?? [], ...(chunk.slug === 'driftwood-isle' ? { practice: PRACTICE_CRAB } : {}) }).build() : null` | crabs, monkeys, the sailor, the practice crab | the spawn tables `spawn.driftwood.enemies` + `spawn.driftwood.practice` (S4.2) |
| 506-507 | `const dayNight = sky.dayNight` / `animals.enemyWorld.night = () => dayNight.night` | the sailor walks at night | `app.world.dayCycle.night` read by the sailor's brain (S2.4 already), line deleted |
| 512 | `dayNight instanceof DayNight ? dayNightClock(dayNight)` | Driftwood's clock behind WorldClock | gone at S2.4 |
| 517, 530-533 | `chunk.sword?.() ?? null` / `const { ironArms, swim: swimArms, ...ownSword } = shardSword ?? {}` / `chunk.weapon === 'sword' ? new Sword(` | the castaway arms for the two swords and the swimming hands | the `weapon.sword` / `weapon.sword-iron` rows' `viewmodel` (S1.2's mechanism, Driftwood's factory `castawayArms`), and `manifest.swimArms` for `Hands` (Q1) |
| 541 | `muzzleLight: !isOcean` | no AR-15 muzzle light on the island | gone: the AR-15 is not in Driftwood's loadout (E333); the row's `muzzleLight` field stays true |
| 545-549 | `const ironSword = chunk.weapon === 'sword' && !isNine ? new Sword(…, { blade: 'iron'` / `isOcean ? { baseName: 'Wooden sword' }` | the iron sword slot; the Bag name | `manifest.loadout` (§3); names from the rows (09 §1.5) |
| 590 | `const shrineHum = shrine ? new ShrineHum(audio, music, { x: SHRINE.x, y: heightAt(SHRINE.x, SHRINE.z) + 2.5, z: SHRINE.z })` | the shrine's hum and score duck | the plugin (S4.3), system `shard.driftwood.shrineHum` |
| 593 | `if (pier) { const y = pier.floorHeightAt(player.position.x, player.position.z); if (y !== undefined) player.position.y = y; }` | spawn on the deck | `manifest.spawn.floor: 'registry'` (row 301) |
| 612 | `maxHealth = 100 … Driftwood's sturdy hearts raise it` | the heart upgrade | `app.player.attributes.maxHealth` modified by the heart effect row (09 §2.2) — S1.3 already; the comment goes |
| 683-686 | `const islandSfx = sea ? new IslandSfx(audio) : null` / `if (islandSfx) islandSfx.interact('chime'); else audio.hitMarker()` | the island's sound bank; the feat chime | Driftwood's voice table (S4.3); the feat sound → `cue.feat.earned` mapped per shard (Driftwood: `interact.chime`, others: `hitMarker`) |
| 690 | `new Hands(sky, game.camera, swimArms ?? null)` | the castaway's swimming arms | `manifest.swimArms` |
| 691, 694, 703 | `(crossbow as Sword).onHeavy = () => { if (!isOcean) audio.swordHeavy(); }` / `else if (!isOcean) audio.swordSwing()` / `if (!isOcean) audio.swordHit(surface, pan, gain)` | the synth sword sounds off the island | gone at S3.5 (the cue routing; Driftwood's CueMap maps `cue.weapon.fire` / `.impact` / `.charge.heavy` to the island whoosh / impact, S4.3) |
| 730-740 | `const ironDrop = (() => { if (!wreck \|\| !ironSword) return null; const drop = new IronSwordPickup({ scene: game.scene, sky, position: ironSwordSite(wreck, heightAt) })` / `if (ironSword && owned.has('iron-sword'))` / `params.get('weapon') === 'iron'` | the iron sword's pickup on the wreck, kept once taken | the `weapon.sword-iron` row's `pickup: { at: 'wreck.deck', model: 'ironSword', prompt, toast }` placed by the plugin (S4.1); `owned` check by the equipment service; `?weapon=iron` stays a harness param read by the equipment service |
| 741-749 | `const adventure = installAdventure({ game, sky, player, chunk, prompts: interactables, …, pois: { hut, lookout, wreck, shrine, cave: cove }, params, gulls })` / `if (adventure !== null && isOcean) { placeDriftwoodPlaces(` | the adventure; the places as Sets | the plugin's `installAdventure(ctx, rt)` and `placeDriftwoodPlaces(ctx.app.registry, …)` (S4.3) |
| 804-817 | `installLoot({ owned, chunk, …, flags: adventure?.flags ?? null, trader: adventure?.trader ?? null, …, swords: [crossbow, ironSword].filter(` | coins, the shop, the Bag's loot | `#game/loot` installed by the engine when `manifest.loot.coins`; the shard hands it its goods, its trader prompt and its finds with `ctx.rows.shop(…)` / `ctx.bag.finds(…)` (S4.3). `swords` → the whetstone effect's `appliesTo: 'weapon.blade'` (09 Q3) |
| 820-824 | `const bodyShadow = chunk.bodyShadow === true ? installBodyShadow(` / `if (adventure !== null && isOcean) installKeepsakes({` | the body shadow; the keepsakes | `manifest.bodyShadow: true` read by `#game`; keepsakes by the plugin (S4.3) |
| 833, 836-837 | `const dmg = hitDamage(chunk, raw, a.kind); // the shard's per-hit cap (E294: Driftwood 20; the captain is exempt)` / `if (meleeShard(chunk) \|\| pineFights !== null) hurtArc.hit(` | the hit cap; the hurt arc | gone at S1.3 (R1 from `manifest.fight.maxHitDamage` / `capExempt`, 09 §2.2) |
| 842-844 | `const surfaces = sea ? new SurfaceMap({ sea: sea.level, heightAt, trailDistance, decks: [pier, ...jetties, boat, hut, lookout, bridge, wreck], stone: [shrine] })` | the island's footstep surfaces | `ctx.answer('player.stepSurface', …)` from `shard:audio/surface.ts` (07's ask) |
| 849-858 | `swordEvents.onSwing = (speed, heavy, dir) => { islandSfx.whoosh(` / `swordEvents.onStrike = (kind, point, strength, killed) => { islandSfx.impact(kind === 'crab' ? 'shell' : kind === 'sailor' ? 'wood' : 'flesh'` / `swordEvents.onClang` / `animals.onWindup = (a) => { const e = a.kind === 'crab' ? 'crab'` | the sword's combat layers, death barks, wind-up cues | Driftwood's CueMap: `cue.weapon.fire` (whoosh, speed / heavy / dir from the event), `cue.hit.<surface>` with the species row's `hitMaterial` (crab `shell`, sailor `wood`, else `flesh`), `cue.creature.death` (vocal), `cue.weapon.clang.<material>`, `cue.ai.windup` (S4.3). `swordEvents` (`Sword.ts`) is deleted at S1.2 (09 §4.3) |
| 859-861 | `const windupWarn = chunk.fightRules !== undefined ? new WindupWarn` | off-screen wind-up chevrons | engine, on with the director (§1.2) — S2.3 |
| 863 | `const ambience = sea ? new IslandAmbience(audio, { sea: sea.level, heightAt, palms: palmSpecs, wreck, cove: Cove.forIsland() })` | the island's zoned soundscape and reverb rooms | Driftwood's `AmbienceZones` profile (S4.3) |
| 896 | `if (islandSfx && surfaces && !(player.wading && player.depth > 0.3)) islandSfx.footstep(player.wading ? 'water' : surfaces.surfaceAt(p.x, p.z, p.y)` | island footsteps | `cue.step.<surface>` (S3.5 routing) with Driftwood's voice table |
| 898 | `pier?.floorHeightAt(p.x, p.z) !== undefined ? 'planks' : sea !== undefined && heightAt(p.x, p.z) - sea.level < 2.6 ? 'sand'` | the generic footstep's pier / sand cases | gone with the ask (Driftwood answers; the others answer their own) |
| 930 | `if (gulls) gulls.onCall = (pos) => audio.gullCallAt(pos, player.position, player.yaw)` | gull calls | the plugin (`cue.ambient.gull`) |
| 933-934 | `islandSfx?.plunge(false)` / `islandSfx?.plunge(true)` | the dive / surface plunge | `cue.player.dive` / `cue.player.surface` mapped by Driftwood to the plunge voices |
| 946-975 | `const placePts = adventure?.places?.points ?? null` / `(sea === undefined \|\| floor > sea.level + 0.3)` / `if (stand !== null && stand.id !== 'pier')` | the last-place respawn over Driftwood's places; the pier is the spawn | `#game/respawn/lastPlace.ts` fed by `ctx.rows.places(…)`; the sea test → `app.world.water.sea?.level`; `manifest.respawn.spawnPlace: 'pier'` (Q1) |
| 976-987 | `const firstMinutes = chunk.slug === 'driftwood-isle' ? installFirstMinutes({` / `onWindup: (fn) => { const prev = animals.onWindup; animals.onWindup = (a, dur) => { prev?.(a, dur); fn(a); }; }` | the six first-time hints | the plugin: `ctx.system('shard.driftwood.firstMinutes')` + `ctx.on('ai.windup')` (S4.3) |
| 1127-1134 | `ocean?.update(dt); boat?.update(dt); palms?.update(dt); gulls?.update(dt, player.position);` / `if (bridge && bridgeDeck?.awake === true) bridge.setPoses(` / `seabed?.update(dt); cove?.update(dt); shrine?.update(dt); enemies?.update(dt, t, player.position);` / `if (dayNight) { shrine?.setDusk(dayNight.dusk); if (ambience) ambience.night = dayNight.night; }` | the island's per-frame work inside `'main'` | the systems of §4, in this order, all `before: ['engine.hands.update']` (today they run before `hands.update`, `:1137`) |
| 1155-1160 | `ironDrop?.update(dt, t, game.renderer, game.camera, player.position)` / `shrineHum?.update(game.camera)` / `ambience?.update(dt, game.camera)` | the pickup's hover; the hum | the equipment service's pickup system (every row pickup); `shard.driftwood.shrineHum` |
| 1296 | `const handle = { ...world, boundary, water, streams: dressing.streams, ocean, pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, enemies, hands, …, shrineHum, islandSfx, surfaces, ambience` | `window.__world` for scripts | `ctx.debug.expose('driftwood', rt)`; the `__world` alias keeps the keys until the scripts are ported (01 §5, F7) |

### 2.2 The look: `src/core/Game.ts`, `src/world/*`

| File:line | Grep key | Today | Replaced by (S4.3) |
|---|---|---|---|
| `Game.ts:348-350` | `const dwPhone = getActiveChunk().style === 'lowpoly' && TIER === 'phone'` / `const fxaa = (dwPhone \|\| R?.aa === 'fxaa')` / `const raysOn = !dwPhone` | FXAA instead of SMAA, no god rays, on Driftwood's phone (E189) | `manifest.tiers.phone: { aa: 'fxaa', godRays: false }` through the tier resolution (05 §2.2): `R?.aa` already exists; `godRays` is a new tier knob (engine default true) |
| `Game.ts:372` | `const lut = this.sky.lut && getActiveChunk().style !== 'lowpoly' ? new LUT3DEffect(` | the haze chain's LUT only off the toon shard | unchanged behaviour: the LUT in the haze chain is read only by the shards that take the haze chain; the condition becomes `!render.cleanChain` (below) |
| `Game.ts:391` | `const colour = chain(getActiveChunk().style === 'lowpoly')` | the clean L5 chain (no volumetrics, grain, fringe; faint rays 0.12; bloom smoothing 0.08; vignette 0.35) | Driftwood's `'extend'` `compose` returns `{ chain: c.engineChain('clean') }` (01 §13.1; 13-lead-resolutions C6) instead of the default `'cinematic'` chain; the two chains stay engine post blocks |
| `Game.ts:283, 356` + `tier.ts:132-134` | `const slices = R?.slices ?? phonePictureCuts()` / `return TIER === 'phone' && (tierShard === 'pine-hollow' \|\| tierShard === 'driftwood-isle')` | the depth slices and off-screen god rays on Driftwood's phone | `manifest.tiers.phone: { slices: true, skipRaysOffscreen: true }`; `phonePictureCuts()` and `tierShard` are deleted (Pine's half went at S2.1) |
| `tier.ts:59-61` (+ the desktop row) | `oceanCell: 4.0, palmCount: 120, palmFrondSegs: 4, bushCount: 170, bushDetail: 0, bushShadows: false, boulderShadows: true` | the 7 Driftwood-named knobs | Driftwood's own tier knobs, declared by the shard (`ctx.tiers.knobs(DRIFTWOOD_KNOBS)`, 01 §13.3 "the kit declares knob schemas for its families" — here the shard) with today's phone and desktop values; the engine table loses them (10-sweeps X7 step 1 then finds them gone) |
| `Sky.ts:17, 99-100, 103` | `const toon = style === 'lowpoly', stylizedSky = toon;` / `if (toon) installStylize();` / `stylizedSky ? await this.setupStylized()` | the toon lighting patch, the stylized dome | `LookStrategy.backdrop` (Driftwood's `StylizedSky` backdrop) + `LookStrategy.lighting: { install: installStylize }` (Q2), called at the same point in `Sky.build()` (before anything compiles) |
| `Sky.ts:48-52, 112, 125-148` | `export function shadowRig(stylized: boolean)` / `const filter = this.stylized !== null && rig.phone` / `if (this.stylized && installShadowFadeChunk())` / `l.shadow.normalBias = this.stylized ? 0.14 : 0.05` / `if (this.stylized && rig.phone) { const maps = new ShadowMaps(` | the toon shard's shadow rig (phone splits, the 7×7 tent, the stepped-sun crossfade, 16-bit maps, the biases) | `LookStrategy.shadows: DRIFTWOOD_SHADOWS` (Q2) — data: `{ rig: 'stylized', filter: 'tent', fade: true, normalBias: 0.14, radius: 0.6, texelBias: 'phone', depth16: 'phone' }`; the engine reads it where it reads `this.stylized` today |
| `Sky.ts:156-169, 245-270` | `if (this.stylized) { const st = this.stylized` / `this.dayNight = this.stylizedClock = new DayNight({` / `stylized: StylizedSky \| null` | the stylized clock's grip on the lights, fog, toon uniforms and the dome's palette | the backdrop's `apply(key)` fed by `app.world.dayCycle` (06 §6.4 A) |
| `Terrain.ts:187, 214-247, 396, 423` | `if (getActiveChunk().style === 'lowpoly') return this.buildLowPoly()` / `const wl = getActiveChunk().ocean?.level ?? -1e4` | the faceted terrain coloured by height and slope; the sea level for the wet sand | `LookStrategy.terrainPainter` (Driftwood's `buildLowPoly` moved to `shard:look/terrainPainter.ts`, reading the sea level from its layout) |
| `stylize.ts:5, 199-216` + `Atmosphere.ts:5, 175-176` | `THREE.ShaderChunk.fog_fragment = RAMP_FOG` / `if (isStylized()) for (const k of Object.keys(toonUniforms)` | the toon ramp fog (the 4th `fog_fragment` writer) and the toon uniforms on every fogged material | `LookStrategy.fog = { order: 200, install: installRampFog }` (01 §13.2: "stylize 200"); the toon uniforms ride the same `attachFogUniforms` hook through the fog model's `uniforms` |
| `Ocean.ts:34, 57`, `explore/MiniMap.ts:17, 163-191` | `toonUniforms.uSeaLevel.value = def.level` / `toonUniforms.uFogStart.value = 1e6` | the caustics' sea level; the Explore map switches the ramp haze off | the ocean (shard) sets its own uniform; Explore's map asks `render.fog.suspend()` / `resume()` (a `FogModel` method, Q2) |
| `AnimalFactory.ts:28, 88-89, 305-354, 488, 544-550`, `Hands.ts:6, 31, 65, 130` | `const lowPoly = this.style === 'lowpoly'` / `this.style = getActiveChunk().style === 'lowpoly' ? 'lowpoly' : 'pbr'` | faceted creatures and swim hands | the creature look registry (07 Q10) and `manifest.kitLook: 'lowpoly'` |
| `Horizon.ts:26, 47` | `const ocean = Boolean(def.ocean)` | far rocky islets instead of ridges over open water | `manifest.horizon.kind: 'islets'` (data; Q1) |
| `Boundary.ts:20` | `if (getActiveChunk().ocean) return Math.max(ground, waterLevel())` | the boundary wall's foot on the sea | `app.world.water.sea !== null` |
| `Seabed.ts:53` | `getActiveChunk().ocean?.level ?? 0` | moves with the file | the shard's layout `OCEAN.level` |

### 2.3 Boot, audio, UI, explore, game, entities, player

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `boot/manifest.ts:75-77, 82-86, 94-101` | `def.sky.painted \|\| def.style === 'lowpoly'` / `ocean = def.ocean !== undefined \|\| def.style === 'painterly' \|\| built` | no HDRI, the baked terrain only, no cabins / props | `manifest.boot.files(tier)` (§3; the node test compares with today's `chunkFiles(DRIFTWOOD_ISLE, tier)`) |
| `boot/prefetch.ts:37-41` | `const painted = def.style === 'lowpoly' \|\| …` / `def.ocean === undefined ? [...files.cabins, ...files.props] : []` | prefetch order | reads `manifest.boot.files` |
| `boot/extras.ts:57, 118, 149` | `if (key.startsWith('../explore/') && def.ocean === undefined) continue` | **only Driftwood preloads Explore offline** (plan §7.4) | `manifest.boot.explore` for every shard (X3 honours it; S4.1 deletes the three `def.ocean` reads so the preload follows the manifest: Driftwood's is identical) |
| `boot/extras.ts:166-167, 223-228` | `const slots: SlotName[] = def.ocean ? ['title', 'island'] : ['title', 'pine']` / `const bed: AmbientBed = ocean ? 'island' : steppe ? 'steppe' : 'forest'` | the island slot and bed decoded at the bar | `manifest.boot.audio` (S4.3) |
| `boot/audioFiles.ts:11-16, 58-80` | `export const DRIFTWOOD_SOUNDS` / `const unplayed = (slug: string): readonly string[] => (slug === PINE ? ['island'] : [])` | the island slot and Driftwood's untagged sounds left out of Pine's bar | Driftwood's own set folder `public/assets/sfx/driftwood-isle/` (the same move as Nalati's, 07 §6.5 D) and its score source: `unplayed`, `DRIFTWOOD_SOUNDS`, `otherShardFiles` are deleted (S4.3) |
| `boot/shardPrefetch.ts:72, 82-83` | `if (def.ocean !== undefined) { const base = blenderModelsBase('driftwood-isle')` | the Blender island's GLBs + the captain as late reads | `manifest.boot.lateReads(tier)` |
| `boot/gpuFiles.ts:42` | `new URLSearchParams(location.search).get('chunk') ?? 'driftwood-isle'` | the default shard when no `?chunk=` | the generated registry's first manifest by `order` (Driftwood is `order: 1`: identical) |
| `boot/steps.ts:9` | the shared nouns are Driftwood's | — | Driftwood's `boot.steps` is empty (it uses the shared labels, as today) |
| `audio/Audio.ts:61, 146, 1073-1107` (+ the island bed) | `this.bed = def.ocean ? 'island'` / `gullCall(` / `gullCallAt(` | the island bed, the gulls | parked in `legacyIsland.ts` by S3.5; moved to `shard:audio/` (S4.3) |
| `audio/Music.ts:500` | `private pending: MusicState = { shard: getActiveChunk().ocean ? 'island' : 'pine'` | the island score slot | Driftwood's `ScoreSource` over the base style bank's `island` slot (`shard:audio/score.ts`, S4.3); `MusicState.shard` is deleted |
| `ui/HurtArc.ts:89` | `if (def.ocean !== undefined) return 'washed back to the pier'` | the respawn text | `strings['respawn.default'] = 'washed back to the pier'` |
| `ui/Minimap.ts:156, 335, 515-560, 589` | `ctx.fillStyle = getActiveChunk().ocean ? OPEN_SEA : VOID` / `const ocean = chunk.ocean ?? null` / `if (ocean \|\| bareGround) { this.paintBuilt(` | the sea by depth, the built pieces | `manifest.minimap.palette` (sea by depth, sand) + `minimap.paths` / `pieces` (today's `ChunkDef.map`) |
| `ui/debugOptions.ts:135-136` | `opt('time', 'sky', 'Time of day', TIMES, { when: (c) => c.chunk.style === 'lowpoly' \|\| …` | the Time row | shown when `uses` has `dayCycle` (06 §2.2) |
| `ui/titleDeck.ts:48` | `{ slug: 'driftwood-isle', name: 'Driftwood Isle', label: 'Low-poly island, open ocean'` | the card | the generated registry (F9) |
| `explore/Explore.ts:44-75, 122, 210` | `const practiceArt = PRACTICE_ART[shard.slug] ?? practiceDriftwood` / `world.chunk.ocean?.level ?? -Infinity` | hub art (Driftwood the fallback); the ground under a camera | `manifest.explore.art` (the four `Record<string, string>` maps are deleted: Driftwood is the last shard, 05 §2.4); `app.world.water.sea?.level ?? -Infinity` |
| `explore/Compare.ts:18-21` | `'driftwood-isle': [ pair('spawn'` | compare pairs | `manifest.explore.compare` |
| `explore/MiniMap.ts:115, 220, 238, 251, 258`, `explore/diorama.ts:153` | `this.world.chunk.ocean?.level` | Explore's sea level | `app.world.water.sea?.level` |
| `game/quest/Complete.ts:26` | `const NEXT_SHARD = 'nalati-grasslands'` | the complete card's next shard | `manifest.next: 'nalati-grasslands'` (Q1) |
| `game/quest/Adventure.ts:255` | `'driftwood-isle': installDriftwoodAdventure` | the adventure registry | deleted (§1.2) |
| `game/achievements.ts:83-100` | `const DRIFTWOOD: AchievementDef[]` | feats | `ctx.rows.feat` |
| `game/Inventory.ts:44-…` | `// Driftwood Isle` item rows | items | `ctx.rows.item` |
| `entities/AnimalManager.ts:99, 437, 512` | `private readonly rules = getActiveChunk().fightRules ?? null` / `if (getActiveChunk().ocean) return false` | the fight rules; animals never wade into the sea | the director (S2.3); the placement / wander test asks `app.world.water.inside(x, z)` (the ocean body says yes below its level) |
| `entities/Enemies.ts:68` | `return getActiveChunk().ocean ? lvl + waveHeight(x, z) : lvl` | coconuts float on the swell | moves with the file (§1.2); `app.world.water.surfaceAt(x, z)` |
| `player/Player.ts:256, 549` | `const ocean = getActiveChunk().ocean` / `const bob = getActiveChunk().ocean ? waveHeight(this.position.x, this.position.z) : Math.sin(` | the swim bob on the swell | `app.world.water.surfaceAt(x, z)` (the ocean returns level + `waveHeight`, other bodies their own bob) |
| `player/BodyShadow.ts:15`, `game/loot/keepsakes.ts:97` | `ChunkDef.bodyShadow` | — | `manifest.bodyShadow` |
| `chunks/ChunkDef.ts` | `meleeShard`, `hitDamage`, `ocean`, `fightRules`, `faunaTuning`, `maxHitDamage`, `hitCapExempt`, `loot`, `bodyShadow`, `map`, `sword` | the Driftwood-shaped fields | deleted at S4.4 with `ChunkDef.ts` (every shard is a `ShardManifest`) |
| `chunks/registry.ts` | `import { DRIFTWOOD_ISLE }` | the hand list | gone at F9 |

## 3. (c) The manifest, in full

`src/shards/driftwood-isle/manifest.ts`, node-safe. Values are today's (`driftwood-isle.ts:88-281`). **Q1** marks
fields 01 §6 does not declare.

```ts
import { defineShard } from '#game';
import { WORLD_WIND } from '#kit';                                          // today's world/wind.ts values as data (Driftwood and Pine share them: kit by the rule of two)
import { TERRAIN, SEED } from './world/terrain';
import { OCEAN, PATHS, HUT, SHRINE, LOOKOUT, WRECK, BRIDGE, SPAWN, ISLAND_BOARS } from './layout';
import { CHUNK_HALF } from '#engine';
import { bootFiles, lateReads } from './boot/files';                     // boot/manifest.ts's Driftwood branch + shardPrefetch.ts:82-83
import thumb from './thumbs/driftwood-isle.jpg';
import portrait from './thumbs/driftwood-isle-portrait.jpg';
import landscape from './thumbs/driftwood-isle-landscape.jpg';

export default defineShard({
  api: 1,
  slug: 'driftwood-isle',
  name: 'Driftwood Isle',
  label: '(−1, +6)',                                                      // gridCoords (01 §6)
  biome: 'Low-poly island, open ocean',                                   // def.biome: the title deck's card line
  blurb: 'A small low-poly island in a bright ocean, in the spirit of Wind Waker. A pier, a moored sailboat, a hut on the plateau, a ring shrine in the jungle and a wreck in the cove — island boar hunted with a wooden sword.',
  order: 1,                                                               // the deck's first card; the default shard (gpuFiles.ts:42)
  status: 'live',
  card: { thumb, portrait, landscape },
  placement: { grid: [-1, 6], size: [500, 500, 500] },                    // gridCoords '(−1, +6)'
  seed: SEED,                                                             // 01 §6 — 0x5ea1
  treeCount: 0,                                                           // carried as data
  style: 'toon',                                                          // today 'lowpoly' (data only, never branched on)
  kitLook: 'toon',                                                        // Q1, declared (01 §6; today's 'lowpoly' path): faceted creatures, the castaway's swim arms, the catalog
  uses: ['dayCycle', 'bosses', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice',
    'coins', 'loot', 'feats', 'bag.pack'],                                // R1-02: exactly what it runs today (swim: the sea; coins + loot: E314's purse, coin burst, shop and trophies, 09 §5.6, with `loot.coins` below as their data; bag.pack: 12 slots); no weather, no elites, no compendium. The director is on because `fight.attackers` is finite
  ground: { terrain: TERRAIN },                                           // buildTerrain(SEED, { oceanLevel: 0.8, landscape, graded, trails, cabinSites: [] })
  water: { sea: () => import('./world/ocean').then((m) => m.OCEAN_BODY) },   // Q1 — the WaterBody (level 0.8, shallow / deep colours, deepDepth 6)
  wind: WORLD_WIND,                                                       // 01 §17: today's world/wind.ts values (sway, gusts) as data for the engine WindField
  trees: { factory: 'none', noun: 'trees' },                              // no forest: the engine builds none (05 §2.3 bootstrap row)
  spawn: { ...SPAWN, floor: 'registry' },                                 // { x: 0, z: −194, yaw: π } on the pier deck; Q1 `floor`
  respawn: { spawnPlace: 'pier' },                                        // Q1 — main.ts:973 (the pier IS the spawn)
  sky: {                                                                  // :242-253
    sunColor: [1.0, 0.97, 0.9], sunIntensity: 2.7, envIntensity: 0.7, bgIntensity: 1.0,
    fogSunColor: [1.0, 0.98, 0.92], cloudSunColor: [1.0, 0.98, 0.94],
    hemiSky: 0x7b90f4, hemiGround: 0xd8a878, hemiIntensity: 0.9,
    planet: { azimuth: 36, elevation: 38, size: 17, tilt: 24, roll: -16 },
  },
  atmosphere: { fogHeight: -20.0, fogHeightFalloff: 0.08, fogHeightDensity: 0.0004, fogDistDensity: 0.00014, volumetricSunColor: [1.0, 0.97, 0.9] },   // :255-261
  grade: {                                                                // :262-267
    saturation: 0.3, brightness: 0.0, contrast: 0.2, bloomIntensity: 0.4, bloomThreshold: 1.0,
    shadowTint: [0.94, 0.98, 1.06], highTint: [1.04, 1.01, 0.96], lift: [0.0, 0.0, 0.005], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  horizon: {                                                              // Q1
    kind: 'islets',                                                       // Horizon.ts:47 (open water)
    matte: { day: '/assets/horizon/driftwood-isle-day.webp', night: '/assets/horizon/driftwood-isle-night.webp', elMin: -4, elMax: 24 },   // HorizonMatte.ts:53
  },
  world: {                                                                // Q1
    blenderArea: () => import('./world/blenderArea').then((m) => m.DRIFTWOOD_AREA),   // blenderArea.ts:30 (the baked cove)
    blenderModels: 'driftwood-blender',                                   // blenderArea.ts:47
  },
  minimap: {                                                              // today's ChunkDef.map, renamed (01 §6) + Minimap's ocean palette
    palette: () => import('./look/minimap').then((m) => m.PALETTE),       // the sea by depth, the sand
    paths: PATHS,
    pieces: [
      { ids: ['palms'], look: 'dot' }, { ids: ['cove'], look: 'rock' },
      { ids: ['pier', 'jetty-*', 'bridge', 'boat'], look: 'planks' },
      { ids: ['hut', 'lookout', 'wreck', 'zipline'], look: 'timber' }, { ids: ['shrine'], look: 'stone' },
    ],
  },
  dayCycle: () => import('./look/dayKeys').then((m) => m.DRIFTWOOD_DAY),  // S2.4: 48-min cycle, day [0, 20/24), FIXED_PHASE
  render: () => import('./look/render').then((m) => m.shardRender()),     // S4.3
  tiers: {
    phone: {
      aa: 'fxaa', godRays: false, slices: true, skipRaysOffscreen: true,  // Game.ts:348-350, tier.ts:133 (E189 / E142)
      oceanCell: 4.0, palmCount: 120, palmFrondSegs: 4, bushCount: 170, bushDetail: 0, bushShadows: false, boulderShadows: true,   // tier.ts:59-61 (shard knobs)
    },
    desktop: { oceanCell: 2.75, palmCount: 150, palmFrondSegs: 6, bushCount: 260, bushDetail: 1, bushShadows: true, boulderShadows: true },   // tier.ts desktop row
  },
  budgets: {                                                              // inputs only; S4.4 derives the numbers, its F2-baseline ceilings until then (R1-14)
    phone: { fps: 30, lanes: 'default' },
    desktop: { fps: 60, lanes: 'default' },
    load: { coldPlay4G: 30 },                                             // budget-design §6.6
  },
  fight: {
    quietPromptInFight: true,                                             // Q1 — main.ts:1177 (E296; today's meleeShard(chunk))
    maxHitDamage: 20,                                                     // E294
    capExempt: ['creature.captain'],                                      // def.hitCapExempt ['captain'] (Jake, 2026-09-30)
    attackers: 2,                                                         // def.fightRules.maxAttackers (E297)
  },
  loadout: {                                                              // 09 §1.5
    weapons: ['weapon.sword', 'weapon.sword-iron'],
    tools: [],
    start: ['weapon.sword'],
    pickups: [{ id: 'weapon.sword-iron', at: 'wreck.deck' }],             // IronSword.ts ironSwordSite; kept once taken (owned 'iron-sword')
    viewmodel: () => import('./vm/castawayArms').then((m) => m.castawayArms),   // Q1 — def.sword (the castaway rig; the code-built sword on a load error)
  },
  swimArms: 'castaway',                                                   // Q1 — main.ts:690 (the rig's swimming arms)
  bag: {                                                                  // Q1 — E314
    tabs: ['map', 'gear', 'finds', 'pack', 'feats'],
    pack: { slots: 12 },                                                  // Inventory.ts (the pack: harvest drops)
  },
  loot: { coins: true },                                                  // Q1 — E314 (the purse, the burst, the shop)
  bodyShadow: true,                                                       // Q1 — E314 stage 3
  next: 'nalati-grasslands',                                              // Q1 — Complete.ts:26
  species: ['kit:creature.boar', 'kit:creature.bear', 'creature.crab', 'creature.monkey', 'creature.sailor', 'creature.captain'],
  faunaTuning: {                                                          // carried as data (01 §6) — def.faunaTuning (a child row of the kit boar, 09 §5.2)
    boar: { sightRange: 42, sightRangeGraze: 26, sightCone: 1.22, hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
  },
  encounters: ['boss.captain'],
  spawns: [                                                               // 09 §5.6
    { kind: 'boar', count: 4, variants: ISLAND_BOARS, anchor: { x: 66, z: -132, rMin: 5, rMax: 20 }, canopy: false, trailBand: [8, 600] },
    { kind: 'boar', count: 3, variants: ISLAND_BOARS, anchor: { x: -140, z: -30, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
    { kind: 'boar', count: 4, variants: ISLAND_BOARS, anchor: { x: 30, z: 150, rMin: 5, rMax: 30 }, canopy: false, trailBand: [8, 600] },
    { kind: 'bear', count: 1, variants: ['brown'], anchor: { x: 56, z: -84, rMin: 4, rMax: 16 }, canopy: false, trailBand: [8, 600] },
    { kind: 'bear', count: 1, variants: ['black', 'black-blaze'], anchor: { x: -122, z: -100, rMin: 4, rMax: 14 }, canopy: false, trailBand: [8, 600] },
  ],                                                                      // = spawn.driftwood.fauna (09 §5.6)
  spawnTables: ['spawn.driftwood.enemies', 'spawn.driftwood.practice'],   // Q1 — S4.2 (Enemies.ts), rows in the plugin
  audio: {
    ambience: 'ambience.driftwood',                                       // S4.3: the AmbienceZones profile (IslandAmbience)
    score: 'score.driftwood',                                             // the base style bank's `island` slot (S4.3)
    cues: () => import('./audio/cues').then((m) => m.CUES),
  },
  input: [],
  pois: [                                                                 // :137-144
    { id: 'jetty', name: 'Jetty', x: 0, z: -CHUNK_HALF + 24, r: 16 },
    { id: 'hut', name: 'Hut', x: HUT.x, z: HUT.z, r: 12 },
    { id: 'shrine', name: 'Ring shrine', x: SHRINE.x, z: SHRINE.z, r: 16 },
    { id: 'lookout', name: 'Lookout', x: LOOKOUT.x, z: LOOKOUT.z, r: 12 },
    { id: 'wreck', name: 'Wreck cove', x: WRECK.x, z: WRECK.z, r: 20 },
    { id: 'bridge', name: 'Rope bridge', x: (BRIDGE.a[0] + BRIDGE.b[0]) / 2, z: (BRIDGE.a[1] + BRIDGE.b[1]) / 2, r: 12 },
  ],
  boot: {
    steps: {},                                                            // the shared labels (steps.ts:9)
    files: bootFiles,                                                     // (tier) => today's chunkFiles(DRIFTWOOD_ISLE, tier), literally
    audio: () => import('./audio/files').then((m) => m.BOOT_AUDIO),      // extras.ts:166-167, 223-233 (title + island slots, the island bed)
    lateReads,                                                            // shardPrefetch.ts:82-83 (the Blender island's GLBs + lightmaps, the captain)
    explore: { art: ['practice', 'world', 'models', 'sets'] },            // extras.ts:57, 118, 149 (Driftwood's today; every shard's from X3)
    precache: [],
  },
  roster: () => import('./roster').then((m) => m.ROSTER),
  explore: {
    art: { practice: './explore/practice-driftwood-isle.webp', world: './explore/world-driftwood-isle.webp',
      models: './explore/models-driftwood-isle.webp', sets: './explore/sets-driftwood-isle.webp' },   // Explore.ts:44-58
    compare: [                                                            // Compare.ts:18-21
      { id: 'spawn', label: 'Spawn · pier', model: 'driftwood-spawn', target: 'art/driftwood-isle/round-4-remaster/mockup-1-fp-front.jpg' },
      { id: 'right', label: 'Spawn · right', model: 'driftwood-right', target: 'art/driftwood-isle/round-4-remaster/mockup-3-fp-right.jpg' },
      { id: 'overlook', label: 'Island overlook', model: 'driftwood-overlook', target: 'art/driftwood-isle/round-4-remaster/mockup-6-diag-front.jpg' },
    ],
  },
  load: () => import('./plugin'),
});
```

The manifest test compares both tier rows with a frozen copy of `tier.ts`'s phone and desktop tables. Fields that
disappear: `id`,
`displayName`, `gridCoords` (→ `label`, `placement.grid`), `thumbnail` / `heroPortrait` / `heroLandscape`, `weapon: 'sword'` and `sword`
(→ `loadout`), `ocean` (→ `water.sea`, the sea's `WaterBody` row: 01 §6, §17), `explore: true`, `map` (→ `minimap`), `fauna` (→ `spawns`), `maxHitDamage` / `hitCapExempt` / `fightRules` (→ `fight`), `terrain` (→ `ground.terrain`).

## 4. (d) The plugin

`src/shards/driftwood-isle/plugin.ts`. The install order is `main.ts`'s Driftwood order, so every registry id,
system and scene object is added in the same sequence:

```ts
export default class DriftwoodPlugin extends ShardPlugin {  // staged hooks, each awaited in its boot stage (R1-24); every ctx verb is bound to ctx.scope (R1-25)
  private rt: DriftwoodRuntime | null = null;               // made in world(); kit() and play() run after it, in stage order
  private runtime(): DriftwoodRuntime { if (this.rt === null) throw new Error('driftwood-isle: world() has not run'); return this.rt; }
  async world(ctx: ShardContext): Promise<void> {           // ── level.world (main.ts:289-427's Driftwood parts, in order; progress into the `edge` key) ──
    ctx.strings(STRINGS);                                     // 'respawn.default', the toasts, weapon names, the quest's lines
    const rt = new DriftwoodRuntime(ctx.scope);
    this.rt = rt;
    ctx.tiers.knobs(DRIFTWOOD_KNOBS);                         // oceanCell, palmCount, … (tier.ts:59-61)
    rt.ocean = buildOcean(ctx);                               // :299 — registers the sea WaterBody
    rt.pier = placePier(ctx);                                 // :303
    rt.boat = placeBoat(ctx, rt);                             // :309
    rt.rocks = placeBoulders(ctx);                            // :318-320
    rt.hut = placeHut(ctx); rt.lookout = placeLookout(ctx); rt.wreck = placeWreck(ctx); rt.shrine = placeShrine(ctx);   // :325-340
    rt.jetties = placeJetties(ctx);                           // :344
    rt.bushes = placeBushes(ctx);                             // :349
    rt.gulls = buildGulls(ctx, rt);                           // :351-362
    rt.trailside = buildTrailside(ctx);                       // :365-368
    rt.bridge = placeBridge(ctx);                             // :372
    rt.seabed = buildSeabed(ctx);                             // :376
    rt.palmSpecs = scatterPalms(ctx);                         // :380
    rt.cove = placeCove(ctx);                                 // :384-388 (+ the sea-cave terrain cut)
    rt.palms = placePalms(ctx, rt);                           // :391
    rt.cover = buildCover(ctx, rt);                           // :393-395 (+ tintTerrain)
    rt.ocean.foamAround(rt.seaColliders());                   // :396
    rt.bridgeDeck = buildBridgeDeck(ctx, rt);                 // :411-412
    rt.island = await installBlenderIsland(ctx, rt);          // :421-427 (null on a load error: the procedural cove stays)
  }
  kit(ctx: ShardContext): void {                            // ── level.kit ──
    ctx.rows.weapon(SWORD_ROW); ctx.rows.weapon(IRON_SWORD_ROW);                            // child rows of the kit's, the castaway arms; `meta` feeds the Bag (R1-26)
    ctx.rows.species(DRIFTWOOD_SPECIES); ctx.rows.creatureLook('toon', LOWPOLY_LOOK);     // S4.2
    ctx.rows.speciesLook(DRIFTWOOD_LOOKS);                    // R1-27: the SpeciesRows are simulation only; the crab / monkey / sailor / captain rigs and meshes are SpeciesLooks, registered apart
    ctx.rows.encounter(CAPTAIN); ctx.rows.spawn(DRIFTWOOD_SPAWNS); ctx.rows.loot(DRIFTWOOD_LOOT);
    ctx.rows.item(DRIFTWOOD_ITEMS); ctx.rows.feat(DRIFTWOOD_FEATS); ctx.rows.shop(DRIFTWOOD_SHOP);
  }
  play(ctx: ShardContext): void {                           // ── level.play (main.ts:500-987's Driftwood calls, in order) ──
    const rt = this.runtime();
    installEnemies(ctx, rt);                                  // :500 — the spawn tables start (S4.2)
    installAudio(ctx, rt);                                    // :590 shrine hum, :684 island voices, :844 surfaces, :863 ambience, :930 gulls
    placeIronSwordPickup(ctx, rt);                            // :730-740
    rt.adventure = installAdventure(ctx, rt);                 // :742 (spine, trader, feats, places, gull guide, complete, finale, ecology, zipline)
    placeDriftwoodPlaces(ctx.app.registry, rt);               // :744-749
    ctx.bag.finds(() => finds(rt.adventure.flags, ctx.app.owned));   // loot/finds.ts
    installKeepsakes(ctx, rt);                                // :823
    installFirstMinutes(ctx, rt);                             // :982
    installDebug(ctx, rt);                                    // the handles
  }
}
```

| Kind | Id | Phase / order | Source today |
|---|---|---|---|
| System | `shard.driftwood.ocean` | `update`; `before: ['engine.hands.update']` | `main.ts:1127` |
| System | `shard.driftwood.boat` | `update`; after `…ocean` | `:1128` |
| System | `shard.driftwood.palms` | `update`; after `…boat` (advances the shared sway wind, `world/wind.ts`) | `:1129` |
| System | `shard.driftwood.gulls` | `update`; after `…palms` | `:1130` |
| System | `shard.driftwood.bridge.pose` | `update`; after `…gulls` | `:1131` |
| System | `shard.driftwood.bridge.capture` | `fixed.post` | `:412` |
| System | `shard.driftwood.seabed` | `update`; after `…bridge.pose` | `:1132` |
| System | `shard.driftwood.cove`, `.shrine` | `update`; after `…seabed` | `:1133` |
| System | `shard.driftwood.enemies` | `update`; `tick: 'ai'` for the brains (S4.2); the coconuts and debris every frame | `:1133` `enemies?.update(dt, t, player.position)` |
| System | `shard.driftwood.dusk` | `update`; after `…enemies` | `:1134` (`shrine.setDusk(dayCycle.dusk)`, `ambience.night`) |
| System | `shard.driftwood.cover` | `update` (registered at `:394`, before `'main'`) | `:394` |
| System | `shard.driftwood.blenderIsland` | `update` (registered at `:427`) | `:427` |
| System | `shard.driftwood.shrineHum` | `update`; `after: ['engine.audio.listener']` | `:1159` |
| System | `shard.driftwood.ambience` | `update`; after `…shrineHum` | `:1160` `ambience?.update(dt, game.camera)` |
| System | `shard.driftwood.firstMinutes` | `update`; before `engine.ui.firstHints` | `:987` |
| System | `shard.driftwood.adventure.*` | `update` | the adventure's updaters (`Adventure.ts:230-245`: the bridge sway, the places tick; Finale's, Spine's, TraderStall's, Ecology's, gullGuide's) |
| System | `shard.driftwood.npc` | `update`; `tick: 'npc'` | the castaway and trader idle |
| Events listened | `actor.died` (Spine's kill hook, Ecology's respawn queue, keepsakes' drops, the sailor's hold key, the captain's end), `ai.windup` (first minutes), `app.ready` (the horizon matte load), `weapon.*` (cue map), `player.died` (last place) | — | `Spine.ts:70`, `Ecology.ts:64`, `keepsakes.ts:183`, `main.ts:984, 404` |
| Asks answered | `player.stepSurface` (SurfaceMap), `feat.toast` (none: the chime is a cue), `damage.modify` (the crab's front × .5, 09 §5.4) | — | `main.ts:844`, `crab.ts:284-288` |
| Pieces | every id today: `pier`, `boat`, `rocks`, `hut`, `lookout`, `wreck`, `shrine`, `jetty-0..2`, `bushes`, `trail-*`, `bridge`, `cove`, `palms`, the cover's, the Blender island's, the zipline's, the adventure kit's | `level.world` / `level.play` | `src/models/place.ts` through `app.registry` |
| HUD | the coin chip, the shop panel (`#game`), the quest objective and talk panels (`QuestUI`, engine quest), the Captain's boss bar (the shared BossBar, `bar: 'boss'`, decision 91, §6.2 B), the first-time hints (engine) | — | `install.ts:80`, `Finale.ts:28` |
| Bag | FINDS (the sticker book), GEAR extras (coins, hearts, charms, cosmetics), PACK | — | `main.ts:804-817`, `finds.ts` |
| Debug handles | `driftwood` (runtime), `driftwood.adventure`, `driftwood.keepsakes`, `driftwood.loot` (from `#game`), `driftwood.enemies` | `ctx.debug.expose` (01 §7) | `Adventure.ts:246`, `keepsakes.ts:233`, `install.ts:177` |
| Playgrounds | none | — | `catalog.ts:7` |

## 5. (e) Engine systems this phase pulls in

| System | What S4 needs of it | Must exist first | Row |
|---|---|---|---|
| `app.world.water` (the `WaterBody` subset: `sea`, `surfaceAt`, `inside`, `level`) | the ocean as a registered body; the engine's ocean readers (§2.2–§2.3) | S3's world service | S4.1 (X5 completes the other bodies; Q3) |
| `manifest.spawn.floor: 'registry'` | the spawn on the pier deck | F11 registry floors | S4.1 |
| Row pickups (`pickup` on a weapon row, placed by the equipment service) | the iron sword on the wreck | S2.2 (the lever's cabin pickup) | S4.1 |
| `LookStrategy.mode` (`'extend'`), `.lighting`, `.shadows`, `.fogControl` (`suspend` / `resume`), `.backdrop.apply` (01 §13.1) | the toon look | S3.2's `LookStrategy` extensions | S4.3 (13-lead-resolutions 07/08#2) |
| Shard tier knobs (`ctx.tiers.knobs`) | the seven Driftwood knobs | S1.1 tier resolution | S4.1 |
| `EncounterService.boss` with `bar: 'quest'`, no intro, no seal, no checkpoint | the Captain unchanged | S2.3 boss runtime | S4.2 |
| `#game/loot` (`manifest.loot.coins`), `ctx.rows.shop`, `ctx.bag.finds` | coins, the trader, FINDS | F9 `#game`, S2.1 Bag fragments | S4.3 |
| `#game/respawn/lastPlace` + `ctx.rows.places` | the dark respawn at the last place | S1.3 death flow | S4.4 |
| `#kit/npc` rows | the castaway, the trader | S2.5, S3.3 | S4.3 |
| `AmbienceZones` profile, voice table registration, the `player.stepSurface` ask | the island audio | S3.5 | S4.3 |

## 6. The rows, step by step

### 6.1 S4.1 — the manifest, the plugin and the world build

1. **Manifest** as §3. `test/shards/driftwood-isle/manifest.test.ts`: node import; every
   value against a frozen copy of `DRIFTWOOD_ISLE` and `tier.ts`'s Driftwood knobs; `boot.files('phone' | 'desktop')`
   against today's `chunkFiles`.
2. **World build** (`shard:world/build.ts`): the functions of §4's `level.world` block, each one `main.ts`'s lines
   with the same arguments, a `slice()` between builders as today (`main.ts:290`, the 30 ms task budget). The
   builders' files move (§1.2). `main.ts:282` and every `isOcean ? … : null` of `:289-408` are deleted; the `edge`
   step keeps only the engine's `Boundary`, `Horizon` and the matte (from `manifest.horizon.matte`).
3. **The Blender island** (`shard:world/blenderIsland.ts`): `B.install({ scene, sky, colliders, terrain, palms,
   palmSpecs, replace: [bushes], cover })` as `main.ts:421-425`; after F11 `colliders: player.colliders` is the
   registry (the island registers its pieces). The `console.warn` fallback is kept.
4. **The sea as a `WaterBody`.** `shard:world/ocean.ts` exports `OCEAN_BODY: WaterBody = { id: 'sea', level: 0.8,
   surfaceAt: (x, z) => 0.8 + waveHeight(x, z), inside: (x, z, y) => y < 0.8 + waveHeight(x, z), … }` and registers
   with `ctx.app.world.water.add(OCEAN_BODY)`. The engine readers switch to `app.world.water`: `Player.ts:256, 549`,
   `Boundary.ts:20`, `AnimalManager.ts:512`, `Terrain.ts:396` (moves with the painter at S4.3), `Explore.ts:122`,
   `explore/MiniMap.ts:115, 220, 238, 251, 258`, `explore/diorama.ts:153`, `main.ts:962`. `waterLevel()`
   (`Heightfield`) stays for the flat level (Pine's pond, Nalati's river).
5. **The loadout.** Rows `weapon.sword` (parent kit `SWORD_WOOD`, name "Wooden sword", viewmodel `castawayArms`) and
   `weapon.sword-iron` (parent kit `SWORD_IRON`, name "Iron sword"; each name is the row's `meta.name`, R1-26, `pickup: { at: 'wreck.deck', model: () =>
   import('./loadout/ironSword'), prompt: 'loadout.iron.take', toast: 'loadout.iron.got' }`, owned id `iron-sword`).
   The castaway's `ironArms` and `swim` (`main.ts:530`) are the rig's parts the rows and `Hands` read.
6. **Tier knobs**: `ctx.tiers.knobs(DRIFTWOOD_KNOBS)` with the seven knobs' schemas; `Palms`, `Bushes`, `Boulders`,
   `Ocean` read `app.tiers.current.<knob>` as they read `TIER_CONFIG.<knob>` today. `tier.ts:59-61` and the desktop
   row's seven lines are deleted. `phonePictureCuts` / `tierShard` are deleted (§2.2).
7. **Boot data**: `boot/manifest.ts`, `prefetch.ts`, `extras.ts:57, 118, 149`, `shardPrefetch.ts:82-83`,
   `gpuFiles.ts:42` read the manifest (§2.3).
8. **Explore**: the four art maps are deleted (every shard has `manifest.explore.art` now); `Compare.ts` pairs from the
   manifest.
9. **Tests**: `test/shards/driftwood-isle/plugin.test.ts` (fake Game, stub builders): the pieces of §4 added in order
   with today's ids; the systems of §4 in order, `before: ['engine.hands.update']`; scope dispose removes every piece,
   system, listener, water body and handle. `test/shards/driftwood-isle/foam.test.ts`: the foam ring list from the
   registry equals the legacy-box list (x, z, r, sorted).

**Done when:** `grep -n "isOcean\|\bsea\b\|chunk\.ocean\|\.ocean\b\|'driftwood-isle'\|lowpoly" src/main.ts src/core src/engine/world src/engine/boot` finds only
the S4.3 look lines (§2.2) and comments; the walk + `--trails` (the Driftwood legs, 0 stuck), the three harness poses,
the registry and the census identical; parity green on 4 shards × 2 tiers.

### 6.2 S4.2 — enemies on the AI runtime; the Drowned Captain on the boss runtime, his fight unchanged

**A. Species and spawns.**
1. **Rows** (09 §5.2, §5.3): `creature.crab` (25; big 70), `creature.monkey` (30; elder 45), `creature.sailor` (60),
   `creature.captain` (320) in `shard:species/`, with their brains as `CreatureBrain` subclasses keeping every state of
   `crab.ts:213`, `monkey.ts:232`, `sailor.ts:275`, `captain.ts:227`. Strikes S1–S7 as `StrikeSpec` rows. Each is a
   `SpeciesRow` (simulation) plus a `SpeciesLook` (rig + mesh from the species files and `captainMesh.ts`), registered
   apart (R1-27). The kit boar and bear take Driftwood's child rows (`ISLAND_BOARS`, `faunaTuning.boar`) and the
   low-poly look (their `SpeciesLook` for `kitLook: 'toon'`).
2. **The big crab hits for 14** (the lead's answer to 09 Q8, a found bug fixed toward the data). Today the snap always
   deals `SNAP_DAMAGE` 10 (`crab.ts:214, 266`) and the big variant's `mods: { chargeDamage: 14 }` (`crab.ts:301`) is
   never read. `strike.crab.snap`'s `damage` reads the variant's `chargeDamage` (small 10 from the species default
   `chargeDamage: SNAP_DAMAGE` `:297`, big 14). Under Driftwood's cap (20) it lands in full. A test and a board item
   (§7, §8).
3. **Spawn tables** (09 §5.6): `spawn.driftwood.fauna` (the five anchor groups of §3), `spawn.driftwood.enemies`
   (crabs per site 3–5, first `big`; ≤ 3 monkey troops of 3–4 on palm groves ≥ 60 m from the spawn and 30 m from the
   wreck; the drowned sailor(s)), `spawn.driftwood.practice` (§C). `Enemies.ts` keeps what is not spawning: the
   coconut bodies (`COCONUTS` 16, r 0.13, `G` 9.81, `REST_T` 4, `MAX_AGE` 16, `LAND_IMPACT` 1.5, `REST_SPEED` 0.15), the
   debris pool (merged into the one particle pool at X5) and the splash. Coconut strikes (S3) go through `combat.hit`
   with `cover.checked`.
4. **Randomness**: `Enemies.ts:284-288, 361` → `'cosmetic'`; the monkey's coconut cooldown 2.5–4 s → `'ai'`;
   `Ecology.ts:33, 82, 84` → `'spawn'`; `keepsakes.ts:166` → `'loot'`; `CoinBurst.ts:80-89` → `'cosmetic'`.
5. **Ticks**: the crab, monkey and sailor brains `tick: 'ai'`, decision 85's bands (near 0–60 m: brain 20 Hz, body
   every frame; mid 60–160 m: brain 10 Hz, body every 2nd frame; far: paused); the captain is pinned while awake
   (09 §5.7). **These self-thinking species (crab, monkey, sailor, the Captain) join the runtime here and get
   body-clock strikes now (R1-32).** Today their strikes are checked inside the 10 Hz `think`
   (`AnimalManager.ts:686-699, 777-782`; the captain's cuts at `captain.ts:275-285`), so a strike's frames may move by
   up to 100 ms: the one allowed difference of S4.2's parity, a boarded M4 item with a clip.

**B. The Drowned Captain on `EncounterService.boss`, his fight unchanged.**
1. `class DrownedCaptain extends BossBrain` (`shard:combat/captain.ts`) from `captain.ts:227-312`: states hide · rise
   · fight · attack · sink · under; phases by hp: 1 above .66, 2 from .66 (sinks every ~7 s, burst 16 within 3 m),
   3 below .33 (1.7 m/s, wind-up .5, a second cut, sinks every ~5 s); strikes S5 (24, 2.5 m), S6 (the second cut),
   S7 (the burst); arena 22 m round the pool (`mem.arena`); asleep until `used:altar`.
2. `CAPTAIN_DEF: BossDef` carries exactly today's fight frame and no Boss.ts extra:
   `{ id: 'boss.captain', name: 'Captain Brine', arena: { at: 'shrine.pool', r: 22 }, wake: { flag: 'used:altar' },
   intro: null, seal: null, checkpoint: false, bar: 'boss', phases: [0.66, 0.33], persist: { deadFlag:
   'dead:captain' }, reward: null, capExempt: true }`.
   - `bar: 'boss'` (**decision 91: the shared BossBar**). The encounter widget renders the Boss runtime's
     `ui/BossBar.ts` with his name, title and phase pips. `QuestUI.BossBar` (`ws-quest-boss`) is deleted once nothing
     else uses it. The bar shows while the player is inside the arena and the captain is up (`Finale.ts:77-81`,
     moved verbatim into the widget's `visible` rule). This is the one intended look change in S4.2, and it goes on
     the look board: his bar before and after, on the iPhone portrait.
   - `checkpoint: false`: `death.checkpoint` is not answered (a death in his fight is a normal death at the last
     place, as `main.ts:1195` never asks him today).
   - `intro: null`, `seal: null`: no intro caption, no arena wall (the Boss runtime's defaults are off for him).
   - The rewards stay where they are: the hat (keepsakes' trophy drop, `effect.captain-hat`), 25 coins (the loot
     table), `dead:captain` (Spine's kill hook → `actor.died`). `reward: null` means the Boss runtime grants nothing.
   - `Finale.ts:49-67`'s spawn / wake / reload-mid-fight rules become the def's `wake` and the runtime's restore: a
     reload with `used:altar` and not `dead:captain` spawns him under the pool asleep until you come near.
3. `Finale.ts` keeps the reward view (the eased camera to the ring, golden hour, the caption, `seen:reward`, the
   complete card hand-off) in `shard:quest/finale.ts`; its `w.sky.dayNight.phase` writes (`:85, 97`) → `dayCycle.set()`
   eased as today (06 §6.4 C's porch pattern).
4. **`boss.attempt` for the Captain: a fix** (D2, §7; 13-lead-resolutions still-open 08#6). Once he is on
   `EncounterService.boss`, the runtime emits `boss.attempt` for him as for every boss: once per wake, with `{ boss:
   'boss.captain', shard: 'driftwood-isle', outcome }` (`outcome` = `'won'` on his kill, `'lost'` on a player death
   inside the arena, `'left'` when the player leaves the arena while he is up). The X8 analytics sink (01 §23) batches
   it with the other bosses'. It is a bug fixed inline (decision 4), since today his fights never reach analytics.
   Parity: the `captain` block records the event's frame and payload; it is new, so its baseline field is recorded in
   the S4.2 commit under the found-bug rule (03 §8 case 4).

**How parity proves the fight unchanged** (the harness block `captain`, run on Driftwood × phone / desktop on every
S4.2 commit):
- Seeded run (`app.rng.seed(4242)`, capture clock 60 fps): `?quest=` to the altar step, `used:altar` set, the player
  scripted to stand 3 m from the pool facing it, dodge on a fixed schedule, and strike with the wooden sword every
  0.9 s until the captain dies.
- Recorded per fixed step: the captain's state, `mem.phase`, hp, position (4 decimals), `mem.rise`; every strike
  (id, frame, damage dealt after the pipeline, the player's health after); the boss bar's state (`visible`, name, phase, fill fraction to 0.1 %: the *data*, since the bar's DOM changes by
  decision 91); the sink / burst frames and the bubble ring positions; the kill frame, `dead:captain`,
  the 25-coin burst and the hat drop.
- The baseline is recorded on HEAD before S4.2 (F2's harness, the same script); the gate compares frame for frame.
  **The one allowed difference is the strike-timing shift (R1-32):** his strikes are checked in the 10 Hz `think`
  today (`captain.ts:275-285`, called from `AnimalManager.ts:686-699, 777-782`) and on the body clock from S4.2, so a
  strike's frames (wind-up, cut, the burst, and what follows from them) may move by up to 100 ms. "His fight
  unchanged" means **rules, moves, phases and damage**: the same states, strikes and phase changes in the same order,
  the same damage per hit and the same kill and rewards. The shift is a boarded M4 item with a clip (§8, §9).
- The node tests: `test/ai/strike-table.test.ts` rows S5–S7 (every number), `test/ai/boss-phases.test.ts` (phases at
  .66 / .33; `death.checkpoint` unanswered for the captain), `test/combat/damage-pipeline.test.ts` (his 24 passes the
  cap of 20 because `capExempt`).

**C. The practice crab and the first minutes' enemy.** `spawn.driftwood.practice`: one small reef crab at
`PRACTICE_CRAB` (−7, −143), respawned `PRACTICE_BACK` 45 s after it dies once the player is `PRACTICE_AWAY` 30 m off
(`Enemies.ts:51-56, 174-190`), its shell fading as today: a spawn table row with `respawn: { after: 45, away: 30 }`
(09 Q9's `'each'` roll, count 1). Its `practice` flag on the animal stays (first minutes reads it).

**Tests:** the strike table S1–S7 (with the big crab at 14), `test/ai/spawn-tables.test.ts` (seeded: the same crabs,
troops and sailors at the same spots as `Enemies.build`), `boss-phases`, `test/shards/driftwood-isle/captain.test.ts`
(the def's flags; the bar visibility rule), `test/ai/practice-crab.test.ts` (dies → back at 45 s only when 30 m off), `test/shards/driftwood-isle/captain-attempt.test.ts`
(a wake then a kill emits one `boss.attempt` with `outcome: 'won'`; a death in the arena emits `'lost'`; a second wake
emits a second event).
**Done when:** the harness's `captain` block is identical except the ≤ 100 ms strike-timing shift (R1-32; plus the new `boss.attempt` field); the scripted swing + kill on the practice crab identical;
a big crab's snap deals 14 (the expected diff); `grep -rn "enemyWorld\|onCharge\|onWindup" src/shards/driftwood-isle` is empty.

### 6.3 S4.3 — adventure, keepsakes, first minutes, shrine hum, island audio; the toon look as a `LookStrategy`

**A. The adventure and the game-layer pieces.**
1. `Adventure.ts`'s `installDriftwoodAdventure` → `shard:quest/adventure.ts` `installAdventure(ctx, rt)`, same body:
   the interactables table (`shard:quest/interact.ts`) on the engine `Interactables` kit, the spine, the trader, the
   feats, the places, the gull guide, the complete card, the finale's reward, the ecology, the zipline, the bridge
   sway. `animals.onKill` chains (`Spine.ts:70-71`, `Ecology.ts:64-65`) → `ctx.on('actor.died')` in today's order
   (Spine, then Ecology, then keepsakes, then loot: `main.ts:742, 804, 823`). `window.__adventure` → `ctx.debug.expose`.
2. `ADVENTURES`, `installAdventure`, `hasAdventure` (`Adventure.ts:250-266`) and `main.ts:741-749` are deleted.
3. **Loot** (`#game/loot`): the engine calls `installLoot` for any manifest with `loot.coins`; it takes the shard's
   shop rows (`ctx.rows.shop`), its trader prompt (`rt.adventure.trader`) and its finds; `coinsOn(chunk)` reads the
   manifest. The swords list → the whetstone effect's `appliesTo` (09 Q3).
4. **Keepsakes** (`shard:loot/keepsakes.ts`): the sea-glass chime, charms, trophy plaques and drops, the captain's
   hat, on `ctx.on('actor.died')`; `body: bodyShadow` from `#game/cosmetics`.
5. **First minutes** (`shard:onboarding/firstMinutes.ts`): the six triggers feed the engine `FirstHints`; the chained
   `onWindup` → `ctx.on('ai.windup')`; the prompt text read from `ctx.app.ui.prompt`.
6. **Feats, items**: `ctx.rows.feat(DRIFTWOOD_FEATS)`, `ctx.rows.item(DRIFTWOOD_ITEMS)`; `Complete.ts:26` → `manifest.next`.

**B. The toon look** (`shard:look/render.ts`):

```ts
export const shardRender = (): LookStrategy => ({
  mode: 'extend',                                           // 01 §13.1 (the default): the engine chain, as today
  compose: (c) => ({ chain: c.engineChain('clean') }),      // Game.ts:391: the engine's clean chain (E88: no volumetrics, grain, fringe; faint rays) in the `chain` slot of today's five (01 §13.1; 13-lead-resolutions C6, still-open 08#2)
  lighting: { install: installStylize },                    // Sky.ts:100 (before anything compiles)
  fog: { order: 200, install: installRampFog, uniforms: toonUniforms },   // stylize.ts:209, Atmosphere.ts:175-176
  fogControl: { suspend, resume },                          // 01 §13.1: the Explore map switches the ramp haze off (explore/MiniMap.ts:163-191)
  shadows: DRIFTWOOD_SHADOWS,                               // Sky.ts:48-52, 112-148 (data)
  backdrop: STYLIZED_BACKDROP,                              // StylizedSky + DayNight's keyframe application
  terrainPainter: LOWPOLY_TERRAIN,                          // Terrain.ts:187, 214-247
});
```

Steps, each its own commit with Driftwood's parity identical (programs byte-identical, poses identical):
1. `Game.ts:348-350, 372, 391` → the tier knobs `aa` / `godRays` and `render.chain` (§2.2).
2. `Sky.ts:99-103, 112-169, 245-270` → `render.lighting`, `render.shadows`, `render.backdrop`. After this commit
   `Sky.ts` has no `stylized` / `pine` / `painted` branch: its three setup paths are `backdrop?.build()` or the HDRI
   (`setupHDRI`, the engine default).
3. `Terrain.ts:187, 214-247` → `render.terrainPainter`; after S2.1 / S3.2 / S4.3 `Terrain.build()` is: the
   structure check, `terrainPainter?.build(this)`, else the PBR path.
4. `stylize.ts` → `shard:look/toon.ts`; `Atmosphere.ts:5, 175-176` → the fog model's `uniforms`; `Ocean.ts:57`'s
   `toonUniforms.uSeaLevel` set by the shard; `explore/MiniMap.ts:163-191` → `render.fogControl.suspend()` / `resume()`.
5. `DayNight.ts` → `shard:look/dayKeys.ts` (the `KEYS` table and `FIXED_PHASE`) + the backdrop's `apply(key)`;
   `DayNight.ts` is deleted (its clock half became `DayCycle` at S2.4).

**C. Island audio** (on S3.5's engine):
1. `IslandAmbience` → Driftwood's `AmbienceZones` profile: zones sea · beach · palms · jungle · cove · lookout, the
   reverb rooms hold · cave · shrine, the scattered waves and birds, `night` from the day cycle, `setUnderwater`.
2. `IslandSfx` + the island families of `Voices.FAMILIES` (the enemy vocals, wind-ups, `impact-shell`) + the island
   bed and gulls parked in `legacyIsland.ts` → Driftwood's voice table (`shard:audio/sfx.ts`); `legacyIsland.ts` is
   deleted.
3. Driftwood's CueMap: `cue.weapon.fire` → whoosh (speed, heavy, dir), `cue.hit.<surface>` → impact by the species
   row's `hitMaterial` (crab `shell`, sailor `wood`, else `flesh`) + `cue.creature.death` → the vocal, `cue.weapon.
   clang.<material>`, `cue.ai.windup` → the wind-up voice (crab, sailor, boar for boar and bear), `cue.step.<surface>`,
   `cue.player.dive` / `.surface` → plunge, `cue.feat.earned` → `interact.chime`, `cue.ambient.gull`.
4. `ShrineHum` (`shard:audio/shrineHum.ts`): the hum by proximity and the score duck.
5. The score: `score.driftwood` = the base style bank's `title` slot on the menu and its `island` slot in play
   (today's `baseSlot()` → `shardSlot('island')`, `Music.ts:697-700`; Driftwood has no night / boss scene);
   `Music.ts:500`'s `ocean ? 'island'`, `wantSlot`'s shard tests and `MusicState.shard` are deleted.
6. The SFX set move (07 §6.5 D's recipe): Driftwood's untagged sounds (`DRIFTWOOD_SOUNDS`: beds `island`, hums
   `shrine`, the one-shots listed at `audioFiles.ts:66-69`) into `public/assets/sfx/driftwood-isle/`; `audioFiles.ts`
   loses `unplayed`, `DRIFTWOOD_SOUNDS`, `otherShardFiles`, `PINE`. No generation.

**D. The castaway and the trader on the kit NPC rig** (the lead: *Castaway / Trader join `#kit/npc`*).
`Castaway.ts` (Wendell: 314 lines, feet / fire positions, the face rig) and `Trader.ts` (Maren: 261, `TRADER_NEAR_R`
85 m draw cut) become rows on `#kit/npc/npcRig.ts` in `shard:quest/people.ts`: `{ id: 'castaway', model: …, idle:
'fire-tend', face: faceHeads(…), near: Infinity }`, `{ id: 'trader', model: …, idle: 'counter', near: 85 }`. The
rig gains what they need that Pine's and Nalati's rows lack as row fields (the face rig from `faceHeads.ts`, the
draw cut). `people.ts` / `trader.ts` models re-point to the rows. Parity: their poses at the three harness times
identical.

**Tests:** `test/shards/driftwood-isle/adventure.test.ts` (the listener order Spine → Ecology → keepsakes → loot on
one `actor.died`), `look.test.ts` (the low-poly terrain's vertex colours at 20 seeded points; the ramp fog chunk bytes),
`audio.test.ts` (zone weights and bed gains at 12 points equal `IslandAmbience`'s; the CueMap covers every cue).
**Done when:** `grep -rn "lowpoly\|stylized\|isStylized\|DayNight\|IslandAmbience\|IslandSfx\|legacyIsland" src/engine src/game src/kit` is empty;
the harness's quest run (`?quest=` to `seen:reward`), the sea-glass collection, a shop purchase and the first-minutes
hints identical; parity green on 4 shards.

### 6.4 S4.4 — `main.ts` → `src/engine/boot.ts` ≤ 150 lines; the shard-branch ratchet at 0 (EI7)

**What is left in `main.ts` at S4.4 start** (after S1–S3 and S4.1–S4.3; line ranges are today's) and where each piece
goes. Every destination is an engine / game module with a system id; `boot.ts` only calls the stages.

| Today | What | Goes to | Its system / call |
|---|---|---|---|
| 1-148 | the ~147 imports | each module imports its own; `boot.ts` imports ~12 (App, stages, the registry, the error screen) | — |
| 150-157 | `animalPositions` (the compass's reused buffer) | `src/engine/ui/hudSync.ts` | part of `engine.ui.hud` |
| 159, 1331-1336 | `installErrorModal()`, `main().catch(…)` | `src/engine/boot.ts` (kept, 5 lines) | — |
| 161-176, 1301-1330 | `shell`, `hostRef`, `SHARD_CAP`, ShardHost, the `park` / `activate` / `dispose` handles | retired at F11 (EI6); `dispose` → `scope.dispose()` | — |
| 178-201 | `main()`: the PWA `?chunk` strip, `consumeTitleArrival`, `setAliveSource` | `src/engine/boot/arrival.ts` (the strip, the arrival; the page entry itself is `src/entry.ts`, the composition root, 01 §0) + `#game/shard/select.ts` (the selected manifest) | stage `engine` |
| 207-234 | the boot plan, bytes, prefetch, pack streaming, the SW wait | `src/engine/boot/plan.ts` (exists) driven by `src/engine/boot/stages.ts` | stage `engine` / `level.data` |
| 235-257 | extras barrier, deferred audio, menu / audio preload, texture worker, lever preload, fieldModels | gone by S1.1 / S2.1 / S2.2 (manifest boot data, row preloads) | — |
| 258-280 | the fragile GPU boot guard | `src/engine/boot/guard.ts` (S1.1) | stage `finish` |
| 283-289 | `painterly`, `built`, `nolock`, `viewer` | `viewer` → `app.scene.viewer`; `nolock` → `app.params`; the rest gone | — |
| 289-408 | the `edge` step: `Boundary`, `Horizon`, the matte (the rest left at S2.1 / S3.1 / S4.1) | `src/engine/world/edge.ts` | stage `level.world` (before `plugin.world`, R1-24) |
| 409-427 | bridge chain, `addPaths`, the Blender island | Driftwood (S4.1); `addPaths` → `src/engine/world/paths.ts` (S3.1) | — |
| 429-488 | the `grass` / `cabins` / `props` steps | gone (S2.1 / S3.1 / S1.1 moved each shard's) | — |
| 490-493 | the `animals` step | `src/engine/ai/creatures.ts` (the creature service's build) | stage `level.play` |
| 494-526 | Nalati / Driftwood / clock lines, `targets` | gone (S3.1, S4.1, S2.4); `targets` → `src/engine/combat/targets.ts` (S3.1) | — |
| 527-555 | the weapons, `Weapons`, lock-on, touch controls | the equipment service (S1.2), `src/engine/input/touch.ts`, `src/engine/combat/lockOn.ts` | stage `level.kit` |
| 556-583 | `HUD`, arena, playground, `WeaponStrip`, `LockOn`, `SpeedLines`, `Perf`, `Minimap`, `FullMap`, `KeepAlive`, the `menu` step | `src/engine/ui/shell.ts` (constructs the HUD pieces), `#engine/practice` (arena, playgrounds) | stage `level.play` |
| 584-611 | `Audio`, `Music`, mood, `toSpawn`, `respawn`, bounds | `src/engine/audio/service.ts`; `toSpawn` / `respawn` → `src/engine/player/spawn.ts`; bounds → `engine.world.bounds` (S1.1) | stage `engine` / `level.play` |
| 612-649 | `kills`, `health` (gone S1.3), `Progress`, `Inventory`, `SkinLocker`, `Owned`, `GameMenu` | `#game/progress`, `#game/bag` (the menu built from registered tabs and fragments) | stage `level.play` |
| 650-682 | the review inbox (F8 key, ✎ disc, feedback composer) | `#game/review/install.ts` | `game.review` system (the disc sync, once a second) |
| 683-712 | the SFX routing, weapon hooks | gone (S3.5 cue routing) | — |
| 713-716 | aim targets | `engine.combat.aimTargets` (S3.1) | — |
| 717-796 | pickups, adventures, skins | row pickups (S2.2 / S4.1), plugins | — |
| 797-825 | compendium, Pine quest, loot, body shadow, keepsakes | `#game/compendium`, plugins, `#game/loot`, `#game/cosmetics` | stage `level.play` |
| 826-841 | `Combat`, `HurtArc`, the hurt block | `src/engine/combat/feedback.ts` (the pipeline's `damage.dealt` subscribers, S1.3) | `engine.combat.feel` |
| 842-899 | surfaces, sword events, wind-up warn, ambience, Pine audio / weather / life, perf counts, footsteps | plugins; perf counts → `src/engine/debug/perfCounts.ts`; footsteps → `engine.player.steps` (the step cue + the surface ask) | — |
| 900-929 | Nalati binds | gone (S3.1) | — |
| 930-945 | player / lock sounds and haptics | `src/engine/player/feedback.ts`: `cue.player.*`, `cue.lock.*` and the `HAPTIC` calls on the player / lock events | listeners |
| 946-975 | death fade, last place, `die` | `#game/respawn/` (`deathFade`, `lastPlace`, `die` on `player.died`) | `game.respawn.lastPlace` (every 0.25 s) |
| 976-987 | first hints (+ Driftwood's first minutes, S4.3) | `src/engine/ui/firstHints.ts` | `engine.ui.firstHints` |
| 988-1016 | `enter`, `hud.onArena`, `onResume`, `onExitToMenu` | `#game/session/menuWorld.ts` (the title ↔ world transitions as app states `title` / `play`) | `app.onEnter('play')` / `onExit('play')` |
| 1017-1060 | Explore open / exit, playgrounds entry | `#engine/explore/entry.ts` (`app.setState('explore')`) | state `explore` |
| 1061-1084 | frame gate, menu-first, arrival modes, `?explore=`, the first-gesture audio unlock | `#game/session/menuWorld.ts` + `src/engine/audio/unlock.ts` | run conditions (`when: inState('play', 'explore')`) replace `frameGate` |
| 1086-1104 | the E interaction + harvest | `#game/interact/install.ts`: the nearest-interactable pick, the `use` action (X1: the `KeyE` listener → `input.consume('use')`), harvest via `ask('harvest.begin')` (S2.1) | `game.interact.pick` |
| 1106-1223 | the `'main'` updater's 32 hand-ordered calls | each call is a system with an id in today's order (below) | — |
| 1225-1233 | `?at=` pose, the reload param | `src/engine/boot/arrival.ts` | stage `finish` |
| 1235-1300 | composer, precompile, first frame, audio decode, GPU recovery, title idle prime, `ws:ready`, shard prefetch, `__world` | `src/engine/boot/stages.ts` (`finish`), `src/engine/render/precompile.ts`, `src/engine/boot/recovery.ts`, `app.events.emit('app.ready')` (replaces the `ws:ready` DOM event; the native shell's watchdog listens to the probe's `ready` flag), `window.__wildshard` | stage `finish` |

**The `'main'` updater** (`main.ts:1110-1223`), split into systems in today's order (phase `update`, each `after` the
previous so ties keep the order): `game.music.poll` (`:1113-1124`, once a second) · the Driftwood systems (§4) ·
`engine.hands.update` (`:1137`) · `engine.horizon.update` (`:1139`) · Pine's carpet / cabins (S2.1) · Nalati's (S3.1)
· `engine.player.swimHolster` (`:1147`) · `engine.creatures.update` (`:1149`) · `engine.combat.aimTargets`
(`:1150`) · `engine.weapons.update` (`:1152`) · Pine's loadout (S2.1) · `engine.ui.weaponStrip` (`:1153`) ·
`engine.equipment.pickups` (`:1154-1156`) · `engine.audio.listener` (`:1158`) · Driftwood's shrine hum and ambience
(`:1159-1160`) · `game.interact.pick` (`:1163-1175`) · `game.interact.fightPrompt` (`:1177-1185`; on when
`manifest.fight.quietPromptInFight` is true: Driftwood, Nine Dragon and Nalati, today's `meleeShard(chunk)`, so the
behaviour is identical whatever weapon is held; Q1) ·
`engine.player.regen` (S1.3) · `game.respawn.deathFade` + `engine.player.death` (`:1191-1198`) · `engine.combat.feel`
(`:1200-1201`) · `engine.ui.hud` (`:1203-1215`: boundary warning, aim readout, lock brackets, speed lines, the compass,
the minimap, the full map, `hud.setState`). The frame-cost marks (`mark('world' | 'player' | 'animals' | 'audio' |
'hud')`) become the systems' own timing (every system is timed by id; the perf panel groups ids by prefix).

**`src/engine/boot.ts`** (≤ 150 lines; `scripts/check-paths.mjs` gains a line-count check): installs the error screen,
creates the `App`, takes the selected shard from `src/main.ts` (which reads the generated registry), runs the stages `engine` → `level.data` →
`level.world` → `level.kit` → `level.play` → `finish` (01 §8) with the plugin's `world` / `kit` / `play` hooks inside them (R1-24), sets
`app.setState('title' | 'play' | 'explore')` from the arrival, and on any throw shows the full-screen error (decision 69).
It names no shard, reads no `style`, no `slug` except to select the manifest.

**The ratchet reaching 0.** At the end of S4.4 these counts in `lint/ratchet.json` are 0 and their entries deleted:
`wildshard/no-shard-branch` (269 at F4: `slug ===`, `style ===`, `isOcean`, `nalatiNow()`, `isPine`, `isNine`,
`painterly ?`, `chunk.ocean`, `def.ocean`, `.fightRules`, `.bodyShadow`, `meleeShard(` outside `src/shards/`),
`wildshard/layer`'s `src/engine/**` word list (no shard slug, no `driftwood` / `nalati` / `pine` / `nine` word in
engine code or identifiers; comments included), and the `getActiveChunk()` count in `src/engine/**` (01 §5: `game.shard`
lives in `#game`). `src/chunks/ChunkDef.ts` is gone (F6 renamed it); `src/main.ts` stays as the **composition root**
(01 §0; 13-lead-resolutions 04#12): ≤ 20 lines that import `#engine`, `#game` and the generated shard registry, select
the manifest and hand it to `src/engine/boot.ts` (the engine may not import `#game`); the page entry, `src/entry.ts`
(F6 moved it there from `src/boot/entry.ts`; `index.html` loads `/src/entry.ts`; 13-lead-resolutions C6), is the
composition root's other half and is unchanged here;
`Game.onInput / onFixed / onUpdate / onLate` (the thin wrappers, 01 §1) are deleted.

**Driftwood's derived budgets** (R1-14; M4 is Driftwood's milestone). The gate derives Driftwood's per-pose numbers
from the budget formula (S1.6) at its three harness poses; until this row Driftwood's check used its F2-baseline
ceilings. A pose over its derived number keeps its current worst as a ceiling in `lint/ratchet.json` (may only go
down), with the derived number printed as its target (the pier pose's 868 desktop draws, budget-design §6.4).

**Tests:** `test/engine/boot.test.ts` (the fake Game boots the template-shaped stub manifest through every stage in
order; a throwing hook, in each stage, shows the error screen and disposes the scope; R1-24), `test/engine/systems-order.test.ts` (the
`'main'` split: the phase list equals the F2 fingerprint's order for each shard).
**Done when:** `wc -l src/engine/boot.ts` ≤ 150; `wc -l src/main.ts` ≤ 20; `pnpm lint:ratchet` shows 0 for the
rules above; parity green on 4 shards × 2 tiers (the systems list renamed by 03's id map, otherwise identical); the gate prints
Driftwood's derived numbers and enforces its ceilings (R1-14).

## 7. (f) Bugs fixed inline in this phase (each with a test)

| # | Bug | Where | Fix, row | Test |
|---|---|---|---|---|
| D1 (09 B6, Q8) | The big crab's `chargeDamage 14` is dead data: its snap deals 10 | `crab.ts:266, 301` | the snap reads the variant's damage: big 14 (the lead, toward the data) (S4.2) | strike table S1: small 10, big 14 |
| §7.4 | Explore's art and code are preloaded offline only when `def.ocean` | `boot/extras.ts:57, 118, 149` | the manifest's `boot.explore` (S4.1 reads it; X3 checks every shard) | the offline-boot harness test on 4 shards (X3) |
| D2 | The Captain's bar and fight live outside the boss runtime, so the boss analytics event (`boss.attempt`, decision 79) would never fire for him | `game/quest/Finale.ts` | the encounter service (S4.2 B step 4; a fix, 13-lead-resolutions still-open 08#6) | `captain-attempt.test.ts`: `boss.attempt` emitted once per wake, with its outcome |
| D3 | The coin burst, the keepsake drop angle and Ecology's respawn draws use `Math.random()` | `CoinBurst.ts:80-89`, `keepsakes.ts:166`, `Ecology.ts:33, 82, 84` | the seeded streams (S4.2) | seeded kills burst the same coins at the same spots twice |
| D4 | The default shard when no `?chunk=` is a string literal in `gpuFiles.ts:42` (a second hand-kept list) | `boot/gpuFiles.ts:42` | the registry's first manifest by `order` (S4.1) | the registry test |

## 8. (g) Parity expectations

**Identical** (`scripts/parity.mjs --export=HEAD --shards=driftwood-isle --tiers=phone` on every commit,
`--tiers=phone,desktop` before a push; all four on engine edits; R1-10): the
systems list (renamed per 03's id map), the registry (sorted), the scene census, programs (byte-identical: the toon
patch and the ramp fog install in the same order), draws and triangles at the three harness poses at pinned `time`,
the walk and `--trails` routes (0 stuck, the Driftwood legs), a swing to a kill with the wooden and the iron sword,
the iron sword pickup, the practice crab, the **`captain` block frame for frame** except the strike-timing shift (R1-32), the quest run to `seen:reward`,
the sea-glass collection, a shop purchase, the first-minutes hints, the audio beds, score slots and voices of the
scripted walk, the HUD slots, the save keys.

**Expected to differ.** Each row is a pending item from the commit that makes it (05 §8, R1-13): listed in
`reviews/pending.json` with its expected fingerprint delta, recorded with `parity --accept <ids>`, shown yellow by the
gate, and OK'd by Jake (re-baselined) or reverted before the pin moves.

| Difference | Row | Where it is shown |
|---|---|---|
| Crab, monkey, sailor and Captain strikes on the body clock: a strike's frames up to 100 ms earlier or later (rules, moves, phases and damage unchanged) | S4.2 (R1-32) | the creatures board (a clip: the Captain's first and second cuts, before / after) |
| A big crab's snap deals 14, not 10 | S4.2 (D1) | the creatures board (one clip: a big crab's snap, the health bar before / after) |
| Crab, monkey, sailor brains think in decision 85's bands (20 Hz near, 10 Hz from 60 m, paused past 160 m) | S4.2 | the creatures board (a monkey troop at 40 / 100 / 200 m) — if M2 already showed Driftwood's boars (06 Q7), only the new species |
| `boss.attempt` fires for the Captain | S4.2 (D2) | M4 summary |
| Driftwood's boot audio lists move to its own set folder (same bytes) | S4.3 | M4 summary |
| `main.ts` gone; systems renamed | S4.4 | M4 summary (the id map) |

## 9. (h) Milestone M4

| Step | Detail |
|---|---|
| Flow | As M1 (05 §9, R1-15): gate green on HEAD → boards to Jake → Jake OKs the board items (or they are fixed / reverted) → the pin moves to HEAD → deploy → Jake plays it live → **Jake's go starts the X rows**. The go is not a ship gate |
| Gate | `gpu-gate` green on HEAD, every shard's budget check on its derived budgets (S1.6, S2.6, S3.5, S4.4; R1-14); parity green on 4 shards; `pnpm test` green; `lint/ratchet.json`'s shard-branch, engine-word and `getActiveChunk` counts at 0 |
| Pin | After Jake OKs the board items, with no item left in `reviews/pending.json` (R1-13, R1-15): `node scripts/deploy-pin.mjs set <HEAD sha> --milestone M4 --go "<where>"` writes `.github/deploy-pin.json` (committed alone; 13-lead-resolutions G7), `gh workflow run deploy`, `version.json` confirmed, the build id in E357 (12-process §3, 03 §13.4) |
| Summary | What moved (§1: ~12k lines from engine folders), what was deleted (`main.ts` 1,336 → `boot.ts` ≤ 150, `ChunkDef.ts`, `DayNight.ts`, `stylize.ts` / `StylizedSky.ts` out of the engine, the adventure registry, `legacyIsland.ts`), the ratchets before / after since F4, Driftwood's derived budgets and ceilings (the pier pose's 868 desktop draws as a ceiling, budget-design §6.4) |
| Boards | **Creatures** (the big crab at 14; the crab / monkey / sailor tick bands; the strike-timing shift, with a clip of the Captain's cuts before / after, R1-32) and **Look** (the Drowned Captain on the shared BossBar, decision 91). iPhone portrait, clips ≤ 10 s, from the harness's capture of HEAD (R1-15). Each item stays pending until Jake OKs it (re-baselined) or it is fixed / reverted (R1-13). No weapons or audio board (nothing else changes) |
| Jake plays | Driftwood **live** on the pinned build, after the deploy (R1-15): the pier, the practice crab, the hut, the wreck's iron sword, a monkey troop, a big crab, the shrine, the Drowned Captain, the reward at golden hour. To play before the pin moves: a Vercel preview deployment of the candidate (`vercel deploy --prebuilt`, which keeps `/api`), not `release-url.sh` (R1-15) |
| Decision asked | Two AskUserQuestions (R1-15): the summary + boards first (each item OK / fix / revert), whose OKs move the pin; then, after he has played it live, "Driftwood M4: go?" (recommended: yes) |
| Rollback | If the pinned M4 build breaks on Jake's phone: `node scripts/deploy-pin.mjs rollback <sha>` to a SHA in the pin history (M3 or earlier), with no gate check; M0 is past F10, so it can't read the v2 saves (accepted, decision 13; stated on the rollback) (R1-16) |
| Reopening | On Jake's go, `src/shards/driftwood-isle/` reopens to content agents; the engine, game and kit stay locked until the plan is archived (Z4). `scripts/check-lock.mjs`, the `commit-msg` hook F0 builds (R1-09), passes a commit without the `E357-Lead: yes` trailer only when every path is on Driftwood's allowlist: `src/shards/driftwood-isle/**`, `test/shards/driftwood-isle/**`, `art/driftwood-isle/**`, the asset folders its manifest declares (`public/assets/driftwood-*`, `public/assets/sfx/driftwood-isle/**`), `scripts/blender/driftwood-isle/**`, `docs/tasks/asks/**`; generated files are built, not committed (R1-11). From then on Driftwood's lane owns its baselines: a content commit re-records them in the same commit (`parity --rebaseline driftwood-isle`), and every other shard must stay identical, the cross-shard proof (R1-12) |

## 10. Questions for the lead

Answered in [13-lead-resolutions.md](13-lead-resolutions.md) (the 07 / 08 table unless named, the still-open table
and C6); none is open, and the body above follows each answer.

1. **Manifest fields not in 01 §6.** **Resolved → 13-lead-resolutions 07/08#1** for the carried-over `ChunkDef` fields:
   `loot.coins`, `bodyShadow`, `horizon`, `faunaTuning` (this spec's `speciesTuning` is renamed back), `minimap` (was
   `mapDraw`), `spawns`; `ocean` → the sea's `WaterBody` row. This spec's sub-fields: **Resolved →
   13-lead-resolutions still-open 08#1:** `water.sea` (the field that holds the sea's `WaterBody` row), `spawn.floor`,
   `respawn.spawnPlace`, `horizon.kind`, `world.blenderArea` / `blenderModels`, `loadout.viewmodel`, `swimArms`,
   `next`, `spawnTables`, `fight.quietPromptInFight` and `kitLook` are declared manifest fields (01 §6 "Declared
   sub-fields"). §3 follows.
2. **`LookStrategy` fields.** **Resolved → 13-lead-resolutions 07/08#2:** `mode`, `lighting`, `shadows`, `fogControl`
   (`suspend` / `resume`) and `backdrop.apply` are on 01 §13.1; §6.3 B uses them. How a compose returns the chain:
   **Resolved → 13-lead-resolutions still-open 08#2 and C6:** `LookComposition` is today's five pass slots for
   `'extend'` or `{ chain: Pass[] }` for `'replace'`; an `'extend'` compose gets the engine chain from
   `c.engineChain('clean' | 'cinematic')` and puts it in its `chain` slot, so Driftwood's compose returns
   `{ chain: c.engineChain('clean') }` (§6.3 B).
3. **`WaterBody` in S4.1.** **Resolved → 13-lead-resolutions 07/08#7:** S4.1 builds the interface and the sea on it
   (`sea`, `surfaceAt`, `inside`, `level`); X5 converts the other bodies and adds `reflect`.
4. **Shard-declared tier knobs.** **Resolved → 13-lead-resolutions 07/08#8:** `ctx.tiers.knobs(schema)` (01 §7);
   10-sweeps X7 then only checks that no shard-named knob is left in the engine table.
5. **The Captain's bar.** **Resolved → 13-lead-resolutions 07/08#9** (Jake, decision 91): the shared BossBar, a small
   Driftwood look change on the look board at S4.2.
6. **`boss.attempt` for the Captain** (D2) is visible to analytics (01 §23's first set names `boss.attempt`).
   **Resolved → 13-lead-resolutions still-open 08#6:** a fix; once he is on the encounter runtime his attempts reach
   analytics like every boss's (S4.2 B step 4, §7 D2).
7. **`rockKit.ts`.** **Resolved → 13-lead-resolutions 07/08#10:** it goes where 04's import analysis puts it: 04 keeps
   it in the engine (`src/engine/world/rockKit.ts`, rule F); X5 folds its generic primitives into the engine geometry
   toolkit (§1.2).
8. **`src/world/interact/validate.ts`** (67 lines) has no importer in `src/`. **Resolved → 13-lead-resolutions
   still-open 08#8:** it goes on F7's one list (02 F7 step 3), which reviews every dead-code candidate in one row. That
   review finds two test importers (`test/interact.test.ts`, `test/pine-quest.test.ts`), so the file is a live test
   helper and is kept at 04's engine path (§1.2).
9. **Scheduler reach at M4.** **Resolved → 13-lead-resolutions 05/06#15:** S2.6 already switched Driftwood's boars and
   bears (shown at M2); M4's board shows the crab / monkey / sailor bands, which join the runtime at S4.2.
10. **The native shell's `ws:ready`.** **Resolved → 13-lead-resolutions 07/08#11:** `ws:ready` stays (the native
    shell's contract, `src/native/boot.ts`), dispatched once by the engine on reaching `title`; the probe also exposes
    `ready`. The internal `app.ready` event (§4) is the engine's own signal for shard code such as the horizon matte.
