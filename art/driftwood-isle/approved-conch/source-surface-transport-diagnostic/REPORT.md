# Conch authored-surface transport control

2026-10-20. **Transport parity established on the retained selected-view attempt3 diagnostic host. Appearance acceptance remains false. Stop transport parameter work.**

## Result

One bounded REST-only experiment rendered baseline-native, source-contract-native, raw-source and restored-baseline synchronously at each of the existing nine views. Source-contract native agrees visually with raw source in silhouette, broad/cavity planes, eyes, armor and shell regions across all nine views. It also removes the baseline's conspicuous fine cavity/face stippling in the front-facing comparisons. It does **not** recover the original hero's pale, readable face, bright separated amber eyes, cream/coral shell or expansive stance. The native result remains ochre/red, face-small and shell-dominant, like raw source in this arena.

The complete authored surface contract is sufficient for source/native transport fidelity here, but is insufficient for original-hero likeness. This is not a new likeness score and does not import the Blender/source 4.05 assessment. The separate original-hero independent review is owned by the coordinator. No further gamma, palette, tint, filter, camera or lighting search follows this result.

## Exact checks and retained evidence

- Pinned GLB SHA256: `21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a`.
- Pinned mapping SHA256: `f6bb1437095c4f13c268b35d25f4710bbf7d6b728eacbeef825506d0fb2a60d6`.
- Independent GLB/accessor reconstruction covers all 51 mesh nodes, all 95 ordered primitive groups and all 14 materials. Every expanded source position and NORMAL component equals the pinned native export: 19,710 each. Groups cover all 6,570 vertices exactly once, without gaps or overlaps.
- Runtime native positions, 26,280 skin-index components, 26,280 skin-weight components and 15-bone order pass exact checks. Baseline runtime geometry/material/bind snapshot equals the original attempt3 capture snapshot. Only a cloned render geometry's NORMAL attribute/groups and the native mesh's temporary material references change.
- GLTFLoader source materials are cloned, not reconstructed from guessed settings. Exact source linear factors, roughness 0.7599999904632568, metalness 0, DoubleSide, non-flat shading, opacity 1 and vertexColors=false are asserted. No actor tint or second vertex-color factor is added. Captured source/candidate material settings agree.
- Actual selected draw programs are recorded from WebGL CURRENT_PROGRAM in onAfterRender, with linked status asserted. Native-source and raw-source fragment shaders are **byte-identical**. Their vertex shaders differ only by the native `USE_SKINNING` define. Both retain `SHADOWMAP_TYPE_PCF`. Baseline operative shaders are separately retained.
- All four passes share camera, lights/shadow settings, root/source-root, native bone/bind matrices, frozen clocks and composer settings. Each view warms all variants first. Original host inventory matches its recorded receipt before and after; no source or host bytes changed.
- Restored-baseline PNGs are byte-identical to baseline-native in all nine views. Original geometry/material references and every original geometry attribute array are unchanged after the final `finally` restoration. Browser closed cleanly.

## Residuals, not a tuning objective

Of 351,348 pixels per capture, source-contract native versus raw-source differs at:

| View | Different pixels | Pixels with any channel delta >8 |
| --- | ---: | ---: |
| front | 37 | 5 |
| left | 28 | 3 |
| right | 28 | 5 |
| back | 52 | 3 |
| top | 16 | 0 |
| diag-front | 54 | 11 |
| diag-left | 37 | 4 |
| diag-right | 26 | 1 |
| diag-back | 56 | 10 |

Baseline-native versus raw-source differs at 14,108–26,281 pixels per view. These are descriptive residuals, not a likeness/performance score or an optimization target. Native REST skinning reproduces source positions within 24.324 micrometres, rather than mathematically exact world positions: original Float32 weights have sums from 0.999999973 to 1.000000025 at world Y=900. Source and native also use different mesh organization/draw order. The tiny sparse residuals are consistent with these numerical/rasterization differences; their individual causes were not separately ablated. Exact source/native PNG identity is not claimed.

## Host, camera and execution boundaries

This is the exact **retained selected-view attempt3 host**, not current public Arena Conch4 and not a current-host admission test. No app build, source integration, publication or production asset change was performed. The nine-view directions, fitting algorithm, FOV 95, 6.481802053463358 distance and portrait 402×874 target remain unchanged. No camera tuning was introduced.

Historical attempt3 captured a moving world root over successive views. This experiment instead freezes the actual acquired native state with the existing public frame gate and stops the public clock without rewriting root, bones, elapsed time or simulation state. All nine quartets therefore share one actual REST root. Absolute world camera coordinates are **not** an exact replay of the historical moving-root captures. Camera state is identical within each new quartet; the original relative nine-view contract is retained. No animation, gameplay cadence or device-performance conclusion follows.

A preflight initially rejected a 1-micrometre bind/rest tolerance before any quartet was captured. Independent arithmetic on the original retained observation reproduced 24.323 micrometres of existing Float32 drift. The assertion was corrected to a documented 50-micrometre numerical bound; no rendering parameter or rig value changed. That failed preflight is retained, with private path prefixes sanitized in its log.

The temporary **95 primitive draw groups are diagnostic only**. They are not a production draw-count budget, performance admission, proposed renderer design or permission to ship. Original evidence, active owner/integration files, global materials, production/public assets, repositories and Mac were untouched.

## Evidence index

- `prepare.py`: independent pinned binary and primitive-group reconstruction.
- `adapter.mjs`, `capture.mjs`: isolated actual-host REST capture and restoration.
- `transport.json`: expanded channels and verified group/material mapping.
- `evidence/report.json`: host hashes, script hashes, nine quartet image hashes, completion and restoration.
- `evidence/setup.json`: runtime arrays, bind/rest/material validation and camera fit.
- `evidence/*-observation.json`: actual per-pass camera/light/material/program/root/bone/composer state; shader files use content hashes.
- `analysis.json`, `analyze.py`: post-capture invariants and descriptive residual calculation, no parameter search.
- `*-nine-view.jpg`: labelled review boards; original unmodified PNG captures remain in `evidence/`.
- `preflight1/`, `preflight1.log`: failed numeric-tolerance preflight, preserved separately.

## Portability-only source conversion after capture

`recorded-source/` preserves the exact three scripts used for the successful capture; their hashes match the unchanged `evidence/report.json` scriptHashes. `portability.json` records original/current hashes. Only file-location arguments were substituted: `prepare.py` now requires `--host`, `--native`, `--output`; `capture.mjs` requires `--host`, `--baseline-evidence`, `--transport`, `--output`, `--chrome`. The adapter and rendering algorithms are unchanged. The portable prepare command reproduces `transport.json` byte-identically. Portable capture passes syntax validation and was not rerendered. Run it under the standard browser lane with an approved installed browser and a fresh output directory. Inputs must be the same verified retained host and baseline evidence, never a substituted current public host.

Compact publication selection (all paths relative to this diagnostic directory): `REPORT.md`, `prepare.py`, `adapter.mjs`, `capture.mjs`, `analyze.py`, `transport.json`, `analysis.json`, `portability.json`, and the three labelled `*-nine-view.jpg` boards. The compact selection's binary budget is 1,295,831 bytes. The complete source-evidence set retains every original PNG, shader, observation, setup, log and failed preflight; total PNG+JPEG binary budget is 7,179,809 bytes. No recovery archive or Git write was created. Publication and native Site preservation are coordinator-owned, not claimed completed here.
