// SHARD-PLATFORM op-ship38 (G326, E435): legacy against shardfile at the same poses, entered the way SHARD SELECT does it
// (Developer on: main menu ▸ SHARD SELECT ▸ the card ▸ LEGACY / SHARDFILE; no URL switch picks the copy). Muted iPhone 16
// Pro portrait, phone tier, Developer on, clock parked at midday, clear weather, the HUD hidden. The legacy side boots
// first; its settled spawn feet are the poses for both sides: the spawn view, then turned 120° and 240°. Each pose gets an
// MAE (0–255 on 390-px copies) and both sides' mean colour.
//   scripts/browser-lane.sh node progress/shard-platform/ship38/parity.mjs --url=<preview> --out=<dir> --card="Pine Hollow"
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../scripts/debug-settings.mjs';

const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), card = arg('card');
if (!base || !out || !card) throw new Error('Pass --url, --out and --card');
mkdirSync(out, { recursive: true });
const slugOf = card.toLowerCase().replace(/[^a-z]+/gu, '-');
const report = { base, card, version: null, sides: {}, poses: [], diffs: [] };
const hideHud = page => page.addStyleTag({ content: '#hud, .ws-toast, .ws-hints, .ws-minimap, .ws-touch, .ws-grid-banner, .ws-dev-banner, [class*="ws-memory"] { visibility: hidden !important; }' });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function side(mode) {
  const row = { mode, errors: [], consoleErrors: [], shard: null, bootMs: null, shots: [] };
  report.sides[mode] = row;
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await debugSettings(context, { time: 'midday' });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage(); page.setDefaultTimeout(300_000);
  page.on('pageerror', e => { row.errors.push(String(e.message).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error' && row.consoleErrors.length < 8) row.consoleErrors.push(m.text().slice(0, 300)); });
  try {
    const t0 = Date.now();
    await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0&weather=clear`, { waitUntil: 'commit' });
    await page.locator('.ws-main-select').click();
    await page.evaluate(name => {
      const el = [...document.querySelectorAll('.ws-menu-card')].find(e => e.querySelector('b')?.textContent === name);
      if (!el) throw new Error(`Missing shard card ${name}`);
      document.querySelector(`.ws-menu-dots i[data-i="${el.dataset.i}"]`)?.click();
    }, card);
    await page.waitForTimeout(500);
    await page.locator(mode === 'legacy' ? '.ws-menu-play' : '.ws-menu-shardfile').click();
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'), undefined, { timeout: 300_000 });
    row.bootMs = Date.now() - t0;
    report.version ??= await page.evaluate(async () => (await fetch('/version.json')).json());
    row.shard = await page.evaluate(() => window.__wildshard.shard.slug);
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await hideHud(page);
    await page.waitForTimeout(8000);
    if (report.poses.length === 0) {
      const feet = await page.evaluate(() => { const pl = window.__wildshard.world.player, r = n => Math.round(n * 100) / 100; return { x: r(pl.position.x), y: r(pl.position.y), z: r(pl.position.z), yaw: r(pl.yaw) }; });
      for (const [i, turn] of [0, 2.0944, 4.1888].entries()) report.poses.push({ name: `view-${i + 1}`, x: feet.x, y: feet.y, z: feet.z, yaw: feet.yaw + turn, pitch: -0.05 });
    }
    for (const p of report.poses) {
      await page.evaluate(q => window.__wildshard.pose(q), { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: join(out, `${slugOf}-${p.name}-${mode}.jpg`), type: 'jpeg', quality: 80 });
      row.shots.push(p.name);
    }
  } catch (error) { row.failure = String(error?.stack ?? error).slice(0, 600); }
  finally { await context.close(); }
}

try { await side('legacy'); await side('shardfile'); }
finally { await browser.close(); }

const meanRGB = f => execFileSync('magick', [f, '-resize', '390x', '-format', '%[fx:255*mean.r] %[fx:255*mean.g] %[fx:255*mean.b]', 'info:']).toString().trim().split(' ').map(n => Math.round(Number(n) * 10) / 10);
for (const p of report.poses) {
  if (!report.sides.legacy?.shots.includes(p.name) || !report.sides.shardfile?.shots.includes(p.name)) continue;
  const a = join(out, `${slugOf}-${p.name}-legacy.jpg`), b = join(out, `${slugOf}-${p.name}-shardfile.jpg`);
  let mae = null;
  try { execFileSync('magick', ['compare', '-metric', 'MAE', '(', a, '-resize', '390x', ')', '(', b, '-resize', '390x', ')', 'null:'], { stdio: ['ignore', 'pipe', 'pipe'] }); mae = 0; }
  catch (e) { const m = /^([\d.e+-]+)/u.exec(String(e.stderr)); mae = m ? Math.round(Number(m[1]) / 257 * 10) / 10 : null; }
  report.diffs.push({ pose: p.name, mae, legacy: meanRGB(a), shardfile: meanRGB(b) });
}
writeFileSync(join(out, `parity-${slugOf}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ card, legacy: { shard: report.sides.legacy?.shard, failure: report.sides.legacy?.failure ?? null, errors: report.sides.legacy?.errors.length }, shardfile: { shard: report.sides.shardfile?.shard, failure: report.sides.shardfile?.failure ?? null, errors: report.sides.shardfile?.errors.length }, diffs: report.diffs }));
