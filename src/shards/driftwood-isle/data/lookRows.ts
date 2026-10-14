// SHARD-PLATFORM W2 C2 (look-family rows): the row types Driftwood's look data is written in: a low-poly kit mesh as its
// parts (runtime/kit/kitParts.ts builds it) and a smoke column's numbers (runtime/looks/smokeColumn.ts draws it). The
// rows themselves are data/castawayLook.ts and data/traderLook.ts.

/** A primitive's kind; `args` are the constructor's (`log`: a, b, r0, r1, sides, twist; `rope`: r then the points
 *  flattened; `rock`: r, detail, squash, rough; `plank`: length, width, thickness, wobble), the kit's rng implied. */
export type KitPartKind = 'box' | 'icosa' | 'cone' | 'cylinder' | 'torus' | 'sphere' | 'log' | 'rope' | 'rock' | 'plank';

/** One part of a kit mesh as data. */
export interface KitPartRow {
  readonly kind: KitPartKind;
  readonly args: readonly number[];
  /** its colour (any CSS colour three parses) */
  readonly color: string;
  /** transforms applied to the primitive first, in order: ['rotateX' | 'rotateY' | 'rotateZ', rad] or ['translate', x, y, z] */
  readonly pre?: readonly (readonly [string, ...number[]])[];
  /** where: [x, y, z, ry, rx, rz, sx, sy, sz] (trailing defaults 0 / 1 may be left off); or `matrix` (16, column-major) */
  readonly at?: readonly number[];
  readonly matrix?: readonly number[];
  /** the kit's per-vertex wobble (m), per-face jitter and wind sway */
  readonly wobble?: number;
  readonly jitter?: number;
  readonly sway?: { readonly w: number; readonly phase?: number; readonly hang?: boolean };
  /** placed off the build's origin (its position, or a log's two ends) */
  readonly rel?: boolean;
}

/** A kit mesh as data: the kit's seed, its finish (baked ambient occlusion or none) and its parts in add order. */
export interface KitMeshRow {
  readonly seed: number;
  readonly ao: { readonly floorY: number; readonly strength: number } | false;
  readonly parts: readonly KitPartRow[];
}

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
  /** the colour (linear), the opacity before the first update, the opacity close (base) and gained from `opacityFrom` to `opacityTo` m, and the distance past
   *  which the puffs stop */
  readonly color: readonly [number, number, number];
  readonly startOpacity: number;
  readonly opacity: readonly [number, number];
  readonly opacityFrom: number;
  readonly opacityTo: number;
  readonly far: number;
  /** the bounding sphere's centre off the fire and its radius, the render order, the material's name and its patch */
  readonly bounds: { readonly offset: readonly [number, number, number]; readonly radius: number };
  readonly renderOrder: number;
  readonly name: string;
  readonly patch: { readonly id: string; readonly key: string };
}
