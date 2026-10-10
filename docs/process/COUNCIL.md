# Council rounds

> **State:** process, written 2026-10-01 (E361). It generalises the council that GAME-NORMALIZATION ran
> ([12-process §1](../../project/archive/game-normalization/12-process.md); decisions 81–83, 92–93, 97, 100 in ask E357), so that any
> plan or design doc can be put through it. Its first use outside
> normalization was [GW2-ZONES](../plans/GW2-ZONES.md) (moved into `docs/plans/` by
> E430); its round files are archived in
> [`project/archive/2026-10-01-gw2-zones-council/`](../../project/archive/2026-10-01-gw2-zones-council/).

## What "let's do some council rounds on this doc" means

A **council** is a fixed number of review **rounds** run on one document by independent AI reviewers.
- **Seats:** each round has **three seats**. At least one is Codex and at least one is Claude.
- **Clean room:** every seat is a **fresh** agent. It reads the document and the repos, never the conversation that
  wrote the document.
- **The lead:** the agent that owns the document. It verifies each finding against the evidence, then fixes or
  rejects it.
- **Converging:** the rounds are built to converge, not circle:
  - a frozen ledger;
  - one bar for what counts as a finding;
  - one register of findings across rounds;
  - a surface that shrinks each round;
  - a scenario battery that only grows.

Jake asks for it by name: "do 3 council rounds on X". He sets the number of rounds, and without a number it is 4.

**Four rounds at most, always.** This is the most important rule (Jake, 2026-10-01).
- Never loop "until two rounds in a row come back clean". An unbounded loop just burns agents and tokens.
- Two clean rounds in a row may **end** a council early. They never extend it past 4.
- After the last round, whatever is still open goes to Jake as decisions, one recommended answer each, and the doc is
  done.
- A 5th pass needs Jake to ask for it. The only standing exception is GAME-NORMALIZATION's single **check pass**
  (decision 100), and it checks only that the round-4 fixes landed: no new findings outside them.

## The protocol

1. **A frozen ledger.**
   - It lists what is settled: Jake's decisions and statements about this topic, quoted with the date, plus anything
     the doc treats as a given.
   - A seat may reopen a ledger item only with **new evidence** (a file and line, a quote, a source) that it is wrong.
     Preference is not evidence.
   - A finding that re-argues the ledger without evidence is closed as `settled`.
2. **One bar.** A finding needs a **location** (doc §), **evidence** and a **concrete fix**. The bar depends on the
   kind of document:

   | Kind | A finding counts if… |
   |---|---|
   | Execution plan | an executing agent would **fail, do the wrong thing, or have to guess** |
   | Design doc | the person or agent acting on it (a shard director, an author, Jake) would **make a worse game, or have to guess**; or a claim is **wrong** against its evidence |

   - Severities: `must-fix` (wrong, or acting on it fails), `should-fix` (a gap or ambiguity someone would guess at),
     `nit` (wording or taste; never blocks).
   - **Design docs add one more severity**, `should-add`: an idea or angle the doc lacks that would change what gets
     built. It counts only with a reason it changes the outcome. The lead takes the best and parks the rest in the
     register.
3. **One register** (`council/register.md`).
   - Every finding gets a **stable ID** and a status:
     - `fixed` + commit;
     - `rejected` + reason;
     - `settled`;
     - `parked` (a should-add not taken);
     - `escalated` (sent to Jake as a decision).
   - Seats get the register and the ledger, never the conversation.
   - A repeat of a closed row without new evidence is closed on sight.
4. **The surface shrinks.**
   - Round 1 reviews everything.
   - From round 2, a seat reviews:
     - (a) **the diff since the last round**: did each fix land, and did it break something nearby;
     - (b) **the battery**.
   - A finding outside the diff counts only if it is must-fix with evidence.
5. **A battery that only grows** (`council/battery.md`).
   - Concrete scenarios the doc must answer. Examples: "design shard 5 with this doc"; "a returning player on day 30";
     "an outside author uploads a shard".
   - A seat walks each one through the doc. A step the doc doesn't answer is a finding.
   - A seat may add a scenario; it stays forever.
6. **Minimal fixes.** Each edit cites a register ID and touches only what the finding names. No section rewrites unless
   a finding demands one.
7. **Convergence or stop.**
   - **Hard cap: 4 rounds** (or fewer if Jake names fewer), with no exceptions the lead can grant itself.
   - Accepted must-fix plus should-fix should **fall each round**. If they don't, or closed rows keep coming back, the
     loop stops early and the open rows go to Jake as decisions, one recommended answer each.
   - Two clean rounds in a row also stop it early.
   - What only Jake can decide goes to him through one question, not through the doc.

## The seats

| Seat | Engine | Default lens |
|---|---|---|
| **A** | Codex CLI, `codex exec` (the model and effort in `~/.codex/config.toml`; GPT 6.1 Sol, reasoning high, at the time of writing) | The battery, walked step by step, plus the doc's central argument |
| **B** | Claude subagent | Evidence and coverage: every claim, number and path checked against its source; contradictions with the other docs |
| **C** | Claude subagent | Red team: what is wrong with the framing itself, what a strong practitioner in the field would do instead, what makes someone guess |

The lead may re-aim a lens per document. On GW2-ZONES, seat A is an open-world game director and seat C argues
against the GW2 frame. The lens is written into the seat's brief.

## Files

Where the council's files live:
- **A singleplayer plan** `docs/plans/<NAME>.md`: in `docs/plans/<name>/reviews/`, as GAME-NORMALIZATION's did
  (`project/archive/game-normalization/reviews/`).
- **A design doc** in `docs/design/<topic>/`: in a `council/` folder next to it while the council runs; the day it
  ends, the round files move to `project/archive/<date>-<topic>-council/`.

The files:
- `ledger.md`: what is frozen.
- `battery.md`: the scenarios.
- `register.md`: every finding, with ID, round, seat, severity, location, one line, status and resolution.
- `brief.md`: the shared brief every seat gets.
- `round-<n>-seat-<A|B|C>.md`: each seat's findings table and battery results; the last line is a verdict.

After each round the lead:
1. merges the findings into the register;
2. fixes or rejects each one, in one commit per round;
3. sends Jake one status line.

## Why it works

- **Different engines and fresh agents find different holes.**
  - In GAME-NORMALIZATION's four rounds the accepted findings went ~71 → ~40 → ~17 → ~18, then a check pass.
  - In GW2-ZONES's three rounds, accepted must-fix went 9 → 7 → 3 and should-fix 24 → 14 → 9.
  - Round 2 caught round 1 swinging too far: it had swapped each shard's own pitch for a borrowed genre.
  - Round 3 caught round 2's overcorrection of Jake's review load.
- **The ledger and the register stop the loop re-arguing settled choices.**
- **The battery turns "is this good?" into scenarios** that pass or fail.
