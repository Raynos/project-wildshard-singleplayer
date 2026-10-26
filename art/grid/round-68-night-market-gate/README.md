# Night Market gate · RM9 (2026-10-26, sp-o1)

r7's three-bay gate (night-market-remaster RM9): a codex `image_gen` reference from the r7 plaza mockup, then Hunyuan3D 2.1
vs TRELLIS.2 (G632: the better take wins), both put through the same post at the shipped budget.

| File | What |
|---|---|
| `crop-r7-gate.jpg` | The gate cropped from `art/grid/round-46-night-market-nine-angles/r7-plaza.jpg` |
| `ref-gate.jpg` | The image-to-3D reference: one gate on plain grey, three bays, no lanterns (the kit's own hang there) |
| `board.jpg` | The pick: mockup and reference over TRELLIS.2 (14.8k triangles), Hunyuan3D 2.1 (12k, picked) and today's gate, same dusk light and cameras |

Hunyuan3D 2.1 wins: at the shipped budget TRELLIS.2's gold trim and plinths went dark and blotchy in the re-bake, while
Hunyuan keeps its gold brackets, cream plaques and clean stone plinths. The post is
`scripts/img2mesh/props/night-market-gate.json` (near 12k and far 2.5k triangles on one 1024 WebP colour atlas, no normal
map). 15k triangles overran the four plaza tiles' pinned resident rows by up to 118 KB; 12k leaves 118–178 KB a tile.
The layout stands it 45 m tall (was 52) so its three bays span ~52 m, as the old gate did.
