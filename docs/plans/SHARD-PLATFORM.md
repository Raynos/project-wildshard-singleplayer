# Plan: SHARD-PLATFORM — MMO-compatible shardfiles in the singleplayer game (E431, E435)

**State:** `ready` 2026-10-04 — rewritten from Jake's E435 grill (§10, G1–G61) and the clean-room audits ([Wildshard MMO Review](../reviews/wildshard-mmo-review.md)); **the four-round council has ended** (217 findings, all fixed or decided; register in [`shard-platform/reviews/`](shard-platform/reviews/register.md)). **Two parts** (G57): Part A, the core (the format, the seven shards ported, the 3 × 3 grid, loading and seamless travel; milestones M1 the package, M2 the grid, M3 the seven at 80/20), then Part B, stretch goals. The grid is a second main-menu entry, **EXPERIMENTAL Wildshard**, beside Select a shard (G58; dev-mode-only until SF22's gates, G61). **F0 done** (2026-10-04, SF22c's phone page in progress); F1 under way (done: SF7a, SF7b, SF7f, SF8a, SF8b-0, SF8b, SF10a, SF10b, SF11a–c, SF15a-min). Next: the rest of F1 → M1. Built by Codex and Opus lanes the coordinator dispatches (§9). Requirements: [MMO-REQUIREMENTS](../design/mmo/MMO-REQUIREMENTS.md).

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
- **DEVSERVER:** a build define `__DEVSERVER__` (`vite build --mode devserver`), set by `scripts/serve-build.sh
  --devserver` and by `wildshard dev`, never by `pnpm build` or Vercel; the push gate asserts it is false in the
  production bundle (R3-C10). Never a URL switch. It shows every shard including Nine Dragon, explore mode, enter world and
  the usual dev controls (G46).
- **Dev mode:** the shipped game's Settings ▸ Developer switch (`src/engine/core/devMode.ts`).

## 1. The measures (exact)

Unit: non-blank, non-comment lines of `.ts` / `.tsx` under `src/shards/<slug>/`, counted by `scripts/shard-platform.mjs`.
Generated and baked output never counts.

- **Public side:** `generators/` **whatever they import** (they never ship: `wildshard/no-runtime-generator` and
  `check-chunks` enforce it; A2: any tool on the author's machine), and `data/`, `behaviour/` (AssemblyScript), `quests/`
  and `shard.config.ts` when their import closure reaches only `@wildshard/sdk` and other public-side files (type-only
  imports included, so the SDK re-exports the row types) (R4-M2).
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
- Memory (SF22a, Simulator): one shard alone uses 282–1,097 MB (Pine Hollow 1,097, Driftwood 868: Driftwood keeps 201 MB
  of geometry arrays in JS after upload); shards are monolithic; travel is a page reload (`src/game/travel/travel.ts`).
  Pine Hollow already ships 19 KTX2 files.
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

### 3.2 Caps v1 (phone; measured by SF22a, not frozen)

SF22a (`3bff65310`, `docs/design/mmo/research/e435/sf22a-memory.md`) measured on the iOS Simulator: the engine base
(the empty template) ≈ **300 MB** (218 MB WebContent + 81 MB GL); each shard alone today: template 282, Driftwood 868,
Nalati 815, **Pine Hollow 1,097**, Signal Dunes 398, Sky Reach 489, Nine Dragon 587 MB. The synthetic crossroads at the
v0 caps cost 617 MB (×1.11 the caps' sum) → ≈ 917 MB with the base, over the 850 MB envelope. So, constants beside
`CELL_*` in `@wildshard/engine/core/config` (C6, B13):

| | L0 tile (62.5 m) | L1 tile (125 m) | Far proxy (per shard) | Shard library | Shard sim (counted in the envelope) |
|---|---|---|---|---|---|
| Resident | **4 MB** | **2 MB** | 1.6 MB | 25 MB | **25 MB** |
| Download (compressed) | 0.3 MB | 0.2 MB | 1 MB | 8 MB | critical bundle ≤ **2 MB** (colliders + sim) |
| Triangles | 40k | 10k | 8k | — | — |
| Draws (instanced, **shadow draws included**) | 8 | 2 | 1 | — | — |

- Engine base 300 MB (Simulator-verified); envelope ≤ 850 MB playing; loading ≤ 1.8 GB; render scale 2×. v1 sums to
  ≈ 818 MB at the worst location. **The format drops three.js's JS copies after GPU upload** (keeping them cost 357 MB
  at the rig). **Only L0 tiles within ~80 m cast shadows** (the sun pass took draws from 64 to 271).
- **Not frozen**: the only Simulator→phone pair on record (E264) is ×1.4, which would put the base near 420 MB and the
  crossroads near 1.3 GB; if SF22c's phone reading confirms it, content drops ~30 % more, cheapest first: three sims
  instead of four, 20 MB libraries, 3 MB L0 tiles.
- **One cost model** for `validate`, SF22a and the residency allocator (A8, D5): engine base + dependency-deduplicated
  assets (shard libraries, the commons once) + the L0 disc and its lookahead + the L1 ring + far proxies + up to four
  whole sims + decode / refinement overlap; each category counted once. `validate` checks it at the **worst location**
  (UEFN-style, C34): the shard's own categories plus **three neighbours at the caps** and the commons once (R3-C14), with a
  fixture whose L0 subtotal passes but whose total fails. MB = 10^6 unless marked MiB; the GL ratchets
  (`budgetCeilings.ts`, MiB) stay as regression ceilings.
- The tile hierarchy is **62.5 m (L0) → 125 m (L1) → whole shard (far proxy)** (C36).

### 3.3 The singleplayer grid (G46, G49)

Jake: *"the first game can be Driftwood in the center, then nalati / pine wood, then to finish a 3x3 grid render the
template in the empty slots. In dev mode we have 5 shards, so you render 4 templates in the empty slots."*

| | x = −1 | x = 0 | x = +1 |
|---|---|---|---|
| **z = +1** | template | Pine Hollow | template |
| **z = 0** | template · *dev: Signal Dunes* | **Driftwood Isle** | Nalati Grasslands |
| **z = −1** | template | template · *dev: Sky Reach* | template |

- Shipped: 3 shards + 6 template instances. Dev mode: 5 shards + 4 templates. DEVSERVER: Nine Dragon at **(+1, −1)**
  (replacing a template; its toggle in Settings ▸ Debug, shown only in DEVSERVER), plus explore mode (R2-C7, D12).

| Mode | Select a shard **enters** (it still **shows** what it shows today: locked "Coming soon" cards and draft titles stay; R3-C11) | EXPERIMENTAL Wildshard grid | Explore |
|---|---|---|---|
| Shipped | Driftwood Isle, Pine Hollow, Nalati Grasslands | 3 shards + 6 templates | — |
| Dev mode (Settings ▸ Developer) | + Signal Dunes, Sky Reach | 5 shards + 4 templates | yes (from Select a shard) |
| DEVSERVER (build-time) | + Nine Dragon Stack, the template | + Nine Dragon at (+1, −1), on by default (its Debug row swaps it back to a template) | yes |

  Today the shipped dev-mode switch unlocks every experimental card, Nine Dragon included (`src/game/titleDeck.ts:115`);
  SF21a narrows that to the table. An assembly fixture covers each mode and both switches together.
- Placement lives in one platform grid file (`src/game/grid/singleplayer.json`), never in shard files (W6, B6). Template
  instances are one shardfile placed several times, each with its own save namespace keyed by its stable **instance id**
  (`template-1` … `template-6`; the cell is a separate attribute, SF14).
- The outer ring's no-man's land eases to an **empty-neighbour profile**: open sea at road level with fog (C15).
- Pitch 555 m (N = 20 m, G37), tuned by SF22. Render origin rebases per cell (C39).
- **The main menu has two entries** (Jake, G58): *"Select a shard => existing shard selection UI; EXPERIMENTAL wildshard =>
  the 3x3 seamless grid. Basically if loading the 3x3 seamless grid crashes the game on iphone with memory error I want to
  be able to go back to select a shard and the existing load one shard at a time flow."* Select a shard is today's flow,
  and where explore lives (behind the dev toggle). The grid stays behind its EXPERIMENTAL label until Jake says otherwise.
  **The label covers the grid's code paths only**: one frame, worker decoding and per-shard physics worlds run inside
  EXPERIMENTAL Wildshard **through all of Part A**; Select a shard keeps today's look and path, and switches only after
  Jake has played the grid (his playtest is the reading, not a chore) (G61, R4-E2). The menu entry itself shows only
  with Settings ▸ Developer on until SF22's gates pass (G61, R4-E1). There is one phone reading: SF22c's rig.
- Dev mode changes apply at the next grid start (return to title), never live under the player (A17, C23).

### 3.4 Versioning (G29)

- One integer **`SHARDFILE_VERSION`** covers the format and the script ABI; the legacy `SHARD_API` stays for plugin
  shards until they're gone (B19, C24).
- The client loads the current version, and in Part A the previous one only for an offline-cached first-party shardfile
  (R4-N2, R3-C25); older ones show a "needs upgrade" card; their source and saves are untouched (A16).
- First-party shardfiles rebuild on every build. **A version bump is one commit** that migrates every first-party
  source and keeps saves (A11); `docs/SHARDFILE.md` gains the manual migration steps for outside authors until
  `wildshard upgrade` (S18) exists (D10).
- **SHARDFILE_VERSION 1 freezes after SF22c's physical-iPhone reading** (R2-C4); a later cap miss bumps the version
  through this section.

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
| SF0 | X | **The frame floor** (§9.4): `scripts/frame-floor.mjs` (desktop Chromium on Metal, uncapped, 2×; the iOS Simulator via `scripts/sim-lane.sh`). PASS = integer-rounded median fps ≥ 60 / 30 and p95 ≤ 17.5 / 35.0 ms; raw fps, strict p95 and CPU work p95 kept | **done** `417db57d2`, corrected `e833dbbb8` + `5ccd7268c` + `c827beb07` (rAF-timestamp grade, per-run scratch, `--device`, Inspector reconnect): baseline `08faf12c7` (measured `1d2a9ee78`) 14/14 PASS, desktop rAF p95 max 16.8 ms, Simulator 34 ms; re-run at `a8fdd1522` 14/14 PASS. Pine Hollow's desktop CPU work p95 is 17.7 ms (cadence passes; headroom tracked in SF47) | M |
| SF0a | O | **Driftwood's desktop frame floor** | **closed, no code change**: no dropped frames (rAF p95 16.7–16.8 ms, 4 × 1,200 frames); the old sampler's jitter. Headroom notes if ever needed: shadow maps take 1,085 of 1,254 draws at the pier; the shadow crossfade adds 286 draws on ~33 % of frames; `skipRaysOffscreen` on the desktop tier is a look-identical one-line saving | — |
| SF0b | O | **Nalati's desktop frame floor** | **closed, no code change**: Nalati drops no frames (rAF-timestamp p95 16.7 ms, max 16.8 ms); the miss was `frame-floor.mjs` grading rAF-callback jitter (it reads `performance.now()` in its own callback after the game's), which rises with machine load. SF0 now grades the rAF timestamp. Noted: Nalati uses ~12.7 ms of GPU per frame at 2880 × 1800 with 4× MSAA on the M5 Max (grass ~6 ms), so weaker laptops have little headroom (Part B, S21) | — |
| SF0c | O | **Nine Dragon's desktop frame floor** | **closed, no code change**: no dropped frames (rAF p95 16.7–16.8 ms over 2,880 intervals); the old sampler's jitter again. A free saving if ever needed: n8ao's two transparency pre-passes (~0.4–0.7 ms GPU) change no pixel on this shard | — |
| SF0d | X | **`sim-lane.sh` exclusive driving**: a `run` on an already-booted device with the same UDID doesn't wait and overwrites the lease, so two drivers share one Simulator (found by SF0) | **done** `15da2ccf3` (+ `2e0850bb2`): a per-device lock spans run and shutdown; lease, release and the reaper respect it | S (before any concurrent Simulator dispatch; until it lands the coordinator serializes Simulator work, R4-A5) |
| SF1a | X | **Guard bootstrap.** Add `ShardManifest` and `ground.terrain` to `scripts/check-row-data.mjs`; record the ~38 existing fields with provenance ("legacy, pre-SF1"); re-baseline `lint/row-functions.json` once in this commit (A1, B21) | **done** `91f97bdfc`: 38 legacy manifest fields bootstrapped (83 total) | S |
| SF1b | X | **Shrink-only comparators that work.** Comparators take an explicit baseline file and candidate file; pre-commit compares the index with `HEAD` (config-only edits included, `scripts/precommit-guards.mjs`); the push gate exports the predecessor's lists into its tree (`scripts/vercel-tree-gate.sh`) (A2). Covers row functions, edge exemptions, shard-platform ceilings | **done** `78fbcbe1d`: staged and committed allowances compared with their predecessor | M |
| SF1c | X | **The transition allowlist**: the six shards, the template and Thin Ice (its 20 % ceiling from its first commit) may hold `runtime/`; "a new shard" = not in `lint/shard-platform.json`, and it may not (A3, B12) | **done** `e452dc355`: runtime folders reserved for the transition baselines (107 fixtures) | S |
| SF1d | X | **Honest contract tests**: a JSON round-trip over every `data/` folder; the world-contract test fails a flat datum that isn't drawn unless listed (Nine Dragon, Sky Reach listed by name); structure bounds checked against the cell; the template declares 500³ | **done** `07926ee35`: data JSON checks, structural exceptions named, the template at 500³ with its spawn unchanged | S |
| SF1e | X | **Stale ids**: every old SP reference in `lint/`, `scripts/` and `test/` points at the new rows: SP10 → SF8c (the edge walk), SP22 → SF46, SP23 → SF49, SP22–SP28 → SF46–SF51, SP31 → SF53 (C19) | **done** `ee2d71d17`: the stale-id search is empty | S |
| SF2 | X | **Measure, don't estimate**: `scripts/shard-coupling.mjs` prints `ctx.app` / `ctx.game` / `ctx.game.runtime` reaches, engine subclasses and non-data `ShardContext` members per shard, with a ratchet | **done** `08352b519` + `a9e08b142`: measured typed coupling (all seven: `ctx.app` 109, `ctx.game` 52, `ctx.game.runtime` 52, engine-derived classes 49), non-data sites in `lint/shard-coupling.json`, ratcheted against the predecessor | S |
| SF3a | X | **Headless means the import closure**: `sim-no-render` walks the import graph from the sim folders (engine `ai/ combat/ events/ quest/ saves/`, every shard's `data/` and `behaviour/`, and **the template's current sim files** `combat/`, `species/`, `quest/`, `world/climate.ts` until they move, R2-C9): no three.js except maths types, no `app/runtime`, no DOM, no `TIER` / `frameCost` | **done** `8a7e167cd` + `42ed6b34a` + `456905174`: the runtime simulation import closure measured and enforced shrink-only (34 keys, 39 occurrences listed with owner rows) | M |
| SF3b | X | **`Animal` sim/view split**: entity state and simulation move to a sim module with no three.js object graph; the view module renders it; `ai/reach.ts` stops importing `app/runtime`; the 70 importers move in batches behind parity (C19) | **done** `400672e05` + `d775d11e0` + `bcb8cf1b8` + `edbab7973`: AnimalSim / AnimalView; parent-vs-split parity 14/14 identical, 38 visuals min SSIM 0.992; frame floor 14/14 | L |
| SF3c | X | **The rest of the closure, engine and kit**: every engine and kit violation SF3a listed is fixed or moved to a view module; **the template's sites are listed with their F1 owner rows** (SF7c, SF7f, SF9c, SF10b, SF12, SF13, SF13b; R4-N3) and reach 0 at SF16 (R3-C1) | **done** `bfed2ceeb` + `541b410a8` + `3fedd2a83` + `aa2f4e1e7` + `d7e36407b`: engine and kit closure violations 0; 7 template sites remain, owned by SF12, SF7f, SF7c (clear at SF16); parent parity 14/14, 38 visuals min SSIM 0.994; frame floor 14/14 at `740e8c1e1` | M |
| SF4a | X | **`@wildshard/engine/sim`**: a versioned headless entry that boots a shard's sim in Node with no renderer (the artifact a server would embed, C30). After SF3c | **done** `00b6e3f2c` (+ earlier SF4a prep): `@wildshard/engine/sim` native host; `test/fixtures/sim-level/` steps 10,000 ticks in plain Node with damage and quest completion | L |
| SF5a | X | **Commands for motor and look**: the player's movement and camera come from recorded input commands, not live input reads | **done** `3760af612` (+ `4b4de05c2`): a 240-step Rapier walk replays to an identical Node state hash; movement tests 14/14 | M |
| SF5b | X | **Aim and hits from commands**: aim from the input command, not the viewmodel camera (`combat/Weapon.ts:56`); hit-stop visual only (`core/Game.ts`); stable entity ids independent of tile and LOD | **done** `692ad12c8` (+ `54225ce28`): aim and contacts from commands; hit-stop visual only | M |
| SF5c | X | **The rest of the commands**: interact, mount, UI-triggered actions; RNG streams and the clock export and restore their state | **done** `eef55e98e` … `7a71caa3e`, follow-ups `820df579a` + `04c692c44`: interact / mount / UI commands (incl. the weapon strip's buttons and pie by stable weapon id) replay to an identical hash; input, RNG and clock state restore fresh | M |
| SF4c | X | **The snapshot interface** (same engine): a versioned snapshot of engine state (entities, timers and pending events, RNG streams, the clock, the Rapier world) with typed slots for script memory and globals, quest state and the ledger's dedupe record, which F1 fills (D2); restore into a fresh host and replay the suffix | **done** `f9e1b908f` (+ `00b6e3f2c` hooks): 11 snapshot tests; five real fight checkpoints replay their 600-tick suffixes to exact full hashes (Rapier bytes, pending actor refs, timers, RNG, clock, slots), motor and dynamic-body suffixes exact; world-scoped collider tags | M |
| SF4d | — | ~~Motor cross-engine hash~~ **dropped** (Jake, 2026-10-04: identical results everywhere only for scripts; same-engine Node replay for everything else) | — | — |
| SF6 | X | **The two measures** (§1) and the booleans in `scripts/shard-platform.mjs` and the push gate; today's metric renamed "legacy TS" (A4, B5, B15, B16, C20) | **done** `54584085a` + `d0bc41390`: the two measures, unique-kit attribution, AS public, generated excluded; flags grid-ready / compatible / transitional; proof convention `test/proof/<slug>/<proof>.test.ts` | M |
| SF22a | X+O | **Measure memory before the format** (C31, R2-C4, D5, D6): the engine base and each shard alone (`scripts/sim-memory.mjs`, `scripts/parity/glbytes.mjs`), and a synthetic 2 × 2 crossroads rig filling every cost category (`scripts/crossroads-rig/`). (Built by an Opus subagent, measuring included: a deviation from the X+O lane, R4-N5) | **done** `3bff65310` (+ `e5f2473d7`, `76a924d7f`): §3.2's caps v1 and §2's numbers | M |
| SF22b | X | **Labelled GL bytes**: extend `scripts/parity/glbytes.mjs` to enumerate every texture, renderbuffer and buffer with a stable owner / asset label (set where the engine creates the resource), totals reconciling with today's aggregate (R3-A6, R3-D2, R3-C8) | **done** `7f5cb60ea` + `a8fdd1522` + `25895d77c` + `f0ce33bd0`: every GPU resource labelled by owner / asset; the live Pine Hollow census is 1,311 resources = 656,554,426 B exact, 0 unlabelled | M |
| SF22c | X | **The phone reading without a chore** (R4-S10): the crossroads rig ships as a static page in the production build with fixed defaults, opened from a pause ▸ Settings ▸ Debug row; it runs itself and posts its stats to `/api/telemetry` (DEPLOY / the existing telemetry endpoint); Jake opens it once when he plays; SHARDFILE_VERSION 1 freezes after its record | **done on the Simulator** `905fa50fd` … `b7654ee72` (pinned `974f1c73e`): one Debug ▸ Performance "Memory check" runs three fixed caps-v1 checks (29 L0 + 4 libraries; production splat 256²), posts per-run + summary telemetry over HTTP; 3/3 completed with zero over-cap units, context losses or errors, 394.4 MB accounted content, cadence p95 17 ms. **Waits for Jake's one tap on the physical phone**; SHARDFILE_VERSION 1 freezes on three phone runs completing with no tab kill or context loss (Safari exposes no OS footprint) | S |
| SF22d | O | **Engine memory cuts** (from the breakdown `4ec64f071`, `docs/design/mmo/research/e435/memory-pine-driftwood.md`): free three.js's CPU copies after GPU upload (textures; geometry except positions and indices: dropping those stalled Driftwood's walk), load the practice dummies only at the practice ring, delete the shadow map's unused colour texture, a half-resolution luminance pass and one composer depth buffer. A risky memory change, so **default-off behind a Debug row** ("Memory saver") until SF22c's phone reading backs it (RENDERING.md) | Simulator (`scripts/sim-memory.mjs`) and desktop census show the measured savings (Pine ≈ −155 MB renderer, −33.6 MB dummies in Pine and Driftwood) with the row on; the frame floor and parity hold both ways | M |

#### F1 — The shardfile → **M1 the package**

| Row | Lane | What | Done when | Size |
|---|---|---|---|---|
| SF8b-0 | X | **The `@wildshard/sdk` skeleton** (R4-S1): `src/sdk` in `pnpm-workspace.yaml`, its `package.json` exports, and the layer guard taught the fifth layer; the format's types and schemas (SF7a) and the CLI (SF8a) live here | **done** `c24c16e93`: the SDK workspace and its author import boundary | S |
| SF7a | X | **Format v0** (`docs/SHARDFILE.md` + valibot schemas): identity and `SHARDFILE_VERSION`; requires; budgets (§3.2); look (family refs, grade, sky / fog / day keys on the engine clock); the **sim contract** (60 Hz fixed step, script tick divisor, command and snapshot schema versions, C29); **declared shared-state fields, host-owned**, and per-player state scoped by actor id (A7, C11); author caps (player cap G26, speed cap G39); server-budget fields (B4); state-schema version (G17, G18); privacy classes (U4); edge profile; `commons:` references (C33); content-addressed files with a dependency graph and declared compressed, decoded and GPU sizes | **done** `cfc0986a6`: strict shardfile v0 with caps v1 and rejection fixtures (59 schema tests); types and schemas in the game layer, re-exported by `@wildshard/sdk` through typed adapters | L |
| SF7b | X | **The project layout** (§3.5): `shard.config.ts`; the layout lint for shardfile shards (no `plugin.ts` required); `public/shardfiles/` git-ignored; and **the grid catalogue** `src/game/grid/singleplayer.json` holding today's placements (they leave the manifests, B6), read by `gen-shards.mjs`; SF17a extends it to the 3 × 3 layout (A1, D1, R2-C13) | **done** `da840b613` + `e41ae3810`: author projects and the platform-owned placement catalogue `src/game/grid/singleplayer.json`; placements out of the manifests | M |
| SF7c | X | **The template's rows as data**: StrikeSpec.weight, WeatherProfile.\*, DayCycleSpec.\*, SpeciesLook.\* (grey blob, boar), the compendium (`stamp`, `stats`) and loot presentation closures become registered ids or data (B2, C2, R2-C1) | **done** `7bbabd96c`: the template's rows as JSON data behind a data-only guard (functions, accessors, cycles and lossy JSON refused); the weather adapter matches today exactly over 10,000 seeded updates; species variants, HP, mods and strike ids as data | M |
| SF7d | X | **The template inventory** (in this plan, §4.1): every trusted surface of the template mapped to the F1 row that replaces it (A5, B3, C1) | **done** (§4.1, completed by council rounds 2–3; R4-N4) | S |
| SF7e | X | **Items v0**: weapon and tool rows over kit families with AssemblyScript hooks (after SF11b); the template's whip and lantern, `buildEquipment` and the Sword / whip context become rows | A fixture weapon and tool work from data + a script in an engine test; the template switch is proved at SF16 | M |
| SF7f | O | **UI v0 for the template** (a thin slice of SF28): its DOM pin (`plugin.ts:98`) becomes a declared marker; the oil meter a declared counter; the bag fragment a declared bag panel; the boss bar (`engine/ui/BossBar`, imported by `combat/encounters.ts`) a declared boss panel (D3, R2-C1) | **done** `24c016d94` + `24db00ff8`: five declared UI kinds (marker, counter, bag panel, boss panel, relabel) render byte-identical to the template's hand-built HUD (happy-dom + screenshots) | M |
| SF7h | X | **Template plumbing as declarations**: the input context (`template.lantern.toggle`), the tier knob (`template.propCount`) and its Debug rows declared in `shard.config.ts` (R2-C1) | A fixture shard declares each; the template's at SF16 (R4-A1) | S |
| SF8a | X | **`wildshard new / build / validate`**: schemas, references, budgets and the worst 150 m disc (C34), cell bounds, asset parsers with caps for GLB / KTX2 / audio and a malformed fixture per type (B35); builds are deterministic, so two clean builds give byte-identical shardfiles (B37) | **done** `d80f0ebca`: new / build / validate; the one summed cost model (817.8 MB at saturated v1); a forged valid-hash unmetered module refused | L |
| SF8b | X | **`@wildshard/sdk` distribution** (after SF8b-0): `pnpm pack` tarballs + a prebuilt client bundle for outside authors (B17, C10) | **done** `405254a08`: a 14.66 MB `pnpm pack` tarball + the normal game bundle (with the Rapier wasm); outside the repo it installs by `file:`, builds 344 files byte-identical twice, passes strict types, and boots with player / physics / HUD with the leak probe at 0 (`progress/sdk/SF8b-distribution.json`) | M |
| SF8c | X | **`wildshard dev` + validate's sim checks + DEVSERVER plumbing** (R4-D5): the `__DEVSERVER__` define in `vite.config.ts` with its TypeScript declaration, `scripts/serve-build.sh --devserver`, and `wildshard dev` setting it; rebuild-and-serve in the real client on the floating cube; validate steps the sim headless (SF4a) and walks every edge entry through the colliders (C8) | Editing a file rebuilds and reloads the shard; a blocked edge fails validate | M |
| SF8d | X | **The build in the repo** (after SF8a, SF8b and the template's project): `pnpm build`, the push gate and Vercel run `wildshard build` for every shardfile shard (A1, D1) | A clean checkout builds the template's shardfile in the push gate (and the push gate asserts `__DEVSERVER__` is false in the production bundle, with a failing fixture; R4-D5) | S |
| SF9a | X | **The baker, terrain**: heightfields cut into L0 / L1 tiles with heightfield colliders and the edge profile; the template's terrain closures become baked data; hand overrides | **done** `62a24242d`: 64 L0 + 16 L1 tiles from a fixture heightfield, deterministic hashes, hand overrides, real `wildshard validate`, refusals for bad payloads / seams / costs; 10,000 Rapier rays within 2 cm; scope cleanup | L |
| SF9d | X | **Water bodies as data** (R3-C6): pools, seas and streams (today closures: `restAt`, `surfaceAt`, `inside`) declared in `shard.json`, read by the motor's swim and wade modes | **done** `c0725ed80`: water bodies declared in data; the real player swims, wades and dries from the declarations | S |
| SF9b | X+O | **The baker, props and scatter**: static props merged per tile, scatter as instance lists, the far proxy mesh, KTX2 → ASTC, the per-tile budget report; Opus reviews the visual result on a portrait board | The template's world bakes within §3.2's caps; the board matches today's within the parity script's threshold (`scripts/parity/compare.mjs`) | L |
| SF9c | X+O | **Skinned and procedural creatures as shardfile content** (R3-D1, R3-C15): a build-time export of procedural geometry, skin weights and joints (the grey blob, the boar, Pine Hollow's `quest/npcModels.ts` rigs) to GLB; their animation closures become sampled clips or named platform pose bindings; GLB skins and clips through SF8a's parsers, played by today's engine rig and `figureRig`, with declared GPU cost; a SpeciesLook becomes baked data, not an engine id. Opus checks the motion on a video (MOCKUPS.md) | The grey blob, the boar and one Pine Hollow NPC animate from exported content in an engine test; a side-by-side video matches today's motion | M |
| SF10a | O | **Material families v1**: toon, PBR, painterly and emissive, renderer-neutral parameters, precompiled before first use; the acceptance set is the three grid shards' looks (C22) **and Signal Dunes' sky and sand** (A10): a runtime adapter may feed family parameters, but the look must pass the family / one-frame gate | **done** part 1 `44868522f` + `0856b7548` + `3ca0db463` + `34cf22476` (registry, toon, PBR: pixel-identical); part 2 `131c1600a` (painterly with an in-material grade, emissive incl. neon glyph tubes and the painted sky dome, a PBR `ground` layer for Signal Dunes' sand): boards `progress/families/sf10a-toon-pbr.jpg`, `sf10a-painterly-emissive.jpg`, all within 5/255 except Nalati edge pixels (grade before MSAA resolve, fog after the grade, desktop bloom moves to SF19a); 0 programs built at first family draw | L |
| SF10b | O | **Look v0 as data**: sky, fog and day keyframes on the engine clock, a grade LUT; the template's GLSL sky dome and `patchShader` fog go | **done** `9015061696` + board `304dff09b`: `look` keys (sky gradient, fog, sun, ambient) on the engine clock, a 33³ LUT, `src/engine/render/dataLook.ts`; matches the template's noon numbers; differences: mid-distance fog (no fog-start field yet: sp-x5 adds it), `grade.exposure` not applied yet | M |
| SF11a | X | **The script toolchain and admission**: asc build, the binaryen.js fuel injector, and an admission check that refuses a module before running it: imports outside the ABI, banned features, memory / table limits, a call-depth limit, missing instrumentation (A8) | **done** `17541e679` + `31a634ca3` + `84495fafb`: asc in Node, binaryen.js fuel, admission (15 fixtures), finite32 / finite64 guards on every float-producing opcode | M |
| SF11b | X | **The script host**: one instance per script module per shard, entity handles passed in (C13); fuel per call; a host memory cap; per-shard allowances for instances, effects, spawns, events and host queries (A9); read-only deterministic host queries (raycast, overlap, nearest, path), charged fuel (C12); effects validated and applied atomically, NaN or out-of-range rejected; a trap discards the instance and restores its last good snapshot, the entity freezes and stops being interactive, a dev-only toast names it; repeat offenders are disabled (A10, B34, C25) | **done** `bcd993e65` + `ad0a26685`: the host (17 fixtures), real Rapier ray / overlap adapters, atomic effects, snapshots, caps, quarantine + 3-strike disable | L |
| SF11c | X | **Entity scripts and the local sim lane**: server scripts run in the singleplayer sim; shared state only through effects on declared fields; per-player state by actor id; **a script conformance gate**: identical ABI inputs and recorded host-query replies give identical effects, fuel totals and restored script state in Node and in WebKit (the only cross-engine check, §3.1; A4) | **done** `43cd59fd2` + `ccb7c6056`: actor-scoped server scripts in the local lane, explicit stable field ids, atomic effects; the Node/WebKit conformance gate (120 ticks, 240 calls and recorded queries, exact transcript) runs in the push gate and its own CI workflow | M |
| SF12 | X | **Quests and dialogue as data**: graphs and trees authored in TypeScript, compiled to validated data; script hooks for custom conditions and scenes; the template's `questFlags` and quest install closures become data | **done** `da4b76dec`: quest graphs and dialogue as data; hooks through the bounded script lane; plain Node import | M |
| SF13 | X | **One platform brain + a spawner**: an archetype with parameters over perception and navigation; the template's spawner becomes data | **done** `5ce8f7840`: one platform brain + a spawner over real physics, navigation and strikes; replay exact (4 fixtures); `src/game/shardfile/creatures.ts` | M |
| SF13b | X | **The template's elite and boss on the phase-table format** (a thin slice of SF27; after SF11b): Greyback and the Big Blob (`combat/encounters.ts`) with phase state, checkpoint and retry, persistence, damage hooks, presentation bindings to SF7f's boss panel | **done** `c1cfd80ec` + `913d8166c`: Greyback and the Big Blob on the phase-table format; damage clamp and shield, fight → death → retry → victory, a durable saved reward not granted twice, same-engine restore, the SF7f boss panel | M |
| SF29a | X | **The template's audio as data** (a thin slice of SF29): its cue map, forest ambience and silent score | **done** `98f82ec93`: the template's cue map, ambience and silent score as data (kit catalogue recipes preserved) | S |
| SF14 | X | **The ledger interface**: fact id = **instance id** + shard + revision + entity id + sim tick + ordinal (C25, A7, D7). The instance id is **stable and separate from the cell** (R4-M1, R4-A2): the grid catalogue gives each placed instance an id (`driftwood-isle`, `template-1` … `template-6`, `template-solo` for Select a shard) and a cell as a separate attribute, so moving a shard on the grid (SF17a's 3 × 3, a later relocation, a dev-mode swap) changes no save or fact; Select a shard, explore and the grid share one instance per first-party shard. Provenance; an allowed reward mapping (platform things only, G25); **feats and titles**: a shard emits a fact and the platform grants the achievement into the **profile** scope (SP2), once per (shard, achievement), no per-instance copy (R4-S4); one atomic durable write with the dedupe record; a failed write retries and never grants twice | **done** `f42b0e3b2` + `f03ad528a`: stable instance ids with cells as attributes; facts granted exactly once across replay, reload, retry and template instances; achievements in the profile scope | M |
| SF15a | X | **The shardfile loader, minimal first** (R3-C2): **SF15a-min** right after SF8a boots a shardfile with an empty world, scope-owned, with the leak test; the full loader then binds tiles, colliders, scripts, quests and UI from a shardfile; the current `SHARDFILE_VERSION` and an offline-cached N−1 (the only N−1 case in Part A: first-party shardfiles rebuild every build, R3-C25); offline boot of a visited shardfile (B26) | SF15a-min: an empty shardfile boots and unloads clean; full: an engine fixture shardfile with every content kind boots; the offline-reload gate passes. "No template chunk" is proved at SF16 **SF15a-min done** `592a070ed` + `ccbc5d62f`: an empty shardfile boots through the real Game (startSession → bootLevel), 20 load/unload cycles at the scope-census baseline, non-empty content and UI refused | M |
| SF15b | X | **The hybrid loader**, moved to the conversion prerequisites (A2, D1, R2-C2) | — | — |
| SF16 | X+O | **M1 proof.** The template (per §4.1, every line owned) boots from its shardfile with **no template chunk** (`check-chunks`); its pool swims, its door opens, closes and restores, its whip, lantern, quest, creatures, elite and boss work from the shardfile; its sim steps 10,000 ticks headless in Node and the template's SF3a sites are at 0; **SF16a**: the full suffix test, snapshotted during the Big Blob fight with script memory, quest state and the ledger dedupe record, replays to the same hash in Node; Opus judges the look against today's on a board. (The outside-author trial is S19) | All the template's milestone booleans true | M |
| SF33a | X | **Instance saves** (right after M1, before SF18a / SF20a; R3-A3): shard saves keyed by the stable instance id (SF14); legacy slug saves migrate into it (a first-party shard's instance id is its slug, so nothing moves) | At the save-store level: a legacy save survives; `template-1` and `template-2` saves stay apart; a cell change moves nothing (the in-game checks are SF20a's and SF46's) | M |

#### 4.1 The template inventory (every trusted surface owned before SF16; D3)

| Trusted surface today | Replaced at M1 by |
|---|---|
| `TemplateWhip extends Weapon` | SF7e (weapon row + script) |
| `TemplateLantern extends Tool` (PointLight) | SF7e (tool row + script) |
| `look/render.ts` sky dome `ShaderMaterial`, `patchShader` fog, `createDay()` | SF10b (look as data on the engine clock) |
| `terrainPainter` `PlaneGeometry` | SF9a (baked terrain) |
| `playground/JumpCourse.ts` at y ≈ 3000 (outside the cell) | SF9b (baked props) + an SF11c script, **moved inside the cell** with its enter / exit pose restore kept (D4) |
| `plugin.ts:98` DOM pin, the oil meter, the bag fragment | SF7f (marker, counter, bag panel) |
| `combat/encounters.ts`: Greyback (`EliteBrain`), the Big Blob (`BossBrain`), phase closures, damage and death answers, boss saves, `BossBar` | SF13b + SF7f's boss panel |
| Grey blob and boar species (`think` / `act`, `SpeciesLook`) | SF13 + SF7c |
| Quest install with closures | SF12 |
| Compendium (`stamp`, `stats`), loot presentation closures | SF7c |
| `installSilentScore`, `installForestAmbience`, `installTemplateCues` | SF29a |
| Input context `template.lantern.toggle`, tier knob `template.propCount`, `installDebug` | SF7h (the Debug row with a script hook) |
| The door (`world/build.ts:22–26`: mutable state, an `active` collider closure, panel visibility, `onInteract`; `plugin.ts:46–47`) | SF7a declared field + SF9b panel + an SF11c script + SF15a bindings (R3-A5) |
| The pool (`world/pool.ts`: `restAt`, `surfaceAt`, `inside`) | SF9d |
| Feats (`progress.recordEvent('template.quest', 1)`) | SF14 (a fact; the platform grants) |
| `buildEquipment`, the Sword / whip context | SF7e |
| `questFlags` | SF12 |
| The HUD relabel | SF7f (over herdr, E332) |
| The spawner | SF13 |
| The gear model | SF9b |
| Terrain closures | SF9a |

#### F2 — The 3 × 3 grid, loading and seamless travel → **M2 the grid**

| Row | Lane | What | Done when | Size |
|---|---|---|---|---|
| SF17a | X | **The grid catalogue and assembly** (§3.3): signed coordinates, the 3 × 3 layout, the empty-neighbour profile, render origin per cell; **legacy horizontal bounds in grid mode**: a shard's play bounds (the template's are ±100 m) yield to the cell in the grid, the standalone path keeps them, and fall recovery stays (R3-A2) | The grid assembles from `singleplayer.json` (instance ids with cells as attributes); entering and leaving the template at all four entrances causes no respawn or teleport; standalone template bounds unchanged | M |
| SF17b | O | **Highway deck and seams**: the engine-owned deck; no-man's land generated from both neighbours' edge profiles, four-way at crossroads (G37). **The strip generator is a pure function under `@wildshard/engine/sim`** (three maths types only), so a server can run it; Opus owns its look (R3-C18) | Two runs on the same edge profiles give byte-identical colliders (Node test); at every seam the height step ≤ 2 cm and ground colour ΔE ≤ 3; a portrait board of each crossroads | L |
| SF18a | X | **Sim residency per shard**: a shard's whole sim loads in a fixed order when the player nears it, in its own local frame with a physics world per active shard; **collider metadata becomes world-scoped** (`physics/surface.ts` keys tags by handle, which is unique only per world: A6); the highway and no-man's land are their own world; the capsule and character controller live only in the world of the player's current frame; at assembly the highway deck and the strip inside the hysteresis band are also instantiated as platform-owned static colliders in each adjacent shard world (local frame, world-scoped tags, excluded from the shard's state hash), so one controller call always has ground on both sides of the re-frame; **the hysteresis band lies inside the strip** (R4-D3): with N = 20 m, highway → shard re-frames when the player's feet pass 6 m from the cell edge and shard → highway when they pass 10 m from it, both on strip geometry present in both worlds, checked once per fixed step (R3-C3: a motor is bound to one world at construction; **the re-frame rebuilds it in the other**, a ridden horse's motor included: SF18a owns the re-frame, SF20a owns "no hitch, nothing lost"; R4-S5, R4-N6); `surface.ts:17`'s false comment is corrected (R3-C23); neighbours stay frozen and visible (C4, C5, C14, A14). Runs only inside EXPERIMENTAL Wildshard until SF22a's physical reading and SF22's gates (R2-C16, R3-A4) | The template at cell (1, 0) hashes as at (0, 0); equal handles in two worlds keep their own tags after one unloads; an opened door and a hurt creature survive unload → reload; `physics-baseline.mjs` gains a **grid mode** entered through EXPERIMENTAL Wildshard with seam routes in both directions, failing if the expected crossings weren't observed (R3-D4): 0 stuck, and edge → strip → highway and back at 15 and 30 m/s with 0 falls and 0 snags | L |
| SF18b | O | **Render streaming**: rings (L0 to 150 m + a lookahead, L1 to 400 m, far proxies in bounded rings), parent-first refinement, decoding in workers, one residency allocator (A18) | Driving the grid never shows a hole; resident memory stays in the envelope | L |
| SF18c | X | **The tile cache**: content-addressed Cache Storage with a quota policy (C35) | A second drive downloads nothing; offline replay works | M |
| SF18d | X | **Traversal safety**: the highway and seams are always solid; readiness distance = speed × (request latency + transfer time of the critical bundle at the link rate + max stall + decode), with the critical bundle (a shard's colliders + sim) ≤ 2 MB on the wire (§3.2; ≈ 435 m at 30 m/s, 5 Mbit/s and a 10 s stall, under the 555 m pitch; R3-D3, R3-C13), plus a **hybrid bundle** line: a neighbour's `runtime/` chunk is fetched and parsed from readiness distance on (R4-S6); while a shard's sim isn't ready its edge holds as a soft wall, never open air; past the bound proxies show, never a fall (A13) | Cold cache, late collision, a U-turn, and 3 s and 10 s stalls at 30 m/s (the hoverboard on the highway, G60): no fall | M |
| SF19a | O | **One frame**: the camera owns sun, sky, fog and exposure under one world clock; per-shard time overrides blend across edge bands; a shard-id buffer picks each pixel's grade; a neutral highway look | Four looks read as one view at a crossroads (board) | L |
| SF19b | O | **Each shard's look under one frame**: the old full-screen look stays as a Debug variant (and stays live in explore mode); a portrait board per changed look goes to Jake | Jake's pick per shard; losing variants deleted in the pick commit | M |
| SF20a | X | **Seamless crossing inside the grid**: no page reload between grid cells; platform things travel, shard items stay in their shard's save, a held shard weapon is stowed at the border (G25, B23). **`travel.ts` stays** for Select a shard and explore: its fresh-document switch releases WebKit's heap and carries the inventory durably (R2-C3, D8) | Crossing a grid border has no hitch and loses nothing; Select a shard still switches shards by a fresh document, explore entry and inventory unchanged; **grid ↔ Select a shard keeps one progress** (R4-S3) | M |
| SF20d | X | **Speed and border rules**: the hoverboard runs at **30 m/s on the highway deck**, easing to the shard's cap across the strip (G60, R3-C24) and ~15 m/s inside shards (HOVER_TOP is 14 today; an author may lower it); creatures stay home; no cross-border combat; the highway is safe; a mount crosses with its rider as one unit; neighbours visible, read-only (W7g) | One test per rule | S |
| SF21a | O | **The main menu: two entries** (G58), per §3.3's table: **Select a shard** (today's one-shard flow) and **EXPERIMENTAL Wildshard** (the 3 × 3 grid), **shown only with Settings ▸ Developer on until SF22's gates pass**, then to everyone, still labelled EXPERIMENTAL (G61). The grid boots only from a one-shot tap intent (session and device storage like `setTitleArrival`, consumed at boot, 60 s TTL); a reload without one lands on the title with Select a shard focused; `lastEnd`'s `unexpected` end only adds a one-line note; `AliveInfo` gains `mode: 'grid' | 'shard'` (R3-C5). It reads `__DEVSERVER__` (built by SF8c / SF8d); Nine Dragon's DEVSERVER toggle in Settings ▸ Debug | Both entries per mode; a reload inside the grid with sessionStorage cleared lands on the title; saves intact | M |
| SF22 | O | **The crossroads gates**: the SF22a rig plus the grid's real crossroads at 2× render scale, the hoverboard at 30 m/s on the highway (a scripted test mover) through 5 Mbit/s with 3–10 s stalls, on the Simulator against SF22a's phone / Simulator ratio; the grid stays behind EXPERIMENTAL either way | ≤ 0.85 GB peak (phone-equivalent); 95 % of frames ≤ 33.3 ms; no holes or falls; no shader compile at the first crossroads; no tab kill in three runs; a hybrid neighbour's install at the crossing ≤ one 33 ms frame (R4-S6) | M |
| SF23 | O | **The far view** in bounded rings: a baked low-poly proxy per shard (the 3 × 3 grid's longest sightline is ≈ 2.4 km, so no impostors in Part A; R3-C20) | Every grid shard visible; boot residency doesn't grow with the grid | M |

#### Systems the seven shards use today (pulled by their conversion rows)

| Row | Lane | System | Used today by | Done when | Size |
|---|---|---|---|---|---|
| SF24 | X | The **shard director** and typed events (G9); grid-event subscriptions reserved in the API (G36) | Driftwood's finale; Nalati's and Pine Hollow's shard-wide events | Each consumer's events run from a director script | M |
| SF25 | X | **Client scripts**: presentation only, a read-only view of declared state (G10) | Driftwood's ambient life, every shard's particles, Nine Dragon's visual movers and walker crowd (R2-C10, R2-C17), Nalati's drifting horses (R4-S7) | A client script drives particles; a fixture proves it can't write shared state | M |
| SF26 | X+O | **The commons v0**: the kit species and sounds the shards share today, shipped once and cached across shards, referenced with `commons:` (G6) | Every shard using kit species or sounds | A commons asset downloads once for two shards; memory at a crossroads counts it once | M |
| SF27 | X | **Brains**: the archetypes the shards use today, boss phase tables, custom AssemblyScript brains over the host queries (G12, R2-C10) | Every shard's creatures; Pine Hollow's Antler King | Each shard's creatures run on platform or AS brains (unique bosses may stay in `runtime/`) | L |
| SF28 | O | **The UI kit** for what shards show today (markers, toasts, quest panels, the trader and shop panels, counters) in platform slots; HUD changes over herdr (E332) (G22) | Pine Hollow's trader, Nalati's camps, the template's markers | No shard builds DOM; each panel is declared | L |
| SF29 | X | **Audio as data**: the cue maps, ambience zones, scores and today's calm / tension stems with boss slots (`engine/audio/Stems.ts`) (G24, R2-C10) | Every shard | Each shard's audio comes from its shardfile | M |
| SF30 | X | **Movers and toys the shards use today**: Sky Reach's winch and rope bridges, Driftwood's rope bridge and its **moored boat** (a wave-bobbed kinematic platform you stand on, `world/Boat.ts`) (G21, R3-C17); hover decks are static colliders gated on hover mode and belong to SF34; Nine Dragon's movers are visual (SF25) | Sky Reach, Driftwood | Their movers run from data + scripts; physics baseline 0 stuck | L |
| SF33 | X | **Saves in the format**: per-player progress, declared shared-state fields, the stable **instance id** (SF14) on every shard save (R2-C14, R4-M1), additive schemas and author migrations tested on real saves (G18, C26) | Every conversion | A conversion keeps a current save of its shard; beating the boss on `template-1` leaves `template-2`'s alive | M |
| SF34 | X+O | **The player modes used today** as platform modes: hover (the hoverboard), ride (Nalati's horse), grapple (Nine Dragon's Fei Zhua), **swim and wade** (the motor's water modes, Driftwood's swim arms), and **hover-only decks** (Sky Reach: colliders live only in hover mode) (G3, R2-C10, D11) | Nalati, Nine Dragon, Sky Reach, Driftwood, the template | Each runs from the SDK; swim parity on Driftwood and Nalati | L |
| SF36 | X | **Items**: the weapons and tools the shards use today as rows over kit families with AS hooks (the whip, the war fan, the Lever Rifle, Nalati's four); signature-item and skin fields reserved (G13) | Every shard's loadout | Every shard weapon is a row + script or sits in `runtime/` | M |
| SF38 | O | **The points budget overlay** in `wildshard dev` and the dev build: one cost score per tile and shard, green / amber / red, raw numbers one tap away (G30) | Every conversion (memory) | The overlay shows each shard's and the crossroads' cost | M |
| SF45 | X | **`docs/SHARDFILE.md` and the SDK docs** from the schemas (A1) | Every conversion | Every schema field and ABI call documented | M |

#### C — The seven shards ported → **M3** (from M1; all seven to 80/20, G49)

Every conversion row has two parts (R2-C5): **-g, grid-ready** (baked tiles, edge profile, look under one frame, within the caps; behaviour may stay in `runtime/` through the hybrid loader) and **-p, the 80/20 port** (behaviour into AS or `runtime/`). M2 needs SF46-g, SF47-g and SF48-g (SF49-g, SF50-g for dev mode). Each part (the -p part also removes the shard's direct progress writes: feats become SF14 facts, R4-S4): a **save migration** tested on a current
save of that shard (C26); the legacy plugin path stays as a Debug variant until Jake picks, the measures count only the
default path, and the legacy code goes in the pick's commit (C27); the per-shard compatibility checks (headless, replay,
ledger) pass on whatever it claims (A15).

| Row | Lane | Shard | Specific exits | Size |
|---|---|---|---|---|
| SF46 | X+O | Driftwood Isle (grid centre) | **First step: the hybrid loader** (old SF15b): shardfile + its trusted `runtime/` chunk, placement from the grid catalogue; proven first on a fixture (the template + a test `runtime/` chunk), then Driftwood boots with parity identical, and Driftwood beaten in Select a shard is beaten in the grid (R4-S3). **A hybrid shard's `runtime/` hooks run only while the player is inside its cell**; neighbours show only shardfile content (baked tiles, colliders, frozen sim); crossing disposes the old shard's play scope and installs the new one (page-global singletons such as `rt.buildEquipment` are set per scope; R3-C4), proven with two hybrid fixture shards, a crossing, the leak test and no singleton left behind. Then four edge entries (pier / sandbar roads) walked by validate and `driftwood-isle` removed from `edge-exemptions.json` (B10, C9); a board to Jake for the level change; DRIFTWOOD-REMASTER-V2's V-B1 Blender pass is still open, so bake through SF9 or after it (B29) **Breakdown** (`4ec64f071`): 318.5 MB GPU (geometry 182, of which the Blender island's merged copies 104; shadows 42) + 204 MB of JS geometry arrays; reachable **without a look change**: instance the island and prop models (≈ −95 / −28 MB), free geometry arrays after upload (−82 MB measured), shadows to ~80 m (§3.2) | L |
| SF47 | X+O | Pine Hollow | **Its memory breakdown starts during F1**: labelled GL bytes per texture and buffer with `scripts/parity/glbytes.mjs` plus the native footprint (`gpuTrace` reports counts, not bytes; the 587 figure is a MiB GL ratchet, D6); targets from §3.2 (library ≤ 25 MB, tiles in caps), work ordered by MB saved; SF47-g right after SF46-g **Breakdown** (`4ec64f071`): 360 MB GPU in KTX2 mode (textures 231, geometry 51, PMREM 22), 660 MB on a cold boot; ≈ 275 MB reachable invisibly, but textures stay ~115 MB, 4× the library cap, so **SF47-g needs a visible change** (ASTC 6×6, 512² props and building sets): a variant sheet to Jake (JAKE.md), old look as a Debug variant | L |
| SF48 | X+O | Nalati Grasslands | Riding (SF34), its ~260 decorative horses as SF9b instance lists **plus an SF25 client script for their drift** (R4-S7) (`engine/entities/farHerd.ts` is engine draw batching and keeps working; R3-C7), two bosses (the Golden King, the Storm Titan; B42), four weapons (SF36); its painterly look under one frame (SF19b) | L |
| SF49 | X+O | Sky Reach (`far-reach`) | Its edges get entries or a seam treatment; `far-reach` leaves `edge-exemptions.json`; hover bridges (SF34), movers (SF30) | L |
| SF50 | X+O | Signal Dunes (`sunscar-dunes`) | Sky and sand onto SF10a's families (a runtime adapter may feed family parameters but must pass the family / one-frame gate; A10); the bullwhip onto items | L |
| SF51 | X+O | Nine Dragon Stack (DEVSERVER only) | Its levels as they work today (interiors culling is S2); its neon look checked against SF19; grapple on SF34; its movers and crowd as client scripts (SF25) | L |
| SF52 | X | The template | Done at M1 (SF16): the reference shard, no `runtime/` | — |
| SF53 | — | Thin Ice | Its own plans; only its `runtime/` ceiling is measured here (T4, G47) | — |

Part A ends at 80/20 for all seven; 90/10 and 100/0 are successor plans (C38).

### Part B — stretch goals

Jake (G57): *"Stretch goals at the bottom like "crodws of hundreds of creatures", "interiors", "physics toys", "ai playtesters", "one lcick vercel preview". Basically anything in the plan that's being built that is not being used in the 6 shards today, goes to the bottom of the plan as stretch goals."* Each starts only after Part A, or earlier when a shard's port needs it. Their decisions in §10 stand; done-whens are written when one starts.

| Row | Was | What |
|---|---|---|
| S1 | SF31 | **Crowds of hundreds**: beyond today's far herd (which is Part A, SF27), hundreds of LOD-AI creatures or NPCs |
| S2 | SF32 | **Interiors and verticality**: stacked spaces with streaming and occlusion culling |
| S3 | SF30, SF20b, SF20c | **New physics toys and vehicles**: boats, carts, gliders, ragdolls, destructibles; a **highway car** (G60: the hoverboard covers 30 m/s in Part A) and **auto-path** along the highway (G33, G39, G40) |
| S4 | SF34 | **New player modes** (climb, drive) and **author movement modes** in AssemblyScript (G14); swim is Part A (SF34) |
| S5 | SF35 | **Material graphs**, then **restricted shader code**, compiled per renderer (G4 stages 2–3) |
| S6 | SF37 | **The WebGPU spike**, default-off behind a Debug row (G32) |
| S6b | SF23 | **Horizon impostors** beyond ~2.5 km, for grids larger than 3 × 3 (G38) |
| S7 | SF26 | **Standard rigs** (humanoid, quadruped, bird, serpent, insect) and a shared clip library (G8) |
| S8 | SF29 | **Adaptive music**: director-driven stems beyond today's calm / tension, reverb zones (G24) |
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
| S21 | SF0b | **Laptop GPU headroom**: a quality tier for weaker laptop GPUs (MSAA, grass density) default-off behind a Debug row, measured on a real lower-end laptop |

## 5. Order and why

1. **Now, alongside the council:** SF0 is done (`417db57d2`); SF0a–c fix the three desktop misses first when code rows open; SF22a (memory: the empty template's engine base and a synthetic four-corner rig on the
   Simulator; Jake: memory is a huge problem): **done**, §3.2 caps v1. SF22b and SF22c come after round 4 (R4-A4).
2. **F0**: SF1a → SF1b → (SF1c, SF1d, SF1e, SF2) in parallel; SF3a → SF3b → SF3c → SF4a; SF5a → SF5b → SF5c → SF4c;
   SF6 after SF1a.
3. **F1** (R3-A1, R3-C2): SF8b-0 → SF7a → SF7b → SF8a → **SF15a-min** → SF11a → SF11b; then in parallel, each proved on an
   engine fixture: SF7c, SF7d, SF7e, SF7f, SF7h, SF8b, SF9a, SF9d, SF9b, SF9c, SF10a, SF10b, SF11c, SF12, SF13, SF13b,
   SF14, SF29a, the full SF15a, SF8c, with these edges (R4-A1): the full SF15a before SF9a's tile load; SF7f before
   SF13b's boss panel; then SF8d; then **SF16 (+ SF16a)** switches the template onto all of them.
   **M1** = SF16 passing. Then **SF33a** before any F2 row that persists state.
   SF47's memory breakdown runs during F1.
4. After M1, in parallel: **F2** (SF17a → SF17b → SF18a, with SF21a and SF20d before SF18a's grid-mode and 30 m/s legs (R4-S5); SF18b, SF18c, SF18d;
   SF19a → SF19b; SF20a; SF23; SF22b, SF22c; then SF22) and **the conversions**: SF46-g (with the hybrid loader), then SF47-g and SF48-g so the shipped cells are
   grid-ready, then SF49-g, SF50-g; the -p ports follow, then SF51; each pulls the systems it uses from the "used today"
   table. **M2** = the 3 × 3 grid playable from
   EXPERIMENTAL Wildshard with seamless travel and SF22's gates passed. **M3** = all seven at 80/20 by both measures.
5. **Part B** after M3, or a single stretch goal earlier when a shard's port needs it.

## 6. Done when

Part A (this plan's goal):
- **M1:** every milestone boolean true for the template.
- **M2:** the 3 × 3 grid plays from EXPERIMENTAL Wildshard with seamless travel; SF22's gates passed on the Simulator,
  calibrated by SF22c's one physical-iPhone reading; Select a shard still works and is the way back.
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
- **ANIMATION-REMASTER**: standard rigs and the clip library (S7); skinned assets in the format (SF9c).
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
  and a crossroads) on **desktop** (headless Chromium on Metal, uncapped, 2× scale)
  and on the **iOS Simulator** through `scripts/sim-lane.sh` (Safari, the phone tier), writing
  `progress/frame-floor/<sha>.json`. **The one acceptance rule** (R4-A3): integer-rounded median fps ≥ 60 (desktop) / 30
  (Simulator) and p95 ≤ 17.5 / 35.0 ms (1.05 × the period, tolerating vsync and ms quantization); strict p95 and CPU
  work p95 are reported, not gated. It records today's baseline first; a surface that misses the floor today is listed
  and gets its own fix row before anything else touches it.
- **Every row that touches the client** (loader, rendering, streaming, scripts on the main thread, looks) runs the frame
  floor before it merges; a miss blocks the merge. Engine-only and tooling rows run it every few merges.
- A risky render or memory change still ships default-off behind a Debug row until a reading backs it (RENDERING.md).

### 9.5 Councils (G59)

**Four council rounds** (Jake, 2026-10-04: "I've also been told that 4 round council approach is better then 8 rounds";
COUNCIL.md's normal cap). Round 1 reviewed everything; rounds 2–4 review the diff since the last round plus the battery,
with two Codex seats and one Claude seat. **Code rows waited until round 4 ended** (Jake, 2026-10-04: "why are you building before the 4 rouns of council are
done"); only the measurements SF0 and SF22a run during the council. SF5a landed before the pause (`3760af612`) and is
re-checked against the final rows. After round 4, whatever is still open is decided by the coordinator
with a recorded reason (Jake set no questions for the night, G56) and listed for his review.

### 9.6 Every merge

Before dispatching a row, the coordinator checks that every row its done-when uses is done (R4-A1 should-add, taken as a
dispatch rule instead of a column). Pathspec-only commits through `scripts/push-main.sh` with the local gates green (`scripts/vercel-tree-gate.sh`); parity
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
| G21 | Which limits to break first | **All four become early platform systems**: physics toys and vehicles (ropes, boats, carts, gliders, ragdolls, destructibles; server-authoritative, phone-cheap); crowds (hundreds of creatures or NPCs with LOD AI and animation); shard UI; interiors and verticality (dungeons, caves, towers inside the cube, with streaming and occlusion for stacked spaces) *(narrowed by G57: only what the shards use today is Part A; the rest is Part B)* |
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
| G42 | How big M1 is | **Thin M1**: format v0, `new / dev / build / validate`, the baker on terrain and static props, two or three material families, the AssemblyScript host with entity scripts, quests as data, one platform brain; the template boots from its shardfile with no trusted code; a fresh author outside the repo builds a small shard *(narrowed by G57: the outside-author trial is S19)* |
| G43 | When the six convert | **From M1**: each shard converts when its agents are idle, onto whatever systems exist, measured both ways; its gaps steer what the platform builds next |
| G44 | Review before `ready` | **Rewrite, then up to six council rounds** (Jake; COUNCIL.md's four-round cap is lifted for this plan) |
| G45 | How compatibility is proven without multiplayer code | **Compatibility checks only**: a test steps each shardfile's simulation in plain Node with no renderer; a determinism test runs one input log in Node and in WebKit and requires identical state hashes; server scripts and client scripts are separate and singleplayer runs both locally; rewards go through a ledger interface that singleplayer implements locally with the same rules. No network, rooms or server process *(narrowed by G48: same-engine Node replay; only scripts are checked across engines (SF11c))* |
| G46 | The singleplayer world | **A singleplayer grid**, starting with **three shards: Driftwood Isle, Pine Hollow and Nalati Grasslands**. Signal Dunes and Sky Reach join the grid (five shards) **only when dev mode is on**. **Nine Dragon Stack is a partial shard**, so it runs only in **DEVSERVER mode**. The DEVSERVER has the usual controls (explore mode, enter world …). The grid has an explore mode that explores one shard at a time: the level selector comes back only for explore mode, behind the dev toggle (Jake) *(narrowed by G58: Select a shard stays on the main menu; §3.3's table)* |
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
| G60 | Highway speed | **The hoverboard runs at 30 m/s on the highway; no car** (Jake: *"30 m/s can be hoverboard speed on highway no car"*); ~15 m/s inside shards (G39); the car stays a stretch goal (S3) |
| G61 | Decided by the coordinator under G56 (no questions tonight), for Jake to review | **E1**: EXPERIMENTAL Wildshard shows only with Settings ▸ Developer on until SF22's gates pass, then to everyone, labelled EXPERIMENTAL (the hourly deploy would otherwise show a half-built grid; ledger 5). **E2**: the grid's code paths stay inside EXPERIMENTAL through Part A; Select a shard switches only after Jake has played the grid (council round 4) |

## Handoff (shard-platform)

Written 2026-10-04 by the shard-platform coordinator, after the council (four rounds) (asks E431, E433, E435; E436 for repo
weight). Jake set the goal: finish the plan, run the council (four rounds, G59), build Part A, keep the frame floor, no
questions to him (G56).

**Read first:** §0, §3, §5 and §9; §10 (G1–G61); the register in `shard-platform/reviews/`.

**Done:** P0; SF0 `417db57d2`; SF1a `91f97bdfc`; SF1b `78fbcbe1d`; SF5a `3760af612` (+ `4b4de05c2`); SF22a `3bff65310`.

**In flight:** the F0 re-briefs (below). **Paused uncommitted work in the shared tree** (do not lose it):
SF1c / SF1d by sp-x2 (`scripts/precommit-guards.mjs`, `scripts/check-shards.*`, `src/shards/_template/manifest.ts` at
500³, `test/world/world-contract.test.ts`, `test/row-data.test.ts`, `test/arch-guards.test.ts`) and SF3a by sp-x3
(`lint/wildshard-plugin.js`, `lint/sim-closure.mjs`, `lint/sim-closure.json`). Builders: Codex panes sp-x1…sp-x4.

**Next:** re-brief sp-x2 (SF1c–e), sp-x3 (SF3a–c → SF4a), sp-x4 (SF5b–c → SF4c), sp-x1 (SF2,
SF6, SF0d, SF22b), Opus SF0a–c; then F1 → M1 → F2 + conversions (§5).

**Lessons:** run the vercel gate before pushing code; imports name the defining module (E434); a guard with zero targets
proves nothing; numbers come from a committed script; builders commit with `Plan-State: unchanged` and the coordinator
closes rows.
