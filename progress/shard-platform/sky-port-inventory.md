# Sky Reach port inventory

Measured at `5985020fe` in the clean private export after the Rising Islet slice.

**78.3%: 5,284 custom runtime lines / 6,745 frozen legacy lines. FAIL; target is 1,349 lines.** One-user platform attribution is zero. Raw GLSL is 693 lines, already included in the runtime numerator. No generated data enters the numerator. The table uses the same generated/header exclusions and parser comment removal as `scripts/shard-platform.mjs`; its file counts sum to 5,284.

Completed non-graphical slices consume the defining quest graph, encounter stages, grazer/diver/burst policies, species/strike/variant/spawn rows, weapon-family registration, audio catalogue, native mover/mode rows and cached SDK Entry/SocketLift authoring. No compatibility flag was changed by these ports.

## Remaining ownership

| Category | Lines | Treatment |
|---|---:|---|
| Graphical | 3,630 | WAITING FOR OPUS: world/view geometry, materials, raw GLSL, skinning, lighting and presentation. |
| Mixed view + binding | 551 | Extract the view portion only with its graphical owner; native ports and initialization order remain real. |
| Native/admission/binding | 802 | Already composes admitted rows or owns physics, continuation, registration and effects. Counted as custom; not claimed removable by moving files. |
| Phased raptor | 194 | Local Roc policy, contract and adapter; no matching canonical policy. |
| Finite roster | 107 | Real spawn/RNG/body-band/restore keeper; existing shared homes have different lifecycle semantics. |

The two remaining substantive non-graphical laws are not graphical waiting items. The Roc needs perch/return/takeoff, circle/stalk/strike/rest, all three readiness laws, player/actor height and altitude steering up to 20 m/s. The existing phased-flyer is circle/dive/climb/grounded; script-species does not expose the flight observation/output ports and caps speed at 15 m/s. The canonical flight/AS boundary is being coordinated with sp-x5. The finite keeper has eight initial flyers, five goats on the first fixed-post step, six native stream draws per arrival, legacy body bands, no respawn and exact late allocation order on restore; the current shared home lifecycle is not interchangeable. Neither owner was relocated to a one-user platform module.

No claim that every non-graphical owner is closed, or that graphics alone guarantees 20%. The mixed files need a measured split; native laws remain counted until an actual row/AS port replaces them.

## Gate evidence

- Frozen layout oracle, persisted JSON, shared cache cold/warm/forced comparison and static world bake are byte-identical.
- Whole native witness, codec/replay/shipping-worker suffix, effects, facts and Ledger are exact. Physics payload and native entry walk/ride outcomes are unchanged.
- Official map image is byte-identical; real Developer gameplay boot passed. Collider layouts did not change.
- Focused authoring/entry/body contracts, root strict and touched typed lint passed. Current-HEAD Node fence passed before CAS.
- Retained generator: `src/shards/far-reach/generators/risingIslets.ts`. The cheap generated JSON remains ignored; `scripts/generation-jobs.json` pins its build output SHA.

## File inventory

Paths are relative to `src/shards/far-reach/`.

| File | Counted lines | Remaining owner |
|---|---:|---|
| `runtime/index.ts` | 322 | Mixed view + native binding |
| `world/build.ts` | 224 | WAITING FOR OPUS |
| `runtime/looks/meadowLook.ts` | 190 | WAITING FOR OPUS |
| `world/risingIslet.ts` | 162 | WAITING FOR OPUS |
| `runtime/looks/windFx.ts` | 142 | WAITING FOR OPUS |
| `runtime/phasedRaptor.ts` | 140 | Native phased-raptor capability gap |
| `world/skyIsleHd.ts` | 136 | WAITING FOR OPUS |
| `runtime/headless.ts` | 135 | Native/admission/binding |
| `runtime/looks/cloudSeaLook.ts` | 130 | WAITING FOR OPUS |
| `runtime/weapons/coneFan.ts` | 126 | Mixed view + native binding |
| `world/isle.ts` | 124 | WAITING FOR OPUS |
| `runtime/looks/cardField.ts` | 123 | WAITING FOR OPUS |
| `world/mill.ts` | 122 | WAITING FOR OPUS |
| `world/shapes.ts` | 115 | WAITING FOR OPUS |
| `quest/keeper.ts` | 114 | WAITING FOR OPUS |
| `look/render.ts` | 110 | WAITING FOR OPUS |
| `runtime/flock.ts` | 107 | Native finite-roster authority |
| `runtime/skinnedModel.ts` | 99 | WAITING FOR OPUS |
| `runtime/looks/modelIntake.ts` | 92 | WAITING FOR OPUS |
| `runtime/looks/bakedInstances.ts` | 89 | WAITING FOR OPUS |
| `runtime/looks/stormLook.ts` | 86 | WAITING FOR OPUS |
| `runtime/looks/shackLook.ts` | 82 | WAITING FOR OPUS |
| `runtime/looks/skyCardsLook.ts` | 70 | WAITING FOR OPUS |
| `world/meadow.ts` | 68 | WAITING FOR OPUS |
| `runtime/weapons/coneStrikes.ts` | 67 | Native/admission/binding |
| `world/swardAtlas.ts` | 61 | WAITING FOR OPUS |
| `manifest.ts` | 60 | Native/admission/binding |
| `world/distant.ts` | 60 | WAITING FOR OPUS |
| `runtime/quest.ts` | 59 | Native/admission/binding |
| `runtime/looks/isleLook.ts` | 57 | WAITING FOR OPUS |
| `species/stormRoc.ts` | 57 | WAITING FOR OPUS |
| `world/storm.ts` | 57 | WAITING FOR OPUS |
| `quest/install.ts` | 55 | Mixed view + native binding |
| `species/driftRay.ts` | 51 | WAITING FOR OPUS |
| `runtime/fan.ts` | 49 | Native/admission/binding |
| `weapons/glove.ts` | 47 | WAITING FOR OPUS |
| `weapons/fanModel.ts` | 46 | WAITING FOR OPUS |
| `look/minimap.ts` | 45 | WAITING FOR OPUS |
| `runtime/looks/dressingLook.ts` | 45 | WAITING FOR OPUS |
| `species/bodies.ts` | 44 | WAITING FOR OPUS |
| `runtime/flockBrains.ts` | 42 | Native/admission/binding |
| `world/bookStand.ts` | 42 | WAITING FOR OPUS |
| `runtime/looks/paintLook.ts` | 41 | WAITING FOR OPUS |
| `world/trees.ts` | 41 | WAITING FOR OPUS |
| `runtime/looks/tileField.ts` | 40 | WAITING FOR OPUS |
| `world/crown.ts` | 40 | WAITING FOR OPUS |
| `world/meshes.ts` | 38 | WAITING FOR OPUS |
| `runtime/looks/wakeRibbon.ts` | 37 | WAITING FOR OPUS |
| `runtime/persistence.ts` | 37 | Native/admission/binding |
| `species/skyGoat.ts` | 37 | WAITING FOR OPUS |
| `world/dressing.ts` | 37 | WAITING FOR OPUS |
| `look/sky.ts` | 36 | WAITING FOR OPUS |
| `runtime/looks/skyDomeLook.ts` | 36 | WAITING FOR OPUS |
| `look/light.ts` | 35 | WAITING FOR OPUS |
| `runtime/looks/millLook.ts` | 35 | WAITING FOR OPUS |
| `runtime/brains.ts` | 34 | Native/admission/binding |
| `runtime/phasedRaptors.ts` | 34 | Native phased-raptor capability gap |
| `shard.config.ts` | 33 | Native/admission/binding |
| `runtime/looks/bridgeLook.ts` | 31 | WAITING FOR OPUS |
| `runtime/looks/skyIsleLook.ts` | 29 | WAITING FOR OPUS |
| `runtime/roc.ts` | 28 | Native/admission/binding |
| `species/rig.ts` | 28 | Mixed view + native binding |
| `combat/stormRoc.ts` | 26 | Native/admission/binding |
| `budgets.ts` | 24 | Native/admission/binding |
| `look/image.ts` | 24 | WAITING FOR OPUS |
| `species/galeWisp.ts` | 24 | WAITING FOR OPUS |
| `look/neutralTone.ts` | 23 | WAITING FOR OPUS |
| `models/creatures.ts` | 23 | WAITING FOR OPUS |
| `world/fir.ts` | 22 | WAITING FOR OPUS |
| `layout.ts` | 20 | Native/admission/binding |
| `quest/vanes.ts` | 20 | Mixed view + native binding |
| `runtime/movers.ts` | 20 | Native/admission/binding |
| `runtime/stormRocBrain.ts` | 20 | Native phased-raptor capability gap |
| `runtime/standalone.ts` | 19 | Native/admission/binding |
| `runtime/headlessMovers.ts` | 18 | Native/admission/binding |
| `runtime/looks/discLayer.ts` | 18 | WAITING FOR OPUS |
| `world/islets.ts` | 16 | Native/admission/binding |
| `runtime/items.ts` | 15 | Native/admission/binding |
| `budgetCeilings.ts` | 13 | Native/admission/binding |
| `look/sun.ts` | 13 | WAITING FOR OPUS |
| `models/gear.ts` | 13 | WAITING FOR OPUS |
| `world/skyDock.ts` | 12 | WAITING FOR OPUS |
| `species/goats.ts` | 11 | Native/admission/binding |
| `weapons/fanShapes.ts` | 11 | WAITING FOR OPUS |
| `world/resources.ts` | 11 | Native/admission/binding |
| `world/shack.ts` | 11 | WAITING FOR OPUS |
| `runtime/audio/cues.ts` | 10 | Native/admission/binding |
| `look/cloudSea.ts` | 9 | WAITING FOR OPUS |
| `plugin.ts` | 8 | Native/admission/binding |
| `runtime/spawns.ts` | 8 | Native/admission/binding |
| `runtime/brainCatalogue.ts` | 7 | Native/admission/binding |
| `weapons/WarFan.ts` | 7 | Native/admission/binding |
| `runtime/moverRows.ts` | 6 | Native/admission/binding |
| `runtime/strikes.ts` | 6 | Native/admission/binding |
| `weapons/rows.ts` | 6 | Native/admission/binding |
| `explore/art.ts` | 5 | WAITING FOR OPUS |
| `roster.ts` | 5 | Native/admission/binding |
| `runtime/looks/knollGlsl.ts` | 5 | WAITING FOR OPUS |
| `runtime/looks/roseFogLook.ts` | 5 | WAITING FOR OPUS |
| `world/skyIsles.ts` | 5 | WAITING FOR OPUS |
| `thumbs/card.ts` | 4 | WAITING FOR OPUS |
| `quest/flags.ts` | 2 | Native/admission/binding |
