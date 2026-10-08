import { expect, it } from 'vitest';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import { SkyReachPlugin } from '../../../src/shards/far-reach/runtime/index';

it('resolves only the declared entry to the unchanged standalone Sky Reach constructor', async () => {
  const loaded = await SKY_REACH.load?.();
  if (loaded?.resolveTrustedRuntime === undefined) throw new Error('Missing trusted runtime resolver');
  expect(loaded.default).toBe(SkyReachPlugin);
  expect(loaded.resolveTrustedRuntime('runtime/index.ts')).toBe(SkyReachPlugin);
  expect(() => loaded.resolveTrustedRuntime?.('runtime/unknown.ts')).toThrow('Unknown trusted runtime entry');
});
