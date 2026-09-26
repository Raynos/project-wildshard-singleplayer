# Nine Dragon facade budget and center-view audit

**Scope:** F8 draw-call cut and an F7 look check at the center view (camera 5) of each of the eight approved dome sheets. These captures do **not** sign off the other 64 camera views or gameplay traversal.

## Evidence

The eight `*-center.jpg` files are portrait engine captures at 512 × 768 CSS pixels, phone tier, from the same camera coordinates as `round-15-eight-domes/<dome>/cameras.json`. Compare them with each dome's `target-5.jpg` there. `A1-before-after.jpg` places the original instanced facade at left and the batched facade at right. Both were captured from clean exports of commit `3ed3285e`, with only the facade change applied to the right-hand build. The target art is a direction, not a pixel-exact production frame.

| Dome | Draws before → after, center | Look check against target 5 |
|---|---:|---|
| A1 spawn | 146 → 129 | Square/gate composition is established; the facade batch preserves it. |
| A2 gate | 140 → 124 | Dense facades and gate read well; there is still target detail to review. |
| B1 Well edge | 142 → 123 | Depth and layered bridges need more geometry and staging. |
| B2 Well look | 140 → 121 | Camera 5 clips into a red wall and takes damage. This is not a valid look approval frame. |
| C1 stair foot | 136 → 117 | Current view is a dense corridor; target asks for more open sky/bridge silhouette. |
| C2 upper stair | 123 → 104 | Same open-sky/upper-bridge gap; silhouette work remains. |
| D1 Well down | 112 → 111 | Most facade is offscreen; depth/strata need review. |
| D2 lower Well | 136 → 119 | Well depth and fog separation remain below target. |

Across all 72 dome poses and four mockup poses, the ruler's maximum changed from **159 draws / 1.62 M triangles** to **138 draws / 1.59 M triangles**. Both are below the 180 draw / 2.3 M triangle whole-frame gate. The large facade pieces changed from one InstancedMesh per type to one BatchedMesh with per-object frustum culling. Small clutter retains its distance-shrink InstancedMeshes; the window program is unchanged. The shader preserves per-instance tint and ruled face scale. `WEBGL_multi_draw` was present in the tested Chrome/Metal renderer; without it the code retains the original instanced path. Safari PWA extension availability still needs a device or simulator check.

The existing budget script's pass-2 geometry allocation assumes Mesh and InstancedMesh. It can measure total facade draws but its regional triangle attribution should be updated for BatchedMesh before using the new lane split as an F8 signoff. The pass-1 totals above are measured renderer counts.
