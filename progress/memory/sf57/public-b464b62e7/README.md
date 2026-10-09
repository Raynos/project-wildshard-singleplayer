# Public SF57 soak: b464b62e7 (qualifying, shipped layout, cells + road in one invocation)

App pin `b464b62e70a21a502b6fc82f76ab212f80a34d21`: origin/main at launch (the receipt commit for 74032f176's soak; the
app is 116f25a06's). The build was served on :4405, with one Simulator through `scripts/sim-lane.sh`. Harness = local
`17c018c62` (the sampler fix below, on top of the pin; no other WIP in the soak scripts). The command was
`node scripts/soak/soak.mjs --prepare --rev=b464b62e7… --layouts=shipped --legs=cells,road --route-scope=catalogue
--qualifying`. That means `rehearsal: false`, the public catalogue (borrowed Driftwood home + template-1 to template-5),
Developer OFF, render scale 2× and texture mode `img`. Lane sf57-relaunch, 2026-10-09 06:43–07:47.

## The sampler gap, and its fix (17c018c62)

74032f176's 9.0 s gap was one loop iteration of `scripts/sim-mem-phases.py`: the sample tagged elapsed 8.06 was
emitted 7.98 s after its tick (every other one of its 1875 samples within 0.25 s), between the phase read and the emit,
where the sampler forked `ps -axo pid=,ppid=,comm=` twice. `ps` reads each process's arguments out of its memory, so one
busy or swapping process can hold it. The sampler now lists processes through libproc in-process (same selection as
`ps` on a live Simulator, 2 ms a call against 61 ms), runs its thread at the user-interactive QoS class (`nice -n -5`
needs root), and records the 1-minute load average and its read time on every sample. The completeness rule (every gap
≤ 2.5 s) is unchanged.

| sampler | cells | road |
|---|---|---|
| samples / largest gap | 1871 / **1.02 s** | 1866 / **1.02 s** |
| slowest read | 16.3 ms | 16.0 ms |
| load average (1 min) min / mean / max | 5.1 / 28.2 / 84.9 | 8.8 / 32.7 / 136.3 |
| QoS | user-interactive | user-interactive |

The Mac is 18 cores; the load peaked at 136 during the road leg and sampling held.

## Recorded verdict: road PASSES; cells FAILS rule (b) only

| | cells | road |
|---|---|---|
| functional | **PASS**: 1811.9 s, 4 circuits + partial, 46 routes, 0 failures, 0 errors | **PASS**: 1814.4 s, 3 circuits + partial, 71 routes, 0 failures, 0 errors |
| memory / gate | **FAIL** (`recovery`, rule (b)) | **PASS / PASS** |
| sampling | PASS | PASS |
| playing peak (WC interval-high + GL) | 839.3 MB (592.4 + 246.9; loop 3, t = 1270.2 s) | 825.6 MB (582.6 + 243.0; baseline-0, t = 21.1 s) |
| loading peak | 932.9 MB (689.1 + 243.7) | 890.6 MB (741.4 + 149.2) |
| calibration (M − E) / A | 1.052 / 1.066 / 1.075 / 1.078, PASS | 1.120 / 1.121 / 1.121, PASS |
| baselines | −11.8 / −6.1 / 0 / +3.9 / +5.3 MB | +5.0 / −0.2 / 0 / 0 MB |
| leaks / cells | zero (disposal errors 0) / 6/6 admitted, 0 refused, 61 evictions, 16/16 crossroads | zero / 0 entries, 16/16 crossroads |

**Rule (b), cells: FAIL.** Loops (peak / trough, MB): 795.9 / 745.8 (warm-up), **813.4 / 755.7**, 839.3 / 762.0,
**779.1** / 764.8, partial 770.4 / 767.1. Loop 3 is within 30 MB of loop 2 (+25.9); loop 4's peak is **34.3 MB below**
loop 2's, outside the ± 30 MB band. Troughs and baselines all pass. Loop 2's peak is not a sub-second transient: it sits
at `template-2-to-template-3` +31 s, where the sampled footprint was 806.2 (loop 2), 814.3 (loop 3) and 775.8 MB
(loop 4), each that loop's highest sampled point; GL stays 245–249 MB across them, so the difference is WebContent
(loop 2's interval high 564.8 MB against loop 4's 530.0). Nothing here is
regraded. **Rule (b), road: PASS**: 825.6 / 766.9 (warm-up), 781.7 / 767.0, 781.9 / 767.5, partial 779.4 / 767.7.

Transients (`transients.mjs`): cells largest **32.5 MB** (`c2 template-2-to-template-3 +8.4 s`, the crossing commit, as in
74032f176's 35.5 MB), 6 of 20 MB or more, 0 of 40 MB or more; road largest 12.3 MB, none of 20 MB or more.

## Settled WebContent per circuit (WC / GL / A, MB)

- **cells**: c0 507.6 / 243.0 / 433.3, c1 510.9 / 245.3 / 433.8, c2 517.0, c3 520.8, c4 522.3 (GL and A flat from c1).
  Growth **+3.3, +6.1, +3.8, +1.5 MB per circuit**: smaller than 74032f176's +10.6 / +6.9 / +3.0 / +2.3, still **no
  plateau** within four circuits (+14.7 MB over them).
- **road**: c0 530.9 / 243.0 / 433.3, c1 525.9 / 242.7 / 418.3, c2 526.2, c3 526.2. **Plateaus**: −5.0, +0.3, 0.0.

## Against SF57's done-when (shipped layout)

- **Road leg: met on its own recorded verdict** (gate PASS: (a), (b), (c), sampling, leaks 0, qualifying).
- **Cells leg: (a) playing ≤ 1.0 GB and loading ≤ 1.8 GB, (c) calibration, sampling, leaks 0, refusals 0 and routes
  complete are met; (b) is not**, on loop 4 settling 34 MB lower than loop 2's peak at one pose.

So the shipped-layout gate does **not** pass as recorded: the sampling defect is gone, and the open item is the cells
leg's loop-to-loop WebContent variance at `template-2-to-template-3` (+ the slow, shrinking WC drift).

Files: `run.log`, `manifest.json`, `archive.json` (sha256 + byte count of every raw file; each `.br` decompresses to it,
checked), `summarize.mjs` → `summary-{cells,road}.json` (now with a `sampler` block), `transients.mjs` →
`transients-{cells,road}.json`. Cleanup: the parent's finally stopped the preview; the lane's Simulator shut down.

Plan-State: unchanged
