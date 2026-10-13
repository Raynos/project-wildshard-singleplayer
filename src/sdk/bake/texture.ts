import * as v from 'valibot';
import { hashImmutableBytes } from '../immutable';
// oxlint-disable-next-line import/no-nodejs-modules -- Trusted author tools run the local, pinned texture encoder at build time.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Encoder throwaways belong to one temporary directory and are always removed.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Portable temporary directory for the author CLI.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only filenames inside the encoder's owned temporary directory.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Pinned Node's deterministic Zstd stores exact admitted raster bytes.
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { parseKtx2 } from '../assets';
import { readImagePixels, writeImagePixels } from './image';

/** Bake PNG colour pixels to mipmapped sRGB UASTC KTX2; the engine's existing loader transcodes these blocks to ASTC. */
export function bakeColourTexture(png: Uint8Array, encoder = 'basisu', options: { flipY?: boolean } = {}): Uint8Array {
  if (png.length < 24 || png.length > 25_000_000 || png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71) throw new Error('Texture source must be a bounded PNG');
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength), width = header.getUint32(16), height = header.getUint32(20);
  if (width === 0 || height === 0 || width > 4096 || height > 4096) throw new Error('Texture dimensions exceed cap');
  const directory = mkdtempSync(join(tmpdir(), 'wildshard-texture-'));
  try {
    const input = join(directory, 'colour.png'), output = join(directory, 'colour.ktx2'); writeFileSync(input, png);
    execFileSync(encoder, ['-ktx2', '-uastc', '-uastc_level', '2', '-srgb', '-mipmap', '-mip_filter', 'box', '-max_threads', '4', '-ktx2_zstandard_level', '20', ...(options.flipY === true ? ['-y_flip'] : []), input, '-output_file', output], { stdio: 'pipe', timeout: 120000 });
    const bytes = Uint8Array.from(readFileSync(output)); parseKtx2(bytes); return bytes;
  } finally { rmSync(directory, { recursive: true }); }
}

/** Store bounded PNG/JPEG/WebP pixels byte-exact in a single-level Zstd RGBA8 KTX2.
 * No lossy encoder or colour transform runs. flipY explicitly selects source row orientation;
 * colourSpace:'linear' retains numerical texture values (default: sRGB).
 * look.samplers mips:'gpu' uses the runtime's existing mip law, as for a painted bitmap. */
export async function bakeRawColourTexture(image: Uint8Array, options: { flipY?: boolean; colourSpace?: 'srgb' | 'linear' } = {}): Promise<Uint8Array> {
  const linear = v.parse(v.picklist(['srgb', 'linear']), options.colourSpace ?? 'srgb') === 'linear';
  const { width, height, pixels } = await readImagePixels(image, options);
  const packed = zstdCompressSync(pixels, { params: { [constants.ZSTD_c_compressionLevel]: 19 } });
  const descriptorSize = 92, offset = 104 + descriptorSize, out = new Uint8Array(offset + packed.length), view = new DataView(out.buffer);
  out.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  // RGBA8 with explicit transfer, one Zstd level. Descriptor and level bytes never overlap.
  [linear ? 37 : 43, 1, width, height, 0, 0, 1, 1, 2, 104, descriptorSize].forEach((value, i) => { view.setUint32(12 + i * 4, value, true); });
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(pixels.length), true);
  view.setUint32(104, descriptorSize, true); view.setUint16(112, 2, true); view.setUint16(114, descriptorSize - 4, true); out.set([1, 1, linear ? 1 : 2, 0], 116);
  for (let channel = 0; channel < 4; channel++) {
    const at = 132 + channel * 16; view.setUint16(at, channel * 8, true); out[at + 2] = 7; out[at + 3] = channel === 3 ? 15 : channel; view.setUint32(at + 12, 255, true);
  }
  out.set(packed, offset); parseKtx2(out); return out;
}

/** Repack existing zstd KTX2 mip payloads without changing a decoded byte.
 * Keep each original block if it is smaller; preserve metadata and physical
 * mip order. Explicit authoring only, never runtime or ordinary builds. */
export function repackKtx2Lossless(bytes: Uint8Array): Uint8Array {
  parseKtx2(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(44, true) !== 2) throw new Error('Lossless repack requires zstd KTX2');
  const levels = view.getUint32(40, true), mips: { mip: number; offset: number; packed: Uint8Array; raw: Uint8Array }[] = [];
  for (let mip = 0; mip < levels; mip++) {
    const offset = Number(view.getBigUint64(80 + mip * 24, true)), length = Number(view.getBigUint64(88 + mip * 24, true)), size = Number(view.getBigUint64(96 + mip * 24, true));
    if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 * 1024) throw new Error('Lossless mip output bound');
    const raw = zstdDecompressSync(bytes.subarray(offset, offset + length), { maxOutputLength: size });
    if (raw.length !== size) throw new Error('Lossless mip decoded length');
    let packed: Uint8Array = bytes.subarray(offset, offset + length);
    for (const level of [21, 22]) {
      const candidate = zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: level } });
      if (!zstdDecompressSync(candidate, { maxOutputLength: size }).equals(raw)) throw new Error('Lossless mip identity');
      if (candidate.length < packed.length) packed = candidate;
    }
    mips.push({ mip, offset, packed, raw });
  }
  mips.sort((a, b) => a.offset - b.offset);
  const first = mips[0], last = mips.at(-1);
  if (first === undefined || last === undefined) throw new Error('Lossless mip roster');
  const lastLength = Number(view.getBigUint64(88 + last.mip * 24, true));
  if (last.offset + lastLength !== bytes.length) throw new Error('Lossless repack refuses unread tail');
  const header = Uint8Array.from(bytes.subarray(0, first.offset)), patched = new DataView(header.buffer), chunks: Uint8Array[] = [header];
  let size = header.length;
  for (const mip of mips) {
    patched.setBigUint64(80 + mip.mip * 24, BigInt(size), true);
    patched.setBigUint64(88 + mip.mip * 24, BigInt(mip.packed.length), true);
    chunks.push(mip.packed); size += mip.packed.length;
  }
  if (size >= bytes.length) return bytes;
  const output = new Uint8Array(size); let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  const final = new DataView(output.buffer);
  for (const mip of mips) {
    const offset = Number(final.getBigUint64(80 + mip.mip * 24, true)), length = Number(final.getBigUint64(88 + mip.mip * 24, true));
    if (!zstdDecompressSync(output.subarray(offset, offset + length), { maxOutputLength: mip.raw.length }).equals(mip.raw)) throw new Error('Final lossless mip identity');
  }
  parseKtx2(output); return output;
}

const sampler = v.strictObject({ filter: v.literal('linear'), wrap: v.optional(v.literal('repeat')), anisotropy: v.optional(v.literal(4)) });
const row = v.strictObject({ source: v.pipe(v.string(), v.regex(/^\/assets\/[a-zA-Z0-9/_-]+\.webp$/u)),
  asset: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))), sampler });
const catalogue = v.pipe(v.record(v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u)), row), v.check(value => Object.keys(value).length > 0 && Object.keys(value).length <= 32));

/** Emit charged exact-source library descriptors; encode is an explicit offline update, never a build prerequisite. */
export async function bakeTextureLibrary(root: string, input: string, options: { encode: boolean; check: boolean }): Promise<void> {
  const source = resolve(root, input), project = dirname(dirname(source));
  if (!source.startsWith(`${resolve(root, 'src/shards')}/`) || !source.endsWith('Sources.json')) throw new Error('Library source catalogue must be an authored shard data Sources.json');
  const raw: unknown = JSON.parse(readFileSync(source, 'utf8'));
  const rows = v.parse(catalogue, raw), files: Record<string, { hash: string; kind: 'ktx2'; compressed: number; decoded: number; gpu: number; triangles: number; draws: number; dependencies: string[]; critical: boolean }> = {};
  mkdirSync(join(project, 'assets'), { recursive: true });
  let pinsChanged = false;
  for (const [name, declaration] of Object.entries(rows)) {
    const image = Uint8Array.from(readFileSync(join(root, 'public', declaration.source)));
    const raster = await readImagePixels(image);
    if (options.encode) {
      const png = await writeImagePixels(raster);
      const bytes = repackKtx2Lossless(bakeColourTexture(png, 'basisu', { flipY: true })), hash = hashImmutableBytes(bytes);
      pinsChanged ||= declaration.asset !== hash;
      declaration.asset = hash; writeFileSync(join(project, 'assets', hash), bytes);
    }
    if (declaration.asset === undefined) throw new Error(`Library map ${name} needs its encoded asset pin`);
    const bytes = Uint8Array.from(readFileSync(join(project, 'assets', declaration.asset)));
    if (hashImmutableBytes(bytes) !== declaration.asset) throw new Error(`Library map ${name} content hash mismatch`);
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = header.getUint32(20, true), height = header.getUint32(24, true);
    if (width !== raster.width || height !== raster.height) throw new Error(`Library map ${name} changed source dimensions`);
    Reflect.set(files, name, { hash: declaration.asset, kind: 'ktx2', compressed: bytes.length, ...parseKtx2(bytes), dependencies: [], critical: false });
    console.info(`library ${name}: ${width}x${height}, ${bytes.length} bytes, ${declaration.asset}`);
  }
  if (options.encode && pinsChanged) writeFileSync(source, `${JSON.stringify(rows, null, 2)}\n`);
  const output = source.replace(/Sources\.json$/u, 's.json'), values = Object.values(files);
  const product = { maps: files, files: values, library: values.map(file => file.hash), budget: { compressed: values.reduce((sum, file) => sum + file.compressed, 0), resident: values.reduce((sum, file) => sum + file.decoded + file.gpu, 0) } };
  const payload = `${JSON.stringify(product, null, 2)}\n`;
  if (options.check) { if (readFileSync(output, 'utf8') !== payload) throw new Error(`Stale library metadata ${output}`); }
  else writeFileSync(output, payload);
}
