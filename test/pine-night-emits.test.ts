// oxlint-disable-next-line import/no-nodejs-modules -- Scenario uses the shipped Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { SpawnScript, installNativeSpawnScript } from '../src/game/population/spawnScript';
import { createSimHost } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Rng } from '../src/engine/core/rng';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import night from '../src/shards/pine-hollow/behaviour/night.generated.json' with { type: 'json' };
import { readSpeciesPrograms } from '../src/format/speciesPrograms';
import { parseSpawnScript } from '../src/format/spawnScripts';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import { installPopulationRoster } from '../src/game/population/roster';
import { PINE_SPECIES_PROGRAMS } from '../src/shards/pine-hollow/generators/speciesPrograms';
import type { HuntGround } from '../src/engine/ai/hunt';

const active = { draws: 0, created: [] as AnimalSim[] };
const ground: HuntGround = { heightAt: () => 0, normalY: () => 1, trailDistance: () => 0, cabinMask: () => 0,
  inChunk: () => true, streamAt: () => null, waterLevel: () => -3, pond: () => null, sea: () => false,
  wetAt: () => false, trees: () => [], treeless: () => true, terrain: () => false, chunkHalf: 250 };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function scenario(rosterStep = 'pine.roster') {
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  active.draws = 0; active.created = [];
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing fixture recipe');
  const native = PINE_SPECIES_PROGRAMS.native[0]; if (native === undefined) throw new Error('Missing species row');
  const population = readSpeciesPrograms({ page: [], hunt: PINE_SPECIES_PROGRAMS.hunt, native: [...PINE_SPECIES_PROGRAMS.native,
    { ...native, id: 'marsh.heron', kind: 'heron', variants: [{ id: 'reed', label: 'Heron', weight: 1, rarity: 'common' as const, scale: [1, 1] }] }] });
  const parked = [['elk', 'thrall'], ['boar', 'thrall'], ['heron', 'reed']].map(([kind, variant], i) => {
    if (kind === undefined || variant === undefined) throw new Error('Missing species recipe');
    return Object.assign(structuredClone(sample), { id: `recipe.${String(i)}`, kind, variant, spec: { ...sample.spec, kind, variant } });
  });
  const step = rosterStep; installPopulationRoster(host, { population, ground, nav: null,
    spawnY: 20, bake: { actors: [], parked, herds: [] } }, {
    version: 1, step, seed: 1368, bodyCount: 0, limit: 512, scripted: 'sidestep', encounter: 'test', poseKinds: [],
    spawn: { x: 0, z: 0 }, fauna: [], identities: [], ordinary: {}, reserves: [], homes: [],
  });
  const spawn = host.spawn.bind(host);
  vi.spyOn(host, 'spawn').mockImplementation(recipe => {
    const body = spawn(recipe); active.created.push(body); active.draws += 6; return body;
  });
  const runner = SpawnScript.native(host, { ...night, roster: rosterStep });
  const point = { x: 150, y: 0, z: -40 };
  return { host, runner, point, run: (ticks: number, dark = 1, flags: string[] = []) => {
    for (let i = 0; i < ticks; i++) {
      runner.advance(1 / 60, point, dark, 3, flags);
      if (runner.hasFlag('errand:done') && !flags.includes('errand:done')) flags.push('errand:done');
    }
  } };
}

test('night v1 places roamers, retains IDs and draws, flees dawn and restores without guest calls', () => {
  const { host, runner, point, run } = scenario();
  try {
    run(60); expect(runner.channel(1)).toBe(0);
    run(1); expect(runner.channel(1)).toBe(1);
    run(60); expect(runner.channel(1)).toBe(2);
    run(60);
    expect(runner.failure).toBeNull(); expect(runner.host.metrics()[0]?.refusals).toBe(0);
    expect(runner.channel(1)).toBe(3); expect(active.created).toHaveLength(3); expect(active.draws).toBe(18);
    const before = runner.snapshot(), ids = active.created.map(actor => actor.entityId), draws = active.draws;
    const restored = SpawnScript.native(host, night); restored.restore(before);
    expect(restored.host.metrics()[0]?.calls).toBe(0); expect(restored.snapshot()).toBe(before);
    const events = [];
    for (let i = 0; i < 245; i++) { restored.advance(1 / 60, point, 0, 3, []); events.push(...restored.drainEffects()); }
    expect(restored.channel(1)).toBe(0); expect(ids.every(id => !host.entities.has(id))).toBe(true);
    expect(events.filter(event => event.kind === 'cue' && event.id === 4)).toHaveLength(3);
    expect(active.draws).toBe(draws); expect(restored.failure).toBeNull(); expect(restored.host.metrics()[0]?.refusals).toBe(0);
  } finally { host.dispose(); }
});

test('millrace wakes on approach, finishes once after all three die, and allows no dawn respawn', () => {
  const { host, runner, point, run } = scenario();
  try {
    point.x = -181; point.z = -144;
    run(80, 1, ['errand:asked']);
    expect(runner.failure).toBeNull(); expect(runner.host.metrics()[0]?.refusals).toBe(0);
    expect(active.created).toHaveLength(3); expect(active.created.every(actor => actor.scripted)).toBe(false);
    for (const actor of active.created) actor.alive = false;
    run(70, 0, ['errand:asked']); expect(runner.hasFlag('errand:done')).toBe(true);
    expect(runner.channel(1)).toBe(0); expect(active.draws).toBe(18);
  } finally { host.dispose(); }
});

test('legacy mid-night identities and placement stream migrate without spawn or guest execution', () => {
  const { host, runner, point, run } = scenario();
  try {
    runner.force(); run(31);
    const rows = parseSpawnScript(night); if (rows.legacy === undefined) throw new Error('Missing old-save map');
    const rng = new Rng(rows.seed).fork(rows.step), oldActors = active.created.slice();
    const ids = oldActors.map(actor => actor.entityId), before = active.draws;
    const old = { version: 1, population: { version: 2, spec: rows.legacy.spec, director: 'legacy checkpoint', acc: .4,
      roam: ids.map(id => ({ id, flee: .6 })), race: [] }, rng: { ...rng.snapshot() } };
    const restored = installNativeSpawnScript(host, { night: 0 }, night);
    const adapter = host.adapters.get('pine.night'); if (adapter === undefined) throw new Error('Missing save owner');
    adapter.restore(old); expect(adapter.snapshot()).toEqual(old);
    expect(restored.host.metrics()[0]?.calls).toBe(0); expect(active.draws).toBe(before);
    expect(restored.host.state(1)['rng']).toBe(rng.snapshot().state); expect(restored.host.state(1)['acc']).toBe(.4);
    for (let i = 0; i < 185; i++) restored.advance(1 / 60, point, 0, 3, []);
    expect(restored.channel(1)).toBe(0); expect(ids.every(id => !host.entities.has(id))).toBe(true);
    expect(active.draws).toBe(before); expect(restored.failure).toBeNull(); expect(restored.host.metrics()[0]?.refusals).toBe(0);
  } finally { host.dispose(); }
});

test('an unrelated salt-marsh script spawns and retires its own species and site rows', async () => {
  const { compileDecisionScripts } = await import('../src/sdk/buildDecisionScripts');
  const { spawnScriptRegistries } = await import('../src/format/spawnScripts');
  const { legacy: _legacy, ...template } = parseSpawnScript(night);
  const script = { ...template.script, id: 'marsh.watch', source: 'behaviour/watch.as', on: ['start', 'tick'],
    reads: [], commands: ['spawn', 'despawn'], actors: { bird: 'watcher' }, spawns: { heron: 'egret.at.reeds' },
    moves: {}, fields: {}, flags: {}, cues: {}, channels: {}, params: {}, state: [
      { name: 'step', type: 'i32', default: 0, scope: 'binding', min: 0, max: 2 },
    ] };
  const data = parseSpawnScript({ ...template, step: 'marsh.watch', roster: 'marsh.roster', seed: 91,
    slots: [{ id: 'watcher', handle: 7 }], species: [{ id: 'white.egret', kind: 'heron', variant: 'reed' }],
    sites: [{ id: 'reeds', slot: 'watcher', point: [8, 8], face: [0, 0] }],
    spawns: [{ id: 'egret.at.reeds', species: 'white.egret', site: 'reeds' }],
    script, fields: [], flags: [], cues: [], channels: [], moves: [] });
  const source = "import {State,Do,Actor,Spawn} from './generated/marshWatch';\nexport function onStart():void{}\nexport function onTick(dt:f64):void{if(State.step===0){Do.spawn(Spawn.heron);State.step=1;}else if(State.step===1){Do.despawn(Actor.bird);State.step=2;}}";
  const built = await compileDecisionScripts([script], spawnScriptRegistries(data), new Map([['behaviour/watch.as', source]]), { asLineCeiling: 256 });
  const compiled = built.rows[0], blob = built.blobs[0]; if (compiled === undefined || blob === undefined) throw new Error('Missing fixture script');
  const { host } = scenario('marsh.roster');
  try {
    const runner = SpawnScript.native(host, { ...data, script: compiled, bytes: btoa(String.fromCodePoint(...blob.bytes)) });
    for (let tick = 0; tick < 7; tick++) runner.advance(1 / 60, { x: 0, y: 0, z: 0 }, 0, 1, []);
    expect(active.created[0]).toMatchObject({ kind: 'heron', variant: 'reed', position: { x: 8, z: 8 } });
    expect(host.entities.has('creature:0')).toBe(true); expect(active.draws).toBe(6);
    for (let tick = 0; tick < 6; tick++) runner.advance(1 / 60, { x: 0, y: 0, z: 0 }, 0, 1, []);
    expect(host.entities.has('creature:0')).toBe(false); expect(active.draws).toBe(6);
    expect(runner.host.metrics()[0]?.refusals).toBe(0);
  } finally { host.dispose(); }
});

test('AS placement preserves the retired sampler coordinates, identity order and every placement draw', async () => {
  const { sampleCreatureGroup } = await import('../src/game/plugin/brain');
  const { default: old } = await import('../src/shards/pine-hollow/data/nightPopulation.generated.json');
  const { default: tuning } = await import('../src/shards/pine-hollow/data/populationWaves.json');
  let total = 0;
  for (let seed = 0; seed < 120; seed++) {
    const { host, point } = scenario();
    try {
      point.x += (seed % 11 - 5) * 14; point.z += (seed % 7 - 3) * 19;
      const oracle = new Rng(seed).fork('pine.night'), initial = oracle.snapshot().state;
      const runner = SpawnScript.native(host, { ...night, seed, script: { ...night.script,
        state: night.script.state.map(slot => slot.name === 'rng' ? Object.assign(structuredClone(slot), { default: initial }) : slot) } });
      const expected: { kind: string; x: number; z: number; yaw: number }[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const sample = sampleCreatureGroup({ kind: old.spec.roamKinds[expected.length % 2] ?? 'elk', count: 1, herd: -1, variant: null, face: point,
          source: { kind: 'radial', centre: old.spec.region, axes: [old.spec.region.ax, old.spec.region.az], bearing: 'compass',
            radius: [0, tuning.placement.radius], radiusLaw: 'area', attempts: tuning.placement.attempts },
          accept: { band: { ...point, min: 18, max: 60 }, clear: [{ ...old.spec.exclude, r: old.spec.exclude.blend + tuning.placement.excludeClear }],
            bound: tuning.placement.bound, minHeight: old.spec.water + tuning.placement.waterClear } }, oracle, { heightAt: () => 0 })[0];
        if (sample !== undefined) expected.push(sample);
      }
      runner.force(); for (let i = 0; i < 25; i++) runner.advance(1 / 60, point, 1, 3, []);
      expect(runner.failure).toBeNull(); expect(runner.host.metrics()[0]?.refusals).toBe(0);
      expect(runner.host.state(1)['rng']).toBe(oracle.snapshot().state);
      expect(active.created.map(actor => ({ kind: actor.kind, x: actor.position.x, z: actor.position.z, yaw: actor.yaw })))
        .toEqual(expected.map(({ kind, x, z, yaw }) => ({ kind, x, z, yaw })));
      expect(active.created.map(actor => actor.entityId)).toEqual(expected.map((_, i) => `creature:${String(i)}`));
      expect(active.draws).toBe(expected.length * 6);
      const recipeStream = new Rng(1368); for (let i = 0; i < expected.length * 6; i++) recipeStream.next();
      const saved = v.parse(v.object({ rng: v.strictObject({ version: v.literal(1), state: v.number(), initial: v.number(), scrambledFork: v.boolean() }) }), host.adapters.get('pine.roster')?.snapshot());
      expect(saved.rng).toEqual(recipeStream.snapshot()); total += expected.length;
    } finally { host.dispose(); }
  }
  expect(total).toBeGreaterThan(100);
});

test('bad spawn recipes and forged saves refuse atomically without draws or guest calls', () => {
  const { host, runner, run } = scenario();
  try {
    runner.force(); run(19);
    const before = runner.snapshot(), calls = runner.host.metrics()[0]?.calls, drawn = active.draws;
    const saved: unknown = JSON.parse(before);
    if (typeof saved !== 'object' || saved === null) throw new Error('Missing saved population');
    for (const forged of [
      { ...saved, fields: [[123, 1, 0]] }, { ...saved, channels: [[123, 1]] },
      { ...saved, actors: [[1, 'foreign']] }, { ...saved, force: -1 },
    ]) {
      expect(() => runner.restore(JSON.stringify(forged))).toThrow(); expect(runner.snapshot()).toBe(before);
      expect(runner.host.metrics()[0]?.calls).toBe(calls); expect(active.draws).toBe(drawn);
    }
    expect(() => SpawnScript.native(host, { ...night, species: [{ id: 'elk', kind: 'elk', variant: 'missing' }, night.species[1]] })).toThrow();
    expect(active.draws).toBe(drawn); expect(runner.snapshot()).toBe(before);
  } finally { host.dispose(); }
});


test('published spawn catalogue admits v1 bytes without installing a second generic decision owner', async () => {
  const { loadHeadlessProduct } = await import('../src/sdk/headlessProduct');
  const { readSpawnScript } = await import('../src/game/population/spawnScript');
  const { scriptAdmissionRows, decisionScriptsFromSections } = await import('../src/format/scriptContract');
  const { SpawnScriptsSchema } = await import('../src/format/spawnScripts');
  const { sectionHostImports } = await import('../scripts/shard-platform-hosts.mjs');
  expect(sectionHostImports([{ name: 'actors/spawn-scripts' }])).toContain('game/population/spawnScript');
  const product = await loadHeadlessProduct('out/pine-hollow');
  const catalogue = product.section('actors/spawn-scripts');
  const rows = new Map<string, unknown>([['actors/spawn-scripts', catalogue], ['sim/scripts', product.section('sim/scripts')]]);
  expect(scriptAdmissionRows(rows).some(row => row.id === 'pine.night')).toBe(true);
  expect(decisionScriptsFromSections(rows).some(row => row.id === 'pine.night')).toBe(false);
  expect(catalogue.every(row => row.bytes === '')).toBe(true);
  expect(() => v.parse(SpawnScriptsSchema, [{ ...night }])).toThrow();
  const admitted = await readSpawnScript(product, 'pine.night');
  expect(admitted.seed).toBe(product.shardfile.identity.seed);
  expect(admitted.bytes).toBe(night.bytes); expect(admitted.script.module).toBe(night.script.module);
  const { host } = scenario();
  try {
    const runner = SpawnScript.native(host, admitted); runner.force();
    for (let i = 0; i < 31; i++) runner.advance(1 / 60, { x: 150, y: 0, z: -40 }, 1, 3, []);
    // The native seed's three bounded placement requests accept exactly two sites here.
    expect(runner.channel(1)).toBe(2); expect(active.draws).toBe(12); expect(runner.failure).toBeNull();
  } finally { host.dispose(); }
});
