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
}

/** Which tree builder to use and what it should be textured with. */
export interface ChunkTrees {
  /**
   * `'pine'` → `src/world/TreeFactory.ts` (baked branch cards). New species = new factory id. `'none'`: the
   * shard has no forest trees — no tree textures, geometry or branch-card bake at launch, an empty Forest
   * (collision / culling hooks still work).
   */
  factory: 'pine' | 'none';
  /** PBR set for the trunks */
  bark: string;
  /** folder under `public/assets/tex/` holding `twig_rgba.png`, `twig_nor_gl.jpg`, `twig_arm.jpg` */
  twigAtlas: string;
  /** what the HUD calls them, plural ("pines", "birches") */
  noun: string;
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

/** Lighting rig (`src/world/Sky.ts`). URL params `?hdri= &sunI= &envI= &bgI=` still override for tuning. */
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
/** The first-person weapon the shard hands the player (`src/player/Crossbow.ts` / `src/player/Sword.ts`). */
export type ChunkWeapon = 'crossbow' | 'sword';

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
  /** where the player stands on entering (feet, metres; yaw radians — π faces +Z, the compass' north) */
  spawn: SpawnPose;
  /** rendering style; omitted = 'pbr' */
  style?: ChunkStyle;
  /** player weapon; omitted = 'crossbow' */
  weapon?: ChunkWeapon;
  /** a painted horizon of its own (Nalati: the plateau rolling on, the snow range south); omitted = the default ridge rings */
  horizon?: ChunkHorizon;
  /**
   * `style: 'painterly'`: the ground's painted colour (linear RGB, written into `out` and returned) at (x, z), given the
   * surface height `h` and `slope` (0 flat → 1 vertical) — height, slope and noise → a palette ramp. `src/world/Terrain.ts` calls it once per terrain vertex; no textures are loaded.
   */
  groundColor?: (x: number, z: number, h: number, slope: number, t: ChunkTerrain, out: RGB) => RGB;
  /** open water over the whole shard; omitted = dry land with an optional pond */
  ocean?: OceanDef;
}
