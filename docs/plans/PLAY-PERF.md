# Play performance — 60 FPS on the phone tier

Ruler: `game.lastFrame` (calls / triangles for the whole composer frame) read headless via agent-browser,
`?tier=phone&skipintro=1&nolock=1` at 390×844. Headless frame ms is vsync-pinned (16.7) so **counts are the
ruler**; the user's iPhone meter is the truth for ms. Poses: gate `x=0&z=-200&yaw=3.1416`, cabin
`x=-14&z=-62&yaw=3.1416`, pond `x=-56&z=95&yaw=3.1416`.

## §0 Measured decomposition — before (commit 58ccfe0, phone tier, 390×844)

iPhone in play: **19 fps · 53 / 76 ms · 471 calls · 16.8 M tris**. Headless phone: gate 451 / 17.2 M, cabin
425 / 17.5 M, pond 380 / 24.0 M. Desktop 1600×900: gate 836 / 22.3 M, cabin 903 / 22.8 M, pond 668 / 29.5 M.

Scene pass at the gate (calls / tris), with the 2 shadow cascades → without shadows:

| group | with shadows | no shadows | why |
|---|---|---|---|
| trees | 48 / 9.70 M | 16 / 3.23 M | all 1770 trees drawn every frame (no frustum cull); lo cards ≈ 1 300 tris/tree × 1 560 far trees = 2.0 M; hi 3–4 k tris × 210 |
| grass | 1 / 2.26 M | 1 / 2.26 M | 75 264 slots × 30 tris, every slot goes through the vertex shader (zero-scaled or not) |
| props | 24 / 2.75 M | 8 / 0.92 M | 380 boulders × 1.3 k + 70 stumps × 3.3 k + 55 logs × 3.6 k, chunk-wide, never culled |
| ferns | 3 / 1.30 M | 1 / 0.43 M | 6 000 × 72 tris chunk-wide, cast shadows |
| cabins | 142 / 0.73 M | 78 / 0.26 M | 3 cabins × ~26 meshes, all in both cascades |
| animals | 145 / 0.15 M | 58 / 0.06 M | 24 animals × ~2.4 meshes, all in both cascades |
| water (pond pose) | 75–124 / 7.1 M | same | planar reflection re-renders the WHOLE scene (grass, ferns, props, animals) at 1024×512 |
| terrain | 2 / 0.13 M | 2 / 0.13 M | fine |
| boundary 19 · crossbow 13 · horizon 4 · shrubs/litter/reeds 9 · particles 3 · sky 5 | | | small |
| post: god rays+bloom+grade pass 25 calls · SMAA 3 · volumetrics 1 | | | |

Shadow passes alone: 211 calls / 9.8 M tris (more than the visible scene).
Budget (phone): ≤ 150 calls, ≤ 2.0 M tris, iPhone ≥ 55 fps. Desktop: 60 fps at 1600×900, ≤ 300 calls.

## §1 Levers (counts before → after, gate / cabin / pond, phone unless noted)

## §2 Left
