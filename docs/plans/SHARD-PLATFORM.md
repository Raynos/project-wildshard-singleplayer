# Plan: SHARD-PLATFORM — MMO-compatible shardfiles in the singleplayer game (E431, E435)

**State:** `draft` 2026-10-04 — rewritten from Jake's E435 grill (§10, G1–G59) and the clean-room audits ([Wildshard MMO Review](../reviews/wildshard-mmo-review.md)); council round 1 folded in (register in [`shard-platform/reviews/`](shard-platform/reviews/register.md)). **Two parts** (G57): Part A, the core (the format, the seven shards ported, the 3 × 3 grid, loading and seamless travel; milestones M1 the package, M2 the grid, M3 the seven at 80/20), then Part B, stretch goals. The grid is a second main-menu entry, **EXPERIMENTAL Wildshard**, beside Select a shard (G58). P0 done. Next: council rounds 2–4 (G59); SF22a (memory) and SF0 (the frame floor) start now. Built by Codex and Opus lanes the coordinator dispatches (§9). Requirements: [MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md).

## 0. Read this first

Jake, E431 (2026-10-03): *"high level the vision is the MMO. … a high level plan to get to the 80/20 split. The 80/20
split can be 80% data and approved systems … The remaining 20% is custom runtime per shard so we don't have to rewrite
everything in one go."*

Jake, E435, the scope (G41): *"This plan and goal is purely to make shardfiles that are MMO & multiplayer compatible, I
do not want to build any multiplayer code, I want to refactor the singleplayer game to be about running a singleplayer
three.js game that contains shardfiles that are MMO/multiplayer compatible."* And the fence (G51): *"No fence, build
the whole thing, all … shards ported over, the fence is the 80/20 split, the fact you can leave the 20% of the hard
code to port in a ./runtime/ directory in typescript."*

**The goal.** The singleplayer game becomes a three.js game that runs **shardfiles**: validated, self-contained build
products a future MMO server could load unchanged together with the platform's headless sim (`@wildshard/engine/sim`,
SF4a). All seven shards are ported to 80/20 (G49): the template, Driftwood Isle, Pine Hollow, Nalati Grasslands, Signal
Dunes (slug `sunscar-dunes`), Sky Reach (slug `far-reach`) and Nine Dragon Stack. They meet on a **3 × 3 singleplayer
grid** joined by the highway and generated no-man's land (§3.3), reached from the main menu's **EXPERIMENTAL Wildshard**
entry; **Select a shard** keeps today's one-shard-at-a-time flow (G58).

**Compatible** means (G45, bounded determinism G48): the shard's sim runs headless in Node; a snapshot taken
mid-encounter restores and replays to the same state hash on the same engine; behaviour is AssemblyScript (bit-identical
everywhere by construction) or, during the transition, TypeScript in `runtime/`; shared state is host-owned declared
fields; rewards go only through the ledger interface. Cross-engine bit identity of the whole sim is **not** required
(§3.1).

**This plan does not build:** servers, rooms, netcode, an upload service, moderation, source storage, remix, a catalogue
service (G41, G47), or anything in WorldClaw (G47). Repo weight has its own plan, [REPO-WEIGHT](REPO-WEIGHT.md) (E436).
Decisions about the MMO platform (G13, G17, G19, G20, G23, G25, G26, G28, G34) are requirements the format stays
compatible with; G7's building and G36's grid events are later.

**The words:**
- **Shardfile:** the build product: `shard.json`, tiles with levels of detail, content rows, baked assets, AssemblyScript
  modules, declared budgets and state schema. Renderer-neutral (G32). Built, never hand-edited (G1).
- **Shard project:** `src/shards/<slug>/` as an SDK project (§3.5): generators (author's machine only), data, behaviour
  (AssemblyScript), quests, and during the transition `runtime/`.
- **Platform systems:** engine and kit code every shard uses through `@wildshard/sdk`: families, the script host, brains,
  quests, rigs, the commons, the UI kit, audio, toys, crowds …
- **Custom runtime:** a first-party shard's trusted TypeScript in `runtime/`. Transition only; the 20 %.
- **Grid-ready:** baked tiles + an edge profile + looks on families under one frame + within the caps. Behaviour may still
  sit in `runtime/` (C16). Grid-ready is separate from 80/20 so the grid doesn't wait on the hardest conversions.
- **DEVSERVER:** the local development build (`wildshard dev`, or `scripts/serve-build.sh` serving a dev build),
  detected at build time, never a URL switch. It shows every shard including Nine Dragon, explore mode, enter world and
  the usual dev controls (G46).
- **Dev mode:** the shipped game's Settings ▸ Developer switch (`src/engine/core/devMode.ts`).

## 1. The measures (exact)

Unit: non-blank, non-comment lines of `.ts` / `.tsx` under `src/shards/<slug>/`, counted by `scripts/shard-platform.mjs`.
Generated and baked output never counts.

- **Public side:** files whose import closure reaches only `@wildshard/sdk` and other public-side files of the same
  shard: `generators/`, `data/`, `behaviour/` (AssemblyScript), `quests/`, `shard.config.ts`.
- **Custom side:** `runtime/`, any file whose closure reaches a non-SDK module, and any legacy file not yet sorted. A kit
  module imported by exactly one shard counts toward that shard's custom side, so moving code into the kit lowers
  nothing (B16).
- **Measure 1, public-SDK share** = public ÷ (public + custom) ≥ 80 %. Before `@wildshard/sdk` exists (SF8b) it prints
  0 %.
- **Measure 2, runtime ceiling** = `runtime/` lines ≤ 20 % of the shard's lines at the baseline (`lint/shard-platform.json`,
  `b96fed1a1`; the template 550, Thin Ice from its own first commit).
- **Milestone booleans** the gate prints: the template boots from its shardfile with no trusted chunk; its sim steps
  headless in Node; snapshot → restore → replay passes; per shard: grid-ready and
  compatible (headless + replay + ledger, A15).
- An 80/20 shard whose gameplay still partly lives in `runtime/` is **transitional**, and the gate says so; its
  remaining runtime is an open conversion item, never "compatible" by percentage alone (A15).

## 2. Where it stands (measured)

- Every shard is **100–107 % custom** by today's script; nothing is sorted into `data/` or `generators/`.
- The loader instantiates trusted plugins with `App`, DOM and mutable services (`src/game/shard/pluginLoad.ts`,
  `ShardContext`); the four layers organise trusted code and are not a security boundary.
- The sim isn't headless: the aim ray comes from the viewmodel camera (`combat/Weapon.ts:56`); hit-stop scales the fixed
  step (`core/Game.ts:592, 753`); `ai/reach.ts` imports `app/runtime`; `entities/Animal.ts` (1,029 lines, 70 importers)
  imports three.js, `app`, `TIER` and `frameCost`.
- Determinism: host `Math.sin` / `cos` / `atan2` / `exp` differ between V8 and JavaScriptCore; physics is
  `@dimforge/rapier3d-simd` 0.21.0 in one world (`physics/Physics.ts:24`); three.js maths classes call host trig.
- The template declares a **200³** cell; Nine Dragon passes the world contract against a flat datum it never draws;
  Sky Reach skips it; Driftwood and Sky Reach are edge-exempt (`lint/edge-exemptions.json`).
- Placement is scattered in manifests (Driftwood (−1, 6), Pine Hollow (3, −2), Nalati (4, −2) …): no two grid shards are
  neighbours.
- One shard alone uses 153–587 MB of phone GPU (`src/shards/*/budgetCeilings.ts`); shards are monolithic; travel is a
  page reload (`src/game/travel/travel.ts`). Pine Hollow already ships 19 KTX2 files.
- Coupling: `ctx.app` 95, `ctx.game.runtime` 32 in the two newest shards; 3 direct `Weapon` subclasses; 13
  `CreatureBrain`, 2 + 4 boss classes; 45 function fields in rows (`lint/row-functions.json`), about 38 more in
  `ShardManifest` (A1).
- Kept as they are: data quests (`validateQuest`), ten data interactable kinds, versioned saves (valibot), scope-owned
  resources + the leak test, seeded RNG and the game clock, the typed event bus, per-shard budgets in the parity and GPU
  gates. ARCH-GUARDS is archived: **this plan owns the guards** (B20).

## 3. The contracts

### 3.1 Determinism: bounded (G48)

Jake: *"Bounded, or even Bounded lite. This benefits from a timebox too."*
- **Required:** (a) behaviour in AssemblyScript (its own libm: bit-identical across engines, measured); (b) the whole sim
  steps headless in Node; (c) record → replay and snapshot → restore → replay give the same state hash **on the same
  engine**; (d) each shard simulates in its **own local frame** (no cell offsets inside the sim), so the client's sim
  matches what a server would run (C5).
- **No cross-engine check beyond scripts** (Jake, 2026-10-04, after G48: *"identical results everywhere only for
  scripts (AssemblyScript gives that for free), and same-engine replay in Node for everything else."*). The player motor
  isn't hash-tested across engines; server corrections absorb any drift.
- **Out (G48):** a cross-engine motor test, the deterministic Rapier build, whole-sim cross-engine identity, fixed collider order across engines,
  three.js trig in the sim. (Closes B8, B9 and C3 as settled.)

### 3.2 Caps v0 (phone; provisional, tuned by SF22a and SF22)

From the streaming research (`docs/design/mmo/research/e435/streaming-claude.md` §3.1), adopted as constants beside
`CELL_*` in `@wildshard/engine/core/config` (C6, B13):

| | L0 tile (62.5 m) | L1 tile (125 m) | Far proxy (per shard) | Shard fixed cost (library) |
|---|---|---|---|---|
| Resident | 5 MB | 2.5 MB | 1.6 MB | 25 MB |
| Download (compressed) | 0.3 MB | 0.2 MB | 1 MB | 8 MB |
| Triangles | 40k | 10k | 8k | — |
| Draws (instanced) | 8 | 2 | 1 | — |

- Engine base: **300 MB, unverified** until SF22a measures it. Playing envelope ≤ 850 MB; loading ≤ 1.8 GB; render
  scale 2×.
- `validate` checks the **worst 150 m disc** (all L0 tiles inside it + up to four shard libraries) against the envelope,
  as UEFN checks memory at every location (C34).
- The tile hierarchy is **62.5 m (L0) → 125 m (L1) → whole shard (far proxy)**; no 250 m level (C36).
- Sim residency (colliders, heightfield, entities, scripts) is budgeted per shard: ≤ 40 MB.

### 3.3 The singleplayer grid (G46, G49)

Jake: *"the first game can be Driftwood in the center, then nalati / pine wood, then to finish a 3x3 grid render the
template in the empty slots. In dev mode we have 5 shards, so you render 4 templates in the empty slots."*

| | x = −1 | x = 0 | x = +1 |
|---|---|---|---|
| **z = +1** | template | Pine Hollow | template |
| **z = 0** | template · *dev: Signal Dunes* | **Driftwood Isle** | Nalati Grasslands |
| **z = −1** | template | template · *dev: Sky Reach* | template |

- Shipped: 3 shards + 6 template instances. Dev mode: 5 shards + 4 templates. DEVSERVER: Nine Dragon replaces one
  template cell (its own toggle), plus explore mode.
- Placement lives in one platform grid file (`src/game/grid/singleplayer.json`), never in shard files (W6, B6). Template
  instances are one shardfile placed several times, each with its own save namespace keyed by cell.
- The outer ring's no-man's land eases to an **empty-neighbour profile**: open sea at road level with fog (C15).
- Pitch 555 m (N = 20 m, G37), tuned by SF22. Render origin rebases per cell (C39).
- **The main menu has two entries** (Jake, G58): *"Select a shard => existing shard selection UI; EXPERIMENTAL wildshard =>
  the 3x3 seamless grid. Basically if loading the 3x3 seamless grid crashes the game on iphone with memory error I want to
  be able to go back to select a shard and the existing load one shard at a time flow."* Select a shard is today's flow,
  unchanged; it is also where explore mode lives (behind the dev toggle, G46). The grid stays behind its EXPERIMENTAL label
  until Jake says otherwise; that label is what satisfies the default-off rule for risky memory changes (C7, ledger 5).
- Dev mode changes apply at the next grid start (return to title), never live under the player (A17, C23).

### 3.4 Versioning (G29)

- One integer **`SHARDFILE_VERSION`** covers the format and the script ABI; the legacy `SHARD_API` stays for plugin
  shards until they're gone (B19, C24).
- The client loads the current version and the one before it during the window (~72 h until the public grid), and shows
  a "needs upgrade" card for older ones; their source and saves are untouched (A16).
- First-party shardfiles rebuild on every build, so they're always current; an outside author upgrades with
  `wildshard upgrade` (stretch goal S18).

### 3.5 Where a shard project lives and how it builds (B4, B17)

```
src/shards/<slug>/
  shard.config.ts      the manifest source → shard.json (identity, budgets, look, sim contract, state schema)
  generators/          build-time code (models, terrain, scatter): never shipped
  data/                serialisable rows and layouts
  behaviour/           AssemblyScript entity and director scripts
  quests/              quest graphs and dialogue trees (TypeScript → data)
  assets/              source assets (GLB, textures, audio) the baker reads
  runtime/             transition only: trusted TypeScript (the 20 %)
```

- `@wildshard/sdk` is a fifth workspace package (`src/sdk`, a layer above kit; its CLI may import the engine, game and kit
  public exports; shard projects import only the SDK). The layer guard learns the new layer.
- `wildshard build` writes `public/shardfiles/<slug>/` (git-ignored). `pnpm build`, the push gate and Vercel run it for
  every shard. `gen-shards.mjs` and `slugs.generated.ts` read the grid file.
- `wildshard dev` is **rebuild-and-serve** (watch → build → static serve → reload), not Vite HMR, so it fits MACHINE.md
  (B18).
- Outside authors get the SDK as `pnpm pack` tarballs plus a prebuilt client bundle, installed by `file:`. The toolchain
  is JavaScript-only (asc + a binaryen.js fuel injector), so no Rust is needed (C10).

## 4. Rows

Every row names its **lane** (routing, §9): **X** = Codex GPT-6.1 Sol high, **O** = Opus 5.5, **X+O** = Codex builds,
Opus does the visual part or judges it. Sizes: S ≤ ½ day, M ≤ 2 days, L ≤ 5 days for one agent; an L row splits
further when it starts if it can.

### Part A — the core: shardfiles, the seven shards ported, the 3 × 3 grid and seamless travel

Jake (G57): *"we want to get the 6 shards ported over to the shardfile format first, we want to render the 3x3 grid first, we want to figure out the traversal and loading and seamless travel first."*

#### P0 — Guardrails and the metric (before any move)

| Row | What | Done when | Size |
|---|---|---|---|
| SP0 | This plan and the requirements doc ([MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md)) | **done** `4a95c2454` (E431) | S |
| SP1 | **Fix `sim-no-render`'s scope**: the rule named `engine/quests` and `engine/effects`, which never existed, so `engine/quest` went unchecked. Now `ai`, `combat`, `events`, `quest`, `saves` less their `view` parts, all at 0; a test fails when a listed folder doesn't exist (the hole ARCH-GUARDS AG24 missed). Widening it over kit and shard code moves to SP5: it needs the `data/` and simulation folders to know what is simulation | **done** (`d3c786833`): a planted renderer import in `engine/quest` now fails; the quest and event code passes at 0 | S |
| SP2 | **Reserve the `profile` save scope** (SHARD-PLATFORM-PLAN G-6): the scope exists in `SaveStore`, no key uses it yet; the travel handoff names it as its future home | **done** (`7bcfd077d`): `SaveScope` has `profile` (own document, exported / imported like `global`, mirrored in the native shells); no level namespace may take a scope's name | S |
| SP3 | **Rows are serialisable** (SHARD-PLATFORM-PLAN G-2): a test round-trips every registered row (items, effects, damage rules, strikes, loot, spawns, species, bosses, interactables, quests, day keys) through JSON. Function-valued fields become **named ids** into an engine registry (`weight: 2` or `{ fn: 'weight.distance' }`; `when: { flag: … }`); a ratchet counts the function fields left (StrikeSpec.weight, WeightedTable.when ×19, think / act, curves, WeatherProfile) | **ratchet done** (`d42ef3214`): `scripts/check-row-data.mjs` walks 44 content row types with the TypeScript compiler; **45 function fields** today (SpeciesLook 9, DayCycleSpec 7, WeatherProfile 4, NpcRow 4, LevelAudioProfile 4, BowProfile 3, the tables' `when` 3, think / act, StrikeSpec.weight …) in `lint/row-functions.json`, which may only shrink; `test/row-data.test.ts` fails a new field and locks the pure-data rows (effects, damage rules, bosses, encounters, interactables, quests). Turning the 45 into named ids is P2 / P3 work, field by field | M |
| SP4 | **The world contract** (SHARD-PLATFORM-PLAN G-5, MMO W1–W6). Jake 10-03: the 500 m cell splits **250 m below and 250 m above** the highway level (O1); Driftwood (open sea) and Sky Reach (floating islands) are **exempt now and fixed in P5** (SP22, SP23). Built: `CELL_HEIGHT` / `CELL_BELOW` / `CELL_ABOVE` in `@wildshard/engine/core/config`; `test/world/world-contract.test.ts` holds every level's ground inside the cell and level with the highway across each edge entry (15 m wide, 50 m in); `lint/edge-exemptions.json` may only shrink. Moved: the full walk from each edge (colliders, water, structures) is SP10's validator; `placement` leaving the manifests is SP29 (server-owned fields leave the package) | **done** (`b96fed1a1`): all seven levels pass; the exempt two are listed with their fixing row | M |
| SP5 | **The metric and the folders**: `generators/`, `data/`, `runtime/` join `lint/shard-layout.json` (AG9) and SHARDS.md; `lint/shard-platform.json` with today's baselines; the gate prints each shard's custom share; `wildshard/no-runtime-generator`; the chunk check for `generators/`; `sim-no-render` widened over each shard's `data/` and simulation folders and the kit's (from SP1) | **done**: part 1 (`94c4a55ed`) the three folders in `lint/shard-layout.json` and SHARDS.md; `check-chunks` refuses generator code in any chunk; `scripts/shard-platform.mjs` prints each shard's custom share against `lint/shard-platform.json` (baselines at `b96fed1a1`, every shard 100 % today: nothing is sorted yet) and `test/shard-platform.test.ts` holds the ceilings; a shard's ceiling is enforced from its conversion row on. Part 2 (`94c4a55ed`): `wildshard/no-runtime-generator` (hard in `.oxlintrc.json`: only generators import a `generators/` module, template specifiers included), `sim-no-render` over `src/shards/*/data/` (`SHARD_SIM_DIRS`; 0 sites, no shard has one yet), and `scripts/vercel-tree-gate.sh` prints the share table. The kit's and the shards' other simulation folders join when P2 creates them | M |


#### F0 — Honest foundations, and memory measured first

| Row | Lane | What | Done when | Size |
|---|---|---|---|---|
| SF0 | X | **The frame floor** (§9.4): `scripts/frame-floor.mjs` measures every playable surface on desktop (Chromium on Metal, uncapped, 2×: ≥ 60 fps) and on the iOS Simulator (Safari via `scripts/sim-lane.sh`: ≥ 30 fps); baseline first; misses become fix rows | Today's baseline committed in `progress/frame-floor/`; the script runs in under 10 minutes for all seven shards | M |
| SF1a | X | **Guard bootstrap.** Add `ShardManifest` and `ground.terrain` to `scripts/check-row-data.mjs`; record the ~38 existing fields with provenance ("legacy, pre-SF1"); re-baseline `lint/row-functions.json` once in this commit (A1, B21) | The expanded list is committed with each field's provenance; the count is stated in the commit | S |
| SF1b | X | **Shrink-only comparators that work.** Comparators take an explicit baseline file and candidate file; pre-commit compares the index with `HEAD` (config-only edits included, `scripts/precommit-guards.mjs`); the push gate exports the predecessor's lists into its tree (`scripts/vercel-tree-gate.sh`) (A2). Covers row functions, edge exemptions, shard-platform ceilings | A fixture that raises a list together with matching code fails after commit; an unknown shard fails | M |
| SF1c | X | **The transition allowlist**: the six shards, the template and Thin Ice (its 20 % ceiling from its first commit) may hold `runtime/`; "a new shard" = not in `lint/shard-platform.json`, and it may not (A3, B12) | Thin Ice's runtime passes; a new shard with `runtime/` fails | S |
| SF1d | X | **Honest contract tests**: a JSON round-trip over every `data/` folder; the world-contract test fails a flat datum that isn't drawn unless listed (Nine Dragon, Sky Reach listed by name); structure bounds checked against the cell; the template declares 500³ | One failing fixture per rule; the template manifest says 500³ and its world is unchanged | S |
| SF1e | X | **Stale ids**: every SP22/SP23/SP10/SP29/SP31 reference in `lint/`, `scripts/` and `test/` points at the new rows (SF46, SF49, SF8a, SF15b, SF53) (B1, C9) | `rg "SP(10|2[2-9]|3[01])" lint scripts test` is empty | S |
| SF2 | X | **Measure, don't estimate**: `scripts/shard-coupling.mjs` prints `ctx.app` / `ctx.game` / `ctx.game.runtime` reaches, engine subclasses and non-data `ShardContext` members per shard, with a ratchet | §2's numbers come from it; a rise fails | S |
| SF3a | X | **Headless means the import closure**: `sim-no-render` walks the import graph from the sim folders (engine `ai/ combat/ events/ quest/ saves/`, every shard's `data/` and `behaviour/`): no three.js except maths types, no `app/runtime`, no DOM, no `TIER` / `frameCost` | A planted transitive import fails; current violations are listed with an owner row | M |
| SF3b | X | **`Animal` sim/view split**: entity state and simulation move to a sim module with no three.js object graph; the view module renders it; `ai/reach.ts` stops importing `app/runtime`; the 70 importers move in batches behind parity (C19) | `Animal`'s sim module passes SF3a; parity identical on all seven shards | L |
| SF3c | X | **The rest of the closure**: every violation SF3a listed is fixed or moved to a view module | SF3a passes at 0 | M |
| SF4a | X | **`@wildshard/engine/sim`**: a versioned headless entry that boots a shard's sim in Node with no renderer (the artifact a server would embed, C30) | The template's sim steps 10,000 ticks in Node | L |
| SF5a | X | **Commands for motor and look**: the player's movement and camera come from recorded input commands, not live input reads | A recorded walk replays to the same position hash in Node | M |
| SF5b | X | **Aim and hits from commands**: aim from the input command, not the viewmodel camera (`combat/Weapon.ts:56`); hit-stop visual only (`core/Game.ts`); stable entity ids independent of tile and LOD | A recorded fight replays to the same hash; parity identical | M |
| SF5c | X | **The rest of the commands**: interact, mount, UI-triggered actions; RNG streams and the clock export and restore their state | A recorded session with interactions replays exactly | M |
| SF4c | X | **Snapshot → restore → replay** (same engine): the snapshot holds entity state, timers and pending events, RNG streams, physics state, script memory and globals, quest state and the ledger's dedupe record; restore into a fresh host mid-encounter and replay the suffix (A6) | The template, snapshotted during its boss fight, replays the suffix to the same hash in Node | M |
| SF4d | — | ~~Motor cross-engine hash~~ **dropped** (Jake, 2026-10-04: identical results everywhere only for scripts; same-engine Node replay for everything else) | — | — |
| SF6 | X | **The two measures** (§1) and the booleans in `scripts/shard-platform.mjs` and the push gate; today's metric renamed "legacy TS" (A4, B5, B15, B16, C20) | Fixtures: moving code to the kit doesn't raise the share; padding generated output doesn't; AS files count public | M |
| SF22a | O | **Measure before designing the format** (C31): the empty template's engine base on the iOS Simulator, and a synthetic 2 × 2 rig of tiles at §3.2's caps, no shardfile needed | §3.2's engine base and caps are confirmed or revised in this plan before SF7a freezes them | M (starts first, alongside SF0) |

#### F1 — The shardfile → **M1 the package**

| Row | Lane | What | Done when | Size |
|---|---|---|---|---|
| SF7a | X | **Format v0** (`docs/SHARDFILE.md` + valibot schemas): identity and `SHARDFILE_VERSION`; requires; budgets (§3.2); look (family refs, grade, sky / fog / day keys on the engine clock); the **sim contract** (60 Hz fixed step, script tick divisor, command and snapshot schema versions, C29); **declared shared-state fields, host-owned**, and per-player state scoped by actor id (A7, C11); author caps (player cap G26, speed cap G39); server-budget fields (B4); state-schema version (G17, G18); privacy classes (U4); edge profile; `commons:` references (C33); content-addressed files with a dependency graph and declared compressed, decoded and GPU sizes | One rejection fixture per rule; the schema is published as the SDK's API | L |
| SF7b | X | **The project layout and the build in the repo** (§3.5): `shard.config.ts`; the layout lint for shardfile shards (no `plugin.ts` required); `public/shardfiles/` git-ignored; `pnpm build`, the push gate and Vercel run `wildshard build`; `gen-shards.mjs` reads the grid file | A clean checkout builds every shardfile in the push gate | M |
| SF7c | X | **Named ids for the template's function fields**: StrikeSpec.weight, WeatherProfile.\*, DayCycleSpec.\*, SpeciesLook.\* (grey blob, boar) become registered ids or data (B2, C2) | Those types reach 0 for the template in `row-functions.json`; the rest of the 45 have an owner row each | M |
| SF7d | X | **The template inventory** (in this plan, §4.1): every trusted surface of the template mapped to the F1 row that replaces it (A5, B3, C1) | §4.1 is complete and every line has a row | S |
| SF7e | X | **Items v0**: weapon and tool rows over kit families with AssemblyScript hooks; the template's whip and lantern become rows (a thin slice of SF36) | The whip and lantern work from data + a script; their classes are deleted | M |
| SF7f | O | **Markers v0**: the template's DOM pin (`plugin.ts:98`) becomes a declared marker (a thin slice of the UI kit, SF28) | No `document.createElement` in the template | S |
| SF8a | X | **`wildshard new / build / validate`**: schemas, references, budgets and the worst 150 m disc (C34), cell bounds, asset parsers with caps for GLB / KTX2 / audio and a malformed fixture per type (B35); builds are deterministic, so two clean builds give byte-identical shardfiles (B37) | A new project builds and validates; each rule has a fixture | L |
| SF8b | X | **`@wildshard/sdk`** as a workspace package (`src/sdk`), the layer guard taught the new layer, `pnpm pack` tarballs + a prebuilt client bundle for outside authors (B17, C10) | A project outside the repo installs the tarball by `file:` and builds | M |
| SF8c | X | **`wildshard dev` + validate's sim checks**: rebuild-and-serve in the real client on the floating cube; validate steps the sim headless (SF4a) and walks every edge entry through the colliders (C8) | Editing a file rebuilds and reloads the shard; a blocked edge fails validate | M |
| SF9a | X | **The baker, terrain**: heightfields cut into L0 / L1 tiles with heightfield colliders and the edge profile; hand overrides | The template's terrain loads from tiles | L |
| SF9b | X+O | **The baker, props and scatter**: static props merged per tile, scatter as instance lists, the far proxy mesh, KTX2 → ASTC, the per-tile budget report; Opus reviews the visual result on a portrait board | The template's world bakes within §3.2's caps; the board matches today's within the parity script's threshold (`scripts/parity/compare.mjs`) | L |
| SF10a | O | **Material families v1**: toon, PBR, painterly and emissive, renderer-neutral parameters, precompiled before first use; the acceptance set is the three grid shards' looks (C22) | Each family renders one grid shard's reference prop like today's on a board | L |
| SF10b | O | **Look v0 as data**: sky, fog and day keyframes on the engine clock, a grade LUT; the template's GLSL sky dome and `patchShader` fog go | The template's look comes from `shard.json`; no shader code in its shardfile | M |
| SF11a | X | **The script toolchain and admission**: asc build, the binaryen.js fuel injector, and an admission check that refuses a module before running it: imports outside the ABI, banned features, memory / table limits, a call-depth limit, missing instrumentation (A8) | A forged shardfile with valid hashes and an unmetered loop is refused by validate and by the loader without executing | M |
| SF11b | X | **The script host**: one instance per script module per shard, entity handles passed in (C13); fuel per call; a host memory cap; per-shard allowances for instances, effects, spawns, events and host queries (A9); read-only deterministic host queries (raycast, overlap, nearest, path), charged fuel (C12); effects validated and applied atomically, NaN or out-of-range rejected; a trap discards the instance and restores its last good snapshot, the entity freezes and stops being interactive, a dev-only toast names it; repeat offenders are disabled (A10, B34, C25) | Fixtures: endless loop, hoarder, NaN effect, trap after output (no partial change), spawn flood, event cascade | L |
| SF11c | X | **Entity scripts and the local sim lane**: server scripts run in the singleplayer sim; shared state only through effects on declared fields; per-player state by actor id | A headless test with two synthetic actors: the shared door agrees, private quest progress stays separate (A7) | M |
| SF12 | X | **Quests and dialogue as data**: graphs and trees authored in TypeScript, compiled to validated data; script hooks for custom conditions and scenes | The template's quest runs from its shardfile; journal and markers unchanged | M |
| SF13 | X | **One platform brain + a spawner**: an archetype with parameters over perception and navigation | The template's grey blobs run on it | M |
| SF14 | X | **The ledger interface**: fact id = shard + revision + entity id + sim tick + ordinal, made by the host (C25); provenance; an allowed reward mapping (platform things only, G25); one atomic durable write with the dedupe record; a failed write retries and never grants twice (A11) | Replayed, reloaded and retried facts grant once; no shard code writes the profile | M |
| SF15a | X | **The shardfile loader**: boots a shard from its shardfile with no trusted chunk; scope-owned; leak test; current and previous `SHARDFILE_VERSION` (§3.4); offline boot of a visited shardfile (B26) | `check-chunks` finds no template chunk; load → unload leaves nothing; the offline-reload gate passes | M |
| SF15b | X | **The hybrid loader** for converted first-party shards: shardfile + its trusted `runtime/` chunk; placement read from the grid file (B6) | Driftwood boots as shardfile + runtime chunk with parity identical | M |
| SF16 | X+O | **M1 proof.** The template (per §4.1) boots from its shardfile with no trusted chunk; its sim steps headless in Node; snapshot → restore → replay passes; Opus judges the look against today's on a board. (The outside-author trial moved to the stretch goals, S19) | All the template's milestone booleans true | M |

#### 4.1 The template inventory (SF7d fills the gaps)

| Trusted surface today | Replaced at M1 by |
|---|---|
| `TemplateWhip extends Weapon` | SF7e (weapon row + script) |
| `TemplateLantern extends Tool` (PointLight) | SF7e (tool row + script) |
| `look/render.ts` sky dome `ShaderMaterial`, `patchShader` fog, `createDay()` | SF10b (look as data on the engine clock) |
| `terrainPainter` `PlaneGeometry` | SF9a (baked terrain) |
| `playground/JumpCourse.ts` | SF9b (baked props) + an SF11c script |
| `plugin.ts:98` DOM pin via `ctx.hud.pin` | SF7f (marker) |
| Grey blob and boar species (`think` / `act`, `SpeciesLook`) | SF13 + SF7c |
| Quest install with closures | SF12 |
| Bag fragments, HUD widgets | SF7e + SF7f |

#### F2 — The 3 × 3 grid, loading and seamless travel → **M2 the grid**

| Row | Lane | What | Done when | Size |
|---|---|---|---|---|
| SF17a | X | **The grid file and assembly** (§3.3): signed coordinates, the 3 × 3 layout, the empty-neighbour profile, render origin per cell | The grid assembles from `singleplayer.json` with placeholder cells | M |
| SF17b | O | **Highway deck and seams**: the engine-owned deck; no-man's land generated from both neighbours' edge profiles, four-way at crossroads (G37) | At every seam the height step ≤ 2 cm and ground colour ΔE ≤ 3; a portrait board of each crossroads | L |
| SF18a | X | **Sim residency per shard**: a shard's whole sim (colliders, heightfield, entities, scripts) loads in a fixed order when the player nears it, in its own local frame with a physics world per active shard; the highway is its own space; neighbours stay frozen and visible (C4, C5, C14, A14) | The template at cell (1, 0) hashes the same as at (0, 0); an opened door and a hurt creature survive unload → reload | L |
| SF18b | O | **Render streaming**: rings (L0 to 150 m + a lookahead, L1 to 400 m, far proxies in bounded rings), parent-first refinement, decoding in workers, one residency allocator (A18) | Driving the grid never shows a hole; resident memory stays in the envelope | L |
| SF18c | X | **The tile cache**: content-addressed Cache Storage with a quota policy (C35) | A second drive downloads nothing; offline replay works | M |
| SF18d | X | **Traversal safety**: the highway and seams are always solid; a shard's colliders load before the player reaches its edge (prep distance = speed × (max stall + decode time)); past that bound proxies show, never a fall (A13) | Cold cache, late collision, a U-turn and a 3 s stall at 30 m/s: no fall | M |
| SF19a | O | **One frame**: the camera owns sun, sky, fog and exposure under one world clock; per-shard time overrides blend across edge bands; a shard-id buffer picks each pixel's grade; a neutral highway look | Four looks read as one view at a crossroads (board) | L |
| SF19b | O | **Each shard's look under one frame**: the old full-screen look stays as a Debug variant (and stays live in explore mode); a portrait board per changed look goes to Jake | Jake's pick per shard; losing variants deleted in the pick commit | M |
| SF20a | X | **Seamless crossing**: no page reload between shards (replaces `travel.ts`); platform things travel, shard items stay in their shard's save, a held shard weapon is stowed at the border (G25, B23) | Crossing has no hitch and loses nothing; the old handoff is deleted | M |
| SF20d | X | **Speed and border rules**: hoverboard and horse ~15 m/s inside shards (HOVER_TOP is 14 today); an author may lower it; creatures stay home; no cross-border combat; the highway is safe; a mount crosses with its rider as one unit; neighbours visible, read-only (W7g) | One test per rule | S |
| SF21a | O | **The main menu: two entries** (G58): **Select a shard** (today's shard selection, one shard at a time, unchanged) and **EXPERIMENTAL Wildshard** (the 3 × 3 seamless grid). If the grid crashes or runs out of memory on the phone, Select a shard still works and is the way back. Dev mode adds Signal Dunes and Sky Reach to the grid (applied at the next grid start); DEVSERVER adds Nine Dragon and explore mode | Both entries reachable from the title; a forced grid failure returns to the title with Select a shard working; saves of every shard intact | M |
| SF22 | O | **The crossroads gates**: the SF22a rig plus the grid's real crossroads at 2× render scale, a scripted 30 m/s drive through 5 Mbit/s with 3–10 s stalls; the Simulator first, then one physical-iPhone reading by Jake; the grid stays behind the EXPERIMENTAL entry either way | ≤ 0.85 GB peak; 95 % of frames ≤ 33.3 ms; no holes or falls; no shader compile at the first crossroads; no tab kill in three runs | M |
| SF23 | O | **The far view** in bounded rings: a baked low-poly proxy per shard; impostors beyond ~2.5 km (B28) | Every shard within the rings is visible; boot residency doesn't grow with the grid | M |

#### Systems the seven shards use today (pulled by their conversion rows)

| Row | Lane | System | Used today by | Done when | Size |
|---|---|---|---|---|---|
| SF24 | X | The **shard director** and typed events (G9); grid-event subscriptions reserved in the API (G36) | The template's finale; Nalati's and Pine Hollow's shard-wide events | Each consumer's events run from a director script | M |
| SF25 | X | **Client scripts**: presentation only, a read-only view of declared state (G10) | Driftwood's ambient life, every shard's particles | A client script drives particles; a fixture proves it can't write shared state | M |
| SF26 | X+O | **The commons v0**: the kit content the shards share today (props, species, sounds) shipped once and cached across shards, referenced with `commons:` (G6) | Every shard using kit content | A commons asset downloads once for two shards; memory at a crossroads counts it once | M |
| SF27 | X | **Brains**: the archetypes the shards use today, boss phase tables, custom AssemblyScript brains over the host queries (G12) | Every shard's creatures; Pine Hollow's Antler King | Each shard's creatures run on platform or AS brains (unique bosses may stay in `runtime/`) | L |
| SF28 | O | **The UI kit** for what shards show today (markers, toasts, quest panels, the trader and shop panels, counters) in platform slots; HUD changes over herdr (E332) (G22) | Pine Hollow's trader, Nalati's camps, the template's markers | No shard builds DOM; each panel is declared | L |
| SF29 | X | **Audio as data**: the cue maps, ambience zones and scores the shards use today (G24) | Every shard | Each shard's audio comes from its shardfile | M |
| SF30 | X | **Movers and toys the shards use today**: Sky Reach's winch and bridges, Nine Dragon's movers, rope bridges, sails (G21) | Sky Reach, Nine Dragon, Driftwood | Their movers run from data + scripts; physics baseline 0 stuck | L |
| SF33 | X | **Saves in the format**: per-player progress, declared shared-state fields, additive schemas and author migrations tested on real saves (G18, C26) | Every conversion | A conversion keeps a current save of its shard | M |
| SF34 | X+O | **The player modes used today** as platform modes: hover (the hoverboard), ride (Nalati's horse), grapple (Nine Dragon's Fei Zhua) (G3) | Nalati, Nine Dragon, Sky Reach | Each runs from the SDK | L |
| SF36 | X | **Items**: the weapons and tools the shards use today as rows over kit families with AS hooks (the whip, the war fan, the Lever Rifle, Nalati's four); signature-item and skin fields reserved (G13) | Every shard's loadout | Every shard weapon is a row + script or sits in `runtime/` | M |
| SF38 | O | **The points budget overlay** in `wildshard dev` and the dev build: one cost score per tile and shard, green / amber / red, raw numbers one tap away (G30) | Every conversion (memory) | The overlay shows each shard's and the crossroads' cost | M |
| SF45 | X | **`docs/SHARDFILE.md` and the SDK docs** from the schemas (A1) | Every conversion | Every schema field and ABI call documented | M |

#### C — The seven shards ported → **M3** (from M1; all seven to 80/20, G49)

Every conversion row: grid-ready first, then behaviour into AS or `runtime/`; a **save migration** tested on a current
save of that shard (C26); the legacy plugin path stays as a Debug variant until Jake picks, the measures count only the
default path, and the legacy code goes in the pick's commit (C27); the per-shard compatibility checks (headless, replay,
ledger) pass on whatever it claims (A15).

| Row | Lane | Shard | Specific exits | Size |
|---|---|---|---|---|
| SF46 | X+O | Driftwood Isle (grid centre) | Four edge entries (pier / sandbar roads) walked by validate and `driftwood-isle` removed from `edge-exemptions.json` (B10, C9); a board to Jake for the level change; DRIFTWOOD-REMASTER-V2's V-B1 Blender pass is still open, so bake through SF9 or after it (B29) | L |
| SF47 | X+O | Pine Hollow | Starts with a `gpuTrace` breakdown of its 587 MB; targets from §3.2 (library ≤ 25 MB, tiles in caps), work ordered by MB saved (C21) | L |
| SF48 | X+O | Nalati Grasslands | Riding (SF34), two bosses (the Golden King, the Storm Titan; B42), four weapons (SF36); its painterly look under one frame (SF19b) | L |
| SF49 | X+O | Sky Reach (`far-reach`) | Its edges get entries or a seam treatment; `far-reach` leaves `edge-exemptions.json`; hover bridges (SF34), movers (SF30) | L |
| SF50 | X+O | Signal Dunes (`sunscar-dunes`) | Sky and sand shaders onto families, or into `runtime/` until the graphs stretch goal (S5); the bullwhip onto items | L |
| SF51 | X+O | Nine Dragon Stack (DEVSERVER only) | Its strata as they work today (interiors culling is the stretch goal S2); neon look checked against SF19; grapple on SF34 | L |
| SF52 | X | The template | Done at M1 (SF16): the reference shard, no `runtime/` | — |
| SF53 | — | Thin Ice | Its own plans; only its `runtime/` ceiling is measured here (T4, G47) | — |

Part A ends at 80/20 for all seven; 90/10 and 100/0 are successor plans (C38).

### Part B — stretch goals

Jake (G57): *"Stretch goals at the bottom like "crodws of hundreds of creatures", "interiors", "physics toys", "ai playtesters", "one lcick vercel preview". Basically anything in the plan that's being built that is not being used in the 6 shards today, goes to the bottom of the plan as stretch goals."* Each starts only after Part A, or earlier when a shard's port needs it. Their decisions in §10 stand; done-whens are written when one starts.

| Row | Was | What |
|---|---|---|
| S1 | SF31 | **Crowds**: hundreds of creatures or NPCs with LOD AI and animation |
| S2 | SF32 | **Interiors and verticality**: stacked spaces with streaming and occlusion culling |
| S3 | SF30, SF20b, SF20c | **New physics toys and vehicles**: boats, carts, gliders, ragdolls, destructibles; the **highway car** (30 m/s, its HUD control over herdr and to Jake) and **auto-path** along the highway (G33, G39, G40) |
| S4 | SF34 | **New player modes** (swim, climb, drive) and **author movement modes** in AssemblyScript (G14) |
| S5 | SF35 | **Material graphs**, then **restricted shader code**, compiled per renderer (G4 stages 2–3) |
| S6 | SF37 | **The WebGPU spike**, default-off behind a Debug row (G32) |
| S7 | SF26 | **Standard rigs** (humanoid, quadruped, bird, serpent, insect) and a shared clip library (G8) |
| S8 | SF29 | **Adaptive music**: director-driven stems, reverb zones (G24) |
| S9 | SF28 | **The sandboxed UI panel canvas** for minigames (G22) |
| S10 | SF33 | **Shared world state with reset rules**, and later **player building** after three building shards (G7) |
| S11 | SF17c | **Signposts** on the highway: shard name, author, rating (G35) |
| S12 | SF38 | **The phone QR** in `wildshard dev` (G2) |
| S13 | SF39 | **The one-click Vercel preview** (G2) |
| S14 | SF40 | **Bot playtests** at validate: every quest objective reached, no stuck spots (G16) |
| S15 | SF41 | **The AI playtester** with Clef / Jev (G31) |
| S16 | SF42 | **Starters**: `npm create wildshard` with three starter shards (G15) |
| S17 | SF43 | **`/wildshard-quickstart`** (G47) |
| S18 | SF44 | **`wildshard upgrade`** and a version window past "rebuild every build" (G29) |
| S19 | SF16 | **The outside-author trial**: a clean-room agent builds the battery shard from the SDK tarball alone (A6) |
| S20 | — | **Grid-wide events** through the director's reserved subscriptions (G36) |

## 5. Order and why

1. **Now, alongside the council:** SF22a (memory: the empty template's engine base and a synthetic four-corner rig on the
   Simulator; Jake: memory is a huge problem) and SF0 (the frame-floor baseline). Their numbers set §3.2's caps before
   SF7a freezes them.
2. **F0**: SF1a → SF1b → (SF1c, SF1d, SF1e, SF2) in parallel; SF3a → SF3b → SF3c; SF4a after SF3b; SF5a → SF5b → SF5c →
   SF4c; SF6 after SF1a.
3. **F1**: SF7a → SF7b → (SF7c–SF7f, SF8a, SF8b, SF9a, SF10a, SF11a, SF12, SF13, SF14) in parallel → (SF9b, SF10b,
   SF11b → SF11c, SF15a, SF15b, SF8c) → SF16. **M1** = SF16 passing.
4. After M1, in parallel: **F2** (SF17a → SF17b; SF18a → SF18b, SF18c, SF18d; SF19a → SF19b; SF20a, SF20d; SF21a; SF23;
   then SF22) and **the conversions** (Driftwood first, then Pine Hollow and Nalati, then Sky Reach, Signal Dunes, Nine
   Dragon), each pulling the systems it uses from the "used today" table. **M2** = the 3 × 3 grid playable from
   EXPERIMENTAL Wildshard with seamless travel and SF22's gates passed. **M3** = all seven at 80/20 by both measures.
5. **Part B** after M3, or a single stretch goal earlier when a shard's port needs it.

## 6. Done when

Part A (this plan's goal):
- **M1:** every milestone boolean true for the template.
- **M2:** the 3 × 3 grid plays from EXPERIMENTAL Wildshard with seamless travel; SF22's gates passed on the Simulator and
  one physical-iPhone reading; Select a shard still works and is the way back.
- **M3:** all seven shards at **80/20 by both measures**, grid-ready, with their compatibility checks green (transitional
  runtime listed per shard).
- Every "used today" system row landed with its consumer.
- **The frame floor held throughout** (§9.4).
- `docs/SHARDFILE.md`, SHARDS.md and ENGINE.md describe the format, the systems and the ABI.

Part B rows are done one by one when they start; the plan archives when Part A is done and Part B's open rows move to a
successor plan.

## 7. Touches other plans

- **Guards**: this plan owns them (ARCH-GUARDS is archived, B20); a lint change is announced on herdr to active agents.
- **REPO-WEIGHT** (E436): media and history; shardfiles stay out of git (§3.5).
- **WORLDCLAW-SHARD / THIN-ICE**: out of scope (G47); Thin Ice's owner is told that new shards other than Thin Ice are
  born on the format and that Thin Ice's `runtime/` is allowlisted (B12).
- **NINE-DRAGON-STACK**: Nine Dragon becomes DEVSERVER-only (G46); its owner is told (B11).
- **EXPLORE-V2, WORLDCLAW-TOOLS**: explore mode is one shard at a time behind the dev toggle (G46).
- **FINISH-LINE**: its title shard map vs the grid's boot path (SF21a).
- **ANIMATION-REMASTER**: standard rigs and the clip library (SF26).
- **PHYSICS-POLISH**: colliders move into tiles and per-shard worlds (SF9a, SF18a).
- **NATIVE-APPS**: the shells need the shardfile loader and the save scopes (SF15a).
- **DRIFTWOOD-REMASTER-V2, SIGNAL-DUNES, SKY-REACH**: conversion waits for those agents to be idle.
- **DEPLOYMENT_ASSET_TRIM**: tiles change the pack layout; its offline-reload gate holds (SF15a).
- **HUD (E332)**: SF28, S3 (the car and auto-path) and any HUD change go over herdr and to Jake.

## 8. Jake's picks before the grill (2026-10-03)

| # | Question | Jake's answer |
|---|---|---|
| Q1 | Thin Ice born on the format or as code? | **As code**, with the 20 % allowance; confirmed in E435 (T4) |
| Q2 | Material graphs onto WebGL patches or WebGPU first? | Superseded by G4 and G32 |
| Q3 | Which bosses move to phase tables? | Only ordinary bosses (Storm Roc, the Matriarch, the Big Blob) |
| Q4 | Start P0 now? | **Yes**; done |
| Q5 | Which milestone proves the platform? | **Package-first** (E435) |


## 9. How it is built

Jake, 2026-10-04: *"Finish the plan … Run the 8 council rounds as discussed … Autonomously build the plan to completion
… At all moments the game must be at 60-120 fps on desktop/laptop and at 30-60 fps on iOS simulator. I'm going to bed,
you are in charge. No ask user tools, only autonomous planning & building."* (The council was later cut to four rounds, G59.) The other agents are paused (Jake: *"they
are paused this is more important"*).

### 9.1 The coordinator and the two kinds of agent (G52)

The shard-platform session **coordinates**: it dispatches rows, reviews every result against its done-when, runs the
gates, commits and pushes, keeps this plan's State, register and Handoff true, and sends Jake status lines. It builds
small glue itself only when dispatching would cost more.

- **Codex GPT-6.1 Sol high**, each in its own herdr pane: `herdr pane split --current --direction right --no-focus`,
  then `herdr agent start <name> --kind codex` in the new pane (model and effort come from `~/.codex/config.toml`).
  Names: `sp-x1`, `sp-x2` … One row (or one row's slice) per prompt via `herdr agent prompt <name> "<brief>"`; the agent
  replies with its commit SHA. Up to **4 Codex panes** at once (the machine's browser lane cap is 4; a Codex row that
  needs a browser takes a lane through `scripts/browser-lane.sh`).
- **Claude Opus 5.5 subagents** (the Agent tool): at most **3 live**, each with SUBAGENTS.md's caps (400k context,
  90 min, ~200 turns, a report ≤ 40 lines, one job, never recycled).

### 9.2 Routing (G53)

Jake: *"Any UI, visual, HUD, rendering, shader, art or graphics work, and shard look and content (E374), goes to Opus 5.5
only. All other code, refactoring, tooling, tests, SDK/CLI, validation, bake and determinism work goes to Codex GPT-6.1
Sol high."* The **Lane** column in §4 applies it: X → Codex, O → Opus, X+O → Codex builds and Opus does the visual part
or judges it (two dispatches).

### 9.3 Budget (G54)

Jake: *"stay within both usage plans. Run openusage before every dispatch and every few rows … the bulk goes to Codex;
keep Claude for UI and visual work and for coordinating. When a plan nears its weekly or 5-hour limit, pause that lane
until it resets rather than going over, and never spend Codex credits or rate-limit resets. … You can burn both claude &
codex to 100% usage to get this plan built out."*

- `openusage` (JSON) before every dispatch and after every few rows. At the start (2026-10-04 06:12 UTC): Claude weekly
  62 % (resets 2026-10-06 18:00 UTC), 5-hour 20 %; Codex weekly 20 % (resets 2026-10-10 00:53 UTC).
- **Pause a lane at 97 % weekly or 95 % of Claude's 5-hour window**; resume after the reset. Never buy or spend Codex
  credits or rate-limit resets.
- Claude is the scarce plan: council seats run as **two Codex seats + one Claude seat** from round 2; Opus subagents
  only for O rows and visual judging.

### 9.4 The frame floor (G55)

Jake: *"At all moments the game must be at 60-120 fps on desktop/laptop and at 30-60 fps on iOS simulator."*
- **SF0** (first row of all, X): `scripts/frame-floor.mjs` measures every playable surface (each shard, later the grid
  and a crossroads) on **desktop** (headless Chromium on Metal, uncapped, 2× scale: p95 frame ≤ 16.7 ms, i.e. ≥ 60 fps)
  and on the **iOS Simulator** through `scripts/sim-lane.sh` (Safari, the phone tier: ≥ 30 fps, p95 ≤ 33.3 ms), writing
  `progress/frame-floor/<sha>.json`. It records today's baseline first; a surface that misses the floor today is listed
  and gets its own fix row before anything else touches it.
- **Every row that touches the client** (loader, rendering, streaming, scripts on the main thread, looks) runs the frame
  floor before it merges; a miss blocks the merge. Engine-only and tooling rows run it every few merges.
- A risky render or memory change still ships default-off behind a Debug row until a reading backs it (RENDERING.md).

### 9.5 Councils (G59)

**Four council rounds** (Jake, 2026-10-04: "I've also been told that 4 round council approach is better then 8 rounds";
COUNCIL.md's normal cap). Round 1 reviewed everything; rounds 2–4 review the diff since the last round plus the battery,
with two Codex seats and one Claude seat. SF22a, SF0 and the F0 rows the council has stopped changing may start while
rounds 2–4 run; a row a round changes is re-briefed. After round 4, whatever is still open is decided by the coordinator
with a recorded reason (Jake set no questions for the night, G56) and listed for his review.

### 9.6 Every merge

Pathspec-only commits through `scripts/push-main.sh` with the local gates green (`scripts/vercel-tree-gate.sh`); parity
identical or a board; the frame floor (§9.4); this plan's row, State line and Handoff updated in the same commit; a status
line to Jake at each milestone.


## 10. The shardfile: the grill with Jake (E435)

Jake, 2026-10-03: *"Grill me, let's brainstorm … everything is on the table, nothing is decided, let's make the perfect
shardfile plan together, let's fight against the limits of the existing shards, lets make it powerful and super
creative and fully open for great thing. But still give a stable baseline and development SDK + UX for building
performant & fun shards."* The evidence behind the earlier calls is the [Wildshard MMO Review](../reviews/wildshard-mmo-review.md).
The rows in §4 build these answers; each row names the ones it builds.

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
| G48 | Bounding determinism | **Bounded** (Jake: *"Bounded, or even Bounded lite. This benefits from a timebox too."* Then: *"Answer "Bounded". I'd go further: identical results everywhere only for scripts (AssemblyScript gives that for free), and same-engine replay in Node for everything else."*): §3.1 |
| G49 | Which shards are ported | **All seven**: *"3 grid + template + signal dunes + sky reach + nine dragon. All the code has to be ported right. you can actually for fun render the template in the empty gaps. the first game can be Driftwood in the center, then nalati / pine wood, then to finish a 3x3 grid render the template in the empty slots. In dev mode we have 5 shards, so you render 4 templates in the empty slots."* (§3.3) |
| G50 | Repo weight | **Its own plan**: *"You can get a subagent to make a second plan called "repo-weight.md" and it can figure out what do with all the media committed lol. we want to keep some of the progress & art work."* (E436, REPO-WEIGHT) |
| G51 | The fence | *"No frence, build the whole thing, all 4 shards ported over, the fence is the 80/20 split, the fact you can leave the 20% of the hard code to port in a ./runtime/ directory in typescript."* |
| G52 | Delegation | The coordinator dispatches to Opus 5.5 subagents (≤ 3 live, SUBAGENTS.md caps) and Codex GPT-6.1 Sol high agents in herdr panes (§9.1) |
| G53 | Routing | UI, visual, HUD, rendering, shader, art, graphics, shard look and content → Opus 5.5 only; all other code, tooling, tests, SDK/CLI, validation, bake, determinism → Codex (§9.2) |
| G54 | Budget | `openusage` before every dispatch; the bulk to Codex; pause a lane near its limit; never spend Codex credits or rate-limit resets; both plans may be used up to 100 % (§9.3) |
| G55 | The frame floor | *"At all moments the game must be at 60-120 fps on desktop/laptop and at 30-60 fps on iOS simulator"* (§9.4, SF0) |
| G56 | Councils and autonomy | *"Run the 8 council rounds as discussed … Autonomously build the plan to completion … No ask user tools, only autonomous planning & building."* (§9.5) |
| G57 | Two parts | **Part A, the core, then Part B, stretch goals** (Jake: *"Can we re-order the milestones and work in the plan in two big segments - What we need for shardfiles, porting the shard implementations over to the data representation, the sdk, the json files, etc etc etc. - Stretch goals at the bottom … Basically anything in the plan that's being built that is not being used in the 6 shards today, goes to the bottom of the plan as stretch goals, we want to get the 6 shards ported over to the shardfile format first, we want to render the 3x3 grid first, we want to figure out the traversal and loading and seamless travel first."*) |
| G58 | The main menu | **Two entries**: Select a shard (today's flow) and EXPERIMENTAL Wildshard (the grid), so a memory crash on the grid always has a way back (§3.3). Jake on memory: *"memory is a huge problem"*; SF22a measures it first |
| G59 | Council length | **Four rounds** (Jake: *"I've also been told that 4 round council approach is better then 8 rounds."*); replaces G44's six and G56's eight |

## Handoff (shard-platform)

Written 2026-10-04 by the shard-platform coordinator, after council round 1 (asks E431, E433, E435; E436 for repo
weight). Jake is asleep; he set the goal: finish the plan, run the council (four rounds, G59), build it, keep the frame floor,
no questions to him (G56); Part A first, stretch goals after (G57).

**Read first:** §0, §3 and §9 of this plan; §10 (G1–G56); the register in `shard-platform/reviews/`; the
[Wildshard MMO Review](../reviews/wildshard-mmo-review.md); MMO-REQUIREMENTS decisions 1–20.

**Next, in order:** council rounds 2–4 (§9.5); SF22a (memory) and SF0 (the frame floor) now; then F0 → F1 (M1) → F2 and
the conversions (M2, M3) → Part B (§5).

**Lessons:** run the vercel gate before pushing code; imports name the defining module (E434, no barrels); a guard with
zero targets proves nothing; numbers in a plan come from a committed script.
