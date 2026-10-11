import { PhasedRaptorBrain } from './phasedRaptor';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { parsePhasedRaptor } from './phasedRaptors';
import { strike } from '@wildshard/sdk/species';
import { ROC_PROFILE, ROC_STRIKES } from '../data/brains';
import { pushPlayer } from '../species/rig';

/** The Roc's strikes (data/brains.ts ROC_STRIKES), admitted: phase 1's stoop, phase 2's gale wall, phase 3's sweep. */
export const [STOOP, GALE_WALL, SWEEP] = ((): [StrikeSpec, StrikeSpec, StrikeSpec] => {
  const [stoop, wall, sweep] = ROC_STRIKES.map(row => strikeFromData(strike(row)));
  if (stoop === undefined || wall === undefined || sweep === undefined) throw new Error('far-reach: the Roc declares three strikes');
  return [stoop, wall, sweep];
})();
/** The Roc's admitted phased-raptor declaration, perched on the authored crown rows. */
const ROC = parsePhasedRaptor(ROC_PROFILE);
/** The phase its encounter sets (runtime/rocEncounter.ts clamps to it). */
export type RocPhase = 0 | 1 | 2;
/** The Storm Roc's body brain: a platform phased raptor (@wildshard/engine/ai/phasedRaptor) on its declared row. */
export type StormRocBrain<A extends AnimalSim = Animal> = PhasedRaptorBrain<A>;
/**
 * A Roc body's brain on its declared row (data/brains.ts ROC_BRAIN, perched on the crown). The boss script
 * (runtime/rocEncounter.ts) owns the fight and sets its phase; `shove` is the gale wall's player push (the browser's
 * pushPlayer; the headless host's impulse).
 */
export function stormRocBrain<A extends AnimalSim>(actor: A, shove: (yaw: number, speed: number, lift: number) => void = pushPlayer): StormRocBrain<A> {
  return new PhasedRaptorBrain(actor, ROC, [STOOP, GALE_WALL, SWEEP], shove);
}
