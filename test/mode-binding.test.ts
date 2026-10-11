import { expect, it } from 'vitest';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
import { withoutRuntimeRows } from '../src/game/plugin/headless';
import source from '../src/shards/far-reach/shard.config';
import { SKY_MODES, SKY_UPDRAFT } from '../src/shards/far-reach/data/modes';
import { inUpdraft } from '../src/game/plugin/mover';
import { inUpdraft as shipping } from './fixtures/modes/nativeUpdraft';

it('admits Sky traversal data only under its native player owner and removes it from the data host', () => {
  expect(source.modes).toEqual(SKY_MODES);
  expect(shardfileRules({ ...source, runtime: null })).toContain('traverse modes require runtime.binds modes until the data client owns their player phase');
  expect(withoutRuntimeRows(source).modes?.traverse).toEqual([]);
  expect(source.modes?.traverse).toEqual([SKY_UPDRAFT]);
  expect(() => parseShardfile({ ...source, runtime: null })).toThrow('shardfile semantic rules');
  expect(() => parseShardfile({ ...source, runtime: { ...source.runtime, binds: source.runtime?.binds?.filter(value => value !== 'modes') } })).toThrow('shardfile semantic rules');
  expect(() => parseShardfile({ ...source, modes: { traverse: [{ ...SKY_UPDRAFT, lift: 65 }] } })).toThrow();
});
it('preserves the authored wind force and every native inside/outside decision', () => {
  let seed = 6417;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 10000; i++) {
    const x = -100 + random() * 140, y = -20 + random() * 80, z = -150 + random() * 120;
    expect(inUpdraft(SKY_UPDRAFT, x, y, z)).toBe(shipping(x, y, z));
  }
  expect(SKY_UPDRAFT.lift).toBe(12);
});
