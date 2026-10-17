import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner, type StrikeActor, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Vector3 } from 'three';
import { strike } from '@wildshard/sdk/species';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import rows from '../data/strikeProfiles.generated.json' with { type: 'json' };

const point = (radius: number): StrikeSpec['shape'] => ({ kind: 'point', radius, exclusive: true });
const row = (id: string, shape: StrikeSpec['shape'], damage: number, windup = 0, recover = 0, cooldown = 0, exempt = false): StrikeSpec => ({
  id: `strike.${id}`, shape, damage, windup, active: 0, recover, cooldown, range: Infinity, units: 'world',
  tags: exempt ? ['cover.exempt'] : [], weight: () => 1,
});
/** Authored goal/body clocks sample these rows; contact() adds no clock or random draw. */
export const NALATI_STRIKES = {
  wolf: strikeFromData(strike(rows.wolf)),
  balbal: strikeFromData(strike(rows.balbal)),
  arrow: strikeFromData(strike(rows.arrow)),
  swipe: strikeFromData(strike(rows.swipe)),
  pounce: strikeFromData(strike(rows.pounce)),
  bite: strikeFromData(strike(rows.bite)),
  stoop: strikeFromData(strike(rows.stoop)),
  captain: strikeFromData(strike(rows.captain)),
  stallion: strikeFromData(strike(rows.stallion)),
  cuts: rows.cuts.map(r => strikeFromData(strike(r))),
  sunburst: strikeFromData(strike(rows.sunburst)),
  beam: strikeFromData(strike(rows.beam)),
  sand: strikeFromData(strike(rows.sand)),
  spear: strikeFromData(strike(rows.spear)),
  whirl: strikeFromData(strike(rows.whirl)),
  wind: strikeFromData(strike(rows.wind)),
  chain: strikeFromData(strike(rows.chain)),
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
