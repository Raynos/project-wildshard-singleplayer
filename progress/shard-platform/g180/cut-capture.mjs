#!/usr/bin/env node
// G180 (E435): one content-cut variant of Pine Hollow, measured and captured the same way for the board. The scratch build
// (a dangling commit, never pushed) reads localStorage `g180.cut` = { trees, herd, view } (fractions of today's; see
// README.md); this script sets it, with the Pine memory trim ON (G180's B1 + B2 + B4 + B5), GPU textures KTX2, phone tier,
// render scale 2, midday / clear, iPhone 16 Pro portrait, muted, service worker blocked. After every pose (the same
// portrait poses for every variant) it waits 120 frames and shoots; at the end it takes the labelled GL census
// (scripts/parity/glbytes.mjs) and the JS heap (precise memory info), and counts the world's trees and animals.
// scripts/browser-lane.sh node progress/shard-platform/g180/cut-capture.mjs <preview-url> <out dir> <label> '<cut json>'
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const [url, out, label, cutJson = '{}'] = process.argv.slice(2);
if (!url || !out || !label) throw new Error("Usage: cut-capture.mjs <preview-url> <out dir> <label> '<cut json>'");
const cut = JSON.parse(cutJson);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await context.addInitScript(GL_INIT);
  await context.addInitScript([
    saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'ktx2', time: 'midday', weather: 'clear' }, merge: true }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    saveFixtureCode({ scope: 'device', key: 'debug.plugin.pine-hollow.pineMemoryTrim', data: 'on' }),
    saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  ].join(';'));
  await context.addInitScript((c) => { localStorage.setItem('g180.cut', c); }, JSON.stringify(cut));
  const version = await (await context.request.get(new URL('/version.json', url).href)).json();
  await context.addInitScript((build) => {
    window.__wildshardHarness = { seed: 1, capture: null, lane: 'g180-cut', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
  }, String(version.build));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0`);
  await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
  const poses = await page.evaluate(async () => {
    const cameras = await window.__wildshard.world.game.level.capturePoses?.() ?? {};
    return Object.entries(cameras).flatMap(([name, camera]) => camera.probe ? [{ ...camera.probe, name }] : camera.feet ? [{ name, x: camera.feet[0], y: camera.feet[1], z: camera.feet[2], yaw: -camera.yaw * Math.PI / 180, pitch: camera.pitch * Math.PI / 180 }] : []);
  });
  const frames = (n) => page.evaluate(async (k) => {
    const end = window.__wildshard.world.game.frameCount + k;
    await new Promise((resolve) => { const tick = () => { if (window.__wildshard.world.game.frameCount >= end) resolve(undefined); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  }, n);
  for (const pose of [{ name: 'spawn' }, ...poses]) {
    await page.evaluate((p) => window.__wildshard.pose(p), pose);
    await frames(120);
    if (pose.name !== 'spawn') await page.screenshot({ path: join(out, `${pose.name}.png`) });
  }
  await page.evaluate(() => { globalThis.gc?.(); });
  await frames(30);
  const observed = await page.evaluate(`(() => {
    const g = window.__wildshard.world.game;
    const contexts = window.__sc_gl().map(({gl,...record}) => record);
    const groups = new Map();
    for (const context of contexts) for (const row of context.resources) {
      const key = row.owner + '\\0' + row.asset;
      const group = groups.get(key) ?? {owner:row.owner,asset:row.asset,bytes:0,resources:0};
      group.bytes += row.bytes; group.resources++; groups.set(key,group);
    }
    let animals = 0, trees = 0;
    const w = window.__wildshard.world;
    animals = w?.animals?.animals?.length ?? w?.game?.animals?.animals?.length ?? -1;
    g.scene.traverse((o) => { if (o.isInstancedMesh && /tree/i.test(o.name)) trees = Math.max(trees, o.count); });
    return {assets:[...groups.values()].sort((a,b)=>b.bytes-a.bytes),
      totalBytes:contexts.reduce((sum,c)=>sum+c.totalBytes,0), unlabelled:contexts.reduce((sum,c)=>sum+c.unlabelled,0),
      reconciled:contexts.every(c=>c.reconciled), heapBytes: performance.memory?.usedJSHeapSize ?? null, animals, treesInstanced: trees};
  })()`);
  const record = { label, cut, build: version.build, poses: poses.map((p) => p.name), errors, glBytes: observed.totalBytes, heapBytes: observed.heapBytes, animals: observed.animals, treesInstanced: observed.treesInstanced, reconciled: observed.reconciled, unlabelled: observed.unlabelled, assets: observed.assets };
  writeFileSync(join(out, 'measure.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${label}: GL ${(observed.totalBytes / 1e6).toFixed(2)} MB, heap ${observed.heapBytes === null ? '?' : (observed.heapBytes / 1e6).toFixed(1)} MB, animals ${observed.animals}, trees ${observed.treesInstanced}, errors ${errors.length}`);
  if (errors.length > 0) { console.error(errors); process.exitCode = 2; }
} finally { await browser.close(); }
