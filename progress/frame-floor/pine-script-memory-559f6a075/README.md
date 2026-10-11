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
