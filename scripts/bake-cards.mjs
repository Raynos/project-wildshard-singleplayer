#!/usr/bin/env node
// bake-cards.mjs — bake the pine branch cards once, headless (docs/plans/LOAD-PERF.md §P2.2).
//
// TreeFactory.bakeBranchCard needs a GPU (it renders the twig atlas into three render targets), so this
// runs the game in headless Chromium against the dev server with `?bakecards=1`, reads the three planes back
// (src/world/BakedCards.ts exportCardTextures → window.__cardBake) and writes them under
// public/assets/baked/<slug>/card-{albedo.png,normal.jpg,arm.jpg} plus cards.json with a hash of the inputs
// (the twig atlas files + TreeFactory.ts + BakedCards.ts). Commit the outputs. Vercel has no GPU: this is a
// local step; `--check` reports staleness (vite.config.ts warns, never fails).
//
//   node scripts/bake-cards.mjs [--url http://localhost:5173] [--chunk pine-hollow] [--force] [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5173');
const SLUG = arg('--chunk', 'pine-hollow');
const force = process.argv.includes('--force'), check = process.argv.includes('--check');
const VERSION = 1;

// inputs: the twig atlas of the chunk (Pine Hollow: pine_tree_01) and the bake code
const atlas = 'pine_tree_01';
const inputs = [`public/assets/tex/${atlas}/twig_rgba.png`, `public/assets/tex/${atlas}/twig_nor_gl.jpg`, `public/assets/tex/${atlas}/twig_arm.jpg`, 'src/world/TreeFactory.ts', 'src/world/BakedCards.ts'];
const hash = createHash('sha1'); hash.update(`v${VERSION}:`);
for (const f of inputs) { const p = resolve(ROOT, f); if (existsSync(p)) hash.update(readFileSync(p)); }
const digest = hash.digest('hex').slice(0, 16);
const dir = resolve(ROOT, 'public/assets/baked', SLUG);
const meta = resolve(dir, 'cards.json');
const prev = existsSync(meta) ? JSON.parse(readFileSync(meta, 'utf8')) : null;
const files = ['card-albedo.png', 'card-normal.jpg', 'card-arm.jpg'];
const complete = files.every((f) => existsSync(resolve(dir, f)));
if (!force && prev?.hash === digest && complete) { console.log(`bake-cards: ${SLUG} up to date (${digest})`); process.exit(0); }
if (check) { console.log(`bake-cards: ${SLUG} STALE (${prev?.hash ?? 'none'} → ${digest}) — run \`node scripts/bake-cards.mjs\` with the dev server up and commit public/assets/baked/${SLUG}/`); process.exit(1); }

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`${URL_BASE}/?chunk=${SLUG}&tier=desktop&skipintro=1&nolock=1&nobake=1&bakecards=1`);
  await page.waitForFunction(() => Boolean(window.__cardBake), null, { timeout: 120000 });
  const out = await page.evaluate(() => window.__cardBake);
  mkdirSync(dir, { recursive: true });
  const write = (name, dataUrl) => { const b = Buffer.from(dataUrl.split(',')[1], 'base64'); writeFileSync(resolve(dir, name), b); return b.length; };
  const sizes = { 'card-albedo.png': write('card-albedo.png', out.albedo), 'card-normal.jpg': write('card-normal.jpg', out.normal), 'card-arm.jpg': write('card-arm.jpg', out.arm) };
  writeFileSync(meta, `${JSON.stringify({ hash: digest, version: VERSION, atlas, sizes }, null, 2)}\n`);
  console.log(`bake-cards: ${SLUG} → ${Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)} KB`).join(' · ')} (${digest}) — commit public/assets/baked/${SLUG}/`);
} finally {
  await browser.close();
}
