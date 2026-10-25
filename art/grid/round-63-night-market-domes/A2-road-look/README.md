# A2 road look · G726 RM1

The eye is inside the southern forecourt at plot-local
`(0,1.7,-205)`. [cameras.json](cameras.json) is authoritative for
RM2 placement; [floorplan.jpg](floorplan.jpg) supplies the actual
64-tile layout and numbered view wedges. Pair:
[A1 road stand](../A1-road-stand/sheet-target-3x3.jpg).

Built-in `image_gen` produced the two saved 3×3 candidates from
the approved road-entry mockup and this floor plan. The kept
`grid-raw.jpg` is the simpler faceted candidate; the softer first
successful version is `grid-raw-alt.jpg`. One earlier grid request
and one individual detail request were refused by the image tool;
the later saved images are successful calls, not substituted
engine captures. No CLI/API fallback was used.

## Prompt set

**Grids:** one portrait 3×3 of nine 2:3 views, all of the same
500 m square lantern town. Supply each camera's eye/look from the
manifest. Preserve the approved red/gold dusk, navy roofs,
turquoise moat canals, bridges, gardens and one central gate.
Order: up/lantern sky, SW forecourt aerial, SE forecourt aerial,
west gardens, north avenue, east gardens, south to the road, down
at paving, aerial back south. The gate cannot appear in rear/side
views; keep the southern neighbour plain. Caption every panel
`A2 · n · TARGET · view`.

**Individual targets:** detail the chosen single tile at
1024×1536 without moving camera, horizon or objects. Use smooth
matte low-poly geometry, round faceted crowns, simple paving
joints and soft warm lantern light rather than photographic grit.
Move the caption to one top navy band. The southern view has
continuous forecourt paving before the single road beyond the
entry. One targeted continuity correction preserves the same
three-tier gate identity as A1 and its greater apparent size from
this closer camera. The paired A1 gate was reduced to keep the
distance ordering consistent.
