// bake-pine-painted.mjs: Pine's painted textures, baked once instead of painted at every launch (SHARD-PLATFORM W2).
//
// The coat's waxed canvas (./coatCanvas.ts) is computed here and written as lossless PNGs, rows flipped so a plain image
// texture reads them the way the old DataTexture did. The log ends' grain, the lamps' glow and the trophy wall's chalk
// atlas need a 2D canvas and the hand font: ./paintedPage.ts is bundled and run on a blank page in headless Chromium
// (muted, as the iPhone 16 Pro). Every file is named by its SHA-256 under public/assets/pine-hollow/painted/, and
// ../data/paintedTextures.generated.json holds their URLs, colour spaces and wraps, and the chalk atlas's layout.
//
//   scripts/browser-lane.sh node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs \
//     src/shards/pine-hollow/generators/bake-pine-painted.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { COAT_SIZE, coatPixels } from './coatCanvas.ts';

const ROOT = resolve(import.meta.dirname, '../../../..');
const OUT = resolve(ROOT, 'public/assets/pine-hollow/painted');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src/shards/pine-hollow/manifest.json'), 'utf8'));
const dataUrl = (file, mime) => `data:${mime};base64,${readFileSync(resolve(ROOT, file)).toString('base64')}`;

/** the coat's maps, row 0 last (an image texture's top row is v = 1) */
async function coat() {
  const S = COAT_SIZE, out = {};
  for (const [key, pixels] of Object.entries(coatPixels())) {
    const flipped = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < S; y++) flipped.set(pixels.subarray(y * S * 4, (y + 1) * S * 4), (S - 1 - y) * S * 4);
    out[key] = { bytes: Buffer.from(await writeImagePixels({ width: S, height: S, pixels: flipped })), ext: 'png' };
  }
  return out;
}

async function page() {
  const bundle = await build({
    configFile: false, logLevel: 'silent', publicDir: false, root: ROOT,
    build: { write: false, target: 'esnext', minify: false, lib: { entry: resolve(ROOT, 'src/shards/pine-hollow/generators/paintedPage.ts'), formats: ['es'], fileName: 'pinePaintedPage' }, rolldownOptions: { output: { codeSplitting: false } } },
  });
  const code = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((b) => ('output' in b ? b.output : [])).find((c) => c.type === 'chunk')?.code;
  if (code === undefined) throw new Error('bake-pine-painted: the bake page did not bundle');
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const tab = await (await browser.newContext(devices['iPhone 16 Pro'])).newPage();
    const errors = [];
    tab.on('pageerror', (e) => { errors.push(e.message); });
    await tab.setContent('<!doctype html><meta charset="utf-8"><title>pine painted bake</title>');
    await tab.addScriptTag({ content: code, type: 'module' });
    await tab.waitForFunction(() => 'bakePinePainted' in window, undefined, { timeout: 60000 });
    const made = await tab.evaluate(([seed, atlas, font]) => window.bakePinePainted(seed, atlas, font),
      [manifest.seed, dataUrl('public/assets/pine-hollow/journal/chalk.webp', 'image/webp'), dataUrl('public/fonts/caveat-600-latin.woff2', 'font/woff2')]);
    if (errors.length > 0) throw new Error(`bake-pine-painted: page errors: ${errors.join('; ')}`);
    const textures = {};
    for (const [key, { dataUrl: url }] of Object.entries(made.textures)) textures[key] = { bytes: Buffer.from(url.split(',')[1] ?? '', 'base64'), ext: url.startsWith('data:image/webp') ? 'webp' : 'png' };
    return { textures, chalk: made.chalk };
  } finally { await browser.close(); }
}

/** colour space and wrap per texture (the old painters' choices) */
const LOOK = {
  endGrain: { srgb: true, repeat: false }, glow: { srgb: false, repeat: false }, chalk: { srgb: true, repeat: false },
  map: { srgb: true, repeat: true }, normalMap: { srgb: false, repeat: true }, arm: { srgb: false, repeat: true },
};
const NAME = { map: 'coatMap', normalMap: 'coatNormal', arm: 'coatArm' };

const painted = await page(), files = { ...painted.textures, ...(await coat()) };
mkdirSync(OUT, { recursive: true });
const textures = {}, keep = new Set();
for (const [key, { bytes, ext }] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
  const name = NAME[key] ?? key, file = `${name}-${createHash('sha256').update(bytes).digest('hex')}.${ext}`;
  writeFileSync(resolve(OUT, file), bytes); keep.add(file);
  textures[name] = { url: `/assets/pine-hollow/painted/${file}`, ...LOOK[key] };
  console.log(`bake-pine-painted: ${file} ${String(bytes.length)} B`);
}
for (const file of readdirSync(OUT)) if (!keep.has(file)) rmSync(resolve(OUT, file));
const urls = Object.values(textures).map((t) => t.url);
writeFileSync(resolve(ROOT, 'src/shards/pine-hollow/data/paintedTextures.generated.json'), `${JSON.stringify({ textures, urls, chalk: painted.chalk }, null, 2)}\n`);
