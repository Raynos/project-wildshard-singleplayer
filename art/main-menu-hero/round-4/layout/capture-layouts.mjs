// G343 round 4: raw screens of the real main menu (G341 layout B, the portrait centre band) on a local build, iPhone 16
// Pro portrait, Developer off:
//   B-SQ-c    the menu as shipped (the interim SQ-c square in the band)
//   B-<id>    a round-4 square answered for the square hero request (/assets/title/main-crossroads-square.jpg)
// Nothing in the game changes; only that one image request is answered. Unlabelled: the board labels them.
//   scripts/browser-lane.sh node art/main-menu-hero/round-4/layout/capture-layouts.mjs <base url> <out dir> <id>=<jpg> …
// Writes <out dir>/<variant>-iphone.png.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [base, outArg, ...picks] = process.argv.slice(2);
if (!base || !outArg || picks.length === 0) throw new Error('usage: capture-layouts.mjs <base url> <out dir> <id>=<jpg> …');
const out = resolve(outArg);
const variants = [['B-SQ-c', null], ...picks.map((pick) => {
  const [id, file] = pick.split('=');
  if (!id || !file) throw new Error(`expected <id>=<jpg>, got ${pick}`);
  return [`B-${id}`, readFileSync(resolve(file))];
})];
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const [variant, body] of variants) {
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: false });
    await saveFixture(ctx, { scope: 'global', key: 'settings', merge: true, data: { volume: 0 } });
    if (body) await ctx.route('**/assets/title/main-crossroads-square.jpg*', (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body }));
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
    await page.locator('.ws-main-hero').waitFor();
    await page.waitForTimeout(4000);
    const file = `${variant}-iphone.png`;
    await page.screenshot({ path: join(out, file) });
    await ctx.close();
    console.log(file);
  }
} finally { await browser.close(); }
