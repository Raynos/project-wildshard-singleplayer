# AGENTS.md

## Version control

- Commit early and often with small commits.

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
