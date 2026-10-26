# Night Market trees · RM4.7 (2026-10-26, sp-o1)

The kit's round-crown trees (night-market-remaster RM4.7): three types cropped from A2's west-gardens target, a codex
`image_gen` reference of each, then Hunyuan3D-2 vs TRELLIS.2 (D2: the better take wins), both put through the kit's tree
builder at its budget.

| File | What |
|---|---|
| `crop-round.jpg`, `crop-tall.jpg`, `crop-willow.jpg` | The trees cropped from `art/grid/round-63-night-market-domes/A2-road-look/target-4.jpg` |
| `ref-round.jpg`, `ref-tall.jpg`, `ref-willow.jpg` | The image-to-3D references: one tree each on plain grey |
| `board.jpg` | The pick: mockup crops and references over TRELLIS.2 (512) and Hunyuan3D-2 at 420 / 420 / 520 triangles |

Hunyuan3D-2 wins: its masses stay whole at the kit's budget, where TRELLIS.2's tall tree and willow tear. Each take is
reduced to a committed source (`scripts/blender/open-plots/model_source.py` → `scripts/blender/open-plots/sources/`,
3,000 flat triangles coloured per face), then `kit.py`'s `generated_tree` voxel-remeshes it into closed masses (a coarser
voxel for the willow), decimates it and colours each face from the nearest source face, as Kit.foliage or Kit.trunk.
The renders here use Night Market's palette, whose foliage is darker than the mockup's lime greens (RM5.2's call).
