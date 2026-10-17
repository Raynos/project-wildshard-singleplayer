# Driftwood Isle under 20 %: the no-AssemblyScript mini plan

Read-only planning page for `src/shards/driftwood-isle/`, made on 2026-10-17 on top of the ruler at `93a250445`:
**6,771 custom lines against 17,167 legacy lines, so 39.4 %**. The 20 % goal is at most 3,433 lines, so **at least
3,338 lines have to go**. The sibling plan covers Pine.

## Verdict

**No, Driftwood cannot reliably get under 20 % without AssemblyScript.**

- The easy and medium wins below (data, generators, section schemas, specimen-catalogue rows and baked world rows, all
  on hosts that already exist) cut **about 2,430 lines**. That takes Driftwood to **about 4,340 lines, 25.3 %**.
- Three large non-AS shared hosts, each built with a second shard in the same row, would cut about 740 more:
  - the native actor and save ABI, paired with Pine;
  - a streamed-cover host, paired with Nalati's `DressLayer`;
  - held-weapon rows, paired with Pine.

  With those, Driftwood reaches **about 3,600 lines, 21.0 %**. Folding the kill, ecology and strike rules onto declared
  hosts as well could reach about 20.4 %, but no second user has been shown for them yet.
- **Lowest reachable without AS: about 21 % for certain, about 20.4 % at best.** The last points need G470's AS move of
  the single-shard rules: quest, adventure, finale, Spine, keepsakes and the C4 keeper and brains, about 1,970 lines.
  - sp-x7's in-flight quest move (528 lines) plus the easy tier gives about 22.7 %.
  - Adding the keepsake and creature rules gives about 17 %.

## How the lines were counted (reproduced, read-only)

The rule comes from `scripts/shard-platform.mjs` `countOutput(…, sourceProgress=true)`.

**What counts:**
- every `.ts`/`.tsx` under `src/shards/driftwood-isle/`;
- G294 platform declarations that only Driftwood reaches: 474 lines today;
- standalone `.glsl` files: none in Driftwood.

**What does not count:**
- **Excluded paths:** `generators/` (G467), tests, `.d.ts` and `.as` (shown separately: 96 lines).
- **Thin entries:** a declaration-only `shard.config.ts` or `manifest.ts`.
- **Generated outputs:** generation-job outputs, *except* `data/*.ts`, which still counts even when generated.
- **JSON:** never counted.

**The unit:** nonblank lines after the parser removes comments.

**How it was reproduced:**
- My own script counted every file at `HEAD` with the ruler's exported `codeLines`. That gives **6,297 shard-folder
  lines in 152 files**, and every file matches the honest-floor table: keeper 299, streamedCover 264, Enemies 234 and so
  on.
- For the 474 platform lines I imported the exported, read-only `sourceProgressInventory` into a scratch script: no CLI,
  no parse cache, nothing written, `git status` unchanged. On the live tree it gave **6,772** (6,298 shard + 474
  platform). The 474 lines are listed by declaration in the appendix.

**Second users** are checked with grep. Where a claim is unverified the table says *verify*.

## Ranked table (cheapest first; numbers are custom lines)

Effort: S is under half a day, M is one to two lane-days, L is a multi-day host design. "Platform +" is new
engine/game/SDK code; it is free to Driftwood only when a second shard uses it in the same row (G454 (10)).

| # | File or group | Counted | Technique | Est. cut | Effort | Needs | Second user |
|---:|---|---:|---|---:|:-:|---|---|
| 1 | `data/placeholder.ts` | 5 | Delete: nothing imports it | 5 | S | nothing | — |
| 2 | `data/entryWalk.ts`, `data/islandLook.ts`, `data/questStory.ts`, `assets/contracts/shrine.ts` | 14 | Build-only, so move to `generators/` (only generators and tests import them) | 14 | S | nothing | — |
| 3 | `data/trailParams.ts` | 15 | Types only the catalogue generator uses, so move to `generators/` (`models/catalogue.ts` already reads `boot/specimenParams.generated`) | 15 | S | nothing | — |
| 4 | `data/landscapeRows.ts` + `data/wreckSites.ts` | 38 | landscapeRows is read only by generators and wreckSites, so move it to `generators/`; wreckSites becomes JSON | 38 | S | nothing | — |
| 5 | `shard.config.ts` | 49 | Move the body to `generators/product.ts`; `shard.config.ts` becomes `export default product`, which is declaration-only (Sky's precedent) | 49 | S | nothing | — |
| 6 | `budgets.ts` + `data/budgetCeilings.ts` + `data/runtimeCost.ts` | 51 | `data/budgets.json` and `data/runtimeCost.json`. The manifest binding points at the JSON; `scripts/authored-manifest.mjs` needs a 2-line tweak to accept a JSON budget (scripts are not counted) | 51 | S | nothing | — |
| 7 | `data/interactables.ts` + its platform charges `sdk/questGraph.ts` (13) and `quests#compileQuestTable` (13) | 79 | Becomes `generators/interactables.ts`, which emits rows. Runtime readers (`interactLifetime`, `keepsakes`, `adventure`) read the emitted JSON, parsed by `@format/questInteractions`. The 26 platform lines were charged only through a `type` import | 79 | S | nothing | — |
| 8 | `data/skyDay.ts`, `skyPalette.ts`, `facetedDayRows.ts` (preset schema to JSON, types derived from SDK `DayLookPreset`), `coverLook.ts`, `layout.ts`, `seabedLook.ts`, `poolLook.ts`, `islandCoverFiles.ts`, `islandPlanFiles.ts`, `islandClipRows.ts`, `terrainBindings.ts` | 176 | Data written in TS becomes JSON rows | 168 | S | nothing | — |
| 9 | `data/speciesActions.ts`, `strikes.ts` (`strike()` runs at build), `questEvents.ts`*, `entryLandings.ts` (the shardfile already declares `landing.*` props colliders), `entryRows.ts`, `pierRows.ts`, `bridgeRows.ts`, `shrineSites.ts`, `captainEncounter.ts`, `questDeaths.ts`* | 103 | Data written in TS becomes JSON rows | 103 | S | nothing | — |
| 10 | `runtime/sections.ts` | 173 | The custom-section valibot registry moves to `generators/sections.ts`; runtime reads are typed through `import type`. A shipped product never runs these schemas (`shardProduct.ts:112`: `if (schemas === undefined \|\| !check) return value(name)`); only the build (`sdk/outputRuntime.ts`, `bake-section-schemas.mjs`) and tests use them. Also `custom/questRows` becomes a platform quest-inventory section and `custom/gullFlock` a platform flock section (`AmbientFlockSchema` is already format). Keeps the two schemas the runtime parses (`EnemyPlacements`, `FixedGeometryGroups`) | 150 | S–M | platform +~6: a typed custom `section()` read with no schema value, plus the build reading `generators/sections.ts` | Pine `runtime/sections.ts` (88); Pine `custom/questInventory` has the same feats + items shape |
| 11 | `plugin.ts` + `runtime/boot/rows.ts` trims | 33 | A declared hybrid entry from the manifest's `runtimeEntry` replaces the per-shard `standaloneHybridEntry` adapter | 17 | S | platform +~8 | Pine `plugin.ts` (24), Nalati `plugin.ts` (19) |
| 12 | `runtime/models/cargo.ts`, `captainHat.ts`, `entryDeck.ts`, `boat.ts`, `palm.ts`, `hibiscusBush.ts` (Explorer cards) | 202 | Specimen-catalogue rows (`defineSpecimenCatalogue`, data only, no callbacks), as `models/catalogue.ts` already does for trail posts. `captainHatGeometry`/`sailclothCapeGeometry` are generator-only exports | 185 | M | the existing host plus a `fixed` product-draw source and capsule colliders (platform +~20) | host already shared with Nalati `models/catalogue.ts` |
| 13 | `world/rockKit.ts` + `runtime/models/shoreBoulder.ts` + `engine/world/geometryBake.ts` charges (120) | 231 | Bake finished rock copies (faceting and normals at build, in `bake-driftwood-rocks.mjs`); rocks become catalogue packed rows and fixed draws. Dropping `bakedGeometry()` frees 120 platform lines that only Driftwood reaches | 220 | M | existing catalogue packed source; bake script (not counted) | Nalati (catalogue) |
| 14 | `runtime/models/fixedSites.ts`, `runtime/world/Shrine.ts`, `world/Wreck.ts`, `assets/contracts/wreck.ts`, `engine/models/place.ts#placeModelSite` charge (31) | 196 | Fixed sites become declared world-scene and baked-kind rows: draws, material keys, collider rows, floor rects, anchors. Site-kind checks move to build | 145 | M | `game/plugin/ui#createWorldScene` + `game/shardfile/bakedKinds#bakedMeshWorld` (existing); *verify* lent graph-look material ports (platform +~30 if missing) | Sky, Signal (existing host users) |
| 15 | `world/Pier.ts`, `world/pierLayout.ts`, `runtime/models/pier.ts`, `assets/contracts/pier.ts`, `world/Boat.ts`, `runtime/props/mooringLines.ts`, `world/Zipline.ts`, `runtime/models/zipline.ts`, `world/RopeBridge.ts` | 340 | Piers, boat, zipline and bridge become placement rows plus baked floor rects (`floorAtRects`) and collider rows. The boat bob is already a declared mover (`runtime/hybrid.ts`); the cable is the engine `CableTraversal`. Pier contract types move to `generators/` | 230 | M | same hosts as #14 | Sky, Signal |
| 16 | `world/Palms.ts`, `world/Bushes.ts`, `world/Trailside.ts`, `world/Seabed.ts`, `runtime/boot/{palm,hibiscus,reef,foliage,trailside}Geometry.ts`, `runtime/world/Gulls.ts` | 201 | Foliage, reef and trail batches become baked placement rows (`bakedMeshWorld` pieces with boxes); the reef fish are an ambient-flock row | 150 | M | existing hosts | Sky, Signal |
| 17 | `world/Cove.ts`, `runtime/boot/coveGeometry.ts`, `runtime/models/cove.ts`, `runtime/world/Waterfall.ts`, `world/islandDressing.ts`, `world/islandCover.ts`, `world/blenderArea.ts` (+ `engine/world/blenderArea` 8), `world/BlenderIsland.ts`, `world/GroundCover.ts` | 448 | Cove and island become world-scene rows. Bake the dressing pre-clipped (the `fc4508dca` precedent); the plan schema goes to format; cove prototypes become instanced placement rows. BlenderIsland keeps about 90 lines of tier/cull view | 230 | M–L | existing hosts | Sky, Signal |
| 18 | `world/build.ts`, `world/sea.ts`, `world/sites.ts`, `world/places.ts`, `runtime/world/systems.ts`, `world/gpuOnlyCopies.ts`, `boot/bridgeFacts.ts`, sea charges (16: `swellBody`, `seaDamp`, shore, horizon) | 309 | World assembly from the rows that #14–17 land. Place sets become rows on `registerPlaceSets`; `gpuOnlyCopies` becomes a host-side "release static copies" step | 190 | M (after #14–17) | small declared place-set host (platform +~15) | Pine `world/places.ts` (36) uses `registerPlaceSets` |
| 19 | `runtime/boot/blobAssets.ts`, `runtime/index.ts`, `runtime/hybrid.ts`, `runtime/look/render.ts`, `look/dayKeys.ts`, `runtime/look/backdrop.ts` | 241 | The fixed draws become the product model library (`createModelLibrary`, shared by Sky, Nalati, Nine, Pine), with the `custom/assets` exit. The long lent-look lists become "all `look.materials`"; the kit's quest and economy rows come from platform sections; the look strategy becomes a declared look row | 110 | S–M | existing hosts; declared look row (platform +~25) | Sky `look/render.ts` (40), Signal (26) for the look row |
| 20 | `loot/effects.ts`, `loot/presentation.ts`, `loadout/rows.ts` | 117 | A declared effect-grant binder and loot-presentation rows on `selectEffectGrants`, `findsCatalogue` and `Exchange` | 55 | M | platform +~30 | Nalati worn-effect and finds rows (W3; G441 pending entries exist). **Risk:** lands only with Nalati |
| 21 | `species/{crab,sailor,captain,fauna,install,bodies}.ts`, `creatures/rows.ts`, part of `creatures/install.ts`, `runtime/models/creatures.ts`, `game/loot/tables` charge (15) | 192 | Species looks become rows (rig contract, clip JSON, body key, fur, damage rule); `numericCreaturePose` and `creatureBody` are already generic. Loot-table registration folds into the rows host | 95 | M | platform +~30 | Pine `species/looks.ts` (81) uses `numericCreaturePose` |
| 22 | `runtime/npc/Castaway.ts`, `runtime/npc/Trader.ts`, `runtime/npc/people.ts`, `runtime/models/people.ts`, `runtime/models/trader.ts`, `runtime/looks/smokeColumn.ts`, `game/systems/npc/npcRig` charges (43) | 289 | NPC figure rows (H9): the client-scene recipe already exists; facing, head focus and clips are shared; the flame flicker and wave become clip rows | 130 | M | platform +~40 | Pine `runtime/quest/npcModels.ts` (82); Nalati figureRig (W3) |
| | **Easy and medium no-AS total** | | | **≈ 2,429** | | | |

\* `questEvents.ts` and `questDeaths.ts` are being edited by sp-x7 right now: its working tree imports
`data/questEvents.json`. Take these two from its landing and don't redo them. Items 7 and 9 also touch the readers of
sp-x7's files (`quest/adventure.ts`, `quest/interactLifetime.ts`).

### Non-AS stretch (L, a new shared host each)

| # | Group | Counted | Technique | Est. cut | Effort | Second user |
|---:|---|---:|---|---:|:-:|---|
| S1 | `sim/keeper.ts` 299 + `creatures/Enemies.ts` 234 | 533 | Native actor + save ownership ABI: identity, dormant/retired bodies, grouped page lifecycle, versioned envelopes. This is the honest floor's first design | ~350 | L | Pine roster / nightDirector (paired landing), Nalati third |
| S2 | `runtime/looks/streamedCover.ts` | 264 | An SDK streamed-cover rows host over `CellWindow`/`InstanceTier` | ~240 | L | Nalati `world/dressing/layer.ts` (143); the W3 row already exists |
| S3 | `runtime/viewmodel/toonArms.ts` 155, `runtime/fpArms.ts` 20, `runtime/models/gear.ts` 18 | 193 | H3 held-weapon rows: GLB arms, sockets, a material binding row | ~150 | L | Pine lever / crossbow viewmodels |
| | **Stretch total** | | | **≈ 740** | | |

## Running total against the 3,338 target

| After batch | Cut so far | Driftwood lines | % |
|---|---:|---:|---:|
| 1 | 251 | 6,520 | 38.0 |
| 2 | 522 | 6,249 | 36.4 |
| 3 | 689 | 6,082 | 35.4 |
| 4 | 874 | 5,897 | 34.4 |
| 5 | 1,094 | 5,677 | 33.1 |
| 6 | 1,239 | 5,532 | 32.2 |
| 7 | 1,469 | 5,302 | 30.9 |
| 8 | 1,619 | 5,152 | 30.0 |
| 9 | 1,849 | 4,922 | 28.7 |
| 10 | 2,039 | 4,732 | 27.6 |
| 11 | 2,204 | 4,567 | 26.6 |
| 12 | 2,429 | 4,342 | **25.3** |
| + S1, S2, S3 | 3,169 | 3,602 | **21.0** |
| Target | 3,338 | 3,433 | 20.0 |

## Batch order (G468: each commit deletes whole runtime files and lands their data path)

1. **Build-only out of the runtime (≈ 251, S):** items 1–7. Do this first: it touches no shared index hunks except
   `data/interactables.ts` readers. Check with a parity-free unit run.
2. **Data TS to JSON (≈ 271, S):** items 8–9. Skip `questEvents`/`questDeaths` if sp-x7 has landed them.
3. **Section schemas to build, plus two platform sections and the declared plugin entry (≈ 167, S–M):** items 10–11.
   Land it together with Pine's `runtime/sections.ts` move (one platform change, two users).
4. **Explorer cards to specimen-catalogue rows (≈ 185, M):** item 12.
5. **Rocks baked whole (≈ 220, M):** item 13. Frees the `geometryBake` charge.
6. **Fixed sites (≈ 145, M):** item 14 (hut, lookout, shrine, wreck).
7. **Piers, boat, zipline, bridge (≈ 230, M):** item 15.
8. **Foliage, reef, trail batches (≈ 150, M):** item 16.
9. **Cove and Blender island (≈ 230, M–L):** item 17. One before/after board, because it changes the look path.
10. **World assembly from rows (≈ 190, M):** item 18, after batches 6–9.
11. **Boot and look glue, loot binders (≈ 165, S–M):** items 19–20. Item 20 waits for its Nalati second user.
12. **Creature looks and NPC figure rows (≈ 225, M):** items 21–22, landed with Pine's `species/looks.ts` and
    `npcModels.ts`.
13. *(stretch)* S1 with Pine, S2 with Nalati W3, S3 with Pine.

Parity per G468: one run per about five commits. Batches 6–10 are C1 visual work (Opus); 1–3 and 11 are non-graphical
(Codex).

## What stays custom without AssemblyScript

**View code (≈ 1,090 lines, kept for a reason):**

| File | Lines | Why it stays |
|---|---:|---|
| `runtime/looks/streamedCover.ts` | 264 | Streaming cell decoder with a near/far handover; no host until S2 |
| `runtime/viewmodel/toonArms.ts` | 155 | Toon material and weapon binding on shared RigArms; no host until S3 |
| `runtime/models/ropeBridge.ts` | 148 | Posed plank/rope instances on the declared chain mover; Sky's bridges are static, so there is no twin |
| `runtime/models/slots.ts`, `trophyPlaques.ts`, `seaGlassChime.ts` | 158 | Slot index rewrite for the growing chime and trophies. `engine/models/slots.ts` exists but has no other user, so it would be charged anyway |
| `runtime/looks/facetedDayBackdrop.ts`, `runtime/look/toon.ts`, `terrainPainter.ts`, `runtime/looks/facetedGround.ts` | 137 | The toon sky, day light and faceted ground painter; Signal's `bakedGround.ts` is a cube skirt, not a twin |
| `runtime/models/reef.ts`, `runtime/looks/creatureLooks.ts`, `species/captainMesh.ts`, `world/Ocean.ts` | 130 | Graph-look material follow, the captain texture intake, the water-surface glue |
| `runtime/fpArms.ts`, `runtime/models/gear.ts`, `roster.ts`, `boot/ground.ts`, `runtime/audio/install.ts`, `models/catalogue.ts`, `look/dayKeys.ts` | ~98 | Manifest bindings (ground, roster) and thin hooks |

Plus about 1,065 residual lines inside the converted batches (BlenderIsland ~90, NPC ~160, world/build stages ~40,
boot ~120 and others) and about 215 platform lines nobody converts:
- `HybridResidentWorld` 39;
- `declaredLootEconomy` 30;
- `ColourRampFog` 23;
- `bindLowPolyMaterial` 12;
- `game/plugin/geometry.ts` 86, reached through the pivot-NPC, whole-geometry and creature-body paths. Measure again
  after batches 4, 11 and 12.

**AssemblyScript-only remainder (G470 single-shard rules, ≈ 1,970 lines):**

| Rules | Files (lines) |
|---|---|
| Quest, adventure, finale, Spine (**sp-x7 is moving these now**) | `runtime/quest.ts` 196, `quest/adventure.ts` 173, `runtime/finalePresentation.ts` 83, `quest/Spine.ts` 71, `quest/guards.ts` 5 (deleted in the working tree) |
| Keepsakes and sword claim | `loot/keepsakes.ts` 139, `weapons/IronSword.ts` 114 |
| C4 keeper, brains, boss, strikes | `sim/keeper.ts` 299*, `creatures/Enemies.ts` 234*, `species/monkeyPolicy.ts` 67, `species/monkey.ts` 32, `sim/enemyBrains.ts` 40, `sim/captainEncounter.ts` 32, `combat/captain.ts` 70, `combat/strikes.ts` 67, `sim/kills.ts` 27, `sim/baked.ts` 90, `boot/headlessModules.ts` 37 |
| Ecology and onboarding | `runtime/ecology.ts` 30, `quest/Ecology.ts` 38, `runtime/onboarding/firstMinutes.ts` 46, `quest/install.ts` 57, `quest/interactLifetime.ts` 16, `quest/Places.ts` 6 |

\* S1 (the native actor ABI) is the non-AS alternative for keeper and Enemies.

The AS ceiling is about 1,716 lines (10 % of the legacy lines); Driftwood has 96 today, so the whole remainder fits only
once it is compacted into scripts and data.

## Risks and things to check before building

- Item 10 moves schemas to `generators/`. It rests on `shardProduct.ts:112`: a shipped product never parses.
  **Confirm with the coordinator that this is G467 build code, not a ruler dodge**, and land it with Pine's move.
- Items 14–17 assume `createWorldScene`/`bakedMeshWorld` can wear Driftwood's lent graph toon looks. If they can't, add
  the material port first (platform +~30, with Sky as its user).
- Item 12 needs a `fixed` (product-owned draw) source and capsule colliders in `SpecimenCatalogueSchema`.
- Items 20–22 count only if the named second user lands in the same row (G454 (10)). Without it, subtract their 280.
- Item 7 and the quest readers overlap sp-x7's in-flight files. Sequence after its push.

## Appendix: the 474 platform lines only Driftwood reaches

| Lines | Declarations | Leaves with |
|---:|---|---|
| 120 | `engine/world/geometryBake.ts`: `bakedGeometry`, `parseEntry`, `fromGeometry`, `toGeometry`, `arrayOf`, `keyOf`, … | #13 |
| 86 | `game/plugin/geometry.ts`: `appendGeometry`, `smoothColors`, `paintCanvas`, `bindRigid`, `withoutTriangles`, `joined`, `standardMaterial`, … | measure again |
| 43 | `game/systems/npc/npcRig.ts`: `NpcRig`, `NpcRow`, `NpcModel`, `NpcFace` | #22 |
| 39 | `game/shardfile/hybrid.ts`: `HybridResidentWorld` | stays |
| 31 | `engine/models/place.ts`: `placeModelSite`, `ModelSite`, `ModelSiteLayout` | #14 |
| 30 | `game/shard/declaredRows.ts`: `declaredLootEconomy` | stays (#20 if Nalati adopts it) |
| 26 | `sdk/questGraph.ts` + `game/plugin/quests.ts#compileQuestTable` | #7 |
| 23 | `engine/world/Atmosphere.ts`: `ColourRampFog` | stays |
| 16 | `water/body#swellBody`, `waves#seaDamp`/`insideWaterExtent`, `shore`, `HorizonMatte` | #18 (partial) |
| 15 | `game/loot/tables.ts`: `registerLootTable`, `readLootTables` | #21 |
| 12 | `engine/world/lowpolyKit.ts`: `bindLowPolyMaterial` | stays |
| 33 | small charges: `engine/world/blenderArea` 8 (#17), `sdk/runtime/prompts` 8 *(AS area)*, `sdk/looks/graphDaySky#domeEnvironmentScene` 5, `sdk/looks/lentLooks#lentToon` 5, `sdk/weapons/meleeProfile` 3, four 1-liners (`ProgressSink`, `buildProgress`, `parseInteractionRows`, `SWIM_CLIPS`) | mixed |

All 6,771 lines are accounted for: 3,502 in items 1–22, 1,085 view lines that stay, 1,969 lines for AS, and 215
platform lines nobody converts.
