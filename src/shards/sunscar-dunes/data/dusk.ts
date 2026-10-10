import type { DuskCurve, DuskRow } from '@wildshard/sdk/looks/duskCurves';

/**
 * How Signal Dunes' light moves with the quest's dusk (`look/dusk.ts` DUSK, 0 the first frame's sunset … 1 the blue
 * hour), as curves on the SDK's dusk curves (`@wildshard/sdk/looks/duskCurves`): the key's dimming and the fill's
 * (`look/render.ts`), the fog's sun-side lift, the far rings' haze and the aerial fog, and the sand's ground-layer terms
 * (`look/families.ts`). The why of each number is in the council rounds the comments name.
 */

/** The key light's dimming (E407: a slower fall through the middle steps, still monotonic; the sun drops fast once the quest starts). */
export const KEY_DIM: DuskCurve = { base: 1, terms: [{ gain: -0.95, pow: 0.7 }] };
/**
 * The sky fill (round 24: it falls by a third after the logbook's step, a global dusk term; round 12: no bump at dusk 0.5,
 * B's sand is lifted in the sand material instead; a floor: the late views keep warm brown sand).
 */
export const FILL: DuskCurve = { base: 1, terms: [{ gain: 0.05, pow: 1 }], times: { base: 1, terms: [{ gain: -0.35, ramp: [0.6, 0.3] }] } };
/** The fog's sun-side tint (row 10 at a third; round 26: brighter toward the glow as the land darkens, never dimmed late). */
export const FOG_SUN: DuskCurve = { scale: 0.35, base: 1, terms: [{ gain: 2.5, linear: [0.2, 0.5] }] };
/** The far ranges' haze (round 21b: full at the sunset step, falling to 15 % by the late waymarks). */
export const FAR_HAZE: DuskCurve = { base: 1, terms: [{ gain: -0.85, ramp: [0.55, 0.3], fold: true }] };
/**
 * The engine's exponential distance fog per metre (row 10's aerial perspective; round 22: 18 % at 150 m, 32 % at 300 m,
 * the haze is sunlight scattered in the air, so it thins as the light goes: full at the sunset step, a fifth by the blue hour).
 */
export const AERIAL_FOG: DuskCurve = { scale: 0.0013, base: 1, terms: [{ gain: -0.8, ramp: [0.3, 0.45], fold: true }] };

/**
 * The sand's ground-layer terms at a dusk value (the PBR family's `GroundLayerParams`; the grain's map and means and the
 * afterglow's direction join them in `look/families.ts`).
 */
export const SAND_DUSK: DuskRow = {
  // round 8 / 11: the ripples' contrast falls with the dusk (mockup B's late sand is dim and soft)
  contrast: { near: 0.52, far: 0.26, window: [4, 26], strength: { curve: { base: 1, terms: [{ gain: -0.55, edges: [0.2, 0.6] }, { gain: -0.2, edges: [0.6, 0.9] }] } } },
  // the blue hour's sky light models no grain (mockups B-D): the grain clumps fade as the dusk deepens
  grainStrength: { curve: { base: 1, terms: [{ gain: -0.75, edges: [0.2, 0.6] }] } },
  // round 12: the sunset step's sand a step darker
  albedo: { curve: { base: 0.8, terms: [{ gain: 0.2, edges: [0, 0.3] }] } },
  // round 1 / loop 6 / R2B-1: a cool blue-grey shade at sunset turning a warm brown at dusk, never blue-black; the dusk's
  // lavender floor (round 8: the late views' sand dim warm brown-violet, not black)
  shade: {
    tint: [{ curve: { mix: [0.95, 0.95] } }, { curve: { mix: [0.9, 0.85] } }, { curve: { mix: [1.3, 0.9] } }],
    gain: { curve: { base: 1.05, terms: [{ gain: 0.1, pow: 1 }] } },
    lift: [{ curve: { scale: 0.016, base: 1, terms: [{ gain: -1, pow: 1 }] } }, { curve: { scale: 0.013, base: 1, terms: [{ gain: -1, pow: 1 }] } }, { curve: { scale: 0.02, base: 1, terms: [{ gain: -1, pow: 1 }] } }],
    amount: 0.9, edge: 0.14,
    floor: [
      { curve: { terms: [{ gain: 0.013, pow: 1 }, { gain: 0.006, edges: [0.15, 0.5] }] } },
      { curve: { terms: [{ gain: 0.008, pow: 1 }, { gain: 0.004, edges: [0.15, 0.5] }] } },
      { curve: { terms: [{ gain: 0.009, pow: 1 }, { gain: 0.003, edges: [0.15, 0.5] }] } },
    ],
  },
  // rounds 12-24: in the late dusk the faces turned from the afterglow fall dark (x0.45), the faces toward it keep their light
  away: { curve: { terms: [{ gain: 0.55, edges: [0.3, 0.85] }] } },
};
