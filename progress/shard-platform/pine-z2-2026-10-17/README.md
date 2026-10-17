# Pine named model placements

Pine's hero landmarks and forest scatter now consume named `world/scenes`
placements. The same scene-handle registry owns deferred construction and its
published root/collider handles. Ordered world assembly still selects when each
named set is placed. Place sets are admitted JSON, generated from the authored
POIs, rather than a runtime table.

The paired C1 producers preserve the original hero vertex/index channels,
coarse hulls, open/closed arch shapes and material payloads. Scatter geometry
keeps native typed attributes, original cull spheres, Float32 uploads and
original local hull/capsule descriptors. Native engine placement carries those
contacts into the world, retaining Chromium's exact rotation conversion.
Public material-only GLBs use the existing
native decoder and asset aliases; embedded images remain ordinary image data.
Source slots can load at their named placement, retaining native material
construction order. Cull rows declare numeric phone/desktop distances and
angular thresholds without shard-specific tier fields in the host.

The native engine places the baked local collider descriptors at the baked
matrices. Serializing Node's final world yaw changed three upright rock
angles by one floating-point unit against Chromium, despite exact
Node-to-Node producer proofs. Keeping the existing native placement path
avoids a shard precision adapter and preserves the browser's descriptors.

Eight whole shard modules disappear: `world/places.ts`, runtime `world/hero.ts`
and `world/props.ts`, and runtime models `waystone.ts`, `caveArch.ts`,
`mossyBoulder.ts`, `treeStump.ts` and `fallenLog.ts`.

Timber landmarks, cabin welds and their living-building adapter remain counted.
Crags and geography belong to the C1 bake lane. Light animation,
canoe visibility and gameplay remain in Pine's existing presentation modules.

## Host bar

The Z2 extension scores **6/6 under the G483 approved-platform exception**;
without that exception its current real-adopter score is **5/6, failing only
user count**. Nalati is the named pending user; the fixture exercises a second
independent content set. Native typed-channel decoding is extracted from the
existing whole-library path and is also used by owned geometry.

| Test | Evidence |
|---|---|
| 1. Users / approved feature | G483; `lint/platform-pending-users.json` entries for `worldScenePlacement.ts` and `worldSceneMaterials.ts`; `test/world-scenes-platform.test.ts:190`, `:234`, `:258` |
| 2. No shard nouns | Generic schemas in `src/format/worldScenePlacement.ts:13` and `src/format/worldSceneModels.ts:20`; hosts import only platform types |
| 3. Rows drive differences | `src/format/worldScenes.ts:17`, `:43`; `src/game/models/worldSceneCatalogue.ts:108` |
| 4. Client-only presentation | `src/game/shardfile/worldScenePlacement.ts:18`, `src/game/shardfile/worldSceneMaterials.ts:13`; schemas and native attribute decoding are server-safe |
| 5. Keep without Pine | Native LOD/placement/culling and source PBR intake preserve arbitrary catalogue rows; generic fixture at `test/world-scenes-platform.test.ts:190` |
| 6. Data-only API | `src/format/worldSceneModels.ts:20`, `src/format/worldScenePlacement.ts:7`, `:15`; named accessors in `src/game/shardfile/worldScenes.ts:26` |

## Validation

The keyed-sky integration pair compares `2671d4556` (source-equivalent to
landed parent `b90201ec9`) with candidate `e1c0a6c14`. All 20 views
(12 world poses and eight creature views) have identical pixels, draws,
triangles, GPU bytes, shader/program sets and collider descriptors.
The candidate passes all ten products, root/layer types, typed lint and 34
focused cases including all 17 shard-headless cases.
Receipt: [native-proof.json](native-proof.json), proof-run
`20261017T175845-sp-x9-keyed-final-58168` (code/native pass; its initial desktop
floor missed at p95 33.4 ms). The follow-up paired desktop floor at 240 frames
per pose compares the same source builds back-to-back and does not regress:
parent worst p95 16.8 ms, candidate 16.8 ms;
minimum median fps 59.88 / 59.88.
Receipt: `20261017T181030-sp-x9-floor-pair-36953`.

The earlier native pair's physics walk passes seven legs with zero stuck legs.
Its collider hash is identical to the final keyed candidate on both tiers;
no collider path changed between these proofs. Receipt: proof-run
`20261017T171513-sp-x9-native-pair-56053`.

The final current-parent source check at `d94df1ecc` also passes all ten
products, root/layer types, typed lint and all 34 focused/headless cases.
Receipt: proof-run `20261017T183453-sp-x9-freeze-final-71987`.

## Source measurement

The build mirror measures candidate `d94df1ecc` after generating all ten
products. Its before inventory was measured at
`3bd0eca85`, source-equivalent to canonical parent `37e814b28`.
Pine changes from
6,626 to 6,294 custom source lines (-332). Net platform source,
including format, changes by +194 lines. AssemblyScript remains 433 of the
2,130-line ceiling. [lines.json](lines.json) records every shard and component.

net -363 shard lines (driftwood-isle -31, pine-hollow -332)

G490 assigns the combined clean map bake and strict freshness gate to sp-x10
after the batch sources land; this source commit carries no map stamp refresh.
