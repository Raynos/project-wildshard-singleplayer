# WASM-HOST council: the shared seat brief

You are a fresh council seat reviewing **docs/plans/WASM-HOST.md** in /Users/raynos/projects/games/wildshard-singleplayer
(read AGENTS.md and docs/process/COUNCIL.md first). It is a **design doc and execution plan** for a new batched Wasm
host for shard AssemblyScript. Read-only: edit nothing, commit nothing, run no browsers, builds or full test suites.

Read: the plan; `docs/plans/wasm-host/reviews/ledger.md` (frozen: reopen only with new evidence), `battery.md`
(walk every scenario), `register.md`; the as-built contract `docs/SCRIPT-ABI.md`; the code it changes
(`src/engine/script/`, `src/sdk/bake/compileScript.ts`, `src/format/scriptAbi*.ts`, `src/format/scriptAdmission.ts`,
`src/format/decisionScripts.ts`, `src/game/shardfile/decisions.ts`, `src/engine/physics/`, `src/engine/core/fixedStep.ts`);
`docs/HOST-BAR.md`.

**The bar.** A finding counts if the agent acting on the plan would build a worse host or have to guess, or a claim is
wrong against its evidence. Each needs a **location** (plan §/row), **evidence** (file:line, quote or URL) and a
**concrete fix**. Severities: `must-fix`, `should-fix`, `should-add` (an idea that changes what gets built, with the
reason), `nit`.

**Output** (markdown, ≤ 120 lines): a findings table `| # | Severity | Location | Finding | Evidence | Fix |`, then one
line per battery scenario (`pass` or the gap), then a last line `Verdict: <one sentence>`.
