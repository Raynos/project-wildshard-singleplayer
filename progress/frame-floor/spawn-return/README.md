# Spawn and return residuals (E435)

**The two requested rows PASS on `1edab0456`; the whole Simulator route remains RED at outbound 277 ms.** Plain runs use no CPU profiler or GL timing. [summary.json](summary.json) keeps every standing/travel/drive/interior row, the failed diagnostic, validity fields and endpoint fences in a compact column table.

| Plain surface / row | p95 ms | Max ms | >50 / >100 ms | Verdict |
| --- | ---: | ---: | ---: | --- |
| Simulator actual boot spawn | 34 | 35 | 0 / 0 | PASS |
| Simulator outbound template drive | 34 | 277 | 18 / 1 | FAIL |
| Simulator full Driftwood return | 34 | 131 | 6 / 2 | PASS |
| Desktop actual boot spawn | 16.7 | 16.8 | 0 / 0 | PASS |
| Desktop outbound template drive | 16.8 | 50.1 | 1 / 0 | PASS |
| Desktop full Driftwood return | 16.8 | 100.0 | 3 / 0 | PASS, at limit |

The gate remains desktop p95 <=17.5 ms / drive max <=100 ms, Simulator p95 <=35 ms / drive max <=200 ms. Both plain captures complete with positive drawn frames, zero skipped frames, owner CPU pass, zero errors/context loss, and settled ready current/inside/frame-owner matching template-2 then Driftwood. Interiors remain 16.7/34 ms. Phone 30 fps cap explains normal 34 ms jitter. No quality, scale, content or admission reduction.

## Attribution and fixes

The old 39 ms “spawn” was **invalid for spawn**: scans had already unloaded the home and its sampled feet were approximately `(273.9,-40)` on the road instead of `(0,-194)`. `f5ce03363` measures the actual boot spawn before those scans, validates XZ within 2 m, rejects non-finite/displaced feet and profiles standing as well as the complete return window. Its 13 focused checks cover order, displacement refusal and profiling. The corrected Safari diagnostic is 34 ms p95 /37 ms max. This is a harness correction, not a claimed engine speedup.

Desktop CPU and both-surface GL diagnostics on `f5ce03363` find return maxima 66.6/93 ms; Safari's four long return frames record only 3/0/1/0 ms GL. The original 252 ms frame on `f71faa702` had no CPU/GL trace and does not reproduce on this later pin. Its exact cause remains unestablished; that pin difference already includes sp-x2's shader warm-ups `93188c5f4` / `15ba9b22a`. No isolated return-speedup claim.

The Safari outbound diagnostic catches a separate 256 ms between-hook frame with only 3 ms GL. Its CPU profile includes 151 Memory-constructor self samples out of6467, including36 under `ScriptHost.restoreState -> lane.restore -> restoreSimHost -> LiveGridSession.create`. Safari reports zero sample timestamps: these are shares, not milliseconds or proof that allocation caused that exact frame. `1edab0456` removes the unnecessary equal-size restore allocations generically: validate ALL module memories/global types before publication, restore complete memory and mutable globals in place, retain fresh instances for changed sizes. No author/init/query call, wire change, memory discount or relaxed refusal. **43 focused script/native-composition checks, scoped strict, touched lint and hooks pass**; real constructor spies prove zero new Wasm memories/instances on equal-size restore, atomic later-module refusal and exact grown/shrunk suffixes.

The plain outbound still fails at277 ms. Both256/277 peaks begin106/111 ms after Nalati's road-preparation afterPlay ends; this is correlation, not a time-aligned CPU cause. Its current/inside remains null on the road at that point; both entries/returns eventually finish. Nalati cold-arrival preparation is sp-x2's active work. This receipt leaves the broader frame-floor row open and gives that lane the phase evidence; it does not claim the restore optimization cured it.

## Conditions

Auto fps, Developer ON / DEVSERVER catalogue, build pacing ON, unchanged2x scale. Pinned source `1edab0456`; actual harness revisions are recorded. Quiet windows wait for the pusher and other windows, leave at least120 s gaps, and release every owned preview/Inspector/browser/Simulator helper. Safari plain244.214 s; desktop194.167 s. Mac-backed Simulator Safari, not physical iPhone. Diagnostics receive no timing credit. Raw reports/profiles stay in scratch, not git; summary records every completed attempt, including the outbound failures.
