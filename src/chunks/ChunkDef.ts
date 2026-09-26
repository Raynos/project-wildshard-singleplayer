/**
 * ChunkDef — everything that makes one Wildshard shard different from another.
 *
 * A shard is one 500 m × 500 m chunk with its own biome. The engine (renderer, sky rig,
 * terrain mesh, forest/grass/prop placers, fauna AI, HUD) is shared; a ChunkDef is the
 * *data* that drives it: the terrain field, which textures and tree species to use, where
 * the animals live, what the sky and fog look like, and how the shard appears on the title
 * screen. Defs are plain data + pure functions — no three.js objects, no DOM, no side effects —
 * so they can be evaluated at module init and swapped by `src/chunks/registry.ts`.
 *
 * Fixed by the Wildshard fundamentals (NOT per chunk, see `src/core/config.ts`): chunk size
 * (500 m), slab depth, the four 15 m entry roads at the edge midpoints reaching ≥ 50 m in and
 * level with no-man's-land (y = 0) at the boundary, and the terrain mesh resolution.
 *
 * To add a shard: copy `src/chunks/_template.ts`, fill it in, register it in
 * `src/chunks/registry.ts`. See `docs/SHARDS.md`.
 */
import type { Noise2D } from '../core/noise';
import type { HuntTuning } from '../entities/AnimalManager';
import type { SpeciesWeights } from '../world/treeSpecies';

/** [x, z] metres, origin at the chunk centre, chunk spans ±250 on both axes */
export type Vec2 = [number, number];
/** linear-space RGB triple, 0..1 (values above 1 are allowed for HDR sun colours) */
export type RGB = [number, number, number];

export interface CabinSite { x: number; z: number; rot: number }
export interface PondDef { x: number; z: number; r: number }

/** The two seeded noise fields every terrain gets: `n` = Noise2D(seed), `n2` = Noise2D(seed + 7). */
export interface TerrainNoise { n: Noise2D; n2: Noise2D }

/**
 * The compiled terrain: pure functions over (x, z). Built once per def by `buildTerrain()` in
 * `src/chunks/terrain.ts`; `src/world/Heightfield.ts` re-exports the active one so the many
 * consumers (Terrain, Forest, Grass, Props, Cabin, Water, Player, animals…) call these directly.
 */
export interface ChunkTerrain {
  /** surface height in metres (after trails, cabin pads, pond basin and entry-road levelling) */
  heightAt: (x: number, z: number) => number;
  /** unit surface normal by central differences */
  normalAt: (x: number, z: number, eps?: number) => [number, number, number];
  /** blend weights for the four ground layers in `ChunkAssets.groundLayers`, summing to 1 */
  splatAt: (x: number, z: number) => [number, number, number, number];
  /** metres to the nearest trail centreline */
  trailDistance: (x: number, z: number) => number;
  /** 0 off the cabin pads → 1 on them */
  cabinMask: (x: number, z: number) => number;
  /** 0 outside the pond basin → 1 at its centre (always 0 when the chunk has no pond) */
  pondMask: (x: number, z: number) => number;
  /** still-water surface height (far below the terrain when the chunk has no pond) */
  waterLevel: () => number;
  /** running water (a creek): its surface at (x, z), or null off it — wading, the dry-ground test, the boundary line */
  streamAt?: (x: number, z: number) => number | null;
  trails: Vec2[][];
  cabinSites: CabinSite[];
  pond: PondDef | null;
}

/** What a def supplies to `buildTerrain()`; the shared parts (roads, pads, trail beds, pond dish) are added for you. */
export interface TerrainSpec {
  /**
   * Raw landscape height (metres) before any of the shared shaping. Use the seeded `noise`
   * fields, never Math.random. Keep it within roughly −10..+40 m; the entry roads are forced
   * to y = 0 at the boundary regardless.
   */
  landscape: (x: number, z: number, noise: TerrainNoise) => number;
  /**
   * Dirt-trail polylines. By convention the first four start at the edge midpoints
   * `[0, ∓250]` / `[∓250, 0]` and run straight for ROAD_LENGTH before bending — that is the
   * mandated entry road. Any number of extra spurs may follow.
   */
  trails: Vec2[][];
  /** Flattened pads where the log cabins stand (`src/world/Cabin.ts` builds one per site). */
  cabinSites: CabinSite[];
  /** Optional still pond; the basin is dished into the landscape below its water line. */
  pond?: PondDef;
  /** metres the pond surface sits above the raw landscape height at its centre (default 1.0) */
  pondFill?: number;
  /** open-water shard: `waterLevel()` returns this (pass `ChunkDef.ocean.level`) and the landscape below it is sea floor */
  oceanLevel?: number;
  /**
   * Paths graded to a walkable profile (PHYSICS.md: the player climbs ≤ 40°): along each polyline the ground is cut
   * and filled so the centreline never climbs steeper than `maxGrade` (rise / run), blended out over a few metres
   * each side. Where the ground is already that gentle it is left exactly as it is — unless `bench`: then the whole
   * path is a shelf levelled across (a footpath traversing a slope steeper than the motor climbs, whose own grade is
   * gentle, still needs a flat tread to walk on).
   */
  graded?: { paths: Vec2[][]; maxGrade: number; bench?: boolean };
  /**
   * A last touch on the finished height, after the graded paths, the pond dish, the trail beds and the cabin pads but
   * before the entry roads are levelled (so the fundamentals still hold): for what the shared shaping would flatten —
   * an islet standing out of the pond's dish (Pine Hollow). Omitted = nothing.
   */
  finish?: (x: number, z: number, h: number) => number;
  /** running water beyond the pond (Pine Hollow's creek): its surface at (x, z), or null off it. Omitted = none. */
  streamAt?: (x: number, z: number) => number | null;
  /**
   * Ground-layer blend for `ChunkAssets.groundLayers` — [layer0, layer1, layer2, layer3], any
   * scale (normalised for you). `t` is the finished terrain so you can query slope, height,
   * trail distance and the masks.
   */
  splat: (x: number, z: number, t: ChunkTerrain, noise: TerrainNoise) => [number, number, number, number];
}

/** Texture / model ids under `public/assets/` (see `scripts/fetch-assets.mjs`). */
export interface ChunkAssets {
  /** four PBR ground sets blended by `splatAt`, in weight order */
  groundLayers: [string, string, string, string];
  /** per-layer albedo multipliers (linear RGB) applied in the terrain shader */
  groundTints: [RGB, RGB, RGB, RGB];
  /** PBR set for the rock walls of the floating slab */
  slabRock: string;
  /**
   * The boreal ground (PINE-HOLLOW PH-L8): the terrain shader's canopy-driven needle litter, moss patches and tiling
   * breakup, with per-layer normal strengths (src/world/lookFlags.ts). Absent: the plain splat shader.
   */
  /** `trailDust`: the trail layer pulled toward its own luminance × this tint by `amount` ([r, g, b, amount]) — dry, dusty
   *  compacted soil instead of the set's grey-violet pebbles (PH-L1 round 3); `grassTint` × the grass tufts' colour (the dry
   *  golden-olive boreal grass, not a lime lawn) */
  boreal?: { normalK: [number, number, number, number]; trailDust: [number, number, number, number]; grassTint: RGB };
}

/** Which tree builder to use and what it should be textured with. */
export interface ChunkTrees {
  /**
   * `'pine'` → `src/world/TreeFactory.ts` (baked branch cards). New species = new factory id. `'none'`: the
   * shard has no forest trees — no tree textures, geometry or branch-card bake at launch, an empty Forest
   * (collision / culling hooks still work). `'spruce'` → `src/world/Spruce.ts` (painterly Tian Shan spruce, no textures).
   */
  factory: 'pine' | 'spruce' | 'none';
  /** PBR set for the trunks */
  bark: string;
  /** folder under `public/assets/tex/` holding `twig_rgba.png`, `twig_nor_gl.jpg`, `twig_arm.jpg` */
  twigAtlas: string;
  /** what the HUD calls them, plural ("pines", "birches") */
  noun: string;
  /**
   * A Blender-built species set (PH-B4): the folder under `public/assets/models/` with its trees.glb + card / impostor
   * atlases (scripts/blender/trees/run.sh). Its variants are `TREE_SPECS_V2` (src/world/placement.ts), planted by
   * `ChunkForest.species`. Omitted (or a build without its files): the runtime pines.
   */
  set?: string;
}

/** Forest placement tuning (`src/world/Forest.ts`). The total is `ChunkDef.treeCount`. */
export interface ChunkForest {
  /** metres between placement candidates on the jittered grid */
  spacing: number;
  /** frequency of the clearing / grove density noise (1/m) */
  densityFreq: number;
  /** density noise range mapped 0→1 keep probability: [sparse, dense] */
  clearings: [number, number];
  /** minimum surface normal y (1 = flat); steeper ground gets no trees */
  maxSlope: number;
  /** foliage tint HSL: base hue, hue jitter [lo, hi], saturation [lo, hi], lightness [lo, hi] */
  tintHue: number;
  tintHueJitter: [number, number];
  tintSat: [number, number];
  tintLight: [number, number];
  /** chance a tree uses the large variant (index 3) instead of variants 0–2 */
  largeVariantChance: number;
  /**
   * Per-place keep multiplier on the density noise (src/world/placement.ts): > 1 thickens a grove (Pine Hollow's
   * old-growth), < 1 thins it, 0 keeps the ground bare — no tree and no undergrowth (building pads, a boss arena).
   * Omitted = 1 everywhere.
   */
  density?: (x: number, z: number) => number;
  /** per-place multiplier on a tree's size (the old-growth's giants); omitted = 1. With a species set: pines and firs only */
  scale?: (x: number, z: number) => number;
  /** with a species set (`ChunkTrees.set`): the species mix at (x, z), relative weights (src/world/placement.ts) */
  species?: (x: number, z: number) => SpeciesWeights;
  /**
   * The understory (src/world/placement.ts placeUndergrowth; PINE-HOLLOW PH-L8): × the fern and shrub caps (and their
   * candidate counts); `fernCanopy` lets ferns fill the dense shade outside the fern-cluster noise (≥ 5 trunks in 12 m).
   * Omitted = the engine's counts.
   */
  understory?: { ferns: number; shrubs: number; fernCanopy: boolean };
  /**
   * A denser stand than `spacing` allows: a second candidate grid, half a cell off the first, inside the circle (x, z, r),
   * tested after the chunk's own candidates by the same rules (density, trails, pads, slope). Omitted = none.
   */
  infill?: { x: number; z: number; r: number };
  /** optional keep probability 0..1 at (x, z), applied after the clearing noise (Nalati: spruce only in the gullies, `src/world/spruceMask.ts`); omitted = everywhere */
  mask?: (x: number, z: number) => number;
}

/** a registered species kind (`src/entities/species/<kind>.ts`): 'deer' | 'boar' built in; bear / elk… as they register */
export type FaunaKind = 'deer' | 'boar' | (string & Record<never, never>);

/** One herd / sounder. `src/entities/AnimalManager.ts` finds a clearing that satisfies it. */
export interface HerdPlan {
  kind: FaunaKind;
  count: number;
  /** restrict the herd to these variant ids of the species (e.g. ['black', 'scarback']); omit for the full weighted table */
  variants?: string[] | undefined;
  /** ring around a point to search for the herd centre; omit for anywhere in the chunk */
  anchor?: { x: number; z: number; rMin: number; rMax: number };
  /** true = under the canopy (boars), false = in a clearing (deer) */
  canopy: boolean;
  /** metres off the nearest trail centreline: [min, max] */
  trailBand: [number, number];
}

/** Lighting rig (`src/world/Sky.ts`). */
export interface ChunkSky {
  /** file stem under `public/assets/hdri/` (without `_2k.hdr`); the sun is found from its brightest pixel */
  hdri: string;
  sunColor: RGB;
  sunIntensity: number;
  envIntensity: number;
  bgIntensity: number;
  /** tint the fog takes when looking toward the sun */
  fogSunColor: RGB;
  /** tint of the procedural cloud layer toward the sun */
  cloudSunColor: RGB;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /**
   * The ringed gas giant (`Sky.buildGasGiant`): a banded cream / tan / rust planet with a thin bright
   * ring, lit from the sun's side. Omitted = the default grey planet low over the west (Pine Hollow).
   * Degrees: `azimuth` compass (0 = north = +Z, 90 = east = −X), `elevation` above the horizon,
   * `size` = the body's apparent diameter, `tilt` = ring opening (0 edge-on … 90 face-on), `roll` = the
   * ring's lean on the sky (optional, default 20).
   */
  planet?: { azimuth: number; elevation: number; size: number; tilt: number; roll?: number };
  /**
   * Put the sun here instead of at the HDRI's brightest pixel (degrees: compass azimuth as `planet`, elevation above
   * the horizon). Nalati: a late-afternoon sun from the WSW.
   */
  sun?: { azimuth: number; elevation: number };
  /**
   * A painted sky instead of the HDRI (`style: 'painterly'`): `Sky.ts` paints a small equirectangular gradient —
   * `zenith` overhead → `horizon` at the skyline → `ground` below it, a warm `glow` around the sun — and uses it as
   * the background and the environment. Nothing is downloaded for the sky (`hdri` is then unused).
   */
  painted?: { zenith: RGB; horizon: RGB; ground: RGB; glow: RGB };
}

/** Height + distance fog (`src/world/Atmosphere.ts`) and the volumetric sun shafts. */
export interface ChunkAtmosphere {
  /** metres; fog is densest below this */
  fogHeight: number;
  fogHeightFalloff: number;
  fogHeightDensity: number;
  fogDistDensity: number;
  /** colour of the god-ray / volumetric light */
  volumetricSunColor: RGB;
  /** the volumetric light's medium (`src/core/Volumetrics.ts`); omitted = the forest haze (height −8, falloff 0.12, density 0.0045, strength 0.55) */
  volumetric?: { height: number; falloff: number; density: number; strength: number };
}

/** Post-process colour grade (`src/core/Game.ts` composer + `src/core/Grade.ts`). */
export interface ChunkGrade {
  saturation: number;
  brightness: number;
  contrast: number;
  bloomIntensity: number;
  bloomThreshold: number;
  /** split-tone multipliers for shadows / highlights (display-space RGB) */
  shadowTint: RGB;
  highTint: RGB;
  lift: RGB;
  gain: RGB;
  gamma: number;
}

/**
 * A shard's look-loop grade (PINE-HOLLOW PH-L1 / L4), laid over `grade` and the day clock
 * (src/world/lookFlags.ts): grade overrides, a display-space S-curve and vibrance in GradeEffect, and multipliers on the
 * clock's volumetric in-scatter / distance fog plus a saturation offset (PineDayNight.look; the presets untouched).
 */
export interface ChunkLook {
  grade: Partial<ChunkGrade>;
  /** S-curve strength around mid grey (0 = none) */
  curve: number;
  /** saturation lift that spares what is already saturated (0 = none) */
  vibrance: number;
  /** × the volumetric in-scatter, × the distance fog, + the clock's grade saturation */
  vol: number;
  fogDist: number;
  sat: number;
  /** × the sky's fill light (the IBL and the hemisphere): lighter shade under the canopy, the sun untouched */
  ambient: number;
  /** × the sky dome's brightness by day (the photo targets' paler sky; the IBL follows it, the fog colour does not) */
  sky: number;
  /** × the ground-mist sheets under a high sun (1 at dawn, dusk and night: the mist is the morning's and the night's) */
  dayMist: number;
}

export interface SpawnPose { x: number; z: number; yaw: number }

/**
 * Open water covering the whole shard (Driftwood Isle). The terrain's `waterLevel()` returns
 * `level` when this is set (the pond's line otherwise); everything below it is sea floor. The
 * ocean surface itself is `src/world/Ocean.ts`.
 */
export interface OceanDef {
  /** sea-surface height in metres */
  level: number;
  /** shallow-water colour (over sand) and deep-water colour, linear RGB */
  shallowColor: RGB;
  deepColor: RGB;
  /** metres below the surface at which the water reads as fully deep */
  deepDepth: number;
}

/**
 * How the shard is rendered: textured PBR (Pine Hollow), faceted flat-shaded vertex colours with no textures
 * (Driftwood Isle), or soft cel-banded vertex/gradient colour with painted shadows and rim light, no textures
 * (Nalati Grasslands — every mesh on the shared `src/world/painterly.ts` material).
 */
export type ChunkStyle = 'pbr' | 'lowpoly' | 'painterly';

/**
 * One azimuth band of a horizon ring (`ChunkHorizon`): a bump in the ring's height profile centred on a compass
 * bearing (0 = north = +Z, 90 = east = −X), `spread` degrees either side (cosine falloff), `height` metres above
 * the ring's base at its peak. `rough` 0 = smooth rolling hills … 1 = jagged ridged peaks.
 */
export interface HorizonBand { azimuth: number; spread: number; height: number; rough: number }
/** A painted horizon ring: radius (m), base height (m, relative to y = 0), colours (linear), snow above `snowLine` of its height (0..1, > 1 = none), haze 0..1 */
export interface HorizonRing { r: number; base: number; color: RGB; top: RGB; snowLine: number; haze: number; bands: HorizonBand[]; floor: number }
/** A shard-specific horizon (`src/world/Horizon.ts`): rings near → far; replaces the default three ridge rings. */
export interface ChunkHorizon { rings: HorizonRing[]; cloudSea: boolean }
/**
 * The first-person weapon the shard hands the player: `src/player/Crossbow.ts`, `src/player/Sword.ts` (+ the iron sword
 * on the wreck), or the Nalati kit (`src/player/nalatiKit.ts`: bow · sabre · spear). 'sword' and 'nalati' are the
 * melee shards (`meleeShard`): telegraphed charges on an arc, the hurt arc + trauma shake.
 */
export type ChunkWeapon = 'crossbow' | 'sword' | 'nalati';
/** the optional pieces of the ONE base HUD a shard switches on (E154) — the layout, the controls and the status column are
 *  every shard's; a shard's own rows / discs come in through src/ui/hudSlots.ts from its own modules */
export interface ChunkHud {
  /** the weapon strip (src/ui/WeaponStrip.ts): tabs down the left edge on the phone, a hotbar on desktop — else the SWAP pill */
  weaponStrip?: boolean;
  /** the sun / moon badge on the minimap's rim (Minimap.showDayBadge) */
  dayBadge?: boolean;
}
/** a shard whose weapons are melee-first (Driftwood's swords, Nalati's sabre / spear): AnimalManager's telegraphed charges, the hurt arc */
export const meleeShard = (def: { weapon?: ChunkWeapon | undefined }): boolean => def.weapon === 'sword' || def.weapon === 'nalati';

export interface ChunkDef {
  /** canonical id, e.g. `chunk://local/pine-hollow` */
  id: string;
  /** URL-safe key used by `?chunk=<slug>` and the registry */
  slug: string;
  displayName: string;
  /** world-grid position shown in the HUD, e.g. `(+3, −2)` */
  gridCoords: string;
  /** master seed; every Rng / Noise2D in the engine derives from it */
  seed: number;
  /** total trees the forest places (subject to the density noise) */
  treeCount: number;
  /** one-line biome name for the picker, e.g. "Boreal pine forest" */
  biome: string;
  /** two sentences for the title-screen picker */
  blurb: string;
  /** unfinished shard: the title deck stamps a big EXPERIMENTAL banner across its card */
  experimental?: boolean;
  /** a playable shard still being built, open to everyone: the title deck stamps EARLY ACCESS (not EXPERIMENTAL) on its card */
  earlyAccess?: boolean;
  /** URL of a 16:9 thumbnail for the picker (import a jpg from `src/chunks/thumbs/`) */
  thumbnail: string;
  /** full-bleed title-screen stills (jpg, ≤1600 px long side): the menu shows these instead of the live world */
  heroPortrait: string;
  heroLandscape: string;

  terrain: ChunkTerrain;
  assets: ChunkAssets;
  trees: ChunkTrees;
  forest: ChunkForest;
  fauna: HerdPlan[];
  /**
   * Per-shard overrides of a species' hunting-loop numbers (`HuntTuning`, src/entities/AnimalManager.ts), merged over
   * the species' own by `AnimalManager.tuningFor` — Driftwood's boars see you from far off on open sand. Keyed by kind.
   */
  faunaTuning?: Partial<Record<FaunaKind, Partial<HuntTuning>>>;
  sky: ChunkSky;
  atmosphere: ChunkAtmosphere;
  grade: ChunkGrade;
  /** the look loop's grade over `grade` (PH-L1 / L4) */
  look?: ChunkLook;
  /** where the player stands on entering (feet, metres; yaw radians — π faces +Z, the compass' north) */
  spawn: SpawnPose;
  /** rendering style; omitted = 'pbr' */
  style?: ChunkStyle;
  /** player weapon; omitted = 'crossbow' */
  weapon?: ChunkWeapon;
  /** what this shard switches on in the ONE base HUD every shard shares (E154, src/ui/hudSlots.ts); omitted = the base alone */
  hud?: ChunkHud;
  /** a painted horizon of its own (Nalati: the plateau rolling on, the snow range south); omitted = the default ridge rings */
  horizon?: ChunkHorizon;
  /**
   * `style: 'painterly'`: the ground's painted colour (linear RGB, written into `out` and returned) at (x, z), given the
   * surface height `h` and `slope` (0 flat → 1 vertical) — height, slope and noise → a palette ramp. `src/world/Terrain.ts` calls it once per terrain vertex; no textures are loaded.
   */
  groundColor?: (x: number, z: number, h: number, slope: number, t: ChunkTerrain, out: RGB) => RGB;
  /**
   * `style: 'painterly'`: the per-vertex masks for the per-pixel ground detail (src/nalati/terrainSurface.ts) —
   * [gravel, rock, snow], each 0..1, given the surface height `h` and `slope`. Roads come from the trails.
   */
  surfaceAt?: (x: number, z: number, h: number, slope: number) => [number, number, number];
  /** open water over the whole shard; omitted = dry land with an optional pond */
  ocean?: OceanDef;
  /** what the minimap and the full map draw of the built world (E130); omitted = ground, trails and the def's own features only */
  map?: ChunkMapDef;
  /** named places — Explore World's mini map pins them and flies to them (src/explore/MiniMap.ts); omitted = none */
  pois?: ChunkPoi[];
  /** the title's EXPLORE WORLD is offered on this shard (project/archive/2026-09-23-explore-world.md; the models it shows are what the
   *  shard's setup registers — src/explore/registry.ts); omitted = play only */
  explore?: boolean;
}

/**
 * The built world on the maps (E130, src/ui/Minimap.ts): flat silhouettes in the map's own style, read from the real layout —
 * the registered pieces' collider footprints (src/world/registry.ts), never hand-placed shapes.
 */
export interface ChunkMapDef {
  /** sand paths drawn as lines (the island's are not the pine trails' dirt beds) */
  paths?: Vec2[][];
  /** registry piece ids (a trailing `*` matches a prefix: `jetty-*`), each drawn in a look: a flat footprint in that material's
   *  colour, or `dot` (a tree crown: one small dot per collider) */
  pieces?: { ids: string[]; look: MapLook }[];
}
export type MapLook = 'planks' | 'timber' | 'stone' | 'rock' | 'dot';

/** a named place on the shard: world XZ in metres; `r` ≈ its size (how far back the fly-to camera stands) */
export interface ChunkPoi { id: string; name: string; x: number; z: number; r?: number }
