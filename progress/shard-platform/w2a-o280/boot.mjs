// SHARD-PLATFORM sp-o280 (W2a): standalone Pine boot on one muted Metal "iPhone 16 Pro" portrait context, phone tier /
// 2x: page errors, the held weapon, the bird draw and the King kit loaded from the product, a short walk and a shot.
//   SERVE_OWNER=sp-o280 scripts/serve-build.sh --rev <sha> --shard pine-hollow --name o280
//   TAG=after scripts/browser-lane.sh --max 20 node progress/shard-platform/w2a-o280/boot.mjs <preview-url> <out-dir>
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out] = process.argv.slice(2);
const TAG = process.env.TAG ?? 'now';
if (!base || !out) throw new Error('usage: boot.mjs <preview-url> <out-dir>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { tag: TAG, errors: [], consoleErrors: [], requests: { shardfile: 0, publicPine: 0 } };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { report.errors.push(String(error.stack ?? error).slice(0, 400)); });
  page.on('console', (msg) => { if (msg.type() === 'error' && report.consoleErrors.length < 12) report.consoleErrors.push(msg.text().slice(0, 300)); });
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/shardfiles/pine-hollow/')) report.requests.shardfile++;
    if (url.includes('/assets/pine-hollow/')) report.requests.publicPine++;
  });
  const t0 = Date.now();
  await page.goto(`${base}/?chunk=pine-hollow&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit' });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 240000, polling: 500 });
  report.bootSeconds = Math.round((Date.now() - t0) / 1000);
  await page.waitForTimeout(8000);
  const scene = () => page.evaluate(() => {
    const api = window.__wildshard, w = api.requireWorld?.() ?? api.world, names = new Set();
    let held = 0, wildlife = 0;
    w.game.rootScene.traverse((o) => {
      if (/crossbow|xbow|hand-crossbow|sleeve/i.test(o.name) && o.visible) held++;
      if (o.name === 'wildlife' || /wildlife/i.test(o.name)) wildlife++;
      if (o.name) names.add(o.name);
    });
    return { held, wildlife, objects: names.size, weapon: w.weapons?.current?.id ?? w.weapons?.selected ?? null, menu: Boolean(document.querySelector('.ws-main-grid')), at: w.player.position.toArray().map((v) => Math.round(v)) };
  });
  report.atSpawn = await scene();
  await page.screenshot({ path: join(out, `pine-${TAG}-spawn.jpg`), type: 'jpeg', quality: 80 });
  // a short walk forward and a shot (the crossbow fires from a tap on the right of the screen)
  const box = page.viewportSize();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  if (box) { await page.mouse.click(box.width * 0.75, box.height * 0.5); }
  await page.waitForTimeout(2500);
  report.afterPlay = await scene();
  await page.screenshot({ path: join(out, `pine-${TAG}-play.jpg`), type: 'jpeg', quality: 80 });
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(join(out, `boot-${TAG}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
