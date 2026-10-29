#!/usr/bin/env node
/**
 * Tone parity (proof.ts): bundle the page into an owned ./tmp directory, serve it, read `window.toneParity` in Chromium
 * (Metal) and WebKit, and write the rows. Run the browsers inside the machine's lane:
 *   node scripts/tone-parity/run.mjs --bundle tmp/<task>/tone-parity
 *   scripts/browser-lane.sh node scripts/tone-parity/run.mjs --serve tmp/<task>/tone-parity <out.json>
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';

const root = resolvePath(import.meta.dirname, '../..');
const [mode, directory, out] = process.argv.slice(2);
if (directory === undefined) throw new Error('Use --bundle or --serve with an owned ./tmp directory');
const dist = resolvePath(directory);
if (mode === '--bundle') {
  const { build } = await import('vite');
  await build({ configFile: false, root: join(root, 'scripts/tone-parity'), publicDir: false, logLevel: 'warn',
    define: { __BUILD_ID__: JSON.stringify('tone-parity'), __SAVE_NAMESPACES__: '[]', __DEVSERVER__: 'false' },
    build: { outDir: dist, emptyOutDir: true, target: 'es2022', reportCompressedSize: false } });
} else if (mode === '--serve') {
  if (out === undefined) throw new Error('--serve needs an output JSON path');
  const { chromium, webkit } = await import('playwright');
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = resolvePath(dist, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${dist}/`)) { response.writeHead(404).end(); return; }
    try {
      response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(readFileSync(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(undefined); }); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Missing tone-parity address');
  const results = {};
  try {
    for (const [name, launcher, args] of [['chromium', chromium, ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist']], ['webkit', webkit, []]]) {
      const browser = await launcher.launch({ headless: true, args });
      try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', (error) => { errors.push(String(error)); });
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(`http://127.0.0.1:${String(address.port)}/`);
        await page.waitForFunction(() => window.toneParity !== undefined, undefined, { timeout: 120000 });
        results[name] = { result: await page.evaluate(() => window.toneParity), errors: errors.slice(0, 10) };
      } finally { await browser.close(); }
    }
  } finally { server.close(); }
  writeFileSync(out, JSON.stringify(results, null, 1));
  for (const [engine, { result }] of Object.entries(results)) console.log(engine, JSON.stringify(result).slice(0, 300));
} else throw new Error('Unknown tone-parity mode');
