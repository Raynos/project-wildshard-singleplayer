# wildshard-v handoff, 2026-11-22

> Written by: Claude (wildshard-v, the singleplayer plan agent), 2026-11-22 20:40 Cancún.

This is the handoff from the plan agent that ran this repo's status check-ins from late October until 2026-11-09.
It tells the next session what this agent was doing, why it stopped, where the work lives now and what is left over.
It does not repeat the plans; it points at them.

## What this session was

- **Role:** Jake's plan agent for `~/projects/games/wildshard-singleplayer` (herdr name `wildshard-v`). It made
  pick boards, asked Jake's picks, relayed the builder's progress and ran an hourly "ACTIVE-PLANS" check-in from a
  cron. It built nothing itself after 11-04; the builder (`wildshard-new`) and its lanes did.
- **The check-ins stopped on 2026-11-09.** Jake: "stop everything, stop the checkins, stop the hourly stuff, stop the
  goal", then "we will come back to the plan next week, ill let you know whats and when is next". The cron is
  deleted; no job, lane, browser or subagent of this session is running.
- **Why they stopped:** from 11-05 the check-ins read this repo's plan files (DOWNLOAD, custom sections, open plots,
  tooling perf, dead code), which froze when the code moved to the new repos. They showed zeros for days while
  other agents landed a lot elsewhere. Lesson (also in this agent's memory): before any status report, find where
  commits are landing now and report from there.
- **Jake has not said what is next.** Do not restart check-ins, crons or lanes on your own.

## Where the work lives now

Singleplayer is no longer where Wildshard is built.

- **J189 (11-07)** made this repo a thin deploy shell for about 48 h, then retirement. `src/` holds only shard
  READMEs, art and a handful of `.ts` files. The last non-disk commit is `8c56c4616b` (11-15, points WASM-HOST and
  HOST-AUDIT to meta).
- **The old origin is retired.** The Vercel project behind `wildshard-singleplayer.vercel.app` was deleted on
  11-13; `b43594f01e` added `deploy/retired-origin/`, a kill-switch service worker that sends old installs to
  `play.wildshard.io`.
- **Jake steers from the meta repo**, `~/projects/games/project-wildshard-meta`:
  - the plans: `docs/plans/` and `docs/plans/MULTI-REPO-SAGA/` (MULTI-REPO, SHARD, MEMORY and MMO sagas);
  - the saga status: `docs/plans/MULTI-REPO-SAGA/STATE.md` (the old `docs/plans/multi-repo/STATE.md` is a moved
    stub);
  - the decisions: `docs/plans/MULTI-REPO-SAGA/decisions/` (J001–J489 on 11-22). `node scripts/decisions.mjs`
    prints the last 10; `--number <n>` finds one;
  - what Jake has to read or do: `docs/plans/MULTI-REPO-SAGA/JAKE-READ-LIST.md`;
  - this repo's retirement plan: `docs/plans/MULTI-REPO-SAGA/SINGLEPLAYER-LEFTOVERS-PLAN.md` (ready for review
    since 11-08, waiting on Jake's approval, J242).
- **The code** is in the org repos (engine, sharddev, the shard repos, shard-format and others). Jake's list:
  `project-wildshard-meta/REPOS.md`.
- `docs/plans/` in this repo is history. Its State lines were true when the code moved and have not been kept up
  since; never report progress from them.

## What is still going on in this repo

- **Disk-audit commits.** Another session appends readings to `project/disk-audit-2026-10-15.md` (`docs(disk): …`,
  twice a day). Nine of them (`ceafe55504`, 11-17, to `cca54d3cf7`, 11-22) are local on `main` and not on
  `origin/main`, which stops at `8c56c4616b`. They are not this session's; ask Jake before pushing them.
- **The scheduled `release-train` workflow has failed every run since 2026-11-12** (32 of 32 in the last listing;
  latest run 45063226304). Its `select` step parses an HTML page as JSON:
  `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`. It most likely fetches from the retired
  origin, which now returns the "Wildshard has moved" page. Nobody is shipping from this repo any more, so the fix
  is probably to turn the schedule off as part of SINGLEPLAYER-LEFTOVERS; that is Jake's call (J242). Not fixed.

## Standing rules from Jake that still apply

These live in `AGENTS.md`, `docs/process/` and the J ledger; they are listed here because this agent was told
them directly:

- Fix forward, never roll back a deploy or land a revert (J179, G674).
- Don't swap the 9 shards in the centre 3×3.
- Never herdr-prompt a pane that has a question open for Jake.
- Kill only your own processes, by PID.
- Commit with `scripts/commit.sh "msg" -- <files>` and an `Assisted-by:` trailer; no `Co-Authored-By:` for AI.
- Times for Jake are Cancún time (UTC−5).

## If Jake brings the plan agent back

1. Ask nothing up front. Read `MULTI-REPO-SAGA/STATE.md`, the last 10 decisions and `JAKE-READ-LIST.md` in the
   meta repo.
2. Find where commits are landing (`git log --since=…` in meta and each org repo Jake names) before saying what
   moved.
3. Wait for Jake to say what the plan agent is for this time. He said he would.

## Suggested skills

- `plan-overview`: only after re-pointing it at the meta repo's plans; its defaults read this repo's frozen
  `docs/plans/`.
- `herdr`: to see which agents and lanes are live before messaging any of them.
- `writing-for-agents`: for any brief or plan row you write.
- `prepare-to-exit`: at the end of the session.
