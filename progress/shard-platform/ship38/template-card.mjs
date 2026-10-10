// SHARD-PLATFORM op-ship38: the Template card in SHARD SELECT. For each way in (the cold title, or a loaded shard's title;
// Developer on), select the Template card, read its buttons, press one (or the Enter key), and record the shard booted.
//   scripts/browser-lane.sh node progress/shard-platform/ship38/template-card.mjs <preview-url> <out-dir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: template-card.mjs <preview-url> <out-dir>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
async function attempt(label, from, press) {
  const row = { label, from, press, buttons: null, booted: null, url: null, errors: [] };
  const ctx = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => row.errors.push(String(e.message).slice(0, 200)));
  try {
    await page.goto(`${base}/${from}`, { waitUntil: 'commit' });
    await page.locator('.ws-main-select').click();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.ws-menu-card')].find((e) => e.querySelector('b')?.textContent === 'Template shard');
      if (!el) throw new Error(`no Template card in ${[...document.querySelectorAll('.ws-menu-card b')].map((b) => b.textContent).join(' | ')}`);
      document.querySelector(`.ws-menu-dots i[data-i="${el.dataset.i}"]`)?.click();
    });
    await page.waitForTimeout(600);
    row.buttons = await page.evaluate(() => [...document.querySelectorAll('.ws-menu-modes button')].map((b) => ({ cls: b.className, text: b.textContent.trim().replace(/\s+/gu, ' '), disabled: b.disabled, hidden: b.hidden })));
    if (press === 'key') await page.keyboard.press('Enter');
    else await page.locator(press).click({ timeout: 5000 });
    row.travelled = await page.waitForURL(/chunk=_template/u, { timeout: 20000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'), undefined, { timeout: 180000 });
    row.booted = await page.evaluate(() => window.__wildshard.shard.slug);
    row.url = page.url();
    await page.screenshot({ path: join(out, `template-${label}.jpg`), type: 'jpeg', quality: 70 });
  } catch (e) { row.failure = String(e).slice(0, 300); row.url = page.url(); }
  finally { await ctx.close(); }
  results.push(row); console.log(JSON.stringify(row));
}
const q = '?tier=phone&mute=1&nolock=1&sw=0';
try {
  await attempt('cold-shardfile', q, '.ws-menu-shardfile');
  await attempt('cold-key', q, 'key');
  await attempt('loaded-shardfile', `${q}&chunk=driftwood-isle`, '.ws-menu-shardfile');
  await attempt('loaded-key', `${q}&chunk=driftwood-isle`, 'key');
} finally { await browser.close(); }
writeFileSync(join(out, 'template-card.json'), `${JSON.stringify(results, null, 2)}\n`);
