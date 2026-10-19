# Puffer complete closed-anatomy study

Unaccepted complete static construction. No score, quality increment, runtime admission or animation claim. Actual retained pass2 is the base; rejected pass3 and bowl revision are preserved untouched. V70 playable, public assets, engine and pins are unchanged.

## Capture byte-provenance limitation

All actual render pixels are retained, but the PNG files are **losslessly re-encoded, not Blender byte-originals**. To meet the initial 15 MiB budget, a lossless job began before the coordinator's later 16 MiB exception arrived. Every image's decoded pixel SHA-256, mode and dimensions were checked equal before replacement. `lossless-png-receipt.json` records that proof and pre/post sizes. Original encoded copies and pre-encoding byte hashes were not retained; they cannot now be claimed. The failed baseline-only launch image is also retained with identical pixels. No replacement rerender was performed.

## Audit and source

Inspected the approved original pixels and actual retained pass2 hero before construction. Read the independent pass2 review, pass3 failure diagnosis and bowl-revision construction. The reference has a hanging rounded cream bowl, angular sheltered face, and visible shoulder/crown spikes. Pass2 has better volume than the failed later reconstruction but a squared pouch and persistent courses.

Editable constructor and complete native source are in `art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/`. `build_candidate.py` reads actual retained pass2, not a renamed pass3. The script plus native JSON are the editable Blender/native source; `render_matched.py` recreates real Blender geometry without a saved `.blend`.

## Complete anatomy

The existing closed 1,022-triangle body hull is retained and continuously reshaped. Lower pouch corners taper inward, outer forward cheeks retreat while the central front stays projected, and the central lower bowl hangs farther down. Side courses sweep diagonally through the shoulders; this is explicitly a volume map, not retopology or a claim that all course rhythm is solved. Crown apex, spikes and upper face assembly are unchanged. Maximum hull vertex displacement is 0.1360 source units; volume changes from 1.22370 to 1.20466, retaining 98.4% of pass2 volume. Those metrics earn no likeness credit.

The four inherited open sheets are now individually closed solids: a 0.022-thick palate, 0.024-thick tongue, and two 0.009-thick nostril inserts. Their original exposed front triangles are exact. Reverse caps and side walls add 55 triangles. No double-sided material, invisible topology waiver, replacement overlaid proxy or whole-body voxelization is used.

All eight spike coordinates, body brow/beak components, tail, all four fins and eight bind joints are exact to pass2. The original head front arrays remain exact. The output is a complete seven-part, eight-joint model, not a small isolated brow, toe or pouch study.

## Technical validation

- `geometry-audit.json`: 116/116 checks pass. Every exact-coordinate connected component is closed, consistently oriented, nondegenerate and positive-volume, in native precision and exported float32 precision. Thirteen finite spike/tail/fin root sample sets are inside the actual changed hull. All 1,022 body triangles retain their original normal hemisphere. A local deformation limiter protects 19 exact shared vertices of narrow semantic-cut facets; minimum normal dot is 0.2835. Initial unconstrained deformations failed that test and were corrected before final capture.
- `glb-roundtrip-audit.json`: 46/46 attribute, absolute bind pivot, inverse bind, single-sided material and size checks pass.
- Complete GLB: 636,280 bytes; 10,458 vertices; 3,486 triangles; seven semantic parts; eight joints.
- `crossing-audit.json`: nine nonadjacent transverse hull crossings occur in retained pass2 and the same nine pairs in this study; zero new crossing pairs. These inherited intersections remain a geometry blocker. The test excludes coplanar overlap and intentionally overlapping separate parts.
- Component closure is not an intersection-free solid certification. Finite root samples do not prove continuous attachment, animation deformation, collider validity or runtime culling. No such claims are made.

## Capture status

All twenty matched actual captures completed in 98.92 seconds. The shared render slot is released. `output-closure.json` verifies 77/77 source, renderer, image, camera-match and budget checks. Every new candidate view was inspected individually: the central bowl remains projected and the spike silhouette survives, but the side cream-cheek facets remain pinched and teal course rhythm remains visible. This is a construction observation, not a score or acceptance. No independent likeness result exists for this geometry. Pass2's historical 3.80 remains attached only to pass2; it is not transferred to the new construction.

## Reproduction

Run `build_candidate.py`, `audit_geometry.py`, `export_glb.py`, and `audit_glb_roundtrip.py` with Python and numpy. Run Blender `render_matched.py --candidate <closed-anatomy-native.json> --out <fresh output directory>` only under the coordinator's shared render slot. Capture produces matched pass2 and new geometry at the retained 600×740 cameras, 24 samples, AgX and three area lights. Pixel-identical losslessly re-encoded actual PNG captures and labelled capped WebP previews are retained through independent review (see byte-provenance limitation); no `.blend` is saved.
