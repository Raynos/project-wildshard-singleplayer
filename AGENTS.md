# AGENTS.md

## The user's asks

- Every user ask → **its own file** before you start: `scripts/ask-new.sh "<the user's words>"`
  claims the next id and creates `docs/tasks/asks/<ID>.md` (the file is the claim, so two agents
  never get the same id). Keep its `**Status:**` line true — `open` / `in flight (<date>, <owner>)` /
  `needs pick` / `done` / `dropped` — with the commit and build id as evidence underneath; flip it
  when it lands; files never leave. `.claude/hooks/session-brief.sh` prints the open ones at session
  start — relay them first. `docs/tasks/ASKS.md` is the legacy table (history up to 2026-09-22): don't
  add rows there; a legacy row that is still open moves to its own file under the same id.

## Plans (`docs/plans/`) and their state

- A plan is a `docs/plans/<NAME>.md` with a checkpoint / lever table. Line 3, right under the title,
  is its **State** line — `**State:** \`<state>\` <YYYY-MM-DD> — <one line: what landed, what is open,
  who or what it waits on>`. The session brief prints it, so keep it true; rewrite it (don't append)
  whenever the state or the open work changes. The plan's detailed status tables stay below it.
- States, in order:
  - `draft` — written, waiting on the user's go. Nothing gets built from a draft.
  - `in progress` — being built; the line names the open rows and their owners / ASKS ids.
  - `blocked` — nothing to build until something named arrives (a phone reading, a user pick).
  - `finished` — every row is built, deployed and ticked, and every leftover is an **open ASKS row**
    (a plan table is not a queue once it is archived).
  - `archived` — a finished plan, moved **in the same commit it finishes** to
    `project/archive/<YYYY-MM-DD>-<name>.md` (the date it finished), the State line reading
    `archived <today> (finished <date>)` plus where the leftovers went. So `docs/plans/` only ever
    holds live plans (`draft` / `in progress` / `blocked`).
  - `dropped` — the user dropped it: State line with their words, then archived like a finished one.
- Moving a plan: fix the links to it in docs and code comments; `docs/tasks/ASKS.md` rows keep the
  old path (they are history).

## Version control

- Commit early and often with small commits, and `scripts/push-main.sh` after every commit —
  don't let local commits pile up. **A push is a deploy** (see Deploy), so before you push,
  HEAD must pass the four CI gates on a clean export of the tree — `tsc --noEmit`, `oxlint`,
  `node scripts/check-css.mjs`, `vite build` — not just the files you touched.
- **Strict means strict.** `tsconfig.json` has every strictness flag on and `.oxlintrc.json` is
  type-aware with every category at error and zero warnings allowed. Fix the type, never the
  gate: no `any`, no non-null `!`, no `@ts-ignore` / `@ts-expect-error`, no `as unknown as`, no
  tsconfig `exclude`, no blanket `oxlint-disable`. A per-line
  `oxlint-disable-next-line <rule> -- <reason>` only where the rule is genuinely wrong there.
- **Shared-tree safety** — this checkout has **up to ~10 agents editing the working tree at
  once** (parallel Claude sessions and their subagents, all on `main`, no worktrees), sharing
  **one working tree, one git index and one local `main`**. **NEVER** `git stash`, `checkout`,
  `restore`, `git rm`, or otherwise mutate files you didn't author, and leave everyone else's
  uncommitted WIP untouched. Verify before you claim: `git status`, `git log origin/main..main`
  (empty = shipped), and `version.json`.
- **Commit with a pathspec, never from the shared index** — enforced by
  `.claude/hooks/guard-git-add-all.sh` (ported from kami-kakushi):
  - an edit to a tracked file is never staged; commit it directly:
    `git commit -m "…" -- path/a path/b` (commits those paths' working-tree copies, nothing else);
  - `git add` only for a **new** file, then the same pathspec commit;
  - blocked: `git add -A` / `.` / `-u`, `git add <tracked file>`, `git commit -a`, and any
    `git commit` without `-- <paths>`. Rare deliberate escape: `SKIP_SWEEPGUARD=1`, and every use
    lands in `project/sweepguard-ledger.md` (auto-committed by `.githooks/post-commit`).
  - A pathspec commit takes the **whole file**. If a file you're committing also carries another
    agent's uncommitted hunk (`git diff -- <path>` shows lines you didn't write), don't ship their
    half-done work inside yours: wait for them, or commit only your hunks (the private-index recipe,
    `.claude/skills/prepare-to-exit/SKILL.md` step 1).
- **Push with `scripts/push-main.sh`, never `git push`** — enforced by
  `.claude/hooks/guard-bash-safety.sh`. The uplink is ~10–100 KB/s and six parallel pushes of the
  same pack hung for 15+ minutes (E19). The script takes `.git/push.lock`; if another push holds it,
  your commits stay local and it exits 0 — that push re-checks `origin/main..main` before it lets go,
  so it carries yours. Escape (rare): `SKIP_PUSHLOCK=1`.
- **No tree-wide destructive git, no escape** (same hook): `git restore .` / `checkout .`, a bare
  `git stash`, `git reset --hard`, `git clean -f` without paths are blocked; name the paths you
  authored instead.
- **Keep pushes small.** `.githooks/pre-commit` refuses a `progress/` image over 500 KB: save
  screenshots as JPEG / WebP. `.gitattributes` marks binaries `-delta`.
- **The pre-push gate builds what Vercel builds.** `.githooks/pre-push` runs `scripts/vercel-tree-gate.sh` on the tip
  you push (~6 s, stamped per commit). The script checks out only the files `.vercelignore` lets through and runs
  check-css · typecheck · oxlint · vitest · vite build on them. It refuses the push when `.vercelignore` would drop
  anything under `src/`, `public/`, `api/` or `scripts/`. Before it (E41), unanchored patterns (`art`) dropped
  `src/explore/art/`, and deploys went red on Vercel with CI green. Anchor every `.vercelignore` line with `/`. A red
  gate is yours to fix before the push, not after. Escape (rare): `SKIP_VERCEL_GATE=1`.
- **Hooks on:** every checkout runs `git config core.hooksPath .githooks` once (the session brief
  warns when it's off). The Claude hooks are in `.claude/settings.json`; an edit there takes effect
  on a session restart.
- Never open a shared file for writing before you've read it: `open(p, 'w').write(f(open(p).read()))`
  truncates first and reads nothing (it wiped every uncommitted ASKS row on 2026-09-22). Append with
  `>>` or Edit; never `>` onto a shared file.
- Deploy from a clean export of HEAD (`git archive HEAD | tar -x -C <dir>`), never from the working
  tree, so nobody's half-finished files ship.
- Every screenshot session must be closed (`agent-browser --session <s> close`) before you
  report — an open one keeps rendering the game and pins the box.
- **Game browsers are a shared lane: at most 3 open across all agents on this machine.** Check
  `agent-browser session list` and `pgrep -fl chrome-headless-shell` before you open one; if 3
  are already running, wait or reuse your own session. Each open game tab costs ~1.5 cores for as
  long as it is open (agent-browser now closes idle sessions after 5 min, via `idleTimeout` in
  `~/.agent-browser/config.json`). Render on the GPU: agent-browser does by default, and Playwright scripts
  pass `--use-angle=metal` like `scripts/bench-load.mjs`. **SwiftShader (`--use-angle=swiftshader`,
  Android `-gpu swiftshader_indirect`) only when the user asks for it**: it draws on the CPU,
  ~3 cores per page. No `--disable-frame-rate-limit`. One Android emulator at a time, killed
  (`adb -s <serial> emu kill`) when the run ends.

## Mockups

- To design the best game, you can use the codex CLI to generate mockup images
with openai image generation, the mockup images are screenshots of the wildshard
singleplayer demo running in Chrome, as if a playtester was hitting print screen
on his laptop.
- **Where they go:** every mockup / concept image / art asset lives in
  `art/<subject>/round-<n>-<label>/` (e.g. `art/hud/round-7-sword-touch/`,
  `art/feedback/round-1-inbox/`; next free round per subject). Never loose in `art/`, never a new
  top-level folder (`mockups/`, `renders/` …). Existing `art/` files are not moved or renamed.
  `art/README.md` is the index. The plan that asked for them lists each file and what it shows.
- **Start from a live capture, not from nothing.** Take the real game's frame first
  (`agent-browser --session <s> set viewport 1600 900`, or `390 844` + `?touch&tier=phone` for the
  phone; `open "https://wildshard-singleplayer.vercel.app/?skipintro&nolock&weapon=sword"`; wait for
  the load (~60–120 s headless); `screenshot`; `close`). Save it in the session scratchpad and pass it
  with `-i`. codex then **edits** that frame, so the world, the camera and the existing HUD stay true
  and only the new thing is invented. Shots in `progress/` have no HUD, so they are poor UI references.
- **One image per headless run, runs in parallel** (one `&` per variant, then `wait`; 4–6 at once is
  fine, each takes a few minutes):

  ```bash
  codex exec -s workspace-write --skip-git-repo-check -C "$REPO" --add-dir ~/.codex/generated_images \
    -i "$SP/ref-desktop.png" -o "$SP/<id>.last.txt" "<COMMON><SCREEN>
  TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached reference screenshot into
  exactly ONE 16:9 landscape image as described above (keep the world, camera and existing HUD; add
  the new UI in the same UI language). One generation only. Then copy the PNG that YOUR image_gen
  call produced (its path is in the tool result; other runs are writing to ~/.codex/generated_images
  at the same time, so never 'the newest file') into
  $REPO/art/<subject>/round-<n>-<label>/<id>.png. Create or modify no other file." > "$SP/<id>.log" 2>&1
  ```

  **Don't wait for codex to copy its own file.** The image lands in
  `~/.codex/generated_images/<session id>/` about 3 min in. codex's follow-up "copy it" turn can then hang 10+ min on
  reconnects over the slow uplink (E41, 2026-09-23). The runner reads `session id:` from each run's log, polls that
  folder, copies the PNG the moment it appears and kills that codex. Pass the reference as a JPEG (~300 KB, not a
  1.4 MB PNG): every run uploads it. More parallel runs don't slow each other; the waiting is per run, not a queue.
  The model and effort come from `~/.codex/config.toml`. `image_gen` is codex's built-in tool (the
  system `imagegen` skill), so it needs no `OPENAI_API_KEY`. Write the prompts and the runner script
  into the scratchpad with the Write tool: the `dcg` hook blocks shell redirects to computed paths.
- **The prompt has two blocks.** COMMON is shared by every run. It says what the game is (low-poly
  stylized first person, Driftwood Isle) and that the image must read as a real print-screen of it,
  not concept art, with no device frame, browser chrome or watermark. It also carries the UI language:
  dark navy glass `#0d1b26` ~80 %, 1 px cyan `#8fe3ff` hairlines with corner brackets, letter-spaced
  monospace uppercase labels, no gradients or emoji. SCREEN is one variant: what is on screen, where
  (the left 30 %, under PAUSE …), and **every string of UI text verbatim, in quotes**. Unquoted text
  comes back garbled.
- **Look at every image before you report it** (Read the PNG). Re-run a variant whose text is garbled
  or whose HUD drifted from the reference. Say which ones were re-rolled.
- Make several different variants per question (a layout A / B / C…), not one. Then the user can pick
  one and name its letter.
- **Commit JPEG, not PNG.** image_gen hands back 1.4–2 MB PNGs, and the uplink is slow.
  `sips -s format jpeg -s formatOptions 88 X.png --out X.jpg && rm X.png` → ~300–450 KB each.

## Games

- A finished game will run at 60 FPS only.
- A finished game will have AAA graphics that are photo realistic worthy of PS5

## Deploy

- **Continuous deployment: every push to `main` deploys.** `.github/workflows/deploy.yml`
  runs typecheck → oxlint → css check → vite build and, if all green, ships the commit to
  production (project `wildshard-singleplayer`, live at
  https://wildshard-singleplayer.vercel.app) — about a minute push-to-live. A red gate means
  no deploy and the run is red on GitHub; that is your red to fix, now.
- After every push: `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
  --exit-status`, then confirm `https://wildshard-singleplayer.vercel.app/version.json` reports
  your HEAD's short SHA. Put that build id in the ask's file.
- Don't `vercel deploy` by hand while CI is healthy; `gh workflow run deploy` re-ships HEAD.
  The deploy uses a project-scoped Vercel token held in the repo's Actions secrets, so any
  collaborator's push deploys — nobody needs a Vercel login.
- Deploy frequently still applies: small commits, pushed as they land. Don't batch up a day
  of work before shipping it.
