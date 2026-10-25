import { expect, test, vi } from 'vitest';
import { sendPaintedCanvas } from '../src/shards/pine-hollow/generators/paintedBytes';

function canvas(blob: Blob | null) {
  return { width: 7, height: 3,
    toBlob: vi.fn((done: BlobCallback, _type?: string, _quality?: number) => { done(blob); }),
  };
}

test.each([
  { type: 'image/webp' as const, ext: 'webp', quality: 0.92 },
  { type: 'image/webp' as const, ext: 'webp', quality: 0.9 },
  { type: 'image/png' as const, ext: 'png', quality: undefined },
])('hands off the exact $type blob at original quality $quality', async ({ type, ext, quality }) => {
  const bytes = new Uint8Array([0, 128, 255]), blob = new Blob([bytes], { type }), image = canvas(blob);
  const send = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
  await expect(sendPaintedCanvas('chalk', image, type, 'https://paint.invalid/bytes/', quality, send)).resolves.toEqual({ ext, width: 7, height: 3 });
  expect(image.toBlob).toHaveBeenCalledExactlyOnceWith(expect.any(Function), type, quality);
  expect(send).toHaveBeenCalledExactlyOnceWith('https://paint.invalid/bytes/chalk', { method: 'POST', body: blob });
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
});

test('preserves the native PNG fallback when WebP encoding is unavailable', async () => {
  const send = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
  const row = await sendPaintedCanvas('chalk', canvas(new Blob(['native PNG'], { type: 'image/png' })), 'image/webp', 'https://paint.invalid/bytes/', 0.9, send);
  expect(row).toEqual({ ext: 'png', width: 7, height: 3 });
});

test('refuses absent or unsupported encoded images before uploading', async () => {
  const send = vi.fn<typeof fetch>();
  await expect(sendPaintedCanvas('glow', canvas(null), 'image/png', 'https://paint.invalid/bytes/', undefined, send)).rejects.toThrow('encoding failed');
  await expect(sendPaintedCanvas('glow', canvas(new Blob(['wrong'], { type: 'text/plain' })), 'image/png', 'https://paint.invalid/bytes/', undefined, send)).rejects.toThrow('unsupported encoded format');
  expect(send).not.toHaveBeenCalled();
});

test('refuses rejected or failed uploads without reporting a completed image', async () => {
  const image = canvas(new Blob(['native PNG'], { type: 'image/png' }));
  const send = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 400 })));
  await expect(sendPaintedCanvas('glow', image, 'image/png', 'https://paint.invalid/bytes/', undefined, send)).rejects.toThrow('handoff refused');
  send.mockRejectedValueOnce(new Error('transport failed'));
  await expect(sendPaintedCanvas('glow', image, 'image/png', 'https://paint.invalid/bytes/', undefined, send)).rejects.toThrow('transport failed');
});
