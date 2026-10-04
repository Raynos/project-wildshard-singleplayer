# Wildshard shard platform — the future plan

> **State:** reference, 2026-10-03 — the thinking behind the MMO route, written 2026-09-30, before GAME-NORMALIZATION
> was archived. **Overtaken in four places:** (1) the requirements now live in [MMO-REQUIREMENTS.md](MMO-REQUIREMENTS.md)
> (Jake, 2026-10-03: shards are 500 m tall; WASM plugins are an approved system; the 80/20 split); (2) phase 2a, the
> 80/20 pass, is the plan [`docs/plans/SHARD-PLATFORM.md`](../../plans/SHARD-PLATFORM.md); (3) the six guardrails of §9
> were never folded in — GAME-NORMALIZATION was archived on 2026-10-01 without them, so SHARD-PLATFORM picks up G-2,
> G-5 and G-6 as its first rows; (4) "build no more code shards" (§9) was overtaken: the clean-room test built Signal
> Dunes and Sky Reach as code shards, so there are six to carry over, not four.
>
> "Singleplayer" below means this repo ([Raynos/project-wildshard-singleplayer](https://github.com/Raynos/project-wildshard-singleplayer)).
> "The one-shot" means [Raynos/project-wildshard](https://github.com/Raynos/project-wildshard) `origin/main`.
>
> Companion docs: [VISION.md](VISION.md) (the full requirements, including the one-shot's binding brief),
> [ONE-SHOT-REVIEW.md](ONE-SHOT-REVIEW.md), [GLOSSARY.md](GLOSSARY.md), [SHARD-IDEAS.md](SHARD-IDEAS.md).

## Contents

1. [The vision in one page](#1-the-vision-in-one-page)
2. [Where things stand today](#2-where-things-stand-today)
3. [How far GAME-NORMALIZATION gets us (R1–R10)](#3-how-far-game-normalization-gets-us-r1r10)
4. [The core problem: custom code](#4-the-core-problem-custom-code)
5. [The answer: build with code, ship data, earn scripting](#5-the-answer-build-with-code-ship-data-earn-scripting)
6. [Mechanics, looks and creative swings](#6-mechanics-looks-and-creative-swings)
7. [Worked example: Driftwood Isle as data + generators](#7-worked-example-driftwood-isle-as-data--generators)
8. [The top 10 lock-ins](#8-the-top-10-lock-ins)
9. [Sequencing: fold in six guardrails now, the rest is phase 2](#9-sequencing-fold-in-six-guardrails-now-the-rest-is-phase-2)
10. [Phases after normalization](#10-phases-after-normalization) (incl. [10.1 the 80/20 pass](#101-phase-2a-the-8020-pass))
11. [Super shards: what the platform can and can't build](#11-super-shards-what-the-platform-can-and-cant-build)
12. [Open decisions](#12-open-decisions)
13. [Next steps](#13-next-steps)
14. [Sources](#14-sources)

---

## 1. The vision in one page

Project Wildshard is a **multiplayer online sandbox MMO** in three.js + TypeScript, browser-first. Players log in or
play anonymously in one big world made of **shards** (chunks), each **authored by a player** — using Claude Code, the
Wildshard skill, CLI and API as the building UI — and **uploaded** to the server. Players either build in Claude Code
or play in the browser.

From `sources/WILDSHARD.md` and `sources/wildshard/FUNDAMENTALS.md` (singleplayer repo; the same files live in the
one-shot under `project/`), the requirements, numbered so the rest of this doc can refer to them:

| # | Requirement |
|---|---|
| **R1** | A shard is a **self-contained package** (zip / tarball) built against a framework and library Wildshard provides |
| **R2** | The package is a **strictly validated format with hard limits** — anti-grief, anti-perf-abuse |
| **R3** | Non-geometry content — NPCs, quests, items, achievements, cosmetics, titles, puzzles, doors — is **loaded by the server as config, never as arbitrary code** |
| **R4** | **Fixed size and edge contract:** 500 × 500 × 200 m (100 m down, 100 m up); a 15 m highway grid between shards (no-man's land owned by the server); a 15 m road entering 50 m at each of the 4 edge midpoints, level with the highway — no wall or cliff may block an edge |
| **R5** | The **centre shard is hardcoded** in the game; every other shard is authored **in isolation** (a floating cube) and the **server decides where it goes** |
| **R6** | **Upload API / CLI / skill;** auth; versions; original author + last editor; public / private; locking and grace periods; invites and collaboration (download the current version to edit it); GC / bin-packing / reshuffling by popularity so the centre is not a ghost town |
| **R7** | **Multiplayer:** each shard has a host (server + room), the server is authoritative, players have identity (login or anonymous), chat |
| **R8** | **Live update** of a shard while players are inside it (warning, evacuation, float, timer — to be designed) |
| **R9** | The **in-game upload ceremony:** run the game in localhost mode, plant beacons at the 8 corners and the 9th in the centre, and do the 30-second upload animation |
| **R10** | **One world:** travel between shards over the highway, shared player identity, inventory and progression |

Note that the two source documents pull in different directions. `WILDSHARD.md` says authors upload "literally a
tarball or zipfile of some threejs code". `FUNDAMENTALS.md` says custom things beyond geometry follow "a very specific
format that the server must be able to load as config without loading arbitrary code". This plan resolves the
tension in favour of FUNDAMENTALS — and goes further: even the geometry code runs **at build time on the author's
machine**, and only its output ships (§5).

---

## 2. Where things stand today

### The repos

| Repo | What it is |
|---|---|
| `project-wildshard` (the one-shot) | A vibe-coded "ultra loop" one-shot attempt at the whole MMO. ~86k lines of TS (server ~52k, client ~17k, shared ~17k) + 306 test files, 824 commits, last push 2026-09-18. Broad, unpolished. **The local checkout at `~/projects/games/project-wildshard` is stale at the 7-commit scaffold**; the real work is on `origin/main` (bb608d4). |
| `project-wildshard-singleplayer` | Smaller scope, single-player only, heavily steered and polished. Four shards on one engine. ~906 source files. Live at <https://wildshard-singleplayer.vercel.app/>. |

### The four singleplayer shards

| Shard | Look | Shard-specific code (approx.) |
|---|---|---|
| **Driftwood Isle** (default) | Faceted low-poly toon | ~16k lines: 5.5k in `src/chunks/driftwood-isle*` + ~10.5k in engine folders (`src/world/*`, `src/entities/species/*`, `src/game/quest/*`, `src/audio/Island*`…) |
| **Pine Hollow** | Photoreal PBR | 5.2k in `src/chunks/pine-hollow` + 6.8k in `src/pinehollow` + engine-folder code |
| **Nalati Grasslands** (early access) | Painterly | 4.0k in `src/chunks/nalati-grasslands` + 9.5k in `src/nalati` + engine-folder code |
| **Nine Dragon Stack** (prototype, partial) | 界画霓虹 Jiehua Neon | 25.5k in `src/chunks/nine-dragon-stack` (108 files) |

Across the shard folders alone that is ~56k lines of shard-specific TS, and **52 of those files write their own
shader code** (`ShaderMaterial`, `onBeforeCompile`, inline GLSL). Note the singleplayer repo's own README is stale:
its opening still describes "a single pine forest chunk" and its Shards section says "Three shards".

### What the one-shot built (for reference only)

The one-shot is **not** the base to build on — its shard-file format is considered buggy and is not to be trusted
or ported. It is still useful as a map of the problem, because it attempted every requirement:

- **A `.shard` ZIP** with a `chunk.json` manifest (entries with sha256 + size), 19 JSON schemas in
  `content/schema/`, every limit in one `content/schema/budgets.json`, and server-owned fields (chunk id, revision,
  placement, host) kept **out** of the manifest.
- **An 11-stage validator** (`src/server/upload/pipeline.ts`): container → manifest → entries → strict JSON → denied
  keys → schema → ids/refs → budgets → semantics/behaviour → assets → spatial (road entries checked as *walkable*).
- **Declarative behaviour:** event → condition → action rules with fuel and cascade limits, interpreted by a pure
  `dispatch()` that returns effects (ADR 0007, `src/shared/behaviour/*`). No uploaded code ever runs.
- **Server:** hand-written WebSocket server, 30 Hz sim / 15 Hz snapshots, one room per shard, cross-host handoff,
  revision swap with players inside via drain → evacuate → swap → re-admit (`lifecycle.ts`).
- **Ownership:** a one-editor lock, invitations, privacy, popularity = distinct visitors over 30 days excluding the
  author, takeover of abandoned shards (90/30/30-day clock), nearest-free-cell placement.
- **Partial or absent:** the 9-beacon ceremony is real server-side but the visible UI is a file picker; no chat, no
  accounts (HTTP Basic + an anonymous cookie id), no host bin-packing, no load tests; status `release_ready:false`.

Ideas worth stealing **as ideas** (not code): budgets in one file referenced by schemas; server-owned fields kept out
of the manifest; quarantine → atomic head flip for activation; a pure effect-returning behaviour interpreter;
spatial checks that prove road entries are walkable; popularity that excludes the author. Ideas to avoid: its very
heavy paper trail (ADRs, journals, gate evidence) relative to working code.

---

## 3. How far GAME-NORMALIZATION gets us (R1–R10)

GAME-NORMALIZATION (`docs/plans/GAME-NORMALIZATION.md` + `docs/plans/game-normalization/00–13`, ~11k lines,
estimated 24–33 agent-days) makes the four shards one shape: shard folders under `src/shards/<slug>/`, a layered
engine, a `ShardContext` plugin API, shared systems, a gate. Its stated scope is single-player ("No netcode", index
line 260). Assessed against the vision:

| Req | Status | Evidence |
|---|---|---|
| **R1** package | **Partial, source-level** | Shards are folders compiled into the build: generated registry (F9), service worker precaches every shard (decision 29), shared `public/assets`; per-shard assets (TP18) deferred to "after" (index §8, 11 Z4). Layer lint and public-index-only imports (01 §0, F4) and an `api: 1` version (01 §7) are good foundations. |
| **R2** validation, limits | **Partial, trust-based** | CI checks on trusted code: TS types, `defineShard` id checks, node-safe manifest test, lint ratchets, GPU-gate budgets per shard (01 §13.4, 03 §15). No schema for shards (valibot is "only for saves", decision 17), no static caps. |
| **R3** content as config | **Against** | DC7 "No JSON data parsed at runtime" marked *honoured* (00-traceability:369); decision 17 typed TS rows; decision 67 behaviour as subclasses; `SpeciesRow` holds `brain: new (…)` and a `mesh` thunk (01 §19); Pine's quest is 605 lines of code (06 §6.5). Near-data pieces: `EffectDef`, `DamageRuleDef`, `StrikeSpec`, `WeightedTable`, profile rows. |
| **R4** size, edges | **Not a contract** | The road rule exists in code (`entryRoadMask`, `src/chunks/terrain.ts:72`) and F6 moves it, but the plan never names it. Structure-first shards skip terrain (index §2.3). `placement.size: [500,500,500]` is per-manifest (01 §6) and contradicts 200 m; Nine Dragon is 500 m tall. |
| **R5** centre, placement | **Against** | Authors set `placement.grid` (01 §6, decision 61); `DEFAULT_SHARD = 'driftwood-isle'` (F9); no centre concept. |
| **R6** upload, ownership | **Absent; one rule against** | Decision 57: "the API may change as long as every in-repo shard moves with it" (index:264, 01:316, 00-traceability:109) — the opposite of keeping uploaded shards working. |
| **R7** multiplayer | **Door only** | `sim-no-render` lint, but only over `src/engine/{combat,ai,saves,quests,effects}` (01 §24); weapons fuse hit detection with the first-person view (01 §18); hit-stop slows the global fixed step (01 §1); seeded RNG + game clock (01 §2); decision 56 marked partial (G12). |
| **R8** live update | **Building block** | Shard resources owned by `ctx.scope`, leak test proves unload frees everything (01 §4, F8, 03 §5.5) — but one App per page, travel is a page reload (01 §5, §7, decision 21). |
| **R9** ceremony | **Absent** | — |
| **R10** one world | **Partial, deferred** | Travel is "a type and a page-reload implementation" (01 §20). Coins, inventory, gear saved per shard (01 §9, F10). `travels` flag default off (decision 75). Gap G10's fix names an **X9** row that does not yet exist in the index or `10-sweeps.md` (wildshard-6 said its next pass would add it). |

**Estimate:** ~15–20% of R1–R10 overall; ~40% of the engine-side prerequisites (layers, scope/unload, sim/render
seam, seeded RNG, event bus, versioned saves, budgets per manifest, the shard-5 clean-room author test). The rework
risk is concentrated in R3 and R1: every shard migrated as code now is content that must be converted again later.

What is **good** and should survive as-is: the layering and lint, scope-owned resources with the leak test, the
seeded RNG and clock, the event bus, versioned saves with migrations, budgets declared per shard and measured by the
gate, and the Z3 shard-5 clean-room protocol ("file API gaps instead of editing the engine").

---

## 4. The core problem: custom code

Shard-specific runtime code is a security, performance and bad-actor problem all at once:

- **Security:** TS/JS running on players' machines can read cookies and storage, call `fetch`, rewrite the DOM,
  phish, mine, or exfiltrate. Lint rules don't stop a malicious uploader — only a runtime boundary does.
- **Performance:** one bad shard can tank every player in it: infinite loops, memory bombs, 50M-triangle scenes,
  GPU-hanging shaders.
- **Bad actors:** offensive geometry, griefing mechanics, exploits against the server's authority.
- **Multiplayer:** code that runs only in the browser can't be server-authoritative; code that runs on the server is
  a server-side sandbox problem.

How other UGC platforms answered it — every one that lasted converged on **uploaders mostly don't ship code**:

| Platform | Answer |
|---|---|
| Roblox | Its own language (Luau) and VM, throttling, a large moderation operation. Works; took years and a big team. |
| Minecraft | Code mods are client-side and opt-in (install at your own risk); server plugins are trusted code the server owner chooses; Bedrock marketplace add-ons are mostly data + a narrow script API. |
| Fortnite UEFN | Its own language (Verse) plus review before publishing; Creative's devices before that. |
| Second Life | Every script runs server-side, heavily throttled — and sims still lag from bad scripts. |

### Would WASM fix it?

About half of it.

**WASM solves:**
- **Capabilities.** A module can call only the imports it is given — no DOM, `fetch`, cookies, `localStorage`,
  `window`. The host API becomes the security boundary, and it is small enough to audit.
- **Caps.** Hard memory ceilings; wasmtime fuel metering on the server; in the browser, run in a Worker and kill it
  on overrun.
- **Same code both sides.** One `.wasm` runs identically in browser and server — a shard's custom gameplay can be
  server-authoritative without writing it twice. For multiplayer this is the bigger win.

**WASM does not solve:**
- **Shaders.** GLSL / WGSL runs on the GPU; WASM can't sandbox it. A shader can hang the GPU or tank frame rate.
- **Budgets.** A sandboxed module can still emit 50M triangles; outputs still need counting and caps.
- **Content.** A sandbox can't judge offensive geometry — that needs moderation.
- **Host-API bugs.** The attack surface moves to whatever you expose; every host function must validate inputs.

**WASM costs:**
- **No direct three.js.** Modules talk to the engine by handles and buffers ("spawn mesh from asset 12", "write 400
  transforms into this array"), not `new THREE.Mesh`. All existing shard code would be rewritten against that API.
- **A source language.** WASM is a target. Options: **AssemblyScript** (TS-like, stricter, thin ecosystem),
  **Rust** (strong with Claude Code, a big shift), or **QuickJS compiled to WASM** — keeps TypeScript and the
  sandbox, but runs roughly 20–50× slower than the browser's JIT. Fine for run-once or 30 Hz code, bad for per-frame
  hot loops.

Conclusion: WASM is the right tool for a **small, earned, sandboxed scripting tier** (§5, tier 3) — not the default
for everything. Don't commit to it now; commit to an **API shape that keeps it possible** (lock-in 2).

---

## 5. The answer: build with code, ship data, earn scripting

Sort shard code by **where it runs**, and give each kind its own home:

| Kind of shard code | Where it runs | What ships | Safety |
|---|---|---|---|
| **Generators** — procedural terrain, trees, buildings, props, scatter, bakers, Blender scripts | The **author's machine**, at build time (`wildshard bake`) | Their **output**: GLB, KTX2 textures, heightmaps, instance lists, audio | Nothing to sandbox; the validator counts the outputs against budgets |
| **Gameplay content** — items, NPCs, creatures, quests, loot, shops, doors, puzzles, feats, bosses | The engine, on server and client | **Data:** schema-validated JSON, wired to engine devices and the logic graph | No code; server-loadable config (R3) |
| **Runtime visuals** — water, wind, particles, special materials, post-processing | The engine's renderer | **Data:** look stacks + material graphs with parameters | Validated node types, cost caps, auto-degrade |
| **Genuinely custom runtime logic** | A sandbox (WASM / QuickJS), server-authoritative | A small script module | Fuel, memory caps, data-only host API, **earned access**, review before public |
| **Anything beyond that** | The author's **own server**, or upstream into the engine | A portal, or a PR | Outside our trust boundary, or reviewed |

Three access tiers:

1. **Everyone: data + engine devices + baked generators.** Safe, fast, covers most shards. Claude Code still writes
   unlimited generator code — it just never runs on someone else's machine.
2. **Mechanics graduate into the engine.** When a shard needs something the engine can't do, it becomes a reviewed
   PR adding a device / material node with parameters that **every** shard can then use (Minecraft-style: popular
   mods become the base game). The Z3 shard-5 protocol's "file API gaps" is this pipeline in miniature — make it
   permanent.
3. **Trusted authors earn sandboxed scripting**, later. Opt-in, reviewed, never the default for anonymous uploads.

Does this break the Wildshard idea? **No — it moves where the code runs.** Claude Code stays the authoring UI;
FUNDAMENTALS already drew the "config, not code" line for everything but geometry; and in Driftwood ~10k of ~16k
lines are generators, which stay unlimited custom code under this model.

What is genuinely lost, and how §6 answers each:
- **New runtime mechanics** — e.g. Nine Dragon's grapple and cable cars, Nalati's horse riding: an outsider can't
  invent a system the engine lacks → devices + logic graph + graduation.
- **New shaders and looks** → look stacks + material graphs.
- **Big creative swings** → sandboxed scripting for trusted authors, self-hosted portal shards, graduation.

---

## 6. Mechanics, looks and creative swings

### 6.1 New runtime mechanics: devices + a logic graph

The model is **Fortnite Creative devices** and **LittleBigPlanet logic**: authors compose mechanics from parts.

- **Devices.** A large engine kit of components with parameters: movers / platforms on waypoints, trigger volumes,
  spawners, timers, counters, teleporters, gravity and force zones, ropes, grapple points, mounts, vehicles,
  projectiles, doors, pressure plates, pushable bodies, scoreboards, guides, display pieces with stages. Most already
  exist inside the four shards — Driftwood's zipline and rope bridge, Nine Dragon's grapple hook and lifts, Nalati's
  horse — and need to become generic.
- **The logic graph.** Devices fire signals into a data graph of events, conditions, variables, arithmetic, timers
  and state machines. Expressive enough for a racing minigame, a gravity puzzle or wave defence. Runs with fuel, on
  the server, and on the client for prediction.
- **Versioned mechanics.** Shards declare `requires: ["grapple@1", "mount@2"]`; the engine guarantees those versions
  keep working.
- **Archetype brains + boss tables.** Creature AI becomes engine archetypes with parameters (melee pack, ranged
  thrower, humanoid melee, grazer herd, flyer…); bosses become phase tables (trigger, spawn, HP thresholds, move sets
  from the engine's strike library).

### 6.2 New shaders and looks: look stacks + material graphs

- **Material graphs.** three.js **TSL node materials** stored as a JSON graph — like Unreal's material editor or
  Unity's Shader Graph. The validator allows only approved node types and caps node count, texture samples and an
  estimated cost; the engine compiles the graph to WGSL / GLSL. Authors never write shader code. Covers water,
  glowing runes, dissolves, vertex wind, caustics, heat haze.
- **Look stacks.** The post-processing chain becomes a stack of engine passes with parameters: tone mapping, toon
  ramp, painterly filter, outlines, bloom, fog, colour grading, film grain.
- **Colour lookup tables.** A 3D LUT is just a texture — a lot of colour freedom almost for free.
- **Baked looks.** Generators can bake lighting, vertex colours and painted textures (Driftwood already bakes its
  island in Cycles), so much of a shard's look lives in its assets anyway.
- **Runtime safety.** If a shard runs slow on a device, the engine lowers its quality tier automatically.
- **Sky, weather and day cycle** are data: palettes, keyframes, fog curves.

The first three look stacks are the existing shards' looks: **toon** (Driftwood), **PBR** (Pine Hollow), **painterly**
(Nalati); **Jiehua Neon** (Nine Dragon) is the fourth.

### 6.3 Big creative swings: two escape hatches + graduation

- **Sandboxed scripting for verified authors.** WASM, or QuickJS for TS authors, with fuel, memory caps and the same
  data-only API as the logic graph. Runs server-side, so it works in multiplayer. Earned by account trust; reviewed
  before the shard goes public.
- **Self-hosted shards.** FUNDAMENTALS already says every shard has a host — let authors run their own. A
  self-hosted shard can run any code, in an isolated cross-origin frame on the author's server; the main world links
  to it through a **portal** on the grid, players see a "custom shard" warning, and identity crosses as a **signed
  token**, never a session. The same trust model as the open web or itch.io.
- **Graduation.** A swing that proves popular is absorbed into the engine as devices / material nodes, and every
  author gets it.

---

## 7. Worked example: Driftwood Isle as data + generators

Source: the inventory in `project/archive/game-normalization/08-driftwood.md` §1 plus file headers.
Driftwood is ~16k lines; almost all of it fits three buckets, and **the uploaded shard contains no code**.

### 7.1 Bake it (generator → assets) — ~10k lines

- **Models.** The 27 builders in `src/chunks/driftwood-isle/models/*.ts` (shipwreck 802, shrine 526, lookout 395,
  hut 387, pier 341, rope bridge 294, boat 285, trophy plaques 245, reef 237, hibiscus 201, palm 184, trailside 167,
  trader 125, sea-glass chime 121, zipline 117, captain's hat 108, cove 106, cargo 99, sailcloth cape 96, and small
  rocks / logs / fish) already follow a model contract (`src/models/model.ts`). Run them in Node at build time,
  export one **GLB per model**, and keep named anchors (hut door, shrine pool, altar) as glTF nodes.
- **World builders** in `src/world/*` (Hut, Pier, Palms, Boat, Boulders, Bushes, Lookout, Wreck, Shrine,
  RopeBridge geometry, Seabed, Trailside, Cove, Waterfall geometry, coverTint — ~4.1k lines) bake the same way.
- **Terrain is already baked:** `BlenderIsland.ts` loads the island that `scripts/blender/driftwood-isle/` builds in
  Blender and bakes in Cycles. The procedural cove underneath becomes the bake source, not runtime code.
- **Ground cover** (`GroundCover.ts`, 830 lines): bake the scatter (per 16 m cell) to instance lists; streaming cells
  round the player becomes a generic engine **scatter** device.
- **Creatures and NPCs** (crab, monkey, sailor, the Drowned Captain, Wendell the castaway, the trader; ~2.4k lines
  incl. `lowpoly.ts`, `captainMesh.ts`, `faceHeads.ts`): bake to **rigged GLBs** with animation clips.
- **First-person arms, the iron sword, cosmetics** (`fpArms.ts`, `IronSword.ts`, hat, cape, chime): GLBs.

### 7.2 Engine components with parameters — ~3k lines move into the engine

| Today | Becomes |
|---|---|
| `Ocean.ts` + `waves.ts` | Engine **water** device: palette, Gerstner wave parameters, foam (`waves.ts` is already planned to move to the engine) |
| `stylize.ts`, `StylizedSky.ts`, `DayNight.ts` keys | The **toon look stack**: ramp bands, shadow colour, rim, sky palette, day keyframes as data |
| `Gulls.ts` (603), reef fish | Engine **flock** device: perches, count, bounds |
| `RopeBridge`, `Zipline`, `ropeChain.ts` | Engine **traversal** devices placed by anchors (`ropeChain.ts` already planned to move) |
| `Waterfall.ts` | Engine **flow / particle** device |
| `IslandAmbience`, `IslandSfx`, `ShrineHum`, `Surface` | An `AmbienceZones` profile + sound files |

### 7.3 Gameplay becomes data — ~3k lines

- **Interactables are already pure data** (`src/world/interact/driftwood.ts`, validated by `validateTable`).
- **The quest** (`Adventure`, `Spine`, `driftwood`, `Complete`, `Ecology`, `Places`… ~1.1k): `Adventure.ts`'s own
  header says "everything it adds is data". Steps over flags → a quest graph in JSON. `gullGuide.ts` → an engine
  **guide** device.
- **Loot, shop, coins, perks, feats, items** → rows (09 already plans much of this).
- **Keepsake displays** (the chime showing sea glass at 0 / 5 / 10 / 15) → an engine **display with stages** device.
- **Enemies:** spawn tables → data; brains → engine archetypes: crab → melee pack, monkey → ranged thrower (coconut as
  a projectile row), sailor → humanoid melee.
- **The Drowned Captain** (`captain.ts` + `Finale.ts`) → a boss table: trigger `used:altar`; rises from the shrine
  pool; phases by HP thresholds, each a move set from the strike library.

### 7.4 The package

```
driftwood-isle/
  shard.json        identity, look: toon {…}, water, day keys, ambience, budgets, requires[]
  layout.json       places, anchors, spawns, paths
  content/          items · npcs · creatures · quests · interactables · loot · shop · feats · boss
  assets/           island.glb · models/*.glb · creatures/*.glb · scatter/*.bin · audio/* · thumbs
  generators/       today's TS builders + Blender scripts — author-side only, never uploaded
```

### 7.5 Where it gets hard

1. **The Captain fight.** 08 demands frame-for-frame parity; a phase-and-strike table can give "the same fight,
   data-driven", not byte-identical.
2. **Creature animation.** If motion is code-driven (procedural legs, IK), it bakes to clips or becomes an engine
   animation component. Not yet measured.
3. **Every new look, archetype or device is engine work.** Intended: the engine grows, shards shrink to data.

### 7.6 Pilot order

Driftwood first (island already baked, interactables already data, small low-poly assets), then Nalati, then
Pine Hollow (photoreal, streamed forest), then Nine Dragon (25k lines, its own mechanics).

---

## 8. The top 10 lock-ins

Ranked by leverage: how cheap the change is while GAME-NORMALIZATION is already moving every file, against how
expensive it would be to retrofit. **MP** = unblocks multiplayer, **UP** = unblocks uploading.

### 1. A shard is data plus baked assets; code runs on the author's machine (MP + UP)
- **Change:** each shard ships `shard.json`, `layout.json`, `content/*.json` and assets. Today's TS builders and the
  Blender scripts become `generators/`, run by `wildshard bake`, never shipped.
- **Plan edits:** reverse DC7, decision 17 and decision 67 for shard content; give content files schemas; 05–08
  change each shard's destination from "a plugin folder of TS" to "content + generators".
- **Done when:** Driftwood boots from its JSON and assets with none of its builders in the runtime bundle.

### 2. The shard API passes only data, and is versioned (UP)
- **Change:** no `ctx.app`, no three.js objects, no subclassing engine classes (`Weapon`, `Tool`, `CreatureBrain`,
  `BossBrain`), no raw DOM in HUD widgets. Every verb takes and returns plain data, ids and typed arrays.
  Capabilities granted through `uses`. Shard code lint-banned from DOM, `fetch`, `window`.
- **Plan edits:** 01 §7; replace decision 57 with a versioned API and a compatibility window.
- **Done when:** the whole surface could be proxied over `postMessage` — which keeps the WASM / QuickJS tier and
  self-hosted shards possible.

### 3. Gameplay is engine devices wired by events; the simulation runs headless (MP)
- **Change:** shared systems become devices with parameters; brains become archetypes; bosses become phase tables;
  shards declare `requires`. Extend `sim-no-render` to all gameplay — kit, shards, weapons, brains, quests, player
  movement, physics. Split weapons into "resolve a hit from an aim input" and "draw the view". Hit-stop is
  visual only.
- **Plan edits:** 01 §0, §1, §18, §19, §24; 09; the sweep order in 10.
- **Done when:** the template shard's simulation runs in Node with no renderer.

### 4. Looks are stacks of engine passes plus material graphs; shards ship no shader code (UP)
- **Change:** toon, painterly, PBR (and Jiehua Neon) become look stacks: passes with parameters, a LUT, TSL material
  graphs as validated JSON. The 52 shard files with shader code migrate into those.
- **Plan edits:** remove `ShardRender.compose` and open shader-patch access from 01; 05–08's look sections (e.g.
  08 §6.3 B) target stacks.
- **Done when:** no file under `src/shards/**` contains GLSL or a raw `ShaderMaterial`.

### 5. The fundamentals are engine rules, enforced by a validator (UP)
- **Change:** 500 × 500 × 200 m and the four 15 m edge road entries become engine constants. Grid placement belongs
  to the server; authors don't set `placement.grid` or `size`. `wildshard validate <dir>` checks schemas, static caps
  (bytes, triangles, entities, rows), the road entries (walkable, not just present) and material-graph budgets.
- **Plan edits:** 01 §6; F6 names `entryRoadMask` as a contract; 03 adds the validator to the gate. Decide Nine
  Dragon's height (§12).
- **Done when:** every in-repo shard passes the validator in CI.

### 6. A player profile above the shards (MP)
- **Change:** inventory, coins, gear, progression and identity live in one `profile` scope that travels by default.
  Per-shard saves hold only that shard's world state. All of it behind a store interface a server can back later.
- **Plan edits:** 01 §9, the F10 save-key table, decision 75; write the missing X9 row.

### 7. Shards are packages loaded from a URL (UP)
- **Change:** pull per-shard assets (TP18) in; externalise the engine behind an import map; a shard loads as bundle +
  `shard.json` + assets from a URL, replacing the build-time registry (F9) and precache-everything (decision 29).
- **Done when:** shard 5 loads from a URL and is never in the build.

### 8. World state that can be serialised, with stable entity ids (MP)
- **Change:** every live entity has a stable id; sim state snapshots to JSON and restores exactly; gameplay changes
  arrive as input commands, not direct calls.
- **Unlocks:** saves, netcode, reconnects, live shard updates.
- **Done when:** snapshot → restore → replay is identical in the determinism proof (03 §9).

### 9. Swap shards inside the page, without a reload (MP + UP)
- **Change:** the App can unload one shard and load another while running (the scope leak test already proves
  unload). Replaces decision 21 and 01 §20's page-reload travel.
- **Unlocks:** seamless highway travel (R10) and live updates with players in place (R8).

### 10. Authoring tools as a product (UP)
- **Change:** one `wildshard` CLI — `new`, `bake`, `validate`, `pack`, `preview` — plus a Claude skill;
  `docs/SHARDS.md` becomes the SDK docs.
- **Plan edits:** redefine Z3 so a clean-room agent builds shard 5 **outside the repo** using only the CLI and SDK
  docs, and produces an uploadable package.
- **Note:** the CLI never uploads. The brief says "do not substitute a CLI uploader" for the beacon ritual (R9), so
  `pack` produces the package and the in-game ritual sends it.

---

## 9. Sequencing: fold in six guardrails now, the rest is phase 2

**Decision proposed: run GAME-NORMALIZATION mostly as written, and make §8 the next plan.**

Why not merge everything into normalization:
- Normalization **builds what phase 2 needs**: shard folders, layering, scope ownership, the event bus, versioned
  saves, the gate. Content-as-data, devices and look stacks all need shards to already have one shape.
- Merging would turn a 24–33 agent-day plan into a much bigger one just as its council is about to lock it.
- The rework risk is **narrow**: only where normalization creates *new* things in the wrong shape. Moving files is
  fine either way.

### The six guardrails to fold in now

Mostly spec wording and lint ratchets; little change to the 04 move map; roughly 1–2 extra agent-days.

| # | Guardrail | Where in the plan |
|---|---|---|
| G-1 | **Shard API rules.** New verbs take/return plain data, ids, typed arrays — no three.js objects. Ratchet `ctx.app` uses down. No *new* extension points by subclassing engine classes (existing brains / weapons / tools can stay subclasses as engine internals). Rewrite decision 57 to "the API is versioned; stability promises start in phase 2". | 01 §7, decision 57 |
| G-2 | **Rows must be serialisable.** Item, effect, loot, species and profile rows hold no functions or closures; `brain` and `mesh` fields point to registered ids. A test checks every row round-trips through JSON. Already-data tables (Driftwood's interactables) stay data. Softens DC7 / decision 17 without converting anything yet. | 01 §19, 09, DC7 |
| G-3 | **Widen `sim-no-render` as a ratchet** over kit and shard folders, with a count that only goes down. Make hit-stop visual only. | 01 §1, §24, 09 |
| G-4 | **No new shader hooks for shards.** Freeze `ShardRender.compose` and shader-patch access at today's uses under a ratchet. Existing shaders move as they are. | 01, 05–08 look sections |
| G-5 | **The fundamentals as named contracts.** F6 names `entryRoadMask` as an engine contract; `placement.grid` and `size` marked server-owned (dev-only for now); record the open decision on Nine Dragon's height. | 01 §6, F6 |
| G-6 | **Reserve a `profile` save scope** in the F10 key table (even unused) and write the missing X9 row. Changing the key table later means migrating saves. | 01 §9, F10, X9 |

### How many shards before converting

**None.** Build no more code shards in the singleplayer repo before phase 2. Four shards (four genres, four looks)
are enough to design devices, archetypes and look stacks against; every further code shard is 10–25k lines of
conversion debt. Bring Nine Dragon's fragment to a stable stopping point, then make **shard 5 the first shard born
as data** through the Z3 clean-room protocol. A small prototype of a missing mechanic (vehicles, a highway car) is
fine if it is shaped like a device. Details: [SHARD-IDEAS §1](SHARD-IDEAS.md#1-when-to-build-new-shards).

### Deferred to phase 2

Everything else in §8: content as data with baked generators, devices and the logic graph, look stacks and
material graphs, the CLI and validator, URL packages, in-page swap, serialisable state, the profile in use, shard 5
out of the repo.

---

## 10. Phases after normalization

| Phase | Name | Contents | Exit test |
|---|---|---|---|
| **1** | GAME-NORMALIZATION (+ G-1…G-6) | As planned in singleplayer, with the six guardrails | The plan's own M1–M4 milestones; guardrail ratchets in the gate |
| **2** | SHARD-PLATFORM | Lock-ins 1–10: shard = data + assets; data-only versioned API; devices + logic graph + archetypes + boss tables; look stacks + material graphs; validator + CLI; URL packages; in-page swap; serialisable state; profile scope | All four shards boot from packages with no shard runtime code; shard 5 built outside the repo with only the CLI + SDK docs; template sim runs headless in Node |
| **3** | MULTIPLAYER + UPLOAD | Authoritative server running the headless sim; rooms and hosts; identity (login + anonymous); chat; upload API + auth; versions, authorship, public / private, locks and grace; placement on the grid (centre shard fixed); live update with players inside; the 9-beacon ceremony; popularity + GC | Two players in one shard; an outside author uploads a validated shard that appears in the world |
| **4** | CREATIVE TIERS | Sandboxed scripting (WASM / QuickJS) for trusted authors; self-hosted portal shards with signed identity tokens; the graduation pipeline from shard requests to engine devices | A trusted author ships a scripted mechanic; a self-hosted shard is reachable by portal |

Parallel, now: the **Driftwood bake spike** (§13) to give phase 2 evidence before it is written.

### 10.1 Phase 2a: the 80/20 pass

**Proposed as the first step of phase 2:** get the four post-normalization shards to **~80% data and assets, ~20%
code**, rather than 100% data in one go. Take the cheap, high-volume conversions first; leave the hard, low-volume
code where it is, as trusted first-party code under a ratchet.

**The metric.** For each shard: shard-specific **runtime** TS lines (code that ships and runs in the player's
browser) against everything else that defines the shard — data rows, layout, baked assets, and generator code that
runs only at build time. Generator lines count on the data side, because they no longer ship. The target is
runtime code ≤ 20% of each shard's pre-conversion runtime lines. The gate reports the number per shard and
ratchets it down.

**The 80% — convert these:**
- **Generators → baked assets.** Model builders, world builders, terrain, scatter and creature meshes run under
  `wildshard bake` and ship as GLB, instance lists and heightmaps. The biggest bucket by far (Driftwood: ~10k of
  ~16k lines).
- **Tables → data.** Items, loot, shops, coins, feats, interactables, spawn tables, places, ambience profiles and
  first-minute hints become schema-validated JSON. Much of this is already data-shaped.
- **Generic visuals → engine devices with parameters.** Ocean / water, flocks (gulls, fish), scatter streaming,
  ropes and ziplines, waterfalls and particles — anything that two shards could share.
- **Quests → quest graphs** where the quest is steps over flags (Driftwood's `Adventure.ts` already says "everything
  it adds is data").

**The 20% — keep as trusted first-party code for now:**
- **Bosses and unique fights** — the Drowned Captain, the Antler King — where parity matters and a phase table
  would lose feel.
- **Unique mechanics** not yet worth a generic device — Nine Dragon's grapple, lifts and cable cars; Nalati's horse.
  Each is a graduation candidate later.
- **Custom shaders and look code** until the look-stack and material-graph work exists (lock-in 4).
- **Procedural animation** that doesn't bake cleanly to clips.

The 20% lives in a clearly marked `runtime/` folder per shard, behind the data-only `ShardContext` (lock-in 2), so
it can later move into the engine, into data, or into the scripting tier one piece at a time.

**Order:** Driftwood (island already baked, interactables already data, small assets) → Nalati → Pine Hollow → Nine
Dragon. Shard 5 is born data-native alongside, and should need **no** `runtime/` folder at all.

**Exit test:** every shard reports ≤ 20% runtime code in the gate; Driftwood boots with all of its builders out of
the runtime bundle; no shard's `runtime/` folder grows.

**Why 80/20 first:** it captures most of the security, size and multiplayer benefit — what remains is a small,
known, first-party code surface — at a fraction of the cost of the long tail (bosses, unique mechanics, looks).
It also answers open decision 8 for now: first-party shards may keep a ratcheted 20%; outside authors get 0%.

---

## 11. Super shards: what the platform can and can't build

Moved to [SHARD-IDEAS.md](SHARD-IDEAS.md), which collects every shard idea in one place:
- **Four showcase shards** buildable on the platform — The Clockwork Tide, Skyforge Regatta, Ashfall Bastion, The
  Lantern Night Market (§3 there).
- **Three that need full custom code** — Shatterworks, The Folded Monastery, Alchemy Pit (§4 there).
- **Five shards that push the engine, game and kit layers** — The Underways, Junction Town, Stormglass Peaks,
  The Drowned Archive, Hearthvale (§2 there).
- **Five expansions to the shard concept** — pocket shards, seams as gameplay, shard law and modes, living shards
  and seasons, the author feedback loop (§5 there).

---

## 12. Open decisions

1. **Nine Dragon's height.** *Decided 2026-10-03: shards are 500 m tall (Jake).* FUNDAMENTALS says 200 m tall (100 down, 100 up); Nine Dragon is a 500 m stack and the
   plan writes `placement.size: [500,500,500]`. Either Nine Dragon fits 200 m, the fundamentals change, or tall
   shards become a special (first-party only?) class. **Candidate answer:** pocket shards
   ([SHARD-IDEAS §5.1](SHARD-IDEAS.md#51-pocket-shards--unbounded-space-behind-a-door)) — the street level sits on
   the grid and the stack lives in an off-grid pocket.
2. **Centre shard.** FUNDAMENTALS hardcodes one centre shard; the one-shot later moved to a 9-cell "citadel" of
   ordinary shards. Which one?
3. **Scripting language** for tier 3: AssemblyScript, Rust, or QuickJS-in-WASM (keeps TS, slower).
4. **Live update UX** (R8): evacuate-and-return (what the one-shot did), float into the sky, a 5-minute warning, or
   teleport to centre.
5. **How much parity to demand** when Driftwood's Captain and creatures move to boss tables and archetypes.
6. **The brief's ban on uploaded WASM and unrestricted shaders.** The one-shot's binding brief (§2) says never
   accept uploaded "JavaScript, TypeScript, WASM, native modules or unrestricted shader programs". Material graphs
   are restricted, so they arguably fit; a tier-3 WASM / QuickJS scripting tier does not, and would need a
   deliberate amendment to the vision. Self-hosted portal shards sidestep it (their code never runs on our hosts
   or in our origin).
7. **"One coherent visual language"** (brief §5) vs four look stacks in one world. Are looks per shard, or does the
   shared world pick one?
8. **Whether phase 2 keeps TS shards as a trusted first-party path** (the four in-repo shards) while outside authors
   are data-only, or whether first-party shards follow the same rules. Provisional answer: first-party shards keep
   a ratcheted ≤ 20% runtime code during the 80/20 pass (§10.1), and the long-term aim is the same rules for
   everyone, because that proves the SDK.

---

## 13. Next steps

1. **Send the six guardrails (§9) to wildshard-6** before GAME-NORMALIZATION's council round locks the plan.
2. **Run the Driftwood bake spike** on a free agent, without touching normalization: bake `shoreBoulder`, `palm` and
   `hut` to GLB, load them from a `layout.json`, compare screenshots against the current build. If they match, bucket
   7.1 — the most code — is proven.
3. **Audit the 56k lines** of shard code into generator / runtime visual / gameplay logic / engine-device candidate,
   per shard, to size phase 2.
4. **Fix the stale singleplayer README** (one pine forest, "Three shards").
5. After normalization lands: write phase 2 (SHARD-PLATFORM) as a plan in the singleplayer repo from §8, starting
   with the **80/20 pass** (§10.1). The audit in step 3 gives each shard's baseline runtime-code number.

---

## 14. Sources

- Singleplayer: `sources/WILDSHARD.md`, `sources/wildshard/FUNDAMENTALS.md`, `docs/SHARDS.md`,
  `docs/plans/GAME-NORMALIZATION.md`, `docs/plans/game-normalization/00–13`, `src/chunks/*`, `src/world/*`.
- The one-shot (`origin/main` bb608d4): `project/charter/BRIEF.md`, `project/adr/`, `content/schema/*`,
  `src/server/upload/pipeline.ts`, `src/shared/behaviour/*`, `src/server/net/*`, `project/GAME-REFERENCES.md`.
- Session: 2026-09-30, a Claude Code planning session.
