# C1 100 m stand · G726 RM1

[cameras.json](cameras.json) and [floorplan.jpg](floorplan.jpg)
pin the outer camera above the plain southern neighbour. Pair:
[C2 100 m look](../C2-100m-look/cameras.json).

Built-in imagegen produced two grids from the floor plan, the
[100 m source view](../../round-46-night-market-nine-angles/r4-above-neighbour.jpg)
and B2's target style. Candidate A is `grid-raw.jpg`; candidate B
is `grid-raw-alt.jpg`. A avoids B's invented distant skyline.
Nine individual detail passes form `sheet-target-3x3.jpg`.

## Prompt set

**Grid:** one portrait 3×3 with nine 2:3 views at outer anchor
`(0,100,-400)`: sky; southwest and southeast downward aerials
onto the plain neighbour; west; north hero across the one road
to the entire market; east; south; straight down; north aerial
looking back south. Empty directions remain empty. Keep the
bounded 500 m market, red/gold lantern dusk, navy courtyard roofs,
turquoise canals, gardens and one three-tier gate.

**Details:** isolate each selected view into one 1024×1536 target,
preserving camera/composition and clean matte low-poly surfaces.
Caption `C1 · n · TARGET · view`. The diagonal aerials explicitly
restore the one southern road along the market/grass boundary.
The hero uses B2's three-tier gate identity without changing its
footprint. The west pass removes an invented bullseye prop;
“TARGET” is caption metadata. View 9 is corrected from a shallow
horizon to the specified steep downward oblique aerial.

These are imagined art targets, not runtime camera/cost proof.
The manifest remains the authority for RM2's actual captures.
