# Pine non-graphical port inventory

Status: **open**, transitional; the trusted runtime still owns simulation.

## Metric and first slice

G291/G294/G304/G306/G312: baseline **21,932 / 21,155 = 103.67%**; after quest/inventory metadata **21,898 / 21,155 = 103.51%**. The numerator is 20,055 shard runtime lines plus 1,843 one-user platform lines. The 576 inline GLSL lines already belong to runtime TS, so the additional GLSL charge is zero. AssemblyScript is report-only: 270 lines. The frozen legacy revision is `8e297137b940f50da7f1949106d5576f80f238ca`. Neither the 20% nor complete emitted-content gate passes.

The existing declared ledger and bag now read the same authored feat/reward/slot rows from `data/questInventory.ts`; the runtime keeps the item predicate and all gameplay laws. The root feat module is deleted. All row values, insertion order, glyphs, local-save ids and travel policy compare exactly with the frozen source. This removes 34 counted metadata lines; it introduces no platform law or facade.

Proof: 69 focused data/save/ledger/pack tests, 14 native witness/replay/ledger/physics/spots tests, strict and typed touched lint passed. Four actual witness recorders produced byte-identical payloads. Two actual physics captures matched all payload fields (164 actors, 3 King prewarm states, 2,078 world solids); the actual 44-row spots capture and independent check matched. No collider changed, so this slice does not create a new physics-walk milestone. The map is recaptured by the official producer because the generator import changed; its WebP is byte-identical: 95,600 bytes, SHA-256 `e7cc19e10f905c377c9b0a61e64aec5d95dff3eff504198b877b3f058b3dea09`.

## Quest and dialogue rows

The seven-step chapter, external flag lists and Hale/Brandt/Mott dialogue trees now live in `data/wardensHollow.ts`. The native module keeps the same admission parser for each tree. Flag timing, dialogue ordering, night wait, King/dawn rewards and all scene side effects stay with their existing owners. The obsolete URL-jump comment now names the real Settings Debug row. This removes 129 runtime metadata lines. Frozen row/tree equality and authoring closure checks plus 48 quest/dialogue tests, strict and typed touched lint passed; actual physics/44 spots and all four witness payloads remain exact. The map inputs and shipped image are unchanged.

Current metric: **21,769 / 21,155 = 102.90%** (19,926 shard + 1,843 one-user platform; 258 primary files). Transitional, compatibility and the content gate are unchanged.

## Lodge and trader rows

The eleven authored lodge offers and seven trader swaps now live in data, including readable TypeScript offer construction, costs, reward ordering, identity and copy policy. The seeded serial draw, overlap counting, claim/reroll/save law, capacity and presentation stay in Pine. The old runtime offer construction is removed, not duplicated. This removes 61 runtime lines. Frozen rows/swaps, 500 seeded draws and 60 real board updates compare exactly, with author rows unmodified. The 58 focused board/trader/save checks, strict and typed touched lint passed; actual physics/44 spots and all four witness payloads remain exact. The map inputs and shipped image are unchanged. There is no new platform module/import rise.

Current metric: **21,708 / 21,155 = 102.61%** (19,865 shard + 1,843 one-user platform; 258 primary files). Transitional, compatibility and the content gate are unchanged.

## Lantern, command and pickup rows

The existing lantern ids/conditions, command bindings, resin coordinates/count and token names now live in `data/interactions.ts`. Their native table geometry and shared interaction/quest admission are unchanged; nearest-prompt/modal input, sitting and world effects stay with the existing hosts. This removes 16 runtime metadata lines. Forty focused flag/pickup/quest/entered tests, strict and typed touched lint passed; actual physics and 44 spots remain exact and the witness recorders reproduced unchanged payloads. Map inputs and the shipped map are unchanged.

Current metric: **21,692 / 21,155 = 102.54%** (19,849 shard +1,843 one-user platform).

## Elite script rows

The four existing elite AS declarations and their unchanged module bytes now live in `data/eliteBrainRows.ts`; the Ghost Stag lair is a shared authored input for the row and roster. The old runtime declaration file is deleted. Prelude, directors, fight host, RNG, contacts and rewards are unchanged. The physics fence removes the now-empty runtime directory and still includes every data input. Twenty-three focused elite/profile/entered checks and fourteen native witness/replay/ledger/freshness checks passed, with root strict and typed touched lint green. Actual physics and 44 spots compare exactly, and witness recorders reproduced byte-identical payloads.

The milestone phone-tier Chromium walk on diagnostic `b564da97d` completed all seven unchanged real-input routes with **0 stuck**: cabin-porch, pond, lookout-climb, zip-landing, creek-bridge, lodge-porch, den-cave. No collider changed. The actual official map recapture is byte-identical (95,600 bytes, SHA-256 `e7cc19e10f905c377c9b0a61e64aec5d95dff3eff504198b877b3f058b3dea09`). The final declaration-only type dependency removal changes no emitted values. All owned browser and preview resources were closed.

Current metric: **21,667 / 21,155 = 102.42%** (19,824 shard + 1,843 one-user platform; 257 primary files). AS remains 270 report-only lines; raw GLSL remains counted. The 20% metric, compatibility and complete emitted-content gate still fail.

## Ownership and remaining work

This round has reached the non-graphical floor of the currently admitted row APIs. Existing authored quest, dialogue, offer, trade, interaction and elite declarations are independent data; their native hosts still run the simulation. This is **transitional**, not a completed conversion or compatible:true claim.

- **WAITING FOR OPUS:** models, materials/shaders, viewmodels, compendium/HUD presentation, sky/cards/weather rendering, and terrain/forest/building generators. Mixed files retain their gameplay portion; graphical ownership never exempts custom lines.
- **KEPT TRUSTED TAILS — native game laws:** deterministic lodge draw/overlap/claim/save, trader capacity/payment, harvest, nearest-prompt/LOS and quest/world-side-effect sequencing. Existing rows describe their content but cannot express the full laws. A one-user platform relocation is prohibited.
- **KEPT TRUSTED TAILS — native ports:** player/camera ride and seating ownership, weapon contacts/projectiles/gust clock, posed King and refight/browser-save continuation, per-body fauna restoration, audio-zone lifetime, persistence/migrations, and weather progression callbacks. Numeric weapon/brain profiles already use the admitted rows; replacing these remaining ports needs an exact supported ABI, not a new hidden implementation.
- **KEPT TRUSTED TAILS — authoring integration:** boot/plugin/manifest admission and layout/geometry construction remain explicit owners until readable scene/collider generators replace them. New source-only metadata relocation would not prove a complete shardfile product.
- **RESERVED sp-x6:** directors, night/clock, elite prelude and coats. Their laws were not changed by this round; their ongoing row work is separate.

The honest headless outcome gaps remain prompt visibility/timing, secret/journal discoveries, night population and world access, browser boss-save/refights, variable motion/weather clocks, animated King hit timing and custom crossbow bolt recovery. Coverage-only gaps remain alternate routes/elites/refights, trader/ammo and grid quest tapes. No gap is closed by moving a declaration.

## Counted primary files

This complete table reproduces the 19,824-line shard numerator; data/generators, tests, generated output and the frozen folder are excluded. A mixed renderer/runtime owner is labelled with both responsibilities.

| File | Counted lines | Owner disposition |
| --- | ---: | --- |
| `life/index.ts` | 730 | WAITING FOR OPUS; mixed harvest/presentation kept |
| `runtime/items/boltCrossbow.ts` | 562 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/index.ts` | 560 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/items/leverFirearm.ts` | 479 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/looks/keyedSky.ts` | 451 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/rainFx.ts` | 328 | WAITING FOR OPUS; presentation/geometry |
| `runtime/antlerKing.ts` | 326 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/eliteScripts.ts` | 325 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/looks/riggedHulls.ts` | 323 | WAITING FOR OPUS; presentation/geometry |
| `runtime/viewmodel/gloveHands.ts` | 323 | WAITING FOR OPUS; presentation/geometry |
| `runtime/props/bakedBuilding.ts` | 322 | WAITING FOR OPUS; presentation/geometry |
| `runtime/quest.ts` | 307 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/viewmodel/staveBow.ts` | 294 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/LeverRifle.ts` | 292 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/compendium/trophyWall.ts` | 265 | WAITING FOR OPUS; presentation/geometry |
| `world/landmarks.ts` | 252 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/audio/ambience.ts` | 236 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `runtime/roster.ts` | 236 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/index.ts` | 233 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/species/limbRig.ts` | 232 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/crossbow/Crossbow.ts` | 219 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/kit/caveInterior.ts` | 205 | WAITING FOR OPUS; presentation/geometry |
| `runtime/audio/sfx.ts` | 203 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `loadout/loadout.ts` | 196 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `world/homestead.ts` | 189 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/headless.ts` | 186 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/crags.ts` | 180 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/nightDirector.ts` | 171 | RESERVED sp-x6; native clock/director/coats |
| `runtime/looks/groundCover.ts` | 169 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/cragLook.ts` | 165 | WAITING FOR OPUS; presentation/geometry |
| `runtime/kit/heldTool.ts` | 162 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/cabinLook.ts` | 160 | WAITING FOR OPUS; presentation/geometry |
| `runtime/king.ts` | 157 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/weather.ts` | 157 | WAITING FOR OPUS; geometry; native weather/host kept |
| `layout.ts` | 156 | WAITING FOR OPUS; geometry; native weather/host kept |
| `combat/install.ts` | 155 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `life/birdModels.ts` | 150 | WAITING FOR OPUS; presentation/geometry |
| `runtime/audio/score.ts` | 146 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `runtime/species/kingClips.ts` | 146 | WAITING FOR OPUS; presentation/geometry |
| `life/birdFix.ts` | 142 | WAITING FOR OPUS; presentation/geometry |
| `models/antlerKing.ts` | 142 | WAITING FOR OPUS; presentation/geometry |
| `runtime/props/buildingLife.ts` | 141 | WAITING FOR OPUS; presentation/geometry |
| `world/terrain.ts` | 141 | WAITING FOR OPUS; geometry; native weather/host kept |
| `models/wildlife.ts` | 139 | WAITING FOR OPUS; presentation/geometry |
| `manifest.ts` | 138 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/kingFight.ts` | 136 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/npc/standInPerson.ts` | 135 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/looks/weatherLook.ts` | 134 | WAITING FOR OPUS; presentation/geometry |
| `quest/ui.ts` | 128 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/headlessLongbow.ts` | 124 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/elites.ts` | 123 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/kingRig.ts` | 121 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `loadout/skins.ts` | 119 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/posedInstances.ts` | 119 | WAITING FOR OPUS; presentation/geometry |
| `compendium.ts` | 118 | WAITING FOR OPUS; presentation/geometry |
| `quest/rides.ts` | 118 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/weapons/headlessCrossbow.ts` | 116 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/kit/peopleLook.ts` | 107 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/stuckArrows.ts` | 107 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/contracts.ts` | 105 | KEPT TRUSTED TAIL; data offers admitted, draw/payment/save law |
| `runtime/looks/keyedSkyDay.ts` | 104 | WAITING FOR OPUS; presentation/geometry |
| `runtime/rainShelter.ts` | 104 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `weapons/leverAction.ts` | 102 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `quest/npcModels.ts` | 100 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `world/streams.ts` | 95 | WAITING FOR OPUS; geometry; native weather/host kept |
| `combat/fxKit.ts` | 94 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/audio/wiring.ts` | 93 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `runtime/weapons/headlessRanged.ts` | 91 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `world/beaverPool.ts` | 91 | WAITING FOR OPUS; geometry; native weather/host kept |
| `weapons/equipment.ts` | 88 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/logKit.ts` | 88 | WAITING FOR OPUS; geometry; native weather/host kept |
| `models/logCabin.ts` | 87 | WAITING FOR OPUS; presentation/geometry |
| `world/timber.ts` | 86 | WAITING FOR OPUS; geometry; native weather/host kept |
| `quest/stagLead.ts` | 83 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/kingPoseHost.ts` | 82 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/kingPoseKeeper.ts` | 82 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/cabins.ts` | 82 | WAITING FOR OPUS; geometry; native weather/host kept |
| `world/cragBake.ts` | 80 | WAITING FOR OPUS; geometry; native weather/host kept |
| `world/treeFactory.ts` | 80 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/lodge.ts` | 79 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/looks/forestLook.ts` | 78 | WAITING FOR OPUS; presentation/geometry |
| `models/people.ts` | 75 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/headlessLever.ts` | 75 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `boot/files.ts` | 71 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/audio/synth.ts` | 69 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `runtime/kingQueryPose.ts` | 69 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/looks/sky.ts` | 69 | WAITING FOR OPUS; presentation/geometry |
| `world/weatherProfile.ts` | 69 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/species/herdShelter.ts` | 67 | WAITING FOR OPUS; presentation/geometry |
| `models/hollowLog.ts` | 66 | WAITING FOR OPUS; presentation/geometry |
| `combat/ctx.ts` | 65 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `combat/elites.ts` | 65 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `models/gear.ts` | 65 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/wildlifeLook.ts` | 65 | WAITING FOR OPUS; presentation/geometry |
| `life/trunks.ts` | 62 | WAITING FOR OPUS; mixed harvest/presentation kept |
| `combat/eliteRoster.ts` | 60 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `models/caveArch.ts` | 58 | WAITING FOR OPUS; presentation/geometry |
| `runtime/kit/primitiveParts.ts` | 58 | WAITING FOR OPUS; presentation/geometry |
| `combat/lane.ts` | 56 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/featLaw.ts` | 55 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/people.ts` | 55 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/combatMath.ts` | 54 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/nightThralls.ts` | 52 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `plugin.ts` | 51 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/questLifetime.ts` | 51 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `world/timberBake.ts` | 51 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/air.ts` | 50 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/cull/batchedLod.ts` | 50 | WAITING FOR OPUS; presentation/geometry |
| `runtime/kit/glbNodes.ts` | 50 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/keyedSkyRows.ts` | 50 | WAITING FOR OPUS; presentation/geometry |
| `runtime/weapons/headlessLoadout.ts` | 50 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `world/timberSites.ts` | 50 | WAITING FOR OPUS; geometry; native weather/host kept |
| `loadout/ammo.ts` | 49 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `models/forestTree.ts` | 49 | WAITING FOR OPUS; presentation/geometry |
| `dev/perfLap.ts` | 48 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/weapons/ammunition.ts` | 48 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `world/props.ts` | 48 | WAITING FOR OPUS; geometry; native weather/host kept |
| `models/birds.ts` | 47 | WAITING FOR OPUS; presentation/geometry |
| `world/drawnModels.ts` | 47 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/nightPopulation.ts` | 46 | RESERVED sp-x6; native clock/director/coats |
| `runtime/directorClock.ts` | 45 | RESERVED sp-x6; native clock/director/coats |
| `runtime/items.ts` | 45 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/entries.ts` | 44 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/kingQueryView.ts` | 44 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/quest/npcDialogue.ts` | 44 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/trader.ts` | 44 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/cabinBake.ts` | 44 | WAITING FOR OPUS; geometry; native weather/host kept |
| `combat/chargeTells.ts` | 43 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `runtime/looks/streamLook.ts` | 43 | WAITING FOR OPUS; presentation/geometry |
| `models/fallenLog.ts` | 42 | WAITING FOR OPUS; presentation/geometry |
| `quest/trades.ts` | 42 | KEPT TRUSTED TAIL; data offers admitted, draw/payment/save law |
| `runtime/elitePrelude.ts` | 42 | RESERVED sp-x6; native clock/director/coats |
| `quest/table.ts` | 41 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/kingCollision.ts` | 41 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/dialogue.ts` | 40 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `quest/stagWalk.ts` | 39 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `species/looks.ts` | 39 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/places.ts` | 39 | WAITING FOR OPUS; geometry; native weather/host kept |
| `models/mossyBoulder.ts` | 38 | WAITING FOR OPUS; presentation/geometry |
| `quest/zipWire.ts` | 36 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/audio/files.ts` | 36 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `combat/strikes.ts` | 34 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `life/lifeMath.ts` | 34 | WAITING FOR OPUS; mixed harvest/presentation kept |
| `runtime/herds.ts` | 34 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `weapons/crossbow/display.ts` | 34 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/fireLookout.ts` | 33 | WAITING FOR OPUS; presentation/geometry |
| `runtime/kingCollisionBake.ts` | 33 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `weapons/longbowView.ts` | 33 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `loadout/finishes.ts` | 32 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `models/tokenShelf.ts` | 32 | WAITING FOR OPUS; presentation/geometry |
| `runtime/viewmodel/longbowLook.ts` | 32 | WAITING FOR OPUS; presentation/geometry |
| `world/undergrowthKit.ts` | 32 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/kit/hullSpots.ts` | 31 | WAITING FOR OPUS; presentation/geometry |
| `quest/tokenShelf.ts` | 30 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/pack.ts` | 30 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/weapons/gustClock.ts` | 30 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/beats.ts` | 29 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `world/cragKit.ts` | 29 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/fauna.ts` | 28 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `weapons/crossbow/profiles.ts` | 28 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/hero.ts` | 28 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/kit/skinningKnifeLook.ts` | 27 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/riseParticles.ts` | 27 | WAITING FOR OPUS; presentation/geometry |
| `world/treeSet.ts` | 26 | WAITING FOR OPUS; geometry; native weather/host kept |
| `budgetCeilings.ts` | 25 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/persistence.ts` | 25 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/cabinKit.ts` | 25 | WAITING FOR OPUS; geometry; native weather/host kept |
| `runtime/combatService.ts` | 24 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/spawns.ts` | 23 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `quest/hollowLog.ts` | 23 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/audio/entered.ts` | 23 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `compendium/install.ts` | 22 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/skinningKnife.ts` | 22 | WAITING FOR OPUS; presentation/geometry |
| `runtime/facts.ts` | 22 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `boot/steps.ts` | 21 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/treeStump.ts` | 21 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/mossOverlay.ts` | 21 | WAITING FOR OPUS; presentation/geometry |
| `roster.ts` | 20 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/audio/combatCues.ts` | 20 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `runtime/kit/lodGlb.ts` | 20 | WAITING FOR OPUS; presentation/geometry |
| `species/thrall.ts` | 20 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/undergrowth.ts` | 20 | WAITING FOR OPUS; geometry; native weather/host kept |
| `debug/options.ts` | 19 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `loadout/events.ts` | 19 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `models/creekFootbridge.ts` | 19 | WAITING FOR OPUS; presentation/geometry |
| `models/ziplineLanding.ts` | 19 | WAITING FOR OPUS; presentation/geometry |
| `shard.config.ts` | 19 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `budgets.ts` | 18 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/zipCable.ts` | 18 | WAITING FOR OPUS; presentation/geometry |
| `loadout/effects.ts` | 17 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `look/far.ts` | 16 | WAITING FOR OPUS; presentation/geometry |
| `weapons/longbowProfile.ts` | 16 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/kingLifetime.ts` | 15 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `species/rows.ts` | 15 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/cragCliff.ts` | 14 | WAITING FOR OPUS; presentation/geometry |
| `models/standingStone.ts` | 14 | WAITING FOR OPUS; presentation/geometry |
| `runtime/props/cabinBuild.ts` | 14 | WAITING FOR OPUS; presentation/geometry |
| `world/water.ts` | 14 | WAITING FOR OPUS; geometry; native weather/host kept |
| `look/viewDistance.ts` | 13 | WAITING FOR OPUS; presentation/geometry |
| `models/cragBoulder.ts` | 13 | WAITING FOR OPUS; presentation/geometry |
| `runtime/looks/undergrowthLook.ts` | 13 | WAITING FOR OPUS; presentation/geometry |
| `models/scree.ts` | 12 | WAITING FOR OPUS; presentation/geometry |
| `runtime/viewmodel/handsLook.ts` | 12 | WAITING FOR OPUS; presentation/geometry |
| `runtime/KingGoals.ts` | 11 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/weapons/motion.ts` | 11 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `world/bakeBytes.ts` | 11 | WAITING FOR OPUS; geometry; native weather/host kept |
| `world/context.ts` | 11 | WAITING FOR OPUS; geometry; native weather/host kept |
| `models/beaverDam.ts` | 10 | WAITING FOR OPUS; presentation/geometry |
| `models/canoe.ts` | 10 | WAITING FOR OPUS; presentation/geometry |
| `models/contractBoard.ts` | 10 | WAITING FOR OPUS; presentation/geometry |
| `models/waystone.ts` | 10 | WAITING FOR OPUS; presentation/geometry |
| `quest/content.ts` | 10 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `quest/rifleFloor.ts` | 10 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/rangedVolumes.ts` | 10 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `weapons/crossbow/flight.ts` | 10 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/entryLanes.ts` | 10 | WAITING FOR OPUS; geometry; native weather/host kept |
| `boot/gpuTable.ts` | 9 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `look/dayKeys.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/fern.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/hamletShed.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/huntingLodge.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/millersHouse.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/moss.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/needleLitter.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/pebbles.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/reeds.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/shrub.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/traderStall.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/watermill.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/wineBarrel.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/woodenBucket.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `models/woodenCrate.ts` | 9 | WAITING FOR OPUS; presentation/geometry |
| `quest/graph.ts` | 9 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `models/hatchet.ts` | 8 | WAITING FOR OPUS; presentation/geometry |
| `models/porchLantern.ts` | 8 | WAITING FOR OPUS; presentation/geometry |
| `models/stoneFirePit.ts` | 8 | WAITING FOR OPUS; presentation/geometry |
| `world/heroFiles.ts` | 8 | WAITING FOR OPUS; geometry; native weather/host kept |
| `quest/nightSpec.ts` | 7 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `quest/npcProfiles.ts` | 7 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `quest/npcRig.ts` | 7 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `runtime/landmarkLifetime.ts` | 7 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `species/rigs.ts` | 7 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/eliteStreams.ts` | 6 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `species/hulls.ts` | 6 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `combat/kingTiming.ts` | 5 | KEPT TRUSTED TAIL; native contact/pose/family ports |
| `look/render.ts` | 5 | WAITING FOR OPUS; presentation/geometry |
| `look/skyBackdrop.ts` | 5 | WAITING FOR OPUS; presentation/geometry |
| `quest/benchPose.ts` | 5 | KEPT TRUSTED TAIL; quest/interaction/inventory host |
| `quest/wardensHollow.ts` | 5 | Existing native parser; authored dialogue admitted |
| `items.ts` | 4 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `runtime/audio/profile.ts` | 4 | KEPT TRUSTED TAIL; zone/clock/audio lifetime ports |
| `weapons/longbowFlight.ts` | 4 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `models/creatures.ts` | 3 | WAITING FOR OPUS; presentation/geometry |
| `strings.ts` | 3 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/pond.ts` | 3 | WAITING FOR OPUS; geometry; native weather/host kept |
| `weapons/Longbow.ts` | 2 | KEPT TRUSTED TAIL; native admission/state/restore host |
| `world/treeAssets.ts` | 2 | WAITING FOR OPUS; geometry; native weather/host kept |

## One-user platform attribution

These 19 imported modules total 1,843 lines and remain charged to Pine. A reusable-looking name and the template do not constitute a second user.

| Defining module | Counted lines |
| --- | ---: |
| `src/engine/ai/view/DebugOverlay.ts` | 71 |
| `src/engine/combat/ammo.ts` | 10 |
| `src/engine/combat/view/rangedFeel.ts` | 38 |
| `src/engine/models/glb.ts` | 64 |
| `src/engine/models/hull.ts` | 31 |
| `src/engine/models/interact.ts` | 15 |
| `src/engine/world/faunaLayout.ts` | 77 |
| `src/engine/world/interact/kit.ts` | 2 |
| `src/engine/world/pondGrid.ts` | 4 |
| `src/engine/world/waterSurface.ts` | 303 |
| `src/game/models/pickups.ts` | 86 |
| `src/game/plugin/effects.ts` | 39 |
| `src/game/systems/effects/view.ts` | 32 |
| `src/game/systems/species/deer.ts` | 266 |
| `src/game/systems/species/elk.ts` | 288 |
| `src/game/systems/species/view/bear.ts` | 209 |
| `src/game/systems/species/view/boar.ts` | 219 |
| `src/sdk/bake/rig.ts` | 83 |
| `src/sdk/runtime/effects.ts` | 6 |
