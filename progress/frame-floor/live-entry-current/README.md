# First-visible entry drive: Simulator follow-up

**Drive targets pass on `bbffcd30e`: Nalati p95 35/max 92 ms; Sky socket-entry 35/93; normal-road Nalati 34/83. Cold-road readiness remains a failure, and Sky's full lift traversal remains incomplete.** Source `3d73d5857` makes each boot slicer respect work already spent since the last drawn frame, instead of starting a fresh budget for every builder. Loading/native behavior is unchanged.

Developer on, phone tier, 2× scale, Auto FPS, build pacing on, seed 357. Quiet window **2026-10-11 08:02:17–08:06:36 UTC**, one-minute load **10.98–12.46**. No GL timing or CPU profiler. Routes reach the actual waypoint inside the geometric cell; earlier motor-transfer endpoints omitted the first visible frame and are not matched controls.

| Drive | Pin | Frames | p95 ms | Maximum ms | ≤35 / ≤200 ms |
| --- | --- | ---: | ---: | ---: | --- |
| Nalati entry | bbffcd30e | 990 | 35 | 92 | PASS / PASS |
| Sky **socket entry** | bbffcd30e | 360 | 35 | 93 | PASS / PASS |
| Nalati normal road | bbffcd30e | 1350 | 34 | 83 | PASS / PASS |
| Signal entry | 20f2b2cb2 | 570 | 34 | 73 | PASS / PASS |
| Template entry | 20f2b2cb2 | 1500 | 34 | 160 | PASS / PASS |
| Template return | 20f2b2cb2 | 1710 | 34 | 182 | PASS / PASS |

Signal/template quiet window was **07:12:11–07:22:47 UTC**, load 7.08–14.78. None of the completed drives reproduces the old >200 ms maxima. Nalati entry's eight frames above 50 ms are world (4, maximum 65), afterKit (3, 61), and activate (1, 92). Its separate travel p95 is 38 ms (sp-x1's travel row); whole-drive p95 is 35 ms. Other source changed between pins, and the newer Nalati drive has 990 versus 900 frames: no isolated causal p95 saving is claimed. The harness's overall strict/travel verdict is separate from the coordinator's ≤35 ms Simulator drive threshold.

Sky socket-entry ends 7.5 m inside the permanent 15 m asphalt socket, before its authored lift. It is explicitly named as a separate route (`bbffcd30e`); it proves the first visible/entered frame, **not the full lift traversal**. The full route at `20f2b2cb2` timed out at feet (0.008, 0.098, −332.174), aiming at (0, −345), after falling off the authored rising-islet route. The destination was current/inside, gameplayReady true, resident, with no pending admission/issues, new document or recovery. That failure remains incomplete; it needs an actual lift itinerary rather than a shortened pass.

**Normal-road readiness still fails.** Pending starts at 12.041 s, wall contact at 13.636 s, and the final pending wall sample is 33.319 s: at least **19.683 s** of observed waiting. First visibility at 34.390 s/x=305.057 has readiness true. World construction takes **6.786 s**, afterKit 0.429 s, play 0.296 s, and afterPlay **11.378 s**. There is no observed early visibility. From a cold turn, the ~1.6 s preparation lead is shorter than world construction alone: another shader-only reduction cannot establish ready-before-arrival. Preparation must begin earlier under the owned-runtime policy, or the world must be cheaper to build. No quality, render scale, motor speed, residency charge or opaque-runtime overlap changed.

Desktop current-pin window **08:13:47–08:14:34 UTC**: Nalati drive 960 frames, **p95 16.8/p99 33.3/max 83.4 ms**, one frame >50 ms in afterPlay. P95 stays at 16.8 and the maximum is below Jake's 100 ms cap. This is not an isolated maximum-frame A/B. The earlier matched shader-pipeline control (`88b76f10c` → `fe363a5d0`, 930 frames each) was p95 **16.8 → 16.8**, max **66.7 → 50.1 ms**. A separate desktop profile recorded one 50 ms task, including 15 ms in getProgramParameter/Program.isReady; profiling has no timing credit.

The 33 boot/pacing/work-slice checks and 19 route checks pass; touched lint and the committed-source root strict check pass. Only scalar summaries are committed. The full Sky route and ready-before-cold-road-arrival remain open.
