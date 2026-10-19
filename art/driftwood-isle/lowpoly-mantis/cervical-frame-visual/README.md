# Frozen cervical-frame repair: matched capture evidence

Actual Cycles captures of the frozen cervical-frame-repair source and its exact
complete-pass2 predecessor. Neither input model was changed. The approved concept
was inspected as pixels; its cropped panel is explicitly labelled as a concept.

## Review status

**Independent visual review pending. No score assigned and no promotion.**
The historical **3.935** applies only to the original complete-pass2 geometry.
No native articulation, collision/contact or combat-readability acceptance is
claimed. This packet is static evidence, not a gameplay screenshot.

## What to inspect

- `matched-hero-board.webp`: approved concept plus matched real source heroes.
- `baseline-nine-board.webp` and `candidate-nine-board.webp`: front, left, right,
  back, top and four elevated cardinal diagonals. All nine share one scale.
- Twenty individually labelled WebP previews preserve each actual capture.
- `cervical-detail-board.webp`: identical pixel-region enlargements of the actual
  hero/front/left/right frames; no repainting, geometry isolation or new render.
- `evidence.json`: authoritative raw PNG paths/hashes, full-model projection fits,
  source pins, overlap disclosure and pending-review status.

Raw lossless, unlabelled 638×900 PNGs are retained under
`tmp/mantis-cervical-frame-visual/{baseline,candidate}/` and must not enter Git.
WebP previews are ordinary evidence, each below 250 KB; boards below 500 KB.

## Correspondence and controls

`render_matched.py` executes the frozen builders into task-owned scratch output.
Before rendering each model, it asserts parsed portable mesh and metrics equality
and exact GLB binary plus all non-name JSON equality with the frozen exports.
`capture-provenance.json` records exact source/frozen/rebuilt hashes and actual
per-view camera/settings receipts. The candidate GLB rebuild is byte-identical.
The baseline differs only in 90 material/mesh `.001` name suffixes, recorded in
`baseline-name-differences.json`; its complete binary and other JSON are exact. `cameras.json` records shared union-bounds
cameras and lighting: Cycles 20 samples, seed 0, no denoising, AgX and identical
three-area-light studio. Each source starts in a factory-empty Blender scene.

`check_correspondence.py` independently checks source polygon boundary/material
correspondence, GLB points/normals and all six packed native channels. Baseline
folded facets remain reported; no normals are silently corrected. The candidate
must have zero opposed normals. Non-flat authored polygon normal deviations are
reported rather than hidden. This is source/native correspondence, not a new
independent visual judgment.

The seven changed terminal points were fixed upstream, maximum displacement 0.25.
The pre-existing geometry audit reports incident triangle intersections with the
skull changing 33→24, plus new rear collar +1:10, rear collar −1:12 and integrated
pale throat:8. These counts are explicitly carried in this packet; overlap is not
contact or articulation acceptance.

## Reproduce

Run from the repository root, with the coordinator's sole rendering slot:

    WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- blender -b -t 4 --python-exit-code 1 -P art/driftwood-isle/lowpoly-mantis/cervical-frame-visual/render_matched.py
    python3 art/driftwood-isle/lowpoly-mantis/cervical-frame-visual/check_correspondence.py baseline
    python3 art/driftwood-isle/lowpoly-mantis/cervical-frame-visual/check_correspondence.py candidate
    python3 art/driftwood-isle/lowpoly-mantis/cervical-frame-visual/assemble_evidence.py

Do not delete earlier evidence, change either input, transfer the historical score
to the repair, or promote the candidate from this capture check.
