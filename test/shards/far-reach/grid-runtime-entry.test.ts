import { expect, it } from 'vitest';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import { SkyReachPlugin } from '../../../src/shards/far-reach/runtime/index';

it('resolves only the declared regional entry to the unchanged native Sky Reach constructor', async () => {
  const loaded = await SKY_REACH.load?.();
  if (loaded?.resolveTrustedRuntime === undefined) throw new Error('Missing trusted runtime resolver');
  // Standalone selection is wrapped; the regional resolver still returns the exact native constructor.
  expect(loaded.default).not.toBe(SkyReachPlugin);
  expect(loaded.resolveTrustedRuntime('runtime/index.ts')).toBe(SkyReachPlugin);
  expect(() => loaded.resolveTrustedRuntime?.('runtime/unknown.ts')).toThrow('Unknown trusted runtime entry');
});
