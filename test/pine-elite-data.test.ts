import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real v1 guests and native body authority.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { readSpeciesPrograms } from '../src/format/speciesPrograms';
import { parseEliteFeature } from '../src/format/eliteFeature';
import { installPopulationRoster } from '../src/game/population/roster';
import { installNativeEliteFeature } from '../src/game/quest/eliteFeature';
import { eliteStream } from '../src/game/quest/eliteStreams';
import { DayCycle } from '../src/engine/world/dayCycle';
import { PINE_DAY, PINE_PHASES } from '../src/shards/pine-hollow/look/dayKeys';
import { PINE_SPECIES_PROGRAMS } from '../src/shards/pine-hollow/generators/speciesPrograms';
import data from '../src/shards/pine-hollow/behaviour/elites.generated.json' with { type: 'json' };
import { SIM_LEVEL } from './fixtures/sim-level/level';
import type { HuntGround } from '../src/engine/ai/hunt';
import { Rng } from '../src/engine/core/rng';

const ground: HuntGround = { heightAt: () => 0, normalY: () => 1, trailDistance: () => 0, cabinMask: () => 0,
  inChunk: () => true, streamAt: () => null, waterLevel: () => -3, pond: () => null, sea: () => false,
  wetAt: () => false, trees: () => [], treeless: () => true, terrain: () => false, chunkHalf: 250 };
async function fixture() {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ ...SIM_LEVEL, id: 'pine-hollow', seed: 1337, ground: { size: 500, height: 0 }, entities: [] }, { rapier });
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing recipe');
  const species = new Map(data.fights.flatMap(fight => fight.program.species).map(row => [`${row.kind}.${row.variant}`, row]));
  const parked = [...species.values()].map((row, i) => ({ seed: sample.seed, scale: sample.scale, id: `recipe.${i}`, kind: row.kind, variant: row.variant,
    spec: { ...sample.spec, kind: row.kind, variant: row.variant }}));
  installPopulationRoster(host, { population: readSpeciesPrograms(PINE_SPECIES_PROGRAMS), ground, nav: null, spawnY: 20,
    bake: { actors: [], parked, herds: [] } }, { version: 1, step: 'pine.roster', seed: 1368, bodyCount: 0, limit: 512,
    scripted: 'sidestep', encounter: 'test', poseKinds: [], spawn: { x: 0, z: 0 }, fauna: [], identities: [], ordinary: {}, reserves: [], homes: [] });
  const day = new DayCycle(PINE_DAY); await day.set(PINE_PHASES.night);
  const feature = installNativeEliteFeature(host, day, data); feature.initialize();
  return { host, feature };
}

test('Pine elite identities and streams are rows; all four v1 guests run without refusals', async () => {
  const { host, feature } = await fixture();
  try {
    expect(feature.scripts.map(script => [script.def.id, script.animal?.kind, script.animal?.variant])).toEqual([
      ['ironhide', 'boar', 'ironhide'], ['ghost-stag', 'deer', 'ghost'], ['blackpaw', 'bear', 'black-old'], ['imperial-bull', 'elk', 'imperial']]);
    const rows = parseEliteFeature(data);
    for (const script of feature.scripts) {
      const stream = eliteStream(rows, 1337, 'spawn', script.def.id); stream.next();
      expect(script.spawnStream.snapshot()).toEqual(stream.snapshot());
      expect(script.row.program.seed).toBe(new Rng(1337).fork(`pine.elite.${script.def.id}`).snapshot().initial);
      const body = script.animal; if (body === null) throw new Error('Missing lair body');
      host.player.position.copy(body.position); host.player.position.z += 8;
      feature.core.devSpawn(script.def.id);
      for (let tick = 0; tick < 140; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      expect(script.program.failure).toBeNull(); expect(script.program.host.metrics().every(row => row.refusals === 0)).toBe(true);
    }
  } finally { host.dispose(); }
}, 60_000);

test('a running Imperial call keeps rival identities and restores quietly and atomically', async () => {
  const { host, feature } = await fixture();
  try {
    const script = feature.scripts.find(row => row.def.id === 'imperial-bull'); if (script?.animal === null || script === undefined) throw new Error('Missing bull');
    host.player.position.copy(script.animal.position); host.player.position.z += 20;
    feature.core.devSpawn(script.def.id);
    for (let tick = 0; tick < 160; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(script.program.failure).toBeNull();
    const ids = ['rival0', 'rival1'].map(slot => script.program.body(slot)?.entityId);
    expect(ids.every(id => id !== undefined)).toBe(true); expect(new Set(ids).size).toBe(2);
    const before = script.program.snapshot(), calls = script.program.host.metrics().map(row => row.calls);
    const commit = script.program.prepareRestore(before); expect(script.program.snapshot()).toBe(before); commit();
    expect(script.program.snapshot()).toBe(before); expect(script.program.host.metrics().map(row => row.calls)).toEqual(calls);
    const bad = v.parse(v.record(v.string(), v.unknown()), JSON.parse(before));
    const actors = v.parse(v.array(v.tuple([v.number(), v.string()])), bad['actors']);
    const first = actors[0], second = actors[1]; if (first === undefined || second === undefined) throw new Error('Missing actors');
    second[1] = first[1]; bad['actors'] = actors;
    expect(() => script.program.prepareRestore(JSON.stringify(bad))).toThrow(); expect(script.program.snapshot()).toBe(before);
    expect(['rival0', 'rival1'].map(slot => script.program.body(slot)?.entityId)).toEqual(ids);
    const previousMain = script.animal;
    previousMain.alive = false; feature.core.devSpawn(script.def.id);
    expect(script.animal.entityId).not.toBe(previousMain.entityId);
    expect(['rival0', 'rival1'].map(slot => script.program.body(slot))).toEqual([null, null]);
    for (let tick = 0; tick < 180; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    expect(script.program.failure).toBeNull();
    expect(['rival0', 'rival1'].map(slot => script.program.body(slot)?.entityId).every(id => id !== undefined && !ids.includes(id))).toBe(true);
  } finally { host.dispose(); }
}, 60_000);

test('ending a concealed encounter restores visibility before saving', async () => {
  const { host, feature } = await fixture();
  try {
    const ghost = feature.scripts.find(row => row.def.id === 'ghost-stag');
    if (ghost?.animal === null || ghost === undefined) throw new Error('Missing stag');
    feature.core.devSpawn(ghost.def.id); host.player.position.copy(ghost.animal.position); host.player.position.z += 8;
    ghost.force('fade');
    for (let tick = 0; tick < 8; tick++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const body = ghost.animal; if (!('hidden' in body)) throw new Error('Missing visibility owner');
    expect(body.hidden).toBe(true); ghost.trophy(); expect(body.hidden).toBe(false);
    const saved = ghost.program.snapshot(); ghost.program.prepareRestore(saved)(); expect(body.hidden).toBe(false);
  } finally { host.dispose(); }
}, 60_000);
