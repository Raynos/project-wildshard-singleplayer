# SHARD-PLATFORM — contracts (§3)

The full contracts, moved verbatim out of [SHARD-PLATFORM.md](../SHARD-PLATFORM.md) on 2026-10-13 (G375); the plan keeps a short summary. Section numbers (§0–§9) refer to [SHARD-PLATFORM.md](../SHARD-PLATFORM.md); its §4 rows are in [rows.md](rows.md), its §10 decisions in [decisions.md](decisions.md).

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
v0 caps cost 617 MB (×1.11 the caps' sum) → ≈ 917 MB with the base (over the first 850 MB envelope; G65 set it to 1.0 GB). So, constants beside
`CELL_*` in `@wildshard/engine/core/config` (C6, B13):

| | L0 tile (62.5 m) | L1 tile (125 m) | Far proxy (per shard) | Shard library | Shard sim (counted in the envelope) |
|---|---|---|---|---|---|
| Resident | **4 MB** | **2 MB** | 1.6 MB | 25 MB | **25 MB** |
| Download (compressed) | 0.3 MB | 0.2 MB | 1 MB | 8 MB | critical bundle ≤ **2 MB** (colliders + sim) |
| Triangles | 40k | 10k | 8k | — | — |
| Draws (instanced, **shadow draws included**) | 8 | 2 | 1 | — | — |

- Engine base 300 MB (Simulator-verified); envelope **≤ 1.0 GB playing** (the raw Simulator reading, WebContent + GL by SF22a's method, no factor applied: G71, C2-R1-B5/C5; Jake, G65: "Use your 1.0 GB rule",
  JAKE.md's Explorer limit); loading ≤ 1.8 GB; render scale 2×. v1 sums to ≈ 818 MB at the worst location, ≈ 180 MB under the envelope. **The format drops three.js's JS copies after GPU upload** (keeping them cost 357 MB
  at the rig). **Only a neighbour's L0 tiles within ~80 m cast shadows** (the sun pass took draws from 64 to 271); the
  shard you stand in keeps today's shadows until Jake has seen a board (G111).
- **Only the worst-location totals are hard caps: 1.0 GB playing and 1.8 GB loading** (G110, C2-R1-C22). The per-category numbers in the table (library 25 MB,
  L0 4 MB, sim 25 MB, 8 draws per tile …) are budgets that warn; a shard may trade one against another. A shard's look
  changes for memory only if it fails the total, and then as a variant sheet to Jake.
- **The road system** (boulevard, roundabouts, strips, rails, void) is budgeted tight on triangles and draws (G101):
  instanced, minimal props; `validate` and SF22 report it as its own category. **Warning targets** (C2-R1-A4/B8/C6;
  like every category they warn, G110): ≤ 150k triangles resident for the whole 3 × 3 platform, ≤ 60k drawn in any
  view, ≤ 16 draws per view with shadow draws included (C2-R2-C7), counting the boulevard, roundabouts, entry asphalt, strips,
  retaining faces, rails, signs, lights and the void. The seam is one adaptive render / collider mesh (`33e0192de`):
  native 256 / 257 boundary rows exact, interior triangles within 2 cm of height and ΔE 3 of the dense field;
  95,180 resident triangles default, 105,242 dev (`674629fef`). **Open:** split it per segment and junction so frustum
  culling works, with measured draws-per-view accounting against the ≤ 16 warning (C2-R3-B3, C2).
- **Freezing**: the only Simulator→phone pair on record (E264) is ×1.4, which would put the base near 420 MB and the
  crossroads near 1.3 GB. iPhone Safari exposes no memory number, so the caps freeze on the Simulator calibration (G71);
  a measured over-envelope total (G180 for Pine), a genuine residual SF57 retention failure or a tab kill in SF22c
  triggers the per-shard cut workflow: approved invisible cuts first, re-measured on the same WebContent + labelled GL
  ruler, then the remaining gap with real-capture options to Jake (C4-R1-B7); **the grid never reloads the page at a
  crossing** (G171; recovery reloads resume in the grid, G185); **any content cut goes to Jake**, per shard (G65): no
  automatic cut. The platform cap candidates (Jake, G65), cheapest first: three sims instead of four, 20 MB libraries, 3 MB L0 tiles.
- **G188, phone textures** (C4-R2-C8): a shard whose SF22a-method Simulator reading alone, from a cold Auto boot with images, exceeds 1.0 GB declares the phone texture policy `ktx2`; validate refuses such a shard without a complete KTX2 set; its declared `runtimeCost` is the KTX2 reading; a Debug pick wins; desktop Auto is unchanged.
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

| Mode | Select a shard **enters** (it still **shows** what it shows today: locked "Coming soon" cards and draft titles stay; R3-C11) | INFINITE WILDSHARD grid | Explore |
|---|---|---|---|
| Shipped | Driftwood Isle, Pine Hollow, Nalati Grasslands | 3 shards + 6 templates | — |
| Dev mode (Settings ▸ Developer) | every card, as today (Nine Dragon and the template included) | 5 shards + 4 templates | yes (from Select a shard) |
| DEVSERVER (build-time) | + Nine Dragon Stack, the template | + Nine Dragon at (+1, −1), on by default (its Debug row swaps it back to a template) | yes |

  The shipped dev-mode switch unlocks every experimental card, Nine Dragon included, and **keeps doing so**: Select a
  shard is the existing flow (Jake, G58), so SF21a does not narrow it (the coordinator reverted a narrowing, 2026-10-04). An assembly fixture covers each mode and both switches together.
- Placement lives in one platform grid file (`src/game/grid/singleplayer.json`), never in shard files (W6, B6). Template
  instances are one shardfile placed several times, each with its own save namespace keyed by its stable **instance id**
  (`template-1` … `template-6`; the cell is a separate attribute, SF14).
- **One landmass** (G72): the 3 × 3 and its strips are land; a shard's own sea stays inside its cell. **The outer edge** (G77): the outer ring is a road, and across it an infinite VR-space void, cheap to render, behind a collision wall (replaces the first open-sea empty-neighbour profile, C15).
- Pitch 555 m (N = 20 m, G37), tuned by SF22. Render origin rebases per cell (C39).
- **The main menu** (G58, renamed and redesigned by G79 / G88): a crossroads hero, the WILDSHARD logo, two big cards
  **SHARD SELECT** and **INFINITE WILDSHARD**, and SETTINGS; with Developer off, one wide SHARD SELECT card. Jake (G58):
  *"if loading the 3x3 seamless grid crashes the game on iphone with memory error I want to be able to go back to select
  a shard and the existing load one shard at a time flow."* SHARD SELECT is today's flow (its carousel restyled, G106) and
  where explore lives (behind the dev toggle). **The grid's code paths** (one frame, worker decoding, per-shard physics
  worlds) run only inside INFINITE WILDSHARD **through all of Part A**; SHARD SELECT keeps today's render path and
  switches only after Jake has played the grid (G64, R4-E2). The INFINITE WILDSHARD card shows only with Settings ▸
  Developer on until SF22's gates pass (G63). The one phone reading is Jake's normal grid playtest (SF22c, G71).
- **Entries, seams and edges (the contract `validate` and the strip generator enforce):** every shard is a 500 × 500 ×
  500 cube with **four entryways at its edge midpoints that meet the road at y = 0** (G93, G99), each a two-lane road 8 m wide (G131) carrying **15 m of
  the platform's asphalt into the shard**, drawn by the platform's entry socket while the shard keeps that 8 × 15 m
  footprint flat, clear and dry (SF8c, C2-R1-C3) (G103: the road's style is forced into the shard, never the reverse); a shard
  without them is illegal. Each road segment along a cell edge has one turn-in, at the midpoint: a plain T-junction with
  a green shard sign (G100). Outside the entries the engine blends the edge to the road by step size (G90: a ramp under
  6 m, a neutral retaining wall 6–14 m, the shard's own cliff + talus + rail past 14 m; G108 C2 for short runs);
  **The whole Driftwood world (island, terrain, seabed, sea, pier, boat, docks, jetties, props, spawns, colliders) is
  lowered 0.8 m together** so its sea sits at road level **in every mode** (G164, replacing G134's sea-only cut) (SHARD SELECT, explore and the grid, behind SF46's one Debug row until
  Jake's board yes; G147) (G134 / G164, replacing G91 / G113:
  water at +0.8 m put any road at 0 m under water). The shard clips its water out of each 8 × 15 m entry footprint so
  the swell never covers it, and the pier and jetty starts move inward past the 15 m socket (they start at the
  midpoints today, `manifest.ts:54-57`); nothing moves relative to anything else (one −0.8 m offset of the shard's world, G164). **An entry is either dry shard ground at y = 0 or a declared `socketOverWater` entry** (G170, C4-R1-B3): the platform supplies the y = 0 deck and collider, the water body's `dryEntries` names the clipped sockets, and the shard supplies the validated landing and route beyond the socket; ground flatness is waived only for that proved deck case; clearance, water clipping and traversal stay mandatory.
  **Shore rule** (C2-R2-B1, C2, C3, C6): where a shard's edge is seabed below 0 under a sea at 0 (≈ 92 % of Driftwood's
  edge), the strip does not descend (B = max(0, clamp(H, −1.5, 6)), so it stays at 0 to the cell edge), and the cell edge
  gets a low **dressed, coursed-stone revetment, crest +0.6 m** (G174; the earlier rip-rap appearance is superseded) (the swell's +0.4 m plus freeboard) in the retaining-wall stone,
  with a collider (G149); the sea's water clip sits at the revetment's inner face (one shared constant); no cyan drop wall
  crosses a shoreline, and the edge reader keeps a sea at exactly 0 (C2-R3-B1, C3). Where an edge
  can't blend (a cliff, a drop, an infinite void) the road gets the cheap cyan rail + grid curtain, 2.0 m high: a single
  jump can't clear it, a double jump or the hoverboard jump can (G99, G101, G108 C1). The **outer VR-void wall is closed
  at full height** (not the jumpable rail). A legacy shard without road-height midpoints meets the turn-in with a rail
  until it converts.
- **Safe zone, crossing and respawn:** the road and strips are a safe zone (G68, G78); the line is the **cell edge** (G130; the
  15 m of entry asphalt is inside the shard). Crossing stows a shard weapon and dismounts a shard's own mount (the Nalati
  horse); only platform mounts (the hoverboard) cross (G68, G126). A fall death respawns on the road until the player has
  really entered the shard: through an entryway, or ≥ 5 s on the shard's own ground and ≥ 20 m past the cell edge
  (G127, G129; the 5 s are continuous and the entry asphalt counts as the shard's ground, C2-R1-C8); after that the
  shard's own respawn applies. A fall below −60 m outside a cell, or below the cube's bottom (−250 m) inside one
  unless the shard declares a higher floor, counts as a fall death.
- **Crossing lines** (C2-R1-C9): one table of where each change happens.

  | Line | Where | What switches | Row |
  |---|---|---|---|
  | Cell edge | the 500 m cell boundary | safe zone, weapon stow, shard-mount dismount, HUD accent, title card, minimap mode, shimmer, combat permission, **who owns the frame** (the shard inside, the neutral road look outside, blended over 16 m; G158, G175) | SF20a, SF20d (G130) |
  | Physics re-frame | 6 m from the edge going in, 10 m going out | the motor's world | SF18a |
  | Speed ease | across the strip, deck edge → cell edge | 30 → 14 m/s | SF20d (G116, G117) |
  | Save wait | the safe transfer line before the re-frame | SAVING… / SAVE FAILED, RETRY; movement held until durable | SF20a (G119) |
  | Respawn lock | entry opening, or 5 s + 20 m inside | road respawn → shard respawn | SF20a (G129) |
- Dev mode changes apply at the next grid start (return to title), never live under the player (A17, C23).

### 3.4 Versioning (G29)

- One **`SHARDFILE_VERSION`** (0.x, bumped freely, G195) covers the format and the script ABI; the legacy `SHARD_API` stays for plugin
  shards until they're gone (B19, C24).
- The client loads the current version, and in Part A the previous one only for an offline-cached first-party shardfile
  (R4-N2, R3-C25); older ones show a "needs upgrade" card; their source and saves are untouched (A16).
- First-party shardfiles rebuild on every build. **A version bump is one commit** that migrates every first-party
  source and keeps saves (A11); `docs/SHARDFILE.md` gains the manual migration steps for outside authors until
  `wildshard upgrade` (S18) exists (D10).
- **No freeze: the format stays 0.x** (G195, Jake 2026-10-07: *"the short file format does not freeze. We don't cut version 1. You just cut version 0.1 and you keep bumping at 0.11, 0.12, 0.13 … we're nowhere near cutting a stable 1.0 … we can just keep making breaking changes"*). Every shard lives in the monorepo, so a breaking change bumps `SHARDFILE_VERSION` (0.11 → 0.12 …) and migrates every first-party shard and its saves in the same commit; no stable 1.0 in this plan. **The wire form** (C4-R2-B8): `SHARDFILE_VERSION` is a canonical string `0.<revision>` (the revision parsed as an integer, never a float); one commit updates the constant, schemas, SDK output, raw admission, product / cache readers and docs; reader compatibility names the previous revision explicitly; a bounded legacy integer-0 reader covers the first-party offline-cache transition; fixtures admit the current revision, allow the cached previous one only under the offline rule, refuse malformed or older versions.

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

- `@wildshard/sdk` is a fifth workspace package (`src/sdk`; its CLI may import the engine and game public exports).
  **The kit package dissolves into it** (G135, SF54): shared code becomes SDK systems and generators, shared assets become
  commons entries, and `@wildshard/kit` disappears. **The commons is a package** (G137): the shared assets and data
  every shard may use (models, rigs and clips, materials, sounds, species definitions, item and creature rows), versioned,
  shipped once and cached across shards, referenced from a shardfile with `commons:` (G6, SF26). Its form is **hybrid packs** (G138): build-time packs
  (creatures, npc, props, weapons, audio, icons, behaviour, authoring) plug into `wildshard build` and emit only
  hash-named content (models, clips, sounds, WASM, rows); no commons code runs in the game. **The import boundary** (G143, Jake: *"80% SDK-only, runtime/ no kit"*):
  shipped shard code outside `runtime/` imports only the SDK's **public surface** (headless-safe modules: no three.js, DOM
  or engine internals); `runtime/` may use the SDK's **trusted surface** (`@wildshard/sdk/runtime/*`) and, during the
  transition, engine / game modules, and its **transitive** import closure contains no kit or `@wildshard/commons` module
  (a `data/` file that `runtime/` imports may not import the commons; `runtime/` reads commons content only by hash through
  the SDK; C2-R3-C11); build-time folders (`generators/`, and data / quest
  authoring) may import `@wildshard/commons` and any author tool (G139). The layer guard enforces it with a ratchet that
  falls to zero as the ports land (C2-R2-A2, B4, C4).
- **Generators are any tool** (G150): a shardfile never contains a generator, only its baked output; generators may be
  AI mesh models (TRELLIS, Hunyuan3D), Blender scripts, Python, Rust, Go or hand modelling. Today's shards are three.js
  TypeScript, so for them the cheapest path is running that code at build time and baking it.
- **What a shardfile may carry** (G146): data and AssemblyScript (WASM), plus baked assets. Migrations, hooks and
  anything else that runs are data or AS, never TypeScript; a domain-specific language is welcome if it compiles to
  data or WASM under the same constraints. `runtime/` is the temporary exception this plan allows.
- `wildshard build` writes `public/shardfiles/<slug>/` (git-ignored). `pnpm build`, the push gate and Vercel run it for
  every shard. `gen-shards.mjs` and `slugs.generated.ts` read the grid file.
- `wildshard dev` is **rebuild-and-serve** (watch → build → static serve → reload), not Vite HMR, so it fits MACHINE.md
  (B18).
- Outside authors get the SDK as `pnpm pack` tarballs plus a prebuilt client bundle, installed by `file:`. The toolchain
  is JavaScript-only (asc + a binaryen.js fuel injector), so no Rust is needed (C10).
