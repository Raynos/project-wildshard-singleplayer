# Signal Dunes under 10 %: mini plan

`src/shards/sunscar-dunes/`, Jake's ask "two new mini plans to get sky and dunes under 10%". Static read on
2026-10-17 at HEAD `18ad6051d`. The Signal folder has no uncommitted edits, only one untracked asset blob.

## Verdict

**Signal can reach 10 % without AssemblyScript.** The plan cuts **996 of 1,380 custom lines**, leaving **384
(9.3 %)** against the ≤ 412 target. That is 28 lines of headroom. With one small optional AssemblyScript script (the
quest-driven dusk, about 25 AS lines) the cut is about **1,016**, leaving **~364 (8.8 %)**. AssemblyScript would then
be 118 + ~25 = **~143 of the 412 ceiling (35 %)**.

The reason it is reachable: **981 of the 1,343 shard lines are `data/*.ts`**. Most of that is plain literals or
build-only code that already has a home in a generator, a platform section or a shardfile field. The view code (362
lines in `plugin.ts`, `world/`, `look/`, `runtime/`, `models/`, `roster.ts` and `boot/`) is already thin, and almost all
of it stays.

**Main risk: host admission code charged back to Signal.** About 150–180 lines of new parse/admission code go into the
game, SDK and engine layers (H-rows, held-recipe admission, painted-look row). Sky Reach has the same shape for every one
of them (`far-reach/data/runtimeRows.ts`, `population.ts`, `heldWeapon.ts`, `equipment.ts`, `skyPaintedLook.ts`,
`strings.ts`, `budgets.ts`, `devPoses.ts`), so Sky is the named second user. But G454 / G294 only clear a host when
both users land together. **Land each shared host with Sky's adoption in the same commit set.** Otherwise its exports
charge back to Signal as sole-user lines, and 150 such lines would put Signal at ~13 %.

## How the lines were counted

`scripts/shard-platform.mjs` (source-progress mode, the plan ruler) counts the following:
- **Every `.ts`/`.tsx` under `src/shards/sunscar-dunes/`**, whether or not anything reaches it (dead code counts).
  Tests, `.d.ts`, `.as` and everything under `generators/` are excluded. `manifest.ts` and `shard.config.ts` are
  excluded when they are declaration-only (Signal's `shard.config.ts` is: it re-exports `generators/product`).
- **`data/*.ts` always counts**, even when it is a registered generated output (`data/striderRig.baked.ts` counts). A
  generated TS file outside `data/` is ignored, but this plan does not use that loophole. JSON never counts.
- **Unit:** nonblank lines after parser comment removal (`codeLines`). Raw GLSL in non-TS files is added (Signal has 0).
- **G294 sole-user charges:** a platform module that only Signal reaches counts whole. In a shared module, each
  top-level declaration that only Signal reaches counts its own span.

Reproduction was read-only. `count.mjs` called the ruler's pure `codeLines` and `rawShaderLines` on every Signal file.
One in-process call of the exported `sourceProgressInventory` (no CLI, no writes, parse cache unset) supplied the
sole-user charges. Result: **shard TS 1,343 + platform 37 = 1,380, legacy 4,122, AS 118, AS ceiling 412**, which
matches the ruler at `93a250445` exactly. The 37 platform lines are:
- `src/sdk/species/clips.ts`: 12, whole module.
- `engine/render/families/ground.ts`: 12 (`setGroundPools` 11, `GroundPool` 1).
- `engine/render/dataLook.ts` `painterLightPatch`: 6.
- `game/shardfile/hybridPresentation.ts` `hybridPresentation`: 3.
- `game/shardfile/runtimeProduct.ts` `runtimePresentation`: 3.
- `sdk/looks/modelLibrary.ts` `HdLookRow`: 1.

The honest-floor ledger (`908dcec0a`) still lists `data/fireLook.ts` at 131 lines. It has since moved to
`generators/fireLook.ts`, which is why the total fell from 1,500 to 1,380.

**Runtime roots:** `runtime/index.ts` (the grid entry), plus the `manifest.json` page bindings: `plugin.ts`,
`roster.ts`, `boot/ground.ts`, `look/render.ts`, `data/{budgets,runtimeCost,devPoses,cues,boot}`. Ten data files are
**not reachable from any runtime root**: `audio`, `ledger`, `stormLook`, `matriarchDecision`, `nativeWorld`,
`headlessLevel`, `restFiles`, `hulls`, `places`, `placeholder`. Only generators, bake scripts or tests import them.
`look/sandEntry.ts` and `familyLook.ts`'s `SAND_LOOK` are dead: nothing reads `SAND_LOOK`, and `generators/product.ts`
inlines the same sand entry itself.

**Guard for every "→ generators/" move:** the moved module must have **zero runtime importers**. The source ruler
skips `generators/` even when a runtime file imports it, so moving runtime code there would hide it rather than cut it.
The P4 output ruler would count it anyway.

## Ranked table

Easy wins without AssemblyScript come first. "Second user" names the other shard on the host for G294 / G454.

| # | File or group | Counted | Technique | Est. cut | Effort | Needs | AS |
|---|---|---:|---|---:|---|---|---|
| 1 | Build-only data: `data/audio` 9, `ledger` 5, `stormLook` 46, `matriarchDecision` 21, `nativeWorld` 4, `headlessLevel` 6, `restFiles` 1, `hulls` 28, `places` 19 | 139 | build-only → `generators/` (G467) | 139 | S | Update imports in `generators/product.ts`, `output.ts`, `restScene.ts`, `hulls.ts`, `facets.ts`, `physicsPlacements.ts`, `places.ts`, `bake-signal-rigs.mjs`, `bake-signal-world.mjs`, and `test/native-runtime-plan.test.ts`. Product and section bytes must stay identical | no |
| 2 | Dead: `look/sandEntry.ts` 8, plus `familyLook` `SAND_LOOK`/`DuskSandRow`/`SAND_MAPS`/2 imports 5; then `data/sandFields.ts` 13 is build-only (`product.ts` only) | 26 | dead → delete; sandFields → `generators/` | 26 | S | none | no |
| 3 | `data/signalQuest.ts`: `SIGNAL_QUESTS` (`parseQuestData` call, 22 lines) | 22 of 30 | build-only → `generators/quests.ts` (it ships in the `quests/quests` section already) | 22 | S | `persistence`, `questPresentation`, `questRepair` and `product.ts` import paths; the witness test | no |
| 4 | `data/placeholder.ts` | 3 | build-only → `generators/` or JSON | 3 | S | `scripts/bake/placeholderShards.mjs` path (shared tooling; Sky's `placeholder.ts` moves in the same commit) | no |
| 5 | Manifest/boot literals: `budgets` 9 + `budgetCeilings` 27, `runtimeCost` 8, `devPoses` 11, `boot` 11, `cues` 1, `runtimeBoot` 1, `nativeMotion` 1, `facets` 1, `striderRig.baked` 1 | 71 | data in TS → JSON; computed ones (`devPoses`, `boot`) → generator-emitted `*.generated.json` | 71 | S–M | `budget-ceilings.mjs` already writes `data/budgetCeilings.json` (Nalati and Nine precedent), and Nalati/Nine ship `runtimeCost.json`. Manifest bindings already take JSON modules (`navigation`, `mapPalette`). `bake-signal-rigs.mjs` must emit `striderRig.json`. New generation-jobs rows | no |
| 6 | Model-library and world rows: `data/files` 44, `surfaces` 25, `pieces` 11, plus platform `HdLookRow` 1 | 81 | data in TS → generator-emitted JSON (`models.generated.json`, `pieces.generated.json`) read by `createModelLibrary` / `bakedMeshWorld` | 81 | M | Precedent: Sky `world/meshes.ts` reads `heroLibrary.generated.json` + `boot/assets.generated.json`, and `world/baked.ts` reads `worldRows.generated.json`. Surface-look rows need an existing `@wildshard/format/surfaceLooks` parse at intake, or one shared admission (Sky second user) | no |
| 7 | Held whip: `data/whip` 84, `heldWeapon` 18, `meleePhase` 7, `equipment` 5, `items` 22, `whipContacts` 16, `nativeMelee` 10, `gearModels` 26 | 188 | data in TS → generators. The item row already ships in `combat/items` (parsed shardfile), and the held recipe/scene/phase become one generated JSON | 188 | M | **Host: held-recipe admission** (game; existing `parsePrivateScene`, `parseHeldMeleePhase`, `parseWorldSceneBindings` as parts). **Equipment row derived from the item row + cues** instead of `WHIP_ROW`. Gear scene rows as JSON for `modelCatalogue`. Second user: Sky (`FAN_HELD_RECIPE`, `equipment.ts`, `gearModels.ts`). ~40–60 platform lines | no |
| 8 | Species catalogue: `data/brains` 33, `species/{duneRay 16, matriarch 31, skitterer 21, strider 33, bodies 11}`, `creatureLooks` 10, `rigLibrary` 15, plus platform `sdk/species/clips.ts` 12 | 182 | data in TS → generators. Emit the existing **`actors/species-programs`** platform section (`page`, `native`, `program`); rig library + looks/clips → shardfile `rows.looks` or a generated rig JSON | 182 | M | Existing section host: Pine and DW already read `ctx.product.section('actors/species-programs')`. `HybridRuntimeRows.species` must take the section. Rig/looks/clips admission (Sky second user: `SKY_RIG_LIBRARY` in `far-reach/data/population.ts`). `clips.ts` stops being runtime-reached (−12) | no |
| 9 | Fight, population, runtime rows and strings: `population` 17, `headlessOwners` 22, `hostOwners` 15, `spawns` 14, `matriarchBoss` 5, `matriarchEncounter` 12, `matriarchPresentation` 6, `runtimeRows` 20, `strings` 42 | 153 | data in TS → generators. Spawns already ship as `runtime.spawns`, the boss via `quests/directors` + existing `parseBossOwnerRow` / `parseMarkedBossPresentation`, strings as the existing **`ui/strings`** section (DW reads it) | 153 | M–L | **Host H-rows:** `HybridRuntimePlugin` assembles `species`/`population`/`fight`/`pageQuest`/`strings`/`weapon` from the admitted product (sections + a generated page-binding JSON for `inspect`/`capture`/`holds`). Second user: Sky (`SKY_RUNTIME_ROWS`). ~80 platform lines. `world/build.ts` reads `lit` from the product strings | no |
| 10 | Painted look: `data/lastLight` 34, `dusk` 19, `sand` 14, `familyLook` rest 8, `sky` 3, `lightLook` 6 | 84 | looks → generator-emitted look row JSON (the sand's `SAND_DUSK` is already `look.curves` in the product) | 84 | M | **Host: painted-look row admission** in `engine/render/dataLook` (`paintedLook` from a parsed `DuskLookRow` + painter-light row). Second user: Sky (`data/skyPaintedLook.ts`; G406 one painted look for both). ~30 platform lines | no |
| 11 | `data/fire.ts` | 35 | `fireRows`/`lampRows` expanded at build into the `restScenes.generated.json` fire entries; `FIRE_STYLE` → `generators/fireLook.ts` (its only reader); `FIRE_GRAPH_IDS` → JSON | 35 | S–M | `cardGroup` / `effectField` accept the expanded rows (typed program ids: check the cardField row parser, or admit at `prepareFireFx`) | no |
| 12 | `data/flags.ts` 4 + `signalQuest` constants 8 | 12 | → generators + JSON (`plugin.duskOf` reads the flag names from the generated JSON, or from #13) | 12 | S | none | no |
| 13 | Dusk progression: `plugin.ts` `duskOf` + dusk install (~11) + `look/dusk.ts` 11 | ~22 | single-shard logic → AssemblyScript: a quest-step → dusk target table plus an eased host field `shared.dusk` | ~20 | M | A decision script on the ABI-v0 ScriptProcedure host that sp-x7 builds for DW/Pine. Events: quest flag / rule changes. Opt-in ≤ 10 Hz tick for the 0.02/s ease. **Needs a state-write command for the `privacy: 'host'` field.** ~25 AS lines. Or data, if a generic "state field follows quest step" host gains a second user | **yes** |
| 14 | Stretch: `runtime/looks/bakedGround.ts` 37 + `hybridPresentation`/`runtimePresentation` 6 | 43 | shared host (`CubeSkirt`, `lentMaterial`: "nothing here knows a shard") | 43 | M | Only with a real second user adopting the baked-tile skirt / lent material (Nalati or Nine grid tiles). Without one it stays charged | no |
| 15 | Stretch: `look/render.ts` 26 → `paintedLookFromRow` (with #10) | ~10 | thin wrapper → host call from data | ~10 | S | the #10 host; Sky `look/render.ts` second user | no |

Items 1–12 are the plan of record: **996 lines cut, no AS**. Item 13 adds ~20 with AS. Items 14–15 are headroom only.

## Running total against the 968 target

| Step | Batch | Cut | Running | Custom left | % of 4,122 |
|---|---|---:|---:|---:|---:|
| 0 | start | 0 | 0 | 1,380 | 33.5 % |
| 1 | A: build-only + dead (items 1–4) | 190 | 190 | 1,190 | 28.9 % |
| 2 | B: manifest/boot + model/world rows (5, 6) | 152 | 342 | 1,038 | 25.2 % |
| 3 | E: held whip (7) | 188 | 530 | 850 | 20.6 % |
| 4 | C: species catalogue (8) | 182 | 712 | 668 | 16.2 % |
| 5 | D: fight/population/rows/strings (9) | 153 | 865 | 515 | 12.5 % |
| 6 | F: looks + fire + flags (10–12) | 131 | **996** | **384** | **9.3 %** ✓ (target 968 passed) |
| 7 | optional G: dusk to AS (13) | ~20 | ~1,016 | ~364 | 8.8 % |
| – | stretch 14–15 | ~53 | ~1,069 | ~311 | 7.5 % |

The target is only crossed at batch F. If any shared host lands without Sky, or a batch under-delivers, run batch G and
the stretch items before calling the 10 % mark.

## Batches (G468: each commit deletes whole runtime modules with their data path)

The order puts the zero-risk work first. The strings move waits until every runtime reader of `STRINGS` has gone.

**A. Build-only data into generators (~190, S, one commit).**
- Move: `data/audio`, `ledger`, `stormLook`, `matriarchDecision`, `nativeWorld`, `headlessLevel`, `restFiles`, `hulls`,
  `places`, `sandFields` and `placeholder` into `generators/`.
- Split `SIGNAL_QUESTS` out of `signalQuest.ts`.
- Delete `look/sandEntry.ts` and the dead `SAND_LOOK` rows.
- Proof: `product.generated.json` and every `out/sunscar-dunes` section hash unchanged. No parity run needed: nothing
  the client runs changes.

**B. Boot, manifest and asset rows to JSON (~152, S–M).**
- `budgets` + `budgetCeilings` → `budgetCeilings.json` + `budgets.json`.
- `runtimeCost.json`, generated `devPoses.generated.json` and `boot.generated.json`.
- `cues`, `runtimeBoot`, `nativeMotion`, `facets` and `striderRig` as JSON.
- `files` + `surfaces` + `pieces` → `models.generated.json` and `pieces.generated.json` (the Sky precedent).
- New generation-jobs rows.
- Proof: boot file list and Model Explorer roster identical; one look-parity batch.

**E. Held whip (~188, M).**
- One commit with Sky: held-recipe admission plus equipment-from-item.
- Delete `whip`, `heldWeapon`, `meleePhase`, `equipment`, `items`, `whipContacts`, `nativeMelee` and `gearModels` from
  `data/`. `generators/lash.ts`, `heldPlayback.ts` and `product.ts` keep their inputs as generator modules.
- Proof: whip/fan held parity and headless lash scenario unchanged.

**C. Species catalogue (~182, M).**
- `generators/output.ts` emits `actors/species-programs`. Rig looks/clips go to shardfile `rows.looks` or a generated rig
  JSON, admitted where `createModelLibrary` takes `rigs`.
- Delete `brains`, `species/*`, `creatureLooks` and `rigLibrary` from `data/`.
- `world/meshes.ts` and `roster.ts` read the generated rows.
- Proof: native species replay / scenario tests, plus creature look parity.

**D. Fight, population, runtime rows, strings (~153, M–L).**
- One commit set with Sky: H-rows in `game/plugin/headless.ts`, plus `ui/strings`.
- Delete `population`, `headlessOwners`, `hostOwners`, `spawns`, `matriarch{Boss,Encounter,Presentation}`,
  `runtimeRows` and `strings` from `data/`. `plugin.rows()` passes only `owners`.
- Proof: Matriarch fight scenario, quest page capture checkpoints, boot smoke.

**F. Looks, fire, flags (~131, M).**
- Painted-look row admission (with Sky); look row JSON.
- `fire.ts` expanded into the rest-scene rows.
- Flags into generators + JSON.
- Delete `lastLight`, `dusk`, `sand`, `familyLook`, `sky`, `lightLook`, `fire` and `flags` from `data/`.
- Proof: look parity (the one batch that can change pixels; a board only if it differs).

**G (optional). Dusk to AssemblyScript (~20 TS cut, ~25 AS).**
- `behaviour/dusk.as` plus its scenario test (G455 (4)).
- Delete `look/dusk.ts` and the `duskOf` logic in `plugin.ts`.

## What stays (~384 lines, listed view code)

| File | Lines | Why it stays |
|---|---:|---|
| `world/build.ts` | 74 | Binds baked pieces, quest page prompts, well channels, braziers and the tower fire to admitted interaction rows, plus the SiteLights pool. View assembly on existing hosts (A10). Optional later: SiteLights config as rows (~10) |
| `plugin.ts` | 62 (~45 after G) | The `HybridRuntimePlugin` hooks: preload, fire FX compile, lent sand, skirt fit, dress, page fight, populate. Per-shard glue only |
| `world/fireFx.ts` | 40 | Places card groups, ember fields and pools on the SDK card/effect hosts, and owns the four firelight slots. Looks are already graph JSON (`generators/fireLook.ts`) |
| `runtime/looks/bakedGround.ts` | 37 | Generic skirt + lent material, but only Signal uses it (stretch 14 if a second user appears) |
| `world/places.ts` | 29 | Scene binder over `createWorldScene` / `bindWorldSceneParts`, plus fire/lamp anchors |
| `look/render.ts` | 26 | Builds the `paintedLook` call and the skirt/pool terrain hooks (stretch 15) |
| `world/meshes.ts` 14, `world/baked.ts` 10 | 24 | Thin host calls (`createModelLibrary`, `bakedMeshWorld`) with Signal's surface inputs |
| `models/gear.ts` 13, `roster.ts` 11 | 24 | Model Explorer catalogue builders over `modelCatalogue` |
| `look/light.ts` | 12 | Applies the painter light per material (opt-out flag) |
| `look/dusk.ts` | 11 | Dusk uniform + ease (goes with G) |
| `data/placeBindings.ts` | 6 | Literal part kinds type `WorldSceneBoundParts` for `world/build.ts`. JSON would widen them |
| `runtime/items/heldWhip.ts` 5, `runtime/source.ts` 3, `runtime/index.ts` 2, `boot/ground.ts` 5 | 15 | Entry, owner map, admitted product, baked ground field |
| Platform sole-user: `setGroundPools`/`GroundPool` 12, `painterLightPatch` 6, `hybridPresentation` 3, `runtimePresentation` 3 | 24 | Signal is the only user today. Each clears when Sky (painter light) or a tile shard (lent material) adopts it |

Expect +5–10 lines of plugin glue to read sections. That is inside the 28-line headroom, and batch G or stretch 15
covers it.

## Things to check while building

- **H-rows, held-recipe admission and painted-look admission are the platform growth (~150–180 lines).** Report them as
  net lines (G455 (1)) and land each with Sky's adoption.
- **Type widening from JSON.** Prefer typed product reads: `ctx.product.section(...)`, the parsed shardfile in
  `runtime/source.ts`, and the existing `parse*` admissions. Never `as unknown as`. Sky's `as SkyMeshName[]` casts on
  generated JSON are not a pattern to copy.
- **Don't open new custom sections** (G453 (3)). Use the existing platform sections `ui/strings`,
  `actors/species-programs`, `actors/strikes`, `combat/items`, `quests/*` and `sim/runtime-plan`, the shardfile fields,
  or generated JSON.
- **`scripts/generation-jobs.json` is shared and already modified in the working tree.** New job rows need a
  private-index commit (GIT.md).
- **Sim stays out of `runtime/`.** None of these moves adds sim to Signal's runtime. G453 is satisfied.
