# C1 mixed-loader adoption and remaining inventory

Source baseline `f5a0dbe120e466040e96ecb5d19b555a6a778095`, candidate `8d2808d0c09d0878ff76880183add40f0e7827a8`.

Sky uses the mixed baked-kind loader already used by Signal. Its instanced
branch calls the original builder with unchanged rows, named materials,
attribute aliases, collider rows and decoration callbacks. Frozen callers
keep the old defining API. No geometry, texture or authored output changes.

The isolated native comparison checks original instance matrices, colours,
geometry attributes, indices, materials and callback order. `scripts/w1-c1-parity.mjs compare` passed all 18 phone/desktop poses:
**0 differing pixels**, identical draws, triangles, GPU bytes, programs,
shader sources and collider hashes. [Scalar comparisons](parity.json) retain
the draw/triangle counts. No timing credit is claimed.

The official map retains pixel hash `f7cfd98a`; only its source key changes
to `d989cdac`. After rebasing onto `10e1ab895`, the key and pixels still
match the official capture. The native tape/replay/ledger remain exact
(endpoint 26469, victory 26349, hash `04dd4bf8`). Fourteen focused checks,
narrowed types and touched typed lint pass.

## G291/G294 metric

| Shard | Custom / frozen before | After | C1 before | C1 after |
| --- | ---: | ---: | ---: | ---: |
| Sky | 2710 / 6777 (39.99%) | 2674 / 6777 (39.46%) | 715 | 686 |
| Signal | 1626 / 4122 (39.45%) | 1547 / 4122 (37.53%) | 449 | 370 |

The 36 Sky and 79 Signal lines of sole-user loader declarations lose their
G294 charge because both shipping shards consume the mixed host. No code is
moved into a one-user module and the metric rules are unchanged.

## Exact remaining C1 charge by file

These are the unmodified canonical component classifier counts, including
bindings it attributes to C1 inside files owned by other components. They
are an inventory, not a claim that all of these lines are static drawing.

### Sky

| File | C1 custom lines |
| --- | ---: |
| `src/shards/far-reach/world/build.ts` | 145 |
| `src/shards/far-reach/world/shapes.ts` | 73 |
| `src/shards/far-reach/world/meshes.ts` | 60 |
| `src/shards/far-reach/world/baked.ts` | 48 |
| `src/shards/far-reach/world/storm.ts` | 42 |
| `src/shards/far-reach/runtime/index.ts` | 40 |
| `src/shards/far-reach/world/mill.ts` | 35 |
| `src/shards/far-reach/world/crown.ts` | 26 |
| `src/shards/far-reach/world/meadow.ts` | 26 |
| `src/shards/far-reach/world/isle.ts` | 24 |
| `src/shards/far-reach/layout.ts` | 20 |
| `src/shards/far-reach/world/bookStand.ts` | 18 |
| `src/shards/far-reach/world/skyIsleHd.ts` | 17 |
| `src/shards/far-reach/world/risingIslet.ts` | 16 |
| `src/shards/far-reach/world/trees.ts` | 14 |
| `src/shards/far-reach/world/skyDock.ts` | 12 |
| `src/game/plugin/geometry.ts` | 9 |
| `src/shards/far-reach/models/gear.ts` | 8 |
| `src/shards/far-reach/runtime/headless.ts` | 8 |
| `src/shards/far-reach/world/distant.ts` | 8 |
| `src/shards/far-reach/models/creatures.ts` | 7 |
| `src/shards/far-reach/quest/install.ts` | 5 |
| `src/shards/far-reach/weapons/fanShapes.ts` | 4 |
| `src/shards/far-reach/shard.config.ts` | 3 |
| `src/shards/far-reach/weapons/fanModel.ts` | 3 |
| `src/shards/far-reach/look/render.ts` | 2 |
| `src/shards/far-reach/manifest.ts` | 2 |
| `src/shards/far-reach/quest/keeper.ts` | 2 |
| `src/shards/far-reach/roster.ts` | 2 |
| `src/shards/far-reach/runtime/looks/modelIntake.ts` | 2 |
| `src/shards/far-reach/look/sky.ts` | 1 |
| `src/shards/far-reach/quest/vanes.ts` | 1 |
| `src/shards/far-reach/world/dressing.ts` | 1 |
| `src/shards/far-reach/world/shack.ts` | 1 |
| `src/sdk/looks/modelLibrary.ts` | 1 |
| **Total** | **686** |

### Signal

| File | C1 custom lines |
| --- | ---: |
| `src/shards/sunscar-dunes/world/build.ts` | 92 |
| `src/shards/sunscar-dunes/world/places.ts` | 56 |
| `src/shards/sunscar-dunes/models/gear.ts` | 29 |
| `src/shards/sunscar-dunes/world/baked.ts` | 26 |
| `src/engine/world/bakedTerrainField.ts` | 22 |
| `src/shards/sunscar-dunes/runtime/looks/bakedGround.ts` | 19 |
| `src/shards/sunscar-dunes/world/drapeGround.ts` | 17 |
| `src/shards/sunscar-dunes/world/tower.ts` | 14 |
| `src/shards/sunscar-dunes/plugin.ts` | 13 |
| `src/shards/sunscar-dunes/runtime/looks/duskLook.ts` | 12 |
| `src/engine/render/families/ground.ts` | 12 |
| `src/shards/sunscar-dunes/manifest.ts` | 8 |
| `src/shards/sunscar-dunes/world/meshes.ts` | 7 |
| `src/shards/sunscar-dunes/roster.ts` | 6 |
| `src/game/plugin/simulation.ts` | 6 |
| `src/shards/sunscar-dunes/runtime/signalPlan.ts` | 5 |
| `src/shards/sunscar-dunes/weapons/whipModel.ts` | 5 |
| `src/shards/sunscar-dunes/look/sandEntry.ts` | 4 |
| `src/shards/sunscar-dunes/quest/install.ts` | 4 |
| `src/shards/sunscar-dunes/runtime/items/lashView.ts` | 4 |
| `src/shards/sunscar-dunes/runtime/items/lashHold.ts` | 3 |
| `src/shards/sunscar-dunes/runtime/shardfile/markedBoss.ts` | 2 |
| `src/shards/sunscar-dunes/combat/matriarch.ts` | 1 |
| `src/shards/sunscar-dunes/look/light.ts` | 1 |
| `src/shards/sunscar-dunes/look/render.ts` | 1 |
| `src/shards/sunscar-dunes/runtime/items/lashWeapon.ts` | 1 |
| **Total** | **370** |

## Work remaining

- Sky: authored bridge ropes/ties and hover/winch primitives still build
  geometry on entry in `world/shapes.ts`; baked instance placement and
  material/ownership binding still live in the world adapters.
- Signal: world adapters still assemble baked pieces and hero-model placements.
  Ground query/pool draping and material bindings remain custom; the retired
  dry-well fit, shell/shaft and basic glass constructors are gone.
- World interaction flags, quest prompts and keeper bindings remain C5;
  fire/storm/meadow motion is C3; mover attachment is C7; held models are C6.
  Their C1-tagged binding lines above remain counted until their owners
  actually replace them. There is no bookkeeping reclassification.
- Generic declaration/placement binding must replace both shards' adapters
  before C1 reaches 100/0. Named materials, borrowed textures, root/resource
  ownership, collider registration order and live node handles must remain
  exact. Newly discovered requirements go to C1's queue.

C1 remains **OPEN**; neither shard nor component is claimed complete.
