# Signal Dunes: why it is still 45 % custom, and the way to 10 %

Measured 2026-10-13 at `94810465f` with `scripts/shard-platform.mjs`, on a clean export of that commit (the shared
working tree held other lanes' uncommitted edits; see "The number"). Nothing under `src/shards/sunscar-dunes/`,
`src/engine/`, `src/game/` or `src/sdk/` that Signal reaches changed between that commit and `c5e234a82`. Every number
below adds up to the script's own total. Machine-readable copy: [data.json](data.json). The per-file checklist sp-x6
generated (`../sunscar-dunes-custom-2026-10-13/`, `aa0007f30`) reaches the same 1,860 lines.

## The number

| | Lines |
|---|---:|
| Shard TS outside `generators/` and `data/` | 1,741 |
| Raw GLSL in `data/` (G306, added on top) | 6 |
| Game / engine / SDK code only Signal uses (G294) | 113 |
| **Custom total** | **1,860** |
| Frozen legacy (`sunscar-dunes-legacy/`, same unit) | 4,122 |
| **Custom ÷ legacy** | **45.1 %** |
| The 20 % bar | 824 |
| The 10 % bar | 412 |
| Still to remove for 10 % | 1,448 |

The brief and STATE.md say 43.9 % (1,808 lines). That reading was taken on the shared working tree, which held
Driftwood's uncommitted edits: its `manifest.ts` and Wendell's NPC call `createBakedTerrainField` and `installPivotNpc`
too, which makes 56 of Signal's G294 lines shared. Driftwood is paused for Sprint 2, so those edits are not in `main`,
and the committed number is 45.1 %. If they land, Signal drops to 1,804 (43.8 %) without touching Signal.
`shard.config.ts` is declarations only, so it is not counted (call 36). Raw GLSL is 177 lines in all: 6 in `data/` and
171 inside runtime TS files, which are already in the 1,741. AssemblyScript: 67 lines (its own column, not custom).

## Words used on this page

- **Row**: a piece of plain data (numbers, names, colours) that a shared system reads. Rows are not custom.
- **Generator**: a script in `generators/` that builds a model or place at build time. **Bake**: running it, so the game
  ships its finished shape (a GLB or a tile) and no code has to rebuild it on the phone. Generators are not custom.
- **Tiles / the data client**: the baked world ships cut into tiles, and the game's generic client draws them. A shard
  whose world is all tiles needs no drawing code of its own.
- **Graph (SF59)**: a shader written as data (nodes such as `noise`, `mix`, `time`) instead of GLSL text. Graphs are
  rows. Hand-written GLSL counts as custom wherever it sits (G306).
- **Mover**: something that moves along a fixed track when a trigger fires (a lift, a bridge, a bucket winding up).
  The platform runs movers from rows (`src/format/movers.ts`, `moverMotion.ts`).
- **G294**: code in engine, game or SDK that only one shard uses counts against that shard. Moving code out of the
  shard's folder only helps once a second shard uses it.
- **AS hook**: a small AssemblyScript module the platform runs at a fixed point (a weapon's hit, say). AS has its own
  column and is not custom.
- **Trusted runtime**: Signal's own TypeScript plugin, which still builds and wires much of the level by hand. At 10 %
  it is gone, and Signal runs on the data client like the Template does.

## Why 45 % and not 10 %

1. **The whip is a whole weapon written in Signal's folder.** Its numbers are rows (the `lash` profile in
   `format/weaponProfiles.ts`), but the code that turns them into hits, the headless copy for replays and the cord that
   unrolls on screen are Signal TypeScript: 434 lines, almost a quarter of the total.
2. **The fire is seven hand-written shaders.** Waymarks, the signal fire, the cookfire and two lamps all come from one
   effect, `runtime/looks/fireFx.ts`: 262 lines, 137 of them GLSL.
3. **The world's shapes are baked, but placing and wiring them is not.** All 8 World entries are ported generators, but
   the client still loads each piece, adds the generated models, the lamps, the well's bucket and the oil, and wires
   every interaction by hand (292 lines). The content gate reports its 64 L0 tiles as ground only, with
   `structuralWorld: false` and "trusted runtime owns simulation".
4. **The look is a program, not rows.** The painted dusk sky, the fog, the key light that sinks as the quest goes on, the
   rim light on every prop and the dune skirt are run by code each frame (243 lines). The sand's own curves are already
   rows bound to `shared.dusk`.
5. **The rest is glue.** Quest, creatures, the Matriarch's storm, the Model Explorer builders, the manifest and the two
   installers (browser and headless) together come to 597 lines. Most of what they connect is already rows.

## The nine parts

| # | Part | Lines | What it is |
|---|---|---:|---|
| 1 | Shard glue | 99 | manifest, boot list, cards, ground field |
| 2 | The bullwhip | 434 | lash hits, headless copy, cord, glove |
| 3 | Fire, embers, smoke | 294 | 7 GLSL programs and their host |
| 4 | Dusk sky, sand, light | 243 | painted dome, key curve, rim, skirt |
| 5 | World places | 292 | client half of the baked world |
| 6 | Model Explorer entries | 54 | 10 legacy builders |
| 7 | Creatures + Matriarch | 151 | looks, held ray, sand storm |
| 8 | Quest wiring | 83 | markers, Sefa, old save |
| 9 | Installers | 210 | `plugin.ts`, `signalPlan.ts` |
| | **Total** | **1,860** | |

## The way out of each part

Sizes: S is up to ½ day, M up to 2 days, L up to 5. "Removed" is my estimate of the lines that leave the custom count.

| # | Way out | Removed | Size | Lane |
|---|---|---:|---|---|
| 1 | `shard.config.ts` declarations + rows | 85 | S | x6 |
| 2 | melee row + AS hook + view row | 360 | L | x1 |
| 3 | SF59 graphs + fires baked as props | 264 | L | o121, o123 |
| 4 | look rows, one painted look with Sky | 203 | M | o121 |
| 5 | bake(scene) to tiles, movers, panels | 242 | L | o123, x1 |
| 6 | Explorer reads the generators | 54 | S | o123 |
| 7 | brain / boss rows, storm row + graph | 116 | M | x6, o121 |
| 8 | NPC and marker rows | 68 | S | x6 |
| 9 | shrinks as 1–8 land; trusted runtime deleted | 170 | M | x6, x1 |

**1. Shard glue (99 → 14).** *What it does:* the shard's ID card: name, cards, spawn, bounds, minimap, the list of
files to download at boot, the Explore pictures, the debug camera poses and where the ground comes from. *Why it
counts:* most fields are already rows (`data/manifestRows.ts`, `data/manifestLook.ts`), but `manifest.ts` is the legacy
form, outside `data/`, with small functions in it (the ground colour, the poses, the boot list). It also builds the
ground field itself with `createBakedTerrainField`, engine code only Signal calls (22 lines, G294). *How it leaves:*
the fields move into `shard.config.ts` as pure declarations, which call 36 rules not custom. The boot list comes from
the product, which already lists every file. The pictures become asset rows, and the poses become numbers (their
heights are already baked into `data/manifestGround.generated.json`). `look/sandEntry.ts` (8) only builds the sand's
row, so it moves to `generators/`. The ground is read from the shardfile's own terrain collider, the way the headless
host already does, or the ground field becomes shared when Driftwood's pending manifest lands. *Blockers:* as for Sky,
`defineShard` has no boot, tier or pose fields, and a data module may not export functions.

**2. The bullwhip (434 → 74).** *What it does:* everything the whip does. A light crack lands one 7 m narrow lash
0.12 s after the press. The heavy double crack's first lash yanks a creature of 40 hp or less to your feet, and its
second staggers a bigger one. A lash that hits no creature cracks the well's crank or lights an oiled brazier. On
touch, a still hold fills the charge ring. The same rules run again without a renderer for replays (`lashHost.ts`,
`lashInput.ts`). And there is the drawing: the glove, the coil and the braided cord that unrolls to the crosshair
(`lashHold.ts`, `lashView.ts`, `lashWeapon.ts`). *Why it counts:* the lash is a "native family": rows give it its
numbers, but its code lives in Signal's folder. Moving it into game alone changes nothing, because Signal would be its
only user (G294). *How it leaves* (x1, the same route G394 chose for Sky's fan): the light crack and the heavy become
moves on the shared melee row (7 m reach, one narrow sweep ray, a 0.12 s windup; the heavy keeps its stagger). What
melee can't do, the yank, the second lash and the world cracks, becomes an AssemblyScript hook on the melee host's
secondary actions, which G394 builds for Sky's GUST. Signal is that seam's second user, so it counts as public. The
world cracks need no new code: the quest's interaction rows already say which spot takes a light or a heavy crack
(`data/signalInteractions.ts`), and the headless quest graph already reads them. The glove and coil become a view row
on the baked glove, the cues SF29 audio rows, and `bindRuntimeItemContexts` (8, G294) goes with the hand-written item
binding. *Left:* the unrolling cord (about 74 lines) until a held item's view can play a baked clip or bind a graph
value to the swing. *Blockers:* the melee host has no AS secondary actions yet (G394), and hits may differ slightly
(melee sweeps rays, the lash tests a chest-height lane), so the combat replays are re-recorded with a clip check, as
G393 did for the Roc. **The trap:** today Sky's fan and Signal's lash are the only users of the engine's contact
family. I measured what happens if Sky's fan moves to melee first: 225 lines (`ContactFamily` 92, `ContactWeaponHost`
32, `HeldContactWeapon` 36, `weaponContactDistance` 14, `HeldWeaponClock` 10 and others) become Signal-only, and Signal
goes up to 2,085 (50.6 %). The lash has to leave the contact family in the same landing as the fan, or before it.

**3. Fire, embers and smoke (294 → 30).** *What it does:* five fires (three waymarks, the signal fire, the cookfire) and
two lamp halos. Each fire is a few camera-facing cards playing a flipbook of a real fire, a glow, rising embers, a
smoke column (or a thin wisp for the cookfire) and a warm disc on the sand (`world/drapeGround.ts` lays the disc on the
dunes). It also keeps a list of up to four burning fires that the sand and the camp's materials read to warm up near
them. *Why it counts:* seven hand-written shader programs (137 lines of GLSL), the host that builds the cards, and
`registerMaterialPreparation` (8), engine code only Signal calls. *How it leaves:* first, under G382 / G397, each
program becomes an SF59 graph with the look kept. The graph format already has everything a fire needs: camera-facing
billboards (`viewBillboard`), point size and `pointCoord` for the embers, additive and premultiplied blending, `time`, a
per-vertex `attribute` for each ember's seed and `texture` for the flipbook. Each switch goes to Jake as a before /
after board (G387). Since `b8d7d8f0e`, meshes a runtime builds itself can wear its look graphs, so this can start before
the world bake. Second, with the world bake (part 5), the generator puts each fire's cards, embers and disc into the
scene. The disc is draped at bake time, so `drapeGround` goes. The fires ship as prop tiles, "lit" becomes a panel shown
when a flag matches (`format/targets.ts`, `visibleWhenMatched`), and the firelight positions become graph values bound
to the lit flags. *In flight:* sp-o122 (G395) is moving the cards onto the SDK card field. It is uncommitted, and for
now it adds about 9 lines to Signal while making Sky's card field public. *Left:* about 30 lines of firelight feed.
*Blockers:* points with a graph material inside a prop tile, and state-bound panels in a hybrid shard, both need
checking on the data client. Boards for Jake.

**4. Dusk sky, sand and light (243 → 40).** *What it does:* the "Last Light" look. A painted sky dome blends two painted
dusk strips. Each frame it sets the fog colour and distance, and the low warm key light that dims and turns redder as
the quest goes on, plus the sky fill, the far haze and the aerial fog, each on a curve. `look/dusk.ts` holds the
quest's dusk value: each quest step sets a darker target, and the light eases there over about 50 seconds. On top come
the orange rim and cool shade floor patched into every prop's shader (`look/light.ts` plus 6 lines of GLSL), the dune
skirt past the playable edge, binding the ground collider (`runtime/looks/bakedGround.ts`), and the fires' light pools
on the sand (`setGroundPools`, 12, G294). *Why it counts:* the look is a runtime "strategy", code that builds the dome
and moves the lights. The rows it moves are already data: the sand, the sky's family entry and the curves. *How it
leaves:* into the shardfile's `look` section. The painted sky is the emissive family's sky entry (already a row in
`runtime/looks/duskFamilies.ts`). The key, fill, fog and haze become look keys on curves bound to `shared.dusk` (the
sand's curves already bind to it, `generators/product.ts`). The rim becomes a graph lighting stage, the skirt a ring
of terrain tiles, and the ground binding moves to the platform (the data client already reads the terrain collider).
**Pair it with Sky:** Sky's `paintedLook` (148 lines of `engine/render/dataLook.ts`, charged to Sky) does the same job:
a painted sky, fog, a key light and haze. One shared painted look that both shards use is public for both, which
takes about 148 lines off Sky and about 150 off Signal. *Left:* about 40 lines of dusk easing until a state row can
ease toward a target. *Blockers:* the look format needs a two-stage painted sky blended by state, look keys on state
curves (today only material curves bind to state) and an eased state field. It's a look change, so it needs a board
and Opus.

**5. World places, client half (292 → 50).** *What it does:* the generators already build and bake the tower frame, the
rocks, the dressing, the caravan camp, the well's stones and the brazier footings. This client half loads those baked
pieces and the generated models (wagon, crates, sacks, horse, braziers, the well) and sets them on their baked anchors.
Then it adds the live bits: the lantern glass and the keeper's lamp; the well's bucket, rope, crank and oil jar, which
wind up when you crack the crank; the oil in each brazier; the tower's point light; and the one light that hops to
whichever lit waymark is nearest you. Last, it wires the interactions (read the logbook, take the oil, pour, light),
each with its toast and its changing prompt, and lists the crack targets. *Why it counts:* every piece is still placed
and wired by Signal code at runtime, and the generic client draws none of it. *How it leaves* (sp-o123, G311 / SF80):
every static piece and model goes into the generator's three.js scene, and `bake(scene)` ships it as L0 prop and
collider tiles the generic client draws, as Sky's islands do (`fd1b0a9a4`). The bucket, rope and crank are one mover:
a track that winds up when the `raised` flag is set (x1's mover work). The oil, the jar and each lit fire are panels
shown when a flag matches. The tower light becomes a light row (`format/lights.ts`). The interactions are already rows
(`data/signalInteractions.ts`), and the headless proof already runs them through the platform's quest graph with
baked spots and prompt registrations (`runtime/signalPlan.ts` → `installQuestGraph`). The browser takes the same rows,
and `world/build.ts` goes. The well model's trim (`facetMaterial`, `withoutTriangles`, 15, G294) moves to bake time.
*Left:* about 50 lines for the hopping waymark light and the flicker. Three fixed light rows would replace them, but
that changes the shaders' light count, so it is a look and phone-cost call for Jake. *Blockers:* SF80's bake for these
pieces, the data client showing panels and movers in a hybrid shard, and Opus parity captures.

**6. Model Explorer entries (54 → 0).** *What it does:* the ten Model Explorer entries (bullwhip, ray, skitterer,
strider, Matriarch, Sefa, tower, caravan, well, brazier). Each is a small builder that puts the model together from
runtime parts. *Why it counts:* G391 says every Explorer entry is a generator's output. These ten are the "10 left" in
`generator-inventory.md` (Signal 8 ported / 10 left, all in `models/gear.ts`). *How it leaves:* once part 5 bakes the
places (the creature bodies are already baked by `generators/species.ts` and `hulls.ts`), the Explorer lists the
baked kinds, as it already does for the World entries. `models/gear.ts` and `roster.ts` go.

**7. Creatures and the Matriarch (151 → 35).** *What it does:* puts each species' look row on its baked body (one call
each); keeps the homes (one ray, three skitterer packs, two striders), which are already rows the platform keeps; tells
the ray to circle without striking until you've met Sefa; and runs the Matriarch boss (already the platform's
`RowBossView` from rows). It also carries her old save over once, and draws her phase-two sand storm: the fog closes to
8–62 m and two shells of blown sand race round you (`stormShell.ts`, 34 lines GLSL; `weatherFog`, 14, G294). *Why it
counts:* the looks are function calls, the shell is raw GLSL, and `weatherFog`, `shardSave` and `SpeciesBrain` are
platform code only Signal uses. *How it leaves* (x6, BR rows): the platform reads the look rows straight from the
species section. The ray's hold is already a row in the headless owners (`data/headlessOwners.ts` `holds`), and the
browser uses the same row. The storm becomes a weather row on the boss presentation (`presentation.storm` is already a
row) drawn by the platform's boss view, with the shell as a graph (o121). *Left:* about 35 lines: the old-save
carry-over (C26), which goes with SF73 as Sky's does, and the weather code, until a second boss uses it (G294).

**8. Quest wiring (83 → 15).** *What it does:* "The signal" is already rows: the quest graph, the director stage that
summons the Matriarch, the interaction rules. What's left places each quest marker on its built piece, checks Sefa's
ground height, stands Sefa up as a turning NPC (`installPivotNpc`, 24 game lines only Signal uses at HEAD), carries
the old reward save over and projects the ledger. *How it leaves* (x6): the generator writes the markers' positions
into the quest rows, and Sefa's row (`SCOUT_ROW`, already a row) is drawn by the platform. `installPivotNpc` becomes
shared when Driftwood's pending Wendell change lands. *Left:* about 15 lines of old-save carry-over (SF73).

**9. Installers (210 → 40).** *What it does:* `plugin.ts` (110) starts the browser level: it loads the models and the
bake, builds the world, lends the sand to the skirt, gives captures their `stage()` hook and installs the quest, the
Matriarch, the director, the creatures and the dusk. `runtime/signalPlan.ts` (83) does the same for the headless
proof. *Why it counts:* it connects parts 1–8, and while those are code, so is this. *How it leaves:* it shrinks as
each part lands. Section 5.2 of the design deletes the trusted runtime in the commit that makes the shard pass, and
Signal then runs on the data client like the Template. `signalPlan.ts` is generic composition (species homes, the
boss row, the quest graph, the director), the same job Sky's `runtime/headless.ts` does, so one declared headless
composer used by both is public for both. The capture hooks move to a generic capture API, as for Sky. *Left:* about 40
lines until the capture API exists.

## The path to 10 %

| Step | Part | Lane | Custom after | % |
|---|---|---|---:|---:|
| now | — | — | 1,860 | 45.1 |
| 1 | Shard glue | x6 | 1,775 | 43.1 |
| 2 | Quest wiring | x6 | 1,707 | 41.4 |
| 3 | Creatures + Matriarch | x6 | 1,591 | 38.6 |
| 4 | Bullwhip → melee + AS hook | x1 | 1,231 | 29.9 |
| 5 | World → tiles | o123, x1 | 989 | 24.0 |
| 6 | Model Explorer | o123 | 935 | 22.7 |
| **7** | **Fire → graphs + props** | **o121, o123** | **671** | **16.3** |
| 8 | Dusk look → rows | o121 | 468 | 11.4 |
| **9** | **Installers** | **x6, x1** | **298** | **7.2** |

**Signal passes 20 % at step 7** (671 ≤ 824) **and 10 % at step 9** (298 ≤ 412). Steps 1–3 are small and safe, with
no look change, and x6 can land them today. Step 4 is the biggest single cut and is not graphical, but it must land with
Sky's fan move (the trap above). Steps 5–8 are the Opus track, done piece by piece: bake a piece to tiles, and its look
becomes a graph at the same time. Without step 9 Signal stops at 11.4 %, so 10 % means deleting the trusted runtime.

**What legitimately stays at the end (298 lines):** the unrolling cord 74, the waymark light 50, dusk easing 40,
capture hooks 40, the storm and boss save carry-over 35, firelight feed 30, quest save carry-over 15 and glue 14. The
two save carry-overs (about 50) go with SF73. The cord, the waymark light and dusk easing go once the platform has a
clip-playing item view, state-bound lights and an eased state row.

## What is already in flight (Sprint 2, G400, from 12:55Z)

| Lane | Its Signal job (STATE.md) | Steps | Landed so far |
|---|---|---|---|
| sp-x6 | inventory G396, glue, quest, creatures | 1, 2, 3, 9 | `6d346ac03`: the per-file checklist (same 1,860); no lines cut yet |
| sp-x1 | lash → melee, movers | 4, the well's mover in 5 | nothing yet |
| sp-o121 | graphs | GLSL in 3, 4, 7 | `b8d7d8f0e` (a runtime's own meshes can wear look graphs) unblocks it |
| sp-o123 | world → tiles | 5, 6, the fires' bake in 3 | nothing yet (the brief says o119; STATE.md says o123) |
| sp-o122 (Sky) | G395 effects pairing | Signal's fire cards on the SDK card field | uncommitted in the working tree (+9 lines to Signal for now) |

`git log --since='6 hours ago' -- src/shards/sunscar-dunes` shows the whole-product work (`a2924feaf` … `b7a7ec703`,
02:06–07:36 local: sand, world and rigs baked from authoring only, product registered, producers kept out of the
runtime). That work made Signal's product Linux-exact but cut no custom lines. Sprint 2 had landed nothing that
shrinks the count at `c5e234a82`.

## What is missing in the platform

- **Melee AS secondary actions** (G394): needed for the yank, the second lash and the world cracks (step 4).
- **A held-item view that plays a baked clip, or binds a graph value to the swing**: needed before the cord leaves (part 2's
  74 left).
- **Look rows for a painted two-stage sky, look keys on state curves, and an eased state field**: step 8.
- **`defineShard` boot, tier and pose fields**: step 1 (Sky has the same blocker).
- **A data client in a hybrid shard that draws prop panels by flag and runs movers**: steps 5 and 7.
- **SF73** (legacy save keys): the last ~50 lines of save carry-over.

## Per file

Paths are relative to `src/shards/sunscar-dunes/` unless they start with `src/`. "(G294)" means platform code that only
Signal uses. "(glsl n)" gives the raw shader lines inside the count.

**1. Shard glue (99)**: `manifest.ts` 48, `boot/files.ts` 9, `look/sandEntry.ts` 8, `explore/art.ts` 5,
`thumbs/card.ts` 4, `runtime/source.ts` 3, `src/engine/world/bakedTerrainField.ts` 22 (G294: createBakedTerrainField 21,
BakedTerrainMetadata 1).

**2. The bullwhip (434)**: `runtime/items/lashWeapon.ts` 86, `runtime/items/lashHost.ts` 79, `runtime/items/lash.ts` 74,
`runtime/items/lashHold.ts` 41, `runtime/items/lashView.ts` 37, `runtime/lashInput.ts` 31, `runtime/items.ts` 20,
`runtime/audio/cues.ts` 19, `weapons/Bullwhip.ts` 15, `weapons/whipModel.ts` 13, `weapons/rows.ts` 11,
`src/game/plugin/headless.ts` 8 (G294: bindRuntimeItemContexts).

**3. Fire, embers and smoke (294)**: `runtime/looks/fireFx.ts` 262 (glsl 137), `world/drapeGround.ts` 17,
`world/fireFx.ts` 7, `src/engine/render/materialPreparation.ts` 8 (G294: registerMaterialPreparation).

**4. Dusk sky, sand and light (243)**: `runtime/looks/duskLook.ts` 78, `runtime/looks/bakedGround.ts` 73,
`runtime/looks/duskFamilies.ts` 21, `look/light.ts` 16, `look/render.ts` 16, `look/dusk.ts` 11,
`runtime/looks/paintedStrips.ts` 10, `data/lightLook.ts` 6 (all raw GLSL), `src/engine/render/families/ground.ts` 12
(G294: setGroundPools 11, GroundPool 1).

**5. World places (292)**: `world/build.ts` 112, `world/places.ts` 78, `world/baked.ts` 29, `world/meshes.ts` 24,
`world/tower.ts` 24, `world/resources.ts` 10, `src/game/plugin/geometry.ts` 10 (G294: withoutTriangles 9, facetMaterial 1),
`src/sdk/looks/modelLibrary.ts` 5 (G294: HdLookRow, ModelLibraryRows, undrawnRig, facetMaterial, withoutTriangles, 1 each).

**6. Model Explorer entries (54)**: `models/gear.ts` 46, `roster.ts` 8.

**7. Creatures and the Matriarch (151)**: `runtime/shardfile/markedBoss.ts` 43, `runtime/looks/stormShell.ts` 40
(glsl 34), `combat/matriarch.ts` 20, `combat/creatures.ts` 11, `species/matriarch.ts` 8, `species/duneRay.ts` 3,
`species/skitterer.ts` 3, `species/strider.ts` 3, `runtime/species/skitterer.ts` 2, `src/engine/world/Atmosphere.ts` 14
(G294: weatherFog 8, WeatherFogSpec 5, WeatherFog 1), `src/game/saves.ts` 3 (G294: shardSave),
`src/sdk/speciesBrains.ts` 1 (G294: SpeciesBrain).

**8. Quest wiring (83)**: `quest/install.ts` 48, `runtime/persistence.ts` 7, `quests/scout.ts` 4,
`src/game/plugin/geometry.ts` 24 (G294: PivotNpcPorts 9, installPivotNpc 8, PivotNpcLevel 6, NpcSurface 1).

**9. Installers (210)**: `plugin.ts` 110, `runtime/signalPlan.ts` 83, `runtime/headless.ts` 5, `runtime/standalone.ts` 4,
`runtime/index.ts` 2, `src/game/plugin/simulation.ts` 6 (G294: admittedTerrain).

## How this was measured

The table comes from a scratch copy of `shardLines()` in `scripts/shard-platform.mjs`, changed only to print one row
per file, run on a `git archive` export of `94810465f` with `node_modules` linked by `scripts/link-node-modules.mjs`. Per
file, the custom count is: TS lines if the file is outside `generators/` and `data/`, isn't a test and isn't a
declarations-only `shard.config.ts`, plus the raw GLSL lines of `.glsl` files and of `data/` or `generators/` TS files.
On top of that come the G294 sole exports the script lists under `gameSystemAttribution`. These add up to 1,860, the
same as the script's `customRuntimeLines` and sp-x6's checklist. The contact-family trap was measured the same way,
with Sky's `coneStrikes.ts` and `coneFan.ts` taken out of the export. The "removed" figures are estimates from reading
the files, not measurements.
