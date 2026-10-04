#!/usr/bin/env node
// SF47-g (E435): Pine Hollow's four canyon-gap entries (G93 / G103), each from the road side (at the edge midpoint, looking
// in) and from inside (60 m in, looking back out through the gap). iPhone 16 Pro portrait, phone tier, render scale 2, muted.
// scripts/browser-lane.sh node progress/shard-platform/sf47/entries-board.mjs <preview-url> <out dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [url, out] = process.argv.slice(2);
if (!url || !out) throw new Error('Usage: entries-board.mjs <preview-url> <out dir>');
mkdirSync(out, { recursive: true });
// yaw: three's rotation.y (0 looks to -z); the edge midpoints are at ±250 m
const EDGES = [
  { name: 'north', edge: [0, 248], inside: [0, 190], inward: 0 },
  { name: 'east', edge: [248, 0], inside: [190, 0], inward: Math.PI / 2 },
  { name: 'south', edge: [0, -248], inside: [0, -190], inward: Math.PI },
  { name: 'west', edge: [-248, 0], inside: [-190, 0], inward: -Math.PI / 2 },
];
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await context.addInitScript([
    saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' }, merge: true }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  ].join(';'));
  const version = await (await context.request.get(new URL('/version.json', url).href)).json();
  await context.addInitScript((build) => {
    window.__wildshardHarness = { seed: 1, capture: null, lane: 'sf47-entries', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
  }, String(version.build));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0`);
  await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
  const shots = [];
  for (const e of EDGES) for (const side of ['road', 'inside']) {
    const [x, z] = side === 'road' ? e.edge : e.inside, yaw = side === 'road' ? e.inward : e.inward + Math.PI;
    await page.evaluate((p) => window.__wildshard.pose(p), { x, z, yaw, pitch: 0.04 });
    await page.evaluate(async () => {
      const end = window.__wildshard.world.game.frameCount + 90;
      await new Promise((resolve) => { const tick = () => { if (window.__wildshard.world.game.frameCount >= end) resolve(undefined); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    });
    const feet = await page.evaluate(() => { const p = window.__wildshard.world.player.position; return [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100); });
    const file = join(out, `${e.name}-${side}.png`);
    await page.screenshot({ path: file });
    shots.push({ edge: e.name, side, feet, yaw: Math.round(yaw * 1e4) / 1e4, file });
    console.log(`${e.name} ${side}: feet ${feet.join(', ')}`);
  }
  writeFileSync(join(out, 'shots.json'), `${JSON.stringify({ build: version.build, device: 'iPhone 16 Pro', tier: 'phone', shots, errors }, null, 2)}\n`);
  if (errors.length > 0) { console.error(errors); process.exitCode = 2; }
} finally { await browser.close(); }
