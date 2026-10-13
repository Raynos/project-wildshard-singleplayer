# Plan: SHARD-PLATFORM — MMO-compatible shardfiles in the singleplayer game (E431, E435)

**State:** `in progress` — the live status is [STATE.md](shard-platform/STATE.md) (the coordinator's, ≤ 3 KB, G275); this file holds the live rules and the open rows (G375) and the full State history is in [history.md](shard-platform/history.md). **Hard count first (G256): shards at 80/20: 1 of 7** (the template; on G291's custom ÷ frozen-legacy measure, 2026-10-13: Signal Dunes 51.3 %, Sky Reach 54.4 %, bar 20 %, G373). Ready-to-share checklist: no known P0; 30 fps on the Simulator met; every enterable shard fits 1.0 GB met (G257); three phone runs with no tab kill not yet (Jake's, G269). Then effort (coordinator, 2026-10-08 evening, not re-counted here; the newer recounts are `progress/shard-platform/effort-recount-*`): whole plan ≈ 57 %, Part A ≈ 74 %, M1 ≈ 99 %, M2 ≈ 92 %, M3 ≈ 51 %.

**Reviews:** [Wildshard MMO Review](../reviews/wildshard-mmo-review.md) (the clean-room audits, E435); [SHARD-PLATFORM mockups](../reviews/shard-platform-mockups.md) (Jake's E438 picks G72–G107, boards in `art/`).

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
Dunes (slug `sunscar-dunes`), Sky Reach (slug `far-reach`) and Nine Dragon Stack, plus an **eighth, Template 2** (G151, SF55):
the fully Blender reference beside Template 1, the fully procedural one. They meet on a **3 × 3 singleplayer
grid** on one landmass joined by an asphalt boulevard and generated no-man's land (§3.3), reached from the main menu's
**INFINITE WILDSHARD** card (G79, G88); **SHARD SELECT** keeps today's one-shard-at-a-time flow (G58). In this plan
"Select a shard" means the SHARD SELECT card.

**Compatible** means (G45, bounded determinism G48): the shard's sim runs headless in Node; a snapshot taken
mid-encounter restores and replays to the same state hash on the same engine; behaviour is AssemblyScript (bit-identical
everywhere by construction) or, during the transition, TypeScript in `runtime/`; shared state is host-owned declared
fields; rewards go only through the ledger interface. Cross-engine bit identity of the whole sim is **not** required
(§3.1).

**This plan does not build:** servers, rooms, netcode, an upload service, moderation, source storage, remix, a catalogue
service (G41, G47), or anything in WorldClaw (G47). Repo weight has its own plan, [REPO-WEIGHT](REPO-WEIGHT.md) (E436).
Decisions about the MMO platform (G13, G17, G19, G20, G23, G25, G26, G28, G34) are requirements the format stays
compatible with; G7's building and G36's grid events are later.

**The route (G319).** The approved shardfile design system, [design-system.md](shard-platform/design-system.md) (page
`docs/reviews/shardfile-design-system.md`, with G312–G318 applied), is how the rest of Part A is built: its rows are
SF79–SF87 (the base, the authoring core, the five shared systems, the one-shot test, regenerable bakes), and its §7
table supersedes the older rows it lists. Read it before any row it touches; the measures are §1, the binding rules are
"Live rules" below.

**The words** (the same three boxes as the [Shardfiles Explained](../reviews/shardfiles-explained.md) page):
- **① Shardfile:** the build product a future MMO receives, and **only compiled output**: `shard.json` (identity,
  version, budgets, entries, accent, state schema, every file by content hash), baked tiles with levels of detail,
  colliders, the far proxy, `.glb` models, textures, sounds, data rows and compiled AssemblyScript (`.wasm`), plus
  `commons:<hash>` references. **No generator, no TypeScript, no source** is in it (G146, G150). Renderer-neutral (G32).
  Built, never hand-edited (G1). An MMO server loads it unchanged; `shard.json` may name a first-party runtime entry
  (`runtime`), which a non-first-party load refuses and the MMO ignores (C3-R1-C11).
- **② Shard project (local authoring source; not uploaded by this singleplayer plan, C3-R1-B11):** `src/shards/<slug>/`
  in the monorepo for first-party shards (§3.5), anywhere for an outside author (SF8b; C3-R1-C11): generators, data and quest
  authoring, AssemblyScript sources, raw assets, and during the transition `runtime/`. `wildshard build` (the SDK's CLI)
  compiles it into ①. A future source-plus-build upload is the MMO's workflow (G19, G41); it never puts source inside ①.
- **Generator:** any tool that makes a shard's geometry or content on the author's machine: our six shards' existing
  three.js TypeScript run once at build time, AI mesh models (TRELLIS, Hunyuan3D), Blender scripts, Rust, Go or hand
  modelling (G150). **Optional**: a shard can have zero generators and be one big Blender world GLB plus data (Template
  2, SF55; Template 1, SF52, is the generator-heavy opposite, G151). Generators never ship; only their output does. A committed hand-made or Blender-exported GLB in `assets/` is an
  input, not a generator: "zero generators" means no `generators/` folder the shard build runs (C3-R1-C2).
- **The SDK's build** (`wildshard build`): **today it validates and packages files that are already baked**; the
  generator-free bake of authored geometry is **SF55a** (C3-R1-A1, B1, C1). With it, the build does the platform work for any authored geometry: cuts it into 62.5 m tiles with LODs, makes the
  colliders and the far proxy, checks the four 8 m entries, the edge profile and the 1.0 GB budget, and maps materials
  onto the engine's material families, which is where the shaders come from (G5).
- **Platform systems:** engine-backed behaviour every shard uses through `@wildshard/sdk`: families, the script host,
  brains, quests, rigs, the UI kit, audio, toys, crowds … (the kit package dissolves into the SDK, G135).
- **The commons:** one `@wildshard/commons` package of build-time packs that emit shared, hash-named content (models,
  clips, sounds, WASM, rows), cached once across shards; no commons code runs in the game (G137, G138).
- **③ Custom runtime:** a first-party shard's trusted TypeScript in `runtime/`, at most 20 % of its lines. It is **not
  part of the shardfile**: in our singleplayer game it ships as a separate trusted chunk next to the shardfile (the
  hybrid loader, SF46), and it never goes to the MMO. Transition only; 90/10 and later plans shrink it to zero (G136,
  G146).
- **Grid-ready:** baked tiles + an edge profile + looks on families under one frame + within the 1.0 GB cap (G110) +
  **four midpoint entryways at y = 0, 8 m wide, each carrying 15 m of the platform's asphalt into the shard** (G93, G99,
  G103, G131; the platform draws the asphalt and the shard keeps the 8 × 15 m footprint clear, SF8c; `validate` checks them) + a declared HUD accent (G104). Behaviour may still sit in `runtime/` (C16). Grid-ready is separate from 80/20 so the grid doesn't wait on the hardest conversions.
- **DEVSERVER:** a build define `__DEVSERVER__` (`vite build --mode devserver`), set by `scripts/serve-build.sh
  --devserver` and by `wildshard dev`, never by `pnpm build` or Vercel; the push gate asserts it is false in the
  production bundle (R3-C10). Never a URL switch. It shows every shard including Nine Dragon, explore mode, enter world and
  the usual dev controls (G46).
- **Dev mode:** the shipped game's Settings ▸ Developer switch (`src/engine/core/devMode.ts`).

## 1. The measures (exact, G291 / G294 / G304)

`scripts/shard-platform.mjs` prints them per shard; generated and baked output never counts (G291).

- **80/20 (G291):** a shard passes when its **custom runtime TypeScript is ≤ 20 % of its frozen `<slug>-legacy/`
  folder's TypeScript** (Jake: *"the 80/20 number should never be between the raw files and the shard file. Should
  always be … between the SDK and the custom runtime"*). Custom = the shard folder's shipped TypeScript, **plus** every
  game / SDK / engine module or export only that shard uses (G294: a system counts as shared only once two real shards
  use it; the template doesn't count, G312), **plus** raw GLSL beyond its runtime TypeScript (G306: raw GLSL is trusted
  custom code). The template and other shards with no legacy folder keep the old public-share check (the
  `legacy-share` column, secondary). 20 % stays the bar for 80/20 done (G373).
- **M3's scope (G265):** the `<slug>/` shardfile folders; `<slug>-legacy/` folders are excluded and frozen (G263).
- **AssemblyScript (G315):** no cap; its own report-only column per shard.
- **The content gate beside 80/20 (G304, SF77):** a ported shard ships its terrain, static geometry and colliders as
  shardfile tiles (via `sdk/bake` / SF55a); bakes stop writing shard-private binaries decoded by trusted code; and
  `compatible` reads `transitional` while trusted code runs the shard's simulation. Report-only first: the script prints
  tiles / files / colliders from the built `shard.json` and names each private binary.
- **The proofs** per shard: boot from its shardfile, headless, replay, ledger, grid-ready, compatible / transitional
  (A15: never "compatible" by percentage alone).
- **Reporting (G256, G351):** lead with the hard count (shards at 80/20 of 7) and the ready-to-share checklist, then
  effort; every status reports game's shard-facing plugin modules and its total exports.

The pre-G291 measure (public ÷ (public + custom) inside the shard folder) is kept in [history.md](shard-platform/history.md).

## Live rules

The rules binding today, one line each; Jake's words are in [decisions.md](shard-platform/decisions.md) under each G-number.

**The goal and the measure**
- 80/20 = custom runtime ≤ 20 % of the frozen legacy size; generated data never counts (G291); 20 % stays the bar (G373).
- A game / SDK system is shared only once 2+ real shards use it; the template is not a second user (G294, G312).
- The content gate: tiles, no shard-private binaries, `transitional` while trusted code runs the sim (G304).
- Raw GLSL is trusted custom code; SF59 shader graphs are the only public material path (G306).
- Each of the six shards is `<slug>-legacy/` (frozen) beside `<slug>/`, with separate saves (G263, G264); every legacy feature is ported 1:1 (G267).

**Layers, the SDK and `runtime/`**
- The SDK is the library you import to generate a shardfile, never a wrapper over engine or game internals (G296).
- It feels like three.js (G301); generators build real three.js scenes in Node and hand them to SDK calls such as `bake(scene)` (G311).
- `runtime/` imports only the `@wildshard/game` plugin modules in its `exports`; no SDK facades; `generators/` and `data/` import only the authoring SDK (G307).
- Game's plugin modules trim one by one toward the design's ~12 (G357).
- Behaviour: data rows first, then a generic SDK system with a second user in mind, AssemblyScript for truly custom logic, `runtime/` last (G295, G309).
- Engine and game stay separate packages for good (G316); the shardfile schema is its own `@wildshard/format` package (G313).
- One-user systems move back into their shard (G303); commons is what 2+ shards reuse to generate shardfiles (G310), and a pack lands only with two real shard users (G355).
- A shard folder holds all the code that generates its shardfile, with no one-time steps (G298).
- Native runtimes and bakes that run runtime code in Node are bridges with an exit row per shard (G297, G350).
- The approved design system is the route for the rest of Part A, rows SF79–SF87 (G319).

**Generated outputs and bakes**
- Infrastructure as code: every output is generated from SDK-driven TypeScript in the repo, never hand-edited (G290).
- Build time + content-hash cache by default; commit an output only when its cold rebuild is over 30 s and it is under 2 MB (G292, G318).
- Blender GLBs stay committed, regenerated by their script (G293); `scene.json` is never committed (G317).
- Every output is regenerable from the shard's authoring folders, the SDK and commons only; no baker boots the game; a nightly clean-room rebuild proves it (G320).
- Near and far placeholders come from the SDK build for any shard: no slug branches, no per-shard tables (G348).
- Generated files are made at commit, fast, and ride in that commit; the push never regenerates (G367); cheap bakes regenerate at commit, slow ones stay committed and are checked in CI (G364).

**Process and the push**
- Debt counts are shrink-only; a rise needs a plan row naming the deletion that pays it back (G349).
- Pre-commit checks those debts on the committed files; allowed-direction graph counts are report-only; green-prefix pushes on (G353).
- Every check of about a second or less runs at commit, in parallel (G358); pre-commit ≤ 10 s (G370).
- The pre-push gate takes ≤ 2 min: changed-file typecheck and lint plus affected tests; the full suite, bakes and receipts run in CI, fix forward (G359, G360, G363).
- Exact-number tests become limits; behaviour tests stay (G365); flaky tests go to the nightly and dead ones are deleted (G280).
- Never stop the line: lanes keep committing while the push lane fixes the queue (G374).
- Faster, less ceremony; no new git or push tooling except to fix a red (G356).
- Builders keep deciding and list every call daily in STATE.md; anything touching an approved G-row asks first (G352).
- Status lives in STATE.md; no per-lane handoff files (G275); heavy proofs per milestone (G273).
- Any agent may dispatch the deploy, at most once an hour (G284).

**The fleet**
- 4 Opus subagents of the coordinator + 3 Codex panes (G366, G376); Opus lanes are subagents, not top-level panes (G337).
- One Codex lane only pushes and deploys (G339); the bench-max lane is a Codex lane (G376); one Opus subagent is the looks lane (G376).
- Long coordinator and plan-agent sessions keep going (G362).

**Picks in force**
- The main-menu hero: above Nalati's centre (NA-a), aimed toward Driftwood; square on the phone band, landscape on desktop (G368, G372, G344).
- The main-menu layout: B on portrait, A on landscape (G341).
- The near tier: the nearest cells by distance, diagonals included (G371); it stays behind its Debug row while it iterates (G342, G347, G369).
- The public 3 × 3: Driftwood (centre), Pine, Nalati, Sky Reach, Signal Dunes, Template 1, Template 2, two open plots (G270); it goes public after Jake's three phone runs (G269).
- Public SHARD SELECT cards flip to the shardfile version once proven (G326).
- Ship real in-engine captures, not AI images; the rest is compared on boards (G332, G333, G334).
- The 80/20 sprint lands Signal at ~25–30 % and Sky at ~35 %; quest state machines move into AssemblyScript hooks now; shader graphs later (G345, G373).

## 3. The contracts (summary)

The full text is [contracts.md](shard-platform/contracts.md), with the same numbering.

- **3.1 Determinism, bounded (G48):** AssemblyScript behaviour (bit-identical everywhere), the whole sim headless in
  Node, same-engine record → replay and snapshot → restore → replay, each shard in its own local frame. No
  cross-engine check beyond scripts.
- **3.2 Caps v1 (SF22a):** the only hard caps are the worst-location totals, **1.0 GB playing and 1.8 GB loading**
  (G110); the per-category budgets (L0 4 MB, L1 2 MB, far proxy 1.6 MB, library 25 MB, sim 25 MB, 8 draws per tile …)
  warn. One cost model for `validate`, SF22a and the residency allocator. Tiles: 62.5 m L0 → 125 m L1 → far proxy.
  Content cuts go to Jake; the grid never reloads the page at a crossing (G171). Phone textures: G188.
- **3.3 The singleplayer grid (G46, G49):** a 3 × 3 on one landmass (G72) inside an outer road and a VR void (G77);
  placement lives in `src/game/grid/singleplayer.json`; every shard is a 500 m cube with four 8 m midpoint entryways at
  y = 0 carrying 15 m of platform asphalt (G93, G99, G103, G131); the cell edge is the line for the safe zone, weapon
  stow, frame owner and respawn (G130); the menu's SHARD SELECT and INFINITE WILDSHARD cards (G58, G79, G88). Today's
  public grid is G270.
- **3.4 Versioning (G29, G195):** one `SHARDFILE_VERSION`, 0.x, bumped freely with every first-party source migrated
  in the same commit; no freeze.
- **3.5 A shard project (B4, B17):** `src/shards/<slug>/` with `shard.config.ts`, `generators/`, `data/`,
  `behaviour/`, `quests/`, `assets/`, `runtime/`; a shardfile carries only data, AssemblyScript and baked assets
  (G146); `wildshard build` writes `public/shardfiles/<slug>/` (git-ignored); `wildshard dev` is rebuild-and-serve.

## 4. Open rows

Lanes (§9): **X** = Codex, **O** = Opus, **X+O** = Codex builds and Opus does the visual part. The full row text, with
done-whens and evidence, is [rows.md](shard-platform/rows.md); statuses here are a first read of each row's done-when
cell (the row text is the authority).

**[P0 — Guardrails and the metric (before any move)](shard-platform/rows.md#p0--guardrails-and-the-metric-before-any-move)**

- **SP3** Rows are serialisable — ratchet done; the named-id conversion open

**[F0 — Honest foundations, and memory measured first](shard-platform/rows.md#f0--honest-foundations-and-memory-measured-first)**

- **SF22c** (X) The phone reading without a chore — Simulator half done; Jake's phone runs open
- **SF22d** (O) Engine memory cuts — fix landed; parity re-run open

**[F1 — The shardfile → M1 the package](shard-platform/rows.md#f1--the-shardfile--m1-the-package)**

- **SF8c** (X) wildshard dev + validate's sim checks + DEVSERVER plumbing — headless half done; the rest open
- **SF10a** (O) Material families v1 — part 1 done; the rest open
- **SF15a** (X) The shardfile loader, minimal first — open
- **SF16** (X+O) M1 proof — open

**[F2 — The 3 × 3 grid, loading and seamless travel → M2 the grid](shard-platform/rows.md#f2--the-3--3-grid-loading-and-seamless-travel--m2-the-grid)**

- **SF17b** (O) Highway deck and seams — open
- **SF18a** (X) Sim residency per shard — open
- **SF18b** (O) Render streaming — rings + allocator landed; open items
- **SF18d** (X) Traversal safety — open
- **SF19a** (O) One frame — open
- **SF19b** (O) Each shard's look under one frame — open
- **SF20a** (X) Seamless crossing inside the grid — open
- **SF21a** (O) The main menu — open
- **SF22** (O) The crossroads gates — open
- **SF57** (X + O) The memory soak test — needs pick
- **SF58** (X) Untrusted-shardfile hardening — reopened
- **SF59** (X + O) Material graphs and per-shard post effects, in Part A — open
- **SF60** (X + O) Playtest and steering — open
- **SF61** (X + O) The Debug-row purge — open
- **SF62** (X + O) Performance guardrails — open
- **SF64** (X + O) The memory debugger — open
- **SF65** (X + O) Legacy vs shardfile entry in SHARD SELECT — open
- **SF66** (X + O) Maps that can't go stale — open
- **SF67** (X + O) The loading sprint — open
- **SF68** (X + O) wildshard-admin, the admin and analytics site — open
- **SF73** (X + O) Legacy and shardfile folders — open
- **SF74** (X) Stop wasting wall-clock time, and keep prod unstuck — open
- **SF75** (X) INFINITE WILDSHARD never drops to one shard silently — open
- **SF76** (O) Move the one-shard systems back into their shards — open
- **SF77** (O) The content gate beside 80/20, and the metric fixed — open
- **SF78** (O) No second SDK, no wrappers — open
- **SF79** (X (+O for looks)) Design system phase 0, the base — open
- **SF80** (X + O) Design system phase 1, the authoring core — open
- **SF81** (X) Directors — open
- **SF82** (X + O) Creature brains — open
- **SF83** (X) Movers — open
- **SF84** (X + O) Player modes — open
- **SF85** (X + O) Weapon rows — open
- **SF86** (O + X) The one-shot test — open
- **SF87** (O + X) Every baker regenerable without legacy code or the running game — open
- **SF70** (X+O) Ranged and thrown items as declared rows — open
- **SF71** (O) Agent playtest round 3, the first in iOS Simulator Safari — open
- **SF72** (X+O) Renderer-free runtime installers — open
- **SF63** (O) Each shard looks like itself inside the grid — open

**[Systems the seven shards use today (pulled by their conversion rows)](shard-platform/rows.md#systems-the-seven-shards-use-today-pulled-by-their-conversion-rows)**

- **SF24** (X) shard director — open
- **SF25** (X) Client scripts — open
- **SF26** (X+O) The commons v0 — open
- **SF27** (X) Brains — open
- **SF28** (O) The UI kit — open
- **SF29** (X) Audio as data — open
- **SF30** (X) Movers and toys the shards use today — open
- **SF34** (X+O) The player modes used today — open
- **SF36** (X) Items — open
- **SF38** (O) The points budget overlay — open

**[C — The seven shards ported → M3 (from M1; all seven to 80/20, G49)](shard-platform/rows.md#c--the-seven-shards-ported--m3-from-m1-all-seven-to-8020-g49)**

- **SF46** (X+O) Driftwood Isle — open
- **SF47** (X+O) Pine Hollow — needs pick
- **SF48** (X+O) Nalati Grasslands — open
- **SF49** (X+O) Sky Reach — open
- **SF50** (X+O) Signal Dunes — open
- **SF51** (X+O) Nine Dragon Stack — open
- **SF52** (X) Template 1, the procedural template — reopened
- **SF53** (—) Thin Ice — open
- **SF55** (O + X) Template 2, the Blender shard — open
- **SF56** (O + X) Template 1's dev-texture look — open

**[Part B — stretch goals](shard-platform/rows.md#part-b--stretch-goals)**

- **S1** Crowds of hundreds — stretch
- **S2** Interiors and verticality — stretch
- **S3** New physics toys and vehicles — stretch
- **S4** New player modes — stretch
- **S5** Restricted shader code — stretch
- **S6** The WebGPU spike — stretch
- **S6b** Horizon impostors — stretch
- **S7** Standard rigs — stretch
- **S8** Adaptive music — stretch
- **S9** The sandboxed UI panel canvas — stretch
- **S10** Shared world state with reset rules — stretch
- **S11** Signposts — stretch
- **S12** The phone QR — stretch
- **S13** The one-click Vercel preview — stretch
- **S14** Bot playtests — stretch
- **S15** The AI playtester — stretch
- **S16** Starters — stretch
- **S17** /wildshard-quickstart — stretch
- **S18** wildshard upgrade — stretch
- **S19** The outside-author trial — stretch
- **S20** Grid-wide events — stretch
- **S21** Laptop GPU headroom — stretch
- **S22** Quest, dialogue and encounter generators — stretch

**Done** (63): SP0, SP1, SP2, SP4, SP5, SF0, SF0a, SF0b, SF0c, SF0d, SF1a, SF1b, SF1c, SF1d, SF1e, SF2, SF3a, SF3b, SF3c, SF4a, SF5a, SF5b, SF5c, SF4c, SF6, SF6b, SF22a, SF22b, SF8b-0, SF7a, SF7b, SF7c, SF7d, SF7e, SF7f, SF7h, SF8a, SF8b, SF8d, SF9a, SF9d, SF9b, SF9c, SF10b, SF11a, SF11b, SF11c, SF12, SF13, SF13b, SF29a, SF14, SF33a, SF17a, SF18c, SF20d, SF69, SF23, SF33, SF33b, SF45, SF54, SF55a.

**Dropped / folded:** SF4d, SF15b (folded into SF46), SF57b (G171).

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
   SF19a → SF19b; SF20a; SF23; SF22b, SF22c; SF46-g, SF47-g, SF48-g prepared → **SF57** (its shipped-leg verdict; C3-R1-C5) → SF22) and **the conversions**: SF46-g (with the hybrid loader), then SF47-g and SF48-g so the shipped cells are
   grid-ready, then SF49-g, SF50-g; the -p ports follow, then SF51; each pulls the systems it uses from the "used today"
   table. **M2** = the 3 × 3 grid playable from
   INFINITE WILDSHARD with seamless travel (never a page reload, G171) and SF57's and SF22's gates passed. **M3** = all seven at 80/20 by both measures.
   **Alongside, off the M2 path** (C3-R1-A8, B2, C8): **SF56** (B picked, G163; shipped `e894412ca`; its proof gates stay with its lane); **SF58** after SF8a's reopened admission, its preflight (1′) before any non-first-party fetch, the whole row before S19; **SF55a → SF55** now, one parallel lane (G211); **SF59** (the TSL spike first) in Part A (no format freeze, G195).
5. **Part B** after M3, or a single stretch goal earlier when a shard's port needs it; S3 (vehicles, a highway car) and S14 / S15 (bot and AI playtests) first (G205).

## 6. Done when

Part A (this plan's goal):
- **M1:** every milestone boolean true for the template.
- **M2:** the 3 × 3 grid plays from INFINITE WILDSHARD with seamless travel (never a page reload, G171);
  SF57 done; SF22's gates passed on the Simulator, and
  Jake's grid playtest (SF22c, G71) survives three crossroads runs with no tab kill; SHARD SELECT still works and is the
  way back. **M2-ready** (the unattended target; C2-R1-C10): every M2 row done, SF57's shipped leg included (the dev leg closes under M3, C3-R2-C11), except Jake's gates (G120 captures,
  G123's board, SF22c's playtest): those boards are on the for-Jake page
  (`docs/reviews/shard-platform-for-jake.md`), their rows read `needs pick (date)`, and the
  grid is ready for SF22c. **Two reported outcomes** (C4-R1-A1, B6): **ready for playtest** (SF57's shipped leg and SF22 pass, every other buildable M2 item done, only unpicked boards and SF22c wait for Jake) or **needs content pick** (all independent M2 work done; SF57's per-shard cut board, measurements and recommended cut recorded; SF57 reads `needs pick (date)`, SF22 `open — blocked by SF57`, SF22c `open — blocked by SF22`; the grid stays Developer-only; never reported as a passed memory gate). Only Jake's yes turns M2-ready into M2. A -g row whose only open item is Jake's look approval counts as **prepared**: its
  new look stays behind its Debug row, and it unblocks the rows that depend on it (C2-R2-A1).
- **M3:** all seven shards at **80/20 by both measures**, grid-ready, with their compatibility checks green (transitional
  runtime listed per shard).
- **Part A also needs** (C3-R1-A8, B2, C8): SF55a and SF55 (the Blender Template; it gates neither M2 nor M3), SF56
  with Jake's pick, SF57, SF58 and SF59. The original seven keep their 80/20 target; the Blender Template is
  100 % public with zero runtime.
- Every "used today" system row landed with its consumer.
- **The frame floor held throughout** (§9.4).

Effort by milestone (agent-days, re-weighted 2026-10-04; C2-R1-C16; council 3's rows added, C3-R1-C16):

| | Total | Done | Left | Basis |
|---|---|---|---|---|
| M1 | ≈ 94 | ≈ 91 | ≈ 3 | the template proofs; the refreshed board and the 8 m entries left |
| M2 | ≈ 108 | ≈ 56 | ≈ 52 | menu, HUD, road and seams built; entries, Driftwood / Pine / Nalati -g, SF57, gates left (SF57b dropped, G171) |
| M3 | ≈ 174 | ≈ 22 | ≈ 152 | the shared systems (SF24 / SF27 / SF29 / SF30 …), not shard lines moved |
| Part A extras | ≈ 24 | ≈ 2 | ≈ 22 | SF55a, SF55, SF56 (picked and shipped), SF58, SF59 |
| Part A | ≈ 400 | ≈ 171 | ≈ 229 | ≈ 43 % (done not re-counted since 2026-10-04; C4-R1-C14 added ≈ 6 to M2 for Pine and ≈ 4 to M3 for the Sky Reach entries and the Nine Dragon lift) |

At ≈ 1–2 wall-clock hours of the fleet per agent-day, a 24–48 h window buys ≈ 12–48 agent-days. The target is M2-ready,
in this order: the deploy green → the M2 integration slice → SF8a / SF8c (admission, the entry contract) → SF46-g, SF47-g,
SF48-g prepared → **SF57**'s shipped-leg verdict (C3-R1-C5, C3-R2-C11) → SF22's gates on the Simulator →
the boards for Jake (C2-R2-C8).
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
- **FINISH-LINE**: its M1 (Jake, E423: CONTINUE + a shard map with progress on the title) moves inside the SHARD SELECT screen; the main menu stays the two cards (G132): progress on the carousel's main card and CONTINUE, no map or grid in SHARD SELECT (G133).
- **ANIMATION-REMASTER**: standard rigs and the clip library (S7); skinned assets in the format (SF9c).
- **PHYSICS-POLISH**: colliders move into tiles and per-shard worlds (SF9a, SF18a).
- **NATIVE-APPS**: the shells need the shardfile loader and the save scopes (SF15a).
- **DRIFTWOOD-REMASTER-V2, SIGNAL-DUNES, SKY-REACH**: conversion waits for those agents to be idle.
- **DEPLOYMENT_ASSET_TRIM**: tiles change the pack layout; its offline-reload gate holds (SF15a).
- **HUD (E332)**: SF28, S3 (the car and auto-path) and any HUD change go over herdr and to Jake.

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
  replies with its commit SHA. Up to **5 Codex panes** at once (amended to the running fleet, C2-R1-C14; browsers stay capped at 4 machine-wide; a Codex row that
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
- **Claude runs to 100 % (G109).** At **99 % of the weekly window** (G145) the coordinator stops dispatching, lets in-flight Codex rows finish, pushes
  them, writes the Handoff, then tells the Codex panes to stop; Codex keeps its 97 % pause (C2-R1-C15). The 5-hour window only pauses dispatch
  until it refills. After the weekly reset (Tue 2026-10-06 18:00 UTC) the coordinator, or a fresh session Jake starts,
  resumes from the Handoff (C2-R2-C9). Never buy or
  spend Codex credits or rate-limit resets.
- Claude is the scarce plan: council seats run as **two Codex seats + one Claude seat** from round 2; Opus subagents
  only for O rows and visual judging.

- Codex / Opus routing and openusage pacing: [SUBAGENTS.md](../process/SUBAGENTS.md) § Large multi-week plans (this plan is one).

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

**Councils 3 and 4** (E447, 2026-10-04; Jake: *"Didn't I say that we were going to do three to four councils? You can do
council three and council four."*) review the plan after G150–G162 and SF55–SF59, two rounds each, run by the plan-status
agent (herdr pane `wildshard-v`), which holds this file's edits while they run (the coordinator sends it plan changes);
the lanes keep building. Files in `shard-platform/reviews/council-3/`; fixes land as plan edits citing their `C3-R…` ID;
Jake's picks from them become §10 rows (G159–G162 from round 1; C3-R1-C12). **Council 3 closed 2026-10-04 after two rounds** (round 1: 38 findings, round 2: 26; all fixed except C3-R2-C1 and C3-R2-C7's remedy, `needs pick`); its round files are in `project/archive/2026-10-04-shard-platform-council-3/`. **Council 4 closed 2026-10-07 after two rounds** (round 1: 31 findings, round 2: 22; all fixed or decided by Jake as G185 / G186 / G208 / G209); its round files are in `project/archive/2026-10-07-shard-platform-council-4/`. **The four councils on the replan are done.**

**Council 2** (E441, 2026-10-04, three rounds at Jake's request) reviews the post-steering plan while the lanes keep
building; its files are in `shard-platform/reviews/council-2/` and its fixes land as plan edits (C2-R1-C21).

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

## Where things live

Everything in [`shard-platform/`](shard-platform/), beside this file:

- [STATE.md](shard-platform/STATE.md): the live status, calls for Jake and the fleet (coordinator only, ≤ 3 KB).
- [decisions.md](shard-platform/decisions.md): every decision G1–G399+ and the pre-grill picks Q1–Q5, verbatim; superseded rows marked.
- [rows.md](shard-platform/rows.md): §4 in full, Part A and Part B, with done-whens and evidence.
- [contracts.md](shard-platform/contracts.md): §3 in full (determinism, caps, the grid, versioning, a shard project).
- [history.md](shard-platform/history.md): the long State line, the council-time baseline (old §2), the pre-G291 measure and the 2026-10-04 Handoff.
- [design-system.md](shard-platform/design-system.md): the shardfile design system, the route for the rest of Part A (G319).
- [open-x-queue.md](shard-platform/open-x-queue.md): the open engineering (X) queue.
- [red-green.md](shard-platform/red-green.md): the push / CI / deploy red → green log (G330).
- [wall-clock-plan.md](shard-platform/wall-clock-plan.md): SF74, stop wasting wall-clock time.
- [kit-commons-audit.md](shard-platform/kit-commons-audit.md): the kit audit and the commons design (SF54 / SF26).
- [mockup-wave-E449.md](shard-platform/mockup-wave-E449.md), [mockup-wave-E450.md](shard-platform/mockup-wave-E450.md): the 2026-10-04 mockup and decision waves.
- [lanes/](shard-platform/lanes/README.md): the lane briefs; [reviews/](shard-platform/reviews/register.md): the four councils' registers (all closed).
