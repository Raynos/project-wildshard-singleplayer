# SF57 plain 30-minute Developer subset — b13614a6e

**Functional PASS / memory RED.** Pin `b13614a6e7bb218f691a5f3b7040510de13cb7e8`, build `b13614a-mv0ahrls` (HTTP = disk). The unchanged owned-shell driver completed **1814.495 seconds**, **7 complete circuits**, **48 passing route witnesses**, all **16 crossroads**, and 30 recorded retirements. No partial final circuit. Browser errors, graphics-context losses, native process losses and disposal errors: **0**. All 15 scope counters returned to zero; before/after retained census matched. Sampling and leakZero passed.

The conservative playing peak was **1229.156 MB**, **229.156 MB over 1.0 GB**: fixed-game-PID WebContent interval high **761.649 MB** + labelled live GL **467.507 MB**, during Pine, zero-based journal cycle 4. The actual WC reading at that row was **631.560 MB** (paired sampled WC+GL **1099.067 MB**). GPU process **260.083 MB** at that row is separate, never added to WC+GL. The interval high belongs to the preceding sampler interval: this conservative ruler does not claim the WC high and GL census occurred at precisely the same instant. Loading peaked at **654.227 MB**, below its separate 1.8 GB limit.

## Settled growth

Original end-of-circuit windows, upper medians of 10–11 actual paired samples per window, decimal MB. Window 0 precedes travel. Each window follows the same returned Driftwood pose. GPU process is independent.

| Circuit completed | WebContent | Labelled GL | WC + GL | Allocator accounted | GPU process |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 397.299 | 177.058 | 574.357 | 493.457 | 155.749 |
| 1 | 473.486 | 184.494 | 657.981 | 492.754 | 201.641 |
| 2 | 487.069 | 186.332 | 673.401 | 492.754 | 337.513 |
| 3 | 464.181 | 186.344 | 650.524 | 492.754 | 334.728 |
| 4 | 471.341 | 186.334 | 657.675 | 492.754 | 336.088 |
| 5 | 480.205 | 186.337 | 666.542 | 492.754 | 338.120 |
| 6 | 489.560 | 186.336 | 675.896 | 492.754 | 338.677 |
| 7 | 499.882 | 186.337 | 686.219 | 492.754 | 338.906 |

Circuit **2 → 7** grows **12.818 MB**: WC **+12.813 MB**, GL **+0.004480 MB**, allocator **0**, independent GPU process **+1.393 MB**. Endpoint growth is **2.564 MB/circuit**. The six-window least-squares WC+GL slope is **4.259 MB/circuit**, R² **0.379**; the early drop makes a single linear rate a weak description. Windows 3 → 7 then rise **35.695 MB**, about **8.924 MB/circuit**. GL/accounting are flat at this pose, but **WebContent has not demonstrated a stable plateau**. Passive samples cannot distinguish JS heap from other native WebContent retention; no heap/VM probes were added.

All settled windows from circuit 2 stay within ±30 MB of that reference. The unchanged recovery grade is still RED because completed-circuit peaks/troughs do not all repeat circuit 2 within ±30 MB. Calibration is also RED; adjusted measured/accounted ratios remain in `analysis.json` (roughly 0.71–0.78). No ruler, calibration, tolerance or baseline changed.

## Complete-circuit peaks

Original WC interval-high + exact labelled GL ruler. Separate component maxima must not be summed. Human circuit numbers below equal zero-based journal cycle + 1.

| Circuit | Peak WC + GL MB | Trough WC + GL MB | Above cap MB |
| --- | ---: | ---: | ---: |
| 1 | 968.939 | 482.778 | 0 |
| 2 | 1113.343 | 572.096 | 113.343 |
| 3 | 1196.027 | 557.865 | 196.027 |
| 4 | 1049.846 | 565.793 | 49.846 |
| 5 | 1229.156 | 572.855 | 229.156 |
| 6 | 1197.765 | 581.802 | 197.765 |
| 7 | 1078.966 | 591.388 | 78.966 |

## Method and limits

One queued clean preview; one fresh owned **iPhone 17 Pro Simulator** (`07BE843A-E4E6-4689-A2EF-1A368C75E562`), Safari, Developer ON, muted, phone tier, live owned shell, 2× render scale. Existing `stageFloorGrid` / `runFloorGridRoute` controls traverse Driftwood → Pine → Nalati → template-2 → Driftwood; the first circuit includes the crossroads tour. One document throughout travel; no navigation, manual GC or manual eviction.

Invocation: `node scripts/soak/soak.mjs --prepare --rev=b13614a6e7bb218f691a5f3b7040510de13cb7e8 --out=<fresh-owned-output> --layouts=dev --legs=cells --route-scope=prepared`, then inspect manifest/preflight and create the output directory's `GO` file.

Light c132 observer + coalesced exact-state journal only. Raw upload trace **0 bytes**; call-site stacks OFF. Kernel footprint sampler at 1-second output with interval-high reset opt-in. **No vmmap, footprint CLI inspection, heap snapshots or SF64 boundary probes**, including at the final pose. GPU-process samples are separate. Settled values use actual censuses within the existing 1.5-second join fence. The completed/reconciled journal supplies exact GL to 60 blocked rows; 1839 rows use actual censuses. No missing GL rows, interpolation or join widening. Allocator is unknown on reconstructed rows. Offline analysis reproduces the exact grader peak and every original settled combined median.

The Simulator now uses images for Pine/Nalati/Sky due to its KTX2 probe; this differs from earlier KTX2-reading cohorts and can increase GL. The e632 baseline's ~51 MB/circuit WC growth is **not an isolated causal comparison**: many lifetime fixes, all six M3 ports, the sampler ruler and this image path changed. No single fix receives memory credit.

This is the approved **Developer D/P/N/template subset**, despite the raw driver's `rehearsal` label. It does **not** close full-catalogue qualifying, road-only or shipped-layout coverage. Sky Reach (`far-reach`) and Signal Dunes (`sunscar-dunes`) are unvisited. Simulator numbers are not physical-iPhone cap clearance or thermal proof.

Host load was not isolated: passive `uptime` includes 1-minute load spikes to **128.24** near boot and **41.90** during travel. Context is retained; the run was not discarded and no extra run started.

## Evidence and cleanup

Large original JSON/JSONL files are losslessly Brotli-compressed. `archive.json` records original size and SHA-256; round-trip equality was checked. Reproduce offline with `node progress/memory/sf57/b13614a6e-plain30/analyse.mjs`. `analysis.json` preserves the full grade, component splits, fitted/endpoint rates and per-lap data. Raw routes, errors, settings, census, native PID/time fences and journal stay intact.

`cleanup.json`: sim-lane **0/1**, owned device shutdown, preview PID/PGID **33109** gone, port **4404** closed. One unrelated browser lane was active and left untouched. Parent/worker finally closed owned Safari, Inspector, proxy and native sampler. Simulator RELEASE went to the coordinator before this receipt. Coordinator owns push and next measurements.

Plan-State: unchanged.
