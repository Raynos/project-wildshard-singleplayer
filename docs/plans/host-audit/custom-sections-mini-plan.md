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
| **CS1** | **done (2026-10-31, sp-x1):** `9a616b4b82` inventories all 24 products in 4.56 s: 1,406 rows / 11 source projects; six inventory controls pass. `b13ad77350` fixes exclusive compiler ownership, with the original owner assertion, six controls and root/scripts types passing. Hash-bound source/reader evidence stays explicit; no ruler or inferred host credit. | 0.5–1 day, Codex |
| **CS2** | **open (2026-10-31, sp-x1):** persistence, 27 native world-scene recipes, the 23 aliases/forest-page documents in `31bffc86fb`, and building-sites/shape-book are qualified. The 62 welds remain withdrawn; eight separate living-cabin envelopes are also an explicit index-footprint exit under the approximately 1.9 MB Pine headroom rule. Ground-family source review is next. Remaining names need the concrete family exits below; the five repeated-name exits alone do not close CS2. | 2–3 days, Codex + Opus review |
| **CS3** | **open (2026-10-31, sp-x2):** first exact phone-dressing slice `1fadd8e67a` passes full body proof and strict P1–P3 A/A + A/B (all six comparisons 0 pixels). Desktop and wider scene migration remain open; see [the scoped reading](#cs3-first-phone-dressing-slice). **K1 scenes**: one streamed `world/scenes` family and `models/library`; Pine's 112 placement files become one indexed section; tier copies derived. | 3–4 days, Codex (Opus memory reading on Pine) |
| **CS4** | **Qualified slices done; row remains open for its explicit owner/host exits.** Pine common physics `5596fde41e`: strict7 and original unfiltered walk **75/75, 0 stuck/bounds/pending**. Floor/cave defining contracts `b5a7dc391d` are qualified by the recorded coalesced proof; fields and complete ground aliases `d0c35248f3` retain original payload/pack/native checks. See the completion ledger below. Pine owner-only physics and G667 tests 2–6 are not closed by metadata. | 2–3 days, Codex (Opus memory reading) |
| **CS5** | **K3 quests**: one `quest/*` family across Pine, Driftwood, Nalati (and Sky's quest rows); Pine `questRuntime` program to AS | 4–6 days, Opus design + Codex port |
| **CS6** | **K4 creatures**: `actors/species` + `actors/populations`; behaviour rows to AS on WASM-HOST H6 / H8 | 4–6 days, Opus + Codex |
| **CS7** | **Audio/cards slice done; row remains open for the 25-name held/look/weather exits.** `2c5aa6386d` / `515ffcac96` qualify Nalati audio and Driftwood people cards: strict6, six controls, original five suites **28.7 s**, 2,993 unchanged bodies of 2,994; only the exact G872-classified Nalati source stamp differs. No full-CS7 completion, geometry/binary exit or weather-envelope unification is inferred. | 4–5 days, Codex |
| **CS8** | **K9 combat and riding**: room, encounter and riding-profile rows; Titan script to AS | 2–3 days, Opus |
| **CS9** | **K10 headless and views**: derive the headless assembly from platform sections; `nativeView`, `runtimeGraphs`, jian effects on H9 / H17 | 2–3 days, Opus (after WASM-HOST H9, H17) |
| **CS10** | **Delete the path, no exception**: `custom/` prefix, shard `SECTIONS` / `FILE_SCHEMAS`, `schemas/custom/` emit, `game/shardfile/customSchema.ts`, the `CustomSectionName` reader overload, `custom-sections/*` budgets, `lint/custom-sections.json`, `check-custom-section-growth.mjs`, `custom-section-policy.mjs` | 1 day, Codex |

### Recorded completed bars: CS1 / CS4 / CS7

This ledger marks the **qualified slices done**, not unimplemented family
exits. CS2 remains open with sp-x1. CS4's remaining owner/host exits and
CS7's complete-envelope/model-library exits remain in their source tables;
they are not counted as deleted private paths or completed CS10 work.

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
| Remaining quest/story/step/panel/carried/runtime documents | **CS5**: complete shared quest schemas and approved WASM programs. Persistence registration is qualified below; the complete panel catalogue still has an inline record contract. |
| `directors/main.json`, population/keeper/return/install/roster/shelter documents and remaining creature custom sections | **CS6**: retain complete native controller/module/ownership rows; executable behaviour belongs on the approved sim host. |
| Held kits/weapons, collections/appearance/sky/audio/weather/water, people/places and raw jian geometry | **CS7**: unify complete wire shapes and retain native consumers. Pine `world/weather.json` is a program; Nalati's same name is `{weather,reactions}`, so it is not yet one contract. Raw geometry exits through the model library. |
| Room/boss/encounter/fight/riding documents | **CS8**: retain closed encounter/riding owners; executable fights use the approved host. |
| Headless assembly/boot/constants, native views and runtime graphs | **CS9**: derive assemblies from platform sections and use approved view hosts; permissive assembly envelopes are not CS2 registrations. |

CS2 is not marked done: the landed registry covers the named slices and bounded families recorded above, while the remaining scene/source, ground, quest, actor, held/look/audio/people, encounter and headless names still require their complete defining contracts through these exits. An existing shared schema or a family-level exit label alone does not demonstrate that every remaining logical name has passed the CS2 bar.

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

**CS4 remains open** for Pine floor/cave, Nalati meadow and other ground
bakes. Retained encounter and authoring-owner data are explicit owner-data
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

**CS9 remains open** for the retired declaration scaffolding, every
remaining unique native constant and the view/graph AS exits. This slice
establishes actual defining-payload derivation, not complete headless
assembly retirement.

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
walk. CS4 remains open for its ground/streaming exits; CS2 remains open.

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
grants a new host or one-user waiver. **CS2 stays open.**

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

This is an explicit **open index-footprint exit on CS2**. A later,
separately reviewed index-compaction row may revisit it while preserving
the original index cap, defining provenance and native checks. It is not
a registration pass or permission to retry a subset of the withdrawn
slice. Other known cross-name native contracts remain source-first work;
CS2 cannot yet be marked done.

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
exit. **CS2 remains open** with these concrete remainders.

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
| Nalati `world/dressing-{phone,desktop}.json` (2) | `dressingScene.ts` emits the complete `SceneDressingSchema`; `output.ts` then binds the original painted books without changing that metadata. G483 explicitly approves `game/shardfile/sceneDressing` and `sceneInstances` with unrelated orchard coverage (HOST-BAR); no new host score is claimed. | **CS3:** X2 owns the first phone-only defining-metadata slice, with full native/refusal/resource checks, payload identity and strict affected-pose AA/AB. Desktop remains a separate exact-pixel adoption step. |
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
| DW/Pine/Nalati/Nine `sim/headless-assembly.json` | Existing `HEADLESS_ASSEMBLY_JSON_SCHEMA` is the trusted assembly scaffold, with distinct constants and native closures in each producer. Explicit **CS9 platform-section derivation/closed assembly exit**, not a permissive constants registration or a union of samples. |
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

**CS2 remains open.** This audit now names the native root or concrete
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
proof turn. CS2 remains open, and no machine reservation is needed to
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
off-tree for a later source/proof boundary. CS2 and the remaining CS5
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
