# B1 40 m stand · G726 RM1 · in flight

[cameras.json](cameras.json) and [floorplan.jpg](floorplan.jpg)
define nine vectors above the southern road. Pair:
[B2 40 m look](../B2-40m-look/cameras.json).

Built-in imagegen produced two 3×3 candidates from the approved
[40 m mockup](../../round-46-night-market-nine-angles/r3-above-road.jpg)
and floor plan. The simpler candidate A is `grid-raw.jpg`;
candidate B is `grid-raw-alt.jpg`. Eight individual detail passes
are saved. **Target 2 is missing:** its southwest aerial upscale
was rejected by the image tool twice. The sheet labels that gap;
it is not a substitute target or a completed dome. No fallback
service was used.

## Prompt set

**Grid:** one portrait 3×3 of nine 2:3 views, with each eye/look
from the manifest. The anchor is 40 m above the road at
`(0,40,-300)`. Preserve the approved low-poly red/gold dusk,
navy roofs, canal moat, gardens, soft lantern grid and one central
three-tier gate. Directions are up, SW road aerial, SE road aerial,
west along road, north hero over the south half, east along road,
south to the plain neighbour, straight down at road, and north
aerial looking back south. Keep the gate out of rear/side views.

**Individual targets:** one 1024×1536 portrait detail pass per
chosen tile; preserve camera, layout and object positions. Smooth
matte low-poly surfaces, simple paving joints and soft warm lamps,
no photographic grit or new objects. Move each caption to a top
navy band `B1 · n · TARGET · view`. The hero also receives A1's
gate as an identity reference, keeping its existing footprint.

These are art targets, not engine captures or cost measurements.
RM2 remains responsible for exact camera placement and costs.
