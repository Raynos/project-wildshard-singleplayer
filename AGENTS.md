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
