# Travel frame cadence (E435)

**RED: desktop target rows pass; Simulator travel remains open.** Baseline `1046bba3d`; desktop after `0c9619149`, Simulator after `dbb89458d`. Scalar validity/CPU/median/count details: [summary.json](summary.json). No full-grid milestone pass is claimed.

| Surface / route | Travel p95 before → after (ms) | After drive p95 / max (ms) | After interior p95 (ms) | Drive >50 / >100 ms | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop Nine | 33.4 → 16.8 | 16.8 / 66.7 | 16.7 | 3 / 0 | PASS |
| Desktop Nalati | 33.4 → 16.8 | 16.8 / 83.3 | 16.7 | 4 / 0 | PASS |
| Simulator template outbound | 58 → 40 | 34 / 160 | 34 | 13 / 2 | FAIL (travel) |
| Simulator template return | 55 → 42 | 34 / 151 | 34 | 13 / 2 | FAIL (travel) |
| Simulator Nalati | 66 → 44 | 39 / 91 | 34 | 12 / 0 | FAIL (travel + drive p95) |

Gate: desktop p95 ≤17.5 ms / drive max ≤100 ms; Simulator p95 ≤35 ms / drive max ≤200 ms, rounded medians ≥60/30 fps, valid drawn frames, owner CPU pass and no errors. The Simulator caps at 30 fps (33.3 ms): 34–35 ms is cap plus vsync jitter. The old milestone README's 33 ms wording is corrected; its raw harness already accepted 35 ms.

## Cause and scheduling fix

Travel samples the first 120 drawn frames one second into a real drive. The whole-drive p95 can dilute this early slowdown; there is no separate fast-travel camera. Nalati desktop CPU/GL diagnostic `f15595c2c` found overlapping construction: painting 199.3 ms inclusive, vertex shading 161.9 ms inclusive, terrain-field sampling 103.3 ms self within the 2383.2 ms travel window (overlapping figures, not additive). Early bins contain outcrops, world assembly and dungeon construction. Shader upload/link work is separate, owned by sp-x2.

`2cd537f76` anchors deadlines to actual rAF/cap; `f57553bec` infers uncapped cadence only from two real rAFs. `0c9619149` gives piece macrotasks the same shared quarter-frame budget and resumes after paint through scoped MessageChannel tasks instead of nested 4 ms timers. `dbb89458d` bounds that budget to 4.17 ms at 60 Hz, even under a 30 fps game cap. Uncapped desktop arithmetic is unchanged by this last correction. Pacing OFF retains its ordinary hops; quality, content, render scale and fps caps are unchanged. 31 focused pacing/work-slice/boot tests, scoped strict and touched lint pass.

The intermediate false-cadence pass starved Nine construction (61 s); that was fixed before the credited results. Desktop Nine world/drive time is now 5.07/7.25 s versus 2.45/4.58 s before; Nalati 1.63/6.02 s versus 1.25/5.03 s. Cooperative scheduling trades admission latency for smooth frames.

## Proof scope

Auto fps, pacing ON, Developer ON/DEVSERVER catalogue, live clocks, 2× scale; plain credited runs without CPU profiler or GL observer. Each route retains real source preparation/input/residency witnesses. Desktop completed in 109.9 s; Simulator in 290.2 s; all samples valid, owner CPU passes, zero errors/context losses. Quiet windows wait for the pusher and leave a two-minute gap; all owned resources closed before release. Other lanes landed between pins: this is a targeted regression comparison, not isolated native A/B. Simulator is Mac-backed Safari, not a physical phone.

Remaining: early Simulator construction still misses cadence, although every measured drive maximum now fits 200 ms. Attribute the remaining world/kit/play stretches before another scheduling change. Raw samples/profiles stay in scratch.
