# Splinter Mantis V6 — tapered cranium and folded wings

Source-only candidate, not yet rendered or accepted. Root owns the queued
Blender run and independent review. V1–V5 remain preserved.

## Change from V5

- Raise a central cranial crest and slope both upper brow corners toward it,
  eliminating the horizontal rectangular forehead.
- Taper cheek and nose planes forward/down into the pointed insect face.
  Keep thin angular seated eyes; shorten the small lower mandibles.
- Give each wing five purposeful staggered stations with alternating ridge
  and edge heights. These produce real broad folded surfaces.
- Drive leaf surfaces and embedded wooden midribs from the same station
  function, preserving V5's corrected attachment throughout the fold.
- Retain overlapping dorsal neck shells, shaped legs, continuous hooks,
  closed volumes and automatic complete-bounds framing.

Python syntax passes for builder, canonical renderer and evidence-board source.
Blender geometry metrics, export, actual views and likeness are unverified for
V6. Do not transfer V5's geometry results or score to this candidate.

V5 independent parent review was 3.2075/5, below the requested strictly-above-3.5
bar: silhouette 3.35, face 2.8, details 3.5, facets/style 3.3, weighted
35/30/20/15. Its actual hero and nine-view boards remain available. V5 improved
rib seating and dorsal continuity but retained a rectangular mask-like face.

## Queued reproduction

After root grants the heavy lane, run serially from repository root:

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis_v6.py \
      -- --out tmp/mantis-v6 --render --view front --samples 24 --height 1100

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/render_mantis_v6_nine.py \
      -- --out tmp/mantis-v6-nine --samples 16 --height 700

    python art/driftwood-isle/lowpoly-mantis/review_board_v6.py

Expected combined render duration is roughly 85–100 seconds based on V5.
Coordinates are X lateral, -Y front, Z up, with Y-up GLB export. Canonical views
are front/left/right/back/top plus four elevated cardinal diagonals, with one
shared automatically fitted orthographic scale. Hero camera matches the
existing V4/V5 direction and uses complete-bounds framing.

Original approved concept remains the authority. No new target generation,
runtime edits, animation, combat, performance or quality-completion claim.
