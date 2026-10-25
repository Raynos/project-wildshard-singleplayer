# C2 100 m look · G726 RM1

[cameras.json](cameras.json) and [floorplan.jpg](floorplan.jpg)
pin the camera above the central gate. Pair:
[C1 100 m stand](../C1-100m-stand/cameras.json).

Built-in imagegen produced two grids from the floor plan, the
[100 m source view](../../round-46-night-market-nine-angles/r4-above-neighbour.jpg)
and B2's target style. Candidate A is `grid-raw.jpg`; candidate B
is `grid-raw-alt.jpg`. A avoids B's foreground box buildings in
the distant view. Nine individual targets form the labelled sheet.

## Prompt set

**Grid:** nine portrait views above `(0,100,0)`: sky; southwest
and southeast diagonals onto the central plaza; west rooftop
panorama; north/down across the northern half; east panorama;
south to the paired stand; straight down; and the whole-market
silhouette from `(0,100,-600)`. Forward aims at `(0,0,125)` so
it is distinct from straight down. Keep the same red/gold dusk,
navy roofs, round crowns, canals, stalls and three-tier gate.

**Details:** one 1024×1536 view per tile, smooth matte low-poly
surfaces and simple joints, header `C2 · n · TARGET · view`.
The gate identity reference is B2's forward target. Reject the
up pass's invented stone arch; it must be open sky at this height.
Raise the side/forward viewpoints over roofs and tree crowns.
End the market after its outer house row: plain grass beyond,
not an infinite town. Remove the east-facing sun disc. Forward
shows the gate roof below the camera; down shows the central
roof/plaza vertically. The 600 m pass keeps one southern road
adjoining the market, removing the invented second foreground road.

These are art targets, not runtime camera or cost measurements.
RM2 captures must use the exact manifest and report actual costs.
