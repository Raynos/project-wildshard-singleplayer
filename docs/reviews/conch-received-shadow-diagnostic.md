# Conch received-shadow diagnostic

2026-10-19. One bounded ablation, no appearance promotion or new quality score.

## Result

**Received shadows are necessary for the conspicuous fine within-plane stippling observed in this candidate's captured rest views.** Switching only the actual native SkinnedMesh's standard `receiveShadow` from true to false removes the dense fine pattern on face/cavity/body planes, while the broad geometric facets remain. The front and diagonal-front cavity become cleaner; side/back body planes also lose the dense stippling. Some small edge/antialiasing detail remains. This is a visual diagnostic conclusion, not a claim that every high-frequency pixel comes from shadows.

All nine ON/OFF pairs differ. Each restored-ON capture is byte-identical to its original ON capture. The custom shader **does honor the toggle**: the candidate's actual WebGL current program changes from ID 3 (ON) to 23 (OFF), and returns to 3. Read-back generated fragment sources differ (25,770 versus 20,432 characters). The ON fragment contains `interleavedGradientNoise` using `gl_FragCoord`, five `vogelDiskSample` shadow taps, and shadow depth comparisons; those received-shadow operations are absent from OFF. Thus this is a verified operative shadow-path bypass, not an inconclusive flag-only test.

It does **not** distinguish sampling noise from self-shadow acne, receiver/depth conventions, normal bias, or toon amplification. The earlier source hypothesis is strengthened, but no individual filter or toon parameter has been isolated. Brighter faces are expected when receiving shadows is disabled; this is not a proposed shipping look. Previous independent 59/100 and historical 64.75/100 assessments are unchanged.

## Exact experiment and controls

- Existing immutable `tmp/conch-color-view-dist-attempt1`, no rebuild. The existing capture identity admission and exact host inventory check passed before and after with identical results.
- Existing authored-colour candidate and original graph/material/tint/geometry. One actual native SkinnedMesh, initially `receiveShadow=true`, `castShadow=true`; cast remains true throughout. Material UUID/version/settings and geometry identity remain fixed across each triplet. Full runtime geometry, both graph objects, bounds and view directions also equal the prior colour-view capture exactly.
- Installed diagnostic instrumentation before the existing comparison adapter, so its render hook executes inside that adapter's exact synchronous rest camera/pose observation. Source stays hidden and native stays selected. No baseline/source render in the diagnostic.
- At each of the same nine views, warmed ON/OFF/ON cache variants without simulation advancement, then synchronously captured ON/OFF/restored-ON through the real composer. Only the public receive flag differs between passes; restored in `finally`.
- Camera, root, game frame/time and rendered light states match across all triplets. The existing adapter enforces zero-rest joint rotations and supplies bone/world state in each observation. Before-warmup light transforms can reflect the prior camera's cascaded-shadow fit; these are retained in evidence, not incorrectly required to match post-warmup transforms. All three **rendered** states match exactly.
- iPhone 16 Pro emulation, portrait 402×874, existing capture's device scale factor 1, muted installed Chrome/SwiftShader through the established browser lane. Diagnostic cadence only, no physical-phone, performance, gameplay or animation acceptance.

Runtime telemetry: phone tier; three enabled composer passes with minified runtime constructors `Bh`, `Ot`, `Ot` (full order recorded, semantic pass names not exposed). Directional shadow light intensity 2.7, colour [1,.97,.9], map 1024², bias -.00012, normalBias .05, radius 2; hemisphere intensity 1.15. Filter runtime wrapper is minified `hr`; generated fragment read-back is the stronger filter-path evidence. Material public roughness field is 1, while generated graph shader explicitly sets roughness .85; the public field alone is not the effective graph value. No direct runtime AO-object telemetry was collected; do not imply it was.

## Evidence and reproduction

Harness: `art/driftwood-isle/approved-conch/received-shadow-diagnostic/` (`capture.mjs`, `adapter.mjs`, `verify.py`). No engine, graph, source asset, pin or host file was changed.

Isolated evidence: `tmp/conch-color-view-qa/received-shadow-attempt1/`.

- 18 genuine canvas PNGs: ON/OFF for front, left, right, back, top, diag-front, diag-left, diag-right, diag-back.
- `report.json` and nine observation JSONs include controls, actual selected GPU program/cache keys, fragment sources, flags, original/restored state and identity receipts. Restored-ON payloads were hashed rather than retained as another nine PNGs.
- `actual-runtime-geometry.json`, `actual-candidate-on.frag`, `actual-candidate-off.frag`, and `verification.json`.
- Three labelled WebP contact sheets are explicitly cropped review derivatives of raw captures. All nine paired views were visually inspected; raw front pair was also inspected directly.
- Verification asserts identical inputs/controls, operative distinct shader selection, nine byte-identical restorations, all original flags restored and exactly 18 PNGs. Changed-pixel counts by view: 4280, 4919, 2501, 4656, 2394, 4874, 3327, 2790, 3464. These are not quality or stipple scores.
- Output approximately 8.63 MiB, below 35 MiB. Owned browser/server closed; no Git, Site, Mac, build, shader edit or parameter sweep.

Run `node --check` on both harness modules. Capture uses the same HOME/TMPDIR/PATH/CHROME_PATH environment as previous dot audit captures and `bash scripts/browser-lane.sh --max 12 node art/driftwood-isle/approved-conch/received-shadow-diagnostic/capture.mjs`. A repeat must choose a fresh `CONCH_QA_OUT` under `tmp/conch-color-view-qa/`; existing evidence is never overwritten by capture. Verify the retained attempt with `python3 art/driftwood-isle/approved-conch/received-shadow-diagnostic/verify.py`.

**Disposition:** bounded diagnostic complete; current appearance remains unpromoted. Any narrower filter/bias/toon isolation is separate work requiring a new scope.
