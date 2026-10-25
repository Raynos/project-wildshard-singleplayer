// Native reference pixels, retained as ordinary lossless product images.
import { resolve } from 'node:path';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { byteWriter, outputHash, browserBakeBytes } from '../../../../scripts/bake-output.mjs';
import nativeDecals from '../data/nativeDecals.json' with { type: 'json' };
import { readImagePixels } from '../../../../src/sdk/bake/image.ts';

const root = resolve(import.meta.dirname, '../../../..');
const result = await build({ configFile: false, logLevel: 'silent', publicDir: false, root,
  build: { write: false, target: 'esnext', minify: false,
    lib: { entry: resolve(import.meta.dirname, 'decalAtlasPage.ts'), formats: ['es'] },
    rolldownOptions: { treeshake: { moduleSideEffects: false }, output: { codeSplitting: false } } } });
const code = (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []).find(chunk => chunk.type === 'chunk')?.code;
if (code === undefined) throw new Error('Decal painter failed to bundle');
const writer = byteWriter(process.argv.includes('--check'), 'nine-decal-atlas');
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']), page = await context.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Nine decal bake</title>');
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => typeof window.bakeNineDecal === 'function');
  for (const tier of ['phone', 'desktop']) {
    const sink = await browserBakeBytes(page);
    let raster, bytes, original;
    try {
      raster = await page.evaluate(async ({ selected, url }) => {
        const row = await window.bakeNineDecal(selected);
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
} finally { await browser.close(); }
writer.finish();
