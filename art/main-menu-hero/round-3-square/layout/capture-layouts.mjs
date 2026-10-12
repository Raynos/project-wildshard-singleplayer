// G344: raw screens of the real main menu (G341 layout B, the portrait centre band) on a local build, iPhone 16 Pro
// portrait with Developer off and on:
//   B-Lb      the menu as shipped (the landscape L-b in the band)
//   B-<id>    a square candidate answered for the hero image request (/assets/title/main-crossroads-landscape.jpg)
// Nothing in the game changes; only the hero image request is answered. Unlabelled: the plan desk makes the board.
//   scripts/browser-lane.sh node art/main-menu-hero/round-3-square/layout/capture-layouts.mjs <base url> <out dir> <id>=<jpg> …
// Writes <out dir>/<variant>-iphone-dev-<off|on>.png.
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const [base, outArg, ...picks] = process.argv.slice(2);
if (!base || !outArg || picks.length === 0) throw new Error('usage: capture-layouts.mjs <base url> <out dir> <id>=<jpg> …');
const out = resolve(outArg);
const variants = [['B-Lb', null], ...picks.map((pick) => {
  const [id, file] = pick.split('=');
  if (!id || !file) throw new Error(`expected <id>=<jpg>, got ${pick}`);
  return [`B-${id}`, readFileSync(resolve(file))];
})];
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const [variant, body] of variants) {
    for (const developer of [false, true]) {
      const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
      await saveFixture(ctx, { scope: 'device', key: 'devMode', data: developer });
      await saveFixture(ctx, { scope: 'global', key: 'settings', merge: true, data: { volume: 0 } });
      if (body) await ctx.route('**/assets/title/main-crossroads-landscape.jpg*', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body }));
      await ctx.route('**/api/**', (r) => r.fulfill({ status: 204, body: '' }));
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
      await page.locator('.ws-main-hero').waitFor();
      await page.waitForTimeout(4000);
      const file = `${variant}-iphone-dev-${developer ? 'on' : 'off'}.png`;
      await page.screenshot({ path: join(out, file) });
      await ctx.close();
      console.log(file);
    }
  }
} finally { await browser.close(); }
