#!/usr/bin/env node
// OS-F7: real built author client, native-bound meshes and the shipping scene prompt picker.
// Run through scripts/browser-lane.sh; the caller supplies a built client and owns its build lifetime.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, resolve as resolvePath } from 'node:path';
import { chromium, devices } from 'playwright';
import { buildProject } from '@wildshard/sdk/project';
import { proveSceneClient } from '@wildshard/sdk/headless';
import { buildWorld, disposeWorld, worldBytes } from './docs/author-project/generators/world.ts';
import { sceneInteractionExample } from './docs/authoring/creatures.ts';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';

const client = process.argv.at(2); assert.ok(client, 'Supply a built normal client directory');
const scratch = mkdtempSync(resolvePath(tmpdir(), 'author-scene-')), output = resolvePath(scratch, 'product');
const authored = await sceneInteractionExample(readFileSync('test/fixtures/sdk-authored-world/door.as', 'utf8'));
mkdirSync(resolvePath(scratch, 'assets'));
for (const [hash, bytes] of authored.assets) writeFileSync(resolvePath(scratch, 'assets', hash), bytes);
const scene = buildWorld();
try { writeFileSync(resolvePath(scratch, 'assets/world.glb'), worldBytes(scene)); } finally { disposeWorld(scene); }
const config = { ...authored.shard, world: { glb: 'assets/world.glb', materials: { Floor: 'pbr' }, colliders: 'mesh' } };
writeFileSync(resolvePath(scratch, 'shard.config.ts'), `export default ${JSON.stringify(config)};`);
await buildProject(scratch, output, { client });
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = resolvePath(output, `.${path === '/' ? '/index.html' : path}`);
  try {
    if (!file.startsWith(`${output}/`) || !statSync(file).isFile()) throw new Error('Missing file');
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(readFileSync(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
let browser;
try {
  const address = server.address(); assert.ok(address && typeof address === 'object');
  browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await installInit(context, { lane: 'author-scene', sha: process.argv.at(3) ?? 'candidate', browser: 'chromium', accelerated: true, tier: 'phone' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.setDefaultTimeout(30_000);
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  page.on('pageerror', error => { console.error(error); });
  await page.goto(`http://127.0.0.1:${address.port}/?mute=1&nolock=1&skipintro=1`);
  try { await page.waitForFunction(() => window.__wildshard?.shard?.shardfile && !document.querySelector('.ws-load')); }
  catch (error) { console.error(await page.evaluate(() => ({ body: document.body.textContent, probe: Boolean(window.__wildshard), errors: window.__wildshardHarness.errors }))); throw error; }
  await page.evaluate(() => window.__wildshard.world.game.app.input.pressGesture('confirm'));
  await page.waitForFunction(() => window.__wildshard.app.state === 'play');
  await page.evaluate(async () => { await window.__wildshard.pose({ x: 0, z: 20, yaw: 0 }); await window.__parity.advance(3); });
  const expected = { creatures: ['goat.0', 'goat.1', 'goat.2', 'hawk.0'], selectedInteraction: null };
  console.log(JSON.stringify(await page.evaluate(() => window.__wildshard.shard.shardfile.sceneEvidence())));
  const evidence = await proveSceneClient(page, expected);
  await page.evaluate(async () => { await window.__wildshard.pose({ x: 0, z: 0, yaw: Math.PI }); await window.__parity.advance(3); });
  await proveSceneClient(page, { creatures: [], selectedInteraction: 'beacon' });
  await assert.rejects(() => proveSceneClient(page, { ...expected, creatures: ['invented'] }), /bound creature view/u);
  await assert.rejects(() => proveSceneClient(page, { ...expected, selectedInteraction: 'invented' }), /prompt selection/u);
  const errors = await page.evaluate(() => window.__wildshardHarness.errors);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, evidence, missingViewRefused: true, wrongPromptRefused: true }));
} finally {
  await browser?.close(); await new Promise(resolve => { server.close(resolve); }); rmSync(scratch, { recursive: true, force: true });
}
