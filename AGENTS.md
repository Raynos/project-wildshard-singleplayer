# AGENTS.md

## The user's asks

- Every user ask → a row in `docs/tasks/ASKS.md` before you start; flip it when it lands; rows never
  leave. `.claude/hooks/session-brief.sh` prints the open rows at session start — relay them first.

## Version control

- Commit early and often with small commits, and `git push origin main` after every commit —
  don't let local commits pile up.
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

- Deploy frequently. After every meaningful, verified change run
  `vercel deploy --prod --yes` from the repo root (project `wildshard-singleplayer`,
  live at https://wildshard-singleplayer.vercel.app). Don't batch up a day of work
  before shipping it.
