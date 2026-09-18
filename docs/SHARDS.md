# Shards — adding a second (and third) chunk

The demo runs one Wildshard *chunk* (we call an authored chunk a **shard**) at a time. Every
shard is a 500 m × 500 m floating slab with its own biome, built by the same engine from a
`ChunkDef` (`src/chunks/ChunkDef.ts`). Pine Hollow is the first (`src/chunks/pine-hollow.ts`).
Shards are picked on the title screen (or with `?chunk=<slug>`), and the page reloads to switch —
chunks are not adjacent or streamed.

## Add a shard in five steps

1. `cp src/chunks/_template.ts src/chunks/<slug>.ts`, rename the export, fill in every field
   (the template comments explain each one).
2. Drop a 640×360 jpg in `src/chunks/thumbs/<slug>.jpg` (crop a headless screenshot, no crossbow).
3. Add the export to `CHUNKS` in `src/chunks/registry.ts`.
4. `npx tsc --noEmit`, then open `http://localhost:5173/?chunk=<slug>&nolock=1&skipintro=1`.
5. Screenshot it headlessly (see `docs/SUBAGENT-BRIEF.md`) and iterate on the def until it looks AAA.

Nothing outside `src/chunks/` needs to change for a new shard *unless* it needs a new tree
species, texture set or animal — see "What is engine work" below.

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
| `biome`, `blurb`, `thumbnail` | title-screen shard picker | |
| `terrain` | `heightAt/normalAt/splatAt/trailDistance/cabinMask/pondMask/waterLevel`, `TRAILS`, `CABIN_SITES`, `POND` re-exported by `src/world/Heightfield.ts` | built by `buildTerrain(seed, spec)` |
| `terrain` spec → `landscape(x, z, noise)` | raw height before roads/pads/trails/pond | use the seeded `noise.n` / `noise.n2` |
| `terrain` spec → `trails` | trail beds, dirt splat, prop placement (`Props`), tree exclusion, animal placement | polylines in metres |
| `terrain` spec → `cabinSites` | `Cabins` builds one log cabin per site on a flattened pad | exactly what `Cabin.ts` expects: `{x, z, rot}` |
| `terrain` spec → `pond`, `pondFill` | basin dished into the landscape, `Water` surface, reeds/ferns/mist around it | omit `pond` for a dry shard (Water is skipped) |
| `terrain` spec → `splat(x, z, t, noise)` | four ground-layer weights for the terrain shader | any scale; normalised |
| `assets.groundLayers` | the four PBR sets blended by `splat` (DataArrayTexture) | ids under `public/assets/tex/` |
| `assets.groundTints` | per-layer albedo multiplier in the terrain shader | linear RGB |
| `assets.slabRock` | PBR set for the slab walls | |
| `trees.factory` | which tree builder `bootstrap()` uses (`TREE_FACTORIES`) | only `'pine'` today |
| `trees.bark`, `trees.twigAtlas` | trunk PBR set, twig atlas folder for the baked branch cards | |
| `trees.noun` | "2,600 pines" on the title screen | |
| `forest.*` | candidate spacing, clearing noise, slope limit, foliage HSL tint, big-variant share | see `Forest.place()` |
| `fauna[]` | `AnimalManager` herd plans: kind, count, optional anchor ring, canopy vs clearing, trail band | `kind` is `'deer' \| 'boar'` |
| `sky.hdri` | HDRI for IBL + background; the sun direction is its brightest pixel | stems in `public/assets/hdri/` |
| `sky.sunColor/sunIntensity/envIntensity/bgIntensity` | CSM sun, environment and background strength | `?sunI= ?envI= ?bgI= ?hdri=` still override for tuning |
| `sky.fogSunColor`, `sky.cloudSunColor`, `sky.hemi*` | fog in-scatter tint, cloud layer tint, hemisphere fill | |
| `atmosphere.fog*` | exponential height fog + distance fog (`Atmosphere.ts`, also read by `Volumetrics`, `Water`, `Particles`) | |
| `atmosphere.volumetricSunColor` | god-ray colour | |
| `grade.*` | composer: saturation / brightness / contrast / bloom + `GradeEffect` split-tone | display-space |
| `spawn` | where the player stands on enter and respawn; `?x= ?z= ?yaw=` override | |
| `style` | `'pbr'` (default: textured splat terrain, PBR slab) or `'lowpoly'` (Driftwood Isle: no textures at all — `Terrain.ts` builds flat-shaded, vertex-coloured facets by height/slope) | every lit thing in a lowpoly shard is `MeshStandardMaterial({ flatShading, vertexColors })` on non-indexed geometry |
| `weapon` | `'crossbow'` (default) or `'sword'` — the first-person weapon main.ts hands the player | |
| `ocean` | open water over the whole shard: `level` (sea surface, m), `shallowColor` / `deepColor` (linear RGB albedo — keep them dark, the midday sun + sky here add up to ~3×), `deepDepth` (m below the surface at which the water is fully deep) | `src/world/Ocean.ts` (faceted, animated, depth-coloured, foam band) replaces `Water`; `Boundary` / `Horizon` sit on the surface and draw islets instead of ridges; pass `oceanLevel: ocean.level` to `buildTerrain` so `waterLevel()` agrees |
| `terrain` spec → `oceanLevel` | `waterLevel()` for an open-water shard (no pond dish) | the entry roads are still forced to y = 0, so a level a little above 0 makes them submerged sandbars under the piers |

## Tuning tips

- **Look first at the landscape.** `?x=0&z=-235&yaw=3.1416&pitch=0&nolock=1&skipintro=1` is the
  south gate looking in; the pond pose is `?x=-56&z=95&yaw=0`. Take headless screenshots and read them.
- Keep the landscape within about −10..+40 m. Roads are forced to y = 0 at the edges, so a landscape
  that sits at +30 m near an edge gets a steep 60 m ramp.
- Cabin pads flatten a ~20 m radius; put sites on gentle ground, > 40 m apart, off the trails.
- `pondFill` above ~2 m floods the surroundings; the basin is dished ~3 m under the water line.
- `splat` weights are blended with a power curve in the shader; a layer under 0.1 barely shows.
- Sun colour + `fogSunColor` + `volumetricSunColor` + `cloudSunColor` should agree with the HDRI
  (pull them from its sun pixel), or the fog reads as a different time of day than the sky.
- The whole def is deterministic: same seed, same shard, every load.

## What is engine work (not a def field)

Some things are still Pine-Hollow-specific in the engine and need code, not data, to change:

- **A new tree species** — `TreeFactory` bakes *pine* branch cards from a twig atlas and shades the
  trunk as Scots-pine bark. A birch or palm needs a new factory registered in `TREE_FACTORIES`
  (`src/core/bootstrap.ts`) and a new `trees.factory` id in `ChunkTrees`.
- **A new animal** — `AnimalFactory` models deer and boar; `FaunaKind` grows with it.
- **Grass, undergrowth, props, particles** (`Grass.ts`, `Undergrowth.ts`, `Props.ts`, `Particles.ts`)
  use the shard's seed, terrain and pond but their *content* (ferns, reeds, mushrooms, mossy rocks,
  needle fall, pond mist) is hard-coded forest dressing. A desert shard would want a
  `dressing` field and per-biome placers; add it when the second biome is chosen.
- **The cabins** are the same three log cabins on every shard (a def chooses only where).
- **The attract-mode camera path** (`src/core/Tour.ts`) follows Pine Hollow's trails.
