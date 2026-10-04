# Wildshard — the vision

> The canonical statement of what Project Wildshard is meant to be, gathered in one place from the four source
> documents scattered across the other repos (listed at the bottom). When this doc and a plan disagree, this doc is
> the target and the plan is the route. Last gathered: 2026-09-30. **Superseded in part on 2026-10-03** by
> [MMO-REQUIREMENTS.md](MMO-REQUIREMENTS.md) (Jake's decisions: 500 m tall shards, WASM plugins as an approved system).

## In one paragraph

A **first-person, multiplayer, browser sandbox** on a **custom three.js / WebGL / TypeScript engine**. The world is a
grid of **shards** (chunks), each **authored by a player**. **Claude Code is the level editor:** an author builds a
shard locally, in isolation, with the Wildshard framework, skill and tools, then uploads it through an **in-game
ritual**; the server validates it, places it on the grid, and other players explore it in the browser. Players can
log in or play anonymously. Players either build in Claude Code or play in the browser.

## The world

- **Shard size:** 500 m × 500 m × **500 m** (Jake, 2026-10-03; was 500 × 500 × 200 — 100 m below ground, 100 m above;
  the new vertical split is [MMO-REQUIREMENTS](MMO-REQUIREMENTS.md) O1). Shard-local `x/z ∈ [-250, 250]`,
  `y ∈ [-100, 100]`, highway ground at `y = 0`. Adjacent shard centres are 515 m apart.
- **The grid:** the first shared deployment is **5 × 5 = 25 shards**: one centre, two out in each direction.
- **The highway:** **15 m wide, server-owned** roads between all shards — a no-man's land owned by the game server.
- **Edge entries:** at the midpoint of each of the four edges, a **15 m wide road runs at least 50 m in**, level with
  the highway. Terrain there must meet the highway; no wall or cliff may close an edge. The check is that the
  entrance is **navigable** (ingress, clearance, terrain continuity), not that four road objects exist.
- **The centre shard** is hardcoded; it changes only with a server release and is not player-editable.
- **Isolation:** authors build on a **floating cube** with no knowledge of neighbours and no say in placement. The
  **server assigns placement.** Shard identity, revision, placement and hosting are separate things.
- **Hosting:** each shard is its own game instance — **a room keyed by shard id on a configurable, trusted host.**
  Most early rooms live on the main host.

## What a shard contains, and how it is loaded

- An upload is a **strictly validated archive**: geometry, parameterised items, NPCs, quests, puzzles,
  achievements, cosmetics.
- Custom behaviour is **declarative data**. The server must load it **as config, never as arbitrary code**. The
  binding brief is explicit: *never accept uploaded arbitrary executable code, JavaScript, TypeScript, WASM, native
  modules or unrestricted shader programs.*
- The format has **hard limits** against griefing and performance abuse.

### Mandatory authoring capabilities (may not be dropped)

Geometry · parameterised items (weapons, equipment) · enemy NPCs · quest-giver NPCs · declarative scripted quests ·
collectibles / exploration / puzzles · doors and windows, locked or not · shard achievements (and "virtues") ·
cosmetic equipment including hats and capes · earned titles. **Crafting is out of scope** (a future feature).

## Ownership, collaboration and the living grid

- Every shard records its **original author** and **last edited by**.
- Shards are **public or private.** Private archives must never leak through public asset URLs.
- **Locking and grace periods** stop shards thrashing.
- **Collaboration:** invite others to edit; they download the current revision to edit it cleanly in Claude Code.
- **Renovation:** old or abandoned shards can be taken over by new authors.
- **Avoid a ghost-town centre:** rank, bin-pack, archive and relocate shards by **meaningful activity** — edits and
  uploads, play, and interaction with authored quests, achievements, puzzles and pickups — while **preventing
  trivial activity farming**. Keep the fixed centre; define what happens to active players, saved progress and
  archived work when a shard moves.

## Uploading is a set piece

Uploading is an **in-game localhost staging ritual**: run the game in localhost mode, place **eight corner beacons**
(underground and sky corners must be reachable in staging) and a **ninth at the centre**, then complete a roughly
**30-second** upload animation. The brief says plainly: *do not substitute a CLI uploader for this experience.*

## Live updates

When a shard is updated while players are inside, it must be handled — options raised so far: a "new shard
incoming" warning, a 5-minute leave timer, floating players into the sky, teleporting them to the centre, or
evacuate-and-return. Revision replacement while occupied, relocation mid-session, room capacity, migration and
crash recovery are **required design decisions with tests**, not future work.

## Gameplay material

Material to **derive a tight design from**, not a checklist to implement. Retained mechanics should **reinforce
authorship and exploration**.

- **Traversal:** a staging-only hoverboard, cars on the highway, auto-pathing to far shards, Guild Wars 2-style
  parkour.
- **Combat:** first-person shooting and melee — knife (PUBG pan / Counter-Strike), guns, bow, crossbow; health,
  damage, respawning; NPC enemies.
- **Content:** quest NPCs and quests; picking up weapons and items; armour and cosmetics; pressure plates, pushable
  blocks and barrels; keys; doors, windows, interiors, stairs, locked rooms; chests and locked chests.
- **Social:** global, shard and proximity chat (WoW-style); a player **Name** with a **Title** beneath it.

## References — qualities, never assets

| Reference | Contributes | Does **not** contribute |
|---|---|---|
| Minecraft | Player authorship as the core loop | Its art style |
| Black Desert Online | The feel of a shared, populated world | Its genre and perspective |
| Conan Exiles | First-person sandbox embodiment | Its survival systems |
| PUBG | Shooting feel, item pickup, vehicles | Battle-royale structure |
| Skyrim / Oblivion | Melee and archery feel | Its fiction |
| Guild Wars 2 | Parkour and traversal readability | Its combat model |
| Breath of the Wild | Exploration pull — "what is over there?" | Its art style |

No copied proprietary assets.

## Art direction

Distinct biomes with **deliberately visible seams** — desert, snow, forest, wetland, volcanic waste, crystal
badlands. A **glowing boundary lattice and light columns** stitch the grid together. **Floating islands and ancient
ruins** give identity. One coherent visual language — not unrelated asset packs, not a default Minecraft look. See
the concept art in [`concept-art/`](concept-art/).

The singleplayer repo has since explored **four** distinct looks (faceted toon, photoreal PBR, painterly, Jiehua
Neon) — an open question is whether "one coherent visual language" becomes "one engine, several look stacks"
(see [SHARD-PLATFORM-PLAN §6.2](SHARD-PLATFORM-PLAN.md#62-new-shaders-and-looks-look-stacks--material-graphs)).

## Known tensions in the sources

| Tension | Where | Status |
|---|---|---|
| "Upload literally a tarball of three.js code" vs "the server loads it as config, not arbitrary code" | `WILDSHARD.md` vs `FUNDAMENTALS.md` and the brief | Resolved in the plan: generator code runs on the author's machine; only data and assets ship |
| The brief bans uploaded WASM and unrestricted shaders | Brief §2 vs SHARD-PLATFORM-PLAN tier 3 (sandboxed scripting) and material graphs | **Decided 2026-10-03 (Jake):** sandboxed WASM plugins behind a data-only host API are an approved system; material graphs are validated data. See [MMO-REQUIREMENTS](MMO-REQUIREMENTS.md) R6, R7 |
| "Do not substitute a CLI uploader" | Brief §2 vs the plan's `wildshard` CLI | Compatible if the CLI only does `new` / `bake` / `validate` / `pack` / `preview` and **uploading itself always goes through the ritual** |
| 200 m tall shards vs Nine Dragon's 500 m stack | Fundamentals vs singleplayer | **Decided 2026-10-03 (Jake):** shards are 500 m tall |
| Hardcoded centre shard vs a 9-cell "citadel" of ordinary shards | Brief vs the one-shot's later product contract | **Open** |
| "One coherent visual language" vs four looks | Brief §5 vs singleplayer | **Open** |

## Sources

| Document | Repo | Path |
|---|---|---|
| The pitch | singleplayer (also the one-shot's README) | `sources/WILDSHARD.md` |
| World fundamentals | singleplayer, the one-shot | `sources/wildshard/FUNDAMENTALS.md`, `project/FUNDAMENTALS.md` |
| Game references and feature wishlist | the one-shot | `project/GAME-REFERENCES.md` |
| Full product brief (v1, binding for the one-shot), 2026-09-12 | the one-shot, `origin/main` | `project/charter/BRIEF.md` |
