import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner, type StrikeActor, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Vector3 } from 'three';
import { strike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { NALATI_STRIKE_ROWS } from '../data/strikeProfiles';

const point = (radius: number): StrikeSpec['shape'] => ({ kind: 'point', radius, exclusive: true });
const row = (id: string, shape: StrikeSpec['shape'], damage: number, windup = 0, recover = 0, cooldown = 0, exempt = false): StrikeSpec => ({
  id: `strike.${id}`, shape, damage, windup, active: 0, recover, cooldown, range: Infinity, units: 'world',
  tags: exempt ? ['cover.exempt'] : [], weight: () => 1,
});
/** Authored goal/body clocks sample these rows; contact() adds no clock or random draw. */
export const NALATI_STRIKES = {
  wolf: strikeFromData(strike(NALATI_STRIKE_ROWS.wolf)),
  balbal: strikeFromData(strike(NALATI_STRIKE_ROWS.balbal)),
  arrow: strikeFromData(strike(NALATI_STRIKE_ROWS.arrow)),
  swipe: strikeFromData(strike(NALATI_STRIKE_ROWS.swipe)),
  pounce: strikeFromData(strike(NALATI_STRIKE_ROWS.pounce)),
  bite: strikeFromData(strike(NALATI_STRIKE_ROWS.bite)),
  stoop: strikeFromData(strike(NALATI_STRIKE_ROWS.stoop)),
  captain: strikeFromData(strike(NALATI_STRIKE_ROWS.captain)),
  stallion: strikeFromData(strike(NALATI_STRIKE_ROWS.stallion)),
  cuts: NALATI_STRIKE_ROWS.cuts.map(r => strikeFromData(strike(r))),
  sunburst: strikeFromData(strike(NALATI_STRIKE_ROWS.sunburst)),
  beam: strikeFromData(strike(NALATI_STRIKE_ROWS.beam)),
  sand: strikeFromData(strike(NALATI_STRIKE_ROWS.sand)),
  spear: strikeFromData(strike(NALATI_STRIKE_ROWS.spear)),
  whirl: strikeFromData(strike(NALATI_STRIKE_ROWS.whirl)),
  wind: strikeFromData(strike(NALATI_STRIKE_ROWS.wind)),
  chain: strikeFromData(strike(NALATI_STRIKE_ROWS.chain)),
  // Arena-wide contacts have intentionally unbounded shapes; the finite authored schema cannot express them.
  fire: row('titan.fire', point(Infinity), 4, 0, 7, 0.5, true),
  wall: row('titan.storm-wall', point(Infinity), 10, 0, 0, 1.2, true),
} satisfies Record<string, StrikeSpec | StrikeSpec[]>;
const contacts = new StrikeRunner();
export function sampleStrike(spec: StrikeSpec, actor: StrikeActor, target: Vector3, hit: () => void,
  options: Pick<StrikeContext, 'origin' | 'ringRadius' | 'airborne'> & { reach?: () => boolean; shape?: StrikeSpec['shape'] } = {}): boolean {
  return contacts.contact(options.shape === undefined ? spec : { ...spec, shape: options.shape }, {
    actor, target, ...options, canReach: options.reach ?? (() => true), hit,
  });
}
const noop = (): void => undefined;
/** Arena contact anchors share the same chest-to-player cover query as creature bodies. */
export function sampleArena(spec: StrikeSpec, origin: Vector3, target: Vector3, hit: () => void, physics: Parameters<typeof canReach>[2], options: Pick<StrikeContext, 'origin' | 'ringRadius' | 'airborne'> = {}): boolean {
  const anchor = { position: origin, scale: 1, yaw: 0, alive: true, dims: { bodyY: 1.2, bodyRadius: 0.1 },
    headWorld: (out: Vector3) => out.copy(origin).add(new Vector3(0, 1.2, 0)), startAttack: noop, cancelAttack: noop, setMotion: noop };
  return sampleStrike(spec, anchor, target, hit, { ...options, reach: () => canReach(anchor, target, physics) });
}
