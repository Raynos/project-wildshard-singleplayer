# Shards — Driftwood Isle, Pine Hollow, Nalati Grasslands (and how to add a fourth)

The demo runs one Wildshard *chunk* (we call an authored chunk a **shard**) at a time. Every shard is a 500 m × 500 m
floating slab with its own biome, built by the same engine from a `ChunkDef` (`src/chunks/ChunkDef.ts`) and listed in
`CHUNKS` (`src/chunks/registry.ts`). Shards are picked on the title deck (or with `?chunk=<slug>`), and the page reloads
to switch — chunks are not adjacent or streamed.

**The deck order is `CHUNKS`' order:** Driftwood Isle first (the default, `DEFAULT_CHUNK`; the user's rule PH-U19), then
Pine Hollow, then Nalati Grasslands. A shard still being built carries a flag the deck shows on its card:
`experimental` (a hazard-taped EXPERIMENTAL band, and "Experimental · rough edges" under ENTER WORLD) or `earlyAccess`
(an EARLY ACCESS tag; playable by everyone). A shard **graduates** by dropping the flag — Pine Hollow did at the end of
its remaster (PINE-HOLLOW-REMASTER PH-S2).

**Each shard keeps its own style** (PH-U1). The shards share the engine and the house *pipelines* (mockup loops, Blender,
image-to-3D, the learned LUT fit, horizon painting, the rig bake), never each other's shading. A fourth shard picks a
look of its own.

## The three shards

| | Driftwood Isle | Pine Hollow | Nalati Grasslands |
|---|---|---|---|
| Def | `src/chunks/driftwood-isle.ts` | `src/chunks/pine-hollow.ts` + `pineHollowLayout.ts` | `src/chunks/nalati-grasslands.ts` + `nalatiLayout.ts` |
| What | A small island in a bright ocean: the pier, a sailboat, the hut, a ring shrine, the wreck in the cove | A boreal pine forest round a sheltered hollow: the ranger's cabin, a still pond under a granite ridge, the old-growth, the mill hamlet | A high Tian Shan steppe: the braided Kunes, the nomad camp, the golden bowl of the Sky Grassland, Snow Lotus Valley in the snow ring |
| Style | **Faceted low-poly toon** (`style: 'lowpoly'`) | **Photoreal PBR** (`style` omitted = `'pbr'`) | **Painterly** (`style: 'painterly'`) |
| Deck | first, the default | second (graduated) | third (EARLY ACCESS) |

### Driftwood Isle — faceted toon

- **Look:** no textures at all — flat-shaded, vertex-coloured facets (`Terrain.ts` by height / slope, `world/lowpolyKit.ts`
  for every model); a two-band toon ramp with coloured shadows and a rim (`world/stylize.ts`); a stylized gradient sky
  with faceted cumulus (`world/StylizedSky.ts`) on a 20 + 4 min day (`world/DayNight.ts`); the learned 33³ LUT
  (`world/lut.ts`, `public/assets/lut/driftwood-isle.bin`); the painted 360° horizon (`world/HorizonMatte.ts`); a faceted
  sea (`world/Ocean.ts`). `?island=blender` swaps the spawn cove for the Blender-baked one (`world/BlenderIsland.ts`).
- **Systems:** the castaway spine (`game/quest/Spine.ts` + `driftwood.ts`: Wendell, the three shards, the altar) ending
  at the Drowned Captain (`game/quest/Finale.ts`); the island's enemies (`entities/Enemies.ts`: reef crabs, coconut
  monkeys, the drowned sailor at night); a sword; swimming and diving; the interactables table
  (`world/interact/driftwood.ts`).
- **Sound:** its themes, the `audio/IslandAmbience.ts` zones, `audio/IslandSfx.ts`.
- **Code:** the low-poly modules in `src/world/` (the table at the end), wired in `main.ts` under `if (chunk.ocean)`; the
  adventure through `ADVENTURES` in `game/quest/Adventure.ts`; `src/dev/driftwood.ts` is the reference wiring.

### Pine Hollow — photoreal PBR

- **Look:** Poly Haven PBR sets on a splat terrain with the boreal ground shader; the Blender-built species set (the hero
  Scots pine, fir, the old-growth giants, birch, snags, saplings — `world/treeSpecies.ts`, `world/treeSet.ts`,
  `scripts/blender/trees/`) baked into the card + impostor LOD; one shared wind (`world/wind.ts`); a full day from seven
  pure-sky keys blended on a dome that re-lights the IBL (`world/PineDayNight.ts`, `pineSkyKeys.ts`); dawn ground fog
  and rain showers (`world/PineWeather.ts`, `PineWeatherFX.ts`); the pond, creek and waterfall on one water program
  (`world/waterSurface.ts`, `PineStreams.ts`); the painted far country at infinity (`world/Horizon.ts`); the Ridge's
  granite skin, its crag kit and the bear cave (`world/PineCrags.ts`, `scripts/blender/crags/`); the learned LUT
  (`public/assets/lut/pine-hollow.bin`).
- **World:** the three cabins (`world/Cabin.ts`); the mill hamlet, the fire lookout + zipline, the footbridge, the
  standing stones, the waystones, the dam and the canoe (`world/PineLandmarks.ts`; the image-to-3D hero props in
  `public/assets/models/pine-hollow-hero/`).
- **Systems:** the ranger's lantern quest *The Warden's Hollow*, the lodge's rotating contracts, the trader and the
  miller, amber resin / carved tokens / secrets, the night thralls (`src/pinehollow/quest/`); the Antler King
  (`pinehollow/antlerKing.ts`, `kingModel.ts`, on the engine's `game/Boss.ts`) and four elites (`pinehollow/elites.ts`,
  `game/Elite.ts`); generated, rig-baked creatures in PBR coats with rarity and legendaries (`entities/pineCreatures.ts`,
  `pineCoats.ts`, `pineCreatureRigs.ts`); the small life — ravens, the owl, a woodpecker, hares (`pinehollow/life/`);
  the crossbow, the lever-action and the Warden's Longbow (`pinehollow/loadout.ts`); the hunter's journal and the trophy
  wall (the engine Compendium: `ui/compendium/` + `shards/pine-hollow.ts`, `world/TrophyWall.ts`); 19 achievements
  (`game/achievements.ts`).
- **Sound:** theme 1 (pine calm / tension) + calm-night, the King's three stems and the dawn sting; zoned beds and
  interior reverb (`audio/ForestAmbience.ts`); the generated one-shot sprite and the NPC barks (`audio/PineHollowSfx.ts`,
  `public/assets/sfx/pine-hollow/`).
- **Code:** `src/chunks/pine-hollow.ts` + `pineHollowLayout.ts` (every site), `src/pinehollow/` (installed from
  `main.ts`), the `Pine*` modules in `src/world/`. Captures: `scripts/pine-hollow-views.mjs` (the 9-angle anchors),
  `scripts/pine-hollow-perf.mjs` (the phone / desktop ruler).

### Nalati Grasslands — painterly

- **Look:** every mesh on the painterly shading (`world/painterly.ts`); a painted panorama sky + a day clock, a cloud sea,
  fog, the grade and the zone tints (`src/nalati/look/`); its own spruce factory (`trees.factory: 'spruce'`); three zones,
  each in its own colour (the green valley, the golden bowl, the snow ring).
- **Systems:** its own kit — bow, sabre, spear (`player/nalatiKit.ts`) — and riding (`nalati/ride.ts`); the quest core
  with three chapters (`game/quest/nalati.ts`, `nalati/adventure.ts`); two bosses, the Golden King in his kurgan
  (`nalati/kurganBoss.ts`) and the Storm Titan (`nalati/stormTitan.ts`); elites, stealth, kokpar, the night riders, the
  storm (`src/nalati/`); generated creature hulls rig-baked to the species' skeletons (`entities/creatureRigBake.ts`,
  `public/assets/nalati/models/`).
- **Sound:** the Kazakh score and Nalati's sound set (`nalati/sound.ts`).
- **Code:** `src/nalati/`, `src/world/nalati/`, `src/ui/NalatiHUD.ts`, `src/dev/nalati-*.ts`. (On main since v0.3.0;
  the Pine Hollow branch picks it up when it merges main in.)

## What the shards share (the engine)

`bootstrap()` and the boot plan (`core/bootstrap.ts`, `boot/`), Rapier physics and the navmesh (`physics/`), the player and
the weapons, `Animal` / `AnimalManager` / the species registry (`entities/species/`), `Elite` / `Boss` and their bars, the
creature rig bake, the interactables kit (`world/interact/`), the quest core (`game/quest/quest.ts`, `QuestUI.ts`), the
Compendium, Progress + achievements, Explore World (`explore/`), the HUD and the title deck (`ui/`), the per-shard LUT.
The pipelines take the shard as an argument: `scripts/blender/run.sh <slug>`, `fit-lut.py --shard`,
`scripts/horizon-matte/`, `scripts/img2mesh/`.

## Adding a fourth shard

1. **Pick its style.** Not one of the three (PH-U1). Run a mockup loop first (`art/<shard>/round-<n>-<label>/`) and let
   the user pick from a board.
2. `cp src/chunks/_template.ts src/chunks/<slug>.ts`, rename the export, fill in every field (the template comments
   explain each one; the table below says what each drives). Keep every coordinate in a `<slug>Layout.ts` beside it.
3. Art for the deck: a 640×360 `src/chunks/thumbs/<slug>.jpg` (no crossbow in frame) + the portrait and landscape hero
   backdrops. Until it is authored it can sit in the deck as a teaser (`src/chunks/placeholders.ts`).
4. Add the export to `CHUNKS` in `src/chunks/registry.ts` — **after** the three (Driftwood stays first) — with
   `experimental: true` or `earlyAccess: true` until it graduates.
5. Bake it: `scripts/bake-chunk.mjs` (the terrain, fingerprinted), `scripts/bake-navmesh.mjs <slug>`, then the byte and
   pack tables (`scripts/bake-packs.mjs`).
6. Its own nouns on the loading screen: a `SHARD_STEPS` entry in `src/boot/steps.ts` (each step names what it really
   builds there; `test/boot-plan.test.ts`).
7. Its game layer: an adventure (`ADVENTURES` in `game/quest/Adventure.ts`, or a `src/<shard>/` installer called from
   `main.ts` as Pine Hollow and Nalati do), an achievements table (`TABLES` in `game/achievements.ts`), a compendium
   (`ui/compendium/shards/<slug>.ts`) if it hunts, and its sound.
8. `npx tsc --noEmit`, `pnpm lint`, `pnpm test` (`test/chunks.test.ts` checks every def), then
   `http://localhost:5173/?chunk=<slug>&nolock=1&skipintro=1`; screenshot it headlessly (`docs/SUBAGENT-BRIEF.md`) on
   the phone and the desktop, and give it rows in `bench.budget.json`.

Nothing outside `src/chunks/` has to change for a shard that reuses the engine's pieces as they are; new trees,
creatures, dressing or a new style are engine work (below).

## What is fixed by the Wildshard fundamentals

These live in `src/core/config.ts` and `src/chunks/terrain.ts` and are **not** per shard:

| Rule | Where it is enforced |
|---|---|
| Chunk is 500 m square, origin at the centre, spans ±250 on X and Z | `CHUNK_SIZE`, `CHUNK_HALF` |
| 100 m of rock under the surface (the floating slab) | `CHUNK_DEPTH`, `Terrain.buildSlab()` |
| A 15 m wide entry road at each of the four edge midpoints | `ROAD_WIDTH`, `entryRoadMask()` in `terrain.ts` |
| Each road reaches ≥ 50 m into the chunk (we use 60) | `ROAD_LENGTH` |
| Roads are level with no-man's-land (y = 0) at the boundary and ramp up inside | `buildTerrain().heightAt` |
| Terrain mesh resolution 256² | `TERRAIN_RES` |
| Boundary wall / no-man's-land warning at the edges | `src/world/Boundary.ts`, HUD |

`buildTerrain()` applies the road levelling on top of *any* landscape you write, so a shard cannot
break the contract by accident — but keep the first segment of the four entry trails exactly as in
the template so the dirt texture and prop placement follow the road.

## What each `ChunkDef` field does

| Field | Drives | Notes |
|---|---|---|
| `id`, `slug`, `displayName`, `gridCoords` | HUD chunk panel, loading screen, title screen, `?chunk=` | `id` is `chunk://local/<slug>` |
| `seed` | every `Rng` / `Noise2D` in the engine (`SEED` in config is a live binding of it) | pick a fresh one per shard |
| `treeCount` | `Forest` places at most this many trees | `TREE_COUNT` live binding |
| `biome`, `blurb`, `thumbnail`, `heroPortrait`, `heroLandscape` | the title deck (the blurb is the card's tooltip: one pitch in the house voice) | |
| `experimental`, `earlyAccess` | the deck's EXPERIMENTAL band / EARLY ACCESS tag | dropped when the shard graduates |
| `terrain` | `heightAt/normalAt/splatAt/trailDistance/cabinMask/pondMask/waterLevel`, `TRAILS`, `CABIN_SITES`, `POND` re-exported by `src/world/Heightfield.ts` | built by `buildTerrain(seed, spec)` |
| `terrain` spec → `landscape(x, z, noise)` | raw height before roads/pads/trails/pond | use the seeded `noise.n` / `noise.n2` |
| `terrain` spec → `trails` | trail beds, dirt splat, prop placement (`Props`), tree exclusion, animal placement | polylines in metres |
| `terrain` spec → `cabinSites` | `Cabins` builds one log cabin per site on a flattened pad | exactly what `Cabin.ts` expects: `{x, z, rot}` |
| `terrain` spec → `pond`, `pondFill` | basin dished into the landscape, `Water` surface, reeds/ferns/mist around it | omit `pond` for a dry shard (Water is skipped) |
| `terrain` spec → `splat(x, z, t, noise)` | four ground-layer weights for the terrain shader | any scale; normalised |
| `assets.groundLayers` | the four PBR sets blended by `splat` (DataArrayTexture) | ids under `public/assets/tex/` |
| `assets.groundTints` | per-layer albedo multiplier in the terrain shader | linear RGB |
| `assets.slabRock` | PBR set for the slab walls | |
| `trees.factory`, `trees.set` | which tree builder `bootstrap()` uses (`TREE_FACTORIES`), and the Blender species set it plants | `'pine'` (Pine Hollow; `set: 'pine-hollow-trees'`), `'spruce'` (Nalati) or `'none'` (no `Forest` trees: Driftwood's palms are their own builder, `src/world/Palms.ts`) |
| `trees.bark`, `trees.twigAtlas` | trunk PBR set, twig atlas folder for the baked branch cards | |
| `trees.noun` | "2,600 pines" on the title screen | |
| `forest.*` | candidate spacing, clearing noise, slope limit, foliage HSL tint, big-variant share | see `Forest.place()` |
| `fauna[]` | `AnimalManager` herd plans: kind, count, optional anchor ring, canopy vs clearing, trail band, `variants` | `kind` is any registered species (`src/entities/species/`: deer, boar, elk, bear, crab, monkey, sailor, captain); `FaunaKind` is `'deer' \| 'boar'` widened to any string, checked against the registry by `test/chunks.test.ts` |
| `sky.hdri` | HDRI for IBL + background; the sun direction is its brightest pixel | stems in `public/assets/hdri/` |
| `sky.sunColor/sunIntensity/envIntensity/bgIntensity` | CSM sun, environment and background strength | `?sunI= ?envI= ?bgI= ?hdri=` still override for tuning |
| `sky.fogSunColor`, `sky.cloudSunColor`, `sky.hemi*` | fog in-scatter tint, cloud layer tint, hemisphere fill | |
| `atmosphere.fog*` | exponential height fog + distance fog (`Atmosphere.ts`, also read by `Volumetrics`, `Water`, `Particles`) | |
| `atmosphere.volumetricSunColor` | god-ray colour | |
| `grade.*` | composer: saturation / brightness / contrast / bloom + `GradeEffect` split-tone | display-space |
| `spawn` | where the player stands on enter and respawn; `?x= ?z= ?yaw=` override | |
| `style` | `'pbr'` (default: textured splat terrain, PBR slab — Pine Hollow), `'lowpoly'` (Driftwood Isle: no textures at all — `Terrain.ts` builds flat-shaded, vertex-coloured facets by height/slope) or `'painterly'` (Nalati) | every lit thing in a lowpoly shard is `MeshStandardMaterial({ flatShading, vertexColors })` on non-indexed geometry |
| `weapon` | `'crossbow'` (default) or `'sword'` — the first-person weapon main.ts hands the player | |
| `ocean` | open water over the whole shard: `level` (sea surface, m), `shallowColor` / `deepColor` (linear RGB albedo — keep them dark, the midday sun + sky here add up to ~3×), `deepDepth` (m below the surface at which the water is fully deep) | `src/world/Ocean.ts` (faceted, animated, depth-coloured, foam band) replaces `Water`; `Boundary` / `Horizon` sit on the surface and draw islets instead of ridges; pass `oceanLevel: ocean.level` to `buildTerrain` so `waterLevel()` agrees |
| `terrain` spec → `oceanLevel` | `waterLevel()` for an open-water shard (no pond dish) | the entry roads are still forced to y = 0, so a level a little above 0 makes them submerged sandbars under the piers |

## Tuning tips

- **Look first at the landscape.** `?chunk=pine-hollow&x=0&z=-235&yaw=3.1416&pitch=0&nolock=1&skipintro=1` is
  the south gate looking in; the pond pose is `?chunk=pine-hollow&x=-56&z=95&yaw=3.1416` (yaw 0 faces −z, away
  from the pond). The 9-angle cameras of five Pine Hollow anchors are in
  `art/pine-hollow/round-0-baseline/cameras.json` (`scripts/pine-hollow-views.mjs`). Take headless screenshots and read them.
- Keep the landscape within about −10..+40 m. Roads are forced to y = 0 at the edges, so a landscape
  that sits at +30 m near an edge gets a steep 60 m ramp.
- Cabin pads flatten a ~20 m radius; put sites on gentle ground, > 40 m apart, off the trails.
- `pondFill` above ~2 m floods the surroundings; the basin is dished ~3 m under the water line.
- `splat` weights are blended with a power curve in the shader; a layer under 0.1 barely shows.
- Sun colour + `fogSunColor` + `volumetricSunColor` + `cloudSunColor` should agree with the HDRI
  (pull them from its sun pixel), or the fog reads as a different time of day than the sky.
- The whole def is deterministic: same seed, same shard, every load.

## What is engine work (not a def field)

- **A new style** — `style` picks the terrain and material path (`'pbr'`, `'lowpoly'`, `'painterly'`); a fourth look is a
  new branch in `Terrain.ts` / `Sky.ts` and its own shading module, the way `stylize.ts` and `painterly.ts` are.
- **New trees** — `trees.factory` picks a builder in `TREE_FACTORIES` (`src/core/bootstrap.ts`): `'pine'` (the baked
  card + impostor LOD; with `trees.set` it plants a Blender species set, `world/treeSet.ts`), `'spruce'` (Nalati) or
  `'none'` (Driftwood's palms are their own builder, `world/Palms.ts`).
- **A new animal** — one file in `src/entities/species/<kind>.ts` ending in `registerSpecies({...})` (the contract is
  `src/entities/species/registry.ts`); a def names it by `kind` in `fauna[]`. Generated hulls go through the rig bake.
- **Grass, undergrowth, props, particles** (`Grass.ts`, `Undergrowth.ts`, `Props.ts`, `Particles.ts`) use the shard's
  seed, terrain and pond, but their *content* is forest dressing; Driftwood and Nalati build their own
  (Nalati: `world/nalati/dressing/`).
- **The cabins** are the same log cabins on every non-ocean PBR shard (a def chooses only where, `cabinSites`); Pine
  Hollow adds the hamlet's buildings on the same kit.
- **The attract-mode camera path** (`src/core/Tour.ts`) follows Pine Hollow's trails.
- **A shard's code as one module** (`ShardModule { build, look, quest, audio, fauna, loadSteps }`, ENGINE-FIT E5) is not
  built yet: each shard still branches in `main.ts` (moved to `docs/plans/PINE-HOLLOW-FOLLOWUPS.md` by PH-U32).

## Driftwood Isle — the low-poly pieces

The second shard (`src/chunks/driftwood-isle.ts`, `style: 'lowpoly'`, `ocean`) is built from
flat-shaded vertex-coloured modules, each one mesh, each exposing `colliders` for
`player.colliders` and (where you can stand on it) `floorHeightAt(x, z)` for `player.platforms`.
`src/dev/driftwood.ts` is the reference wiring; main.ts mirrors it under `if (chunk.ocean)`.

| Module | What | Placement |
|---|---|---|
| `world/Ocean.ts` | faceted sea to the horizon, depth-coloured, foam band, `update(dt)` | `ChunkDef.ocean` |
| `world/Pier.ts` | jetty on rope-wrapped pilings, `bollards`, `posts`, `mooringsFor()` | the south entry road + `JETTIES` (N / W / E) |
| `world/Boat.ts` | moored sailboat, bobs in `update(dt)`, `ropes` mesh to the pier | beside the south pier |
| `world/Boulders.ts` | faceted rocks, `scatterShore(seed)` | the water line |
| `world/Hut.ts` | thatched stilt hut with porch + steps | `HUT` on the `PLATEAU` crag |
| `world/Palms.ts` | coconut palms with a vertex-shader sway, `scatterIsland(seed, n, avoid)`, `update(dt)` | beach top + groves |
| `world/Lookout.ts` | watchtower with stair and banner | `LOOKOUT` on the `HEADLAND` summit |
| `world/Wreck.ts` | beached two-master, cargo and driftwood | `WRECK` in `COVE` (east) |
| `world/Shrine.ts` | ring shrine on a dais with standing stones | `SHRINE` (north-west knoll) |
| `world/Bushes.ts` | shrubs with red hibiscus, `scatterIsland(seed, n, avoid)` | beach top + clumps inland |

The landscape is one function of the constants above (island disc, plateau, headland, cove,
shrine knoll), so moving a POI is a one-line change; the entry roads stay forced to y = 0 and are
the jetties' submerged sandbars. `scripts/bake-chunk.mjs` fingerprints the landscape into the bake
header and `BakedTerrain.ts` refuses a bake that does not match the live def, so a stale
`terrain.bin` (from before a def edit, or a service-worker copy) falls back to the analytic field.
