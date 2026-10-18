# Mantis V3: insect proportions and continuous hooks

Source: `build_mantis_v3.py`. V1 and V2 remain preserved and unaccepted.
The visual target is human-approved; this implementation is not.

V3 narrows the entire head assembly by 26%, pitches the pointed face forward,
and moves the head to the end of a longer forward-sloping prothorax. Eyes,
antennae and mandibles move together, preserving true 3D attachment. Thorax
plates follow the revised neck flow. The raptorial chain moves forward with
anatomically named shoulder, elbow and hook hinge points.

Hook silhouettes are continuous extruded shapes with a broad curving timber
spine and solid serrated ivory cutting edge. The separate triangular teeth
of V2 are replaced by connected silhouette corners. No fine texture, random
facets or camera-facing cards are introduced. Palette decoding and physical
lighting remain the same as V2.

Run from repository root after obtaining the coordinator's render lane:

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis_v3.py \
      -- --out tmp/lowpoly-mantis --render --view front

Then run `review_board_v3.py` for the compact labelled comparison. Raw outputs
remain ignored in `tmp/lowpoly-mantis`; source is the editable artifact.

Status: source syntax and actual Blender export/render pass. Inspected front
render improves pointed insect head proportions, forward neck flow and broad
connected hooks. It remains unaccepted and below target: the right blade is
clipped by the changed framing, arms still have rigid cross-sections, and the
body/leaf planes remain simpler than the approved image. This is incomplete
work, not final quality.

Metrics: 1,566 triangles, 55 mesh parts, zero boundary edges, zero nonmanifold
edges and zero degenerate faces. Actual export is `mantis-study-v3.glb`;
`metrics-v3.json` records counts and anatomical pivots. Evidence is
`actual-v3-preview.webp` and `comparison-v3-board.webp`.

Next: fit camera automatically to full object bounds, inspect side/rear
silhouette, then refine neck/limb transitions and wing planes. No rig,
draw-call, animation, Model Explorer, runtime or device performance claim
follows from this source change.
