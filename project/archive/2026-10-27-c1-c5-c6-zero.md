# C5 / C6 / C1 to zero on Nalati + Nine, then lock (G593, G571)

Measured at HEAD 64644270ed with `sourceProgressInventory()` in the `check` mirror slot (matches ruler 6bf8c2a6e):

| Component | Nalati | Nine | Total | Of which G520/G294 platform charges (sole-user hosts / exports) |
|---|---:|---:|---:|---|
| C5 NPCs and quests | 229 | 0 | 229 | 206 (eliteRosterPage 122, carriedProp 73, eliteEncounters 7, chapter 4) |
| C6 Items and combat | 280 | 63 | 343 | 312 (mounted 99, course 69+52, bowVariant 56, heldLauncher 19, effects/types 16, graphArms 1) |
| C1 Static world | 495 | 406 | 901 | 275 (runtimeSpecimens 74, shapeBook 62, speciesBook 48, mountedSpecimen 28, place.ts 19, basinBody 10, ...) |

Raw spans: `inv.json`, `c-spans.txt`, row map `rows.cjs` (all in this folder). 1,473 lines; every span below is in exactly one row.

## The rule that shapes everything

Two thirds of the count (793) is platform code with Nalati or Nine as its only real user, not shard files. G571 offers exactly
three honest exits per such host: (a) a real second shard drives it (test 1 passes), (b) it is reshaped until it passes HOST-BAR
tests 2–6 and is listed as a dated `- G571 ...` entry in docs/HOST-BAR.md with `module#binding` selectors (scripts/g571-hosts.mjs
reads only those), or (c) it dissolves into the shard's data + AS and the module is deleted. **Not allowed:** moving a file between
folders to change its component (eliteRosterPage is "C5" only because it lives in `game/quest/`; nightView is "C1" only because it
lives in `world/`): moving either is relabelling (G571 (3)). Every row lands on a falling ruler for its shard(s) with no rise in any
other component.

## Rows (lane-sized, disjoint files)

Effort: S < half a day, M ~1 day, L 2–3 days for one lane.

### C5 (229, Nalati only; Nine is already 0)

| Row | Lane | Spans (file#symbol, lines) | Conversion | Effort |
|---|---|---|---|---|
| **N5a** elite roster host | Codex | `game/quest/eliteRosterPage.ts` 1–130 (C5 122, C6 2: StrikeRunner/strikeFromData 51, 98); `game/shardfile/eliteEncounters.ts#KeeperSave,Keeper,EliteKeeperBindings` 7 | **Existing host → G571 listing after reshape.** Fails test 3 today: `RosterContext.rock`/`ledges`, taming `bonded`/`mount`, the herd `request` branch (mares/foals/stallion) and `wildEnv` grass/crouch are Nalati's shape. Move rock/ledges to roster rows; taming and kills to named observation rows; the `request`/`pack` spawns to declared spawn-op rows on the existing population owners; then list `game/quest/eliteRosterPage#EliteRosterPage` (+ `#EliteRosterRows`). Keeper exports: delete if dead after the reshape, else into the listed host. Per-frame `update` observation (~6) stays host code (generic, not view). | M |
| **N5b** carried quest prop | Codex | `game/quest/carriedProp.ts#CarriedQuestProp` 73 (G520 module charge); `game/quest/chapter.ts#installChapterStory` 4 (G294 export) | **Existing host → G571 listing.** Already rows + AS (`ReturnProgram`); fix the literal deck window (`deck<ground+2`) into a row, drop the module from `platform-chargebacks.mjs` modules map in the same commit that adds the HOST-BAR entry (tests 2–6 in `test/nalati-kokpar.test.ts` + a fixture second page). `installChapterStory`: delete if Nalati is its only caller via a path already on the quest host, else list. `carryPose` per-frame (6 lines) stays in the host. | S |
| **N1d** camp people + shepherd (C5 19 + C1 48) | Opus | `nalati/models/people.ts` 1–48 (C5 19, C1 20); `game/models/mountedSpecimen.ts` 28 (G520) | **Existing host reuse:** the five camp people become rows of the G571 quest figures host (`game/quest/figures#kitFigureCards`, Driftwood first) from `boot/peopleFrames.generated.json`; PEOPLE labels move to the generator. The mounted shepherd: `mountedSpecimen` → G571 listing (rows only already: mountedSpecimen.json + shapeRows) or a `seated` figure row on the same figures host. people.ts deleted. Check with sp-x9 ("mounted book") before starting. | M |
| **N0** state/index call sites (C5 4, C6 2, C1 5) | (fold) | `nalati/runtime/index.ts` 45, 64, 89; `runtime/state.ts` 86, 109, 123–125, 139, 157, 239 | **Folded into X41/O27** (sp-x8 owns runtime/{index,state}.ts): each line is a call into a row above; it dies when that row's host is declared. No separate lane. | – |

### C6 (343: Nalati 280, Nine 63)

| Row | Lane | Spans | Conversion | Effort |
|---|---|---|---|---|
| **N6a** declared loadout host | Codex | `game/loadout/mounted.ts` 99 (G520); `game/weapons/bowVariant.ts#VariantBowPower` 56 (G520); `game/weapons/heldLauncher.ts#names,PoolSchema,HeldBowFileSchema,bowLoads,loadHeldBow` 19; `engine/combat/effects/types.ts#SourceMulDef,anyTag,sourceMultiplier` 16; `nalati/weapons/loadout.ts` 1–16 (C6 7, C1 1) | **New host `game/loadout/declaredLoadout`** (rows: slots of kind blade / bow / polearm / firearm with profile ids, refill and upgrade-power rows, mount state). `MountedLoadout`'s fixed `base/bow/sabre/spear` fields fail test 3; the slot rows replace them. **Second real user:** Nine's jian (`game/loadout/declaredMelee`, G571) becomes a one-slot row of the same host, so test 1 passes honestly and `mounted.ts` + `declaredMelee` merge. bowVariant: its pierce-prediction contact law already decides in AS; the host keeps it as a generic `charged-pierce` variant row (sourceMultiplier/heldLauncher exports become host internals with two users or get listed). loadout.ts → product rows (gear.generated.json already holds them); file deleted. | L |
| **N6b** one course controller | Codex | `game/practice/course.ts#MountedCourseController,HookCourseController,hookCoursePad,yawToward,HookCourse*` Nalati 69, Nine 52 | **Existing host with two REAL users** (X42 already put the laws in AS). Merge the two controllers into one row-driven `CourseController` (pad/gate geometry, start/restart, mount-or-hook entry as an entry-kind row on existing riding/grapple owners); no `kind === 'horse'` branch left (test 2). Then remove the course entries from the `declarations` map in platform-chargebacks.mjs with the re-score note G520 asks for. | M |
| **D6** Nine gear | Opus | `nine/models/gear.ts` 1–34 (C6 10, C1 5); `game/systems/viewmodel/graphArms.ts` 75, 77, 111, 123, 155 (C6 1, C1 4) | **Existing host reuse:** `fpArms` becomes a catalogue row consumed by the listed `graphArms#graphArmsSpecimen` (metadata.generated.json already has the model row); the GEAR roster entry becomes a roster row. graphArms's 5 lines sit in unlisted bindings: add them to the existing G571 graph held view entry only if they are that host's own code, else move into listed bindings. | S |
| (in N1c) | | `nalati/species/balbal.ts` 18–68 C6 7 | with N1c | |
| (in N5c) | | `nalati/world/nightView.ts` 27–33 C6 3 | with N5c | |

### C1 (901: Nalati 495, Nine 406)

| Row | Lane | Spans | Conversion | Effort |
|---|---|---|---|---|
| **N1a** specimen + shape books | Opus | `game/models/runtimeSpecimens.ts` 74; `game/models/shapeBook.ts` 62; `game/looks/speciesBook.ts#SpeciesLookBook,packedRows` 48 (G520); `game/models/specimenCatalogue.ts#replaceSpecimenInstance` 8; `nalati/roster.ts` 18–34 (6); `runtime/looks/rider.ts` 16, 58 (2); `models/reins.ts` 1–8 (6) | **Existing hosts → second user or G571 listing.** shapeBook/runtimeSpecimens/speciesBook are already row-driven (generated JSON in, models out); audit tests 2–6, fix any Nalati literal, list `game/models/shapeBook#...`, `game/models/runtimeSpecimens#...`, `game/looks/speciesBook#SpeciesLookBook`. Driftwood's specimen catalogue is a candidate real second user for `replaceSpecimenInstance`; else delete it. roster.ts → roster rows from the generator (counts already in ecology/gear JSON); reins → a reins row on `game/riding/reins#reinSpecimen` (pure data); rider.ts lines go with O27's `loadShepherdRider`. | M |
| **N1b** Nalati POI view | Opus (= O27) | `nalati/world/view.ts` 1–65 (54) | **Existing host reuse:** POI sequence → `game/shardfile/worldAssembly` stages (G571, Driftwood first: `place`/`site`/`group` kinds) + `sceneDressing` pieces; the balbal `live` piece → encounter-site row; roads lettering → a shapeBook lettering row; smoke → a lent-look instanced-quad row (the per-frame `setLentParam` wind/shade/sun, ~4 lines → WASM view lane or a generic lent-look param binding). File deleted. **This is O27's `buildNalatiPOIs` item: run it as O27 with C1 = 0 for view.ts as acceptance.** | M |
| **N5c** Nalati night encounters (C1 56, C6 3) | Opus (= O27) | `nalati/world/nightView.ts#NalatiNight` 1–67 | **New host `game/boss/timedEncounters`** over the existing `SlotEncounterView`/`PatrolEncounterView` (charged C4 today) from the existing `TimedEncountersRows` + its ReturnProgram guest; strike contact via strike rows. One user → G571 dated exception (tests 2–6). Any per-frame dissolve/fade presentation → WASM view lane. **O27 item (`NalatiNight`).** | M |
| **N1c** balbal statues | Opus | `nalati/models/balbal.ts` 1–32 (13); `nalati/species/balbal.ts` 18–82 (C1 2, C6 7); `species/presentation.ts` 11–62 (5) | **Existing hosts:** balbal geometry → shapeBook rows (N1a lands first); crack geometry → baked geometry row read by the specimen catalogue; strike lines → strike rows on the elite/encounter host (N5a/N5c). presentation.ts is in O27's "species presentation factories": coordinate. | S |
| **N1e** terrain channels + water/collider exports | Codex | `nalati/world/geography.ts` 1–38 (34); `nalati/wet.ts` (2); `nalati/manifest.ts` 30–31 (2); `species/eagle.ts` 11 (1); `engine/world/water/body.ts#basinBody` 10; `engine/physics/heightPatch.ts` 37–44 (4); `game/population/environment.ts#populationTerrain` 6; `game/plugin/brain.ts#nativeHuntGround` 3; `engine/core/gpuOnly.ts#rebakes,onGpuRestored` 6 | **New host `game/world/terrainChannels`** (or a format section on the existing baked-terrain field): the manifest declares named baked channels (wet, forest, valley, bowl, snow, rgb) and the ground/colour recipe as rows; consumers (wet walker, forest mask, eagle height) ask by channel id. One user → G571 exception (Pine's forest mask is a candidate second user: check). basinBody / populationTerrain / nativeHuntGround / heightPatch: becomes rows on their existing owners or are listed with the channels host; gpuOnly `rebakes`: delete if dead. | M |
| **N1f** spruce | Opus | `nalati/world/spruceView.ts#SpruceFactory` 1–55 (37) | **Generator + data:** the painterly LOD materials (rim/bands/sway) become look rows on the existing `TreeFactory`/painterly hosts and the LOD geometry a build-time bake (generator), so the subclass goes. Graphical: first-frame parity check. | M |
| **D1a** Nine world build (= O28) | Opus (sp-o5) | `nine/world/build.ts` 1–292 (190); `nine/plugin.ts` 26–65 (17); `look/render.ts` 89, 122, 124, 141 (4); `runtime/state.ts` 19 (1) | **Existing host extension:** the build becomes `game/shardfile/worldAssembly` stage rows (Driftwood is its first user; Nine makes two real users, O13's goal): add generic stage kinds `kits` (merged kit meshes + far distances), `drawnInto`, `facade` (instanced placements from baked f64 records), `spill` (see D1b); `NineDragonWorld.update/cull` stay in the listed render.ts or go to the WASM view lane. **This is O28's world/build.ts item: give O28 C1 = 0 on these files as acceptance.** | L |
| **D1b** Nine baked bounds + spill | Codex | `nine/world/layoutBake.ts` 1–55 (38); `nine/world/casts.ts#loadSpill` 1–42 (36) | **Existing hosts:** bounds already bake offline (O19) → a `bounds` row on the world-scene geometry admission (Pine / Far Reach rest pools are the pattern; check for a second user); spill → per-vertex colour bins loaded by the G571 `game/looks/vertexWear` host (Driftwood first) as a second user. Both files deleted. | M |
| **D1c** Nine kit meshes + drawn-in | Opus (sp-o5, after its drawnInto boxes) | `nine/runtime/kit/drawnInto.ts` 1–35 (18); `runtime/kit/kitMeshes.ts` 1–29 (18) | **Existing host:** the G571 `game/models/fixedDraws` host (Driftwood) or the D1a `kits` stage; drawn-in copies go through engine `place()`'s existing `drawnInto` path with the boxes sp-o5 is baking. Same lane as D1a, sequenced after it. | S |
| **D1d** Nine signs + model look | Opus | `nine/models/signs.ts` 13–44 (23); `nine/world/modelLook.ts` 1–34 (18) | **Data + existing host:** sign variants already come from rows; the model def becomes a world-scene catalogue row (`defineWorldSceneCatalogue`) with the atlas key as a row field; the neon model context becomes a lent-look row on the shared model context. Both files deleted. | S |
| **D1e** Nine one-user exports | Codex | `engine/models/place.ts#_near,copiesAt,shareOf` 19; `game/shardfile/worldScenes.ts#WorldScenePoolPublications` 7; `format/worldScenes.ts` 5; `game/shardfile/scenePools.ts#WorldSceneTierPools` 2; `game/shard/plugin.ts#worldBuildYield` 1 | **Dead code or second user:** delete what D1a leaves unused; worldScenes tier pools / publications: Driftwood/Pine adopt them (they use world scenes) or they are listed with the world-assembly entry after a 2–6 audit. Runs last on Nine (after D1a). | S |

## Totals per component → rows

- **C5 229** → N5a (129), N5b (77), N1d (19), N0 (4, folded).
- **C6 343** → N6a (197), N6b (121), D6 (11), N1c (7), N5c (3), N5a (2), N0 (2).
- **C1 901** → D1a (212), N1a (206), D1b (74), N1e (68), N5c (56), N1b (54), N1d (48), D1d (41), N1f (37), D1c (36), D1e (34),
  N1c (20), D6 (9), N0 (5), N6a (1).

New hosts (G571 dated exceptions unless a second user is found): `game/loadout/declaredLoadout` (two real users: Nalati kit +
Nine jian, so no exception), `game/boss/timedEncounters`, `game/world/terrainChannels`, worldAssembly stage kinds `kits` /
`drawnInto` / `facade` (two real users: Driftwood + Nine). Existing modules to reshape and list: eliteRosterPage,
carriedProp, shapeBook, runtimeSpecimens, speciesBook#SpeciesLookBook, mountedSpecimen; course.ts merges (two real users).

**WASM view lane share:** small, ~40–60 lines (~4 %): smoke params in view.ts, nightView dissolve/fade, Nine `update/cull`
if not already in listed render.ts. Everything else is construction, binding or decisions already in AS.

## Lanes and order (critical path)

Codex (parallel now): N6a (L, critical for C6), N6b, N5a, N5b, N1e, D1b, D1e (last on Nine).
Opus: O27 lane takes N1b + N5c (+ the presentation part of N1c); O28 lane (sp-o5) takes D1a → D1c; a third Opus lane takes
N1a → N1c → N1d → N1f; D6 + D1d fill any idle Opus slot.

**Critical path:** C1 = O28's D1a (L, after sp-o5's drawnInto boxes) → D1c → D1e on Nine, and N1a → N1c → N1d on Nalati.
C5 closes first (N5a + N5b + N1d; ~2 days). C6 closes on N6a (~3 days).

## Lock step (how C3/C7/C8 were locked)

`lint/ratchet.json` holds `closedComponents` (per-shard component ids that must measure 0) and `closingComponents`
(per-shard shrink-only counts for platform charges still left once a shard's own files are clean). `scripts/check-closed-components.mjs`
enforces both: `--source-only` in pre-commit (run by `scripts/check-staged-inputs.mjs`), the full ruler census via
`shard-platform-cli.mjs`, and `compareClosedComponents` (in check-staged-inputs + check-platform-ratchets) refuses any lock removed or
raised. At HEAD C7 is in `closedComponents` for all four shards with `closingComponents` `C7: 0`.

Steps: (1) **lock Nine C5 now** (already 0): add `C5` to `nine-dragon-stack` closedComponents. (2) When a component's last
shard file span is gone but sole-user platform charges remain, add it to `closingComponents` at the measured count (shrink-only).
(3) At 0 on both shards: add the id to `closedComponents` for `nalati-grasslands` and `nine-dragon-stack` and set its closing count to
0, in the same commit as the last cut, with a ruler refresh. Locking Nine C6 early: it is 63, so only after N6b + D6.

## Decisions for Jake

1. **Listing existing one-user hosts.** G571's day-one credit was written for "new hosts" on Pine/Driftwood. About 400 lines
   here clear only by reshaping and listing existing G520-charged modules (eliteRosterPage, carriedProp, shapeBook,
   runtimeSpecimens, speciesBook, mountedSpecimen). Recommend **yes: same terms as G571** (reshape until tests 2–6 pass, logged
   dated entry, the cheating audit checks each one). Without this, C5/C1 cannot reach zero short of multi-day ports.
2. **WASM-HOST scope.** WASM-HOST's state still scopes H9 to Pine and Driftwood. Recommend Jake confirms G593 covers the ~50 view
   lines here; nothing waits on it (they can ride the v2 view-module path deckCameraSway already uses).
3. No other pick needed. Coordinator notes, not Jake: fold N1b/N5c into O27 and D1a/D1c into O28 as acceptance criteria; check
   sp-x9's "mounted book" against N6a/N1d before those start.
