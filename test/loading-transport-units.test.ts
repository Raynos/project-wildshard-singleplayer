import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real HTTP content encodings in the proof counter.
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Serve exact old/new fixture bytes on one observed origin.
import { createServer, type Server } from 'node:http';
// oxlint-disable-next-line import/no-nodejs-modules -- Independently verify the streamed proof digest.
import { createHash } from 'node:crypto';
import { decodedBodyCounter, observeTransport } from '../scripts/loading-benchmark/transport.mjs';

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


test('upgrade observation switches upstreams while retaining one browser origin and exact script bytes', async () => {
  const old = createServer((_request, response) => { response.writeHead(200, {'content-type': 'text/javascript', 'service-worker-allowed': '/'}); response.end('old worker'); });
  const next = createServer((_request, response) => { response.writeHead(200, {'content-type': 'text/javascript', 'service-worker-allowed': '/'}); response.end('new worker'); });
  const listen = async (server: Server): Promise<string> => {
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing fixture address');
    return `http://127.0.0.1:${address.port}/`;
  };
  const close = (server: Server): Promise<void> => new Promise(resolve => { server.closeAllConnections(); server.close(() => { resolve(); }); });
  let observed: Awaited<ReturnType<typeof observeTransport>> | undefined;
  try {
    const oldURL = await listen(old), nextURL = await listen(next);
    let upstream = oldURL;
    observed = await observeTransport(() => upstream, { bodyHashes: true });
    const url = new URL('sw.js', observed.base).href, before = await fetch(url);
    expect(await before.text()).toBe('old worker'); expect(before.headers.get('service-worker-allowed')).toBe('/');
    upstream = nextURL;
    const after = await fetch(url);
    expect(await after.text()).toBe('new worker'); expect(after.url).toBe(url);
    expect(observed.htmlFixtures).toEqual([]);
    expect(observed.receipts.map(row => row.url)).toEqual([new URL('sw.js', oldURL).href, new URL('sw.js', nextURL).href]);
    expect(observed.receipts.map(row => row.bodySHA256)).toEqual(['old worker', 'new worker'].map(body => createHash('sha256').update(body).digest('hex')));
    expect(observed.receipts.every(row => row.bodyEncoding === 'identity' && row.startedAt <= row.endedAt)).toBe(true);
  } finally { await observed?.close(); await close(old); await close(next); }
});
