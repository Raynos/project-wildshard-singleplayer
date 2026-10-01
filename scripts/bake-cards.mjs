#!/usr/bin/env node
// bake-cards.mjs — bake the pine branch cards once, headless (project/archive/2026-09-22-load-perf.md §P2.2).
//
// TreeFactory.bakeBranchCard needs a GPU (it renders the twig atlas into three render targets), so this
// runs the game in headless Chromium against a served build with `?bakecards=1`, reads the three planes back
// (src/engine/world/BakedCards.ts exportCardTextures → window.__cardBake) and writes them under
// public/assets/baked/<slug>/card-{albedo.png,normal.jpg,arm.jpg} plus cards.json with a hash of the output planes. Every run bakes in memory; --check writes nothing.
//
//   node scripts/bake-cards.mjs [--url http://localhost:5173] [--chunk pine-hollow] [--check]
import { byteWriter, outputHash, jsonBytes, toolVersion } from './bake-output.mjs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5173');
const SLUG = arg('--chunk', 'pine-hollow');
const check = process.argv.includes('--check');
const output = byteWriter(check, 'bake-cards');
const atlas = 'pine_tree_01';
const dir = resolve(ROOT, 'public/assets/baked', SLUG);
const meta = resolve(dir, 'cards.json');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  // bakecards also plants the runtime pines on a shard with a Blender species set (PH-B4; placement.ts treeSetOf), whose
  // play build makes no runtime card
  await page.goto(`${URL_BASE}/?chunk=${SLUG}&tier=desktop&skipintro=1&nolock=1&nobake=1&bakecards=1`);
  await page.waitForFunction(() => Boolean(window.__cardBake), null, { timeout: 120000 });
  const out = await page.evaluate(() => window.__cardBake);
  const planes = { 'card-albedo.png': out.albedo, 'card-normal.jpg': out.normal, 'card-arm.jpg': out.arm };
  const sizes = {}, buffers = [];
  for (const [name, dataUrl] of Object.entries(planes)) {
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    buffers.push(bytes);
    output.put(resolve(dir, name), bytes);
    sizes[name] = bytes.length;
  }
  output.put(meta, jsonBytes({ hash: outputHash(Buffer.concat(buffers)), atlas, sizes }));

} finally {
  await browser.close();
}
if (output.finish() > 0) console.log(`bake-cards: Chromium ${toolVersion(chromium.executablePath(), ['--version']) ?? 'unavailable'}`);
