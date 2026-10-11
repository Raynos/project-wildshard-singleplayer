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

## Remaining Simulator attribution

The same Inspector that drives Safari sampled Nalati's travel window on `dbb89458d` using opt-in harness `919ac7ac6` (declaration lint corrected by `4b92d5d01`). This is diagnostic only: 855 samples all had zero timestamps, so their shares cannot be converted to task durations. Terrain noise accounted for 66 self samples (7.7%), trail distance 47 (5.5%); outcrop construction appeared in 135 inclusive samples (15.8%). Inclusive stacks overlap. Five slow world frames peaked at 129 ms while all recorded GL calls in those frames totalled about 1 ms.

The stacks expose synchronous vertex normal calculation, painting transforms and geometry bounds inside producer steps. Outcrop rejection loops yield only after an accepted rock; vertex shading yields after large vertex batches. The shared pacing layer can yield between steps but cannot preempt these atomic producer operations. Shader-link work remains separate.

`11e943f35` reduces the generic trail-distance scan from one square root per segment to one per query. It minimizes the identical squared values and takes the final root: no caching, rounding or approximation. A 10,000-point shipping-formula oracle plus mutable, degenerate, nearly coincident and non-finite cases gives exact values; a 100-segment query uses 100 → 1 roots. Nine focused terrain checks, strict and touched lint pass.

The subsequent plain Simulator attempt on `88b76f10c` completed three standing samples at p95 34 ms but stopped before travel: Driftwood never became an entered ready source resident. No route completed, no context loss or page error was recorded, and no performance credit is assigned to this attempt or the terrain optimization. This does not establish which intervening change caused the admission failure.

A separate check on the optimization's defining pin `11e943f35`, before that regional-view change, also completed three standing samples at 34 ms. Source admission succeeded, but the outbound template route timed out at world feet `(298.35, 0.45, 554.98)` before completing. The harness reconnected a swapped Inspector target for diagnostics, whose console contained five shader errors: `family:pbr` redeclared the horizon uniforms. This is another incomplete attempt, not timing credit or an isolated attribution of the traversal failure.

`ec6e98463` fixes that independent compile error: a copied family-material patch chain keeps one horizon source injection and binds the current owner's uniforms. The existing source stays identical; two focused horizon tests cover copying, retirement and re-entry, with strict and touched lint passing. This does not establish that the uniform error caused the readiness stop.

The follow-up quiet run on `ec6e98463` corroborates the compile fix (diagnostic console errors 5 → 0). The template route still timed out, with current/inside both null and feet `(298.35, 0.45, 555.09)` short of its `(325, 555)` target. Three standing samples again passed at 34 ms. Traversal remains independently open and prevents crediting new travel timings; the latest completed comparisons in the table are retained. Quiet windows, failures and scalar stop evidence are recorded in the summary. All owned previews, Inspector clients and Simulator helpers were closed.

Early Simulator construction still misses cadence in the latest completed run, although every measured drive maximum fits 200 ms. Raw samples/profiles stay in scratch; all owned helpers and previews close before releasing each quiet window.
