# Splinter Mantis V7 — volumetric face and bevelled sickles

Unaccepted static study. Original approved low-poly concept remains authority.
V6 is preserved. No runtime, rig, animation, combat or performance claim.

## Authored correction

- Replace the wide diamond-mask skull with a deep three-ring closed insect
  cranium: narrow raised forehead keel, wraparound temples, converging cheeks
  and pointed lower jaw. Crown splinters grow backwards from the cranial volume.
- Seat vivid green kite-shaped compound eyes on oblique socket surfaces;
  overlapping brow ridges and cheek flanges frame the lens boundaries.
- Replace dangling pale mouth pins with small closed articulated jaw forms
  tucked around the lower facial keel.
- Replace constant-depth wood hooks with six-point cross-sections along a
  depth-swept sickle. Wide ridges taper toward thin inner and outer bevels,
  closing at wrist and tip. The continuous pale saw edge is bevelled too.
- Give folded wing faces deliberate interlocking triangular green tones;
  split selected anatomical wood planes into broad diagonal amber facets.
- Preserve exact V6 wing/embedded-rib positions, all four grounded walking
  leg positions, body proportions, appendage arrangement and camera workflow.

## Verification status

Python syntax passes for all three V7 scripts. The V6/V7 leaf_stations ASTs
are identical. Blender structural metrics and actual visual review are pending
heavy-lane admission. Source self-review is not an independent likeness score.

## Reproduce after heavy-lane admission

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis_v7.py \
      -- --out tmp/mantis-v7 --render --view front --samples 24 --height 1100

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/render_mantis_v7_nine.py \
      -- --out tmp/mantis-v7-nine --samples 16 --height 700

    python art/driftwood-isle/lowpoly-mantis/review_board_v7.py

Full-nine independent review must assess all original PNG frames, including
side/top/back continuation, before judging the strict >3.5 milestone. The
original is a posed concept rather than a hidden-anatomy specification.
