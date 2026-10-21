// Native reference pixels, retained as ordinary lossless product images.
import { resolve } from 'node:path';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { byteWriter, jsonBytes, outputHash } from '../../../../scripts/bake-output.mjs';
import { readImagePixels } from '../../../../src/sdk/bake/image.ts';

const root = resolve(import.meta.dirname, '../../../..');
const result = await build({ configFile: false, logLevel: 'silent', publicDir: false, root,
  build: { write: false, target: 'esnext', minify: false,
    lib: { entry: resolve(import.meta.dirname, 'decalAtlasPage.ts'), formats: ['es'] },
    rolldownOptions: { treeshake: { moduleSideEffects: false }, output: { codeSplitting: false } } } });
const code = (Array.isArray(result) ? result : [result]).flatMap(bundle => 'output' in bundle ? bundle.output : []).find(chunk => chunk.type === 'chunk')?.code;
if (code === undefined) throw new Error('Decal painter failed to bundle');
const browser = await webkit.launch({ headless: true }), rows = {};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']), page = await context.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><title>Nine decal bake</title>');
  await page.addScriptTag({ type: 'module', content: code });
  await page.waitForFunction(() => typeof window.bakeNineDecal === 'function');
  for (const tier of ['phone', 'desktop']) {
    const raster = await page.evaluate(value => window.bakeNineDecal(value), tier);
    const bytes = Buffer.from(raster.png.split(',')[1], 'base64'), original = Buffer.from(raster.rgba, 'base64');
    const image = await readImagePixels(bytes);
    if (image.width !== raster.width || image.height !== raster.height || !Buffer.from(image.pixels).equals(original)) throw new Error(`Decal PNG changes ${tier} reference pixels`);
    rows[tier] = { width: raster.width, height: raster.height, png: bytes.toString('base64') };
    console.log(`Nine ${tier} decal: ${raster.width}x${raster.height}, ${bytes.length} bytes, exact RGBA ${outputHash(original)}`);
  }
} finally { await browser.close(); }
const writer = byteWriter(process.argv.includes('--check'), 'nine-decal-atlas');
writer.put(resolve(root, 'src/shards/nine-dragon-stack/data/heldDecals.generated.json'), jsonBytes(rows));
writer.finish();
