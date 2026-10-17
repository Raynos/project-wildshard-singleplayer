// Native WebKit reference raster; portable product intake reads these retained bytes.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { constants, zstdCompressSync } from 'node:zlib';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { byteWriter, outputHash } from '../../../../scripts/bake-output.mjs';
import { readImagePixels } from '../../../../src/sdk/bake/image.ts';

const root = resolve(import.meta.dirname, '../../../..');
const entry = process.env.NINE_SIGN_ENTRY ?? resolve(import.meta.dirname, 'signAtlasPage.ts');
const result = await build({ configFile: false, logLevel: 'silent', publicDir: false, root,
  build: { write: false, target: 'esnext', minify: false,
    lib: { entry, formats: ['iife'], name: 'NineSignBake' }, rolldownOptions: { output: { codeSplitting: false } } } });
const code = (Array.isArray(result) ? result : [result]).flatMap(b => 'output' in b ? b.output : []).find(c => c.type === 'chunk')?.code;
if (code === undefined) throw new Error('Nine sign page failed to bundle');
const revive = (_key, value) => value === '-0' ? -0 : value;
const layout = JSON.parse(readFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/layout.generated.json'), 'utf8'), revive);
const fixed = JSON.parse(readFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/fixedKits.generated.json'), 'utf8'), revive);
const calls = [...layout.rows.signs, ...fixed.signs];

// Single-level lossless R8/RGBA8 KTX2. Both retain the old bottom-up raster and GPU mip law.
async function ktx(png, mono) {
  const image = await readImagePixels(Buffer.from(png.split(',')[1], 'base64'), { flipY: true });
  const pixels = mono ? Uint8Array.from({ length: image.width * image.height }, (_, i) => image.pixels[i * 4]) : image.pixels;
  const packed = zstdCompressSync(pixels, { params: { [constants.ZSTD_c_compressionLevel]: 19 } });
  const descriptor = mono ? 44 : 92, offset = 104 + descriptor, out = new Uint8Array(offset + packed.length), view = new DataView(out.buffer);
  out.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  [mono ? 9 : 43, 1, image.width, image.height, 0, 0, 1, 1, 2, 104, descriptor].forEach((value, i) => view.setUint32(12 + i * 4, value, true));
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(pixels.length), true);
  view.setUint32(104, descriptor, true); view.setUint16(112, 2, true); view.setUint16(114, descriptor - 4, true); out.set([1, 1, mono ? 1 : 2, 0], 116);
  for (let channel = 0; channel < (mono ? 1 : 4); channel++) {
    const at = 132 + channel * 16; view.setUint16(at, channel * 8, true); out[at + 2] = 7; out[at + 3] = channel === 3 ? 15 : channel; view.setUint32(at + 12, 255, true);
  }
  out.set(packed, offset);
  return { packed: Buffer.from(out).toString('base64'), bytes: pixels.length, pixelHash: outputHash(pixels) };
}

const browser = await webkit.launch({ headless: true }), tiers = {};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']), page = await context.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Nine sign bake</title>');
  await page.addScriptTag({ content: code });
  for (const tier of ['phone', 'desktop']) {
    const { mono, colour, ...row } = await page.evaluate(input => window.bakeNineSigns(input.tier, input.calls), { tier, calls });
    tiers[tier] = { ...row, mono: await ktx(mono, true), colour: await ktx(colour, false) };
    console.log(`Nine ${tier}: ${Object.keys(row.cells).length} cells, ${row.placed.length} signs, ${Object.keys(row.keys).length} specimens; R8 ${tiers[tier].mono.pixelHash}, RGBA8 ${tiers[tier].colour.pixelHash}`);
  }
} finally { await browser.close(); }
const writer = byteWriter(process.argv.includes('--check'), 'nine-sign-atlas');
writer.put(resolve(root, process.env.NINE_SIGN_OUTPUT ?? 'src/shards/nine-dragon-stack/data/signAtlas.generated.json'),
  Buffer.from(`${JSON.stringify(tiers, (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value)}\n`));
writer.finish();
