#!/usr/bin/env node
// SF57b: actual fixed-step exits and fresh documents, no manual navigation during the measured loop.
// scripts/browser-lane.sh --max 45 node scripts/soak/reload.mjs --url=<pinned preview> --sha=<pin> [--runs=50]
import { writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../debug-settings.mjs';
import { installResources } from '../parity/resources.mjs';

const flag = (name, fallback = '') => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url'), sha = flag('sha'), count = Number(flag('runs', '50')), out = flag('out');
if (!base || !sha || !out || !Number.isSafeInteger(count) || count < 1) throw new Error('Supply --url, --sha, --out and a positive run count');
const result = { sha, surface: 'Chromium / iPhone 16 Pro portrait', purpose: 'SF57b controller/reload proof; timing is not an iOS reading', runs: [], errors: [], pass: false };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let page;
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: devices['iPhone 16 Pro'].screen });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(context, { scope: 'device', key: 'debug.global.gridFadeReload', data: 'on' });
  await context.addInitScript(installResources);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
  page = await context.newPage();
  page.on('pageerror', (error) => result.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') result.errors.push(message.text());
    if (message.type() === 'warning') console.log(`warning: ${message.text()}`);
  });
  const ready = () => page.waitForFunction(() => {
    const probe = window.__wildshard;
    if (probe === undefined && document.documentElement.classList.contains('title-first') && performance.now() > 1500) {
      throw new Error('Planned resume returned to the renderer-free title');
    }
    return probe?.shard?.grid?.simulation !== undefined && probe.world?.hud.entered === true && !document.querySelector('.ws-load')
      && !document.querySelector('.ws-grid-reload.opaque') && probe.shard.grid.state().ringsReady;
  }, null, { timeout: 120000 });
  const state = () => page.evaluate(() => window.__wildshard.shard.grid.state());
  const readSave = (instance) => page.evaluate((id) => {
    const local = JSON.parse(localStorage.getItem(`wildshard.save.v2.${id}`) ?? '{"keys":{}}');
    const profile = JSON.parse(localStorage.getItem('wildshard.save.v2.profile') ?? '{"keys":{}}');
    return { coins: local.keys.purse?.data ?? 0, continuation: local.keys['platform.region']?.data ?? null,
      inventory: local.keys.inventory?.data ?? null, loadout: local.keys['platform.loadout']?.data ?? null,
      facts: Object.values(profile.keys['platform.ledger']?.data?.facts ?? {}).filter((fact) => fact.instance === id) };
  }, instance);
  // The existing player and controller drive every border. The parent restarts observation after document replacement.
  const drive = (points) => page.evaluate((route) => {
    const probe = window.__wildshard, player = probe.world.player, game = probe.world.game;
    let index = 0;
    const speedLimit = player.hoverSpeedLimit;
    if (typeof speedLimit !== 'function') throw new Error('Missing real grid hover-speed rule');
    let limit = 30; player.hoverSpeedLimit = () => Math.min(limit, speedLimit());
    window.__reloadDrive = { done: false, error: null, index: 0, started: performance.now() };
    const stop = game.watchFrames(() => {
      const task = window.__reloadDrive, grid = probe.shard.grid.state(), target = route[index];
      task.index = index;
      if (!target) { game.app.input.clear(); player.hoverSpeedLimit = speedLimit; stop(); task.done = true; return; }
      if (performance.now() - task.started > 90000) { game.app.input.clear(); player.hoverSpeedLimit = speedLimit; stop(); task.error = 'Controller route stalled'; return; }
      const feet = grid.live.live.worldFeet, dx = target.x - feet.x, dz = target.z - feet.z;
      const distance = Math.hypot(dx, dz);
      limit = Math.min(target.speed ?? 30, Math.max(2, distance * 2)); // Brake through the real board controller.
      if (distance < 1.2) { index++; game.app.input.clear(); return; }
      player.setHover(true); player.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
    });
  }, points);
  const arrived = async () => {
    await page.waitForFunction(() => window.__reloadDrive?.done === true || window.__reloadDrive?.error !== null && window.__reloadDrive?.error !== undefined, null, { timeout: 100000 });
    const issue = await page.evaluate(() => window.__reloadDrive?.error);
    if (issue) throw new Error(issue);
  };
  const replaces = async (points) => {
    const before = await page.evaluate(() => performance.timeOrigin), start = Date.now();
    await drive(points);
    await page.waitForFunction((origin) => performance.timeOrigin !== origin, before, { timeout: 120000 });
    await ready();
    const after = await state();
    if (after.live.live.current !== null || after.inside !== null || !after.live.stowed) throw new Error('Resume did not restore the highway safe zone');
    const document = await page.evaluate(() => ({ origin: performance.timeOrigin, now: performance.now(), menu: document.querySelector('.ws-main-grid') !== null,
      reveal: document.querySelector('.ws-grid-reveal') !== null, clock: window.__wildshard.world.game.app.clock.snapshot(),
      pending: JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{"keys":{}}').keys['grid.reload.once']?.data }));
    if (document.menu || document.reveal || document.pending !== null) throw new Error('Resume left a menu, sky reveal, or recurring handoff');
    return { seconds: (Date.now() - start) / 1000, bootSeconds: document.now / 1000, document, feet: after.live.live.worldFeet };
  };
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  console.log('phase: grid boot');
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await page.click('.ws-main-grid');
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.simulation !== undefined && !document.querySelector('.ws-load'), null, { timeout: 120000 });
  await page.evaluate(() => window.__wildshard.world.hud.enterNow()); await ready();
  console.log('phase: initial road exit');
  const renderScale = await page.evaluate(() => window.__wildshard.world.game.renderer.getPixelRatio());
  if (renderScale !== 2) throw new Error(`Phone render scale changed: ${renderScale}`);
  result.renderScale = renderScale;
  const initial = await state(), target = initial.cells.find((cell) => cell.instance === 'template-4');
  if (!target) throw new Error('Missing independent template target');
  const origin = { x: target.cell[0] * 555, z: target.cell[1] * 555 }, road = { x: origin.x + 277.5, z: origin.z };
  if (origin.x !== -555 || origin.z !== -555) throw new Error('The developer catalogue moved; rebuild the real road approach');
  await page.evaluate(() => window.__wildshard.pose({ name: 'sf57b.start', x: -235, z: 0, yaw: Math.PI / 2 }));
  result.initialExit = await replaces([{ x: -277.5, z: 0 }]);
  console.log('phase: road approach');
  // Follow asphalt around the real roundabout island, then enter through the east midpoint socket.
  const arc = Array.from({ length: 9 }, (_, index) => ({ x: -277.5 + 10.75 * Math.sin(index * Math.PI / 8),
    z: -277.5 + 10.75 * Math.cos(index * Math.PI / 8), speed: 6 }));
  await drive([{ x: -277.5, z: -256 }, ...arc, road]); await arrived();
  console.log('phase: template quest');
  await drive([{ x: origin.x + 235, z: origin.z }, { x: origin.x, z: origin.z - 9 }]); await arrived();
  await page.waitForFunction((id) => window.__wildshard.shard.grid.simulation(id)?.host.flags.has('template.hut'), target.instance, { timeout: 15000 });
  await page.evaluate((id) => {
    const sim = window.__wildshard.shard.grid.simulation(id), blob = sim?.host.entities.get('grey-blob:1');
    if (!sim || !blob) throw new Error('Missing real quest actor');
    sim.host.combat.hit({ source: sim.host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: blob.combatActor(), amount: blob.hp,
      point: blob.position, from: sim.host.player.position, dir: blob.position.clone().set(0, 0, 1) });
  }, target.instance);
  await page.waitForFunction((id) => window.__wildshard.shard.grid.simulation(id)?.host.flags.has('template.complete'), target.instance, { timeout: 15000 });
  for (let run = 0; run < count; run++) {
    const timing = await replaces([{ x: origin.x + 235, z: origin.z }, road]);
    const saved = await readSave(target.instance);
    if (saved.coins !== 5 || saved.facts.length !== 1 || saved.continuation === null) throw new Error('Reload lost or duplicated the real quest reward');
    result.runs.push({ run: run + 1, ...timing, saved: { ...saved, continuation: { mode: saved.continuation.mode, storedChars: saved.continuation.snapshot?.length ?? 0 } } });
    if (run + 1 < count) {
      await drive([{ x: origin.x + 235, z: origin.z }]); await arrived();
      const restored = await page.evaluate((id) => {
        const sim = window.__wildshard.shard.grid.simulation(id);
        return { complete: sim?.host.flags.has('template.complete'), alive: sim?.host.entities.get('grey-blob:1')?.alive };
      }, target.instance);
      if (restored.complete !== true || restored.alive !== false) throw new Error('Reload did not restore the quest actor and flags');
    }
    console.log(JSON.stringify({ run: run + 1, seconds: timing.seconds, bootSeconds: timing.bootSeconds, coins: saved.coins }));
  }
  result.leak = await page.evaluate(() => window.__wildshard.leak());
  result.pass = result.runs.length === count && result.errors.length === 0 && result.leak.disposalErrors.length === 0
    && result.leak.after.bodies === 0 && result.leak.after.colliders === 0;
} catch (error) {
  result.failure = String(error);
  if (page) result.last = await page.evaluate(() => ({ grid: window.__wildshard?.shard?.grid?.state(), drive: window.__reloadDrive,
    url: location.href, entered: window.__wildshard?.world?.hud?.entered,
    rootClass: document.documentElement.className, title: document.querySelector('.ws-start')?.textContent,
    loading: document.querySelector('.ws-load')?.textContent, fade: document.querySelector('.ws-grid-reload')?.className,
    pending: JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{"keys":{}}').keys['grid.reload.once']?.data })).catch(() => null);
} finally { await browser.close(); }
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ sha, pass: result.pass, runs: result.runs.length, failure: result.failure }));
if (!result.pass) process.exitCode = 1;
