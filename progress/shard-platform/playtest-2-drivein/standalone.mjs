// Playtest round 2 drive-in rows: the same spots in SHARD SELECT (the shard alone), the reference for each grid capture.
// scripts/browser-lane.sh node progress/shard-platform/playtest-2-drivein/standalone.mjs --url=<preview> --out=<dir> --tag=<t> --shard=<Card name> --poses=<json [[name,x,z,yaw,pitch,y?],…] in shard-local metres>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), shard = arg('shard'), poses = JSON.parse(arg('poses') || '[]');
if (!base || !out || !tag || !shard) throw new Error('Pass --url, --out, --tag, --shard and --poses');
mkdirSync(out, { recursive: true });
const report = { base, tag, shard, shots: [], errors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.waitForSelector('.ws-main-select', { timeout: 300_000 }); await page.locator('.ws-main-select').click();
  await page.evaluate(name => { const card = [...document.querySelectorAll('.ws-menu-card')].find(e => e.querySelector('b')?.textContent === name); if (!card) throw new Error('Missing shard card'); document.querySelector(`.ws-menu-dots i[data-i="${card.dataset.i}"]`)?.click(); }, shard);
  await page.locator('.ws-menu-play').click();
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'), undefined, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForTimeout(8000);
  for (const [name, x, z, yaw, pitch, y = 0.55] of poses) { // y: the feet height (default: a road pose)
    await page.evaluate(p => window.__wildshard.pose(p), { x, z, y, yaw, pitch });
    await page.waitForTimeout(6000);
    await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `${name}-${tag}.jpg`), type: 'jpeg', quality: 72 });
    report.shots.push(name);
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `standalone-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), shots: report.shots }));
if (report.failure) process.exitCode = 1;
