export interface PierLanding {
  /** where the deck starts ramping down (metres from the sea end) */
  readonly rampFrom: number;
  /** the sand the ramp lands on, own y (the deck's top is 0) */
  readonly landY: number;
  /** the ground under the two landing posts (the −X one, then the +X one), own y */
  readonly postGround: readonly [number, number];
}

/** SF46 (G134): a ramp at the sea end from the sand the pier starts on up to the deck (the lowered world's entry sandbars) */
export interface PierSeaRamp {
  /** how far the ramp runs from the sea end, metres */
  readonly run: number;
  /** the sand at the sea end, own y (the deck's top is 0) */
  readonly landY: number;
  /** the full entry width at the sea end, narrowing to the deck at the top (Jake's flared-ramp pick) */
  readonly flare: number;
}

export interface PierParams {
  /** the deck's run along +Z, metres (the landing's run included) */
  readonly length: number;
  /** deck width, metres */
  readonly width: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  readonly pileDepth: number;
  /** the step-down onto the sand at the far end, the landing posts and the pennant (the south pier, E43 / E111) */
  readonly landing: PierLanding | null;
  /** the pennant's downwind direction, own xz (unit) */
  readonly pennantDir: readonly [number, number];
  /** where the pennant flies, metres from the sea end: on the −X piling nearest it (E308: half way down the south pier, by
   *  the spawn and the boat); absent = on the sea-end bollard (E111) */
  readonly pennantAt?: number;
  /** a ramp up from the sand at the sea end (absent: the deck is flat to the sea end, over the water) */
  readonly seaRamp?: PierSeaRamp;
}

export interface PierSpec {
  x: number; z: number;
  /** metres along +z from (x, z) */
  length: number;
  /** deck width, metres */
  width: number;
  /** world y of the deck top */
  deckY: number;
  /** direction along the pier in radians about +y (0 = +z); the sea end is at (x, z) */
  rot?: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  pileDepth?: number;
  /** Step down onto sand: true extends through the shallows; 'end' keeps the authored extent. */
  landing?: boolean | 'end';
  /** with a landing: the pennant flies from the piling this many metres from the sea end (E308), not the sea-end bollard */
  pennantAt?: number;
  /** SF46 (G164): the deck ramps up over this many metres from road height (y = 0) at its sea end, where it meets the
   *  platform's entry socket (the lowered world's entries) */
  seaRamp?: { readonly run: number; readonly flare: number };
}

/** Canonical primitive parameters, independent of object property order. */
export function pierParamsKey(p:PierParams):string {
 return JSON.stringify([p.length,p.width,p.pileDepth,p.landing?.rampFrom??null,p.landing?.landY??null,
  p.landing?.postGround[0]??null,p.landing?.postGround[1]??null,p.pennantDir[0],p.pennantDir[1],p.pennantAt??null,
  p.seaRamp?.run??null,p.seaRamp?.landY??null,p.seaRamp?.flare??null]);
}
