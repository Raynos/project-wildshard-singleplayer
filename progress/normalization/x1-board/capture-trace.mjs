// Run through scripts/browser-lane.sh; preview and browser close even on a failed assertion.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cachedTree, serve } from '../../../scripts/parity/serve.mjs';
import { installInit } from '../../../scripts/parity/init.mjs';

const [sha, output] = process.argv.slice(2);
const exported = await cachedTree(resolve('.'), sha);
const preview = await serve(exported.tree, sha, true);
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 30, tier: 'phone' });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(preview.url + '/?chunk=driftwood-isle&tier=phone&touch=1&skipintro=1&nolock=1&mute=1&sw=0');
  await page.waitForFunction(() => window.__wildshard && !document.querySelector('.ws-load'));
  const proof = await page.evaluate(async () => {
    const app = window.__wildshard.world.game.app, debug = app.debug.snapshot().input;
    const off = document.querySelector('#hud pre')?.hidden;
    debug.trace(true);
    for (let i = 0; i < 25; i++) app.input.press(i % 2 === 0 ? 'jump' : 'crouch');
    await window.__parity.advance(30);
    return { offByDefault: off, contexts: debug.contexts(), last20: debug.last20(), visible: document.querySelector('#hud pre')?.hidden === false };
  });
  if (!proof.offByDefault || !proof.visible || proof.last20.length !== 20) throw new Error('Trace contract failed');
  await page.screenshot({ path: output + '.jpg', type: 'jpeg', quality: 88 });
  await page.evaluate(() => window.__wildshard.world.game.app.debug.snapshot().input.trace(false));
  writeFileSync(output + '.json', JSON.stringify({ source: sha, ...proof }, null, 2));
  await context.close();
} finally { await browser.close(); preview.close(); }
