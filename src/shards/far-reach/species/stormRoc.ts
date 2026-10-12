import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { skyBodyOrStandIn } from './bodies';
import { stormRocBrain, type StormRocBrain } from '../runtime/stormRocBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { STORM_ROC_DATA } from '../data/species';

const brains = new WeakMap<Animal, StormRocBrain>();
export const rocBrain = (a: Animal): StormRocBrain => { let value = brains.get(a); if (!value) { value = stormRocBrain(a); brains.set(a, value); } return value; };
export const STORM_ROC: SpeciesRow = { ...STORM_ROC_DATA,
  think: (a, ctx) => { rocBrain(a).think(ctx); }, act: (a, ctx) => { rocBrain(a).act(ctx); } };

/**
 * The body: the textured eagle (E392/E399, mockup D; Hunyuan3D-2's painted great eagle, pitched into flight, skinned with
 * blended weights and its head lifted to look ahead), baked offline by `generators/creatures.ts`; undrawn on its stand-in
 * skeleton when the bake is not loaded.
 */
export const rocBody = (): AnimalSpecies => skyBodyOrStandIn('storm-roc');
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
