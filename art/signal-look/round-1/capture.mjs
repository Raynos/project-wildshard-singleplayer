// sp-o24: raw A / B Signal look captures. node capture.mjs <url> <A|B> <outdir>
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { writeSaveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';

const [url, variant, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const yawTo = (p, t) => Math.atan2(-(t[0] - p[0]), -(t[1] - p[1]));
const POSES = [
  { id: 'waymark-fire', p: [66, -22], t: [58, -34], pitch: 0.12 },
  { id: 'tower-fire', p: [6, -50], t: [8, -75], pitch: 0.28 },
  { id: 'spawn-tower', p: [0, 70], t: [8, -75], pitch: 0.02 },
  { id: 'well', p: [77, 1], t: [84, -6], pitch: -0.2 },
  { id: 'caravan-cookfire', p: [-64, 42], t: [-78, 28], pitch: -0.05 },
  { id: 'sand-dunes', p: [0, 70], t: [0, 170], pitch: -0.08 },
];
const SURFACES = [
  { id: 'phone', ctx: { ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 }, tier: 'phone' },
  { id: 'desktop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, tier: 'desktop' },
];
const sleep = ms => new Promise(r => { setTimeout(r, ms); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const s of SURFACES) {
    const context = await browser.newContext(s.ctx);
    if (variant === 'B') await context.addInitScript(writeSaveFixture, { scope: 'device', key: 'debug.plugin.sunscar-dunes.sunscar.look', data: 'on' });
    const page = await context.newPage();
    page.on('pageerror', e => console.error('pageerror', String(e).slice(0, 300)));
    await page.goto(new URL(`/?chunk=sunscar-dunes&mute=1&skipintro=1&nolock=1&sw=0&tier=${s.tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const w = window.__wildshard?.world; return (w?.animals?.animals?.length ?? 0) > 0 && !document.querySelector('.ws-load'); }, undefined, { timeout: 400000, polling: 1000 });
    await sleep(3000);
    await page.evaluate(() => { const p = window.__wildshard.shard.sunscar; p.stage('waymarks-lit'); p.places.fire.light(); });
    await sleep(9000);
    for (const pose of POSES) {
      await page.evaluate(a => { const w = window.__wildshard.world; w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch; }, { x: pose.p[0], z: pose.p[1], yaw: yawTo(pose.p, pose.t), pitch: pose.pitch });
      await sleep(4000);
      await page.screenshot({ path: `${out}/${variant}-${s.id}-${pose.id}.png` });
      console.log(variant, s.id, pose.id);
    }
    await context.close();
  }
} finally { await browser.close(); }
