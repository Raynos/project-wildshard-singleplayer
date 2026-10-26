// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native HTTP body boundary.
import { createServer, request } from 'node:http';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only this bounded publication fixture.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep all fixture output under repository tmp.
import { resolve as pathResolve } from 'node:path';
import { expect, test } from 'vitest';
import { pngReceiver } from '../scripts/tsl-spike/png-upload.mjs';

const png = readFileSync('test/fixtures/world-source/image.png');

async function host(run: (base: string, root: string, receiver: ReturnType<typeof pngReceiver>) => Promise<void>, maximum = png.length, incoming?: () => void): Promise<void> {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(pathResolve('tmp', 'tsl-png-'));
  const receiver = pngReceiver(new Map([['family', pathResolve(root, 'family.png')], ['warmup', null], ['broken', pathResolve(root, 'absent', 'frame.png')]]), maximum);
  const server = createServer((req, res) => { if (!receiver.handle(req, res)) { res.writeHead(404); res.end(); } incoming?.(); });
  try {
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing upload address');
    await run(`http://127.0.0.1:${address.port}`, root, receiver);
  } finally {
    receiver.dispose(); server.closeAllConnections();
    await new Promise<void>((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); });
    rmSync(root, { recursive: true, force: true });
  }
}

test('one native PNG publishes every byte once and warm-up stays discarded', async () => {
  await host(async (base, root) => {
    const send = (name: string) => fetch(`${base}/shot/${name}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
    expect((await send('family')).status).toBe(204);
    expect(readFileSync(pathResolve(root, 'family.png')).equals(png)).toBe(true);
    expect((await send('family')).status).toBe(400);
    expect((await send('warmup')).status).toBe(204);
    expect(existsSync(pathResolve(root, 'warmup.png'))).toBe(false);
    expect((await send('broken')).status).toBe(500);
  });
});

test('undeclared names, wrong method/MIME and closed owners refuse publication', async () => {
  await host(async (base, root, receiver) => {
    expect((await fetch(`${base}/shot/family`)).status).toBe(400);
    expect((await fetch(`${base}/shot/family`, { method: 'POST', body: png })).status).toBe(400);
    expect((await fetch(`${base}/shot/foreign`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).status).toBe(400);
    expect((await fetch(`${base}/other`)).status).toBe(404);
    receiver.dispose(); receiver.dispose();
    expect((await fetch(`${base}/shot/family`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).status).toBe(400);
    expect(existsSync(pathResolve(root, 'family.png'))).toBe(false);
  });
});

test('oversized and invalid PNG bodies never publish a partial file', async () => {
  for (const bytes of [png, new Uint8Array([1, 2, 3])]) {
    await host(async (base, root) => {
      const response = await fetch(`${base}/shot/family`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: bytes });
      expect(response.status).toBe(bytes === png ? 413 : 400);
      expect(existsSync(pathResolve(root, 'family.png'))).toBe(false);
    }, 8);
  }
});

test('an interrupted request releases its chunks without publishing', async () => {
  await host(async (base, root) => {
    await new Promise<void>((resolve, reject) => {
      const sending = request(`${base}/shot/family`, { method: 'POST', headers: { 'content-type': 'image/png', 'content-length': png.length } });
      sending.on('close', resolve);
      sending.on('error', error => { if (sending.destroyed) resolve(); else reject(error); });
      sending.on('socket', socket => { socket.on('connect', () => { sending.write(png.subarray(0, 8), () => { sending.destroy(); }); }); });
    });
    expect(existsSync(pathResolve(root, 'family.png'))).toBe(false);
  });
});

test('invalid receiver limits and escaping names refuse before admission', () => {
  expect(() => pngReceiver(new Map(), 7)).toThrow('limits');
  expect(() => pngReceiver(new Map([['../frame', 'frame.png']]))).toThrow('limits');
});

test('retiring an owner closes its unfinished request without publishing', async () => {
  let accepted = () => { /* Replaced before the server can receive a request. */ };
  const incoming = new Promise<void>(resolve => { accepted = resolve; });
  await host(async (base, root, receiver) => {
    const sending = request(`${base}/shot/family`, { method: 'POST', headers: { 'content-type': 'image/png', 'content-length': png.length } });
    const closed = new Promise<void>((resolve, reject) => {
      sending.on('close', resolve);
      sending.on('error', error => { if (sending.destroyed) resolve(); else reject(error); });
    });
    sending.write(png.subarray(0, 8));
    await incoming;
    receiver.dispose();
    await closed;
    expect(existsSync(pathResolve(root, 'family.png'))).toBe(false);
  }, png.length, () => { accepted(); });
});
