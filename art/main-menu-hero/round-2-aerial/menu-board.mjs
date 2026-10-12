// Shoot the real production main menu with the shipped painted hero, then with round-2 candidates served in its place
// through a network route. Nothing in the game changes; only the hero image request is answered differently.
//   scripts/browser-lane.sh node art/main-menu-hero/round-2-aerial/menu-board.mjs <out-dir> M-b M-c T-c
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [out, ...ids] = process.argv.slice(2);
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://wildshard-singleplayer.vercel.app/';
const variants = [['painted', null], ...ids.map((id) => [id, join(HERE, `${id}-grid.jpg`)])];
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
  await page.screenshot({ path: join(out, `${name}.png`) });
  await ctx.close();
}
await browser.close();
console.log('done');
