import type { Curve, MaterialCurves } from '@wildshard/format/materials';

/**
 * How Signal Dunes' light moves with the quest's dusk (`look/dusk.ts` DUSK, 0 the first frame's sunset … 1 the blue
 * hour), as the format's curves (`@wildshard/format/materials` curveAt): the key's dimming and the fill's
 * (`look/render.ts`), the fog's sun-side lift, the far rings' haze and the aerial fog, and the sand's ground-layer terms
 * (`look/render.ts` on the platform dusk look). The why of each number is in the council rounds the comments name.
 */

/** The key light's dimming (E407: a slower fall through the middle steps, still monotonic; the sun drops fast once the quest starts). */
export const KEY_DIM: Curve = { base: 1, terms: [{ gain: -0.95, pow: 0.7 }] };
/**
 * The sky fill (round 24: it falls by a third after the logbook's step, a global dusk term; round 12: no bump at dusk 0.5,
 * B's sand is lifted in the sand material instead; a floor: the late views keep warm brown sand).
 */
export const FILL: Curve = { base: 1, terms: [{ gain: 0.05, pow: 1 }], times: { base: 1, terms: [{ gain: -0.35, ramp: [0.6, 0.3] }] } };
/** The fog's sun-side tint (row 10 at a third; round 26: brighter toward the glow as the land darkens, never dimmed late). */
export const FOG_SUN: Curve = { scale: 0.35, base: 1, terms: [{ gain: 2.5, linear: [0.2, 0.5] }] };
/** The far ranges' haze (round 21b: full at the sunset step, falling to 15 % by the late waymarks). */
export const FAR_HAZE: Curve = { base: 1, terms: [{ gain: -0.85, ramp: [0.55, 0.3], fold: true }] };
/**
 * The engine's exponential distance fog per metre (row 10's aerial perspective; round 22: 18 % at 150 m, 32 % at 300 m,
 * the haze is sunlight scattered in the air, so it thins as the light goes: full at the sunset step, a fifth by the blue hour).
 */
export const AERIAL_FOG: Curve = { scale: 0.0013, base: 1, terms: [{ gain: -0.8, ramp: [0.3, 0.45], fold: true }] };

type CurveRow = MaterialCurves[string][number];
const dusk = (param: string, curve: CurveRow['curve']): CurveRow => ({ param: `ground.${param}`, state: 'shared.dusk', curve });
const fades = (...steps: readonly (readonly [number, number, number])[]): { gain: number; edges: [number, number] }[] => steps.map(([gain, from, to]) => ({ gain, edges: [from, to] }));
const TINT: [number, number][] = [[0.95, 0.95], [0.9, 0.85], [1.3, 0.9]], FLOOR: [number, number][] = [[0.013, 0.006], [0.008, 0.004], [0.009, 0.003]];
/**
 * The sand's ground-layer terms over the dusk (the PBR family's `GroundLayerParams` in data/familyLook.ts SAND_LOOK's
 * entry), as state-bound material curves (`look.curves` rows over `shared.dusk`): each writes its curve's value at its path.
 */
export const SAND_DUSK: MaterialCurves[string] = [
  // round 8 / 11: the ripples' contrast falls with the dusk (mockup B's late sand is dim and soft)
  dusk('contrast.strength', { base: 1, terms: fades([-0.55, 0.2, 0.6], [-0.2, 0.6, 0.9]) }),
  // the blue hour's sky light models no grain (mockups B-D): the grain clumps fade as the dusk deepens
  dusk('grain.strength', { base: 1, terms: fades([-0.75, 0.2, 0.6]) }),
  // round 12: the sunset step's sand a step darker
  dusk('albedo', { base: 0.8, terms: fades([0.2, 0, 0.3]) }),
  // round 1 / loop 6 / R2B-1: a cool blue-grey shade at sunset turning a warm brown at dusk, never blue-black; the dusk's
  // lavender floor (round 8: the late views' sand dim warm brown-violet, not black)
  ...TINT.map((mix, i) => dusk(`shade.tint.${String(i)}`, { mix })),
  dusk('shade.gain', { base: 1.05, terms: [{ gain: 0.1, pow: 1 }] }),
  ...[0.016, 0.013, 0.02].map((scale, i) => dusk(`shade.lift.${String(i)}`, { scale, base: 1, terms: [{ gain: -1, pow: 1 }] })),
  ...FLOOR.map(([early, late], i) => dusk(`shade.floor.${String(i)}`, { terms: [{ gain: early, pow: 1 }, { gain: late, edges: [0.15, 0.5] }] })),
  // rounds 12-24: in the late dusk the faces turned from the afterglow fall dark (x0.45), the faces toward it keep their light
  dusk('away.amount', { terms: fades([0.55, 0.3, 0.85]) }),
];
