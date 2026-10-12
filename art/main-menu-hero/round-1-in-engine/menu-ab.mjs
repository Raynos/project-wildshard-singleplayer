// Shoot the real main menu (production) three times: the shipped painted hero, then with candidate G and H served in
// its place through a network route. Nothing in the game changes; only the hero image request is answered differently.
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';

const [out] = process.argv.slice(2);
const BASE = 'https://wildshard-singleplayer.vercel.app/';
const R = '/Users/raynos/projects/games/wildshard-singleplayer/art/main-menu-hero/round-1-in-engine/';
const variants = [['A-painted', null], ['B-pier', `${R}G-driftwood-isle.jpg`], ['C-pine', `${R}H-pine-hollow.jpg`]];
const browser = await chromium.launch({ args: ['--mute-audio'] });
for (const [name, file] of variants) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  if (file) {
    const body = readFileSync(file);
    await ctx.route('**/assets/title/main-crossroads-portrait.jpg*', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body }));
  }
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
await browser.close();
console.log('done');
