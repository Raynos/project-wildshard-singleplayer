#!/usr/bin/env node
// SF20a durability witness: one muted portrait Chromium, the real grid entry, controller walks across both borders,
// native quest/death callbacks, fresh-document reload and return. No URLs select variants and no completion callback
// fabricates a quest reward. Run after the coordinator's quiet window:
// scripts/browser-lane.sh --max 15 node progress/shard-platform/SF20a-durability.mjs --url=<serve-build> --sha=<pin>
import { writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../scripts/debug-settings.mjs';
import { installResources } from '../../scripts/parity/resources.mjs';

const flag = (name) => (process.argv.find((value) => value.startsWith(`--${name}=`)) ?? '').slice(name.length + 3);
const url = flag('url'), sha = flag('sha'), output = flag('out') || new URL('./SF20a-durability.json', import.meta.url).pathname;
if (!url || !sha) throw new Error('Supply --url=<build> and --sha=<commit>');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { sha, surface: 'Chromium emulating iPhone 16 Pro portrait', started: new Date().toISOString(), phases: [], errors: [] };
const started = Date.now();
let page;
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: devices['iPhone 16 Pro'].screen });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(installResources);
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() };
    const setItem = Storage.prototype.setItem;
    window.__durabilityWriteFailures = [];
    Storage.prototype.setItem = function (key, value) {
      try { return setItem.call(this, key, value); }
      catch (error) {
        if (window.__durabilityWriteFailures.length < 20) window.__durabilityWriteFailures.push({ key, characters: value.length, error: String(error) });
        throw error;
      }
    };
  });
  page = await context.newPage();
  page.on('pageerror', (error) => { result.errors.push(error.message); });
  page.on('console', (message) => { if (message.type() === 'error') result.errors.push(message.text()); });

  const enter = async () => {
    await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
    await page.click('.ws-main-grid');
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.simulation !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  };
  const state = () => page.evaluate(() => window.__wildshard.shard.grid.state());
  const physicsCensus = () => page.evaluate(() => {
    const world = window.__wildshard.world;
    if (world === undefined) return { retired: true }; // Native counts are the leak() result after retirement.
    const physics = world.physics, scope = world.game.levelScope.census, remaining = [];
    physics.world.forEachCollider((collider) => { if (remaining.length < 12) remaining.push({ handle: collider.handle, at: collider.translation(), groups: collider.collisionGroups() }); });
    return { bodies: physics.world.bodies.len(), colliders: physics.world.colliders.len(), scopeBodies: scope.bodies, scopeColliders: scope.colliders, remaining };
  });
  const coinsAndFacts = (instance) => page.evaluate((id) => {
    const raw = localStorage.getItem(`wildshard.save.v2.${id}`) ?? '{"keys":{}}', local = JSON.parse(raw);
    const profile = JSON.parse(localStorage.getItem('wildshard.save.v2.profile') ?? '{"keys":{}}');
    return { coins: local.keys.purse?.data ?? 0, saved: local.keys['platform.region'] !== undefined,
      mode: local.keys['platform.region']?.data?.mode ?? null, characters: raw.length,
      facts: Object.values(profile.keys['platform.ledger']?.data?.facts ?? {}).filter((fact) => fact.instance === id).length };
  }, instance);
  const drive = (waypoints) => page.evaluate(async (points) => {
    const probe = window.__wildshard, player = probe.world.player, game = probe.world.game, transitions = [], startedAt = performance.now();
    let index = 0, previous;
    player.setHover(true);
    try {
      await new Promise((resolve, reject) => {
        let stop = () => undefined;
        const timer = setTimeout(() => { stop(); reject(new Error(`Drive stalled at waypoint ${index}: ${JSON.stringify(probe.shard.grid.state().live)}`)); }, 120000);
        stop = game.watchFrames(() => {
          const grid = probe.shard.grid.state(), current = grid.live.live.current;
          if (current !== previous) { transitions.push(current); previous = current; }
          const target = points[index];
          if (target === undefined) { clearTimeout(timer); stop(); resolve(); return; }
          const feet = grid.live.live.worldFeet, dx = target.x - feet.x, dz = target.z - feet.z;
          if (Math.hypot(dx, dz) < 1.2) { index++; game.app.input.clear(); return; }
          player.yaw = Math.atan2(-dx, -dz); game.app.input.setHeld('move.forward', true);
        });
      });
      return { seconds: (performance.now() - startedAt) / 1000, waypoints: index, transitions, end: probe.shard.grid.state().live };
    } finally { game.app.input.clear(); player.setHover(false); }
  }, waypoints);

  await page.goto(url, { waitUntil: 'domcontentloaded' }); await enter();
  result.physicsAtBoot = await physicsCensus();
  const boot = await state(), cell = boot.cells.find((entry) => entry.instance === 'template-1');
  if (cell === undefined) throw new Error('Expected an independent template copy');
  const origin = { x: cell.cell[0] * 555, z: cell.cell[1] * 555 };
  result.home = boot.home; result.instance = cell.instance;
  await page.evaluate(() => window.__wildshard.pose({ name: 'grid.durability', x: -235, z: 235, yaw: Math.PI / 2 }));
  result.phases.push({ name: 'enter-copy', drive: await drive([{ x: -277.5, z: 277.5 }, { x: -277.5, z: origin.z }, { x: origin.x + 235, z: origin.z }]) });
  await page.waitForFunction((id) => window.__wildshard.shard.grid.state().live.live.current === id, cell.instance, { timeout: 15000 });
  result.phases.push({ name: 'visit-hut', drive: await drive([{ x: origin.x, z: origin.z - 9 }]) });
  await page.waitForFunction((id) => window.__wildshard.shard.grid.simulation(id)?.host.flags.has('template.hut'), cell.instance, { timeout: 15000 });
  result.contact = await page.evaluate((id) => {
    const sim = window.__wildshard.shard.grid.simulation(id), blob = sim?.host.entities.get('grey-blob:1');
    if (sim === undefined || blob === undefined) throw new Error('Missing admitted quest actor');
    const host = sim.host;
    host.combat.hit({ source: host.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: blob.combatActor(), amount: blob.hp,
      point: blob.position, from: host.player.position, dir: host.player.position.clone().set(0, 0, 1) });
    return { actor: blob.entityId, hp: blob.hp, dead: !blob.alive };
  }, cell.instance);
  await page.waitForFunction((id) => window.__wildshard.shard.grid.simulation(id)?.host.flags.has('template.complete'), cell.instance, { timeout: 15000 });
  result.phases.push({ name: 'leave-copy', drive: await drive([{ x: -277.5, z: origin.z }]) });
  result.beforeReload = await coinsAndFacts(cell.instance);
  if (result.beforeReload.coins !== 5 || result.beforeReload.facts !== 1 || !result.beforeReload.saved) throw new Error('Quest reward or continuation was not durable');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 });
  result.afterReload = await coinsAndFacts(cell.instance); await enter();
  await page.evaluate(() => window.__wildshard.pose({ name: 'grid.durability.return', x: -235, z: 235, yaw: Math.PI / 2 }));
  result.phases.push({ name: 'return-copy', drive: await drive([{ x: -277.5, z: 277.5 }, { x: -277.5, z: origin.z }, { x: origin.x + 235, z: origin.z }]) });
  await page.waitForFunction((id) => window.__wildshard.shard.grid.state().live.live.current === id, cell.instance, { timeout: 15000 });
  result.restored = await page.evaluate((id) => {
    const sim = window.__wildshard.shard.grid.simulation(id);
    return { complete: sim?.host.flags.has('template.complete'), blobAlive: sim?.host.entities.get('grey-blob:1')?.alive,
      tick: sim?.host.state.tick, questComplete: sim?.quest.quests[0]?.isComplete };
  }, cell.instance);
  await page.waitForTimeout(2500);
  result.afterReturn = await coinsAndFacts(cell.instance); result.sibling = await coinsAndFacts('template-2');
  result.storage = await page.evaluate(() => ({ failures: window.__durabilityWriteFailures,
    documents: Object.keys(localStorage).map((key) => ({ key, characters: localStorage.getItem(key)?.length ?? 0 })) }));
  result.leak = await page.evaluate(() => window.__wildshard.leak());
  result.physicsAfterUnload = { ...(await physicsCensus()), ...result.leak.after, scopeBodies: result.leak.scope.bodies, scopeColliders: result.leak.scope.colliders };
  result.pass = result.restored.complete === true && result.restored.questComplete === true && result.restored.blobAlive === false
    && result.afterReload.coins === 5 && result.afterReturn.coins === 5 && result.afterReturn.facts === 1 && result.sibling.coins === 0
    && result.beforeReload.characters <= 512 * 1024 && result.afterReturn.characters <= 512 * 1024 && result.storage.failures.length === 0
    && result.errors.length === 0 && result.leak.disposalErrors.length === 0 && result.leak.scope.colliders === 0 && result.leak.scope.bodies === 0
    && result.leak.after.colliders === 0 && result.leak.after.bodies === 0;
} catch (error) {
  result.failure = String(error.stack ?? error); result.pass = false;
  if (page !== undefined) {
    result.lastState = await page.evaluate(() => window.__wildshard?.shard?.grid?.state()).catch(() => null);
    result.storage = await page.evaluate(() => ({ failures: window.__durabilityWriteFailures,
      documents: Object.keys(localStorage).map((key) => ({ key, characters: localStorage.getItem(key)?.length ?? 0 })) })).catch(() => null);
    result.failureLeak = await page.evaluate(() => window.__wildshard?.leak()).catch((failure) => ({ error: String(failure) }));
    await page.screenshot({ path: output.replace(/\.json$/, '-failure.jpg'), type: 'jpeg', quality: 60 }).catch(() => undefined);
  }
}
finally { await browser.close(); }
result.seconds = (Date.now() - started) / 1000;
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ sha, pass: result.pass, seconds: result.seconds, before: result.beforeReload, after: result.afterReturn, failure: result.failure }));
if (!result.pass) process.exitCode = 1;
