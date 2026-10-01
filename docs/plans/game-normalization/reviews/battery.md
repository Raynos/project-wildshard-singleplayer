# GAME-NORMALIZATION v2 · the battery (a growing regression suite for the plan)

A scenario passes a round only when every seat that walked it passes it. Round 1: 0 / 20. Round 2: 9 / 23 (seat A passed 13 / 20, seat C 14 / 20 plus 3 new failing). Round 3: 16 / 26 (seat A 20 / 23, seat C 17 / 23 plus 3 new failing). Each round walks every scenario step by step through the plan. A scenario **passes** when every step has an
unambiguous answer: which row, which file / §, what the executor does, and how it knows it's done. The scenarios are
kept forever; a round may **add** one that covers something no scenario touches yet (decision 92). The pass count
must never fall. A scenario that fails names the register IDs of its findings.

| # | Scenario | Added | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|
| 1 | Add shard 5 with a whip, a flying creature and a desert look, using only `docs/SHARDS.md` + 01-architecture (zero engine edits) | R0 | FAIL | FAIL | FAIL | |
| 2 | Migrate Pine Hollow's LeverRifle step by step, keeping its behaviour (decision 12′) | R0 | FAIL | FAIL | FAIL | |
| 3 | The Storm Titan's hit, from swing to HUD, through the new damage pipeline (hit cap + dodge guard, decision 20) | R0 | FAIL | FAIL | PASS | |
| 4 | A player's first boot after F10 (saves reset), then a v2 → v3 save-shape change a month later | R0 | FAIL | PASS | PASS | |
| 5 | The gate goes red at M1 on a pose diff: what happens, and who decides | R0 | FAIL | PASS | PASS | |
| 6 | A bug found in Nine Dragon mid-S2: where it's fixed and when it ships (decision 53) | R0 | FAIL | FAIL | PASS | |
| 7 | Nalati riding under the input context stack: every action, touch disc and verb slot | R0 | FAIL | FAIL | PASS | |
| 8 | A shard plugin throws during `shard.world` on the phone (decision 69) | R0 | FAIL | PASS | PASS | |
| 9 | Unload a shard in-page (the leak test) with Nalati's weather running | R0 | FAIL | FAIL | PASS | |
| 10 | Jake wants a new Debug toggle mid-refactor | R0 | FAIL | PASS | PASS | |
| 11 | The Drowned Captain onto the boss runtime with his fight unchanged, plus the shared BossBar (decision 91) | R0 | FAIL | FAIL | FAIL | |
| 12 | A future seamless travel from Driftwood to Pine Hollow: what exists and what's missing (decisions 59–61) | R0 | FAIL | PASS | PASS | |
| 13 | A later netcode layer: which state is already separate (decision 56) | R0 | FAIL | FAIL | PASS | |
| 14 | The iPhone memory wall at M3 (Nalati over 1.8 GB loading) | R0 | FAIL | FAIL | FAIL | |
| 15 | Rapier 0.21 changes a walk result at F12 (decision 89) | R0 | FAIL | PASS | PASS | |
| 16 | A gate red only on the slower runner: `gpu-gate/pine-hollow` fails `combat.shot` (killed at 23 s > 20 s) on the 3-vCPU `macos-15` VM while the m5 lane is green | R1 (seat C) | FAIL | PASS | PASS | |
| 17 | F6's codemod half-applies (crashes after part of the `git mv`s), and separately the pushed F6 commit turns CI red a day after F8 landed | R1 (seat C) | FAIL | PASS | PASS | |
| 18 | A content agent edits the reopened `src/shards/nine-dragon-stack/` (a new model + a Debug row) while the lead changes the Weapon API that Nine Dragon's plugin uses | R1 (seat C) | FAIL | FAIL | FAIL | |
| 19 | Jake says "no" at M1 after playing, or M1 breaks on his phone a day later | R1 (seat C) | FAIL | FAIL | PASS | |
| 20 | Mid-S2 the nightly `gpu-perf` fails: Pine Hollow's Simulator loading footprint is 12 % above the previous night, while every `gpu-gate` is green | R1 (seat C) | FAIL | PASS | PASS | |
| 21 | A content-lane commit's re-recorded baselines race a lead commit on the shared local `main` (amend onto the wrong HEAD) | R2 (seat C) | — | FAIL | FAIL | |
| 22 | The M2 accept / revert / pin loop: boarded items pending, one rejected, the pin target chosen | R2 (seat C) | — | FAIL | FAIL | |
| 23 | The first clean-export builds after F9 (CI, the pre-push tree gate, Vercel, the runner) with generated files git-ignored | R2 (seat C) | — | FAIL | PASS | |
| 24 | A pending field is changed again by a bug-fix commit before the milestone | R3 (seat C) | — | — | FAIL | |
| 25 | A reopened lane grades a narrow path and retunes Pine's branch cards (bake staleness) | R3 (seat C) | — | — | FAIL | |
| 26 | F2 records with timer-driven ambience; S3.5 later splits `Audio.ts` (the sound log) | R3 (seat C) | — | — | FAIL | |
