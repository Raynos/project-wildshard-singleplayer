#!/usr/bin/env node
// SF15a-min / SF8b: run through scripts/browser-lane.sh after any quiet floor window.
// Serve the installed product itself, without Vite or access to repository assets.
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve as resolvePath } from 'node:path';
import { chromium, devices } from 'playwright';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';

const directory = resolvePath(process.argv.at(2) ?? ''), report = process.argv.at(3);
const mime = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = resolvePath(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${directory}/`)) { response.writeHead(403); response.end(); return; }
  try { if (!statSync(file).isFile()) throw new Error('Not a file'); response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(readFileSync(file)); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
let browser;
try {
  const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing static fixture port');
  browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await installInit(context, { lane: 'sdk', sha: 'installed', browser: 'chromium', capture: null, accelerated: false, tier: 'phone' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/?mute=1&sw=0&nolock=1&skipintro=1`);
  await page.waitForFunction(() => window.__wildshard?.world?.game && !document.querySelector('.ws-load'), { timeout: 120_000 });
  const result = await page.evaluate(async () => {
    const probe = window.__wildshard, world = probe.world;
    const expected = JSON.parse(document.getElementById('ws-shardfile').textContent).identity.slug;
    const boot = { id: world.game.level.id, expected, player: Boolean(world.player), physics: Boolean(world.physics), hud: document.querySelectorAll('#hud *').length > 0, scope: world.game.levelScope.name };
    const leak = await probe.leak();
    return { boot, scope: leak.scope, before: leak.before, after: leak.after, disposalErrors: leak.disposalErrors, errors: window.__wildshardHarness.errors };
  });
  const difference = (a, b, prefix = '') => Object.keys(a).flatMap((key) => typeof a[key] === 'object' && a[key] !== null ? difference(a[key], b[key], `${prefix}${key}.`) : a[key] === b[key] ? [] : [{ field: `${prefix}${key}`, before: a[key], after: b[key] }]);
  const differences = difference(result.before, result.after);
  const pass = result.boot.id === result.boot.expected && result.boot.player && result.boot.physics && result.boot.hud && Object.values(result.scope).every((value) => value === 0) && result.disposalErrors.length === 0 && differences.length === 0 && result.errors.length === 0;
  const proof = { pass, ...result, differences };
  if (report !== undefined) writeFileSync(report, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof)); if (!pass) throw new Error('Installed client load/unload leaked or reported errors');
} finally { await browser?.close(); await new Promise((resolve) => { server.close(resolve); }); }
