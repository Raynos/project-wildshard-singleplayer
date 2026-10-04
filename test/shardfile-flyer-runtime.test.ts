// oxlint-disable-next-line import/no-nodejs-modules -- Load the committed physics binary through the engine-owned loader.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import type { PlatformSpawn, PlatformBrainSpec } from '../src/engine/ai/platform';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { StrikeSpec } from '../src/engine/ai/strikes';
import { installDeclaredBrains, type DeclaredBrainPorts } from '../src/game/shardfile/brainRuntime';
import { parseOrbitDiver, parsePatrolDiver, parseBurstFlyer } from '../src/game/shardfile/flyers';
import { SIM_LEVEL } from './fixtures/sim-level/level';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });
const orbit = parseOrbitDiver({ id: 'brain.orbit', kind: 'orbit-diver', strike: 'fixture.dive', home: { x: 0, z: 0, r: 12, y: 14 },
  circleSpeed: 8, hangAltitude: 9, stalkSpeed: 10, diveSpeed: 16, restSeconds: 6, noticeRadius: 40, giveUpRadius: 60,
  initialRestSeconds: 3, stalkMaxSeconds: 12, riseMargin: 2, targetHeight: 1.2, alignRadius: 3, alignTolerance: 1.6 });
const patrol = parsePatrolDiver({ id: 'brain.patrol', kind: 'patrol-diver', strike: 'fixture.swoop', home: { x: 0, z: 0 },
  glideAltitude: 14, glideSpeed: 9, circleRadius: 20, patrolRadius: 34, patrolAltitude: 22, noticeRadius: 55,
  diveFrom: 38, diveSpeed: 15, climbAltitude: 17, climbSeconds: 2.6, diveMaxSeconds: 4.5, restSeconds: 3,
  targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' });
const burst = parseBurstFlyer({ id: 'brain.burst', kind: 'burst-flyer', strike: 'fixture.burst', home: { x: 0, z: 0, r: 7, y: 3 },
  circleSpeed: 5, dartSpeed: 13, noticeRadius: 14, shoveSpeed: 7, liftSpeed: 2.5, targetHeight: 1.2 });
const pursue: PlatformBrainSpec = { id: 'brain.pursue', kind: 'pursue', awareRadius: 9, leashRadius: 18, speed: 1,
  returnSpeed: 1, stopDistance: 1, turnRate: 4, thinkDivisor: 6, attackCooldownTicks: 60, wanderRadius: 2, wanderEveryTicks: 120 };
const strike: StrikeSpec = { id: orbit.strike, shape: { kind: 'sphere', radius: 1.9 }, windup: 1.1,
  active: 1.1, recover: 0.6, cooldown: 5, range: 14, damage: 10, tags: ['creature.fixture'], units: 'world', weight: () => 1 };
const swoop: StrikeSpec = { ...strike, id: patrol.strike, shape: { kind: 'sphere', radius: 2.2 }, windup: 0.3,
  active: 0.4, recover: 0.5, cooldown: 2.5, range: 7, damage: 14 };
const contact: StrikeSpec = { ...strike, id: burst.strike, shape: { kind: 'sphere', radius: 1.4 }, windup: 0.7,
  active: 0.7, recover: 1.2, cooldown: 3.5, range: 9, damage: 6 };
const base = SIM_LEVEL.entities[0];
if (base === undefined) throw new Error('Missing fixture actor');
const policies = [orbit, patrol, burst, pursue];
const level = { ...SIM_LEVEL, entities: policies.map((policy, i) => ({ ...base, id: policy.id,
  at: { x: i * 4 - 4, y: i === 2 ? 3 : i === 3 ? 0 : 14, z: 4 },
  spec: i === 3 ? base.spec : { ...base.spec, flight: { altitude: 14, above: 'world' as const, climbRate: 6, diveRate: 20, lockRange: 32 } } })) };
const rows: PlatformSpawn[] = level.entities.map((entity, i) => ({ id: entity.id, species: 'boar', variant: 'boar',
  seed: entity.seed, scale: entity.scale, brain: policies[i]?.id ?? null, strike: null,
  at: [entity.at.x, entity.at.y, entity.at.z], yaw: entity.yaw }));
function ports(host: SimHost, trace: string[], dive = strike): DeclaredBrainPorts {
  const observation = (actor: AnimalSim, dt: number) => {
    trace.push(`observe:${actor.entityId}:${String(dt)}`);
    return { dt, player: host.player.position, calm: false, mayAttack: () => true, reach: () => true, claim: () => true,
      hurt: (damage: number) => { trace.push(`hit:${actor.entityId}:${String(damage)}`); },
      shove: (yaw: number, speed: number, lift: number) => { trace.push(`shove:${String(yaw)}:${String(speed)}:${String(lift)}`); },
      flight: { steer: (body: AnimalSim, yaw: number, speed: number, altitude: number, turn: number) => { body.fly(yaw, speed, altitude, turn); } } };
  };
  const recipe = (actor: AnimalSim, binding: StrikeSpec) => ({ strike: binding, observe: (dt: number) => observation(actor, dt),
    body: () => { trace.push(`body:${actor.entityId}`); } });
  return { orbitDiver: actor => recipe(actor, dive), patrolDiver: actor => recipe(actor, swoop), burstFlyer: actor => recipe(actor, contact) };
}
describe('mutable declared flying dispatch', () => {
  it('preserves pursuit and advances each flying body once per fixed tick with six-tick observations', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      expect(installDeclaredBrains(host, rows, policies, ports(host, trace)).size).toBe(4); expect(trace).toEqual([]);
      for (let tick = 0; tick < 12; tick++) host.step();
      for (const policy of [orbit, patrol, burst]) {
        expect(trace.filter(value => value === `body:${policy.id}`)).toHaveLength(12);
        expect(trace.filter(value => value === `observe:${policy.id}:0.1`)).toHaveLength(2);
        expect(trace.filter(value => value === `observe:${policy.id}:${String(1 / 60)}`)).toHaveLength(12);
        expect(host.entities.get(policy.id)?.snapshot().flight).not.toBeNull();
      }
      expect(host.entities.get(pursue.id)?.desiredSpeed).toBeGreaterThan(0);
    } finally { host.dispose(); }
  });
  it('rejects missing ports, wrong strike references and non-sphere recipes before callbacks or RNG/memory mutations', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const rng = host.rng.snapshot(), actors = [...host.entities.values()].map(actor => actor.snapshot());
      expect(() => installDeclaredBrains(host, rows, policies, {})).toThrow('port');
      expect(() => installDeclaredBrains(host, rows, policies, ports(host, trace, { ...strike, id: 'wrong' }))).toThrow('strike');
      expect(() => installDeclaredBrains(host, rows, policies, ports(host, trace, { ...strike, shape: { kind: 'arc', radius: 2, halfAngle: 1 } }))).toThrow('parameters');
      expect(host.adapters.size).toBe(0); expect(host.rng.snapshot()).toEqual(rng);
      expect([...host.entities.values()].map(actor => actor.snapshot())).toEqual(actors); expect(trace).toEqual([]);
    } finally { host.dispose(); }
  });
  it('refuses flight policies on ground-only actors before registering any callbacks', () => {
    const groundLevel = { ...level, entities: level.entities.map(entity => ({ ...entity, spec: base.spec })) };
    const host = createSimHost(groundLevel, { rapier }), trace: string[] = [];
    try {
      const rng = host.rng.snapshot(), actors = [...host.entities.values()].map(actor => actor.snapshot());
      expect(() => installDeclaredBrains(host, rows, policies, ports(host, trace))).toThrow('flight');
      expect(host.adapters.size).toBe(0); expect(trace).toEqual([]); expect(host.rng.snapshot()).toEqual(rng);
      expect([...host.entities.values()].map(actor => actor.snapshot())).toEqual(actors);
    } finally { host.dispose(); }
  });
  it('rebinds native flight without executing restoration and reproduces the real-physics 10,000-tick suffix', () => {
    const host = createSimHost(level, { rapier }), original: string[] = [], suffix: string[] = [];
    let restored: SimHost | undefined;
    try {
      installDeclaredBrains(host, rows, policies, ports(host, original));
      for (let tick = 0; tick < 250; tick++) host.step();
      restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), fresh => { installDeclaredBrains(fresh, rows, policies, ports(fresh, suffix)); });
      expect(suffix).toEqual([]); expect(restored.rng.snapshot()).toEqual(host.rng.snapshot()); original.length = 0;
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expect(original.some(value => value.startsWith('hit:'))).toBe(true);
      expect(suffix).toEqual(original); expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
});
