# G227 original scatter source capture

This closes the source-data gap recorded in the [static assignment](nalati-static-assignment/README.md),
without emitting tiles or changing the live drawing/placement path.

`DressLayer.captureSource()` and `captureDressLayerSource(actualMesh)` return independent copies of the real
layer's original Float32 arrays in original instance order:

| Field | Layout |
| --- | --- |
| `matrices` | 16 components per copy, including original yaw, lean and scale |
| `colours` | 3 linear RGB multipliers per copy |
| `spheres` | 4 values per copy: original XYZ and source bounding radius |
| `ranges` | 1 effective, tier-scaled distance per copy |
| `rangeScale` | The constructor's selected range multiplier, already included in `ranges` |
| `cellSize`, `keepNear`, `fadeStart` | Actual visibility parameters; fade begins at .82 of the range |

Only actual mesh identity resolves a source. The identity map is weak; no scene traversal, guessed model name,
placement planner rerun or copied cull output supplies the data. Source arrays already existed for drawing;
the new owned copies are allocated only when explicitly requested by the offline capture. These are the source
values for the selected capture tier, not a claim that tier-specific geometry/range differences can be discarded.

The owned inventory includes these arrays in `mesh.scatter`. The CLI hashes each original array independently
from the live front buffer and records lengths plus visibility parameters. All ten actual scatter drawers have
complete original sources while their initial visible counts are zero. The original pinned inventory contains
36,553 scatter copies; none may be filtered out because of that initial cull state.

`assignNalatiMeshes` now returns `scatter-source` for a supplied complete source header. Older captures still
return `scatter-source-required`; a source population different from the drawer capacity refuses. Packing must
consume the actual source arrays, preserve tints/visibility behaviour and use the shared catalogue/packer.

Validation: **13/13** focused tests across the source port, owned inventory, assignments and real Node capture CLI.
The source fixture checks a rotated/leaned/nonuniformly scaled copy in the shrink-fade band plus an out-of-range
copy. Culling changes the live population/matrix but leaves both original sources intact; caller mutation, source
list mutation and geometry disposal cannot alter later captures. The CLI proves all ten sources have exact array
lengths, original matrix hashes different from their empty live buffers, and zero pending source assignments.
Root strict typecheck and scoped typed lint passed. No material, geometry, collider or live boot change.

Combined static tile packing, the material catalogue, far proxy and complete product admission/parity remain.
