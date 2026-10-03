# The merge council · the battery (grows; never shrinks)

Walk each scenario through: `docs/plans/WORLDCLAW-SHARD.md` (§0.2 D77–D88, §2, §2b, §2c, rows L0–L3, T1, P12, S1),
`docs/design/worldclaw/06-shard-flow.md` (§5, §11, §10.2), `.claude/skills/worldclaw-interactive/SKILL.md` (BUILD, X, S),
`.claude/skills/shard-checkpoints/SKILL.md` (the pointer), `project/archive/2026-10-03-shard-checkpoints.md`,
`docs/plans/NINE-DRAGON-STACK.md`. A scenario passes when every step has an unambiguous answer: which row, which file /
§, which command or tool, what the executor does, how it knows it is done.

| # | Scenario | Added | R1 | R2 | R3 | R4 |
|---|---|---|---|---|---|---|
| 1 | Run row L2: pause Nine Dragon's slice in flight and make its light front today, before T1's checkers exist. Which files, where, in which format, from which sources; what Jake sees; what "done" is | R0 | FAIL (ABC) | | | |
| 2 | Thin Ice at P12: the village is the next place. Walk one checkpoint Frame → Form → Play → Pin: what each gate produces, what Jake is asked, what is measured, what deploys and who can see it | R0 | FAIL (ABC) | | | |
| 3 | After the village is pinned, which place is next and who decides; what if Jake names a place off the golden path | R0 | FAIL (BC) | | | |
| 4 | Pine Hollow (a live early-access shard) gets a new slice later: entry, light front, the slice in progress visible to players, the pin | R0 | FAIL (ABC) | | | |
| 5 | The village's Form gate needs a model P11's catalog never made (a ferry winch) | R0 | FAIL (ABC) | | | |
| 6 | An agent is told "use shard-checkpoints on Nine Dragon" after the merge | R0 | FAIL (ABC) | | | |
| 7 | A checkpoint's Play gate fails (the player gets stuck on the pier stairs) | R0 | PASS (B, new shard) / FAIL (C) | | | |
| 8 | worldclaw-auto reaches P12 on a zero-shot shard: what the checkpoint is without Jake | R0 | FAIL (ABC) | | | |
| 9 | (added by B) A Nine Dragon slice changes the Well edge's look: what goes red, who re-records, when is it public | R1 | FAIL (B) | | | |
| 10 | (added by C) A new session says "resume nine-dragon-stack" after L2 | R1 | FAIL (C) | | | |
| 11 | (added by C) Nine Dragon's slice hits a hard failure the judges can't fix inside the design | R1 | FAIL (C) | | | |
| 12 | (added by C) At the light front Jake names a slice other than the paused one: F2's half-ported grapple, E281's round 3 | R1 | FAIL (C) | | | |
| 13 | (added by C) The village was pinned at P12; P13 then makes Sigrun's NPC moment and the winch work | R1 | FAIL (C) | | | |
| 14 | (added by C) An in-progress commit on live Pine Hollow moves its look: the next push's gpu-gate and the players' build | R1 | FAIL (C) | | | |

**After round 2 (Jake, D89 / D90):** scenarios 1, 4, 6, 9, 10, 11, 12 and 14 test the existing-shard path, which is withdrawn; they are retired (kept, marked `retired`). Round 3 walks 2, 3, 5, 7, 8, 13.

**Round 3:** 3 and 5 pass in all seats; 2, 7, 8, 13 failed on MC38, MC40, MC41, MC42 (fixed). Added: 15 (B, C: a director's §S on Nine Dragon, MC36), 16 (B, C: WorldClaw on a shipped slug, MC44), 17 (C: a shard-wide P13 pass, MC42), 18 (A: S1 after the pilot, MC35), 19 (A: Thin Ice's P17 caps, MC39).
