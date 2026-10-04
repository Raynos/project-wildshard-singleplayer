# Plan: SHARD-PLATFORM — the 80/20 split: shards become data and approved systems (E431)

**State:** `in progress` 2026-10-03 — **P0 done** (Jake's Q4: "start P0"): SP0–SP5 built; SP5's lint half landed with `wildshard/no-runtime-generator`, `sim-no-render` over each shard's `data/` and the push gate's share table. Next (E435, first-principles session with Jake): he picked **package-first** (Q5); clean-room audits of this plan (Claude + Codex) and research on server authority and a TS-like → WASM behaviour language are running, then P1–P6 are re-planned and go to the council round (§9). Owned by the shard-platform agent, working the plan with Jake (2026-10-03). Jake's picks (ask tool, 10-03): Q1 Thin Ice **starts as code** with the 20 % allowance (SP31); Q2 our own material-graph compiler (WebGL patches + TSL, SP18); Q3 only ordinary bosses move to phase tables; O1 the cell is 250 m below / 250 m above; Driftwood and Sky Reach exempt from edge roads until P5; WebGPU: no port, SP32 spike. Requirements and background: [`docs/design/mmo/`](../design/mmo/MMO-REQUIREMENTS.md).

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
| SP5 | **The metric and the folders**: `generators/`, `data/`, `runtime/` join `lint/shard-layout.json` (AG9) and SHARDS.md; `lint/shard-platform.json` with today's baselines; the gate prints each shard's custom share; `wildshard/no-runtime-generator`; the chunk check for `generators/`; `sim-no-render` widened over each shard's `data/` and simulation folders and the kit's (from SP1) | **done**: part 1 (`94c4a55ed`) the three folders in `lint/shard-layout.json` and SHARDS.md; `check-chunks` refuses generator code in any chunk; `scripts/shard-platform.mjs` prints each shard's custom share against `lint/shard-platform.json` (baselines at `b96fed1a1`, every shard 100 % today: nothing is sorted yet) and `test/shard-platform.test.ts` holds the ceilings; a shard's ceiling is enforced from its conversion row on. Part 2 (this commit): `wildshard/no-runtime-generator` (hard in `.oxlintrc.json`: only generators import a `generators/` module, template specifiers included), `sim-no-render` over `src/shards/*/data/` (`SHARD_SIM_DIRS`; 0 sites, no shard has one yet), and `scripts/vercel-tree-gate.sh` prints the share table. The kit's and the shards' other simulation folders join when P2 creates them | M |

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
| Q5 | First-principles session (E435): which milestone proves the platform, converting the six first or a package that boots with no trusted code? | **Package-first.** Jake: *"Package-First since we already have a template as shard 7 Then the other 6 shards go for the 80/20 split."* The phase order is re-planned after the E435 audits (Claude + Codex, clean room); Fork B (the behaviour language) and Fork C (server authority) wait on their research |

## 9. How it runs

- A council round (docs/process/COUNCIL.md, three fresh seats) before the State goes `ready`.
- No repo lock. Engine and kit rows land behind the parity gate; a shard's conversion waits for its agents to be idle.
- Each commit is pathspec-only and goes through `scripts/push-main.sh`. A risky render or memory change ships
  default-off behind a Debug row until a phone reading backs it (RENDERING.md).
- Every step is identical under the harness, or a small difference batched onto one board per wave (systems,
  looks, bosses).

## 10. The shardfile: the grill with Jake (E435, in progress)

Jake, 2026-10-03: *"Grill me, let's brainstorm … everything is on the table, nothing is decided, let's make the perfect
shardfile plan together, let's fight against the limits of the existing shards, lets make it powerful and super
creative and fully open for great thing. But still give a stable baseline and development SDK + UX for building
performant & fun shards."* The evidence behind the earlier calls is the [Wildshard MMO Review](../reviews/wildshard-mmo-review.md).
Rows P1–P6 above are rewritten from these answers when the grill ends.

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

Written 2026-10-03 by the shard-platform agent, working the plan with Jake (asks E431, E433). P0 is done.

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
- SP5 part 2: `wildshard/no-runtime-generator` and `SHARD_SIM_DIRS` in `lint/wildshard-plugin.js` (fixtures in
  `test/fixtures/lint/cases.json`), the `shard-platform` step in `scripts/vercel-tree-gate.sh`.

**Next, in order:**
1. **A council round on P1–P6** (docs/process/COUNCIL.md, three fresh seats). The plan goes `ready`, and P1 starts,
   only after it.
2. **The open decisions to put to Jake** (question tool, one recommendation each): MMO-REQUIREMENTS O2 (centre shard
   or citadel), O3 (who ships a new WASM plugin), O4 (the plugin toolchain), O5 (live-update UX), O6 (one look or
   one per shard). None blocks P0–P2.

**Lessons from this session:**
- Run `scripts/vercel-tree-gate.sh HEAD` on your commit before `scripts/push-main.sh`. A lint change needs the
  `lint/` files, `test/fixtures/lint/cases.json` and `scripts/README.md` (liveness) checked, not only `src/`.
- Another agent's push may carry yours, and its gate may not have run on your commit.
- `lint/wildshard-plugin.js` and the lint fixtures are shared with ARCH-GUARDS work: ask arch-guards over herdr first.
- Imports are the workspace packages now (`@wildshard/engine`, `@wildshard/engine/data`, `@wildshard/kit` …), not
  `#engine`.
