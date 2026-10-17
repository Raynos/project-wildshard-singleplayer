/** How a hull's source model is framed (the model library's `ModelFit`): turned `yaw` about +Y, centred on x / z (on its
 *  footing, the lowest tenth, with `centre: 'base'`), its lowest point at `floor`, `size` metres by span or height. */
export interface ModelFit { readonly size: number; readonly by: 'span' | 'height'; readonly floor?: number; readonly yaw?: number; readonly centre?: 'base' }

/** One bone of a hull's skeleton (absolute bind space). */
export interface HullBone { name: string; parent: string | null; pos: [number, number, number] }

/** A four-legged hull as rows: its fit, its legs' names and stand-in tops, and the shares that split it. */
export interface QuadrupedHullRow {
  readonly fit: ModelFit;
  /** the legs, front-left, front-right, back-left, back-right: name and the stand-in top's x / z */
  readonly legs: readonly (readonly [string, number, number])[];
  /** the leg tops' height as a share of the hull's height; a facet below it rides a leg */
  readonly legTop: number;
  /** the vertices that place a leg's top: below this share of the leg top */
  readonly legFoot: number;
  /** the head: the front `share` of the length, above `above` of the height */
  readonly head: { readonly share: number; readonly above: number };
  /** the tail: the back share of the length */
  readonly tail: number;
  /** the body, head and tail bones' heights as shares of the hull's height */
  readonly boneY: { readonly body: number; readonly head: number; readonly tail: number };
}

/** A smooth band: 0 at `from`, 1 at `from + over` (a smoothstep). */
export interface HullBand { readonly from: number; readonly over: number }

/** A winged hull as rows: its fit, its nose, its three bands and an optional tint. */
export interface BandSkinRow {
  readonly fit: ModelFit;
  /** the nose's z after the fit (the hull is moved along z so its front lies there) */
  readonly nose: number;
  /** the wings by |x|; the tail by −z (behind −`from`); the head by z */
  readonly wing: HullBand;
  readonly tail: HullBand;
  readonly head: HullBand;
}

/** A tint for a hull's painted facets (linear): the back × `top`, the underside lerped to `belly` by `bellyMix`. */
export interface HullTint { readonly top: readonly [number, number, number]; readonly belly: readonly [number, number, number]; readonly bellyMix: number }

/**
 * The generated strider's hull (C6: Hunyuan3D-2 from `art/sunscar-dunes/round-7-models/ref-strider.jpg`, its head along −X,
 * turned to +Z): 3.6 m nose to tail, hooves at y 0. Facets under half its height ride the leg of their quadrant (each leg
 * bone at its leg's top), the front fifth above the withers is the head and horns, the back tenth the tail. Baked offline
 * (generators/hulls.ts, G345): the client loads rigs/strider.glb on data/striderRig.baked.ts's skeleton.
 */
export const STRIDER_HULL: QuadrupedHullRow = {
  fit: { size: 3.6, by: 'span', yaw: Math.PI / 2 },
  legs: [['legFL', -0.42, 0.75], ['legFR', 0.42, 0.75], ['legBL', -0.42, -0.8], ['legBR', 0.42, -0.8]],
  legTop: 0.5, legFoot: 0.8, head: { share: 0.2, above: 0.55 }, tail: 0.1, boneY: { body: 0.7, head: 0.75, tail: 0.7 },
};

/**
 * The Matriarch's own body (loop 2, R6: `art/sunscar-dunes/round-11-loop-2/ref-matriarch.jpg` → Hunyuan3D-2, painted
 * facets): a sand-hided manta with spined back, curled cephalic horns and a long whip tail, 5.3 m wing tip to wing tip
 * (×3.6 in the world), nose at the code ray's (+Z, z 1.78). Skinned per vertex to the ray's five bones with the ray's own
 * blend: wings by |x|, the head forward of z 1.0, the tail behind the wings' trailing edge.
 */
export const MANTA_HULL: BandSkinRow = { fit: { size: 5.3, by: 'span', floor: 0.05 }, nose: 1.78,
  wing: { from: 0.5, over: 1.6 }, tail: { from: 1.0, over: 0.5 }, head: { from: 1.0, over: 0.6 } };

/** The ray's hide on the Matriarch's generated body (round 1, R1C-2 / R1B-15: the dune ray is this body at its own
 *  scale, a lighter hide over a pale belly, so it reads against the dusk sky); council round 2: a dark silhouette, not a
 *  pale card. */
export const RAY_TINT: HullTint = { top: [0.62, 0.52, 0.5], belly: [0.42, 0.3, 0.24], bellyMix: 0.7 };
