// The boot's spawn download, headless (E525). Runs the game's own
// `downloadSpawnManifest` (src/game/client/boot/spawnDownload.ts: the manifest, then
// eight lanes over its files) in Node against the virtual phone link, with the
// real bodies of a target build. Needs `node --experimental-transform-types`.
import { body, prime } from './bodies.mjs';
import { createLink } from './link.mjs';

const SPAWN = new URL('../../src/game/client/boot/spawnDownload.ts', import.meta.url).href;

/** The spawn manifest address the target's HTML declares for `slug`. */
export async function spawnAddress(/** @type {string} */ base, slug = 'driftwood-isle', flow = 'grid', tier = 'phone', mode = '000') {
  const html = await (await fetch(new URL('/', base), { headers: { 'cache-control': 'no-cache' } })).text();
  const match = /<script\b[^>]*\sid=["']boot-module-files["'][^>]*>([\s\S]*?)<\/script\s*>/u.exec(html);
  if (match === null || match[1] === undefined) throw new Error('target HTML has no boot-module-files bank');
  const bank = JSON.parse(match[1]), roots = flow === 'grid' ? bank.spawnManifests?.grid?.[mode] : bank.spawnManifests?.[flow];
  const address = roots?.[slug]?.[tier];
  if (address === undefined) throw new Error(`no spawn manifest for ${flow}/${slug}/${tier}`);
  return address;
}

/** The manifest's files (absolute URLs, wire and decoded bytes), with every body primed to disk. */
export async function spawnFiles(/** @type {string} */ base, /** @type {{ url: string }} */ address) {
  const manifest = JSON.parse((await body(new URL(address.url, base).href)).body.toString('utf8'));
  const urls = manifest.files.map((/** @type {{ url: string }} */ f) => new URL(f.url, base).href);
  await prime(urls);
  const files = [];
  for (const url of urls) { const { meta } = await body(url); files.push({ url, wireBytes: meta.wireBytes, bytes: meta.bytes, encoding: meta.encoding, contentType: meta.contentType }); }
  return { manifest, files };
}

/**
 * Run the real downloadSpawnManifest on a virtual link.
 * @param {string} base
 * @param {import('./link.mjs').LinkOptions} linkOptions
 */
export async function runRealSpawn(base, linkOptions, slug = 'driftwood-isle') {
  const address = await spawnAddress(base, slug);
  await spawnFiles(base, address);
  const { downloadSpawnManifest } = await import(SPAWN);
  // import the lazily imported reader up front, so its real module I/O is not inside the virtual run
  await import(new URL('../../src/engine/client/boot/contentRead.ts', import.meta.url).href);
  const link = createLink(linkOptions);
  const ports = {
    fetch: async (/** @type {string} */ url) => {
      const { meta, body: bytes } = await body(url);
      await link.transfer(meta.wireBytes, url);
      return new Response(new Uint8Array(bytes), { status: meta.status, headers: { 'content-type': meta.contentType || 'application/octet-stream' } });
    },
    cached: () => Promise.resolve(undefined),
  };
  const { ms } = await link.run(() => { const download = downloadSpawnManifest(address, ports, base); return download.ready.then(() => download.snapshot()); });
  return { ms, address, stats: link.stats };
}
