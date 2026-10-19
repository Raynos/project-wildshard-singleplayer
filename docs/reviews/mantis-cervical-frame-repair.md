# Mantis cervical-frame repair candidate

2026-10-19. Separate source candidate, structural-only. Historical static score remains **3.935/5**. No likeness, material, animation, contact, arena or runtime acceptance; no promotion.

## Result

The source half-turn is removed. Full editable builder, usable GLB, portable mesh, explicit 22-bone/89-object mapping, native JSON and six-channel packed asset live in `art/driftwood-isle/lowpoly-mantis/cervical-frame-repair/`. Original complete-pass2, its failing native pack and runtime7 remain untouched. No heavy renders, browser, engine, AI, Site, STATE or remote writes.

Strict native tuple/source-normal admission: **PASS, STRUCTURAL_ONLY**, zero opposed facets. Independent source/GLB/packed proof checks 89 objects, 3,052 triangles, 9,156 corners, 132 channels. Remaining 595 polygon-normal/facet deviations are non-opposed; minimum cosine 0.3485399854984324. Real unmodified consumer tests 4/4; Python tests 7/7; actual builder-frame regression passes five positive/zero/negative vertical-tangent cases.

## Exact repair

Only `Rising prothorax curved cervical arch` opts into `continuous_frame=True`; shared loft defaults remain unchanged. Start with the original tangent and reference-cross transverse axis. For each subsequent station choose the axis sign with positive dot to previous u; near reference-axis singularity project previous u into the new tangent plane, then normalize. Recompute v=normalize(t cross u). The exact planar profile keeps u=-X throughout. At station 6 both original transverse axes change sign. Centerline, widths/depths, seven-sided section, face/material lists, all 20 static pivots, native rig and every other object remain exact.

Maximum point displacement **0.25 source units**. Only vertex IDs 42–48 change. The adjacent span is station 5→6 (vertices 35–41→42–48), source polygons 53–62; terminal cap 64 also changes. Polygon 63 is the unchanged basal cap.

| Vertex | Before (Blender XYZ) | After (Blender XYZ) | Displacement |
|---|---|---|---|
| 42 | [0.125, -0.8899999856948853, 2.549999952316284] | [-0.125, -0.8899999856948853, 2.549999952316284] | 0.25 |
| 43 | [0.07793622463941574, -0.8984472155570984, 2.6316564083099365] | [-0.07793622463941574, -0.8815527558326721, 2.468343496322632] | 0.226390703067 |
| 44 | [-0.027815116569399834, -0.9005334973335266, 2.6518239974975586] | [0.027815116569399834, -0.8794664740562439, 2.4481759071350098] | 0.212158165097 |
| 45 | [-0.11262110620737076, -0.894687831401825, 2.595315933227539] | [0.11262110620737076, -0.8853121399879456, 2.5046839714050293] | 0.242973476632 |
| 46 | [-0.11262110620737076, -0.8853121399879456, 2.5046839714050293] | [0.11262110620737076, -0.894687831401825, 2.595315933227539] | 0.242973476632 |
| 47 | [-0.027815116569399834, -0.8794664740562439, 2.4481759071350098] | [0.027815116569399834, -0.9005334973335266, 2.6518239974975586] | 0.212158165097 |
| 48 | [0.07793622463941574, -0.8815527558326721, 2.468343496322632] | [-0.07793622463941574, -0.8984472155570984, 2.6316564083099365] | 0.226390703067 |

No normals were flipped or patched, no faces deleted and no triangulation rule changed. Blender recalculates the authored polygon normals normally. Its unchanged tessellator naturally picks the other diagonals for four repaired quads (eight ordered triangles; `triangulation-delta.json`). This is not used to conceal the fold: independent checks prove **both** diagonals of each repaired quad have positive near-unity polygon agreement. All polygon oriented boundaries and n−2 counts remain exact.

## Geometry and intersection evidence

Minimum triangle area: 1.38312110138e-06; all 94 neck triangles have positive outward orientation (minimum radial/cap cosine 0.914570646271); positive enclosed volume 0.117585332559. Zero non-adjacent neck triangle intersections, including coplanar tests. Minimum station-section support thickness lower bound 0.18920346226; this is a section bound, not an assertion about all surface clearances.

Cross-object incident triangle intersections are deliberately reported. Before: skull 33 pairs. After: skull 24, rear collar +1 10, rear collar −1 12, pale throat 8. These are raw triangle-pair overlaps in layered anatomy, not a contact or articulation approval. No unrelated overlays were moved to hide these results. Adjacent/shared-vertex self-intersection pairs are excluded; exact frame/radius, oriented-manifold, outward and both-diagonal checks cover the repaired adjacent panels.

## Reproduce

From repository root, run the candidate builder through the shared build lease with Blender 4.3.2 (no --render), then `export_native.py`, `admit_native.py`, `check_geometry.py`, `check_independent_correspondence.py`; run `python3 -m unittest discover -s art/driftwood-isle/lowpoly-mantis/cervical-frame-repair -p test_export_native.py -v`; execute `test_frame_blender.py` in Blender through the same lease. Real consumer: `node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/lowpoly-mantis/cervical-frame-repair/vitest.config.ts art/driftwood-isle/lowpoly-mantis/cervical-frame-repair/native-consumer.test.ts`.

Use HOME=$PWD/tmp/home, PATH=$PWD/tmp/dot-audit/bin:$PATH, WS_HEAVY_ROOT=$PWD/tmp/heavy-lanes. Input pins bind exact original and candidate identities; closure binds exporter and output tuple. `validation.json` records local focused results. No full suite, render, visual review or arena run is claimed. The editable script replaces the need to retain a generated .blend.
