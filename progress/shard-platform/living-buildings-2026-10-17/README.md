# Living buildings: G474 / G475

Pine's doors, lanterns, wheel, hearth clouds and pooled site lighting use
the game building hosts. Driftwood's camp smoke, shrine fireflies and
day/night shrine pulse use the same resource, cloud and life contracts.
The authored differences are JSON rows; native resource publication remains
counted migration wiring until Z2 builds the static scene resources.

Whole runtime modules removed together with their working replacements:

- Pine: `props/bakedBuilding.ts`, `props/buildingLife.ts`,
  `props/cabinBuild.ts`.
- Driftwood: `looks/smokeColumn.ts`, `world/Shrine.ts`.

Doors retain their prompts, reversible eased motion and moving collision
leaves. The host registers leaves with the engine registry; moving leaves
stay passable until motion stops and the player clears the hinge radius.
Stable door/wheel ids preserve direction, progress, rearm state and wheel
phase through SaveStore continuation. New Game fences stale checkpoints.

## Host bar

The four game modules and their format rows score **6/6**. Assembly uses
G474's approved-platform exception for test 1, registered for Nalati SF48
with an end-of-W3 recheck in `lint/platform-pending-users.json:1795`.

| Test | Evidence |
|---|---|
| 1. Real users / approved feature | Pine `src/shards/pine-hollow/runtime/world/homestead.ts:200`; Driftwood `src/shards/driftwood-isle/world/build.ts:143`; approval `lint/platform-pending-users.json:1795` |
| 2. No shard nouns or identity branches | Generic resource types `src/game/shardfile/sceneResources.ts:4`; generic life declaration `src/game/shardfile/livingBuildings.ts:28`; generic assembly `src/game/shardfile/buildingAssembly.ts:11` |
| 3. Data driven | Bounded look/door/light rows `src/format/buildings.ts:111`; id-based assembly rows `src/format/buildings.ts:88` |
| 4. Client presentation explicitly labelled | `src/game/shardfile/livingBuildings.ts:28`, `src/game/shardfile/buildingAssembly.ts:11`, `src/game/shardfile/buildingCloud.ts:6` |
| 5. Keep after deleting the first shard | Independent outward tower gate, blue lamp and counterwheel `test/living-buildings-platform.test.ts:15`; Driftwood shrine and clouds remain real users `src/shards/driftwood-isle/world/build.ts:143` |
| 6. Data-only API | Typed engine resource loans `src/game/shardfile/sceneResources.ts:14`; JSON admission `src/game/shardfile/livingBuildings.ts:66`; format admission `src/format/buildings.ts:139`; no shard callback, subclass override or owner/path reflection |

Static construction adapters remain in Pine's `cabinBake.ts` / homestead
and Driftwood's world build. Z2 can publish the same named resource ids.
This commit adds no AssemblyScript and changes no art direction.

## Source ruler

Measured in the build mirror with `scripts/shard-platform.mjs`, including
its `sourceProgressInventory()` component spans and sole-user charges.
Source base: `f4e0c85ae`; validated source: `203417d3d`.
Landing parent `5bc1385f9` differs from the measured source base
only in tests and documentation. No source span, import or
custom section changes.

| Source-basis custom lines | Before | After | Net |
|---|---:|---:|---:|
| Pine Hollow | 8,821 | 8,438 | -383 |
| Driftwood Isle | 5,551 | 5,523 | -28 |
| Both shards | 14,372 | 13,961 | **-411** |

The G455 engine/game/SDK source ruler grows **464 lines**: engine
+6, game +458, SDK 0. The format validator adds another 141 code
lines, reported separately because G455 excludes format. Total shared
source growth including format is 605 lines. This first adoption
therefore adds shared code overall while cutting shard code.
AssemblyScript is Pine 351/2,130 and Driftwood 96/1,716.
This migration adds no AssemblyScript.

| Component delta | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Pine | -261 | -36 | -58 | 0 | 0 | 0 | -19 | -1 | -8 |
| Driftwood | -17 | -9 | 0 | 0 | +2 | 0 | 0 | 0 | -4 |

## Verification

[Compact parity, physics and map evidence](proof.json) retains the
before/after hashes and route results without frame traces or save data.

- Root and layer types, typed lint, all ten shardfile products, and all
  35 focused cases pass, including the 17 shard-headless cases.
- Scenarios cover prompted reversal, native door audio scope, moving leaf
  rearm, save continuation in a fresh SaveStore, instance isolation and
  stale checkpoint refusal after New Game. Different outward gate,
  blue lamps, counterwheel, day/night pulse and both cloud formats pass.
- The official Pine physics walk passes all seven routes with **0 stuck**:
  cabin porch, pond, lookout climb, zip landing, creek bridge, lodge porch
  and den cave (`d022e7c-mvcpy4aa`, 143 seconds).
- All eight building poses are **pixel-identical (SSIM 1)** between
  `a87394b-mvcpawvm` and `d022e7c-mvcpy4aa`: Pine cabin and watermill,
  Driftwood hut/camp smoke and shrine, each at midday and night.
  Collider-description hashes match throughout. Six draw/triangle counts
  match exactly; two telemetry counts vary despite identical pixels.
  The pose harness uses an iPhone 16 Pro context, DPR 2, Metal, muted,
  fixed capture clock and the real 3D scene. This paired proof predates
  the unrelated contracts landing; living-building presentation and
  collider code are unchanged in the combined validated tree.
- Official map bakes used served combined trees: Driftwood `2d8656aea`
  and Pine `203417d3d`, the latter including the landed spawn director.
  Fully regenerating the final source confirms both capture input hashes
  and WebP hashes. The WebP bytes are unchanged; fresh genuine stamps
  land with the source migration. Clean tooling paths pass as well.
