import { nineLayoutData } from './layoutSource.ts';
import { fixedKitRows, readFixedSlots } from './casts.ts';
// Native WebKit reference raster; portable product intake reads these retained bytes.
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { openNativeRaster, bundleNativeRaster } from '@wildshard/sdk/bake/nativeRaster';
import { byteWriter, outputHash, browserBakeBytes } from '../../../../scripts/bake-output.mjs';
import { readImagePixels } from '@wildshard/sdk/bake/image';
import { parseSignView } from './sections.ts';

const root = resolve(import.meta.dirname, '../../../..');
const writer = byteWriter(process.argv.includes('--check'), 'nine-sign-atlas');
// GD2: this explicit asset refresh/check publishes native inputs outside source.
const outputData = resolve(root, 'public/assets/nine-dragon/authored/sign-atlas');
const entry = process.env.NINE_SIGN_ENTRY ?? resolve(import.meta.dirname, 'signAtlasPage.ts');
const code = await bundleNativeRaster({ root, entry, format: 'iife', name: 'NineSignBake' });
if (code === undefined) throw new Error('Nine sign page failed to bundle');
const layout = nineLayoutData();
const fixed = fixedKitRows(readFixedSlots(layout));
const calls = [...layout.rows.signs, ...fixed.signs];
const signRows = parseSignView(JSON.parse(readFileSync(resolve(root, 'src/shards/nine-dragon-stack/data/signView.json'), 'utf8')));

// Single-level lossless R8/RGBA8 KTX2. Both retain the old bottom-up raster and GPU mip law.
async function ktx(png, mono, file) {
  const image = await readImagePixels(png, { flipY: true });
  const pixels = mono ? Uint8Array.from({ length: image.width * image.height }, (_, i) => image.pixels[i * 4]) : image.pixels;
  const packed = encodeBuildBytes(Uint8Array.from(pixels), 'zstd', 19);
  const descriptor = mono ? 44 : 92, offset = 104 + descriptor, out = new Uint8Array(offset + packed.length), view = new DataView(out.buffer);
  out.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
  [mono ? 9 : 43, 1, image.width, image.height, 0, 0, 1, 1, 2, 104, descriptor].forEach((value, i) => view.setUint32(12 + i * 4, value, true));
  view.setBigUint64(80, BigInt(offset), true); view.setBigUint64(88, BigInt(packed.length), true); view.setBigUint64(96, BigInt(pixels.length), true);
  view.setUint32(104, descriptor, true); view.setUint16(112, 2, true); view.setUint16(114, descriptor - 4, true); out.set([1, 1, mono ? 1 : 2, 0], 116);
  for (let channel = 0; channel < (mono ? 1 : 4); channel++) {
    const at = 132 + channel * 16; view.setUint16(at, channel * 8, true); out[at + 2] = 7; out[at + 3] = channel === 3 ? 15 : channel; view.setUint32(at + 12, 255, true);
  }
  out.set(packed, offset);
  writer.put(resolve(outputData, file), out);
  return { packed: file, bytes: pixels.length, pixelHash: outputHash(pixels) };
}

const session = await openNativeRaster({ html: '<!doctype html><meta charset="utf-8"><title>Nine sign bake</title>', source: code }), tiers = {};
try {
  const { page } = session;
  for (const tier of ['phone', 'desktop']) {
    const sink = await browserBakeBytes(page);
    let row, geometryBytes, mono, colour;
    try {
      row = await page.evaluate(async input => {
        const { mono: monoCanvas, colour: colourCanvas, ...metadata } = window.bakeNineSigns(input.tier, input.calls, input.signRows);
        const chunks = []; let byteOffset = 0;
        const pack = bytes => { const range = { byteOffset, byteLength: bytes.byteLength }; chunks.push(bytes); byteOffset += bytes.byteLength; return range; };
        const geometries = Object.fromEntries(Object.entries(metadata.geometries).map(([key, geometry]) => [key, { ...geometry,
          attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, { ...attribute, data: pack(attribute.data) }])),
          index: pack(geometry.index),
        }]));
        const all = new Uint8Array(byteOffset); let offset = 0;
        for (const bytes of chunks) { all.set(bytes, offset); offset += bytes.byteLength; }
        const send = async (id, bytes) => {
          const response = await fetch(`${input.url}${id}`, { method: 'POST', body: bytes });
          if (!response.ok) throw new Error('Sign atlas byte handoff refused');
        };
        await send('geometry', all);
        const raster = async canvas => {
          const blob = await new Promise((_resolve, reject) => {
            canvas.toBlob(value => {
              if (value === null) reject(new Error('Sign atlas PNG encoding failed')); else _resolve(value);
            }, 'image/png');
          });
          return new Uint8Array(await blob.arrayBuffer());
        };
        await send('mono', await raster(monoCanvas)); await send('colour', await raster(colourCanvas));
        return { ...metadata, geometries };
      }, { tier, calls, signRows, url: sink.url });
      geometryBytes = sink.take('geometry'); mono = sink.take('mono'); colour = sink.take('colour');
    } finally { await sink.dispose(); }
    const buffer = `signAtlas-${tier}.bin`;
    writer.put(resolve(outputData, buffer), geometryBytes);
    tiers[tier] = { ...row, mono: await ktx(mono, true, `signAtlas-${tier}-mono.ktx2`), colour: await ktx(colour, false, `signAtlas-${tier}-colour.ktx2`), buffer };
    console.log(`Nine ${tier}: ${Object.keys(row.cells).length} cells, ${row.placed.length} signs, ${Object.keys(row.keys).length} specimens; R8 ${tiers[tier].mono.pixelHash}, RGBA8 ${tiers[tier].colour.pixelHash}`);
  }
} finally { await session.dispose(); }
writer.put(process.env.NINE_SIGN_OUTPUT === undefined ? resolve(outputData, 'signAtlas.json') : resolve(root, process.env.NINE_SIGN_OUTPUT),
  Buffer.from(`${JSON.stringify(tiers, (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0' : value)}\n`));
writer.finish();
