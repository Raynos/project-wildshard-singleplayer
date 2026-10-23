import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real HTTP content encodings in the proof counter.
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib';
import { decodedBodyCounter } from '../scripts/loading-benchmark/transport.mjs';

test('proof receipts keep compressed wire bytes separate from exact content bytes', async () => {
  const body = new TextEncoder().encode('many repeated module words '.repeat(100));
  for (const [encoding, wire] of [['gzip', gzipSync(body)], ['br', brotliCompressSync(body)], ['deflate', deflateSync(body)]] as const) {
    expect(wire.length).toBeLessThan(body.length);
    const counter = decodedBodyCounter(encoding);
    counter.write(wire.subarray(0, 7)); counter.write(wire.subarray(7));
    await expect(counter.finish()).resolves.toBe(body.length);
  }
  const identity = decodedBodyCounter(); identity.write(body);
  await expect(identity.finish()).resolves.toBe(body.length);
  const corrupt = decodedBodyCounter('gzip'); corrupt.write(body);
  await expect(corrupt.finish()).resolves.toBeNull();
  const unknown = decodedBodyCounter('future-encoding'); unknown.write(body);
  await expect(unknown.finish()).resolves.toBeNull();
});
