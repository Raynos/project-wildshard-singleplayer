# Custom sections to one generic platform (E498)

**State:** `draft` 2026-10-24 — part of [HOST-AUDIT](../HOST-AUDIT.md) and parked with it (G679) unless Jake pulls it
forward. Direction is G696 ([decisions](../shard-platform/decisions.md)). Read-only audit by the plan agent's subagent
at HEAD `6b7dd7ebd6` (~15:45 Cancun): source greps of every non-legacy shard's generators, the built products in
`out/` (Pine Hollow, Far Reach) and the push gate's latest exact measure
(`.git/custom-section-measures/dcff0904cd….json`). No builds. Counts for Driftwood, Nalati and Nine are split by kind
from their generators, so per-kind numbers are ±10 %; per-shard totals are exact.

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
- **(b) evict to WASM** for data that is really behaviour (spawn streams, keeper / return programs, director rows,
  quest runtime programs, Titan fight script, native views, runtime graphs): an AssemblyScript module plus generic
  data rows, hosted by WASM-HOST (H6 `ws_step`, H8 sim lane, H9 view lane, H17 headless).
- **(c) delete** what is derived or duplicated: tier / shadow copies of cabins (4 files, 0.44 MB), per-shard headless
  assemblies (derive from the sections), raw three.js geometry JSON (ship as GLB).
- **Rating:** every reading host is scored on HOST-BAR's six tests by HA2's fresh seats before its section moves; a
  fail goes to HA4a/b (back to the shard as data or AS), never a renamed TS file.

## Rows (phase HA7 of HOST-AUDIT)

| Row | What | Effort |
|---|---|---|
| **CS0** | **Ceilings to actuals and a schema freeze** (free, can land now): set every `custom-sections/<slug>` ceiling to the measured value (549 → 387, 62 MB → 33.6 MB); refuse a new `custom/` section and any new named JSON whose schema is defined in a shard folder | 0.5 day, Codex |
| **CS1** | **Generated section inventory** inside HA1's ruler mode: every section and named JSON blob with shard, bytes, schema module, the schema's shard users, reading host (H-group). Lands in HA2's one table | 0.5–1 day, Codex |
| **CS2** | **Platform names for blobs**: `product.json` admits only names whose schema is registered platform-wide; the ~345 format-schema blobs get platform names (`world/scenes/<id>`), shard-local schemas listed for CS3–CS9 | 2–3 days, Codex + Opus review |
| **CS3** | **K1 scenes**: one streamed `world/scenes` family and `models/library`; Pine's 112 placement files become one indexed section; tier copies derived. Pine first, then Sky / Signal / Nine / Driftwood / Nalati | 3–4 days, Codex (Opus memory reading on Pine) |
| **CS4** | **K2 ground and physics**: Pine physics into `world/physics`; floor, crag cave, Sky fields, Signal embers into a streamed `world/fields` | 2–3 days, Codex (Opus memory reading) |
| **CS5** | **K3 quests**: one `quest/*` family across Pine, Driftwood, Nalati (and Sky's quest rows); Pine `questRuntime` program to AS | 4–6 days, Opus design + Codex port |
| **CS6** | **K4 creatures**: `actors/species` + `actors/populations`; behaviour rows to AS on WASM-HOST H6 / H8 | 4–6 days, Opus + Codex |
| **CS7** | **K5–K8 small kinds**: held kits, looks / collections, weather / audio, people / places; Nine jian JSON to GLB | 4–5 days, Codex |
| **CS8** | **K9 combat and riding**: room, encounter and riding-profile rows; Titan script to AS | 2–3 days, Opus |
| **CS9** | **K10 headless and views**: derive the headless assembly from platform sections; `nativeView`, `runtimeGraphs`, jian effects on H9 / H17 | 2–3 days, Opus (after WASM-HOST H9, H17) |
| **CS10** | **Delete the path, no exception**: `custom/` prefix, shard `SECTIONS` / `FILE_SCHEMAS`, `schemas/custom/` emit, `game/shardfile/customSchema.ts`, the `CustomSectionName` reader overload, `custom-sections/*` budgets, `lint/custom-sections.json`, `check-custom-section-growth.mjs`, `custom-section-policy.mjs` | 1 day, Codex |

**Effort:** ~26–37 lane-days, about 60 % Codex (CS0–CS4, CS7, CS10: mechanical producer/reader moves) and 40 %
Opus (schema unification in CS5 / CS6, WASM ports, memory readings). With 3 Opus + 3 Codex lanes: ~2–3 weeks
calendar, plus WASM-HOST H6 / H8 / H17 if not already built (that plan's own estimate).

## Order and interactions

1. CS0 now (no host moves, no G679 conflict); CS1–CS2 alongside HA0–HA1.
2. Biggest numbers first: CS4 (30 % of bytes in ~7 blobs) and CS3 (65 % of the count), Pine first (184 of K1,
   7.7 MB of K2, 10 of the 15 `custom/` sections).
3. Most duplication next: CS5 quests, then CS7's small kinds.
4. Behaviour last: CS6, CS8, CS9 wait on WASM-HOST H6 / H8 / H17 (H9 is already in progress).
5. CS10 the day the last ceiling reads 0.

- **WASM-HOST** must provide H6 (one `ws_step` per module) and H8 (sim lane) before CS6 / CS8, H17 (headless v2)
  before CS9; H9 (view lane) is already being built. Pull only those rows in, not all of v2.
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
