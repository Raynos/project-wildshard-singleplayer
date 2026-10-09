// SF64: decoded PCM is charged to the file it came from, not to a content hash under the generic level scope.
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { cachedBytes, decodeBytes } from '../../../src/engine/audio/preload';
import { memoryAttribution } from '../../../src/engine/core/memoryAttribution';

beforeAll(() => {
  vi.stubGlobal('OfflineAudioContext', class {
    decodeAudioData(): Promise<AudioBuffer> { return Promise.resolve({ duration: 1, length: 300000, numberOfChannels: 2 } as AudioBuffer); }
  });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(Uint32Array.of(4242).buffer))));
});
afterAll(() => { vi.unstubAllGlobals(); });

it('charges a fetched recording to its file, and a decode outside any shard scope to the file folder', async () => {
  const buffer = await decodeBytes(await cachedBytes('https://example.test/assets/music/piano/pine-tension-cc014e5b.m4a?v=2'));
  const row = memoryAttribution.snapshot().allocations.find(allocation => allocation.asset === 'audio/assets/music/piano/pine-tension-cc014e5b.m4a');
  expect(row).toMatchObject({ owner: 'audio:assets/music/piano', domain: 'ram', bytes: 300000 * 2 * 4 });
  expect(buffer.length).toBe(300000);
});
