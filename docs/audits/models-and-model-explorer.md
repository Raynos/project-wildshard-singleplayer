# Models and the Model Explorer: an audit (E306)

2026-09-29. Read-only audit of the live build `412d443-mun9x88v` and `main` at `30252b0a`. Nothing in the game was
changed. The proposal that follows from it is a separate draft plan: [MODEL-ARCHITECTURE](../plans/MODEL-ARCHITECTURE.md).
The picture version is [art/models-audit/round-1-census/models-census-sheet.jpg](../../art/models-audit/round-1-census/models-census-sheet.jpg)
(the four live catalogs, four real models, four "areas on a turntable", all iPhone portrait).

Jake's words (E306): *"I don't understand the Model Explorer. What is the Model Explorer? What is a model? … To me a
model is a reusable unit of code, or a model we generate. Each shard has a different definition of what is significant
enough to add to the Model Explorer; some things are baked into the world. There's nothing obvious or rigorous about
it; every agent decides arbitrarily what gets registered. … Audit it. Maybe it needs re-architecting at the code level:
a directory for models, a directory for world, the world made out of the models."*

**The short answer.** The game has no definition of "model". The Model Explorer shows whatever a shard's code happened
to mark with an optional `model` flag, and the four shards mark very different things: Driftwood marks its buildings,
Nalati marks whole places (a 762 k-triangle kurgan field, a meadow of flowers), Pine Hollow marks 8 hand-picked things
and leaves out its landmarks, Nine Dragon marks only its 4 downloaded-style GLB files and none of its ~60 code-built
pieces. Roughly 300 distinct shapes are drawn across the four shards; 54 cards reach the catalog. Your instinct is
right: a model should be "one reusable thing, built by one builder or one file", and the world should be made of
placements of them.

---

## 1. What the Model Explorer is today

**How you open it.** Title screen → **EXPLORE WORLD** → the hub's three cards: **Model explorer** ("Inspect every model
up close"), **World explorer** (god-mode flight), and the developer-only **Practice arena**. In the World Explorer you
can also tap a thing and press **OPEN IN MODEL EXPLORER**. Tests open it straight with the harness param
`?explore=model`. All four shards have it switched on (`explore: true` in each shard's def).

**What it shows.**
- A **catalog**: a grid of cards with a live-rendered thumbnail, a name and a triangle count (or "built on view"),
  filter chips **All · Buildings · Nature · Creatures · Props**, and **LINEUP** (every creature side by side).
- A **turntable**: one model isolated *inside the live scene* (same renderer, lights, day / night and post), on a glass
  disc. **SOLID · WIREFRAME · FACETS · PAINT · TIERS**, **DAWN · NOON · DUSK · NIGHT**, the source file, triangles,
  draw calls, build time, its share of the phone budget (2 M triangles / 150 draws), ‹ › to step through the catalog,
  and **VIEW IN WORLD**. Creatures add clips (idle, walk, trot, charge, hit, die), variants and a skeleton overlay.

**Where the list comes from.** There is one list: the **world registry** (`src/world/registry.ts`), built for
physics. Every built thing is added once with `registry.add({ id, name, category, file, object, colliders, … })`; the
scene draws it, Rapier collides with it, and **if the piece carries the optional `model` field, the Model Explorer
lists it** (`WorldRegistry.models()`). `src/explore/registry.ts` is a thin view onto that list. `registerModel()` adds a
"model-only" piece for one specimen out of a batch (one palm out of the merged palms), built the first time you look
at it. `registerPick()` adds a tap target on a batch mesh. `src/explore/catalog.ts` then appends one **creature** card
per species that the shard's animal manager has alive *at that moment*.

**Seven ways a card gets in.** Nothing is automatic except creatures, and every shard uses its own path:

| # | Path | Who uses it | What decides |
|---|---|---|---|
| 1 | `addBuilt(…, {})`: a trailing `{}` argument on a helper in `src/main.ts` | Driftwood's hand-built structures | whether the author typed `{}` (the pier, hut, wreck… have it; the shore rocks, palms, trailside, second and third jetties don't) |
| 2 | `registerDriftwoodModels()` in `src/explore/catalog.ts` | Driftwood: palm, boulder, bush specimens + taps | a hand-written function in Explore's own code, picked by `if (isOcean)` in `main.ts` |
| 3 | `registerPineHollowModels()` in the same file | Pine Hollow: 3 cabins, pond, pine, boulder, stump, log | another hand-written function, picked by `chunk.slug === 'pine-hollow'` in `main.ts` |
| 4 | an `ENTRY` table with `model: true` (`src/world/nalati/index.ts`) | Nalati's 12 points of interest | one boolean per whole place |
| 5 | a `models` list returned by the world builder (`src/chunks/nine-dragon-stack/world/build.ts`) | Nine Dragon's 4 GLBs | "is it a loaded GLB file" |
| 6 | a direct `registry.add({ …, model })` | Nalati's camp people | one-off |
| 7 | `registerModel()` in `src/practice/catalog.ts` | the training dummy, on all four shards | shared, with 3 armour variants |
| + | automatic, from the live animal list | creatures, every shard | only species alive *now*: the Drowned Captain, Pine Hollow's Antler King, Nalati's elites appear only while spawned; sheep, marmots and the Storm Titan never |

**What is in it right now** (dumped from the live build, desktop tier; the phone numbers are lower):

| Shard | Cards | What they are |
|---|---|---|
| Driftwood Isle | **19** | 9 structures: Pier (127.5 k tris), Sailboat, Hut, Lookout tower, Shipwreck, Ring shrine, Jetty, Rope bridge, Wreck cove · 3 specimens: Coconut palm, Boulder, Hibiscus bush · Training dummy · 6 creatures: Boar, Bear, Deer, Reef crab, Coconut monkey, Drowned sailor |
| Nalati Grasslands | **17** | 12 whole places: Spring camp (86 k), Kunes bridge, Summer camp, **Kurgan field (762 k)**, Balbals, Eagle Rock, Wind Cairn, **Crag ledges + the leopard cave (134 k)**, Watchtower, **Kokpar field (103 k)**, **Snow lotus (116 k)**, Glacier (144 tris) · Camp people · Training dummy · 3 creatures: Steppe wolf, Wild horse, Sheepdog |
| Pine Hollow | **13** | 3 log cabins (one reads 166.7 k on desktop, 27.9 k on phone) · Still pond · 4 specimens: Scots pine, Mossy boulder, Tree stump, Fallen log · Training dummy · 4 creatures: Deer, Elk, Boar, Bear |
| Nine Dragon Stack | **5** | Umbrella walker, Mahjong sitter (filed as *creatures*), Guardian lion, Fei Zhua dragon hook (filed as *buildings*) · Training dummy |
| **Total** | **54** | |

The "mess and blur" is visible on the phone: Nalati's cards are whole places, so the turntable fits a 300 m field on a
disc and the thing you wanted to see is a speck (Kurgan field, Snow lotus, Kokpar field, Spring camp, Driftwood's Wreck
cove; bottom row of the contact sheet).

---

## 2. How models are made: the pipelines

| Pipeline | What it is | Where it lives | Used on |
|---|---|---|---|
| **Procedural three.js code** | TypeScript that builds the geometry at load: boxes, lathes, tubes, noise-sculpted rocks, merged into one mesh ("kit"). By far the most common | `src/world/*.ts` (shared + Driftwood + Pine Hollow), `src/world/nalati/`, `src/nalati/`, `src/pinehollow/`, `src/chunks/nine-dragon-stack/world/`, `src/entities/species/*.ts`, `src/player/*` (weapons) | all four |
| **Blender** | No `.blend` files at all. Python (`bpy`) scripts run headless (`blender -b -P …`, Blender 5.2), export GLB, then `gltf-transform meshopt`. Blender is also the clean-up step after TRELLIS / Hunyuan (`scripts/img2mesh/driftwood_post.py`) | `scripts/blender/` (island, trees, crags, weapons), `src/dev/nd-lab/grapple/blender/` | Driftwood (the spawn cove), Pine Hollow (trees, crags, cave, lever rifle, knife), Nine Dragon (first-person arms, grapple) |
| **TRELLIS.2 (image → 3D)** | A codex reference image of one object on white → TRELLIS.2 on this Mac → Blender post → meshopt GLB (and `.phone` / `-lod1` copies) | `scripts/img2mesh/` ([README](../../scripts/img2mesh/README.md)); outputs under `public/assets/…` | all four |
| **Hunyuan3D-2 (image → 3D)** | Same flow, the other local generator; equally allowed, pick whichever gives the better model | `scripts/img2mesh/`, rig bakes `scripts/creature-rig-bake.mjs`, `scripts/nalati-rig-bake.mjs` | Driftwood (Drowned Captain), Nalati (horses, boulders, watchtower, kokpar rider, collie, ghost horse, Golden King, the 5 camp people), Pine Hollow (6 creature hulls, Antler King, 3 NPCs, birds) |
| **Downloaded CC0 GLB** | Poly Haven photoscans, Kenney / Quaternius kits | `public/assets/models/…` | Pine Hollow (rocks, stump, trunk, 6 cabin props); Driftwood (4 prototypes inside the Blender cove) |
| **Painted images / baked data** | codex-painted horizon mattes and sky panoramas; baked terrain heightfields, navmeshes, placement logs | `public/assets/horizon/`, `public/assets/baked/<shard>/` | all four |
| **img2threejs skill** | An open-source Claude skill ([hoainho/img2threejs](https://github.com/hoainho/img2threejs), Apache-2.0) that rebuilds an object from one image as *procedural three.js code* in gated passes (blockout → structure → form → material → lighting → optimisation), checked by screenshot against the reference; its companion `img2-character` adds rigging and a 12-check rig gate. Installed on this Mac (`~/.claude/skills/img2threejs`, `img2-character`) | — | **Not used in this repo.** No state folder, no commit. Only two ideas from `img2-character` were borrowed and re-implemented for the training dummy's rig (`scripts/practice/rig_dummy.py` geodesic binding, `scripts/practice/dummy_rig_gate.py`) |

**Files on disk:** 344 GLBs under `public/assets`: 270 sources (59 MB) and 74 KTX2 twins (77 MB) that the phone loads
instead where a twin exists. Almost all are meshopt-compressed; nothing uses Draco.

### Counts per pipeline, per shard

Rows of the census below (a "row" is one kind of thing: a builder, a GLB, a kit family). Approximate where a shard
builds families (Nine Dragon's facade has 32 piece types; Pine Hollow's tree set 14 variants; the Blender cove 72
prototypes).

| Pipeline | Driftwood | Nalati | Pine Hollow | Nine Dragon | Total |
|---|---|---|---|---|---|
| Procedural code | ~32 (+4 weapons) | ~22 (+3 code + GLB mixes) | ~26 | ~22 (≈27 region kits, 32 facade pieces, 10 dressing pieces inside) | **~100** |
| Blender scripts | 1 (the spawn cove: 72 prototypes, 16.7 k placements) | 0 | 5 (trees, crags, cave, rifle, knife) | 1 (+1 lab-only) | **7** |
| TRELLIS.2 GLB | 2 in use (6 prototypes baked into the cove; the dummies) | 6 | 9 | 4 (+1 fallback, 6 shipped but unused) | **~21** |
| Hunyuan3D-2 GLB | 1 | 8 (16 GLBs) | 11 | 0 | **~20** |
| Downloaded CC0 | 1 (via the cove) | 0 | 9 | 0 | **~10** |
| img2threejs | 0 | 0 | 0 | 0 | **0** |
| **Model Explorer cards** | **19** | **17** | **13** | **5** | **54** |

---

## 3. Census per shard

Legend. **Explorer**: *card* (a live piece), *specimen* (one built on first view), *no*. **Collides**: the registry
piece id(s). **Drawn as**: *one mesh*; *merged* (many copies welded into one mesh, one draw); *instanced ×N* (one
geometry, N copies, one draw); *batched* (`BatchedMesh`, several shapes in one draw via WebGL multi-draw); *LOD* (a
simpler copy far away); *skinned* (bones).

### Driftwood Isle (toon, low-poly, vertex-coloured, no textures)

| Thing | Made with | Source | Explorer | Collides | Drawn as |
|---|---|---|---|---|---|
| South pier · 3 jetties | code | `src/world/Pier.ts` | card `pier`; card `jetty` for the first jetty only | `pier`, `jetty-0..2` | one merged mesh each |
| Sailboat | code (LowPolyKit) | `Boat.ts` | card `boat` | `boat` (rides a moving body) | 3 draws; its mooring ropes are outside the object, so the turntable shows it without them |
| Hut · Lookout tower · Ring shrine | code (LowPolyKit) | `Hut.ts`, `Lookout.ts`, `Shrine.ts` | cards | boxes + stair treads | one kit mesh + small extras |
| Shipwreck | code + rock kit | `Wreck.ts` | card `wreck` | boxes, treads, capsule | 3 draws |
| Rope bridge | code | `RopeBridge.ts` | card `bridge` | posts / rails; the deck is a physics rope | merged posts + 2 instanced (planks, ropes) |
| Wreck cove (sea cave, waterfall, pools) | code + rock kit | `Cove.ts` | card `cove` (*nature*) | boxes + treads | 7 draws |
| Zipline · Trailside fences and steps | code | `Zipline.ts`, `Trailside.ts` | **no** | `zipline`, `trailside` | merged |
| Coconut palms (≈204 phone / 255 desktop) | code | `Palms.ts` | specimen `palm` (one palm, lean clamped, matching no real palm) + tap | `palms` (capsule per trunk) | **one merged mesh for all** |
| Shore boulders (110) | code (rock kit) | `Boulders.ts` | specimen `boulder`, not linked to the colliding `rocks` piece | `rocks` (hulls) | one merged mesh |
| Hibiscus bushes (170–260) | code (bush kit) | `Bushes.ts` | specimen `bush` + tap | none (walk-through) | one merged mesh |
| **The spawn cove** (terrain tiles + 72 plant / rock / palm prototypes, 16,675 placements, lightmaps) | **Blender** (with TRELLIS palms and driftwood, Kenney palms) | `scripts/blender/build_island.py` → `public/assets/models/driftwood-blender/`; `src/world/BlenderIsland.ts` | **no**: the most-seen model on the shard has no card and no tap target | 200 boxes through the old `player.colliders` bridge, not the registry | merged tiles with near / far copies swapped at 110 m, culled per tile |
| Ground cover: tuft, fern, hibiscus, daisy, pebble, shells, starfish, bush | code | `GroundCover.ts` | no | none | 26 instanced meshes (near + far tiers) |
| Seabed + fish · Gulls | code | `Seabed.ts`, `Gulls.ts` | no | none | merged + instanced ×28; instanced ×36 |
| Terrain · Ocean · horizon islets · horizon matte · sky | baked data + code; painted image | `Terrain.ts`, `Ocean.ts`, `Horizon.ts`, `HorizonMatte.ts`, `StylizedSky.ts` | no (world) | terrain heightfield | one mesh each |
| Boar ×11, Bear ×2, Deer ×3, Reef crab, Coconut monkey, Drowned sailor | code (`AnimalFactory`, low-poly style) | `src/entities/species/*.ts` | creature cards | hit boxes, not the registry | skinned, one draw each; far herds batched |
| Drowned Captain (boss) | **Hunyuan3D-2** GLB on a code rig | `public/assets/models/driftwood-hero/captain/captain.glb` (12.7 k tris) | only after he spawns | hit boxes | skinned |
| Castaway Wendell (NPC) | code (LowPolyKit) | `src/entities/npc/Castaway.ts` | no | a box in the old bridge | ~6 draws |
| Quest interactables (chests, levers, key, altar, sea glass ×15 …) | code | `src/world/interact/` | no | old-bridge boxes | 2 **batched** meshes |
| Training dummy ×3 variants | TRELLIS + Blender rig (code fallback) | `public/assets/practice/dummies/` | specimen `training-dummy` (all shards) | the arena room only | skinned |
| Swords, AR-15, swimming hands | code | `src/player/` | no (weapons) | — | merged |

### Nalati Grasslands (painterly)

| Thing | Made with | Source | Explorer | Collides | Drawn as |
|---|---|---|---|---|---|
| Spring camp (6 yurts, yard, 9 GLB props) | code + TRELLIS props | `src/world/nalati/NomadCamp.ts`, `Yurt.ts`, `modelProps.ts` | card `nalati-camp`: the **whole camp** | 60 | merged kit + instanced props |
| Summer camp (3 yurts + props) | code + TRELLIS | `SummerCamp.ts` | card: whole camp | 14 | same |
| Kunes bridge | code | `Bridge.ts` | card | 39 + floor | merged kit |
| Road fences + signposts | code | `RoadFurniture.ts` | **no** (`model: false` in the table) | 17 | merged + a lettering atlas |
| Kurgan field (kerbs, portals; the domes are terrain) | code | `KurganField.ts` | card: a **whole field**, 762 k tris desktop / 31.8 k phone | 19 | merged kit |
| Kurgan dungeon (the Golden King's tomb) | code | `KurganDungeon.ts` | **no** | 35 + seal | merged, light baked in |
| Balbal statues ×12 | TRELLIS (code stand-in) | `Balbals.ts`, `balbal.glb` | card `nalati-balbals` (no colliders); per-statue pieces are *props* | 12 boxes | 2 instanced |
| Eagle Rock · Wind Cairn · Crag ledges + leopard cave | code | `EagleRock.ts`, `Cairn.ts`, `Crags.ts` | cards (the cairn is *buildings*) | 59, 5, 11 | merged kits |
| Watchtower | Hunyuan3D-2 + code stair | `Bowl.ts`, `watchtower.glb` | card | 1 box + 54 treads | instanced + kit |
| Kokpar field (posts, goals, 6 horses, 6 riders) | code + Hunyuan3D-2 | `Bowl.ts` | card: a **whole field**, filed *props*, **shown under Buildings** | 2 | kit + instanced, gallop animated in the shader |
| Far herds (~240 horses) | Hunyuan3D-2 far LOD | `Bowl.ts` | no, and not in the registry | none | instanced per herd |
| Snow lotus | TRELLIS | `Bowl.ts`, `snow-lotus.glb` | card: a **whole scatter**, 116 k desktop / 51.6 k phone; no colliders | none | one instanced mesh |
| Glacier snout | code | `Bowl.ts` | card (144 tris) | none | one mesh |
| Granite outcrops · crag rock (fins, towers) · dressing boulders | code, code, Hunyuan3D-2 | `src/nalati/outcrops.ts`, `cragRock.ts`, `src/world/nalati/dressing/` | **no** (four rock systems, none listed) | ~154 + ~470 + ~1,347 hulls | merged, 4 quadrant meshes, instanced + culled per instance |
| Stones, juniper, rose, willow, lupin, daisy, reed · logs, stumps, ovoo cairns, ribbon poles | code | `dressing/models.ts`, `dressing/statics.ts` | no | 68 (props) | 7 instanced · region meshes |
| Spruce forest | code (`Spruce.ts`) | `Forest.ts` | no | `forest` | LOD bands; **batched** when multi-draw exists |
| Grass + flowers · water · cloth · smoke · butterflies · weather | code + a painted card atlas | `src/nalati/look/grass.ts` etc. | no (world / effects) | none | instanced blade rings, shader-animated |
| Terrain · horizon · sky panorama | baked data + painted image | `Terrain.ts`, `look/sky.ts` | no (world) | heightfield | — |
| Horse, wolf, sheepdog; leopard, eagle, kokbori, ghost rider, Golden King (while spawned) | code rigs + TRELLIS / Hunyuan3D-2 hulls, rigs baked offline | `src/entities/species/*`, `glbCreatures.ts` | creature cards, some only while spawned | hit boxes | skinned |
| Sheep flock · marmots · Storm Titan | TRELLIS · code · code | `Flock.ts`, `Marmots.ts`, `stormTitan.ts` | **never** | none | instanced, gait in the shader |
| Camp people ×5 | Hunyuan3D-2 (code fallback) | `src/nalati/campPeople*.ts` | card `nalati-camp-people`: 5 figures on one card | 4 capsules + a moving one | one skinned mesh on a packed atlas (the fallback is one **batched** mesh) |
| Bow, Golden Bow, sabre, spear | code | `src/player/` | no (weapons) | — | — |

### Pine Hollow (photoreal PBR)

| Thing | Made with | Source | Explorer | Collides | Drawn as |
|---|---|---|---|---|---|
| Log cabins ×3 (+ trophy wall, token shelf inside) | code + Poly Haven textures | `src/world/Cabin.ts` | cards `cabin-1..3` | `cabins` + door pieces | cores merged across cabins by material; detail / far LOD |
| Mill hamlet ×5 (lodge, trader, miller, watermill, shed) | code (cabin kit) | `src/world/PineLandmarks.ts` → `Cabin.ts` | **no** (the catalog takes only the first 3 roots) | inside `cabins` | one merged cluster |
| Cabin props (crate, barrel, bucket, hatchet, fire pit, lantern) | Poly Haven GLB | `public/assets/models/…` | no | inside `cabins` | instanced across cabins |
| Fire lookout · zipline landing + cable · creek footbridge | code (cabin kit) | `PineLandmarks.ts` | **no**: one piece `pine-landmarks` named "Fire lookout, zipline, footbridge" | `pine-landmarks` | merged per material, detail / far |
| Standing stones ×7 · waystones ×3 · beaver dam · canoe · contract board · cave arch | **TRELLIS** (LOD0 / phone / LOD1 files each) | `public/assets/models/pine-hollow-hero/`, `pineHero.ts` | **no** (all 8 hero props) | `pine-landmark-props` (hulls; surface defaults to stone even for the wooden ones) | instanced + LOD1 + cull distance |
| Ridge crags (12 modules) · bear cave | **Blender** | `scripts/blender/crags/` → `pine-hollow-crags/`; `PineCrags.ts` | **no** | `pine-crags-0..N` (slices of 90 hulls), `pine-cave` (trimesh) | **one batched mesh** for every module, both LODs and the cave |
| Hollow log | code | `src/pinehollow/quest/hollowLog.ts` | **no** (has object, colliders, floor; no `model`) | `hollow-log` | 4 draws |
| Pond + lily pads · creek, waterfall, spray | code | `Water.ts`, `PineStreams.ts` | card `pond` (surface only) | none | 2 + 2 draws |
| Forest: 14 variants (Scots pine, fir, giant, birch, snag, sapling) | **Blender** tree set | `scripts/blender/trees/` → `pine-hollow-trees/trees.glb`; `TreeFactory.ts`, `Forest.ts` | specimen `pine` only (the tallest Scots pine); a tap on *any* tree opens it | `forest` (capsule per trunk) | LOD bands: near cards + twigs → far cards → 2-quad impostor; **4 batched meshes** (84 instanced without multi-draw) |
| Undergrowth: ferns 6,000, shrubs 3,750, litter 5,000, pebbles 3,000, moss 3,000, reeds 1,500 | code | `Undergrowth.ts` | no | none | 6 instanced, culled per cell |
| Grass + flowers · particles · rain | code | `Grass.ts`, `Particles.ts`, `PineWeatherFX.ts` | no | none | instanced |
| Boulders (6 shapes), stumps, fallen logs | Poly Haven photoscans | `src/world/Props.ts` | specimens `boulder` (1 of 6 shapes), `stump`, `log` | `props`, `props-rocks-2` (both named "Props"), `props-wood` | rocks **batched**, stumps / logs instanced, culled per instance |
| Terrain · horizon · panorama · boundary | baked data + code + painted image | `Terrain.ts`, `Horizon.ts`, `HorizonMatte.ts` | no (world) | heightfield | — |
| Hind (TRELLIS) · stag, boar, elk, black / brown bear (Hunyuan3D-2) | GLB hulls on code rigs | `src/entities/pineCreatures.ts` | creature cards | hit boxes | skinned + fur shells |
| Antler King | Hunyuan3D-2 + code kit | `src/pinehollow/kingModel.ts` | only while spawned (night) | hit boxes | skinned |
| Birds (raven, owl, woodpecker) · hare | Hunyuan3D-2 · code | `src/pinehollow/life/` | no | none | one instanced mesh, posed in the shader |
| NPCs: ranger, trader, miller | Hunyuan3D-2, rigged at load | `src/pinehollow/quest/npcModels.ts` | no | old `player.colliders` bridge | skinned |
| Interactables (resin ×30, tokens ×8, levers, sluice …) | code | `src/pinehollow/quest/table.ts` | no | bridge boxes | 2 batched meshes |
| Lever rifle, skinning knife (Blender) · longbow (code) | Blender · code | `src/player/`, `src/pinehollow/life/skinKnife.ts` | no (weapons) | — | — |

### Nine Dragon Stack (Jiehua neon)

| Thing | Made with | Source | Explorer | Collides | Drawn as |
|---|---|---|---|---|---|
| ~27 region kits (the paifang gate cluster, stair-street foot + terraces, bridges, monorail, decks, crown, shop rows, the Well's rim / galleries / crossings) | code (Kit / KitX) | `src/chunks/nine-dragon-stack/world/*.ts` | **no** | `nds-floors`, `nds-fronts`, `nds-edges`, `nds-props`, `nds-crossings` (boxes from the plan, not the mesh) | one merged mesh each; far ones dropped past 95–110 m |
| Facade grammar: 32 piece types (balcony, cage, AC unit, pipe, laundry, plant, tank, shack, eave, rail, antenna, dish, lantern …), >13,600 copies | code | `world/facade/` | **no** | fronts only | 18 **instanced** meshes (the ban on multi-draw applies here), culled per instance, some with far LODs |
| Facade shell · ~10 k windows | code | `world/facade/batch.ts` | no | — | one merged mesh · one instanced quad set |
| Market sets: booth ×5, parasol ×6, pavilion ×3, balustrade panel | code | `stalls.ts`, `props3d.ts` | no | `nds-props` | instanced each |
| Paper lanterns (~1,100) · neon signs · lightbox signs | code + glyph / sign atlases | `look/lanterns.ts`, `look/neonsigns.ts`, `look/signs.ts` | no | — | instanced near / far / dot · 2 meshes · 1 mesh |
| Train, gondola, 2 drones | code | `towers.ts`, `well-bridges.ts` | no | none | 4 meshes moved every frame |
| Guardian lion (~4 copies) | **TRELLIS** | `lab/organic/lion.glb` (8.0 k tris) | specimen `nds-lion` (*buildings*) | sits on the balustrade | instanced + 2 LOD copies |
| Fei Zhua dragon hook (3 copies) | **TRELLIS** | `lab/grapple/dragon-hook.glb` (18 k tris) | specimen `nds-dragon-hook` (*buildings*) | none (grapple anchor) | instanced + 2 LOD copies |
| Crowd: umbrella walkers + mahjong sitters (~700, 6 colourways) | **TRELLIS** | `lab/walker.glb`, `lab/sitter.glb` | specimens `nds-walker`, `nds-sitter` (*creatures*, though they are static scenery; 1 of 6 colourways shown) | none | 24 instanced meshes (6 variants × 4 LODs) |
| Banyan canopy | code + painted leaf atlas | `canopy.ts` | no | hull in `nds-props` | 3 meshes |
| Sky dome, scroll screen, silk sheets, steam, wet streaks | code + painted scroll | `world/build.ts`, `look/` | no (world / effects) | — | shader-animated |
| First-person arms + jian + Fei Zhua gauntlet | **Blender** + a three.js bake | `viewmodel/fp-rig.glb` (209 k tris, 16 clips) | no (viewmodel) | — | skinned |
| Shipped but never drawn | TRELLIS | `stall`, `mahjong`, `canopy`, `banyan-trunk`, `fei-zhua` (~1.2 MB); `pots`, `lanterns` prefetched although switched off (~274 KB) | — | — | — |

---

## 4. Where each shard draws the line

There is no written rule anywhere. Reading the code, each shard's *actual* rule is:

| Shard | The rule in practice | Consequence |
|---|---|---|
| **Driftwood** | "A structure with a floor that the author thought of as a landmark gets `{}`." Plus a hand-picked specimen for 3 of its batches | The pier and first jetty are in; jetties 2–3, trailside, zipline and the colliding shore rocks are out. The Blender spawn cove (the first thing you see, 72 prototypes) is out entirely. The palm specimen is a procedural palm while the cove you stand in draws Blender / TRELLIS palms |
| **Nalati** | "Every point of interest in the table except the road fences." A point of interest is a *place* | 12 cards are places, not things. The yurt (the one reusable model the camps are made of) and the 9 TRELLIS camp props are never on their own. Four rock systems and every plant are out |
| **Pine Hollow** | "What the E66 function listed on 2026-09-23." Everything built after it (the PH-L landmarks, the 8 TRELLIS hero props, the Blender crags, the hamlet, the hollow log) never got a line | The shard's best models (the TRELLIS props already ship with LOD files) are invisible; one Scots pine stands in for 14 tree variants |
| **Nine Dragon** | "A loaded GLB file is a model; code is not." | 4 cards out of ~60 reusable code-built pieces (32 facade types, market sets, lanterns, movers) |
| **Creatures (all)** | Automatic: one card per species alive right now | Bosses and elites flicker in and out; flocks, marmots and the Storm Titan never appear |

Examples of the inconsistency:

- **The same kind of thing, opposite answers.** Pine Hollow shows *one* tree out of its forest; Nalati shows *a whole
  field* of snow lotus; Nine Dragon shows *none* of its 32 facade pieces; Driftwood shows its palms but not its ground
  cover. Foliage is in, out, one-of, or all-of depending on the shard.
- **The same word, different things.** `boulder` is a rock-kit rock on Driftwood and a photoscan on Pine Hollow. "Jetty"
  is three pieces, one card. Two different Nine Dragon tables are both called `PIECES` and share names (plant, tank,
  cage). Nalati has four separate rock systems, two of them named "Crag…".
- **Collider bags pose as things.** Pine Hollow's `pine-landmarks` is named "Fire lookout, zipline, footbridge" but its
  object also draws the 8 TRELLIS props and all the Blender crags; the crags collide as `pine-crags-0..N`, slices of 90
  hulls. Nine Dragon's "The square's props" is one bag (gate posts, planters, banyan hull, shrine, stalls).
- **Categories are guesses, and one is lost.** The Wind Cairn (a stone heap) and the kurgans (terrain domes) are
  *buildings*; the lion and dragon hook are *buildings*; the static crowd is *creatures*. `WorldRegistry.models()` turns
  every category except nature / creatures into *buildings*, so Nalati's Kokpar field, filed *props*, shows under
  **Buildings** (confirmed in the live catalog). The Props tab holds only the training dummy on every shard.
- **A batch shows as one copy with no count.** The palm card says 407 triangles and 1 draw; in the world it is ~250
  palms merged into one mesh. Nothing tells you "× 250", or that it is merged, or what that costs.
- **VIEW IN WORLD is broken for Nine Dragon's specimens.** They are built at the origin without `worldView: false`, so
  the camera flies ~125 m under Lantern Square.

---

## 5. Glossary: how three.js draws things, and what we use

**Mesh, geometry, material, draw call.** A *geometry* is the shape: a list of points and the triangles between them.
A *material* is how it's painted (colour, texture, shader). A *mesh* is one geometry + one material placed in the world.
Every visible mesh costs the GPU a **draw call**: a command from the CPU saying "draw this now". Draw calls, not
triangles, are usually what limits a phone: the budget is ~150 per frame (Nine Dragon: 180), against ~2 M triangles.
Every technique below exists to draw more things with fewer draw calls, fewer triangles, or less memory. *Used
everywhere.*

**Instancing (`InstancedMesh`).** One geometry, drawn N times in **one draw call**, each copy with its own position,
turn, scale and optionally colour. *Saves:* N−1 draw calls and N−1 copies of the geometry in memory. *Costs:* every copy
is the same shape; three.js decides "visible or not" for the whole set at once, so a set spread across the map is
always "visible" unless we cull it per copy ourselves. *Where:* Pine Hollow's undergrowth, props, TRELLIS hero props and
trees (fallback); Nalati's dressing, snow lotus, herds, balbals; Nine Dragon's facade pieces (18 sets, >13,600 copies),
lanterns, crowd, lion; Driftwood's ground cover, gulls, rope-bridge planks. ~50 sites in 35 files. This is the
technique the facade rule tells us to use.

**Merged geometry ("kits").** Many parts, or many copies, welded into **one geometry** once, at load
(`mergeGeometries`). *Saves:* draw calls, like instancing, and each copy can be a different shape (every Driftwood palm
has its own height and lean). *Costs:* memory grows with every copy (250 palms = 250 palms' worth of vertices); you
can't hide, move or cull one copy; the whole mesh is drawn if any of it is on screen. *Where:* Driftwood merges almost
everything (palms, boulders, bushes, pier, every LowPolyKit building); Nalati's POIs are one merged mesh each on one
painterly material; Nine Dragon's ~27 region kits; Pine Hollow's cabin cores (merged across the three cabins by
material). 79 call sites in 42 files.

**LOD (level of detail).** A simpler copy of a model for when it is far away: fewer triangles where nobody can see
them. The simplest far copy is an **impostor**: a flat card with a picture of the model. *Saves:* triangles (and
shading work) at distance. *Costs:* memory for each level, and a visible "pop" at the switch unless it's faded
(Pine Hollow dithers). three.js has a built-in `THREE.LOD`; **we use it nowhere** and instead have at least six
hand-rolled schemes: Pine Hollow's forest bands (near cards + twigs → far cards → 2-quad impostor), the TRELLIS props'
`-lod1` files, the crags' geometry-id swap, Driftwood's Blender tiles (near / far at 110 m), Nalati's `.far.glb` files,
Nine Dragon's meshopt-simplified copies (`sculptLods`, crowd at 12 / 22 / 35 m), and the animals' far-herd batch.

**Culling.** Not drawing what can't be seen. *Frustum culling*: three.js skips a mesh whose bounding sphere is outside
the camera's view; free, automatic, but all-or-nothing per mesh. *Per-instance culling*: for an instanced set that
spans the map, our own code rewrites the list of copies to draw each time the view changes (`src/world/Culling.ts`
`CulledInstances` / `CulledBatch` / `CelledInstances`; Nine Dragon's `InstanceCuller`; Nalati's 24 m dressing cells).
*Distance culling*: dropping things past a range (Nine Dragon's facade clutter past 85 m). *Saves:* GPU work for
off-screen copies. *Costs:* CPU time per view change and re-uploading the list: Nine Dragon found drawing all ~10 k
window quads cheaper on the phone than re-culling them. `frustumCulled = false` (never cull) appears 149 times, mostly on
sky, water and self-culling sets.

**Texture atlases.** Many small pictures packed into one big texture, so many parts share one material and can be
merged or instanced together. *Saves:* draw calls and material switches. *Costs:* a large texture in memory; mip
bleeding at the seams. *Where:* Pine Hollow's tree cards and impostors, the birds, one atlas per TRELLIS prop; Nalati's
five camp people packed into one at load; Nine Dragon's sign and glyph atlases and its paint array. Driftwood uses
none (vertex colours only).

**Compression: KTX2 and meshopt.** Two different things. **KTX2** (Basis) textures stay compressed *on the GPU*: a
2048² texture takes ~4–8× less video memory than the same PNG / WebP, which decompresses to raw pixels. The build makes
KTX2 twins (`scripts/bake-ktx2.mjs`, 74 of them); `src/core/ktx2.ts` swaps them in. Some rigged creatures and the camp
people have no twin yet. **meshopt** compresses the *geometry* inside a GLB so it downloads smaller (and quantises it to
16-bit numbers); it decompresses on load, so it saves download size, not GPU memory. Almost every GLB here uses it;
Draco (the other geometry compressor) is used nowhere.

**BatchedMesh (WebGL multi-draw).** Several *different* shapes that share one material, drawn in one draw call, each
with its own placement and its own on / off switch; it can also swap a copy's LOD by switching its shape. It sits
between instancing (one shape) and merging (no per-copy control). It relies on the `WEBGL_multi_draw` extension.
**Facade multi-draw is banned** on every shard, tier and platform (E271 / E272,
[the incident](nine-dragon-mobile-multidraw.md)): switching Nine Dragon's facade from instancing to a BatchedMesh cut
draw calls but made a real iPhone kill the page after multi-GB memory spikes that the Simulator and desktop never
showed. The ban names the facade path; BatchedMesh itself is still used in six other places: Pine Hollow's forest (4
batches) and its crags, Pine Hollow's props rocks (`CulledBatch`), the quest interactables (Driftwood, Pine Hollow),
and the fallback figures of Nalati's camp people. They are not covered by the ban, and Pine Hollow has physical-iPhone
memory readings (the 2026-09-28 baseline); the incident's lesson (desktop numbers prove nothing, only a physical-iPhone
memory reading does) applies to any new use.

**Skinned meshes.** A mesh bent by an invisible skeleton of bones, so it can walk, breathe and die. Every creature and
character is one: `AnimalFactory` builds a code rig per species, and a TRELLIS / Hunyuan3D hull, when one exists, is
bound to that rig offline (`*.rigged.glb`). *Costs:* the bones are updated every frame on the CPU and the vertices bent
on the GPU; hard to instance, so far-away herds are drawn by a separate batched skinned mesh (`farHerd.ts`), and flocks
(sheep, birds) are posed in the vertex shader instead of with bones. *Where:* 48 sites in 17 files; the first-person
arms (`fp-rig.glb`, 16 clips).

**Shader animation** (one more, because it's everywhere). Wind in trees, grass and fronds, the kokpar gallop, sheep and
birds walking, water: the vertex shader moves the points, so thousands of copies animate at no CPU cost.

---

## 6. Findings

### The top five

1. **There is no definition of "model", so seven code paths and four shards each invent one.** The only switch is an
   optional `model` field on a physics registry piece (on Driftwood, literally whether a trailing `{}` was typed). Two of
   the paths are shard-specific functions living inside Explore's own code (`registerDriftwoodModels`,
   `registerPineHollowModels`), chosen by `if (isOcean) … else if (chunk.slug === 'pine-hollow')` in `main.ts`: a shard
   branch in core, which the shard-module rule forbids. Result: 54 cards meaning four different things.
2. **Places are listed as models, and that is the blur.** 12 of Nalati's 13 static cards are whole places: a camp, a
   762 k-triangle kurgan field, a meadow of snow lotus, the kokpar field. On the turntable a 300 m place shrinks to specks
   on a disc. Driftwood's Wreck cove does the same. A place belongs to the World Explorer; its *parts* (a yurt, a kurgan
   kerb, a balbal, a snow lotus) are the models.
3. **Most reusable things never reach the catalog, and batches hide their count.** Roughly 300 distinct shapes are
   drawn; 54 cards exist. Missing: Pine Hollow's 8 TRELLIS hero props, 13 of 14 tree variants, its fire lookout and
   hamlet; Nine Dragon's ~60 code-built pieces; Driftwood's Blender spawn cove; Nalati's yurt, camp props and all its
   rocks and plants. What is there shows one copy (the palm: 407 tris, 1 draw) with no "× 250, merged into one mesh".
4. **The same kind of thing is made and drawn a different way every time, because nothing is shared at the "place N
   copies of a model" level.** Bushes come from four pipelines on Driftwood alone; Nalati has four rock systems; there
   are six hand-rolled LOD schemes and three per-instance cullers; Driftwood merges, Pine Hollow batches, Nine Dragon
   instances. Different looks per shard are intended (toon / painterly / PBR / Jiehua); different *plumbing* for "draw
   these 500 rocks" is not.
5. **The physics registry is the right spine, but one `Piece` mixes three jobs.** A piece is at once *the drawn
   object*, *a bag of colliders*, and *a catalog entry*, in world space. So the unit of the catalog is whatever the
   collider code grouped: slices of 90 crag hulls, "The square's props", "Fire lookout, zipline, footbridge". Colliders
   can't belong to a model (in its own space) and be reused by every copy; `props` silently becomes `buildings`; tap
   targets on batches are hand-written box functions per shard.

### What the physics registry already gives us (keep all of it)

- **One `add` per built thing** feeds the scene, Rapier, the floors used for placement and footsteps, the ocean's foam
  rings and Explore (ENGINE-FIT E1, PHYSICS P2b). No second list.
- **Engine-neutral colliders** (`ColliderDesc`: box, capsule, ball, hull, trimesh, treads): builders never import
  Rapier. They are already data, so they can be written in a model's own space and transformed per placement.
- **`follows`** puts a moving model (the boat, a door) on a kinematic body; **`floor` / `solidFloor`** give walkable
  surfaces; **`picks`** give tap targets on batch meshes; **`live: false` + `buildAt(tier)`** give lazy specimens and the
  phone / desktop comparison.
- A per-shard registry slot (E155), so shard switches don't leak pieces.

### Other findings

- **Weight shipped but never drawn:** Nine Dragon ~1.2 MB of GLBs never loaded + ~274 KB prefetched while switched off;
  Driftwood's `driftwood-hero` and `driftwood-cc0` (~3.6 MB, only Blender inputs); Nalati's `sourced/` (~8.4 MB) and an
  unused `spruce.glb`; Pine Hollow's baked `card-*` (~3.2 MB, fallback only). Candidates for `.vercelignore` or deletion,
  each with its owner's OK.
- **The triangle count on a card is "whatever hangs under the object at this tier"**: the ridge cabin reads 166.7 k on
  desktop and 27.9 k on phone; the pier 127.5 k. It is not "the cost of this model", and there is no per-copy vs total
  split.
- **The old `player.colliders` bridge** (meant only for moving boxes) still carries the Blender cove's 200 static boxes,
  Pine Hollow's NPCs and the Castaway.
- **Nine Dragon's specimens are not linked to their placements:** `object()` returns a shared mesh at the origin (VIEW
  IN WORLD goes 125 m under the square), and the crowd's 6 colourways aren't offered as variants.
- **Stale comments:** `src/boot/precompile.ts:53` still describes a Nine Dragon facade BatchedMesh; Nine Dragon's
  `def.ts` says "no model catalog is registered"; `BlenderIsland.ts:3` says the cove replaces the shore boulders.
- **Tests don't pin any of it.** `test/registry-models.test.ts` checks the mechanism (a flagged piece is listed, an id
  can be replaced); `test/explore.test.ts` checks URLs and map pins. Nothing checks what each shard lists or that a
  GLB-backed card loads.

## Sources

Four read-only census passes (one per shard, one on the pipelines) on `main` at `30252b0a`; the live catalog dumped from
`https://wildshard-singleplayer.vercel.app` build `412d443-mun9x88v` on each shard (desktop tier) and captured on the
phone tier at 390 × 844 @3×. Key files: `src/world/registry.ts`, `src/explore/{registry,catalog,ModelExplorer,Explore}.ts`,
`src/main.ts:264-371, 477-479`, `src/world/nalati/index.ts`, `src/chunks/nine-dragon-stack/{index.ts,world/build.ts}`,
`src/practice/catalog.ts`, `scripts/img2mesh/README.md`, `scripts/blender/`, `docs/audits/nine-dragon-mobile-multidraw.md`.
