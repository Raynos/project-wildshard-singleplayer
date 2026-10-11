# First-visible entry drive: Simulator follow-up

App pin `20f2b2cb2`; harness `f89b3d9fa`. Developer on, phone tier, 2× scale, Auto FPS, build pacing on, seed 357. Quiet window 2026-10-11 07:12:11–07:22:47 UTC; one-minute load 7.08–14.78. No GL timing or CPU profiler. The routes now reach their actual waypoint inside the geometric cell; earlier motor-transfer endpoints omitted the first visible frame and are not matched controls.

| Drive | Frames | p95 ms | Maximum ms | ≤35 / ≤200 ms |
| --- | ---: | ---: | ---: | --- |
| Nalati entry | 900 | 36 | 96 | FAIL / PASS |
| Signal entry | 570 | 34 | 73 | PASS / PASS |
| Template entry | 1500 | 34 | 160 | PASS / PASS |
| Template return | 1710 | 34 | 182 | PASS / PASS |
| Sky entry | — | — | — | INCOMPLETE |

None of the completed drives reproduces the old >200 ms maxima. Nalati's twelve frames above 50 ms fall in world (6, maximum 71 ms), afterKit (3, 59), activate (1, 96), kit (1, 67), and play (1, 51). None is labelled afterPlay. Its p95 still misses by 1 ms; construction/install attribution is next. The default CPU owner meter reports platform.grid p95 3 ms/max 19 ms and Nalati p95 1 ms/max 5 ms; these are fixed/render system samples, not a decomposition of constructor work.

Sky timed out at world feet (0.008, 0.098, −332.174), aiming at (0, −345). The destination was both current and inside, gameplayReady true, resident, crossing settled, with no pending admission/issues. Document identity remained intact and no recovery failure was reported. This is an interior traversal stall, not a successful drive floor. The last scalar ledger is retained in summary.json. No retry or shortened endpoint is counted as a pass.

These results do not prove normal-road readiness or desktop parity. The earlier matched warm-up still waited 17.632 s at the wall; its p95 was diluted by the longer approach. Root strict passes on a committed-source export of `d87f1f511`; the focused shader and route tests passed with their source landings. The harness's overall strict/travel verdict remains separate from the coordinator's ≤35 ms Simulator drive threshold. Only summaries are committed.
