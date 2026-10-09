# Asks, leftovers, handoffs and claims

Jake's rules from the E423 audit (2026-10-03; the decisions are numbered in
[docs/tasks/asks/E423.md](../tasks/asks/E423.md)). The audit found 133 open asks, 86 of them finished, dead or
duplicated, because the old process filed every leftover as an ask and nothing ever expired.
`scripts/asks.mjs` enforces the rules: in `.githooks/pre-commit`, in `.githooks/commit-msg` and in the session brief.

## An ask is a receipt; plans are the queue

- **An ask file records a request for work from Jake**: a change or a deliverable. Create it with
  `scripts/ask-new.sh "<Jake's words>"` before you start. A question answered in chat gets no file. Steering inside a
  running job is appended to that job's ask.
- **It closes when the reply or the work lands.** Follow-up work is a **row in a live plan** (`docs/plans/`), never
  another ask. There is one queue, and it is the plans.
- **Done means on `origin/main` with the local gates green** (no CI or deploy wait, E428). Add the live build id when the hourly deploy ships it; nobody waits
  for it. Docs-only work is done on push.

## Status vocabulary (line 3 of the file)

| Status | Meaning |
|---|---|
| `open (YYYY-MM-DD)` | received, not started |
| `in flight (YYYY-MM-DD, <owner>)` | claimed. **The lease is 71 h**: with no commit touching the file in 71 h, the brief shows `CLAIM EXPIRED` and anyone may take the work |
| `needs pick (YYYY-MM-DD)` | waits on a decision from Jake. It **never expires**: the brief shows it as `ASK JAKE`, and the next session asks it with the question tool until he answers (E423 grill) |
| `done (YYYY-MM-DD): <commit / evidence>` | landed |
| `dropped (YYYY-MM-DD): <why>` | won't happen |
| `folded into <ASK or PLAN>` | another ask or plan carries it. The target must exist |
| `superseded by <ASK or PLAN>` | replaced by it |

Nothing else: no `needs you`, `parked`, `paused`, `answered` or `picked`. When you migrate an old status, keep it on a
`**Was:**` line below the new one.

## Leftovers

Something you found, deferred or didn't finish is **built in the session that found it**. If it truly can't land, it
becomes an open row of the live plan it belongs to, with an acceptance line, and you say so in chat. **Never a new
ask.** A plan can't archive while it has open rows.

- **Phone checks: none.** Don't file "Jake checks on his iPhone" items; his playtests and FEEDBACK notes are the
  check. **One exception:** a risky rendering or memory change (batching, multi-draw, texture or memory policy) needs a
  physical-device reading. It ships default-off behind a Debug row until it has one (AGENTS.md, Rendering).
- **Decisions for Jake** are asked with the question tool (AskUserQuestion: a short orientation, then each question with its background, the trade-offs and one recommendation; boards or images sent right above). Never a decision page (Jake, E423 grill). Collect them and ask at the end of a job.
- **Jake's real-world chores** (store accounts, licence registrations, a listen or a watch) are rows of the Ship
  checklist in FINISH-LINE.
- **Agent-to-agent requests** go over herdr to the owning agent, who builds them and replies with the SHA. If nobody
  owns it, or it can't land today, it becomes a row in the owning plan. Never an ask.

## Handoffs

**Superseded (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`): no per-lane handoff files; lanes report landings over herdr and the coordinator's
`docs/plans/<plan>/STATE.md` (≤ 3 KB) is the restart record.** Historical rule: one live `## Handoff (<lane>)` section per lane, overwritten in place at every commit: Done, Next, Owns, Learned,
Done when. It is deleted when the work closes; the commits are the history. Old append-only logs live in
`project/archive/handoffs/<ID>.md`. The pre-commit check refuses two sections with the same lane, and any Handoff in a
closed ask.

## Plans stay true by commit

A commit whose message names a live plan (`docs/plans/<NAME>.md`) also touches that plan: tick the row, or rewrite the
State line. When the plan really is unchanged, add the trailer `Plan-State: unchanged`. The brief flags a plan whose
State date is older than its newest commit naming it.

## Plans and their State line

- A plan is a `docs/plans/<NAME>.md` with a row table. Line 3 is its **State** line:
  `**State:** \`<state>\` <YYYY-MM-DD> — <one line: what landed, what is open, who or what it waits on>`. Rewrite it
  (don't append) whenever the state or the open work changes.
- States:
  - `draft`: written, waiting on Jake's go. Nothing is built from a draft.
  - `in progress`: being built. The line names the open rows and their owners.
  - `blocked`: nothing to build until something named arrives.
  - `finished`: every row is built and ticked, and **no row is open**. A leftover is built, or stays an open row and
    the plan stays live. Never file a plan's tail as asks.
  - `archived`: a finished plan, moved **in the same commit it finishes** to `project/archive/<YYYY-MM-DD>-<name>.md`,
    State `archived <today> (finished <date>)`. `docs/plans/` only holds live plans.
  - `dropped`: Jake dropped it. State line with his words, then archived like a finished one.
- Moving a plan: fix the links to it in docs and code comments.
- A council's round files are archived with its result the day the council ends ([COUNCIL.md](COUNCIL.md)).
- **Reviews** (pages for Jake to read) are registered in `docs/reviews/<slug>.md` and stay until Jake says he read them
  ([docs/reviews/README.md](../reviews/README.md)). The plan links its open reviews under its State line.
