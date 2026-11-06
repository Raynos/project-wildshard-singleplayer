// oxlint-disable-next-line import/no-nodejs-modules -- The worker's reader runs on a built product's bytes.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { loadRapier } from '../src/engine/shared/physics/rapier';
import { answerHeldReads, askHeldReads } from '../src/sdk/standalone/heldReads';
import { fetchServerProduct } from '../src/sdk/standalone/serverProduct';
import { builtProduct } from './fixtures/builtProduct';

test('a held read crosses the port, and a miss or a failed read is a null', async () => {
  const { port1, port2 } = new MessageChannel();
  answerHeldReads(port1, url => url === 'held' ? Promise.resolve(Uint8Array.of(1, 2).buffer) : url === 'broken' ? Promise.reject(new Error('refused')) : Promise.resolve(null));
  const ask = askHeldReads(port2);
  expect([...new Uint8Array(await ask('held') ?? new ArrayBuffer(0))]).toEqual([1, 2]);
  expect(await ask('elsewhere')).toBeNull();
  expect(await ask('broken')).toBeNull();
  port1.close();
});

test('a product the page holds moves nothing over the network', async () => {
  const directory = builtProduct('sunscar-dunes'), root = 'https://held.test/shardfiles/sunscar-dunes/';
  const network = vi.fn(() => Promise.reject(new Error('the network was read')));
  const page = { location: Reflect.get(globalThis, 'location'), fetch: globalThis.fetch };
  Reflect.set(globalThis, 'location', { href: 'https://held.test/b/test/standalone/serverWorker.js' }); Reflect.set(globalThis, 'fetch', network);
  const asked: string[] = [];
  const held = (url: string): Promise<ArrayBuffer | null> => {
    asked.push(url);
    const path = url.startsWith(root) ? url.slice(root.length) : null;
    return Promise.resolve(path === null ? null : Uint8Array.from(readFileSync(`${directory}/${path}`)).buffer);
  };
  const input = await fetchServerProduct(root, await loadRapier(readFileSync('public/assets/physics/rapier.wasm')), held)
    .finally(() => { Reflect.set(globalThis, 'location', page.location); Reflect.set(globalThis, 'fetch', page.fetch); });
  expect(input.shard.identity.slug).toBe('sunscar-dunes');
  expect(asked[0]).toBe(`${root}shard.json`);
  expect(network).not.toHaveBeenCalled();
});
