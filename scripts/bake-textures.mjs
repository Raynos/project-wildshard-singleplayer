#!/usr/bin/env node
// bake-textures.mjs — bake the procedural textures once (project/archive/2026-09-22-load-perf.md §P2): fur, clouds, planet…
//
// Every texture that goes through `bakedTexture(name, make)` (src/boot/bakedTextures.ts) is drawn at runtime
// when the build has no file for it. This runs the game headless with `?bakeexport=1&nobake=1` (so every
// procedural source runs), reads `window.__bakeExport` back and writes public/assets/baked/<slug>/tex/<name>.{png,jpg}
// plus textures.json with a hash of the generating sources. Commit the outputs; vite.config.ts only `--check`s
// (Vercel has no GPU/canvas).
//
//   node scripts/bake-textures.mjs [--url http://localhost:5173] [--chunk pine-hollow] [--force] [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5173');
const SLUG = arg('--chunk', 'pine-hollow');
const force = process.argv.includes('--force'), check = process.argv.includes('--check');
const VERSION = 1;

// the sources whose procedural textures are baked — add a file here when you route a new texture through bakedTexture()
const SOURCES = ['src/world/Sky.ts', 'src/entities/AnimalFactory.ts', 'src/boot/bakedTextures.ts', 'src/core/noise.ts', 'src/core/rng.ts'];
const hash = createHash('sha1'); hash.update(`v${VERSION}:`);
for (const f of SOURCES) hash.update(readFileSync(resolve(ROOT, f)));
const digest = hash.digest('hex').slice(0, 16);
const dir = resolve(ROOT, 'public/assets/baked', SLUG, 'tex');
const meta = resolve(ROOT, 'public/assets/baked', SLUG, 'textures.json');
const prev = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : null;
const complete = prev !== null && Object.keys(prev.files ?? {}).every((f) => existsSync(resolve(dir, f)));
if (!force && prev?.hash === digest && complete) { console.log(`bake-textures: ${SLUG} up to date (${digest}, ${Object.keys(prev.files).length} files)`); process.exit(0); }
if (check) { console.log(`bake-textures: ${SLUG} STALE (${prev?.hash ?? 'none'} → ${digest}) — run \`node scripts/bake-textures.mjs\` with the dev server up and commit public/assets/baked/${SLUG}/tex/`); process.exit(1); }

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`${URL_BASE}/?chunk=${SLUG}&tier=desktop&skipintro=1&nolock=1&nobake=1&bakeexport=1`);
  await page.waitForFunction(() => Boolean(window.__world), null, { timeout: 120000 });
  const out = await page.evaluate(() => window.__bakeExport);
  mkdirSync(dir, { recursive: true });
  const files = {};
  let changed = 0;
  const wanted = new Set();
  for (const [name, { dataUrl, lossless, width, height }] of Object.entries(out)) {
    const file = `${name}.${lossless ? 'png' : 'jpg'}`;
    wanted.add(file);
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    const path = resolve(dir, file);
    // a source edit that did not change the pixels keeps the file byte-identical (no commit noise, same SW cache entry)
    if (!existsSync(path) || !readFileSync(path).equals(buf)) { writeFileSync(path, buf); changed++; }
    files[file] = { bytes: buf.length, width, height };
  }
  for (const f of readdirSync(dir)) if (!wanted.has(f) && !f.includes('.phone.')) { rmSync(resolve(dir, f)); changed++; } // .phone.* copies: scripts/tex-tiers.mjs (re-run it after a re-bake)
  writeFileSync(meta, `${JSON.stringify({ hash: digest, version: VERSION, files }, null, 2)}\n`);
  console.log(`bake-textures: ${SLUG} → ${Object.entries(files).map(([f, v]) => `${f} ${(v.bytes / 1024).toFixed(0)} KB`).join(' · ')} (${digest}) — ${changed} file(s) changed; commit public/assets/baked/${SLUG}/`);
} finally {
  await browser.close();
}
