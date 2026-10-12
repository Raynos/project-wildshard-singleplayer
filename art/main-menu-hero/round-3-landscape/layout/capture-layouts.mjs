// G338: raw screens of the real main menu on a local build, iPhone 16 Pro portrait with Developer off and on, and
// desktop landscape 1920 × 1080:
//   A-painted  layout A as shipped (the full-screen painted hero, the cards over it)
//   A-Lb       layout A with round 3's L-b answered for its hero image request (what A would look like with L-b)
//   B-Lb       layout B (L-b as a band in the centre, logo above, cards below), picked through the saved Debug setting
// The layout is picked the way Jake picks it, the saved `mainMenuLayout` setting; only A-Lb routes an image.
//   scripts/browser-lane.sh node art/main-menu-hero/round-3-landscape/layout/capture-layouts.mjs <base url> <out dir> <L-b jpg>
// Writes <out dir>/<variant>-<iphone|desktop>-dev-<off|on>.png (no labels: the plan desk makes the board).
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const [base, outArg, lbArg] = process.argv.slice(2);
if (!base || !outArg || !lbArg) throw new Error('usage: capture-layouts.mjs <base url> <out dir> <L-b jpg>');
const out = resolve(outArg);
const lb = readFileSync(resolve(lbArg));
const surfaces = [
  ['iphone', false, { ...devices['iPhone 16 Pro'] }],
  ['iphone', true, { ...devices['iPhone 16 Pro'] }],
  ['desktop', true, { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
];
const variants = [['A-painted', 'a', false], ['A-Lb', 'a', true], ['B-Lb', 'b', false]];
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const [variant, layout, route] of variants) {
    for (const [surface, developer, options] of surfaces) {
      const ctx = await browser.newContext(options);
      await saveFixture(ctx, { scope: 'device', key: 'devMode', data: developer });
      await saveFixture(ctx, { scope: 'global', key: 'settings', merge: true, data: { mainMenuLayout: layout, volume: 0 } });
      if (route) await ctx.route('**/assets/title/main-crossroads-portrait.jpg*', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: lb }));
      await ctx.route('**/api/**', (r) => r.fulfill({ status: 204, body: '' }));
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
      await page.locator('.ws-main-hero').waitFor();
      const band = await page.evaluate(() => document.querySelector('.ws-main')?.classList.contains('ws-main-band') ?? null);
      if (band !== (layout === 'b')) throw new Error(`layout ${layout} not applied (band: ${band})`);
      await page.waitForTimeout(4000);
      const file = `${variant}-${surface}-dev-${developer ? 'on' : 'off'}.png`;
      await page.screenshot({ path: join(out, file) });
      await ctx.close();
      console.log(file);
    }
  }
} finally { await browser.close(); }
