# A1 road stand · G726 RM1

Four-camera scope: road entry, 40 m over the road, 100 m over the
neighbour, plaza. This is the road **stand** half; the paired look
dome is [A2](../A2-road-look/cameras.json). The actual 64-tile
layout and all nine camera vectors are in [cameras.json](cameras.json)
and [floorplan.jpg](floorplan.jpg).

Built-in `image_gen` made two 3×3 candidates from the approved
[road-entry mockup](../../round-46-night-market-nine-angles/r1-road-entry.jpg)
and the floor plan. `grid-raw.jpg` is candidate B, kept because its
west/east views keep the market on the correct side of the road,
and views 7/9 face the plain neighbour without inventing a second
gate. `grid-raw-alt.jpg` is rejected candidate A: view 9 incorrectly
faces the central gate. The individual `target-1…9.jpg` files are
separate imagegen detail passes over the chosen tiles, not engine
captures. The JSON vectors define the later RM2 camera placement.

## Prompt set

**Grid:** one portrait 3×3 sheet of nine 2:3 views, row-major,
captioned `A1 · n · TARGET · view`. Preserve the approved stylised
red/gold lantern dusk, navy roofs, turquoise canals, gardens,
bridges, slate paving and one central gate. Supply the exact
eye/look vectors from `cameras.json`. Specify the market lies north
of the road; west sees it on the right, east on the left. Back and
back-aerial face the plain southern neighbour. The gate is behind
those cameras and cannot appear. Views 2/3 are steep entry aerials,
8 is down at the kerb, 1 looks up at sky. View 5 is the northward
hero with the sign `OPEN PLOT` / `BUILD THIS SHARD`.

**Individual targets:** upscale the chosen single tile to a crisp
1024×1536 portrait, preserving camera direction, horizon,
composition and object positions. Keep the caption verbatim. Add
architectural detail and soft warm lantern light in the same
stylised 3D dusk palette; no new buildings, landmarks, HUD or device
frame. Back views keep the neighbour empty. One initial multi-view
request was refused by imagegen; the saved single-view passes
succeeded. No CLI/API fallback was used.

The first close-ground detail pass was too photographic; its replacement
keeps broad matte polygon colours and clean joints rather than grit.
