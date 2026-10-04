#!/usr/bin/env node
// SHARD-PLATFORM SF16, the M1 look board: today's template (the legacy chunk, ?chunk=_template on the built client)
// beside the template booted from its shardfile through the real client (the same build with the template's shardfile
// embedded: clientViews + rings + water + exported creatures + the look), six matched cameras, SSIM per pair.
// Run through the browser lane only, outside quiet windows:
//   pnpm build && node scripts/wildshard.mjs build src/shards/_template <client-dir>
//   scripts/browser-lane.sh node progress/shard-platform/sf16/board.mjs dist <client-dir> <scratch-out>
// Writes progress/shard-platform/sf16/board.jpg (JPEG <= 500 KB) and evidence.json.
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, resolve as resolvePath, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { installInit } from '../../../scripts/parity/init.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { ssim } from '../../../scripts/parity/ssim.mjs';

const [legacyDir, clientDir, outDir] = process.argv.slice(2).map((path) => resolvePath(path));
if (legacyDir === undefined || clientDir === undefined || outDir === undefined) throw new Error('usage: board.mjs <dist> <shardfile client dir> <scratch out>');
mkdirSync(outDir, { recursive: true });
const here = import.meta.dirname;
const mime = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.m4a': 'audio/mp4', '.ktx2': 'image/ktx2' };
const serve = (directory) => new Promise((resolve) => {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname, file = resolvePath(directory, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${directory}/`)) { response.writeHead(403); response.end(); return; }
    try { if (!statSync(file).isFile()) throw new Error('missing'); response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(readFileSync(file)); }
    catch { response.writeHead(404); response.end(); }
  });
  server.listen(0, '127.0.0.1', () => { resolve(server); });
});
// feet position and the point the camera faces; yaw from the player's convention (forward = (-sin yaw, -cos yaw))
const CAMERAS = [
  { name: 'spawn', at: [0, 4], look: [0, -12], pitch: -0.1 },
  { name: 'pool', at: [25, 31], look: [25, 20], pitch: -0.3 },
  { name: 'hut', at: [7, -1], look: [0, -12], pitch: -0.1 },
  { name: 'door', at: [0, -4], look: [0, -9], pitch: -0.05 },
  { name: 'creatures', at: [9, -6], look: [15, -12], pitch: -0.2 },
  { name: 'boss arena', at: [-9, -12], look: [-15, -20], pitch: -0.2 },
].map((camera) => ({ ...camera, yaw: Math.atan2(-(camera.look[0] - camera.at[0]), -(camera.look[1] - camera.at[1])) }));

const [legacyServer, clientServer] = await Promise.all([serve(legacyDir), serve(clientDir)]);
const port = (server) => { const address = server.address(); if (address === null || typeof address === 'string') throw new Error('no port'); return address.port; };
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
try {
  const open = async (lane) => {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await installInit(context, { lane, sha: 'sf16-board', browser: 'chromium', accelerated: true, tier: 'phone' });
    await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    const errors = []; page.on('pageerror', (error) => { errors.push(String(error)); }); page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    return { page, errors };
  };
  const today = await open('sf16-today'), declared = await open('sf16-shardfile');
  const query = 'tier=phone&skipintro=1&nolock=1&mute=1&weather=clear&touch=1&sw=0';
  await today.page.goto(`http://127.0.0.1:${port(legacyServer)}/?chunk=_template&${query}`);
  await today.page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load') && !document.getElementById('hud')?.classList.contains('intro'));
  await declared.page.goto(`http://127.0.0.1:${port(clientServer)}/?${query}`);
  await declared.page.waitForFunction(() => window.__wildshard?.shard?.shardfile && !document.querySelector('.ws-load'));
  await declared.page.evaluate(() => { if (window.__wildshard.app.state !== 'play') window.__wildshard.world.game.app.input.pressGesture('confirm'); });
  await declared.page.waitForFunction(() => window.__wildshard.app.state === 'play');
  for (const side of [today, declared]) await side.page.evaluate(() => window.__parity.advance(30));
  const census = async (page) => page.evaluate(() => {
    const animals = window.__wildshard.world.animals.animals;
    return animals.map((view) => ({ kind: view.kind, x: Math.round(view.position.x * 10) / 10, z: Math.round(view.position.z * 10) / 10, alive: view.alive, custom: view.model?.species?.rig ?? null, triangles: view.mesh.geometry.index?.count ?? view.mesh.geometry.getAttribute('position').count }));
  });
  const evidence = { cameras: {}, creatures: { today: await census(today.page), shardfile: await census(declared.page) }, errors: {} };
  const shots = [];
  for (const camera of CAMERAS) {
    const pair = [];
    for (const side of [today, declared]) {
      await side.page.evaluate((p) => window.__wildshard.pose(p), { x: camera.at[0], z: camera.at[1], yaw: camera.yaw, pitch: camera.pitch });
      await side.page.evaluate(() => window.__parity.advance(20));
      const jpeg = await side.page.screenshot({ type: 'jpeg', quality: 88 });
      const draws = await side.page.evaluate(() => ({ calls: window.__wildshard.world.game.lastFrame.calls, triangles: window.__wildshard.world.game.lastFrame.triangles }));
      pair.push({ jpeg, draws });
    }
    const file = (i) => join(outDir, `${camera.name.replace(' ', '-')}-${i === 0 ? 'today' : 'shardfile'}.jpg`);
    pair.forEach((shot, i) => { writeFileSync(file(i), shot.jpeg); });
    const score = await today.page.evaluate(ssim, { a: pair[0].jpeg.toString('base64'), b: pair[1].jpeg.toString('base64') });
    evidence.cameras[camera.name] = { ssim: score.ssim, today: pair[0].draws, shardfile: pair[1].draws, at: camera.at, look: camera.look };
    shots.push({ name: camera.name, today: file(0), shardfile: file(1), ssim: score.ssim });
    console.log(`${camera.name.padEnd(11)} SSIM ${score.ssim.toFixed(4)}  draws ${pair[0].draws.calls} vs ${pair[1].draws.calls}`);
  }
  evidence.errors = { today: today.errors, shardfile: declared.errors };
  writeFileSync(join(outDir, 'shots.json'), JSON.stringify(shots));
  execFileSync('python3', [join(here, 'compose.py'), join(outDir, 'shots.json'), join(here, 'board.jpg')], { stdio: 'inherit' });
  writeFileSync(join(here, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
} finally { await browser.close(); legacyServer.close(); clientServer.close(); }
