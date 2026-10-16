import { describe, expect, it } from 'vitest';
import type { StrikeContext, StrikeSpec } from '../src/engine/ai/strikes';
import { PINE_LANES, PINE_STRIKES } from '../src/shards/pine-hollow/combat/strikes';

// The retired TS builders (combat/strikes.ts before sp-o267), kept here as the law the data rows must reproduce.
const lane = (id: string, windup: number, width: number, speed: number, overshoot: number, damage: number, recover: number, range: number): StrikeSpec => ({
  id, shape: { kind: 'lane', width, length: 0 }, windup, active: 0, recover, cooldown: 0, range, damage,
  tags: ['creature.charge'], weight: () => 1, motion: { speed, track: 'lead', overshoot, skid: recover },
});
const nonlane = (id: string, shape: StrikeSpec['shape'], windup: number, recover: number, cooldown: number, damage: number, exempt = false): StrikeSpec => ({
  id, shape, windup, active: 0, recover, cooldown, range: Infinity, damage,
  tags: exempt ? ['cover.exempt'] : ['cover.checked'], weight: () => 1, units: 'world',
});
const LEGACY_LANES = {
  ironhide: lane('strike.ironhide.charge', 0.9, 2.4, 12.5, 7, 30, 1.1, 1.7),
  blackpaw: lane('strike.blackpaw.charge', 0.75, 2.6, 10.5, 5, 28, 1.2, 1.6),
  imperial: lane('strike.imperial-bull.charge', 1, 2.8, 11, 8, 34, 1.3, 1.8),
  rival: lane('strike.imperial-bull.rival', 0.9, 2.4, 9.5, 6, 18, 1.4, 1.7),
  king: lane('strike.antler-king.last-light', 1.1, 5.2, 13, 10, 32, 1.6, 2),
  thrall: lane('strike.antler-king.thrall', 0.7, 2.4, 9, 5, 14, 1.2, 1.7),
};
const LEGACY_STRIKES = {
  swipe: { ...nonlane('strike.blackpaw.swipe', { kind: 'arc', radius: 3.8 / 1.65, halfAngle: 1.1 }, 0.55, 0.65, 0, 22), units: 'actor' },
  roar: nonlane('strike.blackpaw.roar', { kind: 'point', radius: 8 }, 1.1, 0, 10, 12, true),
  roarPhase2: nonlane('strike.blackpaw.roar.phase2', { kind: 'point', radius: 11 }, 1.1, 0, 5.5, 12, true),
  sweep: { ...nonlane('strike.antler-king.sweep', { kind: 'arc', radius: 4, halfAngle: 1.31 }, 0.9, 0, 5, 24),
    alternatives: [{ kind: 'arc', radius: 7.1, halfAngle: 0.52, yawOffset: -0.26 }] },
  roots: { ...nonlane('strike.antler-king.roots', { kind: 'ring', inner: -0.9, outer: 0.9 }, 1, 0, 0, 20, true),
    motion: { speed: 10.5 }, eligibility: { jumpDodges: true } },
  lantern: nonlane('strike.antler-king.lantern', { kind: 'point', radius: 3, exclusive: true }, 0.75, 0, 0.8, 9, true),
} satisfies Record<string, StrikeSpec>;

const actor = { position: { x: 0, y: 0, z: 0 }, alive: true, scale: 1, yaw: 0,
  startAttack: (): void => undefined, cancelAttack: (): void => undefined, setMotion: (): void => undefined };
const contexts: StrikeContext[] = [[0, 0], [3, 4], [40, -2]].map(([x = 0, z = 0]) => ({ actor, target: { x, y: 0, z }, canReach: () => true, hit: () => undefined }));
const plain = (spec: StrikeSpec): unknown => { const { weight: _weight, ...rest } = spec; return rest; };

describe('Pine strike rows (data/strikes.ts through strikeFromData)', () => {
  it('reproduce every retired lane and contact builder, weight included', () => {
    for (const [legacy, rows] of [[LEGACY_LANES, PINE_LANES], [LEGACY_STRIKES, PINE_STRIKES]] as const) {
      expect(Object.keys(rows)).toEqual(Object.keys(legacy));
      for (const [key, old] of Object.entries(legacy)) {
        const now: StrikeSpec | undefined = Object.entries(rows).find(([name]) => name === key)?.[1];
        expect(now).toBeDefined();
        if (now === undefined) continue;
        expect(plain(now)).toEqual(plain(old));
        for (const ctx of contexts) expect(now.weight(ctx)).toBe(old.weight(ctx));
      }
    }
  });
});
