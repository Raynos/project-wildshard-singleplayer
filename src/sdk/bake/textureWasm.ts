// oxlint-disable-next-line import/no-nodejs-modules -- Trusted author tooling resolves only its pinned dependency artifacts.
import { createRequire } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary CommonJS glue is a verified third-party module, removed after loading.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The encoder owns this unique portable temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Local dependency artifacts, never an author-supplied path or URL.
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { worldImageInfo } from './worldImage';
import { hashImmutableBytes } from '../immutable';
import { parseKtx2 } from '../assets';

/** Exact packaged encoder artifacts; lockfile integrity pins the containing dependency as well. */
export const WORLD_TEXTURE_TOOL = Object.freeze({
  package: '@loaders.gl/textures', version: '4.5.3', decoder: 'sharp@0.34.5',
  glue: 'd204cc62dfdf910f92bce616872a6d6057b6d2b45bbaffbc0ef047375351e4a6',
  wasm: '62ce0364ea8f4969e1e4277ce275213dcce5b234c8c96586da06e3879010341c',
});
interface Encoder {
  setCreateKTX2File: (value: boolean) => void; setKTX2UASTCSupercompression: (value: boolean) => void;
  setKTX2SRGBTransferFunc: (value: boolean) => void; setSliceSourceImage: (slice: number, data: Uint8Array, width: number, height: number, png: boolean) => void;
  setPerceptual: (value: boolean) => void; setMipSRGB: (value: boolean) => void; setQualityLevel: (value: number) => void;
  setUASTC: (value: boolean) => void; setMipGen: (value: boolean) => void; encode: (output: Uint8Array) => number; delete: () => void;
}
interface BasisModule { initializeBasis: () => void; BasisEncoder: new () => unknown }
type BasisFactory = (options: { wasmBinary: Uint8Array; print: (text: string) => void; printErr: (text: string) => void }) => Promise<unknown>;
const methods = ['setCreateKTX2File', 'setKTX2UASTCSupercompression', 'setKTX2SRGBTransferFunc', 'setSliceSourceImage', 'setPerceptual', 'setMipSRGB', 'setQualityLevel', 'setUASTC', 'setMipGen', 'encode', 'delete'] as const;
function factory(value: unknown): value is BasisFactory { return typeof value === 'function'; }
function moduleApi(value: unknown): value is BasisModule { return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'initializeBasis') === 'function' && typeof Reflect.get(value, 'BasisEncoder') === 'function'; }
function encoderApi(value: unknown): value is Encoder { return typeof value === 'object' && value !== null && methods.every(key => typeof Reflect.get(value, key) === 'function'); }
let basis: Promise<BasisModule> | undefined;
async function loadBasis(): Promise<BasisModule> {
  const require = createRequire(join(import.meta.dirname, 'encoder.cjs')), directory = dirname(require.resolve(WORLD_TEXTURE_TOOL.package));
  const glue = Uint8Array.from(readFileSync(join(directory, 'libs/basis_encoder.js'))), wasm = Uint8Array.from(readFileSync(join(directory, 'libs/basis_encoder.wasm')));
  if (hashImmutableBytes(glue) !== WORLD_TEXTURE_TOOL.glue || hashImmutableBytes(wasm) !== WORLD_TEXTURE_TOOL.wasm) throw new Error('Pinned world texture encoder artifact mismatch');
  // The package publishes its CommonJS Emscripten glue beneath type:module. Give those exact verified bytes
  // a .cjs suffix; normal Node module loading executes them, with the WASM already supplied and no network.
  const temporary = mkdtempSync(join(tmpdir(), 'wildshard-basis-'));
  try {
    const path = join(temporary, 'encoder.cjs'); writeFileSync(path, glue);
    // oxlint-disable-next-line import/no-dynamic-require -- Only the SHA-verified pinned dependency bytes above are loaded here.
    const entry: unknown = require(path); if (!factory(entry)) throw new Error('Invalid pinned encoder factory');
    const loaded = await entry({ wasmBinary: wasm, print: () => undefined, printErr: () => undefined });
    if (!moduleApi(loaded)) throw new Error('Invalid pinned encoder API');
    loaded.initializeBasis(); return loaded;
  } finally { rmSync(temporary, { recursive: true }); }
}
/** Encode embedded PNG/JPEG/WebP to deterministic single-threaded UASTC KTX2 with a complete mip chain.
 * Colour/emissive uses sRGB; normal/ORM uses linear transfer. Source flipY is baked into raster rows for the glTF/KTX2 convention; atlas UVs stay unchanged. No system binary, CDN or author code is executed. */
export async function bakeWorldTexture(image: Uint8Array, colourSpace: 'srgb' | 'linear', options: { flipY?: boolean } = {}): Promise<Uint8Array> {
  if (!['srgb', 'linear'].includes(colourSpace)) throw new Error('World texture transfer must be srgb or linear');
  const info = await worldImageInfo(image), size: [number, number] = [info.width, info.height];
  const raster = sharp(image, { limitInputPixels: 4096 * 4096, animated: false, failOn: 'warning' });
  if (options.flipY === true) raster.flip();
  const decoded = await raster.ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== size[0] || decoded.info.height !== size[1] || decoded.info.channels !== 4 || decoded.data.length !== size[0] * size[1] * 4) throw new Error('World texture decoded dimensions differ from admission');
  basis ??= loadBasis(); const module = await basis, raw = new module.BasisEncoder();
  if (!encoderApi(raw)) throw new Error('Invalid pinned encoder methods');
  try {
    const srgb = colourSpace === 'srgb';
    raw.setCreateKTX2File(true); raw.setKTX2UASTCSupercompression(true); raw.setKTX2SRGBTransferFunc(srgb);
    raw.setSliceSourceImage(0, decoded.data, size[0], size[1], false); raw.setPerceptual(srgb); raw.setMipSRGB(srgb);
    raw.setQualityLevel(128); raw.setUASTC(true); raw.setMipGen(true);
    const output = new Uint8Array(size[0] * size[1] * 4 + 1_048_576), length = raw.encode(output);
    if (!Number.isSafeInteger(length) || length < 1 || length > output.length || length > 25_000_000) throw new Error('World texture encoding failed or exceeded wire cap');
    const bytes = output.slice(0, length); parseKtx2(bytes); return bytes;
  } finally { raw.delete(); }
}
