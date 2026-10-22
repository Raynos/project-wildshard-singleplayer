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
- G571 (Jake, 2026-10-21): hosts added to convert Pine Hollow's and Driftwood Isle's remaining custom code into data or AssemblyScript count as platform from day one (test 1 waived) when they pass tests 2–6; each is listed here by name when it lands. `game/shardfile/entryOwners` holds concrete construction/entered loans by finite owner kind and data id (client-only; tests 2–6 pass); it accepts no shard callbacks or reflected paths.
- G571 quest continuation: `game/quest/continuation` consumes `format/questContinuation` rows and concrete entered quest/collection loans, binds the native item effects and keepsakes before loot, and keeps each original save and specimen owner. Client-only; no shard factory or reflected path. Test 1 waived; tests 2–6 covered by `test/quest-continuation.test.ts`, including leaving during both awaited reads.
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
- G571 creature install: `game/population/productCreatures#installProductCreatures` and `game/population/productCreatures#lentGraphLook` install a product's creatures from its declared install rows (actors/creature-install.json: perch poses, practice spawn, packed and hull-book look kinds, lent graph bodies, projection) and wear each look on its lent graph body. No shard callback or selector; client-only. Test 1 waived; tests 2–6 covered by test/driftwood-creature-look.test.ts.
- G571 vertex wear: `game/looks/vertexWear#loadVertexWear`, `format/vertexWear#VertexWearSchema`. Client-only.
- G571 fixed draws: `game/models/fixedDraws#fixedDraws`, `game/models/fixedDraws#FixedDrawRowsSchema`. Client-only.
- G571 world assembly: `game/shardfile/worldAssembly#WorldAssembly`, `game/shardfile/worldAssembly#WorldAssemblyPorts`, `format/worldAssembly#WorldAssemblySchema`, `format/worldAssembly#WorldAssemblyStageSchema`. Client-only.

- G570/G571 versioned script kernels: `engine/script/moduleV2#ScriptModuleV2`,
  `engine/script/simBatchV2#SimBatchV2`, `engine/script/queriesV2#QueryRingV2`
  `engine/script/queriesV2#answerV2QueryBatch` and
  `engine/physics/queryBatchV2#resolvePhysicsQueriesV2` consume admitted Wasm and
  fixed-capacity identity/observation rows. Server-safe; trusted native owner
  ports validate transactions and lend physics/navigation, never shard JS
  callbacks. Test 1 waived; tests 2–6 covered by the script-v2 admission,
  reset, observation, batch and query suites. Shipped v0/v1 paths remain
  separate until H13; no shard policy gains credit from this listing.
- G571 derived species: `game/looks/speciesBook#HullLookBook` `registerDerived` registers each `derived` row of an admitted hull look book (`format/speciesLooks` `HullLookBookSchema`): a book definition's fields under the row's own fields, coat and custom limb rig (rest bones, hit volumes, limb rig / blend / clip rows), with the named game rules think `external` (an owning fight drives it) and damage `roamingBoss`. Pine's Antler King is the first row.
- G571 rope deck view: `engine/physics/ropeChain#RopeDeckView` poses a rope deck's holders (one per RopeChain segment, in the deck's own space) from the chain at the fixed-step alpha, or at rest, and answers the deck's live height along its span from the joint heights; Driftwood's rope bridge is the first deck.
- G571 rope deck: `engine/physics/ropeChain#RopeDeck` builds a rope deck from its rest segments (one holder bone per segment and the posts' anchor, a skinned deck draw bound at rest), gives its RopeChain spec with the holders as hit owners and answers its floor over the span through RopeDeckView; Driftwood's rope bridge is the first deck.
- G571 quest page views: `game/quest/questPageViews#QuestPageViews` presents a quest page per frame from its story file's view rows over the entered quest and quest-spawn loans: the chapter lead and spawns with their puff domes, a flag-driven living-building speed, a throttled spine projection a compendium-complete achievement and a flag-lowered water surface. Pine Hollow is the first page.
- G571 water level transition: `game/systems/looks/waterSurface#WaterSurface` setLowered / reveal ease a surface between the full and lowered levels of its row's finite transition (`format/water` WaterSurfaceSchema transition) and report the eased level and its companion reveal; the owner lends them to the look and the declared water body. Pine's beaver pool is the first transition.

The ruler reads exact module or `module#binding` selectors from the G571
list entries above. A named binding never approves other declarations in its
file; shared physical lines stay charged if an unapproved binding occupies
them. Ordinary prose, other decisions and unnamed one-user hosts grant no
G571 credit. Imports and dependencies retain their own attribution.

- G571 quest entry prefix: `game/shardfile/clientQuestComposition` prepares the entered ranged and named quest owners from finite client-plan rows; `game/quest/chapterDirector#QuestSpawnCapability`, `game/quest/chapterDirector#QuestSpawnResult` and `game/quest/chapterDirector#installDeclaredQuestSpawns` bind the existing AS spawns to exact quest, animal and sound loans. Client-only; no callback row, selector, extra clock or save. Test 1 waived; tests 2–6 covered by `test/quest-spawn-capability.test.ts`, `test/client-plan-platform.test.ts`, `test/ranged-entry-capability.test.ts` and the original quest product/save suites. Unrelated chapter director and guide declarations remain charged.

- G571 inventory reward rows: `game/inventoryLaw#grantNativeInventory` applies declared item/count rows to an existing native pack through its own admission law. No shard branch or authored callback; renderer-free, no new owner, clock or save. Test 1 waived; tests 2–6 pass: generic inventory operation retained without its first user, data-only input, registered-pack refusal, ordered partial grants and slot admission covered by `test/boss-fight-platform.test.ts`.

- G571 entered continuation dispatch: game/quest/continuation#installQuestContinuationFile (inside the module approved above) consumes strict named rows and requires actual completed placement binding before the existing continuation effects. Client-only, no callbacks/extra ids/clock/save. Test 1 waived; tests 2–6 covered by real placement readiness and continuation owner/read-lifetime tests.

## Still owed

- Still owed (G481): every host in `src/engine` and `src/game`, the plugin system, and the G473–G478 features as they
  land.
- G474 boss arenas: `game/boss/arenaRoom` consumes room, effect, floor and scene rows; `game/boss/arenaFire` consumes mesh capacity, graph ids and smoke tuning rows. Both are client-only presentation, with a second-shard vault/fire fixture in `test/boss-arena-room.test.ts`. `arenaFire` also draws an arena field's burning cells and scorch and the whirlwinds' funnels and debris (reed marsh and quarry fixtures in `test/arena-fire-field.test.ts`). `game/boss/encounterView` draws slot and patrol encounters from view rows (cues, wedge tells, looks, figures, arrows, target spheres) over existing AS and `ProjectedState`; client-only, Nalati-only 4/6 and charged C4, never imported by renderer-free hosts, with alternate-data orchard fixtures in `test/slot-encounter-view.test.ts` and `test/patrol-encounter-view.test.ts`.

- G478 grapple traversal: `game/grapple/sim`, `game/grapple/course`, `game/grapple/headless`, `game/grapple/tool`, and `game/grapple/ribbon` consume course/profile rows; client presentation is labelled.
- G478 practice courses: `game/practice/course` `PracticeCourse` shares the native room lifecycle between Nalati riding and Nine grapple rows (6/6). Its mounted and grapple controllers remain individually charged to their actual shard; the shared dispatcher grants no second user to those laws.

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
