#!/usr/bin/env node
// Muted iPhone portrait reveal readiness trace; enter through the real grid title tap, never skip the reveal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const { chromium, devices } = await import('playwright');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), label = flag('label', 'readiness');
if (base === '') throw new Error('--url=<committed preview> required');
const version = await (await fetch(`${base}/version.json`)).json();
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const samples = [], errors = [], warnings = [];
let timings = null;
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  if (args.includes('--hybrid')) await saveFixture(context, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: 'on' });
  const page = await context.newPage();
  page.on('pageerror', (error) => { errors.push(error.message); });
  page.on('console', (message) => { if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text()); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 240_000 });
  await page.locator('.ws-main-grid').waitFor({ timeout: 240_000 });
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid')?.click(); }, 100); });
  await page.waitForFunction(() => window.__wsReveal?.startedAt >= 0, null, { timeout: 240_000 });
  for (let elapsed = 0; elapsed < 40_000; elapsed += 500) {
    const sample = await page.evaluate(() => ({ timings: window.__wsReveal, grid: window.__wildshard?.shard?.grid?.state() }));
    samples.push(sample); timings = sample.timings;
    if (timings?.endedMs !== null && timings?.endedMs !== undefined) break;
    await page.waitForTimeout(500);
  }
  await context.close();
} finally {
  await browser.close();
  const out = resolve('progress/shard-platform/sf21a'); mkdirSync(out, { recursive: true });
  const file = resolve(out, `reveal-${label}-${version.build}.json`);
  writeFileSync(file, `${JSON.stringify({ version, timings, errors, warnings, samples }, null, 2)}\n`);
  console.log(JSON.stringify({ file, version, timings, errors, warnings }));
}
