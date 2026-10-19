# Colossus pass4 independent static review

## Verdict

**77.1/100 weighted likeness. Prefer pass4 narrowly over retained pass1 for further development; do not call this an original-likeness acceptance.** No gameplay, rig, animation or performance acceptance.

The blind score was written to `blind-score.json` before viewing the predecessor, reading closure/construction prose or historical scores. The approved original and ten candidate full raw PNGs were individually opened. Then all ten retained pass1 full raw PNGs were individually opened and the comparison frozen in `comparison-frozen.md`. Only afterward were author documentation and audit receipts read. Historical review scores were not consulted.

| Criterion | Score | Weight | Contribution |
| --- | ---: | ---: | ---: |
| Silhouette | 77 | 35% | 26.95 |
| Face | 76 | 30% | 22.80 |
| Details | 75 | 20% | 15.00 |
| Facets | 83 | 15% | 12.45 |
| Total | | | 77.10 |

No rounding up and no structural-test credit. The large catalogue figure is the main reference; the reference's small side/back thumbnails offer limited guidance for hidden surfaces.

Pass4 is unmistakably the intended wood guardian, but recognizability is not close shape fidelity. The main deficits are the smooth long beak instead of layered wooden cheek/jaw planes, narrow hooked fingers instead of massive root-loop hands, an orderly rib cage instead of interlocking irregular trunk roots, and chunky canopy slabs. Facets fit the low-poly language, but the core and repeated wood profiles are too simple. The cyan back sliver is visible in the raw rear image.

Pass4 improves the predecessor's highly repetitive foliage collars, opens up the wood anatomy and gives the shoulder mantle a less uniform distribution. Pass1 is stronger in dense cascading vegetation, especially from behind; pass4's lengthened separated fingers and wider crown do not improve original likeness. This is a small overall preference with real regressions, not evidence that each intended construction change worked.

## Frozen identity verification

- Final closure SHA-256: `cc7877e81e7703ac4fdf2701024edcbd552eb14832b0e7c1151977e13d08b50c`.
- Final GLB SHA-256: `fb9f593dfa1d1f82259b79429795e355d0736a0977dab73316744041e7ea5fb2`.
- Producer SHA-256: `4ac78cfb86d5cc48f7ed71ed955fc9ca1389d8dcceff2b37a0078eadf8a83693`.
- Verified every file record in final closure, source closure, capture receipt and input preservation: 63 unique paths, no missing files or size/hash mismatches. This includes all 20 reviewed raw images and both final GLB copies.
- All ten recorded camera pairs match position, target and orthographic scale. Reviewed raw images are 525x700. The renderer source sets the stated shared lighting, 16 samples, no denoising and Standard transform.
- Source/metrics/GLB/capture records are internally consistent. Hash consistency is not an independently repeated render; no build or render was run.

Full per-path verification is in `identity-checks.json`.

## Geometry audit: what was actually checked

Read the validator and reran it read-only against the pinned GLB, writing only this review's `geometry-recheck.json`. The result exactly matches the frozen validation JSON: 157 meshes, 613 material primitives, 4,836 triangles, finite primitive attributes and valid indices; zero reported welded boundary/nonmanifold edges, winding conflicts, zero-area triangles and nonpositive mesh volumes. Zero skins and animations.

Important qualification: the implementation accumulates edge and volume tests per mesh, welding by decimal rounding to six places. It does not decompose each mesh into connected components, so “positive component volumes” is stronger wording than the test itself establishes. It checks positive aggregate signed volume for each mesh, not each separately identified connected component. Decimal quantization is also not a general distance-tolerance weld.

No intersection, union watertightness, collision/contact, deformation, motion, in-engine loading or phone performance result follows from those checks. Named parts do not establish a usable rig. These structural results have not changed the frozen visual score.

## Scope preserved

Only new files in this independent review directory were written. No source/image edits, Git operations, builds, renders, browser work, Sites work, Mac access, labels or child agents. The model remains a static unaccepted candidate.
