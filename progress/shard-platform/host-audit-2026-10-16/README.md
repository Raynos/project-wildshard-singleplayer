# Host audit: G441 pending-user hosts against the 5-test HOST BAR (2026-10-16)

Read-only audit of every entry in `lint/platform-pending-users.json` (92 entries, 43 modules) and of the ten biggest
one-user attributions in `node scripts/shard-platform.mjs --json`, graded against Jake's HOST BAR (2026-10-16):
**1** two real users · **2** no shard nouns · **3** data-driven (no shard callbacks / shard-shaped parameter lists) ·
**4** server-safe (or labelled client-only presentation) · **5** deletion test.
Verdicts: **good** (passes all 5) · **borderline** (fixable; fix named) · **silly** (shard logic in a generic coat:
loses credit, counts back to its shard). Ruler run at HEAD `040b05ec0` (working tree as found).

## Summary

| | entries | rows below |
|---|---:|---:|
| good | 77 | 38 |
| borderline | 14 | 6 |
| silly | 1 | 1 |
| **total** | **92** | **45** (animation.ts and brain.ts split by W3 row; small generic hosts bundled) |

Only 74 of the 92 entries carry credit today (Pine 1,320 lines, Driftwood 1,039); the other 18 already have two users
or are covered by an export-level entry (e.g. `bakedTerrainField` is used by Pine, Driftwood and Sunscar).

**Credit that would revert** (ruler: custom runtime lines / frozen legacy lines; lower is better, target ≤ 80 % / 90 %):

| shard | today | silly reverts | % after | borderline also reverts (if unfixed by end of W3) | % after |
|---|---:|---:|---:|---:|---:|
| Pine Hollow | 18,174 / 21,220 = 85.65 % | +79 | **86.02 %** (+0.37 pt) | +249 total | 86.82 % (+1.17 pt) |
| Driftwood Isle | 13,201 / 17,167 = 76.90 % | 0 | 76.90 % | +250 total | 78.35 % (+1.45 pt) |
| Sky Reach, Nalati, Nine | no G441 credit | 0 | unchanged | 0 | unchanged |

Bottom line: the G441 hosts are mostly real mechanisms. The engine-side shard logic Jake suspects is mostly in the
**one-user list** (painterly, waterSurface, armRig, createAmbientLife: 1,309 lines). Those already count back to their
shard, so they don't move any number, but they break the layer rules and belong in the shard folders.

## Pending-user entries, graded

Lines = credit counted as shared today (it reverts if the entry comes out). P = Pine, D = Driftwood.

| module#export(s) | current user | claimed W3 user (file) | lines | verdict | fails | evidence | fix |
|---|---|---|---:|---|---|---|---|
| `game/systems/life/bodylessForager.ts` (module) | P `models/wildlife` via `ambientLife.ts:77` (hares) | Nalati `creatures/marmotBrain.ts` | 79 P | **silly** | 1, 2, 5 | Hard-coded hare hop/bound (`bodylessForager.ts:61`), `ears`/`sit` state (`:8`); the marmot runs to a burrow and sinks (`marmotBrain.ts:87`), a different algorithm | Revert credit; move into Pine. Re-host only as a mode-table forager that the marmot uses unchanged |
| `game/plugin/animation.ts#stepNpcHeadFocus` + 3 types | D `npc/Trader.ts`, `npc/Castaway.ts` | Nalati `models/npc/figureMotion.ts#stepNpcFigure` | 39 D | borderline | 3 | Profile carries parity knobs (`response: 'linear' \| 'exponential'`, `cadence.strict`, `clampAfterOffset`, `animation.ts:119`), one per shard's legacy quirk | Pick one law (G415: similar, not identical) and drop the per-shard flags |
| `animation.ts#stepCreatureLift` | D `species/sailorPose.ts:17`, `captainPolicy.ts` | Nalati `species/balbal.ts` rise/sink | 26 D | borderline | 2, 3 | Reads and writes hidden `mem['rise'/'rising'/'sinking'/'init'/'floor'/'floorS']` (`animation.ts:75`); 7 positional args | Typed `LiftState` + a `LiftRow`; no string-keyed actor memory |
| `animation.ts#NativeCreaturePose`, `…Recipe`, `attachNativeCreaturePose`, `createNativeCreaturePoses` | D `runtime/keeper.ts:191` | Nalati `runtime/headlessTaming.ts`, `tamingHorsePose.ts` | 39 D | good | none | Renderer-free pose from baked joint recipes; roster keyed by kind/variant rows (`animation.ts:485,662`) | none |
| `animation.ts#stepNpcFacing` + profile | D Trader / Castaway | Nalati `figureMotion.ts` | 16 D | good | none | Exponential yaw approach, 10 lines (`:104`) | Optional: drop `wrapTarget`/`wrapOutput` parity flags |
| `animation.ts#sampleCreatureSwing` + spec | D `captainPose.ts`, `sailorPose.ts` | Nalati `balbal.ts#animateBalbal` | 23 D | good | none | Wind/cut/recover envelope over named channels, pure data (`:18`) | none |
| `animation.ts#poseCreatureStride` + profile | D sailor / captain pose | Nalati `balbal.ts#animateBalbal` | 23 D | good | none | Uses the engine humanoid rig's `leg{L,R}_{hip,knee,foot}`; balbal has the same bones and kneel/topple (`balbal.ts:61,201`) | none |
| `game/plugin/brain.ts#createNativeSpeciesContext` | D `runtime/enemyBrains.ts:28` | Nalati `runtime/headlessCreatures.ts` `c` context | 42 D | good | none | Same ThinkCtx port bag Nalati builds by hand (`headlessCreatures.ts:269-280`) | Rename off "Native" (it is the hunt observation context) |
| `brain.ts#createMemoryActionBrain` + rows | D `enemyBrains.ts:38-40` (3 species) | Nalati `balbal.ts#actBalbal` | 58 D | good | none | Rows gate named effects (`brain.ts:60`). Sliver: balbal moves a 2-line gate (`balbal.ts:341`) | none (credit is generous) |
| `brain.ts#createCreatureSpawner` + 2 types | D `creatures/Enemies.ts:106` | Nalati `creatures/wildlife.ts#spawnPack/#spawnHerd` | 53 D | good | none | Ordered manager spawns and herd joins (`brain.ts:129`) | none |
| `brain.ts#sampleCreatureGroup` + 2 types | D `runtime/placement.ts:58,73` | Nalati `creatures/wildPlacement.ts` | 53 D | good | none | Radial/indexed rejection sampling over rows (`brain.ts:183`) | none |
| `brain.ts#selectCreatureSites` | D `placement.ts:63`, `monkeyPolicy.ts:37` | Nalati `wildlife.ts#nearestWolf/#nearestFoal` | 30 D | good | none | Ranked radius selection (`brain.ts:233`). Sliver: nearestWolf is 4 lines (`wildlife.ts:156`) | none (credit is generous) |
| `game/shardfile/homeKeeper.ts#createNativeCreatureRoster` + slot | D `runtime/keeper.ts:192` | Nalati `headlessCreatures.ts` makeBody/spawnPack/restoreRoster | 131 D | borderline | 3 | 12-method surface, 6 shard callbacks (`attach`, `joined`, `ground`, `retired`, `preflight`, `bindBodyStep`; `homeKeeper.ts:251,275`) | Make `ground` and `joined` rows (a floor policy, a brain-by-kind table); cut the API to body/draw/retire/refill/reinstall |
| `game/plugin/quests.ts#createReadingRoster` + 4 types | P `runtime/quest.ts:182` | Nalati `adventure.ts` CAMP_NPCS / NpcTalk | 83 P | borderline | 3 | Router is generic, but `continuation: { bare, wrapped }` (`quests.ts:329`) is Pine's legacy save wire as a parameter | One uniform `{ kind, reading }` continuation; keep the legacy mapping in Pine's save adapter |
| `engine/combat/view/projectile.ts#ProjectilePresentation` | P `runtime/items/boltCrossbow.ts:210` | Nalati `runtime/weapons/javelinSpear.ts` (only the `flyJavelins` matrix publication moves) | 87 P | borderline | 1, 3 | Requires bolt glow (5 geometries) and tracer rows (`projectile.ts:312-313`); the javelin has no glow or trace (0 hits in `javelinSpear.ts`) | Make glow and trace optional layers; the base is a pose-frame pool |
| `game/bag/findsCatalogue.ts` (module) | D `loot/finds.ts:13` | Nalati `bag.ts#nalatiFinds` | 54 D | borderline | 2 | Fully data-driven, but the `glass` field (`findsCatalogue.ts:11`) is Driftwood's sea glass | Rename `glass` to `swatches` |
| `sdk/looks/riggedHulls.ts` (module) | P `species/hulls.ts:27` | Nalati `species/hulls.ts` (row SF48) | 235 P | good | none | Nalati's glbCreatures is the same pre-skinned-hull loader, near line for line (`nalati/species/hulls.ts:10-37`) | Name the W3 row and file instead of "SF48"; URL callbacks could be templates |
| `engine/combat/view/bowProfile.ts#BowShape` | P `runtime/viewmodel/staveBow.ts:87` (data mode) | Nalati `weapons/recurve.ts#BowMesh.shape` | 138 P | good | none | Pine uses `curve` + `sectionSamples` rows. The callback mode (`bowProfile.ts:82`) exists only for the transition | Delete `limbAt`/`section`/`ridge` ports once recurve is on rows |
| `engine/player/heldHandParts.ts` (module) | P `runtime/viewmodel/gloveHands.ts` | Nalati `runtime/weapons/javelinSpear.ts#build` | 79 P | good | none | Fist + sleeve mesh assembly; client-only presentation | Label client-only |
| `game/Boss.ts#installBossEncounter` + 5 types | P `combat/install.ts:157` | Nalati `combat/stormTitan.ts#bind`, `goldenKing.ts#bind` | 76 P | good | none | Same bar/reward/Boss/registration assembly as `stormTitan.ts:1012-1040`; score as rows | none |
| `sdk/panels.ts#DeclaredPanel` + policy | P `quest/ui.ts:68` | Nalati `ride/HorseNamePrompt.ts` | 73 P | good | none | DOM panel lifecycle; client-only UI | none |
| `engine/combat/view/ranged.ts#weaponDisplay`, `#prepareWeaponView` | P `LeverRifle.ts:119`, `leverFirearm.ts:248` | Nalati `magazineFirearm.ts#displayModel/#buildViewmodel` | 60 P | good | none | Generic three.js part/queue prep (`ranged.ts:372,418`) | none |
| `engine/models/glbNodes.ts` (module) | P | Nalati `world/glbPaint.ts` | 56 P | good | none | Named-node reader + dequantization | none |
| `engine/combat/Firearm.ts#RangedAction` + row | P lever firearm | Nalati `magazineFirearm.ts` | 53 P | good | none | Cooldown/reload clocks as a row (`Firearm.ts:47-62`); server-safe | none |
| `engine/app/cachedAssets.ts#ResourceMemo` | P | Nalati `species/hulls.ts#CreatureRigs` | 49 P | good | none | Keyed in-flight memo (`cachedAssets.ts:81`) | none |
| `sdk/headlessRuntime.ts#createNativeBakeReader` + 3 types | P `runtime/baked.ts:11` | Nalati `runtime/baked.ts` | 47 P | good | none | Same version/ground/solids/actors/herds schema (`nalati/runtime/baked.ts:20-22`) | none |
| `engine/render/viewmodelFeel.ts#HitscanPresentation` + row | P `leverFirearm.ts:218` | Nalati `magazineFirearm.ts` | 45 P | good | none | Flash/brass/tracer composition from a row | none |
| `sdk/looks/overcast.ts` (module) | P `runtime/looks/keyedSky.ts` | Nalati `world/installWeather.ts#stormLook` | 35 P | good | none | Pure op rows over look fields (`overcast.ts:39`) | none |
| `sdk/looks/daySky.ts#driveDayAir` + 2 types | P | Nalati `look/skyRig.ts#apply` | 35 P | good | none | Writes shared sky-rig targets from a row (`daySky.ts:87`) | none |
| `engine/models/placementBatch.ts` (module) | P `world/crags.ts`, `landmarks.ts` | Nine `world/squareProps.ts`, `props3d.ts` | 32 P | good | none | Thin ordered wrapper over `place` | none |
| `engine/ai/huntPattern.ts#bakedHuntGround` | P `runtime/herds.ts:32` | Nalati `headlessCreatures.ts#nalatiHuntGround` | 17 P | good | none | Line-for-line twin of `headlessCreatures.ts:68-77` | none |
| `engine/models/colliders.ts#placedGeometryCollider` | P | Nalati `world/solid.ts#hullAt` | 14 P | good | none | Matrix-baked collider descriptor | none |
| `game/plugin/headless.ts#bindRuntimeJsonRecord` | P | Nalati `runtime/persistence.ts#record` | 12 P | good | none | Same function as Nalati's private `record` (`persistence.ts:24`) | none |
| `game/systems/life/ambientLife.ts#createCirclingLife` | P (data kind `circling-flyer`) | Nalati ambient life (SF48) | 8 P | good | none | Data rows over `CirclingFlyer` (`ambientLife.ts:741`) | none |
| `game/systems/looks/rainCurtain.ts#stepRainFall` + 2 types | P rain | Nalati `world/WeatherFX.ts#update` | 7 P | good | none | Three lines of wrap math | none |
| `game/systems/viewmodel/rigArms.ts` (module) | D `runtime/viewmodel/toonArms.ts` | Nine `runtime/viewmodel/fpArmsRig.ts` | 153 D | good | none | Same two-channel arms (vm_root, play/playLeft, walk, lag; `fpArmsRig.ts:147,272-306`) | none |
| `game/plugin/geometry.ts#packedCreatureBodies` + type | D `species/bodies.ts:10` | Nalati `species/bodies.ts#nalatiBody` | 66 D | good | none | Offset-addressed packed body intake | none |
| `sdk/looks/streamedInstances.ts` (module) | D `runtime/looks/streamedCover.ts` | Nalati `world/dressing/layer.ts#DressLayer` | 99 D | good | none | Cell window + double-buffered instance tier, no content | none |
| `engine/models/ownedGeometry.ts` (module) | D `boot/palmGeometry.ts`, `coverGeometry.ts`, `Ocean.ts` | Nine `runtime/geometry.ts`, `world/specimens.ts` | 80 D | good | none | Single-mesh GLB intake (`ownedGeometry.ts:23`) | none |
| `engine/boot/plan.ts#BuildStages` | D | Nine `world/build.ts` | 37 D | good | none | Ordered slice progress (`plan.ts:133`) | none |
| `engine/combat/effects/EffectService.ts#selectEffectGrants` + row | D `loot/effects.ts:29` | Nalati `weapons/nalatiSkins.ts#syncEffects` | 17 D | good | none | Generic keyed grants. Sliver: Nalati's side is one line (`nalatiSkins.ts:58`) | none |
| `engine/world/bakedTerrainField.ts` (2) | P, D, Sunscar | none needed | 0 | good | none | Already three users | Delete the redundant entries |
| `game/plugin/bossStorm.ts` | ui.ts RowBossView | Nalati Storm Titan (SF48) | 0 | good | none | Fight weather from a presentation row (`bossStorm.ts:18`) | Label client-only |
| `engine/ai/ambientFlight.ts#CirclingFlyer` | D `world/Gulls.ts:39`, ambientLife | Nalati ambient life | 0 | good | none | Flight law rows | none |
| `sdk/looks/posedInstances.ts`, `game/cosmetics/locker.ts`, `engine/models/sets.ts` (2), `engine/models/colliders.ts#readColliderRows`, `engine/physics/box.ts#floorAtRects`, `game/plugin/director.ts` (2), `game/eliteSystem.ts` (2) | P / D / Nalati (locker) | Nalati `flock.ts`, `bag.ts#skinRows`, `world/places.ts`; Nine `bakedColliders.ts`, `floorRows.ts`; Nalati `raidDirector.ts`, `headlessElites.ts` | 0 | good | none | Generic instanced channels, locker, spatial sets, collider rows, rect floors, AS stage lane, elite continuation | none |

## Top 10 one-user hosts (already count back; graded for placement)

| # | module#export | shard | lines | verdict | fails | evidence | fix |
|---|---|---|---:|---|---|---|---|
| 1 | `game/systems/life/ambientLife.ts#createAmbientLife` | Pine | 583 | **silly** | 1, 2, 3, 5 | Ravens at carcasses, owl, woodpecker, breadcrumb guides, hares (`ambientLife.ts:79,159`) | Move to `src/shards/pine-hollow/`; keep only CirclingFlyer and createCirclingLife shared |
| 2 | `sdk/bake/placeholders.ts` | ink-cel | 355 | good | none | G348 generic far/near placeholder baker for every shardfile (`placeholders.ts:19`) | Ruler artifact (build tooling, native metric): exclude `sdk/bake` from attribution |
| 3 | `engine/world/waterSurface.ts` | Pine | 303 | **silly** | 1, 2, 5 | "The photoreal water shading Pine Hollow's pond, creek and waterfall share" (`waterSurface.ts:2`) | Move to Pine; an engine water law would be rows |
| 4 | `engine/world/painterly.ts` | Nalati | 218 | **silly** | 1, 2, 5 | The engine names "Nalati Grasslands, style B" (`painterly.ts:2`) | Move to Nalati, or make a banded-toon material family Driftwood would also use |
| 5 | `game/systems/viewmodel/armRig.ts` | Nine | 205 | **silly** | 1, 2, 5 | JIAN grip, GAUNTLET frame, `L_claw` = Fei Zhua talons (`armRig.ts:18`) | Move to `src/shards/nine-dragon-stack/` |
| 6 | `game/plugin/mover.ts#MountedBody` | Nalati | 194 | borderline | 1, 2 | Horse gaits and a `'stampede'` literal in the schema (`mover.ts:780,796`) | Riding is a platform verb (SF34): gaits/capsule as rows, then a second rider; else move to Nalati |
| 7 | `sdk/bake/nearPlaceholder.ts` | ink-cel | 138 | good | none | Generic G342 producer | As #2 |
| 8 | `sdk/bake/authoredWorld.ts` | ink-cel | 134 | good | none | Shardfile authored-world build | As #2 |
| 9 | `sdk/project.ts` | ink-cel | 124 | good | none | `wildshard build` project validation | As #2 |
| 10 | `game/plugin/mover.ts#GrappleSim` | Nine | 124 | borderline | 1 | Mechanism-named, but only Fei Zhua uses it (`nine/grapple/FeiZhua.ts:1`) | Name a second user (a WorldClaw grapple) or move to Nine |

## Patterns

1. **Sliver matches.** G441 credits the whole host when the W3 code moves 1–4 lines onto it (balbal's 2-line hit gate
   gets 58 lines, nearestWolf's 4-line loop gets 30, Nalati's one-line `syncEffects` gets 17). The hosts are real, but
   the credit is generous. Credit only hosts where the W3 adoption deletes at least as much as the host costs.
2. **Parity knobs.** Profiles grow a flag for each shard's legacy quirk (`response: linear|exponential`, `strict`,
   `clampAfterOffset`, `wrapTarget`/`wrapOutput`, "preserves the authored multiplication order"). G415 says similar,
   not identical: pick one law.
3. **Legacy wire as API.** Saved-shape quirks leak into host signatures (`continuation.bare/wrapped`, hidden
   `mem['rise']` keys, `'stampede'`). The save adapter should own the mapping, not the host.
4. **Port bags.** "Native" adapters (`createNativeCreatureRoster`, and to a lesser degree `createNativeSpeciesContext`)
   are callback hubs that mirror one shard's keeper. They pass test 1 but drift toward shard code in disguise.
5. **The real offenders are not in G441.** Shard-named code in engine/game (painterly, waterSurface, armRig,
   createAmbientLife) already counts back, so it pads no number. But it breaks the "engine knows no shard" rule
   (E405), and the `engine-words` / `shard-names` guards don't read comments.

## Recommendation for the coordinator

- **Revert now:** take the `bodylessForager.ts` entry out of `lint/platform-pending-users.json` and delete its W3 row
  ("W3 Nalati bodyless forager policies"). Pine goes to 86.02 % (+79 lines). Then move the module into Pine, or keep it
  in game only if the marmot is rebuilt as a forager mode table.
- **Fix or revert at the end of W3:** give the six borderline hosts their named fix inside the W3 row that adopts them.
  Any still unfixed at the end of W3 comes out with the unresolved entries (worst case Pine 86.82 %, Driftwood 78.35 %).
- **Delete** the two redundant `bakedTerrainField` entries (three users already).
- **New W-row (outside G441):** move `painterly.ts` → Nalati, `waterSurface.ts` and `createAmbientLife` → Pine,
  `armRig.ts` → Nine. No number changes. It cleans the layers and stops these from being cited as shared later.
- **Ruler:** exclude `src/sdk/bake/**` and `src/sdk/project.ts` (build tooling) from one-user runtime attribution.
