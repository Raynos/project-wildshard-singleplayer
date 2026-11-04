// @vitest-environment happy-dom
// DL11 (sp-x2's review of e189c45834): a fetch layer installed after the spawn download's own (the byte counter's
// texture-pack reads) re-issues a request under its own signal. The download must never read through such a layer, or its
// request comes back to the spawn layer as a page read of a listed file and waits for itself. Own file: the module's first
// fetch layer captures the network beneath it once per page.
import {expect, test, vi} from 'vitest';
import {releaseSpawnMembers, startSpawnDownload} from '../src/game/boot/spawnDownload';

const ktx2 = {url: `/shardfiles/overlap/blobs/ktx2/${'e'.repeat(64)}.ktx2`, bytes: 6, hash: 'e'.repeat(64)};
const manifest = {version: 1, shard: 'overlap', tier: 'phone', flow: 'client', files: [ktx2], totalBytes: 6};
const text = JSON.stringify(manifest), address = {url: '/assets/spawn/overlap-1234567890abcdef.json', bytes: text.length, totalBytes: 6, files: 1};

test('a later layer that re-issues a listed read under its own signal cannot make the download wait for itself', async () => {
  const network = vi.fn((input: RequestInfo | URL) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    return Promise.resolve(new Response(path === address.url ? text : path === ktx2.url ? new Uint8Array(6).fill(7) : 'network'));
  });
  vi.stubGlobal('fetch', network);
  document.body.innerHTML = `<script id="boot-module-files" type="application/json">${JSON.stringify({spawnManifests: {client: {overlap: {phone: address}}}})}</script>`;
  const download = startSpawnDownload('overlap', 'client', 'phone');
  if (download === null) throw new Error('No spawn download');
  // The texture-pack reader's shape (texturePack.ts `direct`): a .ktx2 read goes to the layer beneath under a new signal.
  const inner = window.fetch, reissued: string[] = [];
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith('.ktx2')) return inner(input, init);
    reissued.push(new URL(url).pathname);
    return inner(url, {signal: new AbortController().signal});
  };
  await download.ready;
  expect(download.snapshot()).toMatchObject({complete: true, filesDone: 1});
  // the download never entered the later layer; a page read through it waits for the file, then reaches the network
  expect(reissued).toEqual([]);
  expect((await (await window.fetch(new URL(ktx2.url, location.href).href)).arrayBuffer()).byteLength).toBe(6);
  expect(reissued).toEqual([ktx2.url]);
  releaseSpawnMembers(); download.cancel();
  vi.unstubAllGlobals();
});
