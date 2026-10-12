# SF57 — current Developer catalogue, ordinary Auto

**2026-10-12: both recorded verdicts FAIL. SF57 stays open.** This is an ordinary
Simulator image-fallback rehearsal, not a forced-compressed run or phone proof.
Current prepared-layout evidence was not supplied, so `rehearsal: true` remains
visible; no qualifying-mode credit is claimed even independently of the failures.

Pinned source `c5a704e604391cc6bec856e36fe9dd03ee6c9183`; production preview
`c5a704e-mv4hlfkt`, HTTP identical to disk. Developer ON, live clock, render scale
2, portrait Simulator Safari viewport 402×714. One owned preview, two independent
cold Safari legs. The source was on origin before measurement. The final push
completed at **00:17:47Z** (auto-push log), matching the authoritative lock drain;
all five other lanes explicitly confirmed resource closure before the driver ran.
The later 00:19Z exit observation does not imply a measurement overlap.

Quiet was held 00:16:02Z through cleanup at about 01:10:16Z. No GC, manual eviction,
navigation recovery, texture override, subset route or cap adjustment was used.
All Simulator/browser/proxy/sampler/preview processes and quiet were closed and
explicitly released. The watchdog did not terminate either leg.

| Recorded field | Cells | Road |
|---|---:|---:|
| Drive seconds | 1,169.561 | 1,808.347 |
| Complete circuits | 1 | 3 |
| Fixed game WebContent PID | 11761 | 39280 |
| Playing peak, WC interval high + contemporaneous labelled GL | **1,852.482 MB** | **1,417.071 MB** |
| Loading peak, conservative WC overlap + GL | 578.184 MB | 647.224 MB |
| Missing GL joins | 0 | 0 |
| Largest native sample gap | 1.015 s | 1.017 s |
| Positive unlabelled-GL samples | 37 | 8 |
| Largest unlabelled allocation | 2.362 MB | 2.362 MB |
| Recovery / calibration / sampling / leak gates | FAIL / FAIL / FAIL / FAIL | FAIL / FAIL / FAIL / FAIL |
| Runtime outcome | Second Pine approach timed out | Duration completed; runtime error retained |

Decimal MB. Limits stay **1,000 MB playing / 1,800 MB loading**. The cells peak is
1,553.568 MB WC interval high plus **298.914 MB** labelled GL; sampled WC at that
instant was 1,463.112 MB. The road peak is 1,061.212 MB WC interval high plus
**355.858 MB** GL; sampled WC was 983.585 MB. Separate phase maxima and GPU-process
footprints are not substituted for these contemporaneous sums.

## Actual path and coverage

Auto tried compressed because the projected image envelope was 1,206,688,286
bytes, but the probe vetoed all usable UASTC/ETC1S targets. Both recorded `mode`
values are **`img`**. The probe's ASTC and sRGB ETC2 readbacks were zero; RGB ETC2
was `2,2,2,255`. No compressed-arm memory assumption is made.

Lap one entered all nine instances: Pine, Nalati, Template 1 (`template-2`),
Blender Template, Sky Reach, Ink Cel Valley, Pastel Plain, Signal Dunes and
Driftwood. Both legs visited all 16 crossroads. The cells drive then failed on
its second Driftwood → Pine approach, at approximately `(−0.01, 298.35)`, before
its target `(0, 325)`, with the live issue:

```text
pine-hollow: [cabins] not built (useCabins)
```

The road-only leg also recorded that admission error during proximity
preparation, despite never crossing into a shard. The grader's raw `refused: []`
means every expected instance was entered at least once; it **does not** mean
there were zero later admission failures. The error and timeout are retained;
no route success or cap pass is inferred from first-lap coverage.

## Memory and instrumentation limits

Road same-pose WC+GL medians grew **427.265 → 788.499 → 832.114 → 1,116.540 MB**.
The final settled reading is **284.426 MB above loop two**, outside ±30 MB.
Completed road-loop peaks are **1,246.258 / 1,097.463 / 1,417.071 MB**. Thus this
run does not establish a flat plateau. The cells first settled return was
1,570.326 MB versus 534.386 MB initially, but only one complete circuit exists.

Settled calibration `(WC + GL − 300 MB) / accounted` was **2.455** for cells and
**2.225 / 2.424 / 3.720** for road, outside **1.01–1.21**. This does not identify
which residents are unaccounted, or prove application retention rather than
WebKit arenas, driver storage or recorder overhead. No heap ownership experiment
was run and the historical grader's 1.4× phone estimate is not a phone verdict.

Sampling rejected actual positive unlabelled GL bytes; it did not reject missing
joins, reconciliation, zero WC readings or gaps. No missing data was fabricated.
After teardown: **4 textures** each; **2 / 1 programs**; **9 / 11 other listeners**
(cells / road). All scoped counters and disposal errors were zero; native bodies,
colliders, audio, timers and systems were zero. Listener stacks include the SF57
recorder itself, so raw counts do not alone prove a game-listener leak. No
instrumentation exemption or regrade was applied. The full identity evidence
stays in the temporary raw receipts for causal follow-up.

Native sampler load min/mean/max was **3.96 / 9.64 / 66.99** (cells) and
**4.58 / 6.97 / 13.84** (road). No cadence or physical-phone performance credit.

## Reproduction and open work

Use `scripts/soak/soak.mjs` on this pushed source with a production Developer
preview: `--prepared=<manifest> --borrowed-preview`. Each independent manifest
has `sha`, `out`, `bases: [{layout:"dev",base,version}]`, `routeScope:"catalogue"`,
`contentCut:null`, `dryRun:false`, `legs:["cells"]` or `["road"]`, and
`rehearsal:true`; touch the output's `GO` only in the ordered owned quiet window.
Wrap through `scripts/browser-lane.sh`; the parent leases `scripts/sim-lane.sh`.
The outer owner keeps the single preview through both legs and stops it afterward.

Open: Pine fresh re-admission failure; image-residency/accounting mismatch and
road growth; positive unlabelled allocations; precise teardown ownership versus
recorder baselines; current preparation evidence and both accepted duration legs.
No new proof is queued ahead of the coordinator's next capture windows.

[Scalar summary](summary.json) retains exact raw artifact SHA-256s, outcomes and
per-loop numbers. Raw JSONL, receipt archives and images are not committed.
