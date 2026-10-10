# Plan: OCTOBER-BACKLOG — the October backlog (E469)

**State:** `draft` 2026-10-10 — created at Jake's ask (E469): Jake named the three sagas (§1: fun to play, fun to build, the MMO works) and every live plan sits under one; rows OB1 (low-poly player body), OB2 (Debug third-person camera), OB3–OB5 (write the multiplayer, API-server and 60-fps plans), OB6 (audit the repo for coworkers); unowned, nothing built.

## 0. Read this first

Jake, E469 (2026-10-10): *"New plan file called October backlog"*, then *"the character is floating arms and doesn't
have a body it needs a low poly body"* and *"add experimental debug third person camera view"*.

A home for October work that belongs to no other live plan. A row that fits a live plan goes there instead.

## 1. The sagas

Jake, 2026-10-10: *"I want to build three high level sagas for all the plans."* Each live plan and each backlog row
sits under one saga.

| Saga | Jake's words | Rows here |
|---|---|---|
| **1. Fun to play** (players) | *"make the gameplay fun for the players of the mmo a shard should be fun. Controls should be fun. HUD should be fun"* | OB1, OB2 |
| **2. Fun to build** (builders) | *"make building a shard for the builders fun, this is the worldclaw plan, the guild wars 2 plan the draft plan etc"* | |
| **3. The MMO works** (technical) | *"make the MMO work. This is deeply technical work. Make it multiplayer, make it 60 fps, api server. Sdk engine etc"* | OB3, OB4, OB5, OB6 |

**Every live plan under its saga.** The ones Jake named are marked *(Jake)*; the rest are placed by the plan's own
scope.

| Saga | Plans |
|---|---|
| **1. Fun to play** | Shards: [DRIFTWOOD-REMASTER-V2](DRIFTWOOD-REMASTER-V2.md), [NINE-DRAGON-STACK](NINE-DRAGON-STACK.md), [SIGNAL-DUNES](SIGNAL-DUNES.md), [SKY-REACH](SKY-REACH.md). Feel: [FINISH-LINE](FINISH-LINE.md), [ANIMATION-REMASTER](ANIMATION-REMASTER.md), [PHYSICS-POLISH](PHYSICS-POLISH.md). Showing it to players: [MARKETING-SITE](MARKETING-SITE.md), [TRAILERS](TRAILERS.md), [PROGRESS-TRAILER](PROGRESS-TRAILER.md) |
| **2. Fun to build** | [WORLDCLAW-SHARD](WORLDCLAW-SHARD.md) *(Jake)*, GW2-ZONES ([docs/design/gw2-zones/GW2-ZONES.md](../design/gw2-zones/GW2-ZONES.md)) *(Jake)*, [WORLDCLAW-TOOLS](WORLDCLAW-TOOLS.md) (Draft mode, the drafts site) *(Jake)*, [THIN-ICE](THIN-ICE.md) (WorldClaw's pilot shard), [EXPLORE-V2](EXPLORE-V2.md) (the Model Explorer) |
| **3. The MMO works** | [SHARD-PLATFORM](SHARD-PLATFORM.md) (SDK, engine, MMO-compatible shardfiles; it builds no multiplayer, G41), [NATIVE-APPS](NATIVE-APPS.md), [DEPLOYMENT_ASSET_TRIM](DEPLOYMENT_ASSET_TRIM.md), [REPO-WEIGHT](REPO-WEIGHT.md) |

**Gaps in saga 3.** No live plan builds multiplayer, the API server or 60 fps: SHARD-PLATFORM fences out servers,
rooms and netcode (G41), and the vision lives only in design docs ([docs/design/mmo/](../design/mmo/MMO-REQUIREMENTS.md)).
Rows OB3–OB5 start those plans.

## Rows

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| OB1 | **A low-poly player body** | The player is floating arms: the first-person viewmodels (weapons, `Hands.ts` swim gloves, Driftwood's castaway arm rig) hang off the camera, and the game has no body mesh (`src/game/cosmetics/cosmetics.ts`: worn cosmetics only cast a shadow where a body would be). Give the player a rigged low-poly body (torso, legs, feet, arms that line up with the viewmodel arms) that walks, runs, jumps, swims and rides on the player's state, casts the body shadow, and carries the Wardrobe's sockets. First person: legs and torso visible looking down, never clipping the camera. Per-shard style through the model contract (Driftwood toon, Nalati painterly, Pine Hollow PBR). A new look, so it lands behind Developer with the arms-only view kept as the Debug alternative until Jake picks. **Done when:** looking down on each shipping shard shows a body that animates with movement, its shadow matches, and the iPhone frame floor holds | M–L | E469 |
| OB2 | **Experimental Debug third-person camera** | One pause ▸ Settings ▸ Debug row, *Camera: first person / third person (experimental)*: a chase camera behind and above the player that collides with the world (physics queries, pulls in through walls) and shows OB1's body with the worn cosmetics in `visible` mode; touch controls and aim keep working; first person stays the default. Engine-wide registry row, no URL switch. **Done when:** the row toggles live on every shard without a reload, the camera never ends inside geometry on the physics walk spots, and first person is unchanged with the row off | M | E469 |
| OB3 | **Write the MULTIPLAYER plan** (saga 3) | A draft plan for multiplayer: rooms, netcode on the headless sim (`@wildshard/engine/sim`), what a shardfile already gives a server, what the first playable test is (two players in one shard). Built from [MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md) and VISION. **Done when:** `docs/plans/MULTIPLAYER.md` is a draft with rows and Jake's open picks asked | S | E469 |
| OB4 | **Write the API-SERVER plan** (saga 3) | A draft plan for the game's API server: accounts, saves, shard upload / catalogue, what today's Vercel functions (`api/`: inbox, telemetry, errors, waitlist, crossroads) become. **Done when:** `docs/plans/API-SERVER.md` is a draft with rows and Jake's open picks asked | S | E469 |
| OB5 | **Write the 60-FPS plan** (saga 3) | A draft plan for a steady 60 fps on Jake's iPhone 17 Pro at 2× render scale (not in Low Power Mode, which caps at 30): today's frame-floor readings per shard and tier, the worst frames, the budget per system. **Done when:** `docs/plans/SIXTY-FPS.md` is a draft with measured rows | S | E469 |
| OB6 | **Audit the repo for coworkers** (saga 3) | Jake: *"audit and review directory structure to make the repo multi user I want coworkers to help and not just solo engineer"*. Today the repo is built for one human and ~10 agents on one working tree and one `main` (GIT.md: no branches, no PRs, auto-push). Audit and review: the top-level layout (`src/`, `docs/`, `art/`, `progress/`, `project/`, `drafts/`, `sources/`, `api/`, `scripts/`, `lint/`), what a new person reads first, which folders are agent working state rather than source, where each shard's code, assets, music and sfx live, the one-tree / auto-push flow vs branches and review for people, onboarding (clone weight, see [REPO-WEIGHT](REPO-WEIGHT.md); setup; which tests to run), and ownership (CODEOWNERS per layer and shard). **Done when:** a review page (`docs/reviews/`) proposes the target structure and workflow with a move list, and Jake's picks are asked | M | E469 |
