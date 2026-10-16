import { expect, it } from 'vitest';
import { decisionBindingMap } from '@wildshard/sdk/decisionBindingMap';
import { parseDecisionScripts } from '@wildshard/format/decisionScripts';

function script() {
  const row = parseDecisionScripts([{
    id: 'test', abi: '1.0', side: 'sim', module: `blobs/wasm/${'a'.repeat(64)}.wasm`, source: 'behaviour/test.as', binding: { shard: true }, onFail: 'hold',
    on: ['start'], reads: [], commands: [], actors: { zebra: 'actor.last', alpha: 'actor.first' }, timers: ['wait', 'rest'], params: { z: 2, a: 1 }, stateVersion: 1,
    state: [{ name: 'z', type: 'i32', default: 0, scope: 'binding' }, { name: 'a', type: 'i32', default: 0, scope: 'binding' }],
  }])[0];
  if (row === undefined) throw new Error('Missing map fixture'); return row;
}

it('uses authoritative handles, sorted timers/params and authored state order for every consumer', () => {
  const map = decisionBindingMap(script(), { actors: new Map([['actor.last', 71], ['actor.first', 203]]) });
  expect(map.ids.actors).toEqual({ alpha: 203, zebra: 71 });
  expect(map.inverse.actors?.get(71)).toBe('zebra');
  expect(map.ids.timers).toEqual({ rest: 1, wait: 2 }); expect(map.inverse.timers?.get(2)).toBe('wait');
  expect(map.paramNames).toEqual(['a', 'z']); expect(map.stateNames).toEqual(['z', 'a']);
});

it('refuses missing targets, unsafe handles and duplicate real or alias identities', () => {
  const row = script(); expect(() => decisionBindingMap(row, {})).toThrow('Missing actors');
  for (const handle of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 0x80000000]) {
    expect(() => decisionBindingMap(row, { actors: new Map([['actor.last', handle], ['actor.first', 203]]) })).toThrow('registry handle');
  }
  expect(() => decisionBindingMap(row, { actors: new Map([['actor.last', 7], ['actor.first', 7]]) })).toThrow('duplicate');
  expect(() => decisionBindingMap({ ...row, actors: { a: 'actor.first', b: 'actor.first' } }, { actors: new Map([['actor.first', 7]]) })).toThrow('alias handle');
});

it('builds identical compiler and sim handles from real catalogue rows, never aliases or spawn order', async () => {
  const { buildDecisionRegistries, DECISION_PLAYER_HANDLE } = await import('@wildshard/format/decisionBindings');
  const { emptyShardfile } = await import('../src/sdk/author');
  const source = emptyShardfile({ slug: 'binding-test', name: 'Binding', author: 'Test', seed: 2, revision: 1 });
  const spawn = (id: string) => ({ id, species: 'animal', variant: 'animal', brain: null, strike: null, seed: 1, scale: 1, at: [0, 0, 0] as [number, number, number], yaw: 0 });
  source.creatures.spawns = [spawn('actor.last'), spawn('actor.first')];
  source.state.shared = [
    { id: 89, name: 'phase', type: 'i32', privacy: 'public', default: 0, min: 0, max: 3 },
    { id: 42, name: 'secret', type: 'bool', privacy: 'host', default: false },
  ];
  const registry = buildDecisionRegistries(source, []);
  expect([...registry.actors ?? []]).toEqual([['actor.first', 1], ['actor.last', 2]]);
  expect([...registry.fields ?? []]).toEqual([['phase', 89]]);
  expect(registry.actors?.has('actor.player')).toBe(false);
  expect(DECISION_PLAYER_HANDLE).toBe(0x7fffffff);
  expect(decisionBindingMap(script(), registry).ids.actors).toEqual({ alpha: 1, zebra: 2 });
  source.creatures.spawns.reverse();
  expect(decisionBindingMap(script(), buildDecisionRegistries(source, []))).toEqual(decisionBindingMap(script(), registry));
  expect(() => decisionBindingMap({ ...script(), impulses: { shove: 'fake' } }, registry)).toThrow('Missing impulses');
  source.creatures.spawns.push(spawn('actor.first'));
  expect(() => buildDecisionRegistries(source, [])).toThrow('Duplicate');
});

it('uses actual runtime spawn identities in the same namespace and refuses a second owner', async () => {
  const { buildDecisionRegistries } = await import('@wildshard/format/decisionBindings');
  const { emptyShardfile } = await import('../src/sdk/author');
  const source = emptyShardfile({ slug: 'binding-test', name: 'Binding', author: 'Test', seed: 2, revision: 1 });
  const actor = { id: 'actor.retained', kind: 'animal', look: 'animal', at: [0, 0] as [number, number], yaw: 0 };
  source.runtime = { entry: 'runtime/index.ts', binds: ['spawns'], spawns: { homes: [], bosses: [actor], actors: [] } };
  const before = buildDecisionRegistries(source, []);
  expect(before.actors?.get(actor.id)).toBeDefined(); expect(before.spawns).toEqual(before.actors);
  source.runtime.spawns?.actors?.push(actor);
  expect(() => buildDecisionRegistries(source, [])).toThrow('Duplicate');
});
