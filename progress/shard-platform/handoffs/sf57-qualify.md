# Handoff (sf57-qualify) — 2026-10-09, lane sf57-qualify3

## Landed
- `933205df4`, `f05a45712`, `1e428e7d7` (earlier lanes): Driftwood's re-entry copies and residuals are gone.
- `17775d714`: calibration attributed (`progress/memory/sf57/calibration-1e428e7d7/README.md`).
- `236c1225d`: the model fix. Template regional sims charged their measured 3.21 MB (the highest of Chromium 4.83 / WebKit
  3.42 per sim incl. the 1.63 MB basis, Node 3.07 without it; `progress/memory/sf57/regional-sim-cost/`) through
  `ShardManifest.regionalSimCost` and `regionalSimAccountedBytes` (runtimeCost.ts), never above the declared ceiling; the
  page composer is covered by a measured whole-page home (`allocator.markMeasuredPage`; coverage by an unmeasured claim
  refused, `test/grid-measured-coverage.test.ts`).
- The qualifying public soak on `236c1225d`: `progress/memory/sf57/public-236c1225d/README.md`.

## Where it stands
Cells leg functional PASS, peak 835.7 MB (164 MB under the cap), A 536.2 → 454.1 MB, (M − E) / A 0.975–0.999: still under
1.01. Rule (b) fails on a one-off circuit-1 WC spike (835.7 vs 767–789 for the other loops). Settled growth +3.42 MB per
circuit, WebContent only (GL and allocator flat). The road leg could not start: the harness's road plan expects a page
that boots on the road, and the public page boots in its borrowed home.

## Left (in order)
1. ≈ 16 MB of calibration: re-derive the l0 product charge (71 MB accounted vs 45 MB of GL the grid adds) and add
   Driftwood's `img` GL row (204.5 claimed vs 196.3 measured). Cap and window unchanged.
2. Attribute the circuit-1 WC spike (road admission, template-1/2/4 resident).
3. Split the +3.42 MB/circuit WebContent growth with a diagnostic run (heap snapshots are not allowed in a qualifying run).
4. A borrowed-home road plan in `scripts/soak/owned.mjs` so the public road-only leg can run.
5. Then one more qualifying public soak (cells + road) on current origin/main.

Plan-State: unchanged
