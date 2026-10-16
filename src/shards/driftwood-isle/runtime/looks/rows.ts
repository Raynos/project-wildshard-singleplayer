import type { DayClockStyle } from '@wildshard/sdk/looks/dayClock';
import type { DayLookPreset } from '@wildshard/sdk/looks/dayLookPresets';
import type { FACETED_DAY_PRESET } from '../const';

/**
 * The row types Driftwood's runtime looks read (the runtime's own copies, G449; the build-time originals are
 * data/lookRows.ts and data/facetedDayRows.ts). The call sites that hand these looks a data/ value check the two shapes
 * agree; the values themselves are mirrored through runtime/const.ts.
 */

/** A smoke column's numbers as data. */
export interface SmokeColumnRow {
  /** puffs, metres the column climbs, seconds a puff lives, the per-puff life speed (base, jittered gain), the seed spread
   *  and the seed's step each time a puff restarts, and the start seed of the column's LCG */
  readonly count: number;
  readonly rise: number;
  readonly life: number;
  readonly rate: readonly [number, number];
  readonly seedSpread: number;
  readonly reseed: number;
  readonly seed: number;
  /** the rise's eased and linear shares, the base over the fire (m), the lean (m at the top) and the wind (x, z) */
  readonly ease: number;
  readonly linear: number;
  readonly base: number;
  readonly lean: number;
  readonly wind: readonly [number, number];
  /** the wander: [frequency on age, frequency on seed, base reach, reach gained by the top] for x, then z */
  readonly wanderX: readonly [number, number, number, number];
  readonly wanderZ: readonly [number, number, number, number];
  /** the puff's size (base, gained by the top), the fade in (age share), the fade out (age share) and its power, and the
   *  thinning (base, sine gain, seed frequency) */
  readonly size: readonly [number, number];
  readonly fadeIn: number;
  readonly fadeOut: number;
  readonly fadePow: number;
  readonly thin: readonly [number, number, number];
  /** the colour (linear), and the opacity close (base) and gained from `opacityFrom` to `opacityTo` m */
  readonly color: readonly [number, number, number];
  readonly opacity: readonly [number, number];
  readonly opacityFrom: number;
  readonly opacityTo: number;
  /** the bounding sphere's centre off the fire and its radius, the render order and the mesh's name */
  readonly bounds: { readonly offset: readonly [number, number, number]; readonly radius: number };
  readonly renderOrder: number;
  readonly name: string;
}

/** One noise field: its seed (added to the shard's), frequency, octaves and x offset. */
export interface ReefNoiseRow { readonly seed: number; readonly freq: number; readonly octaves: number; readonly offset: number }

/** The scatter's numbers as data. */
export interface ReefBedRow {
  /** the scatter's rng salt (xor the shard's seed), tries per copy and the margin kept from the chunk's edge (m) */
  readonly salt: number;
  readonly tries: number;
  readonly margin: number;
  /** water depth range (m) and the ground's least normal y (sampled `normalReach` m wide) */
  readonly depth: readonly [number, number];
  readonly normalReach: number;
  readonly minNy: number;
  readonly reefNoise: ReefNoiseRow;
  readonly bedNoise: ReefNoiseRow;
  /** the reef kind: where the reef noise is over `above` and the roll under `roll`, kept with p = (noise − above) × gain +
   *  base, `spacing` m apart, sized `scale` × (1 + max(0, noise) × grow) */
  readonly reef: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly grow: number };
  /** the bed kind: likewise on the bed noise, sized `scale` × (from + min(1, depth / full) × grow) */
  readonly bed: { readonly kind: string; readonly above: number; readonly roll: number; readonly gain: number; readonly base: number; readonly spacing: number; readonly scale: readonly [number, number]; readonly from: number; readonly full: number; readonly grow: number };
  /** the scattered kind: a roll past the bed's, kept with p = `chance` */
  readonly scatter: { readonly kind: string; readonly chance: number; readonly spacing: number; readonly scale: readonly [number, number] };
  /** the school: over the reef copy with the most reef copies within `radius`, at depth share `depthShare` (at most
   *  `maxDepth` m down), swimming a loop of radius `r`, `n` fish */
  readonly school: { readonly radius: number; readonly depthShare: number; readonly maxDepth: number; readonly r: number; readonly n: number };
  /** the weld's and the school's rng seeds */
  readonly buildSeed: number;
  readonly schoolSeed: number;
  /** the weld mesh's name and its kinds' piece ids (`<piecePrefix><kind>`); the school's mesh name and piece id */
  readonly mesh: string;
  readonly piecePrefix: string;
  readonly fishMesh: string;
  readonly fishPiece: string;
}

/** A faceted ground's numbers as data. */
export interface FacetedGroundRow {
  /** the look.materials ids the grid and the slab wear (graph toon materials the look lends before the ground builds) */
  readonly materials: { readonly ground: string; readonly slab: string };
  /** rows built per task */
  readonly band: number;
  /** a cliff's top lip: below this normal y, the highest ground within `reach` m, smoothstepped `from` → `to` m above */
  readonly lip: { readonly steep: number; readonly reach: number; readonly from: number; readonly to: number };
  /** the slab walls: segments per side, rock and deep colours, the lip above the ground (m), the bulge's base and
   *  jittered gain (m), the foot's step out (m), the bulge's depth share and the shade's base and jittered gain */
  readonly slab: {
    readonly segs: number; readonly rock: string; readonly deep: string; readonly top: number;
    readonly bulge: readonly [number, number]; readonly foot: number; readonly mid: number; readonly shade: readonly [number, number];
  };
}

/** A kind's far tier as data: its model's geometry key, [farNear, farFar] m, its instance cap and the share kept. */
export interface StreamedCoverFarRow {
  readonly geometry: string;
  readonly reach: readonly [number, number];
  readonly cap: number;
  /** the share of the kind's plants that get a far model (drawn by a hash of the yaw) */
  readonly keep: number;
}

/** One kind as data: its name, geometry key, instance cap (phone, before `capK`), reach, scale range and far tier. */
export interface StreamedCoverKindRow {
  readonly name: string;
  readonly geometry: string;
  readonly cap: number;
  /** (near, far) m: full density inside near, thinning to none at far */
  readonly reach: readonly [number, number];
  readonly scale: readonly [number, number];
  readonly far?: StreamedCoverFarRow;
}

/** The cover's numbers and kinds as data (its plants' graphs are look.materials, data/coverLook.ts). */
export interface StreamedCoverRow {
  /** cell size, refill travel (m), candidates per cell, the least cells cached */
  readonly cell: number;
  readonly refill: number;
  readonly candidates: number;
  readonly cacheMin: number;
  /** the desktop's reach and instance caps over the phone's */
  readonly reachK: { readonly phone: number; readonly desktop: number };
  readonly capK: { readonly phone: number; readonly desktop: number };
  /** the share of (far − near) a plant grows over */
  readonly growShare: number;
  /** the far set's rebuild travel, slack (m) and per-frame budget (ms) */
  readonly farRefill: number;
  readonly farSlack: number;
  readonly farBudgetMs: { readonly phone: number; readonly desktop: number };
  /** s a far set that lands somewhere new takes to grow in */
  readonly farIn: number;
  /** the viewer is the player's feet; the camera is up to this much over them */
  readonly eyeSlack: number;
  /** bytes the whole cover uploads a frame, and how early the near set starts (m) */
  readonly uploadBytes: number;
  readonly nearLag: number;
  /** m a plant's base sits under the ground it stands on */
  readonly sink: number;
  /** plants on sloping ground keep reach × up to `up` (slope `lo` … `hi`), fading out `fadeFrom` … `fadeTo` m over the ground */
  readonly slopeReach: { readonly up: number; readonly lo: number; readonly hi: number; readonly fadeFrom: number; readonly fadeTo: number };
  /** the look.materials ids' prefix: a kind's near model wears `<look>-<kind>`, its far model `<look>-<kind>-far` */
  readonly look: string;
  /** the meshes are named `<meshPrefix><kind>` and `<meshPrefix><kind>-far` */
  readonly meshPrefix: string;
  readonly kinds: readonly StreamedCoverKindRow[];
}

type Rgb = readonly [number, number, number];
/** a colour as data: an sRGB hex number or linear RGB */
export type DayColour = number | Rgb;

/** one keyed light preset, as data */
export interface FacetedDayPresetRow {
  readonly sky: {
    readonly zenith: DayColour; readonly horizon: DayColour; readonly below: DayColour; readonly sunGlow: DayColour;
    readonly cloudLit: DayColour; readonly cloudShade: DayColour; readonly night: number;
  };
  /** the light body (the sun by day, the moon by night): colour, intensity */
  readonly light: DayColour; readonly lightI: number;
  readonly hemiSky: DayColour; readonly hemiGround: DayColour; readonly hemiI: number;
  readonly lift: DayColour; readonly rim: DayColour; readonly fogNear: DayColour; readonly fogSun: DayColour;
  readonly disc: DayColour; readonly cloudShadow: number; readonly dusk: number;
}

/** a faceted day's row: the shared clock's row (presets, keyframes, arcs, curves) and the backdrop's numbers */
export interface FacetedDayStyle extends DayClockStyle<typeof FACETED_DAY_PRESET> {
  readonly presets: Readonly<Record<string, FacetedDayPresetRow>>;
  /** the shadow light turns in steps of this many degrees */
  readonly shadowStepDeg: number;
  /** seconds between environment re-renders */
  readonly envRefresh: number;
  /** the PMREM cube size of the dome's environment */
  readonly envSize: number;
  /** the sun before the clock moves it (normalised) */
  readonly startSun: Rgb;
  /** the planet's lit-side haze: the horizon toward this colour, by this much by day */
  readonly planetHaze: Rgb; readonly planetHazeDay: number;
  /** the disc's scale by night */
  readonly moonDisc: number;
  /** the level's sun intensity this row's `lightI` is relative to */
  readonly sunIBase: number;
}


/** one live preset (the row's colours as three.js colours) */
export type FacetedDayPreset = DayLookPreset<typeof FACETED_DAY_PRESET>;
