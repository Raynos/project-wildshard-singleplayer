// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native localhost transport used before CI browser startup.
import { createServer, type Server, type RequestListener } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
import { previewReady } from '../scripts/parity/serve.mjs';

const servers: Server[] = [];
async function server(listener: RequestListener): Promise<string> {
  const instance = createServer(listener); servers.push(instance);
  await new Promise<void>(resolve => { instance.listen(0, '127.0.0.1', resolve); });
  const address = instance.address();
  if (address === null || typeof address === 'string') throw new Error('Expected a TCP preview');
  return `http://127.0.0.1:${address.port}/version.json`;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const instance of servers.splice(0)) {
    instance.closeAllConnections();
    await new Promise<void>((resolve, reject) => { instance.close(error => { if (error) reject(error); else resolve(); }); });
  }
});

it('reads real preview readiness without the undici transport that crashes on CI macOS', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('setTypeOfService EINVAL'); });
  const url = await server((request, response) => {
    expect(request.url).toBe('/version.json');
    response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"build":"real"}');
  });
  expect(await previewReady(url)).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

it('does not treat a preview HTTP failure as ready', async () => {
  const url = await server((_request, response) => { response.writeHead(503); response.end(); });
  expect(await previewReady(url)).toBe(false);
});

it('bounds an accepted connection that never sends response headers', async () => {
  const url = await server(() => undefined);
  expect(await previewReady(url, 30)).toBe(false);
});
