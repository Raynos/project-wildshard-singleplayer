# Signal first-entry activation (E435 / G329)

Desktop profile, pin `5af2e411356da578d70494f9c248ad8281d5d776`, Developer grid, build pacing ON, 2× render scale, muted. First road entry: 59.88 fps, p95 16.7 ms, max 116.6 ms: FAIL against the 100 ms desktop limit. Subsequent authored-spawn / road-return / re-entry maxima: 16.8 / 16.8 / 33.4 ms.

Source-map attribution of the first RetainedRuntimeHooks.activate subtree: 110.092 ms sampled CPU, including 105.767 ms in the native AudioContext constructor (engine/audio/unlock.ts). The caller is installSilentScore → Music.out → Music.build → Audio.graph. Re-entry activation sampled 0.751 ms. The proposed bulk collider/species installer replay is not the measured cause.

Fix: the shared silent-score installer uses Music's existing silence(scope) rather than reading its lazy output gain. Before the graph exists this records scoped silence without constructing WebAudio; when real audio starts the same gain is muted and restored on disposal. No hook scheduling, simulation, RNG or collider changes. Focused real-Music tests cover pre-gesture silence, first real audio startup and retirement before startup; Signal headless/replay/ledger pass unchanged.

CPU profiling is diagnostic, not timing credit. A plain quiet-window after floor remains required to establish the first-entry maximum. Raw CPU profiles/maps stay in scratch, not git.
