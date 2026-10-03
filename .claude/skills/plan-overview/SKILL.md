---
name: plan-overview
description: Be Jake's plan and review desk. Show every live plan (docs/plans/) and every open review page (docs/reviews/) with their true state, check each State line against git, the asks and the archive, fix stale ones, archive what is finished or what Jake says to archive, register new review pages, rank what to build next, and say what the other agents are on. Use for "/plan-overview", "plan status", "plan overview", "what's ready to archive", "anything almost done", "archive X", "what are the agents working on", "I read X".
---

# Plan and review overview (E411)

You are the desk between Jake and the ~10 agents building Wildshard. He steers by **plans** and decides through
**reviews**: the pages agents make for him to read before a plan is finalised. Your job: tell him the truth about both,
briefly, and keep the paperwork true so the session brief is right for everyone.

Read first: [docs/process/ASKS.md](../../../docs/process/ASKS.md) (asks are receipts, plans are the queue, the plan
States, leftovers as plan rows), [docs/process/GIT.md](../../../docs/process/GIT.md) (pathspec commits,
`scripts/push-main.sh`), and [docs/reviews/README.md](../../../docs/reviews/README.md). `node scripts/asks.mjs brief`
prints the unanswered asks, the expired claims and picks, and any State line older than its newest commit.

## 1. Gather (always from `origin/main`, not the shared working tree)

```bash
git fetch -q origin main
for f in $(git ls-tree --name-only origin/main docs/plans/ | grep '\.md$'); do
  echo "== $(basename $f .md) (last $(git log -1 --format='%cs %h' origin/main -- $f))"
  git show origin/main:$f | sed -n 3p | cut -c1-400      # line 3 is the State line
done
git ls-tree --name-only origin/main project/archive/ | tail -15   # what got archived lately
bash .claude/hooks/session-brief.sh | sed -n '/-- reviews for Jake/,/^$/p'   # open reviews
```

Subfolders of `docs/plans/` (`worldclaw/`, `thin-ice/`, …); a finished council's round files go to `project/archive/` the day it ends are plan support material, not plans.

## 2. Verify before you report: State lines go stale

Agents finish work and forget the State line. For each plan, compare the line with the evidence:
- the asks it names: `grep -m1 '^\*\*Status' docs/tasks/asks/<ID>.md`;
- commits since its date: `git log --oneline --since=<date> origin/main --grep=<plan or ask id>`;
- what it says it waits on. Is that thing done or archived? (E404: nine plans still said "blocked on the E357 lock"
  after GAME-NORMALIZATION was archived and the lock lifted.)
- a council score or a bar quoted in it (E399: the bar moved from 8.0 to 7.0, so "8/10" went stale).

A line that is demonstrably wrong: rewrite it (don't append), one true line, today's date, citing the evidence.
Keep line 3 a single line and line 4 blank (or the `**Reviews:**` line). A plan a live session owns: fix only a
line that is provably wrong, never archive it under them. Before editing any file, `git diff -- <file>`: if it has
another agent's uncommitted hunk, leave it and say so.

For a wide audit (more than ~8 plans), split them across two subagents with disjoint plan lists, each told the rules
above, "paperwork only, build nothing", and to report a table (old → new state, evidence, what's open, who it waits on).

## 3. Report: the shape Jake wants

Lead with plans, not the backlog of picks. Group them, one or two lines each:
1. **Being worked on**: who (herdr agent / ask) and the next thing.
2. **Almost done**: the exact rows left.
3. **Unowned / free to start**.
4. **Drafts waiting on his go or picks**.
5. **Blocked on him**: name the one thing.
6. **Open reviews** under the plan they feed: `unread` / `reading`, with the link.

Then answer what he asked: "ready to archive" (only when every row is built, or he says so), "almost complete", the
top N. Progress percentages: count the plan's rows done / total (a first pass counts ~¾, in flight ~⅓) and say they are
rough. Rankings: give a recommendation with one line of why, not a survey.

His standing preferences (memories, 2026-09-28 → 10-03):
- He can't keep up with pick boards and iPhone chores. When something truly needs him, give **one recommended option
  as a yes/no** (AskUserQuestion, multiSelect for several plans). Don't mint `needs pick` asks by reflex.
- **Never** suggest dropping or parking a draft because it is old or idle. He refused that outright for
  GAME-NORMALIZATION, FINISH-LINE, ENGINE-FIT and EXPLORE-V2 (2026-09-29). Old is not unwanted. Only archive on
  "every row built" or his word.
- If he answers "None", record it and move on; don't re-ask.

## 4. Archive a plan (finished, or on his word)

1. `scripts/ask-new.sh "<his words>"` (never hide its output) unless it is part of an ask you already hold.
2. `git mv docs/plans/<NAME>.md project/archive/<YYYY-MM-DD>-<name-lowercase>.md` (today's date, `date +%F`).
3. Rewrite its State line: `` `archived` <today> (finished <today>[, on Jake's word, <ask>: "<his words>"]) — <what
   landed>.`` A plan with an open row is not finished: build the row, or leave the plan live. Never file a plan's
   tail as asks (E423). Rows Jake never picked are dropped in the State line ("Jake approved none"), not queued.
4. Fix relative links inside the moved file (`../../project/archive/x.md` → `x.md`, `../reviews/` → `../../docs/reviews/`).
5. `git grep -n "<NAME>.md" -- docs project .claude src scripts`: repoint live docs and code comments. Ask files
   keep the old path (history).
6. Commit the moved file, its old path, every edited link and the ask with one pathspec commit, then
   `scripts/push-main.sh`. A push already in flight carries yours; check `git log origin/main..main` later.

## 5. Reviews (docs/reviews/)

- New page from an agent (an artifact report, an audit, a decision page): add `docs/reviews/<slug>.md` (format in its
  README), `unread`, and a `**Reviews:**` link under the plan's State line. `Artifact list` (scope `all`) shows his
  claude.ai pages; `git grep "claude.ai/artifact"` maps them to plans and asks.
- He says he read one / made the call: Status `read <date>` + what he decided, `git mv` to
  `project/archive/reviews/<date>-<slug>.md`, drop it from the plan's Reviews line, one commit.
- He gives notes: `reading`, notes under the file; a revised page goes back to `unread` with what changed.
- Only his words make a review `read`. Old finished pages (listening rounds, logs) are history; don't register them.

## 6. What the other agents are on (herdr)

`test "$HERDR_ENV" = 1` first. Agents sit on several herdr servers; this repo's are on `wildshard`:

```bash
export HERDR_SOCKET_PATH=~/.config/herdr/sessions/wildshard/herdr.sock
herdr agent list | jq -r '.result.agents[] | [.name,.agent_status,.terminal_title_stripped,(.tokens.goal//"-")] | @tsv'
herdr agent read <name> --source visible            # a working agent; recent-unwrapped only works when idle
```

Codex runs in the ChatGPT app, outside herdr: you can't see it; its asks say "(Codex)". Report each agent in a line or
two: plan, what it's building, what it waits on. Don't prompt a working agent unless Jake asks.

Heads-ups arrive from other agents (HUD changes, AGENTS.md rule E332, "stale copy" warnings): check whether this session
touched those files (`git log --author`, your own commits); reply only on a real conflict, and tell Jake in one line.

## 7. Close the loop

Every ask you claim gets its Status flipped with the commit as evidence. Read-only answers (rankings, explanations)
need no commit. Keep the status-line label current (`~/.claude/set-label.sh "<goal>" "<tag>"`).
