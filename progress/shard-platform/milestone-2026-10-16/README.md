# Milestone frame floor — 2026-10-16 UTC

Source `f542a4cfbaa5978bdc8e4ed293f2c1a119d853fd`; one stock DEVSERVER build `f542a4c-mvai5jw6`.
Desktop Chromium/Metal 1440×900, 2×, Auto fps; portrait iPhone 17 Pro Simulator Safari, phone tier, 2×, shipped 30 fps cap. Muted, Developer on, live clocks, 120-frame samples, default pacing, no profiler or GL observer.

Desktop bar: rounded median ≥60 fps, p95 ≤17.5 ms, max ≤100 ms. Safari preset: ≥30 fps, ≤35 ms, ≤200 ms. Native content CPU ownership/validity checks remain active. Simulator results are Mac-backed Safari, not physical-iPhone fps.

Each row below shows the worst-p95 window’s median / p95, then the worst frame across that group. Windows are not pooled. Full per-pose, travel, drive and interior rows, errors and CPU validity are in [receipt.json](receipt.json).

| Surface | Shard / scope | Median / p95 / worst ms | Previous median / p95 / worst ms | Page errors | Verdict |
| --- | --- | ---: | ---: | ---: | --- |
| desktop | Pine standing | 16.7 / 16.7 / 16.8 | 16.7 / 16.8 / 16.8 | 0 | PASS |
| desktop | Driftwood standing | 16.7 / 16.8 / 16.8 | 16.7 / 16.8 / 16.8 | 0 | PASS |
| desktop | Sky standing | 16.7 / 16.8 / 16.8 | 16.7 / 16.8 / 16.8 | 0 | PASS |
| desktop | Signal standing | 16.7 / 16.7 / 16.8 | 16.7 / 16.8 / 16.8 | 0 | PASS |
| desktop | Pine road | 16.7 / 33.4 / 983.3 | 16.7 / 33.4 / 100 | 0 | FAIL |
| desktop | Driftwood road | 16.7 / 16.8 / 66.7 | 16.7 / 16.8 / 83.4 | 0 | PASS |
| desktop | Sky road | 16.7 / 16.8 / 66.7 | 16.7 / 16.8 / 50 | 0 | PASS |
| desktop | Signal road | 16.7 / 16.7 / 83.3 | 16.7 / 16.8 / 50 | 0 | PASS |
| desktop | Hub/grid standing | 16.7 / 16.8 / 16.8 | 16.7 / 16.8 / 16.8 | 0 | PASS |
| sim | Pine standing | 33 / 34 / 35 | 33 / 34 / 35 | 0 | PASS |
| sim | Driftwood standing | 33 / 36 / 42 | 33 / 34 / 35 | 0 | FAIL |
| sim | Sky standing | 33 / 34 / 36 | 33 / 34 / 41 | 0 | PASS |
| sim | Signal standing | 33 / 34 / 34 | 33 / 34 / 34 | 0 | PASS |
| sim | Pine road | 34 / 81 / 852 | 33 / 55 / 109 | 0 | FAIL |
| sim | Driftwood road | 33 / 44 / 113 | 33 / 39 / 93 | 0 | FAIL |
| sim | Sky road | 33 / 45 / 310 | 33 / 47 / 136 | 0 | FAIL |
| sim | Signal road | 33 / 38 / 135 | 33 / 34 / 89 | 0 | FAIL |
| sim | Hub/grid standing | 33 / 34 / 164 | 33 / 34 / 35 | 0 | PASS |

Comparison: [last full milestone](../../frame-floor/milestone-2026-10-13/README.md), `fea49ae28`, standalone and second grid run. It already failed Pine desktop travel/drive and Safari Sky/Pine/Driftwood travel; old Signal passed. New failures require repeat/matched-pin attribution rather than a historical-number-only claim.

Boot smoke: 5/5 PASS using the repository’s unchanged bootCase, fresh contexts and a fresh browser before the grid; real title entry, ten live frames, grid home/rings and Signal road crossing. Zero faults/reports.

**Verdict: floor FAIL; boot PASS (5/5).** All primary cases completed with zero page errors. The frozen grid also logged 12 KTX2 resource errors, subsequently fixed by `c5ef7b1c1`; page-error counts do not include those console reports. Desktop Template return also peaked at 116.7 ms. The initial Sky 150 ms spike did not repeat (66.7 ms on the repaired pin).

Pine's **983.3 ms desktop / 852 ms Safari drive stalls** were intermittent first-pass stalls. Neither reproduced in four instrumented diagnostics (three CPU profiles, one GL-only). Pine drive maxima were 100, 83.3, 83.3 and 99.9 ms. Plain pregraph controls still peaked at 283.3 ms (cell) and 116.7 ms (matched journey). No defensible first-bad FPS SHA was established. The final midpoint was historical `6ad070ff2`, qualified only with the landed water-admission repair; its complete whole-case profile recorded 11 long tasks, 833 ms total, largest 116 ms. Short plugin/install and schema samples appeared, but no matching one-second validation task.

The **likely mechanism** is synchronous Pine plugin import: `runtime/index.ts` imports `shard.config.ts`, whose top-level `parseShardfile` validates every graph table. Independently, x4 captured 99.6 ms module evaluation on `c5ef7b1c1` (~65% graph-walker samples, ~11% GC). This corroborates a real hotspot; it does **not** directly attribute the uncaptured one-second frames. The parse mechanism dates to `2cdce8175`, graph tables to `be59299ff`. x4's interim prewarm is in flight; these results precede it.

The separate broken-entry regression is attributed: `b2c56345a` passed, `de1b7286f` refused, and [`f542a4cfb`](../pine-grid-water-2026-10-16/README.md) restored entry. Grid Pine was unreachable between that regression and the repair, so intervening milestones could not observe its drive.

Safari Driftwood beach p95 36 ms and Signal travel p95 38 ms are new single-run misses against the recorded comparison, not proven unchanged. Sky/Pine/Driftwood travel misses already existed, with differing magnitudes. Historical runs lacked quiet windows. Follow up the intermittent stall and these misses at the next milestone; no further attribution claimed here.

Timing loads, all per-pose results, seven controls and qualification are in the receipt. Overlapping setup was discarded. Quiet leases auto-cleaned; all owned browsers, Simulator and previews are closed after measurement.
