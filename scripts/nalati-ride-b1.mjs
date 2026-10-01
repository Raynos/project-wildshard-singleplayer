#!/usr/bin/env node
// nalati-ride-b1.mjs — NALATI-FINISH B1 (N13, E302): the riding feel, headless (muted, Metal), iPhone portrait (touch, phone tier).
//
//   scripts/browser-lane.sh node scripts/nalati-ride-b1.mjs --url=<a scripts/serve-build.sh URL> [--out=progress/e302-ride] \
//     [--only=look,road,bend,skid,spur,panic,name]
//
// The features are locked in (E331: no Debug rows). Legs (each teleports the camp horse from `?ride=gallop`, drives it
// with the touch stick / the GALLOP disc):
//   look   the free look swung 175° off the heading stops at ±140°
//   road   canter down the north road, let go of the stick: the horse keeps its gait on the road (4 s on: moving, on it)
//   bend   the same round the camp spur's bend (the reins follow the road round it)
//   skid   gallop, then pull back: the stand in < 1.2 s; and E320 — the horse's head is back where it stood (the rear knob
//          back to 0) a second after the stop, not reared up in front of the rider's eye for good
//   spur   canter, then tap GALLOP on the stride's beat: the gallop holds with no hold, faster than a held one, at ~no STEED
//   panic  a scare 6 m ahead at a stand (a bite / lightning): the horse rears, then bolts away from it, deaf to the stick;
//          lightning within 35 m reaches it (Wildlife.scare); the head settles after the bolt (E320)
//   name   on foot at the hitching rail: the prompt reads "Name Camp horse"; the NAME panel opens, a name typed + Enter
//          renames the horse (its prompt, the save in v2 Nalati/horseNames)
// Prints PASS / FAIL per check, writes b1-checks.json and one JPEG per leg (portrait) into --out.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e302-ride'));
const ONLY = flag('only', 'look,road,bend,skid,spur,panic,name').split(',');
const DPR = Number(flag('dpr', '3'));
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
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` · ${extra}` : ''}`); };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: VITE_STUB }));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&ride=gallop&mute=1&nolock=1&skipintro=1&tier=phone&touch=1&weapon=bow`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.ride?.mounted === true, undefined, { timeout: 300000, polling: 1000 });
  await sleep(4000);
  await page.evaluate(() => {
    // a build has no /src modules to import: the two roads the legs ride (src/shards/nalati-grasslands/layout.ts N_ROAD_PTS, CAMP_SPUR)
    const L = { N_ROAD_PTS: [[0, 250], [0, 190], [0, 156]], CAMP_SPUR: [[0, 214], [40, 218], [62, 215.5], [74, 206.5]] };
    const w = window.__wildshard?.world;
    const t = { L, steps: 0, trace: [], rec: false };
    t.m = () => w.ride.mount;
    t.input = (x, y, g) => { w.player.touchMove.x = x; w.player.touchMove.y = y; w.ride.mount.touchGallop = g; };
    t.state = () => {
      const m = w.ride.mount, h = m.horse;
      if (h === null) return { mounted: false };
      const hb = h.mesh.skeleton.getBoneByName('head'), hp = hb === undefined ? null : hb.getWorldPosition(h.position.clone());
      return { mounted: true, x: h.position.x, z: h.position.z, speed: h.speed, gait: m.gait, heading: h.yaw, steed: m.steed, onRoad: m.onRoad, skidT: m.skidT, panicT: m.panicT, rear: h.mem.rear ?? 0, streak: m.spur.streak, good: m.spur.good, latched: m.spur.latched, headUp: hp === null ? 0 : hp.y - h.position.y };
    };
    w.game.onFixed('post', () => { t.steps++; if (t.rec && t.steps % 6 === 0) t.trace.push({ step: t.steps, ...t.state() }); });
    t.start = () => { t.trace = []; t.rec = true; };
    t.stop = () => { t.rec = false; return t.trace; };
    t.place = (x, z, yaw) => { const m = w.ride.mount; m.teleport(x, z, yaw); m.steed = 100; m.winded = false; };
    /** distance from (x, z) to a polyline */
    t.off = (pts, x, z) => {
      let best = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], ux = bx - ax, uz = bz - az, l2 = ux * ux + uz * uz;
        const u = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l2));
        best = Math.min(best, Math.hypot(x - ax - ux * u, z - az - uz * u));
      }
      return best;
    };
    // the rhythm tapper: presses GALLOP for ~70 ms each time the stride's phase crosses its downbeat (the disc's pulse)
    t.tapper = null;
    t.tapRhythm = (on) => {
      if (t.tapper !== null) { cancelAnimationFrame(t.tapper); t.tapper = null; }
      w.ride.mount.touchGallop = false;
      if (!on) return;
      let last = -1, upAt = 0;
      const tick = () => {
        const m = w.ride.mount, h = m.horse;
        if (h !== null) {
          const ph = h.gaitPhase, now = performance.now();
          if (last > 0.8 && ph < 0.2 && now > upAt + 150) { m.touchGallop = true; upAt = now + 70; }
          if (m.touchGallop && now > upAt) m.touchGallop = false;
          last = ph;
        }
        t.tapper = requestAnimationFrame(tick);
      };
      t.tapper = requestAnimationFrame(tick);
    };
    window.__rb = t;
  });
  const input = (x, y, g) => page.evaluate(({ x: sx, y: sy, g: sg }) => { window.__rb.input(sx, sy, sg); }, { x, y, g });
  const simWait = async (ms) => {
    const until = (await page.evaluate(() => window.__rb.steps)) + Math.round(ms * 0.06), wall = Date.now() + ms * 20;
    while (Date.now() < wall && (await page.evaluate(() => window.__rb.steps)) < until) await sleep(50);
  };
  const state = () => page.evaluate(() => window.__rb.state());
  const shot = async (name) => { const p = `${OUT}/b1-${name}.jpg`; await page.screenshot({ path: p, type: 'jpeg', quality: 72 }); return p; };
  const place = (x, z, yaw) => page.evaluate(({ x: px, z: pz, yaw: py }) => { window.__rb.place(px, pz, py); }, { x, z, yaw });
  const stand = async () => { await input(0, -1, false); await simWait(1500); await input(0, 0, false); await simWait(300); };
  const out = {};

  // ── look: the free look swung 175° round stops at the limit ──
  if (ONLY.includes('look')) {
    await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z, sp.yaw + Math.PI); });
    await stand();
    const rel = await page.evaluate(async () => {
      const w = window.__wildshard?.world, h = w.ride.mount.horse;
      w.player.yaw = h.yaw - Math.PI + (175 * Math.PI) / 180;
      await new Promise((resolve) => { setTimeout(resolve, 400); });
      const d = w.player.yaw + Math.PI - h.yaw;
      return (Math.atan2(Math.sin(d), Math.cos(d)) * 180) / Math.PI;
    });
    out.look = Number(rel.toFixed(1));
    check('look behind stops at ±140°', Math.abs(Math.abs(rel) - 140) < 2, `${rel.toFixed(1)}°`);
    await shot('look-140');
  }

  // ── road: canter down the north road, let go ──
  const roadLeg = async (name, pts, x, z, yaw) => {
    const res = {};
    for (const mode of ['on']) {
      await place(x, z, yaw);
      await stand();
      await place(x, z, yaw);
      await input(0, 1, false); await simWait(3500);
      await page.evaluate(() => { window.__rb.start(); });
      await input(0, 0, false); await simWait(4500);
      if (mode === 'on') await shot(name);
      const tr = await page.evaluate(() => window.__rb.stop());
      const end = tr[tr.length - 1];
      if (process.env.B1_TRACE === '1') console.log(name, mode, tr.map((q) => `${q.z.toFixed(0)}:${q.speed.toFixed(1)}${q.onRoad ? 'R' : ''}`).join(' '));
      const offs = await page.evaluate(({ p, tr: tt }) => tt.map((s) => window.__rb.off(p, s.x, s.z)), { p: pts, tr });
      res[mode] = { endSpeed: Number(end.speed.toFixed(1)), maxOff: Number(Math.max(...offs).toFixed(1)), metres: Number(Math.hypot(end.x - tr[0].x, end.z - tr[0].z).toFixed(1)), onRoad: tr.filter((s) => s.onRoad).length / tr.length };
    }
    return res;
  };
  if (ONLY.includes('road')) {
    const r = await page.evaluate(() => { const L = window.__rb.L; return L.N_ROAD_PTS.concat([]); });
    // the north road from its gate, heading south (−z) — a straight 60 m
    out.road = await roadLeg('road', r, 0.5, 236, Math.PI);
    check('road: let go on the road, the horse keeps its gait', out.road.on.endSpeed > 5 && out.road.on.maxOff < 3.5, JSON.stringify(out.road.on));
  }
  if (ONLY.includes('bend')) {
    const spur = await page.evaluate(() => window.__rb.L.CAMP_SPUR.concat([]));
    // the camp spur east from the N road, round its bend at (40, 218)
    out.bend = await roadLeg('bend', spur, 12, 215.2, Math.atan2(40, 4));
    check('bend: the reins follow the road round the bend', out.bend.on.endSpeed > 4 && out.bend.on.maxOff < 4, JSON.stringify(out.bend.on));
  }

  // ── skid: gallop, pull back ──
  if (ONLY.includes('skid')) {
    out.skid = {};
    for (const mode of ['on']) {
      await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z - 2, sp.yaw + Math.PI); });
      await stand();
      await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z - 2, sp.yaw + Math.PI); });
      await simWait(1500);
      out.standHead = (await state()).headUp;
      await input(0, 1, true); await simWait(4500);
      const top = (await state()).speed;
      await page.evaluate(() => { window.__rb.start(); });
      await input(0, -1, false);
      await simWait(350);
      if (mode === 'on') await shot('skid');
      await simWait(1800);
      await input(0, 0, false);
      await simWait(1500);   // E320: stood still a moment — the head must be back down where it was
      const tr = await page.evaluate(() => window.__rb.stop());
      const i = tr.findIndex((s) => s.speed < 0.6);
      const secs = i === -1 ? 99 : (tr[i].step - tr[0].step) / 60;
      const end = tr[tr.length - 1];
      out.skid[mode] = { top: Number(top.toFixed(1)), stopS: Number(secs.toFixed(2)), rear: Number(Math.max(...tr.map((s) => s.rear)).toFixed(2)), rearAfter: Number(end.rear.toFixed(2)), headUpStood: Number(out.standHead.toFixed(2)), headUpAfter: Number(end.headUp.toFixed(2)) };
    }
    check('skid: a gallop stands in < 1.2 s, sitting back on its haunches', out.skid.on.stopS < 1.2 && out.skid.on.top > 11 && out.skid.on.rear > 0.2, JSON.stringify(out.skid.on));
    check('E320: after the skid the rear lets go and the head is back down (not reared in front of the eye)', out.skid.on.rearAfter < 0.02 && out.skid.on.headUpAfter < out.skid.on.headUpStood + 0.08, JSON.stringify(out.skid.on));
  }

  // ── spur: canter, then tap on the beat ──
  if (ONLY.includes('spur')) {
    const run = async (how) => {
      await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z - 2, sp.yaw + Math.PI); });
      await stand();
      await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z - 2, sp.yaw + Math.PI); });
      await input(0, 1, false); await simWait(3000);
      await page.evaluate(() => { window.__rb.start(); });
      await (how === 'rhythm' ? page.evaluate(() => { window.__rb.tapRhythm(true); }) : input(0, 1, true));
      await simWait(2500);
      if (how === 'rhythm') await shot('spur');
      await simWait(2500);
      await page.evaluate(() => { window.__rb.tapRhythm(false); });
      await input(0, 0, false);
      const tr = await page.evaluate(() => window.__rb.stop());
      const late = tr.slice(Math.floor(tr.length / 2));
      return { top: Number(Math.max(...late.map((s) => s.speed)).toFixed(2)), steedUsed: Number((tr[0].steed - tr[tr.length - 1].steed).toFixed(1)), good: tr[tr.length - 1].good, latchedShare: Number((late.filter((s) => s.latched).length / late.length).toFixed(2)) };
    };
    out.spur = { rhythm: await run('rhythm'), held: await run('held') };
    check('spur: taps on the beat hold the gallop', out.spur.rhythm.good >= 4 && out.spur.rhythm.latchedShare > 0.8, JSON.stringify(out.spur.rhythm));
    check('spur: faster than a held gallop, for a fraction of the STEED', out.spur.rhythm.top > out.spur.held.top + 0.3 && out.spur.rhythm.steedUsed < out.spur.held.steedUsed * 0.5, `rhythm ${JSON.stringify(out.spur.rhythm)} · held ${JSON.stringify(out.spur.held)}`);
  }

  // ── panic: a scare ahead at a stand ──
  if (ONLY.includes('panic')) {
    await page.evaluate(() => { const w = window.__wildshard?.world, sp = w.chunk.spawn; window.__rb.place(sp.x, sp.z - 2, sp.yaw + Math.PI); });
    await stand();
    const p0 = await state();
    await page.evaluate(() => { window.__rb.start(); });
    const ok = await page.evaluate(() => { const m = window.__wildshard.world.ride.mount, h = m.horse; return m.panic(h.position.x + Math.sin(h.yaw) * 6, h.position.z + Math.cos(h.yaw) * 6, 2); });
    await input(0.9, 0.4, false);   // the reins say forward-right: the horse ignores them
    await simWait(900);
    await shot('panic');
    await simWait(1500);
    await input(0, 0, false);
    const tr = await page.evaluate(() => window.__rb.stop());
    const end = tr[tr.length - 1];
    // away from the scare: the scare was ahead, so the horse ends up behind where it stood
    const along = (end.x - p0.x) * Math.sin(p0.heading) + (end.z - p0.z) * Math.cos(p0.heading);
    out.panic = { accepted: ok, rear: Number(Math.max(...tr.map((s) => s.rear)).toFixed(2)), along: Number(along.toFixed(1)), top: Number(Math.max(...tr.map((s) => s.speed)).toFixed(1)) };
    check('panic: rears, then bolts away from the scare', ok && out.panic.rear > 0.3 && along < -6, JSON.stringify(out.panic));
    await stand();
    const settled = await state();
    check('E320: after the bolt the rear lets go (the head settles)', settled.rear < 0.02, JSON.stringify({ rear: settled.rear, headUp: settled.headUp }));
    const ev = await page.evaluate(() => {
      const w = window.__wildshard?.world, m = w.ride.mount, h = m.horse;
      m.panicT = 0;
      w.wildlife.scare(h.position.x + 10, h.position.z, 60);
      return { bolt: m.panicT };
    });
    check('panic: lightning within 35 m reaches the horse', ev.bolt > 1, JSON.stringify(ev));
    await simWait(2500);
  }

  // ── name: on foot at the rail, NAME the camp horse tied there ──
  if (ONLY.includes('name')) {
    await page.evaluate(() => {
      const w = window.__wildshard?.world;
      const save = JSON.parse(localStorage.getItem('wildshard.save.v2.nalati-grasslands') ?? '{"keys":{}}'); delete save.keys.horseNames; localStorage.setItem('wildshard.save.v2.nalati-grasslands', JSON.stringify(save));
      w.ride.mount.dismount();
      // at the head of the camp horse still tied there (the black; the bay is out on the road from ?ride=gallop), on its side of the rail
      const h = w.wildlife.campHorses[1], hx = h.position.x + Math.sin(h.yaw) * 1.3, hz = h.position.z + Math.cos(h.yaw) * 1.3 - 0.9;
      w.player.position.set(hx, window.__hf.heightAt(hx, hz), hz); w.player.velocity.set(0, 0, 0);
      w.player.yaw = Math.atan2(-(h.position.x - hx), -(h.position.z - hz)); w.player.pitch = -0.15;
    });
    await simWait(1200);
    const label = await page.evaluate(() => ({ ride: window.__wildshard.world.ride.interactable.label, use: document.querySelector('.ws-touch-use')?.textContent.trim() ?? '' }));
    check('name: at the tied horse\'s head the USE band reads "Name …"', label.ride.startsWith('Name ') && /name/i.test(label.use), JSON.stringify(label));
    await page.evaluate(() => { window.__wildshard.world.ride.interactable.onInteract(); });
    await page.waitForSelector('.ws-ride-nameinput', { timeout: 5000 });
    await sleep(300);   // the box drops input in its first 150 ms (the E that opened it, E328)
    await page.fill('.ws-ride-nameinput', 'kara  jorga');
    await shot('name');
    await page.press('.ws-ride-nameinput', 'Enter');
    await simWait(600);
    const res = await page.evaluate(() => {
      const w = window.__wildshard?.world, a = w.wildlife.campHorses.find((h) => w.ride.mount.nameOf(h) === 'Kara Jorga') ?? null;
      return { renamed: a !== null, label: a?.label ?? null, stored: JSON.stringify(JSON.parse(localStorage.getItem('wildshard.save.v2.nalati-grasslands') ?? '{}').keys?.horseNames?.data ?? null), open: document.querySelector('.ws-ride-namebox') !== null, prompt: w.ride.interactable.label };
    });
    check('name: typed + Enter renames it, saved, the panel closed', res.renamed && res.label === 'Kara Jorga' && res.stored.includes('Kara Jorga') && !res.open, JSON.stringify(res));
  }

  out.errors = errors;
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 5));
  writeFileSync(`${OUT}/b1-checks.json`, JSON.stringify({ results, out }, null, 2));
  const fails = results.filter((r) => !r.ok).length;
  console.log(`${results.length - fails}/${results.length} passed`);
} finally {
  await browser.close();
}
