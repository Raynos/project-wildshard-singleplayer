# Puffer anatomical blockouts

Unrendered control-cage studies for the artistic remaster plan in `docs/reviews/brine-puffer-remaster-art-plan.md`. V71 and the tested runtime asset are untouched. These are three alternatives in one selection round, not three new visual version increments.

## Editable sources

- `control_cages.json`: explicit frontal row widths, heights and depths, posterior closure, shoulder roots and fan footprints.
- `cage_geometry.py`: shared-vertex facial/body cage with real inset orbital and mouth loops; short closed fin-fan cages. No whole-body Boolean or V71 geometry dependency.
- `build_blockouts.py`: Blender triangulation, normal/volume checks, draft rest hierarchy, actual fin-cap containment checks, saved editable scene, clay and flat-color hero/front/side capture.
- `test_cage_geometry.py`: five pure tests for distinct controls, closed combinatorial surfaces, consistent eye symmetry, soles and deterministic construction.

The new cage has a deliberately authored frontal patch layout; it is not yet a final retopology. The posterior closure and large planes are provisional. The meaningful test is whether these different masses make a better coherent animal. A closed combinatorial surface alone does not establish geometric nonintersection or visual quality.

## Alternatives

- Study A: compact pear, projecting lower pouch and wide low shoulders.
- Study B: broad low cheek, shallower pouch and outward compact paddles.
- Study C: higher integrated shoulder hood, upright lower cheek and tucked short fans.

The eye and mouth locations are derived from named facial patches, not inherited lattice pins. All alternatives retain a pair of amber eyes under a sloped hood, open peaked mouth, broad cream lower face, teal upper mass and four low fan limbs. Spines, tail and detailed toe ends are deliberately absent in this first anatomical gate. Their absence must not be mistaken for a final identity change or penalized as missing finished detail.

## Validation and capture contract

Before any image, Blender must triangulate each closed part, recalculate outward normals and reject nonmanifold edges, degenerate triangles or nonpositive volume. Each fin's four root-cap corners must classify inside the final triangulated body using winding plus actual nearest-surface distance. A failed cap check stops the build; roots are not silently moved to make it pass. Independent visual checks still need to assess self-intersections, socket exposure, mouth continuity and appendage seating.

Draft bones use body → belly → head, with tail and fins parented to body. All weights are currently rigid drafts. This establishes editable rig intent, not runtime admission or acceptable animation. Rebinding/blending and deformation tests follow selection.

All alternatives use the same orthographic scale 3.2, target `(0, -.03, .84)`, 600×740 image size, studio lights and AgX display. Hero yaw/elevation are 32.94°/14.34°; front and side are 0° and 90° at zero elevation. Clay and flat-color captures use identical geometry and cameras. Flat-color means large uniform material regions under the same lights, not a game-render claim. No camera refit per candidate.

Example, only after the shared heavy lane is released:

`blender -b -t 2 --python-exit-code 1 -P art/driftwood-isle/puffer-remaster-blockouts/build_blockouts.py -- --candidate study-a --out tmp/puffer-remaster-blockouts/study-a --render`

Repeat for B/C into fresh directories. Do not overwrite prior results. Pure test command:

`python3 art/driftwood-isle/puffer-remaster-blockouts/test_cage_geometry.py`

Before blind review, label the rendered alternatives with neutral randomized presentation letters and keep the source mapping in the capture receipt. Show all three together against the approved original and V71 at fixed views. Choose a stronger bulk/expression before adding decoration. No 4/5 result is assumed.
