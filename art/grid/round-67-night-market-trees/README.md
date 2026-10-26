# Night Market trees · RM4.7 (2026-10-26, sp-o1)

The kit's round-crown trees (night-market-remaster RM4.7): three types cropped from A2's west-gardens target, a codex
`image_gen` reference of each, then Hunyuan3D-2 vs TRELLIS.2 (D2: the better take wins), both put through the kit's tree
builder at its budget.

| File | What |
|---|---|
| `crop-round.jpg`, `crop-tall.jpg`, `crop-willow.jpg` | The trees cropped from `art/grid/round-63-night-market-domes/A2-road-look/target-4.jpg` |
| `ref-round.jpg`, `ref-tall.jpg`, `ref-willow.jpg` | The image-to-3D references: one tree each on plain grey |
| `board.jpg` | The pick: mockup crops and references over TRELLIS.2 (512) and Hunyuan3D-2 at 420 / 420 / 520 triangles |
| `willow-redo.jpg` | The willow redo: mockup and reference over the Hunyuan willow (a blob) and the scripted one, at eye level and from above |

Hunyuan3D-2 wins: its masses stay whole at the kit's budget, where TRELLIS.2's tall tree and willow tear. Each take is
reduced to a committed source (`scripts/blender/open-plots/model_source.py` → `scripts/blender/open-plots/sources/`,
3,000 flat triangles coloured per face), then `kit.py`'s `generated_tree` voxel-remeshes it into closed masses (a coarser
voxel for the willow), decimates it and colours each face from the nearest source face, as Kit.foliage or Kit.trunk.
The renders here use Night Market's palette, whose foliage is darker than the mockup's lime greens (RM5.2's call).

**Willow redo (2026-10-26).** The voxel-remeshed Hunyuan willow read as a blob (wildshard-new). The willow is now a
Blender script, `kit.py`'s `scripted_willow`: a forked trunk under a small dome, and fourteen long leaf-blade lobes
(flattened diamond tubes, a ridge facing out, wide and narrow rings alternating for the layered edge) rising over the
crown and hanging to about a quarter of its height, gaps showing the trunk. 816 triangles (was 520); kit-on Night Market
tiles average 9,325 triangles (was 8,973), the busiest still 14,174. Its Hunyuan source is retired.
