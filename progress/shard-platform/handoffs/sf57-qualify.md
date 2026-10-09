# Handoff (sf57-qualify) — 2026-10-09, lane sf57-qualify4

## Landed
- Earlier lanes: `933205df4`, `f05a45712`, `1e428e7d7` (re-entry leaks), `17775d714` (calibration attributed), `236c1225d`
  (template sims at their measured 3.21 MB; composer covered by the measured home).
- `20225cf9a`: calibration measured (`progress/memory/sf57/calibration-243da2c5e/`). The open plots stop charging their two
  freed atlas canvases (−12.98 MB; the GPU half matches the census) and Driftwood's runtime row carries its re-read GL
  (196.345 vs 204.5, desktop census in `img`; WebKit agrees on the public home). Driftwood's physics bake re-run for the
  input hash. `scripts/soak`: a borrowed-home road plan (`home-to-road` lead-in once, then the boulevard laps).
- `2245b3c89`: the sampling gate counts unlabelled GL bytes, not handles (coordinator's pick).
- The qualifying public soak on `a098b4964`: `progress/memory/sf57/public-a098b4964/README.md`.

## Where it stands
Cells leg **qualifying PASS on the regrade** from raw (recorded verdict failed on one zero-byte create-then-label handle):
peak 852.7 MB, rule (b) passes (loop peaks 788.7 / 763.6 / 767.5), (M − E) / A 1.027–1.050, leaks 0. Road leg functional
PASS, calibration 1.018–1.020, no growth on the road, but rule (b) red on one sample the sampler tagged `drive` after the
teardown had freed GL (trough 527.1); a what-if without it passes.

## Left (in order)
1. A picked fix for the end-of-drive phase race (the worker waits one sampler interval after `phase('unloaded')` before the
   leak census, or the grader drops samples past `seconds`), then regrade the road leg from its raw archive (or rerun it).
2. WebContent growth in the cells leg: +3.8 / +3.3 / +2.8 MB per circuit with GL and A flat and none on the road: shrinking
   but no plateau proven. A diagnostic run that splits it (JS heap vs buffers vs bitmaps) is still owed.
3. The 236c1225d template-2-exit transient did not recur above 22 MB after loop 1; its allocation site is still unnamed.

Plan-State: unchanged
