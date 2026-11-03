// Download levers, measured on the virtual phone link (E525).
//
// `mirror` replays the spawn download's shape (the manifest, then N lanes over
// its files in manifest order, as src/game/boot/spawnDownload.ts does with
// N = 8) with real wire sizes. main.mjs checks mirror(8) against the real
// module before it trusts any lever.
import { brotliCompressSync, constants } from 'node:zlib';
import { body } from './bodies.mjs';
import { createLink } from './link.mjs';

/**
 * @typedef {{ url: string, wireBytes: number, bytes: number, encoding: string, contentType: string }} File
 * @typedef {{ lanes?: number, manifestBytes?: number, startMs?: number }} MirrorOptions
 */

/** @param {File[]} files @param {import('./link.mjs').LinkOptions} link @param {MirrorOptions} options */
export async function mirror(files, link, options = {}) {
  const lanes = options.lanes ?? 8, l = createLink(link);
  const { ms } = await l.run(async () => {
    if ((options.startMs ?? 0) > 0) await l.delay(options.startMs ?? 0);
    if (options.manifestBytes !== undefined) await l.transfer(options.manifestBytes, 'manifest');
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(lanes, files.length) }, async () => {
      for (let i = next++; i < files.length; i = next++) { const f = files[i]; if (f !== undefined) await l.transfer(f.wireBytes, f.url); }
    }));
  });
  return ms;
}

/** Concatenate files into `count` packs of roughly equal wire size (order kept). */
export function packed(/** @type {File[]} */ files, count) {
  const total = files.reduce((s, f) => s + f.wireBytes, 0), target = total / count, out = /** @type {File[]} */ ([]);
  let wire = 0, bytes = 0;
  for (const f of files) {
    wire += f.wireBytes; bytes += f.bytes;
    if (wire >= target) { out.push({ url: `pack-${out.length}`, wireBytes: wire, bytes, encoding: 'br', contentType: 'application/octet-stream' }); wire = 0; bytes = 0; }
  }
  if (wire > 0) out.push({ url: `pack-${out.length}`, wireBytes: wire, bytes, encoding: 'br', contentType: 'application/octet-stream' });
  return out;
}

/** Files under `limit` wire bytes bundled into one pack at the front; big files stay separate. */
export function bundleSmall(/** @type {File[]} */ files, limit = 64 * 1024) {
  const small = files.filter(f => f.wireBytes < limit), big = files.filter(f => f.wireBytes >= limit);
  return [...packed(small, 1), ...big];
}

/** Brotli (quality 11, large window) of every body that the server sent uncompressed or compressed worse. */
export async function brotliBest(/** @type {File[]} */ files, quality = 11) {
  const out = [];
  for (const f of files) {
    const { body: bytes } = await body(f.url);
    const br = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: quality, [constants.BROTLI_PARAM_LGWIN]: 24, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } });
    out.push({ ...f, wireBytes: Math.min(f.wireBytes, br.length) });
  }
  return out;
}
