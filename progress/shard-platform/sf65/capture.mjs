// SF65 (G237–G241, E435): SHARD SELECT's LEGACY / SHARDFILE entry buttons. iPhone 16 Pro portrait, muted.
//   scripts/browser-lane.sh node progress/shard-platform/sf65/capture.mjs --url=<preview> --out=<dir> [--enter=0|1]
// A: Developer OFF SHARD SELECT (one ENTER WORLD, no badge). B: Developer ON, every card (badge, both buttons, their
// states). C: every enabled button enters its shard (a fresh page each), and D: the ✎ note sheet's Level row shows shard · entry.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), enter = arg('enter') !== '0', only = arg('only');
if (!base || !out) throw new Error('Pass --url and --out');
mkdirSync(out, { recursive: true });
const report = { base, off: null, on: [], entries: [], errors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const slugOf = name => name.toLowerCase().replaceAll(/\W+/g, '-');
const title = async (page) => {
  await page.goto(`${base}/?mute=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-select').click({ timeout: 300_000 });
  await page.waitForTimeout(1200);
};
const state = (page) => page.evaluate(() => {
  const btn = (sel) => { const b = document.querySelector(sel); return b instanceof HTMLButtonElement ? { hidden: b.hidden, disabled: b.disabled, label: b.querySelector('b')?.textContent ?? '', line: b.querySelector('small')?.textContent ?? '' } : null; };
  const card = document.querySelector('.ws-menu-card.selected');
  return { name: card?.querySelector('b')?.textContent ?? null, badge: card?.querySelector('.ws-menu-card-port')?.textContent ?? null,
    play: btn('.ws-menu-play'), shardfile: btn('.ws-menu-shardfile') };
});
const devContext = async () => {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  // the ✎ note disc shows once the review inbox is unlocked (a capture-only password: nothing is sent)
  await saveFixture(context, { scope: 'global', key: 'review', data: { password: 'sf65-capture', quick: true } });
  return context;
};
try {
  {
    const context = await browser.newContext(devices['iPhone 16 Pro']);
    const page = await context.newPage(); page.on('pageerror', e => { report.errors.push(`off: ${e.message}`); });
    await title(page);
    report.off = await state(page);
    await page.screenshot({ path: join(out, 'A-developer-off.jpg'), type: 'jpeg', quality: 70 });
    await context.close();
  }
  {
    const context = await devContext();
    const page = await context.newPage(); page.on('pageerror', e => { report.errors.push(`on: ${e.message}`); });
    await title(page);
    const count = await page.locator('.ws-menu-dots i').count();
    for (let i = 0; i < count; i += 1) {
      await page.locator('.ws-menu-dots i').nth(i).click(); await page.waitForTimeout(700);
      const s = await state(page);
      if (s.play?.label !== 'LEGACY') continue; // a draft's COMING SOON card
      report.on.push({ index: i, ...s });
      await page.screenshot({ path: join(out, `B-developer-on-${slugOf(s.name ?? String(i))}.jpg`), type: 'jpeg', quality: 70 });
    }
    await context.close();
  }
  if (enter) for (const card of report.on) for (const [mode, sel] of [['legacy', '.ws-menu-play'], ['shardfile', '.ws-menu-shardfile']]) {
    if (only && !only.split(',').some(o => slugOf(card.name ?? '').includes(o))) continue;
    const button = mode === 'legacy' ? card.play : card.shardfile;
    if (button === null || button.disabled) { report.entries.push({ card: card.name, mode, entered: false, disabled: button?.line ?? 'missing' }); continue; }
    const ctx = await devContext(), p = await ctx.newPage(), errors = [], t0 = Date.now();
    p.on('pageerror', e => { errors.push(e.message); });
    const row = { card: card.name, mode, entered: false };
    try {
      await title(p);
      await p.locator('.ws-menu-dots i').nth(card.index).click(); await p.waitForTimeout(600);
      await p.locator(sel).click();
      await p.waitForFunction(() => window.__wildshard?.world?.hud !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240_000 });
      await p.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
      await p.waitForFunction(() => window.__wildshard.world.game.app.state === 'play' && !window.__wildshard.world.hud.paused, null, { timeout: 120_000 });
      await p.waitForTimeout(2500);
      row.entered = true; row.seconds = Math.round((Date.now() - t0) / 1000);
      row.slot = await p.evaluate(() => JSON.parse(sessionStorage.getItem('wildshard.save.v2.session') ?? '{}').keys?.shardEntry?.data ?? null);
      row.fps = await p.evaluate(() => window.__wildshard.world.game.stats.fps);
      await p.screenshot({ path: join(out, `C-${slugOf(card.name ?? '')}-${mode}.jpg`), type: 'jpeg', quality: 62 });
      await p.locator('.ws-fb-disc').click({ timeout: 20_000 });
      await p.waitForSelector('.ws-fb-ctx', { timeout: 20_000 }); await p.waitForTimeout(500);
      row.level = await p.evaluate(() => [...document.querySelectorAll('.ws-fb-ctx .ws-fb-kv')].slice(0, 2).map((kv) => kv.textContent).join(' | '));
      await p.screenshot({ path: join(out, `D-note-${slugOf(card.name ?? '')}-${mode}.jpg`), type: 'jpeg', quality: 62 });
    } catch (e) { row.failure = String(e?.message ?? e).split('\n')[0]; await p.screenshot({ path: join(out, `F-${slugOf(card.name ?? '')}-${mode}.jpg`), type: 'jpeg', quality: 62 }).catch(() => undefined); row.screen = await p.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => null); }
    row.errors = errors; report.entries.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, off: report.off, on: report.on.length, errors: report.errors }));
