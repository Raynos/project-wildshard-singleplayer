# GAME-NORMALIZATION v2 · the battery (a growing regression suite for the plan)

Each round walks every scenario step by step through the plan. A scenario **passes** when every step has an
unambiguous answer: which row, which file / §, what the executor does, and how it knows it's done. The scenarios are
kept forever; a round may **add** one that covers something no scenario touches yet (decision 92). The pass count
must never fall. A scenario that fails names the register IDs of its findings.

| # | Scenario | Added | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|
| 1 | Add shard 5 with a whip, a flying creature and a desert look, using only `docs/SHARDS.md` + 01-architecture (zero engine edits) | R0 | | | | |
| 2 | Migrate Pine Hollow's LeverRifle step by step, keeping its behaviour (decision 12′) | R0 | | | | |
| 3 | The Storm Titan's hit, from swing to HUD, through the new damage pipeline (hit cap + dodge guard, decision 20) | R0 | | | | |
| 4 | A player's first boot after F10 (saves reset), then a v2 → v3 save-shape change a month later | R0 | | | | |
| 5 | The gate goes red at M1 on a pose diff: what happens, and who decides | R0 | | | | |
| 6 | A bug found in Nine Dragon mid-S2: where it's fixed and when it ships (decision 53) | R0 | | | | |
| 7 | Nalati riding under the input context stack: every action, touch disc and verb slot | R0 | | | | |
| 8 | A shard plugin throws during `shard.world` on the phone (decision 69) | R0 | | | | |
| 9 | Unload a shard in-page (the leak test) with Nalati's weather running | R0 | | | | |
| 10 | Jake wants a new Debug toggle mid-refactor | R0 | | | | |
| 11 | The Drowned Captain onto the boss runtime with his fight unchanged, plus the shared BossBar (decision 91) | R0 | | | | |
| 12 | A future seamless travel from Driftwood to Pine Hollow: what exists and what's missing (decisions 59–61) | R0 | | | | |
| 13 | A later netcode layer: which state is already separate (decision 56) | R0 | | | | |
| 14 | The iPhone memory wall at M3 (Nalati over 1.8 GB loading) | R0 | | | | |
| 15 | Rapier 0.21 changes a walk result at F12 (decision 89) | R0 | | | | |
