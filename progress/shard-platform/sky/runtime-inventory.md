# Sky Reach custom runtime inventory

Measured from committed `29b28e7044c320a30190e8edbcd7cfc195310dc2` with `scripts/shard-platform.mjs` (`shardLines` / `codeLines`), excluding comments and blank lines. The frozen denominator is 6,745 lines. Baseline custom runtime is 5,741 lines (85.1%); no one-user game/SDK module is attributed. The 693 raw GLSL lines are included in runtime, not excluded as data. The prior plan table's 74.2% predates the defining move-backs.

The target is 1,349 custom lines (20%). Behavior rows can remove policies and adapters; the remaining static builders and presentation still require authoring outputs. The Roc's phased raptor law is distinct from the shared phased diver. Its native body policy, flock allocation/restore order and prompt LOS gaps remain open.

This is the baseline file inventory; later slice commits report the measured total in their landing messages.

| File under `src/shards/far-reach/` | Custom lines |
|---|---:|
| runtime/index.ts | 322 |
| world/build.ts | 224 |
| runtime/looks/meadowLook.ts | 190 |
| runtime/phasedRaptor.ts | 161 |
| world/risingIslet.ts | 161 |
| runtime/socketLiftProof.ts | 159 |
| runtime/looks/windFx.ts | 142 |
| runtime/headless.ts | 136 |
| world/skyIsleHd.ts | 136 |
| runtime/looks/cloudSeaLook.ts | 130 |
| runtime/weapons/coneFan.ts | 126 |
| quest/keeper.ts | 125 |
| world/isle.ts | 124 |
| runtime/looks/cardField.ts | 123 |
| world/mill.ts | 122 |
| runtime/flock.ts | 115 |
| world/shapes.ts | 115 |
| look/render.ts | 110 |
| runtime/skinnedModel.ts | 99 |
| runtime/looks/modelIntake.ts | 92 |
| runtime/looks/bakedInstances.ts | 89 |
| runtime/looks/stormLook.ts | 86 |
| runtime/looks/shackLook.ts | 82 |
| world/islets.ts | 73 |
| runtime/looks/skyCardsLook.ts | 70 |
| world/meadow.ts | 68 |
| runtime/weapons/coneStrikes.ts | 67 |
| runtime/quest.ts | 66 |
| quest/install.ts | 63 |
| world/swardAtlas.ts | 61 |
| world/distant.ts | 60 |
| boot/files.ts | 59 |
| runtime/looks/isleLook.ts | 57 |
| species/stormRoc.ts | 57 |
| world/storm.ts | 57 |
| species/driftRay.ts | 55 |
| manifest.ts | 52 |
| world/baked.ts | 50 |
| runtime/brains.ts | 49 |
| runtime/fan.ts | 49 |
| runtime/flockBrains.ts | 49 |
| weapons/glove.ts | 47 |
| weapons/fanModel.ts | 46 |
| look/minimap.ts | 45 |
| runtime/looks/dressingLook.ts | 45 |
| species/bodies.ts | 44 |
| world/bookStand.ts | 42 |
| runtime/looks/paintLook.ts | 41 |
| world/trees.ts | 41 |
| runtime/looks/tileField.ts | 40 |
| world/crown.ts | 40 |
| species/skyGoat.ts | 39 |
| world/meshes.ts | 38 |
| runtime/edgeEntries.ts | 37 |
| runtime/looks/wakeRibbon.ts | 37 |
| runtime/persistence.ts | 37 |
| world/dressing.ts | 37 |
| look/sky.ts | 36 |
| runtime/looks/skyDomeLook.ts | 36 |
| runtime/standalone.ts | 36 |
| look/light.ts | 35 |
| runtime/looks/millLook.ts | 35 |
| runtime/phasedRaptors.ts | 35 |
| runtime/stormRocBrain.ts | 32 |
| shard.config.ts | 32 |
| runtime/looks/bridgeLook.ts | 31 |
| runtime/looks/skyIsleLook.ts | 29 |
| species/galeWisp.ts | 29 |
| runtime/roc.ts | 28 |
| species/rig.ts | 28 |
| combat/stormRoc.ts | 26 |
| runtime/headlessMovers.ts | 25 |
| budgets.ts | 24 |
| look/image.ts | 24 |
| look/neutralTone.ts | 23 |
| models/creatures.ts | 23 |
| world/fir.ts | 22 |
| layout.ts | 20 |
| quest/vanes.ts | 20 |
| runtime/movers.ts | 20 |
| runtime/looks/discLayer.ts | 18 |
| runtime/audio/cues.ts | 17 |
| runtime/items.ts | 15 |
| species/goats.ts | 15 |
| budgetCeilings.ts | 13 |
| look/sun.ts | 13 |
| models/gear.ts | 13 |
| runtime/crownLayout.ts | 12 |
| world/skyDock.ts | 12 |
| weapons/fanShapes.ts | 11 |
| world/resources.ts | 11 |
| world/shack.ts | 11 |
| look/cloudSea.ts | 9 |
| runtime/heldBossFight.ts | 9 |
| plugin.ts | 8 |
| runtime/spawns.ts | 8 |
| look/panoramaData.ts | 7 |
| weapons/WarFan.ts | 7 |
| runtime/moverRows.ts | 6 |
| weapons/rows.ts | 6 |
| explore/art.ts | 5 |
| roster.ts | 5 |
| runtime/looks/knollGlsl.ts | 5 |
| runtime/looks/roseFogLook.ts | 5 |
| runtime/strikes.ts | 5 |
| runtime/variants.ts | 5 |
| world/skyIsles.ts | 5 |
| thumbs/card.ts | 4 |
| quest/flags.ts | 2 |

The entry-proof slice removes the two runtime copies (`socketLiftProof.ts`, 159 lines, and `edgeEntries.ts`, 37 lines). Sky now consumes the defining simulation plugin's existing admission proof and engine capsule law. Custom runtime is 5,524 / 6,745 = 81.9%; the 20% target remains open. No one-user platform lines are added.

The retained-boss port had already replaced its trusted preset wrapper. Removing that unreferenced production wrapper removes another nine custom lines: 5,515 / 6,745 = 81.8%. The frozen 10,000-frame retained-body oracle still compares the profile and explicit held-pattern construction directly, including null-body refusal and restore.

## Native creature strike and variant rows

The goat ram, ray dive and wisp burst now use admitted strike rows on the existing native runner; their empty goat motion, world-space sphere contacts, constant weights and every timing/range/damage/tag value remain unchanged. All four variant rows now live in data/, so the headless scale ranges no longer import the wisp's view module. The existing frozen tuning and 10,000-tick runner/restore fixtures, whole native witness/replay/worker/Ledger, actual physics payload and map bytes are exact. No collider or owner changed.

Custom runtime: 5507 / 6745 = 81.6%; the ≤20% target remains open.

## Shared native audio catalogue

Sky's four cue aliases now name the existing shared kit catalogue voices. The native dispatcher no longer constructs its own duplicate voice map. The frozen 270-dispatch oracle and actual kit-recipe comparison preserve surfaces, optional pan/gain, taps, fallback results and scope removal. The full native witness/replay/worker/Ledger and physics/map bytes remain exact.

Custom runtime: 5500 / 6745 = 81.5%; the ≤20% target remains open. No one-user platform code is added.


## Authored file inventory

The model, rig, generated-piece and texture URL declarations now live as JSON data. Native boot policy still owns texture selection and loading order; consumers index the authored records directly. The frozen ordered desktop/phone image/KTX2 boot hash is exact. The actual Node physics payload, whole native witness/replay/shipping-worker/Ledger and official map image bytes are exact; native gameplay boots successfully. Physics provenance and the map input stamp include the defining data file. No collider, owner or platform implementation changed.

Custom runtime: 5451 / 6745 = 80.8%; the ≤20% target remains open.
