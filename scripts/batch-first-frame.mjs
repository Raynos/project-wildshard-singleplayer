#!/usr/bin/env node
// G509: one real first frame; no captures, soak or native GPU-restart drill.
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';

const base = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
const shard = process.argv.find(arg => arg.startsWith('--shard='))?.slice(8);
if (!base || !shard) throw new Error('Use --url=<preview> --shard=<slug>');
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
  try {
    await page.waitForFunction(() => {
      const fatal = document.querySelector('#wserr .msg, .ws-load-error')?.textContent;
      if (fatal) throw new Error(fatal);
      const renderer = window.__wildshard?.world?.game.renderer;
      return Boolean(renderer && renderer.info.render.frame > 0 && renderer.info.render.calls > 0 && !renderer.getContext().isContextLost());
    }, undefined, { timeout: 240_000, polling: 250 });
  } catch (error) {
    const loading = await page.locator('body').textContent().catch(String) ?? '';
    throw new Error(`${String(error)}\n${errors.join('\n')}\nLoading state: ${loading.slice(0, 4000)}`, { cause: error });
  }
  const real = errors.filter(error => !/favicon|net::ERR_ABORTED/u.test(error));
  if (real.length > 0) throw new Error(real.join('\n'));
  console.info(`${shard}: first frame PASS`);
} finally {
  await browser.close();
}
