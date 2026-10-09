// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed Rapier binary through its physics-owned loader.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import type { PlatformSpawn, PlatformBrainSpec } from '../src/engine/ai/platform';
import type { StrikeSpec } from '../src/engine/ai/strikes';
import { installDeclaredBrains, type DeclaredBrainPorts } from '../src/game/shardfile/brainRuntime';
import { parseRamGrazer, parseChallengeGrazer } from '../src/game/shardfile/grazers';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });
const ram = parseRamGrazer({ id: 'brain.ram', kind: 'ram-grazer', strike: 'fixture.ram', grazeSpeed: 1.2,
  ramSpeed: 7.5, noticeRadius: 9, rimMargin: 2.5, fallDrop: 1.5, levelTolerance: 2.5,
  threatSpeed: 1.6, wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 });
const strike: StrikeSpec = { id: ram.strike, shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8,
  active: 0.5, recover: 0.9, cooldown: 3, range: 5, damage: 12, tags: ['creature.boar'], weight: () => 1 };
const challenge = parseChallengeGrazer({ id: 'brain.challenge', kind: 'challenge-grazer', charge: 'fixture.charge', close: 'fixture.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' });
const charge: StrikeSpec = { ...strike, id: challenge.charge, shape: { kind: 'lane', length: 13, width: 2.2 },
  windup: 1.1, active: 1.2, recover: 1.8, cooldown: 3.5, range: 17, damage: 22, motion: { speed: 11, overshoot: 3 } };
const close: StrikeSpec = { ...strike, id: challenge.close, shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 },
  windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.6, range: 3.2 };
const pursue: PlatformBrainSpec = { id: 'brain.pursue', kind: 'pursue', awareRadius: 9, leashRadius: 18, speed: 1,
  returnSpeed: 1, stopDistance: 1, turnRate: 4, thinkDivisor: 6, attackCooldownTicks: 60, wanderRadius: 2, wanderEveryTicks: 120 };
const base = SIM_LEVEL.entities[0];
if (base === undefined) throw new Error('Missing fixture actor');
const policies = [ram, pursue, challenge];
const level = { ...SIM_LEVEL, entities: [base, { ...base, id: 'pursuer', at: { x: 8, y: 0, z: 4 } }, { ...base, id: 'challenger', at: { x: -4, y: 0, z: 4 } }] };
const rows: PlatformSpawn[] = level.entities.map((entity, i) => ({ id: entity.id, species: 'boar', variant: 'boar',
  seed: entity.seed, scale: entity.scale, brain: policies[i]?.id ?? null, strike: null,
  at: [entity.at.x, entity.at.y, entity.at.z], yaw: entity.yaw }));
function ports(host: SimHost, trace: string[], spec = strike): DeclaredBrainPorts {
  return { ramGrazer: actor => ({ strike: spec, observe: dt => {
    trace.push(`observe:${String(dt)}`);
    return { dt, home: { x: 0, z: 0, y: 0, r: 12 }, player: host.player.position, calm: false,
      rng: host.rng.stream('ai'), reach: () => true, claim: () => true, hurt: damage => { trace.push(`hit:${String(damage)}`); } };
  }, body: () => { trace.push(`body:${actor.entityId}`); } }), challengeGrazer: actor => ({ charge, close, observe: dt => {
    trace.push(`challenge:${String(dt)}`);
    return { dt, t: host.clock.now, phaseOffset: 0, player: host.player.position, calm: false,
      reach: () => true, claim: () => true, hurt: damage => { trace.push(`challenge-hit:${String(damage)}`); },
      steer: (body, yaw, speed, turn) => { body.setMotion(yaw, speed, turn); } };
  }, body: () => { trace.push(`body:${actor.entityId}`); } }) };
}
describe('mutable declared grazer dispatch', () => {
  it('keeps pursuit and runs exactly one ram body per tick with independent six-tick decisions', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      expect(installDeclaredBrains(host, rows, policies, ports(host, trace)).size).toBe(3);
      expect(trace).toEqual([]);
      for (let tick = 0; tick < 12; tick++) host.step();
      expect(trace.filter(value => value === `body:${base.id}`)).toHaveLength(12);
      expect(trace.filter(value => value === 'body:challenger')).toHaveLength(12);
      expect(trace.filter(value => value === 'observe:0.1')).toHaveLength(2);
      expect(trace.filter(value => value === `observe:${String(1 / 60)}`)).toHaveLength(12);
      expect(trace.filter(value => value === 'challenge:0.1')).toHaveLength(2);
      expect(trace.filter(value => value === `challenge:${String(1 / 60)}`)).toHaveLength(12);
      expect(host.entities.get('pursuer')?.desiredSpeed).toBeGreaterThan(0);
    } finally { host.dispose(); }
  });
  it('refuses a missing port or mismatched strike before callbacks, random draws or actor memory writes', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const rng = host.rng.snapshot(), actors = [...host.entities.values()].map(actor => actor.snapshot());
      expect(() => installDeclaredBrains(host, rows, policies, {})).toThrow('port');
      expect(() => installDeclaredBrains(host, rows, policies, ports(host, trace, { ...strike, id: 'wrong' }))).toThrow('strike');
      const native = ports(host, trace), recipe = native.challengeGrazer;
      if (recipe === undefined) throw new Error('Missing fixture recipe');
      expect(() => installDeclaredBrains(host, rows, policies, { ...native, challengeGrazer: (actor, data, owner) => ({
        ...recipe(actor, data, owner), close: { ...close, id: charge.id },
      }) })).toThrow('strikes');
      expect(host.adapters.size).toBe(0); expect(host.rng.snapshot()).toEqual(rng);
      expect([...host.entities.values()].map(actor => actor.snapshot())).toEqual(actors);
      expect(trace).toEqual([]);
    } finally { host.dispose(); }
  });
  it('restores the mutable strike/policy state and reproduces a real-physics 10,000-tick suffix exactly', () => {
    const host = createSimHost(level, { rapier }), original: string[] = [], suffix: string[] = [];
    let restored: SimHost | undefined;
    try {
      installDeclaredBrains(host, rows, policies, ports(host, original));
      for (let tick = 0; tick < 80; tick++) host.step();
      const before = snapshotSimHost(host);
      restored = restoreSimHost(level, { rapier }, before, fresh => { installDeclaredBrains(fresh, rows, policies, ports(fresh, suffix)); });
      expect(suffix).toEqual([]); expect(restored.rng.snapshot()).toEqual(host.rng.snapshot()); original.length = 0;
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
});
