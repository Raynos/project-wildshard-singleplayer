// rigbake.mjs — lab P8 round 13: open the lab page, run __ndVm.bake(), write the raw GLB (then meshopt by hand)
import { writeFileSync } from 'node:fs';

const { chromium } = await import('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs');
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 600)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 400)}`); });
  await page.goto('http://localhost:5173/dev/nd-lab-viewmodel.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ndVm !== undefined, undefined, { timeout: 120000 });
  await page.evaluate(() => window.__ndVm.ready);
  console.log('loaded', JSON.stringify(await page.evaluate(() => window.__ndVm.loaded())));
  const r = await page.evaluate(() => window.__ndVm.bake());
  writeFileSync(out, Buffer.from(r.b64, 'base64'));
  console.log(r.report.join('\n'));
  await context.close();
} finally {
  await browser.close();
}
