#!/usr/bin/env node
// SF66: the full MAP names the places that had none (Nine Dragon's square, market, stair-street, Well rim and road portals,
// the template's hut and arenas, Sky Reach's rising islets), proven in a real browser: Chromium as an iPhone 16 Pro
// portrait, muted, Settings ▸ Developer on. Writes <slug>-places.png into --out (the board is composed from them).
//
//   scripts/serve-build.sh --rev <sha> --name sf66-places            → http://127.0.0.1:<port>/
//   scripts/browser-lane.sh --max 15 node progress/shard-platform/sf66/capture-places.mjs --url=http://127.0.0.1:<port> --out=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3);
const url = arg('url').replace(/\/$/u, ''), out = resolve(arg('out') || '.');
if (url === '') { console.error('usage: capture-places.mjs --url=<build> --out=<dir>'); process.exit(2); }
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
mkdirSync(out, { recursive: true });
const report = {};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const slug of ['nine-dragon-stack', '_template', 'far-reach']) {
    const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, serviceWorkers: 'block' });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 240)); });
    await page.goto(`${url}/?chunk=${encodeURIComponent(slug)}&mute=1&skipintro=1&touch&tier=phone`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), null, { timeout: 180000, polling: 250 });
    await sleep(5000);
    await page.keyboard.press('m'); await sleep(2500);
    writeFileSync(join(out, `${slug}-places.png`), await page.screenshot());
    report[slug] = { errors };
    console.log(slug, JSON.stringify({ errors }));
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(join(out, 'capture-places.json'), `${JSON.stringify({ url, report }, null, 2)}\n`);
}
