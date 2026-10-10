// SHARD-PLATFORM op-ship38 (G325, SF67): where the page's AudioContext is made on an arrival boot. Desktop Chromium (muted,
// 1440×900, 4× CPU through CDP), the player's own way in: a loaded Driftwood title ▸ SHARD SELECT ▸ another card ▸ ENTER WORLD, a fresh page
// that enters at once (arrival `enter`). An init script times every AudioContext constructor (start, ms, whether the page
// had a gesture yet) and a CPU profile covers the arrival page from its first script to ten seconds after it entered; then
// one tap on the canvas. Reports each constructor and the profile's self time inside it (`AudioContext` frames).
//   scripts/browser-lane.sh node progress/shard-platform/ship38/audio-boot.mjs <preview-url> <out.json> [card]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [base, out, card = 'Nalati Grasslands'] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: audio-boot.mjs <preview-url> <out.json> [card]');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { base, card, version: null, contexts: [], beforeTap: null, afterTap: null, profile: null, errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    const made = []; window.__acMade = made; let gestured = false;
    for (const type of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.addEventListener(type, () => { gestured = true; }, { capture: true });
    const Real = window.AudioContext;
    if (Real) window.AudioContext = class extends Real { constructor(...args) { const t = performance.now(); super(...args); made.push({ at: Math.round(t), ms: Math.round((performance.now() - t) * 10) / 10, gestured, href: location.search, stack: String(new Error().stack).split("\n").slice(2, 9).join(" <- ") }); } };
  });
  await ctx.route('**/api/errors', (r) => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(String(e.message).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${base}/?mute=1&sw=0`, { waitUntil: 'commit' });
  await page.locator('.ws-main-select').click();
  await page.evaluate((name) => {
    const el = [...document.querySelectorAll('.ws-menu-card')].find((e) => e.querySelector('b')?.textContent === name);
    if (!el) throw new Error(`Missing card ${name}`);
    document.querySelector(`.ws-menu-dots i[data-i="${el.dataset.i}"]`)?.click();
  }, card);
  await page.waitForTimeout(500);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  await page.locator('.ws-menu-play').click();
  await page.waitForURL(/chunk=/u, { waitUntil: 'commit' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered === true && !document.querySelector('.ws-load'), undefined, { timeout: 300000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(10000);
  report.beforeTap = await page.evaluate(() => [...window.__acMade]);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(), dt = profile.timeDeltas ?? [];
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const name = n?.callFrame.functionName ?? ''; if (/AudioContext/u.test(name)) self.set(name, (self.get(name) ?? 0) + (dt[i] ?? 0) / 1000); });
  report.profile = { audioContextSelfMs: Object.fromEntries([...self].map(([k, v]) => [k, Math.round(v)])), durationMs: Math.round((profile.endTime - profile.startTime) / 1000) };
  await page.mouse.click(720, 450);
  await page.waitForTimeout(1500);
  report.afterTap = await page.evaluate(() => [...window.__acMade]);
  await ctx.close();
} catch (e) { report.failure = String(e?.stack ?? e).slice(0, 500); }
finally { await browser.close(); }
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ card, beforeTap: report.beforeTap, afterTap: report.afterTap, profile: report.profile, failure: report.failure ?? null, errors: report.errors.length }));
