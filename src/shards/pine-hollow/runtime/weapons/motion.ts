import type { SimHost } from '@wildshard/engine/sim';
import { combatSpeedFactor } from '@wildshard/engine/player/combatMotion';

const UNAVAILABLE = new Error('Pine ranged motion requires an authoritative player sample');

/** Weapon input is sampled at the host's real pre-motor boundary, never from corrected displacement. Every active
 * tick replaces it before gameplay callbacks, including the first tick after restore, so no second clock or persisted
 * history is created. Delegated motion without its explicit sample refuses a loose instead of inventing standing input. */
export function installPineRangedMotion(host: SimHost): () => number {
  let factor: number | null = null;
  host.observePlayerMotion(sample => {
    factor = sample === null ? null : combatSpeedFactor(Math.sqrt(sample.velocityX * sample.velocityX + sample.velocityZ * sample.velocityZ),
      sample.grounded, sample.swimming, sample.hover, 7.2);
  });
  return () => { if (factor === null) throw UNAVAILABLE; return factor; };
}
