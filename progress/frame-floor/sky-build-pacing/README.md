# Sky desktop build pacing (E435 / G329)

Harness fix `5af2e4113` permits only the first road seed to leave the home entered by standing probes. Source readiness, the checkpoint refusal, subsequent-leg source checks and document fencing stay strict; all 14 route tests pass.

The quiet diagnostic on `acb850d9652961917de1e0790c0af390fb19dab1`, Developer grid, 2× render scale, muted, pacing ON reproduced the 116.7 ms first-entry frame. CPU profiling and GPU tracing are attribution only, not timing credit. The activation frame spent 113.9 ms in the renderer-main FunctionCall, with 102.2 ms sampled in `new AudioContext` (`engine/audio/unlock.ts:19`). Its source-mapped call chain is `RetainedRuntimeHooks.activate → far-reach runtime score installer → installSilentScore → Music.out → Music.build → Audio.graph → newContext`. The trace shows no corresponding GPU-process stall in that activation frame. A separate 83.3 ms afterPlay frame includes a texture-upload command-buffer wait and remains below the desktop 100 ms cap.

Generic fix `9f099616a` (shared with Signal): `installSilentScore` calls the existing scoped `Music.silence` without touching its lazy output bus. It preserves silence/restoration when audio starts, and avoids constructing WebAudio in a silent shard's entry callback regardless of build pacing. No shard-specific scheduling or rendering change.

Plain matched quiet window on `9f099616a1cd41607b1c9f494f8577a276fe44cb`, CPU profile / GPU trace / GL-call timing OFF, same Developer grid and render scale:

| Sky desktop road entry | Whole-drive frames | Median fps | p95 ms | p99 ms | Max ms | Frames >50 ms | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Pacing ON | 240 | 59.88 | 16.8 | 33.3 | 66.7 | 1 | PASS |
| Pacing OFF | 270 | 59.88 | 16.8 | 33.3 | 50.0 | 0 | PASS |

Both complete source/road/destination and entered-residency witnesses passed, with no runtime error or document change. All standing/travel/interior rows passed. The shared audio fix holds in both modes; the ON run's remaining 66.7 ms frame is afterPlay.

The earlier quiet `acb850d96` pacing A/B (op-hitch45), OFF → ON, had Simulator max / p95 / frames >50 ms: Nine 446 / 42 / 9 → 145 / 34 / 4; Sky 101 / 48 / 11 → 107 / 43 / 8; Nalati 87 / 45 / 13 → 70 / 43 / 10. Desktop maxima: Nine 66.7 → 66.7; Nalati 216.6 → 66.7; Sky OFF 100, with its ON gap closed by the plain pair above. These are long-frame evidence; the older Simulator Sky/Nalati p95 values still exceed the separate 35 ms cadence gate.

Build pacing now defaults ON in ordinary and Developer boots. The existing Developer row retains OFF and the separate opt-in UPLOADS mode; upload budgeting is not enabled by this default. Importing framePacing still installs nothing, and loading/Node callers retain their own yield law. No collider, RNG, appearance or simulation change. The two preview processes and browser lanes closed, and the quiet window was released. This is Mac desktop / Simulator evidence, not a physical-iPhone measurement.
