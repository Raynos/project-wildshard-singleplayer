// SF51-g: portrait frames of one Nine Dragon entry deck (the north one) for Jake's board, row on (and one with it off).
// The player is posed (the standalone world has no road: the grid draws it): at the deck's mouth looking in (the road's
// view), and on the end wall's top looking back out over the deck (from above).
// scripts/browser-lane.sh node progress/shard-platform/sf51/capture.mjs --url=<served devserver build> --out=<dir> [--row=on|off]
import { mkdirSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', '.'), ROW = flag('row', 'on');
mkdirSync(OUT, { recursive: true });
// yaw: the player looks along -sin(yaw), -cos(yaw)
const POSES = [
  { name: 'road', x: 0, z: 249.6, y: 0, yaw: 0, pitch: 0.12 },
  { name: 'above', x: 0, z: 233.6, y: 6, yaw: Math.PI, pitch: -0.55 },
];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.nine-dragon-stack.nineDragonEntries', data: ROW });
  await page.goto(`${BASE}/?chunk=nine-dragon-stack&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await page.waitForTimeout(5000);
  for (const pose of POSES) {
    await page.evaluate((q) => {
      const w = window.__wildshard.world, p = w.player;
      w.game.app.systems.delete('engine.world.bounds'); w.game.app.sorted = null; // the grid lifts the fragment's bounds
      p.spawn(q.x, q.z, q.yaw, q.y); p.position.y = q.y; p.pitch = q.pitch; p.velocity.set(0, 0, 0);
    }, pose);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${ROW}-${pose.name}.jpg`, type: 'jpeg', quality: 85 });
    console.log('shot', `${OUT}/${ROW}-${pose.name}.jpg`);
  }
  await ctx.close();
} finally { await browser.close(); }
