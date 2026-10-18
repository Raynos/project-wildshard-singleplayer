# Splinter Mantis: low-poly reconstruction study

Editable source: `build_mantis.py` (Blender 4.3.2). This is a new study, not a
replacement of previous assets, not runtime-wired, and not visually accepted.
The owner explicitly approved the five revised low-poly mockups on 18 October
2026. That approves the visual target, not this actual model.

## Design

The approved reference is
`../concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`, compared with
the original Driftwood crab/monkey concepts and `round-8-assets/ref-shrine.jpg`.
Retain a long rising prothorax, triangular head, conspicuous green eyes,
segmented horizontal abdomen, four walking legs, two folded raptorial arms,
four leaf wings and bent twig antennae. Large matte wood planes and thick
folded leaves replace fine bark grain, dense splinters and arbitrary facets.

The script authors actual closed three-dimensional surfaces. Wings have
lenticular thickness, hooks have sectional curvature and solid cutting teeth.
There are no camera-facing cards, textures, random perturbations or fake
silhouette surfaces. Every limb has a named anatomical hinge in metadata;
previous prototype pivot positions are deliberately not reused.

## Build and review

From repository root (coordinate render access with the coordinator):

    blender -b -t 2 --python-exit-code 1 \
      -P art/driftwood-isle/lowpoly-mantis/build_mantis.py \
      -- --out tmp/lowpoly-mantis --render --view front

Use `--view side` or `--view rear` for walk-around geometry review, `--clay`
for neutral materials, or omit `--render` for export only. Outputs stay in
ignored `tmp/lowpoly-mantis/`: GLB, portable mesh JSON, metrics, `.blend`
and raw portrait render. Only source and compact labelled review evidence
belong here. The generated `.blend` is a convenience, never the source or a
Git artifact. This study uses X lateral, -Y forward, Z up; GLB export is Y-up.

## Acceptance boundary

Python syntax and Blender 4.3.2 export pass. Actual front render inspected:
1,542 triangles, 53 mesh parts. Identity and anatomical articulation read, but
the study is incomplete and below the approved target: pale wood/green palette,
overly straight brow, narrow hook blades, clipped left-edge framing and
insufficiently shaped shoulder/abdomen planes. The comparison board preserves
this unsuccessful first study honestly.

One retry disabled denoising because this Blender build has no OpenImageDenoise
support. No geometry was changed for the retry. The actual study GLB is
`mantis-study-v1.glb`; metrics and anatomical pivots are in `metrics-v1.json`.

Rear/side views, rigging, animation, Model Explorer, arena behavior, phone
performance and human fun remain untested. Neither an export nor this README
establishes quality acceptance. Runtime wiring follows successful render review.

## V2 correction and inspection

`build_mantis_v2.py` is separate editable source; the first study is preserved.
All declared sRGB palette swatches are explicitly decoded to linear material
inputs. Lighting and exposure were not changed to fake the color correction.
The new study broadens hooks and leaf wings, adds purposeful thorax plates,
angles the brow and changes the camera/framing to match the target side.

Actual v2 export and front render pass: 1,686 triangles, 59 mesh objects, zero
boundary edges, zero nonmanifold edges and zero degenerate faces. The model
is still unaccepted. The inspected render is clearly improved in wood/green
color and blade mass, with the complete silhouette visible. Remaining gaps:
rigid angular upper-arm cross-sections, insufficient tapered/overlapping body
planes, large simplified head and too uniformly straight leaf ridges. Rear
and side review are still required before rigging or runtime integration.
These visual judgments are not a 5/5 claim.

V2 evidence: `comparison-v2-board.webp`, `actual-v2-preview.webp`,
`mantis-study-v2.glb`, and `metrics-v2.json`. Reproduce with the same command
above, substituting `build_mantis_v2.py`, then `review_board_v2.py`.
