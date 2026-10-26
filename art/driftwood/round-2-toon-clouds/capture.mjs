// G685 / G750 toon cel cumulus: Driftwood's sky at a few times of day, iPhone 16 Pro portrait.
// node art/driftwood/round-2-toon-clouds/capture.mjs <preview base> <out dir>
// Boots Driftwood alone at phone tier (muted), parks the day clock through the Developer `time` setting, then stands at
// the shard's own spawn on the south pier deck (keeping its height) and looks back along the pier to the island and out
// over the sea to its right, pitched up a little so the cloud band fills the upper half of the frame.
// G750 (Jake on the board: "Did we clip through the bridge?"): round 2's A / B shots stood at (0, -236), past the deck's
// end, where Player.spawn with no height puts the feet on the terrain (-0.8 m, the shallows), so the eye sat at about
// deck level beside the pier: the capture's pose, not a collision bug. The views now keep the deck's height.
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { developerSettings, hideDeveloperOverlays } from '../../../scripts/debug-settings.mjs';

const [base, out] = process.argv.slice(2);
if (base === undefined || out === undefined) throw new Error('usage: capture.mjs <base> <out>');
const TIMES = ['midday', 'golden', 'sunset'];
// yaw offsets from the pier's own heading: back along it to the island, and out over the sea to its right
const TURNS = [0, -1.1];
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio', '--ignore-gpu-blocklist'] });
try {
  for (const time of TIMES) {
    const context = await browser.newContext({ ...phone, deviceScaleFactor: 2 });
    await developerSettings(context, { time, tier: 'phone' });
    await context.addInitScript(hideDeveloperOverlays);
    const page = await context.newPage();
    page.on('pageerror', error => { console.error('pageerror', String(error).slice(0, 300)); });
    await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
    await sleep(6000);
    const start = await page.evaluate(() => { const p = window.__wildshard.world.player; return { x: p.position.x, y: p.position.y, z: p.position.z }; });
    for (const [i, turn] of TURNS.entries()) {
      await page.evaluate(a => { const w = window.__wildshard.world; w.player.spawn(a.x, a.z, Math.PI + a.turn, a.y); w.player.pitch = 0.18; }, { ...start, turn });
      await sleep(3000);
      await page.screenshot({ path: `${out}/${time}-${i}.png` });
      console.log('shot', time, i);
    }
    await context.close();
  }
} finally { await browser.close(); }
