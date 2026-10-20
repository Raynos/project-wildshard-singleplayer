# Keelmaw complete-character candidate

Source-only integrated character pass, 20 October 2026. Independent likeness review pending. No self-score, visual acceptance, runtime promotion or animation/contact acceptance.

## Editable source and preserved history

- `build_keelmaw.py`: complete candidate producer, stable through final build and captures.
- `capture_baseline.py`: original approved-keelmaw producer geometry, only root resolution and shared capture protocol changed.
- `build_keelmaw_failed_storage.py`: first complete source retained after GLB exceeded the 1 MB cap (1,098,484 bytes).
- `build_keelmaw_first_form.py`: reduced rope subdivision first form, before visible-eye/tail/limb finishing adjustments.
- `model/`: final native JSON, packed payload, metadata, GLB, construction and parity audit. GLB retains the old internal `keelmaw-v1.glb` filename for the established auditor; the actual candidate identity is `keelmaw-complete-character-next`.
- Existing prior sources and failed corpse studies are untouched. No collider recipe, padding, root lift, solver, generic engine or architecture changed.

## Integrated form changes

Broader shoulder-dominant torso and neck, deep continuous ivory cheek and lower-jaw wedge, broad sculpted muzzle and slanted brow, varied tooth spacing/length, more visible amber eyes, larger forelimbs/palms, thick lifted C-tail, swept overlapping shield armor, differentiated limb scutes, two helical rope strands and uneven recessed barnacle clusters. Face, silhouette and details were developed as one character rather than a runtime tuning change.

## Evidence boundaries

The authoritative original hero remains the likeness target. AI World and corrected Explorer sheets support approximate hidden views only. Their top orientation and some tail/pose conventions disagree. No anatomy is mirrored to satisfy contradictory panels.

Actual captures are Blender source-mesh renders with audited native/GLB structural parity, not in-game Model Explorer screenshots. Nine angles plus hero are freshly rendered for both baseline and final candidate. The original historical hero/elevated-right clipped the tail; this fresh pair uses a shared widened orthographic camera protocol for both models, lower hero elevation, identical target/lighting/resolution/sample count, and independently verified projected bounds for every mesh vertex. The producer’s pre-render `framingNDC` values sampled stale Blender camera matrices and are INVALID evidence; raw files are retained unchanged. `audit_framing.py` recalculates current-camera bounds from exact eye/target, roll, aspect and all native vertices. The capture receipt explicitly distinguishes corrected bounds from the stale raw values. This is a new paired comparison, not a claim that historical framing was unchanged. Camera and raw image SHA-256 evidence is in `review/capture-receipt.json`.

The actual native packed consumer is exercised by `source.test.ts`: all 19 native bones, all mesh attributes and absolute binds must equal the editable native source. `audit_source.py` checks native/GLB exact float32 position/color/joint corner multisets, oriented triangles, all nine numerical back-face visibility sets, single-sided materials, positive closed manifold components, nonzero triangle areas and inverse-bind closure. The numerical visibility directions are audit samples, separately enumerated in code; the actual captured cameras are in the capture receipt.

These tests do not establish welded anatomy, natural skin deformation, locomotion, hit coverage, physics contact or combat quality. Rigid single-bone component skinning remains. Existing dimension metadata is retained as an unadmitted core placeholder and must not be used as a newly validated contact representation. No new corpse construction or physics test was run.

## Reproduce

From repository root, with the existing writable shared heavy lane:

    WS_HEAVY_ROOT="$PWD/../heavy-lanes" PYTHONDONTWRITEBYTECODE=1 python3 scripts/heavy-lane.py build -- blender -b -t 2 -P art/driftwood-isle/approved-keelmaw/complete-character-next/build_keelmaw.py -- --out tmp/keelmaw-complete-character/final --render
    WS_HEAVY_ROOT="$PWD/../heavy-lanes" PYTHONDONTWRITEBYTECODE=1 python3 scripts/heavy-lane.py build -- blender -b -t 2 -P art/driftwood-isle/approved-keelmaw/complete-character-next/capture_baseline.py -- --out tmp/keelmaw-complete-character/baseline --render
    PYTHONDONTWRITEBYTECODE=1 python3 art/driftwood-isle/approved-keelmaw/complete-character-next/audit_source.py tmp/keelmaw-complete-character/final
    node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/approved-keelmaw/complete-character-next/vitest.config.ts
    PYTHONDONTWRITEBYTECODE=1 python3 art/driftwood-isle/approved-keelmaw/complete-character-next/make_review.py

The original `pnpm exec` invocation attempted a missing home-store directory and failed before tests; direct execution of the already-installed Vitest is used instead. No packages installed. Raw PNGs, first-form/failed-storage outputs and tool logs stay under `tmp/keelmaw-complete-character/` for native Site preservation, outside Git. Final compact previews are under storage caps. No browser, Mac, shared Git index, remote, Site or production writes were performed by this worker.
