# Brine Puffer tail study

Independent unaccepted anatomical accessory study. V71 and the tested runtime are
untouched. The approved low-poly original remains the authority; the hidden side
is an authored inference, not an independently approved design.

## Observed problem and authored response

The retained V71 hero shows a relatively regular orange-rimmed oval with a
concentrically inset teal face. Its back view exposes a thin nearly straight
profile. The approved original has unequal angular scallops, substantial cream
and ochre rim planes, and teal volume flowing inward toward the creature.

This study makes the distal contour uneven with shallow valleys, varies the rim
width, adds a small bevel rather than a uniform extruded wall, and shifts the
internal fan origin toward the attachment. Teal continues through the proximal
edge instead of being encircled by a full orange ring. Upper and lower planes use
large coherent color regions; there is no random per-triangle variation. Maximum
fan thickness is 0.142 m across a 0.620 m vertical span, tapering to 0.056–0.084 m
at the edge. It is intentionally still one modest vertical fan, never reoriented
toward individual cameras.

## Editable source and integration

- `build_tail.py`: dependency-free reproducible generator.
- `tail-fan-indexed.json`: indexed vertices, triangles, face regions, palette,
  outline parameters and exact V71 native bind pivot.
- `tail-native-study.json`: ordinary native tail-only part, not a complete enemy.
- `test_tail.py`: six structural/source checks.
- `render_comparison.py`: reproducible fixed-camera Blender comparison.

Run `python art/driftwood-isle/puffer-tail-study/build_tail.py`, followed by
`python art/driftwood-isle/puffer-tail-study/test_tail.py` from the repository root.

Integration transform is identity in V71 native x-right/y-up/z-forward space.
Replace only the part named `Tail root`; retain all V71 bones and other parts.
Tail bone index 2 and its original absolute bind position remain exact. First 44
triangles are the untouched V71 root, including all original colors and weights.
The fan and root are closed overlapping components, not a Boolean union. Distal
root-axis containment is tested; this is not a full intersection or animation
proof. Keep original V71 as a selectable comparison until visual acceptance.

The original root remains tapered, but the new teal face overlaps broadly around
its terminal axis. Do not call this a newly welded anatomical connection. A new
body cage must recheck root burial and may require a documented transform; this
study deliberately does not guess that future body’s dimensions.

## Review contract

Before integration, compare unchanged V71 versus this replacement at identical
hero, side and back cameras, with the original reference next to the hero. Use
actual rendered surfaces, identical studio light/exposure and unmodified body
geometry. Hero camera (3,4.6,2.25), target (0,-.03,.84), orthographic 3.2; side and
back use fixed shared scale 4.2 and target (0,-.0575,.79), in Blender coordinates.
Capture portrait 600×740. Label every panel before presenting it. Store full
review images in native Site review sources, not as additional Git binaries.

Reject a thick-coin silhouette, sharp repetitive serrations, cream confetti,
pinched exposed stalk, or increased tail/body separation. Structural tests are
not a likeness score. No full-nine, animation, combat, death or actual-game
acceptance is claimed by this isolated study.
