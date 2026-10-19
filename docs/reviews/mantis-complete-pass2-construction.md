# Mantis complete pass2: curved anatomy study

2026-10-19. Static candidate only; independent review pending. No self-score,
selection, native admission or score transfer is claimed. Complete-pass1, V7 and
the tested runtime remain unchanged. All new authored files are isolated under
`art/driftwood-isle/lowpoly-mantis/complete-pass2/`.

## Complete anatomical revision

The rising prothorax is a seven-station continuous curved volume: a near-upright
basal stem turns into a forward cervical arch, with its throat and overlapping
bark shells rebuilt around that centerline. The narrow compact cranial assembly
has enlarged integrated compound-eye facets, recessed lightweight socket rims,
a lowered central crown and tucked cheek shells instead of heavy angular brows.
Raptorial upper arms and forearms are rebuilt as slimmer tapered articulated
segments; both defining sickles retain actual curved depth and separate ivory
cutting volumes, with reduced wrist and shell thickness. Four folded leaf volumes
have individually authored unequal tips, widths and asymmetric bending paths;
their embedded woody ribs follow their exact new ridge stations. The four walking
legs, independent raptorial chains, antennae and overlapping abdominal anatomy
remain present. These are editable geometry, not painted detail or a hero overlay.

This is a continuation from pass1, not a claim that all criticized identity gaps
are solved. The complete original pixels and pass1 independent review informed
construction. Original hidden/back anatomy is interpretation.

## Mapping limits

Twenty static pivot labels are retained, together with per-object joint and pivot
metadata. The tested native contract has 22 joints. The derived neck and abdomen
joints are absent here; head and raptor parentage also needs explicit remapping.
`mapping-limits.json` enumerates every part and a proposed mapping, including body
parts the old semantic adapter cannot match. Its exact-source pins must continue
to reject pass2. A new exact-source adapter, articulation/contact verification,
clips, native admission and fresh runtime evidence would be separate work. None
of these were performed, and no runtime, AI, physics, Site or STATE file changed.

## Evidence reproduction

From the repository root, run the shared lease with WS_HEAVY_ROOT set to
`$PWD/tmp/heavy-lanes` and HOME set to `$PWD/tmp/home`:

    python3 scripts/heavy-lane.py build -- blender -b -t 2 \
      --python-exit-code 1 -P \
      art/driftwood-isle/lowpoly-mantis/complete-pass2/render_matched.py -- \
      --out tmp/mantis-complete-pass2 --height 900 --samples 20

The renderer rebuilds preserved pass1 and pass2 separately and uses shared
union-bounds cameras, common nine-view scale, identical lighting, 638 × 900
portrait resolution, 20 Cycles samples, no denoising and AgX. Hero plus nine
views are captured for both real models. Raw PNGs and Blender scratch files stay
in `tmp/mantis-complete-pass2/`; no archive or committed blend is created.
The assembler only resizes and labels actual evidence. All deliverable images
carry burned-in labels; all boards are portrait. Structural preflight checks
closed edge incidence, signed volume, finite coordinates, valid material/face
indices and exact exported mesh-node/position/triangle agreement. Such checks
do not exclude intersections or establish a rig, likeness, performance or fun.

## Exact structural result

Preflight passes with 89 closed mesh parts, 3,052 triangles and 20 authored pivot
labels. The GLB is 329,944 bytes, SHA-256
`3566ee1301fd6461d59ff5627ae922856f952667310f6d36463c2ff706927604`.
Boundary edges, nonmanifold edges and degenerate faces are all zero. The portable
mesh JSON and exported GLB positions agree after the documented axis transform
to five decimal places; mesh-node names and triangle counts agree exactly.

## Failed attachment attempt preserved

The first complete capture exposed a real gap between both shoulder roots and
the new curved neck, despite manifold preflight passing. That entire candidate
remains under `complete-pass2/failed-root-gap/`: editable source, exact executed
source paths and hashes in provenance JSON, GLB, portable mesh, all twenty compact previews,
boards, camera receipt and independent structural result. The standalone failed
source had trailing whitespace removed only after capture finished; its AST is
identical to the preserved exact executed bytes. It did not directly produce the
failed captures. The raw PNGs and blend remain in
`tmp/mantis-complete-pass2-failed-root-gap/`. No archive was created.

The bounded correction moves both raptorial shoulder roots from
(side × 0.14, -0.22, 1.94) to (side × 0.12, 0.10, 1.94), inside the curved
prothorax. No other geometry changed. The corrected source was normalized
before its own build/capture and is the exact executed final source. The final
renderer uses `--reuse-baseline tmp/mantis-complete-pass2-failed-root-gap` to
reuse real pass1 captures only after asserting exact equality of all camera
transforms/scales and the rebuilt baseline GLB bytes. All ten corrected candidate
views are newly rendered; no failed candidate frame is reused.

## Final capture closure

Both render leases exited successfully: first attempt 310.18 seconds, corrected
candidate 150.00 seconds, excluding queue time. The builder individually inspected
all ten matched pass1 frames and all ten corrected pass2 frames. The final arm roots
are seated against the neck in both profile views; the original gap is absent.
All creatures fit within their frames, with real volumetric continuity in back,
top and diagonal views. Angular leaf edges, a narrow frontal throat strip and
planar face facets remain visible; these are observations, not likeness scores.

`capture-check.json` validates all twenty 638 × 900 PNGs and projects every mesh
vertex through its actual camera to verify frame containment. Rebuilt pass1 GLB
has identical binary geometry/material values and semantic JSON to preserved pass1,
but material/mesh datablock names lack the historical .001 suffixes. Portable mesh
and metrics are byte-identical. The exact discrepancy is recorded in the receipt. `mapping-limits.json` includes the
full per-part mapping proposal and seven names unmatched by the old adapter.
All previews are below 250 KB and all three portrait boards below 500 KB.
`evidence.json` closes final source, GLB, mesh, camera, checks, labels and raw frame
hashes. Fresh independent comparison against the approved original remains needed.

The first closure assertion requiring historic GLB byte identity failed.
`baseline-name-differences.json` preserves that discrepancy and enumerates every
permitted name change. Verification accepts only removal of a final `.001` from
material/mesh datablock names, then requires all remaining JSON and the entire
binary chunk to match exactly. No historical source or evidence was rewritten.

Copied mesh, metrics and camera JSON deliverables receive a terminal newline;
parsed values match raw build outputs. The GLB bytes are unchanged.
