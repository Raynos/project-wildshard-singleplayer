import { expect, it } from 'vitest';
import { NALATI_GRASSLANDS } from '../../../src/shards/nalati-grasslands/manifest';
import RuntimePlugin from '../../../src/shards/nalati-grasslands/runtime/index';
import HybridPlugin from '../../../src/shards/nalati-grasslands/plugin';

it('resolves only the declared regional constructor through the unchanged standalone plugin loader', async () => {
  const loaded = await NALATI_GRASSLANDS.load?.();
  if (loaded?.resolveTrustedRuntime === undefined) throw new Error('Missing trusted runtime resolver');
  expect(loaded.default).toBe(HybridPlugin);
  expect(loaded.resolveTrustedRuntime('runtime/index.ts')).toBe(RuntimePlugin);
  expect(() => loaded.resolveTrustedRuntime?.('runtime/unknown.ts')).toThrow('Unknown trusted runtime entry');
});
