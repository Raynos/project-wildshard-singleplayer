# Mantis complete pass1: construction and evidence

19 October 2026. Static study only. No self-score, quality acceptance or promotion.
The exact tested runtime candidate7 remains untouched. This pass changes no gait,
physics, Site, production asset or plan STATE file.

## Audit and governing reference

The approved original is
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`.
The builder inspected its actual pixels alongside V7 hero/nine evidence, and read
V3–V7 construction records and V4–V7 independent reviews before editing.

- V3 established continuous hooks and forward head placement, but clipped a blade.
- V4 added leg/neck/wing volume, retaining protruding eyes and detached ribs.
- V5 seated eyes and ribs, but retained the rectangular mask and simple leaf planes.
- V6 tapered the face and folded leaves, but the broad mask, eye plugs and slab
  weapons remained important weaknesses in independent review.
- V7 improved volumetric face, seated vivid eyes, bevelled sickles and green facets.
  Its full-nine review still identified a long mask/throat wedge, straight armored
  neck, bulky muscular shoulders, repetitive plates, regular fan and plain feet.

This pass uses V7 as the editable baseline. It preserves all older sources and
outputs. Hidden/back anatomy remains an interpretation, not authoritative AI
angle matching. The current target is the all-five four-star loop, superseding
historical lower static thresholds.

## Integrated construction

- Curved continuous rising thorax with a narrower upper section, smaller less
  repetitive bark scales and two long overlapping lateral chest splinters.
- Replace the projecting cream throat leaf with a short seated tapered ridge.
- Compress the deep facial wedge, shorten crown/temple projections, broaden and
  convexly facet the seated green eyes while keeping the compact pointed jaw.
- Slim the raptorial upper arm and elbow, preserve the hooked wood/ivory silhouette
  and its bevelled closed section. The elbow lowers into a more folded stance.
- Taper walking tibiae and hip plates, retain all four planted feet, and add closed
  ankle cuffs and paired articulated talons rather than plain terminal points.
- Broaden and deepen the four rooted leaf volumes, introduce different paired tip
  heights/spreads, and vary broad folds. Embedded ribs still derive from exactly
  the same stations as the leaves. No detached braces or camera-facing cards.
- Darker brown base with warm amber/lighter cut planes and vivid green variation.

Standalone source:
`art/driftwood-isle/lowpoly-mantis/complete-pass1/build_mantis_complete.py`.
This is authored geometry, not a repainted screenshot or generated replacement
reference. Source and portable mesh JSON are editable artifacts; temporary Blender
files remain outside the committed art folder.

## Structural verification

Actual Blender export and the independent read-only `preflight.py` pass:
3,024 triangles, 89 mesh parts and 20 named anatomical pivots. Boundary edges,
nonmanifold edges and degenerate polygon faces are all zero. Every position is
finite, every part has positive nonzero signed volume and closed two-use edges,
all face/material indices are valid, every static joint label resolves, and GLB mesh-node
names map exactly to the authored parts. No skins or animations are present.

These checks do not exclude self/inter-part intersections, prove mechanical joint
closure under motion, or establish native rig/runtime admission. The 20 authored static pivot labels are not parity with the tested 22-joint native
contract. The existing native adapter adds derived neck and abdomen joints and
reparents head/raptor roots to the neck. Its exact V7 hashes deliberately refuse
this changed source. New Integrated pale throat and Curved lateral chest splinter
parts also require explicit semantic neck mapping; ankle cuffs and talons require
verification under their knee regions. No native adapter or 22-joint runtime was
changed. Fresh complete mapping/rig/motion admission is required if selected.

V7 preservation:
- Builder SHA256 `442540438fc5c1f9fb38c396854338b3ea049931ad28c0b0c15003911d940330`
- GLB SHA256 `6f63fff9d162a02a4b650aeefa4ccb370fb8fe818c23e51c2d45575ac3c3ea6f`

## Matched evidence protocol

`render_matched.py` rebuilds both unchanged V7 and the candidate, then uses their
combined bounds to compute identical paired cameras. The nine cardinal/top/
elevated views share one orthographic scale; the hero also uses paired identical
transforms. Lighting, resolution, sample count and color transform are identical.
A new common camera receipt does not overwrite either historical V7 receipt.

Reproduce from repository root under the coordinated shared build lease:

    WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" HOME="$PWD/tmp/home" \
      PATH="$PWD/tmp/dot-audit/bin:$PATH" python scripts/heavy-lane.py build -- \
      blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/complete-pass1/render_matched.py -- \
      --out tmp/mantis-complete-pass1 --height 900 --samples 20

Raw actual images remain in `tmp/mantis-complete-pass1/baseline/` and
`tmp/mantis-complete-pass1/candidate/`. `assemble_evidence.py` retains ordinary
WebP frames and labelled boards without repainting. Fresh independent review
must inspect original pixels and every paired frame, not just boards. No likeness,
animation, combat-readability, phone performance or human-fun score is assigned by
the builder. No existing source score transfers to this changed candidate.

## Completed capture and builder inspection

The leased Blender run exited 0 in 246.36 seconds. All twenty actual 638 × 900
PNG frames exist, decode, and were individually inspected: both models' hero and
full nine. Every frame contains the full creature without clipped antennae, wings
or feet. The candidate has a shorter throat/face, slimmer arms, visible paired
talons and a less bilateral deeper leaf fan. The long armored neck, angular
shoulder masses and highly planar foliage remain visible limitations; construction
changes must not be treated as proof that those likeness deficits are solved.

Actual GLB position and normal accessors are finite, indices valid, positions match
the axis-transformed authored vertices to five decimals, and exported triangle
count matches 3,024. Rebuilt baseline GLB exactly matches the preserved V7 bytes.

All twenty compact full-frame WebPs, paired hero board, both nine boards, camera
receipt, portable mesh, GLB, mapping limits and structural audit are frozen in
`art/driftwood-isle/lowpoly-mantis/complete-pass1/`. `evidence.json` hashes those
files and the twenty original raw PNGs. Fresh independent review remains pending.
