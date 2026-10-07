import { expect, it } from 'vitest';
import template from '../src/shards/_template/shard.config';
import driftwood from '../src/shards/driftwood-isle/shard.config';
import nalati from '../src/shards/nalati-grasslands/shard.config';
import pine from '../src/shards/pine-hollow/shard.config';
import nineDragon from '../src/shards/nine-dragon-stack/shard.config';
import farReach from '../src/shards/far-reach/shard.config';
import sunscar from '../src/shards/sunscar-dunes/shard.config';
import { SHARDFILE_VERSION } from '@wildshard/sdk/version';
import { parseShardfile } from '@wildshard/sdk/shardfile';

it.each([template, driftwood, nalati, pine, nineDragon, farReach, sunscar])('migrates first-party author source $identity.slug atomically with the format constant', source => {
  expect(source.version).toBe(SHARDFILE_VERSION); expect(source.requires.sdk).toBe(SHARDFILE_VERSION);
  expect(parseShardfile(source)).toEqual(source);
  expect(source.sim.commandVersion).toBe(0); expect(source.sim.snapshotVersion).toBe(0);
});
