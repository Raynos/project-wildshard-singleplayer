#!/usr/bin/env node
// G222 follow-up probe (grid-polish-2 #1 / #2): Template-2's hub in the grid (cell 1,1). It surveys what a ray from the north
// meets at the cell centre (the stray creature capsule at (0, 0, 0)?), photographs the hut's door from the north, drives the
// board south into the hut at 30 m/s, then opens the door through its published field and drives again.
//   scripts/browser-lane.sh node progress/shard-platform/grid-polish-2/hut.mjs --url=http://127.0.0.1:<port> --out=<dir> --tag=before|after
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), OUT = resolve(flag('out', '.')), tag = flag('tag', 'run');
mkdirSync(OUT, { recursive: true });
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen });
await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 300)); });
const out = { url, tag, errors };
const C = { x: 555, z: 555 };
try {
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  out.version = await page.evaluate(async () => (await fetch('/version.json')).json()).catch(() => null);
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  await page.evaluate((q) => window.__wildshard.pose(q), { x: 262, z: 555, yaw: -Math.PI / 2, pitch: -0.04 });
  await sleep(9000);
  await page.evaluate(() => {
    const api = window.__wildshard, world = api.world, input = world.game.app.input, p = world.player;
    window.__drive = (wps, opts) => new Promise((done0) => {
      let elapsed = 0, wi = 0, last = { t: 0, x: 0, z: 0 }; const old = p.hoverSpeedLimit;
      if (opts.cap) p.hoverSpeedLimit = () => opts.cap;
      let stop = () => undefined;
      const done = (why) => { clearTimeout(timer); input.clear(); stop(); p.hoverSpeedLimit = old; const f = api.shard.grid.state().feet; done0({ why, feet: { x: f.x, z: f.z } }); };
      const timer = setTimeout(() => done('timeout'), opts.timeout ?? 30000);
      stop = world.game.watchFrames((dt) => {
        elapsed += dt;
        const feet = api.shard.grid.state().feet;
        const wp = wps[wi]; if (wp === undefined) { done('arrived'); return; }
        const dx = wp.x - feet.x, dz = wp.z - feet.z;
        if (Math.hypot(dx, dz) < (opts.reach ?? 3)) { wi++; last = { t: elapsed, x: feet.x, z: feet.z }; return; }
        if (Math.hypot(feet.x - last.x, feet.z - last.z) > 0.3) last = { t: elapsed, x: feet.x, z: feet.z };
        else if (elapsed - last.t > (opts.stall ?? 1.5)) { done('stalled'); return; }
        const want = Math.atan2(-dx, -dz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yaw += Math.max(-3 * dt, Math.min(3 * dt, d));
        input.setHeld('move.forward', true);
      });
    });
    p.setHover(true);
  });
  const enter = await page.evaluate(() => window.__drive([{ x: 352, z: 555 }, { x: 420, z: 555 }], {}));
  out.enter = enter.why;
  // what a ray from z = +8 toward the hut meets, in the region's frame (the player is re-origined on template-2)
  const survey = async () => {
    await page.evaluate((q) => window.__wildshard.pose(q), { x: 0, z: 8, y: 0.3, yaw: 0, pitch: 0 }); await sleep(800);
    return page.evaluate(() => {
      const p = window.__wildshard.world.player, phys = p.motor.physics, R = phys.R, rows = [];
      for (const x of [-0.5, 0, 0.5]) for (const y of [0.3, 1.0, 1.8]) {
        const hit = phys.world.castRay(new R.Ray({ x, y, z: 8 }, { x: 0, y: 0, z: -1 }), 30, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, p.motor.collider);
        if (!hit) { rows.push({ x, y, hit: null }); continue; }
        const c = hit.collider, t = c.translation();
        rows.push({ x, y, z: Math.round((8 - hit.timeOfImpact) * 100) / 100, shape: c.shape.type, radius: c.shape.radius ?? null, at: [t.x, t.y, t.z].map((v) => Math.round(v * 100) / 100), enabled: c.isEnabled(), groups: c.collisionGroups() });
      }
      return rows;
    });
  };
  const photo = async (name) => {
    await page.evaluate((q) => window.__wildshard.pose(q), { x: 0, z: 4, y: 0.3, yaw: 0, pitch: -0.1 }); await sleep(2500);
    await page.screenshot({ path: join(OUT, `${tag}-${name}.png`) });
  };
  const run = async (from, to) => {
    await page.evaluate((q) => window.__wildshard.pose(q), { x: from[0], z: from[1], y: 0.3, yaw: Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])), pitch: -0.04 }); await sleep(600);
    const r = await page.evaluate(([w]) => window.__drive(w, { cap: 30, timeout: 20000, stall: 1.2, reach: 2 }), [[{ x: C.x + to[0], z: C.z + to[1] }]]);
    return { why: r.why, stop: { x: Math.round((r.feet.x - C.x) * 10) / 10, z: Math.round((r.feet.z - C.z) * 10) / 10 } };
  };
  out.closed = { survey: await survey() };
  await photo('door-closed');
  out.closed.north = await run([0, 150], [0, -40]);
  out.closed.door = await run([0, -2], [0, -40]);
  // open the door through its published field (the scene the door's interaction plays), then look and drive again
  out.opened = await page.evaluate(async () => {
    const grid = window.__wildshard.shard.grid, current = grid.state().live?.live?.current ?? null, sim = current === null ? undefined : grid.simulation?.(current);
    if (sim === undefined || sim.lane === undefined) return { current, scene: 'no admitted region lane' };
    const target = sim.actors.get(sim.host.player.id);
    if (target === undefined) return { current, scene: 'no player entity' };
    sim.lane.enqueue({ type: 201, target, value: 1 }); // the door's toggle scene (template.door.toggle)
    await new Promise((r) => { setTimeout(r, 500); });
    return { current, scene: 'template.door.toggle', collider: [...sim.colliders].map(([id, port]) => [id, port.active()]).filter(([id]) => id === 'template.door') };
  });
  out.opened.survey = await survey();
  await photo('door-opened');
  out.opened.door = await run([0, -2], [0, -40]);
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); console.log(out.error); }
await ctx.close(); await browser.close();
writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
