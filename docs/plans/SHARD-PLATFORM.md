# Plan: SHARD-PLATFORM — MMO-compatible shardfiles in the singleplayer game (E431, E435)

**State:** `draft` 2026-10-04 — **rewritten from Jake's E435 grill** (47 answers, §10) and the clean-room audits
(the [Wildshard MMO Review](../reviews/wildshard-mmo-review.md)). **P0 done** (SP0–SP5); its guards are made honest
in F0. Next: **up to six council rounds** on this rewrite (G44); the plan goes `ready`, and F0 starts, after them.
Owned by the shard-platform agent, working the plan with Jake. Requirements: [MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md).

## 0. Read this first

Jake, E431 (2026-10-03): *"high level the vision is the MMO. … a high level plan to get to the 80/20 split. The 80/20
split can be 80% data and approved systems … The remaining 20% is custom runtime per shard so we don't have to rewrite
everything in one go."*

Jake, E435 (2026-10-03), the scope (G41): *"This plan and goal is purely to make shardfiles that are MMO & multiplayer
compatible, I do not want to build any multiplayer code, I want to refactor the singleplayer game to be about running a
singleplayer three.js game that contains shardfiles that are MMO/multiplayer compatible."*

**The goal.** The singleplayer game becomes a three.js game that runs **shardfiles**: validated, self-contained build
products that a future MMO server could load unchanged. A shardfile is compatible when its simulation steps headless in
Node, gives bit-identical results in Node and WebKit, separates authoritative server scripts from presentation client
scripts, and grants rewards only through a ledger interface (G45). Singleplayer runs all of it locally.

**This plan builds:** the shardfile format; the singleplayer runtime that loads and streams shardfiles; a seamless
**singleplayer grid** of shards joined by the highway and generated no-man's land (G46); the SDK, CLI and local builder
tools (G47); the platform systems shards build on; and the conversion of the existing shards toward 80/20, then 90/10,
then 100/0.

**This plan does not build:** servers, rooms, netcode, an upload service, moderation, source storage, remixing or a
catalogue service (G41, G47). Their decisions (G13, G17, G19, G20, G26, G28) are requirements the format must be
compatible with. **WorldClaw is out of scope** (G47); it has its own plans.

**The words:**
- **Shardfile:** the build product: a manifest (`shard.json`), tiles with levels of detail, content rows, baked assets,
  AssemblyScript modules, declared budgets and state schema. Renderer-neutral (G32). Nobody edits it by hand (G1).
- **Shard project:** the author's TypeScript source: generators (run on the author's machine; never ship) and
  AssemblyScript behaviour. `wildshard build` turns it into a shardfile.
- **Platform systems:** engine and kit code every shard may use through the versioned SDK API: material families, the
  script host, brains, quests, rigs, the commons, UI kit, audio, physics toys, crowds and so on.
- **Custom runtime:** a first-party shard's own trusted TypeScript that ships. Transition only, in `runtime/`, measured
  by T2's two measures.

## 1. The measures

Two measures per first-party shard (Jake, E435, T2), staged **80/20 → 90/10 → 100/0**:
1. **Public-SDK share:** the share of the shard built the way a player builds a shard (A0): through the shardfile and
   the public SDK. Code that imports a non-public engine module or runs outside the script sandbox counts as custom.
2. **Runtime ceiling:** TypeScript lines in the shard's `runtime/` ≤ 20 % of the shard folder's TypeScript lines at the
   baseline (`lint/shard-platform.json`, `b96fed1a1`). Moving code into a shared non-SDK library lowers neither.

And, because a percentage alone was gamed once already (the audits), **milestone booleans** the gate reports: the
template boots from its shardfile with no trusted shard chunk; its sim steps in Node; the Node-vs-WebKit hash test
passes; a fresh author outside the repo builds a shard with only the SDK.

## 2. Where it stands (measured, E435 audits)

The 10-03 audit table this section used to hold had no committed source; both clean-room audits found its numbers
wrong or unreproducible (`ctx.app` is 95–97, not 127; `ctx.game.runtime` 32 in the newest two shards, not 61; 3–4
direct `Weapon` subclasses, not 10; the per-shard "custom today" percentages were estimates). SF2 replaces it with a
committed measuring script. What holds:

- **Every shard is 100–107 % custom by today's script**: nothing is sorted into `data/` or `generators/` yet, and the
  shards grew past their baseline within hours.
- **The loader instantiates trusted plugins** and hands them `App`, DOM nodes and mutable services
  (`src/game/shard/pluginLoad.ts`, `ShardContext`). There is no upload security boundary yet; the four layers organise
  trusted code.
- **The sim is not headless or deterministic**: the aim ray comes from the viewmodel camera (`combat/Weapon.ts`);
  hit-stop scales the fixed step (`core/Game.ts`); `ai/reach.ts` pulls in the whole app; `Animal` imports three.js;
  host `Math.sin` / `cos` / `atan2` differ between V8 and JavaScriptCore (Pine Hollow's combat maths mismatched on up
  to 42,949 of 200,000 inputs).
- **The template declares a 200³ cell**, not 500³. Nine Dragon passes the world-contract test against a flat datum it
  never draws; Sky Reach skips it.
- **Memory**: one shard alone uses 153–587 MB of phone GPU memory (`src/shards/*/budgetCeilings.ts`); shards are
  monolithic levels, not tiles. Travel is a page reload (`src/game/travel/travel.ts`).
- **What the engine already gives, and stays**: data quests (`QuestDef`, `validateQuest`); ten data interactable
  kinds; versioned saves with valibot; scope-owned resources with a leak test; seeded RNG streams and the game clock;
  the typed event bus; per-shard budgets in the parity and GPU gates; the four layers and their guards.

## 3. Shape of the work

```
P0 (done) ─► F0 honest foundations ─► F1 the shardfile ══► M1 the package
                                                │
            ┌───────────────────────────────────┼──────────────────────────┐
            ▼                                   ▼                          ▼
   F2 the singleplayer grid ══► M2       L  platform systems lane     SDK + UX lane
   (streaming, seams, one frame,          (director, rigs, brains,    (dev + QR, preview,
    travel, the crossroads gates)          UI kit, audio, toys,        playtests, starters,
            ▲                              crowds, interiors …)        quickstart, upgrade)
            │
   C  conversion lane: each shard → shardfile, 80/20 (from M1, when its agents are idle)
```

- **F0** is small and lands first: the audits' fixes and the determinism blockers.
- **F1** is deliberately thin (G42): the least that proves the boundary.
- After M1, **F2, L, SDK and C run in parallel lanes**. The grid opens with three shards (G46), so it waits on C for
  Driftwood, Pine Hollow and Nalati to stream as tiles.
- The format freezes only after F2 and the first conversions have pushed on it; until the public grid the API window
  is about 72 hours (G29).

## 4. Rows

### P0 — Guardrails and the metric (before any move)

| Row | What | Done when | Size |
|---|---|---|---|
| SP0 | This plan and the requirements doc ([MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md)) | **done** `4a95c2454` (E431) | S |
| SP1 | **Fix `sim-no-render`'s scope**: the rule named `engine/quests` and `engine/effects`, which never existed, so `engine/quest` went unchecked. Now `ai`, `combat`, `events`, `quest`, `saves` less their `view` parts, all at 0; a test fails when a listed folder doesn't exist (the hole ARCH-GUARDS AG24 missed). Widening it over kit and shard code moves to SP5: it needs the `data/` and simulation folders to know what is simulation | **done** (this commit): a planted renderer import in `engine/quest` now fails; the quest and event code passes at 0 | S |
| SP2 | **Reserve the `profile` save scope** (SHARD-PLATFORM-PLAN G-6): the scope exists in `SaveStore`, no key uses it yet; the travel handoff names it as its future home | **done** (this commit): `SaveScope` has `profile` (own document, exported / imported like `global`, mirrored in the native shells); no level namespace may take a scope's name | S |
| SP3 | **Rows are serialisable** (SHARD-PLATFORM-PLAN G-2): a test round-trips every registered row (items, effects, damage rules, strikes, loot, spawns, species, bosses, interactables, quests, day keys) through JSON. Function-valued fields become **named ids** into an engine registry (`weight: 2` or `{ fn: 'weight.distance' }`; `when: { flag: … }`); a ratchet counts the function fields left (StrikeSpec.weight, WeightedTable.when ×19, think / act, curves, WeatherProfile) | **ratchet done** (this commit): `scripts/check-row-data.mjs` walks 44 content row types with the TypeScript compiler; **45 function fields** today (SpeciesLook 9, DayCycleSpec 7, WeatherProfile 4, NpcRow 4, LevelAudioProfile 4, BowProfile 3, the tables' `when` 3, think / act, StrikeSpec.weight …) in `lint/row-functions.json`, which may only shrink; `test/row-data.test.ts` fails a new field and locks the pure-data rows (effects, damage rules, bosses, encounters, interactables, quests). Turning the 45 into named ids is P2 / P3 work, field by field | M |
| SP4 | **The world contract** (SHARD-PLATFORM-PLAN G-5, MMO W1–W6). Jake 10-03: the 500 m cell splits **250 m below and 250 m above** the highway level (O1); Driftwood (open sea) and Sky Reach (floating islands) are **exempt now and fixed in P5** (SP22, SP23). Built: `CELL_HEIGHT` / `CELL_BELOW` / `CELL_ABOVE` in `@wildshard/engine/data`; `test/world/world-contract.test.ts` holds every level's ground inside the cell and level with the highway across each edge entry (15 m wide, 50 m in); `lint/edge-exemptions.json` may only shrink. Moved: the full walk from each edge (colliders, water, structures) is SP10's validator; `placement` leaving the manifests is SP29 (server-owned fields leave the package) | **done** (this commit): all seven levels pass; the exempt two are listed with their fixing row | M |
| SP5 | **The metric and the folders**: `generators/`, `data/`, `runtime/` join `lint/shard-layout.json` (AG9) and SHARDS.md; `lint/shard-platform.json` with today's baselines; the gate prints each shard's custom share; `wildshard/no-runtime-generator`; the chunk check for `generators/`; `sim-no-render` widened over each shard's `data/` and simulation folders and the kit's (from SP1) | **done**: part 1 (`94c4a55ed`) the three folders in `lint/shard-layout.json` and SHARDS.md; `check-chunks` refuses generator code in any chunk; `scripts/shard-platform.mjs` prints each shard's custom share against `lint/shard-platform.json` (baselines at `b96fed1a1`, every shard 100 % today: nothing is sorted yet) and `test/shard-platform.test.ts` holds the ceilings; a shard's ceiling is enforced from its conversion row on. Part 2 (this commit): `wildshard/no-runtime-generator` (hard in `.oxlintrc.json`: only generators import a `generators/` module, template specifiers included), `sim-no-render` over `src/shards/*/data/` (`SHARD_SIM_DIRS`; 0 sites, no shard has one yet), and `scripts/vercel-tree-gate.sh` prints the share table. The kit's and the shards' other simulation folders join when P2 creates them | M |


### F0 — Honest foundations (the audits' fixes and the determinism blockers)

| Row | What | Done when | Size |
|---|---|---|---|
| SF1 | **Make P0's guards honest.** Shrink-only lists compare against `HEAD` (`row-functions.json`, `edge-exemptions.json`, the `shard-platform.json` ceilings); an unknown shard or an unlisted row type fails; `ShardManifest` and `ground.terrain` join the row walk; a real JSON round-trip test over every `data/` folder; no `runtime/` folder for the template or a new shard; the world-contract test fails a flat datum that isn't drawn and lists Sky Reach's exemption explicitly; the template declares 500³ | A planted growth, an unlisted row type, a function in `data/`, a template `runtime/` and a fake datum each fail the gate (one fixture per rule) | M |
| SF2 | **Measure, don't estimate.** `scripts/shard-coupling.mjs` prints each shard's `ctx.app` / `ctx.game` / `ctx.game.runtime` reaches, engine subclasses and non-data `ShardContext` members, committed with a ratchet against `HEAD` | The numbers in §2 come from the script; a rise fails | S |
| SF3 | **Headless means the whole import graph.** `sim-no-render` follows the import closure from the simulation folders: no three.js beyond the maths types, no `app/runtime`, no DOM | `ai/reach.ts` and `Animal` are fixed or listed; a planted transitive import fails | M |
| SF4 | **One deterministic maths library** (`sin`, `cos`, `atan2`, `exp`, `pow` …) used by all simulation code; a lint bans host `Math.*` trig in sim folders; a test runs the combat maths in Node and in WebKit (Playwright through `scripts/browser-lane.sh`) and requires identical bits | Pine Hollow's `combatMath` and the shared sim pass the hash test; the parity gate holds | M |
| SF5 | **The netcode blockers, fixed in singleplayer**: aim from input, not the viewmodel camera; hit-stop visual only; stable entity ids independent of tile and LOD; RNG and clock state export and restore; the sim driven by recorded input commands, so record → replay is exact | A recorded template session replays to the same state hash; parity identical | M |
| SF6 | **The two measures** (§1) in `scripts/shard-platform.mjs` and the push gate: the public-SDK share and the `runtime/` ceiling, plus the milestone booleans; today's line metric is renamed "legacy TS" | The gate prints both measures and the booleans per shard | S |

### F1 — The shardfile (thin, G42) → **M1 the package**

| Row | What | Done when | Size |
|---|---|---|---|
| SF7 | **Format v0** (`docs/SHARDFILE.md` + valibot schemas): `shard.json` (identity, the API version it targets, requires, budgets, look), the tile hierarchy (62.5 / 125 / 250 / 500 m, encoded in the manifest), content-addressed files with a dependency graph and declared compressed, decoded and GPU sizes, the state schema, server and client script declarations, the edge profile, privacy classes. Renderer-neutral (G32); unknown keys refused | One rejection fixture per rule; the schema is the SDK's API v0 | M |
| SF8 | **`@wildshard/sdk` and the `wildshard` CLI**: `new`, `dev` (the real client on the floating cube, hot reload), `build` (generators → bake → shardfile), `validate` (schemas, references, budgets, cell bounds, the edge walk through colliders, a headless Node step of the sim) | A new project builds and validates on a clean machine | M |
| SF9 | **The auto-baker v0** (G5): terrain and static props cut into tiles with LOD0, LOD1 and a far proxy; KTX2 → ASTC; scatter as instance lists over shared prototypes; a per-tile budget report; hand overrides | The template's world bakes and loads from tiles; parity within the board tolerance | L |
| SF10 | **Material families v1** (G4 stage 1): two or three engine families (toon, PBR, emissive) with rich parameters, compiled by the engine, precompiled before first use | The template uses only families; no shard shader code in its shardfile | M |
| SF11 | **The script host v1** (O4: AssemblyScript first): ABI v1 (input record, events, validated effect records); fuel injected at build; a host-set memory cap; snapshot and restore; a trap quarantines the instance; entity scripts; server scripts run in the singleplayer client's local sim lane (G9, G10, G45) | A runaway script is stopped, a hoarding script traps at its cap, and the template's door and boss scripts run identically in Node and WebKit | L |
| SF12 | **Quests and dialogue as data** (G11): quest graphs and dialogue trees authored in TypeScript, compiled to validated data; script hooks for custom conditions and scenes | The template's quest runs from its shardfile; the journal and markers work unchanged | M |
| SF13 | **One platform brain + a spawner** (G12, thin): an archetype with parameters over perception and navigation built-ins | The template's grey blobs run on it | M |
| SF14 | **The ledger interface** (G45, M8): rewards only as ledger facts with idempotent ids; singleplayer implements it locally with the rules a server would apply | A replayed reward fact grants nothing twice; no shard code writes the profile directly | S |
| SF15 | **The shardfile loader**: the singleplayer client boots a shard from its shardfile with no trusted shard JS chunk; scope-owned; the leak test covers it | `check-chunks` finds no template chunk; load → unload leaves nothing | M |
| SF16 | **M1 proof.** The template rebuilt as a shardfile with no `runtime/`; it boots in the client, its sim steps in Node, the hash test passes; then a clean-room agent outside the repo builds a small shard with only the SDK, and every gap it hits is logged, not patched during the trial | All four milestone booleans true; the gap log is committed and each gap is a row | M |

### F2 — The singleplayer grid → **M2 the crossroads**

| Row | What | Done when | Size |
|---|---|---|---|
| SF17 | **Grid assembly** (G37, G38, G35): signed cell coordinates, unbounded-ready; a 555 m pitch to start (N = 20 m, tuned by SF22); the engine-owned highway deck; the no-man's land generated at assembly from both neighbours' edge profiles (heights, ground colour, a neutral palette) and blended four ways at crossroads; signposts (shard name, author) | Any two shards meet through a smooth seam with no visible glitch at a crossroads | L |
| SF18 | **Tile streaming and one memory envelope**: rings (near, neighbour band, far proxy, horizon), parent-first refinement, a lookahead in the direction of travel, decoding in workers, a process-wide residency allocator with per-ring shares | Driving the grid never shows a hole; resident memory stays inside the envelope | L |
| SF19 | **One frame** (W7f, G27): the camera owns sun, sky, fog and exposure under one world clock; per-shard time overrides blend across edge bands; each shard's style lives in materials and a per-pixel grade; a neutral highway look; no per-shard full-screen pass. A look that changes keeps the old one as a Debug variant and goes to Jake as a board (JAKE.md) | Four looks read as one view at a crossroads; Jake's pick on any changed look | L |
| SF20 | **Seamless travel** (G33, G39, G40, W7g): no page reload between shards (replaces `travel.ts`); walking and the hoverboard (~15 m/s inside shards, lower if a shard sets it); highway cars at 30 m/s or more on the highway only; auto-path along the highway to a shard's edge entry; simple borders (creatures stay home, no cross-border combat, the highway is safe) | Crossing a border has no hitch and loses nothing; the old travel handoff is deleted | L |
| SF21 | **The grid's contents** (G46): Driftwood Isle, Pine Hollow and Nalati Grasslands on the grid; Signal Dunes and Sky Reach join only in dev mode; Nine Dragon Stack runs only in DEVSERVER mode; explore mode explores one shard at a time, with the level selector behind the dev toggle | The shipped game opens on the three-shard grid; dev mode shows five; the DEVSERVER runs Nine Dragon | M |
| SF22 | **The crossroads gates**: a 2 × 2 rig of synthetic tiles at the caps in four looks, plus the grid's real crossroads; a scripted 30 m/s drive through a 5 Mbit/s throttle with 3–10 s stalls. The iOS Simulator first, then one physical-iPhone reading by Jake (E435) | ≤ 0.85 GB peak; 95 % of frames ≤ 33.3 ms; no holes or falls; no shader compile at the first crossroads; no tab kill in three runs | M |
| SF23 | **The far view** (W8): a baked low-poly proxy per shard for the whole grid, loaded at login; flat impostors only beyond ~2.5 km | Every grid shard is visible from every other at little cost | M |

### L — Platform systems lane (from M1; each lands with a schema, a contract test and one shard switched onto it)

| Row | System | Answers |
|---|---|---|
| SF24 | The **shard director** and typed events; grid-event subscription hooks in the API from day one | G9, G36 |
| SF25 | **Client scripts**: presentation only, read but never write shared state | G10 |
| SF26 | **Standard rigs** (humanoid, quadruped, bird, serpent, insect), the shared clip library and **the commons v0** (cached across shards) | G6, G8 |
| SF27 | **Brains**: the archetype set, boss phase tables and custom AssemblyScript brains over perception, navigation and strike APIs | G12 |
| SF28 | **The UI kit** (dialogs, shop, quest panels, counters, markers, timers, scoreboards in platform slots), then the sandboxed panel canvas. HUD changes are announced over herdr and picked by Jake (E332) | G22 |
| SF29 | **Adaptive audio**: spatial audio, reverb and ambience zones, director-driven music stems | G24 |
| SF30 | **Physics toys and vehicles**: ropes, boats, carts, gliders, ragdolls, destructibles; deterministic, phone-cheap | G21 |
| SF31 | **Crowds**: hundreds of creatures or NPCs with LOD AI and animation | G21 |
| SF32 | **Interiors and verticality**: dungeons, caves and towers inside the cube, with streaming and occlusion for stacked spaces | G21 |
| SF33 | **Persistence**: per-player progress and author-declared shared world state with reset rules; additive schemas, author migrations tested against saves | G7, G18 |
| SF34 | **Platform player modes**: glide, swim, climb, drive, grapple, ride; later **author movement modes** in AssemblyScript, predicted, reviewed | G3, G14 |
| SF35 | **Material graphs** (stage 2), then **restricted shader code** (stage 3), compiled per renderer | G4, G32 |
| SF36 | **Item definitions** ready for the catalogue: signature items with stats and behaviour, and cosmetic skins (format only; no catalogue service) | G13 |

### SDK + UX lane (from F1)

| Row | What | Answers |
|---|---|---|
| SF37 | `wildshard dev` with the **phone QR** (the author's phone joins over the LAN) and the **points budget overlay** (one cost score per tile and shard, green / amber / red, raw numbers one tap away) | G2, G30 |
| SF38 | The **Vercel preview**: a one-click static deploy of the singleplayer client with the author's shardfile to their own free Vercel account, done by Claude Code | G2 |
| SF39 | **Bot playtests** at validate: every edge entry walked, every quest objective reached, no stuck spots or falls, within budget on the phone tier | G16 |
| SF40 | **The AI playtester**: `wildshard playtest` sends Opus 5.5 through the real client at phone size, judged with Clef / Jev; fun notes with screenshots and a clip | G31 |
| SF41 | **Starters**: `npm create wildshard` with three starter shards (adventure, arena, puzzle) | G15 |
| SF42 | **`/wildshard-quickstart`**: a Claude Code skill that gets a playable shard in about five minutes | G15, G47 |
| SF43 | **`wildshard upgrade`**: a skill plus codemods that move a shard project to a new API version and re-run its playtests; the window is about 72 hours until the public grid | G29 |
| SF44 | **SDK docs**: the format, every system, the script ABI and the budgets, generated from the schemas where possible | A1 |

### C — Conversion lane (from M1, each when its shard's agents are idle; 80/20 by both measures)

| Row | Shard | Notes |
|---|---|---|
| SF45 | Driftwood Isle | On the grid. Its island is already baked in Blender; the first full conversion |
| SF46 | Pine Hollow | On the grid. 587 MB of phone GPU today: texture compression and sharing before it fits a crossroads |
| SF47 | Nalati Grasslands | On the grid. Riding, three bosses, four custom weapons; its painterly look is checked against the one-frame rule (SF19) |
| SF48 | Signal Dunes | Dev-mode grid shard. Its sky and sand shaders onto families, later graphs |
| SF49 | Sky Reach | Dev-mode grid shard. Floating islands: its edges get the seam's treatment |
| SF50 | Nine Dragon Stack | A partial shard: DEVSERVER only (G46). Its neon look and arm rig are checked against SF19 and SF26 |
| SF51 | Thin Ice | Owned by its own plans; keeps its custom code in `runtime/` under the 20 % ceiling (T4). Nothing here touches WorldClaw (G47) |

After 80/20, the same rows run again for **90/10** and then **100/0**, each a later stage of this plan or its
successor.

## 5. Order and why

1. **F0**, small rows in any order; SF7's spec can start alongside it.
2. **F1** in order SF7 → SF8 → (SF9, SF10, SF11, SF12, SF13, SF14 in parallel) → SF15 → SF16. **M1** is SF16 passing.
3. After M1, four lanes in parallel: **F2** (SF17 → SF18 → SF19, SF20, SF23 → SF22; SF21 when the three grid shards
   stream), **L**, **SDK + UX**, **C** (Driftwood first, then Pine Hollow and Nalati so the grid can open).
4. **M2** is SF22 passing on the real grid. The format freezes after M2 and the first conversions.

No agent-day estimate: the audits showed the last one was anchored on a mechanical refactor. The council rounds size
the rows.

## 6. Done when

- **M1**: the template boots from its shardfile with no trusted chunk, its sim steps in Node, the hash test passes,
  and a fresh author outside the repo built a shard with only the SDK.
- **M2**: the shipped game opens on the three-shard grid; travel is seamless; the crossroads gates pass on the phone.
- Every L and SDK row has landed, each with its contract test.
- Driftwood, Pine Hollow and Nalati pass **80/20 by both measures**; Signal Dunes, Sky Reach and Nine Dragon are on
  shardfiles; no ceiling has risen.
- SHARDS.md, ENGINE.md and `docs/SHARDFILE.md` describe the format, the systems and the script ABI.

## 7. Touches other plans

- **ARCH-GUARDS:** SF1, SF3 and SF6 change guards in `lint/wildshard-plugin.js`; ask arch-guards over herdr first.
- **WORLDCLAW-SHARD / THIN-ICE:** out of scope (G47). Thin Ice keeps its own plans; only its `runtime/` ceiling is
  measured here.
- **EXPLORE-V2:** explore mode becomes one shard at a time behind the dev toggle (G46).
- **NINE-DRAGON-STACK:** a partial shard, DEVSERVER only (G46); its re-plan should write strata on the format.
- **DRIFTWOOD-REMASTER-V2 / FINISH-LINE / SIGNAL-DUNES / SKY-REACH:** a shard converts only when its agents are idle.
- **DECISION-MODELS (archived):** Clef / Jev judge the AI playtester (SF40).
- **DEPLOYMENT_ASSET_TRIM:** tiles and baked outputs change the pack layout.
- **HUD (E332):** SF28 and any HUD change go over herdr and to Jake.

## 8. Jake's picks before the grill (2026-10-03)

| # | Question | Jake's answer |
|---|---|---|
| Q1 | Thin Ice born on the format or as code? | **As code**, with the 20 % allowance; confirmed in E435 after both audits flagged it (T4) |
| Q2 | Material graphs onto the WebGL patches or WebGPU first? | Our own compiler first; superseded by G4 and G32 (families → graphs → shader code, renderer-neutral) |
| Q3 | Which bosses move to phase tables? | Only ordinary bosses (Storm Roc, the Matriarch, the Big Blob); the unique ones stay custom |
| Q4 | Start P0 now? | **Yes**; P0 is done |
| Q5 | Which milestone proves the platform? | **Package-first** (E435) |

## 9. How it runs

- **Up to six council rounds** on this rewrite before `ready` (G44; COUNCIL.md's cap of four is lifted for this plan).
- No repo lock. Each row lands behind the parity gate; a shard's conversion waits for its agents to be idle.
- Commits are pathspec-only through `scripts/push-main.sh`. A risky render or memory change ships default-off behind a
  Debug row until a phone reading backs it (RENDERING.md). A look change keeps the old look as a Debug variant.
- Small visual differences are batched onto one board per wave.


## 10. The shardfile: the grill with Jake (E435)

Jake, 2026-10-03: *"Grill me, let's brainstorm … everything is on the table, nothing is decided, let's make the perfect
shardfile plan together, let's fight against the limits of the existing shards, lets make it powerful and super
creative and fully open for great thing. But still give a stable baseline and development SDK + UX for building
performant & fun shards."* The evidence behind the earlier calls is the [Wildshard MMO Review](../reviews/wildshard-mmo-review.md).
The rows in §4 were rewritten from these answers on 2026-10-04; each row names the answers it builds.

| # | Question | Jake's answer |
|---|---|---|
| G1 | The source of truth for a shard | **Code-first**: the author's project is TypeScript (generators on their machine + AssemblyScript behaviour); `wildshard build` emits the shardfile, a validated build product nobody edits by hand |
| G2 | The development loop | **`wildshard dev` + a phone QR, and a cloud preview**: local hot reload in the real client with a live budget overlay; scan a QR to play the same build on your phone over the LAN; and a one-click deploy of a preview to the author's own free Vercel account, done by Claude Code |
| G3 | How far a shard bends the game | **Fixed core + modes**: the platform owns the core verbs (move, look, jump, interact, attack, mount) and the HUD; shards add approved player modes (glide, swim, climb, drive, grapple, ride) and invent mechanics inside them |
| G4 | Visual freedom | **Material families, then material graphs, then restricted shader code**: v1 ships rich parameterised families; validated, cost-capped graphs follow as the creative path; a validated, cost-checked shading-language subset comes after |
| G5 | Tiles and levels of detail | **Auto-bake + overrides**: authors build freely in shard-local space; `wildshard build` cuts tiles, makes every LOD, the far proxy and the impostor, and reports per-tile budgets; any LOD or tile can be hand-tuned |
| G6 | A shared asset commons | **Commons + community**: a curated platform commons (models, rigged creatures and clips, materials, sounds, music stems), cached across shards so it costs nothing at a corner; later, authors publish reviewed assets others can remix, with attribution |
| G7 | What players change, and whether it stays | **Per-player progress + author-declared shared world state** with author-set reset rules. **Building comes later**, and only after **three brand-new shards built around building** stress-test it (Jake) |
| G8 | Creatures and characters | **Standard rigs + custom**: a few platform skeletons (humanoid, quadruped, bird, serpent, insect) with a shared clip library in the commons; custom clips on top; custom rigs allowed within a budget |
| G9 | How behaviour is structured | **Entity scripts + a shard director**: AssemblyScript scripts on entities react to events (tick, hit, enter, interact); an optional director per shard runs shard-wide pacing (events, waves, weather drama, the finale); typed events between them |
| G10 | Where scripts run | **Server scripts + client scripts**: server scripts are authoritative and their state replicates automatically (authors never write netcode); client scripts are presentation only and read, never write, shared state. Prediction stays limited to the player's own character |
| G11 | Quests, dialogue and NPCs | **Data + script hooks**: quest graphs and dialogue trees are validated data written in TypeScript; scripts only for custom conditions and scenes; tracking, journal, markers, localisation and reward checks come from the platform |
| G12 | Creature AI | **Platform brains + custom brains**: configurable archetype brains and boss phase tables over perception and navigation built-ins; custom AssemblyScript brains over the same perception, navigation and strike APIs |
| G13 | Signature items | **Submit + review, and cosmetic travel**: an author submits an item to the catalogue; after review it travels at a server-capped power tier, credited to its author, behaviour included. An author item may also travel as a cosmetic skin over a catalogue weapon |
| G14 | Who makes movement modes | **Platform first, then authors**: v1 ships platform modes; later authors write AssemblyScript movement modes, predicted on both sides, under a stricter fuel budget, reviewed before going public |
| G15 | A builder's first hour | **Both: a guided `/wildshard` flow and the full WorldClaw flow**; the CLI and docs always exist (narrowed by G47: this plan builds only `/wildshard-quickstart`; WorldClaw lives in its own plans). Jake: *"Worldclaw is definitly the best way to build shards, but the guided /wildshard flow can probably get something playable in 5 minutes."* Starters: `npm create wildshard` with three starter shards |
| G16 | What an upload must pass | **Safety + playability + review**: safety and budgets, and bot playtests (every edge entry walked, every quest objective reached, no stuck spots or falls, within budget on the phone tier) gate the upload; an AI quality council scores fun and polish for featuring and centre placement |
| G17 | Live updates with players inside | **Blue/green**: players inside finish on the old revision (time-capped); new arrivals get the new one; only a shared-state schema change needs a coordinated cut-over. Replaces MMO-REQUIREMENTS O5's evacuate default |
| G18 | Saves when a shard changes | **Additive changes just work; anything else needs an author migration** tested against real anonymised saves, or the upload is refused. Players never silently lose progress |
| G19 | Source or build only | **Source + build**: uploads carry the source project (private stays private) for collaborators, renovators and remixers; the build output is validated; a sandboxed verified rebuild comes later |
| G20 | Remixing public shards | **Always remixable**: public means forkable within Wildshard, with automatic attribution; there is no lock (Jake picked this over "remixable by default with a lock") |
| G21 | Which limits to break first | **All four become early platform systems**: physics toys and vehicles (ropes, boats, carts, gliders, ragdolls, destructibles; server-authoritative, phone-cheap); crowds (hundreds of creatures or NPCs with LOD AI and animation); shard UI; interiors and verticality (dungeons, caves, towers inside the cube, with streaming and occlusion for stacked spaces) |
| G22 | Shard UI | **A UI kit now, a sandboxed panel canvas later**: shards declare platform UI components (dialogs, shop, quest panels, counters, map markers, timers, scoreboards) rendered in the platform's style and slots; later a script can draw a minigame inside a fixed panel area |
| G23 | What a builder gets | **Prestige only**: titles, featuring, centre placement and name credit (attribution on remixes and signature items). Jake: *"there's no credits and there's no platform currency. There's no revenue share either."* |
| G24 | Audio and music | **Adaptive platform audio**: spatial audio, reverb and ambience zones, adaptive music stems the director drives (explore, tension, combat, boss, victory), a commons sound library; authors bring their own music and SFX made with any tool |
| G25 | Players' money across the grid | **No global coin**: the travelling profile is identity, titles, achievements, cosmetics and catalogue gear; shard coins stay in their shard; catalogue gear comes from shard rewards the ledger maps to catalogue items. MMO-REQUIREMENTS M6 corrected |
| G26 | Players per shard | **A measured cap + copies**: start at 32 per room, raised as load tests allow; a full shard opens a copy with parties kept together; shared world state is per copy; an author may set a lower cap |
| G27 | Time of day across the grid | **One world clock + per-shard overrides**: day and night in sync across the grid; a shard may override inside its cell (eternal night, a frozen golden hour), blended across its edge band |
| G28 | Who moderates | **AI first, Jake on appeal**: an AI pass against a written policy checks every upload, asset, author string and reported chat; borderline cases queue for Jake; players can report anything |
| G29 | How long a shard keeps working | **A support window + auto-upgrade**: each API version is supported for a window after its successor ships, and `wildshard upgrade` (a Claude Code skill plus codemods) migrates a shard's source and re-runs its playtests; a shard on a retired version is archived, never broken. **During alpha, beta and staging the window is about 72 hours** (Jake); the two-year promise starts with the public grid |
| G30 | How authors see their budget | **Points + detail**: one cost score per tile and per shard with green / amber / red in the dev overlay, raw numbers one tap away; validate fails only on hard caps |
| G31 | An AI playtester | **Yes, in v1**: `wildshard playtest` sends an AI player (Opus 5.5) through the real client at phone size, end to end, judged with the fast decision models **Clef / Jev** (DECISION-MODELS, E394), and writes fun notes with screenshots and a clip. First-party shards use it too |
| G32 | The renderer | **A renderer-neutral shardfile**: no WebGL specifics in the format; families, graphs and later shader code compile per renderer; WebGL is the v1 renderer and the WebGPU spike (SP32) continues; a switch needs no shard changes |
| G33 | Getting around the grid | **Travel only, like Black Desert Online**: no fast travel; the hoverboard helps, the highways have cars for going faster, and **auto-pathing** (as in Black Desert) travels to far shards |
| G34 | The centre | **One hardcoded centre shard**: a first-party hub (catalogue vendors, the upload ritual's beacon field, a board of featured shards); it changes only with a platform release; MMO-REQUIREMENTS O2 decided |
| G35 | What the highway is | **A neutral road and safe zone**, *"a straight line for fast travel through an infinite wildshard metaverse"*, with signposts (shard name, author, rating). And **the fixed seam the platform controls**: shards have arbitrary heights, colours, themes and styles and won't meet cleanly, so the highway and a strip of no-man's land let the server, when it assembles the grid, smooth or interpolate from each shard's edge back to the road and on to the next shard, so two shards never render right up against each other (Jake) |
| G36 | Events bigger than one shard | **Later, with hooks designed in**: no grid-wide events in v1; the director's event subscriptions are in the API from day one |
| G37 | Where the no-man's land lives | **Outside the cells**: a platform-owned strip of N m on each side of the road, generated when the grid is assembled from both neighbours' edge profiles (heights, ground colour, a neutral palette), easing each edge down to road level; crossroads squares blend four ways. The 500 m cube stays wholly the author's. Start at N = 20 m (pitch 555 m), tuned in the crossroads prototype |
| G38 | Grid size | **Unbounded-ready**: signed cell coordinates, streaming rings that never assume an edge, a far view limited to the nearest rings, placement that grows outward; the first deployment is still 5 × 5 |
| G39 | Speed | **Fast roads, slower shards**: cars only on the highway (≥ 30 m/s); the hoverboard and horse about 15 m/s inside shards; authors may lower the cap and build their own slower vehicles |
| G40 | Auto-pathing | **Highway only**: auto-path drives you along the highway to a shard's edge entry; inside shards you travel yourself |
| G41 | **This plan's scope** | Jake: *"This plan and goal is purely to make shardfiles that are MMO & multiplayer compatible, I do not want to build any multiplayer code, I want to refactor the singleplayer game to be about running a singleplayer three.js game that contains shardfiles that are MMO/multiplayer compatible."* No server, rooms, netcode, upload service, moderation or ledger service is built here; the decisions about them (G17, G19, G26, G28 …) are requirements the shardfile must be compatible with |
| G42 | How big M1 is | **Thin M1**: format v0, `new / dev / build / validate`, the baker on terrain and static props, two or three material families, the AssemblyScript host with entity scripts, quests as data, one platform brain; the template boots from its shardfile with no trusted code; a fresh author outside the repo builds a small shard |
| G43 | When the six convert | **From M1**: each shard converts when its agents are idle, onto whatever systems exist, measured both ways; its gaps steer what the platform builds next |
| G44 | Review before `ready` | **Rewrite, then up to six council rounds** (Jake; COUNCIL.md's four-round cap is lifted for this plan) |
| G45 | How compatibility is proven without multiplayer code | **Compatibility checks only**: a test steps each shardfile's simulation in plain Node with no renderer; a determinism test runs one input log in Node and in WebKit and requires identical state hashes; server scripts and client scripts are separate and singleplayer runs both locally; rewards go through a ledger interface that singleplayer implements locally with the same rules. No network, rooms or server process |
| G46 | The singleplayer world | **A singleplayer grid**, starting with **three shards: Driftwood Isle, Pine Hollow and Nalati Grasslands**. Signal Dunes and Sky Reach join the grid (five shards) **only when dev mode is on**. **Nine Dragon Stack is a partial shard**, so it runs only in **DEVSERVER mode**. The DEVSERVER has the usual controls (explore mode, enter world …). The grid has an explore mode that explores one shard at a time: the level selector comes back only for explore mode, behind the dev toggle (Jake) |
| G47 | The builder pipeline in this plan | **Everything local or static**: the SDK, CLI, dev server + phone QR, the auto-baker, validate (the checks a future server runs), bot playtests and the AI playtester, the points budget overlay, starter shards, `wildshard upgrade`, the Vercel preview (a static deploy). **A `/wildshard-quickstart` skill** may be built here. **WorldClaw is out of scope for this plan**: it has its own sequence of plans (Jake). Out: upload's server side, moderation, source storage, remix, the signature-item catalogue service |

## Handoff (shard-platform)

Written 2026-10-04 by the shard-platform agent, at the end of the E435 grill with Jake (asks E431, E433, E435).

**Read first:** §0, §1 and §3 of this plan; §10 (Jake's 47 answers, the source of every row); the
[Wildshard MMO Review](../reviews/wildshard-mmo-review.md) and its reports in `docs/design/mmo/research/e435/`;
[MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md) (decisions 1–20). Never link the private planning repo (E433).

**What exists (on `origin/main`):** P0 (SP0–SP5, listed in its rows); the requirements walk-through (MMO-REQUIREMENTS
rewritten as needs); the research (Claude + Codex, clean room); this rewrite.

**Next, in order:**
1. **Council rounds on this rewrite**, up to six (G44, docs/process/COUNCIL.md, three fresh seats a round, at least one
   Codex and one Claude). Fold each round's findings in; the plan goes `ready` after them.
2. Then **F0**: SF1–SF6, ARCH-GUARDS asked over herdr before touching `lint/wildshard-plugin.js`.

**Lessons:**
- Run `scripts/vercel-tree-gate.sh HEAD` before `scripts/push-main.sh` when a commit touches code; a lint change needs
  `lint/`, `test/fixtures/lint/cases.json` and `scripts/README.md` (liveness) checked.
- Imports name the defining module now (E434, no barrels): `@wildshard/engine/core/config`, not a package root.
- A guard with zero targets proves nothing: give every new rule a fixture that fails and one real site, or say it is
  vacuous.
- Numbers in a plan come from a committed script, never from a hand count.
