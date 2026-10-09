import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Compile admitted author modules and use the committed native physics binary.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '@wildshard/sdk/author';
import { contentHash, validateProject } from '@wildshard/sdk/project';
import { loadRapier } from '../src/engine/physics/rapier';
import type { SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim, numericScriptEntityId, type ShardfileSimPorts } from '../src/game/shardfile/simulation';
import { parseShardfile, type Shardfile } from '../src/game/shardfile/schema';
import { logicalStateFromLane } from '../src/game/shardfile/logicalState';
import template from '../src/shards/_template/shard.config';
import { compileScript } from '../scripts/compile-script.mjs';
import { scriptSource } from './script/fixture';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>, source: Shardfile, assets: ReadonlyMap<string, Uint8Array>;
beforeAll(async () => {
  const numeric = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,load<f64>(16384));', '', '1'), { maximumPages: 2 });
  const policy = await compileScript(await readFile('test/fixtures/sim-level/brain.as', 'utf8'), { maximumPages: 2 });
  const numericHash = contentHash(numeric), policyHash = contentHash(policy);
  assets = new Map([[numericHash, numeric], [policyHash, policy]]);
  const s = emptyShardfile({ slug: 'custom-brains', name: 'Custom brains', author: 'Test', revision: 1, seed: 435 });
  const pursue = template.creatures.brains.find(brain => brain.kind === 'pursue');
  if (pursue === undefined) throw new Error('Missing pursuit fixture');
  s.rows.species = template.rows.species; s.rows.strikes = template.rows.strikes;
  s.state.shared = [{ id: 101, name: 'tick', type: 'i32', privacy: 'public', default: 0, min: 0, max: 100000 }];
  s.creatures.brains = [pursue, { id: 'custom', kind: 'script', module: policyHash, thinkDivisor: 6,
    maxSpeed: 3, maxStrafe: 1, maxTurnRate: 6, parameters: [2], strikes: [{ event: 101, strike: 'boar.charge' }] }];
  s.creatures.spawns = [{ id: 'actor.custom', species: 'boar', variant: 'greyback', brain: 'custom', strike: 'boar.charge', seed: 1, scale: 1, at: [0, 0, 4], yaw: 0 },
    { id: 'actor.native', species: 'boar', variant: 'greyback', brain: pursue.id, strike: null, seed: 2, scale: 1, at: [4, 0, 4], yaw: 0 }];
  s.sim = { ...s.sim, scripts: [numericHash, policyHash], scriptTickDivisor: 4, bindings: [{ module: numericHash, entity: numericScriptEntityId('actor.player'), actorId: 'actor.player', kind: 'server' }] };
  s.files = [...assets].map(([hash, bytes]) => ({ hash, kind: 'wasm', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }));
  s.critical = s.sim.scripts; s.budgets.sim = { resident: 1_000_000, compressed: 2_000_000 };
  source = validateProject(s, assets);
  const binary = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(binary).buffer);
});
function ports(observed: number[] = []): ShardfileSimPorts {
  return { rapier, scriptRules: { fields: {}, archetypes: [], events: [201], maxEntities: 100 }, scriptBrains: host => ({
    ports: { observe: actor => { observed.push(host.state.tick); expect(actor.entityId).toBe('actor.custom'); return [6]; }, mayAttack: () => true, strike: () => undefined },
    query: kind => kind === 410 ? [2] : [],
  }) };
}

it('runs native and custom brains with one numeric facade, one host and independent fixed cadences', () => {
  const observed: number[] = [], sim = createShardfileSim(source, assets, ports(observed));
  try {
    expect(observed).toEqual([]);
    for (let tick = 0; tick < 60; tick++) sim.host.step();
    expect(observed).toHaveLength(10); expect(observed.every(tick => tick % 6 === 0)).toBe(true);
    expect(sim.lane?.host.currentTick).toBe(60); expect(sim.lane?.host.checkpoint().modules).toHaveLength(2);
    expect(sim.lane?.world.view('actor.player').shared['tick']).toBe(60);
    expect(sim.host.entities.get('actor.custom')?.desiredSpeed).toBe(2);
    expect(sim.host.adapters.has('brain.actor.custom')).toBe(false); expect(sim.host.adapters.has('brain.actor.native')).toBe(true);
    expect(logicalStateFromLane(1, sim.lane?.snapshot() ?? null).shared).toEqual([{ id: 101, name: 'tick', type: 'i32', value: 60 }]);
    expect(() => sim.lane?.enqueue({ type: 201, target: numericScriptEntityId('brain:actor.custom'), value: 1 })).toThrow('queued input');
  } finally { sim.dispose(); }
});

it('refuses undeclared modules/strikes, missing recipes, alias collisions and aggregate entity or guest memory undercharges', () => {
  const brain = source.creatures.brains.find(row => row.kind === 'script'); if (brain === undefined) throw new Error('Missing custom fixture');
  for (const invalid of [{ ...brain, module: 'a'.repeat(64) }, { ...brain, strikes: [{ event: 1, strike: 'invented' }] }]) {
    expect(() => parseShardfile({ ...source, creatures: { ...source.creatures, brains: source.creatures.brains.map(row => row.id === brain.id ? invalid : row) } })).toThrow();
  }
  expect(() => createShardfileSim(source, assets, { rapier })).toThrow('Missing custom brain port');
  expect(() => createShardfileSim({ ...source, serverBudget: { ...source.serverBudget, entities: 3 } }, assets, ports())).toThrow('Aggregate');
  const alias = numericScriptEntityId('brain:actor.custom');
  expect(() => createShardfileSim(source, assets, { ...ports(), scriptEntities: { entities: [{ id: alias, name: 'item', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }], actors: new Map([[alias, 'actor.player']]) } })).toThrow('alias collision');
  expect(() => createShardfileSim({ ...source, sim: { ...source.sim, bindings: [...source.sim.bindings, { module: brain.module, entity: alias, actorId: null, kind: 'server' }] } }, assets, ports())).toThrow('alias collision');
  expect(() => validateProject({ ...source, budgets: { ...source.budgets, sim: { ...source.budgets.sim, resident: 700000 } } }, assets)).toThrow('script memory');
});

it('shares each admitted module across multiple trusted brain aliases without charging a guest per actor', () => {
  const custom = source.creatures.spawns.find(row => row.id === 'actor.custom'); if (custom === undefined) throw new Error('Missing custom actor');
  const s = validateProject({ ...source, creatures: { ...source.creatures, spawns: [...source.creatures.spawns, { ...custom, id: 'actor.second', at: [8, 0, 4] }] } }, assets);
  const trace: string[] = [], options = ports();
  options.scriptBrains = () => ({ ports: { observe: actor => { trace.push(actor.entityId); return [6]; }, mayAttack: () => true, strike: () => undefined } });
  const sim = createShardfileSim(s, assets, options);
  try {
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    expect(trace.filter(id => id === 'actor.custom')).toHaveLength(2); expect(trace.filter(id => id === 'actor.second')).toHaveLength(2);
    expect(sim.lane?.host.checkpoint().modules).toHaveLength(2);
    expect(sim.host.entities.get('actor.second')?.desiredSpeed).toBe(2);
  } finally { sim.dispose(); }
});

it('refuses a custom module attempting numeric shared-state writes while the numeric role keeps running', async () => {
  const brain = source.creatures.brains.find(row => row.kind === 'script'); if (brain === undefined) throw new Error('Missing custom fixture');
  const forged = await compileScript(scriptSource('store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,999);', '', '1'), { maximumPages: 2 });
  const hash = contentHash(forged), bytes = new Map(assets); bytes.set(hash, forged);
  const s = validateProject({ ...source, serverBudget: { ...source.serverBudget, memory: 2_000_000 }, budgets: { ...source.budgets, sim: { ...source.budgets.sim, resident: 2_000_000 } },
    sim: { ...source.sim, scripts: [...source.sim.scripts, hash] }, critical: [...source.critical, hash],
    files: [...source.files, { hash, kind: 'wasm', compressed: forged.length, decoded: forged.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }],
    creatures: { ...source.creatures, brains: source.creatures.brains.map(row => row.id === brain.id ? { ...brain, module: hash } : row) },
  }, bytes);
  const sim = createShardfileSim(s, bytes, ports());
  try {
    for (let tick = 0; tick < 6; tick++) sim.host.step();
    expect(sim.lane?.world.view('actor.player').shared['tick']).toBe(4);
    expect(sim.lane?.host.checkpoint().modules.find(row => row.name === hash)?.failures).toBe(1);
    expect(sim.host.entities.get('actor.custom')?.desiredSpeed).toBe(0);
  } finally { sim.dispose(); }
});

it('restores both script roles and pending numeric events without executing observations, then replays 10,000 real-motor ticks exactly', () => {
  const observed: number[] = [], restoredObservations: number[] = [], sim = createShardfileSim(source, assets, ports(observed));
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 97; tick++) sim.host.step();
    sim.lane?.enqueue({ type: 201, target: numericScriptEntityId('actor.player'), value: 1 });
    restored = restoreSimHost(sim.host.level, { rapier }, snapshotSimHost(sim.host), host => {
      bindShardfileSim(host, source, assets, { ...ports(restoredObservations), restoring: true });
    });
    expect(restoredObservations).toEqual([]); observed.length = 0;
    for (let tick = 0; tick < 10000; tick++) { sim.host.step(); restored.step(); }
    expect(restoredObservations).toEqual(observed); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
  } finally { sim.dispose(); restored?.dispose(); }
});
