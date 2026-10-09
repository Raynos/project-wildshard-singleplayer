# Public SF57 soak: 83c719436 (qualifying, shipped layout, cells + road in one invocation)

App pin `83c71943631e102d83e33e6dfc5916df5a3c5a57` (origin/main at launch; carries `2245b3c89`'s byte-counted sampling gate
and `6ef20a1ba`'s phase-by-time grader), build served on :4402, one Simulator through `scripts/sim-lane.sh` (portrait
iPhone Simulator Safari, device `sf57-sp-x3-shipped-82065`). Harness = the same pin (the soak scripts were unchanged
between the pin and the run, sha256-checked before and after). `node scripts/soak/soak.mjs --prepare --rev=83c719436…
--layouts=shipped --legs=cells,road --route-scope=catalogue --qualifying`: `rehearsal: false`, public catalogue (borrowed
Driftwood home + template-1 to template-5), Developer OFF, render scale 2×. **Texture mode `img`** on both legs ("auto:
driftwood-isle's KTX2 set is not cached (yet)", no probe). Lane sf57-fresh, 2026-10-09 03:19–04:23.

**Both legs ran in the one invocation** (`run.log`): the cells worker exited 0 (functional pass), so the parent went on to
the road leg. These are the worker's **recorded** verdicts; nothing here is regraded.

`attempt-1/`: the first launch (03:08) failed before any measurement: the very first Inspector call on `version.json`
got `'Runtime' domain was not found` (the WebKit target-attach race seen before in `boot-protocol-0e6d69988`), 0 samples.
Relaunched unchanged into a fresh directory; that second run is this receipt.

## Recorded verdict: both legs functional PASS, memory / gate FAIL on rule (b) only

| | cells | road |
|---|---|---|
| functional | PASS (1831.2 s, 4 circuits + partial, 46 routes, 0 failures, 0 errors) | PASS (1812.7 s, 3 circuits + partial, 71 routes, 0 failures, no shard entered) |
| playing peak (WC interval-high + GL) | **857.3 MB** (612.1 + 245.2; loop 2, t = 1052 s) | **838.0 MB** (596.5 + 241.4; loop 1, t = 119 s) |
| loading peak | 906.0 MB (662.3 + 243.8) | 994.7 MB (775.5 + 219.2) |
| calibration (M − E) / A | **1.018 / 1.033 / 1.040 / 1.044** PASS | **1.125 / 1.125 / 1.121** PASS |
| rule (b) | **FAIL** | **FAIL** |
| sampling / missing GL | PASS / 0 | PASS / 0 |
| leaks | zero (disposal errors 0) | zero (disposal errors 0) |
| cells / crossroads | 6/6 admitted, 0 refused, 59 evictions / 16/16 | 0 entries / 16/16 |

### Cells rule (b): a real WebContent transient in loop 2

Loops (peak / trough, MB): 817.3 / 727.9 (warm-up), **857.3 / 740.7** (loop 2), **774.3** / 747.5, 830.0 / 751.0, partial
757.1 / 752.3. Loop 3's peak is 83 MB under loop 2's, so (b) fails; troughs and baselines (−6.7 / 0 / +3.0 / +4.7 MB) are
all within ± 30. Loop 2's peak is a **WebContent-only transient of +113 MB lasting about 2 s** (footprint 498.7 → 611.3 →
513.5 → 508.4 MB; GL flat at 245.2 MB, residents unchanged), about 5 s after the `template-3-to-template-4` route line
(drive + 994 s). Smaller ones of the same shape: +43.7 MB (drive + 35 s, after `template-1-to-template-2`), +42.6 MB
(+137 s, after `template-3-to-template-4`), +56.7 MB (+1539 s, loop 4's 830.0 peak, after `template-2-to-template-3`).
This is the measured footprint, not a grader artefact; it is the same unnamed transient as `236c1225d`'s template exit
(a098b4964's run had its biggest, +60 MB, in loop 1 instead, so (b) passed there by placement).

### Road rule (b): the phase race again, on the GL half of one sample

Loops: 838.0 / 768.6, **783.9 / 768.3**, 782.3 / 768.0, partial 782.3 / **569.2**. The partial lap's trough is one sample
whose **native** timestamp is 0.101 s before the recorded drive end (so the phase-by-time rule keeps it `drive`) but whose
**joined GL reading** was taken 0.067 s after it (`gl.at`), when the teardown had already dropped GL to 42.9 MB with 0
residents. `road-whatif.mjs` (a what-if, not a verdict) phases each sample by the later of its two timestamps: exactly that
one sample moves, and the road leg passes (b), memory and gate (`road-whatif.json`). Every other road number is green.

## Settled stops (WebContent / GL / A, MB)

- **Cells:** c0 489.6 / 243.0 / 433.3, c1 496.0 / 245.3 / 433.8, c2 502.8, c3 505.8, c4 507.4 (GL 245.3, A 433.8 flat from
  c1). WebContent growth **+6.4, +6.8, +3.0, +1.6 MB per circuit**: shrinking from circuit 3, but **no plateau** yet
  (a098b4964: +10.1, +3.8, +3.3, +2.8).
- **Road:** c0 531.5 / 243.0 / 433.3, c1 527.9 / 242.7 / 418.3, c2 527.7, c3 526.4: **no growth** (−3.6, −0.2, −1.3).
  A settles 15 MB lower on the road than at c0, hence its higher calibration (1.12 vs 1.02 on a098b4964).

## Against SF57's done-when (shipped layout)

Met: (a) playing ≤ 1.0 GB and loading ≤ 1.8 GB on both legs; (c) calibration in [1.01, 1.21] at every settled stop on both
legs; leaks 0; sampling complete; routes complete; zero refusals; qualifying mode; both legs in one invocation. **Not met
as recorded: (b) on both legs** — cells by a genuine 113 MB WebContent transient landing in loop 2 (the reference lap),
road by a teardown GL reading joined to a pre-end native sample (a harness / grader race: the phase rule reads only the
native timestamp). Not fixed or regraded in this lane.

Files: `run.log`, `manifest.json`, `archive.json` (sha256 + byte count of every raw file; each `.br` decompresses to it,
checked), `summarize.mjs` → `summary-*.json` (recorded verdicts and the numbers above, read from the archives),
`road-whatif.mjs` → `road-whatif.json`, `attempt-1/`. Cleanup: the parent's finally stopped the preview; sim lane 0/1.

Plan-State: unchanged
