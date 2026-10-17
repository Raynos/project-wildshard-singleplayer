# Nalati Grasslands under 20 %: mini plan and feature brainstorm

Read-only planning page for `src/shards/nalati-grasslands/`, made on 2026-10-17 (W3 shard; the sibling plans are Pine,
Driftwood and Nine). Basis: the ruler at `93a250445` (10-17 05:31 Cancun) gave **Nalati 20,971 custom / 28,370 legacy =
73.9 %**. The 20 % goal is **≤ 5,674**. The AssemblyScript (AS) ceiling is **2,837** (10 % of legacy, G463 (4)); Nalati
already ships 162 AS lines, which leaves room for **≈ 2,675**.

**Measured today** (HEAD `cc600120e`, plus the uncommitted Nalati lane work in the shared tree): **20,065 custom = 70.7 %**.
That is 19,116 shard lines in 192 files plus 949 G294 sole-user platform lines. The cut still needed is **≥ 14,391**.
- The lane work in flight is worth about −435 shard lines: sp-x6 `world/paint.ts` + `models/signpost.ts` bake,
  sp-x1 `manifest.ts`, `world/painted.ts`, and `creatures/sheepRaid.ts`. Committed HEAD alone is about **20,500 (72.3 %)**.
- Since the ruler: Kurgan, layout/clearings and Storm Titan graphs landed (`b65a4de9f`, `ce0f35146`, `75e8f545a`).

## Verdict

**Yes, but only just, and only with all four steps.** On the estimates below:

| After | Nalati custom | % | What it takes |
|---|---:|---:|---|
| Today | 20,065 | 70.7 | — |
| Step 1: easy and medium wins (no AS, no new feature) | 15,672 | **55.2** | 10 batches, −4,393 |
| Step 2: the approved G473–G477 features (25 % held back) | 10,510 | **37.0** | −5,159 of 6,879 absorbed |
| Step 3: five new platform features (25 % held back) | 8,077 | **28.5** | −2,432 of 3,242 absorbed |
| Step 4: single-shard laws to AssemblyScript (G470) | **≈ 5,535** | **≈ 19.5** | ≈ 2,540 TS lines → ≤ 2,675 AS |

- The margin at the end is only about **140 lines**. Every step must deliver about 90 % of its estimate, so the honest
  band is **19.5–24 %**. The levers that widen the margin are below ("Margin").
- **Without step 3, Nalati cannot get under 20 %.** Riding and taming alone are 1,849 lines (1,398 shard + 451 platform),
  which is 69 % of the AS room. They are not single-shard logic in kind: mounts are a generic game feature.
- **Without AS, the floor is about 28.5 %.** The view code that stays (≈ 4,400 plus about 1,135 view held back) is
  already 98 % of the 5,674 budget. So the logic has to leave TypeScript completely.

## How the lines were counted (reproduced, read-only)

- **Method:** an in-process import of `sourceProgressInventory` from `scripts/shard-platform.mjs`, with
  `WS_SHARD_PARSE_CACHE` unset. No CLI, no generate step, nothing written. The `git status` changes during the run were
  other lanes' work (sweepguard ledger, the gate mirror).
- **Result:** Nalati row 20,065 = 19,116 `runtime-ts` + 66 sole-module + 883 sole-export. `rawGlslLines` is 522.
- **Rules applied:**
  - Counted: every `.ts` file outside `generators/`, tests and `.d.ts`. `data/*.ts` counts; JSON never does.
  - `manifest.ts` (36) and `shard.config.ts` (31) both count, because neither is declaration-only yet.
  - `ktx2.generated.ts` (81) and `boot/declaration.generated.ts` (17) are not counted on the source basis. They would
    count on the P4 output basis, so emit them as JSON before the re-base.
- **Importers:** every counted file was checked against `src/`, `scripts/` and `test/`, plus a reachability walk from the
  play roots and the headless root:
  - play roots: `manifest.ts`, `plugin.ts`, `runtime/index.ts`, `roster.ts`, `look/render.ts`, `world/spruceView.ts`,
    `combat/stormTitan.ts`;
  - headless root: `boot/headlessModules.ts`.
- **Platform charges (949):**
  - `game/plugin/mover.ts` 451 (MountedBody 194, MountedReins 103, roadSteer 40, RhythmSpur 25 and the rest)
  - `game/systems/looks/grassField.ts` 152
  - `game/plugin/weaponFamily.ts` 83
  - `sdk/looks/tileField.ts` 44
  - `engine/core/ktx2#readTexturePixels` 23
  - `heldLauncher#loadHeldBow` 19
  - `engine/combat/targets.ts` 18
  - `rainCurtain` 17, `directorClient` 17, `crowdRuntime` 16, `nalatiArms#forearm` 16, `effects/types` 16, `painterly` 14
  - about 60 in 1–9-line spans
- The honest floor's `sdk/compileScript.ts` (97) and `geometryKit` (101) charges are gone.

## Step 1: easy and medium wins (no AS, no new feature), ranked

Effort: S is under half a day, M is 1–2 lane-days, L is up to 5. G468 applies: each commit deletes whole runtime files or
modules and lands their data path; parity runs once per about 5 commits.

| # | Batch | Files (estimated cut) | Technique | Cut | Effort | Lane | Running total |
|---:|---|---|---|---:|:-:|---|---|
| B1 | **Dead keepers** | `runtime/qaraKeeper.ts` 132, `runtime/ghostRosterKeeper.ts` 132, `runtime/ghostLineKeeper.ts` 120, `runtime/ghostVolleyKeeper.ts` 54, `runtime/headlessGhost.ts` 18, `runtime/qaraBrain.ts` 16, `data/qaraBrain.ts` 12 | **Dead code.** No play or headless root reaches them (the class names occur only in their own definitions; Qara runs on `behaviour/qara.as` since SF82 `aa6c10b81`). They are imported only *as types* by five orphan test fixtures (`test/fixtures/nalati-{qara,ghost-line,ghost-volley,ghost-roster}-oracle/shipping.ts`), which no test or script loads. Delete them together | 484 | S | Codex | 19,581 · 69.0 % |
| B2 | **Build-only, types, config** | `data/campParams.ts` 157 (types only, imported only by generators); `look/far.ts` 13 (read only by the far baker, through its `data/placeholder.json` row; `generators/farLook.ts` is far-reach's precedent); `boot/headlessModules.ts` 47 (generated proof catalogue, "never shipped with play": register it as a generation output or emit it from JSON, as Pine row 6(d) does); `shard.config.ts` 31 → `generators/product.ts` (declaration-only, the Sky and DW precedent); `plugin.ts` 12 (declared hybrid entry, DW item 11); `manifest.ts` 36 (finish sp-x1: dev poses, forest mask and navmesh exclude become bindings, so the manifest is declaration-only); `thrownProfile.ts` 6, `raidClock.ts` 5 (type-only, so `.d.ts`); the two `*.generated.d.json.ts` 4 (emit as `.d.ts`) | Build-only to `generators/`; types to `.d.ts`; declaration-only entries | 311 | S | Codex | 19,270 · 67.9 % |
| B3 | **Data in TS to JSON** | `combat/strikes.ts` 40, `data/eliteEncounters.ts` 37, `data/species/faunaGameplay.ts` 35, `ride/input.ts` key rows 30, `playground/horseCourse.ts` 18, `data/brains.ts` 17, `data/fauna.ts` 17, `combat/spawns.ts` 15 (the `when` closures become tag rows), `data/species/*` 21, `flockRows` 7, `modes` 3, `crowds` 1 | Data rows; the layout anchors are already JSON (`layout.generated.json`) | 241 | S | Codex | 19,029 · 67.1 % |
| B4 | **Looks to graph JSON** | The 12 `runtime/looks/*Glsl.ts` modules (sky 85, lookBake 62, motes 51, air 49, rain 44, cloudSea 43, grade 41, crag 35, fog 31, bowl 19, tint 18, light 9), the flock's sheep shader (60), and binder trims in `look/bake`, `grade`, `air`, `fog` (70) | Raw GLSL to look-graph rows. The Titan precedent (`75e8f545a`) removed 143 GLSL + 10 binder lines; fog graphs exist (`908dcec0a`). Two commits: the post chain (≈ 330), then the world and flock (≈ 290). One board per commit | 617 | M | **Opus** (ON lane is on "Nalati graphs + flock") | 18,412 · 64.9 % |
| B5 | **W3 host adoption: creatures** | `species/balbal.ts` 90 (stride, swing, rise/sink, memory actions), `creatures/flock.ts` 70 (`PosedInstances`), `runtime/baked.ts` 60 (`createNativeBakeReader`), `creatures/wildlife.ts` 50 (spawner, site selection), `creatures/wildPlacement.ts` 45 (`sampleCreatureGroup`), `runtime/headlessCreatures.ts` 40 (`bakedHuntGround`, species context), `species/bodies.ts` 40 (`packedCreatureBodies`), `species/hulls.ts` 30 (`ResourceMemo`), `runtime/flockDeclared.ts` 20 | Existing hosts. Each row is already filed in `open-x-queue.md` "W3 Nalati … (G441)"; none is adopted yet (grep: zero uses in Nalati). **Double win:** this turns Pine's and DW's pending entries into real shared hosts before the end-of-W3 recount | 445 | M | Codex | 17,967 · 63.3 % |
| B6 | **W3 host adoption: look, world, items, NPC** | `look/skyRig.ts` 60 (`driveDayAir`), `runtime/weapons/javelinSpear.ts` 60 (`HeldHandParts`, `ProjectilePresentation`), `world/installWeather.ts` 50 (overcast rows), `world/places.ts` 50 (`registerPlaceSets`), `tileField` 44 (G395 Sky meadow pairing), `world/WeatherFX.ts` 40 (`stepRainFall`), `weapons/nalatiSkins.ts` 40 (`selectEffectGrants`, locker cards), `runtime/headlessTaming.ts` 40 (native pose roster), `models/npc/figureMotion.ts` 40 (head focus, facing), `world/solid.ts` 30, `bag.ts` 30 (`createFindsCatalogue`), `campPeople.ts` 30, `combat/ghostRiders.ts` 30, ghost volley and raid directors 30, the Golden King pair 35 | Existing hosts (the same W3 rows); three commits | 609 | M | Codex | 17,358 · 61.2 % |
| B7 | **Explorer cards to rows** | `models/creatures.ts` 50, `glacierSnout` 45, `gear` 40, `catalogue` 40 (the `catalogue.model('x')` list comes from the JSON), `balbal` 35, `cragRock` 30, `reins` 20, `dressing` 20, `people` 10, `roster.ts` 15, `specimenCatalogue#awaitSpecimenAssets` 9 | Specimen-catalogue and roster rows (`defineSpecimenCatalogue` is already used; DW item 12 precedent) | 314 | M | Opus | 17,044 · 60.1 % |
| B8 | **World assembly to scene rows** | `runtime/state.ts` 150 (water to `clientWater` rows, crags and outcrops to props rows), `world/placeBake.ts` 120, `world/Bowl.ts` 110, `world/painted.ts` 90, `world/index.ts` 60, `world/modelView.ts` 60, `world/KurganDungeon.ts` 60 (what static is left after `b65a4de9f`), `combat/nightFx.ts` 50 (effect rows on `ParticlePool`), `world/Balbals.ts` 30, small POI files 42, `world/solid.ts` + `world/types.ts` 40, `runtime/index.ts` wiring 30 | Baked world-scene and placement rows (`createWorldScene`, `bakedMeshWorld`, props host); three commits with before/after boards. Needs the painterly material as a lent look (see pick 3) | 842 | M–L | Opus | 16,202 · 57.1 % |
| B9 | **Geography bake** | `world/terrain.ts` 250, `edge.ts` 45, `look/minimap.ts` 45, `runtime/heightPatch.ts` 20, `look/zones.ts` 20, `wet.ts` 15 | Analytic river, brook, bowl, berm and forest masks become baked rasters read through the engine's baked samplers. `terrain.bin` is already admitted as query-only terrain. The honest-floor condition holds: every edge and floor consumer must use the same sampler first. The trail SDF and paint bindings stay | 395 | L | Codex | 15,807 · 55.7 % |
| B10 | **NPC figure rows (H9)** | `campPeople.ts` 70, `campPeopleModels.ts` 35, `models/people.ts` 30 | Lands on the H9 figure-rows host the Pine and DW plans build (their rows 1 and 22) | 135 | M | Codex | 15,672 · **55.2 %** |
| | **Step 1 total** | | | **4,393** | | | |

Also small: about 60 lines of product-read valibot schemas (`runtime/baked.ts`, `world/dressing/layer.ts`,
`combat/stormTitan.ts`, `runtime/flockDeclared.ts`) can move to the build once the typed custom-section reader lands with
Pine and DW (their batch 3). These lines are already inside B5, B8 and the feature rows, so they are not added again.
Save and continuation schemas stay.

## Step 2: reuse of the approved features (G473–G477)

Each row lists the gross Nalati lines the feature absorbs; the cut is 75 % (25 % held back for parts that won't
generalise). The order is G477's shared-first order.

| Feature | Nalati files it absorbs (gross lines) | Gross | Cut 75 % |
|---|---|---:|---:|
| Quest step runner | `adventure.ts` 110 (clue carving, boss and taming polls as steps; the reading roster is already tagged quest-step-runner), `kokpar.ts` 20, `runtime/index.ts` feats 20 | 150 | 113 |
| Native actor interface + spawn director | `runtime/headlessCreatures.ts` 400, `combat/ghostRiders.ts` 200 (night line roster), `combat/balbalWarriors.ts` 140 (wake at dusk, sink at dawn as a time-of-day spawn rule), `creatures/wildlife.ts` 110, `creatures/flock.ts` 100, `creatures/sheepRaid.ts` 100 + `runtime/headlessRaid.ts` 90 (raid as a director encounter), `runtime/groups.ts` 90, `runtime/headless.ts` 80, `species/balbal.ts` 60, `runtime/group{Ports,Dispatch,Declared,Registry,Host}.ts` 172, `creatures/sheepdogBrain.ts` 50, `runtime/state.ts` 40, `combat/night.ts` 35, `creatures/env.ts` 30, directors 33, `crowdRuntime` 16, small 34 | 1,800 | 1,350 |
| Boss fight host | `combat/stormTitan.ts` 520 (phases, telegraphs, arena, rewards, continuation), `combat/goldenKing.ts` 200, `world/KurganDungeon.ts` 160 (lid, shafts, beam, heap as arena rows), `species/goldenKing.ts` 60, `combat/stormTitanLook.ts` 30, `combat/damage.ts` 6 | 976 | 732 |
| Held viewmodel arms + loadout/ammo/skins | `runtime/weapons/javelinSpear.ts` 300 (thrust, throw, pickup as held and thrown rows), `weapons/nalatiSkins.ts` 140, `runtime/weapons/Naizagai.ts` 120 and `GoldenBow.ts` 110 (legendary variants as weapon rows), `weaponFamily` 83, `runtime/weapons/mountedSword.ts` 60, `weapons/loadout.ts` 50, `models/gear.ts` 30, `heldLauncher` 19, `nalatiArms` 16, `effects/types` 16, small 33 | 977 | 733 |
| Living buildings | `world/Flutter.ts` 100 (pennants and ribbons on yurts and poles as building-life nodes), the camp smoke plumes in `world/index.ts` 30 | 130 | 98 |
| Collections and display | `bag.ts` 15 (sticker sections beyond `findsCatalogue`) | 15 | 11 |
| Streamed cover | `world/dressing/index.ts` 170, `world/dressing/layer.ts` 120 (already the W3 `CellWindow` row), `models/dressing.ts` 60 | 350 | 263 |
| H6 ambient life | `world/dressing/life.ts` 130 (pollen, butterflies, raptors; `CirclingFlyer` is pending), `creatures/marmots.ts` 60, `models/ambientLife.ts` 60, `marmotBrain` 10 | 260 | 195 |
| Contracts + elites | `combat/elites.ts` 380, the four elite keepers (`aqbars`, `kokbori`, `argymaq`, `qyran`) 97, `species/eagle.ts` 15, `eliteBrain` + `eliteRoster` 14 (no Nalati contracts) | 506 | 380 |
| Quadruped rig + foot IK | `species/horse.ts` 110, `species/hulls.ts` 70 (`riggedHulls` is already tagged quadruped-rig), `wolf` 50, `ghostRider` 50, `rows` 30, `leopard` 30, `bodies` 20, `kokbori`/`rigs`/`bodyKey`/`sheepdog` 50 | 410 | 308 |
| Weather reactions + keyed sky | `world/WeatherFX.ts` 180, `world/Lightning.ts` 150 (tall-target strikes as reaction rows), `look/skyRig.ts` 120, `combat/stormTitan.ts` 80 (storm strikes), `world/installWeather.ts` 80, `world/weatherStep.ts` 40, `runtime/state.ts` 40, `runtime/headless.ts` 40, `rainCurtain` 17, small 19 | 766 | 575 |
| Toon look host (**widened to painterly: pick 3**) | `look/terrainPainter.ts` 120, `look/sky.ts` 80 (the 360° panorama dome), `look/bake.ts` 60 (baked shadow and contact capture), `world/modelView.ts` 40, `look/index.ts` 30, `look/{grade,nalatiTextures,air,fog,light,tint,cloudSea,render,creatureMaterial}.ts` 140, `painterly`/`offscreenPreparation`/`paintedTerrain` 29 | 499 | 374 |
| Resident world | `runtime/state.ts` 20, `runtime/index.ts` 10, `runtime/enteredEnvironment.ts` 10 (`plugin.ts` already calls `prepareHybridShard` with `retainHomeRuntime`) | 40 | 30 |
| Pending-user marks | Nalati has no approved mark yet; see pick 2 for `mover.ts` and `grassField` | 0 | 0 |
| **Step 2 total** | | **6,879** | **5,159** |

## Step 3: new missing features (not on the approved list; generic and data-driven)

| # | Feature | What it is (rows) | Nalati files (gross) | Gross | Cut 75 % | Future users | How sure |
|---:|---|---|---|---:|---:|---|---|
| N1 | **Mounts, riding and taming** | Mount and dismount, gait table, reins steering and road-follow (`roadSteer`), spur rhythm, stamina and trust HUD atoms, mounted weapon passes and lance contacts, horse naming. Taming is a rows state machine: approach, trust, buck, bond, reward | `game/plugin/mover.ts` 451 (already platform, Nalati is the sole user), `ride/Mount.ts` 330, `runtime/tamingLaw.ts` 220, `runtime/headlessMounted.ts` 200, `ride/RideHUD.ts` 150, `ride/ride.ts` 130, `ride/Reins.ts` 90, `runtime/weapons/mountedSword.ts` 70, `runtime/headlessTaming.ts` 70, `javelinSpear` lance 60, `ride/Taming.ts` 35, `runtime/playerModes.ts` 25, small 18 | 1,849 | 1,387 | Any open-world WorldClaw shard with a mount; Sunscar's strider if it becomes rideable (not verified); Nine's rides are portal transit, not mounts | High that it is generic (the shape is standard), medium on taming as rows. **Essential: no 20 % without it** |
| N2 | **Audio cue director + generated voice rows** | Zone beds with hysteresis and a storm sink, seeded distant calls, surface-to-hoof and footstep maps, and event cue rows on the existing `declaredAmbience`. The procedural synth voices become generated SFX (MOSS / Stable Audio, per AGENTS) | `runtime/audio/synth.ts` 300, `runtime/audio/sound.ts` 150, `runtime/audio/SteppeAmbience.ts` 100 | 550 | 413 | Every shard has zone beds and surfaces (Pine, DW, Sky, Nine audio installs) | High for zones and surfaces; medium for replacing the synth (it changes the sound: pick 4) |
| N3 | **Grass field rows** | GPU blade rings, shader flowers, height texture, trample movers and mood as rows on `GrassField` and `tileField` | `look/grass.ts` 230, `grassField` 152, `look/trampleMovers.ts` 15 | 397 | 298 | Sky meadow (`tileField`, G395), Pine ground cover, any grassland shard | Medium (needs one shared look for camera-ring and tiled fields) |
| N4 | **Practice courses** | Track or oval, posts, gates, jumps, ride-through checkpoints and a lap timer as rows on the engine `Playground` host | `playground/HorsePlayground.ts` 200, `kokpar.ts` 50, `playground/registration.ts` 6 | 256 | 192 | **Nine** `playground/GrapplePlayground.ts` + `runtime/tools/hookCourse.ts` (a real second user today); DW or Sky race ideas | Medium |
| N5 | **Stealth and detection** | Crouch, cover concealment from a density field (grass), downwind scent, and a detection meter and HUD cue, feeding `AnimalSim` senses (`hearCrouch` and the like are already generic species tuning) | `stealth.ts` 190 | 190 | 143 | Pine (stalking elk), Sunscar, any hunting shard | Medium |
| | **Step 3 total** | | | **3,242** | **2,432** | | |

Considered and folded in rather than new:
- Lightning target picking goes into weather reactions.
- Statue wake and sink goes into the spawn director's time-of-day rule.
- Kurgan chamber attachments go into the boss host's arena.
- Thrown javelin persistence goes into held + loadout as a thrown row.
- Herding and raids go into the spawn director.
- Cloth goes into living buildings.

## Step 4: the path to 20 % and what stays

**AS move (G470), about 2,540 TypeScript lines, inside the 2,675 AS room:**
- The explicit single-shard law, 1,155 lines:
  - `combat/stormTitan.ts` 200 (cloud patching, tie/leash mounted exam, grass fire)
  - `species/balbal.ts` 100 (crack law)
  - `combat/elites.ts` 93 (Qara wheel, charge, paired rider tells)
  - `combat/ghostRiders.ts` 80 (Qara coupling)
  - `runtime/weapons/Naizagai.ts` 80 (lightning power)
  - `runtime/tamingLaw.ts` 76 (bond and reward specifics)
  - `combat/goldenKing.ts` 65, `GoldenBow` 60 (sun arrow)
  - `headlessCreatures` 54, `sheepRaid` 50, `balbalWarriors` 46, `Lightning` 40, `species/goldenKing` 40, `headlessMounted` 32,
    `adventure` 31, `nalatiSkins` 30 (saddle mask), `headlessRaid` 26, `sheepdogBrain` 20, `shepherdRule` 18, `argymaqKeeper` 14
- The logic share of the 25 % held back from the logic-heavy features, about 1,387 lines: spawn director, boss, elites,
  quest, stealth, and half of ride, weather, held and course.
- It fits only if the AS is no larger than the TypeScript it replaces (≤ 1.05×). The Pine and DW plans assume AS plus
  data is denser.

**What stays as view code (≈ 4,400 lines plus ≈ 1,135 view held back, so ≈ 5,535 at the end):**

| Files (lines left) | Why it stays |
|---|---|
| `world/terrain.ts` ≈ 170, `edge`/`wet`/`minimap`/`zones` ≈ 50 | Trail SDF and paint bindings that the grass, painter and stealth read live every frame |
| `creatures/flock.ts` ≈ 164 | Wool colours, culling bounds, the native flock clock and the posed draw (W3 row keeps these) |
| `world/KurganDungeon.ts` ≈ 156 | Live chamber handles the King fight animates (sand heap, pours, rings) |
| `runtime/state.ts` ≈ 140, `runtime/index.ts` ≈ 126, `runtime/headless.ts` ≈ 60 | Cross-system update order and page install sequence until H11 index boot |
| `world/placeBake.ts` ≈ 124, `world/index.ts` ≈ 77, `world/painted.ts` ≈ 70, `world/modelView.ts` ≈ 67, `world/Bowl.ts` ≈ 94 | Painterly model adoption and the live set anchors (cloth, smoke, floors) |
| `runtime/weapons/javelinSpear.ts` ≈ 122, weapon remainders ≈ 140 | Posed rig clocks, palette, the couch pose |
| `combat/stormTitan.ts` ≈ 111, `combat/stormTitanLook.ts` ≈ 67 | Titan puff and fire-pool drawing (a single-shard visual) |
| `look/grass.ts` ≈ 78, `world/WeatherFX.ts` ≈ 77, `look/skyRig.ts` ≈ 70, `look/bake.ts` ≈ 62, `look/terrainPainter.ts` ≈ 55 | Painterly presentation the hosts do not express (moon disc, corona, painted dome uniforms, flash tint) |
| Species, HUD and model remainders ≈ 900 | Rig fit and attachments (saddle, eyes), RideHUD layout, Explorer card hookups |
| Platform: `ktx2#readTexturePixels` 23, `combat/targets` 18, `directorClient` 17, small ≈ 40 | No second user named |

### Margin (≈ 140 lines is too thin; these widen it)

- **H11 index boot:** `runtime/index.ts` and `state.ts` keep about 266 lines of install order. A platform boot sequence
  from rows would take about 150 of them.
- **Pick 2 pending marks:** −647 at once. These are bookkeeping until the features land; they are not counted above.
- **Risk H1:** the `open-x-queue` H1 row moves `engine/world/painterly.ts` (218) into Nalati. Today only 14 of its lines
  are charged (game modules reach it), so the move would **add about 200 lines**. Fold it into the widened look host
  instead (pick 3).

## Order and batches

1. **Now, cheap, safe whatever the AS answer (B1–B3, ≈ 1,036 lines, S):** dead keepers, build-only and config, data
   JSON. Codex, one batch each. They touch no file another lane is in, except `manifest.ts` (finish sp-x1's).
2. **B4 graphs:** the Opus ON lane is already on them.
3. **B5–B6 W3 adoption (≈ 1,054):** these also make Pine's and DW's pending hosts shared before the end-of-W3 recount.
4. **B7–B8 rows (≈ 1,156), B9 bake, B10 with H9.**
5. **Step 2 features adopt Nalati in G477 order,** after each feature lands for Pine and DW. Nalati supplies the "made-up
   second shard" fixture rows for free: it is a real second user.
6. **Step 3 features once approved:** N1 first (biggest).
7. **Step 4 AS** last: only what is truly unique after the hosts.

G471 timing: lanes reach Nalati only after Pine and DW hit 20 %, except a lane with no spike or Pine/DW task. B1–B3 suit
that case.

## Picks for Jake

Option 1 is always "Skip for now".

1. **Approve the five new platform features** (N1 mounts, riding and taming; N2 audio cue director; N3 grass field rows;
   N4 practice courses; N5 stealth and detection) under the G474 rules: fixture second shard, docs, Nalati as rows.
   **Recommended: approve all five.** N1 is required for 20 %.
2. **Mark Nalati's sole-user platform code pending a second user now**, as bolt flight and ripples were: `mover.ts`
   riding exports (451) and `grassField` + `tileField` (196), so −647 at once. **Recommended: yes, tied to N1 and N3.**
3. **Widen the toon look host to a stylised look host** (toon + painterly families: sky dome, terrain painter, baked
   shadows, grade/tint/fog), and fold `engine/world/painterly.ts` into it instead of H1 moving it into Nalati (+≈ 200).
   **Recommended: yes.**
4. **Replace Nalati's procedural synth voices with generated SFX rows.** This changes the sound, so it gets a listening
   page and the synth stays as a Debug variant until he picks. **Recommended: yes.**
5. **Horse playground:** keep it as course rows (N4, with Nine's grapple course), or delete it (−298 at once, no feature).
   **Recommended: keep** (he asked for it, E307).

## Risks and checks

- **B1:** delete the five orphan fixtures in the same commit. Run the typecheck. Qara must still run on `qara.as`
  (headless proof).
- **B5–B6:** each W3 row lists what Nalati keeps (RNG order, save envelopes, clocks). Exact parity on the headless
  oracles that still load.
- **B8, B9:** colliders must stay exact. After collider changes the physics walk must report 0 stuck. The look should be
  similar, not identical (G415); one board per batch.
- **In-flight work, don't redo:** sp-x1 manifest, sp-x5 layout bake (landed `ce0f35146`), sp-x6 paint and signpost bake,
  the ON graphs and flock.
- **The 25 % held back is a guess per feature.** If the boss host or spawn director generalise less (Titan's owner
  differs from AnimalSim, honest floor A8), the AS bill grows past the 2,675 room. Then the margin levers above are
  needed.
