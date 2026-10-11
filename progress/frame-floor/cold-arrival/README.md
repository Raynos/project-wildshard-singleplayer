# Cold road arrival: Nalati

**Nalati arrival and whole-drive pass; the full milestone remains open.** The latest cold run records **0 blocked frames, 0 early-visible frames**, whole-drive **p95 35 ms / max 90 ms**. The short 120-frame travel window still misses at **p95 40 ms** (sp-x1 owns travel pacing). Other cells and Sky's full authored lift traversal are pending.

Phone Simulator, Developer on, 2× scale, seed 357. Start (277.5, 277.5), road turn (277.5, 0), endpoint (345, 0), normal held input capped at the shipping 30 m/s. Only the first road pose is seeded. Every drawn frame observes real motor blockage within 10 m of the unready cell edge and regional visibility; road gameplayReady cannot substitute for destination readiness.

| Source / mode | Edge wait | Whole-drive p95 / max ms | Short travel p95 ms | Early visible frames |
| --- | ---: | --- | ---: | ---: |
| 245dbd3f8 / on | 19.579 s | 34 / 86 | not extracted | 0 |
| afb331518 / on | 8.396 s | 34 / 76 | not extracted | 0 |
| 15ba9b22a / on | 6.596 s | 34 / 107 | not extracted | 0 |
| 0faadfbf0 / on | 5.966 s | 35 / 87 | not extracted | 0 |
| 246673f05 control / on | 6.304 s | 34 / 93 | 34 | 0 |
| 312618b78 bounded construction / on | 2.400 s | 34 / 74 | 46 | 0 |
| 312618b78 bounded construction / uploads | 0.533 s | 35 / 88 | 45 | 0 |
| 1ed327eec bounded construction + image + parked batches / on | **0** | **35 / 90** | **40** | **0** |

Final quiet window **2026-10-11 10:35:06–10:36:29 UTC**, one-minute load **3.61**. Completed route 23.678 s; no game errors or document recovery. Simulator/window released in cleanup. Each source has one cold run, with intervening commits: this is a timing diagnostic, not a repeated-cohort or fully isolated causal saving. The bounded experiments use the corrected permanent-road crossroads camera (`63231ccbe`); the earlier control passed the old camera. The first old-camera bounded attempt lost its standing position and was incomplete; an initial uploads attempt was rejected by the configuration fence. Neither earns arrival or timing credit.

The final run keeps all 95 textures and 138 parked drawables: compile 4.403 s / 436 jobs, link 0.370 s / 11 programs, upload 0.997 s, parked draws 0.459 s, offscreen draws 0.066 s / 8 passes. Shaders/composer's 5.788 s overlaps compile/link/upload; do not add it. Image batches use the existing measured 8 ms / 8 MiB bound; compressed uploads retain their painted and GL-error fences. Small already-linked parked draws share the construction budget, restore all scene state at every task, and finish behind a painted barrier before readiness. Desktop keeps its existing upload/draw scheduling; quality, 2× scale, speed, charged ownership and exclusive-world retirement stay unchanged.

Source `83a735edc` lands the bounded CPU slice. This receipt records the following combined warm-up candidate, including its still-failing short travel window. Focused parked-draw/upload/cancellation checks and strict in an owned committed-source export passed; the shared tree contains unrelated stale source hunks. No builder full suite was run.
