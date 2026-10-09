// scout.mjs <spec.json> — stills from free-camera views in one page load (window.__world builds).
// spec: { url, out, ready (js expr, truthy when loaded), install (js, run once), views: [{ id, cam, at, fov, fp, eval }] }
// fp: cam[1] / at[1] are metres above the ground under the camera (player.spawn drops the player there).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright');
const __hide = async (page, css = '') => { await page.evaluate(() => { let best = null, area = 0; for (const c of document.querySelectorAll('canvas')) { const r = c.getBoundingClientRect(); if (r.width * r.height > area) { area = r.width * r.height; best = c; } } best?.setAttribute('data-main', '1'); });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas[data-main] { visibility: visible !important; } html, body { background: #000 !important; }' + css }); };
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
spec.install ??= fs.readFileSync(new URL('./install-world.js', import.meta.url), 'utf8');
spec.ready ??= 'Boolean(window.__world || window.__wildshard?.world)';
fs.mkdirSync(spec.out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: spec.dpr ?? 1.5, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 200)));
await page.goto(spec.url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(spec.ready ?? 'Boolean(window.__world)', undefined, { timeout: 300000, polling: 1000 });
await page.waitForTimeout(4000);
console.log('install →', JSON.stringify(await page.evaluate(spec.install ?? 'null')).slice(0, 800));
await __hide(page, spec.css ?? '');
await page.waitForTimeout(6000);
for (const v of spec.views) {
  const r = await page.evaluate(`window.__pose(${JSON.stringify(v)}, true)`);
  await page.waitForTimeout(v.wait ?? 5000);
  const r2 = await page.evaluate(`window.__pose(${JSON.stringify(v)}, false)`);
  if (v.eval) await page.evaluate(v.eval);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${spec.out}/${v.id}.jpg`, type: 'jpeg', quality: 80 });
  console.log(v.id, JSON.stringify(r), JSON.stringify(r2));
}
await browser.close();
