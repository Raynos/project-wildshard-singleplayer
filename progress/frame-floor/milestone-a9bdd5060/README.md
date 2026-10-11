# Current-head grid milestone floor (E435)

Source pin: `a9bdd506008a76fda881dc9a46c9dd4716783fed`. Same source on both surfaces; Developer ON/DEVSERVER catalogue, default pacing ON, Auto fps, unchanged 2× scale, muted. Plain timings: no CPU/GPU profiler or GL observer.

**Milestone FAIL.** Desktop: every frame max<=100ms, p95<=17.5ms. Simulator: max<=200ms, p95<=35ms (shipped 30 fps cap plus34–35 ms vsync jitter). Owner CPU, drawn-frame validity, endpoint/residency witnesses and zero errors remain required.

## desktop

| Observed row | p95 ms | Max ms | >50 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| spawn | 16.7 | 16.8 | 0 | PASS |
| grid-deck-east | 16.7 | 16.8 | 0 | PASS |
| grid-crossroads | 16.7 | 16.8 | 0 | PASS |
| grid-template-interior-travel | 16.7 | 16.8 | 0 | PASS |
| grid-template-interior-drive | 16.7 | 50 | 0 | PASS |
| grid-template-interior | 16.7 | 16.8 | 0 | PASS |
| grid-template-return-travel | 16.8 | 100 | 1 | PASS |
| grid-template-return-drive | 16.8 | 100 | 1 | PASS |
| grid-template-return | 16.7 | 16.8 | 0 | PASS |
| grid-nine-dragon-stack-road-entry-travel | 16.8 | 83.3 | 2 | PASS |
| grid-nine-dragon-stack-road-entry-drive | 16.8 | 83.3 | 3 | PASS |
| grid-nine-dragon-stack-road-entry | 16.7 | 16.8 | 0 | PASS |
| grid-far-reach-road-entry-travel | 16.8 | 66.6 | 1 | PASS |
| grid-far-reach-road-entry-drive | 16.7 | 66.6 | 1 | PASS |
| grid-far-reach-road-entry | 16.8 | 16.8 | 0 | PASS |
| grid-nalati-grasslands-road-entry-travel | 16.8 | 33.3 | 0 | PASS |
| grid-nalati-grasslands-road-entry-drive | 16.8 | 50 | 0 | PASS |
| grid-nalati-grasslands-road-entry | 16.7 | 16.8 | 0 | PASS |
| grid-pine-hollow-road-entry-travel | 16.8 | 33.4 | 0 | PASS |
| grid-pine-hollow-road-entry-drive | 16.8 | 50 | 0 | PASS |
| grid-pine-hollow-road-entry | 16.7 | 16.8 | 0 | PASS |
| grid-sunscar-dunes-road-entry-travel | 16.8 | 49.9 | 0 | PASS |
| grid-sunscar-dunes-road-entry-drive | 16.8 | 49.9 | 0 | PASS |
| grid-sunscar-dunes-road-entry | 16.7 | 16.8 | 0 | PASS |
| grid-driftwood-isle-road-entry-travel | 16.8 | 50 | 0 | PASS |
| grid-driftwood-isle-road-entry-drive | 16.7 | 50 | 0 | PASS |
| grid-driftwood-isle-road-entry | 16.8 | 16.8 | 0 | PASS |

Complete=True, seconds=361.715, errors=0.

## sim

| Observed row | p95 ms | Max ms | >100 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| spawn | 34 | 35 | 0 | PASS |
| grid-crossroads | 34 | 34 | 0 | PASS |
| grid-deck-east | 34 | 34 | 0 | PASS |
| grid-template-interior-travel | 34 | 43 | 0 | PASS |
| grid-template-interior-drive | 34 | 76 | 0 | PASS |
| grid-template-interior | 34 | 62 | 0 | PASS |
| grid-template-return-travel | 34 | 134 | 1 | PASS |
| grid-template-return-drive | 34 | 134 | 1 | PASS |
| grid-template-return | 34 | 34 | 0 | PASS |
| grid-nine-dragon-stack-road-entry-travel | 34 | 192 | 2 | PASS |
| grid-nine-dragon-stack-road-entry-drive | 34 | 192 | 3 | PASS |
| grid-nine-dragon-stack-road-entry | 34 | 34 | 0 | PASS |
| grid-far-reach-road-entry-travel | 37 | 79 | 0 | FAIL |
| grid-far-reach-road-entry-drive | 34 | 96 | 0 | PASS |
| grid-far-reach-road-entry | 34 | 34 | 0 | PASS |
| grid-nalati-grasslands-road-entry-travel | 34 | 59 | 0 | PASS |
| grid-nalati-grasslands-road-entry-drive | 36 | 96 | 0 | FAIL |
| grid-nalati-grasslands-road-entry | 34 | 38 | 0 | PASS |
| grid-pine-hollow-road-entry-travel | 59 | 179 | 1 | FAIL |
| grid-pine-hollow-road-entry-drive | 35 | 179 | 1 | PASS |
| grid-pine-hollow-road-entry | 34 | 35 | 0 | PASS |
| grid-sunscar-dunes-road-entry-travel | 42 | 88 | 0 | FAIL |
| grid-sunscar-dunes-road-entry-drive | 34 | 88 | 0 | PASS |
| grid-sunscar-dunes-road-entry | 34 | 35 | 0 | PASS |
| grid-driftwood-isle-road-entry-travel | 44 | 137 | 1 | FAIL |
| grid-driftwood-isle-road-entry-drive | 34 | 137 | 1 | PASS |
| grid-driftwood-isle-road-entry | 34 | 35 | 0 | PASS |

Complete=True, seconds=510, errors=0.

The initial desktop attempt at `ee80e5e63f5d938d06f5414cec475e61cdecdb2e` is retained as incomplete: Nine was entered and ready, but the harness steered towards its old flat endpoint after the real portal landed in the raised square. `8e03cea0a` follows the declared portal nodes and requires observed road and grounded destination witnesses. Its unstarted Simulator attempt was cancelled; no timing credit is claimed.

[summary.json](summary.json) keeps scalar rows, hook attribution, source/harness pins, validity and all entry endpoints. The incomplete Sky desktop attempt is preserved in the summary: it had zero game errors and an entered ready runtime, but the old harness missed the declared socket lift. `9933ca82a` follows the declared approach and observes USE, real deck motion and the bridge walk; the unstarted Simulator was cancelled. The six road entries are independent approaches after template out/back; interiors are entry-interior samples, not every authored pose. Raw frame arrays and profiles remain in scratch. This is a frame gate, not a memory-cap proof; no physical-device claim is made. All owned proof resources are closed before quiet release; windows respect push priority and 120 s gaps. Simulator Safari is Mac-backed, not physical iPhone.

Quiet windows (UTC): desktop **13:24:20–13:30:26**; Simulator **13:32:32–13:41:06**. Worst remaining row: Pine short travel **59 ms p95**; profile next. Nalati preparation stays with sp-x2. The wire-declaration refusal was fixed by `8e9631cb9` and is preserved as a separate incomplete attempt.
