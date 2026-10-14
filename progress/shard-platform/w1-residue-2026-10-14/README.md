# W1's last 10 %: what is left in Sky and Signal, and the way to zero

Measured 2026-10-14 at `99c9a7079` with `node scripts/shard-platform.mjs --json`, on a clean `git archive` of that
commit with `node_modules` linked by `scripts/link-node-modules.mjs` and `pnpm gen` run (the shared tree had
uncommitted edits under `src/shards/far-reach/`). Every number below adds up to the script's own totals, per shard and
per component. Machine-readable copy: [data.json](data.json). This is a mini plan; nothing here is built.

**Short answer.** It is not 4 more hours. About 4 hours buys the quick wins (65 lines; Sky to 9.1 %, Signal to 9.3 %).
What is left after that is the trusted runtime itself: the plugin class, its world assembly and its wiring. It goes
only when the data client can do those jobs from rows, and **both shards have to drop their runtimes in the same
commit set** (see blocker B1). That is roughly **230–300 lane-hours** (about 105 of them shared platform features),
**2–3 days nonstop with 4 Opus + 5 Codex, 4–5 days realistically**. There is no hard technical blocker. There are two
ordering traps and four calls for Jake. With everything native the shards measure **Sky 23 lines (0.34 %) and
Signal 6 (0.15 %)**. Those last lines go with a ruler rule and two small fixes, so literal zero is reachable. The
sensible floor is **Sky ≤ 1 % (its meadow), Signal 0 %**.

## The number

| | Sky Reach | Signal Dunes |
|---|---:|---:|
| Shard TS outside `generators/` and `data/` | 599 | 384 |
| Raw GLSL in `data/` (G306) | 7 | 0 |
| Platform code only this shard uses (G294) | 51 | 26 |
| **Custom total** | **657** | **410** |
| Frozen legacy | 6,777 | 4,122 |
| **Custom ÷ legacy** | **9.69 %** | **9.95 %** |
| AssemblyScript (own column, not custom) | 18 | 67 |

| Component | Sky | Signal |
|---|---:|---:|
| C1 static world | 366 | 161 |
| C2 looks | 92 | 139 |
| C3 effects | 49 | 45 |
| C4 creatures | 0 | 0 |
| C5 NPCs and quests | 17 | 8 |
| C6 items and combat | 27 | 12 |
| C7 movers | 0 | 0 |
| C8 audio | 0 | 0 |
| C9 boot glue | 106 | 45 |

The brief's Sky C1 of 375 (9.83 %) was read at `fc005c527`. Nine C1 lines have gone since then. Signal is unchanged.

## Words used on this page

- **Trusted runtime**: the shard's own TypeScript plugin (`plugin.ts`, `runtime/index.ts`). It still loads the world,
  wires the quest and starts the effects. The shardfile's `runtime.binds` lists the sections it owns. Sky binds
  quests, ledger, state, items, spawns, modes, props and clientChannels. Signal binds all of those except modes and
  props.
- **Data client**: the game's generic shardfile client. It runs the Template and Pastel with no shard code at all.
  "Native" below means the data client runs that section from rows.
- **G294**: platform code with one shard user counts against that shard. Code that only the data client calls counts
  against no shard.

## What is left, and the way to zero

Effort: S ≤ ½ day, M ≤ 2 days, L ≤ 5 days. "h" means lane-hours of shard work, not counting the shared features
F1–F8 below. Class: **a** just work · **b** needs a missing platform feature · **c** needs Jake's decision ·
**d** stays custom.

### Sky Reach (657)

| Group | Lines | Components | Way to zero | Effort | h | Class |
|---|---:|---|---|---|---:|---|
| Static scene assembly | 147 | C1 120, C2 24, C5 3 | bake every scene into props tiles; channels drive the moving nodes (F4) | L | 24 | b |
| Boot glue, installer shell | 83 | C9 58, C1 10, other 15 | deleted with the runtime; the last 4 manifest lines need F8 | M | 8 | a |
| Baked-world loader | 82 | C1 59, C2 20, C3 3 | library section; the bake writes material ids | M | 8 | a |
| Island props, runtime-bound | 50 | C1 50 | unbind props; 39 G294 lines lose their only user | S | 4 | a |
| Quest world wiring | 47 | C1 38, C5 5, C9 4 | bridge mover; a director condition on the winch channel (F1) | M | 12 | b |
| Creatures and ray wakes | 39 | C3 31, C9 5, C1 3 | native spawns (F1); wake per D3 | M | 8 | c |
| Painted look | 35 | C2 20, C3 12, other 3 | look section in the shardfile (F2) | S | 3 | b |
| Near meadow blades | 29 | C1 29 | no later-wave user; keep (D2) | 0 or M | 0 | d |
| Crown storm lightning | 25 | C1 21, C6 3, C2 1 | props tile plus a graph-timed flash | S–M | 6 | a |
| Layout maths | 23 | C1 23 | move to generators/, emit data | S | 3 | a |
| Explorer specimens | 17 | C6 8, C1 7, C9 2 | gear rows over baked assets | S | 3 | a |
| Roc fight and gale wall | 13 | C9 11, other 2 | boss rows (F1), telegraph row (F3) | S | 4 | b |
| Per-frame dressing | 12 | C9 11, C1 1 | spinning movers; glow graph on the player mode (F7) | S | 3 | b |
| War fan view | 12 | C6 8, C1 2, C2 2 | item view row with the silk graph (F1) | S | 4 | a |
| SDK bake helpers (G294) | 12 | C2 12 | Signal reuses bindRigid; move bakeColourTexture | hours | 1 | a |
| Wind fields and gust | 11 | C9 9, C2 2 | effect rows: emitters plus a burst on gust (F3) | S | 3 | b |
| Capture staging hooks | 11 | C5 5, C6 3, C9 3 | capture-stage rows or a test helper | S | 3 | a |
| Roc plumage GLSL | 7 | C2 7 | mapped graph after F5 | S | 2 | b |
| Updraft impulse | 2 | C9 2 | unbind modes; traverse rows run natively | hours | 1 | a |

### Signal Dunes (410)

| Group | Lines | Components | Way to zero | Effort | h | Class |
|---|---:|---|---|---|---:|---|
| Quest world wiring | 68 | C1 45, C2 16, C5 7 | native quests and state; hook scenes for fire and braziers (F1) | M | 12 | b |
| Lent sand and dune skirt | 59 | C2 44, C1 15 | skirt as a terrain row (F6); lending deleted | M | 6 | b |
| Boot glue, installer shell | 55 | C9 38, other 17 | deleted with the runtime; the last 4 manifest lines need F8 | M | 6 | a |
| Painted look, Last Light rim | 46 | C2 35, C1 11 | look section (F2); the rim as a family look row | M | 8 | b |
| Fire effect plumbing | 40 | C3 40 | effect rows at prop anchors plus light slots (F3) | S–M | 6 | b |
| Roaming firelight, pools | 29 | C1 27, other 2 | drop the moving light (D4); pools as a surface row | S | 4 | c |
| Place builder | 29 | C1 22, C2 5, C3 2 | props tiles with light rows; glow as a hook scene (F4) | M | 6 | b |
| Baked-world loader | 28 | C1 18, C2 9, C3 1 | library section; surface rows read host fields | S | 4 | a |
| Explorer specimens | 24 | C1 12, C6 7, C9 5 | gear rows over baked assets | S | 3 | a |
| Quest-driven dusk | 23 | C2 21, C9 2 | an AS client script eases shared.dusk | S | 4 | a |
| Held whip owners | 5 | C6 3, C1 2 | native item view rows (the Template has a whip) | S | 2 | a |
| Terrain field in manifest | 2 | C1 2 | data client builds it from the terrain section | S | 2 | a |
| SDK library types (G294) | 2 | C2 2 | gone with the library section | hours | 1 | a |

## What each group is

Paths are relative to the shard folder unless they start with `src/`.

### Sky Reach

- **Static scene assembly (147)**: `world/build.ts` 90, `world/shapes.ts` 25, `world/crown.ts` 16, `world/mill.ts` 13,
  `runtime/index.ts` 3. The recipes are generated already. The runtime still hands over geometry and materials for
  several things: the ground scene (made from the island tiles), the hero statics with their mapped looks, the rope
  and hover routes, the islet road lips and posts, the docks, the winch house, the book stands, the vanes, the crown
  arena and the mill.
- **Boot glue (83)**: `runtime/index.ts` 60 (imports, the `far.gust` / `far.meadowBlades` / `far-fan` module
  augmentations, the row bound, class fields), `manifest.ts` 8, `plugin.ts` 7, `runtime/headless.ts` 5,
  `runtime/source.ts` 3.
- **Baked-world loader (82)**: `world/baked.ts` 27, `world/meshes.ts` 19, `world/isle.ts` 13, `world/dressing.ts` 8,
  `world/materials.ts` 7, `world/shack.ts` 4, `runtime/index.ts` 4. This is the bakedMeshWorld set-up, a material
  picked per kind (look, shack, dressing or paint), the two model libraries and the palette.
- **Island props (50)**: `src/game/shardfile/runtimeWorld.ts` 35 and `runtimeProduct.ts` 4 (G294,
  `bindRuntimeProps`), `world/isle.ts` 8, `runtime/index.ts` 3.
- **Quest world wiring (47)**: `world/build.ts` 27, `runtime/index.ts` 19, `quests/flags.ts` 1. This covers the fallen
  bridge's pivot and its "raised" collider, the winch and notes prompts, the keeper stand and the vane rotors. It also
  has the winch observation that raises the bridge, shows a toast and advances the quest, plus the quest page,
  held-script, save-restore and socket-lift wiring.
- **Creatures and wakes (39)**: `runtime/looks/wakeRibbon.ts` 30 (a camera-facing ribbon rebuilt on the CPU every
  frame), `runtime/index.ts` 9 (populate, the wake loop).
- **Painted look (35)**: `look/render.ts` 27 (the panorama dome graph, the glow / maelstrom / sea / cumulus dressing,
  the clock, the LUT), `runtime/looks/discLayer.ts` 8.
- **Meadow (29)**: `world/meadow.ts` 25 (the baked blade chunks drawn as instanced LOD meshes), `runtime/index.ts` 4
  (the tier knob).
- **Storm (25)**: `world/storm.ts` 23, `world/build.ts` 2. The vortex ring and three bolts strike every 3.5–8 s from the
  cosmetic RNG, with a double flicker.
- **Layout maths (23)**: `layout.ts`, the rope sag, knoll height, rim, spire and span helpers that `data/` rows and
  generators read.
- **Explorer (17)**: `models/gear.ts` 11, `roster.ts` 6. They build the mill, bridge kit and vane for the Model
  Explorer.
- **Roc fight and gale wall (13)**, **per-frame dressing (12)** (hover-deck glow, mill hub and vane spin, storm tick),
  **wind and gust (11)**, **capture hooks (11)** (`stage()` for the Roc poses and strikes, `gustVanes`), **updraft
  (2)**: all in `runtime/index.ts`.
- **War fan view (12)**: `weapons/fanModel.ts` 7 (swaps the silk for its graph), `runtime/weapons/heldFan.ts` 5.
- **Bake helpers (12)**: `src/sdk/bake/texture.ts` 11 and `src/sdk/looks/modelLibrary.ts` 1. These are G294 lines that
  only Sky's generators reach. Signal's generators carry their own copy of `bindRigid`.
- **Roc GLSL (7)**: `data/paintLook.ts` `ROC_SLATE_EDITS`, a raw shader edit that turns the Roc's browns slate grey.

### Signal Dunes

- **Quest world wiring (68)**: `world/build.ts` lines 1–101. This is the places, interaction rules, logbook and fire
  prompts, the well bucket's channels fed from flags, the braziers' oiled / lit state, the lantern, the fire catching,
  the quest page and the crack targets.
- **Lent sand and skirt (59)**: `runtime/looks/bakedGround.ts` 37 (the skirt pack and its grid-cube cut, the borrowed
  material), `plugin.ts` 8, `look/sandEntry.ts` 8, and `hybridPresentation` / `runtimePresentation` 6 (G294).
- **Boot glue (55)**: `plugin.ts` 34, `manifest.ts` 11, `runtime/headless.ts` 5, `runtime/source.ts` 3,
  `runtime/index.ts` 2.
- **Painted look and rim (46)**: `look/render.ts` 26 (strips, fog, clock, sun, dusk curves, skirt hook), `look/light.ts`
  12 (the painter rim on every material), `painterLightPatch` 6 (G294), `plugin.ts` 2.
- **Fire plumbing (40)**: `world/fireFx.ts`. It compiles the fire graphs on a shared clock, places the card groups and
  ember fields at anchors and hands out four fire-light slots.
- **Roaming firelight (29)**: `world/build.ts` 17 and `setGroundPools` 12 (G294). One real PointLight follows the
  nearest lit fire, the tower flickers, and the sand gets its fire pools.
- **Places (29)**: `world/places.ts`, each place's recipe with its lights, ember materials, fires, lamps and glow switch.
- **Baked-world loader (28)**: `world/meshes.ts` 14, `world/baked.ts` 10, `plugin.ts` 4 (warm-by-fire, surface inputs).
- **Explorer (24)**: `models/gear.ts` 13, `roster.ts` 11. **Quest-driven dusk (23)**: `plugin.ts` 12 (`duskOf`),
  `look/dusk.ts` 11 (easing at 0.02 per second). **Whip (5)**, **terrain field (2)**, **library types (2, G294)**.

## The platform features zero needs

| | Feature | Users | Effort | h |
|---|---|---|---|---:|
| F1 | **The data client owns every bound section.** `runtime.binds` → `[]`: quests and quest-page interactions (today they reach into runtime objects by name: `world`, `plugin`, `commands`), ledger, state, items (held melee, the AS gust, view rows), spawns (→ `creatures.spawns` + boss rows), modes, props, clientChannels (inputs from state; an observed value can advance a stage) | Sky, Signal; W2 Driftwood needs the same | L | 28 |
| F2 | **Painted look as a shardfile section**: dome graph or strips, haze, fog, sun, clock, LUT, state curves, dressing rows | Sky, Signal | M | 16 |
| F3 | **Effects section and a data-client effect host**: card groups, point fields, actor ribbons, lane telegraphs, anchors, event bursts, light slots | Sky, Signal; W2 plausibly | L | 28 |
| F4 | **Props tiles for textured hero scenes**: graph over the model's own map (`bindMeshMap` exists), channel-driven named nodes, light rows switched by hook scenes | Sky, Signal; W2 Driftwood, W3 Nine | M | 12 |
| F5 | **Graph looks on skinned creatures with hit flash** (engine; queue sp-o146) | Sky; W2 creatures (G419) | M | 10 |
| F6 | **Terrain skirt row** in the data client | Signal; W2 Driftwood (G419) | S–M | 6 |
| F7 | **Graph inputs** for the player mode and a quest-driven eased field | Sky, Signal | S | 4 |
| F8 | **A declaration-only manifest is not custom** (ruler; extends call 36) | every shard | hours | 1 |

Sky and Signal are two shards, so anything both adopt is public under G294. Only F5 and F6 start out single-user, and
both have a likely W2 user (G419).

## Blockers

There is no hard technical blocker. These are the traps:

- **B1. Lockstep: neither runtime can go first.** About 3,100 lines of hybrid-host platform code have exactly two
  shard users, Sky and Signal: the quest page in `game/plugin/ui.ts` 654, `headless.ts` 529, `simulation.ts` 525,
  `paintedLook` 276, `bakedKinds.ts` 230, the held melee 200 + 182, `homeKeeper` 118, `bossRow` 98, the card and effect
  fields 107 and more. I checked this in the scratch export. With Signal's runtime deleted, **Sky jumps 657 → 3,756
  (55.4 %)**. With Sky's deleted first, **Signal jumps 410 → 3,509 (85.1 %)**. Both runtimes have to go in one commit
  set, after F1–F4 are in. This fits the wave rule that a component closes across both shards at once.
- **B2. W2 and W3 inherit about 640 lines when W1 leaves** (same simulation): Pine +439 (→ 89.8 %), Driftwood +162
  (→ 80.7 %), Nine +19, Nalati +18. Doing W1 zero in the middle of W2's 80/20 push moves Pine's target.
- **B3. The ruler counts every executable manifest.** Even the native Template counts 70 lines (its `manifest.ts` 36,
  budgets 19, hooks 11). Each W1 shard keeps a 4-line `defineShard` call. Literal zero needs F8.
- **B4. Meadow and wake have no second user** (queue rows sp-o162/o164 and sp-o148/o152). Moving either into the
  platform still counts against Sky. Only a decision removes them.

## Decisions for Jake (one recommendation each)

1. **D1: What does "zero" mean?** Recommend: **a declaration-only `manifest.ts` is not custom** (extend call 36). The
   same rule frees the Template.
2. **D2: Sky's near meadow (29 lines).** Keep it, swap to the shared camera-ring grass (a look change), or build a
   single-user field family (no gain). Recommend: **keep it as Sky's one custom piece** and revisit at the end of W3.
3. **D3: Sky's ray wakes (30 lines).** Extend the engine `SlashTrail` with a camera-facing timed mode, drop them, or
   keep them. Recommend: **extend SlashTrail** (a shared host, and the look is kept).
4. **D4: Signal's roaming firelight.** Drop the one moving PointLight and let the fire-light pools light the sand and
   plinths, or keep it as a "nearest lit source" light row. Recommend: **drop it, with one before / after board**.
5. **D5: When.** Now, after W2 reaches 80/20, or never (90/10 is the bar). Recommend: **after W2 reaches 80/20, both
   W1 shards in one lockstep commit set**, reusing the F1 / F3 / F4 work W2 needs anyway.

The storm's lightning changing from RNG to a graph timer is not a call: G415 needs similar, not identical.

## Estimate to zero

| | Lane-hours |
|---|---:|
| Shared features F1–F8 | 105 |
| Sky shard work | 100 |
| Signal shard work | 64 |
| Checks (headless proofs, boot smoke, by-eye) | 10 |
| **Total** | **~280 (range 230–300)** |

**Wall-clock with 4 Opus + 5 Codex: 2–3 days nonstop, 4–5 days realistically.** Codex carries about 200 h of it
(F1, F2, F3, F4, F6, F7 and most adoption) and Opus about 55 h (the scene bakes and parity, the storm, F5 and the
by-eye checks). The critical path is F1 (split over three lanes) → quest wiring → one lockstep runtime deletion →
checks, about 32–40 h. Most groups edit the same `runtime/index.ts` and `plugin.ts`, so contention adds the rest.

**Quick wins in about 4 hours, no new feature:** Sky's bake helpers 12, layout maths 23, `quests/flags.ts` 1 and the
updraft 2 bring it to 619 (9.13 %). Signal's dusk as an AS client script 23, library types 2 and terrain field 2
bring it to 383 (9.29 %).

## Is zero the right target?

What matters is that the **trusted runtime is deleted**: `runtime.binds` empty, no `plugin.ts`, `runtime/`, `world/`
or runtime `look/` code. That is what makes these real shardfile shards and closes W1-C9 as written ("at 90/10 the
trusted runtime is deleted", which has not happened yet). With everything native the simulation leaves:

- **Sky: 23 lines (0.34 %)**: manifest 4, Roc GLSL 7 (removed by F5), bake helpers 12 (an hour's work).
- **Signal: 6 lines (0.15 %)**: manifest 4, library types 2.

With D1 both reach 0. **The sensible floor is Sky 0–0.9 %** (0 if the meadow goes, 29 more lines if it stays, 30 more
if the wakes stay custom) **and Signal 0 %**. Chasing the manifest's 4 lines without D1 is not worth it.

## How this was measured

`node scripts/shard-platform.mjs --json` gives per-line component spans (W1-M0) for each shard. A scratch script put
every span into exactly one group by file and line range. It checks that the groups add up to the script's
`customRuntimeLines` (657, 410) and to every component count. Lane-hours and the ways to zero are estimates from
reading the files and `docs/plans/shard-platform/open-x-queue.md`. The lockstep and inheritance numbers come from
deleting each shard's runtime, world and look files in the scratch export only (leaving a 4-line `defineShard`
manifest) and re-running the script. No repository source was changed.
