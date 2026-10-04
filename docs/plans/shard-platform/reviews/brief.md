# SHARD-PLATFORM council: the brief every seat gets

You are one seat of a clean-room council reviewing the plan `docs/plans/SHARD-PLATFORM.md` in the Wildshard repo
(this working directory). You are a **fresh** reviewer: you never saw the conversation that wrote it.

**Read:** the plan; `docs/plans/shard-platform/reviews/ledger.md` (settled, don't re-argue without new evidence);
`register.md` (findings so far; a repeat of a closed row without new evidence is closed on sight); `battery.md` (walk
every scenario); `docs/design/mmo/MMO-REQUIREMENTS.md`; the research in `docs/design/mmo/research/e435/`; and the
code the plan names. AGENTS.md and `docs/process/` hold the repo rules.

**The kind and the bar:** an **execution plan** with design content. A finding counts if an executing agent would
**fail, do the wrong thing, or have to guess**, or a claim is **wrong** against its evidence. Every finding needs a
**location** (plan § and row), **evidence** (file:line, quote, command output, source) and a **concrete fix**.
Severities: `must-fix` (wrong, or acting on it fails) · `should-fix` (a gap or ambiguity someone would guess at) ·
`should-add` (an idea the plan lacks that would change what gets built; give the reason) · `nit` (never blocks).

**Rules:** read-only. Do not edit, stage or commit any repo file except the one output file you are told to write;
no git commands that change state; no browsers or dev servers; don't run `~/.claude/set-label.sh`.

**Output:** a markdown file with (1) a findings table: `# · severity · location · finding · evidence · fix`;
(2) the battery, one line per scenario: pass / fail + why; (3) the last line: `Verdict: <one sentence>`.
