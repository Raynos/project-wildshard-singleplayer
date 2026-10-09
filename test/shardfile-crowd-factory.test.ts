import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Load the committed physics binary for the actual factory.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '@wildshard/sdk/author';
import { loadRapier } from '../src/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { parseFlock } from '../src/game/shardfile/crowds';
import { parseShardfile } from '../src/game/shardfile/schema';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { createShardfileSim, bindShardfileSim, type ShardfileSimPorts } from '../src/game/shardfile/simulation';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function source() {
  const s = emptyShardfile({ slug: 'crowd-factory', name: 'Crowd', author: 'Test', revision: 1, seed: 435 });
  s.crowds = [parseFlock({ id: 'flock.a', kind: 'flock', x: 0, z: 0, count: 4, seed: 57, range: 32,
    runSpeed: 4.6, walkSpeed: 0.9, grazeStep: 0.35, bleatCue: 'sheep_bleat' })];
  s.serverBudget.entities = 4;
  return parseShardfile(s);
}
function recipes(trace: string[]): NonNullable<ShardfileSimPorts['crowds']> {
  return host => ({ flock: () => ({ ports: {
    heightAt: (x, z) => { trace.push('height'); return Math.sin(x * 0.01) + Math.cos(z * 0.02); },
    normalY: () => 1, inBounds: () => true, wetAt: () => false, playerCrouched: () => false, grassHeightAt: () => 1,
    trample: () => { trace.push('trample'); }, centre: () => { trace.push('centre'); },
  }, observe: () => { trace.push('observe'); return { player: host.player.position, playerSpeed: 0, wolves: [], dog: null }; },
  present: () => { trace.push('present'); } }) });
}
it('admits bounded unique crowd rows and counts members with authoritative entities', () => {
  const s = source(), row = s.crowds[0]; if (row === undefined) throw new Error('Missing fixture');
  expect(emptyShardfile({ slug: 'empty', name: 'Empty', author: 'Test', revision: 1, seed: 1 }).crowds).toEqual([]);
  for (const crowds of [[row, row], [{ ...row, x: 251 }], Array.from({ length: 65 }, (_, i) => ({ ...row, id: `flock.${i}` })),
    Array.from({ length: 17 }, (_, i) => ({ ...row, id: `flock.${i}`, count: 256 }))]) {
    expect(() => parseShardfile({ ...s, crowds, serverBudget: { ...s.serverBudget, entities: 10000 } })).toThrow();
  }
  expect(() => parseShardfile({ ...s, serverBudget: { ...s.serverBudget, entities: 3 } })).toThrow();
  expect(() => emptyShardfileSource(s)).toThrow('empty shardfiles only');
});
it('refuses missing recipes or later encounter admission without crowd setup or presentation', () => {
  const s = source(), trace: string[] = [];
  expect(() => createShardfileSim(s, new Map(), { rapier })).toThrow('crowd ports');
  const ports = recipes(trace);
  expect(() => createShardfileSim(s, new Map(), { rapier, crowds: host => ({ flock: row => {
    const recipe = ports(host).flock(row); Reflect.set(recipe, 'observe', undefined); return recipe;
  } }) })).toThrow('recipe');
  expect(trace).toEqual([]);
  s.encounters.push({ id: 'invalid', entity: 'missing', kind: 'boss', panel: null, name: 'Boss', title: 'Boss', retry: 'Retry',
    arena: { at: [0, 0, 0], radius: 20 }, intro: 0, introShort: 0, respawn: { at: [0, 0, 0], yaw: 0 },
    phases: [{ at: 1, name: 'Start', caption: 'Start', speed: 1, stopDistance: 1, turnRate: 1 }] });
  expect(() => createShardfileSim(s, new Map(), { rapier, crowds: ports })).toThrow();
  expect(trace).toEqual([]);
});
it('uses the authoritative fixed clock and restores a complete host with an exact 10k suffix', () => {
  const s = source(), trace: string[] = [], original = createShardfileSim(s, new Map(), { rapier, crowds: recipes(trace) });
  let restored: ReturnType<typeof restoreSimHost> | undefined;
  try {
    expect(original.crowds.size).toBe(1); trace.length = 0;
    original.host.step(); expect(trace.filter(value => value === 'observe')).toHaveLength(1);
    for (let tick = 0; tick < 301; tick++) original.host.step();
    const saved = snapshotSimHost(original.host), restoringTrace: string[] = [];
    restored = restoreSimHost(original.host.level, { rapier }, saved, host => { bindShardfileSim(host, s, new Map(), { rapier, restoring: true, crowds: recipes(restoringTrace) }); });
    expect(restoringTrace).toEqual([]); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < 10000; tick++) { original.host.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original.host));
  } finally { original.dispose(); restored?.dispose(); }
});
