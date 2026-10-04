import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseMigrations } from '@wildshard/sdk/migrations';
import { parseShardfile } from '../src/game/shardfile/schema';

it('defaults migrations to empty and admits composed stable-id rename and value mapping', () => {
  const s = emptyShardfile({ slug: 'migration', name: 'Migration', author: 'Test', revision: 2, seed: 1 });
  expect(s.migrations).toEqual([]); s.state.version = 2;
  s.migrations = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 101, name: 'opened' },
    { op: 'map', scope: 'shared', id: 101, type: 'bool', values: [{ from: 1, to: true }, { from: 0, to: false }], fallback: 'reject' }], asHook: null }]);
  expect(parseShardfile(s).migrations).toEqual(s.migrations);
  s.state.version = 1; expect(() => parseShardfile(s)).toThrow();
});
it('refuses author migration hooks and ambiguous duplicate version/field declarations', () => {
  const step = { from: 1, to: 2, fields: [], asHook: null };
  expect(() => parseMigrations([{ ...step, asHook: 'author-migrate' }])).toThrow();
  expect(() => parseMigrations([step, step])).toThrow();
  expect(() => parseMigrations([{ ...step, to: 3 }])).toThrow();
});
