#!/usr/bin/env node
// nalati-ride-physics.mjs — NALATI-MERGE R2 / R3: the ridden horse against the world, headless (muted, Metal), one page.
//
//   node scripts/nalati-ride-physics.mjs --tag=r2 [--url=http://127.0.0.1:5188] [--out=progress/nalati-riding/r2] [--only=open,yurt,…]
//
// Legs (each teleports the camp horse from `?ride=gallop`, drives it with the touch stick / the GALLOP disc, samples the
// horse every 100 ms):
//   open    gallop 3.5 s from a stand on the north road: distance (≥ ~20 m), the rider's eye over the horse's feet (≈ 2.28 m)
//   yurt    gallop 3 s at the nearest camp yurt: it stops at the felt, never inside it (no tunnelling)
//   fence   walk 7 s at the corral fence: it stops at the rail · then canter at it: it jumps it (feet clear the 1.3 m rail)
//   bridge  trot 12 s over the Kunes bridge: the feet stay on the deck (deckY) the whole span, it reaches the far bank
//   crag    gallop 6 s, then walk 10 s, at a crag face: the steepest ground climbed at each (gallop refuses past ~35°)
//   herd    R3: a stampede through the rider on foot (knocked down, hurt) and into a rider at a gallop (jostled / thrown)
// Prints a table per leg, writes <tag>-legs.json and one JPEG contact sheet <tag>-sheet.jpg (a frame per leg).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const OUT = resolvePath(flag('out', 'progress/nalati-riding/r2'));
const TAG = flag('tag', 'now');
const ONLY = flag('only', 'open,yurt,fence,bridge,crag,herd').split(',');
mkdirSync(OUT, { recursive: true });

const VITE_STUB = `
import '/@vite/env';
const hot = () => ({ data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {} });
export function createHotContext() { return hot(); }
const sheets = new Map();
export function updateStyle(id, css) { let s = sheets.get(id); if (!s) { s = document.createElement('style'); s.setAttribute('data-vite-dev-id', id); document.head.appendChild(s); sheets.set(id, s); } s.textContent = css; }
export function removeStyle(id) { const s = sheets.get(id); if (s) { s.remove(); sheets.delete(id); } }
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  // no hot reload: the dev server is shared, and another agent's edit would reload the page mid-leg. Vite's client is
  // swapped for a stub that still injects CSS (the one thing the app needs of it)
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: VITE_STUB }));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&ride=gallop&mute=1&nolock=1&skipintro=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  // the page-side helpers: the layout (Vite serves the module), the horse's state, the sampler. Re-installed when the page
  // reloads under us (the dev server is shared: another agent's edit is a Vite full reload)
  const init = async () => {
  await page.waitForFunction(() => window.__world?.ride?.mounted === true, undefined, { timeout: 300000, polling: 1000 });
  await sleep(3000);
  await page.evaluate(async () => {
    const L = await import('/src/world/nalati/layout.ts');
    const w = window.__world, hf = window.__hf;
    const t = { L, trace: [], timer: 0 };
    t.input = (x, y, g) => { w.player.touchMove.x = x; w.player.touchMove.y = y; w.ride.mount.touchGallop = g; };
    t.state = () => {
      const m = w.ride.mount, h = m.horse, cam = w.player.camera.position;
      if (h === null) return { mounted: false, x: w.player.position.x, y: w.player.position.y, z: w.player.position.z, ground: hf.heightAt(w.player.position.x, w.player.position.z) };
      return { mounted: true, x: h.position.x, y: h.position.y, z: h.position.z, ground: hf.heightAt(h.position.x, h.position.z), speed: m.speedNow ?? h.speed, gait: m.gait, eye: cam.y - h.position.y, yaw: h.yaw };
    };
    // the sampler rides the game's fixed step (sim time, not wall time: a slow headless frame runs fewer steps a second)
    t.steps = 0; t.rec = false;
    w.game.onFixed('post', () => {
      t.steps++;
      if (t.rec && t.steps % 6 === 0) t.trace.push({ step: t.steps, ...t.state() });
      // R3: the nearest herd horse to the player (on foot: a stampede that passes through him comes within its own girth)
      if (t.rec && t.herd !== undefined) for (const h of t.herd.members) t.minD = Math.min(t.minD, Math.hypot(h.position.x - w.player.position.x, h.position.z - w.player.position.z));
    });
    t.start = () => { t.trace = []; t.rec = true; t.t0 = t.steps; };
    t.stop = () => { t.rec = false; return t.trace; };
    t.q = { ...(await import('/src/physics/query.ts')), ...(await import('/src/physics/active.ts')), ...(await import('/src/physics/surface.ts')) };
    t.place = (x, z, yaw) => {
      const m = w.ride.mount;
      if (!m.mounted) { const h = w.wildlife.campHorses[0]; w.player.position.set(x + 1, hf.heightAt(x, z), z); m.mount(h); }
      m.teleport(x, z, yaw);
      m.steed = 100; m.winded = false;
    };
    window.__rt = t;
  });
  };
  await init();
  /** run a leg; if the page reloaded mid-way (window.__rt gone), set up again and run it once more */
  const leg = async (name, fn) => {
    if (!ONLY.includes(name)) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (!(await page.evaluate(() => window.__rt !== undefined))) await init();
        await fn();
        if (await page.evaluate(() => window.__rt !== undefined)) return;
      } catch (e) { console.log(`${name}: ${String(e).slice(0, 160)} — retrying`); }
      await init();
    }
  };
  const input = (sx, sy, gallop) => page.evaluate(({ x, y, g }) => { window.__rt.input(x, y, g); }, { x: sx, y: sy, g: gallop });
  const frames = [];
  const shot = async (label) => { frames.push({ label, b64: (await page.screenshot({ type: 'jpeg', quality: 78 })).toString('base64') }); };
  /** wait `ms` of game time (fixed steps at 60 Hz), a wall-clock cap of 20× */
  const simWait = async (ms) => {
    const until = (await page.evaluate(() => window.__rt.steps)) + Math.round(ms * 0.06), wall = Date.now() + ms * 20;
    while (Date.now() < wall && (await page.evaluate(() => window.__rt.steps)) < until) await sleep(100);
  };
  const run = async (ms, x, y, g) => { await page.evaluate(() => { window.__rt.start(); }); await input(x, y, g); await simWait(ms); await input(0, 0, false); return page.evaluate(() => window.__rt.stop()); };
  const settle = async () => { await input(0, 0, false); await simWait(1500); };

  // ── open ground: the north road from the spawn ──
  await leg('open', async () => {
    await page.evaluate(() => { const w = window.__world, sp = w.chunk.spawn; window.__rt.place(sp.x, sp.z, sp.yaw + Math.PI); });
    await settle();
    const tr = await run(3500, 0, 1, true);
    const a = tr[0], b = tr[tr.length - 1];
    const eyes = tr.filter((s) => s.mounted).map((s) => s.eye);
    results.open = { metres: Number(Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)), eyeMin: Number(Math.min(...eyes).toFixed(2)), eyeMax: Number(Math.max(...eyes).toFixed(2)), eyeMean: Number((eyes.reduce((s, v) => s + v, 0) / eyes.length).toFixed(2)), topSpeed: Number(Math.max(...tr.map((s) => s.speed ?? 0)).toFixed(1)), feetOverGround: Number(Math.max(...tr.map((s) => Math.abs(s.y - s.ground))).toFixed(2)) };
    await shot(`open · ${results.open.metres} m in 3.5 s · eye ${results.open.eyeMean} m`);
  });

  // ── the camp yurt: gallop straight at it (found in the physics world: a tall wall on a ray in from outside the camp) ──
  await leg('yurt', async () => {
    const setup = await page.evaluate(() => {
      const rt = window.__rt, { CAMP } = rt.L, hf = window.__hf, ph = rt.q.activePhysics();
      let best = null;
      for (let i = 0; i < 24; i++) {
        const th = i / 24 * Math.PI * 2, dx = -Math.sin(th), dz = -Math.cos(th);
        const sx = CAMP.x - dx * 40, sz = CAMP.z - dz * 40, gy = hf.heightAt(CAMP.x, CAMP.z);
        const lo = rt.q.castRay(ph, { x: sx, y: gy + 1.2, z: sz }, { x: dx, y: 0, z: dz }, 45);
        const hi = rt.q.castRay(ph, { x: sx, y: gy + 3.0, z: sz }, { x: dx, y: 0, z: dz }, 45);
        if (lo === null || hi === null || lo.material === 'ground' || Math.abs(lo.distance - hi.distance) > 2.5 || lo.distance < 18) continue;
        // a wall as wide as the horse (a yurt's felt), not a pole: two rays 1 m either side meet it within 1.5 m too
        const side = [-1, 1].map((k) => rt.q.castRay(ph, { x: sx + dz * k, y: gy + 1.2, z: sz - dx * k }, { x: dx, y: 0, z: dz }, 45));
        if (lo.material !== 'felt' && side.some((h) => h === null || Math.abs(h.distance - lo.distance) > 1.5)) continue;
        const owner = lo.owner, name = String(owner?.name ?? owner?.id ?? '?');
        const c = { dx, dz, x: lo.point.x, z: lo.point.z, name, material: lo.material, collider: lo.collider };
        if (best === null || (lo.material === 'felt' && best.material !== 'felt')) best = c;   // felt = a yurt
      }
      if (best === null) return null;
      // head-on: aim at the middle of the thing hit (a round yurt met off-centre only turns the horse aside)
      const t = best.collider.translation();
      let dx = t.x - (best.x - best.dx * 16), dz = t.z - (best.z - best.dz * 16);
      const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const sx = t.x - dx * 9, sz = t.z - dz * 9;
      const face = rt.q.castRay(ph, { x: sx, y: hf.heightAt(t.x - dx * 5, t.z - dz * 5) + 1.0, z: sz }, { x: dx, y: 0, z: dz }, 12);
      if (face === null || face.material === 'ground') return null;
      rt.place(face.point.x - dx * 16, face.point.z - dz * 16, Math.atan2(dx, dz));
      return { dx, dz, x: face.point.x, z: face.point.z, name: best.name, material: face.material };
    });
    if (setup !== null) {
      await settle();
      const tr = await run(3500, 0, 1, true);
      const along = (s) => (s.x - setup.x) * setup.dx + (s.z - setup.z) * setup.dz;   // 0 = the wall, - = before it
      const nose = Math.max(...tr.map(along)) + 1.2;
      results.yurt = { hit: setup.name, material: setup.material, closestNoseToWall: Number((-nose).toFixed(2)), passedWall: tr.some((s) => along(s) > 0), topSpeed: Number(Math.max(...tr.map((s) => s.speed ?? 0)).toFixed(1)), endSpeed: Number((tr[tr.length - 1].speed ?? 0).toFixed(1)) };
      await shot(`${setup.material === 'felt' ? 'yurt' : setup.name} at a gallop · nose ${results.yurt.closestNoseToWall} m off · through: ${results.yurt.passedWall}`);
    } else results.yurt = { skipped: 'no tall wall on a ray into the camp (not registered as colliders yet?)' };
  });

  // ── the corral fence: walk into it (stops), then canter at it (jumps it) — the rail found by a ray at knee height ──
  await leg('fence', async () => {
    const setup = await page.evaluate(() => {
      const rt = window.__rt, { CORRAL } = rt.L, hf = window.__hf, ph = rt.q.activePhysics();
      for (let i = 0; i < 16; i++) {
        const th = Math.PI / 2 + i / 16 * Math.PI * 2, dx = -Math.sin(th), dz = -Math.cos(th);
        const sx = CORRAL.x - dx * (CORRAL.r + 25), sz = CORRAL.z - dz * (CORRAL.r + 25);
        let clear = true;
        for (let k = 0; k <= 26; k += 2) { const x = sx + dx * k, z = sz + dz * k; if (Math.abs(hf.heightAt(x, z) - hf.heightAt(sx, sz)) > 1.2) clear = false; }
        if (!clear) continue;
        const y = hf.heightAt(CORRAL.x - dx * CORRAL.r, CORRAL.z - dz * CORRAL.r);
        const hit = rt.q.castRay(ph, { x: sx, y: y + 0.7, z: sz }, { x: dx, y: 0, z: dz }, CORRAL.r + 27);
        if (hit === null || hit.material === 'ground' || Math.abs(hit.distance - 25) > 1.5) continue;
        const top = rt.q.castRay(ph, { x: sx, y: y + 1.75, z: sz }, { x: dx, y: 0, z: dz }, CORRAL.r + 27);
        return { x: hit.point.x, z: hit.point.z, dx, dz, name: String(hit.owner?.name ?? hit.owner?.id ?? '?'), clearAbove: top === null || top.distance > hit.distance + 1 };
      }
      return null;
    });
    if (setup !== null) {
      const along = (s) => (s.x - setup.x) * setup.dx + (s.z - setup.z) * setup.dz;   // 0 = the rail, + = past it
      await page.evaluate((f) => { window.__rt.place(f.x - f.dx * 7, f.z - f.dz * 7, Math.atan2(f.dx, f.dz)); }, setup);
      await settle();
      const walk = await run(6000, 0, 0.3, false);
      await shot(`fence at a walk · nose ${(-(Math.max(...walk.map(along)) + 1.2)).toFixed(2)} m off the rail`);
      await page.evaluate((f) => { window.__rt.place(f.x - f.dx * 24, f.z - f.dz * 24, Math.atan2(f.dx, f.dz)); }, setup);
      await settle();
      const jump = await run(5000, 0, 1, false);
      const near = jump.filter((s) => Math.abs(along(s)) < 1.3);
      results.fence = {
        hit: setup.name, clearAbove: setup.clearAbove,
        walk: { closestNoseToRail: Number((-(Math.max(...walk.map(along)) + 1.2)).toFixed(2)), crossed: walk.some((s) => along(s) > 0.5) },
        canter: { crossed: jump.some((s) => along(s) > 1.5), feetOverGroundAtRail: near.length > 0 ? Number(Math.max(...near.map((s) => s.y - s.ground)).toFixed(2)) : null, topSpeed: Number(Math.max(...jump.map((s) => s.speed ?? 0)).toFixed(1)) },
      };
    } else results.fence = { skipped: 'no rail on a ray into the corral at knee height (not registered as colliders yet?)' };
  });

  // ── the bridge over the Kunes: trot across, south → north ──
  await leg('bridge', async () => {
    const setup = await page.evaluate(() => {
      const { BRIDGE } = window.__rt.L;
      const z0 = BRIDGE.z - BRIDGE.span / 2 - 14;
      window.__rt.place(BRIDGE.x, z0, 0);
      return { x: BRIDGE.x, z: BRIDGE.z, span: BRIDGE.span, deckY: BRIDGE.deckY, z0 };
    });
    await settle();
    // trot across; the frame is taken as the horse passes mid-span
    await page.evaluate(() => { window.__rt.start(); });
    await input(0, 0.6, false);
    const total = Math.round((setup.span + 36) / 4.2 * 1000);
    let waited = 0;
    while (waited < total && (await page.evaluate((zm) => window.__world.ride.mount.horse.position.z < zm, setup.z))) { await simWait(200); waited += 200; }
    await shot('bridge · mid-span (the frame)');
    const midShot = frames.length - 1;
    await simWait(Math.max(0, total - waited));
    await input(0, 0, false);
    const tr = await page.evaluate(() => window.__rt.stop());
    const onSpan = tr.filter((s) => Math.abs(s.z - setup.z) < setup.span / 2 - 1);
    const mid = tr.reduce((b, s) => (Math.abs(s.z - setup.z) < Math.abs(b.z - setup.z) ? s : b), tr[0]);
    results.bridge = {
      deckY: setup.deckY, samplesOnSpan: onSpan.length,
      lowestOnSpan: onSpan.length > 0 ? Number(Math.min(...onSpan.map((s) => s.y)).toFixed(2)) : null,
      riverBedAtMid: Number(mid.ground.toFixed(2)), midY: Number(mid.y.toFixed(2)),
      reachedFarBank: tr[tr.length - 1].z > setup.z + setup.span / 2, maxXDrift: Number(Math.max(...tr.map((s) => Math.abs(s.x - setup.x))).toFixed(2)),
    };
    frames[midShot].label = `bridge at a trot · lowest on the span ${results.bridge.lowestOnSpan} (deck ${setup.deckY}, river bed ${results.bridge.riverBedAtMid})`;
  });

  // ── crag faces: one between the horse's two limits (40–45°: a gallop refuses it, a walk climbs it), one past both ──
  await leg('crag', async () => {
    const faces = await page.evaluate(() => {
      const rt = window.__rt, hf = window.__hf, ph = rt.q.activePhysics(), half = (hf.CHUNK_HALF ?? 560) - 30;
      const slope = (x, z, dx, dz) => Math.atan2(hf.heightAt(x + dx * 0.5, z + dz * 0.5) - hf.heightAt(x - dx * 0.5, z - dz * 0.5), 1) * 180 / Math.PI;
      // anywhere on the map: a face whose slope up its fall line holds in [lo, hi] for 4 m, with 16 m of gentle run-up
      // below it and nothing built / no rock in the way (a knee-high ray up the path meets only the ground)
      const find = (lo, hi) => {
        for (let gx = -half; gx < half; gx += 3) for (let gz = -half; gz < half; gz += 3) {
          const e = 0.5, hx = hf.heightAt(gx + e, gz) - hf.heightAt(gx - e, gz), hz = hf.heightAt(gx, gz + e) - hf.heightAt(gx, gz - e), l = Math.hypot(hx, hz);
          if (l < 1e-3) continue;
          const dx = hx / l, dz = hz / l;
          let ok = true;
          for (let k = 0; k <= 3 && ok; k += 0.5) { const sl = slope(gx + dx * k, gz + dz * k, dx, dz); if (sl < lo || sl > hi) ok = false; }
          for (let k = 2; k <= 12 && ok; k += 1) if (Math.abs(slope(gx - dx * k, gz - dz * k, dx, dz)) > 22) ok = false;
          if (!ok) continue;
          const sx = gx - dx * 14, sz = gz - dz * 14;
          const hit = rt.q.castRay(ph, { x: sx, y: hf.heightAt(sx, sz) + 0.9, z: sz }, { x: dx, y: 0, z: dz }, 14);
          if (hit !== null && hit.material !== 'ground') continue;
          return { x: gx, z: gz, dx, dz, face: slope(gx + dx * 2, gz + dz * 2, dx, dz) };
        }
        return null;
      };
      return { mid: find(37, 46), steep: find(55, 75) };
    });
    const ride = async (face, gait) => {
      await page.evaluate((s) => { window.__rt.place(s.x - s.dx * 11, s.z - s.dz * 11, Math.atan2(s.dx, s.dz)); }, face);
      await settle();
      const tr = await run(gait === 'gallop' ? 5000 : 14000, 0, gait === 'gallop' ? 1 : 0.3, gait === 'gallop');
      return page.evaluate(({ tr: trace, face: f }) => {
        const hf = window.__hf;
        const slope = (x, z) => Math.atan2(hf.heightAt(x + f.dx * 0.5, z + f.dz * 0.5) - hf.heightAt(x - f.dx * 0.5, z - f.dz * 0.5), 1) * 180 / Math.PI;
        const along = (p) => (p.x - f.x) * f.dx + (p.z - f.z) * f.dz;   // 0 = the foot of the face
        const end = trace[trace.length - 1];
        return {
          furthestUpFace: Number(Math.max(...trace.map(along)).toFixed(1)),
          steepestGroundUnder: Number(Math.max(...trace.map((p) => slope(p.x, p.z))).toFixed(1)),
          climbed: Number((end.y - trace[0].y).toFixed(2)),
          slopeAheadAtStop: Number(slope(end.x + f.dx * 1.4, end.z + f.dz * 1.4).toFixed(1)),
          endSpeed: Number((end.speed ?? 0).toFixed(1)),
        };
      }, { tr, face });
    };
    results.crag = {};
    if (faces.mid !== null) {
      results.crag.mid = { face: Number(faces.mid.face.toFixed(1)), gallop: await ride(faces.mid, 'gallop') };
      await shot(`${results.crag.mid.face}° face at a gallop · refused ${results.crag.mid.gallop.furthestUpFace} m up`);
      results.crag.mid.walk = await ride(faces.mid, 'walk');
      await shot(`${results.crag.mid.face}° face at a walk · ${results.crag.mid.walk.furthestUpFace} m up, +${results.crag.mid.walk.climbed} m`);
    } else results.crag.mid = { skipped: 'no 37–46° face' };
    results.crag.steep = faces.steep === null ? { skipped: 'no 55–75° face' } : { face: Number(faces.steep.face.toFixed(1)), walk: await ride(faces.steep, 'walk') };
  });

  // ── R3: a stampede through the rider on foot · into a rider galloping at it (head-on) · with a rider among it ──
  await leg('herd', async () => {
    await page.evaluate(async () => {
      const { wildEnv } = await import('/src/entities/wildEnv.ts');
      const rt = window.__rt;
      rt.knocks = 0;
      if (rt.knockHooked !== true) { rt.knockHooked = true; const k = wildEnv.onKnockdown; wildEnv.onKnockdown = (x, z, s) => { rt.knocks++; k?.(x, z, s); }; }
    });
    // one herd for every leg — the calm one with the flattest 115 m east of it (it stampedes east, the head-on rider
    // comes from there) — put back where it grazed before each leg, so the legs don't depend on each other
    await page.evaluate(() => {
      const w = window.__world, rt = window.__rt, hf = window.__hf;
      const rough = (h) => { let worst = 0; for (let x = h.cx - 10; x < h.cx + 115; x += 2) worst = Math.max(worst, Math.abs(hf.heightAt(x + 1, h.cz) - hf.heightAt(x - 1, h.cz)) / 2); return worst + (hf.inChunk(h.cx + 115, h.cz, 12) ? 0 : 100); };
      rt.herd = w.wildlife.herds.filter((h) => h.members.length > 6).sort((a, b) => rough(a) - rough(b))[0] ?? w.wildlife.herds[0];
      rt.herdHome = rt.herd === undefined ? null : { cx: rt.herd.cx, cz: rt.herd.cz, at: rt.herd.members.map((a) => ({ a, x: a.position.x, z: a.position.z, yaw: a.yaw })) };
      rt.resetHerd = () => {
        const h = rt.herd, home = rt.herdHome;
        for (const s0 of home.at) { s0.a.place(s0.x, s0.z, s0.yaw); s0.a.speed = 0; s0.a.setMotion(s0.yaw, 0, 1); }
        h.mode = 'graze'; h.stampeding = false; h.alert = 0; h.cx = home.cx; h.cz = home.cz;
      };
    });
    const legs = {};
    for (const mode of ['foot', 'head-on', 'with']) {
      const setup = await page.evaluate((how) => {
        const w = window.__world, rt = window.__rt, m = w.ride.mount, herd = rt.herd;
        if (herd === undefined || rt.herdHome === null) return null;
        rt.resetHerd();
        const cx = rt.herdHome.cx, cz = rt.herdHome.cz;
        // the herd runs +x, away from a point 25 m west of its centre
        if (how === 'foot') { if (m.mounted) m.dismount(); }
        else if (how === 'head-on') rt.place(cx + 110, cz, -Math.PI / 2);  // galloping west, into the herd running east
        else rt.place(cx - 4, cz, Math.PI / 2);                            // among them, running east with them
        rt.knocks = 0; m.jostles = 0; m.thrownBy = null; rt.minD = Infinity;
        return { n: herd.members.length };
      }, mode);
      if (setup === null) { legs[mode] = { skipped: 'no herd' }; continue; }
      await simWait(500);
      await page.evaluate(() => { window.__rt.start(); });
      await input(0, mode === 'foot' ? 0 : 1, mode !== 'foot');
      // head-on: 3.5 s of run-up to a full gallop (≥ 11 m/s) first
      if (mode === 'head-on') await simWait(3500);
      await page.evaluate(() => { const rt = window.__rt; rt.herd.stampede(rt.herdHome.cx - 25, rt.herdHome.cz); });
      if (mode === 'foot') {
        // on foot: stand in the path of the leading horse, 9 m ahead of it, facing it
        await simWait(500);
        await page.evaluate(() => {
          const w = window.__world, h = window.__rt.herd;
          const lead = [...h.members].sort((a, b) => b.position.x - a.position.x)[0];
          // its line of flight: away from the scare, through it
          const hx = window.__rt.herdHome.cx - 25, hz = window.__rt.herdHome.cz;
          let fx = lead.position.x - hx, fz = lead.position.z - hz; const fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
          const px = lead.position.x + fx * 8, pz = lead.position.z + fz * 8;
          w.player.position.set(px, window.__hf.heightAt(px, pz), pz); w.player.velocity.set(0, 0, 0); w.player.yaw = Math.atan2(fx, fz); window.__rt.minD = Infinity;
        });
      }
      await simWait(mode === 'head-on' ? 5000 : 4000);
      await input(0, 0, false);
      const tr = await page.evaluate(() => window.__rt.stop());
      const probe = await page.evaluate(() => { const m = window.__world.ride.mount; return { knockdowns: window.__rt.knocks, jostles: m.jostles, thrownBy: m.thrownBy, mountedAtEnd: m.mounted, nearestHorse: Number(window.__rt.minD.toFixed(2)) }; });
      legs[mode] = { herd: setup.n, topSpeed: Number(Math.max(...tr.map((s) => s.speed ?? 0)).toFixed(1)), ...probe };
      await shot(`stampede · ${mode} · knocked ${probe.knockdowns} · jostled ${probe.jostles} · thrown ${probe.thrownBy !== null}`);
    }
    results.herd = legs;
  });

  // ── the sheet: 3 columns of the frames, a caption under each ──
  const strip = await ctx.newPage();
  const sheet = await strip.evaluate(async ({ fs }) => {
    const w = 480, h = 270, cols = 3, rows = Math.ceil(fs.length / cols);
    const cv = document.createElement('canvas'); cv.width = w * cols; cv.height = (h + 26) * rows;
    const g = cv.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < fs.length; i++) {
      const im = new Image(); im.src = `data:image/jpeg;base64,${fs[i].b64}`; await im.decode();
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 26);
      g.drawImage(im, x, y, w - 4, h);
      g.fillStyle = '#8fe3ff'; g.font = '12px monospace'; g.fillText(fs[i].label.slice(0, 70), x + 6, y + h + 17);
    }
    return cv.toDataURL('image/jpeg', 0.75).slice('data:image/jpeg;base64,'.length);
  }, { fs: frames });
  const file = resolvePath(OUT, `${TAG}-sheet.jpg`);
  writeFileSync(file, Buffer.from(sheet, 'base64'));
  writeFileSync(resolvePath(OUT, `${TAG}-legs.json`), `${JSON.stringify({ tag: TAG, results, errors }, null, 2)}\n`);
  console.log(file);
  console.log(JSON.stringify(results, null, 2));
  if (errors.length > 0) console.log(`page errors:\n  ${errors.slice(0, 5).join('\n  ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
