# The merge council · the brief every seat gets

You are a fresh, independent reviewer (a clean room). Do not edit any repo file except your own output file named in
your task. Read the documents, never the conversation that wrote them.

**What happened:** on 2026-10-03 Jake merged the plan SHARD-CHECKPOINTS (now `project/archive/2026-10-03-shard-checkpoints.md`;
its skill `.claude/skills/shard-checkpoints/SKILL.md` is now a pointer) into `docs/plans/WORLDCLAW-SHARD.md`, by a grill
whose answers are D77–D88 (ask `docs/tasks/asks/E406.md`). The merge commit is `d6af748f6` (`git show d6af748f6`).

**Review surface:** the merge: WORLDCLAW-SHARD §0.2 D77–D88, §1 Goal / Done-when 6, §2 (BUILD, EXIST lines), §2b, §2c,
rows T1, P12, S1, L0–L3; `docs/design/worldclaw/06-shard-flow.md` (§5, §10.2, §11 and the lines the commit touched);
`.claude/skills/worldclaw-interactive/SKILL.md` (BUILD, X, S, the description); the pointer skill; the archived plan;
and how all of it fits `docs/plans/NINE-DRAGON-STACK.md` (the first existing shard), `docs/plans/THIN-ICE.md` and
`docs/plans/WORLDCLAW-TOOLS.md`.

**The ledger** (`ledger.md`) is frozen. **The bar** (an execution plan): a finding counts only if an executing agent
would **fail, do the wrong thing, or have to guess**. Each finding needs a **location** (file §/line), **evidence** and a
**concrete fix**. Severities: `must-fix` (wrong, or acting on it fails), `should-fix` (a gap someone would guess at),
`nit` (never blocks). No invented numbers in your fixes (AGENTS.md / E388: a number must come from a measurement, a device
or platform limit, the engine's budgets or a Jake decision).

**The battery** (`battery.md`): walk every scenario through the documents; a step without an unambiguous answer is a
finding. You may add a scenario (mark it "added by <seat>").

**Output:** your file `round-<n>-seat-<X>.md` in `docs/plans/worldclaw/reviews/merge/`: a findings table (ID-less:
the lead assigns IDs; columns: severity, location, finding, evidence, fix), then the battery table (scenario #, PASS /
FAIL, the finding it maps to), then one last line `Verdict: <clean | N must-fix, M should-fix>`. At most 120 lines.

## Round 2 (and later): the surface shrinks
From round 2 a seat reviews (a) **the diff since the last round**: `git diff 1ea79c334 HEAD -- docs/plans/WORLDCLAW-SHARD.md
docs/design/worldclaw/06-shard-flow.md .claude/skills/worldclaw-interactive/SKILL.md .claude/skills/worldclaw-auto/SKILL.md
docs/plans/WORLDCLAW-TOOLS.md docs/plans/NINE-DRAGON-STACK.md scripts/worldclaw/ src/shards/nine-dragon-stack/design/`:
did each fix in `register.md` (MC1–MC24) land as its resolution says, and did it break something nearby; and (b) **the
battery** (now 14 scenarios). A finding outside the diff counts only if it is must-fix with evidence. Don't re-raise a closed
register row without new evidence.

## Round 3: after Jake's D89 / D90
Jake cut the existing-shard path after round 2: Nine Dragon is not a WorldClaw shard (D89) and WorldClaw builds new
shards only (D90); D84–D86, §2c, the skill's §X, 06 §11 and rows L2 / L3 are withdrawn (`register.md` MC26, MC34). Review
(a) **the diff since round 2**: `git diff 21d5e913c HEAD -- docs/plans/WORLDCLAW-SHARD.md docs/design/worldclaw/06-shard-flow.md
.claude/skills/ docs/plans/WORLDCLAW-TOOLS.md docs/plans/NINE-DRAGON-STACK.md scripts/worldclaw/ test/worldclaw-formats.test.ts
project/archive/2026-10-03-shard-checkpoints.md`: did MC25–MC34 land as `register.md` says, and did the unwind leave a
dangling reference to the existing-shard path (a § that no longer exists, a mode, a row, a skill step); and (b) **the
battery's live scenarios** (2, 3, 5, 7, 8, 13 and the seats' additions that are about new shards). Same bar, same output.
