import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

const point = (id: string, radius: number, damage: number, windup: number, recover: number, cooldown: number): StrikeSpec => ({
  id, shape: { kind: 'point', radius }, range: radius, damage, windup, active: 0, recover, cooldown,
  units: 'world', tags: ['cover.checked'], weight: () => 1,
});
/** Measured authored attack windows, including animation's phase offsets. */
export const DRIFTWOOD_STRIKES = {
  snap: point('strike.crab.snap', 1.6, 10, 0.5, 0.28, 1.4),
  bite: point('strike.monkey.bite', 1.3, 6, 0.405, 0.495, 1.2),
  coconut: point('strike.monkey.coconut', 0.45, 8, 0.62, 0.38, 2.5),
  sailor: point('strike.sailor.swing', 1.9, 14, 0.645, 0.255, 1.5),
  swing: point('strike.captain.swing', 2.5, 24, 0.742, 0.308, 1.4),
  second: point('strike.captain.second-cut', 2.5, 24, (0.5 / 0.85 + 0.04) * 0.55, 0.55 - (0.5 / 0.85 + 0.04) * 0.55, 0.8),
  burst: { ...point('strike.captain.burst', 3, 16, 1.1, 0, 0), shape: { kind: 'point', radius: 3, exclusive: true } },
} satisfies Record<string, StrikeSpec>;
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
