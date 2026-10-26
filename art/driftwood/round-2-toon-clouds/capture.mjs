// G685 toon cel cumulus: Driftwood's sky, A today / B toon cumulus, at a few times of day, iPhone 16 Pro portrait.
// node art/driftwood/round-2-toon-clouds/capture.mjs <preview base> <out dir> [A|B ...]
// Boots Driftwood alone at phone tier (muted), parks the day clock through the Developer `time` setting, then from the
// south pier looks out to sea and back at the island, pitched up a little so the cloud band fills the upper half of the frame.
// The variant is the live Look row's device save (B = toon cumulus), so A and B differ only in the clouds.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { developerSettings, hideDeveloperOverlays, saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out, ...picked] = process.argv.slice(2);
if (base === undefined || out === undefined) throw new Error('usage: capture.mjs <base> <out> [A|B ...]');
const variants = picked.length > 0 ? picked : ['A', 'B'];
const TIMES = ['midday', 'golden', 'sunset'];
// the south pier: along it to the island, and out over the sea to its right (round-1-pier-ramps' south entry)
const VIEWS = [{ x: 0, z: -236, yaw: Math.PI }, { x: 0, z: -236, yaw: Math.PI - 1.1 }];
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio', '--ignore-gpu-blocklist'] });
try {
  for (const variant of variants) for (const time of TIMES) {
    const context = await browser.newContext({ ...phone, deviceScaleFactor: 2 });
    await developerSettings(context, { time, tier: 'phone' });
    await saveFixture(context, { scope: 'device', key: 'debug.global.toonClouds', data: variant === 'B' ? 'toon' : 'faceted' });
    await context.addInitScript(hideDeveloperOverlays);
    const page = await context.newPage();
    page.on('pageerror', error => { console.error('pageerror', String(error).slice(0, 300)); });
    await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
    await sleep(6000);
    for (const [i, view] of VIEWS.entries()) {
      await page.evaluate(a => { const w = window.__wildshard.world; w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = 0.18; }, view);
      await sleep(3000);
      await page.screenshot({ path: `${out}/${variant}-${time}-${i}.png` });
      console.log('shot', variant, time, i);
    }
    await context.close();
  }
} finally { await browser.close(); }
