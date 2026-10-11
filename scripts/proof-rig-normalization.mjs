#!/usr/bin/env node
// Exact source/normalized practice figures through their native loader and fixed DummyStudio on phone pixels.
// Run through heavy-lane build and browser-lane; output is a short summary plus one labelled O-check still per user.
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { build } from 'vite';
import { chromium, devices } from 'playwright';
import { normalizeRigSource } from '../src/sdk/bake/normalizeRig.ts';

const output = process.argv.slice(2).at(0), sourceTree = process.argv.slice(3).at(0);
if (output === undefined || sourceTree === undefined || !/^[a-f0-9]{40}$/u.test(sourceTree)) throw new Error('Requires an owned output directory and exact source tree hash');
const quietFile = process.env.WS_QUIET_FILE;
if (quietFile === undefined) throw new Error('Set WS_QUIET_FILE to the shared main checkout quiet file, including in scratch exports');
if (existsSync(quietFile)) throw new Error('Another lane owns the quiet window');
mkdirSync(output, { recursive: true });
const cases = [{ shard: 'driftwood-isle', variant: 'wood', file: 'wood-wood' }, { shard: 'pine-hollow', variant: 'wood-steel', file: 'wood-steel' }];
const originals = new Map(), normalized = new Map(), resources = new Map();
for (const row of cases) {
  const url = `/assets/practice/dummies/${row.file}.glb`, bytes = Uint8Array.from(readFileSync(new URL(`../public${url}`, import.meta.url)));
  const result = await normalizeRigSource(bytes);
  originals.set(url, bytes); normalized.set(url, Buffer.from(JSON.stringify(result.json)));
  for (const [name, resource] of Object.entries(result.resources)) resources.set(`/assets/practice/dummies/${name}`, resource);
}
const bundled = await build({ configFile: false, logLevel: 'error', build: { write: false, minify: false,
  lib: { entry: fileURLToPath(new URL('proof-rig-normalization/client.js', import.meta.url)), formats: ['es'], fileName: 'client' },
  rolldownOptions: { output: { codeSplitting: false } } } });
const bundles = Array.isArray(bundled) ? bundled : [bundled];
const chunk = bundles.flatMap(bundle => bundle.output ?? []).find(row => row.type === 'chunk');
if (chunk === undefined) throw new Error('Missing native figure fixture bundle');
const server = createServer((request, response) => {
  if (request.url === '/client.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(chunk.code); return; }
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101d2c;color:white;font:14px sans-serif}header{height:92px;padding:10px;box-sizing:border-box}h1{font-size:17px;margin:0 0 8px}canvas{display:block}</style><header></header><script type="module" src="/client.js"></script>');
});
await new Promise(_resolve => { server.listen(0, '127.0.0.1', _resolve); });
const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing owned fixture listener');
if (existsSync(quietFile)) { server.close(); throw new Error('Another lane acquired quiet while the fixture was bundling'); }
const rows = [], errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
  for (const row of cases) {
    const captures = [];
    for (const arm of ['original', 'normalized']) {
      const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
      try {
        await context.route('**/assets/practice/dummies/*', route => {
          const path = new URL(route.request().url()).pathname;
          const bytes = resources.get(path) ?? (arm === 'original' ? originals : normalized).get(path);
          if (bytes === undefined) throw new Error(`Unexpected native asset request: ${path}`);
          return route.fulfill({ body: Buffer.from(bytes), contentType: path.endsWith('.webp') ? 'image/webp' : path.endsWith('.bin') ? 'application/octet-stream' : arm === 'original' ? 'model/gltf-binary' : 'model/gltf+json' });
        });
        const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
        await page.waitForFunction(() => typeof window.captureFigure === 'function');
        const result = await page.evaluate(variant => window.captureFigure(variant), row.variant); captures.push(result);
        if (arm === 'normalized') {
          await page.evaluate(label => {
            const header = document.querySelector('header');
            header.innerHTML = '<h1>Lossless practice model normalization</h1>';
            const panel = document.createElement('div'); panel.textContent = `AFTER: normalized · ${label}\nNative DummyStudio · three-quarter rest pose`; panel.style.whiteSpace = 'pre-line'; header.append(panel);
          }, row.shard);
          // The still is a phone portrait O-check; the exact pixel hash above excludes burned-in evidence labels.
          const image = await page.screenshot({ type: 'jpeg', quality: 85 }); writeFileSync(join(output, `${row.shard}.jpg`), image);
        }
      } finally { await context.close(); }
    }
    const [before, after] = captures;
    rows.push({ ...row, before, after, exact: JSON.stringify(before) === JSON.stringify(after) });
  }
} finally { await browser?.close(); await new Promise((_resolve, reject) => { server.close(error => error === undefined ? _resolve() : reject(error)); }); }
const report = { sourceTree,
  profile: 'iPhone 16 Pro / DPR2 / Chromium Metal / muted', method: 'native TrainingDummyAssets + DummyStudio; original Meshopt embedded-WebP against plain accessors and unchanged external WebP; both real ordinary-arena users', rows, errors };
writeFileSync(join(output, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);
if (errors.length > 0 || rows.some(row => !row.exact || row.after.error !== 0 || row.after.calls === 0 || row.after.triangles === 0)) throw new Error('Native practice figure pixel parity failed');
console.info('EXACT native pixels, programs, triangles and draws for Driftwood and Pine');
