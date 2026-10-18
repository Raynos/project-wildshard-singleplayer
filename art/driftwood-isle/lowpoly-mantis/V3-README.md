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

Status: source syntax validated. Actual V3 render/export/topology review is
pending. No rig, draw-call, animation, Model Explorer, runtime or device
performance claim follows from this source change.
