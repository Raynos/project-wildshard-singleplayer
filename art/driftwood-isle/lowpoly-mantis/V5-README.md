# Splinter Mantis V5 — seated eyes, neck shells, leaf ribs

V5 corrects the full-view V4 findings against the same approved low-poly
reference. V4 is preserved, including its independent weighted likeness of
3.115/5 (silhouette 3.3, face 2.8, details 3.2, facets/style 3.2; weights
35/30/20/15). No new target was generated and no score is assigned by this builder.

`build_mantis_v5.py` is standalone editable Blender 4.3.2 source. It broadens
cranial brow/cheek geometry, replaces protruding eye volumes with thin angular
caps seated in the face, adds four overlapping dorsal neck shells, and computes
each woody wing rib from exactly the same folded ridge positions as its leaf.
V4's shaped legs, curved continuous hooks, anatomical pivot metadata, broad
facets and complete auto-fitted framing are retained.

Actual hero and canonical nine-view renders completed successfully. All nine
show the full silhouette. Side/rear views show the ribs seated against their
leaves instead of visibly detached straight braces. The dorsal neck now has
purposeful overlapping planes. The broad cranial front is still visually flat
and simplified compared with the original concept, so independent likeness
acceptance remains pending.

Metrics: 2,218 triangles, 71 mesh parts, zero boundary edges, zero nonmanifold
edges and zero degenerate faces. Independent hero/nine rebuilds produce the
same GLB bytes and the same authored geometry. No animation is present.

Reproduce after coordinating the heavy lane, from repository root:

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis_v5.py \
      -- --out tmp/mantis-v5 --render --view front --samples 24 --height 1100

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/render_mantis_v5_nine.py \
      -- --out tmp/mantis-v5-nine --samples 16 --height 700

    python art/driftwood-isle/lowpoly-mantis/review_board_v5.py

Coordinates: X lateral, -Y front, Z up; GLB is Y-up. The canonical nine use a
common full-bounds orthographic scale, four cardinal views, top and four
elevated cardinal diagonals. Camera transforms are saved. Lighting, exposure
and material decoding match V4. Hidden anatomy remains an interpretation.

Portable authored geometry and metrics are ordinary versioned JSON files
beside the source. GLB, raw renders, cameras and labelled boards remain in
ignored `tmp/mantis-v5` / `tmp/mantis-v5-nine` pending coordinator storage and
publication. No `.blend` belongs in Git.

Likeness, rig/animation, draw-call optimization, runtime integration, isolated
combat/loot/retry, phone performance and human fun are separate gates. This
study establishes only actual geometry/export/render evidence.
