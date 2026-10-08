import { expect, it } from 'vitest';
import { SUNSCAR_DUNES } from '../../../src/shards/sunscar-dunes/manifest';
import { SignalDunesPlugin } from '../../../src/shards/sunscar-dunes/plugin';

it('resolves only the declared entry to the unchanged standalone Signal Dunes constructor', async () => {
  const loaded = await SUNSCAR_DUNES.load?.();
  if (loaded?.resolveTrustedRuntime === undefined) throw new Error('Missing trusted runtime resolver');
  expect(loaded.default).toBe(SignalDunesPlugin);
  expect(loaded.resolveTrustedRuntime('runtime/index.ts')).toBe(SignalDunesPlugin);
  expect(() => loaded.resolveTrustedRuntime?.('runtime/unknown.ts')).toThrow('Unknown trusted runtime entry');
});
