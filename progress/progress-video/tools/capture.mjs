// capture.mjs <spec.json> — deterministic frame-stepped capture of a served build, iPhone portrait 1080x1920.
// spec: { url, out (dir), fps, seconds, loadWaitSec, setup (js, once after load), frame (js body using `t`),
//         hideDom (bool: hide everything but the canvas), clock (bool: fake clock stepping, default true),
//         warmSec (real-time seconds after setup before frame 0) }
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright');
const __hide = async (page, css = '') => { await page.evaluate(() => { let best = null, area = 0; for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width * r.height > area) { area = r.width * r.height; best = c; } } best?.setAttribute('data-main', '1'); });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas[data-main] { visibility: visible !important; } html, body { background: #000 !important; }' + css }); };
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fps = spec.fps ?? 30, n = Math.round((spec.seconds ?? 8) * fps);
fs.mkdirSync(spec.out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
if (spec.clock !== false) await page.clock.install();
await page.goto(spec.url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout((spec.loadWaitSec ?? 15) * 1000);
if (spec.move) {
  // free camera (install-world.js): an eased move from → to; heights over the ground under `from` when fp
  await page.waitForFunction('Boolean(window.__world || window.__wildshard?.world)', undefined, { timeout: 300000, polling: 1000 });
  console.log('install →', await page.evaluate(fs.readFileSync(new URL('./install-world.js', import.meta.url), 'utf8')));
  const m = spec.move;
  console.log('ground →', await page.evaluate(`window.__pose(${JSON.stringify({ ...m.from, fov: m.fov, fp: m.fp })}, true)`));
  await page.waitForTimeout(7000);
  await page.evaluate(`window.__pose(${JSON.stringify({ ...m.from, fov: m.fov, fp: m.fp })}, false)`);
  const lerp = (a, b, u) => a.map((x, k) => x + (b[k] - x) * u);
  spec.frame = `const u0 = Math.min(1, t / ${spec.seconds ?? 8}); const u = 0.5 - 0.5 * Math.cos(Math.PI * u0);
    const A = ${JSON.stringify(m.from)}, B = ${JSON.stringify(m.to)};
    const L = (a, b) => a.map((x, k) => x + (b[k] - x) * u);
    const g = window.__ground, v = window.__cv; window.__cv = { ...v, cam: L(A.cam, B.cam).map((x, k) => k === 1 ? x + g : x), at: L(A.at, B.at).map((x, k) => k === 1 ? x + g : x) };`;
  void lerp;
}
if (spec.setup) console.log('setup →', JSON.stringify(await page.evaluate(spec.setup)).slice(0, 1500));
await page.waitForTimeout((spec.warmSec ?? 3) * 1000);
if (spec.hideDom) await __hide(page, spec.css ?? '');
if (spec.clock !== false) await page.clock.pauseAt(Date.now() + 500);
const frameFn = spec.frame ? new Function('t', spec.frame) : null;
for (let i = 0; i < n; i++) {
  const t = i / fps;
  if (frameFn) await page.evaluate(`(${frameFn.toString()})(${t})`);
  if (spec.clock !== false) await page.clock.runFor(Math.round(1000 / fps));
  else await page.waitForTimeout(1000 / fps);
  await page.screenshot({ path: `${spec.out}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
  if (i % 30 === 0) console.log(`frame ${i}/${n}`);
}
await browser.close();
console.log('done', n);
