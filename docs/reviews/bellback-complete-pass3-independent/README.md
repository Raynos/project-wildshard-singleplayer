# Bellback complete-pass3: independent static review

2026-10-19. **Retain complete-pass3 narrowly over complete-pass2 as the next working candidate; 4/5 target remains unmet.** This does not select a shipped/runtime replacement.

## Frozen candidate-only judgment

Approved original inspected first, then actual full `hero/hero.png` and all nine individual candidate PNGs, before predecessor images, construction prose or prior scores. The exact judgment was saved in `frozen-judgment.json` before comparison. All ten full predecessor PNGs were inspected afterward. No prior review scores were read or subtracted.

| Criterion | Weight | Candidate /5 |
|---|---:|---:|
| Silhouette/proportions | 35% | 3.9 |
| Face/expression | 30% | 3.6 |
| Defining details | 20% | 4.1 |
| Facet/style | 15% | 4.2 |

Exact weighted result: **3.895/5**. No rounding to four. Original: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.

## Actual-image findings

- Hero/front: unmistakable green ship bell, warm timber guardian and broad stone feet. The orange eyes are legible but narrow under a dominant planar brow. The ivory forehead spikes and tooth fan draw attention away from the reference's wooden predator expression.
- Left/right: pass3's elongated projecting head and boxy vertical cargo frame are especially obvious. The original suggests more integrated irregular shoulder/head mass. Long brow blades flatten the snout rather than resolving its cheek, muzzle and eye depth.
- Back/top: the model is coherent around the bell, but parallel uprights and clean horizontal strakes still read like a built rack. These views expose interpretation rather than direct reference correspondence; the concept does not specify a rear view.
- Diagonal front/left/right/back: the added wood density improves the wreck identity, while the broad forehead and orderly frame remain dominant. Teeth read more as a row at the muzzle than pass2's continuous ivory W, but are still a conspicuous fan, especially front-on. Separate solids or closed geometry earn no intrinsic likeness bonus.
- Broad facets, matte color blocking and bell bands are convincing. Lighting differs from the concept environment, so brightness is not treated as a geometry defect.

## Matched predecessor and retained best

Direct comparison of all ten actual pass2 renders supports **pass3 overall**, narrowly: denser broken timbers, overlapping shoulder mass and the visible tooth-row silhouette better express the original's wreck guardian. Pass2 is preferable for its compact head and lacks the distracting ivory forehead spikes. Its sparse open carrier and continuous W-shaped jaw lose defining detail. This is a trade-off, not an across-the-board improvement. The candidate-only score is unchanged.

Next worthwhile correction: resolve the head as a wooden predator with a deeper muzzle/cheek transition and more readable recessed eyes; reduce the forehead-spike emphasis and fan-like tooth regularity. Preserve the bell and useful wreck density while breaking the rack-like silhouette. Another topology-only tooth pass cannot close this likeness gap.

## Provenance and limits

`hash-closure.json` records 84 passing checks over 68 files: all 20 actual PNGs match capture-receipt hashes/byte counts; both sources and capture scripts match their receipts; packaged receipts and hero/nine/packaged GLBs match; all candidate closure entries match. Every corresponding camera, target and orthographic scale matches exactly, and lights match. Capture scripts are byte-identical, including resolution, samples, world/color settings and exposure.

Candidate source SHA256: `f3f285d3463c21e922d0de8a7a9683326902df72ae00763c5f42ccfeeaa55040`.
Candidate GLB SHA256: `7f5f31a1c39dc4a7768d012d485bca996c927585c87bc6876fee625ec16ea796`.

This is receipt/source/hash closure, not an independent rerender or GLB reimport. The capture script runs the generator then renders its Blender scene. Candidate identity, filenames and rubric were known; only predecessor/prose/score exposure was delayed. The target is a single concept with differing scene lighting and incompletely specified hidden anatomy. Preserve any other reviewer's disagreement rather than averaging it into this frozen judgment. Construction prose was read only after visual scoring/comparison. No animation, runtime, performance, collision or ragdoll-architecture acceptance follows. No builds, product edits, Git writes or remote writes were performed.
