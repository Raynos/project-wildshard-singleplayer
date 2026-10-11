# Desktop return checkpoint (E435)

**Desktop return PASS with margin: 50 ms max / 16.7 ms p95 on `0e4a46b2e`.** The previous plain return was exactly 100 ms ([prior receipt](../spawn-return/README.md)). [summary.json](summary.json) preserves every row and both endpoint fences for two diagnostics and the new plain run.

| Plain row | p95 ms | Max ms | Frames >50 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| Boot spawn | 16.8 | 16.8 | 0 | PASS |
| Template outbound drive, including builds | 16.7 | 49.9 | 0 | PASS |
| Driftwood return drive, including builds | 16.7 | 50.0 | 0 | PASS |

The complete 199.6 s run has zero skipped frames, errors or context loss; every owner CPU check passes. Both ends have matching current/inside/frame owner, gameplayReady, no pending/refusal, settled crossing, and required residency. Standing and interiors pass. Gate: desktop p95 <=17.5 ms, drive max <=100 ms; Simulator p95 <=35 ms, drive max <=200 ms.

## Cause and byte-preserving fix

On `d4d6acc08`, diagnostics find return maxima 116.6 and 100 ms. The trace's 100 ms frame contains a 111.385 ms main task (111.020 ms thread CPU), about 97.5 ms sampled under `GridCrossing.step -> LiveGridHost.checkpoint -> serializeSnapshotDataSteps`: 36.2 ms DEFLATE, 22.2 ms byte matching, 13.9 ms hashing and 13.1 ms reference encoding. GL API time is approximately 0.1 ms. The separately collected CPU profile has a misaligned window and is not used for this attribution.

`350d6cc47` times synchronous GPU queries/readbacks without issuing extra calls; repeated installation preserves its accumulator. `0e4a46b2e` reads the same little-endian hash words directly and compares sixteen-byte match blocks before exact word/byte tails. Dictionaries, match selection, references, native bytes, bounds and snapshot wire remain unchanged. Golden packets cover differing bytes, overlapping copies and offset views; the real production native basis restores an exact suffix. Seven codec/native tests and thirteen timing/profiling tests, scoped strict and touched lint pass. No new imports, memory discount, quality or render-scale change.

The final timing is a combined current-pin result, not an isolated A/B estimate: bounded preparation changes also landed between pins. Diagnostics receive no timing credit. The final plain run uses no CPU profiler, GPU trace or GL timing; Developer ON / DEVSERVER catalogue, pacing ON, Auto fps, unchanged 2x scale. It completes the same template-2 round trip. Quiet windows respect push priority and 120 s gaps; every owned preview/browser is closed. Raw arrays/traces remain in scratch, not git.

**Simulator outbound 277 ms remains open:** its peak followed Nalati preparation afterPlay by 111 ms while still on the road. That phase correlation does not prove a CPU cause. sp-x2 owns the preparation path; this slice leaves it untouched and does not claim the Simulator row passed. Direct Herdr relay was unavailable in this shell (`HERDR_ENV` unset); ownership confirmation is pending through the coordinator.
