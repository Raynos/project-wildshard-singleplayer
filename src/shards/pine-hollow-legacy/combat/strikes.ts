import { StrikeRunner, type StrikeActor, type StrikeSpec } from '@wildshard/engine/ai/strikes';

interface BrainPoint { x: number; y: number; z: number }

const lane = (id: string, windup: number, width: number, speed: number, overshoot: number, damage: number, recover: number, range: number): StrikeSpec => ({
  id, shape: { kind: 'lane', width, length: 0 }, windup, active: 0, recover, cooldown: 0, range, damage,
  tags: ['creature.charge'], weight: () => 1,
  motion: { speed, track: 'lead', overshoot, skid: recover },
});
/** Authored lane rows; phase-dependent windups/speed multipliers remain the fight's policy. */
export const PINE_LANES = {
  ironhide: lane('strike.ironhide.charge', 0.9, 2.4, 12.5, 7, 30, 1.1, 1.7),
  blackpaw: lane('strike.blackpaw.charge', 0.75, 2.6, 10.5, 5, 28, 1.2, 1.6),
  imperial: lane('strike.imperial-bull.charge', 1, 2.8, 11, 8, 34, 1.3, 1.8),
  rival: lane('strike.imperial-bull.rival', 0.9, 2.4, 9.5, 6, 18, 1.4, 1.7),
  king: lane('strike.antler-king.last-light', 1.1, 5.2, 13, 10, 32, 1.6, 2),
  thrall: lane('strike.antler-king.thrall', 0.7, 2.4, 9, 5, 14, 1.2, 1.7),
};

const nonlane = (id: string, shape: StrikeSpec['shape'], windup: number, recover: number, cooldown: number, damage: number, exempt = false): StrikeSpec => ({
  id, shape, windup, active: 0, recover, cooldown, range: Infinity, damage,
  tags: exempt ? ['cover.exempt'] : ['cover.checked'], weight: () => 1, units: 'world',
});
/** Measured contacts retain the authored goal clocks and cover exceptions. */
export const PINE_STRIKES = {
  swipe: { ...nonlane('strike.blackpaw.swipe', { kind: 'arc', radius: 3.8 / 1.65, halfAngle: 1.1 }, 0.55, 0.65, 0, 22), units: 'actor' } satisfies StrikeSpec,
  roar: nonlane('strike.blackpaw.roar', { kind: 'point', radius: 8 }, 1.1, 0, 10, 12, true),
  roarPhase2: nonlane('strike.blackpaw.roar.phase2', { kind: 'point', radius: 11 }, 1.1, 0, 5.5, 12, true),
  sweep: { ...nonlane('strike.antler-king.sweep', { kind: 'arc', radius: 4, halfAngle: 1.31 }, 0.9, 0, 5, 24),
    alternatives: [{ kind: 'arc', radius: 7.1, halfAngle: 0.52, yawOffset: -0.26 }] } satisfies StrikeSpec,
  roots: { ...nonlane('strike.antler-king.roots', { kind: 'ring', inner: -0.9, outer: 0.9 }, 1, 0, 0, 20, true),
    motion: { speed: 10.5 }, eligibility: { jumpDodges: true } } satisfies StrikeSpec,
  lantern: nonlane('strike.antler-king.lantern', { kind: 'point', radius: 3, exclusive: true }, 0.75, 0, 0.8, 9, true),
};
const contact = new StrikeRunner();
export function pineContact(actor: StrikeActor, target: BrainPoint, spec: StrikeSpec, hit: (damage: number) => void,
  reach: () => boolean, options: { origin?: BrainPoint; ringRadius?: number; airborne?: boolean } = {}): boolean {
  return contact.contact(spec, { actor, target, ...options, canReach: reach, hit: (row) => { hit(row.damage); } });
}
