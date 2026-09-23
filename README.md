# Wildshard singleplayer demo

The goal is to make a project wildshard singleplayer prototype / demo. Project
wildshard is a large MMO as per ./sources/* ; to aid with development we 
want to do a standalone single player demo.

The singleplayer demo will be a single Chunk, the chunk will be a AAA pine forest
implemented with Typescript and Three.js , within the pine forest there are three
wood cabins, and there are boars and deers available for hunting and killing.

Build a beautiful, AAA, PS5 worthy game demo, inspired by Skyrim Special Edition
on PS5 and by Conan Exiles on PS5 and by Crimson desert on PS5 

The game is a first person sandbox game, where you are in a chunk from project
wildshard, the chunk is covered in pine forest, with some wood cabins, and
you have a crossbow and there are boars and deers available to kill.

The game should feel like playtesting a standalone chunk from project wildshard
before uploading it.

The game must be absolutely amazing with its graphics, we must build the AAA 
graphics until we are absolutely wowed and we must not stop until it looks
like a genuine PS5 game

## Status

Playable: `pnpm install && pnpm assets && pnpm dev` → http://localhost:5173 (see `docs/RUNNING.md`).
Target look: `art/` (codex/OpenAI image-gen mockups); gap list: `docs/AAA-PLAN.md`;
progress photos, `timelapse.mp4` and `progress-video.mp4`: `progress/`.

Physics: Rapier 3D (`src/physics/`). Both shards collide for real: the player and nearby creatures on a character
controller, every structure as colliders, projectiles and blades against the world, items as bodies, ragdolls, and a
navmesh for the herds. How it fits together, and the numbers before and after: `docs/plans/PHYSICS.md`, or its archive
once finished. Working rules: `AGENTS.md` → Physics.

## Plans

Live plans are in `docs/plans/` — each opens with a **State** line (`draft` · `in progress` · `blocked`).
Finished or dropped plans move to `project/archive/<date>-<name>.md`. The rules are in `AGENTS.md` → Plans.
