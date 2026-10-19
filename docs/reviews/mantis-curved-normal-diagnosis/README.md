# Cervical arch: source-frame fold, not native import damage

2026-10-19. Diagnosis only. Original complete-pass2, native preparation, V7/runtime7, host and engine remain unchanged. Static score remains **3.935/5**, below 4; no admission or visual acceptance is claimed.

## Verdict

The source loft frame reverses at its terminal cervical station. That creates folded, nonplanar source quads. GLB exports the correct source polygon normal, but a single polygon normal cannot agree with both nearly opposed constituent facets. The native six-channel representation faithfully copies that problem. Neither an importer/transform defect nor an arbitrary GLB winding reversal caused it.

`build_mantis_complete.py:30–46` chooses each ring independently using `u = normalize(t × (0,1,0))`, `v = normalize(t × u)`. Its neck profile at lines 87–90 turns from rising to slightly descending:

- Station 5 tangent derives from station 4 → 6: Δ=(0,−0.58,+0.06). Its u points −X.
- Station 6 tangent derives from station 5 → 6: Δ=(0,−0.29,−0.03). Its u points +X.
- Adjacent u dot = **−1**, adjacent v dot = **−0.9788235294**. Rings connect equal corner indices across an unintended half-turn.
- The four unsplit quads in this span are polygons **53, 56, 59, 62**. Other panels in the same span were already authored as triangles by the alternating bark-plane rule. Their own facet normals do not expose the fold through the stored-normal gate; fixing only the four reported triangles would miss the shared root cause.

## Exact opposed-facet identity

All are GLB node 4, object `Rising prothorax curved cervical arch`, assigned to native `neck`. IDs are zero-based. Each listed stored normal is identical at its triangle’s three corners. Full positions, geometric normals, stored normals, materials and companion triangles are in `results.json`.

| Source polygon / boundary vertices | GLB primitive:triangle | Opposed triangle source vertices | Material | Native starting vertex | Stored/facet cosine |
|---|---|---|---|---:|---:|
| 53 / 35,36,43,42 | 0:32 | 36,43,42 | 0 Honey driftwood | 96 | −0.6997748063 |
| 56 / 37,38,45,44 | 1:28 | 38,45,44 | 1 Warm broad wood plane | 231 | −0.8982597841 |
| 59 / 39,40,47,46 | 0:35 | 40,47,46 | 0 Honey driftwood | 105 | −0.8671328424 |
| 62 / 41,35,42,48 | 0:38 | 35,42,48 | 0 Honey driftwood | 114 | −0.7136163622 |

These are genuinely nonplanar: fourth-point distances from the first-three-point plane are respectively **0.009593, 0.005942, 0.008005, 0.011203** source units. More importantly, either diagonal gives nearly opposite facet normals: mutual cosine spans **−0.9983734 to −0.9924100**. Each diagonal leaves one triangle opposed to the source polygon normal. Merely choosing a different diagonal is not a repair.

Stored normals match independently computed source polygon Newell normals to cosine ≥ **0.9999999984** on these four polygons. Recalculating a quad normal will reproduce the conflict; assigning independent triangle normals could conceal it while leaving the twisted surface.

## The 603 deviations are not 603 opposed facets

Independent raw GLB decoding reproduces **603** triangles below .999 stored/facet cosine: **599 non-opposed + 4 opposed**, minimum **−0.8982597841363307**. All 603 normals match their source polygon Newell normals, minimum normalized cosine **0.9999999967910094**. Their polygon sizes are 561 quad-derived triangles, 5 octagon-derived, 3 pentagon-derived and 34 twelve-gon-derived. Thus the broad deviation count is polygon-normal versus tessellated-facet evidence, not evidence of 603 reversed triangles or importer corruption. This audit does not certify all remaining polygons geometrically clean.

## Independent correspondence and consumer evidence

`diagnose.py` uses only Python's standard library. It does not import the adapter, Blender, or the engine. It independently reads binary GLB accessors and the compressed native payload and checks:

- All **89 objects, 255 primitives, 3,052 triangles, 9,156 ordered triangle corners** against exact authored source points and uniquely matching polygon/material ownership.
- Every polygon's n−2 triangle count and signed oriented boundary; no winding reversal or dropped corners.
- Native world points, normals, linear colors, explicit authored joint assignment and exact unit rigid skin weights.
- **22 parts × 6 channels = 132** packed float32/uint16 channels, including furLen, against native JSON; source corner order is unchanged.
- Source-to-GLB basis `(x,y,z) → (x,z,−y)` has determinant +1. Node 4 and its native map both use zero translation; no rotation, scale or matrix can explain this opposition.

Existing real-consumer proof was inspected, not rerun: `complete-pass2-native/native-consumer.test.ts` exercises actual `packedCreatureBodies`, independent THREE.GLTFLoader point/normal/material comparison, rest skinning and joint isolation. `consumer-focused-test.log` records 4/4 passing. Those tests explicitly preserve the four opposed triangles. Passing fidelity tests does not grant strict normal admission, material/visual approval or runtime approval.

## Smallest correct source-level repair to propose

Create a separately named source candidate. Restrict the change to the cervical loft’s frame continuity, preserving the profile centerline, seven-sided cross-section, widths/depths, object identity, face/material assignments and anatomical attachment intent. Carry the previous transverse axis through the next station (projection/parallel transport); for this planar profile, ensuring the next u has positive dot with previous u and recomputing v removes the sign discontinuity. Avoid changing the shared loft behavior for unrelated objects without independent tests.

This is an honest geometry correction, **not** a bit-identical preservation claim: it changes the seven terminal-ring points (42–48) and the incident span/cap surface. With seven corners, a half-turn is not an exact cyclic reindexing of the same point set. Keeping every point, edge and facet unchanged cannot remove the existing fold.

A numeric-only counterfactual reflecting the final ring about its unchanged center models this frame correction. It changes seven vertices, maximum displacement **0.25 source units**; it writes no model. For all four former bad quads, both diagonals then have facet-to-polygon cosine ≥ **0.9998961638**, mutual facet cosine ≥ **0.9996209579**. This supports the repair direction but is not a Blender-export, intersection or appearance acceptance test.

Required before admission:

1. Add a regression for transverse frame continuity through zero vertical tangent, including this exact final span, and inspect the entire repaired span, including its already-triangulated panels and cap.
2. Independently check planar/nonplanar face validity, triangle areas, oriented boundaries, outward orientation, self-intersections and minimum neck thickness. Closed edge counts alone do not detect a folded loft.
3. Regenerate only the new candidate from its construction script, then independently verify permitted vertex changes and unchanged centerline/radii, object/material identity, all other points, pivots and assignments. Recalculate normals from the repaired source geometry, never flip exported values to satisfy admission.
4. Repeat source/GLB/native six-channel correspondence, real consumer/rest/joint tests and the **unchanged strict admission gate**, requiring zero opposed facets. Keep the original failing candidate and its evidence intact; use fresh pins and receipts for the new candidate.
5. Obtain matched visual/silhouette, material, articulation/contact and isolated-arena checks as separately authorized. A normal repair cannot raise the retained 3.935 score, prove motion, or promote runtime7 automatically.

## Reproduce

From repository root:

`python3 docs/reviews/mantis-curved-normal-diagnosis/diagnose.py`

Only sibling `results.json` is written. Input SHA-256 hashes are recorded there. No source/model repairs, render, browser, build, package installation or Git/remote writes were performed. Output folder is under 100 KiB.
