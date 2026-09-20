---
name: prepare-to-exit
description: Checkpoint the session and prepare to exit — commit your own paths through a private index, run the four gates on the exported tree, push (which deploys), confirm the CI run went live, flip the ledgers, queue every leftover, close your browser sessions, report, then print the BYE / OOPS banner. User-invoked only.
disable-model-invocation: true
---

# Prepare to exit

Ported from `trials-gauntlet-demo` on 2026-09-19, re-cut on 2026-09-20 for continuous deployment (AGENTS.md is
canon). Execute in order; don't paraphrase or shortcut.

## What is different here

- **A push IS a deploy.** `.github/workflows/deploy.yml` runs on every push to `main`: typecheck → oxlint → css
  check → vite build, and if all four are green it ships to production (`https://wildshard-singleplayer.vercel.app`,
  ~1 min push-to-live). There is no separate deploy step to run and nobody "owns" deploys — but it means every
  commit you push is a release, so **HEAD must pass all four gates before you push**, and a red CI run on your
  push is your red. Never `vercel deploy` by hand unless CI itself is broken; `gh workflow run deploy` re-ships HEAD.
- **The gates are strict and there is no cheating them.** `tsconfig.json` has every strictness flag TS 7 has;
  `.oxlintrc.json` is type-aware with all seven categories at error and warnings denied. `any`, non-null `!`,
  `@ts-ignore` / `@ts-expect-error`, `as unknown as`, blanket `oxlint-disable` and tsconfig `exclude`s are not fixes
  — narrow the type. A per-line `oxlint-disable-next-line rule -- reason` is allowed only where the rule is
  genuinely wrong at that spot (nine exist; each has a reason).
- **One checkout, one git index, many sessions.** Two or three Claude sessions (herdr panes) plus their subagents
  edit this tree at once on `main`, no worktrees. The shared index is routinely stale or holds other people's
  blobs; on 2026-09-20 it was a whole older tree (49 phantom staged deletions). A plain `git commit` here has swept
  stale blobs into HEAD **four times** in one night (Audio.ts, main.ts, Minimap.ts, Weapons.ts). So: **no
  `git commit` at all** — every commit goes through a private index (step 1).
- **What ships is a clean export of HEAD** (CI checks out the commit), never the working tree — so *HEAD* is what
  has to be green, and the other sessions' dirty files never ship.
- **Headless browsers pin the box.** Six open `agent-browser` sessions took the machine to load 20 and wedged the
  daemon. Close yours before the banner (step 5).
- **The checkout lives at `~/projects/games/project-wildshard-singleplayer`** (moved from `~/projects/…` on
  2026-09-20); the memory directory is keyed by that path.

## Steps

1. **Commit only your paths, through a private index pinned to a captured base.** `git status` and
   `git diff --cached --stat` first: if anything you didn't author is staged or the index shows deletions of
   files that exist, the shared index is stale — **do not fix it with `git reset` for other people**; just don't
   use it. Recipe (also in the memory note `shared-index-private-commits`):
   ```
   BASE=$(git rev-parse HEAD)                                   # capture ONCE, before read-tree
   export GIT_INDEX_FILE=<scratchpad>/idx; git read-tree $BASE
   git update-index --add --cacheinfo 100644,$(git hash-object -w <file>),<path>   # per file; 100755 for scripts
   T=$(git write-tree)
   git archive $T | tar -x -C <scratchpad>/tree && ln -s $PWD/node_modules <scratchpad>/tree/node_modules
   cd <scratchpad>/tree && PATH=$PWD/node_modules/.bin:$PATH   # the shims resolve through the symlink; never `pnpm exec` here
   tsc --noEmit && oxlint && node scripts/check-css.mjs && vite build           # the FOUR gates, on the TREE, exactly as CI runs them
   C=$(git commit-tree $T -p $BASE -m "<subject>"); git update-ref refs/heads/main $C $BASE   # refuses if HEAD moved → redo
   unset GIT_INDEX_FILE
   ```
   For a shared file (`src/main.ts`, `docs/tasks/ASKS.md`, `src/audio/Audio.ts`, `src/game/Inventory.ts`,
   `TouchControls.ts` …) apply only your hunks to `git show $BASE:<path>`, never the worktree copy (it carries
   others' WIP) — `git diff -- <path>` → keep your hunks → `git apply --cached` against the private index. Subject
   states the finding; end with the Co-Authored-By / Claude-Session lines. Say plainly what is red and whose it
   is — another agent's uncommitted WIP in the worktree is not your red, but a red *HEAD* is everyone's, and it
   blocks every deploy until fixed.
2. **Push after every commit — and watch it ship.** `git push origin main`; on rejection `git fetch && git merge
   origin/main` (never rebase, never stash), re-run the gates on the merged tree, push again. Then:
   ```
   gh run list --limit 1                       # the run for your SHA
   gh run watch <id> --exit-status             # ~1 min; red = your fix, now
   curl -s https://wildshard-singleplayer.vercel.app/version.json   # "build":"<short sha>-…" must be your HEAD
   ```
   Also verify nobody's files regressed in the commits between your `BASE` and HEAD (`git rev-parse HEAD:<path>`
   for the files the last few commits touched) — the read-tree/commit-tree race silently reverts a sibling's
   commit if HEAD moved in between. An unpushed commit at exit is an OOPS; so is a pushed commit whose CI run
   is red or still unknown.
3. **Sync the worktree copies of your files to HEAD** (`git show HEAD:<path> > <path>`) for the files you committed
   as blobs — a private-index commit never writes the working tree, so the dev server on :5173 keeps serving the
   old code (this is how a trailer capture ran against a stale `main.ts` for an hour). Only for files whose worktree
   copy is an older version of *yours*; never overwrite a copy that carries someone else's hunks.
4. **Ledgers.** Every ask you took this session is a row in `docs/tasks/ASKS.md` (the user's words, shortened) and
   its status is true: **done** with the commit SHA and the live build id from `version.json`, **in flight** with
   the owner, **needs pick** with what the user must choose, or **dropped** with the user's words. A plan you moved
   in `docs/plans/*.md` has its rows ticked. Since every push deploys, a done row without a build id means the
   push didn't happen or CI is red — go back to step 2.
5. **Close every browser session you opened.** `agent-browser session list` must show none of yours
   (`agent-browser --session <s> close`); Playwright scripts must have `browser.close()`d. An open session renders
   the game at 60 fps forever and pins the box for everyone.
6. **Leftover-work sweep — a QUEUE, not a record.** Anything this session ruled, found, deferred or decided but did
   not build must have a home an agent or the human starts from: an **open row in `docs/tasks/ASKS.md`** (the
   session-brief hook prints open rows at every session start — that is the only queue anyone reads), or a **row in a
   `docs/plans/*.md` checkpoint table**. A commit body, a subagent report, a memory note or a chat message is a
   RECORD, not a QUEUE. This is the step most likely to be skipped because everything *looks* clean; it is a banner
   precondition below.
7. **Subagents and sibling sessions.** Don't kill running subagents to exit — a checkpoint resumes committed state;
   live work notifies when done. List every agent still alive with what it holds and which files it owns. If a
   subagent of yours has uncommitted edits in the tree, either land them through step 1 or queue exactly what is
   half-done (step 6) — an agent's WIP that nobody else will finish is an OOPS. `TaskStop` only orphaned polling
   loops or if the user asks.
8. **Memory.** If this session learned something the next one must know that the repo does not record (a tool
   gotcha, a user rule, a decision's why), write it to the memory directory and index it in `MEMORY.md`.
9. **Report**, then the banner. The report names: commits (SHAs + one line each), the CI run id and result for the
   last push, the live build id and whether it equals HEAD, the four gates on the exported tree and their results,
   what is left local (yours vs others' WIP), every live agent, every open ask this session touched, browser
   sessions closed — so the user knows whether it is safe to close.

Guardrails: never `rm -rf` / `find -delete` (`dcg` blocks it anyway — write scripts with the Write tool and move
things aside instead). Never `git push --force`, never rewrite history, never `git stash` / `checkout` / `restore` /
`reset` files you didn't author — other sessions' dirty files are theirs. Never `vercel deploy` from the working
tree; never hand-deploy at all while CI is healthy. Don't `AskUserQuestion` on the way out — the banner is the
question's answer.

## Last step — the sign-off banner (MANDATORY, ALWAYS)

The **final thing in your final message**, after the report, is **one** of the two banners below — printed
**verbatim, inside a fenced code block**, as the last lines you emit. Nothing follows it: no sign-off prose,
no "let me know if…", no further tool calls.

**A banner ALWAYS prints. There is no path through this skill that ends without one.** Its job is to answer
*"did this session run prepare-to-exit?"* from across the room — the human reads the answer off the
**silhouette alone**. A silent failure looks exactly like a session that never ran the skill, which is the one
outcome that breaks the signal: a failed checkpoint doesn't *suppress* the banner, it **switches** it.

The two banners answer **one** question — not "did the git commands succeed" but:

> **Is it safe to KILL this pane right now?**

- **BYE — safe to close.** Your work is committed on `main` and pushed, **the CI run for your last push is green
  and `version.json` serves your HEAD**, your browser sessions are closed, the session is at a coherent stopping
  point, **and the leftover-work sweep is done — every ruling, finding and deferral this session produced has a
  row in `docs/tasks/ASKS.md` or a `docs/plans/` table**. A BYE is a claim that nothing here will be lost.
- **OOPS — do NOT close.** Any of these, and they weigh the same:
  1. **Something is wrong.** A gate is red on HEAD, the CI run for your push failed or you didn't wait for it, a
     push is refused, a sibling's commit got reverted by yours, a stranded commit with no queued reason — or you
     simply **don't know** whether it's sound. Uncertainty is an OOPS: the banner is a safety signal, so it fails
     *loud*, not *optimistic*.
  2. **Leftover work has no queue.** Something this session ruled, found or deferred lives only in a commit body,
     a subagent report, a memory note or a chat message. Queue it (it is five minutes) and *then* BYE; if you
     cannot, OOPS and name it.
  3. **The session is half-built.** Run too early — mid-implementation, an agent mid-round with uncommitted edits
     that nobody else will finish, a feature wired but unreachable, a browser session still rendering. **A clean
     `git status` does NOT mean done — here it rarely is clean anyway.** Ask it straight: *if this pane were killed
     right now, would anything be left half-implemented?* If yes → **OOPS**, and the report names exactly what's
     half-done and where to resume.

Never print BYE over either case — a BYE on a half-finished session is a false green, and it is the *report*, not
the banner, that carries the detail.

Both are **fixed, byte-stable signals**, not decoration — they only work if they are **always the same**. Copy
them character-for-character: don't retype from memory, don't restyle, don't personalize, don't append a run
summary inside the box, don't swap the block letters. The two are deliberately distinguishable when blurred or
squished: BYE is light-bordered and 4 glyphs, OOPS is heavy double-bordered and squarer.

**BYE — checkpoint clean:**

```
   ┌──────────────────────────────────────────────────────────────┐
   │  ██████╗ ██╗   ██╗███████╗██╗                                │
   │  ██╔══██╗╚██╗ ██╔╝██╔════╝██║  prepare-to-exit is complete.  │
   │  ██████╔╝ ╚████╔╝ █████╗  ██║  committed - verified - pushed │
   │  ██╔══██╗  ╚██╔╝  ██╔══╝  ╚═╝                                │
   │  ██████╔╝   ██║   ███████╗██╗  you may close this session.   │
   │  ╚═════╝    ╚═╝   ╚══════╝╚═╝                                │
   └──────────────────────────────────────────────────────────────┘
```

**OOPS — prepare-to-exit ran, but this session is NOT safe to close:**

```
   ╔═════════════════════════════════════════════════════════════════════╗
   ║   ██████╗  ██████╗ ██████╗ ███████╗                                 ║
   ║  ██╔═══██╗██╔═══██╗██╔══██╗██╔════╝  prepare-to-exit ran, but       ║
   ║  ██║   ██║██║   ██║██████╔╝███████╗  this session is NOT done.      ║
   ║  ██║   ██║██║   ██║██╔═══╝ ╚════██║                                 ║
   ║  ╚██████╔╝╚██████╔╝██║     ███████║  something is red or half-done  ║
   ║   ╚═════╝  ╚═════╝ ╚═╝     ╚══════╝  read the report; DON'T close.  ║
   ╚═════════════════════════════════════════════════════════════════════╝
```
