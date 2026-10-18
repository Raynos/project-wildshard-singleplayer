# Driftwood world assembly rows

Three whole runtime modules leave together with their data paths:

- `world/sites.ts`: computed static facts move to `generators/worldSites.ts`.
  The world product declares ocean settings, bridge span and ordered pier
  scene handles in `custom/fixedLayouts.assembly`. Existing generators use
  the same build-only source facts; runtime reads admitted rows.
- `world/places.ts`: authored `data/placeSets.json` ships as validated
  `world/place-sets.json`. The existing place-set host retains live named
  locations and whole Wreck membership in the quest installer.
- `world/gpuOnlyCopies.ts`: the world builder supplies explicit native
  roots to the engine's static-tree upload helper. There is no reflected
  field registry or traversal of the complete scene.

The world builder retains its counted view/stage wiring: live water,
bridge physics, flocks, wind, cover and sky updates remain shard view
code. The live sea clipping still follows the grid water extent and shore
inset; the generic declared-water adapter currently has different bounds,
so this landing preserves that counted view code. Bridge rest-fact intake
still validates the active terrain before posing its live chain.
The entry removes only the old GPU-copy wrapper import/call; peer
catalogue and page-life changes are composed independently.

Post-generation source-basis mirror ruler: DW **3,681 → 3,596**,
net **−85** shard lines. Pine remains 4,800; DW AssemblyScript stays 119.
Types, typed lint, all ten products, path/model guards and 39 focused tests
(including 17 headless cases) pass. Native phone/desktop poses and site
views match exactly in 28 captures; eight walk legs report zero stuck.

## Upload helper: HOST-BAR 6/6

1. Two real shard users in this landing: Driftwood's explicit world roots
   (`src/shards/driftwood-isle/world/build.ts:271`) and Template's admitted
   terrain (`src/shards/_template/generators/product.ts:47`) through
   `src/game/shardfile/clientViews.ts:72` and
   `src/engine/world/terrainTileView.ts:129`.
2. Engine-only vocabulary and mesh/geometry rules:
   `src/engine/core/gpuOnly.ts:60`.
3. Explicit native root arrays, label and retained attribute names:
   `src/engine/core/gpuOnly.ts:65`.
4. Client-only presentation label:
   `src/engine/core/gpuOnly.ts:62`.
5. Terrain tiles retain this helper if the first world vanishes:
   `src/engine/world/terrainTileView.ts:129`.
6. Native resources and attribute names, no shard callback or reflected
   owner paths: `src/engine/core/gpuOnly.ts:65`.

Memory behavior stays the same: shared geometries once; static attributes
only; positions and indices kept; skinned/morphing meshes and dynamic
attributes kept; bounds computed before upload; existing context-loss
reload. The existing node/GPU test covers those retained readers and
shared/duplicate roots. Terrain tiles use the helper in the same position
before first upload, with the same retained attributes.

## Frame sampling

`--standing-poses=beach,wreck` selects authored standing cameras in that
order for both sides of paired measurements. Spawn remains measured.
The default heaviest-camera scan is unchanged. Missing, duplicate or
malformed requested names fail instead of silently comparing other views.

Pinned quiet ABBA used base/candidate/candidate/base, 180 frames at
spawn plus the identical authored beach and wreck cameras on both
surfaces. Repo build/test work was drained; personal background apps
were left untouched. Simulator milliseconds are diagnostic under G415.

| Surface / pose | Base fps / p95 ms | Candidate fps / p95 ms |
|---|---:|---:|
| desktop / spawn | 59.880 / 16.75 | 59.880 / 16.70 |
| desktop / beach | 59.880 / 16.75 | 59.880 / 16.70 |
| desktop / wreck | 59.880 / 16.75 | 59.880 / 16.70 |
| sim / spawn | 30.303 / 43.50 | 30.303 / 44.00 |
| sim / beach | 30.303 / 50.00 | 30.303 / 46.50 |
| sim / wreck | 30.303 / 45.50 | 30.303 / 44.00 |

Every paired sample completed with zero skipped frames and context
losses; CPU and maximum-frame checks passed. The receipt retains each
run and each floor verdict; no Simulator timing gate is inferred.

Final ninth source gate: `be3467b3dab248a81f779ca8086640d3c721cf0f`.
Post-gen DW 3681 -> 3596 (-85); Pine 4800 unchanged; DW AS 119.
Platform runtime +13; generators +36 source lines outside the custom
ruler (G467). Root/layer/scripts types, typed lint, all10, 39 tests
including 17 headless, paths and models pass.
