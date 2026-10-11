# Pine non-graphical port inventory

Status: **open**, transitional; the trusted runtime still owns simulation.

## Metric and first slice

G291/G294/G304/G306/G312: baseline **21,932 / 21,155 = 103.67%**; after quest/inventory metadata **21,898 / 21,155 = 103.51%**. The numerator is 20,055 shard runtime lines plus 1,843 one-user platform lines. The 576 inline GLSL lines already belong to runtime TS, so the additional GLSL charge is zero. AssemblyScript is report-only: 270 lines. The frozen legacy revision is `8e297137b940f50da7f1949106d5576f80f238ca`. Neither the 20% nor complete emitted-content gate passes.

The existing declared ledger and bag now read the same authored feat/reward/slot rows from `data/questInventory.ts`; the runtime keeps the item predicate and all gameplay laws. The root feat module is deleted. All row values, insertion order, glyphs, local-save ids and travel policy compare exactly with the frozen source. This removes 34 counted metadata lines; it introduces no platform law or facade.

Proof: 69 focused data/save/ledger/pack tests, 14 native witness/replay/ledger/physics/spots tests, strict and typed touched lint passed. Four actual witness recorders produced byte-identical payloads. Two actual physics captures matched all payload fields (164 actors, 3 King prewarm states, 2,078 world solids); the actual 44-row spots capture and independent check matched. No collider changed, so this slice does not create a new physics-walk milestone. The map is recaptured by the official producer because the generator import changed; its WebP is byte-identical: 95,600 bytes, SHA-256 `e7cc19e10f905c377c9b0a61e64aec5d95dff3eff504198b877b3f058b3dea09`.

## Quest and dialogue rows

The seven-step chapter, external flag lists and Hale/Brandt/Mott dialogue trees now live in `data/wardensHollow.ts`. The native module keeps the same admission parser for each tree. Flag timing, dialogue ordering, night wait, King/dawn rewards and all scene side effects stay with their existing owners. The obsolete URL-jump comment now names the real Settings Debug row. This removes 129 runtime metadata lines. Frozen row/tree equality and authoring closure checks plus 48 quest/dialogue tests, strict and typed touched lint passed; actual physics/44 spots and all four witness payloads remain exact. The map inputs and shipped image are unchanged.

Current metric: **21,769 / 21,155 = 102.90%** (19,926 shard + 1,843 one-user platform; 258 primary files). Transitional, compatibility and the content gate are unchanged.

## Ownership and remaining work

- **WAITING FOR OPUS:** figures, materials/shaders, viewmodels, cards/sky/weather rendering, terrain/forest/building geometry and HUD presentation. Mixed files keep their gameplay portion until a data row can express it; this label never exempts custom lines.
- **KEPT TRUSTED TAILS:** Pine-specific harvest/lodge/trader/refight/quest sequencing, native weapon-contact adapters, posed King ownership, persistence/migrations and weather/world seams without an equivalent shared row. No new one-user platform system will hide them.
- **ROW REVIEW:** remaining authored quest/dialogue, contract/trade and profile literals can be separated from their native laws, then existing row hosts can replace code only under exact gameplay proofs.
- **RESERVED sp-x6:** directors, night/clock, elite prelude and coats; import-only changes are coordinated and their laws are unchanged.

## Counted primary files

This complete table reproduces the 19,926-line shard numerator; data/generators, tests, generated output and the frozen folder are excluded. A mixed renderer/runtime owner is labelled with both responsibilities.

| File | Counted lines | Owner disposition |
| --- | ---: | --- |
| `life/index.ts` | 730 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/items/boltCrossbow.ts` | 562 | KEPT TRUSTED TAIL / row-host review |
| `quest/index.ts` | 558 | KEPT TRUSTED TAIL / row-host review |
| `runtime/items/leverFirearm.ts` | 479 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/keyedSky.ts` | 451 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/rainFx.ts` | 328 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/antlerKing.ts` | 326 | KEPT TRUSTED TAIL / row-host review |
| `combat/eliteScripts.ts` | 325 | RESERVED sp-x6 |
| `runtime/looks/riggedHulls.ts` | 323 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/viewmodel/gloveHands.ts` | 323 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/props/bakedBuilding.ts` | 322 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/quest.ts` | 306 | KEPT TRUSTED TAIL / row-host review |
| `runtime/viewmodel/staveBow.ts` | 294 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/LeverRifle.ts` | 292 | KEPT TRUSTED TAIL / row-host review |
| `runtime/compendium/trophyWall.ts` | 265 | WAITING FOR OPUS; mixed gameplay kept |
| `world/landmarks.ts` | 252 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/ambience.ts` | 236 | KEPT TRUSTED TAIL / row-host review |
| `runtime/roster.ts` | 236 | KEPT TRUSTED TAIL / row-host review |
| `runtime/index.ts` | 233 | KEPT TRUSTED TAIL / row-host review |
| `runtime/species/limbRig.ts` | 232 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/crossbow/Crossbow.ts` | 219 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kit/caveInterior.ts` | 205 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/audio/sfx.ts` | 203 | KEPT TRUSTED TAIL / row-host review |
| `loadout/loadout.ts` | 196 | KEPT TRUSTED TAIL / row-host review |
| `world/homestead.ts` | 189 | KEPT TRUSTED TAIL / row-host review |
| `runtime/headless.ts` | 186 | KEPT TRUSTED TAIL / row-host review |
| `world/crags.ts` | 180 | KEPT TRUSTED TAIL / row-host review |
| `runtime/nightDirector.ts` | 171 | RESERVED sp-x6 |
| `runtime/looks/groundCover.ts` | 169 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/cragLook.ts` | 165 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/kit/heldTool.ts` | 162 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/cabinLook.ts` | 160 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/king.ts` | 157 | KEPT TRUSTED TAIL / row-host review |
| `world/weather.ts` | 157 | KEPT TRUSTED TAIL / row-host review |
| `layout.ts` | 156 | KEPT TRUSTED TAIL / row-host review |
| `combat/install.ts` | 155 | KEPT TRUSTED TAIL / row-host review |
| `life/birdModels.ts` | 150 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/contracts.ts` | 150 | ROW REVIEW; native law stays |
| `runtime/audio/score.ts` | 146 | KEPT TRUSTED TAIL / row-host review |
| `runtime/species/kingClips.ts` | 146 | WAITING FOR OPUS; mixed gameplay kept |
| `life/birdFix.ts` | 142 | WAITING FOR OPUS; mixed gameplay kept |
| `models/antlerKing.ts` | 142 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/props/buildingLife.ts` | 141 | WAITING FOR OPUS; mixed gameplay kept |
| `world/terrain.ts` | 141 | KEPT TRUSTED TAIL / row-host review |
| `models/wildlife.ts` | 139 | WAITING FOR OPUS; mixed gameplay kept |
| `manifest.ts` | 138 | KEPT TRUSTED TAIL / row-host review |
| `combat/kingFight.ts` | 136 | KEPT TRUSTED TAIL / row-host review |
| `runtime/npc/standInPerson.ts` | 135 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/weatherLook.ts` | 134 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/ui.ts` | 128 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/headlessLongbow.ts` | 124 | KEPT TRUSTED TAIL / row-host review |
| `runtime/elites.ts` | 123 | KEPT TRUSTED TAIL / row-host review |
| `combat/kingRig.ts` | 121 | KEPT TRUSTED TAIL / row-host review |
| `loadout/skins.ts` | 119 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/posedInstances.ts` | 119 | WAITING FOR OPUS; mixed gameplay kept |
| `compendium.ts` | 118 | ROW REVIEW; native law stays |
| `quest/rides.ts` | 118 | KEPT TRUSTED TAIL / row-host review |
| `runtime/weapons/headlessCrossbow.ts` | 116 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kit/peopleLook.ts` | 107 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/stuckArrows.ts` | 107 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/keyedSkyDay.ts` | 104 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/rainShelter.ts` | 104 | KEPT TRUSTED TAIL / row-host review |
| `weapons/leverAction.ts` | 102 | KEPT TRUSTED TAIL / row-host review |
| `quest/npcModels.ts` | 100 | WAITING FOR OPUS; mixed gameplay kept |
| `world/streams.ts` | 95 | KEPT TRUSTED TAIL / row-host review |
| `combat/fxKit.ts` | 94 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/wiring.ts` | 93 | KEPT TRUSTED TAIL / row-host review |
| `runtime/weapons/headlessRanged.ts` | 91 | KEPT TRUSTED TAIL / row-host review |
| `world/beaverPool.ts` | 91 | KEPT TRUSTED TAIL / row-host review |
| `weapons/equipment.ts` | 88 | KEPT TRUSTED TAIL / row-host review |
| `world/logKit.ts` | 88 | KEPT TRUSTED TAIL / row-host review |
| `models/logCabin.ts` | 87 | WAITING FOR OPUS; mixed gameplay kept |
| `world/timber.ts` | 86 | KEPT TRUSTED TAIL / row-host review |
| `quest/stagLead.ts` | 83 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kingPoseHost.ts` | 82 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kingPoseKeeper.ts` | 82 | KEPT TRUSTED TAIL / row-host review |
| `world/cabins.ts` | 82 | KEPT TRUSTED TAIL / row-host review |
| `world/cragBake.ts` | 80 | KEPT TRUSTED TAIL / row-host review |
| `world/treeFactory.ts` | 80 | KEPT TRUSTED TAIL / row-host review |
| `runtime/lodge.ts` | 78 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/forestLook.ts` | 78 | WAITING FOR OPUS; mixed gameplay kept |
| `models/people.ts` | 75 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/headlessLever.ts` | 75 | KEPT TRUSTED TAIL / row-host review |
| `boot/files.ts` | 71 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/synth.ts` | 69 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kingQueryPose.ts` | 69 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/sky.ts` | 69 | WAITING FOR OPUS; mixed gameplay kept |
| `world/weatherProfile.ts` | 69 | KEPT TRUSTED TAIL / row-host review |
| `runtime/species/herdShelter.ts` | 67 | WAITING FOR OPUS; mixed gameplay kept |
| `models/hollowLog.ts` | 66 | WAITING FOR OPUS; mixed gameplay kept |
| `combat/ctx.ts` | 65 | KEPT TRUSTED TAIL / row-host review |
| `combat/elites.ts` | 65 | KEPT TRUSTED TAIL / row-host review |
| `models/gear.ts` | 65 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/wildlifeLook.ts` | 65 | WAITING FOR OPUS; mixed gameplay kept |
| `life/trunks.ts` | 62 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/trades.ts` | 61 | ROW REVIEW; native law stays |
| `combat/eliteRoster.ts` | 60 | KEPT TRUSTED TAIL / row-host review |
| `models/caveArch.ts` | 58 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/kit/primitiveParts.ts` | 58 | WAITING FOR OPUS; mixed gameplay kept |
| `combat/lane.ts` | 56 | KEPT TRUSTED TAIL / row-host review |
| `quest/featLaw.ts` | 55 | KEPT TRUSTED TAIL / row-host review |
| `runtime/people.ts` | 55 | KEPT TRUSTED TAIL / row-host review |
| `combat/combatMath.ts` | 54 | KEPT TRUSTED TAIL / row-host review |
| `quest/nightThralls.ts` | 52 | KEPT TRUSTED TAIL / row-host review |
| `plugin.ts` | 51 | KEPT TRUSTED TAIL / row-host review |
| `runtime/questLifetime.ts` | 51 | KEPT TRUSTED TAIL / row-host review |
| `world/timberBake.ts` | 51 | KEPT TRUSTED TAIL / row-host review |
| `quest/table.ts` | 50 | KEPT TRUSTED TAIL / row-host review |
| `runtime/air.ts` | 50 | KEPT TRUSTED TAIL / row-host review |
| `runtime/cull/batchedLod.ts` | 50 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/kit/glbNodes.ts` | 50 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/keyedSkyRows.ts` | 50 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/weapons/headlessLoadout.ts` | 50 | KEPT TRUSTED TAIL / row-host review |
| `world/timberSites.ts` | 50 | KEPT TRUSTED TAIL / row-host review |
| `loadout/ammo.ts` | 49 | KEPT TRUSTED TAIL / row-host review |
| `models/forestTree.ts` | 49 | WAITING FOR OPUS; mixed gameplay kept |
| `dev/perfLap.ts` | 48 | KEPT TRUSTED TAIL / row-host review |
| `runtime/weapons/ammunition.ts` | 48 | KEPT TRUSTED TAIL / row-host review |
| `world/props.ts` | 48 | KEPT TRUSTED TAIL / row-host review |
| `models/birds.ts` | 47 | WAITING FOR OPUS; mixed gameplay kept |
| `world/drawnModels.ts` | 47 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/nightPopulation.ts` | 46 | RESERVED sp-x6 |
| `runtime/directorClock.ts` | 45 | RESERVED sp-x6 |
| `runtime/items.ts` | 45 | KEPT TRUSTED TAIL / row-host review |
| `runtime/entries.ts` | 44 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kingQueryView.ts` | 44 | KEPT TRUSTED TAIL / row-host review |
| `runtime/quest/npcDialogue.ts` | 44 | KEPT TRUSTED TAIL / row-host review |
| `world/cabinBake.ts` | 44 | KEPT TRUSTED TAIL / row-host review |
| `combat/chargeTells.ts` | 43 | KEPT TRUSTED TAIL / row-host review |
| `runtime/looks/streamLook.ts` | 43 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/trader.ts` | 43 | KEPT TRUSTED TAIL / row-host review |
| `models/fallenLog.ts` | 42 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/elitePrelude.ts` | 42 | RESERVED sp-x6 |
| `runtime/kingCollision.ts` | 41 | KEPT TRUSTED TAIL / row-host review |
| `runtime/dialogue.ts` | 40 | KEPT TRUSTED TAIL / row-host review |
| `quest/stagWalk.ts` | 39 | KEPT TRUSTED TAIL / row-host review |
| `species/looks.ts` | 39 | KEPT TRUSTED TAIL / row-host review |
| `world/places.ts` | 39 | KEPT TRUSTED TAIL / row-host review |
| `models/mossyBoulder.ts` | 38 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/zipWire.ts` | 36 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/audio/files.ts` | 36 | KEPT TRUSTED TAIL / row-host review |
| `combat/strikes.ts` | 34 | KEPT TRUSTED TAIL / row-host review |
| `life/lifeMath.ts` | 34 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/herds.ts` | 34 | KEPT TRUSTED TAIL / row-host review |
| `weapons/crossbow/display.ts` | 34 | WAITING FOR OPUS; mixed gameplay kept |
| `models/fireLookout.ts` | 33 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/kingCollisionBake.ts` | 33 | KEPT TRUSTED TAIL / row-host review |
| `weapons/longbowView.ts` | 33 | WAITING FOR OPUS; mixed gameplay kept |
| `loadout/finishes.ts` | 32 | WAITING FOR OPUS; mixed gameplay kept |
| `models/tokenShelf.ts` | 32 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/viewmodel/longbowLook.ts` | 32 | WAITING FOR OPUS; mixed gameplay kept |
| `world/undergrowthKit.ts` | 32 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kit/hullSpots.ts` | 31 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/tokenShelf.ts` | 30 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/pack.ts` | 30 | KEPT TRUSTED TAIL / row-host review |
| `runtime/weapons/gustClock.ts` | 30 | KEPT TRUSTED TAIL / row-host review |
| `quest/beats.ts` | 29 | KEPT TRUSTED TAIL / row-host review |
| `world/cragKit.ts` | 29 | KEPT TRUSTED TAIL / row-host review |
| `runtime/fauna.ts` | 28 | KEPT TRUSTED TAIL / row-host review |
| `weapons/crossbow/profiles.ts` | 28 | KEPT TRUSTED TAIL / row-host review |
| `world/hero.ts` | 28 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kit/skinningKnifeLook.ts` | 27 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/riseParticles.ts` | 27 | WAITING FOR OPUS; mixed gameplay kept |
| `world/treeSet.ts` | 26 | KEPT TRUSTED TAIL / row-host review |
| `budgetCeilings.ts` | 25 | KEPT TRUSTED TAIL / row-host review |
| `runtime/brains/eliteBrains.ts` | 25 | KEPT TRUSTED TAIL / row-host review |
| `runtime/persistence.ts` | 25 | KEPT TRUSTED TAIL / row-host review |
| `world/cabinKit.ts` | 25 | KEPT TRUSTED TAIL / row-host review |
| `runtime/combatService.ts` | 24 | KEPT TRUSTED TAIL / row-host review |
| `combat/spawns.ts` | 23 | KEPT TRUSTED TAIL / row-host review |
| `quest/hollowLog.ts` | 23 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/entered.ts` | 23 | KEPT TRUSTED TAIL / row-host review |
| `compendium/install.ts` | 22 | KEPT TRUSTED TAIL / row-host review |
| `models/skinningKnife.ts` | 22 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/facts.ts` | 22 | KEPT TRUSTED TAIL / row-host review |
| `boot/steps.ts` | 21 | KEPT TRUSTED TAIL / row-host review |
| `models/treeStump.ts` | 21 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/mossOverlay.ts` | 21 | WAITING FOR OPUS; mixed gameplay kept |
| `roster.ts` | 20 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/combatCues.ts` | 20 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kit/lodGlb.ts` | 20 | WAITING FOR OPUS; mixed gameplay kept |
| `species/thrall.ts` | 20 | KEPT TRUSTED TAIL / row-host review |
| `world/undergrowth.ts` | 20 | KEPT TRUSTED TAIL / row-host review |
| `debug/options.ts` | 19 | KEPT TRUSTED TAIL / row-host review |
| `loadout/events.ts` | 19 | KEPT TRUSTED TAIL / row-host review |
| `models/creekFootbridge.ts` | 19 | WAITING FOR OPUS; mixed gameplay kept |
| `models/ziplineLanding.ts` | 19 | WAITING FOR OPUS; mixed gameplay kept |
| `shard.config.ts` | 19 | KEPT TRUSTED TAIL / row-host review |
| `budgets.ts` | 18 | KEPT TRUSTED TAIL / row-host review |
| `models/zipCable.ts` | 18 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/graph.ts` | 18 | KEPT TRUSTED TAIL / row-host review |
| `loadout/effects.ts` | 17 | KEPT TRUSTED TAIL / row-host review |
| `look/far.ts` | 16 | WAITING FOR OPUS; mixed gameplay kept |
| `weapons/longbowProfile.ts` | 16 | KEPT TRUSTED TAIL / row-host review |
| `runtime/kingLifetime.ts` | 15 | KEPT TRUSTED TAIL / row-host review |
| `species/rows.ts` | 15 | KEPT TRUSTED TAIL / row-host review |
| `models/cragCliff.ts` | 14 | WAITING FOR OPUS; mixed gameplay kept |
| `models/standingStone.ts` | 14 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/props/cabinBuild.ts` | 14 | WAITING FOR OPUS; mixed gameplay kept |
| `world/water.ts` | 14 | KEPT TRUSTED TAIL / row-host review |
| `look/viewDistance.ts` | 13 | WAITING FOR OPUS; mixed gameplay kept |
| `models/cragBoulder.ts` | 13 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/looks/undergrowthLook.ts` | 13 | WAITING FOR OPUS; mixed gameplay kept |
| `models/scree.ts` | 12 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/viewmodel/handsLook.ts` | 12 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/KingGoals.ts` | 11 | KEPT TRUSTED TAIL / row-host review |
| `runtime/weapons/motion.ts` | 11 | KEPT TRUSTED TAIL / row-host review |
| `world/bakeBytes.ts` | 11 | KEPT TRUSTED TAIL / row-host review |
| `world/context.ts` | 11 | KEPT TRUSTED TAIL / row-host review |
| `models/beaverDam.ts` | 10 | WAITING FOR OPUS; mixed gameplay kept |
| `models/canoe.ts` | 10 | WAITING FOR OPUS; mixed gameplay kept |
| `models/contractBoard.ts` | 10 | WAITING FOR OPUS; mixed gameplay kept |
| `models/waystone.ts` | 10 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/content.ts` | 10 | ROW REVIEW; native law stays |
| `quest/rifleFloor.ts` | 10 | KEPT TRUSTED TAIL / row-host review |
| `runtime/rangedVolumes.ts` | 10 | KEPT TRUSTED TAIL / row-host review |
| `weapons/crossbow/flight.ts` | 10 | KEPT TRUSTED TAIL / row-host review |
| `world/entryLanes.ts` | 10 | KEPT TRUSTED TAIL / row-host review |
| `boot/gpuTable.ts` | 9 | KEPT TRUSTED TAIL / row-host review |
| `look/dayKeys.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/fern.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/hamletShed.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/huntingLodge.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/millersHouse.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/moss.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/needleLitter.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/pebbles.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/reeds.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/shrub.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/traderStall.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/watermill.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/wineBarrel.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/woodenBucket.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/woodenCrate.ts` | 9 | WAITING FOR OPUS; mixed gameplay kept |
| `models/hatchet.ts` | 8 | WAITING FOR OPUS; mixed gameplay kept |
| `models/porchLantern.ts` | 8 | WAITING FOR OPUS; mixed gameplay kept |
| `models/stoneFirePit.ts` | 8 | WAITING FOR OPUS; mixed gameplay kept |
| `world/heroFiles.ts` | 8 | KEPT TRUSTED TAIL / row-host review |
| `quest/nightSpec.ts` | 7 | ROW REVIEW; native law stays |
| `quest/npcProfiles.ts` | 7 | ROW REVIEW; native law stays |
| `quest/npcRig.ts` | 7 | WAITING FOR OPUS; mixed gameplay kept |
| `runtime/landmarkLifetime.ts` | 7 | KEPT TRUSTED TAIL / row-host review |
| `species/rigs.ts` | 7 | KEPT TRUSTED TAIL / row-host review |
| `combat/eliteStreams.ts` | 6 | KEPT TRUSTED TAIL / row-host review |
| `species/hulls.ts` | 6 | KEPT TRUSTED TAIL / row-host review |
| `combat/kingTiming.ts` | 5 | KEPT TRUSTED TAIL / row-host review |
| `look/render.ts` | 5 | WAITING FOR OPUS; mixed gameplay kept |
| `look/skyBackdrop.ts` | 5 | WAITING FOR OPUS; mixed gameplay kept |
| `quest/benchPose.ts` | 5 | ROW REVIEW; native law stays |
| `quest/wardensHollow.ts` | 5 | Existing native parser; authored rows admitted |
| `items.ts` | 4 | KEPT TRUSTED TAIL / row-host review |
| `runtime/audio/profile.ts` | 4 | ROW REVIEW; native law stays |
| `weapons/longbowFlight.ts` | 4 | KEPT TRUSTED TAIL / row-host review |
| `models/creatures.ts` | 3 | WAITING FOR OPUS; mixed gameplay kept |
| `strings.ts` | 3 | KEPT TRUSTED TAIL / row-host review |
| `world/pond.ts` | 3 | KEPT TRUSTED TAIL / row-host review |
| `weapons/Longbow.ts` | 2 | KEPT TRUSTED TAIL / row-host review |
| `world/treeAssets.ts` | 2 | KEPT TRUSTED TAIL / row-host review |

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
