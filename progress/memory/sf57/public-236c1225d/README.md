# Public SF57 soak: 236c1225d (qualifying, shipped layout, cells + road legs)

App pin `236c1225d8c0e23d72ea7f2037307e93270d8a9f` (origin/main at launch; the coordinator's later push `5e26ddd38` adds
only headless / regen commits), build `236c122-mv0i9ovc`, one preview (:4402), one Simulator through `scripts/sim-lane.sh`
(portrait iPhone Simulator Safari). `node scripts/soak/soak.mjs --prepare --rev=236c1225d… --layouts=shipped
--legs=cells,road --route-scope=catalogue --qualifying`: `rehearsal: false`, public catalogue (borrowed Driftwood home +
template-1 to template-5), Developer OFF, render scale 2×, kernel footprint + light/coalesced GL observer, raw upload
trace off, no VM-map or heap probes. Preview HTTP == disk == manifest pin checked before GO; the build carries the
`regionalSimCost` charge. Lane sf57-qualify3, 2026-10-09.

**What changed since `public-c47de2d8c`:** the re-entry fixes (`933205df4`, `f05a45712`, `1e428e7d7`) and the model fix
`236c1225d` (template sims charged their measured 3.21 MB, `progress/memory/sf57/regional-sim-cost/`; the page
composer covered by the measured Driftwood home).

## Cells leg: functional PASS, under the cap, grader RED (calibration and the loop-peak rule)

- **Functional:** 1827.2 s, 4 complete circuits plus a partial fifth, 46 route witnesses, 0 failures; all 6 cells admitted,
  none refused; 16/16 crossroads. App errors 0, GPU / context losses 0, leak census zero, sampling complete (0 missing GL).
- **Peaks (playing):** combined **835.7 MB** (WC interval-high 589.6 + GL 246.1, circuit 1, on the road with template-1/2/4
  resident) = **164.3 MB under the 1.0 GB cap**. Labelled GL max 249.2; GPU process 198.6 (reported, never added). Loading
  912.8 MB (< 1.8 GB). Per-lap peaks 778.1 / **835.7** / 766.8 / 788.8 / (partial) 757.7.
- **Settled stops** (WC + GL, MB): c0 731.8, c1 742.7, c2 746.7, c3 750.3, c4 753.5. GL flat at 245.3 and the allocator
  flat at 454.1 from c1 on. **Growth +3.42 MB per circuit, WebContent only** (R² 0.999; was +4.30 with GL +0.61 before the
  re-entry fixes). Baseline drift c2 → c4 is +6.8 MB, inside ± 30, but there is still no plateau on the Simulator.
- **Calibration:** A = 454.1 MB (was 536.2), **(M − E) / A = 0.975 / 0.984 / 0.992 / 0.999** (was 0.867–0.893), raw
  1.64–1.66. Still under the 1.01 floor: the model over-states by ≈ 16 MB at this stop (A ≤ 438.3 would pass at c1). A
  matched A (453.6 predicted, 454.1 read), but the ≈ 1.03 prediction used the leaky run's settled M (764.7); after the
  re-entry fixes the same stop settles at 742.7. (An early unsettled c0 sample read 1.034; the settled median does not.)
- **Rule (b):** `recovery` false because loop 2's peak (835.7) is a one-off WC interval-high spike during a road
  admission; loops 3 and 4 peak 69 MB and 47 MB lower. Troughs are within ± 30 MB.
- **Texture mode:** `img` ("auto: driftwood-isle's KTX2 set is not cached (yet)", probe null). On the Simulator the KTX2
  probe would veto anyway (zeroed compressed mips), so this is an `img` soak; a KTX2 reading needs the phone.

## Road leg: harness failure, not run

The road-only worker failed at boot, before any drive: `Grid floor starts in driftwood-isle, expected null`
(`scripts/soak/owned.mjs:254`). The road plan expects a page that starts on the road; the public page starts in its
borrowed home. `ownedSoakPlans` needs a borrowed-home road plan (leave home first, then lap) before a public road leg
can run. Raw evidence kept (`shipped-road*.br`), loading peak 841.9 MB.

## Verdict and what blocks green

Not green, so not qualifying evidence for M2. Left, in order of size:
1. **Calibration (≈ 16 MB):** the l0 products (71 MB accounted vs 45 MB of GL the grid adds,
   `progress/memory/sf57/calibration-1e428e7d7/`) and Driftwood's home GL in `img` (204.5 claimed vs 196.3 measured, ≈ 7
   MB accounted). The window and the cap stay unchanged.
2. **Loop-peak rule:** attribute the circuit-1 WC spike (589.6 MB interval-high on the road during an admission).
3. **Growth:** +3.42 MB per circuit of WebContent with GL and the allocator flat. Chromium's JS heap plateaued after
   `1e428e7d7`, so the remainder is either JS on another route section or WebKit retention; a qualifying run takes no heap
   probes, so a diagnostic run must split it.
4. **Road leg:** the borrowed-home road plan in the harness.

Files: `analyse.mjs` (the c47de2d8c reader, `node analyse.mjs <dir> cells|road`), `analysis.json` (cells), `archive.json`
(sha256 of every raw file, archived losslessly as `.br`), `manifest.json`, `run.log`. Cleanup: the preview stopped in the
parent's finally, the sim lane is at 0/1, and no inspector proxy remains.

Plan-State: unchanged
