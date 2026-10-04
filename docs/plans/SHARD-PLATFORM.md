# Plan: SHARD-PLATFORM — the 80/20 split: shards become data and approved systems (E431)

**State:** `in progress` 2026-10-03 — P0 (Jake's Q4: "start P0"): SP0–SP4 done, SP5 part 1 done (`94c4a55ed`); left in P0: SP5's lint half and the gate's share table, unblocked since the @wildshard packages landed (`76675135b`). P1–P6 stay a draft until a council round (§9). Unowned from the end of the 10-03 session: start at the Handoff. Jake's picks (ask tool, 10-03): Q1 Thin Ice **starts as code** with the 20 % allowance (SP31); Q2 our own material-graph compiler (WebGL patches + TSL, SP18); Q3 only ordinary bosses move to phase tables; O1 the cell is 250 m below / 250 m above; Driftwood and Sky Reach exempt from edge roads until P5; WebGPU: no port, SP32 spike. Requirements and background: [`docs/design/mmo/`](../design/mmo/MMO-REQUIREMENTS.md).

## 0. Read this first

Jake, E431 (2026-10-03): *"high level the vision is the MMO. … Since the MMO is hard we started with single player.
But the sandbox MMO including an API with user generated shards has lots of constraints. … a high level plan to get
to the 80/20 split. The 80/20 split can be 80% data and approved systems (logic system, stacks, graphs, wasm
plugins). The remaining 20% is custom runtime per shard so we don't have to rewrite everything in one go. The
remaining 20% is part of the transition plan to not break the existing 6 shards."*

**Background:** the vision is [VISION](../design/mmo/VISION.md); the thinking behind this plan (code vs data, WASM, the
lock-ins, the guardrails G-1…G-6, the worked Driftwood example) is [SHARD-PLATFORM-PLAN](../design/mmo/SHARD-PLATFORM-PLAN.md);
terms are in [GLOSSARY](../design/mmo/GLOSSARY.md).

**The goal.** Each of the six shards (Driftwood Isle, Pine Hollow, Nalati Grasslands, Nine Dragon Stack, Signal
Dunes, Sky Reach) ends at **≥ 80 % data and approved systems, ≤ 20 % custom runtime TypeScript**, and stays playable
and live at every step. A new shard is born on the format with no custom runtime. This is the first milestone of the
MMO (MMO-REQUIREMENTS §5); multiplayer, upload and the grid come after and are not in this plan.

**Three words:**
- **Data:** JSON-serialisable rows and layouts with a schema (items, species, loot, spawns, quests, interactables,
  places, budgets, strings), and **baked assets** that build-time **generators** produce (GLB, KTX2, heightmaps,
  instance lists). Generator code runs on the author's machine; it never ships, so it counts as data.
- **Approved systems:** engine and kit code every shard may use, driven only by data: **devices** with parameters
  (water, scatter, movers, zones, spawners…), the **logic system** that wires them, **archetype brains** and **boss
  phase tables**, **look stacks** and **material graphs**, and **WASM plugins** behind a data-only host API.
- **Custom runtime:** a shard's own TypeScript that ships and runs. After this plan it lives only in
  `src/shards/<slug>/runtime/` (plus the plugin glue), under a ratchet that only falls.

**What this plan is not.** No rewrite in one go; no multiplayer, upload or server; no change to how Jake plays (the
build, the PWA, the phone budgets are untouched). Every step is identical under the parity harness, or a small
difference batched onto one board per wave, as in GAME-NORMALIZATION.

## 1. The metric

**Custom share** of a shard = (TS lines under `runtime/` + the plugin glue) ÷ (the shard's TS lines at the baseline,
§2). The target is **≤ 20 %** for each of the six. Lines that moved to `generators/` (build-time only), to `data/`
(serialisable rows), or were replaced by an approved system count on the 80 % side.

Enforced from row SP5 on:
- `lint/shard-platform.json` holds each shard's baseline and current ceiling; the gate prints the share per shard and
  the ceiling only goes down (the ratchet pattern).
- **Outside `runtime/`, a shard has no runtime code:** `data/` files export serialisable values only (a JSON
  round-trip test), `generators/` are imported only by the bake (a `wildshard/no-runtime-generator` rule), and the
  shard's chunk contains no module from `generators/` (read from Vite's manifest, like `check-chunks`).
- A shard born after SP5 (and the template) has **no `runtime/` folder**.

## 2. Where it stands (audit, 2026-10-03, `06de6df0e`)

Line counts are exact; the buckets are estimates (file headers and exports read, mixed files given to their main
bucket, ±5 points). **G** generator · **D** data-shaped · **S** a mechanism that should be an approved system ·
**C** custom · **X** glue.

| Shard | Lines | G | D | S | C | X | Custom today (C+X) | Data side once S is a system (G+D+S) |
|---|---|---|---|---|---|---|---|---|
| Driftwood Isle | 18,766 | 44 % | 13 % | 39 % | 2 % | 3 % | **5 %** | 96 % |
| Pine Hollow | 21,716 | 42 % | 17 % | 27 % | 10 % | 5 % | **15 %** | 86 % |
| Nalati Grasslands | 33,094 | 33 % | 9 % | 32 % | 22 % | 3 % | **25 %** | 74 % |
| Nine Dragon Stack | 25,166 | 53 % | 9 % | 11 % | 23 % | 5 % | **28 %** | 73 % |
| Signal Dunes | 4,826 | 28 % | 10 % | 33 % | 19 % | 9 % | **28 %** | 71 % |
| Sky Reach | 6,893 | 44 % | 8 % | 33 % | 5 % | 11 % | **16 %** | 85 % |
| **All six** | **110,461** | **42 %** | **11 %** | **27 %** | **15 %** | **5 %** | **20 %** | **80 %** |
| template | 554 | 7 % | 28 % | 34 % | 9 % | 22 % | 31 % | — |

What the numbers say:
- **The big lever is S (27 %, ~30k lines): the approved systems.** Shards wrote their own water, scatter, sky,
  ambience, brains, spawners, weather and quest glue because no system existed. Until a system exists, that code can't
  move to the data side.
- **G is the bulk (42 %)**: models, world builders, scatter, terrain. Baking is mechanical but touches every shard.
- **Driftwood, Pine Hollow and Sky Reach are already near or under 20 % custom.** Nalati, Nine Dragon and Signal Dunes
  need their C to shrink too:
  - **Nalati:** riding, three boss fights, four custom weapons.
  - **Nine Dragon:** its Jiehua shader programs and first-person arm rig.
  - **Signal Dunes:** its sky and sand shaders, and the bullwhip.
- **Shaders:** about 110 shard files hold GLSL or a `ShaderMaterial`. 46 of them already go through the engine's
  `patchShader` verb. Look stacks and material graphs must absorb roughly 40 shader-bearing S files before those files
  count as data.

What the engine already gives (keep as is):
- **Quests:** `QuestDef` / `QuestStep` / `Cond` are pure data, checked by `validateQuest`.
- **Interactables:** 10 kinds, pure data, checked by `validateTable`.
- **Pure-data rows:** `EffectDef`, `DamageRuleDef` and `BossDef` phases.
- **Saves:** versioned SaveStore with valibot schemas.
- **Leak test:** scope-owned resources with a load → unload test.
- **Determinism:** seeded RNG streams and the game clock.
- **Event bus:** typed `emit` / `ask`.
- **Budgets:** per manifest, checked by the parity and GPU gates.
- **Engine constants:** `CHUNK_SIZE = 500` and `ROAD_WIDTH = 15`. Every manifest already declares a 500 × 500 × 500 cell.

What is in the way:
1. **Rows hold functions:**
   - `StrikeSpec.weight` (required), `WeightedTable.when` (19 uses), `SpeciesRow.think` / `act`;
   - `SpeciesLook.build`, `animate`, `postPose`;
   - `DayCycleSpec` curves, `WeatherProfile` (all functions), `WaterBody` (an interface of functions).
   No test round-trips a row through JSON, and no content has a schema.
2. **The shard API is not data:**
   - `ShardContext` has ~19 members, several of them not data: `app`, `root: THREE.Group`, `piece(Object3D)`,
     `hud.widget(HTMLElement)` and closures.
   - `ctx.app` is used 127 times in shards and `ctx.game` 86 times. The newest two shards reach through
     `ctx.game.runtime` 61 times for what are really missing verbs (toast, spawn, cues, quest flags).
   - Shards extend engine classes: `Weapon` 10, `Tool` 4, `CreatureBrain` 13, `Boss` / `BossBrain` 6, plus
     `ShardPlugin` itself.
3. **The headless sim isn't real yet:**
   - `sim-no-render` matches `engine/(quests|effects)`, which don't exist, so `engine/quest` is unchecked, and the
     kit and shards aren't covered at all.
   - The aim ray comes from the viewmodel camera.
   - Hit-stop scales the fixed step.
   - No whole shard runs in plain Node. `FakeGame` still builds a three.js scene under happy-dom.
4. **No player profile:** save scopes are `global | shard | device | session`. Travel is a page reload with a 60 s
   handoff.
5. **The world contract is soft:** `placement.grid` / `size` are set by each manifest and nothing reads them;
   `entryRoadMask` is a private engine function.

## 3. Shape of the work

Seven phases. Phase 0 is small and safe and can start on Jake's go; phases 1, 2 and 3 can run in parallel lanes;
phase 5 converts shard by shard as the systems land.

```
P0 guardrails + metric ──► P1 bake (G) ──────────────┐
                       ├─► P2 data (D) ──────────────┼─► P5 per-shard conversion ─► P6 boot from the package
                       └─► P3 approved systems (S) ──┤        (C → runtime/, ≤ 20 %)
                           P4 WASM plugins ──────────┘
```

## 4. Rows

### P0 — Guardrails and the metric (before any move)

| Row | What | Done when | Size |
|---|---|---|---|
| SP0 | This plan and the requirements doc ([MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md)) | **done** `4a95c2454` (E431) | S |
| SP1 | **Fix `sim-no-render`'s scope**: the rule named `engine/quests` and `engine/effects`, which never existed, so `engine/quest` went unchecked. Now `ai`, `combat`, `events`, `quest`, `saves` less their `view` parts, all at 0; a test fails when a listed folder doesn't exist (the hole ARCH-GUARDS AG24 missed). Widening it over kit and shard code moves to SP5: it needs the `data/` and simulation folders to know what is simulation | **done** (this commit): a planted renderer import in `engine/quest` now fails; the quest and event code passes at 0 | S |
| SP2 | **Reserve the `profile` save scope** (SHARD-PLATFORM-PLAN G-6): the scope exists in `SaveStore`, no key uses it yet; the travel handoff names it as its future home | **done** (this commit): `SaveScope` has `profile` (own document, exported / imported like `global`, mirrored in the native shells); no level namespace may take a scope's name | S |
| SP3 | **Rows are serialisable** (SHARD-PLATFORM-PLAN G-2): a test round-trips every registered row (items, effects, damage rules, strikes, loot, spawns, species, bosses, interactables, quests, day keys) through JSON. Function-valued fields become **named ids** into an engine registry (`weight: 2` or `{ fn: 'weight.distance' }`; `when: { flag: … }`); a ratchet counts the function fields left (StrikeSpec.weight, WeightedTable.when ×19, think / act, curves, WeatherProfile) | **ratchet done** (this commit): `scripts/check-row-data.mjs` walks 44 content row types with the TypeScript compiler; **45 function fields** today (SpeciesLook 9, DayCycleSpec 7, WeatherProfile 4, NpcRow 4, LevelAudioProfile 4, BowProfile 3, the tables' `when` 3, think / act, StrikeSpec.weight …) in `lint/row-functions.json`, which may only shrink; `test/row-data.test.ts` fails a new field and locks the pure-data rows (effects, damage rules, bosses, encounters, interactables, quests). Turning the 45 into named ids is P2 / P3 work, field by field | M |
| SP4 | **The world contract** (SHARD-PLATFORM-PLAN G-5, MMO W1–W6). Jake 10-03: the 500 m cell splits **250 m below and 250 m above** the highway level (O1); Driftwood (open sea) and Sky Reach (floating islands) are **exempt now and fixed in P5** (SP22, SP23). Built: `CELL_HEIGHT` / `CELL_BELOW` / `CELL_ABOVE` in `@wildshard/engine/data`; `test/world/world-contract.test.ts` holds every level's ground inside the cell and level with the highway across each edge entry (15 m wide, 50 m in); `lint/edge-exemptions.json` may only shrink. Moved: the full walk from each edge (colliders, water, structures) is SP10's validator; `placement` leaving the manifests is SP29 (server-owned fields leave the package) | **done** (this commit): all seven levels pass; the exempt two are listed with their fixing row | M |
| SP5 | **The metric and the folders**: `generators/`, `data/`, `runtime/` join `lint/shard-layout.json` (AG9) and SHARDS.md; `lint/shard-platform.json` with today's baselines; the gate prints each shard's custom share; `wildshard/no-runtime-generator`; the chunk check for `generators/`; `sim-no-render` widened over each shard's `data/` and simulation folders and the kit's (from SP1) | **part 1 done** (this commit): the three folders in `lint/shard-layout.json` and SHARDS.md; `check-chunks` refuses generator code in any chunk; `scripts/shard-platform.mjs` prints each shard's custom share against `lint/shard-platform.json` (baselines at `b96fed1a1`, every shard 100 % today: nothing is sorted yet) and `test/shard-platform.test.ts` holds the ceilings. A shard's ceiling is enforced from its conversion row on, so shard work isn't frozen meanwhile. **Left:** `wildshard/no-runtime-generator` and `sim-no-render` over `data/` (waiting on the arch-guards @wildshard packages commit, which holds `lint/wildshard-plugin.js`), and the table printed by the push gate | M |

### P1 — Bake the generators (G, 42 %)

| Row | What | Done when | Size |
|---|---|---|---|
| SP6 | **`pnpm bake`**: runs a shard's `generators/` in Node (the model contract `defineModel` already builds geometry without a renderer), writes content-hashed GLB / KTX2 / instance lists to `public/assets/<slug>/baked/`, a manifest of outputs, `--check` in the push gate. Per-tier outputs where a generator reads the tier. **Pilot: Driftwood's shore boulder, palm and hut** (SHARD-PLATFORM-PLAN's bake spike), loaded back through the existing model registry | The three models load from GLB; parity identical; the bake is reproducible (same bytes twice) | M |
| SP7 | Bake each shard: models, world builders, scatter (cell instance lists), terrain. One row per shard, in the §5 order; seeded generators keep their seeds; a generator whose output depends on runtime state stays in `runtime/` with a reason | Each shard's G lines are out of its chunk; parity identical; the memory gates hold (baked assets must not raise `gpuMB`) | L |

### P2 — Content becomes data (D, 11 %)

| Row | What | Done when | Size |
|---|---|---|---|
| SP8 | **Schemas** (valibot, already the save library) for every content row type and for `shard.json` / `layout.json`. `manifest.ts` stays the typed source for first-party shards and **emits** `shard.json`; `layout.json` holds places, anchors, spawns, paths, edge entries | `pnpm gen` writes and validates both files for all six; a schema failure fails the gate | M |
| SP9 | **`data/` per shard**: rows move into `data/` as serialisable values (TS `as const` or JSON); the round-trip test of SP3 covers them | Each shard's D lines live in `data/` | M |
| SP10 | **`wildshard validate`** v0: schemas, ids and references, static budget caps from one budgets file, the edge-entry walk through the colliders from each midpoint (SP4 checks the ground only), the cell bounds (250 m below and above). Runs in the push gate on every shard and on the template | All six + template pass; one rejection fixture per rule | M |

### P3 — The approved systems (S, 27 %): the biggest phase

Each system is built once in the engine (mechanism) or kit (content), takes only data, has a schema and a contract
test, and is switched onto its first shard with parity, then the others. Ordered by how many shards need it.

| Row | System | Replaces (shards) |
|---|---|---|
| SP11 | **Author API v1**: the verbs the newest shards reach `ctx.game.runtime` for (toast, spawn / retire, cues, quest flags, equipment, impulse, interactables) become data-in / data-out `ShardContext` verbs; ratchet `ctx.app` (127) and `ctx.game` (86) down; no new extension points by subclassing | SD, FR first; all six |
| SP12 | **The logic system**: events → conditions → actions over variables, timers and state machines; a pure interpreter that returns effects, with fuel and cascade limits; node-safe; quests' flag conditions are its first user | Quest glue (3.7k lines), triggers, hints: all six |
| SP13 | **Archetype brains + spawners**: melee pack, charger, ranged thrower, grazer / herd, flyer dive, burrower, wisp, ambient critter; spawner homes with respawn; elite tables. A species row names an archetype and parameters (no `think` / `act`) | D, P, N, SD, FR, template |
| SP14 | **Boss phase tables**: `BossDef` + strike rows + hooks as named effects; the bosses whose fight is ordinary move onto it (Storm Roc, the Matriarch, the template's Big Blob); the unique ones stay in `runtime/` (Q3) | SD, FR, template, D |
| SP15 | **World devices**: water body (sea, stream, waterfall, pool), scatter / ground-cover and grass streaming, flock / herd / ambient life, movers and rotators (bridge, sails, monorail, gondola), wind / updraft zones, rope / zipline / grapple points, floating platform, particle / fire emitter, trail ribbon, cloth flutter | D, P, N, ND, SD, FR |
| SP16 | **Sky, weather and ambience as data**: sky dome / painted backdrop / cloud sea, `DayCycle` keys without function curves, weather profiles as data (the rain / snow program in the kit), ambience zones | All six |
| SP17 | **Look stacks**: the post chain as an ordered list of engine passes with parameters (toon ramp, painterly, PBR grade, Jiehua neon, bloom, haze, LUT, fog, rim / shade floor), from `LookStrategy` code to a `look` block in `shard.json` | All six |
| SP18 | **Material graphs**: a validated node graph (allowlisted nodes, cost cap) compiled by our own compiler (Q2) to **two targets** (Jake, 10-03): the WebGL renderer's shader patches through the existing `patchShader` registry, and TSL for three.js's WebGPURenderer, so every effect moved to a graph is already WebGPU-ready; a contract test compiles each graph both ways; first targets: sand ripple, facade windows, water, wind sway, the dune shadow | ND, SD, FR, N |
| SP19 | **Kit content families** for what one shard still hand-builds: the shop / trade panel, loot / trophy display, NPC talker and guide, the GLB preload and material-tweak loaders and rigid-hull creature builder that SD and FR duplicate, the Sabre / Naizagai / Golden Bow / whip as weapon-family profiles | D, P, N, SD, FR |

Most of the S rows can run in parallel lanes. SP11 comes first because every other system's verb hangs off it.

### P4 — WASM plugins (an approved system; the way down for the 20 %) and the WebGPU spike

| Row | What | Done when | Size |
|---|---|---|---|
| SP20 | **The plugin host**: a language-neutral host ABI (ids, numbers, typed arrays, events in and effects out; no three.js, no DOM), a per-call fuel limit (instrumented module) and memory cap, deterministic (the seeded RNG through the ABI), the same module in Node and the browser, owned by the shard scope. First toolchain: Rust (MMO-REQUIREMENTS O4) | A test plugin runs identically in Node and on the phone tier; a runaway plugin is stopped by fuel; the leak test passes |
| SP21 | **Pilot**: port one small piece of custom gameplay logic to WASM. Candidate: the Antler King's move policy (`combat/KingGoals.ts` + `combat/combatMath.ts`, ~190 lines, Pine) | Parity identical; frame-time cost measured on the phone tier |
| SP32 | **WebGPU spike** (Jake, 10-03: WebGPU is three.js's future, but no full port yet): one shard (the template, then Sky Reach) on `WebGPURenderer` through the engine's `Renderer` interface, **default-off behind a Debug row** (RENDERING.md: the one exception to "no phone checks"); its graphs from SP18's TSL target, its other shaders stubbed or ported; measured against WebGL on the M5 lanes (frame, GPU, CPU, draws) and by one physical-iPhone reading (fps hot, memory against 1.0 / 1.8 GB). The full port (~92 shader patches, 114 `ShaderMaterial` sites in 68 files, the post stack: `docs/design/webgpu-port-inventory.md`) becomes its own plan only when one of these holds: three.js fixes its many-draws regression ([#30560](https://github.com/mrdoob/three.js/issues/30560)), three.js deprecates `WebGLRenderer`, or the iPhone reading beats WebGL | A written verdict with the numbers; the Debug row deleted with the losing code once Jake decides | M |

### P5 — Convert each shard (C → `runtime/`, ≤ 20 %)

One row per shard, in §5's order, each when its shard's agents are idle (no lock this time; HUD files are announced
over herdr, AGENTS.md E332). A conversion row: bake (SP7), data (SP9), switch to every system that exists, move what
is left into `runtime/`, prove parity, lower the ceiling.

| Row | Shard | Custom today → target | What must leave the custom side |
|---|---|---|---|
| SP22 | Driftwood Isle | 5 % → ≤ 5 % | Nothing: the Drowned Captain stays in `runtime/`. The bake pilot and the first full conversion |
| SP23 | Sky Reach | 16 % → ≤ 16 % | Its plugin's updraft, winch and roost wiring move onto devices and the logic system |
| SP24 | Pine Hollow | 15 % → ≤ 15 % | The Lever Rifle and the Antler King stay (the King's policy is the WASM pilot) |
| SP25 | Signal Dunes | 28 % → ≤ 20 % | The sky and sand-ripple shaders onto the look stack and a material graph (about 40 % of `look/render.ts` bakes); the bullwhip onto a kit weapon family |
| SP26 | Nalati Grasslands | 25 % → ≤ 20 % | ~1,700 lines: the Sabre, Naizagai and Golden Bow onto kit families, the ghost riders and balbal onto the elite table and brains; riding, the Storm Titan and the Golden King stay |
| SP27 | Nine Dragon Stack | 28 % → ≤ 20 % | ~2,000 lines: the facade and filament programs onto material graphs and the Jiehua neon look stack; the first-person arm rig onto `#kit/viewmodel`; the movers onto devices. The grapple (Fei Zhua) becomes a device (SP15) |
| SP28 | template | 31 % → 0 % (no `runtime/`) | The template shows only data and systems; SHARDS.md is rewritten for the format |
| SP31 | Thin Ice (shard 7, Q1) | ≤ 20 % from its first commit after SP5 | Built as code under WORLDCLAW-SHARD with a `runtime/` folder and a 20 % ceiling; converted last, with whatever systems exist by then |

### P6 — Boot from the package

| Row | What | Done when | Size |
|---|---|---|---|
| SP29 | Each shard boots from `shard.json` + `layout.json` + `data/` + baked assets + its `runtime/` chunk; `placement` leaves the manifests for one first-party placement table outside the levels (it stands in for the server, MMO W6); the generated registry lists packages, not TS modules | All six boot this way; parity identical; offline boot still works (the service worker caches the package files) | M |
| SP30 | **A shard born on the format**: a small shard with no `runtime/` folder, built by a fresh agent from SHARDS.md and the SDK only (the Z3 protocol, now for the format); every gap it hits becomes an approved system, not shard code. Not Thin Ice (Q1: it starts as code) | It ships with a 0 % custom share and zero engine edits on the final run |

## 5. Order and why

Template → **Driftwood** (the bake pilot: its island is already baked in Blender, its interactables are already data,
and it is 5 % custom) → **Sky Reach** (small, 85 % once systems exist) → **Pine Hollow** → **Signal Dunes** →
**Nalati** → **Nine Dragon** (the most shader code and its own mechanics, last). The newest shards are still being
polished under SIGNAL-DUNES and SKY-REACH; their conversion waits until those plans archive.

**Estimate (rough, agent-days):**

| Phase | Agent-days |
|---|---|
| P0 | ~3 |
| P1 | ~6 |
| P2 | ~4 |
| P3 | ~18–24 |
| P4 | ~5 |
| P5 | ~8 |
| P6 | ~3 |
| **Total** | **~45–55** |

GAME-NORMALIZATION's 25–34 agent-day estimate ran in about two days of wall clock with parallel lanes; P3's systems
parallelise the same way.

## 6. Done when

- The gate prints every first-party shard at **≤ 20 % custom**, and no ceiling has risen.
- All six boot from their packages with parity identical (or the wave boards accepted), offline boot intact, inside
  the phone budgets.
- The template and SP30's shard have no `runtime/` folder.
- `wildshard validate` passes all of them.
- The template's simulation runs in plain Node with no renderer (`sim-no-render` over kit and shards at 0).
- SHARDS.md and ENGINE.md describe the format, the systems and the plugin ABI.

## 7. Touches other plans

- **ARCH-GUARDS:** SP1, SP5 and SP11 add or fix guards (the `sim-no-render` path bug, `no-runtime-generator`, the
  `ctx.app` ratchet); they land as rows there or here, not both.
- **WORLDCLAW-SHARD / THIN-ICE:** Q1 — Thin Ice starts as code with the 20 % allowance; from SP5 on it keeps its custom code in `runtime/` under its own ceiling, and SP31 converts it last.
- **ANIMATION-REMASTER:** procedural animation that bakes to clips (Nine Dragon's arms, the King's rig) leaves the
  custom side.
- **DRIFTWOOD-REMASTER-V2:** V-B1, the island-wide Blender pass, is a generator change; it lands before or after
  SP22, never during it.
- **DEPLOYMENT_ASSET_TRIM:** baked outputs add files; T5's pack layout and cost comparison count them.
- **NINE-DRAGON-STACK:** its re-plan (E380) should write new strata on the format.

## 8. Jake's picks (answered 2026-10-03, ask tool)

| # | Question | Recommended (Jake's answer in §0's State line) |
|---|---|---|
| Q1 | Is Thin Ice (shard 7) born on the format, so WorldClaw's build waits for P0–P2 and the systems it needs, or does it start as code with the six's 20 % allowance? | **Born on the format.** Its grey world and layout are data anyway; what it lacks is built as an approved system first. Otherwise the transition grows a seventh shard to convert |
| Q2 | Material graphs: compile to the WebGL renderer's shader patches, or switch the engine to three.js's WebGPU renderer (which runs TSL node materials, with a WebGL 2 fallback) first? | **Our own compiler onto `patchShader` first.** The renderer switch is a risky, phone-gated change of its own (RENDERING.md: default-off until an iPhone reading backs it) |
| Q3 | How much parity for a boss moved to a phase table? | **Only ordinary bosses move** (Storm Roc, the Matriarch, the Big Blob); the Drowned Captain, Antler King, Storm Titan and Golden King stay in `runtime/` with their fights untouched |
| Q4 | Start now with P0 (SP1–SP5), the small, safe guardrails, while the council reviews the rest? | **Yes.** SP1 fixes a real lint hole; SP2–SP5 are cheap now and cost a save migration later |

## 9. How it runs

- A council round (docs/process/COUNCIL.md, three fresh seats) before the State goes `ready`.
- No repo lock. Engine and kit rows land behind the parity gate; a shard's conversion waits for its agents to be idle.
- Each commit is pathspec-only and goes through `scripts/push-main.sh`. A risky render or memory change ships
  default-off behind a Debug row until a phone reading backs it (RENDERING.md).
- Every step is identical under the harness, or a small difference batched onto one board per wave (systems,
  looks, bosses).

## Handoff (shard-platform)

Written 2026-10-03 at `15efd13ef` by the session that wrote the plan (herdr wildshard-new; asks E431, E433).

**Read first:** this plan's §0–§2 and §4 P0; [MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md) (the why, Jake's
decisions in §6, the open ones in §7); [SHARD-PLATFORM-PLAN](../design/mmo/SHARD-PLATFORM-PLAN.md) for the thinking.
All MMO docs live in `docs/design/mmo/`; never link the private planning repo (E433, JAKE.md).

**What exists (all on `origin/main`):**
- SP1: `SIM_DIRS` / `VIEW_PATHS` in `lint/wildshard-plugin.js` (sim-no-render), a folders-exist test in
  `test/arch-guards.test.ts`, the fixtures in `test/fixtures/lint/cases.json`.
- SP2: the `profile` scope in `src/engine/saves/store.ts` and `src/engine/native/saves.ts`; `test/engine/saves*.test.ts`.
- SP3: `scripts/check-row-data.mjs` (+ `.d.mts`), `lint/row-functions.json` (45 fields), `test/row-data.test.ts`.
- SP4: `CELL_*` in `src/engine/core/config.ts` (exported from `@wildshard/engine/data`), `lint/edge-exemptions.json`,
  `test/world/world-contract.test.ts`.
- SP5 part 1: `lint/shard-layout.json` (generators / data / runtime), `scripts/check-chunks.mjs` (+ test),
  `scripts/shard-platform.mjs` (+ `.d.mts`), `lint/shard-platform.json` (baselines at `b96fed1a1`),
  `test/shard-platform.test.ts`.

**Next, in order:**
1. **SP5's lint half.** In `lint/wildshard-plugin.js`, add a `no-runtime-generator` rule: a file under
   `src/shards/<slug>/` outside `generators/` may not import from `src/shards/<slug>/generators/`. Register it in the
   plugin's `rules`, make it hard in `.oxlintrc.json`, and add fixture cases (one refused, generator → generator
   allowed). Widen `sim-no-render` to `src/shards/*/data/` (0 sites today: no shard has a `data/` folder). Add
   `node scripts/shard-platform.mjs --check` as a step in `scripts/vercel-tree-gate.sh` so the gate prints the table.
   Then tick SP5 and P0 in the State line.
2. **A council round on P1–P6** (docs/process/COUNCIL.md, three fresh seats). The plan goes `ready`, and P1 starts,
   only after it.
3. **The open decisions to put to Jake** (question tool, one recommendation each): MMO-REQUIREMENTS O2 (centre shard
   or citadel), O3 (who ships a new WASM plugin), O4 (the plugin toolchain), O5 (live-update UX), O6 (one look or
   one per shard). None blocks P0–P2.

**Lessons from this session:**
- Run `scripts/vercel-tree-gate.sh HEAD` on your commit before `scripts/push-main.sh`. A lint change needs the
  `lint/` files, `test/fixtures/lint/cases.json` and `scripts/README.md` (liveness) checked, not only `src/`.
- Another agent's push may carry yours, and its gate may not have run on your commit.
- `lint/wildshard-plugin.js` and the lint fixtures are shared with ARCH-GUARDS work: ask arch-guards over herdr first.
- Imports are the workspace packages now (`@wildshard/engine`, `@wildshard/engine/data`, `@wildshard/kit` …), not
  `#engine`.
