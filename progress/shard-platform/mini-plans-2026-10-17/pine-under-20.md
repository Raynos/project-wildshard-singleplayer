# Pine Hollow under 20 %: the easy wins that need no AssemblyScript (mini plan)

Basis: ruler at `93a250445` (10-17 05:31 Cancun): **Pine 10,642 custom / 21,305 legacy = 50.0 %**. The 20 % target is
**≤ 4,261**, so the cut needed is **≥ 6,381**. All counts below are from HEAD (`18ad6051d`, no Pine commits since the
ruler). They come from a read-only counter of my own, not the ruler. Uncommitted work in the tree is excluded: sp-x7's
`behaviour/lodge.as` and `data/contractCatalogue.ts` (G470 lodge to AssemblyScript) and hunks in `quest/index.ts`,
`quest/contracts.ts` and `runtime/quest.ts`.

## Verdict

**No. Pine cannot reach 20 % without AssemblyScript.** Every non-AssemblyScript cut found here adds up to about
**3,040 lines (−28.5 points)**. That leaves Pine at about **7,600, or 35.7 %**. Three more large hosts are possible, but
each needs a W3 second user to adopt it in the same landing: a quadruped rig, a living-building host, and the H6
ambient-life host. With all three, the lowest Pine reaches without AssemblyScript is about **6,300, or 29.7 %**.

The blocker is about **3,840 lines of single-shard logic**: quest, lodge, contracts, elites, King fight, roster,
night director, weather answers and ambient-life laws. That logic alone is 90 % of the 4,261 budget. On top of it sit
about 2,980 lines of view code and 780 lines of one-user platform code that stay. G470 is right that the logic must
move to AssemblyScript plus data. Doing this plan **and** moving that logic to AssemblyScript lands Pine at about
**3,760, or 17.6 %**. That only works if the AssemblyScript is denser than the TypeScript it replaces: the
AssemblyScript ceiling is 2,130 lines (10 % of legacy), so 3,840 lines of TypeScript logic must fit in 2,130 lines of
AssemblyScript plus data, about 45 % smaller.

Do the cheap batches anyway (batches 1–5 below, about 1,270 lines, mostly small and medium effort with existing
hosts). They are safe whatever the AssemblyScript answer is. They also shrink the TypeScript the AssemblyScript lanes
must read.

## How the ruler counts (read from `scripts/shard-platform.mjs`, `countOutput(..., sourceProgress=true)`)

- **Counted:** every `src/shards/pine-hollow/**/*.ts|tsx`, as non-blank lines after parser comment removal
  (`linesWithoutComments`).
- **Not counted:**
  - `.d.ts` files, tests, and everything in `generators/` (G467).
  - `.as` files (reported separately: 317 lines).
  - `manifest.ts` or `shard.config.ts`, but **only** if they are declaration-only. Pine's `shard.config.ts` is
    **not**: it has arrows and arithmetic, so it counts 33.
  - Generated outputs (`scripts/generation-jobs.json`, `scripts/source-generation-outputs.json`), **except** under
    `data/`, where generated `.ts` still counts.
- **`data/*.ts` counts.** JSON never counts.
- **Raw GLSL** inside TypeScript counts. Pine has none.
- **G294 attribution:** an engine, game or SDK module that only Pine reaches counts whole. In a shared module, each
  top-level declaration only Pine reaches counts. Entries in `lint/platform-pending-users.json` are excluded
  (riggedHulls, glbNodes, overcast, placementBatch and others are pending, so they are not charged).

**Reproduced:**
- Shard TypeScript = **9,539** over 147 files. That is 9,764 counted, minus the ignored `ktx2.generated.ts` (140) and
  `runtime/boot/astc6/ktx2.generated.ts` (85).
- Per-file numbers match the honest-floor ledger exactly (for example `quest/index.ts` 424, `runtime/life/visitors.ts`
  312, `bakedBuilding.ts` 306).
- G294 attribution = 10,642 − 9,539 = **1,103**. The named items are:
  - `game/plugin/heldLauncher.ts` sole-export 255
  - `game/systems/npc/npcRig.ts` sole-export about 132
  - `engine/world/water/ripples.ts` 102
  - `engine/ai/view/DebugOverlay.ts` 71
  - `engine/models/glb.ts` 64
  - `engine/combat/view/rangedFeel.ts` 38
  - `sdk/weapons/firearmProfile.ts` 8
  - `sdk/runtime/effects.ts` 6
  - about 430 lines of smaller sole-export spans in shared modules. These are not itemised here; they need the
    ruler's `customSources`.

**What actually runs:** I checked importers of every file across `src/`, `scripts/` and `test/`, plus the runtime
roots: `plugin.ts`, `runtime/index.ts`, `boot/headlessModules.ts`, and the generated `discovery.generated.ts` (budgets,
runtimeCost, world/terrain, behaviour/layout, runtime/boot/files, look/render, roster, runtime/boot/gpuTable).
- The only build-only files in the counted set are `data/placeholder.ts` (read by `scripts/bake/placeholderShards.mjs`)
  and `data/eliteHomes.ts` (read by generators).
- No other counted file is dead.
- Five runtime files import `../shard.config` directly.

## Ranked table (by estimated cut)

Effort: S = under half a day, M = 1–2 days, L = up to 5 days. "Second user" is the shard whose matching code must
adopt the host **in the same landing** (G454). A cut charged to Pine is only real once that happens.

| # | File or group | Counted | Technique | Est. cut | Effort | Needs | Second user |
|---|---|---:|---|---:|---|---|---|
| 1 | **NPC figures**: `runtime/npc/standInPerson.ts` 139, `runtime/quest/npcModels.ts` 82, `runtime/models/people.ts` 62, plus the `npcRig` sole-export about 132 | 415 | Small new generic host: a `game/systems/npc` figure-rows host (collider, talk, walk, sway, lantern, baked leg-skin rig), driven by `people/figure.json` and `npcSkins` rows (H9) | 358 | L | New host, about +200 platform (shared, not charged once DW adopts) | **DW** `runtime/npc/people.ts`, `runtime/models/trader.ts` (already on `npcRig`) |
| 2 | **Held weapons**: `runtime/weapons/LeverRifle.ts` 93, `crossbow/Crossbow.ts` 48, `boot/crossbowGeometry.ts` 26, `boot/handsGeometry.ts` 13, `viewmodel/gloveHands.ts` 6, `weapons/crossbow/profiles.ts` 21, `models/gear.ts` 55, `models/skinningKnife.ts` 31, `kit/heldTool.ts` 109, plus `rangedFeel` 38 and `firearmProfile`/`effects` 14 | 454 | Thin wrappers over HeldFirearm, HeldLauncher and HeldPlayback: move the eight `custom/held*`, `lever*`, `crossbowPool`, `handsPool` and `heldToolPlayback` sections onto the platform held-channel and model-library sections (the open-x "section exit" rows). Item rows then build the weapons; Explorer gear specimens come from item rows; the held host installs ranged feel | 320 | L | Existing held hosts plus platform held sections, about +60 platform | **Nalati** `runtime/weapons/magazineFirearm.ts`, `weapons/recurve.ts` (W3 pending rows "held hand parts", "ranged action clocks") |
| 3 | **Cabin static shells**: `runtime/world/cabins.ts` 80, `models/logCabin.ts` 80, `world/cabinKit.ts` 25, `models/woodenCrate.ts` 10, `models/stoneFirePit.ts` 7, `world/cabinBake.ts` 56, `world/homestead.ts` 202, `props/cabinBuild.ts` 14 | 474 | Static geometry to GLB and props rows: walls, glass and prop scans become `world/props` rows. Cabin PBR materials become `look/materials` rows. The living nodes (doors, lanterns, wheel, smoke, lights) stay on `BakedBuildingAssembly` and read the same bake | 304 | L | Existing `world/props` and client prop-material hosts (`clientWorld`, `clientPropMaterials`, `placementBatch`) | Sky, Signal, Template already use the props host |
| 4 | **Product schemas checked at runtime**: `runtime/sections.ts` 88, `quest/rows.ts` 50, `world/logKit.ts` 40, `world/timberBake.ts` 16, `data/keyedSkyRows.ts` 68, `look/dayKeys.ts` 8, `runtime/kingCollisionBake.ts` 31, `species/looks.ts` 81, `runtime/baked.ts` 15, plus schema lines inside homestead, timberSites, fireLookout, cabinBake, mossyBoulder, props, standInPerson, skins, context and index | 397 (+≈70 inline) | Build-only code to `generators/`: the build already validates every section value (G445/G448, shardProduct.ts) and ships `schemas/custom/*.schema.json`. Move the valibot schemas into generators, type custom sections and JSON imports with generated `.d.ts` (`layout.generated.d.json.ts` precedent), and turn `product.file('x.json')` plus `v.parse` reads into custom sections | 289 (+≈60 inline, counted in rows 3–6) | M | One small platform change: a typed `ShardProduct.section(name)` without a runtime schema (about +25 lines) | **DW** `runtime/sections.ts` |
| 5 | **Data written in TypeScript**: `data/budgetCeilings.ts` 24, `budgets.ts` 18, `data/runtimeCost.ts` 19, `data/antlerKing.ts` 20, `data/antlerKingLook.ts` 24, `data/kingRig.ts` 34, `data/bowProfile.ts` 8, `data/weatherLook.ts` 10, `data/undergrowthLook.ts` 11, `data/waterLook.ts` 7, small `data/*.ts` constants (terrainBindings, wardensHollow, nativeLoadout, forestLook, skyLook, quests) 11, `strings.ts` 3, `world/treeSet.ts` 27, `world/places.ts` 36, `weapons/longbowFlight.ts` 2, `loadout/effects.ts` 5 | 259 | Data in TypeScript becomes JSON rows or sections. Discovery already binds JSON (`data/boot-poses.generated.json`); strings go to the `ui/strings` section; place sets become rows for `registerPlaceSets`; finish effects become effect rows | 248 | S | Nothing | — |
| 6 | **Dev tools and build glue**: `runtime/dev/perfLap.ts` 51, `shard.config.ts` 33, `boot/headlessModules.ts` 61, plus `DebugOverlay` 71 (+3 call lines) | 219 | (a) Perf-lap spots become a row. The busy policy is generic (practice room, boss state, elite engaged, combat music, charging animals, riding, swimming), so it moves to an engine default that the game session installs for every shard; code no shard reaches is charged to no one. (b) `installAiDebug` is installed by the session, not Pine. (c) `shard.config.ts`: move the budget arithmetic and `row()` into a generator so it becomes declaration-only (exempt), and read `ctx.product.shardfile` instead of `../shard.config` in the 5 runtime files. (d) `headlessModules.ts` is generated from `data/headlessAssembly.json` | 219 | S–M | About +35 engine/session lines, not charged (shell) | — |
| 7 | **Hero landmarks**: `runtime/world/hero.ts` 29, `models/waystone.ts` 26, `models/caveArch.ts` 45, `world/heroFiles.ts` 5, plus `engine/models/glb.ts` 64 (Pine is its only user) | 169 | Static geometry to GLB and props rows (stones, waystone, dam, canoe, board, arch). The generator bakes the arch's open and closed variants, which removes the runtime `hollow()` triangle mask. With no other Pine user, `glb.ts` drops out | 169 | M | Existing `world/props` host | Sky, Signal |
| 8 | **Trophy wall**: `runtime/compendium/trophyWall.ts` 155, `runtime/compendium/install.ts` 22 | 177 | Small new generic host: a game compendium wall (slots, chalk atlas, mount pack rows) behind `installCompendium`'s `wall` port | 160 | M–L | New host, about +120 platform | **DW** `runtime/models/trophyPlaques.ts` + `data/trophySlots.json` (check the semantics match before claiming) |
| 9 | **Timber landmarks**: `models/fireLookout.ts` 28, `world/timber.ts` 51, `models/zipCable.ts` 13, `world/timberSites.ts` 69 | 161 | Static geometry to props rows (lookout, landing, footbridge, zip cable, token-shelf mesh). Timber materials become `look/materials` rows. Keep `loadSiteTimbers` (about 20) for the pool, streams and undergrowth reads | 141 | M | Existing props and materials hosts | Sky, Signal |
| 10 | `runtime/world/landmarks.ts` | 149 | The `placeTimber` and `buildProps` halves leave with rows 7 and 9. Canoe-away, waystone glow and the cave registry stay (about 69) | 80 | M | Rows 7 and 9 | — |
| 11 | **Looks**: `looks/paintedTextures.ts` 28, `looks/groundCover.ts` 94, `looks/keyedSky.ts` (key packing), `world/streams.ts` (spray), `world/water.ts` | 456 counted | Looks to graph or material rows and existing hosts: painted metadata becomes platform texture/atlas entries (open-x exit row); ground-cover materials become `look/materials` rows, with viewer and sun as engine graph inputs (graph features round 3); RGB9E5 sky keys are packed at build; waterfall spray becomes effect rows; water becomes `clientWater` rows | 117 | M | Existing graph and material hosts; graph inputs (round 3 #18) | — |
| 12 | `runtime/index.ts` | 277 | Shrinks as the builders in rows 2, 3, 7, 9, 11 and 13 leave (world and kit assembly). The rest waits for H11 index boot | 110 | S per batch | Rows above | — |
| 13 | **Props**: `runtime/world/props.ts` 38, `models/mossyBoulder.ts` 57, `treeStump.ts` 9, `fallenLog.ts` 8 | 112 | Static geometry to props rows. The rock, stump and log hulls and placements are already baked (`world/props.json`, `world/prop-shapes.json`) | 110 | S–M | Existing props host | Sky, Signal |
| 14 | `runtime/world/crags.ts` | 167 | Crag modules become batched props rows with the crag graph material (the sp-o202 crag-graph port is parked on an "unlit up close" issue). Cave assembly and frame stay (about 57) | 110 | M–L | Existing props host plus a batched graph | — |
| 15 | **Forest model drawer**: `models/forestTree.ts` 49, `world/drawnModels.ts` 44, `models/fern.ts` 11, `world/undergrowthKit.ts` 35 | 139 | Thin wrapper over an existing engine host: the engine `Forest.drawItself()` path already exists in `drawnModels`. The Explorer model registrations become registry rows | 110 | M | Existing engine Forest; check phone culling and draw calls first | — |
| 16 | **Geography**: `world/terrain.ts` 84, `behaviour/layout.ts` 52 | 136 | Static analytic geography becomes baked rows: generators bake the forest density and species rasters and the creek-water raster, read through the engine's baked samplers (`createBakedTerrainField`, `shardfileWater`). The tier trim stays | 95 | M | Existing baked samplers | — |
| 17 | **LEGACY entry and harness params**: `entered === undefined` branches (combat/install, loadout, weather, index, ambientLife, chargeTells), plus `?boss`, `?bossGod`, `?elite`, `?ammo`, `?quest`, `?resetquest` | ~89 of the files' 1,249 | Delete the leftover legacy path: drop Pine's non-retained LEGACY entry (Developer-only, SHARD SELECT). The harness params move to generic game harness handling (boss, elite, quest beat) | 89 | S–M | **Jake's call** on removing the LEGACY entry | — |
| | **Total without AssemblyScript** | | | **3,041** (2,719 shard + 322 platform) | | Platform growth about +550 shared or shell, so net about −2,490 (G455) | |

Not counted, but recommended for the output-basis re-base (P4): the two generated GPU tables `ktx2.generated.ts`
(140) and `runtime/boot/astc6/ktx2.generated.ts` (85) are ignored on today's source ruler. On the output ruler,
generated TypeScript that ships counts, so they would add +225. Emit them as JSON in batch 1 to protect the P4
number. The same applies to row 6(d): a generated `headlessModules.ts` only helps the source basis unless the SDK builds
that map itself.

## Running total against the 6,381 target

| After batch | Cumulative cut | Pine custom | Pine % | Short of 6,381 |
|---|---:|---:|---:|---:|
| 1 data to JSON | 260 | 10,382 | 48.7 % | 6,121 |
| 2 dev tools and build glue | 479 | 10,163 | 47.7 % | 5,902 |
| 3 schemas to generators | 768 | 9,874 | 46.3 % | 5,613 |
| 4 props, hero, landmarks share | 1,127 | 9,515 | 44.7 % | 5,254 |
| 5 timber landmarks | 1,268 | 9,374 | 44.0 % | 5,113 |
| 6 cabin static shells | 1,572 | 9,070 | 42.6 % | 4,809 |
| 7 crags and forest drawer | 1,792 | 8,850 | 41.5 % | 4,589 |
| 8 looks rows and index shrink | 2,019 | 8,623 | 40.5 % | 4,362 |
| 9 held weapons | 2,339 | 8,303 | 39.0 % | 4,042 |
| 10 NPC figure host (DW) | 2,697 | 7,945 | 37.3 % | 3,684 |
| 11 trophy wall (DW) and geography bake | 2,952 | 7,690 | 36.1 % | 3,429 |
| 12 LEGACY path and harness params | **3,041** | **7,601** | **35.7 %** | **3,340** |
| Stretch: three L hosts with W3 second users (below) | ≈4,320 | ≈6,320 | ≈29.7 % | ≈2,060 |
| Then single-shard logic to AssemblyScript (G470) | ≈6,880 | ≈3,760 | **≈17.6 %** | met |

## Order: batches of about 150–500 lines

G468 applies: each commit deletes a whole runtime file or module and lands its data path in the same commit. Each
batch has one parity check. A board is only needed where the look changes.

1. **Data to JSON (≈260, S, 3–4 commits).**
   - King rows: `data/antlerKing.ts`, `antlerKingLook.ts`, `kingRig.ts`.
   - Look and weather constants: `weatherLook`, `undergrowthLook`, `waterLook`, `forestLook`, `skyLook`,
     `bowProfile` + `weapons/longbowFlight`, `terrainBindings`, `wardensHollow`, `nativeLoadout`, `quests`.
   - Budgets and cost: `budgets.ts`, `budgetCeilings.ts`, `runtimeCost.ts`, as JSON bindings for discovery.
   - `strings.ts`, `world/treeSet.ts`, `world/places.ts`, `loadout/effects.ts`.
   - Build-only: `data/placeholder.ts` and `data/eliteHomes.ts` move to generators.
   - Also emit the two ktx2 tables as JSON (P4).
2. **Dev tools and build glue (≈219, S–M, 3 commits).**
   - Perf lap to a session-installed default plus a spots row; delete `runtime/dev/perfLap.ts`.
   - Session installs the AI debug overlay; Pine drops its `DebugOverlay` charge.
   - `shard.config.ts` becomes declaration-only, and runtime stops importing it.
   - `boot/headlessModules.ts` is generated.
3. **Schemas to generators (≈289, M).**
   - Platform commit first: a typed custom-section reader that needs no runtime schema, adopted by DW
     `runtime/sections.ts` in the same commit.
   - Then Pine commits that delete `runtime/sections.ts` (the SECTIONS registry), `quest/rows.ts`, and the schema
     halves of `logKit`, `timberBake`, `keyedSkyRows`, `kingCollisionBake` and `species/looks`.
   - Move the `product.file()` JSON reads to build-validated custom sections.
4. **Props, hero landmarks and the landmarks share (≈360, M).**
   - Delete `runtime/world/props.ts`, `models/mossyBoulder.ts`, `treeStump.ts`, `fallenLog.ts`, `world/hero.ts`,
     `world/heroFiles.ts`, `models/waystone.ts` and `models/caveArch.ts`.
   - Draw them from `world/props` rows. Bake the arch variants.
   - `glb.ts` loses its only user.
5. **Timber landmarks (≈141, M).** Delete `models/fireLookout.ts`, `world/timber.ts` and `models/zipCable.ts`, and the
   site half of `timberSites`. Timber materials become material rows.
6. **Cabin static shells (≈304, L, 2 commits).**
   - Static shell and prop scans become props rows; materials become material rows.
   - Delete `cabins.ts`, `cabinKit.ts`, `woodenCrate.ts`, `stoneFirePit.ts`, `cabinBuild.ts`, and the static half of
     `logCabin`, `cabinBake` and `homestead`.
   - The living nodes stay on `BakedBuildingAssembly`.
7. **Crags and forest drawer (≈220, M–L).**
   - Crag modules become batched props rows. First fix the parked "unlit up close" crag-graph issue (sp-o202).
   - Delete `models/forestTree.ts` and `models/fern.ts` and use `Forest.drawItself()`. Check the phone frame and draw
     count first.
8. **Looks rows and index shrink (≈227, M).** Painted textures become platform texture entries. Ground-cover materials
   become rows. Sky keys are packed at build. Spray becomes effect rows. Water becomes `clientWater` rows. Fold the
   `runtime/index.ts` lines that wired deleted builders.
9. **Held weapons (≈320, L, 2–3 commits).** The platform held sections replace the eight `custom/*` held sections.
   Delete `crossbowGeometry`, `handsGeometry`, `gloveHands` and `crossbow/profiles`, and the wrapper halves of
   `LeverRifle`, `Crossbow`, `gear` and `heldTool`. The held host installs ranged feel. Nalati's W3 rows supply the
   second user.
   - G482 follow-up (sp-x6, feature #4, recheck 2026-10-18): resolve native held owners from the platform context and item ids; remove the public world/targets ports and cooperative-yield callback from `HeldEquipment`. This catalogue lands at 5/6 pending that data-only entry.
   - G482 loadout follow-up (sp-x6, feature #4, recheck 2026-10-18): replace `HeldLoadoutHost` and the death reset callback with context/id resolution; convert native ammunition family ports to native owner ids. The first loadout slice scores 5/6 until these public seams are data-only.
10. **NPC figure host with DW (≈358, L).** A game figure-rows host. Delete `standInPerson`, `npcModels` and the
    people wrapper. DW `runtime/npc/people.ts` moves onto it in the same landing.
11. **Trophy wall with DW, and the geography bake (≈255, M–L).** The game compendium wall host plus DW trophy plaques.
    Delete `runtime/compendium/trophyWall.ts`. Bake the forest and creek rasters, and delete most of
    `behaviour/layout.ts` and the analytic part of `world/terrain.ts`.
    - G482 follow-up (sp-x4, feature #6, recheck 2026-10-18): replace the collection entry points' borrowed world/save capability bundles with platform context and resource ids. Collections lands at 5/6; packed geometry already registers rows and is borrowed by id.
12. **LEGACY path and harness params (≈89, S–M).** Needs Jake's pick on dropping the non-retained LEGACY entry.
    Recommended answer: drop it (Developer-only; the public entry is `shardfile`). Until he answers, build everything
    else; this batch is last on purpose.

**Stretch (non-AssemblyScript, L each, only with a real W3 second user in the same landing):**
- **A quadruped rig and foot-IK host** on GLB clips: `species/limbRig.ts` 190, `combat/kingRig.ts` 94,
  `kingPoseKeeper` 127, `kingQueryPose` 69, `kingQueryView` 44, `kingCollision` 41, the `models/antlerKing.ts` dressing
  148. Cuts about 600. Second user: Nalati horse or creature poses (`createNativeCreaturePoses` is already pending
  there).
- **A living-building host** for doors, lanterns, wheel, smoke and lights: `props/bakedBuilding.ts` 306 and
  `props/buildingLife.ts` 78 (≈330). Second user: a Nalati yurt or a Nine building, which must be found and verified.
- **H6 ambient-life host**: the view and flight half of `runtime/life/visitors.ts` and `ambientLife.ts` (≈350). Second
  users: DW `gullFlock.ts` and Nalati `creatures/flock.ts`.

## What stays custom without AssemblyScript

**View code (≈2,980 after the batches), with reasons:**
- **Living buildings: `props/bakedBuilding.ts` 306, `props/buildingLife.ts` 78, homestead and cabin remainder ≈150.**
  Doors with colliders and prompts, swinging lanterns, the mill wheel, hearth particles and pooled site lights. No
  second shard has a living-building contract yet (stretch host above).
- **King body: `species/limbRig.ts` 190, `models/antlerKing.ts` 148, `kingPoseKeeper` 127, `kingRig` 94,
  `kingQueryPose` 69, `kingQueryView` 44, `kingCollision` 41.** Procedural four-limb IK plus baked clips and pose
  publication order. There is no second quadruped-IK consumer (stretch host above).
- **`looks/keyedSky.ts` ≈245.** Keyed photoreal sky-texture residency and eviction, and weather-over-clock driving. The
  graph and day hosts already do the drawing, and no other shard has keyed sky textures.
- **`looks/rainFx.ts` 195.** Canopy cover texture, rain curtain, splashes, lens drops and puddles. Nalati's storm deck
  is a different presentation. It already runs on channel programs.
- **`kit/caveInterior.ts` 151, crags remainder ≈57.** Cave frame queries (inside, hole test, terrain cuts), light shaft
  and drips. Partly physics, used by rain and audio.
- **`runtime/index.ts` remainder ≈167, `plugin.ts` 24, `roster.ts` 31, `runtime/boot/files.ts` + `gpuTable` + `debug`
  ≈25, `look/render.ts` 9.** Page installation sequencing until H11 index boot; Explorer roster; GPU table choice.
- **`world/treeFactory.ts` 77, `looks/groundCover.ts` ≈44, `world/undergrowth.ts` 12, drawer and kit remainders ≈30.**
  Pine tree-set materials and fade bands, and the ground-cover class (DW's compressed-cell streaming is a different
  law).
- **`kit/heldTool.ts` ≈69, held wrapper remainders ≈45.** The knife's work-beat presentation; only Pine has a held
  tool.
- **Small view helpers ≈200:** `species/looks.ts` ≈46 (Pine boar and bear look rows plus the hull skin hookup),
  `combat/fxKit.ts` 38, `species/hulls.ts` 38, `chargeTells` ≈36, `models/hollowLog` 32, `world/codeParts` 17,
  `world/context` 16.
- **Platform charges that stay (≈780):** `heldLauncher` sole-export 255 (physical bolt flight and sticking; Nalati only
  uses the bow parts), `water/ripples` 102 (no second water user of those declarations), and about 430 lines of
  smaller sole-export spans.

**AssemblyScript-only remainder (single-shard logic, ≈3,840 TypeScript lines):**

| Group | Files (lines left after this plan) |
|---|---|
| Quest, lodge, contracts (C5) | `quest/index.ts` 412, `runtime/quest.ts` 273, `quest/contracts.ts` 104, `runtime/lodge.ts` 102 (sp-x7 is on it), `quest/stagLead.ts` 67, `quest/nightThralls.ts` 51, `quest/stagWalk.ts` 43, `quest/tokenShelf.ts` 30, `quest/hollowLog.ts` 24, `world/beaverPool.ts` 66 (drain law), `quest/rows`, `featLaw`, `rifleFloor` ≈24 |
| Elites, King fight (C4) | `combat/eliteScripts.ts` 270, `runtime/antlerKing.ts` 213, `combat/install.ts` ≈160, `runtime/king.ts` 145, `combat/kingFight.ts` 79, `combat/elites.ts` 64, `combat/ctx.ts` 62, `combat/lane.ts` 46, `combat/spawns.ts` 19, `runtime/kingLifetime.ts` 15, `combat/eliteStreams.ts` 10 |
| Roster, night, herds (C4, needs the native actor and save ABI) | `runtime/roster.ts` 170, `runtime/nightDirector.ts` 154, `runtime/nightPopulation.ts` 45, `runtime/species/herdShelter.ts` 96, `runtime/herds.ts` 20, `runtime/rainShelter.ts` 18, `runtime/baked.ts` ≈12 |
| Ambient life laws (C3) | `runtime/life/visitors.ts` 312 (scavenge and visit; the view half could go to H6), `runtime/life/ambientLife.ts` ≈246 (harvest beats, carcass visits, crumbs, discoveries) |
| Loadout, ammo, finishes (C6) | `loadout/loadout.ts` ≈188, `runtime/weapons/ammunition.ts` 51, `runtime/loadout/skins.ts` 43, `loadout/ammo.ts` 31, `loadout/events.ts` 19 |
| Weather answers, geography (C3) | `world/weather.ts` ≈118, `world/terrain.ts` ≈29, `behaviour/layout.ts` ≈12 |

## Risks and checks

- **Rows 1, 2, 8 (new or extended hosts).** The second user must land in the same commit set, or the host stays
  charged to Pine (G294/G454). Rows 1 and 8 name concrete DW files; check that the semantics really match before
  building.
- **Rows 3, 7, 9, 13, 14.** These rely on Pine's hybrid page drawing from its product `world/props` tiles and library.
  The product already ships 26 props tiles and a 4-file `wholeLibrary`, but its `models` and `colliders` arrays are
  empty today. Each batch needs the per-batch parity check (G466(6), G468): colliders exact, the physics walk at 0
  stuck after collider changes, and look similar (G415).
- **Row 15 (forest drawer).** It was chosen for phone culling. Check phone frame time and draw calls before deleting
  it.
- **Row 4.** Valid only because the build already validates every section value (`src/game/shardfile/shardProduct.ts`
  says so, G445/G448). Keep save and continuation schemas: king, roster, night, herd shelter, ammo and loadout saves
  stay as they are.
- **Row 17** needs Jake's pick (LEGACY entry). The harness params are on the `lint/url-params.json` harness list, so
  capture scripts depend on them. Move them to a generic harness; don't delete them.
