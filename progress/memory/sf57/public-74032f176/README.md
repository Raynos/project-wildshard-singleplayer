# Public SF57 soak: 74032f176 (qualifying, shipped layout, cells + road in one invocation)

App pin `74032f17647090ee864b98edaf33aa0ddde76741`: origin/main at launch, carrying `dcff4e586` (the gl.at grader)
and `8c4271064` (the allocation-free GL census walk). The build was served on :4401, with one Simulator through
`scripts/sim-lane.sh`. Harness = the same pin (no WIP in the soak scripts). The command was
`node scripts/soak/soak.mjs --prepare --rev=74032f176… --layouts=shipped --legs=cells,road --route-scope=catalogue
--qualifying`. That means `rehearsal: false`, the public catalogue (borrowed Driftwood home + template-1 to template-5),
Developer OFF, render scale 2× and texture mode `img` (KTX2 set not cached). Lane sf57-spike, 2026-10-09 05:57–06:31.

## Recorded verdict: cells functional FAIL on `sampling` only; road not run

The cells worker exited 1 because its recorded `sampling` was false, so the parent stopped before the road leg. The
only sampling defect is **one 9.0 s gap in the native sampler during boot loading** (t = −48.9 s before the drive; every
other gap ≤ 2.5 s). The interval-high counter still covered that gap: the next sample's high was 575.9 MB, which is in
the loading peak. Drive samples 1803 / 1814.8 s, 0 missing GL, 0 unlabelled bytes, every reading reconciled. Nothing
here is regraded.

| cells | recorded |
|---|---|
| functional | **FAIL** (sampling); 1814.8 s, 4 circuits + partial, 46 routes, 0 route failures, 0 errors |
| playing peak (WC interval-high + GL) | **840.9 MB** (596.7 + 244.3; loop 1, the warm-up, t = 89.7 s) |
| loading peak | 887.0 MB (643.2 + 243.7) |
| calibration (M − E) / A | 1.046 / 1.062 / 1.069 / 1.074, PASS |
| **rule (b)** | **PASS**: loops 840.9 / 740.5 (warm-up), **793.5 / 753.2**, 773.7 / 760.1, 777.1 / 763.4, partial 778.2 / 765.6 |
| baselines | −19.8 / −6.9 / 0 / +3.0 / +5.3 MB, within ± 30 |
| leaks / cells | zero (disposal errors 0) / 6/6 admitted, 0 refused, 60 evictions, 16/16 crossroads |

## The template-exit transient is gone

Measured with `transients.mjs`: a sample's interval high above the median footprint of the ±3 samples, placed on the
running route.

- **83c719436**: largest 103.7 MB (`c1 template-3-to-template-4`); 11 transients of 20 MB or more, 2 of 40 MB or more.
- **This run**: largest **35.5 MB** (`c0 template-1-to-template-2 +9.7 s`, `c1 template-2-to-template-3 +7.6 s`, both at
  the crossing commit, where the regional checkpoint serializes); **2** of 20 MB or more, **0** of 40 MB or more.

Loop 2's peak is now 793.5 MB, against 857.3 MB in 83c719436, and loops 2–4 lie within 20 MB of each other.

## Settled WebContent per circuit (WC / GL / A, MB)

c0 497.7 / 243.0 / 433.3, c1 508.3 / 245.3 / 433.8, c2 515.2, c3 518.2, c4 520.5 (GL and A flat from c1). WebContent
growth is **+10.6, +6.9, +3.0, +2.3 MB per circuit**. It shrinks each circuit, but there is **no plateau** within four
circuits (83c719436: +6.4, +6.8, +3.0, +1.6).

## Against SF57's done-when (shipped layout)

**Met by the cells leg:**
- (a) playing ≤ 1.0 GB and loading ≤ 1.8 GB;
- **(b)**;
- (c) calibration in [1.01, 1.21];
- leaks 0, refusals 0, routes complete, qualifying mode.

**Not met as recorded:**
- the cells leg's `sampling`, because of one 9 s native-sampler stall during boot;
- the road leg, which never ran.

A relaunch of the same invocation is the next step.

Files: `run.log`, `manifest.json`, `archive.json` (sha256 + byte count of every raw file; each `.br` decompresses to it,
checked), `summarize.mjs` → `summary-cells.json`, `transients.mjs` → `transients-cells.json` (run against
`../public-83c719436/` for the comparison above). Cleanup: the parent's finally stopped the preview; sim lane 0/1.

Plan-State: unchanged
