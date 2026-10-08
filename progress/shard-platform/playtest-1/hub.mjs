#!/usr/bin/env node
// probe: Template-2 (cell 1,1; centre 555,555 in Driftwood's frame) hub block at 30 m/s from each road; per frame the
// player's feet, the capsule's penetration into WORLD colliders and whether the camera is inside one.
//   node hub.mjs --url=... --out=<dir> [--video]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d = '') => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const url = flag('url'), OUT = resolve(flag('out', '.')), record = argv.includes('--video');
const only = flag('only');
mkdirSync(OUT, { recursive: true });
const PHONE = devices['iPhone 16 Pro'];
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const video = join(OUT, '.video'); rmSync(video, { recursive: true, force: true });
const ctx = await browser.newContext({ ...PHONE, viewport: PHONE.screen, ...(record ? { recordVideo: { dir: video, size: PHONE.screen } } : {}) });
await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => { errors.push(e.message.slice(0, 300)); });
const t0 = Date.now(), at = () => (Date.now() - t0) / 1000;
const out = { url, errors, runs: [] };
const C = { x: 555, z: 555 };
// each run: a straight 30 m/s line from a spoke road into the hub (cell-local metres; +z north)
const RUNS = [
  { name: 'north', from: [0, 150], to: [0, -40] },
  { name: 'north-door', from: [0, -2], to: [0, -40] },
  { name: 'north-wall', from: [-2, 150], to: [-2, -40] },
  { name: 'south', from: [0, -150], to: [0, 40] },
  { name: 'west', from: [-150, -12], to: [40, -12] },
  { name: 'east', from: [150, -12], to: [-40, -12] },
  { name: 'tower', from: [-88, 60], to: [-88, -140] },
  { name: 'office', from: [88, 60], to: [88, -140] },
  { name: 'arcade', from: [-150, 88], to: [40, 88] },
  { name: 'sheds', from: [150, 88], to: [40, 88] },
].filter((r) => only === '' || only.split(',').includes(r.name));
try {
  await page.goto(`${url}/?mute=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ws-main-grid', { timeout: 120000 }); await sleep(1500);
  await page.click('.ws-main-grid');
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') !== null, null, { timeout: 240000, polling: 100 });
  await page.evaluate(() => { document.querySelector('.ws-grid-reveal')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.ws-grid-reveal') === null, null, { timeout: 120000, polling: 100 });
  await sleep(1500);
  await page.evaluate((q) => window.__wildshard.pose(q), { x: 262, z: 555, yaw: -Math.PI / 2, pitch: -0.04 });
  await sleep(9000);
  // the in-page driver: waypoints in grid metres, yaw rate-limited, optional speed cap override
  await page.evaluate(() => {
    const api = window.__wildshard, world = api.world, input = world.game.app.input, p = world.player;
    window.__drive = (wps, opts) => new Promise((resolve) => {
      const rows = []; let elapsed = 0, wi = 0, last = { t: 0, x: 0, z: 0 }; const old = p.hoverSpeedLimit;
      if (opts.cap) p.hoverSpeedLimit = () => opts.cap;
      let stop = () => undefined;
      const done = (why) => { clearTimeout(timer); input.clear(); stop(); p.hoverSpeedLimit = old; resolve({ why, rows }); };
      const timer = setTimeout(() => done('timeout'), opts.timeout ?? 30000);
      stop = world.game.watchFrames((dt) => {
        elapsed += dt;
        const s = api.shard.grid.state(), feet = s.feet, motor = p.motor, phys = motor.physics, cam = world.game.camera;
        let pen = 0; const hits = [];
        motor.touching(-0.06, ['WORLD'], (c) => { if (c.shape.type !== 7 /* heightfield */) { pen++; hits.push(c.handle); } return true; });
        const cp = cam.getWorldPosition(cam.position.clone()); let camIn = 0;
        phys.world.intersectionsWithPoint({ x: cp.x, y: cp.y, z: cp.z }, (c) => { if (c.shape.type !== 7 && !c.isSensor()) camIn++; return true; });
        // the camera's line of sight to the rider's head: geometry between them = the camera is behind / inside a wall
        const R = phys.R, head = { x: p.position.x, y: p.position.y + 1.5, z: p.position.z }, dv = { x: cp.x - head.x, y: cp.y - head.y, z: cp.z - head.z };
        const dl = Math.hypot(dv.x, dv.y, dv.z) || 1; let los = 0;
        const hit = phys.world.castRay(new R.Ray(head, { x: dv.x / dl, y: dv.y / dl, z: dv.z / dl }), dl, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, motor.collider);
        if (hit && hit.collider.shape.type !== 7 && hit.timeOfImpact < dl - 0.05) los = Math.round(hit.timeOfImpact * 100) / 100;
        if (opts.sample) rows.push({ los, lx: Math.round(p.position.x * 100) / 100, lz: Math.round(p.position.z * 100) / 100, t: Math.round(elapsed * 1000) / 1000, x: Math.round(feet.x * 100) / 100, z: Math.round(feet.z * 100) / 100, y: Math.round(p.position.y * 100) / 100,
          speed: Math.round(Math.hypot(p.velocity.x, p.velocity.z) * 10) / 10, current: s.live?.live?.current ?? null, pen, hits, camIn,
          cam: [Math.round(cp.x * 10) / 10, Math.round(cp.y * 10) / 10, Math.round(cp.z * 10) / 10] });
        const wp = wps[wi]; if (wp === undefined) { done('arrived'); return; }
        const dx = wp.x - feet.x, dz = wp.z - feet.z;
        if (Math.hypot(dx, dz) < (opts.reach ?? 3)) { wi++; last = { t: elapsed, x: feet.x, z: feet.z }; return; }
        if (Math.hypot(feet.x - last.x, feet.z - last.z) > 0.3) last = { t: elapsed, x: feet.x, z: feet.z };
        else if (elapsed - last.t > (opts.stall ?? 1.5)) { done('stalled'); return; }
        const want = Math.atan2(-dx, -dz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        p.yaw += opts.snapYaw ? d : Math.max(-3 * dt, Math.min(3 * dt, d));
        input.setHeld('move.forward', true);
      });
    });
    p.setHover(true);
  });
  // into the cell through its west entry, to the west spoke
  const enter = await page.evaluate(() => window.__drive([{ x: 352, z: 555 }, { x: 420, z: 555 }], {}));
  out.enter = { why: enter.why };
  if (argv.includes('--survey')) {
    await page.evaluate((q) => window.__wildshard.pose(q), { x: 0, z: 8, y: 0.3, yaw: 0, pitch: 0 });
    await sleep(800);
    out.survey = await page.evaluate(() => {
      const p = window.__wildshard.world.player, phys = p.motor.physics, R = phys.R, rows = [];
      for (const x of [-2, -1, -0.5, 0, 0.5, 1, 2]) for (const y of [0.3, 1.0, 1.8]) {
        const hit = phys.world.castRay(new R.Ray({ x, y, z: 8 }, { x: 0, y: 0, z: -1 }), 30, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, p.motor.collider);
        if (!hit) { rows.push({ x, y, hit: null }); continue; }
        const c = hit.collider, t = c.translation(), b = c.parent();
        rows.push({ x, y, z: Math.round((8 - hit.timeOfImpact) * 100) / 100, shape: c.shape.type, half: c.shape.halfExtents ?? null, radius: c.shape.radius ?? null, at: [t.x, t.y, t.z].map((v) => Math.round(v * 100) / 100), body: b ? b.bodyType() : null, enabled: c.isEnabled(), groups: c.collisionGroups() });
      }
      return rows;
    });
    console.log(JSON.stringify(out.survey));
  }
  for (const run of RUNS) {
    const a = { x: C.x + run.from[0], z: C.z + run.from[1] }, b = { x: C.x + run.to[0], z: C.z + run.to[1] };
    // the run's start: posed in the cell's own frame (the player is re-origined on template-2), facing the line
    const dir = Math.atan2(b.x - a.x, b.z - a.z);
    await page.evaluate((q) => window.__wildshard.pose(q), { x: run.from[0], z: run.from[1], y: 0.3, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)), pitch: -0.04 });
    await sleep(600);
    const go = { why: 'posed' }, settle = { why: await page.evaluate(() => window.__wildshard.shard.grid.state().live?.live?.current) };
    const v0 = at();
    const res = await page.evaluate(([w]) => window.__drive(w, { cap: 30, sample: true, timeout: 20000, stall: 1.2, reach: 2 }), [[b]]);
    const rows = res.rows, losRows = rows.filter((r) => r.los > 0), maxSpeed = Math.max(...rows.map((r) => r.speed)), pen = rows.filter((r) => r.pen > 0), camIn = rows.filter((r) => r.camIn > 0);
    const stopRow = rows[rows.length - 1];
    out.runs.push({ name: run.name, reach: [go.why, settle.why], why: res.why, frames: rows.length, maxSpeed, penFrames: pen.length, camInFrames: camIn.length, losFrames: losRows.length,
      stop: stopRow && { x: Math.round((stopRow.x - C.x) * 10) / 10, z: Math.round((stopRow.z - C.z) * 10) / 10, speed: stopRow.speed }, video: [v0, at()],
      firstPen: pen[0] ?? null, firstCam: camIn[0] ?? null, rows });
    console.log(run.name, res.why, 'max', maxSpeed, 'pen', pen.length, 'camIn', camIn.length, 'los', losRows.length, 'stop', JSON.stringify(out.runs.at(-1).stop));
  }
} catch (error) { out.error = String(error?.stack ?? error).slice(0, 800); console.log(out.error); }
await ctx.close(); await browser.close();
if (record) {
  const [file] = readdirSync(video).filter((f) => f.endsWith('.webm'));
  if (file !== undefined) execFileSync('cp', [join(video, file), join(OUT, 'hub.webm')]);
  rmSync(video, { recursive: true, force: true });
}
writeFileSync(join(OUT, 'hub.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ error: out.error, errors: errors.length, enter: out.enter }));
