# Milestone frame floor rerun (E435)

**FAIL** on source `c66b5b324e5de37195db4c7921e742243bc06580`. Measured surfaces: desktop, sim. Developer ON, DEVSERVER catalogue, default build pacing ON, Auto fps, unchanged 2x render scale, muted. No profiling or GL observer.

Desktop gate: max <=100 ms, p95 <=17.5 ms. Simulator: max <=200 ms, p95 <=35 ms; the shipped 30 fps cap allows 34–35 ms vsync jitter. Drawn-frame validity, owner CPU, route witnesses, zero errors and the ten-minute run budget remain required.

The first Simulator attempt is discarded: sp-x7 reported CPU proof overlap at 21:07:13–21:08:32 UTC and 21:10:04–21:10:12 UTC. Only the clean same-pin retry below receives timing credit.

The second Simulator attempt was stopped after focused map proofs, concurrent strict/lint and commit hooks overlapped live sampling at 21:29–21:30 UTC. It also receives no timing credit. The coordinator enforced a global CPU hold before the credited retry.

## desktop

| Route | p95 ms (travel / drive / interior) | Max ms (travel / drive / interior) | Verdict |
| --- | ---: | ---: | --- |
| template-interior | 16.7 / 16.8 / 16.7 | 16.8 / 66.7 / 16.8 | PASS |
| template-return | 16.7 / 16.7 / 16.7 | 16.8 / 50 / 16.8 | PASS |
| nine-dragon-stack-road-entry | 16.7 / 16.8 / 16.8 | 83.3 / 83.3 / 16.8 | PASS |
| far-reach-road-entry | 16.8 / 16.8 / 16.7 | 66.7 / 66.7 / 16.8 | PASS |
| nalati-grasslands-road-entry | 16.7 / 16.8 / 16.7 | 16.8 / 50.1 / 16.8 | PASS |
| pine-hollow-road-entry | 33.3 / 16.7 / 16.7 | 50 / 50 / 16.8 | FAIL |
| sunscar-dunes-road-entry | 16.8 / 16.7 / 16.7 | 49.9 / 49.9 / 16.8 | PASS |
| driftwood-isle-road-entry | 16.8 / 16.8 / 16.8 | 66.7 / 66.7 / 16.8 | PASS |

Standing samples: spawn: p95 16.7 ms, max 16.8 ms, PASS; grid-deck-north: p95 16.7 ms, max 16.8 ms, PASS; grid-deck-east: p95 16.7 ms, max 16.8 ms, PASS.

Complete=True; run budget=True (362.042 seconds); errors=0.

## sim

| Route | p95 ms (travel / drive / interior) | Max ms (travel / drive / interior) | Verdict |
| --- | ---: | ---: | --- |
| template-interior | 34 / 34 / 34 | 40 / 174 / 66 | PASS |
| template-return | 34 / 34 / 34 | 142 / 142 / 34 | PASS |
| nine-dragon-stack-road-entry | 34 / 34 / 34 | 184 / 184 / 34 | PASS |
| far-reach-road-entry | 37 / 34 / 34 | 82 / 82 / 34 | FAIL |
| nalati-grasslands-road-entry | 36 / 36 / 34 | 54 / 103 / 34 | FAIL |
| pine-hollow-road-entry | 58 / 39 / 34 | 91 / 113 / 48 | FAIL |
| sunscar-dunes-road-entry | 52 / 51 / 46 | 117 / 117 / 53 | FAIL |
| driftwood-isle-road-entry | 59 / 45 / 34 | 133 / 133 / 52 | FAIL |

Standing samples: spawn: p95 34 ms, max 34 ms, PASS; grid-crossroads: p95 34 ms, max 34 ms, PASS; grid-deck-east: p95 34 ms, max 34 ms, PASS.

Complete=True; run budget=True (479.708 seconds); errors=0.

The [scalar receipt](summary.json) retains every measured phase, missing rows, validity and CPU ownership, long-frame hook attribution and all entry witnesses. The six road entries follow the continuous template out/back route; entry-interior samples do not cover every authored pose. This measures Mac-backed Safari Simulator performance, with no physical-device or memory-cap claim. Owned previews, browser and Simulator are closed before quiet release.

Pine short desktop travel remains the first owned fix: 33.3 ms p95 exceeds
the 17.5 ms gate. Simulator short travel also fails in Far Reach, Pine,
Sunscar and Driftwood, with Sunscar interior failing as well; these rows
remain open here. Nalati readiness/preparation belongs to sp-x2. The next
owned step is a profiled Pine diagnostic after its comparison window,
then a generic fix supported by attribution and focused exact-output
checks. No fix or quality change is claimed by this baseline receipt.
