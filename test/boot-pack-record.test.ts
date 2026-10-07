// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { createBootPlan } from '../src/engine/boot/plan';
import { streamPack } from '../src/engine/boot/pack';
import { BYTE_SOURCES, type ByteKey } from '../src/engine/boot/steps';
import type { PackDef } from '../src/engine/boot/tables';
import type { ChunkFiles } from '../src/engine/boot/bytes';

it('records original file requests through the production unavailable-pack fallback', async () => {
  const urls: string[] = [];
  vi.spyOn(window, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    urls.push(url);
    return Promise.resolve(url.startsWith('/assets/packs/') ? new Response(null, { status: 503 }) : new Response(Uint8Array.of(7, 8)));
  });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const files: ChunkFiles = Object.fromEntries(BYTE_SOURCES.map(key => [key, key === 'terrain' ? ['/assets/fixture.bin'] : []])) as Record<ByteKey, string[]>;
  const totals = Object.fromEntries(BYTE_SOURCES.map(key => [key, { bytes: key === 'terrain' ? 2 : 0, files: key === 'terrain' ? 1 : 0 }])) as Record<ByteKey, { bytes: number; files: number }>;
  const pack: PackDef = { bytes: 2, files: [['/assets/fixture.bin', 0, 2, 'application/octet-stream']],
    parts: [{ url: '/assets/packs/fixture.bin', bytes: 2, files: [['/assets/fixture.bin', 0, 2, 'application/octet-stream']] }] };
  const plan = createBootPlan(() => undefined, { totals, schedule: null });
  await streamPack(pack, plan, files);
  const response = await window.fetch('/assets/fixture.bin');
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([7, 8]);
  expect(urls).toEqual(['/assets/packs/fixture.bin', '/assets/fixture.bin']);
  expect(warning).toHaveBeenCalledOnce();
});
