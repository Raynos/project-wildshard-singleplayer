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
Target look: `art/<subject>/round-<n>/` (mockups from codex/OpenAI image-gen, or local Qwen-Image-2.1 turbo via
`scripts/mockup-local.sh`, ~20–35 s per image on the M5 Max; index in `art/README.md`, when to use which in AGENTS.md
"Mockups"); gap list: `docs/AAA-PLAN.md`;
progress photos, `timelapse.mp4` and `progress-video.mp4`: `progress/`.

Physics: Rapier 3D (`src/physics/`). Every shard collides for real: the player and nearby creatures on a character
controller, every structure as colliders, projectiles and blades against the world, items as bodies, ragdolls, and a
navmesh for the herds. How it fits together, and the numbers before and after: `project/archive/2026-09-23-physics.md`, or its archive
once finished. Working rules: `AGENTS.md` → Physics.

## Shards

Three shards, one engine, each in its own style (picked on the title deck, or `?chunk=<slug>`):
- **Driftwood Isle** (`driftwood-isle`, the default): a low-poly island in a bright ocean, faceted toon.
- **Pine Hollow** (`pine-hollow`): a boreal hunting forest, the lantern quest and the Antler King, photoreal PBR.
- **Nalati Grasslands** (`nalati-grasslands`, early access): the Tian Shan steppe on horseback, painterly.

What each is, its systems, where its code lives, and how to add a fourth: `docs/SHARDS.md`.

## Plans

Live plans are in `docs/plans/` — each opens with a **State** line (`draft` · `in progress` · `blocked`).
Finished or dropped plans move to `project/archive/<date>-<name>.md`. The rules are in `AGENTS.md` → Plans.
