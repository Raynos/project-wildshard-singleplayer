// SHARD-PLATFORM M3 hybrid-rows: Signal Dunes standalone boot on the served build (Chromium, muted, iPhone 16 Pro):
// entry, the bound whip (declared item row → runtime family), quest progress through the bound quest, a whip crack.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
const page = await context.newPage(), errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const t0 = Date.now();
await page.goto(`${url}?chunk=sunscar-dunes&tier=phone&touch=1&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), null, { timeout: 180_000, polling: 250 });
await page.waitForTimeout(4000);
const bootMs = Date.now() - t0;
await page.screenshot({ path: `${out}/entry.jpg`, type: 'jpeg', quality: 70 });
const result = await page.evaluate(async () => {
  const probe = window.__wildshard, keys = Object.keys(probe);
  const app = probe.world.game.app;
  const snap = probe.shard;
  const dunes = snap.sunscar;
  if (dunes === undefined) return { keys, snapKeys: Object.keys(snap) };
  const equipment = app.equipment ?? null;
  const r = { whip: dunes.whip?.constructor?.name ?? null, whipId: dunes.whip?.id ?? null, current: equipment?.current?.id ?? null,
    quest: { id: dunes.quest?.def?.id ?? null, index0: dunes.quest?.index ?? null } };
  dunes.places.flags.set('sunscar.scout'); app.events.flush('update');
  r.quest.afterScout = dunes.quest.index;
  dunes.stage('waymarks-lit'); app.events.flush('update');
  r.quest.afterWaymarks = dunes.quest.index; r.quest.chip = document.querySelector('.ws-quest-chip, [class*="quest-chip"]')?.textContent ?? null;
  const before = dunes.whip?.crackT ?? null; app.input.press('attack');
  r.crack = { before, after: dunes.whip?.crackT ?? null, cooldown: dunes.whip?.cooldown ?? null };
  return r;
});
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/after-crack.jpg`, type: 'jpeg', quality: 70 });
const record = { url, device: 'iPhone 16 Pro', bootMs, result, errors };
writeFileSync(`${out}/browser-run.json`, JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
await browser.close();
