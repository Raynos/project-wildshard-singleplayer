# Pine script-memory preparation (E435)

**Simulator cadence remains FAIL; no frame-rate win claimed.** Desktop passes. Same parent plus only the script-memory patch, default pacing ON, Auto fps, Developer ON/DEVSERVER catalogue, unchanged 2× scale, muted. Plain measurements: no CPU/GPU profiler or GL observer.

| Surface / phase | Before p95 / max ms | After p95 / max ms | After verdict |
| --- | ---: | ---: | --- |
| Simulator travel | 56 / 133 | 58 / 120 | FAIL |
| Simulator whole drive | 36 / 133 | 37 / 120 | FAIL |
| Simulator interior | 34 / 35 | 34 / 35 | PASS |
| Desktop travel | unmeasured in this pair | 16.8 / 33.4 | PASS |
| Desktop whole drive | unmeasured in this pair | 16.8 / 50.1 | PASS |
| Desktop interior | unmeasured in this pair | 16.8 / 16.8 | PASS |

Source: `559f6a075` + construction-owner correction `43df46799`. Isolated candidate `9c92fa979`, parent `c3ae3493f`; exact tree and patch SHA-256 in [summary.json](summary.json). The engine allocates fresh independent AS memories across drawn-frame yields, preserving ceilings, initialization, quota checks and continuation. Async construction uses its admitted owner; explicit foreign/unowned callbacks cannot consume the pool. Owner retirement rejects pending waits and clears unused references. Standalone/OFF uses the original installer.

83 focused host/Pine checks passed for the consumer; 33 native script checks passed for the construction-owner correction. Scoped strict, touched lint and private hooks passed. All three routes completed with zero errors, valid drawn frames/CPU checks and Pine current/inside/resident and gameplay-ready endpoint. Summary retains every measured phase, counts and validity flags.

Gate: desktop max ≤100 ms and p95 ≤17.5 ms; Simulator max ≤200 ms and p95 ≤35 ms. The phone tier caps at 30 fps; 34–35 ms vsync jitter passes. This proves neither memory savings nor physical-iPhone performance. The earlier queued pair was cancelled before any build or measurement to correct ownership; it receives no timing credit. Raw arrays remain in scratch.

The instrumented follow-up on the same isolated candidate completed without errors (16:30:47–16:33:04 UTC). All six prepared native memories were used: 130 ms cumulative construction, **zero memory constructors in frames over 50 ms**. The remaining early travel sample is still red at 58 ms p95. World preparation includes a 48 ms shader-link query; the other long frames need separate attribution. Safari's 4,455 sampling records have zero timestamps, so their counts do not establish task duration. The GL/constructor capture is diagnostic only and receives no floor credit. The JSON retains the phase counts and raw checksum; raw profiles remain in scratch.

A Timeline follow-up stopped before Pine on a repeated-domain enable error. Its 275 captured roots contained 2,834 start times and 1,981 end times, all exactly zero; native Timeline therefore cannot establish task duration either. The incomplete captures and launcher error receive no gate credit and are retained as scalar failures in the JSON.

The verified page-clock telemetry follow-up completed (17:40:09–17:42:26 UTC, zero errors): each grid state/residency read took **0–1 ms in all 12 long frames**. That excludes the per-frame observer reads as the cause; the lightweight-read prototype was deleted. Travel remains FAIL (54 ms p95), whole drive 35 ms p95 / 116 ms max, interior 34 ms p95. A 51 ms world shader-link call remains in sp-x2’s preparation area. The earlier capture with an incorrectly embedded shim has no telemetry or gate credit; its scalar failure is retained in the summary.

The direct creature-call capture (18:00:36–18:03:02 UTC, same isolated candidate, complete / zero errors) locates one **53 ms play frame containing eight spawns: 20 ms inclusive, of which 19 ms is model construction and 1 ms instantiation**. Those spans overlap and must not be added. The three afterKit long frames contain only 3 ms of spawning/model work; the herd loop is not established as their cause. World long frames contain 47 ms of program-status and 32 ms of program-log queries. Travel remains FAIL (58 ms p95), whole drive FAIL (37 ms), interior PASS (34 ms), max 102 ms. These instrumented numbers diagnose the isolated patch, not the current-HEAD milestone. Any model preparation must retain factory ownership, exact requested variants and original actor/RNG order; no speculative scheduling change landed.
