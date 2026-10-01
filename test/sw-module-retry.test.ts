// oxlint-disable-next-line import/no-nodejs-modules -- Execute the production SW handler in a worker-shaped sandbox.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The SW is a stamped script, not a Node import.
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface FetchEvent { request: Request; respondWith: (value: Promise<Response>) => void }
function worker(replies: (() => Response)[]) {
  const waits: number[] = [], attempts: Request[] = [], kept: Response[] = [];
  let handler: (event: FetchEvent) => void = () => { throw new Error('No fetch handler'); };
  const cache = { match: () => undefined, put: (_req: Request, res: Response) => { kept.push(res); return Promise.resolve(); } };
  const source = readFileSync(new URL('../src/engine/pwa/sw.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/mu, '').replaceAll('__BUNDLE__', '[]').replaceAll('__FONTS__', '[]');
  runInNewContext(source, {
    URL, Request, Response, console,
    self: { location: { origin: 'https://game.test' }, navigator: { onLine: true } },
    caches: { open: () => Promise.resolve(cache) },
    workerScope: {
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Model the worker's actual listener registration API.
      listen: (_target: object, name: string, callback: (event: FetchEvent) => void) => { if (name === 'fetch') handler = callback; },
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Record Scope timer backoff while releasing its callback immediately in this fixture.
      timeout: (ms: number, callback: () => void) => { waits.push(ms); queueMicrotask(callback); },
    },
    fetch: (req: Request) => { attempts.push(req); const next = replies.shift(); if (!next) throw new Error('Unexpected fetch'); return Promise.resolve(next()); },
  });
  const request = (path: string, destination: string): Promise<Response> => {
    const req = new Request(`https://game.test${path}`);
    Object.defineProperty(req, 'destination', { value: destination });
    let response: Promise<Response> | undefined;
    handler({ request: req, respondWith: (value) => { response = value; } });
    if (!response) throw new Error('Fetch was not handled');
    return response;
  };
  return { request, waits, attempts, kept };
}
const broken = (): Response => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('radio cut')); } }));
describe('service-worker module network retries', () => {
  it('withholds two broken script bodies, backs off, and stores only a complete third response', async () => {
    const w = worker([broken, broken, () => new Response('export const ok = true;')]);
    const response = await w.request('/unhashed-module.js', 'script');
    expect(await response.text()).toBe('export const ok = true;');
    expect(w.waits).toEqual([700, 2000]);
    expect(w.attempts.map((req) => req.cache)).toEqual(['default', 'reload', 'reload']);
    expect(w.kept).toHaveLength(1);
    expect(await w.kept[0]?.text()).toBe('export const ok = true;');
  });
  it('rejects a third broken script body without storing partial bytes', async () => {
    const w = worker([broken, broken, broken]);
    await expect(w.request('/unhashed-module.js', 'script')).rejects.toThrow('radio cut');
    expect(w.waits).toEqual([700, 2000]);
    expect(w.attempts).toHaveLength(3);
    expect(w.kept).toEqual([]);
  });
  it('leaves a non-script response streaming without module retry backoff', async () => {
    const w = worker([broken]);
    const response = await w.request('/assets/title/picture.jpg', 'image');
    await expect(response.text()).rejects.toThrow('radio cut');
    expect(w.waits).toEqual([]);
    expect(w.attempts).toHaveLength(1);
  });
});
