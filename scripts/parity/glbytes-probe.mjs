#!/usr/bin/env node
// SF22b: full, uncapped resident GL census after visiting every authored standing pose.
// scripts/browser-lane.sh node scripts/parity/glbytes-probe.mjs <preview-url> <output.json> [shard] [phone|desktop]
// Add --tile-census --pin=<full SHA> for scalar scene-buffer links and 4x phone CPU.
// Serve a pinned build first with scripts/serve-build.sh --head, from your scratchpad. Phone render scale is 2x.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, devices } from 'playwright';
import { GL_INIT, GL_FULL_INIT } from './glbytes.mjs';
import { captureTileScene } from './tile-census-scene.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';

// Full SHA comes from the serve-build lease; HTTP confirms its build stamp.
const tileCensus = process.argv.includes('--tile-census');
const pin = process.argv.find(arg => arg.startsWith('--pin='))?.slice(6);
if ((tileCensus || pin !== undefined) && !/^[a-f0-9]{40}$/u.test(pin ?? '')) throw new Error('Tile census requires --pin=<full served SHA>');
const labelMode = process.argv.find(arg => arg.startsWith('--gl-labels='))?.slice(12) ?? 'sampled';
if (!['sampled', 'full'].includes(labelMode)) throw new Error('GL labels must be sampled or full');
const [url, output, shard = 'pine-hollow', tier = 'phone'] = process.argv.slice(2).filter(arg => !arg.startsWith('--gl-labels=') && !arg.startsWith('--pin=') && arg !== '--tile-census');
if (!url || !output || !['phone', 'desktop'].includes(tier)) throw new Error('Usage: glbytes-probe.mjs <preview-url> <output.json> [shard] [phone|desktop]');
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(tier === 'phone'
    ? { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(labelMode === 'full' ? GL_FULL_INIT : GL_INIT);
  await context.addInitScript([
    saveFixtureCode({ scope: 'global', key: 'settings', data: { tier, fps: 'auto', volume: 0 }, merge: true }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  ].join(';'));
  const page = await context.newPage();
  if (tileCensus && tier === 'phone') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const errors = /** @type {string[]} */ ([]);
  page.on('pageerror', (error) => errors.push(error.message));
  const version = await (await page.request.get(new URL('/version.json', url).href)).json();
  if (pin !== undefined && !String(version.build).startsWith(`${pin.slice(0, 7)}-`)) throw new Error('Census build stamp differs from served SHA');
  await context.addInitScript((build) => {
    window.__wildshardHarness = { seed: 1, capture: null, lane: 'glbytes-census', sha: build, browser: 'chromium', errors: [], audioRequests: [], saves: { read: [], written: [] } };
  }, String(version.build));
  await page.goto(`${url}/?chunk=${encodeURIComponent(shard)}&mute=1&skipintro=1&nolock=1&sw=0`);
  await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 120000 });
  const actual = await page.evaluate('window.__wildshard.requireWorld().game.level.id');
  if (actual !== shard) throw new Error(`Census requested ${shard}, entered ${actual}`);
  const poses = await page.evaluate(async () => {
    const cameras = await window.__wildshard.requireWorld().game.level.capturePoses?.() ?? {};
    return Object.entries(cameras).flatMap(([name, camera]) => camera.probe ? [{ ...camera.probe, name }] : camera.feet ? [{ name, x: camera.feet[0], y: camera.feet[1], z: camera.feet[2], yaw: -camera.yaw * Math.PI / 180, pitch: camera.pitch * Math.PI / 180 }] : []);
  });
  for (const pose of [{ name: 'spawn' }, ...poses]) {
    await page.evaluate((p) => window.__wildshard.pose(p), pose);
    await page.evaluate(async () => {
      const end = window.__wildshard.requireWorld().game.frameCount + 60;
      await new Promise((resolve) => { const tick = () => { if (window.__wildshard.requireWorld().game.frameCount >= end) resolve(undefined); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    });
  }
  const observed = /** @type {import('./glbytes.mjs').CensusObservation} */ (await page.evaluate(`(() => {
    const g = window.__wildshard.requireWorld().game;
    const contexts = window.__sc_gl().map(({gl,...record}) => record);
    const groups = new Map();
    for (const context of contexts) for (const row of context.resources) {
      const key = row.owner + '\\0' + row.asset;
      const group = groups.get(key) ?? {owner:row.owner,asset:row.asset,bytes:0,resources:0};
      group.bytes += row.bytes; group.resources++; groups.set(key,group);
    }
    return {contexts, assets:[...groups.values()].sort((a,b)=>b.bytes-a.bytes || a.asset.localeCompare(b.asset)),
      totalBytes:contexts.reduce((sum,c)=>sum+c.totalBytes,0),
      listedBytes:contexts.reduce((sum,c)=>sum+c.listedBytes,0),
      unlabelled:contexts.reduce((sum,c)=>sum+c.unlabelled,0),
      reconciled:contexts.every(c=>c.reconciled),
      renderScale:g.renderer.getPixelRatio(),canvas:[g.canvas.width,g.canvas.height],viewport:[innerWidth,innerHeight],
      renderer:g.renderer.getContext().getParameter(g.renderer.getContext().RENDERER)};
  })()`));
  let tileData = {};
  if (tileCensus) {
    const allocation = await page.evaluate('window.__wildshard.memory()');
    const scene = /** @type {import('./tile-census-scene.mjs').CensusSceneSnapshot} */ (await page.evaluate(
      `(${captureTileScene.toString()})(window.__wildshard.requireWorld().game.scene, source => window.__sc_gl_source_ids?.(source) ?? [])`));
    tileData = { pinned: pin, cpuRate: tier === 'phone' ? 4 : 1, allocation,
      nodes: scene.nodes, cpuBuffers: scene.cpuBuffers, sceneCpuVersion: 1 };
  }
  const record = { ...tileData, version, shard, tier, labelMode, poses: ['spawn', ...poses.map((pose) => pose.name)], observed, errors };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${shard}.${tier}: ${observed.contexts.reduce((sum, c) => sum + c.resources.length, 0)} resources, ${observed.totalBytes} bytes (${(observed.totalBytes / 2 ** 20).toFixed(2)} MiB), ${observed.unlabelled} unlabelled, reconciled=${observed.reconciled}`);
  if (!observed.reconciled || observed.unlabelled > 0 || errors.length > 0) process.exitCode = 2;
} finally { await browser.close(); }
