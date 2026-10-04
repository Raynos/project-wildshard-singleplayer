import { canReach } from '@wildshard/engine/ai/reach';
import { StrikeRunner, type StrikeActor, type StrikeContext, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Vector3 } from 'three';

const point = (radius: number): StrikeSpec['shape'] => ({ kind: 'point', radius, exclusive: true });
const row = (id: string, shape: StrikeSpec['shape'], damage: number, windup = 0, recover = 0, cooldown = 0, exempt = false): StrikeSpec => ({
  id: `strike.${id}`, shape, damage, windup, active: 0, recover, cooldown, range: Infinity, units: 'world',
  tags: exempt ? ['cover.exempt'] : [], weight: () => 1,
});
/** Authored goal/body clocks sample these rows; contact() adds no clock or random draw. */
export const NALATI_STRIKES = {
  wolf: row('wolf.lunge', point(1.65), 12, 0.4, 1.1),
  balbal: row('balbal.slam', { kind: 'wedge', length: 3.5, halfAngle: 0.96 }, 30, 2.9 * 0.55, 2.9 * 0.45, 1.4),
  arrow: { ...row('ghost-rider.arrow', point(0.5), 10), motion: { speed: 34 } },
  swipe: row('aqbars.swipe', point(2.9), 14, 0.45, 0.2, 1.4),
  pounce: row('aqbars.pounce', point(1.9), 35, 1, 1.5),
  bite: row('kokbori.bite', point(3.2), 22, 0.9 * 0.7, 0.9 * 0.3, 1.8),
  stoop: row('qyran.stoop', point(2.4), 30, 1.2),
  captain: row('qara-batyr.charge', point(1.9), 38, 1.3),
  stallion: { ...row('horse.stallion', point(1.9), 25, 0, 0, 5), motion: { speed: 12 } },
  cuts: [14, 14, 22, 22].map((damage, i) => row(`golden-king.cut${i}`, { kind: 'arc', radius: i < 2 ? 3 : 3.3, halfAngle: i < 2 ? 0.95 : 1.35 }, damage, 0.95 * 0.62)),
  sunburst: { ...row('golden-king.sunburst', { kind: 'ring', inner: -0.5, outer: 0.5 }, 25, 0, 0, 0, true), motion: { speed: 8.5 } },
  beam: row('golden-king.beam', point(1.15), 15, 0, 0, 1, true),
  sand: row('golden-king.sand', point(0.55), 4, 1, 6, 0, true),
  spear: row('titan.spear', point(4.5), 40, 1.5, 3),
  whirl: row('titan.whirl', point(3.2), 15),
  wind: row('titan.wind-charge', point(3.4), 30, 1.2, 4),
  chain: row('titan.chain', point(3), 18, 0.6, 0, 0, true),
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
