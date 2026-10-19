# Conch complete character refinement: independent review

## Decision

**Do not promote this refinement. Its frozen likeness is exactly 3.97/5, below the >=4 bar.** Retain complete-pass2 as the slightly better whole-character likeness of these two reviewed variants. This is a narrow subjective preference, not a confident large quality gap. Neither result is human acceptance or runtime admission.

| Variant | Silhouette 35% | Face 30% | Details 20% | Facet 15% | Exact total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Character refinement | 4.0 | 3.8 | 4.0 | 4.2 | **3.97** |
| Complete-pass2 | 4.0 | 4.0 | 3.9 | 4.2 | **4.01** |

The original approved low-poly concept pixels were inspected first, then all ten full actual candidate PNGs individually. Candidate judgment was frozen in `visual-freeze.json` at 15:40:12 UTC, before comparator images, technical results, author claims or previous scores. All ten full retained complete-pass2 PNGs were inspected next, and independently scored. No earlier review score was consulted or transferred; no rounding or structural bonus was applied.

## Visual findings

The refinement clearly reads as the conch duelist: tall cream/coral shell, yellow slit eyes on wine-red stalks, asymmetric shield and rapier, and broad stance. Flat facets and palette are strong.

The main regression is facial: its smaller pinched mask, narrower cheek volume and lighter eyes are less expressive than pass2 and less like the original fuller predatory face. Pass2's facial advantage outweighs this candidate's cleaner shield/thumb relationship and less black, more cohesive limb joints. Both retain an overly plain elongated abdomen, thin lower legs, broad flat shell ledges, and slab-like aperture rim from the side. The original shield has a more organic curved taper. Back/top views are coherent but cannot demonstrate likeness to unseen sides of a single concept image.

Recommended next revision: restore fuller cheek/jaw and stronger eye framing; shorten and layer the abdomen; improve shell shoulder rhythm and side rim thickness. Judge the whole character again, not isolated topology or face close-ups.

## Capture match and artifact closure

- Existing captures only: no new renders or fabricated matched comparison. Hero camera/light/render blocks are byte-identical between variant sources. Nine-view render sources match after variant-name substitutions; camera receipts match exactly. Resolutions match: hero 780×960, nine 496×700. These are matched retained model captures; the illustrative original is not a matched-camera render.
- Every final `evidence.json` file hash resolves, including original, authoritative source, both GLB byte variants, actual PNGs and logs. The source-freeze generated `.blend` hash is stale, exactly as disclosed by the builder; final evidence pins the regenerated blend. The authoritative Python and retained GLB match their pre-capture hashes.
- Retained GLB SHA-256: `6a2740b1059be2ba7c20eb6e1b34ec2c5fff126202eb4a2aa16248da2ba8dbbd`. Capture-rebuilt GLB: `13ec84acd3cade9a4ef1720724be8d560215896c3fb57e803029dc1d19e00109`. Independent decoding confirms identical JSON metadata and attributes; only index accessor 96 differs, with identical oriented triangle multiset. They are geometrically equivalent, not byte-identical.
- Independent topology reconstruction matches receipt: 47 named meshes, 2,210 triangles, zero boundary/nonmanifold edges and degenerate triangles under six-decimal position welding. Re-run facet audit passes, minimum cosine 0.9999999250794644; each mesh has positive signed volume and consistent directed edges. Re-run crossing audit finds zero proper nonadjacent intra-mesh crossings.
- Source-domain sweep rerun, before normal recalculation and without saving geometry, exactly reproduces final receipt: 36 sweeps, zero opposed triangles/strip pairs, minimum outward radial cosine 0.5387902157381177. The retained rejected breast source correctly fails on both breast meshes, minimum -0.8647028189152479. Thus the check distinguishes that fold defect rather than passing solely because normals were repaired.

## Limits and animation readiness

**Animation-ready is unproven.** GLB has zero skins and zero animations. Named rigid parts provide a starting point, not a rig: no binding, joint-pivot verification, deformation, idle/walk/attack/hit/death motion or runtime/phone testing was performed. Crossing checks exclude shared-vertex/coplanar contacts and do not test intersections between separate anatomical meshes. Source fold checks cover swept parts, not every possible shell/mesh failure. Static geometry success does not improve likeness scores or establish movement quality.

Artifacts: `visual-freeze.json`, `comparator-judgment.json`, `verification.json`, `source-fold-independent.json`, `facet-independent.json`, `crossings-independent.json`. Verification scripts write only in this review directory; no source, Git, runtime, Site, build or browser changes were made.
