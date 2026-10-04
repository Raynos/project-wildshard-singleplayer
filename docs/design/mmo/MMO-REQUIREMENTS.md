# Wildshard MMO: the problem statement and the requirements

> **State:** draft, 2026-10-03 (ask E431). Built from Jake's words that day, meta's [VISION.md](https://github.com/Raynos/project-wildshard-meta/blob/main/docs/vision/VISION.md),
> the pitch and the fundamentals (singleplayer `sources/WILDSHARD.md`, `sources/wildshard/FUNDAMENTALS.md`), the
> [one-shot review](https://github.com/Raynos/project-wildshard-meta/blob/main/docs/shard-platform/ONE-SHOT-REVIEW.md) and an audit of this repo at `06de6df0e`.
> Where this doc and meta's VISION.md disagree, this doc is newer: it records Jake's 2026-10-03 decisions (§6). The route to
> the first milestone is the plan [SHARD-PLATFORM](../../plans/SHARD-PLATFORM.md) (the 80/20 split). The thinking
> behind it (code vs data, WASM, the lock-ins, shard ideas) is meta's
> [SHARD-PLATFORM-PLAN](https://github.com/Raynos/project-wildshard-meta/blob/main/docs/shard-platform/SHARD-PLATFORM-PLAN.md) and
> [SHARD-IDEAS](https://github.com/Raynos/project-wildshard-meta/blob/main/docs/shard-platform/SHARD-IDEAS.md).

Jake, 2026-10-03: *"high level the vision is the MMO. … Since the MMO is hard we started with single player. But the
sandbox MMO including an API with user generated shards has lots of constraints."*

## 1. The problem statement

**What we are building.** Wildshard is a sandbox MMO in the browser. The world is a grid of **shards**. Each shard
is made by a player, an **author**, who builds it with Claude Code and the Wildshard SDK, then uploads it in an
in-game ritual. Other players walk, ride and fight their way across the grid and play each shard together.
Two front doors: **play in the browser** (desktop and phone), or **build in Claude Code**.

**Why it is hard.** Claude Code can write anything, and that freedom is the product. But a shard runs on other
people's phones and on our servers, next to strangers' shards:

| # | Problem | Why it bites |
|---|---|---|
| P1 | **Untrusted content** | Uploaded JS / TS runs with the page's powers: storage, cookies, `fetch`, the DOM. Lint can't stop a bad actor; only a runtime boundary can |
| P2 | **Performance on a phone** | One heavy shard (a 50M-triangle scene, an endless loop, a GPU-hanging shader) ruins it for everyone in it. The reference device is an iPhone at 30 fps sustained hot, inside 1.0 GB |
| P3 | **Server authority** | Multiplayer needs the server to run the rules. Code that only runs in the browser can't be authoritative, and code on the server is a sandbox problem |
| P4 | **An API that lasts** | Authors' shards must keep working for years. Today the engine API "may change as long as every in-repo shard moves with it" (GAME-NORMALIZATION decision 57). That can't hold for shards we don't own |
| P5 | **One world from many hands** | Fixed size, walkable edges, a shared scale and a shared sense of place, while each shard keeps its own look |
| P6 | **A living grid** | Ownership, collaboration, renovation, live updates with players inside, and a centre that doesn't become a ghost town |
| P7 | **Moderation and cost** | Offensive content, griefing, farming; hosting and bandwidth per shard |

**The answer, in one line: build with code, ship data and approved systems.** Authors keep unlimited code where it
runs on their own machine: generators that bake models, terrain and scatter. What ships is data (rows, layouts, graphs)
and baked assets, run by **approved systems** the engine owns: a logic system, devices, look stacks, material
graphs and sandboxed **WASM plugins**. Custom TypeScript at runtime survives only as a transition allowance for the
six first-party shards (§3.10).

**Why single-player first.** Six shards on one engine (Driftwood Isle, Pine Hollow, Nalati Grasslands, Nine Dragon
Stack, Signal Dunes, Sky Reach) proved the feel, the looks and the engine shape, and GAME-NORMALIZATION gave them one
shape: four layers, a manifest + plugin per shard, scope-owned resources, a seeded RNG and clock, versioned saves,
budgets per shard, a parity gate. What they are not yet is **uploadable**: every shard is 4k–30k lines of trusted
TypeScript compiled into the build.

## 2. Goals and non-goals

**Goals.** A shared, persistent grid of player-made shards; authoring in Claude Code with a real SDK; a format the
server can load as config; phone-grade performance by construction; server-authoritative play; an API with a
compatibility promise; the existing six shards carried over without a rewrite.

**Non-goals (for now).** Crafting (the brief puts it out of scope). Building inside the game (Minecraft-style): the
editor is Claude Code. Unreviewed arbitrary code from strangers. A native-only client.

## 3. Requirements

**MUST** is required for the first public grid. **SHOULD** is wanted, and can follow. Each row cites its source:
**F** the fundamentals, **V** VISION.md, **J** Jake on 2026-10-03, **N** new here (proposed, not yet approved).

### 3.1 The world

| Id | Requirement | Level | Src |
|---|---|---|---|
| W1 | A shard is **500 × 500 × 500 m**, in its own local coordinates; x and z ∈ [−250, 250] | MUST | J (was 500 × 500 × 200, F) |
| W2 | The vertical split around the highway level y = 0 is an engine constant, the same for every shard: **250 m below, 250 m above** (O1) | MUST | J |
| W3 | Shards sit on a grid, centres 515 m apart, with a **15 m highway** between them owned by the server (no man's land). The first deployment is **5 × 5 = 25** | MUST | F |
| W4 | **Edge entries:** at each of the four edge midpoints a 15 m road runs at least 50 m in, level with the highway. No wall or cliff may close an edge. The validator proves each entry is **walkable** (ingress, clearance, terrain continuity), not just present. During the transition Driftwood Isle (open sea) and Sky Reach (floating islands) are exempt; their conversion adds the entries (Jake, 2026-10-03) | MUST | F, V |
| W5 | The **centre shard** is first-party and changes only with a server release | MUST | F |
| W6 | **The server places shards.** Authors build in isolation (a floating cube) and never pick their cell. Identity, revision, placement and host are separate fields, and the server owns all four | MUST | F |
| W7 | Travel between shards over the highway is **seamless**: no page reload, the next shard streams in | SHOULD | V |
| W8 | Shards are seen from afar: neighbours render as low-detail horizon impostors | SHOULD | N |
| W9 | **Pocket spaces:** interiors and dungeons behind a door may be larger than the cell, off the grid, reachable only through declared doors | SHOULD | N (SHARD-IDEAS §5.1) |

### 3.2 Authoring

| Id | Requirement | Level | Src |
|---|---|---|---|
| A1 | **Claude Code is the editor.** The SDK is a skill, docs and a `wildshard` CLI: `new`, `bake`, `validate`, `pack`, `preview` | MUST | V |
| A2 | **Generators run on the author's machine.** Procedural models, terrain, scatter and Blender scripts run under `bake`; only their output ships (GLB, KTX2, heightmaps, instance lists, audio) | MUST | N (platform plan §5) |
| A3 | `validate` runs **the same pipeline the server runs**, so a shard that passes locally passes on upload | MUST | N |
| A4 | `preview` runs the shard in the real client, in localhost mode, with the budget overlay | MUST | V |
| A5 | **The CLI never uploads.** Uploading is the in-game ritual (U1) | MUST | V |
| A6 | A fresh author with only the SDK can build a small, real, playable shard **outside the repo** | MUST | N (extends singleplayer Z3) |
| A7 | Authors share generators as ordinary code packages and can remix public shards, with attribution | SHOULD | N |

### 3.3 The shard package

| Id | Requirement | Level | Src |
|---|---|---|---|
| S1 | A shard is **one archive**: `shard.json` (identity, look, `requires`, budgets), `layout.json` (places, anchors, spawns, paths, edge entries), `content/` (rows and graphs), `assets/` (baked), and optionally `plugins/*.wasm` | MUST | F, N |
| S2 | **Strictly validated:** every file has a schema; unknown keys are refused; ids and references resolve; entries carry a hash and size | MUST | F |
| S3 | **Hard limits in one budgets file** (bytes, triangles, draws, entities, rows, lights, material cost, plugin fuel and memory), referenced by the schemas | MUST | F, N |
| S4 | Server-owned fields (id, revision, placement, host, author) are **never** in the author's files | MUST | N |
| S5 | A shard declares the systems it needs with versions (`requires: ["logic@1", "mount@2", "look.painterly@1"]`); the server refuses a shard that needs one it lacks | MUST | N |
| S6 | Content the brief makes mandatory is expressible as data: geometry; parameterised items (weapons, equipment); enemy NPCs; quest-giver NPCs; declarative quests; collectibles, exploration and puzzles; doors and windows, locked or not; achievements and virtues; cosmetics including hats and capes; earned titles | MUST | V |

### 3.4 What runs: data and approved systems

| Id | Requirement | Level | Src |
|---|---|---|---|
| R1 | **No uploaded JavaScript or TypeScript runs**, on the client or the server. Content is loaded as config | MUST | F |
| R2 | Behaviour is a **logic system**: devices fire events into a data graph of conditions, actions, variables, timers and state machines. The interpreter is pure (it returns effects), metered by fuel and cascade limits, and runs headless on the server and on the client for prediction | MUST | J, N |
| R3 | **Devices** are engine components with parameters that shards place and wire: movers, triggers, spawners, doors, pressure plates, mounts, grapple points, ropes, water bodies, flocks, scatter, wind zones, scoreboards, displays with stages… | MUST | N |
| R4 | Creatures are **archetype brains** with parameters; bosses are **phase tables** (trigger, HP thresholds, move sets from the strike library); quests are **quest graphs** | MUST | N |
| R5 | Looks are **look stacks**: engine post passes with parameters plus a colour LUT, sky, fog and day keyframes as data. Each shard keeps its own look (toon, PBR, painterly, Jiehua Neon and the newer ones) | MUST | J |
| R6 | Special surfaces are **material graphs**: validated node graphs with an allowlist of nodes and a cost cap, compiled by the engine. Shards ship no shader source | MUST | J |
| R7 | **WASM plugins** are an approved system: a module that talks to the engine only through a small, data-only host API (ids, numbers, typed arrays), with fuel and memory caps, deterministic, runnable on the server and in the browser | MUST | J (amends VISION's ban, §6) |
| R8 | A new mechanic **graduates**: a shard's need becomes a reviewed engine device or node that every shard can then use | SHOULD | N |

### 3.5 Trust tiers

| Tier | Who | Ships |
|---|---|---|
| 0 · first-party transition | The six in-repo shards, during the transition | Up to **20 % custom runtime TypeScript**, in a marked `runtime/` folder, under a ratchet that only falls (§3.10) |
| 1 · everyone | Any author | Data, baked assets, devices, the logic system, look stacks, material graphs, **approved** WASM plugins |
| 2 · plugin authors | Authors whose plugin passed review | Their own WASM plugin, public after review (open decision O3) |
| 3 · self-hosted | Anyone, outside our trust boundary | Any code on their own server, reached through a portal; identity crosses as a signed token |

### 3.6 Performance and budgets

| Id | Requirement | Level | Src |
|---|---|---|---|
| B1 | The reference device is the phone: **30 fps sustained hot**, 60-ready; memory within **1.0 GB in world, 1.8 GB while loading** | MUST | singleplayer budgets |
| B2 | Budgets are **checked statically on upload** (S3) and **enforced at runtime**: a shard that runs slow drops its quality tier, and a plugin that runs out of fuel is stopped, not waited on | MUST | N |
| B3 | Static assets are served content-addressed and cacheable; a shard boots offline once visited | SHOULD | N |

### 3.7 Multiplayer

| Id | Requirement | Level | Src |
|---|---|---|---|
| M1 | **The server is authoritative.** Each shard runs as a **room** on a **host**; most rooms start on the main host | MUST | F |
| M2 | The simulation runs **headless**: no renderer, no DOM. Hits are resolved from aim inputs, not from what the first-person view draws | MUST | N |
| M3 | World state is serialisable with **stable entity ids**; gameplay changes arrive as input commands, so snapshot → restore → replay is exact | MUST | N |
| M4 | Identity: log in or play anonymously. A **Name** with a **Title** beneath it | MUST | V |
| M5 | Chat: global, shard and proximity | MUST | V |
| M6 | A **player profile** above the shards (identity, inventory, coins, gear, cosmetics, titles, progression) travels between shards; each shard keeps only its own world state | MUST | V (R10) |
| M7 | Shard modes and law (persistent, instanced, scheduled, competitive; PvP, gravity, permadeath) are declared data the server enforces | SHOULD | N (SHARD-IDEAS §5.3) |

### 3.8 Upload and lifecycle

| Id | Requirement | Level | Src |
|---|---|---|---|
| U1 | **The upload ritual:** in localhost mode the author plants a beacon at the 8 corners and a 9th at the centre, then completes a ~30 s upload sequence. No CLI or API upload replaces it | MUST | F |
| U2 | The server validates (A3), quarantines, then activates a revision by an atomic head flip. Every revision is kept | MUST | N |
| U3 | **Live update with players inside** is designed and tested: revision swap while occupied, relocation mid-session, capacity, crash recovery (open decision O5) | MUST | V |
| U4 | **Private shards never leak**, including through public asset URLs | MUST | V |

### 3.9 Ownership and the living grid

| Id | Requirement | Level | Src |
|---|---|---|---|
| O1 | Every shard records its **original author** and **last editor**; it is public or private | MUST | F |
| O2 | **Locking and grace periods** stop shards thrashing | MUST | F |
| O3 | **Collaboration:** invite editors; an editor downloads the current revision to edit it cleanly in Claude Code | MUST | F |
| O4 | **Renovation:** abandoned shards can be claimed by new authors | MUST | F |
| O5 | **No ghost-town centre:** rank, bin-pack, archive and relocate shards by meaningful activity (edits, play, authored quests, achievements, puzzles, pickups), **excluding the author**, resistant to farming. The centre stays fixed. What happens to players, saves and archived work on a move is defined | MUST | F |
| O6 | Moderation: report, review and take down a shard or a revision; content checks on upload where they are cheap | MUST | N |

### 3.10 The transition: the six shards keep working

| Id | Requirement | Level | Src |
|---|---|---|---|
| T1 | **Nothing breaks.** Driftwood Isle, Pine Hollow, Nalati Grasslands, Nine Dragon Stack, Signal Dunes and Sky Reach stay playable and live through every step; the singleplayer parity gate proves each step | MUST | J |
| T2 | **The 80/20 split:** each first-party shard reaches **≥ 80 % data and approved systems, ≤ 20 % custom runtime TypeScript** (the metric is defined in SHARD-PLATFORM), without a rewrite in one go | MUST | J |
| T3 | The 20 % lives in each shard's `runtime/` folder, behind the shard API, under a per-shard ratchet that only falls. It shrinks later by graduation (R8) or a port to a WASM plugin (R7) | MUST | J |
| T4 | **New shards are born on the format** with no `runtime/` folder; what they lack becomes an approved system. One exception: **Thin Ice** (shard 7) starts as code with the six's 20 % allowance and converts last (Jake, SHARD-PLATFORM Q1) | MUST | J |
| T5 | Until the first public grid, single-player stays the shipping product | MUST | N |

## 4. What the singleplayer engine already gives us

Kept as they are: the four layers and their guards (ARCH-GUARDS: the engine names no game, shard or content); a shard
as manifest + plugin with opt-in mechanisms (`uses`); scope-owned resources with a load → unload leak test; the seeded
RNG and game clock; the typed event bus; versioned saves with migrations; budgets per shard measured by the gate; the
parity harness and the GPU gate; the template shard and the clean-room "shard 5" protocol; every shard manifest already
declares a 500 × 500 × 500 cell. The audit of what is missing is in SHARD-PLATFORM §2.

## 5. How we will know

| Milestone | Exit test |
|---|---|
| **80/20** (SHARD-PLATFORM) | Every first-party shard reports ≥ 80 % in the gate; the shards boot from their packages; a new shard ships with no `runtime/` folder; the template's simulation runs in Node with no renderer |
| **Multiplayer** | Two players in one shard on an authoritative server, from the same packages |
| **Upload** | An outside author uploads a validated shard through the ritual and it appears on the grid |
| **The grid** | 25 shards live, travel over the highway without a reload, profiles that travel |

## 6. Decisions recorded (Jake, 2026-10-03)

1. **The vision is the MMO.** Single-player came first because the MMO is hard.
2. **Shards are 500 × 500 × 500 m.** This replaces the fundamentals' 500 × 500 × 200 and resolves VISION's open tension
   on Nine Dragon's 500 m stack.
3. **The 80/20 split:** 80 % data and approved systems (a logic system, look stacks, material graphs, WASM plugins),
   20 % custom runtime per shard, so nothing is rewritten in one go.
4. **The 20 % is the transition** that keeps the six existing shards working.
5. **WASM plugins are approved systems.** This amends the one-shot brief's ban on uploaded WASM (VISION's tension
   table) for sandboxed plugins behind the data-only host API.

## 7. Open decisions (each with a recommended answer)

| # | Decision | Recommended |
|---|---|---|
| O1 | The vertical split of the 500 m | **Decided (Jake, 2026-10-03): 250 m below the highway level, 250 m above** (`CELL_BELOW` / `CELL_ABOVE`, SHARD-PLATFORM SP4) |
| O2 | A hardcoded centre shard, or the one-shot's 9-cell citadel | **One hardcoded centre shard** (the fundamentals): one hub for vendors, the upload ritual and portals; the citadel can come later |
| O3 | Who may ship a new WASM plugin | **Any author may use approved plugins; a new plugin goes public only after review.** A private shard may test an unreviewed plugin locally |
| O4 | The first plugin toolchain | **Rust, with a language-neutral host ABI.** The best WASM toolchain, deterministic, and Claude Code writes it well; AssemblyScript or QuickJS for TypeScript authors later on the same ABI |
| O5 | Live update with players inside | **A 60 s warning, then evacuate to the highway and return when the new revision is active** (the one-shot's drain → swap → re-admit) |
| O6 | One shared look for the world, or one per shard | **One per shard**, made coherent by the shared lattice, highway and sky (Jake keeps each shard's own style today) |
| O7 | Material graphs need a node compiler | **Decided (Jake, SHARD-PLATFORM Q2): our own compiler onto the WebGL renderer's shader patches.** three.js TSL node materials need its WebGPU renderer, which singleplayer keeps contained; revisit when the engine switches |

## 8. Out of scope here

Server technology, hosting and cost model, accounts and payments, and the multiplayer protocol: they are the
milestones after 80/20 and get their own plans. Crafting. Accessibility features.
