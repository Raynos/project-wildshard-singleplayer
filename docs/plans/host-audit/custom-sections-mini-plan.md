# Custom sections to one generic platform (E498)

**State:** `planned` 2026-10-24; **non-graphics rows unparked for the Codex lanes 2026-10-31 (G963):** CS1, CS2, CS4, CS5, CS6, CS7 (audio / weather / people), CS9; CS3 only with identical captures; graphics rows stay Opus. — phase HA7 of [HOST-AUDIT](../HOST-AUDIT.md) (G697). **CS0 lands now** (G698); CS1–CS10
start with HOST-AUDIT (G679), **quests (CS5) first** (G702), no exceptions at the end (G699), WASM-HOST H6 / H8 / H17 only (G701). Direction is G696 ([decisions](../shard-platform/decisions.md)). Read-only audit by the plan agent's subagent
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
| **CS0** | **done (2026-10-24, sp-x6):** measured ceilings 387 / 33,613,009 B; shrink-only existing-name inventory, new custom sections refused, new named JSON requires an exact defining format schema. **Ceilings to actuals and a schema freeze** (free, can land now): set every `custom-sections/<slug>` ceiling to the measured value (549 → 387, 62 MB → 33.6 MB); refuse a new `custom/` section and any new named JSON whose schema is defined in a shard folder | 0.5 day, Codex |
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
| Remaining quest/story/step/panel/persistence/carried/runtime documents | **CS5**: complete shared quest schemas and approved WASM programs. Persistence and panel-catalogue registration remain explicit work in that row. |
| `directors/main.json`, population/keeper/return/install/roster/shelter documents and remaining creature custom sections | **CS6**: retain complete native controller/module/ownership rows; executable behaviour belongs on the approved sim host. |
| Held kits/weapons, collections/appearance/sky/audio/weather/water, people/places and raw jian geometry | **CS7**: unify complete wire shapes and retain native consumers. Pine `world/weather.json` is a program; Nalati's same name is `{weather,reactions}`, so it is not yet one contract. Raw geometry exits through the model library. |
| Room/boss/encounter/fight/riding documents | **CS8**: retain closed encounter/riding owners; executable fights use the approved host. |
| Headless assembly/boot/constants, native views and runtime graphs | **CS9**: derive assemblies from platform sections and use approved view hosts; permissive assembly envelopes are not CS2 registrations. |

These exits remain open work, not completed platform contracts. CS10
removes the checked private path only after they land. Missing provenance,
unresolved readers and one-user schemas remain explicit audit evidence.
