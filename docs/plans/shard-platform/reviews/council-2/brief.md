# SHARD-PLATFORM council 2 (E441): the brief every seat gets

You are one seat of a clean-room council reviewing the plan `docs/plans/SHARD-PLATFORM.md` in the Wildshard repo (this
working directory). You are a **fresh** reviewer: you never saw the conversations that wrote it. Council 1 (four rounds,
`docs/plans/shard-platform/reviews/round-*`) ended on 2026-10-04; since then Jake steered the plan hard (§10 G62–G132:
mockup picks for the grid's look and UI, and his review of 34 agent-made decisions) and the plan was rewritten around
those picks. Council 2 checks that the plan an agent executes for the next 24–48 h unattended is right.

**Read:** the plan (State, §0–§9, every row in §4, §10 G1–G132, the Handoff); `council-2/ledger.md` (settled: don't
re-argue without new evidence); `council-2/register.md` (findings so far; a repeat of a closed row without new evidence
is closed on sight); `council-2/battery.md` (walk every scenario); `docs/reviews/shard-platform-mockups.md` and the
`art/` rounds it names (the picked looks); the code the plan names (`src/game/grid/`, `src/game/shardfile/`,
`src/sdk/`, `scripts/shard-platform.mjs` …); `git log --oneline -60`. AGENTS.md and `docs/process/` hold the repo rules.

**The kind and the bar:** an **execution plan** with design content. A finding counts if an executing agent would
**fail, do the wrong thing, or have to guess**, or a claim is **wrong** against its evidence (the code, a commit, a
measurement). Every finding needs a **location** (plan § and row), **evidence** (file:line, quote, command output) and a
**concrete fix** (the exact text to change). Severities: `must-fix` (wrong, or acting on it fails) · `should-fix` (a gap
or ambiguity someone would guess at) · `should-add` (an idea the plan lacks that would change what gets built; give the
reason) · `nit` (never blocks).

**Rules:** read-only. Do not edit, stage or commit any repo file except the one output file you are told to write; no
git commands that change state; no browsers, dev servers or simulators; don't run `~/.claude/set-label.sh`. Keep it to
~60 minutes.

**Output:** the markdown file you are told to write, with (1) a findings table:
`# · severity · location · finding · evidence · fix`; (2) the battery, one line per scenario: pass / fail + why;
(3) the last line: `Verdict: <one sentence>`.
