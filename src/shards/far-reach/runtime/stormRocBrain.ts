import { PhasedRaptorBrain } from '@wildshard/engine/ai/phasedRaptor';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { phasedRaptor } from '@wildshard/sdk/flyers';
import { strike } from '@wildshard/sdk/species';
import { CROWN } from '../data/layout';
import { ROC_BRAIN, ROC_STRIKES } from '../data/brains';
import { crownStones } from '../runtime/crownLayout';
import { STORM } from '../data/storm';
import { pushPlayer } from '../species/rig';

/** The Roc's strikes (data/brains.ts ROC_STRIKES), admitted: phase 1's stoop, phase 2's gale wall, phase 3's sweep. */
export const [STOOP, GALE_WALL, SWEEP] = ((): [StrikeSpec, StrikeSpec, StrikeSpec] => {
  const [stoop, wall, sweep] = ROC_STRIKES.map(row => strikeFromData(strike(row)));
  if (stoop === undefined || wall === undefined || sweep === undefined) throw new Error('far-reach: the Roc declares three strikes');
  return [stoop, wall, sweep];
})();
/** The Roc's perch: the top of the ring's tallest stone (world/crown.ts), the one opposite the arena's entrance. */
const PERCH = (): { x: number; y: number; z: number } => {
  const tallest = crownStones().reduce((best, st) => (st.h > best.h ? st : best));
  return { x: tallest.x, y: CROWN.y + tallest.h + 0.6, z: tallest.z };
};
/** The storm's eye (world/build.ts hangs the vortex STORM.ahead north of the crown). */
const STORM_EYE = { x: CROWN.x, z: CROWN.z - STORM.ahead } as const;
/**
 * The perched Roc's heading: into the storm's wind (E410 row 5). A perched raptor faces into the wind, so its feathers
 * lie flat and it lifts off into it. The storm's winds circle its eye the way its painted vortex turns: the lower disc
 * spins positive about +y (STORM.layers[0].spin, counter-clockwise seen from above), so on the crown, south of the eye,
 * they blow east across the arena and the Roc on the tallest stone faces west into them, side-on to whoever walks in
 * from the bridge. Its take-off then swings it round onto the player.
 */
const perchYaw = (): number => {
  const perch = PERCH(), spin = Math.sign(STORM.layers[0].spin), dx = perch.x - STORM_EYE.x, dz = perch.z - STORM_EYE.z;
  // the wind at the perch is spin * (up × out-from-the-eye) = spin * (dz, -dx); the Roc faces the other way
  return Math.atan2(-spin * dz, spin * dx);
};
/** The Roc's admitted phased-raptor declaration, perched on the crown. */
const ROC = phasedRaptor({ ...ROC_BRAIN, perch: { ...PERCH(), yaw: perchYaw() } });
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
