# Bellback: independent complete-character pair review

## Decision

**Prefer the final complete-character candidate to the actual retained woody baseline, as a modest visual improvement. Do not treat this as target likeness, production promotion, runtime, animation or physics acceptance.**

Blind candidate score: **3.585/5** (3.59 rounded), frozen before any baseline or previous review was read. Unchanged rubric: silhouette 3.6 × 35%, face 3.5 × 30%, details 3.4 × 20%, facet style 4.0 × 15%. See `blind-freeze.md` for the contemporaneous score and ten individual candidate-view observations. No structural repair earned likeness points.

Approved concept was inspected first. The actual ten final candidate PNGs were then individually opened, scored and frozen; all ten corresponding actual baseline PNGs were individually opened next. Only afterward was `docs/reviews/bellback-complete-character-pass.md` read. No failed-attempt image or contact sheet substituted for an actual final image. Earlier independent numerical scores were not consulted.

## Matched-view findings

Paths are under `tmp/bellback-complete-character-pass/final/{candidate,baseline}/`; hero is `hero/hero.png`, other views are `nine/<view>.png`. Each entry below reflects individual inspection of both complete images.

- **hero:** candidate preferred. Shorter broader face, broader broken ivory bite and wider front support improve compact guardian read. Baseline has a narrower long muzzle and long pendant tusks. Candidate still resembles a carefully built wooden mask; cheek planes and teeth need more irregular integrated character.
- **01-front:** candidate preferred. Wider crouch and shortened tooth block are closer to the heavy creature. Both are unusually bilateral and neat; the bell arch resembles a roof.
- **02-left:** candidate preferred by a small margin. Shorter body and snout reduce baseline's stretched carriage. Candidate still has a straight shelf-like jaw underside, thin projecting muzzle and long side rails.
- **03-right:** candidate preferred by a small margin for the same compactness. Baseline's elongated head and parallel fence rails are especially obvious; candidate remains broadly constructed from boxy sections.
- **04-back:** candidate preferred for overall silhouette coherence. Varied rear posts and added fan fragments break the baseline's long parallel posts. The exposed polygonal rump remains plain. Reference provides no direct rear view, so this is consistency judgment rather than literal rear likeness.
- **05-top:** candidate preferred. Broader, less extended face and shorter body footprint feel heavier and more compact. Symmetric rail spacing and tidy bell bands remain.
- **06-diag-front:** candidate preferred. Broad front stance and shorter face improve concentration of mass. Baseline's extended narrow face and hanging tusks are conspicuous. Candidate's paired white bite is still too orderly and prominent.
- **07-diag-left:** candidate preferred for shortened fence/body and head. Neither resolves the blocky upright hindquarters or long straight muzzle profile.
- **08-diag-right:** candidate preferred for proportion. Straight long flank rails and relatively subdued lashings continue to undercut the salvage character.
- **09-diag-back:** candidate preferred for more varied, shorter rear structure. This remains an inferred rear design and does not establish reference fidelity for an unseen surface.

The preference is consistent across views but is not a claim of a large leap. Bell, orange squints, wood palette, gray stone feet and low-poly treatment already read well in both. Remaining high-value visual work is the integrated downward face/jaw silhouette, irregular substantial lashings and wreck timbers, and less box-like flank/hindquarter construction. A future pass should be judged against the original concept, not rewarded simply for making more geometry changes.

## Provenance and verification

Read-only `verify.py` was inspected and executed successfully. It reports 4,834 triangles, 94 meshes, twenty pinned actual renders and ten exact-camera pairs. Its source and raw-file hash verification passes. The dedicated independent `verify_readonly.py` and `verification.json` in this review directory additionally establish:

- Final source SHA-256: `ff889c90fb5c7c0a0974678cc2cf59ccc7cbcdaee38da2ff823809613b78b131`.
- Final GLB SHA-256: `137f14c636f5a81717d3a06cfef612bb8517b7c465df1c23b60417d960389cce`; 362,648 bytes.
- Actual GLB accessors contain 94 meshes and 4,834 triangles. Independently recomputed minimum triangle area is 0.00014030262427508947; minimum geometric-normal dot is 0.00028060524957114285, both positive. Package verifier also checks finite positions/normals, valid indices, near-unit normals, no skins/animations and self-contained buffers/images.
- Final hero and nine-angle exported GLBs for each role are byte-identical to their corresponding pinned asset.
- Candidate capture script is byte-identical to retained woody capture script. Package receipts match the same lights, camera position, target and orthographic scale for all ten named pairs; original script also fixes rendering settings and dimensions. This checks recorded capture provenance, not a fresh rerender.
- All ten fresh baseline images independently match the retained baseline's exact RGB pixels, despite PNG metadata/hash changes.
- Both failed source/export directories still exist. The assembly-clearance failure's ten actual raw PNGs remain preserved and were excluded from likeness scoring. No source, export, image or historical review was altered.

## Geometry claims and limits

Final source and audit scripts were inspected. Source contains periodic closed rope tube construction, the explicit +0.20 clapper-weight lift, shortened stem, coherent shortened head, broader bite halves, chest strakes and rear fragments. Final pinned source audit records all 94 closed components with consistent winding, positive volume, flat shading, valid material slots and no zero-area native triangles. Native GLB triangle area/normal claims were independently recomputed as above.

The pinned intersection audit records zero proper within-component crossings and zero inclusive nonadjacent self-intersections for the candidate. Coplanar audit records zero positive-area self-overlaps; quad audit records all 8,276 alternate-diagonal test triangles positively aligned. Those source/intersection computations were inspected and hash-checked, **not independently rerun**, because this assignment excludes building/rendering. They should not be represented as a second independent geometric clearance solve.

The final recorded cross-object inventory remains **10,989 intersecting triangle pairs**. For the clapper, only `Clapper stem | Clapper weight` (20 pairs) and `Clapper stem | Hollow cast bell` (10 pairs) remain; no weight/head, weight/hull or weight/bell pair is listed. This supports the narrowly stated static weight-clearance repair, not moving clearance, penetration-depth or collision acceptance. The source still has seven semantic rigid pivots, with no demonstrated motion or physics behavior.

The reported 36,510,459-byte evidence footprint is below 60 MiB. No timing, performance, runtime integration, animation, physics architecture or production-ready claim is established by this review.
