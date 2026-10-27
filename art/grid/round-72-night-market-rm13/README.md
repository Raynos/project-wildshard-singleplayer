# Night Market remaster · RM13 board (2026-10-26, sp-o1)

| File | What |
|---|---|
| `board.jpg` | Five hero cameras (road entry, road look, 40 m over the road, 100 m over the neighbour, the plaza) × MOCKUP (round 46 / round 63 targets) · BEFORE (RM2's baseline, 903baf53bc) · NOW (b9699cb002: the kit on, G764; figures off until the G755 pick), iPhone portrait, labels burned in |

NOW is `scripts/capture-night-market-domes.mjs` on a pinned preview of b9699cb002 (Chromium as iPhone 16 Pro, phone
tier, render scale 2), view 5 of each dome; the board is `tmp/rm4/rm13board.py`'s layout. Measured per dome: 121–148
draw calls, 0.27–0.56 M triangles.

What it shows: the plaza (D1) now reads like its mockup (the Hunyuan3D 2.1 gate, its lanterns, beds and trees), and from
above (B1, C1) the stalls, houses, trees and canals fill the blocks. From the road (A1, A2) the avenue is still far
sparser than the mockup's double row of lit lanterns, trees and houses: the remaining gap is density and light along the
entry avenue, not the models.
