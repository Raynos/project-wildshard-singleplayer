# Pacing-on grid milestone floor (E435)

Pinned source: `1046bba3d4f3e1f78cdcedd28c9f9621e5f63664`. Developer ON, DEVSERVER catalogue (Nine included), default build pacing ON, live clocks, Auto fps, 2× render scale, muted. No CPU/GPU profiling or GL allocation observer in the baseline. Desktop: uncapped Metal; Simulator: portrait Safari phone tier.

Gate: desktop max ≤100 ms and p95 ≤17.5 ms; Simulator max ≤200 ms and p95 ≤35 ms. The Simulator caps at 30 fps (33.3 ms), so 34–35 ms is cap plus vsync jitter, not a failure. Integer-rounded medians must be ≥60 / ≥30 fps; content CPU ownership and valid drawn-frame samples remain required. A short-window cadence miss remains FAIL even when the whole-drive p95 passes.

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

Standing samples: spawn p95 36 ms / max 237 ms: FAIL; grid-crossroads p95 34 ms / max 39 ms: PASS; grid-deck-north p95 34 ms / max 36 ms: PASS.

desktop: complete=True, 255.13 seconds; errors=0.
sim: complete=True, 393.604 seconds; errors=0.

Raw arrays stay in scratch. The scalar summary retains all phase metrics, validity verdicts and long-frame hook attribution. Both surfaces use the same source pin. Quiet windows are separately acquired/released; browser/preview/Simulator cleanup is required before release.


Worst route: Pine activation, 414 ms on the Simulator. Nalati activation is 230 ms; the template outbound drive has a 228 ms between-hook frame. Signal has a 277 ms afterPlay frame. This is a RED milestone, not a passing default-pacing claim. Correction: the earlier README wrongly classified 34–35 ms standing samples under a 33 ms limit; the raw harness already accepted 35 ms. The travel and long-frame failures below remain valid. Pine activation is the next profiling target; Signal activation and the Simulator frame-cap fix remain with sp-x2.

## Pine attribution and first-frame preparation

A separate desktop CPU/GPU profile on `1046bba3d` found two different frames. `afterPlay` waited on texture upload (60.4 ms in `texSubImage2D`, 55.5 ms command-buffer waits). `activate` ran the update systems: grass's initial `flush(Infinity)` / cell seeding / noise and RNG, far-herd growth, and the HUD class change with layout. It did **not** construct an AudioContext. The profile itself is diagnostic, not baseline timing credit.

`a6c81a933` adds owner-scoped render-data preparation; `5dcd0008a` connects it to the actual entered `precompileLevel` path as well as streamed-root warm-up. Grass fills the same initial cell window in cooperative slices before compilation / first draw, rather than all in the activation update. Every grass and flower matrix / colour element matches the old first fill; the next update does not refill. Standalone updates keep their original path. Seventeen focused tests, strict checking and touched lint passed. No simulation, collider, shader or appearance change.

The first queued check was cancelled before measurement after noticing the missed entered warm-up call. It is not a failed timing sample. The targeted Simulator check uses `5dcd0008a`; that pin also contains sp-x2's frame-cap fix, so cadence improvement is not credited to grass preparation.

The plain targeted Simulator pass completed in 143.1 s with zero errors, no profiler or GL observer, and released its browser / preview / Simulator before ending the quiet window. Pine activation was **104 ms** (baseline 414 ms); the whole drive peaked at **154 ms**, with three frames over 100 ms. Travel p95 was 52 ms, whole-drive p95 36 ms, and the 120-frame entry interior p95 34 ms. Median was 30.303 fps in each phase. The spike gate now passes for Pine, but the strict p95 gate still fails. This targeted check does not replace or regrade the other milestone rows.

The same-pin plain desktop check completed in 99.1 s, zero errors: whole-drive max **50.1 ms**, p95 **16.8 ms**, one frame over 50 ms (`afterPlay`), median 59.88 fps. Travel p95 16.7 ms and entry-interior p95 16.7 ms both pass; activation produced no frame over 50 ms. All desktop phases pass. Its browser and preview were closed before quiet release.

| Targeted Pine drive | Max ms | p95 ms | Frames over threshold | Verdict |
| --- | ---: | ---: | ---: | --- |
| Desktop, prepared | 50.1 | 16.8 | 1 (>50 ms) | PASS |
| Simulator, prepared | 154 | 36 | 3 (>100 ms) | FAIL (p95) |

Milestone stays **RED**. The worst activation spike is reduced and Pine now fits the Simulator spike limit, but cadence still needs sp-x2's frame-cap work; the other baseline failures remain open. This does not claim a fresh full-route milestone pass.
