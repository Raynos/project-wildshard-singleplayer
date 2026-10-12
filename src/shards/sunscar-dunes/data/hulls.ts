import type { ModelFit } from '@wildshard/sdk/looks/modelLibrary';

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
  /** the stand-in: its height and skeleton when the generated mesh did not load (drawn as nothing) */
  readonly standIn: { readonly h: number; readonly bones: readonly HullBone[] };
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

type V3 = readonly [number, number, number];

/** A code-built winged body as rows: the outline's right half (x / z, nose first, x 0 at both ends), mirrored. */
export interface LoftedBandHullRow {
  readonly half: readonly (readonly [number, number])[];
  /** the rim's height: `base` plus `perX` per metre out from the spine */
  readonly lift: { readonly base: number; readonly perX: number };
  /** the raised centre the top fans to, and the lower one the belly fans to */
  readonly top: V3;
  readonly bottom: V3;
  /** the back's and the belly's grey, times `tint` per channel (linear) */
  readonly shade: { readonly top: number; readonly bottom: number; readonly tint: V3 };
  /** the wing and head bands (as `BandSkinRow`'s) and the z behind which a vertex is wholly tail */
  readonly wing: HullBand;
  readonly head: HullBand;
  readonly tailBehind: number;
  /** the tail: a three-sided spine from its root's left, right and top corners to the tip */
  readonly tail: { readonly left: V3; readonly right: V3; readonly up: V3; readonly tip: V3 };
}

/**
 * The generated strider's hull (C6: Hunyuan3D-2 from `art/sunscar-dunes/round-7-models/ref-strider.jpg`, its head along −X,
 * turned to +Z): 3.6 m nose to tail, hooves at y 0. Facets under half its height ride the leg of their quadrant (each leg
 * bone at its leg's top), the front fifth above the withers is the head and horns, the back tenth the tail. A strider whose
 * model did not load stands undrawn on the stand-in skeleton (its load was faulted, SF72).
 */
export const STRIDER_HULL: QuadrupedHullRow = {
  fit: { size: 3.6, by: 'span', yaw: Math.PI / 2 },
  legs: [['legFL', -0.42, 0.75], ['legFR', 0.42, 0.75], ['legBL', -0.42, -0.8], ['legBR', 0.42, -0.8]],
  legTop: 0.5, legFoot: 0.8, head: { share: 0.2, above: 0.55 }, tail: 0.1, boneY: { body: 0.7, head: 0.75, tail: 0.7 },
  standIn: { h: 2.8, bones: [
    { name: 'body', parent: null, pos: [0, 2.0, 0] }, { name: 'head', parent: 'body', pos: [0, 2.2, 1.0] },
    { name: 'legFL', parent: 'body', pos: [-0.42, 1.85, 0.75] }, { name: 'legFR', parent: 'body', pos: [0.42, 1.85, 0.75] },
    { name: 'legBL', parent: 'body', pos: [-0.42, 1.85, -0.8] }, { name: 'legBR', parent: 'body', pos: [0.42, 1.85, -0.8] },
    { name: 'tail', parent: 'body', pos: [0, 2.0, -1.2] },
  ] },
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

/**
 * The code ray (the stand-in while the generated manta is missing, and the Model Explorer's dune ray): a flat manta with
 * a raised back, cephalic lobes and a long whip tail, a near-black back over a dark grey belly, skinned to the ray's five
 * bones with the generated body's wing and head bands; its whip tail a thin three-sided spine 2.2 m behind the body.
 */
export const RAY_CODE_HULL: LoftedBandHullRow = {
  half: [[0, 1.45], [0.35, 1.78], [0.62, 1.3], [1.6, 0.62], [2.65, -0.15], [1.45, -0.6], [0.42, -1.0], [0, -1.08]],
  lift: { base: 0.3, perX: 0.06 }, top: [0, 0.58, 0.15], bottom: [0, 0.12, 0.15], shade: { top: 0.07, bottom: 0.16, tint: [1.1, 0.85, 1] },
  wing: { from: 0.5, over: 1.6 }, head: { from: 1.0, over: 0.6 }, tailBehind: -1.05,
  tail: { left: [-0.07, 0.3, -1.0], right: [0.07, 0.3, -1.0], up: [0, 0.4, -1.0], tip: [0, 0.32, -3.2] },
};
