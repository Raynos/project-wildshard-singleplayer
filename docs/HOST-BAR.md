# The host bar: what goes in the engine, the game, or the shard

The scoring matrix for every platform host and every proposed one. A host is shared code in `src/engine`, `src/game`,
`src/sdk` or `src/format` that shards drive. Jake set the bar in G454 (2026-10-16) and asked for it to be written down
as permanent design (G481, 2026-10-17): *"the engine is supposed to be very flexible and not have all kinds of random
Sky specific and Dune specific if statements in them."* Decisions live in
[plans/shard-platform/decisions.md](plans/shard-platform/decisions.md); the layer rules are in
[ENGINE.md](ENGINE.md) and [AGENTS.md](../AGENTS.md).

## Where code belongs

| Place | What it holds | Test |
|---|---|---|
| **Engine** (`src/engine`) | Rendering, physics, input, audio, boot, levels in general | Knows nothing of the game, Wildshard, shards or content. Engine words only (E405) |
| **Game** (`src/game`, rows in `src/format`) | Wildshard concepts two or more shards use, driven by rows | Knows it is Wildshard; never names a shard |
| **Shard data** | JSON, sections, GLB, look-graph JSON, generator output | No runtime code |
| **Shard AssemblyScript** | Rules, decisions and story only this shard has | Event-driven, at most 10 Hz, through Script ABI commands ([SCRIPT-ABI.md](SCRIPT-ABI.md)); within 10 % of legacy lines (G463) |
| **Shard view code** (TS that stays) | Per-frame drawing or page wiring only this shard has and not worth a host | Listed with a reason; counted as custom |
| **Delete** | Dead code, finished Debug rows, legacy paths | Nothing reaches it |

`generators/` is build-time code and never counts as custom (G467), but only for files no runtime or headless file
imports.

## The six tests

A host counts as shared platform code only if it passes all six. Score each test 1 (pass) or 0 (fail), with file:line
evidence for every fail.

1. **Two real users.** Two shards drive it today. *Exception:* a feature Jake approved as platform from day one
   (G473–G478) or a pending-user entry in `lint/platform-pending-users.json` that names a real future shard, a plan row
   and a recheck date. A pending entry whose shard never adopts it by its recheck comes out and charges back.
2. **No shard nouns.** No shard names, ids, shard-only constants or `if (shard === …)` / `mode === 'board'` branches.
3. **Data-driven.** Shards differ only in the data they declare, not in parameter lists shaped like one shard.
4. **Server-safe**, or labelled as client-only presentation.
5. **Deletion test.** You would keep it if its first shard vanished.
6. **Data-only API** (G454 (5)). The API takes rows and ids. A per-shard hook is an AssemblyScript script reference,
   never a TS callback, subclass override, port object or `{owner, path}` reflection into shard code.

## Verdicts

| Score | Verdict | What happens |
|---|---|---|
| 6 / 6 (or 5 / 6 failing only test 1 under its exception) | **Real engine feature** or **real game host** | Counts as platform |
| 3–5 | **Borderline** | Named fix, a plan row and an owner; counts back to its shard if unfixed by its recheck |
| 0–2 | **Silly**: shard logic in a generic coat | Loses credit at once; moves back to the shard as data, AssemblyScript or listed view code |

**Single-shot code** (exactly one use, no plausible second user) is never a new host. It becomes a row, a number or an
AssemblyScript script. Examples from the Signal audit: the dusk-per-step table, flicker waves, a save-slot name.

## Nothing is free: net platform lines

Moving a line out of a shard into a host is not a cut until the host passes the bar. Every report shows shard lines
cut **and** platform lines added (G455, G466 (9)). A wave that removes 800 shard lines and adds 1,800 platform lines
has grown the codebase; the hosts earn it back only as more shards adopt them.

## The plugin system is migration scaffolding

`src/game/plugin/` (the `HybridRuntimePlugin` and the hooks shards subclass) exists to carry the legacy `runtime/`
code of shards that are not yet fully data. It is not the target architecture. As each shard's runtime reaches zero,
the plugin pieces only it used become dead code and are deleted (SHARD-PLATFORM-NEXT N2, G481). The Signal audit
(2026-10-17) scored `HybridRuntimePlugin` 1 / 6: a subclass with TS hooks and Sky's hoverboard mode hard-coded.

## Audits

- `progress/shard-platform/host-audit-2026-10-16/README.md`: the 92 pending-user hosts (77 good, 14 borderline, 1 silly).
- The Sky and Signal deep dives (2026-10-17): every platform module only those two shards use, scored on the six tests.
- `progress/shard-platform/builder-calls-audit-2026-10-17/host-rescore.md` (G496): 31 feature hosts since the 10:37
  pass re-scored; 17 self-scores held, 14 were too high; loadout `held.ts` and the held equipment catalogue score 2 / 6.

## Dated exceptions

- G586 (Jake, 2026-10-21): the Blender island loader (from Driftwood's `blobAssets.ts`) is a native engine host with one user.
- **G595 (Jake, 2026-10-22): from now on every one-user host needs Jake's own approval, host by host** (the plan agent brings each with its tests 2–6 scores); rejected hosts fold back into the shard as data / AS / WASM. Entries below that predate G595 are re-reviewed the same way.
- G599 N1 (Jake, 2026-10-22): the post-graph look platform, `game/looks/postGraphLook` over `format/postGraphLook` rows (side passes by tier, the graph composite, presence flags, pixel terms, LUT, AO / fog, sky, boolean event overrides, a lent live uniform set; no uniform name of its own, not the keyed sky). Approved on condition that Nalati's grade chain moves onto it too, which it did in G600 L1 (an optional `scene` row: its own composer with the scene pass and tiered bloom, the grade as a post graph, and a `replace` look's grid-cell composite): Nine and Nalati are its two users. Client-only; tests 2–6 in `test/post-graph-look.test.ts` (an orchard fixture).
- G600 L1 (Jake, 2026-10-22): `game/looks/paintedWorld#paintedWorld`, `game/looks/paintedWorld#paintedWorldOf` and `game/looks/paintedWorld#PaintedWorldSchema` build a painterly level's fog (a colour ramp over a painted heading LUT under the engine's panorama tint), painted air, painted ground and grass from rows, beside its post-graph look, once a page per slug; its world wiring reads the same parts by slug. No shard nouns, callbacks or selectors; each part's own host admits its row. Client-only; Nalati is the first level; tests 2-6 in `test/painted-world.test.ts` (a moor fixture).
- G571 (Jake, 2026-10-21): hosts added to convert Pine Hollow's and Driftwood Isle's remaining custom code into data or AssemblyScript count as platform from day one (test 1 waived) when they pass tests 2–6; each is listed here by name when it lands. `game/shardfile/entryOwners` holds concrete construction/entered loans by finite owner kind and data id (client-only; tests 2–6 pass); it accepts no shard callbacks or reflected paths.
- G571 quest continuation: `game/quest/continuation` consumes format/questContinuation rows and concrete entered quest/collection loans, binds the native item effects and keepsakes before loot, and keeps each original save and specimen owner. Client-only; no shard factory or reflected path. Test 1 waived; tests 2–6 covered by `test/quest-continuation.test.ts`, including leaving during both awaited reads.
- G571 page-mode policy: `game/shard/pagePolicy` `pageModeValue` and `pageModeCap` read two declared JSON rows at the existing page-mode boundary, with no callback, selector path, clock or side effect. Pine boot and keyed sky use standalone/grid rows; caps retain the authored input ceiling. Test 1 waived; tests 2–6 covered by `test/page-mode-policy.test.ts`.
- G571 keyed-sky look: `game/looks/keyedSky` `keyedSkyRender` builds a shard's look (the engine chain under its keyed day / night sky) from the manifest's declared `render: { platform: 'keyed', channels, looks, trim, trimRow }` rows: the look/keyed-sky section, its dome / env look ids and a page-policy trim row (packed keys, small environment). No shard module, callback or selector. Client-only (a look). Test 1 waived; tests 2-6: no shard nouns, rows only, server-safe by being client presentation, deletes with its binding, data-only API (`test/product-in-look.test.ts`).
- G571 herd shelter: `game/population/shelter` `HerdShelter` and `installNativeHerdShelter` retain live herd ownership and the v1 herd-order continuation. Admitted stateless return projections decide wet/dry, hold expiry and goals at ten Hz; rows name roster, environment, weather and step. No shard callback, clock or durable script owner. Server-safe; test 1 waived; tests 2–6 covered by `test/pine-herd-shelter.test.ts` and `test/population-platform.test.ts`.
- G571 grouped page actors: `game/population/pageGroups#PageActorGroups`, `game/population/pageGroups#Placement` and `game/population/pageGroups#Counts` binds declared placements and an admitted return guest to the existing client animal manager. The guest owns refill timing/range/hidden-corpse decisions at ten Hz; the host retains ordered identity, counts and scope retirement. Client-only; no shard callback or selector. Test 1 waived; tests 2–6 covered by `test/population-projection.test.ts` and `test/native-roster-returns.test.ts`.
- G478 riding presentation: `game/riding/mount` consumes profile rows and actor identities (fixture second shard).
- G478 riding HUD: `game/riding/hud` consumes observation rows and retains the baseline HUD slots (fixture second shard).

- `engine/world/waterSurface.ts` (Pine's water body) stays in the engine until `pine-hollow-legacy` is deleted
  (SHARD-PLATFORM-NEXT N5) and moves to Pine in that commit (G500); the sealed legacy copy cannot import primary Pine.

- G520 X20: Pine's reversible beaver-pool wet-bed projection is listed
  client-only view code in `src/shards/pine-hollow/world/poolSurface.ts`.
  Its transition schema and per-frame geometry updates have no second shard;
  they are removed from the shared water surface and count to Pine C2.

- G571 ranged page preparation: `game/loadout/rangedPage#prepareRangedPage` consumes admitted finish/collection source ids and ranged-page rows in the entered world phase. Existing equipment, inventory, geometry and menu owners stay authoritative. Client-only; tests 2–6 covered by `test/ranged-entry-capability.test.ts`; test 1 waived.
- G571 creature install: `game/population/productCreatures#installProductCreatures` and `game/population/productCreatures#lentGraphLook` install a product's creatures from its declared install rows (actors/creature-install.json: perch poses, practice spawn, packed and hull-book look kinds, lent graph bodies, projection) and wear each look on its lent graph body. No shard callback or selector; client-only. Test 1 waived; tests 2–6 covered by test/driftwood-creature-look.test.ts.
- G571 vertex wear: `game/looks/vertexWear#loadVertexWear`, `game/looks/vertexWear#wearBakedTiles`, `format/vertexWear#VertexWearSchema`. Client-only.
- G571 fixed draws: `game/models/fixedDraws#fixedDraws`, `format/fixedDraws#FixedDrawRowsSchema`. Client-only.
- G571 world assembly: `game/shardfile/worldAssembly#WorldAssembly`, `game/shardfile/worldAssembly#WorldAssemblyPorts`, `format/worldAssembly#WorldAssemblySchema`, `format/worldAssembly#WorldAssemblyStageSchema`. `game/shardfile/worldAssembly#admitted`, `game/shardfile/worldAssembly#loanKinds`. Client-only; finite rope-deck placement and later rope-chain allocation borrow original draws/physics/fixed registration, preserve construction loans, and never select an authored callback or pose phase. Test 1 waived; tests 2–6 covered by native handles/snapshot/floor parity, ordered capture, duplicate-placement admission and retirement in test/world-assembly.test.ts and test/driftwood-bridge-facts.test.ts. `format/buildings#BuildingCloudPoseSchema`. Site life reuses the original loaded draw library, scene resources and product reader after the existing site slice; its finite pose descriptor creates the same cloud before the life read, with owner/retirement fences and no extra clock or progress tick. Tested against the original cold/hot shrine path in test/world-site-life.test.ts. Ambient-flock construction uses the existing fixed-draw library, lent material clone, declared perches and original scene root, publishing concrete original owners; the separate entered ambient-life capability remains the only updater. Native flock/draw parity and retire/preflight checks live in test/world-ambient-stage.test.ts. Streamed-cover construction reuses original pre-read cells, scene/draw/look identities and the native viewer/update receiver, with finite placement/object bindings and retirement fences; no second cell intake or renderer. Oracle and authority checks: test/world-cover-stage.test.ts.

- G570/G571 versioned script kernels: `engine/script/moduleV2#ScriptModuleV2`,
  `engine/script/simBatchV2#SimBatchV2`, `engine/script/queriesV2#QueryRingV2`
  `engine/script/queriesV2#answerV2QueryBatch` and
  `engine/physics/queryBatchV2#resolvePhysicsQueriesV2` consume admitted Wasm and
  fixed-capacity identity/observation rows. Server-safe; trusted native owner
  ports validate transactions and lend physics/navigation, never shard JS
  callbacks. Test 1 waived; tests 2–6 covered by the script-v2 admission,
  reset, observation, batch and query suites. Shipped v0/v1 paths remain
  separate until H13; no shard policy gains credit from this listing.
- G571 derived species: `game/looks/speciesBook#HullLookBook` `registerDerived` registers each `derived` row of an admitted hull look book (format/speciesLooks HullLookBookSchema): a book definition's fields under the row's own fields, coat and custom limb rig (rest bones, hit volumes, limb rig / blend / clip rows), with the named game rules think `external` (an owning fight drives it) and damage `roamingBoss`. Pine's Antler King is the first row.
- G571 rope deck view: `engine/physics/ropeChain#RopeDeckView` poses a rope deck's holders (one per RopeChain segment, in the deck's own space) from the chain at the fixed-step alpha, or at rest, and answers the deck's live height along its span from the joint heights; Driftwood's rope bridge is the first deck.
- G571 rope deck: `engine/physics/ropeChain#RopeDeck` builds a rope deck from its rest segments (one holder bone per segment and the posts' anchor, a skinned deck draw bound at rest), gives its RopeChain spec with the holders as hit owners and answers its floor over the span through RopeDeckView; Driftwood's rope bridge is the first deck.
- G571 quest page views: `game/quest/questPageViews#QuestPageViews` presents a quest page per frame from its story file's view rows over the entered quest and quest-spawn loans: the chapter lead and spawns with their puff domes, a flag-driven living-building speed, a throttled spine projection a compendium-complete achievement and a flag-lowered water surface. Pine Hollow is the first page.
- G571 water level transition: `game/systems/looks/waterSurface#WaterSurface` setLowered / reveal ease a surface between the full and lowered levels of its row's finite transition (the format/water WaterSurfaceSchema transition) and report the eased level and its companion reveal; the owner lends them to the look and the declared water body. Pine's beaver pool is the first transition.
- G571 island library: `game/models/islandLibrary#IslandLibrary` takes a shard's declared Blender island library (`IslandLibrarySchema`: product, the custom section field of its fixed draw rows, the groups file, the figure catalogue and collection slots), admits or opens the product, loads every slot once (the world's whole-geometry assembly, named blobs or the product files) and lends inert slot handles, the groups, the loaded library, the figure catalogue and the collection cards; Driftwood's 90-slot library is the first (G586).
- G600 view programs (Jake's L7 pick): `engine/script/viewProgram#viewProgram`, `game/shardfile/clientViewProgram#installViewProgram`, `format/viewProgram#ViewProgramSchema`. A v2 view module (SCRIPT-ABI v2 lane 3) and its rows: binding samples (player position or speed, a registry piece's floor under the player, constants), channel targets (additive camera offsets, lent look parameters, a lent object's visibility, opacity or shader uniform, one instanced copy's attribute) and transform targets (lent objects, named bones under them, single instanced copies; all restored on leave), with the lane's budget and matrix bounds. No shard nouns, callbacks or reflected paths; client-only. Driftwood's rope-deck sway is the first program, Nalati's views next. Tests 2-6: test/driftwood-bridge-sway.test.ts (exact original camera sample and floor membership), test/client-plan-platform.test.ts (owner fencing, admitted module, row refusal), test/view-program.test.ts (object, bone and instanced-copy targets, look/visibility/opacity/uniform/attribute channels, all restored; absent piece).
- G600 aim ribbon (Jake's L7b pick): `engine/combat/view/projectedTrail#ProjectedTrail` draws a camera-facing prediction ribbon over the caller's points (an aimed throw's arc) from strict rows (`format/clientTrails#ProjectedTrailSchema`: point count, widths, lifetime, fade, colour, order); the caller lends its scene and camera. No shard nouns or callbacks; client-only. Nalati's Golden Bow is its first user. Tests 2-6: test/projected-trail.test.ts (an unrelated ribbon's padding and fade, the bow's declared topology).
- G571 rope deck site: `game/models/ropeDeckSite#RopeDeckSite` `game/models/ropeDeckSite#RopeDeckLayout` make a walkable rope deck site model from strict rows (its card, the baked rest plans of its spans, the specimen span, the skinned deck draw slots, the deck's bounds, owner, margin and registry piece): rest facts admitted against the live ground, the engine's RopeDeck on a borrowed fixed draw, colliders from the rest plan, a placement whose piece answers the live floor; Driftwood's rope bridge is the first site.
- G571 boss creature card: `game/models/socketRigCreature#SocketRigCreature` `game/models/socketRigCreature#prepareHullBookKit` make a boss creature's card from strict rows (model card, the hull book's derived species kind, one coat, the socket rig rows file that dresses it) and run the page kit a hull-book product needs before play (derived species, species programs page, hull looks, spawn tables, held equipment, each card's socket rows); Pine's Antler King is the first.
- G571 quest figures: `game/quest/figures#questFigure` `game/quest/figures#fireInFigureFrame` `game/quest/figures#installQuestFigures` build a page's kit figures from its admitted figures file (format/questFigures rows: kit and catalogue rows, composition places, part draws, an unlit flame mesh and a lent-look cloud, publications, pose system), place a trader row as its registry piece with its counter on the floor ahead, while cold Explorer cards use the view-owned kitFigureCard host; Driftwood's castaway and trader are the first figures.

- G571 compiled page ownership: `game/shard/declaredEntry#declaredClientPlanEntry`, `game/shard/declaredEntry#clientPlanNative`, `game/shardfile/hybrid#ClientPlanRuntime`, `game/shardfile/hybrid#preparePageRuntime`, `format/runtime#ClientPlanRuntimeSchema`. Finite client-plan metadata retains actual measured cost, binds and spawns; no authored TS path or arbitrary import registry. Test 1 waived; tests 2–6 cover exact legacy/compiled wire admission, actual output round trips, executable-copy refusal and real retained construction/entered owners in test/client-runtime-declaration.test.ts and test/hybrid-entry-preparation.test.ts.

- G571 world update ownership: `game/shardfile/worldUpdates#installWorldUpdates`, `format/worldUpdates#WorldUpdatesSchema`. Ordered finite native primitive bindings retain the original wind, awake rope interpolation, toon follow and building update systems. Test 1 waived; tests 2–6 preserve actual construction-selected owners, original system/receiver/order/cadence and retirement/reentry; no authored callback, path, new clock or rewritten view law.


- G571 native construction checkpoints: `format/worldAssembly#WorldConstructionSchema` and `game/shardfile/worldAssembly#WorldConstructionPorts` declare finite checkpoints and existing concrete library/world authorities for the already-approved WorldAssembly host. Test 1 waived; tests 2–6 cover one original stage walk, native receivers, exact progress/yields/floor and GPU-root identities, whole-root preflight, retirement fences and strict refusal in test/world-construction.test.ts and the existing native world-assembly suite. No authored callback, path, second intake/cache, update or runtime phase.

The ruler reads exact module or `module#binding` selectors from G571 list
entries and unconditional G599, G600 or G601 entries explicitly tagged
`Jake-approved host:` (an optional row id precedes the tag). Plain or
conditional prose grants no credit, including G599 N1 until its Nalati
condition is fulfilled and its entry explicitly updated. A named binding
never approves other declarations in its file; shared physical lines stay
charged if an unapproved binding occupies them. Imports and dependencies
retain their own attribution.

- G571 quest entry prefix: `game/shardfile/clientQuestComposition#installEntryQuestReference`, `game/shardfile/clientQuestComposition#installEntryRangedPage` and `game/shardfile/clientQuestComposition#installEntryQuestComposition` prepare the entered ranged and named quest owners from finite client-plan rows; `game/quest/chapterDirector#QuestSpawnCapability`, `game/quest/chapterDirector#QuestSpawnResult` and `game/quest/chapterDirector#installDeclaredQuestSpawns` bind the existing AS spawns to exact quest, animal and sound loans. Client-only; no callback row, selector, extra clock or save. Test 1 waived; tests 2–6 covered by `test/quest-spawn-capability.test.ts`, `test/client-plan-platform.test.ts`, `test/ranged-entry-capability.test.ts` and the original quest product/save suites. Unrelated chapter director and guide declarations remain charged.

- G571 inventory reward rows: `game/inventoryLaw#grantNativeInventory` applies declared item/count rows to an existing native pack through its own admission law. No shard branch or authored callback; renderer-free, no new owner, clock or save. Test 1 waived; tests 2–6 pass: generic inventory operation retained without its first user, data-only input, registered-pack refusal, ordered partial grants and slot admission covered by `test/boss-fight-platform.test.ts`.

- G571 entered continuation dispatch: game/quest/continuation#installQuestContinuationFile (inside the module approved above) consumes strict named rows and requires actual completed placement binding before the existing continuation effects. Client-only, no callbacks/extra ids/clock/save. Test 1 waived; tests 2–6 covered by real placement readiness and continuation owner/read-lifetime tests.

- G571 page boot: `game/shard/pageBoot` `pageModeBoot` and `pageModeKtx2` select fully resolved inventories and lazy GPU tables from strict JSON rows for the current page mode on every call. No shard callback, runtime recipe, selector path, service or clock. Server-safe; test 1 waived; tests 2–6 covered by `test/page-mode-boot.test.ts` and the original-recipe parity in `test/pine-runtime-mirrors.test.ts`.

- G571 entered claims: `game/shardfile/heldClaimsEntry#prepareHeldClaimsEntry` and `game/shardfile/heldClaimsEntry#installHeldClaimsEntry` consume finite kit ids and the concrete entered claims loan. Client-only; no callback, reflected path, extra clock or save. Test 1 waived; tests 2–6 covered by actual native claims/lifetime tests and compiled kit admission/order tests.

- G571 quest world facts: `game/shardfile/questWorld#prepareQuestWorldEntry` consumes strict named anchors and an optional concrete ambient loan, refusing expired or changed loans across reads. Client-only; no callback, property selector, extra clock or save. Test 1 waived; tests 2–6 covered by actual fixed-placement parity and entered/resident lifetime tests.

- G571 cold kit card: `game/models/kitFigureCard#kitFigureCard` consumes strict named numeric figure/card rows and an explicit view owner, reusing the fixed-draw loader and existing KitFigure. Test 1 waived; tests 2–6 covered by original castaway geometry snapshots, actual product intake, card retirement and missing-owner refusal. No clock, save or authored callback.

- G571 entered quest figures: `game/quest/pageReference#QuestPageReference` provides the stable entered reader before publication. Test 1 waived; tests 2–6 covered by original live geometry, poses, collisions, resident material lifetime and captured-reader tests. No extra clock/save/author callbacks.

- G571 entered named places: `game/shardfile/clientPlaceSets#bindEnteredClientPlaceSets` consumes finite placement and quest loan ids, preserving actual array order and binding completion. Test 1 waived; tests 2–6 covered by original registry sets, all-owner preflight, duplicate refusal and sliced owner-retirement regressions. No callback, clock or save.

- G571 native bake intake: `game/population/nativeBake#createNativeBakeReader` and `game/population/nativeBake#nativeIntake` consume unknown producer data and strict stock lattice, rig, shape, parked and provenance rows. Test 1 waived; test 2: generic profiles without shard branches; test 3: declared data selects existing validation; test 4: renderer-free with no import-time installation; test 5: reusable native data admission remains useful without its first shard; test 6: JSON-only input, no supplied validator, callback or reflected selector. Tests 2–6 covered by native-bake-reader and headless-assembly refusal, complete-field, buffer-ownership and memoization tests, plus unchanged Pine/Driftwood native save envelopes. Unrelated declarations and dependencies remain charged.

- G571 bundled quest data: `format/questWorld#parseQuestWorldDocument` `format/questFigures#parseQuestFiguresDocument` `format/questContinuation#parseQuestContinuationDocument` read only their fixed admitted entry-resource field or original standalone rows. Tests 2–6 retain strict field admission, plain JSON, original values and owner/refusal behavior; no authored selectors, callback, clock or save.

- G571 declared biome queries: `game/shard/manifest#declaredForestQueries` and `game/shard/manifest#declaredPondClip` consume generated candidate-answer and pond-cell clip rows at existing manifest bindings. Test 1 waived; test 2: generic coordinates/species and no shard branches; test 3: the declared rows supply every answer and boundary; test 4: renderer-free admission with no import-time installation; test 5: candidate lookups and grid-cell membership remain useful without their first shard; test 6: unknown JSON admitted by fixed schemas, no supplied callbacks or reflected paths. Tests 2–6 covered by test/declared-biome-queries.test.ts (data answers, missing candidates, non-finite/executable refusal, listed cells only, grid bounds), with original Pine candidate/pond parity in test/fixed-boot-layout-data.test.ts. No other manifest binding gains credit.

## Still owed

- Still owed (G481): every host in `src/engine` and `src/game`, the plugin system, and the G473–G478 features as they
  land.
- G474 boss arenas: `game/boss/arenaRoom` consumes room, effect, floor and scene rows; `game/boss/arenaFire` consumes mesh capacity, graph ids and smoke tuning rows. Both are client-only presentation, with a second-shard vault/fire fixture in `test/boss-arena-room.test.ts`. `arenaFire` also draws an arena field's burning cells and scorch and the whirlwinds' funnels and debris (reed marsh and quarry fixtures in `test/arena-fire-field.test.ts`). `game/boss/encounterView` draws slot and patrol encounters from view rows (cues, wedge tells, looks, figures, arrows, target spheres) over existing AS and `ProjectedState`; client-only, Nalati-only 4/6 and charged C4, never imported by renderer-free hosts, with alternate-data orchard fixtures in `test/slot-encounter-view.test.ts` and `test/patrol-encounter-view.test.ts`.

- G478 grapple traversal: `game/grapple/sim`, `game/grapple/course`, `game/grapple/headless`, `game/grapple/tool`, and `game/grapple/ribbon` consume course/profile rows; client presentation is labelled.
- G478 practice courses: `game/practice/course` `PracticeCourse` shares the native room lifecycle between Nalati riding and Nine grapple rows (6/6). Both also drive the common NumericCourse presenter and commons AS course source through ABI1/ReturnProgram. The thin mounted and grapple body controllers remain individually charged; no sole-user body or drawing owner gains credit.

- G520 numeric projection continuation: `game/population/returnProgram`
  `ProjectedState` is renderer-free and data-only (6/6), used live by Nalati's
  arena clocks and Nine's grapple practice course. It retains guest channels
  and samples at ten Hz; neither arena grids nor actor-roster code gains credit.

- G478 stealth: `game/stealth/controller` consumes detection observations and ABI-v1 program rows; `StealthDetection` is server-safe and `StealthController` is client-only baseline HUD presentation.

- G475 held weapons: `game/weapons/heldPolearm`, `game/weapons/mountedBlade`, `game/weapons/arcPower` and `game/weapons/heldDecision` consume `format/heldMelee` schemas for admitted model, pose, contact and ABI-v1 guest rows. Native presentation is client-only; `heldDecision` is renderer-free. An unrelated orchard weapon fixture drives the same projection runner in `test/held-weapon-laws.test.ts`.

- G478 walk-in portal rides: `game/shardfile/walkInPortalRide` consumes portal links, trigger/fade rows and feet observations, returning hold/transfer commands and a veil amount. Renderer-free; a made-up orchard shard drives the same host in `test/nine-traversal-data.test.ts`. `game/shardfile/portalRideBinding` binds it to a player: the page's veil panel and update step, the renderer-free host's fixed step with continuation, and the facts a declared landing reports; the orchard drives that too.
- G478 painterly look host: `game/looks/paintedLook` (Sky and Signal's painted looks, and painted air: cloud shadows from tile, cover and drift rows) and `game/looks/painterlyLook` (a level that paints its own world: the painted ground from surface, tile, material, colour-graph, shape and recipe rows). Client-only; a moor and a reed marsh drive them in `test/painted-air.test.ts` and `test/painted-ground.test.ts`.
- G478 audio patches: `game/audio/voicePatches` consumes voice, bed, scheduler and layer rows; client-only presentation, with an unrelated cavern fixture in `test/audio-voice-patches.test.ts`.
- G478 audio scenes: `game/audio/sceneDirector` consumes zone probes, surface maps, event cues, bed controls and score observations; client-only presentation.

- G478 grass fields: `game/looks/grassPresentation` consumes admitted field rasters, bounded ring buffers and mood rows; client-only presentation. `format/fieldPresentation` validates its profile and the G475 static capture rows.
- G478 painterly panorama fog: `engine/world/Atmosphere` `ColourRampFog` with a `panorama` (heading LUT, aerial haze, edge haze, live tint; `render/nodes/engineFog` its node twin) consumes borrowed live values only; client-only presentation. Nalati is the first user; an unrelated painted dusk desert fixture drives both paths in `test/graph-ramp-fog.test.ts`.
- G478 merged figure groups: `game/systems/npc/figureRows` `enterFigureGroup` and `figureSkins` `atlasFigureSkin` consume `format/figures` `FigureGroupSchema` / `FigureAtlasSchema` rows and admitted channel programs; client-only presentation. Nalati's camp is the first user; an unrelated harbour fixture in `test/figure-group.test.ts`.
- G475 static captures: `game/looks/staticCapture` consumes bounds, quality and pass-program rows; client-only shadow/contact presentation.
- G475 scatter projection: `engine/render/scatterInstances` consumes numeric pose, colour and range rows; client-only culling, shared with an unrelated orchard fixture.
- G474 wing projection: `game/ambient/wingField` consumes ambient group, palette and paired-wing rows; client-only projection of the existing 10 Hz ambient host.

- G474 loadout finishes: `game/loadout/cosmeticFinishes` and `game/shardfile/clientCosmeticFinishes` consume skin-card, grant, save and held-finish rows; client-only cosmetic presentation, with an unrelated orchard fixture.
- G483 declared runtime entry: `game/shardfile/clientWaterSurfaces` consumes geometry and water-profile rows; `game/shardfile/clientPlaceSets` consumes named group and spatial membership rows. Client-only setup, with unrelated orchard fixtures.

- G532 (4) baked tiles: `game/shardfile/bakedTiles` (the `world.baked` client feature, `format/bakedTiles` rows) draws a Blender tile set in one look, lends it its offline lightmaps (`engine/render/lightmaps`: a graph look's lent params, or a standard surface's AO and bounce maps) and places its prototype families instanced with their collider boxes. Client-only presentation; Driftwood's cove (tiles, lightmaps, families) and Blender Template's ground (tiles, lightmaps) drive it, 6 / 6 with the families part one-user until a second shard places Blender prototypes.
- G483 world scene assembly: `game/shardfile/sceneDressing` and `game/shardfile/sceneInstances` consume admitted geometry, material, scatter, private-scene and numeric pose rows; client-only presentation. The unrelated orchard fixture constructs, updates and retires these projections.

- G483 declared page preparation: `game/shardfile/pageWater` binds admitted texture slots and look ids to the native pond; `game/shardfile/pagePreparation` binds generated terrain openings and native path ramps. Both are client-only setup, with data-only entry points and orchard coverage in `test/page-preparation.test.ts`. Chapter script-memory preparation belongs to `game/quest/chapterDirector.readChapterDirector`, immediately around its actual clock construction.

- `game/riding/physics`: G478 riding physics binds admitted reins, gait and road observations to native movement.
- `game/riding/taming`: G478 taming sessions evaluate declared approach, breaking and riding guests over candidate observations.
- `game/riding/native`: G478 mounted-player rows bind native player, herd and mount owners with saved continuation.
- `game/riding/roster`: G478 bonded-mount rows own admitted spawn identities, recipes and upgrades in the native roster.
- `game/riding/presentation`: G478 numeric riding envelopes pose borrowed rig joints from admitted measurements.
- `game/riding/nativeTaming`: G478 native taming rows bind the actual player, candidates and decision guests.
- `game/riding/client`: G478 client riding rows bind entered herds, taming, actions and presentation to native services.
- `game/riding/nativePopulation`: G478 native population rows bind boot recipes, hunting, pasture and mount state to the native host.

## Listed view register (G570)

[The per-shard register](../lint/listed-view-code.json) names reviewed source
files or top-level declarations, their reason to remain view code and the
applicable G decision. Mixed modules list only their view declarations; imports
and other decisions remain unlisted. A removed or uncharged registration reports
no listed lines. Whole-file and named registrations cannot overlap.

The ruler reports **listed view + other custom = total custom** for both source
and built-output inventories. Listed view remains in the existing custom total,
percentage, component counts, M3 and gates. The label grants no host credit and
supplies no second user. New registrations require the same source review as
the rest of this document; filenames or a client-only label alone are insufficient.
- G571 native body scripts: `game/quest/nativeBodyScripts` installs admitted sim body rows and their AS decisions through the finite `native.body-scripts` top-level headless capability. Real static ground admission precedes installation; body post/decision/pre and quest-envelope continuation retain their original native owners and adapter ids. Renderer-free; no authored callbacks or reflected ports. Test 1 waived; tests 2–6 covered by `test/headless-assembly.test.ts` and `test/driftwood-barrel-saves.test.ts`, including refused unready hosts, old-save adoption and byte-identical snapshots.
- G571 forest page features: `game/shardfile/clientForestPage` hosts the client-plan kinds world.forest-page, weather.forest and page.life over a shard's admitted forest page, cave interior, weather and page-life files: the page and its optional cave at an inline page-mode cap, the cave's spots on a declared ranged page, the weather, and the ambient life. Rows name product files and ids only; no shard module, callback or selector. Client-only; test 1 waived (Pine Hollow converts its world/play plugin and landmarks runtime); tests 2-6 covered by forest-page-features (inline caps, refusal of a module cap, the old construction order) and Pine's first frame.

- G571 world owner bindings: `game/shardfile/clientRuntimeHooks#installClientRuntimeHooks` and `game/shardfile/clientMoverOwners#installClientMoverOwners` bind concrete construction-owned floor, scene and chain loans after world construction and before the shell captures hooks. The mover host retains its original fixed-step/save ownership and computes only the declared fixed-pose moor vec2 after publishing a pose. Tests 2–6 cover exact loan identity, complete preflight, refusal during retirement, borrowed group cleanup, original equation/rest/restore parity, and native/regional/data stage order. No authored callback, path or extra clock.
- G571 entered ambient life: `game/shardfile/clientAmbientLife#installClientAmbientLife` resolves the original resident flock draws before reading admitted rows and rechecks their scope and identity after reads; the existing page-life owner retains updates and cues. No second flock or draw cache.

- G571 view module admission: `format/scriptContract#ScriptV2ContractSchema` `format/scriptContract#ViewModuleSchema` `format/scriptContract#ViewModulesSchema` and `format/scriptContract#ViewModuleRow` declare fixed ABI2 view bytes independently of execution. Tests 2–6 cover finite JSON admission, exact paths and revisions, named/disk/browser/worker transport, fixed memory accounting and refusal without declarations. No authored validator, callback, extra clock or save; the bridge view is the first production user.

- G571 concrete gameplay audio: `game/plugin/audio#installRuntimeGameplayAudio` consumes typed floor-query groups, the original building controller and emitter object, detached numeric probe bounds and ordered near points. Client-only, no world adapter, new owner/path resolver, clock or save. Test 1 waived; tests 2–6 covered by original cue/order parity, intentional floor gaps, concrete loan identity, ancestry/retirement refusal and teardown in test/declared-audio-gameplay.test.ts and test/declared-audio-ambience.test.ts. Legacy environment conflicts refuse before effects.

- G571 entered audio loans: `game/audio/sceneDirector#gameplayAudioEnvironment` and `format/audio#AudioEntryEnvironmentSchema` resolve finite floor/object/building ids and detached numeric spatial facts before the existing entered audio phase. Test 1 waived; tests 2–6 cover bounded JSON and refusal of reflected/callable rows, original construction loans, exact tier order and floor gaps, missing/retired owner refusal before effects and original cue/teardown parity. No new world adapter, scheduler or continuation. Tests: test/audio-entry-environment.test.ts, test/driftwood-audio-environment.test.ts and the existing declared-audio gameplay/ambience suites.

- G571 quest view entry: `game/shardfile/clientQuestComposition#installEntryQuestViews` dispatches admitted view rows to the existing quest presentation owner at its fixed entered-play boundary. Test 1 waived; tests 2–6 cover finite JSON/file admission, phase order, actual host dispatch and leave/ancestor-retirement refusal. No authored callback, clock or save owner; presentation remains in its existing host.

- G571 declared hull-book kit: `game/models/socketRigCreature#declaredSocketRigCreatures`, `game/models/socketRigCreature#prepareDeclaredHullBookKit`, `format/socketRigCreature#SocketRigCreatureSchema` and `format/socketRigCreature#SocketRigCreatureRows` resolve admitted socket-creature catalogue rows into the existing card and kit owners. Test 1 waived; tests 2–6 cover strict data/refusal, original card metadata and coat, one product identity, kit order and retirement across actual service boundaries. Existing rig and socket presentation are unchanged.

- G571 compiled island owners: `format/islandLibrary#ResolvedIslandLibrarySchema`, `game/shardfile/islandBook#admittedIslandBook`, `game/shardfile/islandBook#preflightIslandBook` and `game/shardfile/clientWorldAssembly#installClientWorldAssembly` admit one resolved library book per product/id and retain its original construction cache, draws, collection catalogue and scene models. Test 1 waived; tests 2–6 cover strict finite data, whole-plan preflight, original stage/owner order, cold/world identity and one intake, retirement/refusal and unchanged native saves. No authored imports, selectors, factories, extra clock or cold fallback library.

- G571 explicit catalogue registration: `format/catalogueEconomy#CatalogueEconomySchema` , `format/catalogueEconomy#CatalogueEconomyRegistrationSchema`, `format/catalogueEconomy#catalogueEconomyRules` and `game/shardfile/clientCatalogue#installClientCatalogue` consume bounded effects/goods data at the original kit phase. Test 1 waived; tests 2–6 cover strict JSON and reference refusal, real ownership admission before any registration, original effect/shop/skin order and exact producer parity. No selector, callback, extra clock, cache or save owner.

- G520 Explorer dispatch re-score (2026-10-22, eeb30486f1):
  `game/models/explorerCatalogue#explorerRoster` and
  `format/explorerCatalogue#ExplorerCatalogueSchema` pass 6/6. Pine Hollow and
  Driftwood Isle both publish ordered admitted product catalogues without a
  native roster fallback. Driftwood resolves its gull, castaway, collections
  and site cards through this dispatcher; its collections and site cards
  borrow the same pinned island book as construction. The API is client-only,
  takes finite rows and ids, has no shard branches or authored callbacks, and
  remains useful if either page disappears. Tests cover both real emitted
  catalogues, original order, cold/world book identity, refusal and retirement.
  Retire only the ProductExplorerDispatch receipt; private geometry intake and
  quest presentation keep their independent charges.

- G571 entered hint and flag binding: `game/quest/hints#installQuestHints`, `game/quest/hints#installQuestHintFile` and `game/quest/chapterBindings#publishChapterFlags` borrow concrete entered hint, population, player, UI and bound chapter owners. Test 1 waived; tests 2–6 cover plain finite rows, original scheduler/control order and sorted flags, missing/retired/replaced owner refusal, original map publication and scoped hook restoration. No authored ports, new state, probe registry, clock or cache.

- G571 explicit entered Bag projection: `game/loot/runtime#enteredLootPresentation`, `format/lootBag#LootPresentationSchema`, `format/lootBag#LootProgressionSchema`, `format/lootBag#LootFindsSchema`, `format/lootBag#LootMarksSchema`, `format/lootBag#lootBagRules` and `format/lootBag#LootBagSchema`. Test 1 waived; tests 2–6 cover finite defining rows, original native ownership and live projection order, reference/OwnedId/JSON/retirement refusal and unchanged native grants/saves. The basic path never selects a rich economy.

- G600 H4 Jake-approved host: `format/scriptActionsV2` and `game/shardfile/worldActionsV2` provide finite ABI-v2 dismount, ignite and impulse commands over explicit scoped native owners. No shard nouns or callbacks in authored rows; target handles, quotas, operand bounds and reserved words are admitted before effects. Server-safe, no new clock, registry, body or save owner. Scores 2-6: 1/1/1/1/1; test/script-v2-world-actions.test.ts and test/native-riding.test.ts cover real compiled AS, whole-bank refusal, concrete native impulse/dismount parity, ordered effects and ancestor retirement. Pick: G600 H4 commands, prioritized by G604.

- G600 L3 Jake-approved host: `game/systems/cellField` and `format/cellField` own bounded cell storage, addressing, delayed generations and ten-Hz sampling over explicit state/channel/signal rows and an admitted AS guest. AS decides activation, propagation, lifetime and contact policy; no fire, weather, arena or shard noun in the host. Server-safe, no new scheduler, body or save owner. Scores 2-6: 1/1/1/1/1; test/cell-field.test.ts covers an independently compiled irrigation law, frozen-original Titan/RNG/contact differential, JSON/getter/ambiguous-binding refusal, detached rows and SAME-owner H4 activation. Native boundary and renderer adapters remain outside this approval. Pick: G600 L3.

- G601 C3 Jake-approved host: `engine/world/scalarChannel#readScalarChannel` and `format/scalarChannel#ScalarChannelSchema` decode bounded finite f32/f64 rows without conversion or interpolation. Nalati's raster samplers and Pine's exact ordered forest candidates are real users; no shard nouns, callbacks, cache or new owner. Scores 2-6: 1/1/1/1/1; test/scalar-channel.test.ts and test/fixed-boot-layout-data.test.ts cover plain JSON/size/finite refusal, native typed bytes and signed zero, old sampling/lookup order, both caller families and independent decoded storage. Pick: G601 C3; Pine payload bytes and zero census remain pinned; defining schema changes refresh only the validator metadata.

- G601 C3 Jake-approved host: `game/shard/manifest#declaredGround`, `format/terrain#GroundRowsSchema` and `engine/world/water/body#basinBody` bind an optional finite f32 pond lattice and an ordered ground-only basin row to the same concrete terrain. The existing ground host has Pine and Nalati callers; the new terrain-basin row's first user is Nalati, as picked in G601 C3. Authored rows contain no callbacks, sampler policy, renderer, cache or collider owner. Scores 2-6: 1/1/1/1/1; test/declared-ground-mask.test.ts covers independent native fields, detached inputs, strict preflight and getter refusal, exact clamped/live-level behavior, original stream/body order and actual Nalati metadata/native admission; test/nalati-headless-assembly.test.ts retains save/restore and taming continuation.

- G601 C10 Jake-approved host: `game/systems/viewmodel/heldView#HeldView` over `format/heldView#HeldViewSchema` dresses first-person arms on the shared rig player by look kind: `toon` (two blades and swimming hands in toon-family looks following the row's day lighting) and `graph` (graph looks with maps, weave, decals, pendants and the swing trail as rows, and frame-row writes). It replaces graphArms and toonArms (437 lines) with one host (404) sharing the rig contract and bake, look preparation, the sword wrapper and the Explorer settle. Users: Driftwood Isle (toon), Nine Dragon Stack and the template (graph). Rows and ids only, refused before any rig or look is borrowed; client-only presentation. Scores 2-6: 1/1/1/1/1; test/held-arms-platform.test.ts covers both kinds' admission and refusals, toon blades, glow, light follow, independent loans and swimming. Pick: G601 C10.

- G601 C8 Jake-approved host: `game/quest/carriedProp`, `format/questSteps#CarriedQuestSchema`, `format/questSteps#CarriedQuestRows` and `format/questSteps#parseCarriedQuest` implement client-only carry-to-goal rows over a concrete player or mount. The admitted AS guest owns decisions and ordered quest effects; finite rows select carrier and player movement threshold, poses, floors, goals and existing service ids; omitted carrier preserves the legacy mount wire. No shard nouns, callback data, reflected paths, new clock or save owner. Scores 2-6: 1/1/1/1/1; test/carried-quest-host.test.ts covers player delivery, independent construction/entered lifetimes, owner replacement and JSON/refusal boundaries; test/nalati-kokpar.test.ts retains the original 10,000-decision mount/pose/effect differential and an unrelated delivery fixture. Pick: G601 C8.

- G601 C3 Jake-approved host: `engine/physics/heightPatch#HeightPatch` and `engine/physics/heightPatch#HeightPatchOpts` replace a finite height lattice in the supplied physics world; `engine/core/gpuOnly#rebakes` and `engine/core/gpuOnly#onGpuRestored` retain the existing resource-scoped restore event. These are existing engine primitives, not terrain policy or a new shard adapter. HeightPatch currently has one content user; its engine-feature treatment and removal of GPU-restore attribution are Jake's explicit C3 pick. Scores 2-6: 1/1/1/1/1; test/terrain-primitives.test.ts covers native orientation/translation/surface ownership, replacement/flat removal, independent worlds and independent callback retirement. No runtime source, collider recipe, cadence or save payload changes.

- G601 C3 Jake-approved host: `engine/world/scalarChannel#readScalarLattice` and `format/scalarChannel#ScalarLatticeSchema` bind explicit bounded square f32 rows to the existing bakedSamplers law, with one decode and no conversion, array copy, owner or cache. Nalati declares its raster metadata as data; GroundRows.mask reuses the same grammar. The shared decoder's Pine f64 exact-index user remains unchanged. Scores 2-6: 1/1/1/1/1; test/scalar-lattice.test.ts covers strict metadata/accessor/storage refusals, edge and signed-zero sampling, independent storage and real Nalati data parity; existing scalar-channel and declared-ground-mask tests retain both consumer laws. Pick: G601 C3, the thin channel reader rather than an aggregate terrain host.

- G601 C11 Jake-approved host: `game/practice/course#CourseController`, `format/practiceCourseRows#PracticeControllerSchema`, `format/practiceCourseRows#PracticeControllerRows` and `format/practiceCourseRows#parsePracticeController` merge the two real course presenters over finite room, mounted/grapple entry and lap/checkpoint display rows. The common NumericCourse and commons AS source retain run law/cadence; native body/tool adapters remain separately charged. Scores 2-6: 1/1/1/1/1; test/practice-controller-rows.test.ts covers strict finite/admitted rows, unrelated content and accessor refusal; test/riding-platform.test.ts and test/grapple-platform.test.ts compare the frozen original presenter against the shared controller, including native entry, fall/reset, HUD and clock order; test/course-differential.test.ts retains the independent AS-law differential. Pick: G601 C11 / N6b.
