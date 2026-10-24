import { expect, test } from 'vitest';
import * as v from 'valibot';
import { RuntimeSchema } from '../src/format/runtime';
import { parseShardfile } from '../src/format/shardSchema';
import pine from '../src/shards/pine-hollow-legacy/shard.config';
import driftwood from '../src/shards/driftwood-isle-legacy/shard.config';
import nalati from '../src/shards/nalati-grasslands-legacy/shard.config';

test.each([pine,driftwood,nalati])('frozen $identity.slug keeps its trusted runtime data through the shared schema',source=>{
  expect(source.identity.slug.endsWith('-legacy')).toBe(true);
  expect(source.runtime).toHaveProperty('entry');
  expect(source.manifest).toBeUndefined();
  expect(parseShardfile(source)).toEqual(source);
  expect(v.parse(RuntimeSchema,source.runtime)).toEqual(source.runtime);
});
