# Cold road arrival: Nalati

**The zero-wait gate still fails.** At shipping road speed, actual motor blockage falls from **19.579 s (581 frames) to 8.396 s (252 frames)**. Neither run shows an unready regional root visible.

Matched cold Simulator routes, Developer on, phone tier, 2× scale, build pacing on, seed 357. Control `245dbd3f8`; candidate `afb331518` contains earlier boulevard preparation and static warm-draw deduplication. Start (277.5, 277.5), turn (277.5, 0), endpoint (345, 0); real held input up to the shipped 30 m/s. Only the first road pose is seeded. Every drawn frame records actual motor blockage within 10 m of an unready destination. Road `gameplayReady` does not establish destination readiness.

| Source | Edge wait | Drive frames | p95 / p99 / max ms | Early visible frames |
| --- | ---: | ---: | --- | ---: |
| 245dbd3f8 | 19.579 s | 1350 | 34 / 48 / 86 | 0 |
| afb331518 | 8.396 s | 1020 | 34 / 54 / 76 | 0 |

Both meet the Simulator drive gate (p95 ≤35 ms, max ≤200 ms); both fail arrival. Control has 9 frames above 50 ms, candidate 13; candidate world max is 76, activate max 71 ms. Quiet window 2026-10-11 08:58:12–09:01:26 UTC; one-minute loads 9.77 and 12.91. Simulator/window released in cleanup. One cold run per source: no repeated-cohort or isolated timing saving claimed.

Pending starts by 0.280 s instead of 12.008 s. Candidate construction still costs 7.430 s (control 7.151), afterKit 0.515, play 0.312, afterPlay 11.392 s. Warming is unchanged: compile 6.204 s / 619 jobs, link 0.366 s / 11 remaining programs, upload 2.635 s / 95 textures, parked draws 2.097 s / 138 drawables, offscreen draws 0.065 s / 8 passes. Shaders/composer's 9.229 s span overlaps compile/link/upload: do not add it. Static draw deduplication earns no saving credit here.

Next source `93188c5f4` restricts exterior-light variants to content that survives outside regional roots. Entered-light inventory and the first shadow pass's previous-light variants stay intact; measurement pending. Other template-drive arrivals and Sky's full authored lift remain open. No quality, scale, speed cap, residency charge, or exclusive-world overlap changed.
