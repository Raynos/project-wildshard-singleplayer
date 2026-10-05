# SHARD-PLATFORM council 4 (E447): the brief every seat gets

You are one seat of a clean-room council reviewing the plan `docs/plans/SHARD-PLATFORM.md` in the Wildshard repo (this
working directory). You are a **fresh** reviewer: you never saw the conversations that wrote it. Councils 1–3 have
already reviewed it (registers: `docs/plans/shard-platform/reviews/register.md`, `council-2/register.md`, `council-3/register.md`).
Since council 3 closed, Jake decided G163–G182 (E449 / E450 mockup and board picks), including **G171: the grid never
reloads the page** (SF57b dropped; a memory failure becomes a content-cut board), G164 / G170 / G172 (Driftwood's whole
world 0.8 m lower with road decks over the water), G175 (the frame owner on), G176 (Sky Reach's entries rethought), G180
(Pine's memory cuts). Council 4 checks the plan an unattended
agent executes now.

**Read:** the plan (State, §0–§9, every row in §4, §10 G1–G182, the Handoff); `council-4/ledger.md` (settled);
`council-4/register.md` (findings so far); `council-4/battery.md` (25 scenarios; walk them); the two pages the ledger
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
fix` with IDs `C4-R<round>-<seat><n>`; (2) the battery, one line per scenario (pass / fail + why); (3) the last line:
`Verdict: <one sentence>`.
