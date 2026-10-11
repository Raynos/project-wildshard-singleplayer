# SF22: cadence and maximum-gap subset passes

The source fix is `bf3b0c45e`; the measured candidate is `6f6dd47c78b5391285df8723223725c208643fc9`, containing the same eight-path source projection. Baseline `a819411795ede65ceca6e860fa40c33b9604c6f4` and after use the same actual Driftwood → Signal → Driftwood road-hover inputs, Developer OFF, Memory saver OFF, Auto images, phone tier, DPR 2 and mute. Network shaping is aggregate 5 Mbit/s with 3/10-second asset stalls after home becomes playable. Clock: native browser rAF timestamp of each completed Game draw. Limits and quality remain unchanged.

| Surface / check | Before | After |
| --- | --- | --- |
| Desktop p95 / p99 | 33.4 / 33.4 ms | 33.4 / 33.4 ms |
| Desktop maximum draw gap (100 ms limit) | 366.6 ms FAIL | 66.6 ms PASS |
| Desktop PBR shader calls outside explicit compile | 4 | 0 |
| Desktop warm invocation / task upper bound | 6.2 / ≤50 ms | 6.1 / ≤50 ms |
| Safari p95 / p99 | 34 / 46 ms | 34 / 44 ms |
| Safari maximum draw gap (200 ms limit) | 301 ms FAIL | 85 ms PASS |
| Safari PBR shader calls outside explicit compile | 4 | 0 |

The source diagnostic found synchronous shader-link inspection on the main Game renderer, rather than a timer or worker owner. Signal streamed terrain forced 273/257 ms `getProgramInfoLog` calls; their completed-draw gaps were 350/374 ms with zero frame-gate refusals. A drawn sky material selected a warm-issued program before readiness and blocked 811 ms (826 ms draw gap). These are loaded diagnostic wall intervals, not GPU execution times or normative cadence results. Other short gaps remain unclassified; no GC, worker or timer time is invented.

`bf3b0c45e` prepares detached streamed tiles after their final horizon patch and before publication, through the existing sliced compile/link/upload path. Live compilation preserves the last real draw's selected program, renderer material state and uniform bindings while retaining the newly compiled variants in the program cache. Geometry, materials, leases, shader sources, resolution and quality are unchanged. Thirty-seven focused tests, root strict and touched-file typed lint pass. No scheduler or timing-limit changes.

The before/after scalar journals, measured load, build identities, failed attempts and gate limitations are in [summary.json](summary.json). Desktop completed both directions without errors/refusals and zero missing draw observations. Safari completed both directions with zero errors/refusals, zero missing draw observations, and zero shader calls outside explicit compilation. Its warm invocation maximum was 3 ms. Safari's Long Task bound is unavailable; it is not credited as zero. Desktop retains utility/warm-draw shader calls outside renderer.compile, so this does not claim zero compilation for the whole route. The old 49 ms headline used a polling clock and is not the comparable before value; the comparable earlier Safari p95/p99 was 36/53 ms on `77380da36`.

A missing scratch import stopped the first after Safari attempt before sampling; the valid desktop run is retained and Safari alone is retried. The scalar receipt preserves the failed attempts. The ordered Safari retry waited for sp-x2’s release, the two-minute gap and the pusher to exit; its quiet ran 19:54:59–19:57:04 UTC. All owned browsers, Simulator helpers, proxy, preview and quiet marker are closed. SF22 has no timing slot reserved; sp-x1 may follow the coordinator’s current order. This subset is not the full G270 gate or physical-phone memory clearance.

These are single matched route observations. Browser/app cache is cold/no-store as driven by the harness; driver disk caches are not erased. Timing differences are not a population estimate or a shader-cache-reset experiment. The call-site diagnostic and PBR compile-call reduction establish the removed path independently.

Safari retains the harness’s under-load flags: route load-average medians were 20.09 / 15.06 (before: 24.71 / 14.81). Desktop after medians were 7.03 / 6.85. The browser and Simulator lanes were isolated, but these flags are not cleared or recast as an uncontended qualification. The measured cadence/max-gap subset passes; the full G270 and physical-phone gates remain open.
