import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { BoxGeometry, ConeGeometry, IcosahedronGeometry } from 'three';
import { hull } from './rig';
import { skyBody } from './bodies';
import { stormRocBrain, type StormRocBrain } from '../runtime/stormRocBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { ROC } from '../data/layout';
import { STRINGS } from '../data/strings';
import { STORM_ROC_VARIANTS } from '../runtime/variants';


const brains = new WeakMap<Animal, StormRocBrain>();
export const rocBrain = (a: Animal): StormRocBrain => { let value = brains.get(a); if (!value) { value = stormRocBrain(a); brains.set(a, value); } return value; };
export const STORM_ROC: SpeciesRow = { id: 'far.creature.stormRoc', kind: 'stormRoc', label: STRINGS.roc, aggressive: true, blood: false,
  // bank (engine 8252e3978): it rolls into its turns, so the lap round the dais banks (round 7: 'a frontal level bird')
  flight: { altitude: ROC.y, above: 'world', climbRate: 9, diveRate: 24, lockRange: 40, bank: 0.35 },
  variants: STORM_ROC_VARIANTS,
  think: (a, ctx) => { rocBrain(a).think(ctx); }, act: (a, ctx) => { rocBrain(a).act(ctx); } };


const BODY = 0, HEAD = 1, WING_L = 2, WING_R = 3, TAIL = 4;
const wing = (side: number, bone: number): { geometry: ConeGeometry; bone: number; color: number; at: readonly [number, number, number]; rot: readonly [number, number, number] }[] => [
  { geometry: new ConeGeometry(0.9, 4.8, 4), bone, color: 0x3b3150, at: [side * 2.9, 1.6, -0.2], rot: [0, 0, side * Math.PI / 2] },
  { geometry: new ConeGeometry(0.6, 3.2, 4), bone, color: 0xd9a066, at: [side * 4.4, 1.5, -0.7], rot: [0.2, 0, side * Math.PI / 2] },
];
/** Where a wing starts (metres off the centre line): outboard of it a facet rides its wing bone. */
const ROC_WING_ROOT = 1.1;
const ROC_BONES = (head: number, headY: number, tail: number): BoneDef[] => [{ name: 'body', parent: null, pos: [0, 1.6, 0] },
  { name: 'head', parent: 'body', pos: [0, headY, head] }, { name: 'wingL', parent: 'body', pos: [ROC_WING_ROOT, 1.7, 0] },
  { name: 'wingR', parent: 'body', pos: [-ROC_WING_ROOT, 1.7, 0] }, { name: 'tail', parent: 'body', pos: [0, 1.5, tail] }];
/** The code Roc: primitive parts (the stand-in while the generated model is missing). */
function rocCode(): AnimalSpecies {
  return { bones: ROC_BONES(1.6, 2.1, -1.4), furParts: [], eyeParts: [],
    hardParts: [hull([
      { geometry: new IcosahedronGeometry(1.1, 0), bone: BODY, color: 0x463a5c, at: [0, 1.6, 0], rot: [0, 0, 0] },
      { geometry: new BoxGeometry(1.3, 1, 2.4), bone: BODY, color: 0x3b3150, at: [0, 1.6, -0.2] },
      { geometry: new IcosahedronGeometry(0.55, 0), bone: HEAD, color: 0xe8dcc8, at: [0, 2.2, 1.7] },
      { geometry: new ConeGeometry(0.22, 0.8, 4), bone: HEAD, color: 0xf0b542, at: [0, 2.1, 2.4], rot: [Math.PI / 2, 0, 0] },
      ...wing(1, WING_L), ...wing(-1, WING_R),
      { geometry: new ConeGeometry(0.7, 2.2, 4), bone: TAIL, color: 0x2e2640, at: [0, 1.5, -2.4], rot: [-Math.PI / 2, 0, 0] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [0.35, 0.55, 0.1] },
      { geometry: new BoxGeometry(0.18, 1.1, 0.18), bone: BODY, color: 0xf0b542, at: [-0.35, 0.55, 0.1] },
    ])],
    dims: { bodyY: 1.6, bodyHalfLen: 1.4, bodyRadius: 1.1, headRadius: 0.55, legLen: 1, feet: [], halfWidth: 5.5 } };
}
/**
 * The body: the textured eagle (E392/E399, mockup D; Hunyuan3D-2's painted great eagle, pitched into flight, skinned with
 * blended weights and its head lifted to look ahead), baked offline by `generators/creatures.ts`; the code Roc when the
 * bake is not loaded (headless, a failed load).
 */
export const rocBody = (): AnimalSpecies => skyBody('storm-roc') ?? rocCode();
/** The soaring wings' raised V (radians): level, from the arena they read edge-on; raised, their undersides face a viewer below. */
const ROC_DIHEDRAL = 0.1;
export const STORM_ROC_LOOK: SpeciesLook = { id: 'far.look.stormRoc', species: STORM_ROC.id, kind: 'stormRoc', rig: 'custom', fur: NO_FUR,
  rigContract: { skeleton: 'far.stormRoc', sockets: ['body', 'head', 'wingL', 'wingR', 'tail'], clips: ['idle', 'fly', 'attack', 'hit', 'die'] },
  build: () => rocBody(),
  animate: ({ bones, t, dt, alive, mem }) => {
    // a 19 m raptor soars (round 7: a steady beat caught the wings raised edge-on in half the frames; mockup D's eagle glides,
    // wings spread): a slow flex, with a few strong beats in a short burst every ~6 s
    const burst = Math.max(0, Math.sin(t * 1.05) - 0.85) / 0.15;
    const flap = alive ? ROC_DIHEDRAL + Math.sin(t * 0.9) * 0.06 + Math.sin(t * 3.8) * 0.45 * burst : 0.9;
    const l = bones['wingL'], r = bones['wingR'], tail = bones['tail'], body = bones['body'];
    if (l) l.rotation.z = flap; if (r) r.rotation.z = -flap; if (tail) tail.rotation.x = alive ? Math.sin(t * 1.1) * 0.15 : 0;
    // the take-off's lean into its swing onto the player (the brain's rocLean), eased; level flight adds the engine's bank
    const lean = (mem['rocBank'] ?? 0) + ((alive ? mem['rocLean'] ?? 0 : 0) - (mem['rocBank'] ?? 0)) * Math.min(1, dt * 3);
    mem['rocBank'] = lean; if (body) body.rotation.z = lean;
    // (round 13: 'no face or beak shows') the head looks into the turn it leans into, so from the ground you see a turned
    // white head and its hooked beak, as mockup D's eagle shows them
    const head = bones['head'];
    if (head) head.rotation.y = alive ? Math.max(-0.6, Math.min(0.6, -lean * 1.8)) + Math.sin(t * 0.45) * 0.12 : 0;
  },
};
