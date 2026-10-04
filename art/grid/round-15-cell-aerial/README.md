# round-15-cell-aerial: Does one cell read right on the grid?

Ask E438 (SHARD-PLATFORM mockups, wave 8). One cell seen whole from the air, with Jake's rules so far: the four-lane
boulevard round all four sides (G80), kerbed roundabouts with green distance signs at the corners (G81), exactly one
turn-in at each edge midpoint meeting the road at y = 0 (G93, G99), the seam by step height (G90: the shard's own cliff
over 14 m, a neutral retaining wall for 6–14 m, an eased ramp under 6 m), Nalati painterly to its edge (G96).

The cell is Nalati Grasslands (grid (1, 0)): grassland and braided river inside snow-capped crag rims (47–99 m on
E / S / W, a 7–21 m berm with spruce on N; `art/grid/round-11-seam-heights/README.md`). Neighbours at the frame
borders: Driftwood Isle west (its lagoon held by the low dike, G91), template cells north and south, and the outer
ring road with the cyan rail and the VR void east (G89). The variants differ only in how much of Nalati's rim opens
round the four entries.

Made with codex `image_gen`, editing `art/grid/round-12-vr-void/board-overview.jpg` (aerial look, void) and the real
Nalati capture `progress/nalati-grasslands/20261002-0011-0d59505c/aerial-overview.jpg` (rim and valley). Art
direction, not renders.

## Board: `board.jpg`

| Variant | File | What it shows |
|---|---|---|
| A | `A-rims-canyon-gaps.jpg` | The rims kept at full height; each entry is a narrow canyon slot cut through the rim; the north berm is lined with neutral stone retaining walls; corner signs. |
| B | `B-rims-lowered-valleys.jpg` | The rims stay tall at the corners and sweep down into broad gentle grass valleys at each entry; "500 m" corner signs. |
| C | `C-rim-ring-tunnels.jpg` | The rim ring unbroken; the road enters through a stone-portal tunnel at each midpoint. |

**Re-rolled: all three, once.** The first takes were straight top-down, put palm trees inside Nalati (A) and lost the
retaining walls; the second takes (kept) are better but still not perfect. Drift kept: the image model would not draw
a square cell in a portrait frame, so the cell reads about 1.4× taller than wide. The river leaves east and west
through the rims right beside the entries. B adds a road through the template cells. The sign text is invented
("N 12", "500 m"). The dike and the guard rails are too small to read at this height.

**Recommended: A.** It is the smallest change to a shipped shard. Nalati keeps its whole rim (G96: painterly kept
fully), and each entry is a 15 m flat cut at y = 0, which is what `edgeEntries.ts` already carves at every midpoint
(W4) and what `validate` can check. From the air and from the road the slot reads as the shard's gate. B opens the
views but rebuilds Nalati's terrain round four entries. C hides the entry inside a tunnel and adds four tunnel
interiors to model and collide.
