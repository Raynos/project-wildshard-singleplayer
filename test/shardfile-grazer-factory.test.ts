import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the production physics binary with the complete declared loader.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '@wildshard/sdk/author';
import { loadRapier } from '../src/engine/physics/rapier';
import type { SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim, type ShardfileSimPorts } from '../src/game/shardfile/simulation';
import { parseShardfile, shardfileRules, type Shardfile } from '../src/game/shardfile/schema';
import { parseRamGrazer, parseChallengeGrazer } from '../src/game/shardfile/grazers';
import { scoredStrikes } from '../src/game/shardfile/rows';
import template from '../src/shards/_template/shard.config';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
const ram = parseRamGrazer({ id: 'brain.ram', kind: 'ram-grazer', strike: 'fixture.ram', grazeSpeed: 1.2,
  ramSpeed: 7.5, noticeRadius: 9, rimMargin: 2.5, fallDrop: 1.5, levelTolerance: 2.5,
  threatSpeed: 1.6, wanderMinSeconds: 2, wanderMaxSeconds: 5, rampRate: 4 });
const challenge = parseChallengeGrazer({ id: 'brain.challenge', kind: 'challenge-grazer', charge: 'fixture.charge', close: 'fixture.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' });
function source(): Shardfile {
  const s = emptyShardfile({ slug: 'grazer-factory', name: 'Grazer factory', author: 'Test', revision: 1, seed: 435 });
  const pursue = template.creatures.brains.find(brain => brain.kind === 'pursue');
  if (pursue === undefined) throw new Error('Missing pursuit fixture');
  s.rows.species = template.rows.species;
  s.rows.strikes = [
    { id: ram.strike, shape: { kind: 'lane', length: 4, width: 1.4 }, windup: 0.8, active: 0.5, recover: 0.9,
      cooldown: 3, range: 5, damage: 12, tags: ['creature.boar'], weight: 1, speed: 7.5 },
    { id: challenge.charge, shape: { kind: 'lane', length: 13, width: 2.2 }, windup: 1.1, active: 1.2, recover: 1.8,
      cooldown: 3.5, range: 17, damage: 22, tags: ['creature.boar'], weight: 2, speed: 11 },
    { id: challenge.close, shape: { kind: 'arc', radius: 3.4, halfAngle: 0.9 }, windup: 0.6, active: 0.2, recover: 0.8,
      cooldown: 1.6, range: 3.2, damage: 12, tags: ['creature.boar'], weight: 1, speed: 0 },
  ];
  s.creatures.brains = [ram, pursue, challenge];
  s.creatures.spawns = s.creatures.brains.map((brain, index) => ({ id: `actor.${index}`, brain: brain.id,
    species: 'boar', variant: 'greyback', strike: null, seed: index, scale: 1, at: [index * 4, 0, 2], yaw: 0 }));
  return parseShardfile(s);
}
function options(s: Shardfile, trace: string[], prepared?: (host: SimHost) => void): ShardfileSimPorts {
  const strikes = new Map(scoredStrikes(s.rows).map(strike => [strike.id, strike]));
  const named = (id: string) => { const strike = strikes.get(id); if (strike === undefined) throw new Error('Missing fixture strike'); return strike; };
  return { rapier, brains: {
    ramGrazer: (actor, declaration, host) => {
      prepared?.(host);
      return { strike: named(declaration.strike), observe: dt => {
        trace.push(`ram.observe:${dt}`);
        return { dt, player: host.player.position, calm: false, rng: host.rng.stream('ai'), home: { x: 0, z: 2, y: 0, r: 12 },
          reach: () => true, claim: () => true, hurt: damage => { trace.push(`ram.hit:${damage}`); } };
      }, body: () => { trace.push(`body:${actor.entityId}`); } };
    },
    challengeGrazer: (actor, declaration, host) => ({ charge: named(declaration.charge), close: named(declaration.close), observe: dt => {
      trace.push(`challenge.observe:${dt}`);
      return { dt, t: host.clock.now, phaseOffset: 0, player: host.player.position, calm: false, reach: () => true, claim: () => true,
        hurt: damage => { trace.push(`challenge.hit:${damage}`); }, steer: (body, yaw, speed, turn) => { body.setMotion(yaw, speed, turn); } };
    }, body: () => { trace.push(`body:${actor.entityId}`); } }),
  } };
}
it('admits both grazer families and refuses missing or incompatible named strike rows before boot', () => {
  const s = source();
  expect(s.creatures.brains.map(brain => brain.kind)).toEqual(['ram-grazer', 'pursue', 'challenge-grazer']);
  const { thinkDivisor: _ramCadence, ...ramDefault } = ram, { thinkDivisor: _challengeCadence, ...challengeDefault } = challenge;
  expect(parseShardfile({ ...s, creatures: { ...s.creatures, brains: [ramDefault, challengeDefault], spawns: [] } }).creatures.brains.map(brain => brain.thinkDivisor)).toEqual([6, 6]);
  for (const id of [ram.strike, challenge.charge, challenge.close]) {
    const missing = { ...s, rows: { ...s.rows, strikes: s.rows.strikes.filter(strike => strike.id !== id) } };
    expect(() => parseShardfile(missing)).toThrow(); expect(shardfileRules(missing).some(rule => rule.includes('grazer'))).toBe(true);
  }
  const invalid = structuredClone(s), charge = invalid.rows.strikes.find(strike => strike.id === challenge.charge), close = invalid.rows.strikes.find(strike => strike.id === challenge.close);
  if (charge === undefined || close === undefined) throw new Error('Missing challenge fixture');
  charge.shape = { kind: 'arc', radius: 4, halfAngle: 1 }; close.shape = { kind: 'lane', length: 4, width: 1 };
  expect(() => parseShardfile(invalid)).toThrow();
  const zero = structuredClone(s), ramStrike = zero.rows.strikes.find(strike => strike.id === ram.strike);
  if (ramStrike === undefined) throw new Error('Missing ram fixture');
  ramStrike.windup = 0; expect(() => parseShardfile(zero)).toThrow();
});
it('uses the existing full-factory native ports for one body/act per tick and divisor-scheduled decisions', () => {
  const s = source(), trace: string[] = [], sim = createShardfileSim(s, new Map(), options(s, trace));
  try {
    expect(trace).toEqual([]); expect(sim.host.adapters.has('brain.actor.0')).toBe(true); expect(sim.host.adapters.has('brain.actor.2')).toBe(true);
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    for (const [name, id] of [['ram', 'actor.0'], ['challenge', 'actor.2']]) {
      expect(trace.filter(row => row === `${name}.observe:0.1`)).toHaveLength(2);
      expect(trace.filter(row => row === `${name}.observe:${1 / 60}`)).toHaveLength(12);
      expect(trace.filter(row => row === `body:${id}`)).toHaveLength(12);
    }
    expect(sim.host.entities.get('actor.1')?.desiredSpeed).toBeGreaterThan(0);
  } finally { sim.dispose(); }
});
it('refuses absent recipes or mismatched trusted strike identities before callbacks, RNG or actor memory changes', () => {
  const s = source(), trace: string[] = [];
  expect(() => createShardfileSim(s, new Map(), { rapier })).toThrow('Missing native brain port');
  let preparedHost: SimHost | undefined, before: ReturnType<typeof snapshotSimHost> | undefined;
  const ports = options(s, trace, host => { preparedHost = host; before = snapshotSimHost(host); });
  const recipe = ports.brains?.challengeGrazer;
  if (recipe === undefined || ports.brains === undefined) throw new Error('Missing fixture recipe');
  const wrong = { ...ports, brains: { ...ports.brains, challengeGrazer: (...args: Parameters<typeof recipe>) => {
    const native = recipe(...args); return { ...native, close: { ...native.close, id: 'wrong.strike' } };
  } } };
  expect(() => createShardfileSim(s, new Map(), wrong)).toThrow('Unresolved declared grazer strikes');
  expect(preparedHost?.rng.snapshot()).toEqual(before?.rng);
  expect(preparedHost?.adapters.size).toBe(0); expect(trace).toEqual([]);
  if (preparedHost === undefined || before === undefined) throw new Error('Missing prepared host');
  expect([...preparedHost.entities.values()].map(actor => actor.snapshot())).toEqual(before.entities.map(row => row.state));
});
it('restores mutable strike and policy clocks without observations and replays the full 10,000-tick suffix exactly', () => {
  const s = source(), assets = new Map<string, Uint8Array>(), original: string[] = [], suffix: string[] = [];
  const sim = createShardfileSim(s, assets, options(s, original));
  let restored: SimHost | undefined;
  try {
    const initial = sim.host.adapters.get('brain.actor.2')?.snapshot();
    for (let tick = 0; tick < 80; tick++) sim.host.step();
    expect(sim.host.adapters.get('brain.actor.2')?.snapshot()).not.toEqual(initial);
    restored = restoreSimHost(sim.host.level, { rapier }, snapshotSimHost(sim.host), host => {
      const before = host.rng.snapshot(); bindShardfileSim(host, s, assets, { ...options(s, suffix), restoring: true });
      expect(host.rng.snapshot()).toEqual(before);
    });
    expect(suffix).toEqual([]); original.length = 0;
    for (let tick = 0; tick < 10000; tick++) { sim.host.step(); restored.step(); }
    expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
  } finally { sim.dispose(); restored?.dispose(); }
});
