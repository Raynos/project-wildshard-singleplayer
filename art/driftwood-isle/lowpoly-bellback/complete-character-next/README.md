# Bellback complete-character-next

A complete static model correction for fresh independent comparison against the selected complete-character-pass. Not promoted; no likeness score assigned by the producer.

Editable source: `build_bellback_complete.py`. Native editable geometry: `native-geometry.json` (mesh vertices, polygon faces, material indices, source material names, world matrices and semantic parents). Self-contained export: `bellback-complete-character-next.glb`.

All ten candidate and ten fresh baseline actual Blender renders use the byte-identical retained `capture_review.py`: unchanged camera, framing, lights, samples and dimensions. `paired-captures.json` pins full raw PNGs and exact paired images; compact WebP derivatives do not replace the raw evidence. Approved original hero and correct World/Explorer sheets are pinned in `input-pins.json`. Rear/top anatomy remains an inference from generated sheets, not independently observed reference anatomy.

Checks:
- `check_geometry.py`: source manifoldness, winding, positive component volume, native facet orientation, material slots and flat shading.
- `check_native.py`: actual GLB triangle areas and normals.
- `check_intersections.py`, `check_coplanar.py`, `check_quad_diagonals.py`: self-crossings and overlapping coplanar facets; ordinary cross-component overlap is inventoried, not treated as physics acceptance.
- `check_consumer.py`: import the actual exported GLB through Blender's glTF consumer and compare full source geometry positions.
- `verify.py`: read-only frozen hashes, twenty actual images, camera parity, self-contained buffers, finite attributes, valid indices, unit normals and absent skin/animation assertions.

Build with Blender 4.3.2, two threads, under the shared build lease. Run the source with `-- --out <ignored raw directory>`. Run `capture_review.py` with `-- --source build_bellback_complete.py --out <ignored raw directory> --shots hero` and `--shots nine`. The source exports only the creature, before the review stage is added.

This remains a rigid static asset with seven organizational pivots. No animation clips, skinning, runtime integration, game build, performance, collision, ragdoll or production acceptance is claimed. The specific five-body/four-joint permission remains absent. Selected and failed sources are preserved.
