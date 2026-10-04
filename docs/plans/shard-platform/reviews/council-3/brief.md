# SHARD-PLATFORM council 3 (E447): the brief every seat gets

You are one seat of a clean-room council reviewing the plan `docs/plans/SHARD-PLATFORM.md` in the Wildshard repo (this
working directory). You are a **fresh** reviewer: you never saw the conversations that wrote it. Councils 1 and 2 have
already reviewed it (their registers are in `docs/plans/shard-platform/reviews/register.md` and `council-2/register.md`).
Since council 2 closed, Jake added G150–G154 and rows SF55 (Template 2, the Blender shard), SF56 (Template 1's dev-map
look), SF57 (the memory soak test with a fade-reload fallback) and SF58 (untrusted-shardfile hardening), and the plan's
glossary ("The words") was rewritten to match the Shardfiles Explained page. Council 3 checks the plan an unattended
agent executes now.

**Read:** the plan (State, §0–§9, every row in §4, §10 G1–G154, the Handoff); `council-3/ledger.md` (settled);
`council-3/register.md` (findings so far); `council-3/battery.md` (21 scenarios; walk them); the two pages the ledger
names; `docs/plans/shard-platform/kit-commons-audit.md`; the code the plan names; `git log --oneline -60`. AGENTS.md and
`docs/process/` hold the repo rules.

**The bar:** an **execution plan** with design content. A finding counts if an executing agent would **fail, do the
wrong thing, or have to guess**, or a claim is **wrong** against its evidence. Each needs a **location** (plan § and row),
**evidence** (file:line, quote, command output) and a **concrete fix** (the exact text). Severities: `must-fix` ·
`should-fix` · `should-add` (with the reason it changes what gets built) · `nit`. Mark any finding only Jake can decide,
with one recommendation.

**Rules:** read-only. Do not edit, stage or commit any repo file except the one output file you are told to write; no git
commands that change state; no browsers, dev servers or simulators; don't run `~/.claude/set-label.sh`. ~60 minutes.

**Output:** the markdown file you are told to write: (1) a findings table `# · severity · location · finding · evidence ·
fix` with IDs `C3-R<round>-<seat><n>`; (2) the battery, one line per scenario (pass / fail + why); (3) the last line:
`Verdict: <one sentence>`.
