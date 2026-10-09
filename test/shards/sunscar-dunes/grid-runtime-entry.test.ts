import { expect, it } from 'vitest';
import { SUNSCAR_DUNES } from '../../../src/shards/sunscar-dunes/manifest';
import { SignalDunesPlugin } from '../../../src/shards/sunscar-dunes/plugin';

it('resolves only the declared regional entry to the unchanged native Signal Dunes constructor', async () => {
  const loaded = await SUNSCAR_DUNES.load?.();
  if (loaded?.resolveTrustedRuntime === undefined) throw new Error('Missing trusted runtime resolver');
  // Standalone selection is wrapped; the regional resolver still returns the exact native constructor.
  expect(loaded.default).not.toBe(SignalDunesPlugin);
  expect(loaded.resolveTrustedRuntime('runtime/index.ts')).toBe(SignalDunesPlugin);
  expect(() => loaded.resolveTrustedRuntime?.('runtime/unknown.ts')).toThrow('Unknown trusted runtime entry');
});
