# Signal first-entry activation (E435 / G329)

Desktop profile, pin `5af2e411356da578d70494f9c248ad8281d5d776`, Developer grid, build pacing ON, 2× render scale, muted. First road entry: 59.88 fps, p95 16.7 ms, max 116.6 ms: FAIL against the 100 ms desktop limit. Subsequent authored-spawn / road-return / re-entry maxima: 16.8 / 16.8 / 33.4 ms.

Source-map attribution of the first RetainedRuntimeHooks.activate subtree: 110.092 ms sampled CPU, including 105.767 ms in the native AudioContext constructor (engine/audio/unlock.ts). The caller is installSilentScore → Music.out → Music.build → Audio.graph. Re-entry activation sampled 0.751 ms. The proposed bulk collider/species installer replay is not the measured cause.

Fix: the shared silent-score installer uses Music's existing silence(scope) rather than reading its lazy output gain. Before the graph exists this records scoped silence without constructing WebAudio; when real audio starts the same gain is muted and restored on disposal. No hook scheduling, simulation, RNG or collider changes. Focused real-Music tests cover pre-gesture silence, first real audio startup and retirement before startup; Signal headless/replay/ledger pass unchanged.

Plain matched quiet-window floor, 2026-10-10 21:57–22:02 CT: baseline `5af2e4113` versus isolated `052b03cbf` (only the silent-score production change from `9f099616a`). Both complete routes PASS; all grid poses and interiors held 59.88 fps. CPU profiling was off. One-minute machine load was 11.34 → 7.63 on the baseline and 7.63 → 6.88 on the fix.

| Whole drive including construction | Baseline p95 / max ms | Fix p95 / max ms | Frames >50 ms, before → after |
| --- | ---: | ---: | ---: |
| First road entry | 16.8 / 100 | 16.7 / 33.4 | 2 → 0 |
| Authored spawn | 16.7 / 16.8 | 16.8 / 16.8 | 0 → 0 |
| Road return | 16.7 / 16.8 | 16.7 / 16.8 | 0 → 0 |
| Re-entry | 16.8 / 33.3 | 16.7 / 33.4 | 0 → 0 |

Neither plain arm had a frame over 100 ms. The fix removes the attributed activation hitch without replaying or slicing installers. Raw profiles/maps and floor recordings stay in scratch, not git.
