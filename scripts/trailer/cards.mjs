import { chromium } from '/Users/raynos/projects/project-wildshard-singleplayer/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
mkdirSync(`${dir}cards`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
for (const id of ['title', 'vision', 'chunk1', 'chunk2', 'built', 'end']) {
  await page.goto(`file://${dir}cards.html?card=${id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}cards/${id}.png` });
  console.log('card', id);
}
await browser.close();
