#!/usr/bin/env node
// SF15a: installed normal Game, live interaction/streaming, durable state, actual offline reload and scoped unload.
// Run only through scripts/browser-lane.sh, outside performance quiet windows.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve as resolvePath } from 'node:path';
import { chromium, devices } from 'playwright';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';

const directory = resolvePath(process.argv.at(2) ?? ''), report = process.argv.at(3), sha = process.argv.at(4) ?? 'installed';
const mode = process.argv.at(5) ?? 'product';
assert.ok(mode === 'product' || mode === 'first-party', 'Expected product or first-party boot mode');
const requests = [], mime = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.m4a': 'audio/mp4' };
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  requests.push(path);
  const productPath = mode === 'first-party' ? path.replace(/^\/shardfiles\/_template\//u, '/') : path;
  const file = resolvePath(directory, `.${productPath === '/' ? '/index.html' : productPath}`);
  if (!file.startsWith(`${directory}/`)) { response.writeHead(403); response.end(); return; }
  try {
    if (!statSync(file).isFile()) throw new Error('Missing file');
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    // Exercise the normal selected manifest descriptor with the same bundle and admitted immutable source bytes.
    const body = mode === 'first-party' && extname(file) === '.html' ? readFileSync(file, 'utf8').replace(/<script id="ws-shardfile" type="application\/json">[\s\S]*?<\/script>/u, '') : readFileSync(file);
    response.end(body);
  }
  catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
let browser, stage = 'cold boot';
try {
  const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing fixture port');
  browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await installInit(context, { lane: 'sdk-full', sha, browser: 'chromium', accelerated: true, tier: 'phone' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.setDefaultTimeout(120_000);
  const boot = async () => {
    await page.waitForFunction(() => window.__wildshard?.shard?.shardfile && !document.querySelector('.ws-load'));
    await page.evaluate(() => { window.__wildshard.world.game.app.input.pressGesture('confirm'); });
    await page.waitForFunction(() => window.__wildshard.app.state === 'play');
    await page.evaluate(() => window.__parity.advance(3));
  };
  await page.goto(`http://127.0.0.1:${address.port}/?mute=1&nolock=1&skipintro=1${mode === 'first-party' ? '&chunk=_template' : ''}`); await boot();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  if (mode === 'first-party') assert.equal(await page.evaluate(() => window.__wildshard.shard.slug), '_template', 'Descriptor lost its canonical picker identity');
  const first = await page.evaluate(async () => {
    const probe = window.__wildshard, data = probe.shard.shardfile, rings = probe.shard.shardfileRings;
    if (!data.host.embedded || probe.world.animals.animals.some((view) => !view.simulationBound)) throw new Error('Client allocated a second simulation owner');
    const tool = probe.world.game.app.equipment.tools.find((row) => row.id === 'tool.template-lantern');
    if (tool?.model.parent !== probe.world.game.app.equipmentHost.viewmodel) throw new Error('Declared lantern was not mounted in the normal viewmodel host');
    const camera = probe.world.game.camera, expectedFov = camera.aspect >= 1 ? 72 : 360 / Math.PI * Math.atan(Math.tan(72 * Math.PI / 360) / Math.sqrt(camera.aspect));
    if (Math.abs(camera.fov - expectedFov) > 0.02) throw new Error(`Declared melee portrait FOV differs: ${camera.fov} vs ${expectedFov}`);
    const declaration = data.source.targets.interactions.find((row) => row.id === 'template.door.use');
    const door = probe.world.interactables.find((row) => row.label === declaration?.label);
    if (door === undefined) throw new Error('Missing declared door prompt');
    door.onInteract(); probe.world.game.app.input.pressGesture('template.lantern.toggle');
    await window.__parity.advance(30);
    const lamp = data.items.get('tool.template-lantern');
    if (data.colliders.get('template.door').active() || !lamp.lightOn || lamp.remainingFuel >= 1) throw new Error(`Door/item interaction did not enter authored state: ${JSON.stringify({ tick: data.host.state.tick, active: data.colliders.get('template.door').active(), light: lamp.lightOn, fuel: lamp.remainingFuel, lane: data.lane.world.view(data.host.player.id), input: probe.world.game.app.input.snapshot(), modules: data.lane.host.checkpoint().modules.map((m) => ({name:m.name, failures:m.failures,disabled:m.disabled})) })}`);
    // Real player motor movement crosses two tile boundaries; streaming runs from the normal fixed.post driver.
    await probe.pose({ x: 30, z: 30, yaw: -Math.PI / 2 });
    probe.world.player.setHover(true);
    probe.world.game.app.input.setHeld('move.forward', true);
    await window.__parity.advance(300);
    probe.world.game.app.input.clear(); probe.world.player.setHover(false);
    await window.__parity.advance(20);
    const position = probe.world.player.position;
    if (position.x < 130 || !rings.rings.ready() || rings.rings.stats().resident.l0 === 0) throw new Error(`Drive did not cross two tile boundaries and refine actual ring tiles: ${JSON.stringify({ position, rings: rings.rings.stats() })}`);
    return { embedded: data.host.embedded, creatures: data.host.entities.size, boundViews: probe.world.animals.animals.length,
      ticks: data.host.state.tick, position: { x: position.x, y: position.y, z: position.z }, fuel: lamp.remainingFuel,
      open: data.lane.world.view(data.host.player.id).shared['template.door.open'], rings: rings.rings.stats(), workers: rings.workers,
      allocator: rings.allocator.cost().input, errors: [...window.__wildshardHarness.errors] };
  });
  assert.equal(first.errors.length, 0, `Cold drive browser errors: ${JSON.stringify(first)}`);
  const contentRequests = () => requests.filter((path) => /\/[a-f0-9]{64}$/u.test(path)).length;
  const coldDownloads = contentRequests(); assert.ok(coldDownloads > 0);
  stage = 'cached revisit';
  await page.reload(); await boot();
  const revisitDownloads = contentRequests() - coldDownloads;
  assert.equal(revisitDownloads, 0, 'Revisit downloaded immutable content twice');
  const cached = await page.evaluate(async () => ({ names: await caches.keys(), restored: window.__wildshard.shard.shardfile.lane.world.view('actor.player').shared['template.door.open'] }));
  assert.ok(cached.names.includes('ws-content-v0')); assert.ok(cached.names.includes('ws-shardfile-products-v0')); assert.equal(cached.restored, 1);
  stage = 'offline reload';
  const beforeOffline = contentRequests();
  await context.setOffline(true); await page.reload(); await boot();
  const offline = await page.evaluate(async () => {
    const probe = window.__wildshard, data = probe.shard.shardfile, lamp = data.items.get('tool.template-lantern');
    const restored = { online: navigator.onLine, open: data.lane.world.view('actor.player').shared['template.door.open'], active: data.colliders.get('template.door').active(), lit: lamp.lightOn, fuel: lamp.remainingFuel };
    const leak = await probe.leak();
    return { restored, scope: leak.scope, before: leak.before, after: leak.after, disposalErrors: leak.disposalErrors, errors: window.__wildshardHarness.errors };
  });
  assert.equal(offline.restored.online, false); assert.equal(offline.restored.open, 1); assert.equal(offline.restored.active, false); assert.equal(offline.restored.lit, true);
  assert.ok(offline.restored.fuel < 1); assert.deepEqual(offline.after, offline.before); assert.ok(Object.values(offline.scope).every((value) => value === 0));
  assert.equal(offline.disposalErrors.length, 0, `Offline scope disposal: ${JSON.stringify(offline)}`); assert.equal(offline.errors.length, 0, `Offline browser errors: ${JSON.stringify(offline)}`);
  const offlineDownloads = contentRequests() - beforeOffline;
  assert.equal(offlineDownloads, 0, 'Offline reload reached the content server');
  const proof = { pass: true, sha, mode, first, coldDownloads, revisitDownloads, offlineDownloads, cacheNames: cached.names, offline };
  if (report !== undefined) writeFileSync(report, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof));
} catch (error) {
  if (report !== undefined) writeFileSync(report, `${JSON.stringify({ pass: false, sha, stage, error: String(error) }, null, 2)}\n`);
  throw error;
} finally { await browser?.close(); await new Promise((resolve) => { server.close(resolve); }); }
