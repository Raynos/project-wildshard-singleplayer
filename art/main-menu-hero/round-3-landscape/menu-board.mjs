// Shoot the real main menu of a local build, desktop landscape and iPhone portrait, with a round-3 candidate served as
// the hero image through a network route. Nothing in the game changes; only the hero image request is answered.
//   scripts/browser-lane.sh node art/main-menu-hero/round-3-landscape/menu-board.mjs <base url> <out dir> <hero jpg>
// Writes <out dir>/menu-desktop.png (1920 × 1080, DSF 1) and <out dir>/menu-phone.png (iPhone 16 Pro portrait).
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, out, hero] = process.argv.slice(2);
if (!base || !out || !hero) throw new Error('usage: menu-board.mjs <base url> <out dir> <hero jpg>');
const body = readFileSync(hero);
const browser = await chromium.launch({ args: ['--mute-audio'] });
try {
  for (const [name, options] of [
    ['desktop', { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
    ['phone', { ...devices['iPhone 16 Pro'] }],
  ]) {
    const ctx = await browser.newContext(options);
    await ctx.route('**/assets/title/main-crossroads-portrait.jpg*', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body }));
    await ctx.route('**/api/**', (route) => route.fulfill({ status: 204, body: '' }));
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
    await page.locator('.ws-main-hero').waitFor();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(out, `menu-${name}.png`) });
    await ctx.close();
    console.log(`menu-${name}.png`);
  }
} finally { await browser.close(); }
