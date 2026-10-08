# G227 Nalati static assignment and packing inputs

This data slice assigns the meshes in the real [cd1890836 capture](../nalati-authored-capture-cd1890836/README.md).
It does not emit a product, replace a material, change rendering or switch a live boot path.
[assignments.json](assignments.json) is the output of `assignNalatiMeshes` in
[nalatiMeshAssignments.ts](../../../../scripts/bake/nalatiMeshAssignments.ts).

| Source / replay | Unique meshes | Packing input |
| --- | ---: | --- |
| Static merged world geometry | 30 | Captured vertex channels and mesh world matrix; do not multiply registry poses again |
| Complete static instance buffers | 10 | Captured geometry, root matrix, instance matrices and linear tints |
| Static scatter geometry | 10 | Original DressLayer transforms, tints and distance/fade metadata **still required** |
| Hybrid root meshes | 6 | Saddled horses, Kokpar riders and four far-herd drawers stay runtime-owned |
| Hybrid builder meshes | 2 | Both balbal model outputs stay runtime-owned |

The capture has **58 root mesh references = 56 distinct root meshes**, plus two independent balbal builder
meshes: **58 distinct meshes overall**. The earlier capture report's `uniqueMeshes: 56` counts roots only.
The assignment covers all of them and preserves each original root/build reference. The watchtower includes
its separately registered steps; the Kokpar rider parent includes its separately registered static goals/posts.
Both aliases emit one static world-mesh assignment. A new root/model/layout, an unreviewed identity alias, a
new builder or an incomplete static instance buffer refuses instead of being silently treated as static.

The ten scatter drawers begin with zero visible instances. Their registry placement callbacks currently contain
XYZ only (`world/dressing/index.ts`), whereas `DressLayer` uses yaw, scale, lean, linear tint, per-copy range,
tier range scale and keep-near distance. Its live matrix/colour buffers are cull outputs, not original sources.
`scatter-source-required` therefore forbids treating those buffers or the callback's identity transforms as a
complete bake. The next capture addition must copy the actual layer's immutable source data, preserving order,
without rerunning `planDressing` or invoking another model builder. Flora also uses painterly sway (shrub .05,
flower .3, reed .1); a static geometry assignment does not authorize dropping that material behaviour.

## Static tiles

1. Keep the exact WSTR256/500 m/seed authority as critical `nativeGround`. Runtime owns its native physics and
   the existing authored registry collision. Render packing must not add duplicate compiled terrain/prop solids.
2. Use the shared native-lattice slicer for **64 L0 tiles at 62.5 m** and **16 L1 tiles at 125 m**. Preserve native
   triangles/holes and POSITION, NORMAL, COLOR_0, `_SURF` vec4, `_RDIR` vec2 and `_ZONE` vec3. No analytic rebake,
   257 resample or flattened true edge heights.
3. Feed deduplicated assigned static primitives to sp-x5's shared static packer. Resolve source materials and
   retained atlas textures through its reviewed catalogue before packing. Ground and static props combine into
   **one final GLB per address**, consumed by `WorldBakeRows`; no second tile row may overwrite the first.
4. For a merged mesh, apply its captured world matrix once. For an instanced mesh, compose the root and original
   instance transform once, retaining tints. Clip through the shared packer with all channels interpolated;
   never infer missing transforms, filter by initial visibility, or multiply an already merged root's poses.
5. Retain full native geometry in the initial L1 until an error-measured simplification exists. Deduplicate exact
   byte hashes and texture dependencies in cost metadata. Report tile warnings separately from the **1 GB whole
   resident hard limit**; the source L1 ground exceeds the advisory wire target and no target was raised.

## Far input and hybrid boundary

The far source consists of native terrain plus the assigned static world geometry, each physical mesh once.
Source geometry must be complete before deriving bounds or proxy costs. Runtime riders, horses, balbals,
characters, combat/interaction state, water, grass, weather, flutter cloth, smoke and DressLife's pollen,
butterflies and raptors remain hybrid. The latter global systems are outside the drawn-into capture roots;
this inventory does not claim to enumerate every scene object.

The proxy's material treatment, vegetation range/fade, simplification and source-subset fidelity belong to the
rendering owner. A far proxy may not invent a vertical skirt down from Nalati's true 85–100 m boundary to the
road, flatten the native boundary or include dynamic actor silhouettes as permanent scenery. Keep the existing
hybrid presentation until the replacement's look is proved. The planned product needs truthful measured bounds,
geometric error, decoded/GPU/draw costs and exact admitted dependency bytes.

Completion still requires the source scatter capture, sp-x5 material/static contract, combined static packing,
far proxy, full product admission, same-engine parity and the final live ownership switch. No runtime drawing
is disabled by this slice. Assignment fixtures cover all 58 unique meshes, both aliases, the ten empty scatter
sources and refusals for new layouts, identity conflicts and truncated static instances.
