# Conch authored-color actual REST results

2026-10-19. **Capture complete; visual acceptance withheld.** All nine views have synchronous baseline-native, authored-color candidate-native and source-GLB renders: 27 actual PNGs. No animation, gameplay, combat-distance, physics, physical-phone performance or likeness score is claimed. Retained native likeness stays 64.75/100 pending an independent new candidate review.

## Exact build and capture

Root-reviewed immutable build pin authorized the isolated product and host. SDK product admission and pre/post build inventory checks passed; host capture identity is identical before/after. Product/app ran under the established shared heavy lane in 16.72 seconds; one muted installed headless Chromium ran through the browser lane and closed with its server afterward. Approximate combined product/host/QA storage is 22 MiB, below the 80 MiB limit. No earlier host, original candidate, existing pin or engine/schema source was edited.

- Product: `tmp/conch-color-view-attempt1/candidate`
- Actual host: `tmp/conch-color-view-dist-attempt1`
- Complete raw evidence: `tmp/conch-color-view-qa/attempt1`
- Build pin SHA-256: 0ffa7acb554ae68f014d578d8082116a6c02875d829266a73ef844d01ed105ae
- Host inventory receipt SHA-256: 5b35b40450484f9a7c7ea20d9d5ec7cd66a26aff2ca4de9b76501c47b6c63b64
- Capture report SHA-256: 0f56fa8827dacb2b31a39967975ff6d056b8dde7d535de57679f8d77c3b5c666

## What the comparison proves

All three passes are synchronous under one actor root and one camera. The baseline material is compiled from the retained original graph by the unchanged compileGraph, sharing the actual live ToonLook through lentToon. The candidate pass uses its actual host material. Public material state including live tint and emissive is copied to the baseline. Original candidate material arrays are restored in finally. This is comparison-only composer sampling and material/visibility switching, not a playable variant or an engine/shader patch. Source GLB retains its source materials. Baseline and candidate differ exactly at the paint input; the generated candidate product itself contains only its candidate graph.

Every rendered baseline/candidate/source/after light snapshot matches within each triple. Source and native roots match exactly. The same nine camera contracts, FOV-fit and room bounds as the valid prior comparison are retained. All 27 visible-candidate pixel checks pass; bounds checks contain the full projected model and camera within the room. Front candidate/baseline and true-top candidate were directly inspected by this capture author: visible model, no image-edge clipping or ceiling occlusion. Full individual-image independent inspection remains a separate review requirement.

The captured actual host has all 19,710 authored-color components exactly equal to the admitted Float32 original colors. Its six old runtime channels (positions, normals, legacy colors, skin indices, weights and fur lengths) are exactly equal to historical attempt3, not merely within a tolerance. This does not undo default normal/color faceting: original pre-facet normal and color differences remain. Source geometry and candidate skinning were not changed.

## Limited pixel observation

The following RGB mean absolute error uses the union of warm-color pixels across all three raw frames. It is a heuristic mask, not perfect segmentation, not a quality score and not directly interchangeable with historical two-image masks. Candidate/source error decreases slightly in eight views and increases in diag-left. Front face/body stippling is still plainly visible; this candidate has not established resolution of that defect.

| View | Baseline/source MAE | Candidate/source MAE |
|---|---:|---:|
| front | 8.171 | 8.020 |
| left | 14.420 | 14.017 |
| right | 10.150 | 9.611 |
| back | 13.479 | 12.798 |
| top | 16.432 | 15.695 |
| diag-front | 12.402 | 12.243 |
| diag-left | 16.823 | 16.999 |
| diag-right | 15.398 | 14.839 |
| diag-back | 13.613 | 12.643 |

Raw PNGs are intentionally untouched and have no burned-in labels. They are internal evidence; any user-facing board must clearly label baseline, candidate and source and say REST diagnostic. The existing HTML diagnostic is not part of the raw canvas PNG. No new quality score, public host promotion or acceptance follows from the small error reductions.

## Validation

Six authored-color Vitest tests, three deterministic Python checks, three camera-room tests and three adapter admission/closure tests pass. Capture finished nine triples with zero errors and verifies exact input, product and host identity before and after. Build warnings concerned existing dynamic/static import overlap, not failure. Prebuild review remains immutable for pin verification; this separate results page does not invalidate it.
