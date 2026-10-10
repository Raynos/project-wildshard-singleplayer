// oxlint-disable-next-line import/no-nodejs-modules -- Read the public defining-module map without constructing game services.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ShardPlugin } from '../src/game/plugin/shardPlugin';

it('publishes the defining context and preserves the exact staged constructor for frozen consumers', async () => {
  const { ShardPlugin: LegacyPlugin } = await import('@wildshard/game/shard/plugin');
  const manifest: unknown = JSON.parse(readFileSync('src/game/package.json', 'utf8'));
  if (manifest === null || typeof manifest !== 'object' || !('exports' in manifest)) throw new Error('Missing game exports');
  expect(manifest.exports).toMatchObject({ './plugin/context': './plugin/context.ts', './shard/context': './plugin/context.ts', './shard/plugin': './plugin/shardPlugin.ts', './plugin/shardPlugin': './plugin/shardPlugin.ts' });
  expect(ShardPlugin).toBe(LegacyPlugin);
  class Probe extends ShardPlugin {}
  expect(new Probe()).toBeInstanceOf(LegacyPlugin);
});
