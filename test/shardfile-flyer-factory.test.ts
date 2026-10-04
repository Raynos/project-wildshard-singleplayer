// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the full loader with the production physics binary.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import type { SimHost } from '../src/engine/sim';
import type { PlatformBrainSpec } from '../src/engine/ai/platform';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, shardfileRules, type Shardfile } from '../src/game/shardfile/schema';
import { createShardfileSim, bindShardfileSim, type ShardfileSimPorts } from '../src/game/shardfile/simulation';
import { parseOrbitDiver, parsePatrolDiver, parseBurstFlyer } from '../src/game/shardfile/flyers';
import { parseRows, scoredStrikes, speciesResolver } from '../src/game/shardfile/rows';
import template from '../src/shards/_template/shard.config';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
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

function source(): Shardfile {
  const s = emptyShardfile({ slug: 'flyer-factory', name: 'Flying factory', author: 'Test', revision: 1, seed: 435 });
  const species = template.rows.species.find(row => row.id === 'boar');
  if (species === undefined) throw new Error('Missing species fixture');
  s.rows.species = [species, { ...species, id: 'flying-boar', flight: { altitude: 14, above: 'world', climbRate: 6, diveRate: 20, lockRange: 32 } }];
  s.rows.strikes = [orbit, patrol, burst].map((brain, index) => ({ id: brain.strike, shape: { kind: 'sphere', radius: [1.9, 2.2, 1.4][index] ?? 1 },
    windup: [1.1, 0.3, 0.7][index] ?? 1, active: [1.1, 0.4, 0.7][index] ?? 1, recover: 0.6,
    cooldown: 3, range: 14, damage: 10, tags: ['creature.fixture'], weight: 1, speed: 0 }));
  s.creatures.brains = [orbit, patrol, burst, pursue];
  s.creatures.spawns = s.creatures.brains.map((brain, i) => ({ id: `actor.${i}`, brain: brain.id,
    species: i === 3 ? 'boar' : 'flying-boar', variant: 'greyback', seed: i, scale: 1, strike: null,
    at: [i === 3 ? 4 : i * 4 - 4, i === 2 ? 3 : i === 3 ? 0 : 14, i === 3 ? -4 : 4], yaw: 0 }));
  return parseShardfile(s);
}
function options(s: Shardfile, trace: string[], prepared?: (host: SimHost) => void): ShardfileSimPorts {
  const strikes = new Map(scoredStrikes(s.rows).map(row => [row.id, row]));
  const recipe = (actor: AnimalSim, id: string, host: SimHost) => {
    prepared?.(host);
    const strike = strikes.get(id); if (strike === undefined) throw new Error('Missing strike fixture');
    return { strike, observe: (dt: number) => {
      trace.push(`observe:${actor.entityId}:${dt}`);
      return { dt, player: host.player.position, calm: false, mayAttack: () => true, reach: () => true, claim: () => true,
        hurt: (damage: number) => { trace.push(`hit:${actor.entityId}:${damage}`); },
        shove: (yaw: number, speed: number, lift: number) => { trace.push(`shove:${yaw}:${speed}:${lift}`); },
        flight: { steer: (body: AnimalSim, yaw: number, speed: number, altitude: number, turn: number) => { body.fly(yaw, speed, altitude, turn); } } };
    }, body: () => { trace.push(`body:${actor.entityId}`); } };
  };
  return { rapier, brains: {
    orbitDiver: (actor, brain, host) => recipe(actor, brain.strike, host),
    patrolDiver: (actor, brain, host) => recipe(actor, brain.strike, host),
    burstFlyer: (actor, brain, host) => recipe(actor, brain.strike, host),
  } };
}
it('admits explicit flight motors and refuses absent flight, missing/non-sphere strikes and homes outside the cell', () => {
  const s = source(), resolver = speciesResolver(s.rows);
  expect(resolver('boar', 'greyback').flight).toBeUndefined();
  const resolved = resolver('flying-boar', 'greyback'); expect(resolved.flight).toEqual(s.rows.species[1]?.flight);
  if (resolved.flight === undefined) throw new Error('Missing flight');
  resolved.flight.altitude = 1; expect(s.rows.species[1]?.flight?.altitude).toBe(14);
  for (const policy of [orbit, patrol, burst]) {
    const missing = structuredClone(s); missing.rows.strikes = missing.rows.strikes.filter(row => row.id !== policy.strike);
    expect(() => parseShardfile(missing)).toThrow('shardfile semantic rules'); expect(shardfileRules(missing)).toContain('declared flyer sphere strike');
    const wrong = structuredClone(s), strike = wrong.rows.strikes.find(row => row.id === policy.strike);
    if (strike === undefined) throw new Error('Missing strike'); strike.shape = { kind: 'arc', radius: 2, halfAngle: 1 };
    expect(() => parseShardfile(wrong)).toThrow('shardfile semantic rules'); expect(shardfileRules(wrong)).toContain('declared flyer sphere strike');
  }
  const ground = structuredClone(s); ground.creatures.spawns[0] = { ...s.creatures.spawns[0], id: 'actor.0', brain: orbit.id, species: 'boar', variant: 'greyback', strike: null, seed: 0, scale: 1, at: [0, 14, 4], yaw: 0 };
  expect(() => parseShardfile(ground)).toThrow('shardfile semantic rules'); expect(shardfileRules(ground)).toContain('declared flyer species flight');
  expect(() => parseShardfile({ ...s, creatures: { ...s.creatures, brains: [{ ...orbit, home: { ...orbit.home, x: 251 } }, patrol, burst, pursue] } })).toThrow();
  for (const flight of [{ altitude: 14, climbRate: 0, diveRate: 20 }, { altitude: 14, climbRate: 6, diveRate: 31 }, { altitude: 14, climbRate: 6, diveRate: 20, bank: Math.PI / 2 }]) {
    expect(() => parseRows({ ...s.rows, species: [{ ...s.rows.species[0], flight }] })).toThrow();
  }
});
it('boots all flying policies with pursuit and runs one body/act per tick with divisor-scheduled decisions', () => {
  const s = source(), trace: string[] = [], sim = createShardfileSim(s, new Map(), options(s, trace));
  try {
    expect(trace).toEqual([]);
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    for (let i = 0; i < 3; i++) {
      expect(sim.host.entities.get(`actor.${i}`)?.snapshot().flight).not.toBeNull();
      expect(trace.filter(row => row === `body:actor.${i}`)).toHaveLength(12);
      expect(trace.filter(row => row === `observe:actor.${i}:0.1`)).toHaveLength(2);
      expect(trace.filter(row => row === `observe:actor.${i}:${1 / 60}`)).toHaveLength(12);
    }
    expect(sim.host.entities.get('actor.3')?.desiredSpeed).toBeGreaterThan(0);
  } finally { sim.dispose(); }
});
it('refuses missing or mismatched trusted recipes before callbacks, RNG draws or actor mutation', () => {
  const s = source(), trace: string[] = [];
  expect(() => createShardfileSim(s, new Map(), { rapier })).toThrow('Missing native brain port');
  let host: SimHost | undefined, before: ReturnType<typeof snapshotSimHost> | undefined;
  const ports = options(s, trace, prepared => { host = prepared; before ??= snapshotSimHost(prepared); });
  const recipe = ports.brains?.burstFlyer;
  if (recipe === undefined || ports.brains === undefined) throw new Error('Missing recipe');
  expect(() => createShardfileSim(s, new Map(), { ...ports, brains: { ...ports.brains, burstFlyer: (...args: Parameters<typeof recipe>) => {
    const native = recipe(...args); return { ...native, strike: { ...native.strike, id: 'wrong.strike' } };
  } } })).toThrow('Unresolved declared flyer strike');
  if (host === undefined || before === undefined) throw new Error('Missing prepared host');
  expect(trace).toEqual([]); expect(host.adapters.size).toBe(0); expect(host.rng.snapshot()).toEqual(before.rng);
  expect([...host.entities.values()].map(actor => actor.snapshot())).toEqual(before.entities.map(row => row.state));
});
it('restores without observations and replays flight motors, policy clocks and contacts for 10,000 real-physics ticks', () => {
  const s = source(), original: string[] = [], suffix: string[] = [], assets = new Map<string, Uint8Array>();
  const sim = createShardfileSim(s, assets, options(s, original)); let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 250; tick++) sim.host.step();
    restored = restoreSimHost(sim.host.level, { rapier }, snapshotSimHost(sim.host), fresh => {
      const rng = fresh.rng.snapshot(); bindShardfileSim(fresh, s, assets, { ...options(s, suffix), restoring: true }); expect(fresh.rng.snapshot()).toEqual(rng);
    });
    expect(suffix).toEqual([]); original.length = 0;
    for (let tick = 0; tick < 10000; tick++) { sim.host.step(); restored.step(); }
    expect(original.some(row => row.startsWith('hit:'))).toBe(true);
    expect(suffix).toEqual(original); expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(sim.host));
  } finally { sim.dispose(); restored?.dispose(); }
});
