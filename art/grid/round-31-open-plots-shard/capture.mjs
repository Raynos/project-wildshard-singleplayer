#!/usr/bin/env node
// SF88g P1: one iPhone-portrait capture standing on an open-plots plot (default Ember Forge) (Developer on, phone tier, muted).
//   bash scripts/browser-lane.sh node art/grid/round-31-open-plots-shard/capture.mjs --url=<serve-build preview> --out=<png>
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const base = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6);
const settle = Number(process.argv.find(arg => arg.startsWith('--settle='))?.slice(9) ?? 8000);
const shard = process.argv.find(arg => arg.startsWith('--shard='))?.slice(8) ?? 'open-plot-ember-forge';
if (!base || !out) throw new Error('Use --url=<preview> --out=<png>');
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
  const context = await browser.newContext(phone);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/?chunk=${encodeURIComponent(shard)}&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const fatal = document.querySelector('#wserr .msg, .ws-load-error')?.textContent;
    if (fatal) throw new Error(fatal);
    const renderer = window.__wildshard?.world?.game.renderer;
    return Boolean(renderer && renderer.info.render.frame > 0 && renderer.info.render.calls > 0);
  }, undefined, { timeout: 240_000, polling: 250 });
  await page.waitForTimeout(settle);
  const info = await page.evaluate(() => {
    const r = window.__wildshard?.world?.game.renderer;
    return { calls: r?.info.render.calls, triangles: r?.info.render.triangles, programs: r?.info.programs?.length };
  });
  await page.screenshot({ path: out });
  console.info(JSON.stringify({ out, ...info, errors: errors.filter(e => !/favicon|net::ERR_ABORTED/u.test(e)).slice(0, 5) }));
} finally {
  await browser.close();
}
