# W2 component replan: Pine + Driftwood as shardfiles (2026-10-16)

Jake, 2026-10-16: *"Just moving code into the runtime directory doesn't fucking help. You have to actually start working
towards a shard file, which means data sections, engine hosts, assembly scripts … why are they not generic? Why can't we
just bang out a shard yet?"* Then, at 12:45: *"We had this component by component approach for wave one … if we do the
same thing for wave two, if we incorporate the new shard file design … assign the lanes to components … components work
on both driftwood and pinewood in one mega build per component … I feel the circling the drain."*

Read-only planning page (an Opus side agent of the coordinator). It builds on G403/G406 (component waves), G447–G450
(shardfile), G453–G455 (host bar, data-only host APIs, Wasm), G457 (Wasm API v1, moves library) and G465 (shrink only,
no detours through `runtime/`). Inputs: `docs/plans/shard-platform/w2-m0-inventory.md` (W2 M0 on the old ruler),
`progress/shard-platform/host-audit-2026-10-16/`, `progress/shard-platform/wasm-api-design-2026-10-16/`,
`scripts/shard-platform-hosts.mjs`.

**How it was measured.** `countOutput(…, sourceProgress=true)` from `scripts/shard-platform.mjs` (the G458 source-basis
ruler the hourly report uses) with `includeSources`, plus `componentInventory` from `scripts/shard-components.mjs`, run
on the live tree at `63dfdc7db` (other lanes' uncommitted hunks included). That gives **Pine 18,955 / 21,305 = 89.0 %**
and **Driftwood 14,266 / 17,167 = 83.1 %**. The last hourly ruler (`2f80e66b4`) said 87.9 % and 80.9 %. The +221 Pine
and +371 DW since then come from today's closure commits that mirror facts into `runtime/` (`4b1e78d2d` "mirror cabin
client facts", `30f34b303`, `5926c7ab4`), which is exactly what G465 forbids. All line numbers below are that ruler's
unit: nonblank lines after comment removal, every shard `.ts` except `generators/`, plus one-user platform code.
**Estimates are marked "est."; everything else is measured.**

---

## 1. The re-run M0 inventory (today's ruler)

### 1.1 The ruler's own tags (`componentInventory`, unchanged rules)

| Component | Pine now | DW now | Pine at old M0 (`68e72579`) | DW at old M0 |
|---|---:|---:|---:|---:|
| C1 Static world | 3,985 | 3,691 | 4,683 | 6,329 |
| C2 Looks | 1,789 | 1,939 | 3,472 | 3,806 |
| C3 Effects | 151 | 0 | 0 | 0 |
| C4 Creatures | 3,112 | 1,665 | 1,657 | 1,983 |
| C5 NPCs and quests | 1,948 | 1,287 | 1,824 | 1,007 |
| C6 Items and combat | 2,585 | 909 | 2,627 | 483 |
| C7 Movers | 13 | 503 | 42 | 171 |
| C8 Audio | 1,003 | 1,744 | 888 | 1,219 |
| C9 Boot glue / unmatched fallback | 4,369 | 2,528 | 7,803 | 3,017 |
| **Total** | **18,955** | **14,266** | 22,996 | 18,015 |
| Unknown-owner units | 62 | 79 | 147 | 84 |

The ruler's C9 is still a dump: Pine's biggest "C9" items are `data/weatherChannels.ts` (1,241, a look DAG),
`runtime/life/ambientLife.ts` (604, birds and hares) and `data/questPageInteractions.ts` (480, quest rows).

### 1.2 Re-tagged by job (C9 becomes boot glue only; nothing is "unmatched")

Every counted line was assigned to one job by ordered file-path rules (the 533 Pine / 543 DW
"misc tables" are small `data/*.ts` tables such as `data/budgetCeilings.ts`, `data/landscapeRows.ts`, `sim/headless.ts`,
which go with C9). **data** = JSON-shaped `data/*.ts` tables that play code imports: the source ruler counts them, the
built-output ruler (P4) does not once play code reads the emitted section instead (G448). **code** = everything else.

| Component | Jobs in it | Pine data | Pine code | **Pine** | DW data | DW code | **DW** |
|---|---|---:|---:|---:|---:|---:|---:|
| C1 Static world | procedural models, world build, props, kit | 92 | 2,845 | **2,937** | 32 | 2,147 | **2,179** |
| C2 Looks | weather/sky/day (2,159 P / 343 D), water (491 / 799), materials/graphs (344 / 762) | 1,598 | 1,396 | **2,994** | 388 | 1,516 | **1,904** |
| C3 Effects + ambient life | ambient birds/hares/gulls, building life, air, fx kit | 17 | 848 | **865** | 0 | 379 | **379** |
| C4 Creatures + bosses | elites, herds, keeper, species policies (1,885 / 1,459); boss fight (1,132 / 355) | 243 | 2,774 | **3,017** | 322 | 1,492 | **1,814** |
| C5 NPCs and quests | quests/stages/director (2,395 / 1,519), NPC talk/trade/rigs (483 / 566), compendium/journal (643 / 92) | 1,303 | 2,218 | **3,521** | 638 | 1,539 | **2,177** |
| C6 Items and combat | weapons, viewmodels, loadout, ammo, loot, keepsakes, effects grants | 166 | 2,406 | **2,572** | 100 | 766 | **866** |
| C7 Movers | zipline, boat, rope bridge, entries | 3 | 12 | **15** | 506 | 369 | **875** |
| C8 Audio | ambience, sfx, score, zones, procedural PCM | 660 | 280 | **940** | 1,591 | 149 | **1,740** |
| C9 Boot glue | const mirrors (530 / 808), boot files/index/headless (1,031 / 981), misc tables (533 / 543) | 789 | 1,305 | **2,094** | 926 | 1,406 | **2,332** |
| **Total** | | **4,871** | **14,084** | **18,955** | **4,503** | **9,763** | **14,266** |

Where it sits today (Pine / DW): `data/` 4,871 / 4,503; `runtime/` 9,327 / 5,122; play folders outside `runtime/`
(`quest/`, `combat/`, `world/`, `species/`, `sim/`, `loot/`, `creatures/`, `weapons/`, `loadout/`, root) 3,530 / 4,222;
one-user platform code 1,227 / 419 (Pine's biggest: `engine/world/waterSurface.ts` 303, `game/models/pickups.ts` 86,
`game/systems/npc/npcRig.ts#legPose` 77, `engine/ai/view/DebugOverlay.ts` 71; DW's: `game/complete/ShardComplete.ts` 78,
`game/shardfile/hybrid.ts#HybridResidentWorld` 35). Escapes on the output ruler: Pine 155, DW 37 (`runtimeClosures`).

Biggest files per component (lines that file adds to the component):

| Component | Pine | Driftwood |
|---|---|---|
| C1 | `runtime/props/bakedBuilding.ts` 281, `runtime/world/landmarks.ts` 154, `runtime/kit/caveInterior.ts` 143, `runtime/world/homestead.ts` 143, `runtime/world/crags.ts` 142 | `world/BlenderIsland.ts` 168, `world/build.ts` 150, `runtime/models/ropeBridge.ts` 142, `world/GroundCover.ts` 108, `runtime/boot/fixedGeometry.ts` 94 |
| C2 | `data/weatherChannels.ts` 1,241, `engine/world/waterSurface.ts` 303, `runtime/looks/keyedSky.ts` 271, `runtime/looks/rainFx.ts` 153, `data/undergrowthPaint.ts` 127 | `runtime/looks/streamedCover.ts` 251, `data/lookRows.ts` 119, `runtime/looks/rows.ts` 119, `data/castawayLook.ts` 115, `runtime/looks/facetedOcean.ts` 72 |
| C3 | `runtime/life/ambientLife.ts` 604, `runtime/life/bodylessForager.ts` 80, `runtime/props/buildingLife.ts` 66 | `runtime/looks/gullFlock.ts` 298+ |
| C4 | `combat/eliteScripts.ts` 225, `runtime/species/limbRig.ts` 190, `combat/install.ts` 169, `runtime/roster.ts` 163, `runtime/nightDirector.ts` 153; boss: `runtime/antlerKing.ts`, `runtime/kingPoseKeeper.ts` 132, `runtime/king.ts` 125 | `sim/keeper.ts` 302, `creatures/Enemies.ts` 146, `species/captainPolicy.ts` 100, `species/monkeyPose.ts` 75, `combat/captain.ts` 69 |
| C5 | `quest/index.ts` 362, `runtime/quest.ts` 263, `data/questPageInteractions.ts` 480, `data/journal.ts` 386, `runtime/npc/standInPerson.ts` 129 | `runtime/quest.ts` 192, `quest/adventure.ts` 144, `quest/Complete.ts` 115, `game/complete/ShardComplete.ts` 99, `runtime/finalePresentation.ts` 79 |
| C6 | `runtime/items/leverFirearm.ts` 268, `runtime/items/boltCrossbow.ts` 261, `loadout/loadout.ts` 188, `runtime/weapons/headlessLongbow.ts` 94, `weapons/leverAction.ts` 94 | `runtime/viewmodel/toonArms.ts` 134, `loot/keepsakes.ts` 118, `weapons/IronSword.ts` 118, `combat/coconuts.ts` 57 |
| C7 | `runtime/props/buildingLife.ts` 12 | `data/movers.ts` 498, `world/Zipline.ts`, `runtime/models/zipline.ts` |
| C8 | `data/audioZones.ts` 590, `runtime/audio/wiring.ts` 72, `runtime/audio/ambience.ts` 69 | `data/audioPcm.ts` 1,435, `data/audio.ts` 71, `runtime/audio/sfx.ts` 52 |
| C9 | `data/bootFiles.ts` 285, `runtime/index.ts` 172, `runtime/const.ts` 253 (all tags), `runtime/headless.ts` 91 | `runtime/const.ts` 477 (all tags), `data/bootFiles.ts` 121, `data/runtimeMirrors.ts` 90, `sim/baked.ts` 58 |

---

## 2. Why the hosts so far aren't enough (Jake's question)

1. **They cover what Sky and Signal needed, not what Pine and DW are made of.** `scripts/shard-platform-hosts.mjs` maps 46
   sections to hosts: tiles, terrain, collision, props, water, movers, look/materials, quests, interactions, items,
   director stages, audio cues, compendium. Pine and DW's custom lines sit in jobs those hosts never did: code-built
   models (2,937 P / 2,179 D), elite, keeper and boss behaviour (3,017 / 1,814), firearm, bow and sword viewmodels
   (2,572 / 866), photoreal sky, weather and water (2,650 / 1,142) and ambient life (865 / 379).
2. **The hosts are callback-shaped, so every shard keeps TS glue to feed them.** 84 exported engine/game/SDK functions
   take a `ports`, `callbacks`, `hooks` or `recipes` parameter (36 files in `game/shardfile`, `game/plugin`,
   `game/shard`). `QuestHostPorts` (`src/game/plugin/simulation.ts:1240`) wants `observations: Map<string, () => boolean>`,
   `actions: Map<string, () => void>` and `directorActions`; `declaredSpeciesLook` takes a `recipes` map of functions;
   `createNativeCreatureRoster` takes 6 callbacks (host audit). G454 (5) says data only; nobody has converted them yet.
3. **There was no decision runtime until this week.** `engine/script/decision.ts` (DecisionHost, 467 lines) and
   `engine/ai/moves.ts` (148) just landed. Only Sky's `roc.as` (uncommitted, x8) uses them. Pine's elites run on the v0
   `EliteScriptLane`, and DW's keeper runs on `homeKeeper` callbacks, so one-off behaviour had nowhere to go but TS.
4. **Looks and models are still TypeScript.** Pine's `runtime/models` + `runtime/world` + `runtime/props` +
   `runtime/kit` = 2,803 lines; DW's `runtime/models` + `world/` + `runtime/boot` = 3,071. The build-time path
   (generators → GLB, `clientGraphs`, `clientMaterials`) exists. These builders just haven't moved onto it.
5. **Data-in-TS and mirrors keep the count up.** 9,374 lines are JSON-shaped `data/*.ts` tables that play code imports
   (155 / 37 escapes), and the closure commits added const mirrors (`runtime/const.ts`: Pine 253, DW 477). Moving code
   into `runtime/` never cuts a line. Only reading a section, a GLB or a Wasm script does.

---

## 3. One megabuild per component, across both shards

"Closes at" = 100/0 for that component in both shards: no custom TS left except the named view code, no `data/*.ts`
import from play code, and one behaviour or look check per shard (G403 rule 6). Lines removed = component total − what
stays. **What stays is an estimate.** Users = shards whose code does the same job today (grep evidence in §4).

| # | Component | Pine | DW | End state (sections · hosts · scripts · assets) | New / generalised hosts (rule of two) | Stays as view code (est.) | Removed P / D (est.) | Lane |
|---|---|---:|---:|---|---|---|---:|---|
| C1 | Static world | 2,937 | 2,179 | Every builder becomes a generator emitting GLB plus `world/props` / `world/tiles` rows; existing hosts `game/shardfile/props#propColliderDescriptors`, `clientViews#clientTileViews`, `engine/models/placementBatch`, `engine/models/ownedGeometry`; colliders from `world/collision` | none new; **build-time** `sdk` GLB emit for code models (not counted, G456 H2) | ~100 / ~50 instancing glue | 2,840 / 2,130 | **Opus O1** |
| C2 | Looks (sky, weather, water, materials) | 2,994 | 1,904 | Materials as graph JSON (`clientGraphs`, `clientMaterials`); sky/fog/overcast as `world/days` + `world/weather` rows; Pine's weather DAG (`data/weatherChannels.ts`, already data) run by a channel host; water as `world/water` law rows (`clientWater#installClientWater`) | **H4 channel-program host** (Pine, Nalati `world/installWeather.ts` 282, Sky); **H7 water law rows** generalising `engine/world/waterSurface.ts` (Pine, DW ocean, Nalati `runtime/looks/waterGlsl.ts`); `declaredSpeciesLook` loses its `recipes` callbacks | ~250 / ~150 (sky pass until H4 covers the photoreal IBL) | 2,740 / 1,750 | **Opus O2** (+ O4 water) |
| C3 | Effects + ambient life | 865 | 379 | Ambient life as mode rows (circle, perch-hop, forage, flee-burrow, flock) on one client host; building smoke, air and hit fx as effect rows | **H6 ambient-life host** (Pine `ambientLife.ts` 604, DW `gullFlock.ts` 298, Nalati `creatures/flock.ts` 488 + `marmots.ts` 119 + `marmotBrain.ts` 115); builds on `engine/ai/ambientFlight#CirclingFlyer` | ~50 / ~50 | 815 / 330 | **Opus O4** (Codex host in X-C4's queue) |
| C4 | Creatures + bosses | 3,017 | 1,814 | Spawns, herds, keeper as `actors/creatures` + `actors/spawns` rows (`brainRuntime#installDeclaredBrains`); motion on the moves library (`engine/ai/moves#ActorMoveRunner`); each boss and elite = encounter row (`game/Boss#installBossEncounter`, `bossRow`) + one AS script (`king.as`, `captain.as`, elites v0→v1) on DecisionHost; pose/rig from GLB clips | **H1 ground moves + encounter binding** (Pine, DW, Sky, Signal, Nalati `combat/stormTitan.ts` 1,129 + `goldenKing.ts` 399); **H8 keeper rows** (fix `homeKeeper`'s 6 callbacks) | ~200 / ~100 pose adapters | 2,800 / 1,700 | **Codex X-C4** + Opus O4 scripts |
| C5 | NPCs, quests, journal | 3,521 | 2,177 | Quest graph + director stages (`quests/quests`, `quests/host`, `quests/directors`), interactions as rows; observations and actions as **binding rows**, never closures; NPCs as `actors/npcs` rows; journal on `ui/compendium` | **H2 data-only quest bindings** (every shard; Sky and Signal owner paths: `far-reach/data/questPageInteractions.ts`, `sunscar-dunes/data/questPageInteractions.ts`); **H9 NPC figure rows** generalising `npcRig` and `animation.ts#stepNpcHeadFocus` (Pine, DW, Nalati `models/npc/figureRig.ts` 211) | ~84 / 0 (`quest/ui.ts` DOM panel until the G459 UI kit) | 3,430 / 2,170 | **Codex X-C5** |
| C6 | Items and combat | 2,572 | 866 | Weapon sim on `combat/items` rows (`items#installDeclaredItems`, `engine/combat/Firearm#RangedAction`); held weapons from GLB + a held-item row (feel, sockets, reload clip, flash/tracer layers); loot and keepsakes as `economy/loot` rows | **H3 held-weapon rows** (Pine lever/crossbow/longbow, DW sword/`toonArms.ts`, Nalati `runtime/weapons/magazineFirearm.ts` 333 + `javelinSpear.ts` 667 + `weapons/recurve.ts` 438, Nine `fpArmsRig`); `ProjectilePresentation` glow/trace optional; `findsCatalogue.glass` → `swatches` | ~400 / ~150 viewmodel feel until H3 covers it | 2,170 / 720 | **Opus O3** (view) + **Codex X-C6** (sim) |
| C7 | Movers | 15 | 875 | `world/movers` rows on `game/plugin/mover#installDeclaredMovers`; kernels become an engine mover mechanic (G457 Q6) | **H5 track-row mover mechanic** (DW, Sky's 12 mover modules = C7 3,263 in Sky, Nine `runtime/props/moverCopies.ts`) | 0 / 0 | 15 / 875 | **Codex X-C7** |
| C8 | Audio | 940 | 1,740 | Cues, beds, zones and score as the `audio/audio` section (`engine/audio/declared#installDeclaredAudio`); DW's PCM layers as synth patch rows | **H10 synth-patch host** (DW `data/audioPcm.ts`, Nalati `runtime/audio/synth.ts` 589) | 0 / 0 | 940 / 1,740 | **Codex X-C8** |
| C9 | Boot glue | 2,094 | 2,332 | Boot from the output index (blobs by hash, G450); no `runtime/index.ts` install list; no const mirrors; misc tables as section JSON | **H11 index boot** (every shard; the Template already boots with no `runtime/`) | ~60 / ~60 entry | 2,030 / 2,270 | **Codex X-C9** |
| | **Total** | **18,955** | **14,266** | | | **~1,140 / ~560** | **17,800 / 13,700** | |

End state, est.: Pine ~1,140 custom lines (**5.4 %**), DW ~560 (**3.3 %**), plus AS scripts under the 10 % budget (Pine
≤ 2,130, DW ≤ 1,716; Sky's `roc.as` is 51 lines, so expect a few hundred).

---

## 4. The gap list: missing generic hosts, ranked by lines removed across six shards

Pine and DW lines are this page's measured component code; the other shards' lines are **est.** from file sizes found
by grep (listed). Rows are ranked by the total. A host lands with its second real user in the same row (G454 (10)).

| ID | Host (new or generalised) | Users (evidence) | Removes Pine / DW | Removes others (est.) | Total (est.) | Size (est.) | Lane | Order |
|---:|---|---|---:|---:|---:|---|---|---:|
| H0 | **Code models → GLB at build** (existing props/tiles hosts; a generator emit helper) | Pine, DW, Nalati `models/cragRock.ts` 173, `eagleRock.ts` 133, Nine `world/` | 2,840 / 2,130 | Nalati+Nine ≥ 1,000 | ~6,000 | M per shard, no runtime host | Opus | 1 (running: o293, o294) |
| H1 | **Ground moves + encounter binding** on DecisionHost: charge, flee, wander, perch-hop, graze-drift beside the W1 flight moves; encounter → binding → AS script | Pine elites/king, DW captain/monkey/crab, Sky roc, Signal matriarch, Nalati stormTitan/goldenKing | 2,000 / 1,100 | Nalati 1,200, Sky+Signal 300 | ~4,600 | L (+300 moves, +260 wiring) | Codex + Opus scripts | 2 |
| H3 | **Held-weapon rows** (GLB parts + sockets + feel row + reload clip + optional flash/glow/trace layers) | Pine lever/crossbow/longbow/knife, DW sword, Nalati firearm/javelin/recurve, Nine arms | 1,800 / 600 | Nalati 1,200, Nine 500 | ~4,100 | L | Opus view + Codex sim | 3 |
| H2 | **Data-only quest bindings**: observation rows (mover-at, actor-dead, zone, flag, item-held, timer) and action rows (the Wasm v1 command table §3.6) replace `QuestHostPorts`' closure maps | all six | 1,500 / 1,000 | Sky 100, Signal 100, Nalati 800 | ~3,500 | M (~400) | Codex | 1 |
| H11 | **Index boot**: install from the output index; delete `runtime/index.ts` lists and const mirrors | all six | 1,300 / 1,400 | Nalati, Nine ≥ 500 | ~3,200 | M | Codex | 1 |
| H5 | **Track-row mover mechanic** (G457 Q6) | DW, Sky (C7 3,263), Nine `moverCopies.ts` | 15 / 370 | Sky 2,500 | ~2,900 | L | Codex | 3 |
| H6 | **Ambient-life host** (mode table over `CirclingFlyer`) | Pine, DW gulls, Nalati flock/marmots | 800 / 350 | Nalati 700 | ~1,850 | M (~350) | Codex host + Opus rows | 4 |
| H4 | **Channel-program host** for weather/sky DAG rows (targets = named look uniforms) | Pine `data/weatherChannels.ts` (1,241 data, already DAG rows), Nalati `installWeather.ts` 282 + `WeatherFX.ts` 446, Sky painted look | 780 / 280 | Nalati 700 | ~1,750 | M | Codex host + Opus | 2 |
| H7 | **Water law rows** (photoreal, faceted, painterly) generalising `engine/world/waterSurface.ts` | Pine pond/creek/falls, DW ocean/reef, Nalati `water.ts` 165 + `waterGlsl.ts` 91, Sky | 490 / 750 | Nalati 250 | ~1,500 | M | Opus | 3 |
| H9 | **NPC figure rows** (rig GLB, idle/talk clips, one head-focus law, trade/talk pages) | Pine, DW, Nalati `figureRig.ts` 211 + `figureMotion.ts` 73 | 470 / 520 | Nalati 280 | ~1,270 | M | Codex | 4 |
| H10 | **Synth-patch host** (procedural PCM layers as rows) | DW `audioPcm`, Nalati `synth.ts` 589 + `sound.ts` 247 | 280 / 149 | Nalati 800 | ~1,230 | M | Codex | 4 |
| H8 | **Keeper rows**: `homeKeeper` floor policy and brain-by-kind table instead of 6 callbacks | DW keeper, Nalati `headlessCreatures.ts` | 0 / 400 | Nalati 300 | ~700 | S | Codex | 2 |

### Existing hosts that aren't generic yet, and the fix

| Host | Problem | Makes it generic |
|---|---|---|
| `game/plugin/simulation.ts#installDeclaredQuestHost` / `installQuestHost` | `QuestHostPorts`: closure maps for observations, actions, director actions | H2 binding rows; the host resolves them against mechanics |
| `game/shard/declaredRows.ts#declaredSpeciesLook` | `recipes: Map<string, fn>` per shard | look rows + GLB; delete the recipe map |
| `game/shardfile/homeKeeper.ts#createNativeCreatureRoster` | 6 callbacks (`attach`, `joined`, `ground`, `retired`, `preflight`, `bindBodyStep`) | H8: floor policy + brain table rows; API cut to body/draw/retire/refill |
| `game/plugin/animation.ts` (head focus, lift) | per-shard parity knobs; hidden `mem['rise']` keys | one law (G415); typed `LiftState` |
| `engine/combat/view/projectile.ts#ProjectilePresentation` | requires bolt glow and tracer | optional layers (H3) |
| `game/plugin/quests.ts#createReadingRoster` | Pine's save wire `continuation.bare/wrapped` as API | uniform continuation; Pine's save adapter maps it |
| `game/bag/findsCatalogue.ts` | `glass` field is DW sea glass | rename to `swatches` |
| `game/plugin/mover.ts#MountedBody`, `#GrappleSim` | horse `'stampede'` literal; one user (Nine) | gaits as rows + a second rider, or back to the shard |
| `engine/world/waterSurface.ts` | Pine's water in the engine (303 one-user lines) | H7, or move to Pine |
| 84 exported host functions with `ports`/`callbacks`/`hooks`/`recipes` | TS glue in every shard | lint ratchet on new ones (G454 (5)); convert as each component closes |

---

## 5. Lane assignment: one component per lane, both shards (G406)

No detours through `runtime/` (G465): code goes straight to its end state, and only the "stays" column moves in. Grid-ready
work waits. Each row deletes the TS it replaces in the same commit set.

| Lane | Component | Row 1 | Row 2 | Row 3 |
|---|---|---|---|---|
| **O1** (o293) Opus | C1 models → GLB | DW `runtime/models/*` (1,319: `ropeBridge.ts`, `trophyPlaques.ts`, `cove.ts`, `pier.ts`, `shrine.ts`, `slots.ts`, `entryDeck.ts`) → generator GLB + `world/props` rows | Pine `runtime/models/*` (1,019) + `runtime/props/bakedBuilding.ts` (281) + `runtime/kit/caveInterior.ts` → GLB | Pine `runtime/world/*` (1,121) and DW `world/*` (1,368) builders → tiles/props sections |
| **O2** (o294) Opus | C2 looks | Pine `runtime/looks/keyedSky.ts`, `rainFx.ts`, `groundCover.ts` → graph JSON + day/weather rows, driving H4 | DW `runtime/looks/streamedCover.ts`, `rows.ts`, `faceted{Sky,DayBackdrop}.ts`, `coverGrid.ts`, `bakedIsland.ts` → graph JSON over `sdk/looks/streamedInstances` | character looks (`castawayLook`, `traderLook`, `antlerKingLook`, `longbowLook`) → GLB/look rows; delete the `declaredSpeciesLook` recipes |
| **O3** (new) Opus | C6 held weapons (view) | H3 held-weapon row + Pine `runtime/items/leverFirearm.ts` 268 on it | Pine `boltCrossbow.ts` 261, `viewmodel/staveBow.ts`, `gloveHands.ts` | DW `runtime/viewmodel/toonArms.ts` 134 + `weapons/IronSword.ts` 118 |
| **O4** (next free) Opus | C3 + water + AS scripts | H7 water rows: Pine `waterSurface.ts` + `world/beaverPool.ts`; DW `facetedOcean.ts`, `reefBed.ts`, `world/Cove.ts` | `king.as` + `captain.as` + elite v1 scripts, each with a seeded scenario test (unblocks X-C4 row 3) | H6 ambient-life rows: Pine `ambientLife.ts` + `bodylessForager.ts`, DW `gullFlock.ts` |
| **X-C4** (x8) Codex | C4 creatures | DW `sim/keeper.ts`, `fauna`, `runtime/placement.ts`, `creatures/Enemies.ts` → `installDeclaredBrains` + H8 keeper rows | H1 ground moves; DW `species/*Policy.ts`, Pine `runtime/roster.ts`, `nightDirector.ts`, `herdShelter.ts` → brain/spawn rows | Pine `combat/eliteScripts.ts`, `combat/install.ts`, `runtime/elites.ts`, `king*.ts` → encounter rows + O4's scripts; then the H6 host |
| **X-C5** (x5) Codex | C5 NPCs, quests | H2 binding rows replacing `QuestHostPorts` closures, with Sky + Signal as the second users | Pine `quest/index.ts`, `runtime/quest.ts`, `quest/contracts.ts`, `rides.ts`, `stag*.ts`; DW `runtime/quest.ts`, `quest/adventure.ts`, `Complete.ts`, `Spine.ts` → quest graph + director stages | H9 NPC rows: Pine `runtime/npc/standInPerson.ts`, `lodge.ts`, `trader.ts`; DW `runtime/npc/Trader.ts`, `Castaway.ts`, `quest/TraderStall.ts` |
| **X-C6** (x6) Codex | C6 items (sim) | Pine `runtime/weapons/headless{Longbow,Crossbow,Lever}.ts` + `weapons/leverAction.ts`, `equipment.ts` → `combat/items` rows on `RangedAction` | loadouts: Pine `loadout/loadout.ts` 188, DW `runtime/loadout.ts`, `loadout/rows.ts` → item rows | DW `loot/keepsakes.ts`, `finds`, `shop`, `perks`, `presentation`, `effects` → `economy/loot` rows |
| **X-C7** (x1) Codex | C7 movers | DW `data/movers.ts` read as the `world/movers` section; `world/Zipline.ts` + `runtime/models/zipline.ts` sim halves → mover rows (C7 closes for both shards) | H5 track-row mover mechanic, second user Sky's 12 mover modules | then C1 data side: DW world-build data → sections (x4's current row) |
| **X-C8** (x4) Codex | C8 audio (+ H4) | Pine `runtime/audio/*` (280) + DW `runtime/audio/*` (149) → `installDeclaredAudio`; `audioZones` / `audioPcm` emitted as section JSON | H10 synth-patch host (DW PCM, Nalati `synth.ts`) | H4 channel-program host for Pine's weather DAG, Nalati as second user; delete `world/weather.ts` glue |
| **X-C9** (x7) Codex | C9 glue, escapes | DW escapes 37 → 0 through section readers, no mirrors; delete DW `runtime/const.ts` (477); P4 re-base DW (G464) | Pine escapes 155 → 0 from `data/bootFiles.ts`, `runtime/index.ts`, `runtime/headless.ts`, `runtime/sections.ts`; delete Pine `runtime/const.ts` (253) | H11 index boot; JSON-shaped `data/*.ts` become generator-emitted section JSON in both shards |

x8 and x1 are on Sky rows (KS1, gust) in STATE. They move to C4 and C7 because both carry their W1 work straight over:
roc.as and the moves library become H1, and Sky's movers become H5's second user.

---

## 6. Headline metric and expected percentages

**Components closed: 0 of 9 now.** Expected closing order: C7 (batch 1), C8 and C9 (batch 2), C5 and C3 (batch 3),
C1, C2, C4 and C6 (batch 4). Report each hour: components closed N of 9, custom lines per component per shard (the §1.2
table), Pine and DW %.

Pace assumption, **est.**: ~500 lines/h across the 10 lanes for code (W2 history ran 360–1,150/h), plus the measured
`data/*.ts` lines that drop when their readers switch to section JSON. Base = live tree (Pine 18,955, DW 14,266).

| Batch | Window (Cancun) | Code cut P / D (est.) | Data reads → sections P / D (measured lines) | Pine after | DW after | Components closed |
|---|---|---:|---:|---:|---:|---|
| now | 13:00 10-16 | | | 18,955 = **89.0 %** | 14,266 = **83.1 %** | 0 / 9 |
| B1 | → 00:00 10-17 (W2 close, G451) | 2,700 / 2,800 | 3,308 (`weatherChannels`, `audioZones`, `questPageInteractions`, `journal`, `bootFiles`, `wardensHollow`, `undergrowthPaint`, `audio`) / 4,503 (all of DW, G464) | 12,947 = **60.8 %** | 6,963 = **40.6 %** | C7 |
| B2 | → 12:00 10-17 | 2,500 / 2,000 | 1,563 (rest of Pine) / 0 | 8,884 = **41.7 %** | 4,963 = **28.9 %** | + C8, C9 |
| B3 | → 00:00 10-18 | 3,000 / 1,800 | | 5,884 = **27.6 %** | 3,163 = **18.4 %** (DW past 80/20) | + C5, C3 |
| B4 | → 12:00 10-18 | 2,000 / 1,000 | | 3,884 = **18.2 %** (Pine past 80/20) | 2,163 = **12.6 %** | + C1, C2, C4, C6 for DW; Pine C4/C6 by its tail |
| end | | | | ~1,140 = **5.4 %** | ~560 = **3.3 %** | 9 / 9 |

Two cautions. (1) The data column is real on the source ruler; on the output ruler it shows up as the P4 re-base when a
shard closes. It only counts if the reader goes through a section host: a new `runtime/const.ts` mirror cancels it.
(2) Platform lines go up (H1–H11 ≈ +4,000 est.). That is the KR1 net-lines report, not a gate (G455 (1)).

**Needs Jake (one pick):** G452/G463 put every lane on the W1 spike at 00:00. Recommended: **keep the ten component
lanes on their components past midnight** (B2–B4 as the G463 closure rows), because H1, H2 and H5 carry Sky and Signal
as second users anyway, so the W1 spike rides along inside C4, C5 and C7.
