# Pacing-on grid milestone floor (E435)

Pinned source: `1046bba3d4f3e1f78cdcedd28c9f9621e5f63664`. Developer ON, DEVSERVER catalogue (Nine included), default build pacing ON, live clocks, Auto fps, 2× render scale, muted. No CPU/GPU profiling or GL allocation observer in the baseline. Desktop: uncapped Metal; Simulator: portrait Safari phone tier.

Gate: desktop max ≤100 ms and p95 ≤17.5 ms; Simulator max ≤200 ms and p95 ≤33 ms. Integer-rounded medians must be ≥60 / ≥30 fps; content CPU ownership and valid drawn-frame samples remain required. A short-window cadence miss remains FAIL even when the whole-drive p95 passes.

Each row covers a real driven road entry (template out/back use their continuous route), its 120-frame travel window and a subsequent 120-frame **entry-interior** sample. These are entry interiors, not a claim about every interior pose. Independent runtime approaches seed the road, complete the actual source checkpoint/leave, then drive the border; they do not fabricate an entered resident.

## Desktop

| Route | Max ms (drive / interior) | p95 ms (drive / travel / interior) | Drive frames >50 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| template-interior | 83.3 / 16.8 | 16.8 / 16.8 / 16.8 | 1 | PASS |
| template-return | 66.7 / 16.8 | 16.7 / 16.7 / 16.7 | 2 | PASS |
| nine-dragon-stack-road-entry | 83.4 / 16.8 | 16.8 / 33.4 / 16.7 | 2 | FAIL |
| far-reach-road-entry | 50 / 16.8 | 16.8 / 16.8 / 16.7 | 0 | PASS |
| nalati-grasslands-road-entry | 50 / 16.8 | 16.8 / 33.4 / 16.7 | 0 | FAIL |
| pine-hollow-road-entry | 66.7 / 16.8 | 16.8 / 16.8 / 16.8 | 2 | PASS |
| sunscar-dunes-road-entry | 33.3 / 16.8 | 16.8 / 16.7 / 16.7 | 0 | PASS |
| driftwood-isle-road-entry | 66.6 / 16.8 | 16.8 / 16.8 / 16.8 | 1 | PASS |

Standing samples: spawn p95 16.7 ms / max 16.8 ms: PASS; grid-crossroads p95 16.8 ms / max 16.8 ms: PASS; grid-deck-north p95 16.8 ms / max 16.8 ms: PASS.

## iOS Simulator

| Route | Max ms (drive / interior) | p95 ms (drive / travel / interior) | Drive frames >100 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| template-interior | 228 / 35 | 35 / 58 / 34 | 3 | FAIL |
| template-return | 175 / 34 | 36 / 55 / 34 | 2 | FAIL |
| nine-dragon-stack-road-entry | 154 / 35 | 34 / 36 / 34 | 3 | FAIL |
| far-reach-road-entry | 111 / 34 | 45 / 39 / 34 | 1 | FAIL |
| nalati-grasslands-road-entry | 230 / 35 | 49 / 66 / 34 | 1 | FAIL |
| pine-hollow-road-entry | 414 / 35 | 37 / 53 / 35 | 3 | FAIL |
| sunscar-dunes-road-entry | 277 / 34 | 45 / 54 / 34 | 1 | FAIL |
| driftwood-isle-road-entry | 124 / 34 | 43 / 47 / 34 | 1 | FAIL |

Standing samples: spawn p95 36 ms / max 237 ms: FAIL; grid-crossroads p95 34 ms / max 39 ms: FAIL; grid-deck-north p95 34 ms / max 36 ms: FAIL.

desktop: complete=True, 255.13 seconds; errors=0.
sim: complete=True, 393.604 seconds; errors=0.

Raw arrays stay in scratch. The scalar summary retains all phase metrics, validity verdicts and long-frame hook attribution. Both surfaces use the same source pin. Quiet windows are separately acquired/released; browser/preview/Simulator cleanup is required before release.


Worst route: Pine activation, 414 ms on the Simulator. Nalati activation is 230 ms; the template outbound drive has a 228 ms between-hook frame. Signal has a 277 ms afterPlay frame. This is a RED milestone, not a passing default-pacing claim. Pine activation is the next profiling target; Signal activation and the Simulator frame-cap fix remain with sp-x2.
