# Complete-pass2 bounded geometry correction

Authoritative editable source: `build_selected_conch.py` + `geometry_checks.py`.
Frozen model: `conch-study.glb`. This candidate is **not visually approved or runtime-admitted**.

The original selected source and GLB are in sibling `complete-pass2/`, unchanged. Full report: `docs/reviews/conch-selected-geometry-admission.md` from repository root. `freeze.json` pins the final evidence and input hashes.

## Verification from repository root

    python art/driftwood-isle/approved-conch/selected-geometry-admission/test_source_gate.py -v
    python art/driftwood-isle/approved-conch/selected-geometry-admission/test_export_native.py -v
    python art/driftwood-isle/approved-conch/selected-geometry-admission/check_glb_diff.py
    python art/driftwood-isle/approved-conch/selected-geometry-admission/verify_capture.py

Source-indexed geometry audit can be re-executed under Blender with `check_indexed_diff.py`. Original source failures can be re-executed with `audit_source.py`. `rejected-transport-only-source.py` deliberately retains an unsuccessful intermediate; it must not be mistaken for the corrected candidate. Build output should go to a separate scratch directory when reproducing; do not overwrite this frozen evidence during review.

All 20 images in `captures/` are actual unedited renderer PNGs, 10 baseline and 10 corrected. No boards, image-generated substitutes, or Photoshop-like edits. Original source camera/light/sample code is reused directly; only optional `.blend` saving is suppressed.

The all-closed/unit-facet diagnostic remains false for original authored overlays and non-opposed cap shading. Existing native contract tests preserve these disclosed limitations; no source folds are waived. Full source domain negative controls remain in `baseline-source-sweep.json` and `rejected-transport-only-sweep.json`.
