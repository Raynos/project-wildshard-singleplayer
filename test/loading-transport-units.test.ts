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

test('HTML observation retains exact compiler facts without altering them or hiding absent evidence', async () => {
  const inventory = JSON.stringify({ common: [['/assets/entry.js', 7]], optional: { files: [['/assets/parser.js', 11]], groups: { 'models.gltf': [0] } } });
  const bank = (json: string): string => `<script type="application/json" id="boot-module-files">${json}</script>`;
  let html = `<html><head>${bank(inventory)}</head><body>Unrelated page content</body></html>`;
  const server = createServer((_request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end(html); });
  let observed: Awaited<ReturnType<typeof observeTransport>> | undefined;
  try {
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing fixture address');
    observed = await observeTransport(`http://127.0.0.1:${address.port}/`, { recorder: () => undefined });
    const served = await (await fetch(observed.base)).text();
    expect(served).toContain(bank(inventory));
    expect(observed.htmlFixtures[0]).toEqual({ originalSHA256: createHash('sha256').update(html).digest('hex'),
      injectedSHA256: createHash('sha256').update(served).digest('hex'),
      moduleInventory: { json: inventory, sha256: createHash('sha256').update(inventory).digest('hex') } });
    for (const [head, error] of [['', 'missing'], [bank('{'), 'invalid JSON'], [bank('[]'), 'not an object'],
      [bank(inventory) + bank(inventory), 'duplicate'], [bank(JSON.stringify({ large: 'x'.repeat(1024 * 1024) })), 'over 1 MiB']]) {
      html = `<html><head>${head}</head></html>`;
      expect(await (await fetch(observed.base)).text()).toContain(head);
      expect(observed.htmlFixtures.at(-1)?.moduleInventory).toEqual({ error });
    }
  } finally { await observed?.close(); server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => { resolve(); }); }); }
});


test('encoded chunk observation includes an unfinished response without changing its body', async () => {
  let finish: (() => void) | undefined;
  let signalStarted = (): void => { throw new Error('Start signal not installed'); },
    signalChunk = (): void => { throw new Error('Chunk signal not installed'); };
  const started = new Promise<void>(resolve => { signalStarted = resolve; }), chunk = new Promise<void>(resolve => { signalChunk = resolve; });
  const chunks: { bytes: number; at: number }[] = [], requests: { url: string; startedAt: number }[] = [];
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream' }); response.write('first');
    finish = () => { response.end('last'); }; signalStarted();
  });
  let observed: Awaited<ReturnType<typeof observeTransport>> | undefined;
  try {
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing fixture address');
    observed = await observeTransport(`http://127.0.0.1:${address.port}/`, { transfer: request => {
      requests.push(request); return (bytes, at) => { chunks.push({ bytes, at }); signalChunk(); };
    } });
    const body = fetch(observed.base).then(response => response.text()); await started; await chunk;
    expect(requests).toHaveLength(1); expect(chunks.reduce((sum, row) => sum + row.bytes, 0)).toBe(5);
    expect(observed.receipts).toHaveLength(0); expect(chunks.every(row => row.at >= (requests[0]?.startedAt ?? Infinity))).toBe(true);
    finish?.(); expect(await body).toBe('firstlast');
    expect(chunks.reduce((sum, row) => sum + row.bytes, 0)).toBe(9);
  } finally { finish?.(); await observed?.close(); server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => { resolve(); }); }); }
});
