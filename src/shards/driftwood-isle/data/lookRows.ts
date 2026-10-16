// SHARD-PLATFORM W2 C2 (look-family rows): the row types Driftwood's look data is written in (a low-poly kit mesh's rows
// are generators/kitParts.ts's own): a smoke column's numbers (data/smokeLook.ts), the reef bed's
// scatter (runtime/looks/reefBed.ts), the faceted ground (runtime/looks/facetedGround.ts), the mooring lines
// (runtime/props/mooringLines.ts) and the streamed ground cover (runtime/looks/streamedCover.ts). The rows themselves are
// data/{smoke,seabed,ground,boat,cover}Look.ts.
import type { AmbientFlockData } from '@wildshard/format/ambientLife';

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
  /** the school's swim: an ambient flock wheel row (the baked school sets its centre, radius, depth and count) */
  readonly swim: AmbientFlockData;
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

/** Mooring lines' numbers as data. */
export interface MooringLinesRow {
  /** the rope's colour, its post end's height over the still water (m), the sag at the middle (m), the tube's length
   *  segments, radius (m) and radial segments */
  readonly color: string;
  readonly postAbove: number;
  readonly sag: number;
  readonly segments: number;
  readonly radius: number;
  readonly radial: number;
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
