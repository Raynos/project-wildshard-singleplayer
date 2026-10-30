// oxlint-disable-next-line import/no-nodejs-modules -- Preserve the native build-only gzip byte contract.
import { gzipSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The build-only memo keys the exact transform by content.
import { createHash, randomBytes } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The memo lives in the CI-cached gen root, outside the product.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The default memo root is the user's cache folder.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Memo paths are joined, never read from input.
import { resolve } from 'node:path';
import { DataUtils } from 'three';

const sha = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
/** level-9 gzip of a sky's planes, the shipped OS marker set: the same bytes for the same input, zlib and Node */
function gzipGainKey(input: Uint8Array): Uint8Array {
  const bytes = gzipSync(input, { level: 9 });
  bytes[9] = 19;
  return bytes;
}
// CI6: the gzip is most of a keyed sky's bake (1.4 s of Pine's product worker, on its critical path) and its input is the
// sky art, which rarely changes. Every byte the transform depends on is in the key; a hit re-hashes its body.
const codec = sha(JSON.stringify({ schema: 'gain-key-gzip/1', node: process.version, zlib: process.versions.zlib, platform: process.platform,
  arch: process.arch, level: 9, implementation: gzipGainKey.toString() }));
const memoRoot = process.env['WILDSHARD_GAIN_KEY_CACHE'] ?? resolve(homedir(), '.cache/wildshard/gen/gain-key/1');

/** Keep the shipped gzip OS marker stable across Darwin and Linux producers. An exact memo in the gen cache returns the
 *  same bytes for the same planes; a missing, corrupt or unwritable memo runs the gzip. */
export function encodeGainKey(data: Uint16Array): Uint8Array {
  const input = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const key = sha(`${codec}\0${input.byteLength}\0${sha(input)}`), body = resolve(memoRoot, `${key}.bin`), meta = resolve(memoRoot, `${key}.json`);
  try {
    const saved: unknown = JSON.parse(readFileSync(meta, 'utf8'));
    if (typeof saved === 'object' && saved !== null && 'key' in saved && saved.key === key && 'hash' in saved && typeof saved.hash === 'string') {
      const bytes = readFileSync(body);
      if (sha(bytes) === saved.hash) return new Uint8Array(bytes);
    }
  } catch { /* no memo yet, or a damaged one: compute */ }
  const bytes = gzipGainKey(input), suffix = `.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    mkdirSync(memoRoot, { recursive: true });
    writeFileSync(body + suffix, bytes, { flag: 'wx' }); renameSync(body + suffix, body);
    writeFileSync(meta + suffix, JSON.stringify({ key, hash: sha(bytes) }), { flag: 'wx' }); renameSync(meta + suffix, meta);
  } catch { /* the memo is optional: storage never changes the build */ }
  finally { for (const file of [body + suffix, meta + suffix]) try { rmSync(file, { force: true }); } catch { /* own temporaries only */ } }
  return bytes;
}

/** Pack display colour/gain planes into owned RGB half texels with the original unrounded horizon means. */
export function packGainKey(color: Uint8Array, gain: Uint8Array, width: number, height: number): { data: Uint16Array<ArrayBuffer>; horizon: number[] } {
  if (color.length !== width * height * 4 || gain.length !== color.length) throw new Error('Sky plane sizes differ');
  const lin = new Float32Array(256), lut = new Uint16Array(65536);
  const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  const half = (value: number): number => {
    f32[0] = value; const x = u32[0];
    if (x === undefined) throw new Error('Missing half-float word');
    const e = ((x >>> 23) & 255) - 112, m = x & 0x7fffff;
    if (e >= 31) return 0x7bff;
    if (e <= 0) return e < -10 ? 0 : ((((m | 0x800000) >>> (1 - e)) + 0x1000) >>> 13);
    return (e << 10) + ((m + 0x1000) >>> 13);
  };
  for (let c = 0; c < 256; c++) { const s = c / 255; lin[c] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
  for (let g = 0; g < 256; g++) for (let c = 0; c < 256; c++) {
    const linear = lin[c]; if (linear === undefined) throw new Error('Missing linear colour');
    lut[g * 256 + c] = half(Math.min(65504, linear * 2 ** (g / 255 * 16)));
  }
  const data = new Uint16Array(width * height * 3), horizon = [0, 0, 0], row = Math.floor(height * 0.47);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4, gainByte = gain[i];
    if (gainByte === undefined) throw new Error('Missing gain texel');
    const at = gainByte * 256;
    for (let c = 0; c < 3; c++) {
      const colorByte = color[i + c]; if (colorByte === undefined) throw new Error('Missing colour texel');
      const value = lut[at + colorByte]; if (value === undefined) throw new Error('Missing gain lookup');
      data[p * 3 + c] = value;
      if (Math.floor(p / width) === row && p % width % 4 === 0) {
        const sum = horizon[c]; if (sum === undefined) throw new Error('Missing horizon channel');
        horizon[c] = sum + DataUtils.fromHalfFloat(value);
      }
    }
  }
  return { data, horizon: horizon.map(c => c / Math.ceil(width / 4)) };
}
