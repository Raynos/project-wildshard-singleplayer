import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise admitted declarations with the committed native physics binary.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '@wildshard/sdk/author';
import { loadRapier } from '../src/engine/physics/rapier';
import { Rng, type RngState } from '../src/engine/core/rng';
import type { SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim } from '../src/game/shardfile/simulation';
import { parseShardfile } from '../src/game/shardfile/schema';
import { parseGroupBrain } from '../src/game/shardfile/groupBrains';
import type { DeclaredGroupPorts } from '../src/game/shardfile/groupRuntime';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../src/shards/nalati-grasslands/data/brains';
import { CRAB_BRAIN } from '../src/shards/driftwood-isle/data/brains';
import template from '../src/shards/_template/shard.config';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
function source() {
  const s = emptyShardfile({ slug: 'group-factory', name: 'Group factory', author: 'Test', revision: 1, seed: 435 });
  const pursue = template.creatures.brains.find(brain => brain.kind === 'pursue');
  if (pursue === undefined) throw new Error('Missing pursuit fixture');
  s.rows.species = template.rows.species;
  s.creatures.brains = [pursue];
  s.creatures.groups = [parseGroupBrain({ ...NALATI_PACK_BRAIN, members: ['pack.0', 'pack.1'], home: [0, 4] }),
    parseGroupBrain({ ...NALATI_HERD_BRAIN, members: ['herd.0', 'herd.1'] })];
  const controllers = [...s.creatures.groups.flatMap(group => group.members.map(id => ({ id, brain: group.id }))), { id: 'solo', brain: pursue.id }];
  s.creatures.spawns = controllers.map((row, index) => ({ id: row.id, brain: row.brain, species: 'boar', variant: 'greyback', strike: null,
    seed: index, scale: 1, at: [index * 4, 0, 4], yaw: 0 }));
  return parseShardfile(s);
}
function recipes(trace: string[], prepare?: (host: SimHost) => void): DeclaredGroupPorts {
  const common = (host: SimHost) => ({ t: 0, player: host.player.position, playerSpeed: 3, calm: false, rng: host.rng.stream('ai'),
    sound: (cue: string) => { trace.push(cue); }, claim: () => true,
    steer: (actor: Parameters<NonNullable<DeclaredGroupPorts['pack']>>[1][number], yaw: number, speed: number, turn: number) => { actor.setMotion(yaw, speed, turn); }, pathYaw: () => 0 });
  const perception = (host: SimHost) => ({ visibility: () => 1, hearing: () => 30, downwind: () => true,
    inBounds: () => true, normalY: () => 1, sharedRng: () => host.rng.stream('ai') });
  return {
    pack: (_group, _members, host) => {
      prepare?.(host);
      return { ports: { ...perception(host), environment: () => ({ playerFwdX: 0, playerFwdZ: 1, playerMounted: false,
        playerHealth01: 1, grassHeightAt: () => 0 }), register: () => undefined, bite: () => { trace.push('bite'); },
        preyIdentity: () => 'prey.none', resolvePrey: () => null },
      observe: (actor, dt) => { trace.push(`${actor.entityId}.${dt === 0.1 ? 'think' : 'body'}`); return { ...common(host), dt }; }, confine: () => undefined };
    },
    herd: (_group, _members, host) => ({ ports: { ...perception(host), environment: () => ({ playerMounted: false, playerCrouched: false }),
      passThrough: () => undefined, chargeContact: () => { trace.push('charge'); }, scarePack: () => false, resolveActor: id => host.entities.get(id) ?? null },
    observe: (actor, dt) => { trace.push(`${actor.entityId}.${dt === 0.1 ? 'think' : 'body'}`); return { ...common(host), dt, hurt: () => undefined, confine: () => undefined }; } }),
  };
}
it('admits only exact ordered group rosters with exclusive controller identities', () => {
  const s = source(), first = s.creatures.groups[0], individual = s.creatures.brains[0];
  if (first === undefined || individual === undefined) throw new Error('Missing controller fixture');
  for (const invalid of [
    { ...first, members: [...first.members].reverse() },
    { ...first, members: ['pack.0', 'missing'] },
    { ...first, id: individual.id },
  ]) expect(() => parseShardfile({ ...s, creatures: { ...s.creatures, groups: [invalid, ...s.creatures.groups.slice(1)] } })).toThrow();
  expect(() => parseShardfile({ ...s, creatures: { ...s.creatures, groups: [...s.creatures.groups, first] } })).toThrow();
  const encounter = template.encounters[0];
  if (encounter === undefined) throw new Error('Missing encounter fixture');
  expect(() => parseShardfile({ ...s, encounters: [{ ...encounter, entity: 'pack.0' }] })).toThrow('shardfile semantic rules');
});
it('installs two group controllers and one individual, drawing cold setup exactly once before fixed callbacks', () => {
  const s = source(), trace: string[] = [];
  let initial: RngState | undefined;
  const sim = createShardfileSim(s, new Map(), { rapier, groups: recipes(trace, host => { initial = host.rng.stream('ai').snapshot(); }) });
  try {
    if (initial === undefined) throw new Error('Missing prepared RNG state');
    const expected = new Rng(0); expected.restore(initial);
    for (let draw = 0; draw < 7; draw++) expected.next();
    expect(sim.host.rng.stream('ai').snapshot()).toEqual(expected.snapshot());
    expect(sim.groups.size).toBe(2); expect(trace).toEqual([]);
    expect(sim.host.adapters.has('brain.solo')).toBe(true);
    for (const group of s.creatures.groups) expect(sim.host.adapters.has(`group.${group.id}`)).toBe(true);
    for (const id of ['pack.0', 'pack.1', 'herd.0', 'herd.1']) expect(sim.host.hasStep(`brain.${id}`)).toBe(false);
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    for (const id of ['pack.0', 'pack.1', 'herd.0', 'herd.1']) {
      expect(trace.filter(row => row === `${id}.body`)).toHaveLength(12);
      expect(trace.filter(row => row === `${id}.think`)).toHaveLength(2);
    }
  } finally { sim.dispose(); }
});
it('refuses a missing group recipe and a later individual recipe before group setup or observations', () => {
  const s = source(), trace: string[] = [];
  expect(() => createShardfileSim(s, new Map(), { rapier })).toThrow('Missing declared group port');
  const solo = s.creatures.spawns.find(row => row.id === 'solo');
  if (solo === undefined) throw new Error('Missing solo fixture');
  const invalid = parseShardfile({ ...s, creatures: { ...s.creatures, brains: [...s.creatures.brains, CRAB_BRAIN],
    spawns: [...s.creatures.spawns, { ...solo, id: 'crab', brain: CRAB_BRAIN.id }] } });
  let preparedHost: SimHost | undefined, initial: RngState | undefined;
  expect(() => createShardfileSim(invalid, new Map(), { rapier, groups: recipes(trace, host => {
    preparedHost = host; initial = host.rng.stream('ai').snapshot();
  }) })).toThrow('Missing native brain port');
  expect(preparedHost?.rng.stream('ai').snapshot()).toEqual(initial);
  expect(preparedHost?.entities.get('pack.0')?.mem['init']).toBeUndefined();
  expect(trace).toEqual([]);
});
it('rebinds all full-factory controllers without setup draws and matches a 10,000-tick native suffix', () => {
  const s = source(), assets = new Map<string, Uint8Array>(), original: string[] = [], suffix: string[] = [];
  const sim = createShardfileSim(s, assets, { rapier, groups: recipes(original) });
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 301; tick++) sim.host.step();
    restored = restoreSimHost(sim.host.level, { rapier }, snapshotSimHost(sim.host), host => {
      const before = host.rng.stream('ai').snapshot();
      const bound = bindShardfileSim(host, s, assets, { rapier, groups: recipes(suffix), restoring: true });
      expect(bound.groups.size).toBe(2); expect(host.rng.stream('ai').snapshot()).toEqual(before);
    });
    expect(suffix).toEqual([]); original.length = 0;
    for (let tick = 0; tick < 10000; tick++) { sim.host.step(); restored.step(); }
    expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
  } finally { sim.dispose(); restored?.dispose(); }
});
