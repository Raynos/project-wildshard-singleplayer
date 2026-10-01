#!/usr/bin/env node
// bake-textures.mjs — bake the procedural textures once (project/archive/2026-09-22-load-perf.md §P2): fur, clouds, planet…
//
// Every texture that goes through `bakedTexture(name, make)` (src/boot/bakedTextures.ts) is drawn at runtime
// when the build has no file for it. This runs the game headless with `?bakeexport=1&nobake=1` (so every
// procedural source runs), reads `window.__bakeExport` back and writes public/assets/baked/<slug>/tex/<name>.{png,jpg}
// plus textures.json with a hash of the output files. Every run bakes in memory; --check writes nothing.
//
//   node scripts/bake-textures.mjs [--url http://localhost:5173] [--chunk pine-hollow] [--check]
import { existsSync, readdirSync } from 'node:fs';
import { byteWriter, outputHash, jsonBytes, toolVersion } from './bake-output.mjs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5173');
const SLUG = arg('--chunk', 'pine-hollow');
const check = process.argv.includes('--check');
const output = byteWriter(check, 'bake-textures');
const dir = resolve(ROOT, 'public/assets/baked', SLUG, 'tex');
const meta = resolve(ROOT, 'public/assets/baked', SLUG, 'textures.json');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`${URL_BASE}/?chunk=${SLUG}&tier=desktop&skipintro=1&nolock=1&nobake=1&bakeexport=1`);
  await page.waitForFunction(() => Boolean(window.__wildshard?.world), null, { timeout: 120000 });
  // The probe exists before the world has built everything (E357 F2 installs it ahead of `ws:ready`; the sky's clouds
  // come later): wait until the export has stopped growing for 2 s, so no procedural source is missed (13 B9).
  let count = -1;
  for (let stable = 0, waited = 0; stable < 4 && waited < 60_000; waited += 500) {
    await page.waitForTimeout(500);
    const now = await page.evaluate(() => Object.keys(window.__bakeExport ?? {}).length);
    stable = now === count ? stable + 1 : 0;
    count = now;
  }
  const out = await page.evaluate(() => window.__bakeExport);
  const files = {};
  const buffers = [];
  const wanted = new Set();
  for (const [name, { dataUrl, lossless, width, height }] of Object.entries(out).sort(([a], [b]) => a.localeCompare(b))) {
    const file = `${name}.${lossless ? 'png' : 'jpg'}`;
    wanted.add(file);
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const path = resolve(dir, file);
    // a source edit that did not change the pixels keeps the file byte-identical (no commit noise, same SW cache entry)
    output.put(path, buf);
    buffers.push(buf);
    files[file] = { bytes: buf.length, width, height };
  }
  if (existsSync(dir)) for (const f of readdirSync(dir)) if (!wanted.has(f) && !f.includes('.phone.')) output.remove(resolve(dir, f));
  output.put(meta, jsonBytes({ hash: outputHash(Buffer.concat(buffers)), files }));

} finally {
  await browser.close();
}
if (output.finish() > 0) console.log(`bake-textures: Chromium ${toolVersion(chromium.executablePath(), ['--version']) ?? 'unavailable'}`);
