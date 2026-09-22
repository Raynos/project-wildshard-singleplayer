# AGENTS.md

## The user's asks

- Every user ask → a row in `docs/tasks/ASKS.md` before you start; flip it when it lands; rows never
  leave. `.claude/hooks/session-brief.sh` prints the open rows at session start — relay them first.

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

- Commit early and often with small commits, and `git push origin main` after every commit —
  don't let local commits pile up. **A push is a deploy** (see Deploy), so before you push,
  HEAD must pass the four CI gates on a clean export of the tree — `tsc --noEmit`, `oxlint`,
  `node scripts/check-css.mjs`, `vite build` — not just the files you touched.
- **Strict means strict.** `tsconfig.json` has every strictness flag on and `.oxlintrc.json` is
  type-aware with every category at error and zero warnings allowed. Fix the type, never the
  gate: no `any`, no non-null `!`, no `@ts-ignore` / `@ts-expect-error`, no `as unknown as`, no
  tsconfig `exclude`, no blanket `oxlint-disable`. A per-line
  `oxlint-disable-next-line <rule> -- <reason>` only where the rule is genuinely wrong there.
- **Shared-tree safety** — this checkout has **more than one agent editing the working tree at
  once** (parallel Claude sessions and their subagents, all on `main`, no worktrees). **NEVER**
  `git stash`, `checkout`, `restore`, `git rm`, or otherwise mutate files you didn't author.
  Stage **only your own files, by explicit path** (`git add path/a path/b` — never `git add -A`,
  `git add .`, or `git commit -a`), and leave everyone else's uncommitted WIP untouched. Deploy
  from a clean export of HEAD (`git archive HEAD | tar -x -C <dir>`), never from the working
  tree, so nobody's half-finished files ship. Verify before you claim: `git status`,
  `git log origin/main..main`, and the push actually succeeding.
- Every screenshot session must be closed (`agent-browser --session <s> close`) before you
  report — an open one keeps rendering the game and pins the box.

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
  your HEAD's short SHA. Put that build id in the ASKS row.
- Don't `vercel deploy` by hand while CI is healthy; `gh workflow run deploy` re-ships HEAD.
  The deploy uses a project-scoped Vercel token held in the repo's Actions secrets, so any
  collaborator's push deploys — nobody needs a Vercel login.
- Deploy frequently still applies: small commits, pushed as they land. Don't batch up a day
  of work before shipping it.
