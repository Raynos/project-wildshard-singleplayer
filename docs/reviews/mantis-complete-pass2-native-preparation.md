# Mantis complete-pass2 native preparation

2026-10-19. Candidate-only integration preparation; no promotion.

## Result

Exact geometry/rig preparation and real consumer correspondence pass. **Strict clean-normal admission fails**: four source triangles in `Rising prothorax curved cervical arch` have stored source normals opposed to their winding. They remain unchanged. No geometry, winding or normals were repaired to manufacture admission.

The independent static score remains **3.935/5**, below 4.0. This work does not reassess likeness, motion, world contact, rendering, performance or gameplay.

All outputs live in `art/driftwood-isle/lowpoly-mantis/complete-pass2-native/`. Source complete-pass2, V7/native/runtime7, shared engine, AI, tactics, current host and public Site were not edited. No render, browser, app build, Git operation or remote write was performed.

## Explicit mapping

`authored-mapping.json` is the editable authored contract: all 89 mesh object names, all 20 static joint labels, every native assignment and all 22 parent/pivot rows are literal. There are no prefix/suffix guesses or fallback assignments.

The seven parts rejected by the previous semantic adapter now explicitly bind rigidly to `neck`:

- Integrated pale throat
- Overlapping dorsal curved neck shell 0, 1, 2 and 3
- Curved lateral chest splinter -1 and 1

The 20 static pivots are copied exactly from the candidate metrics. Two extra pivots are newly authored from explicit source profile attachment stations: neck `(0, .36, 1.40)` and abdomen `(0, .14, 1.47)` in Blender space. Head and both raptorial roots have parent `neck`; all other parents are literal rows. This is new native rigid weighting, not a claim that static labels already supplied a rig.

Coordinates transform `(x,y,z)` in Blender to `(x,z,-y)` in native space, determinant +1. GLB axes are already native axes. Only translation-only GLB transforms are supported; rotation, scale, matrices, nested mesh parents, external buffers and unknown channels are refused. Bones use absolute identity-oriented rest pivots. Local parent offsets reconstruct those exact rest positions.

## Source-to-native proof

The candidate adapter pins construction source, GLB, portable mesh, metrics, old mapping limits, new authored mapping and both imported audited helper sources. Old V7 source/GLB pins remain unchanged; a test proves the old exporter refuses this candidate.

Counts: **89 source objects, 255 material primitives, 3,052 ordered triangles, 9,156 triangle-soup vertices, 22 bones and 22 rigid batches**.

Checks cover:

- Every source point, with exact float values and complete point-set coverage.
- Every GLB triangle's unique authored polygon and material ownership.
- Each source polygon's `n-2` triangulation count and complete oriented boundary, with internal triangle edges canceled. No decimation, reordering of triangle corners or winding repair.
- Linear material region colors and opaque roughness/metallic source response.
- World translations, all source NORMAL values, and exact one-bone unit weights.
- Every packed channel's float32/uint16 binary roundtrip and complete ordered partition ranges.
- Independent GLTFLoader comparison of every triangle, normal, color and world point.
- Actual unmodified `packedCreatureBodies` copies, including normal attributes, and actual THREE skin bind/rest preservation plus every joint/descendant isolation.

The V7 helper's pack omits normals. This candidate instead writes an explicit normal channel using the existing generic packed-body format. The unmodified consumer already accepts and retains it. No shared schema/engine exemption was added. `mantis-native.json` is an ordinary native asset, not raw source embedded in a backup. `payload.bin` is the standard compressed packed-body asset, not an archive or source-storage workaround.

## Preserved failure

`normal-audit.json`, `admission.json` and `admission-test.log` retain the complete failed normal-orientation evidence, including positions, source normals, material, source polygon, node, primitive and triangle IDs. Source node 4 has opposed normals at primitive 0 triangles 32, 35 and 38, and primitive 1 triangle 28. Minimum cosine is **-0.8982597841363307**. There are **603** source-vs-facet deviations at cosine < .999, including these four.

`admit_native.py` verifies the exact output tuple, rebuilds geometry correspondence and fails closed with exit 1 on these opposed source triangles. This failure is intentional evidence, not a failed exporter or hidden test exception. Correspondence and source-normal preservation pass; clean source-normal orientation does not. Any later geometry correction requires a separate candidate and fresh evidence.

## Test commands

Run from repository root:

- `python3 art/driftwood-isle/lowpoly-mantis/complete-pass2-native/export_native.py`
- `python3 -m unittest discover -s art/driftwood-isle/lowpoly-mantis/complete-pass2-native -p test_export_native.py -v`
- `node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-mantis/complete-pass2-native/vitest.config.ts art/driftwood-isle/lowpoly-mantis/complete-pass2-native/native-consumer.test.ts`
- `python3 art/driftwood-isle/lowpoly-mantis/complete-pass2-native/admit_native.py` (expected exit 1)

Focused test results and exact file hashes are in `validation.json`. Logs retain the initial pnpm launcher setup failure and the explicit-file-selection correction: pnpm tried to initialize unavailable local storage; direct Vitest without a file selector was correctly refused by the full-suite gate. The final command is an ordinary focused run; no heavy-lane bypass or package installation was used.

## Unproved boundaries

Conservative diagnostic hull dimensions are freshly computed and remain test-only. Feet stay in explicit source order; runtime7 foot-order/contact tuning has not been inherited. Toon material appearance, double-sidedness, articulation intersections, collision, motion, contact, performance and isolated arena behavior remain untested here. CPU skin-joint isolation is not animation acceptance. All acceptance and promotion flags remain false.
