# Glossary

Terms used across the Wildshard repos and the docs here. "SP" = the singleplayer repo, "one-shot" = the
`project-wildshard` repo.

## World

| Term | Meaning |
|---|---|
| **Shard** | One authored tile of the world, 500 × 500 × 500 m (Jake, 2026-10-03; was × 200). The one-shot and older SP code call it a **chunk**; same thing. |
| **Grid** | The layout of shards. The first deployment is 5 × 5; shard centres 515 m apart. |
| **Highway** | The 15 m wide, server-owned road network between shards — a no-man's land. |
| **Edge entry** | The 15 m road at each edge midpoint, running ≥ 50 m in, level with the highway. Must be walkable. In SP code: `entryRoadMask` (`src/chunks/terrain.ts`). |
| **Centre shard** | The hardcoded shard at the middle of the grid; changes only with a server release. |
| **Citadel** | The one-shot's later replacement for a single centre: 9 ordinary cells at the middle. |
| **Lattice** | The glowing energy seams and light columns along shard boundaries (art direction). |
| **Host / room** | The server process running a shard (host) and the game instance keyed by shard id (room). |

## Authoring and uploading

| Term | Meaning |
|---|---|
| **Shard file / package** | What an author uploads. The one-shot's is a `.shard` ZIP; the platform plan's is `shard.json` + `layout.json` + `content/` + `assets/`. |
| **Manifest** | The top-level description of a shard. In SP today a TS module (`manifest.ts`) that must be executed; in the plan, data (`shard.json`). |
| **Generator** | Author-side code that produces assets — procedural meshes, terrain, scatter, Blender scripts. Runs at build time; never shipped. |
| **Bake** | Running generators to produce shippable assets (GLB, KTX2, heightmaps, instance lists). `wildshard bake` in the plan. |
| **Validator** | The check every shard must pass: schemas, budgets, edge entries, asset formats. `wildshard validate` in the plan. |
| **Budgets** | Hard numeric limits per shard: bytes, triangles, entities, rows, material cost, frame time. |
| **Beacon ritual** | The in-game upload: 8 corner beacons + 1 centre beacon, then a ~30 s upload sequence, in localhost staging. |
| **Floating cube** | The isolated space an author builds a shard in, with no neighbours. |
| **Revision** | One uploaded version of a shard; the server keeps them and flips a head pointer to activate one. |

## Engine and platform (SP and the plan)

| Term | Meaning |
|---|---|
| **GAME-NORMALIZATION** | SP's big refactor plan making all four shards one shape (`docs/plans/GAME-NORMALIZATION.md` + `game-normalization/00–13`). Phase 1. |
| **SHARD-PLATFORM** | The proposed phase 2: shards as data + assets, devices, look stacks, validator, CLI. See [SHARD-PLATFORM-PLAN](SHARD-PLATFORM-PLAN.md). |
| **`ShardContext` / `ctx`** | The API a shard plugin gets from the engine in SP's plan (01 §7). The plan wants it data-only. |
| **`uses`** | A shard's opt-in list of engine capabilities; the basis for granting capabilities. |
| **Device** | An engine component with parameters that shards place and wire: mover, trigger, spawner, mount, grapple point, door, pressure plate, scoreboard… (Fortnite Creative's term.) |
| **Logic graph** | Data wiring between devices: events, conditions, variables, timers, state machines. Runs with fuel. |
| **Archetype brain** | An engine-owned creature AI with parameters (melee pack, ranged thrower…), replacing per-species brain classes. |
| **Boss table** | A boss as data: trigger, spawn, HP-threshold phases, move sets from the strike library. |
| **Look stack** | A shard's look as a stack of engine post-processing passes with parameters, plus a colour LUT. Toon, PBR, painterly, Jiehua Neon are the first four. |
| **Material graph** | A TSL node material stored as validated JSON; the engine compiles it to a shader. Replaces hand-written GLSL. |
| **LUT** | A colour lookup table — a texture that remaps colours; cheap, expressive grading. |
| **`sim-no-render`** | SP's lint rule keeping simulation code free of rendering, so the sim can run headless (on a server). |
| **Profile scope** | A save scope above per-shard saves for identity, inventory, coins, gear and progression that travel with the player. |
| **Ratchet** | A gate check whose count may only go down (e.g. remaining `ctx.app` uses). |
| **Council** | SP's multi-agent review of a plan before it is locked ("definition of ready", 12 §1). |
| **Shard 5 / clean-room author** | SP's test where an agent builds a new shard using only the docs and template, filing API gaps instead of editing the engine (11 Z3). |
| **Pocket shard** | An off-grid sub-shard behind a door or portal, free of the 500 × 500 × 500 m limit (an idea; [SHARD-IDEAS §5.1](SHARD-IDEAS.md#51-pocket-shards--unbounded-space-behind-a-door)). |
| **Seams / cross-shard hooks** | What a shard exports or accepts across its edges — rivers, weather, keys, quest hand-offs — declared as an interface, not a neighbour (an idea). |
| **Shard law / mode** | A shard's declared rules (PvP, permadeath, gravity…) and mode: persistent, instanced, scheduled, competitive (an idea). |
| **Living shard** | A shard with server-held, community-changed state and seasons (an idea). |
| **Graduation** | A mechanic first built for one shard becoming an engine device every shard can use. |

## Trust tiers (the plan)

| Tier | Who | Can ship |
|---|---|---|
| 1 — data | Everyone | Data, baked assets, devices, logic graphs, look stacks, material graphs |
| 2 — graduation | Anyone, via review | A PR adding a device or material node to the engine |
| 3 — sandboxed scripting | Trusted authors, later | A WASM / QuickJS module with fuel, memory caps and a data-only API. Jake, 2026-10-03: **WASM plugins are an approved system**; who may ship a new one is [MMO-REQUIREMENTS](MMO-REQUIREMENTS.md) O3 |
| Self-hosted | Anyone, outside our trust boundary | Any code, on the author's own server, reached by a portal |
