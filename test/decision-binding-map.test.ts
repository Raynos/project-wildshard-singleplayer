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
