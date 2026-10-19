# Splinter Mantis V7 structural and capture check

2026-10-19 03:39 UTC. Builder's technical check; not independent likeness acceptance.

## Frozen inputs

Builder `art/driftwood-isle/lowpoly-mantis/build_mantis_v7.py`, 19,520 bytes,
SHA-256 `442540438fc5c1f9fb38c396854338b3ea049931ad28c0b0c15003911d940330`.
The canonical nine renderer and board source are the matching V7 files.
The approved original remains
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`.

## Verified actual result

- Serial Blender hero and canonical nine captures exited 0.
- 2,662 triangles across 75 closed mesh objects.
- Mesh-edge audit: 0 boundary edges, 0 edges used by more than two faces,
  0 degenerate polygon faces. This does not certify absence of intersections.
- Exported V7 vertex arrays exactly equal exported V6 arrays for all four
  wing surfaces, four embedded midribs, four femurs, four tibias and four tarsi.
  Some wood face triangulation/material assignments intentionally changed.
- The leaf-station function's V6/V7 parsed syntax trees are identical.
- Python syntax passes for builder, nine renderer and review-board script.
- Hero and all nine original PNG frames were inspected by the builder;
  full bounds remain inside the automatic framing. No image repainting.

Actual GLB: `tmp/mantis-v7/mantis-study-v7.glb`, 287,744 bytes,
SHA-256 `6f63fff9d162a02a4b650aeefa4ccb370fb8fe818c23e51c2d45575ac3c3ea6f`.
Portable authored mesh: `tmp/mantis-v7/mantis-mesh-v7.json`, 133,347 bytes.

Evidence: `tmp/mantis-v7/actual-v7-preview.webp`,
`tmp/mantis-v7/comparison-v7-board.webp`,
`tmp/mantis-v7/nine-view-v7-board.webp`, and all nine complete
`tmp/mantis-v7-nine/color-v7-*.png` frames. Frame directions are front,
left, right, back, top, diag-front, diag-left, diag-right, diag-back.
The common nine-view orthographic scale and individual camera transforms
are recorded in `tmp/mantis-v7-nine/cameras-v7.json`.

## Visual observations and limits

The new side profile tapers the cutting hooks sharply rather than exposing a
constant-width rectangular side slab. The face has a narrower pointed keel,
angled framing brows, deep cheeks and stronger green eye facets. Wing fronts
now contain broad triangular green breakup. Full orthographic front remains
symmetrical and angular; crown and cheek planes are still a stylized anatomical
interpretation. Wood colors remain lighter than the concept under the study
lighting. These are observations, not a score or an acceptance argument.

A fresh reviewer must inspect the original and all nine complete frames to
establish likeness. No inherited score, rounding or gameplay milestone is
claimed. Runtime admission, packing, skinning, motion, combat and physical-phone
performance remain separate work. V6 and unrelated assets remain preserved.
