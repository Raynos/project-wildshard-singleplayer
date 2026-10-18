# Low-poly Puffer reinterpretation

Status: v7 rendered and failed anatomy; v8 source unexecuted. Neither accepted.

Portable target: [Puffer low-poly style revision](../concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp).
The concept folder retains the exact prompt and provenance.

The coordinator supplied a low-poly style-revision mockup after the owner asked
the five existing identities to match Driftwood's original art. This is not a
new human approval of the replacement image. Earlier targets, failures and
unexecuted clay source remain preserved.

`build_puffer_lowpoly_v7.py` is a fresh source: authored low-sided cranial sections,
fourteen broad teal mantle plates, an ivory planar egg-shaped pouch, simple
recessed amber eyes, orange brow wedges, connected solid fan feet, a modest
polygonal tail and eight cream spines. There are no fine grooves, random paint
chips, smooth Gaussian sculpting or dense shingle carpet. Eight joints are
declared for eventual runtime integration; no runtime model is replaced.

Primary style anchors are the original round-3 crab/monkey concepts, round-8
palm/boulder references, round-4 spawn target, and archived actual round-7
Blender cove captures. Full-color clay-scale rendering is used only to compare
shape and broad matte color regions against the style revision.

Build: Blender 4.3.2, two threads, source script with `--out tmp/puffer-lowpoly-v7`
and optional `--render`. Raw GLB, metrics, inspection scene and render stay in
the ignored task directory. Source syntax checks are not visual acceptance.

## V7 real result and v8 correction

V7: 2,903 triangles, eight joints, one material, raw GLB 434,168 bytes. Matte
color regions and broad facets are closer to the revised style, but orbital
rings project like cylinders, brows sit too high, the beak reads as a separate
frame and an exposed black gap appears beside it. The right foot also needs
more camera margin. [Actual labelled render](failed-lowpoly-v7.webp).

V8 is an unexecuted source correction: orbital outer edges conform to the skull,
irises are recessed and brow edges descend over them, the beak becomes broad
solid cream face planes, and only the pouch is cut for the mouth to avoid the
side gap. Camera framing is widened. No runtime replacement or acceptance.

## Preserved WIP export

`failed-lowpoly-v7.glb` is the exact 434,168-byte Blender 4.3.2 export, preserved
for reproducibility only. It is NOT a shipping or accepted model. Khronos
gltf-validator 2.0.0-dev.3.10 reports zero errors and one standard Blender
`NODE_SKINNED_MESH_NON_ROOT` warning; parent transforms are identity. The asset
retains a single skinned mesh, eight joints and one vertex-color material.
The script remains the source; this copy is deliberately labelled failed.

## Owner approval update, 2026-10-18 15:31 UTC

The owner explicitly approved all five revised low-poly mockups, including the
portable Puffer image linked above. It is now the approved build target. Earlier
proposal-status statements record the prior checkpoint state. This approval
does not accept any generated mesh; v7 still fails and v8 remains unexecuted.


## V8 actual result and V9 source-only correction
V8 rendered successfully, but failed target anatomy: pouch too small, feet too long, brows still layered, tail obscured. The closed mouth side gap is an improvement, not acceptance. `failed-lowpoly-v8.webp` and `failed-lowpoly-v8.glb` preserve this failed study. Export: 2,899 triangles, 7,559 vertices, eight joints, one material, 443,776 bytes; Khronos validator 2.0.0-dev.3.10 reports zero errors and one skinned-non-root warning with identity parent transforms.

`build_puffer_lowpoly_v9.py` is unexecuted. It enlarges the forward ivory pouch, shortens and widens foot roots, lowers brow back planes, buries spine roots and angles the tail root toward its visible fan. These are geometry changes awaiting a single comparison render; no quality acceptance or runtime admission.

V9 executed: pouch scale and grounding improved, but exposed eye rims, layered brow chunks, raised narrow mouth and incomplete tail webbing still fail the approved target. `failed-lowpoly-v9.webp` and `.glb` preserve the actual failed result: 2,889 triangles, eight joints, one material, 443,608 bytes. No implementation accepted.
