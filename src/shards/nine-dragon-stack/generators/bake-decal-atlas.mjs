// Native reference pixels, retained as ordinary lossless product images.
import { resolve } from 'node:path';
import { openNativeRaster, bundleNativeRaster } from '@wildshard/sdk/bake/nativeRaster';
import { byteWriter, outputHash, browserBakeBytes } from '../../../../scripts/bake-output.mjs';
import nativeDecals from '../data/nativeDecals.json' with { type: 'json' };
import { readImagePixels } from '@wildshard/sdk/bake/image';

const root = resolve(import.meta.dirname, '../../../..');
const code = await bundleNativeRaster({ root, entry: resolve(import.meta.dirname, 'decalAtlasPage.ts'), format: 'iife', name: 'NineDecalBake' });
if (code === undefined) throw new Error('Decal painter failed to bundle');
const writer = byteWriter(process.argv.includes('--check'), 'nine-decal-atlas');
const session = await openNativeRaster({
  html: '<!doctype html><meta charset="utf-8"><title>Nine decal bake</title>', source: code,
});
try {
  const { page } = session;
  await page.waitForFunction(() => typeof window.NineDecalBake.bakeNineDecal === 'function');
  for (const tier of ['phone', 'desktop']) {
    const sink = await browserBakeBytes(page);
    let raster, bytes, original;
    try {
      raster = await page.evaluate(async ({ selected, url }) => {
        const row = await window.NineDecalBake.bakeNineDecal(selected);
        const send = async (id, body) => {
          const response = await fetch(`${url}${id}`, { method: 'POST', body });
          if (!response.ok) throw new Error('Decal byte handoff refused');
        };
        await send('png', row.png);
        await send('rgba', new Uint8Array(row.rgba.buffer, row.rgba.byteOffset, row.rgba.byteLength));
        return { width: row.width, height: row.height };
      }, { selected: tier, url: sink.url });
      bytes = sink.take('png'); original = sink.take('rgba');
    } finally { await sink.dispose(); }
    const image = await readImagePixels(bytes);
    if (image.width !== raster.width || image.height !== raster.height || !Buffer.from(image.pixels).equals(original)) throw new Error(`Decal PNG changes ${tier} reference pixels`);
    const source = nativeDecals[tier];
    if (!/^\/assets\/nine-dragon\/authored\/[a-z-]+\.png$/u.test(source.url)) throw new Error('Invalid authored decal output');
    writer.put(resolve(root, 'public', source.url.slice(1)), bytes);
    console.log(`Nine ${tier} decal: ${raster.width}x${raster.height}, ${bytes.length} bytes, exact RGBA ${outputHash(original)}`);
  }
} finally { await session.dispose(); }
writer.finish();
