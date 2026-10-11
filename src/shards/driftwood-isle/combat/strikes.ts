import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { DRIFTWOOD_STRIKE_ROWS } from '../data/strikes';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** Existing contact profiles evaluated through the shared two-user native strike-row law. */
export const DRIFTWOOD_STRIKES = {
  snap: strikeFromData(DRIFTWOOD_STRIKE_ROWS.snap),
  bite: strikeFromData(DRIFTWOOD_STRIKE_ROWS.bite),
  coconut: strikeFromData(DRIFTWOOD_STRIKE_ROWS.coconut),
  sailor: strikeFromData(DRIFTWOOD_STRIKE_ROWS.sailor),
  swing: strikeFromData(DRIFTWOOD_STRIKE_ROWS.swing),
  second: strikeFromData(DRIFTWOOD_STRIKE_ROWS.second),
  burst: strikeFromData(DRIFTWOOD_STRIKE_ROWS.burst),
};
const contact = new StrikeRunner();
/** What a Driftwood strike reads: the player's feet, the line-of-reach test and the common player damage pipeline.
 * The browser's ThinkCtx satisfies it; a renderer-free host lends its own (SF72). */
export interface DriftwoodContactPorts<A extends AnimalSim> {
  readonly player: A['position'];
  reach: (actor: A) => boolean;
  hurt: (damage: number) => void;
}
/** The manager supplies facing, cover and the common player damage pipeline through these ports. */
export function driftwoodContact<A extends AnimalSim>(actor: A, ctx: DriftwoodContactPorts<A>, spec: StrikeSpec): boolean {
  return contact.contact(spec, { actor, target: ctx.player, canReach: () => ctx.reach(actor), hit: (row) => { ctx.hurt(row.damage); } });
}
