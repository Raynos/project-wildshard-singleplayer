# Wildshard MMO: the problem statement and the requirements

> **State:** draft, 2026-10-03 (ask E431). Built from Jake's words that day, [VISION.md](VISION.md), the pitch and
> the fundamentals (`sources/WILDSHARD.md`, `sources/wildshard/FUNDAMENTALS.md`), the
> [one-shot review](ONE-SHOT-REVIEW.md) and an audit of this repo at `06de6df0e`. Where this doc and VISION.md
> disagree, this doc is newer: it records Jake's 2026-10-03 decisions (§6). The route to the first milestone is the
> plan [SHARD-PLATFORM](../../plans/SHARD-PLATFORM.md) (the 80/20 split). The thinking behind it (code vs data, WASM,
> the lock-ins, shard ideas) is [SHARD-PLATFORM-PLAN](SHARD-PLATFORM-PLAN.md) and [SHARD-IDEAS](SHARD-IDEAS.md);
> the terms are in [GLOSSARY](GLOSSARY.md).

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
| P8 | **An economy across strangers' shards** | The profile travels (M6). A stranger's shard that grants a god-sword or a chest of coins would inflate every other shard. Decided (Jake, E435): **two wallets** (M6) |
| P9 | **Netcode on a phone** | First-person combat with physics over mobile networks: latency, loss and jitter decide how authoritative play can feel (Fork C, E435) |
| P10 | **Quality and discovery** | Twenty-five shards by strangers: what brings a good one forward and lets a bad one leave (O5 is half of it) |

**The constraint, not the mechanism** (Jake, E435: the requirements state what must be true; the plan picks how):
whatever a shard ships is **safe by construction** (it cannot reach storage, network, the DOM or other shards),
**metered** (CPU, memory, draw cost; a runaway is stopped, not waited on), **deterministic** (the server and the
client get the same result) and written against a **versioned API**. How that is achieved is the plan's call, not
this doc's.

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
| W3 | Shards sit on a grid with a **15 m highway** between them owned by the server, and a **platform-owned no-man's land of N m on each side of it** (G37), generated when the grid is assembled from both neighbours' edges to ease each shard down to road level; crossroads blend four ways. Start N = 20 m, so centres sit 555 m apart; N is tuned in the crossroads prototype. The grid is **unbounded-ready** (G38: signed coordinates, no assumed edge); the first deployment is **5 × 5 = 25** | MUST | F, J |
| W4 | **Edge entries:** at each of the four edge midpoints a 15 m road runs at least 50 m in, level with the highway. No wall or cliff may close an edge. The validator proves each entry is **walkable** (ingress, clearance, terrain continuity), not just present. During the transition Driftwood Isle (open sea) and Sky Reach (floating islands) are exempt; their conversion adds the entries (Jake, 2026-10-03) | MUST | F, V |
| W5 | The **centre shard** is first-party and changes only with a server release | MUST | F |
| W6 | **The server places shards.** Authors build in isolation (a floating cube) and never pick their cell. Identity, revision, placement and host are separate fields, and the server owns all four | MUST | F |
| W7 | **Seamless travel**: no page reload and no loading screen; walking, riding or driving across a border streams the next shard in. **Designed first** (Jake, E435): it decides the package format, the budgets and the server rooms, so the design and a phone prototype come before the format freezes | MUST | V, J |
| W7a | **The crossroads is the worst case.** Where four shards meet, the player stands within ~40 m of four shard corners (≈ 38.9 m at the 555 m pitch), all four in the near field. Every budget (memory, draws, CPU, bandwidth) is proven at a crossroads, not inside one shard | MUST | J |
| W7b | **A shard's edges show at full detail without its interior**: a shard can be streamed in parts, nearest first | MUST | J |
| W7c | **Everything in view fits the phone together**: at a crossroads, four shards' near parts plus the far ring fit in 1.0 GB (B1). A shard's budget is a share of the phone, not the whole phone | MUST | J |
| W7d | **Speed never outruns the stream**: at driving speed (~30 m/s) on a mobile link, the next shard's near parts arrive before the player does; a stall degrades to proxies, never a hole, a fall or a freeze | MUST | J |
| W7e | **Borders are invisible to play**: crossing hands the player from room to room with nothing lost or duplicated and no hitch; creatures and players across a border are seen | MUST | J |
| W7f | **Several looks on one screen** (overridden by Jake, 2026-10-04, SHARD-PLATFORM G158): **inside a shard, that shard owns the whole frame** (sky, sun, fog, lighting, exposure and its own post stack, as data and material / post graphs within the GPU budget, never raw code); on the highway and strips, the neutral road look; the frame blends at the cell edge. One world clock still applies (G27; a shard may override time inside its cell). Jake: *"once you enter a shard, it has full control of making a shard that looks like GTA 6 or No Man's Sky or whatever"* | MUST | J |
| W7g | **Simple borders for the first grid** (Jake, E435): creatures never leave their shard; no combat across a border; the highway is a no-combat zone; a vehicle crosses with its passengers as one unit; players and creatures across a border are visible, read-only. Lifted only once authority transfer is proven | MUST | J |
| W7h | **Travel only** (G33, like Black Desert Online): no fast travel; the hoverboard, highway cars (≥ 30 m/s, highway only) and auto-pathing along the highway to a shard's edge entry (G40); inside shards about 15 m/s, lower if the author sets it (G39) | MUST | J |
| W8 | **The grid is seen from afar**: every shard has a far form (a proxy, then a horizon impostor) made by the platform from its package, so distant shards are visible at little cost | MUST | N, J |

### 3.2 Authoring

Needs only (Jake, E435): the tools, commands and file layout that meet them are SHARD-PLATFORM's.

| Id | Requirement | Level | Src |
|---|---|---|---|
| A0 | **Any player can become a shard builder** (Jake, E435): *"A player of the game can become a shard builder, and it's done by getting the claude code skill / quickstart / cli for wildshard and building their own shard the same way first party shards are built."* One path: first-party shards are built with the same public skill, quickstart and CLI; there is no private first-party route (the six's transition allowance, X1, aside) | MUST | J |
| A1 | **Claude Code is the editor.** An author needs nothing but Claude Code and the Wildshard SDK | MUST | V |
| A2 | Authors may make content with **any tool on their own machine**; only the output ships | MUST | N |
| A3 | The author's local check runs **the same validation the server runs**, so a shard that passes locally passes on upload | MUST | N |
| A4 | An author can **play the shard locally in the real client** and see what it costs against the limits | MUST | V |
| A6 | **The first proof of the platform** (Jake, E435, package-first): a fresh author with only the SDK builds a small, real, playable shard **outside the repo**, and it runs with no trusted code (deferred to SHARD-PLATFORM S19 by G57; M1 proves the template package) | MUST | N, J |
| A7 | Authors can share their tools and remix public shards, with attribution | SHOULD | N |

### 3.3 The shard

| Id | Requirement | Level | Src |
|---|---|---|---|
| S1 | A shard is **one self-contained, immutable package**: everything it needs is inside it or provided by the platform | MUST | F |
| S2 | **Strictly validated**: unknown content is refused; every reference resolves; every part is checked for size and integrity | MUST | F |
| S3 | **Hard limits** (bytes, geometry, draw cost, entities, CPU, memory) are declared and **checked before anyone plays it** | MUST | F |
| S4 | Server-owned facts (id, revision, placement, host, author) are **never** in the author's files | MUST | N |
| S5 | A shard **names the API version it targets**; the platform keeps that version working or refuses the shard. Authors' shards keep working for years | MUST | N |
| S6 | The content the brief makes mandatory can be expressed: geometry; parameterised items (weapons, equipment); enemy NPCs; quest-giver NPCs; scripted quests; collectibles, exploration and puzzles; doors and windows, locked or not; achievements and virtues; cosmetics including hats and capes; earned titles | MUST | V |

### 3.4 Behaviour and safety

| Id | Requirement | Level | Src |
|---|---|---|---|
| R1 | **Authors invent mechanics** (Jake, E435): a shard can carry genuinely new behaviour (a puzzle, a boss's mind, a gadget, a minigame), not only configure mechanics the platform made | MUST | J |
| R2 | **Nothing a shard ships can reach** storage, cookies, the network, the DOM, other shards or other players' data, whatever it contains | MUST | F |
| R3 | **A shard cannot hang the CPU or the GPU or crash the page**: its work is metered and a runaway is stopped, not waited on | MUST | F, N |
| R4 | Behaviour gives **the same result on the server and on the client** (M2, M3) | MUST | N |
| R5 | **Each shard keeps its own look** (toon, PBR, painterly, Jiehua Neon and the newer ones) | MUST | J |
| R8 | A mechanic many shards need can **graduate** into the platform | SHOULD | N |

### 3.5 Trust

| Id | Requirement | Level | Src |
|---|---|---|---|
| X1 | The six first-party shards keep a **custom runtime allowance** during the transition (§3.10) | MUST | J |
| X2 | **Self-hosted shards**: a shard on its author's own server, reached through a portal, outside the platform's trust boundary (identity crosses as a signed token). Later, after the grid (Jake, E435) | LATER | N, J |

### 3.6 Performance and budgets

| Id | Requirement | Level | Src |
|---|---|---|---|
| B1 | The reference device is the phone: **30 fps sustained hot**, 60-ready; memory within **1.0 GB in world, 1.8 GB while loading** | MUST | singleplayer budgets |
| B2 | Limits are **checked before play** (S3) and **enforced while playing**: a shard that overruns is degraded or stopped, never waited on | MUST | N |
| B3 | Assets are served content-addressed and cacheable; a shard boots offline once visited, within iOS's storage quota for a home-screen app | SHOULD | N |
| B4 | **A server budget per shard**: the server cost of a shard (time per tick, memory, players per room) is measured at upload under bot load, and a shard over budget is refused. An overloaded room slows down on purpose rather than crashing | MUST | N, J |

### 3.7 Multiplayer

| Id | Requirement | Level | Src |
|---|---|---|---|
| M1 | **The server is authoritative over everything shared** (Jake, E435, Fork C: full authority, hybrid): each shard runs as a **room** that runs the shared simulation headless (creatures, combat, loot, quests); phones send **inputs, not positions**, and predict only their own character; hits are settled on the server against what the player saw (a capped rewind); cosmetics (particles, flocks, wind) stay local and change no shared state. Server cost is load-tested early | MUST | F, J |
| M2 | The simulation runs **headless**: no renderer, no DOM. Hits are resolved from aim inputs, not from what the first-person view draws | MUST | N |
| M3 | World state is serialisable with **stable entity ids**; gameplay changes arrive as input commands, so snapshot → restore → replay is exact | MUST | N |
| M4 | Identity: log in or play anonymously. A **Name** with a **Title** beneath it | MUST | V |
| M5 | Chat: global, shard and proximity ; everything players and authors write is shown as plain text, and chat is moderated | MUST | V |
| M6 | A **player profile** above the shards travels between shards. **Two wallets** (Jake, E435): the profile holds only what the platform controls (identity, cosmetics, titles, achievements, and gear from the shared item catalogue at server-capped power tiers). **No global coin** (SHARD-PLATFORM G25). Anything a shard invents (its own items, keys, coins, progress) stays in that shard's save and never leaves it, except a signature item that passed catalogue review (G13) | MUST | V (R10), J |
| M8 | **One progress ledger**: only events the server witnessed can grant profile things (loot, XP, titles, achievements, activity credit), and every grant is idempotent: a disconnect, a retry or a lag switch never duplicates or repeats one | MUST | N, J |
| M9 | **Rooms have a measured cap and copies** (G26): start at 32 players; a full shard opens a copy with parties kept together; an author may set a lower cap | MUST | J |
| M7 | Shard modes and law (persistent, instanced, scheduled, competitive; PvP, gravity, permadeath) declared as data the server enforces. Later (Jake, E435): the first grid is PvE in persistent shards | LATER | N, J |

### 3.8 Upload and lifecycle

| Id | Requirement | Level | Src |
|---|---|---|---|
| U1 | **The upload ritual:** in localhost mode the author plants a beacon at the 8 corners and a 9th at the centre, then completes a ~30 s upload sequence. No CLI or API upload replaces it; the SDK never uploads | MUST | F |
| U2 | The server validates (A3) and quarantines a revision, then activates it all-or-nothing. Every revision is kept | MUST | N |
| U3 | **Live update with players inside, blue/green** (G17): players inside finish on the old revision (time-capped), new arrivals get the new one; only a shared-state schema change needs a coordinated cut-over. Schema changes are additive, or carry an author migration tested against real saves (G18) | MUST | V, J |
| U4 | **Private shards never leak**, including through public asset URLs | MUST | V |
| U5 | **The creator key** (Jake, E465 Q1): an author requests a key, which is their creator identity and signs their uploads; the upload itself is still the ritual (U1). The marketing site tells it in that order: key → build in Claude Code → ritual | MUST | J |

### 3.9 Ownership and the living grid

| Id | Requirement | Level | Src |
|---|---|---|---|
| O1 | Every shard records its **original author** and **last editor**; it is public or private | MUST | F |
| O2 | **Locking and grace periods** stop shards thrashing | MUST | F |
| O3 | **Collaboration:** invite editors; an editor downloads the current revision to edit it cleanly in Claude Code | MUST | F |
| O4 | **Renovation:** abandoned shards can be claimed by new authors | MUST | F |
| O5 | **No ghost-town centre:** rank, bin-pack, archive and relocate shards by meaningful activity (edits, play, authored quests, achievements, puzzles, pickups), **excluding the author**, resistant to farming. The centre stays fixed. What happens to players, saves and archived work on a move is defined | MUST | F |
| O6 | Moderation, **AI first with Jake on appeal** (G28): an AI pass against a written policy checks every upload, asset, author string and reported chat; borderline cases queue for a human; players report anything; copyright takedowns | MUST | N, J |
| O7 | **Public shards are always remixable** within Wildshard, with automatic attribution (G20); uploads carry their source (G19) | MUST | J |
| O8 | **Player building** (placing and destroying persistent things) comes later, after three brand-new shards built around building stress-test it (G7) | LATER | J |
| O9 | **Founding authors** (Jake, E465 idea 8): the first authors to upload get a permanent "Founding Author" title and a plaque on their shard. The marketing site promises it publicly, so the MMO keeps it | MUST | J |
| O10 | **The author owns the shard** (Jake, E465): the author keeps the rights to what they build; uploading grants Wildshard a licence to host it and show it in the world; a renovated shard keeps its original author's name (O1, O4). Playing is free; building is free with the author's own Claude Code; uploads are never charged | MUST | J |

### 3.10 The transition: the six shards keep working

| Id | Requirement | Level | Src |
|---|---|---|---|
| T1 | **Nothing breaks.** The shards on the singleplayer grid (Driftwood Isle, Pine Hollow, Nalati Grasslands) stay playable and live through every step; Signal Dunes and Sky Reach stay playable in dev mode and Nine Dragon Stack in DEVSERVER mode (SHARD-PLATFORM G46); the parity gate proves each step | MUST | J |
| T2 | **The 80/20 split, measured two ways** (Jake, E435): (1) **the public-SDK share**: ≥ 80 % of each first-party shard is built the way a player builds a shard (A0), and code outside the public SDK path counts as custom; (2) **the runtime ceiling**: the lines of TypeScript in the shard's `runtime/` are ≤ 20 % of the shard folder's TypeScript lines today. Moving code into a shared non-SDK library lowers neither. **Staged: 80/20, then 90/10, then 100/0** | MUST | J |
| T3 | The 20 % lives in each shard's `runtime/` folder, behind the shard API, under a per-shard ratchet that only falls. It shrinks later by graduation (R8) or a port to AssemblyScript behaviour (R1) | MUST | J |
| T4 | **New shards are born on the format** with no `runtime/` folder. One exception, confirmed by Jake in E435 after both audits flagged it: **Thin Ice** (shard 7) starts as code with the six's 20 % allowance and converts last (SHARD-PLATFORM Q1) | MUST | J |
| T6 | **The kit becomes the SDK** (Jake, E435): shared code that today's shards import at runtime is split over time into the public SDK (generation on the author's machine, and libraries an author's sandboxed behaviour may use) and platform built-ins behind the versioned API. The kit stays during the transition, as a stepping stone to 100/0, never as a way to lower a shard's count | MUST | J |
| T5 | Until the first public grid, single-player stays the shipping product | MUST | N |

## 4. What the singleplayer engine already gives us

Kept as they are: the four layers and their guards (ARCH-GUARDS: the engine names no game, shard or content); a shard
as manifest + plugin with opt-in mechanisms (`uses`); scope-owned resources with a load → unload leak test; the seeded
RNG and game clock; the typed event bus; versioned saves with migrations; budgets per shard measured by the gate; the
parity harness and the GPU gate; the template shard and the clean-room "shard 5" protocol; every shard manifest but the
template (200³; SHARD-PLATFORM SF1d fixes it) declares a 500 × 500 × 500 cell. The audit of what is missing is in SHARD-PLATFORM §2.

## 5. How we will know

In order (Jake, E435: package-first; seamless travel designed first):

| Milestone | Exit test |
|---|---|
| **The package** | The template boots from its shardfile with no trusted code and its simulation runs in Node with no renderer (SHARD-PLATFORM M1). A fresh author outside the repo building with only the SDK (A0, A6) is SHARD-PLATFORM's stretch goal S19 |
| **The crossroads** | SHARD-PLATFORM SF22a's synthetic 2 × 2 rig measured on the Simulator and once on a physical iPhone before the format freezes; then the real grid's crossroads (SF22): ≤ 0.85 GB peak, 95 % of frames ≤ 33.3 ms, no holes or falls, no shader compile at the first crossroads, no tab kill in three runs |
| **Multiplayer** | Two players in one shard on an authoritative server, from the same package, with the progress ledger |
| **Upload** | An outside author uploads a validated shard through the ritual and it appears on the grid |
| **The grid** | 25 shards live, seamless travel over the highway, profiles that travel |
| **80/20 → 90/10 → 100/0** (alongside) | Each first-party shard passes both T2 measures at each stage |

## 6. Decisions recorded (Jake, 2026-10-03)

1. **The vision is the MMO.** Single-player came first because the MMO is hard.
2. **Shards are 500 × 500 × 500 m.** This replaces the fundamentals' 500 × 500 × 200 and resolves VISION's open tension
   on Nine Dragon's 500 m stack.
3. **The 80/20 split:** 80 % data and approved systems (a logic system, look stacks, material graphs, WASM plugins),
   20 % custom runtime per shard, so nothing is rewritten in one go.
4. **The 20 % is the transition** that keeps the six existing shards working.
5. **WASM plugins are approved systems.** This amends the one-shot brief's ban on uploaded WASM (VISION's tension
   table) for sandboxed plugins behind the data-only host API.

6. **Requirements state constraints, not mechanisms** (E435): §1's "ship data and approved systems" became the
   constraint (safe by construction, metered, deterministic, versioned); decision 3's list of mechanisms is the
   plan's to pick (Fork B).
7. **Two wallets** (E435, P8 / M6): the profile carries only platform-controlled things; shard-invented items stay
   in the shard's save.
8. **No pocket spaces for now** (E435): W9 is cut; a shard is exactly its cell. It may return after the grid as a
   pocket with its own fixed budget.
9. **Needs, not mechanisms** (E435): §3.2–3.5 were rewritten as needs. The file layout, the CLI commands and the
   catalogue (logic system, devices, brains, phase tables, look stacks, material graphs, WASM plugins) moved out to
   SHARD-PLATFORM, which decides them after the E435 audits and Fork B. A5 merged into U1.
10. **Authors invent mechanics** (E435, R1), not only compose the platform's.
11. **Self-hosted shards are later** (E435, X2), not cut.
12. **Seamless travel and the far view are designed first** (E435, W7–W8): both were SHOULDs; they decide the
    format, the budgets and the rooms, so the crossroads (four shards in the near field) is the design case and a
    phone prototype precedes the format freeze.
13. **Any player can become a shard builder** (E435, A0), with the same skill, quickstart and CLI that first-party
    shards are built with: one path, no private first-party route.
14. **Full server authority, hybrid** (E435, Fork C, M1, M8): the server runs the shared sim; inputs not positions;
    own-character prediction; server-settled hits; local cosmetics; one idempotent progress ledger.
15. **80/20 measured two ways, staged to 100/0, and the kit becomes the SDK** (E435, T2, T6).
16. **Thin Ice stays code** (E435, T4): Jake kept Q1 after both audits flagged it.
17. **Shard modes and law are later** (E435, M7): the first grid is PvE.
18. **Server authority, cost and seamless travel are in scope** (E435, §5, §8); the milestones are re-ordered.
19. **AssemblyScript is the first behaviour language** (E435, O4 reversed from Rust first).
20. **One frame, per-shard grade** for several looks on one screen (E435, W7f); **simple borders** for the first
    grid (W7g); **the crossroads prototype is the second milestone**, after the package (§5).

## 7. Open decisions (each with a recommended answer)

| # | Decision | Recommended |
|---|---|---|
| O1 | The vertical split of the 500 m | **Decided (Jake, 2026-10-03): 250 m below the highway level, 250 m above** (`CELL_BELOW` / `CELL_ABOVE`, SHARD-PLATFORM SP4) |
| O2 | A hardcoded centre shard, or the one-shot's 9-cell citadel | **One hardcoded centre shard** (the fundamentals): one hub for vendors, the upload ritual and portals; the citadel can come later |
| O3 | Who may ship new behaviour | **Superseded (E435)**: behaviour is AssemblyScript in every shard (R1, decision 10); a reviewed catalogue applies only to signature items (SHARD-PLATFORM G13) |
| O4 | The first behaviour language | **Decided (Jake, E435): AssemblyScript first** (plain linear-memory Wasm, not WasmGC), on a language-neutral interface Rust can target later; QuickJS at most as a slow "any JS" fallback. Measured: about JIT speed, 5–9 KB modules, a compiler that runs inside Node, fuel metering and exact memory caps on V8 and JavaScriptCore, bit-identical maths |
| O5 | Live update with players inside | **Decided (Jake, E435, SHARD-PLATFORM G17): blue/green**, not evacuate |
| O6 | One shared look for the world, or one per shard | **One per shard**, made coherent by the shared lattice, highway and sky (Jake keeps each shard's own style today) |
| O7 | Material graphs need a node compiler | **Superseded (E435, SHARD-PLATFORM G4, G32)**: material families, then graphs, then restricted shader code, compiled per renderer; the shardfile is renderer-neutral |

## 8. Out of scope here

Pocket spaces (W9, cut by E435). Accounts and payments. Crafting. Accessibility features. (Server authority, cost and
seamless travel moved **in scope** in E435: they shape the package format, so they are designed before it freezes.)
