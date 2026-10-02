import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const out = dirname(fileURLToPath(import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => { document.addEventListener('ws:ready', () => { Reflect.set(window, '__j15bReady', true); }); });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${process.argv[2]}?touch&tier=phone&chunk=driftwood-isle&skipintro&mute`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Reflect.get(window, '__j15bReady') === true, { timeout: 120000 });
  await page.locator('.ws-touch-pause').waitFor({ timeout: 60000 });
  await page.locator('.ws-touch-pause').tap();
  const button = page.getByRole('switch', { name: /developer mode/i });
  await button.scrollIntoViewIfNeeded();
  const state = () => button.evaluate((el) => ({ checked: el.getAttribute('aria-checked'), on: el.classList.contains('on') }));
  const before = await state();
  assert.deepEqual(before, { checked: 'false', on: false });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, 'before-tap.jpg'), type: 'jpeg', quality: 85 });
  await button.tap();
  const afterOn = await state();
  assert.deepEqual(afterOn, { checked: 'true', on: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, 'after-tap-on.jpg'), type: 'jpeg', quality: 85 });
  await button.tap();
  const afterOff = await state();
  assert.deepEqual(afterOff, { checked: 'false', on: false });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, 'after-tap-off.jpg'), type: 'jpeg', quality: 85 });
  assert.deepEqual(errors, []);
  const proof = { url: process.argv[2], viewport: { width: 390, height: 844 },
    touch: await page.evaluate(() => ({ points: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches })),
    before, afterOn, afterOff, errors };
  await writeFile(join(out, 'proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof));
} finally { await browser.close(); }
