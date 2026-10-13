// oxlint-disable-next-line import/no-nodejs-modules -- Trusted author tools run the local, pinned texture encoder at build time.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Encoder throwaways belong to one temporary directory and are always removed.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Portable temporary directory for the author CLI.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only filenames inside the encoder's owned temporary directory.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Pinned Node's deterministic Zstd stores exact admitted raster bytes.
import { constants, zstdCompressSync } from 'node:zlib';
import { parseKtx2 } from '../assets';
import { readImagePixels } from './image';

/** Bake PNG colour pixels to mipmapped sRGB UASTC KTX2; the engine's existing loader transcodes these blocks to ASTC. */
export function bakeColourTexture(png: Uint8Array, encoder = 'basisu'): Uint8Array {
  if (png.length < 24 || png.length > 25_000_000 || png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71) throw new Error('Texture source must be a bounded PNG');
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength), width = header.getUint32(16), height = header.getUint32(20);
  if (width === 0 || height === 0 || width > 4096 || height > 4096) throw new Error('Texture dimensions exceed cap');
  const directory = mkdtempSync(join(tmpdir(), 'wildshard-texture-'));
  try {
    const input = join(directory, 'colour.png'), output = join(directory, 'colour.ktx2'); writeFileSync(input, png);
    execFileSync(encoder, ['-ktx2', '-uastc', '-uastc_level', '2', '-srgb', '-mipmap', '-mip_filter', 'box', '-max_threads', '4', '-ktx2_zstandard_level', '20', input, '-output_file', output], { stdio: 'pipe', timeout: 120000 });
    const bytes = Uint8Array.from(readFileSync(output)); parseKtx2(bytes); return bytes;
  } finally { rmSync(directory, { recursive: true }); }
}

/** Store bounded PNG/JPEG/WebP pixels byte-exact in a single-level Zstd RGBA8 KTX2.
 * No lossy encoder or colour transform runs. flipY explicitly selects source row orientation;
 * look.samplers mips:'gpu' uses the runtime's existing mip law, as for a painted bitmap. */
export async function bakeRawColourTexture(image: Uint8Array, options: { flipY?: boolean } = {}): Promise<Uint8Array> {
  const { width, height, pixels } = await readImagePixels(image, options);
  const packed = zstdCompressSync(pixels, { params: { [constants.ZSTD_c_compressionLevel]: 19 } });
  const descriptorSize = 92, offset = 104 + descriptorSize, out = new Uint8Array(offset + packed.length), view = new DataView(out.buffer);
  out.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  // RGBA8_SRGB, one Zstd level. The descriptor and level bytes never overlap.
  [43, 1, width, height, 0, 0, 1, 1, 2, 104, descriptorSize].forEach((value, i) => { view.setUint32(12 + i * 4, value, true); });
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(pixels.length), true);
  view.setUint32(104, descriptorSize, true); view.setUint16(112, 2, true); view.setUint16(114, descriptorSize - 4, true); out.set([1, 1, 2, 0], 116);
  for (let channel = 0; channel < 4; channel++) {
    const at = 132 + channel * 16; view.setUint16(at, channel * 8, true); out[at + 2] = 7; out[at + 3] = channel === 3 ? 15 : channel; view.setUint32(at + 12, 255, true);
  }
  out.set(packed, offset); parseKtx2(out); return out;
}
