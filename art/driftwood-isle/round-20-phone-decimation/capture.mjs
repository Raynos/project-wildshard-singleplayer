// L18.3e (G769): Driftwood's phone foliage before / after the triangle cut, iPhone 16 Pro portrait, phone tier, midday.
// node art/driftwood-isle/round-20-phone-decimation/capture.mjs <preview base> <out dir> <label>
// Boots Driftwood alone (muted), parks the clock at midday through the Developer `time` setting, then stands a few metres
// from real placements and looks at them: a palm stand, a hibiscus bush, and the reef shallows (pitched down).
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { developerSettings, hideDeveloperOverlays } from '../../../scripts/debug-settings.mjs';

const [base, out, label] = process.argv.slice(2);
if (base === undefined || out === undefined || label === undefined) throw new Error('usage: capture.mjs <base> <out> <label>');
/** stand at (x, z), face (tx, tz), pitch: a palm at (-53.7, 69.5), a bush at (-17.6, 39.6), reef shallows near (-219.9, 234.5) */
const VIEWS = [
  { name: 'palms', x: -61, z: 78, tx: -53.7, tz: 69.5, pitch: 0.25 },
  { name: 'hibiscus', x: -21.5, z: 44, tx: -17.6, tz: 39.6, pitch: -0.25 },
  { name: 'reef', x: -211, z: 226, tx: -219.9, tz: 234.5, pitch: -0.55 },
];
mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...phone, deviceScaleFactor: 2 });
  await developerSettings(context, { time: 'midday', tier: 'phone' });
  await context.addInitScript(hideDeveloperOverlays);
  const page = await context.newPage();
  page.on('pageerror', error => { console.error('pageerror', String(error).slice(0, 300)); });
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0', base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
  await sleep(6000);
  for (const view of VIEWS) {
    // yaw 0 looks down -z; face the target from the stand point
    await page.evaluate(v => { const w = window.__wildshard.world; w.player.spawn(v.x, v.z, Math.atan2(-(v.tx - v.x), -(v.tz - v.z))); w.player.pitch = v.pitch; }, view);
    await sleep(4000);
    await page.screenshot({ path: `${out}/${label}-${view.name}.png` });
    console.log('shot', label, view.name);
  }
  await context.close();
} finally { await browser.close(); }
