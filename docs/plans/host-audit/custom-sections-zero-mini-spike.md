# Custom sections to zero: audit and spike (HA7 follow-up)

**State:** research spike, 2026-11-03, for wildshard-v. Read-only: `node scripts/section-inventory.ts --json` (CS1's
script) over the `out/` products built 06:57 today at HEAD `2ec2da8a9e`, plus the gate's own measure
(`outputSections` in `scripts/shard-platform-output.mjs`), source greps and the emitted routing rows. No builds,
browsers or captures. Its hosts are the build rows **Z0–Z15** of the
[custom-sections mini plan](custom-sections-mini-plan.md#zero-rows-one-generic-host-each-2026-11-03) (R0 = Z1, step 0 = Z0, H1 = Z2 + Z3,
H2 = Z5, H3 = Z12, H4 = Z9, H5 = Z7, H6 = Z8, H7 = Z4, H8 = Z14, H9 = Z6, H10 = Z11, H11 = Z10, H12 = Z13, Z = Z15).

Jake, 2026-11-03: *"all the custom sections have to be removed … they all have to be generic, high-quality hosts in
the engine … the goal is to get custom sections to zero."*

## Bottom line

- **The true number is 342**: 4 `custom/` sections plus 338 named JSON blobs, 30.6 MB, in six shards. The gate
  measures the same 342 (G496 counts every named JSON). Templates, open plots, Pastel Plain and Ink-Cel are 0.
- The mini plan's CS rows are "done" by **named exits**, not by removal: the count fell 387 → 342 since 10-24.
- **98 of the 342 already use one shared format schema with two or more shard users.** They are custom only
  because the measure counts every named file. One registry (R0) clears them.
- **Shard runtime TS is already 0.** Shard folders hold generators (build-time, never custom under G467), data,
  AssemblyScript and `.d.ts` typings. The only shard TS tied to custom sections is the two
  `runtime/productSections.d.ts` files (Driftwood, Pine). The custom thing left is **data with a private schema**.
- 12 hosts plus a registry and a delete step reach zero in **~45 lane-days** (~29 Opus, ~16 Codex), about two
  weeks with 3 Opus + 3 Codex lanes.

## What "custom" means here

| Term | Meaning | Count | Bytes |
|---|---|---:|---:|
| `custom/` section | Private section, shard `SECTIONS` schema | 4 | 48 KB |
| Named JSON, raw | Schema built inside the shard's generators, or none | 135 | 12.5 MB |
| Named JSON, one-shard format schema | Schema in `@wildshard/format`, one shard emits it | 101 | 15.5 MB |
| Named JSON, shared format schema | Schema in format, two or more shards emit it | 98 | 2.5 MB |
| **Total (= gate measure)** | | **342** | **30.6 MB** |

Platform sections (1,072 rows, 7.3 MB) and binary blobs are not custom.

## Per shard today

| Shard | `custom/` | Named JSON | Total | Bytes | Ratchet ceiling (count / bytes) |
|---|---:|---:|---:|---:|---|
| Pine Hollow | 2 | 121 | 123 | 7.44 MB | 234 / 10.6 MB (111 slack) |
| Nine Dragon Stack | 0 | 91 | 91 | 10.91 MB | **19 / 4.55 MB: measured is 72 over** |
| Driftwood Isle | 2 | 46 | 48 | 2.76 MB | 53 / 3.07 MB |
| Nalati Grasslands | 0 | 45 | 45 | 8.77 MB | 46 / 12.35 MB |
| Far Reach | 0 | 19 | 19 | 0.61 MB | 19 / 2.93 MB |
| Sunscar Dunes | 0 | 16 | 16 | 0.07 MB | 16 / 0.08 MB |
| **Total** | **4** | **338** | **342** | **30.6 MB** | 387 / 33.6 MB |

The four `custom/` sections: DW `collections` (2.7 KB) and `fixedLayouts` (7.9 KB); Pine `questRuntime` (29.3 KB)
and `nativeView` (8.6 KB). **`custom/nativeView` has no shipped reader**: no `src/` module and no emitted row
names it; only `test/fixtures/pine-headless.ts` and Pine's generators touch it.

## How a named file is read

Named files are a tree. A root is routed by a generic row (mostly `client/plan` feature kinds, `world/scenes`
steps, `explore/catalogue`), and the root names its children. Examples: DW `quests/page-composition` names nine
quest files; Pine `world/forest-weather` names weather, rain, observations and shelter; Nalati `held/slots` names
the four weapon pages. 306 of 342 are named by an emitted row; the other 36 are read by fixed name in a game
module (`quests/story.json` in `game/client/quest/pageComposition.ts`), by the headless worker, or only by tests.
So the readers are mostly generic row-kind hosts already. What is private is the **schema** of the document.

## The audit, grouped by the host that absorbs it

"Raw" = schema in the shard; "1-shard" = format schema with one user; "shared" = cleared by R0.
E = emitting generator (`src/shards/<slug>/generators/`); R = route or reader.

| Host | Shard: families (count, bytes) | E | R | State |
|---|---|---|---|---|
| R0 | DW+Pine `world/placement-pages/*` (12, 1.26 MB) | Pine bake, DW productPageFiles | `sdk/worldScenes.ts` | shared |
| R0 | All `scenes/*`, `world/scenes/*` recipes: DW 11, Pine 3, Nine 3+1 portal, Far 15, Sun 9 (42, 142 KB) | worldScenes.ts | `world/scenes` steps | shared |
| R0 | `world/fields/*`, `world/cards/*`, portal sparks: Far 1, Sun 4, Nine 4 (9, 150 KB) | meadowScene / emberBuffers / worldScenes | `world/scenes[buffered]` | shared |
| R0 | `models/world-scenes` DW, Pine, Nine (3, 385 KB) | worldScenes.ts | `world/scenes`, `client/plan[world.assembly]` | shared |
| R0 | Quests DW+Pine: story, achievements, chapter-director, page-composition, services, stall, trader/lanterns/mill-door; Pine+Nalati panels, persistence (19, 49 KB) | output.ts / sourceOutput.ts | `client/plan[quest.*]`, `game/quest/*` | shared |
| R0 | Actors: page-life ×2, directors ×2, creature looks DW+Nalati, posed draws ×3 (9, 440 KB) | creatureLook, pageLife, output | `client/plan[page.life|species.program]`, `game/shared/plugin/director.ts` | shared |
| R0 | `people/catalogue` DW+Pine, `world/forest-weather` Pine+Nalati (4, 38 KB) | figureCatalogue, output | `client/plan[weather.forest]`, quest roots | shared |
| H1 | Nine `world/placements/*` (70, 6.33 MB) | worldScenes.ts | `world/scenes` steps | 1-shard |
| H1 | Pine `scenes/cabins/specimens/*` (56, 702 KB), `living/*` (8, 691 KB), `cabins-{phone,desktop}-shadow-*` (4, 339 KB) | bake-cabin-scenes.mjs, bake-cabin-living.mjs | weld refs, `game/client/shardfile/forestPage.ts` | raw |
| H1 | DW `world/island/plan-{phone,desktop}` (2, 651 KB); Nine `world/casts`, `world/fabric` (2, 25 KB) | productPageFiles, castSources, slabs | `client/plan[world.baked]`, `world/scenes` | raw |
| H2 | Far `world/sources/{bakes,heroes,sky}` (3, 353 KB); Sun `world/sources/{bakes,models}`, `world/places-effects` (3, 56 KB) | sceneSources.ts | `game/client/shardfile/sceneSources.ts`, `sceneBakeFiles.ts` | raw |
| H3 | Pine `world/floor` (3.20 MB), `crag-cave` (922 KB), `cave-interior`, `forest-page`, `building-sites`, `landmark-view`, `data/physics.generated` (152 KB); Nalati `world/meadow`, `world/water` (86 KB) (9, 4.40 MB) | forestPage, bake-pine-floor, groundTileInputs, output | `client/plan[world.forest-page|world.meadow|practice.course]`, `forestPage.ts`, `caveInterior.ts` | 1-shard / raw |
| H4 | Nalati `world/dressing-pages/*` (5, 2.75 MB), `dressing-{phone,desktop}` (2, 1.82 MB); Pine `world/props`, `prop-shapes` (2, 106 KB) | dressingPages, dressingScene, bake-pine-props | `world/scenes`, `game/client/shardfile/sceneDressing.ts`, `game/client/grid/products.ts` | 1-shard / raw |
| H5 | Nalati `models/cover-{phone,desktop}`, `gear-book`, `shape-book`, `cloud-specimen` (963 KB); Nine `geometry/fixed-kits`, `geometry/layout` (1.0 MB), `models/held-cards`, `signs/atlas-{phone,desktop}` (1.35 MB); DW `models/fixed-geometry`, **`custom/fixedLayouts`**, **`custom/collections`**; Pine `look/cover-appearance` (14, 3.64 MB) | explorerCatalogue, coverSpecimens, demandAdmission, clientSections | `explore/catalogue[specimen|cloud|held]`, `game/models/{islandLibrary,fixedDraws,collectionDisplay}.ts`, `game/client/shardfile/islandBook.ts` | raw |
| H6 | Pine `native-spots`, `native-story`, `contracts`, `forest-story`, **`custom/questRuntime`**; DW `discovery`, `interaction-source`, `hints`, `steps`, `wake-boss`; Nalati `carried`, `chapters`, `content`, `finds` (14, 98 KB) | forestStory, nativeQuest, output | `client/plan[quest.views|quest.spawns|quest.chapter-view|bag.finds]`, `game/server/plugin/simulation.ts` | raw / 1-shard |
| H7 | DW `actors/projection`, `creature-install`, `poses/monkey` (82 KB), `sim/keeper`, `sim/returns`, `sim/enemy-placement`; Pine `actors/roster` (250 KB), `elites`, `shelter`; Nalati `actors/sheep`, `actors/wildlife`, `sim/population-metadata`, `sim/taming-poses` (13, 734 KB) | creatureLook, sourceOutput, output | `client/plan[population.wildlife]`, `game/population/*` | 1-shard / raw |
| H8 | Nalati `combat/{room-entry,timed-encounters,titan-fight,titan-geometry (845 KB)}`, `ride/rules`, `riding/{session,mounted-figure}`; Pine `combat/roaming`, `client/ranged-page`, **`custom/nativeView`** (10, 1.08 MB) | output, roamingCombat, rangedPage | `client/plan[arena-room|timed.encounters|riding.session|held.ranged-page]`, `game/server/boss/arenaRoom.ts` | raw |
| H9 | Nalati `weapons/{bow-page,rifle-model,rifle-page,sabre,spear}`, `held/slots`; Nine `weapons/jian-{cloth (1.36 MB),halo,row (390 KB)}`; Pine `loadout/finishes` (10, 1.91 MB) | heldSlots, sabrePool, heldView, productOutput | `client/plan[held.claims.*]`, `held/arms`, `game/client/systems/viewmodel/heldView.ts` | raw |
| H10 | Nalati `world/weather`, `weather-fx` (1.05 MB), `audio/scene`, `look/post`; Pine `world/weather`, `rain`, `weather-observations`, `ambience` (8, 1.11 MB) | weatherPage, rangedPage, output | `world/forest-weather` children, `audio/audio`, `ui/level`, `game/client/weather/forest.ts` | raw |
| H11 | DW `people/cards`, `world/building-life`, `world/cover-composition` (3, 2 KB) | explorerCatalogue, worldAssembly | `explore/catalogue[kit-figure]`, `client/plan[site|streamed-cover]` | 1-shard / raw |
| H12 | `sim/headless-assembly` DW (920 KB), Pine, Nalati, Nine; Nalati `sim/headless-boot`; Nine `sim/headless-constants` (6, 1.31 MB) | output, productOutput | headless worker, `client/plan[elite.construct]` | raw |

Sum: R0 98 + H1 142 + H2 6 + H3 9 + H4 9 + H5 14 + H6 14 + H7 13 + H8 10 + H9 10 + H10 8 + H11 3 + H12 6 = **342**.

## The hosts

Six tests = HOST-BAR's (two users, no shard nouns, data-driven, server-safe, deletion, data-only API). "Exists"
means a game or SDK module already reads this data for at least one shard.

| Host | What it is | Kills | Exists today | Host-bar fit | Lane | Days | Proof |
|---|---|---:|---|---|---|---:|---|
| **R0 Platform file families** | A registry in `@wildshard/format` beside `PLATFORM_DATA_SECTIONS`: a name pattern → one format schema, for streamed named files. The measure counts a named file only if its family is unregistered. A family registers only after its reader scores 6/6 | 98 | Schemas and readers exist; registry does not | Good: every family has ≥ 2 shard users | Codex | 2 | Payload bytes identical; index metadata only |
| **H1 Streamed scene pages** | One paged placement family; tier and shadow variants derived at load, not shipped as copies | 142 | `sdk/worldScenes.ts`, `WorldScenePlacementPageSchema` (DW + Pine) | Good once Nine and the Pine cabins adopt it | Opus | 7 | Zero-pixel A/A + A/B per affected pose, both tiers and shadow modes; no-worse loading; walk 0 stuck |
| **H2 Scene source envelopes** | One complete bake / model source root (CS3-E5) | 6 | `game/client/shardfile/sceneSources.ts` (Far + Sun) | Good: two users | Codex | 1.5 | Byte-identical payloads, same parse |
| **H3 Ground pages** | Ground layout, caves and collision as a `world/ground` family; big grids as binary packets with row headers | 9 | `forestPage.ts`, `caveInterior.ts` (Pine only), `world/physics` | Weak: forest grammar is Pine-only (test 1) | Opus | 3.5 | Zero-pixel; Pine walk 75/75, 0 stuck |
| **H4 Instanced scatter rows** | Typed scatter pages for dressing and props | 9 | `game/client/shardfile/sceneDressing.ts` (Nalati) | Fits once Pine props is user two | Opus | 3 | Zero-pixel both tiers; collider walk |
| **H5 Model library** | One specimen / fixed-draw / collection book, plus a generic atlas row (glyph rects over the KTX2 that already ships) | 14 | `game/client/models/islandLibrary.ts`, `fixedDraws.ts`, `collectionDisplay.ts`, `SpecimenBookSchema` | Good: DW, Nalati, Nine all have books | Opus | 4.5 | Zero-pixel per specimen; Explorer cold-open |
| **H6 Quest documents** | Finish the `quest/*` family; Pine's `lead.program` becomes an AssemblyScript module on today's Script ABI | 14 | `game/quest/*`, `quest.composition` (DW + Pine) | Good; the program is shard AS by design | Opus design, Codex port | 4.5 | Save / phase / native assertions; quest e2e |
| **H7 Populations** | `actors/species` + `actors/populations`; keeper, returns and spawn programs as AS | 13 | `game/population/*`, `looks/speciesBook.ts` | Good: three shards | Codex (+ Opus for poses) | 3 | Byte-identical, native population checks |
| **H8 Encounters and riding (= CS8)** | Arena room, timed encounter and riding-profile rows; Titan fight script to AS (`nativeView` is deleted at step 0) | 9 | `game/server/boss/arenaRoom.ts` (1,641 lines, Nalati only), `game/riding/*` | Weak: one user today | Opus | 4.5 | Fight e2e, ride e2e, zero-pixel arena |
| **H9 Held kits** | Weapon pages into the `held/*` platform sections; Jian cloth / halo ship as GLB | 10 | `held/arms|gear|finishes|loadout|equipment`, `heldView.ts` | Good: three shards | Opus | 3 | Zero-pixel viewmodel per weapon |
| **H10 Weather, audio, look** | `world/weather` + `audio/scene` families; post look into the approved post-graph platform (G599) | 8 | `game/client/weather/forest.ts` (Pine + Nalati), `audio/sceneDirector.ts` | Good: two users | Opus fx, Codex audio | 3 | Zero-pixel weather states; audio byte-identical |
| **H11 People and places** | Fold cards / building life / cover into `people/figures`, `world/places` | 3 | `people/catalogue` (shared) | Good | Codex | 1 | Byte-identical |
| **H12 Headless derivation** | The worker derives its assembly from the shipped sections; the files are deleted | 6 | `sdk/headlessRuntime.ts` | Good: no shard data at all | Codex | 2.5 | Headless replay identical on four shards |
| **Z Delete and lock** | See end state | — | — | — | Codex | 1.5 | Types, lint, full build |

## Order: most sections per lane-day first

| # | Step | Kills | Days | Per day |
|---|---|---:|---:|---:|
| 0 | Ceilings to actuals (DW 48, Pine 123, Nalati 45; record Nine's 72-over); delete Pine `custom/nativeView` after one reader check | 1 | 0.25 | — |
| 1 | R0 platform file families | 98 | 2 | 49 |
| 2 | H1 Nine placements → pages | 72 | 2.5 | 29 |
| 3 | H1 Pine cabins (68) + DW island plans (2) | 70 | 4.5 | 16 |
| 4 | H7 populations | 13 | 3 | 4.3 |
| 5 | H2 source envelopes | 6 | 1.5 | 4.0 |
| 6 | H9 held kits | 10 | 3 | 3.3 |
| 7 | H5 model library (2 `custom/`) | 14 | 4.5 | 3.1 |
| 8 | H6 quests (1 `custom/`) | 14 | 4.5 | 3.1 |
| 9 | H4 scatter, H11 people, H10 weather | 20 | 7 | 2.9 |
| 10 | H3 ground, H12 headless, H8 encounters | 24 | 10.5 | 2.3 |
| 11 | Z delete and lock | — | 1.5 | — |

Steps 0–3 take 9 lane-days and remove 241 of 342 (70 %). Codex starts R0, H2, H7 and H12 at once; Opus takes H1 first.

## End state

- `shard.json` holds platform sections, registered file families and binary blobs. Nothing else is admitted.
- **Deleted:** shard `SECTIONS` and both `runtime/productSections.d.ts`; the custom branches in `sdk/outputRuntime.ts`,
  `sdk/outputProduct.ts`, `game/shared/shardfile/shardProduct.ts`, `clientPlan.ts`, `game/quest/{pageComposition,
  continuation,chapterDirector,questPageViews}.ts`, `game/models/{islandLibrary,kitFigureCard}.ts`; shard-built
  inline schemas (`driftwood-isle/generators/namedSchemas.ts` and the rest); `scripts/custom-section-policy.mjs`,
  `scripts/check-custom-section-growth.mjs`, `lint/custom-sections.json` and the 28 `custom-sections/*` ceilings.
- **The lock (one rule, at build):** output admission refuses any `custom/` section name and any named JSON whose
  name matches no registered family. A new family needs a format schema, two shard users or a Jake G row, and a
  6/6 reader score. One ratchet row, `custom-sections/total = 0`, stays as the CI-visible number.
- `scripts/section-inventory.ts` stays as the census; its "custom" column must read 0 for every product.

## Risks and what cannot be generic

1. **The measure is the lever.** G496 counts every named file. Pages must stay separate files: sections are read
   eagerly and synchronously, and inlining 30 MB would break the 1.2 GB phone budget. So zero must mean "no
   `custom/` and no unregistered named JSON". **Recommend Jake rules this before R0.**
2. **"Done by named exit" must stop.** CS2–CS10 closed by naming exits; the count barely moved. Recommend: a
   host row is done only when the gate's number drops by its kill count.
3. **One-user families fail test 1**: forest ground (Pine), arena, Titan and riding (Nalati), sign atlas and Jian
   (Nine). Recommend folding into wider two-user families where honest (Pine props into scatter, the sign atlas
   into the model library, Nalati meadow / water and Far / Sun fields into ground). Bring what is left to Jake as
   **one batch** of G595 one-user approvals, not one host each.
4. **Behaviour is not data.** Pine `lead.program`, the Titan fight script, keeper / return programs and taming
   are behaviour. They go to AssemblyScript on today's Script ABI (10 Hz). G969 bars WASM-HOST work, so H6 / H8 /
   H17 are not available; anything that needs a per-frame lane is a blocker to raise, not to fake.
5. **Geometry in JSON.** Jian cloth (1.36 MB three.js JSON), sign atlas (1.35 MB), Nine layout (1.0 MB), Titan
   geometry (845 KB), cloud specimen (963 KB) and weather fx (1.05 MB) are meshes or buffers in JSON. The generic
   answer is GLB or `.bin` plus row headers, not a JSON schema. It also cuts parse time on the phone.
6. **Nine is 27 % of the count** and 72 over its ceiling. CS3-E1 holds a Nine QA deferral. Nine's shardfile
   pages do not touch Nine legacy (G908 / G933), so recommend building them now under identical captures.
7. **Pixel and loading cost.** DW pages needed a loading fix-forward; Nalati pages needed warm-loading reads.
   Budget one capture day inside every Opus host, and keep each new paging change behind a Debug row until
   its reading is in.
8. **Reader evidence is thin.** CS1 binds readers by literal name for only 9 of 342 rows. Route-following (this
   spike's emitted-row walk) found 306; R0 should add that walk to the census so no family registers without a
   known reader.

## Decisions for Jake

1. **Zero means no `custom/` and no unregistered named JSON** (registered streamed families allowed)?
   Recommended: yes.
2. **One batch of one-user approvals** for what cannot find a second user (expected: forest ground, arena / Titan,
   riding)? Recommended: yes, after steps 0–8, so the batch is small.
3. **Nine pages now** under identical captures, without waiting for the Nine fps QA? Recommended: yes.
