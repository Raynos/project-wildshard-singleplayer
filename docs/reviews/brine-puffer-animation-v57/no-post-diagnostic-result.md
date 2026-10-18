# V57 motion2: reduced-post diagnostic result

Executed 2026-10-18 20:42:56.710–20:44:10.565 UTC; process exited 0. No browser or HTTP errors. Real model, rig, AI, simulation and input controls stayed unchanged. The same page switched from normal look to explicitly labelled post/shadows-off capture. No public artifact changed.

Baseline: 183 rAF observations, mean 4.50 Hz, median gap 0.22155 s. Diagnostic: 709 observations, mean 24.03 Hz, median gap 0.03725 s including warm-up. Warm complete attack stages consumed 2.17–2.23 wall seconds versus 4.87–4.90 seconds for baseline, with the same authored 2.1-second clock. This is observed browser cadence, not a phone-performance result or a guarantee of video motion quality.

## Important buffer limitation

Both measured inventories report pixel ratio 1 and 390×844 canvas/drawing buffer. The capture context used deviceScaleFactor:1; Game sets pixel ratio to min(devicePixelRatio, tier cap). No render-scale setting was changed, but this does **not** verify mandated phone 2× rendering. A separate 780×1688 buffer test is required. Prior cloud captures likewise must not be described as measured 2× evidence.

Four passes began enabled. Only the first scene pass remained enabled and became renderToScreen; the other three were disabled. Shadows changed true→false. This omits AgX, grade and other post effects, so it is motion diagnostic footage only. The final screenshot shows the actual rendered model and diagnostic label, though the close frontal view still occludes feet behind controls.

Raw video: page@0a85d461f4bffa8f482336319f8eaf68.webm; SHA256 dea225137fa44e4e4ecd17633bfa50e9790eaf8e4fb3f7f492bd88a236edf513. Authoritative stage/clock samples and before/after pass/buffer inventories are in no-post-diagnostic-telemetry.json. Source pin 07e88721a8ff7283e16b71f4b2d7a1b02b95dfa3; native pin d416b961d57f70a5d6a77753a72aba0b2d19db12. No independent frame audit of this diagnostic video yet.
