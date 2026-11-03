# Custom sections to one generic platform (E498)

**State:** `in progress` 2026-11-03 — **goal: custom sections at ZERO through generic, high-quality hosts** (Jake,
2026-11-03). Today **342** (4 `custom/` + 338 named JSON, 30.6 MB; gate measure at `2ec2da8a9e`). CS0–CS10 closed
their *disposition* (slices plus named exits); those exits are **not** an ending any more. The open work is the
**zero rows Z0–Z15** below (one row per host, ~45 lane-days, ~29 Opus / ~16 Codex); the count and evidence are in
the [zero spike](custom-sections-zero-mini-spike.md). A Z row is done only when the gate's count drops by its kill
count with identical pixels (Opus rows) or identical bytes (Codex rows). Jake rules first on decision 6 (what zero
counts). Non-graphics rows run on Codex (G963 / G969); graphics rows stay Opus (G848); no WASM-HOST work (G969).
Phase HA7 of [HOST-AUDIT](../HOST-AUDIT.md) (G697); direction G696 ([decisions](../shard-platform/decisions.md)).

**G988 (Jake, 2026-11-03 ~08:35):** zero = no `custom/` section and no named JSON outside a registered shared file type. **Codex lanes only**: every Z row marked Opus runs on Codex under a pixel-identical bar (G958); no Opus lane works this plan.

Jake, 2026-11-03: *"all the custom sections have to be removed … they all have to be generic, high-quality hosts in
the engine … the goal is to get custom sections to zero."*

History: the original audit (2026-10-24) was read-only at HEAD `6b7dd7ebd6`: source greps, the built Pine and Far
products and the push gate's measure (`.git/custom-section-measures/dcff0904cd….json`); per-kind numbers ±10 %.

Jake, 2026-10-24 (E498): *"I read about those custom sections. Those are absolutely horrible. I didn't know we had
custom sections at all. We don't want custom sections. We don't want one-shot custom sections. We want a generic
platform, and we want each one of those to be rewritten to fit in the generic platform. Like the shard file should be
generic or high level. Everything in the platform should be generic. And we need a plan or a massive section inside
host audit, because maybe the answer is that, you know, the host audit is going to solve it. Maybe the host audit
already flagged half of them, but any section that's custom is clearly wrong, right? … We should be having one generic
format for everything, and some of those custom sections may have to be evicted to WASM. Like, each one of the platform
hosts that goes along with the custom section would have to get rated as per the host audit, and some of that stuff
was going to have to get evicted to WASM, and I might pull in the WASM v2 plan, like all of that stuff."*

## Findings

**1. There are 387 "custom sections", not ~550.** The 549 in G696 is the sum of the ratchet *ceilings*
(`lint/ratchet.json` `custom-sections/<slug>/count`). The exact measure at `dcff0904cd`:

| Shard | Ceiling (count / bytes) | Measured (count / bytes) | of which `custom/` sections |
|---|---|---|---|
| Pine Hollow | 236 / 15.9 MB | **234 / 10.6 MB** | 10 |
| Driftwood Isle | 58 / 3.4 MB | **53 / 3.1 MB** | 5 |
| Nalati Grasslands | 80 / 24 MB | **46 / 12.4 MB** | 0 |
| Nine Dragon Stack | 140 / 16 MB | **19 / 4.6 MB** | 0 (`SECTIONS = {}`) |
| Far Reach (Sky) | 19 / 2.9 MB | **19 / 2.9 MB** | 0 |
| Sunscar (Signal) | 16 / 0.08 MB | **16 / 0.08 MB** | 0 |
| **Total** | **549 / 62 MB** | **387 / 33.6 MB** | **15** |

CS0 keeps those historic measured ceilings. Its existing-name freeze is
from the exact `eec878c1f4` built inventory: 472 identities / 36,459,508 B
after source-generation changes. It grants no higher count/byte ceiling;
the existing exact-base rule still governs holding or shrinking excess.

Templates, open plots, Pastel Plain and Ink-Cel Valley are 0. Legacy shards use neither (`custom/` or `nameBlob` appear
in no `-legacy` file), so nothing here touches custom-code wave 3.

**2. Only 15 are real `custom/` sections; 372 are named JSON blobs.** G496 counts every named JSON blob
(`nameBlob(name, 'json', …)`, read by `product.json(row.file)`) as a custom section so private data can't hide behind a
blob name (`scripts/shard-platform-output.mjs` `productSections`). The 15: Pine `questRuntime` (41 KB), `thrallLook`,
`nativeView`, `grazers`, `trophyMounts`, `paintedTextures`, `cabinAmbience`, `cabinAppearance`, `runtimeGraphs`,
`kingKit`; Driftwood `enemyPlacements`, `collections`, `cumulusPuffs`, `fixedLayouts`, `gullFlock`. All already have
an exit row in `shard-platform/open-x-queue.md` W2 (`shardfile/custom-sections` exceptions in the ratchet).

**3. ~90 % already use a shared `@wildshard/format` schema; ~40 are truly shard-shaped.** Each producer attaches its
defining schema (G491J). About 345 blobs name a format schema (`WorldSceneSchema`, `WorldScenePlacementSchema`,
`QuestStorySchema`, `PackedCreatureLooksSchema`, `HeldBowFileSchema`, …). About 40 are shard-shaped: the 15 `custom/`
sections, Pine's `FILE_SCHEMAS` (`spots`, `cabins`, `physics`: `PinePhysicsSchema` though platform `world/physics`
exists), Driftwood's inline `quests/discovery`, `world/building-life`, `directors/main`, `poses/monkey`,
`models/fixed-geometry`, `sim/enemy-placement`, Nalati's ~4 inline objects, and Nine's `weapons/jian-cloth` /
`jian-halo` (raw three.js `toJSON()` geometry, no schema), `jian-row`, `signs/atlas-*` (`SignAtlasSchema` in Nine's
folder), `geometry/fixed-kits`. **A format schema is not proof of generic**: HOST-AUDIT's ruler skips `src/format`
(finding 5), so a one-user schema such as `forestWeather` or `forestPage` sits in format for free. The real test is a
schema with ≥ 2 shard users, or a Jake-approved G571 one.

**4. The per-kind picture.** Bytes "≥" are measured from the built Pine / Sky products; the rest is inside the
shard totals.

| Kind | Sections | Shards (count) | Bytes | Reading hosts (inventory groups) | Audit coverage | Target |
|---|---|---|---|---|---|---|
| K1 Scenes, placements, dressing, model catalogues | ≈252 | P 184 (placements 112, cabins 64, 4 tier/shadow copies), DW ≈20, 9 ≈14, Sky 18, Sig ≈15, N ≈8 | ≥ 3.4 MB | H015, H016, H023, H061, H062, H090, H098; `sceneSources` / `sceneDraws` / `sceneDressing` | hosts listed (keep); `sceneDressing` borderline in plan examples; blobs not listed | **a** `world/scenes` streamed family + `models/library`; tier copies **c** (derive at load) |
| K2 Ground, fields, physics bakes | ≈7 | P 4 (floor 5.9 MB, crag-cave 0.9 MB, physics 0.9 MB, cave), Sky 1 (fields 2.4 MB), Sig ≈2 | **≥ 10.1 MB (30 %)** | H087, H088, H089, H093, H094, `engine/physics` | hosts keep; blobs not listed | **a** existing `world/physics` + new `world/fields` (streamed) |
| K3 Quests, story, chapters, trade | ≈32 | P 15, DW 11, N 6 | ≈0.2 MB | H004, H021 fold, H032 fold, H036, H038, H041, H079 fold, H084 fold, H092 | **partly flagged** (4 folds) | **a** `quest/*` family (story, steps, chapters, achievements, trade, persistence); Pine `questRuntime` program **b** |
| K4 Creatures, herds, populations, directors | ≈32 | P ≈11 (roster 250 KB), DW ≈13, N ≈8 | ≥ 0.35 MB | H007, H008, H013, H018, H055, H058, H075 fold, H100, H101, H107, H111 fold, H112, H113 | hosts listed; 2 folds | **a** `actors/species` + `actors/populations`; keeper, return programs, spawn streams, director rows **b** |
| K5 Held kits and weapons | ≈11 | P 3, N 5, 9 3 | < 0.1 MB + Nine's three.js JSON | H012, H048, H059, H091, H105 | hosts keep; not flagged | **a** `held/kits`; Nine jian cloth/halo **c** (ship GLB via model library), jian effects **b** (H9) |
| K6 Looks, textures, trophies, collections, sky | ≈10 | P 5, DW 2, N 3 | ≈0.05 MB | H001, H006, H050, H106, `models/collectionDisplay` (P + DW) | hosts keep; not flagged | **a** existing post-graph / sky / atlas rows + one `collections/displays` |
| K7 Weather, ambience, water, audio | ≈12 | P 6, N 6 | ≈0.02 MB | H022, H051, H052, H077, H078; the forest family | **flagged** (forest family borderline) | **a** `world/weather` + `audio/scenes`; `forest-weather` (Pine name, Nalati user) folds |
| K8 People, figures, props, places | ≈12 | P 6, DW 4, N 1, Sig 1 | ≈0.15 MB | H028, H039, H055, H073 fold, H082, H083 | partly (H073) | **a** `people/figures`, `world/places`, `world/props` |
| K9 Combat rooms, bosses, encounters, riding | ≈8 | N 7, DW 1 | small | H043, H064–H071, H102, H103, H109, H110 fold | partly (H110) | **a** room / encounter / riding-profile rows; Titan fight script **b** |
| K10 Headless sim, runtime plans, native views | ≈11 | `sim/headless-assembly` ×4 (P, DW, N, 9), N boot, 9 constants, DW returns, P `runtimeGraphs` + `nativeView`, Sig runtime plan | ≥ 0.08 MB | H005, H017, H024, H029, H034 fold, H063 fold, H072, H076; `sdk/headlessRuntime` | hosts listed; blobs not | **c** headless assembly derived from the platform sections; views and graphs **b** (WASM-HOST H9 / H17) |

Near-duplicates, the clearest case for one schema: `sim/headless-assembly.json` in four shards;
`quests/page-composition`, `achievements`, `chapter-director`, `stall`, `services` in Pine and Driftwood;
`quests/persistence` and `panels` in Pine and Nalati; `world/forest-weather` in Pine and Nalati; `people/catalogue` in
Pine and Driftwood; `models/world-scenes.json` in Pine, Driftwood, Nine; `world/scenes/*` + `world/sources/*` +
`world/fields*` in Sky and Signal (same painterly scene family); `directors/main.json` in Pine and Driftwood.

**5. HOST-AUDIT covers the readers, not the data.** The accepted inventory (114 groups) names **0 of the 387**
sections; it lists hosts. About 60 of its 114 groups read one of K1–K10, and of those **10 are already "fold"**
(H021, H032, H034, H063, H073, H075, H079, H084, H110, H111) and the forest family / `sceneDressing` are "borderline"
in the plan's examples. So the audit already flags the coupling for K3, K7 and parts of K4, K8, K9, K10 (roughly
**70 sections, ~18 %**); the other ~317 (K1, K2, K5, K6: the bulk and the bytes) sit behind hosts the audit
recommends keeping, and its ruler never looks at the blob or its format schema. HA0 (e) "charge `src/format`" is the
hook: extend it to charge a section's or blob's schema to the shards that emit it.

## The target: one generic format

- **End state:** a shardfile holds only platform sections (one shared schema each, in `@wildshard/format`,
  registered in `platformDataSections`) and binary blobs (GLB, KTX2, bin, wasm). No `custom/` prefix, no shard
  `SECTIONS`, no shard `FILE_SCHEMAS`, no JSON blob whose schema lives in a shard folder or has one shard user without
  a Jake-approved G row. `custom-sections/<slug>` ceilings are 0 for every shard, then the check is deleted.
- **(a) generic platform section** for data that is the same concept in two or more shards (K1–K3, K5–K8, most of
  K4 / K9): one schema, streamed by id where it is big (`world/scenes`, `world/fields`).
- **What zero counts (2026-11-03, decision 6):** no `custom/` section and no named JSON outside a **registered
  platform file family** (a name pattern → one `@wildshard/format` schema with two shard users or a Jake G row, read
  by a host that scores 6/6). Streamed pages stay separate files: sections load eagerly, and inlining 30 MB would
  break the 1.2 GB phone budget. The build refuses anything else; `custom-sections/total = 0` is the ratchet.
- **(b) evict to AssemblyScript** for data that is really behaviour (spawn streams, keeper / return programs,
  quest runtime programs, Titan fight script): an AS module on **today's Script ABI** (`sim/scripts`, 10 Hz) plus
  generic rows. G969 bars WASM-HOST work, so H6 / H8 / H17 are not assumed; a program that truly needs a per-frame
  lane is raised as a blocker, never kept as a private section.
- **(c) delete** what is derived or duplicated: tier / shadow copies of cabins (4 files, 0.34 MB), per-shard headless
  assemblies (derive from the sections), meshes and buffers in JSON (Jian cloth, sign atlas, Nine layout, Titan
  geometry, cloud specimen, weather fx: ship as GLB / `.bin` with row headers).
- **Rating:** every reading host is scored on HOST-BAR's six tests by HA2's fresh seats before its section moves; a
  fail goes to HA4a/b (back to the shard as data or AS), never a renamed TS file.

## Rows (phase HA7 of HOST-AUDIT)

| Row | What | Effort |
|---|---|---|
| **CS0** | **done (2026-10-24, sp-x6):** measured ceilings 387 / 33,613,009 B; shrink-only existing-name inventory, new custom sections refused, new named JSON requires an exact defining format schema. **Ceilings to actuals and a schema freeze** (free, can land now): set every `custom-sections/<slug>` ceiling to the measured value (549 → 387, 62 MB → 33.6 MB); refuse a new `custom/` section and any new named JSON whose schema is defined in a shard folder | 0.5 day, Codex |
| **CS1** | **done (2026-10-31, sp-x1):** `9a616b4b82` inventories all 24 products in 4.56 s: 1,406 rows / 11 source projects; six inventory controls pass. `b13ad77350` fixes exclusive compiler ownership, with the original owner assertion, six controls and root/scripts types passing. Hash-bound source/reader evidence stays explicit; no ruler or inferred host credit. | 0.5–1 day, Codex |
| **CS2** | **done (2026-10-31, sp-x1, Jake's slice-or-explicit-exit ruling):** all remaining families have a qualified exact slice or a concrete named CS3–CS9 / index-footprint exit. The [completion evidence](#cs2-completion-evidence) binds every family to its per-name source table and landed proof. The 62 welds, eight living envelopes and Pine spray companion remain explicit exits; no cap, host, capture or CS10 deletion credit is inferred. | 2–3 days, Codex + Opus review |
| **CS3** | **done (2026-11-03, sp-x2, qualified-slice-or-named-explicit-exit bar):** Pine112 and DW12 have qualified bounded-page slices; catalogues/recipes retain exact render-input proofs and Nalati dressing retains twelve zero-pixel comparisons. All 318 historical rows and the expanded remainder have a qualified slice or named **CS3-E1–E13** exit in the [completion ledger](#cs3-completion-bar-and-named-implementation-exits). Tier/shadow derivation remains source-only. **Disposition only: every CS3 exit is now built by a Z row** ([exit → host map](#exits-become-host-rows)). | 3–4 days, Codex (Opus memory reading on Pine) |
| **CS4** | **done (2026-11-02, sp-x1, landed-slice-or-recorded-exit bar):** the five field descriptors, common Pine physics, floor/cave contracts and two ground aliases have their recorded exact payload/native proofs; maintained Pine walk is **75/75, 0 stuck/bounds/pending**. Pine owner-only physics, G667 tests 2–6 and the named terrain/bake/shelter/recipe/grid-collision owner configurations remain explicit exits, without host or CS10 deletion credit. See the [completion bar](#cs4--cs7-completion-bar). | 2–3 days, Codex (Opus memory reading) |
| **CS5** | **done (2026-11-02, sp-x1, Jake accepted `9507499224`):** eight historical quest names now have qualified exact slices: the earlier DW three, Pine native-story/native-spots/contracts, Nalati carried and the shared whole-panel catalogue. The one fresh-baseline combined proof retains all target bodies, 226 old wire contracts and original owners; only the exact G872 Nalati source-stamp case differs (self-applied under the 2026-11-02 standing rule, with explicit concurrence). Six presentation/figure/discovery/finds/story/guest families and live `custom/questRuntime` retain their explicit exits, without host or CS10 deletion credit. See the [qualified slice](#cs5-four-native-aliases-and-the-whole-panel-catalogue). | 4–6 days, Opus design + Codex port |
| **CS6** | **done (2026-10-31, sp-x6, Jake's slice-or-explicit-exit ruling):** the 55-row baseline and four additional actor names have qualified exact slices or concrete complete-contract/native-check/context exits. Directors, keeper/returns, roster/elites and the duplicate grazers retirement are recorded below. Existing native controller/AS owners stay authoritative; no host-score or CS10 bridge-deletion credit is inferred. See the [completion evidence](#cs6-completion-evidence). | 4–6 days, Opus + Codex |
| **CS7** | **done (2026-11-02, sp-x1, landed-slice-or-recorded-exit bar):** audio/cards `2c5aa6386d` / `515ffcac96` have normal/strict6 and exact original payload/owner proofs. Every remaining logical name is in the 25-row source table: ten native-root qualification exits and fifteen complete-contract/model/binary/owner/collision exits. No byte rewrite, host score, weather union or CS10 deletion follows. See the [completion bar](#cs4--cs7-completion-bar). | 4–5 days, Codex |
| **CS8** | **folded into Z14 (2026-11-03):** K9 combat and riding: room, encounter and riding-profile rows; Titan script to AS | see Z14 |
| **CS9** | **done (2026-11-02, sp-x1, exact-slice-or-explicit-exit bar):** eight defining-payload derivations reconstruct all old canonical bytes; 36 original cases pass across eight suites. The complete 69-field ledger accounts for eight qualified derivations and 61 explicit owner/contract exits; Pine’s scaffold is retired and the other three shells have explicit source/schema/witness exits. The exact Nalati source-stamp case is self-applied under G872, with raw refusal retained. No CS10 deletion or host credit follows. See the [completion proof](#cs9-exact-constant-derivations-and-completion-bar). | 2–3 days, Opus (after WASM-HOST H9, H17) |
| **CS10** | **done (2026-11-03, Codex takeover from sp-x1/sp-x9, exact-slice-or-named-explicit-exit bar; G872 self-applied):** ten redundant copies retain their landed exact payload/native/pack proof and 29 original cases. The four live envelopes and shared reader/emitter/validation/policy paths had named **CS10-E1–E6** exits in the [completion ledger](#cs10-completion-bar-and-named-implementation-exits). **Superseded 2026-11-03: no KEEP survives; E1–E6 are built by Z0, Z1, Z7, Z8 and Z15** ([exit → host map](#exits-become-host-rows)). | 1 day, Codex |

### Zero rows: one generic host each (2026-11-03)

From the [zero spike](custom-sections-zero-mini-spike.md): 342 today, every row assigned once. **Bar for every Z
row:** the gate's count (`outputSections`, same as `scripts/section-inventory.ts`) drops by the row's kill count;
Opus rows show zero-pixel A/A + A/B captures of every affected pose at both tiers plus no-worse loading; Codex rows
show identical payload bytes; collider changes walk 0 stuck. The reading host is scored on HOST-BAR's six tests
(fresh seat) before its family registers; a fail folds back as data or AS, never a renamed TS file. A named exit
does not close a Z row.

| Row | Host: what it is | Kills (sections) | Lane | Days |
|---|---|---|---|---:|
| **Z0** | **done (2026-11-03, sp-x1; `e7ce1f2ba0`).** Pine 123 → 122, −8648 B; all 59 retained sections and 877 files exact. Five ceilings shrink; Nine never rises. **Ceilings to actuals and a dead section.** `custom-sections/<slug>` to measured (DW 48, Pine 123, Nalati 45, Far 19, Sun 16; record Nine at 91 / 10.9 MB, 72 over its 19). Delete Pine `custom/nativeView`: no `src/` reader and no emitted row names it; only `test/fixtures/pine-headless.ts` and Pine generators touch it | 1 (`custom/nativeView`) | Codex | 0.25 |
| **Z1** | **done (2026-11-03, sp-x1; `890d8f05ce`, `4ac0585b6f`; G941 exact-pair capture ruling).** Nineteen shared grammars remove exactly 98 baseline files / 2459046 B. Fresh-seat sp-x8: 6/6; 52 focused cases and format/SDK types green. All 187 runtime JS/CSS assets and Pine/Nine payload/pack inventories exact (build metadata only). Pine 18 Metal frames / 12 raw-zero comparisons, both tiers. Nine canonical P1 uses only the existing approved (569,1139) RGBA pair; the extra-frame experiment at (627,1271) stays refused and grants no allowance. **Platform file families.** A registry in `@wildshard/format` beside `PLATFORM_DATA_SECTIONS`: name pattern → one format schema. The measure counts a named file only if its family is unregistered. The census follows emitted routing rows so every family has a known reader | 98 already on a shared schema: placement pages 12, scene recipes 42, scene buffers 9, world-scene models 3, quests 19, actors 9, people catalogue 2, forest weather 2 | Codex | 2 |
| **Z2** | **Done (2026-11-03, sp-x8): `9a3952f83c`, `a2a0e604ff`; ratchet `a131158d0c`.** Nine streamed placement pages and complete cast/fabric weld roots; byte, refusal, strict capture and golden qualification below | **72 removed:** 70 placement files + `world/casts`, `world/fabric`; Nine custom count **82 → 10** | Codex (G958) | 2.5 |
| **Z3** | **Pine 68 landed `c98d1cffe0` (2026-11-03, sp-x1); DW 2 remain charged for the one-user batch.** Sixteen bounded family pages reconstruct all 68 original Pine graphs byte-for-byte; Driftwood's trader is the second whole-page user. Fresh-seat sp-x2: 6/6. Native payload 1,733,628 → 1,419,651 B; page schema definitions save 302,816 index bytes. G998: Pine and Driftwood 24/24 green in Chromium and WebKit on `d4c2e8d15d-mw0u2vw4`; Pine 11/20 are verified moving native animals. Four reviewed boards are under `art/golden-runs/pine-hollow/` and `art/golden-runs/driftwood-isle/`, named `2026-11-03-d4c2e8d15d-z3-board.jpg` and `2026-11-03-d4c2e8d15d-z3-webkit-board.jpg`. `BakedPlacementPlanSchema` has only Driftwood as a complete emitter (`sets` and `smallRocks` included): both `world/island/plan-{phone,desktop}.json` remain custom pending Jake's batch ruling. **Streamed scene pages: Pine cabins and DW island.** Specimens and living roots become pages; tier / shadow variants derived at load | 70: Pine specimens 56, living 8, tier/shadow copies 4; DW `world/island/plan-{phone,desktop}` | Opus | 4.5 |
| **Z4** | **In flight (2026-11-03, sp-x9), 0/13 removed.** The complete-root census below names 13 single-user/envelope blockers for Jake’s one-user batch; no shared-family registration or AS rewrite is qualified. **Populations.** `actors/species` + `actors/populations` (`game/population/*`); keeper, return and spawn programs as AS | 13: DW projection, creature-install, poses/monkey, keeper, returns, enemy-placement; Pine roster, elites, shelter; Nalati sheep, wildlife, population-metadata, taming-poses | Codex (+ Opus poses) | 3 |
| **Z5** | **Done (2026-11-03, sp-x2): `92f8a2e671`, `c9ae94288f`; strict proof and G872 acceptance below.** Complete bake/model envelopes shared by Far + Sun, native full-root admission before publication; fresh sp-x1 HOST-BAR 6/6 for each family. Delete the zero-reader Sun effects duplicate | **6 removed:** Far sources bakes/heroes/sky; Sun sources bakes/models, places-effects; custom counts 3→0 each | Codex | 1.5 |
| **Z6** | **In flight (2026-11-03, sp-x8): exact native-type/user audit and byte-preserving transport.** Weapon pages into `held/*`; Jian cloth / halo ship as GLB. One-user complete contracts go to Jake's G988 batch; G958 parity, G998 goldens and held-view captures required | 10 targets: Nalati bow-page, rifle-model, rifle-page, sabre, spear, held/slots; Nine jian-cloth, jian-halo, jian-row; Pine loadout/finishes | Codex (G958) | 3 |
| **Z7** | **Model library.** One specimen / fixed-draw / collection book (`game/models/{islandLibrary,fixedDraws,collectionDisplay}.ts`, `SpecimenBookSchema`) and a generic atlas row over the KTX2 that ships | 14: DW **`custom/fixedLayouts`**, **`custom/collections`**, fixed-geometry; Nalati cover ×2, gear-book, shape-book, cloud-specimen; Nine fixed-kits, layout, held-cards, sign atlas ×2; Pine cover-appearance | Opus | 4.5 |
| **Z8** | **Eligible slice done (2026-11-03, sp-x9), 2/14 removed.** Exact shared ChapterStoryPresentation family (6/6, real complete Nalati/DW/Pine users), plus the 149 B reader-less DW steps deletion `98bab03828`. Original native owners and all Pine bytes remain; all six shards qualify 24/24 Chromium + WebKit through the shared cohort, with Nalati re-shot after QD11. Twelve per-file blockers / 93,379 B below remain charged for the one-user batch; Pine lead already runs as AS. | 14: Pine **`custom/questRuntime`**, native-spots, native-story, contracts, forest-story; DW discovery, interaction-source, hints, steps, wake-boss; Nalati carried, chapters, content, finds | Opus design, Codex port | 4.5 |
| **Z9** | **Five dead copies retired (2026-11-03, sp-x2); four live Nalati files remain charged for Jake’s one-user batch.** Pine’s two prop JSONs and Nalati support pages 2/3/4 have no reader or routing reference. G872 approved deletion removes 397,308 B; all unrelated 242,316,656 B and 122 ordered packs verify exactly, with only the independently reconstructed Nalati map source stamp attributed. Strict native 48 frames / 16 A/A + 16 A/B all zero. Pine and Nalati each 24/24 green in Chromium and WebKit; actual builds, four boards and per-file retained-root evidence [below](#z9-dead-copies-and-four-real-one-user-roots-2026-11-03-sp-x2). No fabricated Pine scatter user or new platform-family credit | **5 of 9 retired; 4 charged:** Nalati dressing-pages 0/1 and dressing-{phone,desktop} | Codex (G958) | 3 |
| **Z10** | **People and places.** Into `people/figures` / `world/places` | 3: DW people/cards, building-life, cover-composition | Codex | 1 |
| **Z11** | **In flight (2026-11-03, sp-x6): candidate reduction 5; three one-user roots stay charged. G998 qualification pending; evidence below. Weather, audio, look.** `world/weather` + `audio/scene` families (`game/weather/forest.ts`, Pine + Nalati); post look into the G599 post-graph platform | **5 eligible:** dead Pine ambience, Pine + Nalati weather, Nalati audio/scene and look/post. **3 charged:** Nalati weather-fx; Pine rain and weather-observations | Opus fx, Codex audio | 3 |
| **Z12** | **In flight (2026-11-03, sp-x2): census 1 dead / 8 live.** G872 approves deleting only unread Pine landmark-view (5,510 B); byte/pack/native/G998/physics-walk qualification pending. Eight complete live files remain charged with [per-file evidence](#z12-census-ground-roots-and-one-unread-copy-2026-11-03-sp-x2). Far/Sun SceneBuffers are real shared fields but a different whole root from Pine floor/cave/forest and Nalati geography/water; no fake field-root credit | **1 candidate; 8 charged:** Pine floor, crag-cave, cave-interior, forest-page, building-sites, physics.generated; Nalati meadow, water | Codex (G958) | 3.5 |
| **Z13** | **Headless derivation.** The worker derives its assembly from the shipped sections (`sdk/headlessRuntime.ts`); the files are deleted. **In flight (2026-11-03, sp-x6): 0/6 files deleted; qualified Driftwood duplicate-field cut below. Nine held for sp-o1's live-wall RCA; prerequisite semantic owners recorded below.** | 6: `sim/headless-assembly` ×4, Nalati headless-boot, Nine headless-constants | Codex | 2.5 |
| **Z14** | **In flight (2026-11-03, sp-x1): census one approved unread copy / nine live one-user roots.** G872 approves retiring Nalati ride/rules (31,569 B); body/pack and strict native parity qualified, G998 pending. The original CS8 cloud specimen plus the added Pine ranged page make ten files in the union; cloud overlaps Z7. Titan decisions already compile from shard AS. [Per-file hashes, routes and exact scope below](#z14-census-encounters-riding-and-one-unread-copy-2026-11-03-sp-x1) | **1 candidate; 9 charged:** Nalati room-entry, timed-encounters, titan-fight, titan-geometry, cloud-specimen, riding/session, mounted-figure; Pine combat/roaming, client/ranged-page | Codex (G958) | 4.5 |
| **Z15** | **Delete the custom path and lock it at 0.** Delete shard `SECTIONS` and both `runtime/productSections.d.ts`; the custom branches in `sdk/outputRuntime.ts`, `sdk/outputProduct.ts`, `game/shardfile/shardProduct.ts`, `clientPlan.ts`, `game/quest/{pageComposition,continuation,chapterDirector,questPageViews}.ts`, `game/models/{islandLibrary,kitFigureCard}.ts`; shard-built inline schemas; `scripts/custom-section-policy.mjs`, `scripts/check-custom-section-growth.mjs`, `lint/custom-sections.json` and the per-shard ceilings. Output admission refuses any `custom/` name and any unregistered named JSON; one ratchet row `custom-sections/total = 0` | the path itself; count stays 0 | Codex | 1.5 |

Kills: 1 + 98 + 72 + 70 + 13 + 6 + 10 + 14 + 14 + 9 + 3 + 8 + 9 + 6 + 9 = **342**. Z0–Z3 remove 241 (70 %) in
~9 lane-days. Rows are numbered in build order (most sections per lane-day first); Codex takes Z1, Z4, Z5, Z13 at
once while Opus starts Z2.


### Z4 complete-root preflight (2026-11-03, sp-x9)

**0/13 removed; 13 remain charged.** G988 requires two real users of the
complete registered type. The existing G571 native-host receipts and the
CS6 defining-schema registrations do not establish a second emitter of
these complete documents. Fixtures, nested shared schemas and an absent
`jsonSchema` are not additional users. The source trace and six-product
file census find no second complete-root emitter for any target below;
none even has an identical top-level field set in another product. A
union of these private envelopes would not be a shared population host.

The ordinary `outputSections` census still counts all 13 targets:
Driftwood **6 / 194,166 B**, Pine **3 / 278,434 B**, Nalati **4 / 261,050 B**;
total **733,650 B**. Every body length and SHA-256 matches its existing
product manifest. These are inspected on-disk products, not a fresh
CURRENT build or a new native/pack/pixel parity qualification. No body,
metadata, registry, host attribution, ceiling or guard changes accompany
this preflight. G998 end-to-end qualification and any Z4 look-sensitive
landing wait for the QD1 browser-priority hold to lift.

| Target (whole file) | Bytes | Complete owner and exact-port blocker for the one-user batch |
|---|---:|---|
| DW `actors/projection.json` | 86,103 | `format/populationProjection#PopulationProjectionSchema` → `game/population/projection#PopulationProjection`. Only DW emits the whole page/practice/hold/volley/effects/light root. Preserve authored seed, hold-floor dimensions, stream order, native body loans and presentation allocation. |
| DW `actors/creature-install.json` | 345 | `format/speciesLooks#CreatureInstallSchema` → `game/population/productCreatures#installProductCreatures`. Only DW emits the complete perch/practice/projection/packed/hulls/lent install root; preserve read order and every retiring-owner fence. |
| DW `poses/monkey.json` | 81,562 | `generators/namedSchemas.ts` composes the exact two-clip tuple, ReturnProgram and mixed-population perch fields. `PerchBodyBinding` owns native/page guest admission and pose execution. Shared NumericPose children do not qualify this sole-user whole envelope. |
| DW `sim/keeper.json` | 15,874 | `PopulationKeeperRowsSchema` retains environment, bodyPhase, volley, ecology, fauna, variants, herds and bodies. The demonstrated native consumer is still `test/fixtures/native-hosts/population/mixedRoster.ts#installMixedPopulation`, not a new production host. Preserve body/recipe joins, original native identities and RNG; a new keeper guest descriptor would change the required bytes. |
| DW `sim/returns.json` | 1,710 | `PageReturnRowsSchema` → `game/population/pageReturns#installPageReturns`. Only DW emits this full rules/outOfSight/program/water/fixed/step root. Its `driftwood.returns` decision already compiles from `behaviour/returns.as`; retain module/loan identity, reverse queue order, eligibility, final land query and spawn draws. |
| DW `sim/enemy-placement.json` | 8,572 | `generators/sections#EnemyPlacementsSchema` is the exact page + native placement root, with bounded native kinds, stream state and BodySlots. Projection and keeper each contain partial inputs, not this whole value or an honest second user. |
| Pine `actors/roster.json` | 250,356 | `NativePopulationRowsSchema` plus `parseNativePopulationRows` → `game/population/roster#installPopulationRoster`. Only Pine emits the complete ordered fauna/reserves/homes/limb-pose root. Preserve bodyCount/limit checks, dormant recipe validation, seed, manager identity and boot/restore order. |
| Pine `actors/elites.json` | 26,501 | `EliteFeatureSchema` plus `parseEliteFeature` is Pine's complete bounds/streams/ordinary/legacy/view/fights root. Nalati's ExternalElite rows are a different child contract, not user two. Original catalogue/kernel/module/resource checks remain required. |
| Pine `actors/shelter.json` | 1,577 | `PopulationShelterSchema` → `game/population/shelter`. Only Pine emits the complete environment/roster/weather/step/herdLimit/look/program root. `pine.shelter` already compiles from `behaviour/shelter.as`; Nalati's native shelter observations are not this whole file. |
| Nalati `actors/sheep.json` | 108,205 | `SpeciesActorsFileSchema` wraps species, page.world/specimen, exactly one fixed draw, pivots, parts and radius. It still has opaque page/pose/guest children. Only Nalati emits this whole crowd-page envelope; shared species/pose/fixed-draw children do not qualify it. |
| Nalati `actors/wildlife.json` | 101,603 | `WildlifePopulationSchema` → `game/population/wildlife#PageWildlife` / `installClientWildlife`; sole whole-root emitter. No defining schema metadata ships on this file. Keep the three original native checks (power, hull-book id and native limb-pose reference) with their actual owners; generic schema admission does not replace them. Admission and pasture guests already ship as AS. |
| Nalati `sim/population-metadata.json` | 18,468 | `sdk/nativePopulationRows#namePopulationHabitat` defines exact tree/tops lengths, maximum six ledges and ForagerContinuation. Native headless/elite loans consume it. A broad unbounded habitat schema would weaken the contextual contract, and no second complete emitter exists. |
| Nalati `sim/taming-poses.json` | 32,774 | Sole `{poses: NativeTamingRows["poses"]}` envelope, emitted by `generators/output.ts#tamingOf` and read by `test/fixtures/nalati-headless.ts`. No defining schema metadata ships. The typed native taming/pose owner and complete guest/source contract must be supplied before registration; numeric-pose children are insufficient. |

Seven targets already name a registered defining root; four carry private
inline schemas; wildlife and taming poses carry none. Matching missing
metadata across products was explicitly rejected as sharing evidence.
No `actors/populations` catch-all, compatibility mapping or erased
unknown root is introduced. Each whole-file one-user case goes to the
coordinator's batch under G988; additional complete-contract/native-owner
work remains explicit in the table, so this is **not a Z4 closeout**.

The AS boundary is already concrete for DW returns/practice/perch,
Pine shelter, and Nalati admission/pasture: the emitted declarations name
existing raw module hashes and the native/page ReturnProgram loan guard
owns module admission and lifetime. Keeper's author compiler emits immutable boot joins;
its original native roster still owns physical actors and RNG. Rewriting
that ownership into a new guest would require a separate exact contract
and would change the current payload; no byte-identical port is claimed.

Original non-browser checks: five suites passed **13 cases** (keeper
rows, Pine shelter, Nalati page planner, return shared memory and native
actor interfaces). Mixed-population and projection suites refused setup
when a peer changed `src/format/worldScenePages.ts` during the native
fixture recorder; no freshness retry, bypass or semantic pass is claimed.
No golden, loading or collider evidence is inferred from these checks.

### Z11 candidate boundary (2026-11-03, sp-x6)

Runtime source is still uncommitted, awaiting G998. The eligible reduction
is **5**, not 8: delete reader-less Pine `world/ambience.json`; register
the complete weather document used by Pine and Nalati, the existing
shared audio-scene grammar, and the G599 post-graph document used by
Nine and Nalati. Native executors retain allocation and ownership guards.
Pine's live forest-page floor/fire bodies and their order are pinned.

G988 exact-type ruling: Nalati `world/weather-fx.json`, Pine
`world/rain.json` and Pine `world/weather-observations.json` remain
charged one-user documents. Their complete grammars are admitted but
have **no platform-family entry**. G571's host approval is not a second
whole-file user; all three join Jake's one-user batch. No fake second
emitter or waiver is claimed.

Focused native/converter checks: **42/42 across 8 files, 9.4 s**; touched
types and typed lint pass. Pine's isolated emission comparison removes
only the 1,564 B dead ambience: all 718 other named bodies and 19
sections are exact. Combined frozen candidate `d4c2e8d15d-mw0u2vw4`
includes Z3 and Z8: its Pine index is **1,712,988 B**, under the unchanged
2,000,000 B cap. Local schema definitions preserve complete branch
constraints; their focused regression passes. Combined family census is
Pine 24 and Nalati 37 custom names; these are not Z11-only reductions.

Nalati raw byte comparison **FAILS** at the 164 B `look/map` stamp:
all 338 named bodies and 50/51 sections are exact; map.image remains
`80afaa55b292b48c93694dbc7ac95557ecb96714b2c159cd467ff3fa0caff2d6`.
Only tilesHash changes `28158e1c1c99e7d4ab7f74fecf0a4e433672cf8fe18f7ce37288ed5ba24d0967`
to `0251e8cae02598c70fe00c4652f8840b54f6fc9c0924d0aea1c7d3ac2b9692a8`
from output.ts defining metadata. Coordinator explicitly accepted this
exact G872 source-stamp class; no literal whole-product byte bar is claimed.

Fresh sp-x2 HOST-BAR review: **6/6 for exactly the three credited
patterns**, with real complete weather, audio and post roots; no generic
custom-predicate or transform waiver. Four independent focused native /
storage / registration suites pass in 2.3 s. FX, rain and observations
remain charged.

Sp-x9 independently sealed the old Nalati product against this exact B0
inventory. Each side's **22 packs / 377 entries / 62,322,835 B** fully
reconstructs with hashes checked. The 376 retained entries have identical
order and bytes except the separate map-stamp entry above. The complete
4,645 B chapter body is exact. This is reconstruction evidence, not a
literal whole-pack byte claim. Protocol and audit:
`tmp/sp-x9-z8/nalati-pack-audit.{py,json}`.

G998 on frozen `d4c2e8d15d-mw0u2vw4`: **Pine 24/24 green in Chromium
and WebKit**, all 48 individual panels read. Native read-only observation
identifies the camera 11/20 obstructions as moving `SkinnedMesh` actors
under `animals` (0.9–3.1 m per 60 frames), covered by G998's explicit
moving-creature exception. Coordinator accepted this verdict. No actor
was hidden or paused; no golden was promoted. Driftwood is 24/24 green
in both engines; Nine Chromium is 24/24 green, WebKit pending.

**Z11 does not receive a pre-existing-red waiver for Nalati QD11.**
Coordinator requires sp-o1's colour-space fix to land, the candidate to
be rebuilt on that source, and Nalati's 24 cameras re-shot in Chromium
and WebKit expecting the golden match. Z3 lands first, then Z11 only
after that visual bar passes. The remaining cohort stays explicit.

### Z5 complete-source qualification (2026-11-03, sp-x2)

Source `92f8a2e671` + `c9ae94288f` registers complete model and bake
families with actual Far Reach and Sunscar users of each. Fresh sp-x1
HOST-BAR seat: **6/6 each**, whole envelopes, pure format, client-only
reader, no shard selectors or authored callbacks. Full-root admission
precedes publication; original resource/native refusals and colour-graph
semantic/type/budget checks remain. Original source/converter/native
focused checks, root types and touched fast lint pass. No guard or cap
is deleted or raised. E9/E11 remain separately charged one-user roots.

Immutable `26a98e7be3` → `c9ae94288f`: five source bodies / **403,251 B
identical**. Far 202 bodies / 35,396,837 B are unchanged; Sun 192→191
bodies / 8,187,546→8,182,591 B removes only the authorized zero-reader
4,955 B effects duplicate (live effects stay in their complete sources).
All **28 old/new packs / 777 ordered entries** reconstruct exactly.
Admission changes only by that dead library hash and −4,955 compressed /
resident bytes. Indexes 278,755→463,744 B (Far), 207,135→304,434 B (Sun)
remain under the unchanged 2 MB cap. Registered-family census: **3→0
custom names each, −6 total**.

The one unrelated raw-body difference is the 164 B Sun `look/map` source
stamp. Independent reconstruction of every committed map input attributes
it only to the authorized emitter deletion; the map image stays
`bac9393474d96298d9bd4a407197d0bc86be913b872c8430e8f2e0aabd5cb399`.
Restoring the old stamp reconstructs the complete original map bytes and
SHA exactly. This is explicit source-stamp attribution, not a blanket
byte-identical claim for the whole index or all raw sections.

Both tiers, four affected poses per shard: **48 native Metal phone
portrait frames, 16 A/A + 16 A/B comparisons, every changed-pixel count
zero**; readiness/frame/error guards pass. Both pins contain the same
`0d7a022fbb` sun fix. Source landed before G998. Supplemental historical
golden captures completed Chromium 144/144 and WebKit west 72/72 with
errors empty; capture completion is not an all-panel green verdict.
Far Reach’s 24-panel Chromium read finds pre-existing differences at
**16 (sun position) and 24 (bridge fog)**; the other 22 have no static
loss. [Labelled board](../../../art/golden-runs/far-reach/2026-11-03-c9ae94288f-board.jpg).
**G872 coordinator ruling:** qualify Z5 on the strict before/after; those
two pre-existing differences do not block it and go to sp-o2 after QD1
for an Opus read. No 24/24 green claim or golden promotion. QD1 browser
priority stops further supplemental captures; all our browsers exited
and the preview lease was released (sp-x9 retains its own use).

Raw protocol/readings: `tmp/sp-x2-cs3-exits/z5/{audit.json,map-audit.json,
pixels/reading.json}`. No Pine/Nine source changed in this slice.

### Z8 whole-quest candidates and batch (2026-11-03, sp-x9)

**0/14 landed; two approved candidates, 12 retained blockers.** Existing
manifest-verified targets total **98,173 B**: Pine **5 / 53,098 B**,
Driftwood **5 / 13,092 B**, Nalati **4 / 31,983 B**. The named-body census
alone is insufficient: complete shared values also live inside other
real shipped documents, while two author emitters without a reading host
do not establish platform eligibility. No new CURRENT, pack or pixel
qualification is claimed by this preflight.

| Candidate | Actual users / reader and exact scope |
|---|---|
| Nalati `quests/chapters.json`, **4,645 B** | Fresh sp-x2 **6/6**, accepted by the coordinator. The exact whole private `ChapterPresentation` is Nalati's standalone body and the complete, present `QuestStorySchema.chapters` values emitted by DW and Pine. `game/quest/chapter.ts` and `story.ts` actually call `parseChapterStoryPresentation`. Candidate exports the same defining object as `ChapterStoryPresentationSchema`, preserves its parser/checks, appends one SDK root and adds only defining schema metadata on Nalati's original encoder. No optional child or inferred wrapper substitutes for the complete body. |
| DW `quests/steps.json`, **149 B** | Coordinator-approved zero-reader deletion, separate candidate. Fresh sp-x2 found no whole-file runtime route; a second source trace confirms only the emitter/schema declarations and producer/provenance tests name the file. `generators/heldArms.ts` reads `data/questSteps.json` directly and emits its guard into held claims; `game/loadout/claims#HeldClaimGuard` constructs its own complete guard runner. Pine's full steps still run through its original page/native owners. Delete only the unreferenced emitted copy and unused output imports, retaining source data, held guard, original shared step schema and every Pine step. No invented named-file reader credit. |

**DW dead-copy cut qualified (2026-11-03).** The sealed
`d4c2e8d15d-mw0u2vw4` candidate deletes only `quests/steps.json`
(149 B), its unused output import and parser alias. The source data,
held guard and all Pine steps remain. Combined Z3/Z8 reconstruction
retains 392 DW file bodies and 58 sections exactly; its one catalogue
routing change is Z3’s independently verified native-equivalent page.
Both old and candidate reconstruct 13 packs / 436 ordered entries;
434 retained entries are exact in the same order, with only the Z3
catalogue/page transport delta and this approved deletion. Sp-x1 read
all 48 individual Chromium/WebKit panels: both 24/24 green. Boards
landed with Z3 `c98d1cffe0` at
`art/golden-runs/driftwood-isle/2026-11-03-d4c2e8d15d-z3-board.jpg`
and `2026-11-03-d4c2e8d15d-z3-webkit-board.jpg`. The original
chapter/native/platform-family suites, root types and named lint pass.
Current reduction is **1/14**, leaving **13 / 98,024 B** charged.

**Chapter family qualified (2026-11-03).** Export and register the same
complete defining object as `ChapterStoryPresentationSchema`; the original
`parseChapterStoryPresentation` remains the reader and retains duplicate,
reward-reference, bounds and unknown-field refusals. Only Nalati’s
`quests/chapters.json` defining schema metadata changes. Its **4,645 B**
body SHA-256 stays
`b3c75e46c9c49bba83bd9756d993e006e61f6e15d421a9f95d773d931cbda6b5`.
The full DW and Pine chapter values remain present under their original
story owners; every one of the 13 retained target bodies / **98,024 B**
is byte-identical to the preflight. Pine’s lead module remains the exact
9,133 B AS module below; no Pine envelope is deleted or normalized.

All indexed Nalati bodies and ordered packs are reconstructed against a
sealed before product matching Z11’s B0 inventory exactly. Frozen candidate:
338 retained file bodies and 50 sections exact, one separate 164 B
`look/map` stamp delta; 22 packs / 377 entries / 62,322,835 B per side,
376 retained entries in the same order. Post-QD11/Z9 candidate: 335 retained
file bodies and 50 sections exact; the three deleted dressing pages belong
to Z9 `abedbc1d76`. Its 22 packs / 374 entries / 62,031,703 B reconstruct,
with 373 retained entries in the original order. Chapter descriptor and
body are exactly the frozen qualified values. These are reconstruction
claims, not a claim that complete index or pack files stay byte-identical.

**G998 shared cohort:** DW/Pine/Nine each 24/24 green on Chromium and
WebKit on frozen `d4c2e8d15d-mw0u2vw4` (Z3 `c98d1cffe0`, Z11’s Nine
reader); Nalati re-shot after QD11 `2d4405a27c`, 24/24 each on
`5b5922e263-mw0vipws` (Z9 `abedbc1d76`, independently read by sp-x6).
Far/Sun each 24/24 green Chromium on frozen d4c2 and WebKit on
`a0614245af-mw0vl5br`; their actual product indexes are byte-identical
across these candidates. All 96 Far/Sun panels read by sp-x9; four
labelled boards are committed in `67aae61a47`. Far’s fully roc-obscured
Chromium 12 and WebKit 7’s moving white foreground owner are re-shot with
the original normal protocol on the same respective builds: exact eye,
rotation and FOV, both settled gates, no errors, no actor hiding or colour
threshold change. Original plus subset receipts and hashed compositions
are retained under `tmp/sp-x9-z8/`. No pre-existing Nalati colour-red waiver.

Root types, named lint and the original registered quest/platform-family
suites plus the three-real-user chapter controls pass. The chapter SDK root
lands after all eleven Z11 roots, preserving first-seen wire identities.
A renewed original native run passes seven cases across Pine life authoring,
Pine native-story admission and step/native parity. The separate carried-quest
suite refuses before its tests because `src/game/boot/packs.generated.ts`
changes during preparation; no stale-input bypass or carried-suite pass.
No guard or ceiling changes. **Final slice: 2/14**, comprising one shared
family port and one dead-copy cut; **12 / 93,379 B** remain charged below.

**Pine lead is already AS, not a new rewrite.** `sourceOutput.ts` compiles
`returnModule(ctx, 'life')` from `behaviour/life.as` and `stag.as` through
the Script ABI 1.0 decision compiler. The real `custom/questRuntime`
lead.program, page-life program and quest-page chapter program are deeply
identical and their script is present in `actors/return-scripts`. Its
**9,133 B** raw module, SHA-256
`260eee8839d76af399fadc27a383c92ef8f75a0bbab154bce727d973d24e3594`,
is byte-identical to the frozen native oracle and the emitted declaration
matches the original fixture. This establishes the existing AS decision
owner; it does not close the surrounding questRuntime envelope. The
attempted original life/native/quest/carried test group refused before
running because ordinary CURRENT DW/Pine products were unavailable.
No stale-product bypass, new compiler proof or semantic pass is claimed.

| Retained whole file for the batch | Bytes | Exact remaining blocker |
|---|---:|---|
| Pine `custom/questRuntime` | 29,289 | Sole complete envelope and live quest.spawns source / forest-story content. PineQuestRowsSchema still leaves events, deaths, pageDeaths and content opaque, beyond the already-AS lead. Preserve source/content references, phase/save order, native inputs and every owner. A page/native-story child is not the whole replacement. |
| Pine `quests/native-spots.json` | 6,692 | Complete NativeQuestServiceSpots root has only Pine as emitter. DW's authored spots have a different complete envelope; sharing a point/prompt child is insufficient. Preserve duplicate row/person identities, all cable endpoints and native prop/entry loans. |
| Pine `quests/native-story.json` | 2,440 | DW and Pine genuinely author complete NativeQuestComposition values, but the native composition consumer traced is the fixture host; no src/game/engine reading host was found by the fresh seat. Author SDK/schema reuse alone cannot supply real runtime-user credit. Keep every saved-role/dependency/phase/reference check; any dead/duplicate retirement needs a complete routing and native reconstruction proof first. |
| Pine `quests/contracts.json` | 6,740 | Sole complete ContractCatalogue emitter. DW's trader/loot rows are different roots. Keep catalogue/program/offer identities, guest module loan, serial/save rules and original contract admissions; a board child cannot replace the whole catalogue. |
| Pine `quests/forest-story.json` | 7,937 | Sole whole story envelope. Existing inline board/store/talks grammar does not establish the complete world/map/pool/cable/mover contract. Preserve original fields and live custom/questRuntime content reference rather than dropping them to fit a child schema. |
| DW `quests/discovery.json` | 1,150 | Sole complete places/guide/glassCount/shardFlags root. Its strict authored grammar and AdventureContent reader do not have a second whole emitter; other shards' places arrays are partial children. Preserve guide clocks, IDs, flags and named world anchors. |
| DW `quests/interaction-source.json` | 9,886 | Sole closed constants.interact + interactSpots guest-input envelope. Preserve the actual ABI/input owner and original typed/native interaction-source checks. An unknown constants map or source wrapper is not a common root. |
| DW `quests/hints.json` | 761 | Sole complete QuestHintRows root and actual page hint-file reader. Engine default hints in other shards do not emit this whole control/condition/system policy. Keep duplicate control, scan bounds, scheduling and the global learned-control save. |
| DW `quests/wake-boss.json` | 1,146 | Sole complete ChapterWake root; Pine's elite/boss/controller children are different whole envelopes. Preserve quest/spawn/director identity, cue effects, duplicate/system separation and original native/entered encounter ownership. |
| Nalati `quests/carried.json` | 4,718 | Sole complete CarriedQuest root. Existing G601 scope and shared effect/pose children do not add a second emitter. Keep player/mount/resource loans, AS decisions, terrain tests, state/output and event identities and the original carried/Kokpar differentials. |
| Nalati `quests/content.json` | 20,411 | Sole complete chapter/figure envelope. Current ChapterViewSchema strips frame file/height/radius and child/cook motion.idleArm/idleHead; the emitted raw body retains them. Establish those exact owners and full contract; do not normalize away fields to fit the partial schema. |
| Nalati `quests/finds.json` | 2,209 | Sole complete static FindsCatalogue root on the clientFinds admission path. DW's LootFinds root/binding is different. Keep flags/owned/counters and the actual catalogue owner; importing its parser does not grant the old G441 one-user host approval. |

The 12 blockers stay charged for the coordinator's G988 one-user batch;
missing complete contracts and routing proofs remain explicit, not
silently approved by the batch label. No catch-all quest union,
compatibility alias, guard deletion or cap increase is proposed.

### Z13: qualified cuts and retained semantic owners

**2026-11-03, sp-x6:** Driftwood no longer duplicates `dayStyle` and
`nativeSpecs` in its assembly. The native proof reads the entire day input
from admitted `look/toon.sky.day` and derives the ordered spec catalogue
from the same admitted physics actors and captain. Entry budgets and all
native installation, clock and restore expectations stay unchanged.
`headlessSpecCatalogue` refuses divergent bodies under one identity.

The actual layout-dependent emitter retains all **41/41 other named
payloads and 16/16 section payloads byte for byte**. The assembly changes
only by deleting those two fields: **920,377 → 912,509 B (−7,868 B)**.
All 15 focused cases pass; strict root types and touched typed lint pass.
Before/after native replay is byte-identical over 240 ticks, including a
120-tick restored continuation (6,495,613 serialized observation bytes,
SHA-256 `53e93ae4fe3fe00c576be76504cf4bfb2c83713e287e69d53f2c265eef031efb`).
That replay uses the same retained admitted product on both sides; the
separate emitter comparison proves the removal. No browser or ordinary
build proof is claimed. **Count reduction remains 0/6.**

**Nine is untouched**, including its assembly, constants, portal ride and
grapple readers, until sp-o1 identifies the live missing-wall cause.
Its remaining predecessors are the native held policy (Z6), layout/spawn
and hook defining data (Z7), and the retained Z13 portal/grapple and native
grid-collision owners. Those owners must preserve standalone-cap removal,
float32 tread/hull expansion, install/restore ids and the independently
recorded entry proof; matching scene geometry is insufficient.

Remaining Driftwood owners include native quest/population/specimen roots
(Z4/Z7/Z8), native collision metadata and held policy (retained CS4/CS7
exits). Pine still needs its sole-copy 63,824 B population environment
(Z4), native terrain binding (Z12) and independent entry budget. Nalati
still needs population/boot identities and RNG (Z4), weather/shelters
(Z11), native collision binding (Z12), and riding/elite capabilities
(Z14). Its browser weather and elite readers name the retained assembly
and boot. Deleting those documents before these owners qualify would
remove live data; no alias, source import or renamed private envelope
counts as a deletion.

### Exits become host rows

| Named exit | Built by |
|---|---|
| CS3-E1 Nine placements | Z2 |
| CS3-E2 recipe transport | Z1 (recipes already share `WorldSceneSchema` across five shards) |
| CS3-E3 welds, CS3-E4 living roots, CS3-E11 island plan | Z3 (Nine casts / fabric in Z2) |
| CS3-E5 source envelopes | Z5 |
| CS3-E6 fixed geometry, CS3-E7 specimen book, CS3-E8 sign atlas | Z7 |
| CS3-E9 building life | Z10 |
| CS3-E10 Nalati dressing rows | Z9 |
| CS3-E12 landmark view | Z12 |
| CS3-E13 spray packet | none: it is a `.bin` blob, not custom |
| CS10-E1 collections, CS10-E2 fixed layouts | Z7 |
| CS10-E3 native view | Z0 (delete) |
| CS10-E4 quest runtime | Z8 |
| CS10-E5 private emitter / reader path | Z15 |
| CS10-E6 named-JSON validation and freeze | Z1 (registry replaces the freeze), Z15 (policy files deleted) |

### Recorded completed bars: CS1 / CS4 / CS7

This ledger originally marked only the **qualified slices done**. The
2026-11-02 completion bar below also marks CS4 and CS7 done from those
landed slices plus their exact recorded exits. Unimplemented owner,
contract and qualification work remains assigned in the source tables;
no deleted private path, higher host score or completed CS10 work follows.

| Completed bar | Landed authority and recorded exit |
|---|---|
| **CS1 inventory — done** | `9a616b4b82`, exclusive ownership `b13ad77350`: all-24 scan 4.56 s, 1,406 rows (930 platform / 461 named / 15 custom), six controls and original ownership assertion; root/scripts/test types and typed lint pass. Unresolved provenance remains unresolved. |
| **CS4 fields — done for the five existing descriptors** | `bb782c4930` (fixture repair `f9caf76f31`) retains 142,101 JSON B and 1,745,112 binary B. Four suites / 14 controls, normal six-product build 48.91 s, strict6; 2,991 / 2,993 bodies exact. The two exact Far/Sun map stamps remain raw FAIL with only their accepted G872 classifications; no general tolerance. |
| **CS4 common physics — done** | `5596fde41e`: normal physics7 25.91 s / strict7; original 873,873 B full wire reconstructs, 644 typed buffers / 890,236 B exact and 1,046 unrelated bodies exact. Original walk 75/75, no stuck, bounds failure or pending leg; same colliders and owners. |
| **CS4 floor/cave metadata — done** | `b5a7dc391d` with its later recorded coalesced six-product proof: original floor/runtime mirror and registration suites pass; the 32-document coalesced proof (normal6 46.20 s; original five suites / 31 cases 37.2 s) retains the existing payloads and the separately classified G966 Explorer labels. No collider movement, new walk or second-user credit. |
| **CS4 existing ground aliases — done for the two roots** | `d0c35248f3`: 13 controls, normal AFTER 48.219 s, strict DW/Nalati and five originals 9.178 s; 868 / 869 payloads exact, whole packs reconstruct. Sole Nalati map stamp raw FAIL is retained with its exact G872 classification. The 99 B cover and 21,630 B meadow bodies stay unchanged. G667's host audit and Pine's owner document remain open. |
| **CS7 audio/cards — done** | `2c5aa6386d`, recorded in `515ffcac96`: six controls, root/test types/lint and five original suites 28.7 s, normal6 / strict6. Of 2,994 paths / 484,565,055 B, 2,993 other bodies are exact; two defining metadata records change. Sole 164 B Nalati source stamp stays raw FAIL, accepted only under its existing exact G872 ruling. No weather collision, held/geometry migration or wider CS7 exit is closed. |

No build, native worker, browser, stamp rewrite or requalification was run
for this documentation update. The defining payload/pack proofs below
remain the authority, including every recorded refusal and explicit exit.

**Effort (Z0–Z15, 2026-11-03):** ~45 lane-days, ~29 Opus (Z2, Z3, Z6, Z7, Z9, Z12, Z14 and the visual halves of
Z4, Z8, Z11) and ~16 Codex. With 3 Opus + 3 Codex lanes about two weeks, Opus-bound. No WASM-HOST rows (G969).
The earlier 26–37 day estimate (CS0–CS10) bought the inventory, slices and exits, not removal.

## Order and interactions

1. CS0 now (no host moves, no G679 conflict); CS1–CS2 alongside HA0–HA1.
2. Biggest numbers first: CS4 (30 % of bytes in ~7 blobs) and CS3 (65 % of the count), Pine first (184 of K1,
   7.7 MB of K2, 10 of the 15 `custom/` sections).
3. Most duplication next: CS5 quests, then CS7's small kinds.
4. Behaviour last: CS6, CS8, CS9 wait on WASM-HOST H6 / H8 / H17 (H9 is already in progress).
5. CS10 disposition closed under the completion ledger below.
6. **From 2026-11-03 the order is Z0 → Z15** (the zero rows above): registry and pages first, behaviour hosts
   (Z13, Z14) late, Z15 deletes the path once the count is 0.

- **WASM-HOST** is not pulled in (G969). Behaviour moves to AS on the existing Script ABI; a per-frame need is a
  blocker raised to Jake, not a reason to keep a section.
- **Custom-code wave 3 and the legacy shards:** independent. No legacy file reads a custom section or named JSON, so
  nothing here breaks `src/shards/*-legacy`, and CS10 does not wait for legacy deletion.
- **SHARD-PLATFORM's W2 exit rows** for the 15 `custom/` sections (open-x-queue) fold into CS3–CS9 when this starts;
  until then they stay where they are.

## Decisions for Jake

1. **Where does it live?** Recommended: **phase HA7 inside HOST-AUDIT** (this file is that phase), because the
   readers are HOST-AUDIT's hosts and HA0's ruler must charge schemas too. Alternative: its own plan.
2. **When?** Recommended: **CS0 now** (ceilings 549 → 387 and the shard-schema freeze cost nothing and stop
   growth), the rest starts with HOST-AUDIT after the SHARD-PLATFORM mini plans finish (G679).
3. **Pull WASM-HOST in?** Recommended: **only H6, H8, H17, when CS6 starts**; H9 is already running. Not all of v2.
4. **First kind and shard?** Recommended: **scenes and ground on Pine Hollow** (CS3 + CS4): two thirds of the count
   and a third of the bytes, mostly mechanical.
5. **Delete the custom path at the end with no exception?** Recommended: **yes**: no `custom/` sections and no
   shard-defined JSON schemas; a one-shard schema needs a Jake G row or goes to WASM.
6. **(2026-11-03) What does zero count?** Recommended: **no `custom/` and no named JSON outside a registered
   platform file family** (Z1). Counting every named file would force 30 MB of pages into eagerly loaded sections.
7. **(2026-11-03) One-user hosts?** Forest ground (Z12), arena / Titan and riding (Z14) may find no second user.
   Recommended: fold into two-user families where honest, then bring what is left to Jake as **one batch** of G595
   approvals after Z0–Z11, not one host at a time.
8. **(2026-11-03) Nine pages now?** Z2 does not touch Nine legacy (G908 / G933). Recommended: build it now under
   identical captures rather than wait for the Nine fps QA (CS3-E1's deferral).

## CS5 / CS6: initial shared-document slices

**2026-10-31, sp-x2.** CS5's first slice (`4e345989fb`) registers the
existing `QuestPageInteractionsSchema` for Driftwood's `quests/trader.json`
and Pine's `quests/mill-door.json` / `quests/lanterns.json`. Their native
parser, logical names, payloads and consumer ownership stay unchanged.
One normal build and independent admission preserve all **1,511 payload
paths / 234,296,562 B**, with only the three defining-schema metadata
records changed. Eighteen focused controls, root types and touched typed
lint pass. This is a registration slice, not completion of CS5's remaining
quest families or its quest-runtime eviction.

CS6's source inventory uses CS1's retained primary-shard rows: **55**
actor, behaviour, director and grazer entries across the six primary
shards, comprising **42 platform**, **12 named JSON** and **one custom**
entry. Schema candidates in that inventory do not themselves prove an
admitted contract or a shared host. The first independently inspected
family is `actors/page-life.json`, whose real Pine and Driftwood producers
already use `PageLifeSchema` / `parsePageLife`. Its live host retains the
original flock, forager, borrowed-draw, system-order and AS program
ownership; no new callback, program, tick or default application is added.

The final candidate passes **29 controls across six suites**, including
the original ambient ownership, retirement and page-life controls; root
types and touched typed lint pass. One coalesced normal DW/Pine/Nalati
build takes 47.60 s with declared peer overlap (no isolated timing claim),
and independently admits all three products. Its 1,911 payload paths /
322,948,635 B differ in exactly one 164-byte Nalati `look/map` record:
only `map.tilesHash` moves from `a9646fb2…abe455b` to the exact current
source hash `f11c8cb9…5ddc96`. The only map input edit is the earlier
`7de65890f1` two-line defining-metadata change in `generators/output.ts`.
Image `80afaa55…aff2d6`, the other 1,910 payloads, and every DW/Pine byte
are identical. Four defining metadata records change: two prior
creature-look records and the two page-life records.

The strict raw comparator remains **FAIL**. Jake's **G872 per-case
ruling** accepts exactly that current-source stamp classification; no
general tolerance, stamp/image write or admission guard change is added.
The remaining CS6 species/population and behaviour-to-AS work stays open;
no legacy file is part of either slice (G908).



## CS6: existing native population documents

**2026-10-31, sp-x2.** The next three names retain their already approved
G571 hosts and original complete format roots: Driftwood's
`actors/creature-install.json` (`CreatureInstallSchema`) and
`actors/projection.json` (`PopulationProjectionSchema`), and Pine's
`actors/shelter.json` (`PopulationShelterSchema` / its native parser).
These single-user documents gain defining-contract registration; this is
no new shared-host claim, callback, behaviour port or schema inference.
Wire values retain the existing input types and consumer defaults.

One normal coalesced six-product AFTER build exits successfully in
48.91 s with declared ordinary builder overlap, followed by independent
strict admission of all six. Every Driftwood/Pine payload remains exact:
1,511 paths / 234,296,562 B, with only these three defining metadata
records changed. Six focused suites pass (5.9 s), including the original
kit/leave/shelter controls and coalesced field controls; root types and
touched typed lint pass. The actual-product test declares both products
for CI and keeps missing/foreign metadata and native-bound refusals.

The separate field owner's coalesced proof covers 2,993 raw payloads /
484,588,041 B. Exactly two Far/Sun 164-byte map source stamps differ;
2,991 other payloads and every image stay exact. Ordered pack members,
offsets and original pack hashes reconstruct with only those same stamp
members replaced. Its raw comparator remains FAIL and its exact source
classification belongs to that separate slice. No general tolerance or
admission guard change is added here. Remaining creature/behaviour rows
and AS ownership exits stay open; no legacy source is touched (G908).

## CS2: shared names and remaining exits

**2026-10-31, sp-x1.** Model catalogues (`79b336bd52`) bind the existing
`models/world-scenes.json` name in modern Driftwood, Pine and Nine to
`WorldSceneModelsSchema` / its original parser. Weather presentation
(`59dd3208e1`) binds Pine and Nalati `world/forest-weather.json` to their
existing `ForestWeatherSchema`, including its native program/storm and
observation-block checks. Payload encoding, resource ownership, consumer
defaults and all legacy sources remain unchanged. The weather fixtures
retain every original held-read, retirement, HUD and owner assertion and
now carry real defining metadata plus the native validator.

Fourteen model controls and 21 weather controls pass, as do root types
and touched typed lint. One normal coalesced publisher takes 44.15 s;
independent strict admission accepts all four products. All **2,376 file
rows** retain their names, paths, hashes, ordering and costs; precisely
five defining-schema metadata records change. Of **2,599 payload paths /
440,949,804 B**, 2,597 are byte-identical. The original strict comparator
fails on exactly the two 164-byte `look/map` source-stamp records and is
retained as a failure. Independent full comparison verifies that each
record differs only in `map.tilesHash`: Nalati `f11c8cb9…5ddc96` becomes
`07afaebe…197a9e`, and Nine `7ed9611d…deba07e` becomes
`0579007a…6603a8`. Both equal current `mapTilesHash`; only the respective
`output.ts` / `worldScenes.ts` metadata options changed among map inputs.
Map images remain exactly `80afaa55…aff2d6` and `ce62e427…9fefd`.
G872 accepts these two exact cases only. No source stamp is frozen and
neither the strict comparator nor map freshness is weakened.

Registration preserves an existing logical name and its complete shared
native parser. It does not merge payloads, derive tier copies, change
host ownership or make a one-user schema generic. The private ingestion
bridge remains open until the following existing exit rows replace its
remaining documents; an inventory shape match alone proves no contract.

| Remaining document family | Explicit exit and retained requirement |
|---|---|
| Scene/source families, cabin tier/shadow copies, fixed model geometry, dressing and model libraries | **CS3**: streamed scenes/models and derived copies; retain geometry/resource/ownership checks. Placement-name registration alone does not collapse the 194 placement documents. |
| Fields, Pine floor/cave and `data/physics.generated.json`, Nalati meadow and other ground bakes | **CS4**: streamed fields and the existing physics section; retain Pine profile/notice/King-hit/tree/shelter/piece owners, not just the ground subset. |
| Remaining quest/story/step/panel/carried/runtime documents | **CS5**: complete shared quest schemas and approved WASM programs. Persistence registration is qualified below; the complete panel catalogue still has an inline record contract. |
| `directors/main.json`, population/keeper/return/install/roster/shelter documents and remaining creature custom sections | **CS6**: retain complete native controller/module/ownership rows; executable behaviour belongs on the approved sim host. |
| Held kits/weapons, collections/appearance/sky/audio/weather/water, people/places and raw jian geometry | **CS7**: unify complete wire shapes and retain native consumers. Pine `world/weather.json` is a program; Nalati's same name is `{weather,reactions}`, so it is not yet one contract. Raw geometry exits through the model library. |
| Room/boss/encounter/fight/riding documents | **CS8**: retain closed encounter/riding owners; executable fights use the approved host. |
| Headless assembly/boot/constants, native views and runtime graphs | **CS9**: derive assemblies from platform sections and use approved view hosts; permissive assembly envelopes are not CS2 registrations. |

At this intermediate slice CS2 was not marked done: broad family labels did not account for every remaining logical name. The later exact-name source tables and completion ledger supply that missing assignment. Their CS3–CS9 implementation exits remain open; neither an existing child schema nor a family label alone demonstrates a complete native contract.

These exits remain open work, not completed platform contracts. CS10
removes the checked private path only after they land. Missing provenance,
unresolved readers and one-user schemas remain explicit audit evidence.


## CS4: existing streamed field descriptors

**2026-10-31, sp-x1.** The first bounded slice registers
`world/fields/<id>.json` against the existing `SceneBuffersSchema` and
native parser. Sky's meadow and Signal's four ember descriptors retain
all **142,101 JSON bytes** and **1,745,112 binary bytes**. Their two real
producers keep each original name, dependency, byte range, stride,
instance count, LOD and draw order; only defining metadata is added.
The existing client-only buffer and tile hosts retain detached geometry
storage, scope ownership and retirement. No new host or drawing path is
introduced, and neither Pine nor Nine legacy is touched.

Four suites / **14 controls** pass, including the original complete
scene-buffer byte/LOD/transform, construction-retirement and buffered-tile
controls; root types and touched typed lint pass. The cold Explorer
fixture retains its real emitted metadata and uses the native validator;
all original rendering, missing-file and lifetime assertions remain.

One coalesced six-product build takes **48.91 s**, followed by independent
strict admission of all six products. Of **2,993 declared payload paths /
484,588,041 B**, 2,991 are byte-identical. Eight defining metadata records
change: the five field records and sp-x2's three native population records
in `d066e8f046`. The original raw comparator remains **FAIL** on exactly
the two 164-byte map records: Far Reach `81c78376…57b4fdf` becomes
`aa064ca3…97e5ec`, and Sunscar `d3e1f33c…05f3a90` becomes
`75b09cfc…923c87`. Each is the exact current source hash after only the
respective field emitter metadata/type annotations changed. Their images
stay exactly `a4d2c580…04728d` / `bac93934…5cb399`. Full ordered pack
members and offsets reconstruct; only these map members and the derived
pack hashes differ. G872 accepts these two exact cases only, preserving
both the strict failure and all map freshness checks.

The old full source stamps are independently reconstructed. Far Reach's
pre-existing untracked `generators/rows/islets.generated.ts` contributes
hash-bound bytes matching the old aggregate; its local/CI divergence is
an open BURN-DAMAGE-LIST finding, and the file is left intact.

## CS4: Pine native collision transport

The existing `world/physics` section now carries Pine's common ground,
solid, actor, parked-body and herd rows. The original
`data/physics.generated.json` name remains for version, profile, notice,
King-hit, tree, shelter-tree and piece owners. Its original full authoring
oracle remains available for comparison. The native fixture reads both
admitted transports through the same native bake reader; no host,
collider, controller, tick or rendering logic changes.

The final needed seven-product refresh completes in 25.91 s, followed by
independent strict admission of all seven modern physics products. All
1,046 unrelated Pine payloads / 153,570,019 B, all original names, other
sections and custom schemas remain exact. The original 873,873-byte full
JSON reconstructs exactly from the 152,494-byte owner file and
721,431-byte common section. The same native reader produces deeply and
string-exact results; all 644 typed buffers / 890,236 B are byte-identical,
retaining 2,078 solids, 164 actors, three parked bodies and 52 herds.
Map-source stamp and all drawn payloads are unchanged; no capture credit
is claimed.

The required maintained command, `node scripts/physics-baseline.mjs
--no-build --mode=walk`, passes the complete unfiltered HEAD catalog:
**75/75 route legs, zero stuck, zero bounds failures, zero pending**.
The prior 85-leg queue shorthand was corrected before execution; no
route, assertion or cap changed. Focused transport/native-reader controls,
root types and touched typed lint pass. Neither Pine nor Nine legacy is
modified or used for this proof.

At this intermediate slice CS4 remained open for Pine floor/cave,
Nalati meadow and other ground bakes; the later completion bar records
the qualified follow-through and explicit remaining owner exits. Retained encounter and authoring-owner data are explicit owner-data
exits, not a new platform host or a discarded projection remainder.


## CS9: source-first assembly derivation

**2026-10-31, sp-x1 — open.** The four modern products still emit
`sim/headless-assembly.json`: Driftwood 932,863 B, Pine 64,873 B,
Nalati 135,522 B and Nine 731 B. All four source declarations have empty
`modules`, `prepare` and `install` collections; their legacy expression
scaffolding and unique native constants are not yet retired. Registering
that scaffold under a new name would not satisfy CS9.

The first bounded derivation slice removes Driftwood's `chapterDirector`
and `nativeEncounter` copies and Nalati's `nativeField` copy. Native proof
readers now obtain the same values from the existing admitted
`quests/chapter-director.json`, `quests/wake-boss.json#encounter` and
`world/meadow.json` payloads through their original defining parsers.
Driftwood's assembly shrinks to 931,426 B and Nalati's to 113,878 B:
23,081 B of duplicated JSON removed, with no new schema, host or callback.

One normal seven-product publisher completes in 25.77 s (two builds,
five reuses), followed by independent strict admission of all seven.
Both original full canonical assembly byte strings reconstruct exactly;
the other 861 payloads / 167,436,194 B, all other metadata and custom
schemas remain exact. Every old and new ordered pack member, offset and
pack hash reconstructs. Five original suites / 25 cases pass in 18.8 s;
root types and named typed lint pass. Pine's separately queued physics
slice is still uncommitted and its emitted proof remains unchanged.

The raw full-payload comparator remains **FAIL** only on Nalati's
164-byte `look/map` source stamp: `07afaebe…9197a9e` becomes
`e785ea8f…924b21`. The old full source stamp is independently reconstructed;
the new value equals `mapTilesHash` after only `output.ts` drops the
already duplicated `nativeField`. Image `80afaa55…aff2d6` is identical,
and Driftwood's map stamp is unchanged. G872 accepts this exact case
only. No old stamp is frozen and no map freshness check is weakened.

**At this intermediate slice, CS9 remained open** for the retired declaration scaffolding, every
remaining unique native constant and the view/graph AS exits. This slice
establishes actual defining-payload derivation, not complete headless
assembly retirement.

## CS9: retire Pine's unused declaration shell

**2026-10-31, sp-x9 — bounded slice done, `892e75d553`.** Delete
Pine's inert `data/headlessAssembly.json` and its producer import. The
existing `sim/headless-assembly.json` now carries only the same three
constants: terrain, entries and environment. The typed native fixture
continues to own level, ports, collision and installation. The proof
names that actual fixture in `ENTRY` and its explicit source-input fence;
the hashing algorithm and all other inputs remain unchanged. No old
checkpoint is retagged. The sim-in-runtime inventory remains exact, so
this deletion earns no new host or chargeback credit.

The single coalesced publication with CS6 `9375c2c52f` qualifies the
**64,873 → 64,095 B** assembly and exact reconstruction of its whole old
canonical value, all **1,055 other bodies / 154,466,131 B**, all ordered
packs and all nine maintained suites (**33.6 s**). The complete tuple,
two exact actor-schema additions and retained scratch hash-label refusal
are recorded in [the CS6 proof](#cs6-complete-pine-roster-and-elite-documents).
Post-landing ordinary Pine admission remains CURRENT without rebuilding.

**At this intermediate slice, CS9 remained open:** Pine's unique constants still use the private native
transport; the other three declaration shells and every remaining
boot/constants/pose/view exit remain. In particular, an available
population-environment schema does not approve its G571 owner/host exit.
CS10 retains its live producers, readers, named validator and policies.

## CS3: modern scene inventory before captures

**2026-10-31, sp-x1 — source-only inventory.** This bounded inventory reads
only the seven existing modern products and their source-project configs.
Each selected member is hash-verified; no legacy folder or legacy-final
pin is read or modified. Names below describe existing payloads, not a
new registration, consolidation, reader adoption or pixel qualification.

| Modern product | Root world/scenes | Placement family | Model catalogue | Scene/source candidates |
|---|---:|---:|---:|---:|
| Driftwood | 1 / 689,373 B | 12 / 688,231 B | 1 / 98,139 B | 11 / 5,066 B |
| Pine | 1 / 353,324 B | 112 / 566,608 B | 1 / 233,857 B | 72 / 1,735,138 B |
| Nalati | 1 / 208 B | 0 | 0 | 0 |
| Nine | 1 / 481,022 B | 70 / 6,328,079 B | 1 / 53,009 B | 3 / 3,397 B |
| Far Reach | 1 / 313,596 B | 0 | 0 | 18 / 480,683 B |
| Sunscar | 1 / 22,431 B | 0 | 0 | 11 / 60,231 B |
| Blender template | 0 | 0 | 0 | 0 |

The placement names are the four already registered placement families;
the model catalogue is the existing shared schema. Scene/source
candidates include literal scene paths and existing WorldScene defining
contracts; dynamic references and shared resource lifetimes still need
source review. Counts are scoped to these seven products, not the entire
24-product inventory. CS3 implementation requires identical captures,
including tier/shadow variants and complete scene resources. No drawing
path changes or capture credit are claimed here.

## CS7: existing audio and people contracts

**Done for these two documents (2026-10-31, sp-x2): `2c5aa6386d`.**
Nalati's `audio/scene.json` uses the existing complete `AudioSceneSchema`
and native director. Driftwood's `people/cards.json` uses the existing
`KitFigureCardsSchema` and cold Explorer reader. Their names, canonical
payload expressions, parsers, ownership and critical audio admission
remain unchanged. Registration adds exact defining provenance and the
audio schema's SDK wire root. The positive audio fixture supplies actual
metadata and the real checker; every consumer assertion remains.

Six focused controls pass for native identity, complete canonical bytes,
unchanged input objects, malformed-data refusal, pre-read metadata
refusal and valid product reads. The five original audio, island-book,
Pine cabin, Nine cast and Nine Explorer suites pass in 28.7 s. Root/test
types and named typed lint pass. One cause-fixed normal six-product
AFTER build and independent strict admission pass; post-landing root
types and strict six-product admission also pass. No BEFORE build,
browser, pixel or isolated author-speed reading is claimed.

The complete comparison covers **2,994 unique payload paths and
484,565,055 bytes**. Exactly 2,993 other bodies are byte-identical, with
two intended `jsonSchema` metadata changes. The raw strict comparison
retains FAIL for the remaining 164-byte Nalati `look/map` document.
G872 accepts only its exact source stamp `9a4ae5ff…` → `ed7a40e2…`:
the current `mapTilesHash` changed solely with the audio metadata option
and unused import. Image `80afaa55…` is identical; the old source stamp
is independently reconstructed and the current stamp recomputed.
Pine and Nine maps are fully unchanged. This is one classified case,
with no guard or general tolerance change. Full hashes are in the
source commit message.

The proposed 62-document weld registration was entirely withdrawn:
Pine's index reached 3,120,670 bytes against the unchanged 2,000,000-byte
cap. Its source/test activation is absent; Pine's index is 1,703,170
bytes again. The original baseline was retained for the cause-fixed
CS7-only build. Its explicit CS2 footprint exit remains recorded below.
Pine's weather program and Nalati's `{weather,reactions}` envelope remain
an explicit CS7 exit; these two registrations do not unify those shapes.


## CS4: floor and cave defining contracts

**2026-10-31, sp-x1 — defining-contract slice qualified.** Three
existing modern Pine names now carry their existing defining contracts:
world/floor.json uses ForestGroundLayoutSchema; world/crag-cave.json
uses CaveFileSchema; world/cave-interior.json uses CaveInteriorSchema.
These are the already approved G571 forest-page feature inputs, with its
original one-user waiver; no second shard user or new host credit is
claimed. The original payload encoders, paced floor admission, cave
collider admission, file identities and runtime readers stay unchanged.

The patch adds only these three registry entries, defining SDK wire
roots and modern emitter metadata. It excludes all parked CS7 entries.
Focused registration/native format suites, root types and named typed
lint pass. Missing or foreign defining metadata still refuses before the
file read, and native count, tuple and shaft bounds remain authoritative.

The coalesced six-product proof below binds all three documents to the
immutable pre-`b5a7dc391d` baseline: every Pine floor, cave and other
existing payload byte is unchanged, except the separately classified
G966 Explorer source labels. Original floor and runtime mirror suites
pass alongside registration controls. Since this slice moves no collider
data or installation, it does not repeat the already qualified native
walk. CS4 was still open here; the later completion bar retains its
remaining owner/streaming exits explicitly. CS2 was still open
at this slice; its later per-name exit assignment is recorded below.

## CS2: persistence and native world-scene recipes

**2026-10-31, sp-x1.** Pine and Nalati's existing
`quests/persistence.json` now names the original
`namedJsonContracts#AdventurePersistenceSchema`. Both already use
`game/quest/persistence#bindAdventurePersistence`; saved records,
defaults, legacy adoption, completion facts and refusal order stay with
that owner. Both canonical serialization expressions remain unchanged.

The bounded `world/scenes/<id>.json` family names the original
`clientChannels#WorldSceneSchema` and `parseWorldScene`: three existing
Nine, 15 Far Reach and nine Sunscar documents. Its 27 payloads retain
their original hierarchy, imports, resource ownership and encoding.
The family refuses nested/empty/oversized ids and does not capture
`world/sources/*` or Pine's mixed `scenes/cabins*` namespace. The original
Sky ground metadata equality adds only the actual defining schema; its
complete content hash, costs and geometry assertions remain intact.

Four focused suites / 18 controls pass in 22.7 s, with root and test
types plus touched typed lint clean. One normal six-product AFTER build
takes 46.20 s under ordinary shared-host admission. Independent ordinary
strict admission accepts all six products and all **32** affected native
documents: the preceding three floor/cave records, two persistence
records and 27 recipe records. Five original suites / **31 cases** pass
in 37.2 s: Pine floor, Pine runtime mirrors, Sky ground, Nine world scenes
and Explorer catalogue. No runtime reader, collider, renderer or native
input changes; no extra walk, live capture or timing claim is made.

The immutable baseline contains **3,009 payload paths / 484,714,581 B**;
**3,003 payloads are byte-identical**. Names, order, resource costs and
all custom schemas stay exact apart from the following classified
records. Every old/current pack member, offset and complete pack hash
reconstructs; the old baseline is never replaced.

| Exact map-source case | Old stamp → current stamp | Identical image |
|---|---|---|
| Nalati, only `output.ts` defining metadata | `1fbc0931…eabd59bd` → `9a4ae5ff…41aa33ce` | `80afaa55…aff2d6` |
| Nine, only `worldScenes.ts` defining metadata | `0579007a…f86603a8` → `c68ef3ed…4c17216` | `ce62e427…9fefd` |
| Far Reach, only `worldScenes.ts` defining metadata | `aa064ca3…6b97e5ec` → `1fd7fc6b…58e23c12` | `a4d2c580…a704728d` |
| Sunscar, only world/skirt scene defining metadata | `75b09cfc…0923c87` → `f3202b34…31cad69c` | `bac93934…bd5cb399` |

Each 164-byte map record differs only in `map.tilesHash`, equal to the
current complete source fingerprint. Each old full fingerprint is also
independently reconstructed, including Far's existing untracked source
input. The other two changed payloads are x2's intended G966 provenance
retarget in `a9bdb20119`: only `entries[].file` for Driftwood
`shared/boar`, `shared/bear` and Pine `shared/deer`, `shared/boar`,
`shared/bear` changes from `src/game/models/creatures.ts` to
`src/game/models/explorerCatalogue.ts`. Replacing exactly those five
labels reconstructs the original catalogues; IDs, species, order,
pipelines, construction and every other field remain exact.

**The strict raw comparator remains FAIL on those six payloads.** G872
accepts these four exact source-stamp cases, the five intended Explorer
labels and exactly the 32 defining-schema records, per case only.
No tolerance, frozen old stamp or weaker freshness/admission check is
introduced.

### Source-first remainder, without inferred registrations

The seven modern product bodies at the `929d759689` boundary are
hash-verified for candidate selection, independently of current-source
admission. After those registrations and before CS7's next slice,
194 distinct named JSON identities remain unregistered.
Only five names repeat across shards; their complete contracts are:

| Remaining repeated name | Exact source evidence and exit |
|---|---|
| `directors/main.json` (DW/Pine) | Inline `{declaration,module,stages,bindings,seed}` composites in the two output emitters; `DirectorSchema` and `DirectorStagesSchema` are children, not a defining root for the envelope. **CS6**, retain complete program/owner admission. |
| `quests/panels.json` (Pine/Nalati) | Pine emits `v.record(v.string(), PanelDefinitionSchema)`; Nalati emits `{name: parsePanelDefinition(namePanel)}`. The record wrapper is inline. **CS5**, complete catalogue root before registration. |
| `sim/headless-assembly.json` (DW/Pine/Nalati/Nine) | Different unique constants and retired declaration scaffolding; CS9 already derives duplicated chapter/encounter/field inputs. **CS9**, finish derivation and approved view/program exits. |
| `world/sources/bakes.json` (Far/Sun) | `sdk/worldScenes#bakedSceneSourceFile` uses the existing `SceneBakeSource` interface, bounds and downstream native resource admission; there is no exported complete native format root for that envelope. **CS3**, establish its complete contract without inferring one from the bytes. |
| `world/weather.json` (Pine/Nalati) | Pine emits a plain parsed weather program, Nalati `{weather,reactions}`. **CS7**, a real shape collision; no alias, union or wrapper added. |

Repeated literal names are not the whole CS2 bar. Cross-name shared
native roots still require source-first coverage: Pine cabin shell and
specimen documents and Nine cast/fabric documents already use
`WorldSceneWeldSchema`. That attempted slice is fully withdrawn for the
measured index-footprint exit below; the mixed living-cabin
`{graph,life}` wrapper remains a separate CS3 exit. The
CS3–CS9 family table continues to own remaining single-user, inline,
unknown and collision cases; neither a shape match nor this inventory
grants a new host or one-user waiver. **CS2 was still open at this audit**;
the later per-name completion ledger supersedes that intermediate status.

### CS2 explicit index-footprint exit: weld documents

**2026-10-31, sp-x1; explicit ruling to withdraw.** The real emitters
already use `WorldSceneWeldSchema` for 60 modern Pine cabin shell and
specimen documents / 1,041,529 B and two modern Nine cast/fabric documents
/ 25,380 B. Eight living-cabin `{graph,life}` wrappers correctly refuse
that whole-document root and stay outside the proposal. Feasibility and
25 focused/native-format controls pass; these are not an emitted-product
qualification.

The one coalesced normal six-product AFTER attempt fails after 33.99 s
at Pine index admission: `shard.json` grows from **1,703,170 B** to
**3,120,670 B**, exceeding the unchanged **2,000,000 B** cap. Repeating
the full defining weld schema across the 62 records adds about 1.4 MB
to that index. The normal guard refuses it. No complete strict-six,
payload-identity or original welded-product qualification is claimed.

The **entire unlanded 62-document slice is withdrawn**: its common
registry entries/families, three emitter metadata changes, changed
existing negative control and new test are removed. The three emitters
and existing test are verified exactly HEAD-clean; x2 restores only its
two-entry CS7 seed. No weld registration, compact-schema protocol,
serializer/reader change or cap waiver lands. The immutable before
baseline and actual refusal remain unchanged; x2 owns one cause-directed
CS7-only AFTER proof.

This is an explicit **open CS3/index-compaction exit assigned by CS2**. A later,
separately reviewed index-compaction row may revisit it while preserving
the original index cap, defining provenance and native checks. It is not
a registration pass or permission to retry a subset of the withdrawn
slice. Other known cross-name native contracts remain source-first work;
At this rejected slice CS2 could not yet be marked done. The later
completion ledger records the whole footprint exit without retrying it.

### CS2: native scene aliases and the admitted forest page

**2026-10-31, sp-x1.** Source-first registration keeps 23 existing
logical names: 15 `WorldSceneSchema` recipes across modern Driftwood,
Pine and Nine, four Nine `SceneBuffersSchema` documents, three
`PosedLibrarySchema` draw libraries across Driftwood and Pine, and
Pine's existing `ForestPageSchema` under its explicit G571 waiver.
The original whole-document native parsers remain authoritative.
Only defining metadata is added; encoding expressions, dependencies,
consumers, resources and collider data retain their original values.
Neither legacy tree nor the withdrawn 62 weld documents is registered.

The SDK names the two existing PosedLibrary and ForestPage wire roots
so metadata resolves the actual defining native schemas. The original
portal and inner-fish fixtures use the real file metadata helper;
original geometry, ownership, retirement and teardown assertions stay.
Five focused suites / 48 controls pass in 11.46 s; the final inner-fish
fixture audit independently passes its original seven controls. Root
and test types and touched typed lint pass.

One normal AFTER publisher completes in 44.09 s (six products reported
built); the three audited products independently pass ordinary strict
admission and all 23 registered documents pass native validation. Actual
index sizes equal the unchanged-canonical-serializer projections:
Driftwood 994,362 to 995,193 B, Pine 1,703,170 to 1,757,786 B, and Nine
1,032,432 to 1,061,329 B, all under the unchanged 2,000,000 B cap. The
five original portal/buffer, Driftwood named-file, ambient-owner, Pine
runtime-mirror and Nine world-scene suites pass all 25 cases in 25.7 s.

Of **2,215 indexed payload paths / 352,445,954 B**, 2,214 are
byte-identical. Precisely 23 defining metadata records change in the
three indexes. Custom schemas and all other index fields are exact,
apart from normally refreshed source/validator build receipts. Both
ordered pack inventories and offsets are exact; every original and
current pack hash reconstructs from its actual member bytes.

The original raw comparator fails on exactly Nine's 164-byte
`look/map` record, and that failure is retained. Its only changed field
is `map.tilesHash`: `c68ef3ed…17216` to `3020b0de…131a5`, equal to
current `mapTilesHash`. Reconstructing the full old source fingerprint
identifies only `generators/worldScenes.ts` and `generators/portalLook.ts`
metadata options among map inputs. The image remains exactly
`ce62e427…9fefd`; Driftwood and Pine stamps remain unchanged. Jake's
G872 ruling accepts this exact case only: no tolerance, stamp freeze or
weaker freshness check. All 62 weld registrations stay withdrawn.

The source-only six-primary remainder scan verifies each physical body
hash before filtering registered names. It reports 169 distinct names
after this candidate, not full-24 or current-product admission: CS3
scenes/sources 42, CS4 other ground 3, CS5 quests 14, CS6 actors and
programs 9, CS7 appearance/held/weather 25, CS8 encounters/riding 9,
CS9 headless/views 5, and the unchanged 62-name index-footprint exit.
Those family assignments are open ownership, not completed defining
contracts. For example, Driftwood keeper/return/quest row roots already
exist but still need complete source and approved-owner qualification;
Nalati's specimen/dressing roots still need their one-user/genericity
exit. **CS2 was still open at this slice**; its later completion ledger
assigns every concrete remainder without marking those migrations done.

### CS2 scene-family remainder: exact source traces

**2026-10-31, sp-x1, after `31bffc86fb`.** The forest-page request is
already satisfied by that accepted 23-document slice and its same
payload proof; no second forest-page publisher is required. The
42 distinct remaining scene-family names in the six-primary snapshot
split into two next native registrations, eight withheld living
envelopes, and 32 explicit source/contract exits below. This is source
evidence, not scene consolidation, host adoption or pixel qualification.

The two approved names, qualified below, are Pine `world/building-sites.json`, whose
complete `LivingPageSitesSchema` is consumed by
`game/shardfile/forestPage`, and Nalati `models/shape-book.json`, whose
complete `FixedDrawRowsSchema` is consumed by `game/models/fixedDraws`.
Their existing G571 forest-page and G602 fixed-draw approvals apply.
Hash-verified bodies are 963 B and 12,854 B; native-root feasibility
preserves them exactly. Seven off-tree controls pass, including missing
and foreign provenance refusal before reads. Metadata-only physical-index
projections add 790 B and 62 B respectively; these are not current-source
admission or an AFTER payload qualification. The two-name source stayed
off-tree through the director owner's checked registry handback.

**Eight living-cabin names are an explicit index-footprint exit.**
`cabinLivingContribution.ts` emits the complete
`LivingPageInputSchema` envelope `{graph,life,geometry}` at exactly
`scenes/cabins/living/{phone,desktop}-{false,true}-{false,true}.json`.
These eight names are distinct from all 62 withdrawn shell/specimen/
cast/fabric names. A read-only projection with the existing full native
schema takes Pine from **1,757,786 B to 1,984,106 B** before the pending
director metadata, leaving only 15,894 B below the unchanged 2,000,000 B
cap. Jake rejects this 0.8% headroom: keep Pine's index at or below
approximately **1.9 MB**. No living-envelope registration or new wire
root activates. Like the 62 welds, these eight wait for a separate
index-compaction row; neither the hard cap nor freshness is relaxed.

| Remaining exact names | Source/complete-contract evidence | Explicit exit |
|---|---|---|
| Nine `geometry/fixed-kits.json`, `geometry/layout.json`; DW `models/fixed-geometry.json` (3) | Nine `productOutput.ts` and `layoutBlobs.ts` use shard-local `FixedPracticeFileSchema` and `GeometryBootSchema`; DW `namedSchemas.ts` imports its shard-local `FixedGeometryGroupsSchema`. Native checks exist, but these are not shared format roots. | **CS3:** complete shared/approved document contracts before registration; preserve practice, layout, negative-zero and geometry/resource admission. |
| Nalati `models/cover-{phone,desktop}.json` (2) | `coverSpecimens.ts` calls `nameSpecimenBook`; the complete `SpecimenBookSchema` root is real, but these named-book emissions and `models/gear-book.json` have only Nalati as a demonstrated source user. | **CS3:** establish the second-user or exact one-user approval evidence for this root; shape equality alone gives no genericity or host credit. |
| Nine `signs/atlas-{phone,desktop}.json` (2) | `signAtlasOutput.ts` uses the shard-local `sections.ts#SignAtlasSchema`, with its exact glyph, light, pool and channel bindings. | **CS3:** shared atlas/native-resource contract or existing approved shader/model exit; retain the original complete sign parser. |
| DW `world/building-life.json` (1) | `namedSchemas.ts` composes `{look: BuildingLifeLook, life: BuildingLifeRows, initialDusk: number}` inline. The two native child roots do not define the whole envelope. | **CS3:** complete life-document root and original site owner; no child-only registration. |
| Nalati `world/dressing-{boulder,slab,juniper,rose,willow,lupin,reed,logs,stumps,ovoos,poles,fences,gates,drifts,colliders,clutter}.json` (16) | `dressingSchemas.ts#DRESSING_SCHEMAS` declares local instance, spot, log, fence, gate, drift, collider and clutter array grammars and re-encodes through their existing parsers. | **CS3**, with **CS4** for collider ownership: adopt complete native shared rows without changing doubles, resources or collision; no permissive array wrapper. |
| Nalati `world/dressing-{phone,desktop}.json` (2) | `dressingScene.ts` emits the complete `SceneDressingSchema`; `output.ts` then binds the original painted books without changing that metadata. G483 explicitly approves `game/shardfile/sceneDressing` and `sceneInstances` with unrelated orchard coverage (HOST-BAR); no new host score is claimed. | **CS3 scoped adoption done:** phone `1fadd8e67a` and desktop `d83676a5d4` retain their complete native root and original owners/resources; each passes its payload proof and strict affected-pose AA/AB at zero pixels. This closes these two names, not the wider CS3 row or a new host score. |
| DW `world/island/plan-{phone,desktop}.json` (2) | `productPageFiles.ts#driftwoodPlanBytes` encodes `islandCover.ts#bakeIslandPlan`; `IslandPlacementPlan` is a local interface with sets, families, small rocks and unclaimed boxes, not an exported complete native schema. | **CS3:** complete placement-plan contract and exact native collider/resource checks; do not infer a format root from the interface or bytes. |
| Far/Sun `world/sources/bakes.json`; Far `world/sources/{heroes,sky}.json`; Sun `world/sources/models.json` (4 distinct names) | `sdk/worldScenes#bakedSceneSourceFile` and `modelSceneSourceFile` emit `SceneBakeSource` / `SceneModelSource` interfaces with kind/inventory limits; downstream `game/shardfile/sceneSources` retains full resource/owner admission. X2's bakes audit finds the actual 321,049 B Far / 23,984 B Sun envelopes also carry GLB, hull, rig, rail, disc, anchor and other author leftovers outside the typed runtime subset. | **CS3 complete-contract exit:** no complete native format root admits that whole envelope. Do not register only the runtime fields, unknown extensions or an inferred shape. Model-source interfaces likewise remain a complete-root/resource-contract exit. |

The eight withheld living envelopes plus the table's 32 names account
for every scene-family remainder beyond the two approved next names.
The separate 62-name weld exit remains unchanged. Other CS2 families
are still audited in plan order. The existing all-product inventory
command currently refuses missing `out/_template/shard.json`; it is not
treated as a zero or silently skipped, and no full-product coverage is
claimed from the six-primary snapshot.

### CS6: complete shared director documents

**2026-10-31, sp-x6; agreed with sp-x1/sp-x2.** Driftwood and Pine now
name one complete `DirectorProductSchema` for `directors/main.json`.
The root retains declaration, module, stages, bindings and seed; its
structural draft-07 grammar equals the complete former composition.
Optional-file author admission and the native loader's named-file
refusal remain distinct. This registers two existing AS users; binary
hash agreement, stage bindings, owner retirement, fuel and fixed-step
order remain with their unchanged hosts. No legacy or rendering source
changes.

One coalesced normal AFTER publisher completes in **45.312 s**. The
requested DW/Pine/Nalati products and three program-bound discovery
products are all built by the ordinary producer. Independent strict
DW/Pine/Nalati readers accept current receipts. Exactly four defining
metadata records change: the two directors plus x1's separately landed
building-sites/shape-book pair. Both director JSON bodies (**2,828 /
4,514 B**) and their complete Wasm hashes are exact. Actual coalesced
indexes are DW **995,262 B**, Pine **1,763,458 B** and Nalati
**1,100,052 B**: below the unchanged 2 MB cap and Pine's about-1.9 MB
headroom target.

The raw comparator retains its failure on Nalati's sole **164 B**
`look/map` body change and the corresponding ordered-pack hash
propagation. Only `tilesHash` changes `ed7a40e2…61d7f3` to
`9ace4b97…488234`; the map image remains `80afaa55…aff2d6`. Full old/current
source reconstruction binds that change to the shape-book producer's
metadata expression. **G872 accepts this exact shared-proof case**;
no tolerance, frozen stamp, comparator change or blind retry is added.
The independent Pine/Nalati audit verifies all other **1,457 / 1,458**
primary payloads and reconstructs ordered pack offsets and hashes.
The three-product audit also reads all **2,001** listed payload/pack
records (**535,667,572 B**, including packed duplicates).

The combined original/new native suites first pass **66 / 67** controls.
The remaining chapter-wake fixture still emitted an unregistered
metadata shape and unused old bindings. It now supplies the exact
registered metadata and the real authored `bindings: null` envelope;
all original assertions remain unchanged, and its focused rerun passes
(**6.3 s**) without regeneration. Root types and named typed lint pass;
strict current readers pass again. The seven new controls retain full
envelope bounds and refusal of missing/foreign provenance before reads.

Evidence: `tmp/sp-x6-cs6-director/{proof-exits,audit-after}.json`,
`originals-after.log`, `fixture-focus.log`, and the independent
`tmp/sp-x1-cs2-next-scenes/{map-source-audit,audit}.json`. The latter
remains a separate raw failure plus case ruling. CS6 stays open for its
remaining population/keeper/return/roster/controller/custom families;
this slice does not retire the private bridge or claim a frame gain.

### CS2: building sites and fixed shape book

**2026-10-31, sp-x1.** Bind exactly Pine's existing
`world/building-sites.json` to `forestPage#LivingPageSitesSchema` and
Nalati's existing `models/shape-book.json` to
`fixedDraws#FixedDrawRowsSchema`. The G571 forest-page and G602 fixed-draw
approvals remain the authority. These are the original complete native
roots, not a child-only envelope, new host or physics owner. The SDK
names those two roots; only the existing emitter metadata options
change. Their encoded bodies, resource names, ordering and dependencies
remain unchanged. All eight living envelopes and all 62 welds remain
unregistered under the explicit index-footprint exits.

Seven native/provenance controls pass, including refusal of absent or
foreign defining metadata before payload reads; root/test types and
typed lint pass. Before emitter changes the ordinary Nalati read
correctly refused the stale namespace. Its hash-verified physical body
and immutable index were retained as historical before evidence, not
current admission, and no BEFORE generation was run.

One shared normal AFTER publisher takes 45.31 s for the director and
these two documents. Ordinary strict admission accepts all three
products and every new document. Actual indexes are Pine **1,763,458 B**
and Nalati **1,100,052 B**, below the approximately 1.9 MB Pine headroom
rule and unchanged 2 MB hard cap. The four original cabin-document,
Nalati native-shape, forest-page-feature and fixed-draw suites pass.
The director owner repairs its separate missing-metadata fixture before
the agreed director-first, then scene-facts HEAD-only landings.

The independent Pine/Nalati comparator covers **1,458 payload paths /
243,189,266 B**: 1,457 are byte-identical. Precisely the two approved
metadata records and the director owner's Pine metadata change in
these two indexes. Every custom schema and other index field is exact,
apart from ordinary refreshed build source/validator receipts. Ordered
pack members and offsets are exact; old and new pack hashes reconstruct.

The strict raw comparator still fails on exactly Nalati's 164-byte
`look/map` record. Only `map.tilesHash` changes, from `ed7a40e2…61d7f3`
to `9ace4b97…488234`, equal to current `mapTilesHash`. The full old source
fingerprint reconstructs; the sole changed map input is the shape-book
metadata option in `generators/output.ts`. The image remains exactly
`80afaa55…aff2d6`, and Pine's map stamp remains unchanged. Jake's G872
ruling accepts this exact case only, with no tolerance, stamp freeze or
weaker freshness. The original raw failure remains a failure.

### CS2 ground-family source remainder

The three remaining names at the `31bffc86fb` six-primary boundary
are traced separately; this is source/native feasibility, not emitted
AFTER proof or new host-bar credit.

| Name | Complete source contract and owner evidence | Disposition |
|---|---|---|
| DW `world/cover-composition.json` | `generators/output.ts` emits `sdk/rows#coverCompositionRows`; `namedSchemas.ts` already names `streamedCover.CoverComposition`. `format/streamedCover#CoverCompositionSchema` is the whole root, consumed by the original streamed-cover stage in `game/shardfile/worldAssembly` under G602. | Exact native metadata slice qualified below. The 99 B body/hash is unchanged; actual index metadata grows 68 B. Original stage loans and placement/object ownership remain; no collider movement. |
| Nalati `world/meadow.json` | `generators/output.ts` emits the original nativeField; both `game/population/environment#NativePopulationField` and `test/fixtures/nalati-headless.ts` parse the complete `PopulationFieldSchema`. G667 explicitly approves that exact one-user native field/driver/roster host; its tests 2-6 remain HOST-AUDIT work. | Complete-root metadata slice qualified below, not a new completed host audit. The 21,630 B body/hash is unchanged; actual index metadata grows 3,037 B. The complete riding-world/river/meadow/trail fields and all existing query/canonical physics checks remain. |
| Pine `data/physics.generated.json` | `sourceOutput.ts` emits `pinePhysicsOwnersBytes()` with shard-local `sections.ts#PinePhysicsOwnersSchema`, the exact `version`, `trees`, `kingHit`, `shelterTrees` subset of `PinePhysicsSchema`. `test/fixtures/pine-headless.ts` retains this separate owner document. | Explicit **CS4 complete-owner-contract exit**: the common `world/physics` move and its 75/75 walk do not make these remaining owner rows a shared format root. Preserve every profile/tree/King-hit/shelter owner check; no shard-local alias or ground-only wrapper. |

The source projections used unchanged canonical index encoding on
hash-verified physical indexes. The later qualification below supplies
current-source admission; this source table alone supplied none.

**Ground2 qualification, 2026-10-31:** register only those two existing
native roots and add the Nalati emitter's defining metadata option. DW's
existing registered-name adapter needs no emitter edit. The SDK appends
the PopulationField wire root without changing earlier shared-check
identities. Native schemas, encoders, payloads and consumers are unchanged.
No collider, physics owner, runtime or legacy source changes.

Thirteen new/original ground controls pass, as do root/test types and
touched typed lint. One normal AFTER takes **48.219 s**; its declared
DW/Nalati request rebuilds the six primary program-bound products through
the existing discovery closure. Independent strict admission accepts DW
and Nalati. The five original suites pass in **9.178 s**: world-cover
stage, meadow data, native-ground assembly, Nalati page-roster product
and direct headless admission, including the unchanged negative read
ordering. No BEFORE generation, walk, browser or timing claim is added.

The immutable DW/Nalati corpus covers **869 payload paths /
168,516,379 B**; **868 bodies are exact**, including both target JSONs.
Precisely the two defining metadata records change. Every other index
field and custom schema, ordered pack member and offset is exact; all
old/new pack hashes reconstruct. Actual indexes are DW **995,330 B**,
Nalati **1,103,154 B** and Pine **1,763,458 B**, retaining the roughly
1.9 MB Pine rule and unchanged hard 2 MB cap.

The raw comparator deliberately remains **FAIL** on the sole 164-byte
Nalati `look/map` source stamp, `f3f8719e…0e154e` to
`8b2d10bf…0d1648`. The old full source reconstructs; only `output.ts`'s
meadow metadata option changes among declared map inputs, and the new
stamp equals current `mapTilesHash`. The image remains exactly
`80afaa55…aff2d6`. G872 accepts this exact case only: no tolerance,
stamp freeze or weaker freshness check. Compact evidence is
`tmp/sp-x1-cs2-ground-audit/{strict,audit,map-source-audit}.json` and the
original-suite log. The remaining Pine owner document still exits to
CS4; no host-bar test or streaming work is credited by this metadata move.


### CS3 first phone-dressing slice

**2026-10-31, sp-x2; source `1fadd8e67ab58296d75fc5993cff71f9295f9a1b`.**
Bind only Nalati's existing `world/dressing-phone.json` to the complete
`format/sceneDressing#SceneDressingSchema`. The G483 world-scene-assembly
approval is recorded in `docs/HOST-BAR.md` and the existing pending-user
ledger; this is not a new host or a new six-test host-bar score. The SDK
already exposes that exact defining root. The original installer keeps
its full native reference/bounds parser, geometry/contact file admission,
entered-owner identity, deferred catalogue reads, failure cleanup and
lifetime. No resource name, binary word, draw/tier/shadow policy, schema
or default changes. Desktop remains unregistered by this slice.

The actual 872,825-byte phone document (`ce7d9916…9abd22`) parses under the
full native root without mutating the wire input. The defining grammar
is byte-identical; only its provenance comment is added. One ordinary
six-product AFTER build passes in **44.52 s**, followed by independent
strict-current admission for all six. The Nalati index grows by exactly
**65 B**, from 1,100,052 to **1,100,117 B**; Pine stays **1,763,458 B**.
The approximately 1.9 MB Pine headroom rule and hard 2 MB cap stay intact.

The pre-activation snapshot covers **3,009 actual payload paths /
484,714,621 B**. DW, Pine and Nalati were independently current after the
preceding coalesced proof; the other three before outputs are labelled
hash-verified historical oracles, not a fresh admission claim. No BEFORE
generation is run. **3,008 payloads are exact**; every other index field,
custom schema, ordered pack member, offset and reconstructed pack hash
is checked independently. Precisely one file's provenance metadata changes.

The raw body comparator remains **FAIL** on the sole 164-byte Nalati
`look/map` record. The full old source stamp reconstructs;
`map.tilesHash` changes from `9ace4b97…488234` to `f3f8719e…0e154e`,
the exact current `mapTilesHash`. Only `generators/dressingScene.ts`'s
import and phone metadata option changed among all declared map inputs.
The image stays `80afaa55…aff2d6`; all five other maps are unchanged.
G872 accepts this individual source-stamp case only: no tolerance,
stamp freeze, freshness waiver or changed guard.

Seven maintained admission controls and the original owner, file-only,
row and baked-file focus pass in **9.0 s**. The original product and
complete dressing-grammar consumers pass in **5.6 s**. Missing/foreign
metadata refuses before reads; raw omitted defaults stay omitted. Root
types and named typed lint pass; the source reaches `origin/main` with
the committed push gate green (**11.46 s**, no bad commit).

G612 explicitly authorizes **land, then measure** so the native preview
excludes old foreign working-tree renderer edits. The sealed normal
`--rev` pair is `578c36f-mvx25qtn` / full `578c36fb…abc5` before and
`1fadd8e-mvx38av9` / the full source SHA above after. The before pin also
predates the separately qualified grass range change, and the pair
includes intervening peer format metadata; the full source diff is
retained, not described as a pure-leaf or isolated timing experiment.
Both served phone bodies are independently hash-bound and identical.
No working-tree preview, mirror edit, response override or program loan
is used. The rejected working-tree idea launches no builder or browser.

Native Chromium/Metal (Apple M5 Max), iPhone 16 Pro **402×874 / DPR 2**,
uses three fresh controlled worlds and nine **804×1748 RGBA** frames.
At **P1, P2 and P3, both strict A/A and A/B differ by 0 pixels**:
no tolerance, whitelist, crop, colour adjustment or comparator change.
Per-pose native draws/triangles also match across all three worlds:
P1 **73 / 1,061,236**, P2 **73 / 1,192,327**, P3 **62 / 1,013,390**.
The maintained posed-world protocol retains native control and clocks,
world shadows and resource admission; its declared scope excludes post
and the camera-child viewmodel. This is pixel identity, not FPS,
physical Safari or desktop-quality qualification. Both own preview
leases and all browsers close normally; there is no attached cohort.

Compact evidence is `tmp/sp-x2-cs3-bake-source/{summary,
payload-after-audit,raw-comparison}.json`, `immutable-source-diff.txt`,
`physical-final.json`, `original-product-focus.log`, and
`pixels/reading.json` plus the nine untouched raw RGBA files. A malformed
lane-wrapper invocation refuses before browser creation; the corrected
invocation changes no capture policy. All six final comparisons pass.

**Explicit complete-contract exit:** Far/Sun `world/sources/bakes.json`
(321,049 / 23,984 B at this read) cannot be registered as the current
partial `SceneBakeSource` interface. Their emitted rows also carry
hulls/rigs/rails/discs or anchors/tip/along/braziers and other author
fields outside that interface. Preserve full resource, URL, material
and lifetime semantics; no unknown or child-only schema can launder
that envelope. CS3 remains open for a complete native contract and the
remaining scene/tier/placement work. No withdrawn weld or living-cabin
index-footprint candidate is reactivated here.

### CS2 remaining native roots and explicit exits

**2026-10-31, source audit after Ground2 `d0c35248f3`.** The following
tables replace broad family labels for the other **61 logical names**:
14 quest, 8 actor, 25 held/look/weather, 9 encounter/riding and 5
headless/view names. Names shared by shards count once. These are source
contracts and exit requirements, not another product build, current
admission, pixel proof or completed host-bar score. Every native parser's
additional checks and resource/guest ownership remain authoritative.
An existing root is a bounded future metadata candidate only after its
complete emitted envelope, approved user scope and index footprint pass;
this table does not register it or credit sibling hosts.

The six-primary historical inventory had 169 unregistered names after
the 23-name slice. Director, the two scene facts, phone dressing and
Ground2 remove six logical names, leaving **163** at this boundary:
39 scene names, 1 Pine owner document, these 61 names and the withdrawn
62 welds. The existing scene and ground tables account for the other
40 non-weld names, including the eight living-envelope footprint exits.
Desktop dressing and the cover books remain in the scene table; source
readiness alone does not remove them from this count.

**CS5 — all 14 quest names.** Source owners are Nalati `generators/output.ts`,
Pine `generators/sourceOutput.ts` / `forestStory.ts`, and DW
`generators/output.ts` / `namedSchemas.ts`, unless specified otherwise.

| Exact logical name / user | Native root or concrete exit |
|---|---|
| Nalati `quests/carried.json` | `format/questSteps#CarriedQuestSchema` and `parseCarriedQuest`; G601 C8 covers the exact carried-prop/player/mount owner. Preserve the AS decisions, finite floors/goals/services and differential Kokpar controls; metadata proof remains CS5 work. |
| Nalati `quests/chapters.json` | `format/questStory#parseChapterStoryPresentation` uses the private `ChapterPresentation` root. Explicit **CS5 public whole-presentation-contract exit**: do not register the optional child of QuestStorySchema or an inferred wrapper. |
| Nalati `quests/content.json` | `format/questPageComposition#ChapterViewSchema` admits the body but its nested figure parsers strip frame `file`/`height`/`radius` and child/cook `idleArm`/`idleHead` fields. Explicit **CS5 complete chapter/figure-envelope exit**: a successful outer parse is not a complete contract for the emitted body. Retain every original figure/view field; do not normalize or rewrite the payload. |
| Pine `quests/contracts.json` | `format/contracts#ContractCatalogueSchema` / `parseContractCatalogue`; `sourceOutput.ts#contractModule` emits the original compiled script with empty embedded bytes. Retain module/program admission and full catalogue semantics, not merely its board rows. |
| DW `quests/discovery.json` | Shard-local strict places/guide/glassCount/shardFlags grammar in `namedSchemas.ts`. Explicit **CS5 complete shared discovery/guide-contract exit**; no common root is demonstrated. |
| Nalati `quests/finds.json` | `format/findsCatalogue#FindsCatalogueSchema` / `parseFindsCatalogue`, used by `sdk/finds` and `generators/finds.ts`. Retain flags/owned/counters and qualify the actual user scope; a single producer is not a second host. |
| Pine `quests/forest-story.json` | `forestStory.ts#forestStoryContract` composes a partial board/store/talks schema while the body also owns world/map/pool/cable/mover rows. Explicit **CS5 whole-story-envelope / CS9 view exit**; native child roots do not cover the document. |
| DW `quests/hints.json` | `format/questSteps#QuestHintRowsSchema` / `parseQuestHintRows`. G571's entered-hints/flag-binding scope is exact: preserve `installQuestHints`, `installQuestHintFile` and chapter flag publication; no module-wide waiver. |
| DW `quests/interaction-source.json` | `output.ts` emits the inline `interactionWireSchema` over `constants.interact` and authored interaction spots through `nameGuestBlob`. Explicit **CS5/CS9 closed guest-input-envelope exit**, not a generic unknown-constants map. |
| Pine `quests/native-spots.json` | `format/nativeQuestComposition#NativeQuestServiceSpotsSchema` / `parseNativeQuestServiceSpots`, including rows/people/board/pickup/cable/signals and native checks. Preserve referenced services and their existing loans; qualify this exact named root. |
| Pine `quests/native-story.json` | `format/nativeQuestComposition#NativeQuestCompositionSchema` / `parseNativeQuestComposition`. Both Pine and DW `generators/nativeQuest.ts` use this root; DW embeds its rows in the assembly. G571 covers the exact quest-entry prefix/capabilities, not unrelated guide/director hosts. |
| Pine and Nalati `quests/panels.json` | Inline record of `PanelDefinitionSchema` in Pine and `{name: parsePanelDefinition(...)}` in Nalati. Explicit **CS5 complete shared panel-catalogue root exit**; a panel child schema alone is insufficient. |
| DW `quests/steps.json` | `format/questSteps#QuestStepRowsSchema` / `parseQuestStepRows`, already named in DW `namedSchemas.ts`. Preserve step/group/order checks. No second direct producer is established merely by Pine importing the type. |
| DW `quests/wake-boss.json` | `format/chapterDirector#ChapterWakeSchema`, already named by the producer. Retain encounter/program ownership and the SDK's existing stable `WakeEncounterSchema` shared-check identity; no sibling director approval is inferred. |

**CS6 — all 8 actor/population names.** X6's existing hash-bound actual-body
audit covers keeper, returns, roster, elites, sheep and wildlife. Its
native parses and conversion probes are feasibility evidence, not
current admission or completed production hosts. No duplicate producer
or implementation is started by this source table.

| Exact logical name / user | Native root or concrete exit |
|---|---|
| Pine `actors/elites.json` | `format/eliteFeature#EliteFeatureSchema`, plus `parseEliteFeature` / catalogue `readEliteFeature` checks. Preserve the full feature/owner graph and catalogue admission; CS6 owns the bounded metadata slice. |
| Pine `actors/roster.json` | `format/populationRoster#NativePopulationRowsSchema` plus `parseNativePopulationRows`. Preserve row identities and additional parser rules. The retained 250,356 B body's projected 9,471 B metadata addition is below the roughly 1.9 MB Pine rule, not a current-index proof. |
| Nalati `actors/sheep.json` | `SpeciesActorsFileSchema` admits `page.world` and `page.specimen` as unknown. Their actual private grammar is `game/ambient/crowdPage#PageCrowdsSchema`. Explicit **CS6 complete crowd-envelope exit**; a successful outer parse cannot launder those unknown children. |
| Nalati `actors/wildlife.json` | `format/wildlifePopulation#WildlifePopulationSchema` parses the actual body, but conversion refuses three unbridged checks: resume values zero/unique, notices unique, knockdown minimum no greater than maximum. Explicit **CS6 native-check bridge exit**; do not bypass any predicate. |
| DW `sim/enemy-placement.json` | Shard-local `sections.ts#EnemyPlacementsSchema`. Explicit **CS6 complete native-placement-contract exit**; keeper/returns approval does not qualify this sibling. |
| DW `sim/keeper.json` | `format/populationKeeper#PopulationKeeperRowsSchema`. The actual native consumer traced is `test/fixtures/native-hosts/population/mixedRoster.ts#installMixedPopulation`; production-host completion is not demonstrated. Retain that distinction in the CS6 slice. |
| Nalati `sim/population-metadata.json` | `sdk/nativePopulationRows#namePopulationHabitat` builds a contextual schema: trees/tops exactly match `treeCount`, ledges obey `maxLedges`, marmots retain ForagerContinuation. Explicit **CS6 contextual habitat-contract exit**; replacing exact lengths with an unbounded shared array would weaken admission. |
| DW `sim/returns.json` | `format/namedJsonContracts#PageReturnRowsSchema` with the original `installPageReturns`. ReturnProgram/script fields retain their separate closed guest admission; the JSON root does not validate executable code by itself. |

The existing wildlife evidence is
`tmp/sp-x6-cs6-audit/{family-feasibility,wildlife-checks}.json`; those
checks remain refused rather than converted with a permissive fallback.

**CS7 — all 25 held, look and weather names.** Existing source roots below
do not authorize a pixel change or replace the original resource/owner
checks. Pine source is `sourceOutput.ts` or `rangedPage.ts`; Nalati source
is `output.ts` and its named generator; Nine source is `productOutput.ts`;
DW's monkey envelope is in `namedSchemas.ts`.

| Exact logical name / user | Native root or concrete exit |
|---|---|
| Pine `client/ranged-page.json` | `format/rangedPage#RangedPageSchema`, parsed through `sdk/rows`; qualify the whole entered page and original held/audio ownership, not just a projectile field. |
| Nalati `held/slots.json` | `format/heldArms#HeldSlotsSchema` / `parseHeldSlots`, authored by `heldSlots.ts` through `sdk/rows`. Preserve slot references, distinct identities, blade sources and admission order. |
| Pine `loadout/finishes.json` | Authored `WEAPON_FINISHES` in `weaponFinishes.ts`; no complete shared catalogue root is traced. Explicit **CS7 finishes-catalogue contract exit**. |
| Pine `look/cover-appearance.json` | `format/coverAppearance#CoverAppearanceSchema` / `parseCoverAppearance`; the producer includes its original texture rows. Retain the full JSON and native texture/resource checks. |
| Nalati `look/post.json` | `format/postGraphLook#PostGraphLookSchema`; `output.ts#postLook` merges the existing graph and painted fog/air/ground/tiles/capture/grass/world rows. Retain the whole strict post root and original look owner; no appearance change. |
| Nalati `models/gear-book.json` | `format/specimenCatalogue#SpecimenBookSchema` through `nameSpecimenBook`. Explicit **CS3 complete specimen owner/genericity exit** shared with the cover books; one shard's repeated use alone does not establish the approved user scope. |
| Nine `models/held-cards.json` | `format/heldArms#HeldGraphCardsSchema`, matching the complete authored `data/heldCards.json` kind/slug/file/cards envelope. G601 C10 covers the exact graph held-card framing; keep cold-entry resource, size and settle-frame limits. |
| DW `poses/monkey.json` | Inline composed clips tuple/ReturnProgram/mixed-population perch wrapper. Explicit **CS7 complete pose/guest-envelope exit**; the child pose and return roots are insufficient. |
| Nalati `weapons/bow-page.json` | `format/weaponProfiles#HeldBowFileSchema`: complete pool/bow/base envelope. Retain original baked pool bytes, strings and native dependency admission. |
| Nine `weapons/jian-cloth.json` | Map of original Three geometry JSON with fixed UUIDs. Explicit **CS7 model-library/binary exit**, not a new inferred geometry-JSON schema. |
| Nine `weapons/jian-halo.json` | Original geometry/material Three JSON pair with fixed UUIDs. Explicit **CS7 model-library/binary exit** retaining full material/resource semantics. |
| Nine `weapons/jian-row.json` | Inline equipment/held-view/viewmodel/post envelope in `productOutput.ts`; native child roots cover only portions. Explicit **CS7 complete held/post contract exit**. |
| Nalati `weapons/rifle-model.json` | `format/weaponProfiles#HeldFirearmRowsSchema` / `parseHeldFirearmRows`, authored by `rifleRows.ts`. Preserve native row/view constraints and all referenced model parts. |
| Nalati `weapons/rifle-page.json` | Existing `format/weaponProfiles#HeldFirearmPageSchema`; retain its original view/profile/rows/resource admission, including the native semantics of the non-strict object parser. No stricter inferred envelope is introduced. |
| Nalati `weapons/sabre.json` | Inline model rows plus blade program, power program and parts. Explicit **CS7 complete model/guest/power-envelope exit**; no child-only held-model registration. |
| Nalati `weapons/spear.json` | Inline spear rows plus polearm program and presentation. Explicit **CS7 complete polearm/guest-envelope exit**, retaining executable ownership. |
| Pine `world/ambience.json` | Shard-local `sections.ts#CabinAmbienceSchema`, parsed before emission. Explicit **CS7 complete shared ambience-contract exit**; do not alias the shard-local root. |
| Sun `world/places-effects.json` | `worldScenes.ts` derives an array of lamp/fire effects with prefixed part IDs. Explicit **CS7 complete effect-catalogue exit**; individual source/lamp/fire children do not define the whole array. |
| Pine `world/prop-shapes.json` | `sourceOutput.ts` serializes the `timberWorldRows` prop-shape projection. Explicit **CS7 complete prop-shape contract exit**; preserve native placement/collider owners if this later moves. |
| Pine `world/props.json` | The same producer serializes the original props projection. Explicit **CS7 complete prop catalogue/owner exit**, not an arbitrary record wrapper. |
| Pine `world/rain.json` | `format/rainPresentation#RainPresentationSchema` through `sdk/rows`, emitted by `rangedPage.ts`. Preserve entered emitter, material and lifetime ownership. |
| Nalati `world/water.json` | Full body is surface/terrain/placeSets/practice; attached loose schema validates only `practice:RidingPracticeSchema`. Explicit **CS7 complete water-envelope exit**; the child grammar does not qualify the other fields. |
| Nalati `world/weather-fx.json` | Inline presentation spread plus sky in `output.ts`. Explicit **CS7 complete weather-FX contract exit**; do not infer a wrapper from the emitted sample. |
| Pine `world/weather-observations.json` | `format/rangedPage#ForestWeatherObservationSchema` through `sdk/rows`, emitted by `rangedPage.ts`; preserve exact page/audio/guide references. |
| Pine and Nalati `world/weather.json` | Pine emits a plain parsed weather program, Nalati emits `{weather,reactions}`. Explicit **CS7 same-name contract collision**: no union, wrapper, renamed payload or byte change in CS2. |

**CS8 — all 9 encounter/riding names.** Source is Nalati `output.ts`,
except Pine `generators/roamingCombat.ts`. Closed encounter, rider,
collision, script and view owners remain charged to their existing rows.

| Exact logical name / user | Native root or concrete exit |
|---|---|
| Pine `combat/roaming.json` | `format/roamingCombat#RoamingCombatSchema` / `parseRoamingCombat`, already emitted with the named native schema. Qualify its exact root and retain original combat loans; no generic encounter score. |
| Nalati `combat/room-entry.json` | Body contains room/view plus encounter/definition/program, but attached strict schema makes both children unknown. Explicit **CS8 complete room/King-envelope exit**; unknown children are not a complete native contract. |
| Nalati `combat/timed-encounters.json` | `format/encounterRows#TimedEncountersSchema` is deliberately loose to retain other source fields. Explicit **CS8 full source-binding envelope exit** beyond its native slot/patrol/view subset; preserve G601 C6's exact lifecycle and contact checks. |
| Nalati `combat/titan-fight.json` | `format/arenaScriptRows#ArenaScriptFightFileSchema` validates arenaScript/programs/arenaFire while retaining extra King and room rows. Explicit **CS8 complete fight/King/room exit**; do not promote the loose subset as the whole grammar. |
| Nalati `combat/titan-geometry.json` | `ArenaScriptGeometrySchema` retains loose body rows and unknown eyes/poses/flames. Explicit **CS8 complete geometry/pose contract exit**, preserving both tiers, native bounds and pose ordering. |
| Nalati `models/cloud-specimen.json` | `format/encounterRows#CloudSpecimenSchema` names the whole outer document, but its `CloudBodySchema.poses` remains unknown. Explicit **CS8 complete pose/native-view contract exit** before calling that a complete payload contract. Preserve both native tiers, ports and resource owners; a successful outer parse alone is insufficient. |
| Nalati `ride/rules.json` | `ridingWireOf` drops only `NalatiRidingPrograms.compiled` and emits the rest. Explicit **CS8 complete compiled riding-program wire/ABI exit**; NativeRidingSchema is only a child and cannot label this envelope. |
| Nalati `riding/mounted-figure.json` | `format/mountedSpecimenRows#MountedSpecimenSeatSchema`, already attached by the producer. Preserve native seat/figure/resource admission and qualify its exact user scope. |
| Nalati `riding/session.json` | `format/riding#ClientRidingSessionSchema`, authored through `nalatiRidingSession`: preset/programs/profile/roads/rest/taming/naming/figure. Retain the original closed ReturnProgram and riding-owner admission; a JSON root alone does not qualify executable code. |

**CS9 — all 5 headless/view names.** Previous derivation slices removed
duplicate fields, not the complete remaining envelopes below. Every
maintained replay, admission ordering and original negative stays intact.

| Exact logical name / user | Native root or concrete exit |
|---|---|
| DW/Pine/Nalati/Nine `sim/headless-assembly.json` | DW/Nalati/Nine retain the trusted declaration scaffold. Pine `892e75d553` retires its unused shell and preserves its exact constants-only native transport. Distinct constants and native closures still require the **CS9 platform-section derivation/closed assembly exit**, not a permissive constants registration or a union of samples. |
| Nalati `sim/headless-boot.json` | Compound headlessBoot/worldUpdates/combatTargets/hunt/admission/pasture/riding wire in `output.ts`. Explicit **CS9 typed boot-owner/derivation exit**; no complete shared root covers the whole compound body. |
| Nine `sim/headless-constants.json` | `productOutput.ts` emits constants plus entryProof used by grapple and portal capabilities. Explicit **CS9 complete constants/entry-proof derivation exit**; no unknown record may replace native capabilities. |
| Nalati `sim/taming-poses.json` | Shard-local `generators/tamingPoseRows.ts#NalatiTamingPoseRows`; construction checks at most 32 bones and parent-before-child order. Explicit **CS9 complete pose/joint contract exit**, preserving numeric bits, gait/pose defaults, hierarchy and original source bounds. |
| Pine `world/landmark-view.json` | `forestPage.ts` serializes `timberWorldRows`' local landmark view/book projection. Explicit **CS9/CS3 complete native-view derivation exit**; no shared whole root is demonstrated. |

The other **18 modern products** are checked in source without reading
either legacy family: `_template/generators/productOutput.ts` emits a
named Wasm blob and platform rows; `blender-template/generators/ground.ts`
emits one GLB, two images and platform rows; pastel-plain and ink-cel-valley
return empty ProjectOutput objects; open-plots' 14 declared programs in
`generators/product.ts` return only their world and map pixels. None
declares private named JSON through those output paths. This is a source
census, not a successful full-output scan: the ordinary all-product
inventory still honestly refuses absent `out/_template/shard.json`.
No missing product is silently skipped, treated as zero or rebuilt here.

**Intermediate source audit.** This table names the native root or concrete
CS3-CS9/index-footprint exit for every remaining six-primary name, but
the ready native-root slices still need their ordinary defining-metadata
and payload proofs. Complete-contract, user-scope, unbridged-check and
index exits remain open work in their owning rows; they are not evidence
that the private bridge can be removed. Pine stays at or below roughly
1.9 MB, with the unchanged hard 2 MB cap. No new schema, runtime, guest,
pixel path, collider or producer is activated by these tables.

### CS2 quest-family slice preparation

**2026-10-31, source-only/off-tree; no machine turn, build or native run.**
The next family is now split into three bounded metadata candidates,
using seven existing complete native roots. A private candidate adds the
exact registry names and dispatches through the **full parser**, not just
`v.parse`: step/guard identity, hint control uniqueness, wake identities,
saved-role/dependency policy, native spot identities, contract references
and carried continuation checks are all preserved. No new schema grammar
or gameplay service is introduced. No common file or emitter is physically
activated by this preparation; X2's desktop source turn is preserved.

| Bounded future slice | Exact source delta prepared off-tree | Historical physical index projection, not current admission |
|---|---|---|
| DW `quests/steps.json`, `quests/hints.json`, `quests/wake-boss.json` | One additive registry hunk; existing `QuestStepRowsSchema`/`parseQuestStepRows`, `QuestHintRowsSchema`/`parseQuestHintRows`, `ChapterWakeSchema`/`parseChapterWake`. The SDK already exposes all three roots. The original registry-first `driftwoodJsonBlob` needs **no emitter or encoder edit**. | Defining metadata only: +62 / +62 / +65 B; DW 995,330 to **995,519 B** combined. |
| Pine `quests/native-story.json`, `quests/native-spots.json`, `quests/contracts.json` | Additive registry entries using complete `parseNativeQuestComposition`, `parseNativeQuestServiceSpots`, `parseContractCatalogue`; append the first two defining SDK wire roots, retaining all existing check identities. Only three `sourceOutput.ts` metadata options change. Compiled modules and every serializer expression remain original. | +83 / +84 / +65 B; Pine 1,762,914 to **1,763,146 B** combined, below the roughly 1.9 MB rule. |
| Nalati `quests/carried.json` | Exact `CarriedQuestSchema` plus `parseCarriedQuest`; append its defining SDK root and change only the original carried blob's metadata option. Existing G601 C8 player/mount/AS/resource and continuation ownership stays intact. | +61 B; Nalati 1,103,219 to **1,103,280 B**. |

Nine actual documents pass their original native parsers without raw
input mutation. The seven candidates also return exactly the complete
wire value and retain their existing JSON grammar byte-for-structure;
only defining provenance is added. Twenty-one off-tree controls pass
in **1.5 s**: whole-root/body identity, native semantic refusals beyond
the structural schema, and missing/foreign metadata before any payload
read. The private registry/SDK/test candidate passes strict TypeScript
against the repository's normal layer references. The actual emitted DW
steps array is empty; its duplicate-step negative uses an explicitly
unplayed, structurally valid two-step fixture rather than pretending the
physical body contains a step. No native state or authored grant is used.

The probe finds two concrete exclusions among the nine roots. Chapter
content retains the complete-figure-envelope exit above: its parser
accepts but strips the listed source fields. Nalati `quests/finds.json`
passes `FindsCatalogueSchema` and projects +3,449 B, but its live owner is
still the pending single-user `game/bag/findsCatalogue` G441 row. No exact
root/user approval is established; keep an explicit **CS5/CS7 owner and
genericity exit**, not a schema-shape credit. The other five quest names
already have exact inline/private/partial-envelope exits in the CS5 table.
Thus all 14 names have either a concrete prepared slice or an explicit
remaining exit; none is silently counted as completed metadata work.

Compact source preparation is
`tmp/sp-x1-cs2-quest-ready/{source-base,feasibility}.json`, the additive
registry/SDK/emitter patches, and `ready-final.log` / `types-final.log`.
Each patch must rebase onto its owner's checked common-file handback;
these physical-body projections do not certify a future source tuple.
At the granted proof turn, snapshot the actual current baseline before
activation, use one normal AFTER for the admitted slice, and retain the
strict body/pack comparator and every original consumer assertion. The
original step/hint runner and chapter-wake suites, Pine native quest and
contract admission/product suites, and carried-host/Kokpar controls are
the corresponding retained consumers. No source-stamp waiver, BEFORE
generation, index compaction, cap increase or collider change is prepared.

The combined 21 controls also pass with each of the three registry/SDK
slices loaded **independently** (9 DW, 9 Pine and 3 carried controls;
1.4 s per focus). This catches missing defining SDK roots as well as
cross-slice check-identity changes; the Pine pair and carried root are
appended rather than reordered among old roots. The three explicit
`source.patch` files remain off-tree in the respective `dw`, `pine` and
`carried` subdirectories. No code landing is implied by the docs receipt.

### CS2 held/look and encounter feasibility follow-through

**Source-only, no world or producer:** a second hash-bound probe admits
14 actual held/look/weather/encounter/riding documents under their named
native roots without input mutation. No parsed output loses wire fields
in those 14 probes, but that is not proof of complete nested grammar or
host ownership. Eleven roots convert; **three refuse honestly**. The
plain probes and exact predicate paths are retained in
`tmp/sp-x1-cs2-native-remainder/{feasibility,checks}.json`.

| Exact next source group | Result and bounded action / exit |
|---|---|
| Pine `client/ranged-page.json`, `world/weather-observations.json`, `look/cover-appearance.json` | Native roots and complete actual wire values agree. Full defining metadata projects +5,842 / +403 / +1,857 B respectively; together Pine would be **1,771,016 B** on the 1,762,914 B historical index. Retain the existing ranged/cover owners and their original admission tests; source patch and native-resource controls are the next CS7 preparation, not a current-source or pixel claim. |
| Pine `world/rain.json` | Native parse succeeds, but conversion refuses `water.transition`'s **ordered reveal band** check, `reveal[0] < reveal[1]`. Explicit **CS7 native-check bridge exit**; keep the predicate and original rain wire, with no permissive converter fallback. |
| Nalati `held/slots.json`, `weapons/bow-page.json` | Existing native roots and wire grammar match exactly; provenance-only projections are +56 / +64 B. A future bounded slice must retain `parseHeldSlots`' complete reference/identity policy and all original baked bow dependencies; no new equipment or pose owner is introduced. |
| Nine `models/held-cards.json` | Full `HeldGraphCardsSchema` admits the actual card envelope; +1,160 B defining metadata, projected index **1,062,489 B**. Preserve G601 C10's concrete cold-card/frame/resource limits; full native controls and source patch remain CS7 preparation. |
| Nalati `look/post.json` | Conversion refuses Unicode regex flags before reaching further pass/uniform/input bounds, RGB triples and channel safety/identity predicates. Explicit **CS7 exact regex/native-check bridge exit**; do not strip flags or omit the later checks. No post graph or pixel change is prepared. |
| Nalati `weapons/rifle-model.json`, `weapons/rifle-page.json` | Actual native parses retain all source fields; projections +8,842 / +68 B. Their playback group/input rows still contain unknown grammar and require the original closed playback/field-loan owner checks. Keep the **CS7 complete playback-envelope exit** until those exact checks and scope are demonstrated; no unknown-field wrapper is registered. |
| Pine `combat/roaming.json` | Existing whole root parses and its attached grammar is exact; provenance projects +65 B. Retain the native combat/loadout/body/persistence loans and original encounter controls. This is a future CS8 metadata slice, not another host score. |
| Nalati `models/cloud-specimen.json` | Outer native parse and attached grammar agree, but cloud-body poses remain unknown. Keep the **CS8 complete pose/native-view exit** above; the small +65 B projection does not override that missing contract. |
| Nalati `riding/mounted-figure.json` | Native root and existing grammar agree, +77 B. Both actual shape rows use the admitted binary-file/baked-geometry branch with attrs/box/count/expand/index/indexCount, not the legacy loose inline geometry branch. Retain G603 L10's original mounted/figure/clip/resource checks for a future bounded slice; do not broaden that branch's approval. |
| Nalati `riding/session.json` | Conversion refuses native checks in the existing controls/panel graph, including **distinct foot/mounted/breaking contexts** and safe action paths. Explicit **CS8 exact native-check bridge exit**; no dropped predicate or changed input context. |

These source results refine the earlier root/exit matrix; they do not
activate any of these 14 names. Together with X6's separate population
check witnesses, they show why a successful schema parse or small index
delta alone does not qualify a root. Only the seven quest aliases above
have concrete tested off-tree source patches ready for their normal
proof turn. Those implementation exits remain open, and no machine reservation is needed to
continue the remaining native-control/source preparation.

### CS2: Driftwood step, hint and wake aliases

**2026-10-31, qualified after the ordered keeper/returns landing
`94cd0e375e`.** Register only `quests/steps.json`, `quests/hints.json`
and `quests/wake-boss.json` on their existing defining roots. Dispatch
through `parseQuestStepRows`, `parseQuestHintRows` and `parseChapterWake`,
retaining duplicate step/guard/control/cue refusal, phase/event binding,
native owner identities and every existing dependency. The SDK already
exposes these three roots. The registry-first DW adapter needs no emitter
or encoder edit; this slice adds no runtime, guest, clock or save owner.

The positive held-hint fixture uses the real `fixtureProductFile` and
paced `fixtureJsonCheck`, preserving every original replacement,
retirement, held-read and exact feed/event/system assertion. The named
producer expectation keeps its entire original native grammar and adds
only the exact defining comment. Deliberate malformed metadata remains
malformed; no synthetic payload, trusted bypass or relaxed guard is used.
Ten new controls include a detached negative-zero fixture and original
native semantic refusals; that fixture is never played or admitted to a
native continuation. Root/test types and touched typed lint pass.

The one coalesced DW/Nalati AFTER takes **45.403 s** and admits all five
DW documents through ordinary strict readers. Both products are current.
The combined **8 original/new suites / 36 cases pass in 17.046 s**,
including the four keeper/returns controls, ten quest controls, original
mixed-population/ecology queue, held-hint owners, named producers, chapter
wake and quest presentation. The separate original step/hint runner
already passes in the five-suite **6.3 s** functional focus. No extra
generation, browser, walk or native tape is run for this slice.

All **469 DW payloads / 79,885,949 B** are byte-identical. Precisely five
defining metadata records change: these three plus the preceding peer
keeper/returns pair. All other index fields and custom schemas, ordered
pack members, offsets and reconstructed hashes are exact. The raw
comparator exits **0**: DW map stamp `92629a77…2eae76` and image
`c0c1482d…45b28f` are unchanged. **No G872 stamp exception or tolerance
is needed.** Nalati's independently reconstructed qualified desktop
corpus also retains all **400 payloads / 88,630,430 B**, every metadata
record and all ordered packs exactly.

Actual indexes are DW **995,665 B**, Nalati **1,103,219 B** and Pine
**1,762,914 B**. Pine retains the roughly 1.9 MB rule and hard 2 MB cap.
The shared registry's peer-owned two-name HEAD patch lands first; this
three-name patch preserves those exact roots and the append-only return
wire root. The seven qualified physical source hashes remain unchanged
through the proof and ordered landings. Evidence is
`tmp/sp-x1-cs5-dw/{source-final,strict,audit,map-source-audit}.json` and
`tmp/sp-x6-cs6-population/dw/{proof-exits,nalati-unchanged}.json` plus the
original-suite log. The four prepared Pine/carried aliases remain
off-tree for a later source/proof boundary. The remaining CS5
contract/owner exits stay open; this metadata move completes no new host.

## CS6: retire the duplicate Pine grazers section

The complete source audit finds no live reader of `custom/grazers`.
A bare-basename `git grep` across every tracked importer, including
`test/`, separates Pine's two generator imports from unrelated platform
`grazers` modules and historical records. `nativeView` remains the live
Pine importer. `grazerRows()` and `hullBody()` construct fresh authored
rows without RNG or generation counters; their existing species and body
owners remain unchanged.

The 8,015-byte custom value is exactly the deer/elk `definitions` already
admitted in the 114,696-byte `look/hull-book` by
`format/speciesLooks#HullLookBookSchema` and its reference-checking
`game/looks/speciesBook#HullLookBook` owner. Both species retain their
original native and page rows in the 16,847-byte
`actors/species-programs`. This slice removes only the duplicate emission
and its 19,817-byte defining custom schema. It keeps the authored grazer
module, hull book, species programs, rigged bodies and native/page owners;
there is no new host, AS, tick, rendering, physics or legacy path.

The one normal coalesced Pine/Nalati AFTER publisher completes in
**48.352 s**, with independent ordinary strict admission for both products.
Pine removes exactly the one **8,015 B** document and its **19,817 B**
defining schema. All **1,056** retained primary payloads /
**154,531,004 B** and every other descriptor remain exact; all
ordered pack bytes, members, offsets and hashes reconstruct from only
those removals. The index changes **1,763,458 → 1,762,914 B**,
retaining the about-1.9 MB headroom target and unchanged 2 MB admission.

The new complete-owner/refusal controls and original hull/species suites
pass. Root types and named typed lint pass. No pixel or frame-time gain
is claimed. Evidence: `tmp/sp-x6-cs6-grazers/proof-exits.json` and
`payload-after.json`; Nalati's separately owned metadata/source-stamp
proof is not a Pine exemption.

The remaining approved slices stay separate: Driftwood `sim/keeper.json`
names `PopulationKeeperRowsSchema` (its traced native consumer is the
mixed-roster **test fixture**, not production-host completion), and
`sim/returns.json` names `PageReturnRowsSchema` while preserving the native
return-program/queue owner. Pine `actors/roster.json` retains
`parseNativePopulationRows`, including cross-row bounds; `actors/elites.json`
retains `parseEliteFeature` and the existing spawn-catalogue owner checks.
Their projected combined Pine index is 1,780,123 B before this retirement,
below the approximately 1.9 MB headroom rule and unchanged 2 MB hard cap.
Each requires its own full-payload and native-consumer proof.

Nalati sheep remain an explicit whole-crowd-page-contract exit: the nominal
species-actors root leaves `page.world` and `specimen` unknown. Wildlife
retains its complete native root but cannot yet cross the wire bridge:
resume-value membership/uniqueness, notice-signal uniqueness and knockdown
min/max checks must each be bridged intact. No unknown check, child root,
or sibling G667 approval substitutes for these owners.

### CS6: complete keeper and page-return documents

**Done for these two metadata bindings (2026-10-31, sp-x6).** Driftwood
`sim/keeper.json` now names the existing complete
`PopulationKeeperRowsSchema`; `sim/returns.json` names
`PageReturnRowsSchema`. The old logical names, bodies, field admission
and native owners are unchanged. Keeper's traced native consumer is
`test/fixtures/native-hosts/population/mixedRoster.ts#installMixedPopulation`,
including its body/roster/practice-slot checks. This registration is not
a claim of a new or completed production host. Page returns retain the
existing `ReturnProgram.page` declaration/module/loan checks, native
respawn queue, event order, eligibility, terrain retry and spawn RNG.
The existing unknown program envelope is not replaced by an inferred
schema or treated as admission of the guest.

The SDK adds only the page-return wire root, appended after all previous
roots so shared-check identities keep first-seen order. Nine off-tree
native/wire/body controls pass; all **224** original wire contracts remain
exact. Four maintained controls cover actual canonical bodies, complete
native fields, malformed rows and refusal of missing/foreign defining
provenance before reads. Original mixed-population and respawn/guest
controls remain unchanged.

One cause-directed normal coalesced DW/Nalati AFTER completes in
**45.403 s** after ordinary current admission honestly refuses the new
source tuple. No BEFORE product is generated and no refusal is bypassed.
Independent strict readers then accept both current products and all
five agreed DW logical documents. All **469 DW payloads / 79,885,949 B**
and all ordered pack bodies, members, offsets and hashes are exact.
Only five metadata records change across this slice and x1's separate
steps/hints/wake slice; keeper/returns add **75 / 71 B**. The actual DW
index is **995,665 B**. Map stamp `92629a77…2eae76` and image
`c0c1482d…45b28f` remain exact: the raw audit passes without a G872 case.

The independent Nalati comparison retains all **400 payloads /
88,630,430 B**, metadata and ordered packs exactly against the qualified
desktop corpus; index **1,103,219 B**. That corpus is reconstructed from
its sealed earlier baseline and qualified exact-field audit, not claimed
as a fresh current BEFORE. Pine remains **1,762,914 B**, below the
about-1.9 MB target and unchanged 2 MB cap. Eight combined native/owner
suites pass **36 controls / 17.046 s**; root types and named typed lint
pass. No host, AS, tick, physics, legacy, rendering or frame-gain change.

Evidence: `tmp/sp-x6-cs6-population/dw/{proof-exits,nalati-unchanged}.json`
and `originals-after.log`; independent
`tmp/sp-x1-cs5-dw/{audit,strict,map-source-audit}.json`. The initial
maintained-suite stale-product refusal remains in `physical-controls.log`.
CS6 stays open for roster/elites and the documented whole-contract exits.


### CS3 desktop dressing counterpart

**2026-10-31, sp-x2; source `d83676a5d4092d1a073bd0e89def590ec8024b6f`.**
Bind the existing `world/dressing-desktop.json` beside the qualified
phone counterpart to the same complete `SceneDressingSchema` and G483
owner. Preserve all previous registered roots, raw defaults, original
geometry/contact files, materials, callbacks, ownership and native
lifetime. No SDK root, new format, new host or renderer is introduced.
The existing seven metadata/default/refusal controls now run for both
exact names (14); the unknown-name negative still names a genuinely
unregistered document, not a wildcard family.

The actual desktop body is **951,455 B**, SHA `41334960…d206b4`.
Its complete native grammar is unchanged; provenance adds exactly
**65 B**, taking the selected Nalati index from 1,103,154 to
**1,103,219 B**. No cap or approximately 1.9 MB Pine headroom is changed.
One normal coalesced Pine/Nalati AFTER takes **48.352 s**. The independent
Nalati scope is all **400 payload paths / 88,630,430 B**: 399 are exact,
only one desktop provenance field changes, and ordered pack members,
offsets and old/new pack hashes reconstruct. The independent Pine
grazers retirement is not included in a global byte-purity claim.

The raw comparison stays **FAIL** for exactly the 164-byte `look/map`
body. Only `tilesHash` changes, `8b2d10bf…0d1648` to
`e40e2211…57c520`, equal to current `mapTilesHash`. The full old source
hash reconstructs; only `dressingScene.ts` import cleanup and the desktop
metadata option change among declared map inputs. Image
`80afaa55…aff2d6` is exact. G872 accepts this case only: no tolerance,
stamp freeze or weaker freshness. Fourteen controls plus original
owner/file/rows/bake focus pass in **12.2 s**; the original three product
and grammar suites pass in **6.256 s**. Root types and typed lint pass.

G612 lands these three paths HEAD-only, then measures normal immutable
previews: BEFORE **d0c3524-mvx4urdp**, full
`d0c35248f398670c64b42803b873df71e3093b06`, normally borrowed from root
with no extra baseline builder; AFTER **d83676a-mvx5dbxt**, the full
source SHA above. Both actual committed preview products are separately
hash-verified: all 400 selected bodies, exactly the same single map
case and desktop provenance difference, and the identical 951,455-byte
desktop body. The native `world/scenes.dressing[TIER]` selector is intact.
The complete intervening source/asset diff includes the separate Pine
retirement and two unused twig-JPG removals; this is not a pure-leaf
whole-release or timing comparison. No foreign working-tree renderer
edit, response override or material-program loan enters either build.

The capture guards actual **`game.tier === 'desktop'`** in every fresh
world while retaining portrait **iPhone 16 Pro 402×874 / DPR 2**, the
unchanged phone frame controller and native Metal (Apple M5 Max).
Three fresh worlds produce nine **804×1748 RGBA** frames. At **P1, P2
and P3, both A/A and A/B differ by exactly 0 pixels**, without a
whitelist or comparator tolerance. Per-pose native draws/triangles
also match across all three worlds: P1 **153 / 2,958,499**, P2
**161 / 3,621,300**, P3 **112 / 2,159,729**. This is the same declared
posed-world protocol (native shadows, no post or camera-child viewmodel),
not phone-tier performance, frame cadence or physical Safari evidence.
Both own preview leases and every browser close normally; all own
hardware is returned before root's next required release entry.

Evidence: `tmp/sp-x2-cs3-desktop/{payload-baseline,payload-after-audit,
raw-comparison,before-binding,after-binding,physical-final,summary}.json`,
`immutable-source-diff.txt`, the original-consumer logs, and
`pixels/reading.json` with nine untouched raw RGBA frames. This closes
only the two dressing names across phone and desktop. Remaining local
placement grammars, complete-source-envelope gaps, index-footprint
exits and unproved user scope remain open in the CS3 census.

The next source read confirms that Nalati's two cover books have a real
complete `SpecimenBookSchema` and native Explorer, held and forager
consumers. These three consumer modules still demonstrate only Nalati
as a complete named-book source. DW's four inline specimen rows drive
the shared catalogue child, not that complete book document. No second
book source or exact one-user root approval has yet been established;
the existing owner/genericity exit remains explicit. Shape equality,
an unknown wrapper or a manufactured second user cannot close it.


## CS3: complete inventory disposition and remaining bar

**2026-10-31, sp-x2; G872 evidence ruling.** The exact source inventory
landed in `959c6f1503` is `tmp/sp-x1-cs3/inventory.json`, SHA-256
`b08f048f87336c0383d67839fd1328a329aa5f1e90be297d7d963e4338797768`.
It contains **318 product/name rows** in seven historical modern products,
not a current/all-24 inventory. Every row is assigned exactly once below;
the empty Blender snapshot contributes no rows. The script and expanded
42-name remainder map remain independently scoped historical evidence.

**G872:** when a registration changes only defining index metadata and
every render-consumed payload byte remains exact, that full-payload proof
is the identical-capture evidence: identical render inputs give identical
pixels. This applies to the recorded placement, catalogue and recipe
slices. It is an evidence inference, not a claim that new GPU frames were
captured for them. The separately accepted map-source fingerprints do
not change the map image or other render inputs. Render-changing scene
consolidation or tier-copy retirement still requires strict A/A and A/B
on the landed SHA under G612, followed by a forward fix on any pixel.

| Family in the exact 959c inventory | Rows | Landed evidence or explicit exit |
|---|---:|---|
| `world/scenes` in DW, Pine, Nalati, Nine, Far and Sun | 6 | Existing shared `WorldScenesSchema`/native assembly, introduced by `b133765b9e`. Already a platform section in the historical inventory. This is not proof that all referenced scene files have been consolidated or tier copies retired. Those integration changes remain the concrete CS3 implementation bar. |
| DW `world/{foliage,piers}/*.json`; Pine `scenes/placements/*.json`; Nine `world/placements/*.json` | 194 (12/112/70) | `2e5f28e594`, exact placement proof in `e04c5ef4a6`: 2,198 other bodies / 352,297,731 total B, all 2,027 file entries and 194 defining schemas exact; only Nine's accepted 164 B map-source stamp changes, image `ce62e427…9fefd` exact. **G872 render-input proof qualifies identical pixels.** No streamed-file collapse is inferred from registration. |
| DW/Pine/Nine `models/world-scenes.json` | 3 | `79b336bd52`, full coalesced body/pack proof in `bc888b89de`: all original catalogue bytes/defaults/geometry/resources exact; only defining metadata and separately accepted map-source stamps change. **G872 render-input proof qualifies identical pixels.** |
| DW `scenes/{cascade,cove,hibiscus,logs,moorings,palms,reef,rocks,trail,wreck,zipline}.json`; Pine `scenes/{pool,quest-rides,streams}.json` | 14 | `31bffc86fb`: existing complete `WorldSceneSchema`, original native/consumer controls and normal strict AFTER; 2,214 of 2,215 bodies exact, sole accepted non-rendering map source stamp. **G872 render-input proof qualifies identical pixels.** |
| Nine `world/scenes/{cards,dressing,fixed}.json`; Far and Sun bounded `world/scenes/*.json` recipes | 27 (3/15/9) | `929d759689`: complete existing native world-scene contracts, normal six-product AFTER/strict6 and full ordered pack reconstruction. All render inputs exact; the recorded six exceptional bodies are only four accepted map-source stamps and the five G966 source-label fields in two catalogues. **G872 render-input proof qualifies identical pixels.** |
| Pine `scenes/cabins-{phone,desktop}-shadow-{false,true}.json` plus 56 `scenes/cabins/specimens/*.json` | 60 | **Index-footprint exit.** Together with Nine casts/fabric these form the whole withdrawn 62-name `WorldSceneWeldSchema` slice: Pine index 1,703,170 → 3,120,670 B exceeds the unchanged 2,000,000 B cap. All production/test activation was withdrawn. No subset retry or metadata registration supplies scene consolidation or shadow-copy derivation. |
| Pine `scenes/cabins/living/{phone,desktop}-{false,true}-{false,true}.json` | 8 | **Index-footprint exit.** Existing whole `LivingPageInputSchema` is real, but 1,757,786 → 1,984,106 B leaves only 0.8% hard-cap headroom before pending metadata. G872 requires Pine at or below approximately 1.9 MB. No activation, cap raise or partial envelope. |
| Pine `scenes/streams-spray.bin` | 1 | **Companion-binary/resource-owner exit.** Historical 1,012 B packet, SHA `56200b24…10502`. Existing source binds exact f32 matrix/seed/size offsets and native instance counts. Registering `scenes/streams.json` does not retire this binary or prove a wire conversion; retain its packet bounds and native owner. |
| Far `world/sources/{bakes,heroes,sky}.json`; Sun `world/sources/{bakes,models}.json` | 5 | **Complete-envelope exit.** `SceneBakeSource`/`SceneModelSource` are runtime interfaces, not complete schemas for the actual author envelopes and leftover GLB/hull/rig/rail/disc/anchor data. No partial runtime-field root, unknown extension or inferred shape registration. |

The total is **6 + 194 + 3 + 14 + 27 + 60 + 8 + 1 + 5 = 318**.
The exact per-product names, body hashes and one-to-one dispositions are
retained in `tmp/sp-x2-cs3-closeout/inventory-dispositions.json`; no
historical inventory is silently replaced with today's output.

The later expanded family census also has an explicit disposition for
every additional CS3 name. These rows are not extra members of the 318:

| Later scene family | Disposition |
|---|---|
| Nalati `world/dressing-{phone,desktop}.json` | **Done:** `1fadd8e67a` / `d83676a5d4`; byte/pack proofs plus actual strict P1–P3 A/A and A/B, all **12 comparisons zero pixels**, recorded in `35950f7c64` / `435c9d23b4`. Actual quality tiers are guarded; no broader renderer or timing claim. |
| Nalati `models/cover-{phone,desktop}.json` and `models/gear-book.json` | **SpecimenBook genericity exit:** the complete native book root exists, but demonstrated named-book producer users are Nalati only. Explorer/held/forager modules are not a second shard; DW's four inline specimen rows use the catalogue child, not this whole document. Exact one-user approval or a real second whole-book source remains necessary. |
| Nine `geometry/{fixed-kits,layout}.json`; DW `models/fixed-geometry.json` | **Shared complete-contract exit:** original shard-local practice/layout/geometry grammars are not a shared approved whole root. Preserve geometry/resource, negative-zero and native refusal checks. |
| Nine `signs/atlas-{phone,desktop}.json` | **Complete atlas/resource-contract exit:** retain original glyph/light/pool/channel binding; do not promote the shard-local atlas schema by shape. |
| DW `world/building-life.json` | **Whole-envelope exit:** the native look and life children do not define `{look,life,initialDusk}` and its original site ownership. |
| Nalati `world/dressing-{boulder,slab,juniper,rose,willow,lupin,reed,logs,stumps,ovoos,poles,fences,gates,drifts,colliders,clutter}.json` | **Complete shared row/owner exit:** 16 shard-local array grammars; no permissive wrapper around a child pose schema. Collider ownership stays with CS4; preserve doubles and native resources. |
| DW `world/island/plan-{phone,desktop}.json` | **Complete placement-plan exit:** local `IslandPlacementPlan` interface is not a whole native wire root; retain all family/set/rock/box and collider/resource checks. |
| Nine `world/{casts,fabric}.json` | The other two members of the **whole withdrawn 62-name index-footprint exit**, not an approved smaller retry. |
| Pine `world/landmark-view.json` | **CS9/CS3 complete native-view derivation exit:** the local landmark projection is not a shared whole root. |
| Pine `world/building-sites.json`, Nalati `models/shape-book.json`, Pine `world/forest-page.json` | Existing complete native aliases are qualified in `d45c13a9ae` / `31bffc86fb` with exact full bodies (G571/G602); no duplicate migration, new host score or tier-copy retirement is inferred. |

**CS3 therefore stays open for exactly the render-affecting consolidation
and tier/shadow-copy retirement work.** Metadata adoption and the explicit
contract/genericity/index/binary exits above are fully accounted; no
unclassified source family remains. Next is a bounded existing-host
consolidation design, not another registration of already admitted files.
Do not close that implementation bar on provenance alone or count the
withdrawn 62/8 names as migrated. A candidate must retain complete resource
lifetimes, ownership and index caps, prove its payload change, land
HEAD-only, then pass strict affected-pose A/A and A/B on its landed SHA.

## CS10: live tool and runtime users

**2026-10-31, sp-x2 with sp-x9; read-only.** No deletion is earned by
recording a CS1–CS9 exit. The observed six primary output indexes still
contain **14 hash-verified `custom/*` bodies / 81,124 B** plus **461
named JSON files**. Index hashes and exact names are retained in
`tmp/sp-x2-cs3-closeout/cs10-users.json`. This is not fresh current-source
admission or a full-24 census: both local `_template` and
`blender-template` outputs are absent, and neither absence counts as zero.

| Machinery | Exact remaining live uses / decision |
|---|---|
| DW `generators/sections.ts#SECTIONS` and `output.ts` | Five sections: `collections`, `cumulusPuffs`, `enemyPlacements`, `fixedLayouts`, `gullFlock` (all under `custom/`). The original parsed emitter and native consumers remain live. |
| Pine `generators/sections.ts#SECTIONS` and `sourceOutput.ts` | Nine sections: `cabinAmbience`, `cabinAppearance`, `kingKit`, `nativeView`, `paintedTextures`, `questRuntime`, `runtimeGraphs`, `thrallLook`, `trophyMounts`. Removing dead assembly scaffolding does not remove these payloads or their owners. |
| `src/sdk/sections.ts` custom emitter; `src/format/outputIndex.ts`; `src/sdk/outputProduct.ts` | DW/Pine still emit `sections/custom/*` and `schemas/custom/*`; index admission requires the exact matching schema path, and native output admission validates their complete data. Keep the custom-name checks, emitted schema membership and native refusals. |
| `CustomSectionName`, `SectionReader` and `CustomSectionSchemas` | Real users include `game/quest/continuation.ts`, `game/models/collectionDisplay.ts`, `game/shardfile/islandBook.ts` and `islandLibrary.ts`, plus original SDK/product tests. `islandLibrary` encodes custom section references in its native draws contract. Neither custom read overload nor schema type is unused. |
| Generic `ShardProduct.json<T>(name:string)` | Remains necessary for unresolved named-JSON families and shared dynamic-name readers. Registering exact names does not erase the checked compatibility path or prove those other readers converted. No untyped substitute or broad overload deletion. |
| `game/shardfile/customSchema.ts` | The file serves **both** the 14 custom sections and normal named JSON. `namedJsonChecks.ts` lazily loads its paced named validator; `outputChecksNode.ts` uses custom and named admission. Registered-json and many original native/quest/resource tests import that same validator. Its 256-entry compiled-schema cache and strict Ajv/plain-JSON/refusal rules are live; the filename is not evidence of an unused module. |
| `scripts/check-custom-section-growth.mjs` / `.d.mts` | Retained CLI plus maintained growth fixtures and a historical adapter: `scripts/test_products.py` defines `custom_section_growth_command`, whose only tracked invocation is `test/local-gate-scenarios.test.ts`. No current deploy/live-push execution of this checker is proved. Original `test/custom-section-growth.test.ts` verifies exact measurement and missing-output refusal. Keep it with the live users; a partial empty output directory is not a zero-user proof. |
| `scripts/custom-section-policy.mjs` / `.d.mts`, `lint/custom-sections.json` | Called by growth/freeze, `check-platform-ratchets.mjs`, `check-staged-inputs.mjs`, `precommit-checks.mjs` and the committed fast-check chain; original policy/growth/freeze/committed-gate fixtures remain live. Freeze identity and defining-provenance admission still guard new names. |
| `custom-sections/*` count/byte ceilings | Six nonzero pairs remain: DW **53 / 3,074,153 B**, Far **19 / 2,928,189**, Nalati **46 / 12,351,832**, Nine **19 / 4,552,493**, Pine **234 / 10,626,533**, Sun **16 / 79,809**. Total **387 / 33,613,009 B**. These are committed ceilings, not current measured use. |

`shard-platform-output.mjs#productSections` deliberately charges **all
named JSON**, including registered names, alongside `custom/*` sections.
Therefore a successful metadata registration does not imply a zero
ceiling or an unused growth/freeze policy. The observed named counts are
DW 55, Pine 224, Nalati 56, Nine 91, Far 19, Sun 16; these counts do not
assert those 461 files are all private or all unresolved. SDK JSON-schema
conversion's unrelated `customSchemas` map is not custom-section legacy.

**CS10 remains open. No listed tool, guard, emitter or reader is currently
proved to have zero users.** X9 owns its separate narrow dead Pine
headless-scaffold retirement and full old-constant reconstruction. Any
later deletion must demonstrate zero actual producers/readers, preserve
named JSON admission, remove only retired charged spans and their exact
tests together, and retain historical required-source guards. No build,
native worker, browser, new artifact/API read, schema tweak or guard
relaxation was run for this census.

## CS2 completion evidence

**Done, 2026-10-31, sp-x1, on Jake's explicit landed-slice-or-exit bar.**
Every remainder family now has a landed exact native slice or a concrete
named exit below. The earlier CS2-open statements describe intermediate
proofs; they do not override this completion ledger. This closes the
contract assignment/alias stage. It does not call any unimplemented
CS3–CS9 migration done, remove a live private reader, lower a ceiling,
approve a host or earn CS10 deletion.

The original all-24 CS1 scan is bound by `9a616b4b82` and its exclusive
compiler-owner correction `b13ad77350`. Later source work uses explicitly
scoped hash-bound oracles, not a fictitious new all-product admission.
The exact historical 169-name remainder is reconciled against current
registered roots: **12 now have landed exact aliases**, and the following
**157 names have concrete assigned exits**. The plain read-only lookup
checks exact names and preserves source hashes in
`tmp/sp-x1-cs2-closeout/reading.json`; it builds and runs no world.

| Family / exact remaining scope | Landed authority or explicit owning exit |
|---|---|
| Earlier shared foundation and bounded aliases | Placement families `e04c5ef4a6`, existing world-scene/model/weather/persistence contracts and `31bffc86fb`'s 23 aliases retain their original exact payload/pack/native proofs. No metadata alias is counted as scene consolidation, resource retirement or a new host. |
| Scene facts and dressing counterparts — four of the historical names now landed | `d45c13a9ae` binds building-sites/shape-book; `1fadd8e67a` and `d83676a5d4` bind phone/desktop dressing. Their full bodies and native controls are qualified; both dressing tiers have strict P1–P3 A/A and A/B at zero pixels. Forest-page already belongs to `31bffc86fb`. |
| Ground — two historical names landed, **1** exact owner exit | `d0c35248f3` binds DW cover composition and Nalati meadow on existing G602/G667 roots. Pine `data/physics.generated.json` stays a **CS4 complete owner-contract exit**, retaining profile/notice/King-hit/tree/shelter ownership; G667 tests 2–6 also remain open, with no collider/host credit from metadata. |
| Directors/population — three historical names landed, **6** exact exits | `99d9ff28cc` binds directors; `94cd0e375e` binds keeper/returns with the original body/queue owners. Pine roster/elites retain their complete native-parser/catalogue proof exits; Nalati sheep needs the complete crowd envelope, wildlife retains three unbridged checks, DW enemy placement needs its shared whole root, and Nalati habitat retains its exact contextual tree/ledge bounds. These are **CS6** work, individually named in the 61-name matrix. |
| Quests — three historical names landed, **11** exact exits | `cff6cc28ca` binds steps/hints/wake. Pine contracts/native-story/native-spots and Nalati carried have exact whole roots and tested off-tree slices, assigned to **CS5 defining-metadata/payload/owner qualification**. The other seven names retain concrete panel catalogue, private presentation, partial figure/story, discovery/guide, closed interaction guest or finds-owner exits in the CS5 table; they are not counted as implemented. |
| Held/look/weather — **25** exact names | The CS7 table names every native root or complete catalogue/model/guest/appearance exit. Rain keeps its ordered-water predicate; post keeps exact regex and native safety checks; same-name Pine/Nalati weather remains a real collision. Cover/gear books keep the **CS3 owner/genericity exit**, not a manufactured second user. Small schema size or an outer parse supplies no host credit. |
| Encounter/riding — **9** exact names | **CS8** retains full room/King/fight/geometry/pose/playback and riding-wire/ABI exits. Existing roaming/mounted roots still require their exact named payload/native-owner proofs. Unknown child fields, loose subsets and unbridged riding checks are never promoted as whole contracts. |
| Headless/views — **5** exact names | **CS9** owns each remaining assembly/boot/constants/taming-pose/landmark-view derivation. `58050f2620`'s original assembly reconstruction, `103e484`'s defining encounter test and `c75f3f9a02`'s return-before-derived-read guard stay intact. Unique constants and retired scaffold do not become an unknown union or an automatically approved platform section. |
| Other scene/source names — **38** exact names | All are enumerated in the scene-family table and X2's complete CS3 ledger: eight living envelopes, three local fixed-geometry roots, two cover books, two atlases, building-life, sixteen local dressing grammars, two island plans and four distinct Far/Sun source names. They have **CS3 complete-contract/resource/genericity/index exits**, with collider ownership retained by CS4. |
| Whole withdrawn weld slice — **62** exact names | The full Pine60/Nine2 slice remains withdrawn: Pine index **1,703,170 → 3,120,670 B** exceeded the hard 2 MB cap. It is a **CS3/index-compaction exit**; no smaller retry, compact-schema API, cap movement or partial envelope is authorized by this ledger. |
| Eight living envelopes, included in the 38 scene names | Their exact complete schema still projects **1,984,106 B**, above Jake's roughly **1.9 MB** Pine headroom rule. Keep this separate **index-footprint exit** beside the welds until a reviewed compaction row exists. They remain unregistered. |
| Pine `scenes/streams-spray.bin`, outside the 169 JSON-name reconciliation | Explicit **CS3 companion-binary/resource-owner exit**, already accounted in X2's 318-entry inventory. The historical 1,012 B resource is not a missing JSON root, and recipe registration does not prove its wire conversion or retirement. Retain exact instance packets, offsets/counts and native resource lifetime. |
| Other 18 modern products | The source census names all 14 open-plot declarations plus template, blender-template, pastel and ink outputs; those output paths declare no private named JSON. A later physical scan refusing missing template outputs stays refused, never zero. Neither legacy family is read or modified. |

The exit count is **38 + 1 + 11 + 6 + 25 + 9 + 5 + 62 = 157**;
the 12 landed names account for the rest of the bound 169-name snapshot.
This count is source assignment, not a claim that 157 payloads were
removed, migrated or freshly admitted. The companion binary and CS10's
14 live custom-section bodies are deliberately separate scopes.

The latest qualified tuple retains Pine **1,762,914 B**, Nalati
**1,103,219 B** and DW **995,665 B**. All existing hard caps, the roughly
1.9 MB Pine rule and native guards remain. Historical G872 stamp failures
stay raw failures beside their individual accepted classifications; no
general tolerance or freshness exemption is introduced. No build,
browser, native run, capture, payload change or host-score adjustment is
performed for this one documentation completion. CS5's remaining native
slices and explicit quest/runtime exits are the next work; CS10 remains
gated by the actual live-user ledger, regardless of CS2's done mark.

## CS6: complete Pine roster and elite documents

The exact names `actors/roster.json` and `actors/elites.json` bind the
existing `NativePopulationRowsSchema` and `EliteFeatureSchema`. Registered
admission calls their complete native parsers. Roster cross-row bounds,
elite fight identities, bounds, slots and complete spawn programs retain
the original refusals; catalogue module/owner checks remain with
`readEliteFeature`. No host, AS program, tick, pose or legacy path changes.
Both SDK wire roots already existed, so this slice adds no SDK root or
changes to first-seen wire-check identities.

The maintained five product controls cover complete actual bodies,
structurally valid but natively invalid roster/elite values, and
missing/foreign provenance refusing before any read. Root types and
named typed lint pass. One normal Pine AFTER is shared with X9's separate
CS9 scaffold removal; no BEFORE generator or second AFTER is run.

The roster body is 250,356 B and the elite body is 26,501 B. Their defining
metadata adds 9,471 / 7,194 B. The payload proof must retain both bodies,
every unrelated file and section descriptor, and all ordered pack member
bytes, offsets and hashes. The independent scaffold scope may remove
only its 778 B of retired fields; its full old canonical reconstruction
and constant bytes stay exact. These are separate ordered commits.

The first scratch audit refused because this lane mislabeled a
`SHA256(JSON.stringify(schema))` expectation as a canonical hash. The
artifact and raw refusal stay retained. Corrected reporting distinguishes
that declared digest from the independently computed sorted canonical
hash and requires full source/artifact/index schema equality plus exact
metadata deltas. No product edit, rebuild, schema tolerance or admission
waiver follows from this diagnostic correction.

The shared normal AFTER exits 0 in **45.42 s**, followed by independent
ordinary Pine admission **CURRENT**. The completed audit verifies all
**1,055 unrelated payloads / 154,466,131 B** exactly. The assembly alone
changes **64,873 → 64,095 B** under the separate scaffold slice, with all
constant bytes and the entire old canonical value reconstructed exactly.
Both roster/elite bodies and all other metadata remain exact apart from
the two defining schema additions. Every old/new ordered pack, member,
offset and hash reconstructs. The actual index is **1,779,579 B**, below
the roughly 1.9 MB headroom rule and unchanged hard 2 MB cap.

All **nine original/maintained suites PASS (33.6 s)**, including the
native population platform, elite/output originals, five defining-root
controls and independent assembly/physics/source-admission controls.
All seven combined source hashes remain frozen through the proof and
ordered commits. There is no map-source exception, new pixel claim or
G872 tolerance. Source/schema/body identity is the scope of this slice.
Evidence: `tmp/sp-x9-cs9/pine-scaffold/{strict-after,payload-after}.json`,
`qualified-originals.log`, and this lane's frozen expected metadata and
native-parser witness in `tmp/sp-x6-cs6-population/`.

The remaining CS6 actor names have explicit exits: Nalati sheep needs its
complete crowd-page envelope; wildlife retains all three unbridged native
checks; DW enemy placement needs its complete approved placement root;
and Nalati habitat retains exact contextual tree counts, ledge bounds
and forager continuation. The historical 55-row source inventory is not
a new host score or an all-product admission claim. CS6's broader native
controller/AS ownership and CS10's live bridge/guard users remain open.

## CS6 completion evidence

**2026-10-31, sp-x6; Jake accepts the slice-or-recorded-exit bar.**
CS6 is done as a disposition of every family, not a claim that every
private contract has become a new shared host or AS port. The retained
55-row inventory is historical source evidence; re-auditing HEAD avoids
reopening already registered names as missing work.

| Exact baseline scope | Disposition |
|---|---|
| 42 existing platform rows | Existing complete platform section contracts and their native controller/AS owners remain. The hash-bound body/grammar audit is not a new host score or proof of changed executable behaviour. |
| 10 named documents | Nalati species-looks (`7de65890f1`), DW/Pine page-life (`a6459dbebc`), DW creature-install/projection plus Pine shelter (`d066e8f046`), DW/Pine directors (`99d9ff28cc`), and Pine roster/elites (`9375c2c52f`) have exact defining-root slices and their recorded original/native/payload proofs. |
| One duplicate custom section | Pine `custom/grazers` is retired by `2dcda69209`; only its duplicate body/schema are removed. The hull-book and species-program bytes and original live owners remain. |
| Two named documents with explicit exits | Nalati sheep retains the complete private crowd-page envelope/owner exit; wildlife retains all three native-check bridge exits. Unknown children and unbridged predicates are not promoted. |

Those dispositions account for **42 +10 +1 +2 =55** baseline rows.
Four additional actor-family names outside that inventory are also
explicit: DW keeper/returns are qualified by `94cd0e375e`; DW enemy
placement retains its complete native-placement/genericity exit; Nalati
population metadata retains its contextual exact tree/tops counts,
maximum ledges and ForagerContinuation contract. Keeper's demonstrated
native consumer remains the mixed-roster **test fixture**, without a
production-host completion claim. Return-program guest admission stays
with its original module, queue, owner and execution guards.

The latest roster/elites proof has ordinary strict Pine CURRENT,
**1,779,579 B** index, exact body/ordered-pack checks and nine passing
original/maintained suites. No new generation, browser, Simulator,
physics walk or payload change accompanies this completion mark. The
complete per-name source anchors and refusals are retained in the CS6
actor table and individual landed-slice sections above.

Remaining implementation follows those concrete exit rows in this live
plan. G571/G667 host ownership and WASM-HOST H6/H8 are not blanket
approvals; no admission check or AS behaviour is replaced. CS10 remains
open while its private emitter/readers, validators and guards have live
users. No zero-ceiling or bridge-deletion claim follows from CS6's done
mark.

## CS5: complete remainder disposition and next slices

**2026-10-31, source-only follow-through after CS2 completion.** CS5 is
still **open**. All 14 historical quest names have an exact disposition:
three qualified aliases, four prepared aliases, and seven concrete
remaining contract/owner exits. The panel exit now has a tested whole-root
prototype, but no activation or product proof. Pine's separate live
`custom/questRuntime` is also unfinished. This ledger assigns the work;
it does not mark those implementations or the CS10 deletion bar done.

| Exact name / user | Evidence and remaining acceptance |
|---|---|
| DW `quests/steps.json`, `quests/hints.json`, `quests/wake-boss.json` | **Qualified** by `cff6cc28ca` after `94cd0e375e`: complete existing schemas and full native parsers, ordinary strict/current products, all 469 DW bodies and ordered packs exact, original owner/step/hint/wake consumers retained. Five metadata records across the ordered two slices; no map-stamp exception. |
| Pine `quests/native-story.json`, `quests/native-spots.json` | **Prepared off-tree** on `NativeQuestCompositionSchema` / `parseNativeQuestComposition` and `NativeQuestServiceSpotsSchema` / `parseNativeQuestServiceSpots`. Append the two SDK wire roots; change only the two metadata options. Preserve every service reference, saved-role/dependency check, native prop/entry owner and original input/continuation assertion. |
| Pine `quests/contracts.json` | **Prepared off-tree** on `ContractCatalogueSchema` / `parseContractCatalogue`; SDK root already exists. Preserve compiled module, program admission, offers and catalogue references. Metadata only; no board-child substitute or program rewrite. |
| Nalati `quests/carried.json` | **Prepared off-tree** on `CarriedQuestSchema` / `parseCarriedQuest`, with its defining SDK root appended. Existing G601 C8 scope stays exact: player/mount/resource loans, AS decisions and original carried-host/Kokpar differentials. |
| Pine and Nalati `quests/panels.json` | **Whole-catalogue root exit, prototype ready below.** A `PanelDefinition` child alone is insufficient. The existing native reader's outer limit and per-panel recursion, action-path and lifetime rules must all survive before registration can qualify. |
| Nalati `quests/chapters.json` | **Public whole-presentation-contract exit.** `parseChapterStoryPresentation` uses private `ChapterPresentation`; neither an optional `QuestStorySchema` child nor an inferred wrapper covers the public document. |
| Nalati `quests/content.json` | **Complete chapter/figure-envelope exit.** `ChapterViewSchema` accepts but strips frame `file`/`height`/`radius` and child/cook `motion.idleArm`/`idleHead`. Retain the complete original fields and establish their exact owner; never normalize the emitted body to fit a partial root. |
| DW `quests/discovery.json` | **Shared discovery/guide-contract exit.** The strict shard-local places/guide/glassCount/shardFlags grammar is complete locally, but no complete common root is established. |
| Nalati `quests/finds.json` | **Owner/genericity exit (CS5/CS7).** Actual native admission under `FindsCatalogueSchema` / `parseFindsCatalogue` succeeds, but the pending single-user `game/bag/findsCatalogue` G441 owner is not approved merely by importing its schema. Retain flags/owned/counters and qualify the actual user scope. |
| Pine `quests/forest-story.json` | **Whole-story-envelope / CS9 view exit.** Inline board/store/talks grammar leaves world/map/pool/cable/mover rows outside the demonstrated root. Preserve those fields and the live content reference. |
| DW `quests/interaction-source.json` | **Closed guest-input-envelope exit (CS5/CS9).** The inline `interactionWireSchema` binds `constants.interact` plus authored spots through `nameGuestBlob`. Establish the complete ABI/input owner; do not register an unknown constants map. |

The four pending aliases are rebased off-tree after the roster/scaffold
source boundary. Their 21 native/root/provenance controls pass in
**1.4 s** (including the nine landed-DW regressions), and private strict
TypeScript covers the registry, SDK, both complete emitter candidates
and controls. Unused schema imports are removed only from the private
emitter copies. Every serialization expression stays original. The
candidate is excluded from the peer's already-frozen Pine proof; it
requires a later agreed common-file turn and fresh ordinary payload proof.

### Whole quest-panel catalogue readiness

`game/ui/dataPanels.ts#readDataPanels` already supplies the whole native
contract for two actual users. The off-tree candidate names that existing
catalogue in `format/panelTemplate`, delegates the original reader to it,
and adds the exact registry/SDK root and two metadata options. It retains
the original **16-panel** outer refusal before per-panel admission, the
**8,192-node / 32-depth** recursion bound, safe action paths, and the
transient/persistent shown-frame rule. Rendering, DOM installation,
callbacks and owner lifetimes are unchanged.

Eight off-tree controls pass in **1.6 s**, comparing both actual bodies
(Pine **3,198 B**, Nalati **931 B**) against the original unmodified
reader. Accepted values, raw inputs, serialization bytes and malformed
error names/messages/order are exact. Missing/foreign defining metadata
refuses before payload reads; all **225** old named wire contracts remain
deep-exact with the new root appended. The six complete private source
candidates and controls pass strict TypeScript. This is source readiness,
not normal output admission, a visual capture or host-bar completion.

Historical index projections add **90 B** to Pine and **5,604 B** to
Nalati. These are individually hash-bound feasibility oracles, not a
single current BEFORE tuple. A draft helper overwrote its local oracle:
Pine's original **1,762,914 B** index was recovered and hash-verified from
an independent captured corpus; Nalati's initial index tuple was not
recovered and its retained later tuple is labelled as such. Native body
parity is unaffected. The helper now preserves existing oracles. A future
activation must capture a fresh ordinary baseline, keep Pine at or below
about **1.9 MB** and the hard **2 MB** cap, then prove all bodies,
descriptors and ordered packs with the original data-panel/lifecycle
consumers. No source-stamp exception is assumed.

### Live questRuntime and the already-shared quest sections

Pine's hash-bound **29,289 B** `custom/questRuntime` remains live in
`test/fixtures/pine-headless.ts` and `forestStory.ts`'s content reference.
`sections.ts#PineQuestRowsSchema` types lead/page/steps/spawns/table and
policy, but leaves `lead.program`, events, deaths, pageDeaths and content
unknown. That is an explicit **complete content / closed guest / AS-owner
exit**, not a whole native-root registration. The generator already emits
the compiled life module and shared `actors/page-life` / return-scripts;
this does not prove the rest of the custom envelope has moved to AS.
Retain every live consumer, save/phase rule and owner assertion until the
whole replacement and unchanged payload/behaviour proof are demonstrated.

Sky's rows are not an unclassified private envelope. The source census
finds the existing shared `quests/quests`, `quests/host` and
`quests/directors` section contracts in `format/sections.ts` and
`format/outputFields.ts`, including Far Reach's actual native quest-host
rows. `QuestHostSchema` / `questHostRules` and the Shardfile binding rules
retain routes, references and observations. Those existing platform roots
do not imply that every guest decision is already AS or that another
private quest document can borrow their approval.

Evidence is `tmp/sp-x1-cs5-remainder/{reading,platform-and-runtime}.json`,
`tmp/sp-x1-cs2-quest-ready/{source-base,feasibility}.json` and its private
candidate patches, plus `complete-four-{controls,types}.log`.
Panel evidence is `tmp/sp-x1-cs5-panels/{source-base,before,footprint,
oracle-recovery}.json`, `controls-complete.log` and `types-rebased.log`.
No build, browser, native simulation, registry activation, cap change or
CS10 guard deletion is performed by this source-audit documentation.

## CS9: remaining fields and scaffold exits

**2026-10-31, sp-x9 — source-first disposition, not a migration-complete
mark.** The retained four-product read verifies each named JSON body
against its actual index hash, then searches the other complete named
payloads and admitted shardfile. It accounts for all **34 assembly
constants**, every top-level field of the four other CS9 documents
(**69 fields total**), and all three remaining declaration shells.
The retained outputs pass native format admission; this census does not
assert fresh current-source admission or a full-24 output scan.

The eight exact derivations subsequently qualified in the [completion
proof](#cs9-exact-constant-derivations-and-completion-bar). Original native
parsers reconstruct the entire old canonical Driftwood/Nalati assemblies
and taming-pose document. Actual emitted sizes are Driftwood
**931,426 → 920,377 B**, Nalati assembly **113,878 → 113,286 B** and
taming poses **85,858 → 32,774 B**, removing **64,725 B**. The sealed
current BEFORE was captured after the placement/CS5 handbacks; no BEFORE
generation, namespace retag or permissive schema was used.

The other fields have the explicit exits below. An exact child match is
reported where found; it never labels the whole compound body as a
platform contract. Existing caps, native assertions, semantic parsers,
return-before-derived-read ordering and actual proof-input identity stay.
Evidence: `tmp/sp-x9-cs9/remainder/{inventory,shard-matches,related-matches,
feasibility,dispositions}.json`; the read-only candidate type overlay
has zero diagnostics. CS10's recorded live-user exits are unchanged.

### driftwood-isle — `sim/headless-assembly.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `dayStyle` | **Qualified Z13 derivation (2026-11-03).** Complete admitted look/toon.sky.day reproduces TOON_LOOK.sky.day byte for byte. Native preset values and initial clock alignment remain unchanged. |
| `entries` | **Explicit exit.** CS9 native entry-proof exit: data/entryWalk.json is an expected walk/count budget consumed by proveTerrainEntries; do not recompute expected proof facts from the geometry being checked. |
| `interact` | **Qualified exact derivation; full old canonical bytes reconstructed.** quests/interaction-source.json#/constants/interact; existing bounded named-JSON admission and original native interaction owner |
| `interactSpots` | **Qualified exact derivation; full old canonical bytes reconstructed.** quests/interaction-source.json#/constants/interactSpots; original page/native placement input |
| `mixedPopulation` | **Explicit exit.** CS6/CS9 complete mixed-roster owner: combines practice placement/respawn, native attack cap and four pose banks. sim/keeper and sim/enemy-placement are partial inputs, not the whole native value. |
| `nativeChapterCues` | **Qualified exact derivation; full old canonical bytes reconstructed.** quests/wake-boss.json#/cues projected to id/operation by the original parseChapterWake |
| `nativeCounters` | **Qualified exact derivation; full old canonical bytes reconstructed.** quests/achievements.json through parseAchievementCounterData and the original native-feat/flag/write projection |
| `nativeQuest` | **Explicit exit.** CS5/CS9 complete native quest-composition owner: generators/nativeQuest.ts joins save order, prompts, transitions, acquisition and reward. Preserve parseNativeQuestComposition and original native entry assertions. |
| `nativeQuestSpots` | **Explicit exit.** CS5/CS9 complete native place/prompt/cable root: DRIFTWOOD_SPOTS contains more than the interaction-source row array. Keep readNativeQuestSpots, prompt-registration and cable bounds. |
| `nativeSpecs` | **Qualified Z13 derivation (2026-11-03).** Ordered catalogue over the full admitted physics actor specs plus captain spec reconstructs every original catalogue byte. Conflicting bodies under the same kind.variant are refused; no species-name inference. |
| `physics` | **Explicit exit.** CS4 complete native-bake owner/typed binary derivation: preserve solid order, tagged provenance, actor/herd/habitat/captain and exact ground/collider bytes. The two existing binaries alone do not define this whole compound value. |
| `questKillSteps` | **Explicit exit.** CS5 native kill-step/feat continuation: preserve kill fact identity, ordered native reward and original quest counter ownership; no whole admitted replacement was found. |
| `questProps` | **Explicit exit.** CS5 complete native prop-owner exit: nativeQuestProps joins barrels, floors, plates and water with placements and owned save order; a scene/view payload is not the native owner. |
| `sea` | **Qualified exact derivation; full old canonical bytes reconstructed.** admitted shardfile.water row id=sea; declaredWaterBody unchanged |
| `swords` | **Explicit exit.** CS7 complete native melee/loadout policy exit: data/nativeSwords.json has slot, source, tags, combo/contact/lunge rules not present as the same whole admitted item row. |

### pine-hollow — `sim/headless-assembly.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `entries` | **Explicit exit.** CS9 native entry-proof exit: data/entryWalk.json binds lanes/walk/start/maxTicks; preserve expected proof facts independently of actual geometry and original native entry guards. |
| `environment` | **Explicit exit.** CS6/CS9 G571 population-environment owner/genericity exit. POPULATION_ENVIRONMENT is emitted only here; actors/shelter contains an id reference, not this 63,824-byte value. PopulationEnvironmentSchema is not host approval. |
| `terrain` | **Explicit exit.** CS4/CS9 native terrain/navmesh binding exit: terrainBindings.json names the native terrain format, resolution/size/seed and original public asset paths. The admitted sampling tile is a different wire; no implicit conversion or path alias. |

### nalati-grasslands — `sim/headless-assembly.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `eliteDefs` | **Explicit exit.** CS8/CS9 complete native elite catalogue: selected ecology lair/rule/radius/respawn facts retain native identity and exact kernel admission; a profile child is not the complete owner. |
| `eliteEntry` | **Explicit exit.** CS8/CS9 elite-construct capability/owner exit: preserve assembly/admission file identities, fight/model/program/weather/night bindings and ledge anchor; do not manufacture authority from matching strings. |
| `groupRows` | **Explicit exit.** CS8/CS9 ordered native group/guest ABI exit: parseNativeGroupRows preserves member adoption, two guest-owned draws, delay/admission and group ordering. Page wildlife groups are not this whole native program. |
| `nativeBake` | **Explicit exit.** CS4 native bake-admission configuration exit: retain the exact native label, axis/shape/storage/provenance bounds used by createNativeBakeReader. Existing collider bodies are not an independent config contract. |
| `nativeDayClock` | **Qualified exact derivation; full old canonical bytes reconstructed.** world/forest-weather.json#/sky/clock through ForestWeatherSchema |
| `nativeKnockdown` | **Qualified exact derivation; full old canonical bytes reconstructed.** sim/headless-boot.json#/riding through parsePopulationKnockdownSource |
| `nativePopulation` | **Explicit exit.** CS6/CS9 complete native population/cadence/projection-driver exit: the riding population is extended with crowdNativeProjection; preserve encounter loan checks and original body/decision order. |
| `nativeRide` | **Explicit exit.** CS8 native mounted controller exit: nativeRide joins riding speeds and original roads; its projection is not the full riding/session or boot owner. Preserve mounted command/save rules. |
| `nativeShelters` | **Explicit exit.** CS4/CS9 native weather-shelter owner exit: original shelter circles and weather-world binding remain exact; rendered yurt geometry or ids alone do not define native hit/shelter queries. |
| `nativeTaming` | **Explicit exit.** CS8 native taming/bond controller wire exit: keep herd/roster ids, bindings, prompts, acquisition/save order and limits; riding/session has related fields but no equal whole native envelope. |
| `nativeWeather` | **Explicit exit.** CS9 native weather-world owner exit: world/weather.json supplies a program/reaction bundle, while this value owns native world query/binding rows. Preserve steppe wind, weather continuation and shelter semantics. |
| `pageElites` | **Explicit exit.** CS8/CS9 complete elite entry/profile catalogue exit: buildEliteEntryPageRows joins profiles, native identity and kernel loans; no permissive profile union or child schema may label the whole body. |
| `timedEntry` | **Explicit exit.** CS8/CS9 timed-encounter capability/guest exit: retain owner/source/species/guest/site/figure names and native activation semantics; matching a view does not prove the executable entry. |

### nine-dragon-stack — `sim/headless-assembly.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `portalStep` | **Explicit exit.** CS8/CS9 native portal adapter identity exit: preserve the restore adapter key and installHostPortalRide ownership. No admitted defining row carries this complete native binding. |
| `jianStep` | **Explicit exit.** CS7/CS9 held-policy adapter identity exit: the value also equals jianPolicy.step, but the retained source witness reads this identity directly. Retire that source/wire reference together with the complete native policy proof, not by an unproved alias. |
| `jianPolicy` | **Explicit exit.** CS7 complete native swept policy exit: retain source/slot/combo/heavy/contact/lunge values and nativeMeleeItem admission; no equal whole loadout/item payload was found. |

### nalati-grasslands — `sim/headless-boot.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `admission` | **Explicit exit.** Exact subvalue in actors/wildlife.json#/admission; CS8 boot/guest ownership exit until the original complete wildlife/native program parser and boot-source reconstruction are qualified together. |
| `combatTargets` | **Explicit exit.** CS9 complete boot combat-target/native body owner exit; retain target identity and exact native body/shape authority. |
| `hunt` | **Explicit exit.** CS6 native hunt/ecology owner exit; preserve encounter loan bounds and owner-selected native programs. |
| `mountable` | **Explicit exit.** CS8 boot mounted-id owner exit; keep exact admitted body identities and the original bonded roster union. |
| `pasture` | **Explicit exit.** Exact subvalue in actors/wildlife.json#/pasture; same CS8 boot/guest ABI exit, preserving guest-owned draws and original native compilation/admission. |
| `phases` | **Explicit exit.** CS9 boot clock/population phase-order exit; phase names alone are not an independently admitted native lifecycle. |
| `recipes` | **Explicit exit.** CS4/CS6 exact native body/variant recipe owner exit; preserve original body parsers, variant membership and bounded encounter loans. |
| `rest` | **Explicit exit.** Exact subvalue in riding/session.json#/rest; CS8 whole boot/riding owner reconstruction exit, not a whole-envelope alias. |
| `riding` | **Explicit exit.** Exact whole ride/rules.json value; CS8 original native riding-program wire/ABI exit before rebinding boot consumers. Retain compiled ReturnProgram/capability checks. |
| `roads` | **Explicit exit.** Exact values in world/meadow.json#/trails and riding/session.json#/roads; CS8 boot/mounted owner reconstruction exit, preserving array order and original native roads. |
| `roster` | **Explicit exit.** CS6 native boot roster/identity/RNG exit; preserve initial body/herd order, stream snapshots and native installation sequence. |
| `species` | **Explicit exit.** CS6 complete native species/variant catalogue exit; preserve original SpeciesSchema and admitted recipe membership. |
| `streamSeed` | **Explicit exit.** CS6 boot random-stream authority exit; no recomputed or newly granted seed. |
| `worldUpdates` | **Explicit exit.** CS9 typed native boot update/scheduling owner exit; preserve world/control/weather cadence and ordering. |

### nalati-grasslands — `sim/taming-poses.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `horse` | **Qualified exact derivation; full old canonical bytes reconstructed.** Queued exact derivation from registered actors/species-looks.json#/poses/horse through parsePackedCreatureLooks. Native pose compiler remains unchanged. |
| `poses` | **Explicit exit.** CS9 complete owned native pose/joint exit: tamingPoseRows.ts checks <=32 bones and parent-before-child; preserve relative numeric coordinates, zero defaults, gait/pose fields and the extra Argymaq row. |

### nine-dragon-stack — `sim/headless-constants.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `spawnY` | **Explicit exit.** CS9 native entry/collision proof exit: preserve the original layout.Y0+0.1 rule and trusted spawn bound; no authoritative whole replacement was found. |
| `hooks` | **Explicit exit.** CS9 grapple native point-book exit: recordedPhysicsPoints binds original ring centres; rendered hook nodes are not the native capture book. |
| `grappleProfile` | **Explicit exit.** CS9 complete native grapple profile exit: preserve parseGrappleProfile, host/query limits and original rise/flat control; no identical admitted defining payload was found. |
| `portalRide` | **Explicit exit.** CS9 native portal ride binding/landing exit: preserve director, triggers, fade/veil and exact landings with original native portal checks. |
| `pieces` | **Explicit exit.** CS4/CS9 grid-collision owner exit: preserve original piece/filter/order, exact float32 hulls, standalone cap removal and native tread expansion; never infer it from the rendered kit. |
| `entryProof` | **Explicit exit.** CS9 native capability proof exit: lanes/steps/transfers are the actual admitted entry result, not ordinary source constants to be retagged or recomputed as expected values. |

### pine-hollow — `world/landmark-view.json`

| Field | Disposition / defining payload or explicit exit |
|---|---|
| `contractBoardSite` | **Explicit exit.** The exact board point also appears in quests/page-composition.json#/board/at; CS9/CS3 whole landmark projection reconstruction remains the exit, retaining all other native view fields. |
| `waystoneSites` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `stones` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `waystones` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `dam` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `canoe` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `board` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `arch` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `archGround` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `lamps` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `archShape` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `zip` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |
| `timberFloors` | **Explicit exit.** CS9/CS3 complete native timber-view/book projection exit: forestPage.ts/timberWorldRows owns exact placed transforms, shapes and floor references; no whole admitted replacement was found. |

### Retained declaration shells

Each still has `version`, `modules`, `prepare`, `install`, `level`,
`ports` and `entries` alongside its distinct constants. The original
`modules`/`prepare`/`install` collections are empty. Pine’s qualified
shell deletion `892e75d553` does not prove these three source, schema
and witness contracts retired.

| Product | Explicit deletion exit |
|---|---|
| driftwood-isle | CS9 closed native-input wire/DSL retirement exit: namedSchemas.ts still attaches HEADLESS_ASSEMBLY_JSON_SCHEMA plus the complete native-quest allOf; its original wire/refusal test is live. Retire the source shell, closed payload schema, explicit proof ENTRY/input and original schema test atomically after constants have defining owners. Never weaken the global grammar to an unknown constants record. |
| nalati-grasslands | CS9 authored constant-book/typed native bootstrap separation exit: data/headlessAssembly.json is also a live source for nativeGroups.ts and clientRiding.ts. Preserve exact source constants and generated native type, return-first admission, runtime weather/ride references and native proof input identity when deleting the inert DSL fields. A wire rename alone is not retirement. |
| nine-dragon-stack | CS9 authored native control-book/witness ABI exit: data/headlessAssembly.json supplies constants/type and source witness snapshot adapter ids; sim-in-runtime also validates its declared assembly form. Retire only inert DSL fields with all those source/fence references and original entry/collision/grapple/portal guards intact, without weakening the census or retagging proof. |

These concrete owner/contract/deletion exits remain explicit after the
row’s exact-slice-or-explicit-exit completion. No live custom emitter,
reader, named validator, policy or ceiling is deleted by this ledger.


## CS3: Pine bounded placement pages

Source `5c72cf6cf03568412d53b9df6e8efe4d75964076` lands the
G612 source-first consolidation. The normal AFTER producer, independent
ordinary strict admission and original consumers qualify its payloads;
the later immutable-preview checks below qualify the affected fixed poses.
This closes the Pine **112-placement page slice**, not CS3's remaining
scene families, tier/shadow-copy retirement, all-pose streaming or CS10.

### Complete rows and unchanged limits

The 112 original complete placement documents (566,608 B) reconstruct
byte-for-byte, in original ID/order/tier membership, from nine native pages
(566,918 B). Pages hold 1–16 complete rows and share device membership;
the existing 128-placement ceiling, original resource/model/collider
checks and owned reads remain. Missing members, foreign IDs, tier mismatch,
malformed unselected rows and missing/foreign provenance refuse before
publication. Admission still verifies the shared file, parses a page once
per scene admission and drops its temporary page map afterward.

The selected Pine normal AFTER verifies 953 bodies / 154,531,543 B;
943 unrelated bodies and their records are exact. All 39 old and 39 new
ordered packs independently reconstruct; the only retained body change is
the placement references in `world/scenes`. All 112 native row words,
other world-scene fields, map image, map body and map input stamps are
exact. The index shrinks **1,779,579 → 1,188,985 B** (−590,594 B), below
the unchanged 2 MB hard ceiling and approximately 1.9 MB Pine target.
Transport headers add 310 B and the references add 1,007 B; these exact
admission membership/cost deltas are accounted explicitly, not normalized
away. The withdrawn 62 welds and eight living envelopes are not retried.

The maintained focused controls pass 82 cases across four suites; the
original world-scenes file also passes all 65 cases with its page
negatives and two-member/one-read check. Original Pine cabin-documents,
prop-product and prop-shapes suites pass four cases in 23.42 s. Root
types and touched typed lint pass. Root independently qualifies the
ordinary containing release: all 37 required/native4/SIX, exact-source
live BUILD/version, maps/API and own Sky/P1 pass (`qa-5c72-complete-proof`).

### Immutable pins and strict pixels

BEFORE is `8b4d4eed6d5e9714d397ae39fe934c8e2ce0beb2`, build
`8b4d4ee-mvx6qqw4`; AFTER is the landed `5c72cf6cf0`, build
`5c72cf6-mvx8misk`. Both are normal `--rev` previews. The AFTER's
953 bodies and 39 packs independently match the qualified normal output.
Its only index difference is `build.validator`: the actual committed
revision `2f738d5e…38a5` reconstructs from all 717 exact committed
inputs, while the earlier working-tree producer used `f3a052b5…3d04`.
The source hash and every other index field are exact. The raw whole-index
refusal remains recorded; no production admission check is bypassed.

The full 8b→5c72 source contrast is declared, rather than called a pure
leaf comparison. Pine's intervening roster/elites changes add only schema
metadata to exact bodies; scaffold `892e75d553` removes dead DSL fields
from `sim/headless-assembly` (64,873 → 64,095 B), retaining all three
constant bodies exactly. No working-tree renderer edits or response
overrides enter either preview.

The maintained native Metal fixed-world-frame protocol captures Pine P1
and P2 at both real phone and desktop tiers, iPhone 16 Pro viewport
402×874/DPR2 and full RGBA 804×1748. Four fresh-context **A/A** and four
landed-SHA **A/B** comparisons all have **zero differing pixels** with
the strict comparator; all six native boots/frame gates pass. Camera
metadata is exact. P1 calls/triangles are 73/835,267 (phone) and
133/4,739,135 (desktop); P2 is 30/454,916 and 50/2,743,815.
The actual advanced P2 camera height is −104.011111 in both pins; this is
the retained existing P2 protocol, not proof of additional surface views.
Viewmodel is excluded by the original world-frame reader. No tolerance,
forced shadow variant, all-pose claim or physical-iPhone FPS claim is added.

### Clean Pine entry and bytes

One serial before/after pair uses the maintained `phone-loading` caller:
`--preset phone --flow select:pine-hollow --engine chromium`, default
title/post-control dwells and 240 s deadline, CPU10 and 10 Mbps/100 ms.
No CPU profile, response fixture or accounting filter is used. Both arms
exit 0; all four native entered-control witnesses qualify, `errors=[]`
and maintained request accounting is complete.

| Measured field | BEFORE cold | AFTER cold | BEFORE warm | AFTER warm |
| --- | ---: | ---: | ---: | ---: |
| Entry to native control (s) | 138.235200 | 137.468800 | 30.129800 | 29.147600 |
| All recorded request events | 1,690 | 1,390 | 1,226 | 1,018 |
| Page-network known encoded body (B) | 120,022,292 | 121,195,678 | 62 | 62 |
| Page-network known transfer incl. headers (B) | 120,465,519 | 121,578,510 | 953 | 953 |
| Page-network known decoded body (B) | 217,359,266 | 219,564,118 | 14,435,318 | 14,435,318 |
| Page-network unknown-size events | 5 | 5 | 2 | 2 |
| SW decoded response body (B) | 576 | 576 | 119,337,537 | 117,320,294 |
| Worker known transfer (B) | 0 | 0 | 1,792,275 | 1,792,275 |

The entry-to-control clocks are no worse in this pair. This selected Pine
flow has **no Home row** and its native witness has `gridHome=null`;
there is no separately measured Home-ready clock. Native phase envelopes
remain separate rather than being added or relabelled as Home.

The cold known network transfer is **1,112,991 B higher**, so the whole
visit is not claimed as a byte reduction. Exact raw decomposition is:
unchanged retained bodies +1,332,917 B; app/other −89,948 B; index −15,570 B;
placement transport **429,504 → 315,096 B** (−114,408 B). Among the
unchanged-body observations, a 608,260 B bin is requested 11.1 ms before
control only in AFTER and finishes 3 s later; other identical URLs have
one versus two nonzero wire bodies despite the same three request events.
These are observed delivery/cache-frontier differences, not changed
render payloads or an isolated causal speedup. The selected placement
request events are 327→24 cold and 218→16 warm; repeated receipts do not
mean that many unique files. SW and worker sources stay separate to avoid
double-counting; unknown or in-flight sizes remain unknown, not zero.

Both preview leases release normally after the complete cohort, all
browsers close, and X1 receives the next sole producer turn. Retained
scratch is `tmp/sp-x2-cs3-placement-pages/`: full payload/pack audits,
committed-validator inputs, immutable source contrast, four maintained
loading records and all strict capture records. No unchanged run is repeated.

### CS5: four native aliases and the whole panel catalogue

**2026-10-31, one combined AFTER after the qualified Pine placement
turn.** Bind Pine `quests/native-story.json`, `quests/native-spots.json`
and `quests/contracts.json`, and Nalati `quests/carried.json`, to their
existing whole schemas and **full native parsers**. Saved-role and spot
identities, contract references and carried state/output checks remain
strict. Append the defining SDK roots without changing any of the
**226** existing named wire contracts.

`quests/panels.json` is one shared whole catalogue with two actual users.
Its named `QuestPanelCatalogueSchema` and `parseQuestPanelCatalogue`
retain the original reader's 16-panel outer refusal before per-panel
admission, 8,192-node / 32-depth bound, safe action paths and
transient/persistent shown-frame rule. `readDataPanels` delegates that
same original parser sequence; its rendering, callbacks and scoped panel
owners are unchanged. Pine's metadata adds only the already-enforced
outer bound and defining provenance; Nalati gains the complete catalogue
metadata. All six target document bodies remain byte-identical.

The fresh BEFORE is captured **before activation** on the checked
`5c72cf6cf0` handback. Ordinary strict admission is CURRENT independently
for DW, Pine and Nalati; their full payload bodies, source-map input
corpora, manifests and 74 ordered packs are hash-verified and sealed.
No local draft oracle, earlier namespace or BEFORE generation is used.
The foreign loose `ENGINE.md` changes remain untouched; only this API's
manual paragraph is included in the fresh HEAD-only commit patch.

One normal DW/Pine/Nalati AFTER takes **44.673 s**. Ordinary strict3
admits every target, and the final strict3 still reports CURRENT after
the consumers. The **five original plus two new suites / 31 cases pass
in 23.899 s**: native-story admission, Pine contract admission, carried
quest host, data panels, declared panel lifecycle and the two new native
catalogue/provenance suites. Root types, touched typed lint and the
physical panel controls pass. Nine physical code/test hashes remain
frozen through the entire producer and consumer proof.

The corpus has **1,822 unique payload paths / 323,047,922 B**. All
**1,821 other payloads / 323,047,758 B** are exact. Precisely six defining
metadata records change: four Pine and two Nalati. Every other manifest
field and custom schema is exact; ordered pack members, offsets and both
old/new pack hashes reconstruct. Pine and DW map stamps are unchanged.
Pine's index is **1,189,307 B**, below both the roughly 1.9 MB rule and
hard 2 MB cap; Nalati is **1,108,884 B**, DW **995,665 B**.

The raw comparator retains **EXIT2** solely for Nalati's 164 B
`look/map` source stamp: `e40e2211…57c520` to `62a2bba6…4dd95a`.
The new stamp equals the current `mapTilesHash`; the old full ordered
source inputs reconstruct the old stamp exactly. Only Nalati
`generators/output.ts` changes in that source corpus: the carried/panels
metadata options and unused schema import removal. Image
`80afaa55…aff2d6` and every other map field are identical. **G872, 2026-11-02:** self-apply this established source-stamp class;
wildshard-new also explicitly concurred with this exact case. No tolerance,
old-stamp freeze or freshness bypass is introduced.

This qualifies eight of the historical 14 quest names, including the
earlier DW three. The six presentation/figure/discovery/finds/story/guest
contract or ownership exits and live `custom/questRuntime` remain open;
no new host-bar or CS10 deletion credit follows. X9's prepared CS9 body
omissions are excluded from this proof and source patch.

Evidence is `tmp/sp-x1-cs5-combined/{capture-complete,before-strict,
payload-before,source-final,strict,audit,map-source-audit,proof-exits,
originals-report}.json`, the five step logs and final types/lint logs.
The exact source-stamp difference remains in the raw audit.

**Standing G872 rule (2026-11-02):** builders decide each case on the
recommended option. Apply an established class with exact case evidence
and record it as self-applied in the commit; report genuinely new classes
with the recommendation, proceed and log the decision. Do not wait for
coordinator availability. This changes decision routing, not comparators,
source freshness, payload identity, caps or native assertions.

## CS4 / CS7 completion bar

**2026-11-02, sp-x1 — Jake's landed-slice-or-recorded-exit ruling.**
The completed-bar ledger above already contains the exact source commits,
original native/payload/pack checks and per-case source-stamp evidence.
No second proof ledger or new run is needed. The two row marks now use
the same explicit classification bar as CS2 and CS6.

| Row | Why its classification bar is met | Obligations retained by its explicit exits |
|---|---|---|
| **CS4 — done** | Five field descriptors (`bb782c4930`, fixture `f9caf76f31`), common Pine physics (`5596fde41e`, maintained 75/75 walk with zero stuck/bounds/pending), three floor/cave contracts (`b5a7dc391d`) and the two complete ground aliases (`d0c35248f3`) have their recorded qualifying proofs. | Pine `data/physics.generated.json` remains a complete-owner-contract exit, not a ground-only registration. G667 tests 2–6 remain host work. The CS9 field ledger preserves terrain/navmesh bindings, native bake configuration, weather shelters, body/variant recipes and grid-collision piece/filter/order/hull/tread owners; rendered geometry or an admitted child is not a full replacement. |
| **CS7 — done** | Shared audio/cards (`2c5aa6386d`, proof `515ffcac96`) are qualified. The exact 25-name source table accounts for every remainder once: ten existing native-root candidates with defining-metadata/native-owner qualification exits, plus fifteen complete-contract, binary, ownership or collision exits. | Keep every original resource, entered/cold lifetime, slot/part reference, native bound, non-strict parser semantic and approved user scope. Preserve the full envelope/model-library/specimen-user/water exits and Pine/Nalati weather collision; no child-only root, inferred wrapper, union, alias or changed payload is approved. |

The ten existing-root candidates are the ranged page, held slots, cover
appearance, post look, held cards, bow page, firearm rows/page, rain and
weather observations named in the 25-row table. They remain **explicit
qualification exits**, not silently implemented registrations. The other
fifteen retain their already named complete-envelope/catalogue (seven),
held/guest/power (three), geometry-library/binary (two), specimen
owner/genericity (one), water-envelope (one) and weather-collision (one)
exits: **10 + 7 + 3 + 2 + 1 + 1 + 1 = 25**.

These done marks close the assigned slice-or-exit classification bar.
Unimplemented migrations remain with their exact owners; no host score,
second user, collider change, private-path deletion or tolerance is
inferred. CS10's live emitters/readers, validators, policy and ceilings
stay unchanged, as do the other open rows. Evidence reconciliation:
`tmp/sp-x1-cs4-cs7-close/reading.json`. No build, test, native worker,
browser, stamp rewrite or requalification is performed for this update.

## CS9: exact constant derivations and completion bar

2026-11-02, sp-x1: the eight remaining exact derivations have the
sealed ordinary CURRENT BEFORE and one coalesced G972/CS9 physics7
normal AFTER. The original malformed-return rejection still precedes
all new reads, on all four native hosts. Native semantic parsers and
all original caps, assertions, independent replay and proof inputs stay.

Driftwood's sea, interaction table/spots, wake cues and native counters
come from their admitted defining payloads. Nalati's day clock,
knockdown and horse pose come from the complete admitted forest-weather,
original riding and species-look values. The three emitted documents
reconstruct every original canonical byte, including each removed
value's type and signed zero. All other payloads and descriptors,
section/schema membership and ordered pack contents reconstruct exactly.

Original eight suites / **36 cases PASS in 48.5 s**; typed lint passes
for all eight changed source/test paths. The earlier root-type failure
was confined to sp-o1’s render tests and fixed separately. The normal
physics7 refresh is shared with G972; an actual compiler-input crossing
was retained as an ordinary refusal and corrected once on the frozen
tuple. There was no unchanged retry or BEFORE repin.

Across 869 payload paths, **865 other bodies / 167,385,053 B are exact**.
Only the three intended omission-only documents and Nalati’s 164-byte
map stamp differ. Schema/section membership and defining metadata stay
exact; hash references and library accounting reconstruct from only the
measured target changes. All old/new ordered packs and actual pack files
reconstruct. Indexes: DW **995,665 B**, Nalati **1,108,883 B**, unchanged
Pine **1,189,307 B** (below the about-1.9-MB policy).

The raw comparator remains **EXIT 2** for exactly Nalati’s `look/map`
source stamp:

- Old: `62a2bba69d38898571e05bd23cb8fb7713aa74e6bbf372da37a38049a74dd95a`.
- New/current `mapTilesHash`: `fb19cfa3ad381e9e7e4a1dca2f2f81f01dc0e03eaed707a4bab97abb418916df`.
- Identical image: `80afaa55b292b48c93694dbc7ac95557ecb96714b2c159cd467ff3fa0caff2d6`.

The full old stamp is independently reconstructed. Only `output.ts`’s
two duplicate constant omissions and `tamingPoseRows.ts`’s duplicate
horse-pose omission changed its map source inputs; every other map value
and image byte is exact. **Self-applied G872 established exact
source-stamp class**, under Jake’s 2026-11-02 standing delegation. This
is one recorded case: no tolerance, frozen old stamp or weakened freshness.
Evidence: `tmp/sp-x9-cs9/remainder/` (`payload-before.json`,
`payload-after.json`, `originals-report.json`, source hashes and raw
refusal logs).

The complete 69-field ledger is reconciled: eight qualified derivations
and 61 explicit owner/contract exits. Pine's declaration shell is already
retired by 892e75d553/c6f4b14668; Driftwood, Nalati and Nine retain the
three explicit source/schema/proof-witness shell exits. This meets the
requested exact-slice-or-explicit-exit completion bar. No remaining live
owner is silently deleted or promoted, and CS10's emitters, readers,
validators and ceilings retain their existing exit conditions.


### CS3: Pine tier/shadow source derivation (2026-11-03)

**Source-only audit complete; exact candidate off-tree.** The four complete
`scenes/cabins-{phone,desktop}-shadow-{false,true}.json` bodies (339,196 B)
reconstruct byte-for-byte from the existing phone/shadow-true root. The
prototype selects whole native rows, preserves all numeric words/culls,
rebinds explicit aliases and validates each complete target root/hash.
All four SHA256/size checks and nine refusal controls pass; no provider,
wire-format, runtime, registry or generated output is activated.

| Choice | Decision | Exact native distinction retained |
|---|---|---|
| Phone/desktop, shadow false | Exact derivation prepared | 72 nodes/81 resources; every actual geometry body, attribute binding, numeric word, bound, material and cull is equal after aliases resolve. Placement/set IDs retain each original branch. |
| Phone/desktop, shadow true | Exact derivation prepared | Same result over 75 nodes/93 resources. The apparent tier geometry differences were recorder aliases; physical file hashes are equal. |
| Shadow false from the true canonical source | Exact bounded projection prepared | Select 72/75 nodes and 81/93 resources, remap original part/batch IDs and restore six exact casting rules. Full original roots reconstruct, including native external parent/cull anchors. |
| Drop shadow-specific geometry or alias false to true | **Explicit exit / KEEP** | True needs three extra mesh nodes/four extra unique geometry bindings; six meshes also use different existing cast-distance rules. Preserve both authored modes. |
| Delete the four files with today's transport grammar | **Explicit integration exit** | The native source accepts complete graph files and tier/knob file choices, with no projected-root port. A complete typed contract and all-branch/selected-owner integration remain necessary; the off-tree authoring prototype supplies no new runtime authority. |

Current ordinary Pine index is 1,189,307 B. The source binding audit verified
322 immutable model files / 20,553,212 B. Canonical root is 86,921 B;
all four prototype recipes are 69,499 B (156,420 B raw-content sketch only,
not a current product, archive or loading saving). Full payload/index proof,
landed-SHA strict captures at both tiers/shadow choices and loading proof for
changed streaming remain open. CS3 remains open; Driftwood has priority.


## CS10: Pine seven-case decisions

**Done, 2026-11-03, sp-x9; agreed disjoint split with sp-x1.** X1 owns DW's
five sections and Pine runtimeGraphs/cabinAmbience. This half owns the
seven Pine names below. These are per-case decisions under Jake's standing
G872 rule, self-applied without waiting for a coordinator pick. The global
CS10 deletion bar and all live named-JSON validators/policies stay unchanged.

| Pine section | Observed body | Decision and complete defining carrier / remaining exit |
|---|---:|---|
| `custom/cabinAppearance` | 594 B | **Done: redundant emitted copy retired.** Complete native `world/forest-page.json` supplies buildings.life/light; admitted `world/scenes` supplies all three exact cabin smoke/flame/ember material bindings. The whole old canonical object reconstructs; retain original life/material negative assertions against these carriers. |
| `custom/kingKit` | 311 B | **Done: redundant emitted copy retired.** Complete native `combat/roaming.json` supplies projection.socketRig.pool and the hazards-ordered attachment positions. Full pool parts, every floating-point coordinate and original <=3 hazard capacity remain; the actual baked kit/model still ships. |
| `custom/paintedTextures` | 718 B | **Done: redundant emitted copy retired.** Existing `held/equipment` supplies all three coat textures; complete native `client/ranged-page.json` supplies collection chalk/texture. Reconstruct the entire textures/chalk object, including every URL, colour-space and repeat flag; preserve original named-asset checks. |
| `custom/thrallLook` | 8,900 B | **Done: redundant emitted copy retired.** Existing `look/hull-book` elk row supplies the complete postPose, thrall tint and traits; remove only the explicitly added derived antlers=1 field when reconstructing the old object. Every numeric channel/input/output/restore/scalar row and value remains exact. This test/proof projection installs no runtime adapter or new schema. |
| `custom/trophyMounts` | 970 B | **Done: redundant emitted copy retired.** The complete `client/ranged-page.json` collection.pack is the original CollectionMountPackSchema value. Preserve all geometry/index ownership, bytes, SHA, slots and original resource-presence assertions; only the redundant custom document/schema retire. |
| `custom/nativeView` | 8,648 B | **Explicit exit / KEEP.** `test/fixtures/pine-headless.ts` still reads BOSS_ENCOUNTER.profile, and the original runtime-mirror test checks the complete NativeViewSchema envelope. Combat's encounter child alone does not replace all ribs, presentation/cues, clearing/cave, fog/look, spray and prop-kind/box fields. A complete admitted derivation plus unchanged native-witness/input proof is still required; a renamed private look/native-view wrapper is not a platform migration. |
| `custom/questRuntime` | 29,289 B | **Explicit exit / KEEP.** The real client-plan quest.spawns source, forest-story content and native fixture remain live. The local whole envelope includes lead.program, events, deaths, pageDeaths and content with unresolved complete guest/AS ownership. Existing native-story/page children do not cover it. Keep all content/source/save/phase/reference/native assertions until a complete format and the actual custom-port migration are proved. |

All five complete bodies / **11,493 B** reconstruct exactly from the six
full native carrier parsers. Together with X1's runtimeGraphs and
cabinAmbience copies, this commit retires seven Pine bodies / **13,442 B**
and their **8,981 B** schemas. Existing named ambience, the full graph
implementation, held equipment, ranged page, combat and hull-book remain.
Author input dictionaries are not mistaken for runtime custom readers;
the unreachable heldToolPlayback fallback is preserved for narrow scope.

The fresh ordinary CURRENT DW/Pine BEFORE was sealed once. The one normal
AFTER publication and strict admission pass, and the sole corpus comparator
exits **0**: all 1,393 remaining paths / 234,342,145 B, complete native
assemblies, file/schema metadata and every old/new ordered pack verify.
No map stamp or other exception is needed. All twelve original/native
suites pass **29 cases / 35.50 s**; root types and touched typed lint pass.
See the combined receipt below for the ten-copy scope and exact pack
deduplication; this is not a cold-author or frame-time gain claim.

The generator-side cabin diagnostic uses the existing complete SDK
forestPageRows/worldSceneRows facades, keeping every original equality
and malformed-row refusal. Its first forbidden-format import lint is
retained; no new API, schema shim or moved map input fixes it. The initial
observed-body probe and off-tree patch were readiness only; the qualified
current corpus now supplies the retirement evidence. Artifacts remain in
tmp/sp-x9-cs10 and tmp/sp-x1-cs10.

**G798 declaration correction:** the earlier manual DW table command had
failed module resolution, leaving old declarations in the precommit
fifteen-path fence. The maintained hook correctly regenerated those two
DW declaration tables in f534af4da8, and post-generation root types pass.
Authored source, native assemblies and shipped payloads do not change;
the two generated DW hashes intentionally advance after the closed proof.
Pine's maintained table generation succeeded and its two hashes remain
the qualified values. No corpus, native visit or publication is repeated.

Pine nativeView and questRuntime retain their concrete KEEP exits above.
The shared original named-payload test reaches the exact qualified final
bytes only in this second, ordered commit; the first DW commit keeps the
then-live Pine assertion intact. OP4's browser captures remain queued.

## CS3: Driftwood twelve-row pages (2026-11-03)

**Initial f84 reading: bytes/pixels qualified; loading missed. The later
fix-forward closure below resolves loading and separates inherited G5.**
Source `f84fb23bf34cb88bb0624ce503a52184a77bd9b8` consolidates twelve
existing pier/log/foliage rows into three bounded native pages. Original
IDs, order, device membership, resource/collider values and JSON wire are
exact; filenames do not invent tier filters. No format, host or cap changes.

The sealed BEFORE has 469 bodies / 79,874,900 B and index 995,665 B.
ONE normal AFTER exits 0 in 23.26 s, with independent strict CURRENT.
All twelve old documents reconstruct byte-exact (688,231 → 688,309 B,
+78 B envelopes), as does the complete old world/scenes body after only
restoring its references and object key order. All 455 unrelated bodies /
78,497,132 B and thirteen ordered packs verify; map image/body/source
aggregate are exact. Index is 944,607 B (−51,058); total body bytes rise
391 B (78 envelope +313 references). Library accounting rises exactly
78 B compressed/resident; authored/server limits are unchanged. The raw
membership comparison remains a difference, not a waived exact result.
Original two files pass 7.7 s, native page/sliced/footprint suites pass
1.9 s, root types and touched typed lint pass.

Self-applied G872 covers only the exact row reconstruction. G612 source
landed before immutable captures: BEFORE `9981182077129c21edc8444503574d22f4ad44b4`
/ `9981182-mw09nx61`, AFTER landed `f84fb23bf3` / `f84fb23-mw09uh3e`.
The full source contrast adds only these three DW source files besides
tests/docs; foreign renderer edits are excluded. Existing BEFORE was
normally borrowed, with no new BEFORE producer or baseline repin.
Both actual phone and desktop quality tiers pass **18 native Metal
captures: six A/A and six A/B, every RGBA pixel identical** at committed
pier/beach/wreck poses. Portrait iPhone16Pro 402×874/DPR2, actual tier,
original frame gate/control, camera, authored held midday, GL/readback and
page-error guards pass. No working-tree preview, override or tolerance.
Only these affected poses qualify. Both browser phases closed; own AFTER
stopped and only own BEFORE borrow released.

### Clean loading: no-worse bar remains open

The maintained b13fab phone preset ran once per immutable source, using
the unchanged select:driftwood-isle Chromium defaults without profiles,
filters or fixtures. Both commands exit 0, four native controls qualify,
errors are empty and accounting is complete. There is no native Home-ready
row; overlapping envelopes are not substituted or added.

| Observed measure | BEFORE | AFTER |
|---|---:|---:|
| Cold tap → control | 45.2489 s | 46.7629 s |
| Warm tap → control | 23.2231 s | 24.8974 s |
| Cold recorded request rows | 1,178 | 1,157 |
| Warm recorded request rows | 873 | 855 |
| Cold network encoded / transfer B | 21,730,633 / 21,922,980 | 21,730,571 / 21,921,732 |
| Cold network decoded B | 135,988,577 | 140,095,867 |

Warm source rows stay separate: SW 852 → 833, network 11 → 12, worker
10 → 10. Network encoded/transfer stays 62/953 B; SW/worker wire bytes are
zero and are not summed into network savings. Native accounting retains
two cold in-flight background rows per side and one → two warm rows.

**Loading misses the bar:** +1.5140 s cold, +1.6743 s warm. O1's previously
active Chromium/WebKit counts and ordinary correctness CPU overlapped;
there is no isolated cause/gain claim or repeat. Passive native placement
admission is 58.5 → 72.1 ms cold and 52.1 → 78.0 ms warm; library/modules/
audio also move. Next is cause-directed native admission versus broader
loading analysis before any earned follow-up pair. Keep source landed
under G612, fix forward on a concrete cause, and leave loading/CS3 open.
No further scene/tier-copy retirement is credited. Retained compact audit,
hashes and readings: tmp/sp-x2-cs3-driftwood-pages/ and its two exact-source
phone-loading folders; the source/qualification commits record the results.

## CS3: non-Nine placement-page eligibility (2026-11-03)

**Source-only exit for the requested existing-root paging slice.** Nine
streaming is deferred until after Jake's morning QA. Re-auditing Nalati
and Far Reach with x2 finds neither has individual
`world/scenes.placements` documents to consolidate with Pine's existing
`worldScenePlacementPages` helper. No emitter, reader or runtime changes.

| Shard | Existing placement-page candidates | Other documents are a different complete format |
|---|---:|---|
| Nalati | 0 | `dressingPlacementProgram.ts` produces 18 scatter groups. `dressingSchemas.ts` emits 16 differently typed JSON arrays plus two numeric binary tables; the dressing reader consumes these, not `WorldScenePlacementRow`. |
| Far Reach | 0 | `worldScenes.ts` emits scene recipes referenced by ordered scene steps, not placement rows. The physical inventory contains 15 recipe files/steps. |

The defining emitter/helper sources were HEAD-clean at the audit. The
physical `out/` snapshots independently contain zero placement references
in both products, matching x2's retained inventory; those snapshots are
hash-bound observations, **not CURRENT product admission**. Exact source
and index hashes are retained in
`tmp/sp-x6-cs3-non-nine-pages/audit.json`. Packing either other family
would need a separately defined complete native transport and consumer
audit; re-labelling those bodies as the existing placement-page grammar
would weaken admission. No generation, loading pair, pixel capture or
machine reservation was needed or claimed. CS3 as a whole remains open.


### Driftwood loading regression: fix-forward closure

**2026-11-03: the loading regression is resolved, without restoring the
twelve-document transport.** `61cacd3f5813ee4e81cd676a40f0e783705c9d9b`
moves complete native page decoding into verified metadata read-ahead;
`241f1d9cdbcee953241e19526574b93f508b0231` revalidates the original read
owner immediately after awaiting a prepared page. Existing sixteen-read
parallelism and file deduplication already existed: they were not replaced
by serial fetches. Full-page parsing had instead waited at the ordered
admission cursor. It now runs while other verified metadata is pending.
Both successful and failed parse results stay retained until that original
cursor. No partial row publication, early rejection, skipped malformed
member, schema/JSON guard, lifetime check, transport count or cap change.

Three new real-parser/cursor/refusal controls plus original native page,
read-pool and platform suites pass (four files, 7.8 s); the additional
post-await owner guard passes its three-file focus (8.3 s), root types and
touched typed lint. Hash-bound actual-input CPU comparison finds twelve
old parses 4.357 ms versus three page parses 5.856 ms (20 alternating Node
samples after four warmups). That explains added page validation work, not
the entire previous 1.5–1.7 s shared-host loading miss.

The one cause-directed immutable AFTER is exact
`53dd955063aca925db357a583c4101db03720aec` / `53dd955-mw0atk0y`, including
the separately required OB0 boot-inventory repair. All 460 bodies /
79,875,291 B, their complete declarations and thirteen packs match the
qualified f84 output exactly; index remains 944,607 B. The old 998 source,
payload baseline and initial timing readings were retained, not repinned.

| Native tap → control | Original 998 before | Regressed f84 | Fresh matched 998 before | Fixed 53dd |
|---|---:|---:|---:|---:|
| Cold | 45.2489 s | 46.7629 s | 58.5952 s | **44.8011 s** |
| Warm | 23.2231 s | 24.8974 s | 27.3668 s | **23.0956 s** |

Both clean maintained preset commands exit 0; all four controls qualify,
errors are empty and accounting is complete. The fixed values are no
worse than **both** the fresh matched and original historical BEFORE.
Fresh recorded request rows are 1,168 → 1,165 cold and 872 → 855 warm.
Native placement-admission spans move 67.2 → 1.7 ms cold and 73.8 → 0.1 ms
warm: complete validation has left the late ordered cursor, not vanished.
O1's existing counts cohort and X8's finite pure-Node component overlapped;
retain raw measurements without claiming an isolated speedup, entire-run
RCA or additive costs from overlapping spans. No further loading retry.

### Pixel/source classification remains exact, not a tolerance

The original f84 page consolidation retains its six strict A/A and six
strict A/B zero-pixel comparisons. A fresh 998 → 53dd source contrast also
crosses G5 `e31e8f5672` and other explicitly listed commits. After correcting
a reader-only double-offer bug, native zero-budget settlement strictly
holds frame/app-clock/camera, and gate query plus advance share one browser
JS turn with the unchanged exact +1 guard. Phone A/A is zero at all three
poses; phone A/B pier and beach are zero, but wreck **strictly refuses one
pixel**, `(46,764)` green 216 → 215. Desktop after that refusal is unstarted.
This contrast is not reported as twelve passing comparisons or zero.

A bounded cause-only reading, on both exact source pins, observes actual
submitted draws at that pixel. All six final full-image hashes, frame,
clock and camera match the retained old/refused-new images exactly; the
observer changes no pixels. It skips shadow/offscreen targets and restores
read-framebuffer/read-buffer state, with native GL errors forbidden. Sky
then ground write identical colors and have identical submitted shaders.
The final changing draw in both normal render passes is
`graph:material:driftwood-ocean`: old RGBA [214,216,214,255], new
[214,215,214,255]. Submitted ocean fragment hashes are:

- old: bf10ccb962cc840352372cb807abddfe26117479a4eb492af9a59831fd3e978c
- new: adadbf113475a091eea8d2f9540846b163b9d7b06d9ce6237a905a9189a43d16

Actual old/new vertex and fragment sources contain the exact pre-G5/G5
emitted ocean bodies. The independent 47-graph source audit finds only
ocean and gulls changed; all 45 others are exact. G5 owner sp-o3 concurs
that this ocean edge is within its already accepted e31 performance class.
**Self-applied G872:** classify this inherited compiler edge separately;
do not alter the comparator, introduce a new pixel allowance, claim a
bit-exact current cross-G5 image, or attribute it to page payload changes.
No compiler revert or shard branch is introduced. Original page pixel
proof and current identical payload/ordered-publication proof remain scoped
to the page change; the raw current cross-G5 refusal remains visible.

The first new capture refused before AFTER pixels because the scratch
reader armed remaining=1, crossed a CDP gap and then rearmed advance(1).
An unchanged-helper controlled case proves old 2→4 versus atomic 2→3;
there is no production frame-budget change. The first cause observer also
refused before target reads on its wrong renderer accessor, then used the
maintained game.renderer path in the earned continuation. Both refusals
are retained. A lost 53dd lease caused one replacement same-SHA snapshot
(unplanned correctness CPU overlap disclosed); its 460 bodies/packs are
exact too. No known-bad G5 prefix, working-tree preview or response override.
All browsers, builds and own leases are literally closed. Compact source,
shader and cause evidence is under tmp/sp-x2-cs3-driftwood-pages/; no new
scene family or tier-copy retirement is credited by this loading closure.


## CS10: seven-case ownership and combined retirement proof

**2026-11-03, sp-x1; DW first, Pine second.** The three DW copies below
landed in f534af4da8. The two Pine removals now land with the five Pine
copies above in the second ordered source commit, using the same full proof.
This table supersedes only the corresponding historical census decisions.

| Custom section | Exact complete carrier / disposition |
|---|---|
| DW `cumulusPuffs` (9,013 B) | **Done:** full native `parseToonLook(look/toon).sky.clouds.puffs`; exact original cloud rows and original nonempty assertion remain. |
| DW `gullFlock` (1,607 B) | **Done:** full native `parsePageLife(actors/page-life.json)` gull flock row, with original assembly ambient flock unchanged. Packed rows, draw ownership and lifetime checks remain. |
| DW `enemyPlacements` (8,572 B) | **Done:** existing complete `sim/enemy-placement.json`; keep its native schema, seed/sampling and keeper controls. The original named-body test now compares complete authored canonical bytes and asserts only the duplicate is absent. |
| Pine `cabinAmbience` (1,564 B) | **Done:** full ForestPage buildings floors/firePits and existing named `world/ambience.json` reconstruct the complete old canonical body. Audio order/caps and native parser remain. |
| Pine `runtimeGraphs` (385 B) | **Done:** full ForestPage graphs reconstruct all 20 exact IDs; every hash-bound graph file and native look owner remains. No look math or cache changes. |
| DW `collections` (2,698 B) | **Explicit live-port exit / KEEP:** complete CollectionDisplaysSchema exists, but collectionDisplay and continuation dynamically read the synchronous custom port. A migration must preserve cold/entered/read-once catalogue, model and keepsake lifetimes together; a filename or asynchronous JSON substitution is insufficient. |
| DW `fixedLayouts` (7,855 B) | **Explicit live identity/owner-port exit / KEEP:** complete G571 ResolvedIslandLibrarySchema is approved. islandBook's preflight resource/unique-slot checks, product/root identity cache, three post-await identity checks and resourceScope ownership remain live through islandLibrary and people/cards draws. Migrate that entire port before deleting it. |

### Frozen combined proof, not a global zero-user claim

Fresh ordinary CURRENT DW/Pine BEFORE was sealed once without a BEFORE
generation. The initial independent reader ordering refusal and transient
ordinary admission refusal remain historical; neither was repinned. The
reader now follows actual projectDecisions order, including rebuilt
sim/scripts last, and independently reproduces writer phase/tier/alternative
membership and global hash deduplication for both complete pack layouts.

One normal AFTER succeeds; the maintained reuse CLI also keeps its four
program-bound discovery companions current (six reused, zero rebuilds).
Independent strict DW/Pine and the full AFTER corpus pass. Exactly twenty
body/schema paths / **64,703 B** retire. All **1,393 remaining bodies /
234,342,145 B**, every remaining descriptor/schema/metadata and both full
native assemblies are exact. Ten complete old canonical bodies / 32,634 B
reconstruct through the original full native parsers. Every old and new
ordered pack plan (52 per layout), actual pack body, hash and offset verifies.
Packed bytes decrease 54,567 B: equal-hash named enemy/ambience members
survive and may move to their later writer phase, rather than being deleted.
DW index is **943,030 B** and Pine **1,185,500 B**, below the unchanged
2 MB cap and Pine's approximately 1.9 MB working ceiling.

All twelve original/native/reconstruction files pass **29 cases / 35.50 s**;
root types and touched typed lint pass. Full source/controller fences pass
before and after the publisher, corpus and original tests. A later
open-plots README-only commit follows this closed proof and is outside its
runtime/source inputs; it is not silently substituted into the old fence.
**Self-applied G872** covers the exact duplicate retirement only. Raw
comparison passes with no failures: no map-stamp exception, tolerance,
freshness waiver, altered assertion/cap or collider change is needed.
There is no cold-loading, network, frame-time or isolated CI gain claim.

The full combined end state retains four real custom bodies / **48,490 B**:
DW collections/fixedLayouts and Pine nativeView/questRuntime, with the two
Pine exits documented above. Named JSON validators, custom-name admission,
growth/freeze policy, ceilings and compatibility readers remain live.
The current two-product proof counts 167 named JSON files; the historic
six-product 461-name census is not a fresh full-product zero-user proof.
**At this retirement landing CS10 remained open toward deleting the path; the completion ledger below supersedes that row status only.** No guard or tool is deleted
merely because ten redundant copies retire. Compact evidence is retained in
tmp/sp-x1-cs10 and tmp/sp-x9-cs10; no extra native/browser/walk is required
for unchanged collider, geometry and native assembly bytes.

## CS10 completion bar and named implementation exits

> **Superseded 2026-11-03 (zero goal):** none of the KEEP exits below is an ending. Each is built by a zero row:
> E1 / E2 → Z7, E3 → Z0, E4 → Z8, E5 → Z15, E6 → Z1 + Z15 ([map](#exits-become-host-rows)). The ledger stays as
> the record of what each port must preserve.

**Done, 2026-11-03, Codex takeover from sp-x1/sp-x9.** The coordinator's
fresh-context instruction applies the same exact-slice-or-named-explicit-exit
bar as CS2–CS9, with **G872 self-applied**. This closes CS10's disposition
work, superseding its earlier open-until-deletion status and order step 5.
The generic-only end state remains the target. None of the exits below is
an implemented migration, host approval, guard waiver or zero-user proof.
Their implementation remains **open in this plan**.

The ten redundant copies retain the ordered landed authority
**`f534af4da8` (DW) → `c8c844c993` (Pine)** and the full combined proof
above: complete old canonical reconstruction, 1,393 remaining bodies /
234,342,145 B exact, native assemblies exact and all 52 old / 52 new
ordered packs verified. The 29 original cases, types and lint belong to
that retirement proof; they are not claimed as freshly rerun here.

The closeout source audit is pinned to
`a8f1f940c772319f53bc3fa38afd23682555e522`: sixteen committed defining
producer/consumer/fixture/policy files were checked without adopting loose
peer edits. DW declares exactly collections/fixedLayouts and Pine exactly
nativeView/questRuntime. Those four retained bodies total **48,490 B** in
the qualified combined corpus; this is not a fresh all-24 product census.

| Named exit, implementation open | Live reason and exact retirement condition |
|---|---|
| **CS10-E1 — DW collection port / PORTED** | **2026-11-03, sp-x9, `3c42144c50`:** complete 2,698 B body moves byte-identically to synchronous `collections/displays`. CollectionCatalogue and quest continuation use the same full native root. Original geometry preparation, checked/deep-frozen read-once catalogue, pinned product, cancellation, model ownership and keepsake/save lifetimes remain. The exact two-reference ruling and full payload/native/pack/capture/Explorer proof are [below](#cs10-e1e2-driftwood-platform-ports). |
| **CS10-E2 — DW fixed-layout port / PORTED** | **2026-11-03, sp-x9, `3c42144c50`:** complete 7,855 B body moves byte-identically to synchronous `models/island-library`. Preserve whole-plan resource/unique-slot/collection-slot admission, product/root/recipe cache, checks after awaits, caller resourceScope and catalogue/library lifetime. Entry and cold Explorer use that same admitted root; both custom copies and their emitted schemas retire. The [qualified proof](#cs10-e1e2-driftwood-platform-ports) covers the exact two-reference exception, native ownership and strict captures. |
| **CS10-E3 — Pine whole native-view port / KEEP** | `custom/nativeView`, **8,648 B**. `generators/sections.ts` and `sourceOutput.ts` retain NativeViewSchema and emission; `test/fixtures/pine-headless.ts` reads BOSS_ENCOUNTER.profile, and `test/pine-runtime-mirrors.test.ts` checks the complete envelope and malformed native refusals. The combat child does not reconstruct all ribs, presentation/cues, clearing/cave, fog/look, spray and prop-kind/box fields. Require a complete admitted derivation, unchanged native-witness/input and full body/pack proof. **G908:** preserve Pine bytes and pixels; without exact retirement this remains an exit, never a renamed private wrapper. |
| **CS10-E4 — Pine whole quest-runtime/guest port / KEEP** | `custom/questRuntime`, **29,289 B**. `data/clientPlan.json` names it as quest.spawns.source; `generators/forestStory.ts` names it as content; `sourceOutput.ts` emits the compiled lead.program, and the native fixture reads this quest source. PineQuestRowsSchema still contains lead.program, events, deaths, pageDeaths and content with unresolved complete guest/AS ownership. Native-story/page children are incomplete replacements. Migrate the actual source/content/guest ports together, preserving original save, phase, reference and native assertions with exact full body/pack and witness proof. **G908:** no Pine byte or pixel change is accepted to retire this path. |
| **CS10-E5 — Shared private emitter/reader/compatibility path / KEEP** | E1–E4 are live callers, so shard SECTIONS, emitCustom/custom row emission, custom schema admission and product.section compatibility remain necessary. Removal requires every actual caller to migrate with its own exact payload/native/pack proof, then an immutable complete product/source census proving zero private emitters/readers and no compatibility users. Ten duplicate retirements and the two-product proof do not meet that condition. Retain original unknown/malformed/resource/identity refusals and all generic named-JSON support. |
| **CS10-E6 — Named-JSON validation, accounting and freeze policy / KEEP** | `game/shardfile/namedJsonChecks.ts` still reaches the defining native validator; `scripts/shard-platform-output.mjs` hash-checks and charges named JSON as well as custom envelopes. `scripts/custom-section-policy.mjs`, `lint/custom-sections.json` and the nonzero `lint/ratchet.json` ceilings still enforce provenance, shrink-only growth and frozen identities. The retained two-product corpus has **167 named JSON files**; neither it nor the historic 461-name census proves a global zero. Keep every validator, check, ceiling and policy. Any eventual obsolete-path cleanup requires a fresh complete census and qualified coverage of every remaining named contract, with no guard deletion, cap raise or waiver credited by this closeout. |

Verification: all sixteen pinned source/policy checks and the exact four-name
declaration check pass. The retained comparator record again verifies ten
complete reconstructions, exact remaining payload/native metadata and both
52-pack layouts, with rawComparisonPassed=true and no raw failures. This
is a documentation-only disposition: no product publication, source/runtime
edit, native run, browser, pixel capture or physics walk was needed or run.
Pine and Nine bytes/pixels are untouched by this commit under G908; no fresh
pixel result, loading gain, new host score or completed path deletion is
claimed. All six implementation exits and all existing guards remain live.

## CS3 completion bar and named implementation exits

> **Superseded 2026-11-03 (zero goal):** every exit below is built by a zero row (E1 → Z2; E2 → Z1; E3, E4, E11 →
> Z3; E5 → Z5; E6–E8 → Z7; E9 → Z10; E10 → Z9; E12 → Z12; E13 is a binary blob, not custom;
> [map](#exits-become-host-rows)). The conditions below stay as each port's preservation checklist.

**2026-11-03, sp-x2; coordinator's qualified-slice-or-named-explicit-exit
instruction.** This completion bar supersedes the earlier requirement to
keep CS3 open until every consolidation and tier-copy retirement ships.
It closes the row's disposition work. The exits below remain unbuilt
implementation work in this plan; none becomes a migration, host approval
or CS10 deletion by being named here. G963's identical-capture bar and all
native guards/caps still apply to any later implementation.

The source audit is pinned to `ca8561f3bfc64976c8fdbf01bcc882bc7a496912`:
15 committed defining producer/format/consumer files were checked, without
adopting loose peer changes or rebuilding products. The unchanged historical
inventory SHA `b08f048f…7768` has **318 distinct product/name rows**, each
assigned once: six existing platform roots, **124 qualified page rows**
(Pine112 + DW12), **70 Nine placement exits**, three qualified catalogues,
41 qualified recipe metadata rows, 60 Pine weld exits, eight living exits,
one binary exit and five source-envelope exits. Sum: **318**. This is the
historical inventory's coverage, not a new all-24 CURRENT assertion.

Qualified slices retain their original evidence: Pine `5c72cf6cf0`
(four A/A + four A/B zero-pixel comparisons); DW `f84fb23bf3` (six A/A +
six A/B zero-pixel comparisons), with ordered native read-ahead/owner fixes
`61cacd3f58` / `241f1d9cdb` and the recorded no-worse loading at `53dd955063`;
Nalati phone/desktop `1fadd8e67a` / `d83676a5d4` (twelve strict zero-pixel
comparisons). Catalogue/recipe metadata proofs remain scoped to exact
render-consumed bytes under G872. The later cross-G5 wreck one-pixel
refusal remains raw and separately classified above; it does not become
zero. The DW world golden is owned by sp-ci-deploy and is untouched here.

| Named exit, retained in CS3 | Exact family and remaining implementation condition |
|---|---|
| **CS3-E1 — Nine placement-page qualification** | **Skipped in this port turn: Nine, G908 task scope.** All **70** historical `world/placements/*.json` rows. `nine-dragon-stack/generators/worldScenes.ts` still emits SET/MOVER/LAYOUT individual references; the shared page helper is not adopted there. Retain the requested Nine QA deferral. A later complete slice must reconstruct every ordered row/tier, pass normal/strict admission and all original native resource/collider checks, then qualify immutable affected-pose A/A and A/B plus changed-streaming loading. Pine/DW qualification is not Nine evidence. |
| **CS3-E2 — Complete recipe transport** | **Retained: exact complete recipes already use the standard schema; a new physical recipe page transport is not qualified. Pine/Nine recipes are skipped.** DW's eleven and Pine's three `scenes/*.json`, Nine's three `world/scenes/*.json`, Far's fifteen and Sun's nine recipes (**41** historical rows). Their complete roots are already qualified; they are ordered step recipes, not `WorldScenePlacementRow` documents. `game/shardfile/worldScenes.ts` still reads each complete `step.scene`/variant. Any further packing needs its own bounded complete-recipe grammar and consumer, exact step/publication/instance-packet/resource lifetime and native refusal proof, then strict landed-SHA pixels/loading. Do not pass recipes through the placement-page parser. Nalati/Far have zero placement-page candidates in the retained source audit. |
| **CS3-E3 — Weld registration and projected-root integration** | **Skipped in this port turn: every member belongs to Pine or Nine.** The **whole 62-name** withdrawn slice: four Pine cabin tier/shadow roots, 56 Pine specimen roots and Nine casts/fabric. Keep the historical 1,703,170 → 3,120,670 B refusal; it is not a current index measurement. No full-slice admissible index or projected-root runtime has been qualified after compaction. `WorldSceneWeldSourceSchema` still accepts complete file/tier/knob choices, and the native consumer admits all branches before selecting resources. Four source-only cabin projections reconstruct 339,196 B exactly and pass nine refusal controls, but do not supply this port. Preserve true/false shadow geometry and casting-distance distinctions; require a complete typed derivation, all-branch admission/selected-owner proof, unchanged caps and strict captures at both tiers and both shadow modes before retiring any file. |
| **CS3-E4 — Living whole-root registration and owner qualification** | **Skipped in this port turn: Pine.** All eight `scenes/cabins/living/{phone,desktop}-{false,true}-{false,true}.json` envelopes. The complete `LivingPageInputSchema` and `{graph,life,geometry}` producer are real; `forestPage.ts` selects the exact tier/shadow/shared branch and borrows shell geometry under the resident owner. The old 1,984,106 B projection predates Pine112 compaction: it is **not a current index blocker**. No fresh full defining-schema/index admission or combined native owner proof is qualified. Register the complete root, retain all eight branches and owner retirement/shared-light/late-hydration behavior, prove exact payloads/packs and remeasure the unchanged index limit. Any copy retirement additionally requires complete derivation and strict affected-branch captures/loading. |
| **CS3-E5 — Complete source envelopes — ported** | `92f8a2e671` / `c9ae94288f`: complete shared `SceneBakeSourceSchema` and `SceneModelSourceSchema` replace the missing author-envelope contract for Far `world/sources/{bakes,heroes,sky}.json` and Sun `world/sources/{bakes,models}.json`. All five bodies / 403,251 B remain exact, full GLB/hull/rig/rail/disc/anchor/decorator fields admitted before native publication with original owners and refusals intact. Full colour-graph structure plus original semantic checks remain; no unknown document wrapper or transform-guard waiver. Z5 additionally retires Sun’s 4,955 B zero-reader `world/places-effects.json`. Immutable proof, exact map-stamp attribution and G872 acceptance in the Z5 qualification above. |
| **CS3-E6 — Fixed geometry contracts** | **Nine skipped. DW retained: the existing fixed-group root is shard-shaped; a generic dictionary alias would drop its original exact-shape refusals.** Nine `geometry/{fixed-kits,layout}.json`, DW `models/fixed-geometry.json`. Shard-local `FixedPracticeFileSchema`, `GeometryBootSchema` and `FixedGeometryGroupsSchema` remain authoritative. A shared/approved complete root must retain negative-zero, layout/practice and original geometry/resource refusal checks. |
| **CS3-E7 — Whole specimen-book genericity/owner** | **Retained: current whole-book producer remains Nalati-only; neither a second whole-book user nor exact Jake approval is established.** Nalati `models/cover-{phone,desktop}.json` and `models/gear-book.json`. Whole `SpecimenBookSchema` users demonstrated in the source remain Nalati-only. Require an actual second whole-book shard user or exact one-user approval, plus unchanged native model/material ownership. Child catalogue use elsewhere supplies neither. |
| **CS3-E8 — Sign atlas/resource contract** | **Skipped in this port turn: Nine.** Nine `signs/atlas-{phone,desktop}.json`. Preserve shard-local `SignAtlasSchema`, glyph/light/pool/channel bindings until a complete shared contract or the existing approved shader/model exit is qualified. |
| **CS3-E9 — Building-life envelope/site owner — ported** | `d3b32d2003`: complete `BuildingLifeDocumentSchema` registers DW `world/building-life.json`; the inline private defining copy is retired. The original native site/cloud/resource owner and retirement fences remain. Immutable `71c1451716` → `d3b32d2003` keeps the 510 B document and all 485,148,116 B of the six CS3 products byte-exact. All 224 old/new packs / 5,580 entries reconstruct exactly. Only the defining schema metadata changes, adding the native initial-dusk bounds. Both tiers, pier/beach/wreck plus the affected shrine: eight strict A/A and eight strict A/B comparisons, zero differing pixels (24 native Metal portrait frames); all native readiness/frame/error guards pass. Original/native plus registered tests: 32 pass; root types/fast lint pass. No cap, guard, collider or loading path changes. Raw results: `tmp/sp-x2-cs3-exits/e9-{audit.json,pixels/reading.json}`. |
| **CS3-E10 — Native dressing rows and colliders — source port landed, qualification open** | The original sixteen Nalati arrays have been retired into five complete `world/dressing-pages/{0,1,2,3,4}.json` `SceneScatterPageSchema` documents, final source reapply `dab6b3b9d9`; the below dated record supersedes this row’s old loose-peer wording. All sixteen canonical lists reconstruct exactly, including 9,706 rows, doubles, numeric resources and original native owners/refusals; the original 50 focused cases pass. Fixed AFTER `af6f2f8eb3` has both-tier P1–P3 A/A0, with Jake explicitly accepting P1/P3. Clean warm `3221e06306` is 22.560400 s. **No A/B or clean matched cold+warm no-worse pair exists**: the unchanged BEFORE was prohibited by the shared audio P0. Jake’s no-rerun instruction stands. Keep comparative qualification open; do not fabricate a baseline or retire any further copy. No E10 code, collider, loading or browser rerun in this port turn. **2026-11-03 Z9:** G872 separately approves deletion of the three now-proven unread support pages (2/3/4); two live pages and both complete books stay charged. The [Z9 proof](#z9-dead-copies-and-four-real-one-user-roots-2026-11-03-sp-x2) qualifies only that current deletion. Historical missing E10 A/B/loading proof is not retroactively closed. |
| **CS3-E11 — Island placement-plan contract — ported** | `ea6ad1472a`: complete `BakedPlacementPlanSchema` registers DW `world/island/plan-{phone,desktop}.json`, retaining all families, partitions, small-rock matrices and unclaimed collider rows. The shard-local return interface is retired; the original `BakedPlanSchema`, byte counts, family/table/resource refusals and collider owners are unchanged. Original phone/desktop hashes survive (297,521 / 353,953 B); three actual-plan/refusal cases, registration originals, root types and fast lint pass. Immutable `d3b32d2003` → `ea6ad1472a`: all 485,148,116 B of the six CS3 products remain exact; 224 old/new packs / 5,580 ordered entries reconstruct exactly; only the two defining schema metadata entries change. Both tiers at pier/beach/wreck/shrine: eight strict A/A + eight strict A/B comparisons, zero differing pixels across 24 native Metal portrait frames, original readiness/frame/error guards intact. No cap, collider or streaming/loading change. Raw results: `tmp/sp-x2-cs3-exits/e11-{audit.json,pixels/reading.json}`. |
| **CS3-E12 — Landmark native-view derivation** | **Skipped in this port turn: Pine.** Pine `world/landmark-view.json`, jointly recorded by CS9: exact board/site/stone/dam/canoe/view/book fields and native owners remain local to `forestPage.ts`/`timberWorldRows.ts`. Require a whole native projection/reconstruction, not a child alias. |
| **CS3-E13 — Spray packet/resource owner** | **Skipped in this port turn: Pine.** Pine `scenes/streams-spray.bin`, historical 1,012 B. Retain f32 matrices/seeds/sizes, byte offsets/counts and the native instanced resource lifetime. Recipe registration does not retire or convert this packet. |

The expanded remainder tables above additionally close the two Nalati
scene metadata names and the existing Pine building-sites/forest-page and
Nalati shape-book aliases on their original byte/native proofs. Every
remaining expanded family maps to E3–E12; none is discarded as a duplicate
of the historical census. The six `world/scenes` roots and three model
catalogues remain already-admitted complete families; their consumers do
not need a second migration just to close this row.

Validation of this closeout: the 318-row/hash/unique-disposition check and
15 pinned source-contract checks pass. The retained off-tree cabin
prototype again reconstructs all four exact roots and passes nine refusal
controls through the normal bake loader. A first plain-Node invocation
refused the extensionless SDK import before verification; no runtime or
guard changed to make it run. No product, browser, loading run or new
capture was needed for this documentation-only disposition. Caps, live
files, private readers and the remaining CS10 work retain their authority.

## CS3: Nalati bounded typed scatter pages (2026-11-03)

**In flight: source/payload qualified; clean loading and landed strict
P1–P3 A/A and A/B remain required.** Jake approved this separate
scatter transport after the existing placement-page eligibility audit.
It extends the existing dressing host, not the world-scene-placement
reader. No Nine streaming or legacy source changes.

Sixteen differently typed JSON lists become five complete native pages,
at most four lists and four MiB per page, each list bounded at100,000
rows. Every original `DRESSING_SCHEMAS` parser still runs before packing;
the independent full native `SceneScatterPageSchema` covers every field
and kind. The 9,706-row physical corpus reconstructs all sixteen canonical
JSON bodies byte-exact:2,750,287→2,751,022 B (+735 B page envelopes).
Both numeric tables remain independent and exact:2,058,320/916,400 B.
The two live pages contain existing layer lists in original first-use
order; the nine unused support lists never ride those live pages. Within
lists, every original row, double, selection index and ordering remains.

`SceneScatterPages` starts distinct demanded pages in parallel once,
fully parses each bounded page on arrival and retains errors until the
original ordered layer cursor. Scope/product/reader changes and retirement
refuse after awaited reads. Owned parsed pose lists freeze before reuse;
every layer still makes its original independent output poses and keeps
its modulo selection, pauses and publication order. Complete native
validation runs once per page rather than again at every consumer. Both
unchanged numeric-table readers retain their original admission.
The SDK root is appended after existing roots to preserve shared-check
identities. The two dressing-book schemas differ only by the optional
member reference; every original body grammar and default survives.

Physical native/transport/lifetime and original root/grammar controls,
root types and named typed lint pass. The first normal selected build
exits0 (0 built/6 program-bound products reused); selected Nalati admits
CURRENT. Its original50-case focus catches two genuine default-API
regressions: books with no page members must not access a JSON port.
Only the runtime reader changes to bypass page-owner construction there;
original tests stay unchanged. Actual post-repair currentness refuses as
expected; retain that raw refusal. One cause-directed normal refresh
restores ordinary CURRENT, then the **full50 focused cases pass14.1s**
on the final frozen15-source/compiler/selector tuple. Neither refresh is
an author timing gain. OP4/root entry overlaps are labelled shared-host
ordinary correctness, not isolated performance.

The final full audit verifies400→389 bodies: all16 old lists reconstruct
exact,381 unrelated bodies/84,002,023 B and both numeric tables remain
exact. The two dressing books differ only by declared file/member binds;
their schemas differ only by the new optional member property. Both old
and new ordered packs reconstruct all767 entries with exact offsets,
lengths and digests. Library/late rebinding changes only the retired
sixteen/list and two/book identities to the five/pages and two/books;
every unrelated identity/order and all other index/admission fields are
exact. Total body growth is1,039 B (735 page envelopes +304 book binds).
Index1,116,451 B remains below the unchanged2,000,000 B limit.

**Self-applied G872, established exact source-stamp class:** only the164B
`look/map` source stamp changes38d54efb→28158e1c, equal to the current
full Nalati source aggregate. Image stays
`80afaa55b292b48c93694dbc7ac95557ecb96714b2c159cd467ff3fa0caff2d6`;
all other unrelated bodies/descriptors are exact. Raw comparison remains
FAIL for that one stamp, separately retained; no tolerance, comparator
allowance or source guard is weakened.

Next use G612 immutable parent/landed commits with the same renderer for
one original clean phone loading pair, no-worse cold and warm, plus strict
native Metal P1–P3 A/A and A/B in both quality tiers. No loading or pixel
qualification, gain, broader CS3 closure or Nine change is credited yet.
The earlier eligibility exit applied to Pine's existing placement-row
helper; this separately approved complete scatter transport fits its
actual owner. Retained full audit, raw failures, hashes and protocol:
`tmp/sp-x6-cs3-nalati-pages/`.

### Nalati immutable turn: common build/runtime miss (2026-11-03)

After verified B7-containing17e15e8d42, use ordinary main reverse/reapply
commits for the **complete nine-code/test paths and API paragraph**.
Every pair has exactly that contrast; no other source byte differs,
no renderer interleaves and the final nine paths equal qualified61d894.
No overlay, source-equivalence build or old known-bad app pin is used.

| Fixed committed pair | Actual result, not loading time |
| --- | --- |
| `01a6752cfe` → `7a7e3336e4` | Both contain17e15. Both immutable builders exit1: open-plots `Invalid generation file name`. |
| `1686089c57` → `676e9288e3` | Both also contain filename1c1e and AAC98f7 repairs. Generation succeeds; both app admissions exit1 at Bayou6,422,853 B against its pre-audio5,481,557 B wire ceiling. |
| `a5a8ec880eb093c750a6564fecd5cc3624cd6fd6` → `dab6b3b9d9d26888df4d9f56c997e38825626c97` | Both include authorized audio accountingbbda after the owner's actual app-greena2de boundary. BEFORE builder was already active when a separate required runtime P0 arrived; AFTER builder/browser remain unstarted. |

An accidental moving-HEAD preview at1c1e is explicitly unused; it fails
strict AAC indexing. Keep that raw failure separately, with no timing or
pixel sample. The audio owner fixes the filename, continuous AAC timestamp
and authorized-content accounting causes; this slice changes no limit.

Before the third pair enters a browser, ordinary061 run41610290549
boot-public/job125837201300 reports Nalati `Missing declared audio
profile: scene loop inventory`. Root routes that common audio frontier
to its owner and prohibits a known-bad runtime launch. Preserve the
already-running builder naturally, release its own lease at closure,
and do not infer a runtime result for these unvisited pins from app
build success. No unchanged retry, source bypass or extra product
refresh is authorized by a failed build.

**Miss: loading and strict both-tier native P1–P3 A/A and A/B remain
OPEN, with zero browser samples.** The source/body/original50 proof
stands; no no-worse result, regression or pixel pass is invented. Final
scatter reapply is `dab6b3b9d9`; all owned runtime bytes are restored.
A later resumed turn needs the checked common runtime fix in both exact
pins and the same complete-cut/non-cut equality. Failed logs, exact
full-SHA bindings and protocols remain under
`tmp/sp-x6-cs3-nalati-pages/paired-requalification/`.

### Nalati fixed AFTER-only reading (2026-11-03)

On the next explicit ruling, keep BEFORE
`a5a8ec880eb093c750a6564fecd5cc3624cd6fd6` unchanged and run only
AFTER containing the common runtime audio fixaf6f2f8eb3. Exact served
pin **`af6f2f8eb3daf75a991d0ecf8946b78267a2baa5`**, build
**`af6f2f8-mw0i9u28`**, retains all nine qualified61d894 scatter files
byte-exact. Use one ordinary shared immutable preview; no overlay,
new generator, allowance or before-side retry.

| After-side original phone loading | Tap to qualified control | Errors | Request accounting |
| --- | ---: | --- | --- |
| Cold | **99.0555 s** | `[]` | complete |
| Warm | **55.007900 s** | `[]` | complete |

Both runs use the maintained Chromium phone preset:10× page CPU,
10 Mbps down/100 ms latency, original240 s deadline,3 s title dwell and
4 s post-control dwell. They are **shared-host absolute readings**:
X2's already-started Frostline MOSS/audio-QA cohort overlaps, preserved
naturally. No isolation, speedup, no-worse bar or phone/Safari equivalence
is inferred. Original native control/document and actual-shard guards
pass; there are no page or flow errors.

Strict native Metal A/A uses two fresh contexts per tier, iPhone16Pro
portrait804×1748/DPR2, fixed seeded world/time10, original P1/P2/P3
and no comparator allowance. **Phone:0/0/0 differing pixels;
desktop:0/0/0**, twelve full RGBA frames, six exact comparisons.
World-only capture retains the original readiness/frame/error guards.
The actual source/build/HTTP/disk identity is checked before and after
each phase; all phase exits0. Actual whole09:50:07.548→09:54:45.101Z,
2026-11-03, includes normal preview release0; every browser closes.

**Comparative qualification remains OPEN.** The unchanged BEFORE has
zero browser samples because entry was prohibited by the common audio
P0. Therefore there is **no before/after no-worse loading result and no
A/B pixel result**; A/A stability and successful after entry do not fill
those missing cells. Keep the earlier raw misses and source/body proof.
The next comparison requires an explicitly reviewed executable baseline,
not a fabricated metric or silent repin. Numbers, all source/version
checks, twelve frame hashes and raw paths are retained in
`tmp/sp-x6-cs3-nalati-pages/paired-requalification/after-only/summary.json`.

### Nalati loading reference: warm question OPEN (2026-11-03)

Jake accepts the recorded **P1 and P3 A/A0 on both tiers**. Keep the
full measured P2A/A0 reading too, without broadening the scope of that
explicit acceptance or inventing A/B evidence.

The latest older Nalati cold/warm files retained for the same maintained
`pnpm phone-loading` reader family/Chromium phone preset are build
`7d3c0ee-mvu4kk8v`,2026-10-29T22:50:37.422Z. Profile fields and applied
notes match the current reading:10× page CPU,10 Mbps down/2 Mbps up,
100 ms latency, worker network applied,3 s title/4 s post-control dwell.
This is a historical reference, not an identical-source paired run.

| Nalati tap-to-qualified-control | Last retained reference7d3 | Fixed afteraf6 | Observed difference |
| --- | ---: | ---: | ---: |
| Cold |102.350300 s |99.055500 s |−3.294800 s (−3.22%) |
| Warm |36.281500 s |55.007900 s |**+18.726400 s (+51.61%)** |

Both historical native controls qualify. Retain their real errors:
cold has local telemetryHTTP405 plus one incomplete request-size record;
warm has two telemetryHTTP405s. The current pair has errors[] and
complete accounting. Do not call the older pair clean or remove those
refusals. The older WebKit10.358/9.647 s readings are unthrottled Mac
WebKit and are **not** substituted for phone10× Chromium.

The explicit bar for this paging slice is a **clean matched pair, cold
AND warm no worse**, not merely entry before the unchanged240 s failure
deadline. No Nalati-specific absolute loading SLO is established here.
**OPEN loading question:** warm55.0079 s is18.7264 s above the last
same-preset36.2815 s reference. Source/date and the acknowledged X2 model
and audio-QA overlap differ, so this does not establish a page-regression
cause or an isolated slowdown. Contention remains a possible contributor,
not a measured explanation. Jake explicitly requests no rerun now.

Old raw files:
`tmp/phone-loading/2026-10-29T22-50-37-422Z-7d3c0ee-mvu4kk8v/`.
Current raw files:
`tmp/phone-loading/2026-11-03T09-50-08-303Z-af6f2f8-mw0i9u28/`.
Exact-profile comparison, raw digests and limits:
`tmp/sp-x6-cs3-nalati-pages/paired-requalification/reference-comparison.json`.

### Nalati clean warm follow-up: contention question closed (2026-11-03)

On Jake's explicit one-reading instruction, wait for the already-active
model, browser, release-entry and test owners to close naturally. Then
check `lsof ~/projects/localai/.model.lock`: no holder; browser pool0,
app builds/queue0, official Simulator quietfalse. X2 holds its next loads
through the announced bounded window; the other owners also report whole.
No process is interrupted, no source/runtime fix is made and no limit rises.

Use one normal `--head` preview, pinned at actual build admission to
**`3221e06306a343e113373749fea5b812011f9658`**, build
**`3221e06-mw0itsyl`**. The maintained reader has no warm-only selector;
a private adapter changes only the first visit label to `prime` plus
relative import relocation and pre-warm ownership checks. The original
cache population runs once in the original context; only the subsequent
unchanged warm visit is accepted as the requested reading. No new cold
comparison or CPU profile is taken. Fourteen reader/helper hashes stay
exact across the run. Original phone10× CPU/network,240 s deadline,
3 s title and4 s post-control dwell, native control/document/selected-world
and request-accounting guards all remain.

**Clean warm:22.560400 s**, native control qualified, errors[], completed
request accounting. Immediate pre-warm boundary10:13:56.235Z independently
records no model holder, no build, sole owned browser and quietfalse.
Post-run model check again has no holder and the pool is0. The finite
prime+warm cohort runs10:12:19.273→10:14:30.228Z; browser and normal preview
release exit0. Literal whole is sent directly to every waiting owner.

| Nalati warm | Tap to qualified control |
| --- | ---: |
| Historical Oct29 same-preset7d3 reference |36.281500 s |
| Earlier shared-hostaf6 reading |55.007900 s |
| This clean HEAD-at-build reading |**22.560400 s** |

This is13.7211 s below the historical reference and32.4475 s below the
contended reading. **The55 s result does not reproduce with competing
model/browser work absent: close the warm contention question on Jake's
specified branch.** Different committed pins/date mean this is not an
isolated scatter-page speedup or a quantified allocation of lost time
between the model and audio QA. Historical405/accounting errors remain
in their old raws. No code fix is proposed or implemented.

The raw also retains the same stage clocks for audit, with nested Home
and assembly spans explicitly non-additive. No new cold no-worse or A/B
pixel claim is invented by this warm-only follow-up. Previously accepted
P1/P3 both-tier A/A0 stands. Raw warm JSON, all free-owner/version/hash
checks and reference-stage comparison:
`tmp/sp-x6-nalati-clean-warm/summary.json`.

## CS10 E1/E2: Driftwood platform ports

**Ported and accepted, 2026-11-03, sp-x9.** Source `3c42144c50`;
empty-registry generator fix `1aefef4f57`. These are two scoped Z7 exits,
not completion of the other model-library contracts. The coordinator's
G872 ruling allows exactly the two reference-string changes below, with
no compatibility mapping. The authored continuation JSON is compiled into
the complete quest page document.

| Emitted body | Field | Before | After |
|---|---|---|---|
| `quests/page-composition.json` | `entryResources.continuation.collections` | `collections` | `collections/displays` |
| `people/cards.json` | `draws` | `custom/fixedLayouts` | `models/island-library` |

Fresh ordinary CURRENT BEFORE and AFTER both pass complete native admission.
The complete moved bodies retain hashes
`3af8db49f9389abe5d87412e994f47579454d1ec41ad3ce47ba2fc0bb81e4d6c`
(collections, **2,698 B**) and
`98fee95f2f4967665220504a98bfaa97b002a175a202692dfc9c58a2651b7302`
(library, **7,855 B**). **450 complete bodies / 79,801,679 B** are exact;
each of the two remaining bodies changes only the one shown string,
including canonical byte order. No float, key, geometry, collider, resource
or native simulation row changes. Full native assembly is exact apart from
the two resource hashes/inventories and their exact **+11 B** library
compressed/resident accounting. Both emitted custom schemas disappear;
their original complete defining parsers now admit the platform roots.

The independent ordered writer transcription verifies every old/new pack
plan, body hash, member and offset: **13 packs / 438 members / 32,481,954 B**
before; **13 / 436 / 32,470,354 B** after. Equal-hash deduplication and the
platform consumer order are retained. AFTER index is **942,515 B**, below
the unchanged 2 MB cap. All **57 original native/owner cases**, the
section-schema bridge suite, touched layer/scenario types and typed lint
pass. The generator now emits an empty record alias for a zero-entry custom
registry, preserving nonempty registry output; no lint rule is waived.

Immutable capture pair: BEFORE
`71c1451716a1ea8050b0ce8d0448e40d522e9f30` / `71c1451-mw0pjhoq`;
AFTER `3c42144c5061a0abb8a0053b0ca8db009ac3e95a` / `3c42144-mw0q7pqc`.
Native Metal, iPhone 16 Pro portrait 402 × 874 at DPR 2, actual phone and
desktop tiers, original seeded frame/readiness guards and authored midday:
**24 full RGBA frames, 16 A/A and A/B comparisons, zero differing pixels**
at pier, beach, wreck and shrine. No tolerance, overlay or input replacement.
Both real cold Explorer sweeps pass **61/61 thumbnails**, including castaway,
sea-glass chime and trophy plaques, with no errors or stale document.
Every browser closes and both owned preview leases are released.

No Pine source belongs to this slice; E3/E4 remain with their owning work.
All custom compatibility, native validation, provenance/freeze guards and
caps remain. This proof grants no global zero-user, loading, memory or
frame-time claim. The coordinator explicitly accepted scoped E1/E2 after
the zero-pixel and 61/61 Explorer results.

### Z9: dead copies and four real one-user roots (2026-11-03, sp-x2)

The fresh nine-file census does not find a second whole-root shard user.
Pine's live props already use `WorldSceneModels` and
`WorldScenePlacementPage` in `generators/sceneModelRows.ts:93–115`:
original hull/sphere/capsule facts, native materials, quaternion matrices,
selection, culling and collider owners survive there. Its two separate
JSON files have zero source readers and zero exact references in any
emitted section or JSON body. Nalati’s support pages 2–4 are also unread;
the native author still validates all sixteen original lists and compiles
support geometry/contacts into the complete, unchanged dressing books.

**G872 coordinator-approved retirement: five reader-less copies, 397,308 B.**

| File | Bytes | Original SHA-256 |
|---|---:|---|
| Pine `world/props.json` | 80,532 | `ef7c22ff43873e4fb32d0869e98a388078e3f87c63099db71b204c29f72f06d3` |
| Pine `world/prop-shapes.json` | 25,644 | `d9eb2ba63d54be68081307300e1592840268e86434d1bf9f0bd0aebf62a10e17` |
| Nalati `world/dressing-pages/2.json` | 4,142 | `b2c3fde9ece3190310002f19082482872bafa74a68faaecb834745bafd4ef952` |
| Nalati `world/dressing-pages/3.json` | 283,048 | `2cef7b6221fd2dd9eaec9b1d26a876115ad27346f43d4d83e70edfae31ac0f40` |
| Nalati `world/dressing-pages/4.json` | 3,942 | `72f57481ccf6457a462157c556b75c2d3831a467c582f5b10c44d141ae781307` |

**Four remain charged for Jake’s one-user batch, no platform family credit:**

| Actual complete root | Bytes / exact body SHA-256 | Live reader / reason it stays |
|---|---|---|
| Nalati `world/dressing-pages/0.json` — `SceneScatterPageSchema` | 1,207,078 / `047ac1c4b4513b28cd0cf0b4bbf53da933e03e8033d71a4e33a1d66dbecdccf0` | Both tier books name it for boulder (including tall selection), slab and juniper. `SceneScatterPages` admits the complete page before `SceneDressing` consumes its ordered poses. Only Nalati emits/reads the whole page. |
| Nalati `world/dressing-pages/1.json` — `SceneScatterPageSchema` | 1,252,812 / `cecc60613cfe21030862a6c891e9e3feda904adcb688f43f3d4e9c3b3e059451` | Both tier books name it for rose, willow, lupin and reed; same full-page/native owner. Pine's live placement-page format is different and is not a second user. |
| Nalati `world/dressing-phone.json` — `SceneDressingSchema` | 872,977 / `2a932d4e032a401d44a1deec828bcaaa6ab45e1dba17d595521e8044875b5434` | `world/scenes.dressing.phone` selects the complete book; `SceneDressing` consumes model/material/geometry/scatter/static/ambient/contact rows. Only Nalati drives the whole host. |
| Nalati `world/dressing-desktop.json` — `SceneDressingSchema` | 951,607 / `9196ef04e004539d758cb2549b35939fb32919f24fc27a4a7715fc9d080a8dd1` | `world/scenes.dressing.desktop` selects the complete desktop book; same native owners. No exact second whole-book user or one-user approval is established. |

These four fail HOST-BAR test 1’s actual two-user requirement for new
family credit. No child-schema user, fixture, optional wrapper or name
pattern is substituted. No format/SDK/runtime code, cap or guard changes.
The original sixteen-list exact packing/refusal checks stay; the maintained
product fixture keeps all population/camp keep-out assertions, reads live
poses from the actual admitted product, and explicitly verifies retired
pages absent while checking offline support lists from their native source.

Frozen working-tree BEFORE `837066a073-mw0u4ne6` (:4407) and AFTER
`b625930020-mw0ug72f` (:4403) both include the same other lanes’ candidate
source; these are actual served artifacts, not falsely labelled clean
commit builds. Pine bodies 884→882, 154,136,335→154,030,159 B; Nalati
389→386, 88,577,793→88,286,661 B. Every unrelated **242,316,656 B** body
is exact; all **122 old/new packs / 2,475 ordered entries** reconstruct
exactly after only the five removals and the attributed map-stamp change.
Admission removes only the dead library/late hashes and exact costs.
Indexes 1,712,988→1,712,018 B (Pine), 1,166,641→1,153,110 B (Nalati)
remain under unchanged caps.

The one other raw-body difference is Nalati’s 164 B `look/map` source
stamp: independent aggregate reconstruction over all 327 declared input
occurrences proves only the authorized `generators/output.ts` emitter
cut. Map image remains
`80afaa55b292b48c93694dbc7ac95557ecb96714b2c159cd467ff3fa0caff2d6`;
restoring the old stamp reconstructs the original map bytes/hash exactly.
This is explicit source-stamp attribution, not a raw all-body parity claim.

Strict native Metal proof: **48 phone-portrait frames, 16 A/A + 16 A/B, every changed-pixel count zero**, actual phone and desktop tiers at four poses in each shard. Original native frame gate, exact camera/clock/frame comparisons and empty-error requirements remain. Both frozen sides contain the same pre-existing QD11.

Fresh ordinary QD11-fixed candidate `5b5922e263-mw0vipws` (:4409)
contains landed `2d4405a27c`. Independent bridge checks both full indexes,
all **1,268 bodies / 242,316,820 B** and all **122 old/new packs /
2,470 ordered entries** byte-identical to the earlier AFTER artifact.
Thus the original five-copy/body/native proof transfers without a source
overlay, stale-product bypass or tolerance.

**G998 qualified before landing:** every LEGACY / SHARDFILE / NOW row
read, all 24 cameras green per shard per engine, empty errors and all
settled. Pine Chromium and WebKit use AFTER `b625930020-mw0ug72f`;
Nalati Chromium and WebKit use QD11-fixed `5b5922e263-mw0vipws`.
Pine WebKit 11/20 have close moving creatures (the automatic camera 11
colour flag remains visible and is explicitly classified as creature
motion). Nalati's earlier 24-camera exposure/colour red was pre-existing
QD11, missing `<colorspace_fragment>` since `180df449c9`; the required
post-`2d4405a27c` re-shoot is green without waiver or golden promotion.
Terrain, buildings, native props, water, sky and hands are intact; moving
grass, water, clouds, wildlife, crowds, projectile trails and sway remain.

Committed reviewed boards:

- [Pine Chromium](../../../art/golden-runs/pine-hollow/2026-11-03-b625930020-z9-chromium-board.jpg)
- [Pine WebKit](../../../art/golden-runs/pine-hollow/2026-11-03-b625930020-z9-webkit-board.jpg)
- [Nalati Chromium](../../../art/golden-runs/nalati-grasslands/2026-11-03-5b5922e263-z9-chromium-board.jpg)
- [Nalati WebKit](../../../art/golden-runs/nalati-grasslands/2026-11-03-5b5922e263-z9-webkit-board.jpg)

The five focused scatter/native-owner/contract files pass (18.7 s), the
maintained actual-product cases pass (9.9 s), root types and touched fast
lint pass. Browser cohorts close before reporting. Historical E10's
missing old A/B/loading pair remains history; Z9 qualifies only its
current five-copy deletion, not that old missing proof. Remaining target
count is **4**, explicitly pending Jake's one-user batch; no ceiling is
edited here (sp-x1 owns the combined downward ratchet).

### Z12 census: ground roots and one unread copy (2026-11-03, sp-x2)

The nine-file census reads the actual served `5b5922e263-mw0vipws`
products and walks every section and named JSON body in Pine, Nalati,
Far Reach and Sunscar for exact routing references. Source reader and
whole-root producer searches are separate. The current Z6 cuts do not
alter these nine bodies. **No ground family is newly registered.**

G872 authorizes retiring only Pine `world/landmark-view.json`, **5,510 B**,
SHA-256 `50869a1b58b55e424f384b5592b4c7506ba95aed1727fe7423528ef5891ba7d9`.
It has zero emitted references and zero source readers; its only source
mentions are its generator and output. The original `timberWorld`
landmarks still feed ForestPage's lamps/ordered landmark placements and
the native scene models. Its board/site/stone/dam/canoe/view/book facts
stay in those unchanged owners; no one-user wrapper replaces the copy.
**Retirement is pending exact body/pack/native proof, G998 and walk.**

Eight files remain live and charged for Jake's one-user batch:

| Complete file / bytes / SHA-256 | Actual route and native owner; why it stays |
|---|---|
| Pine `world/floor.json`, **3,198,511 B**, `ac357d01b06c4a12e64f9f1a3ff43ec0a052400475f61f2d0d6a1261bfbeb028` | `forest-page.ground.layout` → `readForestGroundInputs` → `ForestGround.prepare` → `forestGroundLayoutSteps`. Whole `ForestGroundLayoutSchema` has ordered counts and six complete placement lists, 22,250 rows; only Pine emits/drives it. Native appearance, matrix composition, cell bounds, trample, shadows, resources and retirement checks remain. |
| Pine `world/crag-cave.json`, **921,717 B**, `0e53e5357740394bfd288ddb3d2fc0959d3ef029132a3d0679d6763c1671aaab` | `cave-interior.file` → `CaveInterior.load`; whole `CaveFileSchema` then original `readColliderRows` admits the shell's trimesh/surface. Complete meta has holes/cuts/spots/inside/shaft/drips/floor/tris. One cave-file producer (Pine); a shared collider child is not a second complete cave root. |
| Pine `world/cave-interior.json`, **2,617 B**, `0064dd817729ef5efd2118a5e2c430f7a9ae3cc4ce34b5fed9d37c13c6291f89` | `client/plan` world.forest-page cave.file → `installClientForestPage` → `CaveInterior.load`. Whole `CaveInteriorSchema` retains product/file/frame/roof/rock/look, native roof geometry, fills, drips, cut/roof colliders, textures and resource ownership. Only Pine calls `caveInteriorRows`; no second full root. |
| Pine `world/forest-page.json`, **6,594 B**, `0c0e441cf71bcace7906a0ea0f2b6908b7429b5b5ed659c7959badd506ddaa71` | `client/plan` world.forest-page.file → `installClientForestPage` → `prepareForestPage`. Whole `ForestPageSchema` includes water/treeLooks/graphs/wildlife/streams/ground/buildings/props/lanterns/landmarks. Only Pine calls `forestPageRows`; shared native scene pages do not reconstruct this whole forest composition. |
| Pine `world/building-sites.json`, **963 B**, `f579ded5e9ab2987b4b33401be2182019667d6b6ceaf739bf6aa57fa203923e6` | `forest-page.buildings.sites` → `prepareForestPage` parses `LivingPageSitesSchema` before native building hydration. The complete buildings/roofs root belongs only to Pine. Driftwood's Z3 graph page is a different whole root, not another sites producer. |
| Pine `data/physics.generated.json`, **152,494 B**, `7f7381f716560f164806c0c50389acfb67fa37a4020246ea30616d475e8369d9` | No emitted route, but the maintained real native path `test/fixtures/pine-headless.ts:72–113` reads its owner data: kingHit supplies boss weak-point radius; shelterTrees supplies native herd shelter. `world/physics` and existing `.bin` floor/hull ranges already carry common collision. Retained owner root also includes version/profile/notice/trees/pieces; the common physics child is not its complete reconstruction or a second private-owner user. |
| Nalati `world/meadow.json`, **21,630 B**, `7491afc9489511378d52c48fd98d0cd435e7521de8d7fc93c2f4a43b1ee05adb` | Actual `client/plan` feature names it; `configureGrassFieldData` admits whole `PopulationFieldSchema`, and native headless preparation uses the same geography in `NativePopulationField`. Whole seed/world/trails/river/meadow root is produced only by Nalati's `nativeGroups.ts`. Far Reach's blade buffers do not include or drive this semantic root. |
| Nalati `world/water.json`, **86,396 B**, `1572cc613c2880ef68554379ac74cb1e808b86f9c5adc4e5a2c1f577ffd7731d` | Actual `client/plan` practice course reads practice; `look/post.painted.ground.recipe.file` reads terrain. Complete body retains placeSets/practice/surface/terrain, while its current emitted loose defining schema checks only practice. No exact complete water-world defining root with two real users exists; child terrain/water/practice schemas do not earn whole-envelope family credit. |

All eight fail the actual two-whole-root-user requirement for new family
credit (HOST-BAR test 1). No fixture user, optional superset or renamed
private envelope is added. Unknown/malformed/resource/range/native-owner
refusals remain intact; this census does not loosen their contracts.

Far Reach `generators/meadowScene.ts` and Sunscar
`generators/emberBuffers.ts` really drive the existing complete
`SceneBuffersSchema`: typed GPU channels, attributes, geometries, draws
and LOD bands backed by named `.bin` ranges. It supports f32/u16/u8, not
GroundPlacement doubles or cave/native owner roots. In actual Pine floor
rows, an f32 round-trip changes **240,975 of 244,750 numbers** (maximum
7.626953134831638e-6). That is not an exact reconstruction; an opaque u8
JSON payload or a fresh one-user decoder would not fix the whole-root
bar. Existing binary ground and collider sources remain unchanged.

### Z6 census: held roots and two unread copies (2026-11-03, sp-x8)

The ten target bodies total **1,910,790 B** in immutable
`54771ba-mw0sut9p`; this is a payload census, not a visual baseline for
Nalati (QD11 subsequently fixed its exposure). Every named JSON body and
platform section was walked for exact references, separately from source
reader and whole-root producer searches. The target bodies and original
`held/*` sections are preserved for reconstruction checks.

G872 authorizes deleting two exact reader-less copies, **39,941 B**:

| File / bytes / SHA-256 | Canonical owner and refusal boundary |
|---|---|
| Nalati `weapons/rifle-model.json`, **35,744 B**, `9814f8b49a28acc52d77d137b2fb1dd0859ab7407f0f7bf07da9e19ccc46893e` | Zero emitted references and zero source readers. Its complete value equals `weapons/rifle-page.json.rows`; that unchanged page retains `HeldFirearmPageSchema`, original native firearm playback/profile/view admission and resource ownership. |
| Pine `loadout/finishes.json`, **4,197 B**, `2ebca6078a5b850f15d93a3c52dd2f8f6afa6687e093d4f8777e76c628ecb57e` | Zero emitted references and zero source readers. Its complete value equals the existing platform `held/finishes.rows`; native finish metadata, materials, drop ownership and malformed/atomic failure checks remain there. |

Both cuts are authored but **not landed or capture-qualified** at this
census boundary. G998 goldens and additional held-view captures remain
required. No payload alias or replacement private envelope is introduced.

Six complete live roots remain charged for Jake's G988 one-user batch:

| Complete file / bytes / SHA-256 | Actual route, native owner and whole-user evidence |
|---|---|
| Nalati `weapons/bow-page.json`, **22,780 B**, `46d521bd3a3936c6702ebde4d7fa083c4b042b05dec0deb55ab1b52bc597ed84` | `held/slots.json.slots[2].file` → `HeldClaims.loadBow` → original `bindHeldBow` and native model-pool owner. Full `HeldBowFileSchema` includes pool/bow/base; only Nalati emits and drives this whole document. Pine's nested bow definition/pool inside a different equipment root is not a second complete file user. Existing channel, geometry, profile, presentation and native input refusals remain. |
| Nalati `weapons/rifle-page.json`, **36,302 B**, `4a31a2b080284dea17f1b27ef0f97bdbff455ae6f249251c1b405e62d3623ef9` | `held/slots.json.slots[3].file` → `HeldClaims` firearm construction → original `HeldFirearm` owner. Full `HeldFirearmPageSchema` contains feel/rows/view and the entire playback/model/presentation table. Pine's lever firearm shares native children but does not emit or consume this complete page. Existing firearm/profile/view admission is unchanged. |
| Nalati `weapons/sabre.json`, **17,348 B**, `a6897b67bd447645beaf4663029a932e22637727788a20b5d0ced1b28244c398` | `held/slots.json.slots[0].source.file` → `mountedBlade` → original full `BladeRowsSchema` and mounted blade/pass/decision-program owners. Pool, rig, blade, moves, power, program and parts form the complete root; one real whole-root shard producer. Pine's distinct held-equipment root is not another blade page. |
| Nalati `weapons/spear.json`, **8,883 B**, `b35efe728409cd896cbb0b4d16a02406da3ab8c16ad3b150ed65944e028116a4` | `held/slots.json.slots[1].file` → `heldPolearm` → original full `PolearmRowsSchema`, native pool, throw/recover/lance and decision-program owners. Pool/presentation/profile/program/view are all retained. No second whole-root producer exists. |
| Nalati `held/slots.json`, **7,696 B**, `951be9afac0629f2197cbd6bba2914bc8cc02202c6d825844a39ec156d9a1b11` | Actual `client/plan` held.claims.prepare source.slots → `HeldClaims` → `parseHeldSlots`. Complete finite slots/registration/equipment/selection/mount/refills/upgrades grammar retains duplicate-item/slot, coverage, destination-kind and native owner/refusal checks. Nine's declared-primary envelope and Pine's equipment envelope are distinct roots, not second users. |
| Nine `weapons/jian-row.json`, **390,446 B**, `a7830f4f47d5172ed7eaa4caa805e7cc3437806366a2c666e3e122a85d858b84` | Actual `held/arms.primary.file`, `client/plan` grapple.presentation, `ui/level` render/sword bindings and held cards all read this same one-shard envelope. Native `HeldView.fromProduct`/`GraphArmsSchema`, grapple and graph-look owners retain their existing admissions. The entire portraitFov/aim/bursts/view/look envelope has no second whole-root producer; its shared children and multiple consumers do not earn complete-root credit. Its quoted hash is the census baseline; a later GLB reference change must be shown separately. |

These six total **483,455 B**. No new platform-family registration or
count credit is claimed for them. Routing them into `held/*` without a
real second complete native-type user would merely rename a private root.

Nine's two remaining targets are the cloth collection (**1,362,188 B**)
and halo (**25,206 B**). The read-only spike admits both replacement GLB
collections through the existing `worldScenePool`/`createModelLibrary`
host. All six original parts retain exact typed attribute/index bytes,
normalization, widths, groups, draw range and authored bounds, including
signed zero. This is a transport proof only: source wiring, refusal
controls, Nine's 24 goldens and identical Jian views in Chromium/WebKit
remain open. No GLB count reduction is claimed at this census boundary.

### Z14 census: encounters, riding and one unread copy (2026-11-03, sp-x1)

The ordinary frozen BEFORE `7cc93a3856-mw0wlkup` (:4408) verifies
all 28 products' section and named-JSON hashes and exact routing strings.
The original CS8 nine include `models/cloud-specimen.json`; the Z14 row
adds Pine's ranged page but omitted that cloud entry. **The union is ten
files: one unread copy, nine live one-user bodies.** Cloud is also in Z7,
so this census grants no extra kill or duplicate family credit.

**G872 coordinator-approved retirement:** Nalati `ride/rules.json`,
**31,569 B**, SHA-256
`449c2e7e3f98a429077242e69dc384768a6d49a823800cd7b5fec52705c0ff76`.
There are no exact routing references in the 28 products and no runtime
or headless reader. Its only source consumers are output.ts's emitter
and the maintained `test/taming-script-admission.test.ts` assertion.
The complete decoded wire equals `sim/headless-boot.json.riding` exactly;
client riding retains its own admitted live session. The original ABI,
selected module/witness hashes, sole executable inventory, ReturnProgram
identity and wire equality checks remain; the assertion now reads the
live boot wire and checks the redundant file is absent.

**Nine remain charged, 2,004,340 B, for Jake's one-user batch:**

| Complete file / bytes / exact SHA-256 | Actual native route and whole-root evidence |
|---|---|
| Pine `combat/roaming.json`, **11,319 B**, `f38da1c9db4198b6dcb66199e39039cacb62286aa870451e5356015eaa165bc0` | Pine `rangedPage.combat` → `game/loadout/rangedPage.ts:91` → `installRoamingCombat` (`game/combat/roamingSession.ts:41`); Explorer King sockets read the same file. Whole `RoamingCombatSchema` includes native session/projection/presentation, loadout, elite rewards, parked drops, tells and owner ordering. Only Pine calls the complete producer in `generators/roamingCombat.ts`; a shared boss profile child does not supply a second root. |
| Pine `client/ranged-page.json`, **2,979 B**, `3b7fcc523a52199450c25212d9e2a07a9c0284f03a2d36ac8d34f59a190fb856` | Pine `client/plan` held.ranged-page → `game/shardfile/clientQuestComposition.ts:29` → native `prepareRangedPage` / `installRangedPage`. Whole `RangedPageSchema` includes menu, pickups, prewarm, collection/chalk, debug lap, actor life and shadow flags. Only Pine emits the complete page (`generators/rangedPage.ts:32–51`); common held rows are different complete roots. Existing G571 host listing does not establish a second actual file user. |
| Nalati `combat/room-entry.json`, **46,170 B**, `7ef91a55cdb6568f415ec473c64f366af967b334fc94b34f1580b334867ee781` | Nalati `client/plan` world.assembly stage file → `game/shardfile/worldAssembly.ts:359` → `buildArenaRoomEncounter` / `ArenaRoomSchema` / `ArenaRoomEncounterSchema`. Actual envelope is `{room,encounter}` with private scene/view and King definition/program. The attached outer unknown children are not a complete shared grammar. Only Nalati authors this full room/King body. |
| Nalati `combat/timed-encounters.json`, **12,907 B**, `ea527b416b0b73f44f4cbc54eb97c57eb061b6742fabb4ccfd2c615e957ce3fb` | Nalati `client/plan` timed.encounters and headless assembly constants.timedEntry.file → `installClientTimedEncounters` → `TimedEncounters.install` (`game/boss/timedEncounters.ts:50`). Whole body retains slots/patrol/views plus source parameters/phases/respawn/tell, AS return descriptor and contact strike. `TimedEncountersSchema` is loose; shared slot/patrol children or a fixture do not establish a second full producer. Only Nalati emits it. |
| Nalati `combat/titan-fight.json`, **88,700 B**, `20412d9f03c08749247dff2dedd344db425b989fca26917877d782687bd894c7` | Nalati world.assembly arena-room files.fight → `readArenaScriptData` (`game/boss/openArenaFight.ts:29`), also the maintained native Titan runner. Whole body includes arenaScript, programs, arenaFire, arenaRoom and king. `ArenaScriptFightFileSchema` admits only its loose fight subset; no second whole fight/King/room producer exists. Do not register that subset as the complete envelope. |
| Nalati `combat/titan-geometry.json`, **845,213 B**, `f727df6d5a597843eb4e21774d25cbc520533383131089d274dcc29bd6d078e6` | The same Nalati world.assembly stage files.geometry → `readArenaScriptData` → native cloud body, arena, eyes, poses, per-tier puffs and flames. `ArenaScriptGeometrySchema` has loose body and unknown eyes/poses/flames; neither a common scene child nor another boss supplies this whole contract. Only Nalati emits `titanGeometryRows()`. |
| Nalati `models/cloud-specimen.json`, **962,762 B**, `d4b0727222dff41bab3d2079cb3574ecee3ad1ce65996dadda7b3be5625bcc33` | Nalati Explorer storm-titan json → `game/boss/encounterView.ts:371` CloudSpecimen factory. Whole name/pose/ports/phone/desktop body has both native cloud views; `CloudSpecimenSchema` still has unknown CloudBody poses. Only Nalati constructs it in output.ts. This file overlaps Z7; it stays charged once, with no invented second geometry/specimen user. |
| Nalati `riding/mounted-figure.json`, **1,821 B**, `597b13a0028c4c7c0e6e8aef34ccfdadeaf002a88172a97263c320c8594ca1f9` | Nalati `riding/session.figure` and Explorer mounted specimen → `installClientRiding` (`game/riding/client.ts:298`) / `game/models/mountedSpecimen.ts:36`. Whole `MountedSpecimenSeatSchema` contains mount joint, private figure, material, shapes, clips, speed and gesture cues; original native seated-figure/resource preflight remains. Only Nalati produces `nalatiMountedFigure`; generic figure/clip children are not a second whole seated root. |
| Nalati `riding/session.json`, **32,469 B**, `89cdb417cbbab6cdb255005adae10319b8ff9e037af8f5ab009ba26b268c7900` | Nalati `client/plan` riding.session file → `installClientRiding` (`game/riding/client.ts:295`). Whole `ClientRidingSessionSchema` has preset/programs/profile/roads/rest/taming/naming/figure. Build author removes compiled metadata via native schema parsing; original ReturnProgram/owner/resource admission remains. Only Nalati emits this complete session, despite shared Mount and HUD children. |

All nine fail HOST-BAR test 1's actual two-whole-root-user requirement
for new family credit. No registration, permissive union, renamed
one-user envelope, fixture second user or child-schema substitution is
introduced. Existing unknown/malformed/range/resource and native-owner
checks are unchanged. This census makes no new host approval claim.

The requested Titan-to-AS direction is already implemented for the
shard's rules and decisions: `generators/stormTitanRows.mjs:31–45` compiles
`titanCombined.as` / `titanCommands.as` and the pasture/wind AS, retaining
the exact ABI-1 witnesses beside selected ABI-2 modules.
`generators/scriptInventory.ts:29` publishes the attack and pasture
projections; `OpenArenaFight` lends native simulation/view authorities.
The remaining fight JSON is its complete wire/view envelope; renaming
that file or duplicating its descriptor in a platform wrapper would not
remove the one-user contract. No new WASM-HOST work or runtime move is
claimed here.

Retirement qualification and landing remain open until the candidate’s
Nalati Chromium and WebKit G998 rows are all read and green. No ceiling
is changed in this census commit.
