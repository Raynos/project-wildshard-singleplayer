---
name: prepare-to-exit
description: Checkpoint the session and prepare to exit — pathspec-commit only your paths (private index for shared files), run the four gates on a clean export of HEAD, push through the push lock (a push deploys), confirm the CI run went live, flip your ask files and plan State lines, queue every leftover, close your browsers, report, then print the BYE / OOPS banner. User-invoked only.
disable-model-invocation: true
---

# Prepare to exit

Ported from `~/projects/game-demos/trials-gauntlet-demo` on 2026-09-19, re-cut on 2026-09-20 for continuous
deployment, and again on 2026-09-22 (E27) for the E21 multi-agent git rules. AGENTS.md is canon; where this file
and AGENTS.md disagree, AGENTS.md wins and this file is the bug. Execute in order; don't paraphrase or shortcut.

## What is different here

- **A push IS a deploy.** `.github/workflows/deploy.yml` runs on every push to `main`: typecheck → oxlint → css
  check → vite build, and if all four are green it ships to production (`https://wildshard-singleplayer.vercel.app`,
  ~1 min push-to-live). There is no separate deploy step — but every commit you push is a release, so **HEAD must
  pass all four gates on a clean export before you push**, and a red CI run on your push is your red. Never
  `vercel deploy` by hand while CI is healthy; `gh workflow run deploy` re-ships HEAD.
- **The gates are strict and there is no cheating them.** `tsconfig.json` has every strictness flag on;
  `.oxlintrc.json` is type-aware with every category at error and zero warnings. `any`, non-null `!`,
  `@ts-ignore` / `@ts-expect-error`, `as unknown as`, blanket `oxlint-disable` and tsconfig `exclude`s are not fixes
  — narrow the type. A per-line `oxlint-disable-next-line <rule> -- <reason>` only where the rule is genuinely
  wrong at that spot.
- **One checkout, one git index, one local `main`, up to ~10 agents.** Parallel Claude sessions (herdr panes) and
  their subagents all edit this tree on `main`, no worktrees. Other agents leave files **staged** in the shared
  index (28 foreign files swept into one commit on 2026-09-22), so nothing you do may snapshot that index. Hooks
  enforce it: `.claude/hooks/guard-git-add-all.sh` blocks `git add -A` / `.` / `-u`, `git add <tracked file>`,
  `git commit -a` and any `git commit` without `-- <paths>`; `.claude/hooks/guard-bash-safety.sh` blocks a bare
  `git push` and tree-wide `restore .` / `checkout .` / bare `stash` / `reset --hard` / `clean -f`; `dcg` blocks
  `rm -rf` and `>` onto computed paths.
- **The uplink is ~10–100 KB/s.** Six parallel pushes of one pack hung 15+ minutes (E19). Push only through
  `scripts/push-main.sh` (it holds `.git/push.lock`), and keep packs small: `.githooks/pre-commit` refuses a
  `progress/` image over 500 KB, and mockups under `art/<subject>/round-<n>-<label>/` are committed as JPEG.
- **What ships is a clean export of HEAD** (CI checks out the commit), never the working tree — so *HEAD* is what
  has to be green, and other agents' dirty files never ship.
- **Game browsers are a shared lane: at most 3 open machine-wide.** Each open game tab costs ~1.5 cores for as
  long as it lives; SwiftShader ~3 per page. Close yours before the banner (step 6).
- **Paths.** The checkout is `~/projects/games/wildshard-singleplayer`; its memory directory is
  `~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/memory/` (index `MEMORY.md`).

## Steps

1. **Commit only your paths.** First `git config core.hooksPath` must print `.githooks` (else the pre-commit
   image check and the post-commit ledger don't run — `git config core.hooksPath .githooks`). Then `git status`:
   list exactly which paths you (and your subagents) authored this session.
   - **Default — a pathspec commit.** An edit to a tracked file is never staged; commit it directly:
     `git commit -m "<subject>" -- path/a path/b` (git's `--only`: HEAD + those paths' working-tree copies, the
     shared index untouched). A **new** file: `git add path/new` first, then the same pathspec commit. Then
     `git show --stat HEAD` must list only your paths — if it doesn't, stop and say so; never `reset` to fix it
     while other agents may have committed on top.
   - **A shared file with someone else's hunks** (`git diff -- <path>` shows lines you didn't write — typical for
     `src/main.ts`, `src/audio/Audio.ts`, `src/player/*.ts`, `src/ui/Menu.ts`, `AGENTS.md`, a `docs/plans/*.md`):
     a pathspec commit would ship their half-done work inside yours. Either wait for them, or commit only your
     hunks through a private index pinned to a captured base:
     ```
     BASE=$(git rev-parse HEAD)                                   # capture ONCE, before read-tree
     export GIT_INDEX_FILE=<scratchpad>/idx; git read-tree $BASE
     git diff $BASE -- <path>                                     # → keep only your hunks in <scratchpad>/mine.patch
     git apply --cached <scratchpad>/mine.patch                   # applies to $BASE's blob, never the worktree copy
     git update-index --add --cacheinfo 100644,$(git hash-object -w <file>),<path>   # whole files that are all yours
     T=$(git write-tree)
     C=$(git commit-tree $T -p $BASE -m "<subject>"); git update-ref refs/heads/main $C $BASE   # refuses if HEAD moved → redo
     unset GIT_INDEX_FILE
     ```
     `commit-tree` skips `.githooks`, so check any `progress/` image you add is ≤ 500 KB yourself.
   - The subject states the finding; end every message with the Co-Authored-By / Claude-Session lines. Say plainly
     what is red and whose it is — another agent's uncommitted WIP is not your red, but a red *HEAD* is everyone's.
2. **The four gates on a clean export of HEAD — before the push.**
   ```
   D=<scratchpad>/tree-$(git rev-parse --short HEAD); mkdir -p $D   # a fresh dir per HEAD (rm -rf is blocked)
   git archive HEAD | tar -x -C $D && ln -s $PWD/node_modules $D/node_modules
   cd $D && PATH=$PWD/node_modules/.bin:$PATH     # the shims resolve through the symlink; never `pnpm exec` here
   tsc --noEmit && oxlint && node scripts/check-css.mjs && vite build
   ```
   Red on something you committed → fix it with a new pathspec commit and re-run (never `--amend`: other agents'
   commits may already sit on top of yours in the shared `main`). Red on someone else's commit → name the commit
   and its owner in the report; don't push over a red HEAD.
3. **Push through the lock — and watch it ship.** `scripts/push-main.sh`. If another push holds the lock it exits
   0 with your commits still local — the push in flight re-checks `origin/main..main` before it lets go, so it
   carries them; re-check later: `git log origin/main..main` empty = shipped. Rejected (non-fast-forward) →
   `git fetch && git merge origin/main` (never rebase, never stash), gates again on the merged HEAD, push again.
   Then:
   ```
   gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status   # ~1 min; red = your fix, now
   curl -s https://wildshard-singleplayer.vercel.app/version.json   # "build":"<short sha>-…" must be HEAD (or a later HEAD that contains yours)
   ```
   After a private-index commit, also check nobody's work regressed between your `BASE` and HEAD
   (`git show --stat` the commits in `$BASE..HEAD`, `git rev-parse HEAD:<path>` for the files they touched) — the
   read-tree / commit-tree race silently reverts a sibling's commit if HEAD moved in between. An unpushed commit at
   exit is an OOPS; so is a pushed commit whose CI run is red or still unknown.
4. **Sync the worktree after a private-index commit.** It never writes the working tree, so the dev server on :5173
   keeps serving the old code. Bring *your* files to HEAD with the Write / Edit tool (or `git show HEAD:<path>`
   into a literal path) — only where the worktree copy is an older version of *yours*; never overwrite a copy that
   carries someone else's hunks. Pathspec commits need no sync.
5. **Ledgers.** Every ask you took this session has its own file `docs/tasks/asks/<ID>.md` (claimed with
   `scripts/ask-new.sh "<the user's words>"` — never a new row in the legacy `docs/tasks/ASKS.md`), and its
   `**Status:**` line is true: `done` with the commit SHA and the live build id from `version.json`,
   `in flight (<date>, <owner>)`, `needs pick` with exactly what the user must choose, or `dropped` with the user's
   words. Ask files never move or get deleted. A plan you moved has its rows ticked and its line-3 **State** line
   rewritten (not appended) to the truth; a plan that finished is moved **in the same commit** to
   `project/archive/<YYYY-MM-DD>-<name>.md` with State `archived <today> (finished <date>)` plus where the leftovers
   went, and the links to it fixed. A `done` ask without a build id means the push didn't happen or CI is red —
   go back to step 3. Edit shared ledgers with Edit or `>>`, never `>`.
6. **Close every browser and emulator you opened.** `agent-browser session list` shows none of yours
   (`agent-browser --session <s> close`); `pgrep -fl chrome-headless-shell` has nothing you started; Playwright
   scripts have `browser.close()`d; an Android emulator you booted is gone (`adb -s <serial> emu kill`). An open
   game tab renders at 60 fps forever and eats a slot of the 3-browser lane for everyone.
7. **Leftover-work sweep — a QUEUE, not a record.** Anything this session ruled, found, deferred or decided but did
   not build must have a home an agent or the human starts from: an **open ask file in `docs/tasks/asks/`** (the
   session-brief hook prints every ask whose Status isn't done / dropped, and every live plan's State line, at
   each session start — that is the only queue anyone reads), or a **row in a `docs/plans/*.md` checkpoint table**
   whose State line names it. Something only the user can do (an account, a pick, a phone reading) is an ask with
   `needs pick` / `needs you` and exactly what they must do. A commit body, a subagent report, a memory note or a
   chat message is a RECORD, not a QUEUE. This is the step most likely to be skipped because everything *looks*
   clean; it is a banner precondition below.
8. **Subagents and sibling sessions.** Don't kill running subagents to exit — a checkpoint resumes committed state;
   live work notifies when done. List every agent still alive with what it holds and which files it owns. If a
   subagent of yours has uncommitted edits in the tree, either land them through step 1 or queue exactly what is
   half-done (step 7) — an agent's WIP that nobody else will finish is an OOPS. Sibling sessions are found with
   ListAgents (herdr: mind `HERDR_SOCKET_PATH`, there is more than one server). `TaskStop` only orphaned polling
   loops or if the user asks.
9. **Memory.** If this session learned something the next one must know that the repo does not record (a tool
   gotcha, a user rule, a decision's why), write it to the memory directory above and index it in `MEMORY.md`.
   Don't duplicate what AGENTS.md or a commit already says.
10. **Report**, then the banner. The report names: commits (SHAs + one line each), the CI run id and result for the
    last push, the live build id and whether it contains HEAD, the four gates on the exported tree and their
    results, what is left local (yours vs others' WIP), every live agent, every ask file this session touched and
    its Status, browsers / emulators closed — so the user knows whether it is safe to close.

Guardrails: never `rm -rf` / `find -delete` (`dcg` blocks it — write scripts with the Write tool and move things
aside instead). Never `git push --force`, never rewrite pushed or shared history, never `git stash` / `checkout` /
`restore` / `reset` files you didn't author — other agents' dirty and staged files are theirs. `SKIP_SWEEPGUARD=1` /
`SKIP_PUSHLOCK=1` only deliberately and rarely (every sweep-guard escape lands in `project/sweepguard-ledger.md`).
Never `vercel deploy` from the working tree; never hand-deploy at all while CI is healthy. Don't `AskUserQuestion`
on the way out — the banner is the question's answer.

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
  point, **and the leftover-work sweep is done — every ruling, finding and deferral this session produced has an
  ask file in `docs/tasks/asks/` or a `docs/plans/` table**. A BYE is a claim that nothing here will be lost.
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
