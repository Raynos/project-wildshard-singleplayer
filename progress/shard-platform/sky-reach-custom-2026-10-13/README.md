# Sky Reach: why it is still 50 % custom, and the way out

Measured 2026-10-13 at `ccf5c7532` with `scripts/shard-platform.mjs`. `src/shards/far-reach/` had no uncommitted
changes. Every number below adds up to the script's own total. Machine-readable copy: [data.json](data.json).

## The number

| | Lines |
|---|---:|
| Shard TS outside `generators/` and `data/` | 2,547 |
| Raw GLSL in `data/` (G306, added on top) | 614 |
| Game / engine / SDK code only Sky uses (G294) | 237 |
| **Custom total** | **3,398** |
| Frozen legacy (`far-reach-legacy/`, same unit) | 6,777 |
| **Custom ÷ legacy** | **50.1 %** |
| The 20 % bar | 1,355 |
| Still to remove | 2,043 |

The brief said 3,569 and 6,889. 6,889 is the old physical-line baseline in `lint/shard-platform.json`. The script's
denominator recounts the sealed legacy files the same way it counts custom code (nonblank, comments stripped), which
gives 6,777, so the bar is 1,355 lines, not 1,378. The 3,569 reading came before today's Sky bake commits
(`a77443f19`, `b7dd70203`, `fd1b0a9a4` …). Raw GLSL is 647 lines in all: 614 in `data/` plus 33 that sit inside
runtime TS files and are already in the 2,547. AssemblyScript: 0 lines.

## Why 50 % and not 15 %

1. **The bake moved the geometry, not the drawing.** The world's shapes are built in `generators/` now, but the
   client side still runs as Sky code: it loads each GLB, puts its look on, patches its shaders and registers its
   colliders (`world/`, 848 lines). Only the islands come in as shardfile props tiles. The content gate in this run
   reports 0 L0 render tiles.
2. **Raw GLSL counts wherever it sits (G306).** The 12 look rows in `data/` are 614 lines of hand-written shader
   source. Being in `data/` doesn't help: only SF59 graphs count as data. Sky has no graph look yet.
3. **Moving code into the platform doesn't help (G294).** 237 lines of engine, game and SDK code have Sky as their
   only user: `paintedLook` in `engine/render/dataLook.ts` (148) and the headless movers and updraft in
   `game/plugin/mover.ts` (69).
4. **Behaviour is still wired by hand.** Rows on shared systems already exist for weapons (`cone`), grazers, flyers,
   bosses, director stages, movers and modes (`src/format/`), and Sky uses many of them. But Sky's runtime still binds
   them body by body. The fan family, the creature glue, the quest wiring and the two installers come to 1,041 lines.
5. **The rule goes by folder.** Every TS file outside `generators/` and `data/` counts, including declarations:
   `shard.config.ts` (35), the legacy `manifest.ts` (62), budgets, roster and card lists (71 more). Section 2.3 of the
   design calls `shard.config.ts` SDK-driven, but the metric counts it.

## The ten parts

| # | Part | Lines | What it is |
|---|---|---:|---|
| 1 | Shard glue | 168 | config, manifest, budgets, roster |
| 2 | Movers + islets | 237 | Rising Islets, winch, updraft |
| 3 | Raw GLSL looks | 614 | 12 shader rows in `data/` |
| 4 | World builders | 848 | client side of the baked world |
| 5 | Sky + grade | 253 | panorama, sun, cloud sea |
| 6 | War fan | 337 | cone weapon, view, vanes, cues |
| 7 | Creatures + Roc | 218 | brain glue, flock, boss view |
| 8 | Quest wiring | 125 | winch, roost, reward, saves |
| 9 | Effect hosts | 237 | cards, disc, meadow, wake, wind |
| 10 | Installers | 361 | `runtime/index.ts`, `headless.ts` |
| | **Total** | **3,398** | |

## The way out of each part

Sizes: S is up to ½ day, M up to 2 days, L up to 5. "Removed" is my estimate of lines that leave the custom count.

| # | Way out | Removed | Size |
|---|---|---:|---|
| 1 | data rows + SDK `defineShard` | 120 | S |
| 2 | mover / mode rows (G388, MV, PM-4) | 200 | M |
| 3 | SF59 shader graphs (G382) | 614 | L |
| 4 | three.js generators + bake to tiles | 760 | L |
| 5 | look rows + post graph | 230 | M |
| 6 | melee row + AS gust hook + view row | 280 | M |
| 7 | brain / boss rows + `roc.as` | 170 | L |
| 8 | director stage rows + state rows | 100 | M |
| 9 | generic effect rows (2nd user) | 180 | M |
| 10 | shrinks as 1–9 land | 250 | S |

**1. Shard glue (168 → 48).** Pure rows (budgets, ceilings, roster, card and Explore images) move into `data/`. The
layout maths goes to `generators/`, since it is used at bake time. The manifest's fields (boot sources, tiers,
minimap) move into `defineShard`. *Blockers:* `defineShard` has no boot, tier or budget fields yet, and a data
module may not export functions (`bootSources` is a function of the tier). The coordinator should also rule on
`shard.config.ts`: the design says it doesn't count, the metric counts it. Those 35 lines are not counted as removed
here.

**2. Movers, Rising Islets, updraft (237 → 37).** G388 is decided: Sky's headless moves onto the generic
`MoverScriptDriver` and the 69 one-user lines in `plugin/mover.ts` go. After that, the islet bodies become baked mover
body nodes with chain rows (MV-1/MV-2), the RIDE/CALL prompts become socketLift rows answered by the platform's
`commandSocketLift`, and the updraft becomes a PM-4 traverse row. *Blockers:* the work is queued for sp-x6. The
drawing and prompt half, `SocketLift` and `UpdraftDriver` need a second real user (Driftwood's boat and bridge, MV-3,
or Nine's lifts, MV-4). Without one, the generic code still counts against Sky (G294).

**3. Raw GLSL looks (614 → 0).** G382 is decided: each of the 12 programs is rewritten as an SF59 material graph,
keeping its look. The graph IR already has vertex and fragment stages, noise, textures, attributes and sun inputs.
Each switch goes to Jake as a labelled before / after board (G387). *Blockers:* graphs only bind to shardfile tile and
prop materials (`game/shardfile/clientGraphs.ts`). Sky's meshes are still built by runtime code, so either this goes
piece by piece together with part 4, or `plugin/look` gets a graph-compile call (Signal would be its second user).
This is Opus work.

**4. World builders (848 → 88).** Under G311 and SF80, each static piece (sky isles, keels, knolls, docks, crown,
trees, dressing, mill, book stand, bridges, shacks) becomes a real three.js scene in `generators/` passed to
`bake(scene)`. It ships as L0 props and collider tiles that the generic client draws, the way the islands already do
(`fd1b0a9a4`). The mill hub and vane rotors become always-on mover tracks. The falls and the hover-deck glow become
graph params bound to time or state. What stays is the storm's lightning, the meadow's camera follow and the winch and
notes interactables. *Blockers:* `bake(scene)` hasn't been run for Sky's remaining pieces, the looks need part 3, and
Opus has to do parity captures.

**5. Sky and grade (253 → 23).** The shardfile `look` section takes it as rows (G321/G322, Sky keeps its own sky):
the panorama as a still-image sky row, a fixed `dayCycle` row, sun light rows and the grade as a post-stack graph.
`paintedLook` in `dataLook.ts` (148) is then deleted, or Nalati or Signal adopts it and it becomes public.
*Blockers:* the format's look must be able to carry a painted panorama and the heading haze. It's a look change, so it
needs a board, and it's Opus work.

**6. War fan (337 → 57).** Under G382, SWING and HEAVY become a row on the shared melee family (engine `Melee`). GUST
becomes an AssemblyScript weapon hook (`format/weaponHooks.ts`, which Nalati already uses), counted in its own column.
The model becomes a `view` row on the baked fan GLB with a graph material. The cues become SF29 audio rows, and the
vanes turning becomes a director input. *Blockers:* the melee host has to accept an AS secondary action, and
`declaredWeaponVoices` (8, G294) needs a second user or SF29. *Fallback:* the design's WP-5 keeps the cone family
trusted inside the 20 %, which still lets the view, item and audio rows go (about 110 lines).

**7. Creatures and Roc (218 → 48).** BR-1 (rows admitted automatically, each body keeping its own authority) and BR-2
(the platform builds the boss) turn goats, rays and wisps into grazer and diver rows. The Roc becomes a boss row whose
last phase is `roc.as`. The flock becomes spawn rows on the shared homes host, and the Model Explorer specimens come
from the baked bodies. *Blockers:* BR-3 / SF49-p is **held** in `open-x-queue.md`, because the Roc's flight and the
finite keeper have no shared seam that keeps the frozen traces. It needs either a re-recorded Roc trace (as G388
allowed for the movers) or a G314 clip check.

**8. Quest wiring (125 → 25).** The quest graph is already rows. The rest moves to DIR-5 director stage rows
(`format/directorStages.ts` exists) for roost-clear, the vanes, the winch unlock and the Roc's defeat. Persistence
becomes declared state rows. *Blockers:* Sky isn't on the director host yet, and the legacy save key can only go with
SF73.

**9. Effect hosts (237 → 57).** These are generic by design (card field, cloud-sea disc, camera-tiled meadow, wake
ribbon, wind streaks) but only Sky uses them. With graph materials, each becomes a generic effect row in game, public
once a second real shard uses it, for example Nalati's meadow on the tile field or Signal's sand or fire on the card
field. An SF25 client script that only presents is the other option. *Blockers:* there is no second real user today
(G312), and SF25 isn't built.

**10. Installers (361 → 111).** `runtime/index.ts` and `runtime/headless.ts` only put the other parts together, so
they shrink as each part lands. Section 5.2 of the design deletes a shard's installer in the commit that makes it
80/20. The capture hooks (`stage`, `isletAt`, `interactIslet`, `raise`) move to a generic capture API.

## The path to 20 %

| Step | Part | Custom after | % |
|---|---|---:|---:|
| now | — | 3,398 | 50.1 |
| 1 | Shard glue | 3,278 | 48.4 |
| 2 | Movers (G388) | 3,078 | 45.4 |
| 3 | GLSL → graphs | 2,464 | 36.4 |
| 4 | World → tiles | 1,704 | 25.1 |
| 5 | Sky + grade rows | 1,474 | 21.8 |
| **6** | **War fan rows** | **1,194** | **17.6** |
| 7 | Creatures + Roc | 1,024 | 15.1 |
| 8 | Quest rows | 924 | 13.6 |
| 9 | Effect hosts | 744 | 11.0 |
| 10 | Installers | 494 | 7.3 |

**Sky passes at step 6** (1,194 ≤ 1,355). Steps 3–4 are 40 % of the job and are graphical. They are one track,
piece by piece: bake a piece to tiles, and its look becomes a graph at the same time. Parts 1, 2, 7 and 8 aren't
graphical and can run beside them. If the fan stays trusted (WP-5), steps 1–5 plus 7 still pass, at 1,304 lines
(19.2 %).

**What stays as the trusted 20 % after step 6 (1,194 lines):** creatures and the Roc 218, effect hosts 237,
installers 361, quest wiring 125, plus the tails of parts 1–6: world presentation 88, fan gust adapter 57, glue 48
(`shard.config.ts` among them), movers 37 and sky 23. Steps 7–10 are how to get from there to Jake's 15 % and below.

## Per file

Paths are relative to `src/shards/far-reach/` unless they start with `src/`. "(G294)" means platform code that only
Sky uses. "(glsl n)" gives the raw shader lines inside the count.

**1. Shard glue (168)**: `budgetCeilings.ts` 13, `budgets.ts` 24, `explore/art.ts` 5, `layout.ts` 20, `manifest.ts` 62,
`roster.ts` 5, `shard.config.ts` 35, `thumbs/card.ts` 4.

**2. Movers, Rising Islets, updraft (237)**: `runtime/movers.ts` 20, `world/islets.ts` 16, `world/risingIslet.ts` 122,
`src/game/plugin/mover.ts` 69 (G294: headless installer 15, createHeadlessMovers 12, verifiedMoverModules 8,
headlessMoverSaved 8, UpdraftDriver 7, HeadlessMoverInstallation 6, inUpdraft 5, rest 8), `src/sdk/entries.ts` 9
(G294: SocketLift), `src/sdk/modes.ts` 1 (G294: UpdraftRow).

**3. Raw GLSL looks (614)**: `data/meadowLook.ts` 120, `data/cloudSeaLook.ts` 96, `data/shackLook.ts` 68,
`data/stormLook.ts` 61, `data/skyCardsLook.ts` 54, `data/isleLook.ts` 41, `data/dressingLook.ts` 35,
`data/paintLook.ts` 35, `data/millLook.ts` 31, `data/bridgeLook.ts` 26, `data/skyDomeLook.ts` 25,
`data/skyIsleLook.ts` 22 (all raw GLSL).

**4. World builders (848)**: `world/build.ts` 173, `world/shapes.ts` 100, `world/mill.ts` 63, `world/baked.ts` 57,
`world/storm.ts` 57, `world/isle.ts` 45, `world/meadow.ts` 43, `world/crown.ts` 38, `world/distant.ts` 37 (glsl 19),
`runtime/looks/modelIntake.ts` 34, `world/bookStand.ts` 32, `world/meshes.ts` 31, `world/skyIsleHd.ts` 30,
`world/dressing.ts` 27, `world/trees.ts` 27, `quest/keeper.ts` 19, `world/skyDock.ts` 12, `world/resources.ts` 11,
`world/shack.ts` 11, `src/sdk/looks/modelLibrary.ts` 1 (G294: bindRigid).

**5. Sky and grade (253)**: `look/render.ts` 46, `look/sky.ts` 24, `look/image.ts` 13, `look/sun.ts` 13,
`look/cloudSea.ts` 9, `src/engine/render/dataLook.ts` 148 (G294: paintedLook 64, painterLightGlsl 20,
NEUTRAL_FRAGMENT 19, PaintedLookSpec 13, headingHaze 10, painterLight 7, rest 15).

**6. War fan (337)**: `runtime/weapons/coneFan.ts` 109, `runtime/weapons/coneStrikes.ts` 52, `runtime/fan.ts` 49,
`weapons/fanModel.ts` 36, `quest/vanes.ts` 20, `runtime/items.ts` 15, `models/gear.ts` 13, `weapons/fanShapes.ts` 11,
`runtime/audio/cues.ts` 10, `weapons/WarFan.ts` 8, `weapons/rows.ts` 6, `src/game/plugin/audio.ts` 8 (G294:
declaredWeaponVoices).

**7. Creatures and Roc (218)**: `runtime/flock.ts` 41, `runtime/brains.ts` 34, `species/stormRoc.ts` 25,
`models/creatures.ts` 23, `runtime/stormRocBrain.ts` 19, `combat/stormRoc.ts` 13, `species/bodies.ts` 12,
`species/rig.ts` 11, `species/goats.ts` 10, `species/driftRay.ts` 8, `species/skyGoat.ts` 8,
`runtime/brainCatalogue.ts` 7, `species/galeWisp.ts` 6, `src/engine/ai/diver.ts` 1 (G294: readRaptorDiverSpec).

**8. Quest wiring (125)**: `runtime/quest.ts` 48, `quest/install.ts` 38, `runtime/persistence.ts` 37,
`quest/flags.ts` 2.

**9. Effect hosts (237)**: `runtime/looks/windFx.ts` 119 (glsl 9), `runtime/looks/cardField.ts` 41,
`runtime/looks/tileField.ts` 31, `runtime/looks/wakeRibbon.ts` 31 (glsl 3), `runtime/looks/discLayer.ts` 10,
`runtime/looks/knollGlsl.ts` 5 (glsl 2).

**10. Installers (361)**: `runtime/index.ts` 266, `runtime/headless.ts` 83, `plugin.ts` 8, `runtime/standalone.ts` 4.

## How this was measured

The table comes from a scratch copy of `shardLines()` in `scripts/shard-platform.mjs`, changed only to print one row
per file. Per file, the custom count is: TS lines if the file is outside `generators/` and `data/` and isn't a test,
plus the raw GLSL lines of `.glsl` files and of `data/` or `generators/` TS files. On top of that come the G294 sole
exports the script lists under `gameSystemAttribution`. These add up to 3,398, the same as the script's
`customRuntimeLines`. The "removed" figures are estimates from reading the files, not measurements.
