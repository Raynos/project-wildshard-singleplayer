# Public SF57 soak: a098b4964 (qualifying, shipped layout, cells + road legs)

App pin `a098b496435e4562e1be13cc6ccb4c903daade78` (origin/main at launch; carries `20225cf9a`'s calibration and road plan),
builds `a098b49-mv0kzmjm` (cells, :4404) and the same pin rebuilt for the road leg (:4403), one Simulator through
`scripts/sim-lane.sh` (portrait iPhone Simulator Safari). `node scripts/soak/soak.mjs --prepare --rev=a098b4964…
--layouts=shipped --legs=cells,road --route-scope=catalogue --qualifying`: `rehearsal: false`, public catalogue (borrowed
Driftwood home + template-1 to template-5), Developer OFF, render scale 2×, kernel footprint + light GL observer, no VM-map
or heap probes. Texture mode `img` ("auto: driftwood-isle's KTX2 set is not cached (yet)"). Lane sf57-qualify4, 2026-10-09.

The cells worker exited 1 (see "Two verdicts"), so the parent stopped before the road leg; the road leg was then run by
itself on the same pin (`--legs=road`, `run-road.log`). Same pin, same harness, one leg each.

## Two verdicts, both from the same raw samples

The worker's recorded verdict is kept in each `shipped-<leg>.json` (`.br`). `regrade.mjs` re-runs the worker's own join and
`gradeSoak` call on the archived raw samples with the grader as of `2245b3c89` (the coordinator's pick: the sampling gate
counts unlabelled GL **bytes**, not handles). The regrade is legitimate because the evidence is the raw samples, not the old
verdict; nothing in the samples was edited. Outputs: `regrade-cells.json`, `regrade-road.json`.

| Leg | Recorded (grader at a098b4964) | Regraded (grader 2245b3c89) |
|---|---|---|
| cells | functional FAIL, gate FAIL: one journal-reconstructed loading sample fell in the 90 ms between a zero-byte `createBuffer` and its label (`ground-cover-hibiscus/aNrm`), so `unlabelled = 1` failed sampling | **functional PASS, memory PASS, gate PASS** |
| road | functional PASS, gate FAIL: rule (b) | functional PASS, gate FAIL: rule (b), same cause (below) |

## Cells leg: green on the regrade

- **Functional:** 1827.4 s, 4 complete circuits plus a partial fifth, 46 route witnesses, 0 failures; all 6 cells admitted,
  none refused; 16/16 crossroads; 60 evictions. App errors 0, GPU / context losses 0, leak census zero, 0 missing GL.
- **Peaks:** playing **852.7 MB** (loop 1, the warm-up with the road tour; WC interval-high 609.2 + GL) = 147 MB under the
  cap; loading 842.8 MB (< 1.8 GB). Per-lap peaks 852.7 / **788.7** / 763.6 / 767.5 / (partial) 758.8.
- **Rule (b): PASS.** Loop 2's peak 788.7 and trough 744.6; loops 3 and 4 peak 25.1 and 21.2 MB lower, troughs +4.6 and
  +8.1; baselines within ± 30 of loop 2's.
- **Calibration (c): PASS.** (M − E) / A = **1.027 / 1.036 / 1.044 / 1.050** (was 0.975–0.999 on 236c1225d); A = 433.8 MB
  (was 454.1), as `calibration-243da2c5e` predicted (≈ 433.8).
- **Settled stops** (WebContent / GL / A, MB): c0 490.1 / 243.0 / 433.3, c1 500.2 / 245.3 / 433.8, c2 504.0, c3 507.3,
  c4 510.1 (GL 245.3 and A 433.8 flat from c1). **Growth +3.8, +3.3, +2.8 MB per circuit, WebContent only**, shrinking each
  circuit but not yet a plateau.
- **The 236c1225d circuit-1 spike did not recur at that size:** the largest drive interval-highs after loop 1 are +60.3 MB
  (t = 663–700 s, the end of loop 1's road tour) and ≤ 22 MB in loops 2–4.

## Road leg: functional PASS, gate red on one post-teardown sample

- The new borrowed-home plan works: `home-to-road` leaves Driftwood once, then 3 full boulevard circuits plus a partial
  fourth, 70 route witnesses, 0 failures, 63 crossroads passes (16/16 distinct), no shard entered; leaks zero.
- Peaks: playing 805.4 MB (loop 1), loading 905.2 MB; calibration **1.020 / 1.018 / 1.019**; settled baselines within
  +0.8 MB of each other: **no growth on the road**, so the cells leg's WebContent growth comes from the cells.
- **Rule (b) fails on one sample**: the partial last lap's trough reads 527.1 MB because the sampler tagged the first sample
  after the drive ended (t = 1811.9 s vs the drive's 1811.755 s) as `drive`, after the teardown had already dropped GL to
  42.9 MB. Loops 2–3 otherwise repeat loop 2 within 12 MB. `road-whatif.mjs` (a what-if, not a verdict) moves that one
  sample to `unloaded`: rule (b) and the gate then pass. A grader / worker fix for this phase race (the worker waits a
  sampler interval after `phase('unloaded')` before the leak census, or the grader drops samples after `seconds`) needs
  the coordinator's pick; this receipt does not regrade it.

## Verdict

Cells: qualifying PASS on the regrade. Road: functional and calibration PASS, gate red on a harness phase race that the
evidence attributes to the teardown, not to memory. SF57's shipped leg is green when that race is fixed by a picked rule
and the road leg regrades (or reruns) green.

Files: `regrade.mjs`, `regrade-*.json`, `road-whatif.mjs`, `archive.json` (sha256 of every raw file, archived losslessly
as `.br`), `manifest-*.json`, `run-*.log`. Cleanup: both previews stopped in the parents' finally, the sim lane is at 0/1.

Plan-State: unchanged
