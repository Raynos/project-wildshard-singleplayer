# SF22: prepared first-entry owners

2026-10-10. Runtime pin `a45eb30e15796a6b60213ad6436f1b05c7d27b2b`, including
`9ca641bfe` (exact StaticBake override preparation) and `a45eb30e1` (ranged effects
prepared before entered listeners). This is an owner diagnostic, **not a new cadence
qualification**: draw wrappers and the initial-boot CPU profiler were enabled.
The prior normative desktop PASS remains `63636a567`.

Muted Chromium, phone tier, DPR 2, Developer OFF, Memory saver OFF, Auto textures;
real input through the six G270 routes. Network shaping after initial home boot:
5 Mbit/s plus the same 3 s and 10 s asset stalls. Six routes, twelve crossings,
zero refusals, game errors or network failures. Preview, browser and helper all closed.

| Entry | First-second draw/driver compiles | First-second tasks >50 ms | Activation ms | Route load median (range) |
| --- | ---: | ---: | ---: | --- |
| Pine | 0 | 0 | 2.3 | 30.6 (24.1–39.5), under load |
| Nalati | 0 | 0 | 4.0 | 17.3 (13.8–27.1), under load |
| Template 2 | 0 | 0 | data entry | 12.9 (11.7–13.8) |
| Sky Reach | 0 | 0 | 1.3 | 29.5 (11.9–36.9), under load |
| Signal Dunes | 0 | 67 ms | 1.1 | 37.8 (31.0–40.0), under load |
| Driftwood | 0 | 0 | 1.5 | 37.7 (35.5–40.0), under load |

Pine and Nalati's previous owner diagnostic at `170180f1a` had 2 / 14 first-entry
shader calls and 67 / 84 ms tasks. Both mechanisms are absent here. These runs have
different load, so their millisecond differences are not a controlled speed estimate.
The exact Nalati pixel/program/source/GPU/collider parity proof is recorded in
[the preparation receipt](../sf22-offscreen-preparation/README.md); the sample-exact
ranged event/resource and unchanged actual Pine physics bake proofs are in
[the ranged preparation receipt](../sf22-pine-ranged-preparation/README.md).

Maximum crossing commit was 0.2 ms; maximum demand wait 3.4 ms. Pine departure
was 14.9 ms total (2.0 checkpoint, 0.1 commit, 12.8 leave). Other departures:
Driftwood 21.2, Nalati 9.9, Template 26.6 (26.1 checkpoint), Sky 11.0, Signal 4.5 ms.
The route's 556 explicit renderer warm-up invocations had a maximum wall interval
of 17.3 ms. No >50 ms task overlapped those invocations: the task maximum is
bounded by the observer's 50 ms threshold, not measured as 17.3 ms. Crossroads had
96 explicit warm-up shader calls, zero draw/driver calls and zero unclassified calls.

Raw cadence was p95 33.4 / p99 33.5 ms; standing p95 33.4 ms, observed timestamp
quantum 0.1 ms. Kept for diagnosis only because profiling/wrappers were enabled.
Memory qualification remains G269 phone runs; this adds no Simulator memory verdict.

Open: Signal's 67 ms first-entry task has no shader compile and still needs CPU
attribution. Initial boot still has a 678 ms task and a 452 ms task; sampled native
`getProgramInfoLog` accounts for 294.7 ms of the latter. The bounded CDP/page clock
join has 1.7 ms uncertainty. Exact compiled-source maps were not retained for all
boot nodes, so unmapped minified functions are not assigned authored source owners.

Raw evidence stays outside git:
`/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/attempt-a45-prepared-entry-owners.json`,
SHA-256 `3cbafc2697b059d862ada451b0dd163ac66d00a623d902c48cc95b955dd45d75`.
Detached proof `20261010T015213-sf22-prepared-entry-owners-a45eb-90459` completed
with rc 0 in 723 s. HTTP/disk version `a45eb30-mv21hnmd` was fenced to the pin.
