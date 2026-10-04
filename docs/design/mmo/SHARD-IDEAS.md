# Shard ideas

> **State:** ideas, not commitments. Written 2026-09-30. Each idea says what it would push or prove, so it can be
> picked when that capability is wanted. Terms are in [GLOSSARY.md](GLOSSARY.md); the platform these ideas assume
> is in [SHARD-PLATFORM-PLAN.md](SHARD-PLATFORM-PLAN.md).

## Contents

1. [When to build new shards](#1-when-to-build-new-shards)
2. [Five shards that push the engine, game and kit layers](#2-five-shards-that-push-the-engine-game-and-kit-layers)
3. [Four showcase shards for the platform](#3-four-showcase-shards-for-the-platform)
4. [Three shards that need full custom code](#4-three-shards-that-need-full-custom-code)
5. [Five expansions to the shard concept](#5-five-expansions-to-the-shard-concept)
6. [Where each idea lands in the phases](#6-where-each-idea-lands-in-the-phases)

---

## 1. When to build new shards

**Build no more code shards in the singleplayer repo before converting to data + generators. Four is the right
number; the fifth should be the first shard born as data.**

- **Four is enough to generalise from.** Four genres and four looks — toon island adventure (Driftwood), photoreal
  hunting forest (Pine Hollow), painterly mounted steppe (Nalati), vertical neon city (Nine Dragon). That spread is
  wide enough to design devices, archetypes and look stacks against.
- **Every code shard is conversion debt.** Driftwood alone is ~16k lines to sort into data, generators and engine
  devices; Nine Dragon is ~25k. A fifth code shard adds 10–25k more without teaching much the four don't.
- **Shard 5 is the real test.** GAME-NORMALIZATION already has a shard-5 clean-room protocol (11 Z3). Make shard 5
  the first shard written natively as `shard.json` + `content/` + `generators/`, by an author using only the SDK —
  stronger proof than converting old shards.
- **Before converting:** bring the Nine Dragon fragment to a stable stopping point (not the full nine-stratum
  stack); run GAME-NORMALIZATION with the six guardrails; run the Driftwood bake spike in parallel; then convert
  Driftwood → Nalati → Pine Hollow → Nine Dragon.
- **Exception:** a small prototype is fine if a new idea needs a mechanic the four lack (vehicles, a highway car).
  Build it shaped like a device — parameters plus events — so it becomes engine material, not more shard code.

The shards in §2 are therefore candidates for **shards 5, 6, 7…, built data-native after normalization.**

---

## 2. Five shards that push the engine, game and kit layers

Each forces capabilities the four current shards don't have — and that the MMO needs anyway.

### 2.1 The Underways — a deep mine and cave shard using the 100 m below ground

- **The shard:** caves, mine shafts, flooded galleries, mine-cart rails; lantern light is the only light.
- **Pushes the engine:** occlusion culling for rooms and interiors (nothing does this yet); many dynamic local lights
  under a budget; reverb zones; navigation through 3D cave volumes; real use of the shard's vertical range.
- **Pushes the kit:** light sources as devices; a rail vehicle; cave generators (signed distance fields baked to
  meshes).
- **Vision link:** interiors, stairs and locked rooms from the brief, and the 100 m below ground that no current
  shard uses.

### 2.2 Junction Town — a truck-stop frontier town on the highway

- **The shard:** wheeled vehicles, convoy raids, a gun-heavy outlaw faction, a town on the highway's edge.
- **Pushes the engine:** vehicle physics; streaming at driving speed; **seeing neighbouring shards from afar** as
  low-detail horizon impostors; crossing shard boundaries without a seam.
- **Pushes the game layer:** first-person guns — hitscan versus projectiles, cover.
- **Vision link:** highway cars and PUBG-style shooting and vehicles. The first shard about **the grid itself**.

### 2.3 Stormglass Peaks — an alpine climbing shard where weather is gameplay

- **The shard:** Guild Wars 2-style parkour and climbing; blizzards that cut visibility; avalanches; wind that pushes
  you; footprints in snow; cold as a resource.
- **Pushes the engine:** a player movement system with climb, mantle, slide and glide modes; weather that changes
  gameplay, not just visuals; snow that deforms underfoot; long vertical sightlines.
- **Pushes the kit:** climbable surfaces; rope and anchor devices; a weather director.
- **Vision link:** the brief's parkour and traversal readability, and the snow biome.

### 2.4 The Drowned Archive — a sunken library explored fully underwater

- **The shard:** swim in full 3D with breath, currents and buoyancy puzzles; drift between air-pocket rooms; creatures
  that hunt in three dimensions.
- **Pushes the engine:** navigation in open 3D water for swimmers and flyers (all current AI walks on navmeshes);
  water volumes as devices; underwater light shafts, caustics and fog; a player who swims in any direction
  (Driftwood only swims at the surface).
- **Unlocks:** the same 3D navigation serves flyers around the art direction's floating islands.

### 2.5 Hearthvale — a living village of 150 NPCs

- **The shard:** villagers with daily schedules (work, trade, sleep), opinions, reputation, gossip that spreads, shops
  that open and close, festivals.
- **Pushes the engine:** crowd simulation at scale; animation instancing; AI ticking at different rates by distance;
  NPC level of detail.
- **Pushes the game layer:** a dialogue system; reputation; NPC schedules as data; buildings you can enter.
- **Vision link:** the "shared, populated world" quality the brief takes from Black Desert Online.

**Suggested order:** Junction Town first — the one shard that tests the grid (streaming, neighbours, boundaries).
Hearthvale second — crowds are needed for multiplayer anyway. Then the Underways, Stormglass Peaks and the Drowned
Archive as the player movement and navigation work matures.

---

## 3. Four showcase shards for the platform

Buildable with data, devices, the logic graph, look stacks, material graphs and (where marked) tier-3 sandboxed
scripting. They show what an outside author could make once phase 2 exists.

### 3.1 The Clockwork Tide — a canal city on a 20-minute tide

- **Hook:** low tide opens streets and vaults; high tide turns rooftops into islands and boats replace roads.
  Players work sluice gates together to hold a district dry.
- **Built from:** a water body on a logic-graph timer; mover devices for gates, drawbridges and boats; trigger
  volumes that flood and drain zones; puzzles whose state depends on the tide; a watercolour look stack with a
  caustics material graph.

### 3.2 Skyforge Regatta — sky-sailing races through floating islands

- **Hook:** sailing ships, wind lanes, updrafts, slipstreaming behind rivals, seasonal leaderboards.
- **Built from:** a vehicle / mount device; force-zone devices for wind and updrafts; checkpoint triggers and a
  scoreboard; generator-baked islands; a toon look stack with a cloud-scatter material. *Scripted:* adaptive AI
  rivals that learn your racing lines.

### 3.3 Ashfall Bastion — a co-op siege on a volcanic fortress

- **Hook:** waves climb the ash slopes while lava flows reroute between waves. Players repair barricades and raise
  bridges; a multi-phase boss erupts from the caldera.
- **Built from:** spawner devices and a wave director with parameters; lava as mover and hazard devices on a
  timeline; buildable barricades as interactables; a boss phase table; a heat-haze material graph with an ash-grade
  LUT. *Scripted:* each wave adapts to how the squad is doing.

### 3.4 The Lantern Night Market — a social hub that only opens at dusk

- **Hook:** stalls run minigames — fishing, lantern darts, dumpling timing. A market economy, rare cosmetics and
  titles, and a fireworks show on the logic graph's clock where every player's lantern joins the display.
- **Built from:** shop and loot rows; minigames as logic graphs; cosmetics and titles as data; a neon look stack with
  bloom and a night LUT. *Scripted:* the dumpling timing minigame.

---

## 4. Three shards that need full custom code

These break the engine's assumptions too deeply for data or a fuel-limited script. They belong in the
**self-hosted portal tier**, or are candidates to **graduate** into the engine (e.g. a "destructible voxel volume"
device every author can use).

### 4.1 Shatterworks — everything is destructible

A Teardown-style voxel city: every wall, floor and tower can be cut, blown up or collapsed with real structural
physics; heists are planned around what you break.
*Why data can't do it:* its own voxel data structures, a custom mesher and physics every frame, GPU work, its own
renderer. No device or material graph covers changing world geometry in real time.

### 4.2 The Folded Monastery — impossible spaces

Manifold Garden / Antichamber style: corridors loop into themselves, rooms are bigger inside than out, gravity
follows the surface you walk on, portals show recursive views.
*Why data can't do it:* its own rendering pipeline (stencil tricks for recursive portals), its own camera and
physics rules, rewritten world coordinates.

### 4.3 Alchemy Pit — a falling-sand world

Noita style: every pixel is simulated material — sand, water, oil, fire, acid, gas — reacting chemically; spells are
built from the reactions.
*Why data can't do it:* millions of cells on a GPU cellular automaton every frame — custom compute and a custom
simulation, far past any fuel-limited script.

---

## 5. Five expansions to the shard concept

Beyond the platform mechanisms already planned (devices, logic graph, look stacks, material graphs, sandboxed
scripting, self-hosting), these change **what a shard is** or **how shards relate**.

### 5.1 Pocket shards — unbounded space behind a door

- Interiors, dungeons and towers live **off the grid** as sub-shards reached through doors or portals, free of the
  500 × 500 × 200 m limit.
- The grid stays tidy while depth becomes unlimited.
- **Resolves an open decision:** Nine Dragon's 500 m height. Its street level sits on the grid; the stack lives in a
  pocket.
- Engine needs: a portal / door transition that swaps the loaded space (builds on lock-in 9, in-page swap); pocket
  budgets of their own; validation that a pocket is reachable only through its declared doors.

### 5.2 The seams become gameplay — shards talk across the highway

- Shards declare what crosses their edges: a river flowing out under the highway, weather drifting over, sound
  carrying.
- Shards publish **cross-shard hooks**: a key earned in one shard opens a vault in another; a quest starts here and
  ends three shards over.
- Authors write against an **interface**, not a neighbour, so isolation (R5) survives: "I export `river.out` on the
  east edge"; "I accept any `ancient-key` item".
- The world feels woven together rather than tiled; the glowing lattice from the art direction becomes the place
  these exchanges happen.

### 5.3 Shard law — rules and modes for each shard

- Each shard declares its rules: PvP on or off, permadeath, low gravity, no weapons, how long a stay lasts.
- And its **mode**:
  - **persistent and shared** (the default);
  - **instanced** — party copies, as dungeons have;
  - **scheduled** — open only at certain times (the Night Market);
  - **competitive** — seasonal leaderboards (the Regatta).
- Same format, very different social shapes. The server enforces the law; the client only displays it.

### 5.4 Living shards — persistent shared state and seasons

- The whole community changes a shard over weeks: a bridge everyone contributes to, a forest that regrows, a boss
  that stays dead until the season resets.
- Shards can **age**: decay, ruins, "this place remembers" moments.
- Gives returning players a reason to come back, and gives popularity / GC (R6) a richer signal than visit counts.
- Engine needs: a server-held, per-shard **world state** separate from each player's save (builds on lock-in 8,
  serialisable state), with a schema the author declares and a season clock.

### 5.5 The author feedback loop — playtest data goes back to Claude Code

- Every shard produces **anonymous play telemetry**: heatmaps of where people died, got stuck, quit or lingered;
  which puzzles nobody solved; frame-time hotspots per device.
- It comes back to the author as a file Claude Code can read — "players quit at the cave mouth; here's a fix" — and
  the next upload acts on it.
- Claude Code as the editor is Wildshard's whole edge; this makes it an editor that **learns from players**.
- Engine needs: a telemetry schema, privacy rules (aggregate only, no player identity), a download route for
  authors, and a skill that turns the report into suggested changes.

### Runner-up: a shared generator library, with remixing

Generators run on the author's machine, so authors can safely share them as ordinary code packages — trees,
buildings, cave carvers, scatter rules. Remixing and forking public shards, with attribution and a family tree of
versions, comes with it.

---

## 6. Where each idea lands in the phases

Phases are defined in [SHARD-PLATFORM-PLAN §10](SHARD-PLATFORM-PLAN.md#10-phases-after-normalization).

| Idea | Earliest phase | Depends on |
|---|---|---|
| Shard 5 as the first data-native shard | 2 | Lock-ins 1, 2, 10 |
| Junction Town, Hearthvale, Underways, Stormglass, Drowned Archive | 2 (as shards 5–9) | Devices, archetypes, look stacks; each adds its own engine work |
| Clockwork Tide, Ashfall Bastion, Night Market (data parts) | 2 | Devices, logic graph, look stacks, material graphs |
| Scripted parts of Regatta, Ashfall, Night Market | 4 | The tier-3 scripting decision (conflicts with the brief) |
| Shatterworks, Folded Monastery, Alchemy Pit | 4 | Self-hosted portal shards, or graduation |
| Pocket shards | 2 | In-page swap (lock-in 9) |
| Seams / cross-shard hooks | 3 | One world (R10), the profile scope (lock-in 6) |
| Shard law and modes | 3 | Server authority, rooms |
| Living shards and seasons | 3 | Serialisable state (lock-in 8), server-held world state |
| Author feedback loop | 3 | Multiplayer telemetry; a local version can start in 2 from playtests |
| Generator library and remixing | 2 | `wildshard bake`, generators as packages |
