// bake-pine-painted.mjs: Pine's painted textures, baked once instead of painted at every launch (SHARD-PLATFORM W2).
//
// The coat's waxed canvas (./coatCanvas.ts) is computed here and written as lossless PNGs, rows flipped so a plain image
// texture reads them the way the old DataTexture did. The log ends' grain, the lamps' glow and the trophy wall's chalk
// atlas need a 2D canvas and the hand font: ./paintedPage.ts is bundled and run on a blank page in headless Chromium
// (muted, as the iPhone 16 Pro). The forest floor's six ground-cover textures (./undergrowthPaint.ts rows) are painted
// on the same page by ./undergrowthPaintPage.ts. Every file is named by its SHA-256 under public/assets/pine-hollow/painted/, and
// ../data/paintedTextures.generated.json holds their URLs, colour spaces and wraps, and the chalk atlas's layout.
//
//   scripts/browser-lane.sh node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs \
//     src/shards/pine-hollow/generators/bake-pine-painted.mjs [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { COAT_SIZE, coatPixels } from './coatCanvas.ts';

const ROOT = resolve(import.meta.dirname, '../../../..');
const OUT = resolve(ROOT, 'public/assets/pine-hollow/painted'), check = process.argv.includes('--check');
function publish(file, bytes) {
  if (check) {
    if (!existsSync(file) || !readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`bake-pine-painted: stale output ${file}`);
  } else writeFileSync(file, bytes);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'src/shards/pine-hollow/manifest.json'), 'utf8'));
const ORIGIN = 'https://pine-painted.invalid/';

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

/** one bake page's module, bundled on its own */
async function bundlePage(file) {
  const bundle = await build({
    configFile: false, logLevel: 'silent', publicDir: false, root: ROOT,
    build: { write: false, target: 'esnext', minify: false, lib: { entry: resolve(ROOT, 'src/shards/pine-hollow/generators', file), formats: ['es'], fileName: 'pinePaintedPage' }, rolldownOptions: { output: { codeSplitting: false } } },
  });
  const code = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((b) => ('output' in b ? b.output : [])).find((c) => c.type === 'chunk')?.code;
  if (code === undefined) throw new Error(`bake-pine-painted: ${file} did not bundle`);
  return code;
}

async function page() {
  const code = await bundlePage('paintedPage.ts'), underCode = await bundlePage('undergrowthPaintPage.ts');
  const { chromium, devices } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const tab = await (await browser.newContext(devices['iPhone 16 Pro'])).newPage();
    const errors = [];
    tab.on('pageerror', (e) => { errors.push(e.message); });
    const inputs = new Map([
      ['chalk.webp', { mime: 'image/webp', bytes: readFileSync(resolve(ROOT, 'public/assets/pine-hollow/journal/chalk.webp')) }],
      ['font.woff2', { mime: 'font/woff2', bytes: readFileSync(resolve(ROOT, 'public/fonts/caveat-600-latin.woff2')) }],
    ]);
    const expected = new Set(['endGrain', 'glow', 'chalk', 'ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds']);
    const received = new Map(); let total = 0;
    await tab.route(`${ORIGIN}**`, async route => {
      const request = route.request(), path = request.url().slice(ORIGIN.length), input = inputs.get(path);
      if (request.method() === 'GET' && path === '') {
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>pine painted bake</title>' }); return;
      }
      if (request.method() === 'GET' && input !== undefined) {
        await route.fulfill({ status: 200, contentType: input.mime, body: input.bytes }); return;
      }
      const name = path.startsWith('bytes/') ? path.slice(6) : '', bytes = request.postDataBuffer(), mime = request.headers()['content-type'];
      const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : undefined;
      if (request.method() !== 'POST' || !expected.has(name) || received.has(name) || ext === undefined ||
          bytes === null || bytes.length === 0 || total + bytes.length > 64_000_000) {
        await route.fulfill({ status: 400, body: 'Invalid or over-budget Pine painted bytes' }); return;
      }
      received.set(name, { bytes, ext }); total += bytes.length;
      await route.fulfill({ status: 204 });
    });
    await tab.goto(ORIGIN);
    await tab.addScriptTag({ content: code, type: 'module' });
    await tab.addScriptTag({ content: underCode, type: 'module' });
    await tab.waitForFunction(() => 'bakePinePainted' in window && 'bakePineUndergrowth' in window, undefined, { timeout: 60000 });
    const made = await tab.evaluate(({ seed, origin }) => window.bakePinePainted(seed, `${origin}chalk.webp`, `${origin}font.woff2`, `${origin}bytes/`), { seed: manifest.seed, origin: ORIGIN });
    const under = await tab.evaluate(({ seed, origin }) => window.bakePineUndergrowth(seed, `${origin}bytes/`), { seed: manifest.seed, origin: ORIGIN });
    if (errors.length > 0) throw new Error(`bake-pine-painted: page errors: ${errors.join('; ')}`);
    const textures = {};
    const metadata = { ...made.textures, ...under };
    if (Object.keys(metadata).length !== expected.size || received.size !== expected.size) throw new Error('Pine painted byte roster changed');
    for (const [key, row] of Object.entries(metadata)) {
      const file = received.get(key);
      if (file === undefined || file.ext !== row.ext) throw new Error(`Missing Pine painted bytes: ${key}`);
      textures[key] = file;
    }
    return { textures, chalk: made.chalk };
  } finally { await browser.close(); }
}

/** colour space and wrap per texture (the old painters' choices) */
const LOOK = {
  endGrain: { srgb: true, repeat: false }, glow: { srgb: false, repeat: false }, chalk: { srgb: true, repeat: false },
  map: { srgb: true, repeat: true }, normalMap: { srgb: false, repeat: true }, arm: { srgb: false, repeat: true },
  ...Object.fromEntries(['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'].map((kind) => [kind, { srgb: true, repeat: false }])),
};
const NAME = { map: 'coatMap', normalMap: 'coatNormal', arm: 'coatArm' };

const painted = await page(), files = { ...painted.textures, ...(await coat()) };
if (!check) mkdirSync(OUT, { recursive: true });
const textures = {}, keep = new Set();
for (const [key, { bytes, ext }] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
  const name = NAME[key] ?? key, file = `${name}-${createHash('sha256').update(bytes).digest('hex')}.${ext}`;
  publish(resolve(OUT, file), bytes); keep.add(file);
  textures[name] = { url: `/assets/pine-hollow/painted/${file}`, ...LOOK[key] };
  console.log(`bake-pine-painted: ${file} ${String(bytes.length)} B`);
}
for (const file of readdirSync(OUT)) if (!keep.has(file)) {
  if (check) throw new Error(`bake-pine-painted: obsolete output ${file}`); else rmSync(resolve(OUT, file));
}
const urls = Object.values(textures).map((t) => t.url);
publish(resolve(ROOT, 'src/shards/pine-hollow/data/paintedTextures.generated.json'), `${JSON.stringify({ textures, urls, chalk: painted.chalk }, null, 2)}\n`);
