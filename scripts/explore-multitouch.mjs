#!/usr/bin/env node
// explore-multitouch.mjs — E329 (Jake, iPhone: "World Explorer is not multi-tap: I can't change speed whilst flying"). The
// World Explorer's touch flight driven with REAL multi-touch: CDP Input.dispatchTouchEvent with several touch points down
// at once, on an iPhone-16-Pro portrait page (402 × 874 @ 3×, touch, phone tier), muted, on Metal.
//
//   speed   hold the FLY stick forward; while it is held, a second finger taps the speed chip. The chip must change
//           (Normal → Fast) and the camera must keep flying through the tap and after it, faster.
//   rail    stick + ▲ held at once: it climbs while it flies forward; ▲ lifts, it still flies; then stick + ▼ (descends).
//   look    stick + a one-finger look drag on the world: the view turns while the camera keeps flying.
//   all     stick + ▲ + a look drag + a speed tap, four fingers: every control acts at once.
//
//   scripts/serve-build.sh                                     # prints the URL
//   scripts/browser-lane.sh node scripts/explore-multitouch.mjs --url=http://127.0.0.1:4400 [--chunk=driftwood-isle]
//     [--only=speed,rail,look,all] [--shots=<dir>]
// Exit 1 on any failed check.
import { mkdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { flags, sleep } from './playground-harness.mjs';

const { chromium } = await import('playwright');
const flag = flags();
const BASE = flag('url', 'http://127.0.0.1:4400');
const CHUNK = flag('chunk', 'driftwood-isle');
const ONLY = flag('only', 'speed,rail,look,all').split(',');
const SHOTS = flag('shots', '');
if (SHOTS !== '') mkdirSync(resolvePath(SHOTS), { recursive: true });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${CHUNK} · ${name}${detail === undefined ? '' : ` — ${detail}`}`); };
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * the touch screen: each message lists the points it changes (Puppeteer's multi-touch semantics). A touchMove that leaves
 * a held point out does NOT lift it (probed on this Chrome: no pointerup until a touchEnd); touchEnd [p] lifts exactly p.
 */
function touchScreen(cdp) {
  const down = new Map();
  const point = (id) => { const p = down.get(id) ?? { x: 0, y: 0 }; return { id, x: p.x, y: p.y, radiusX: 6, radiusY: 6, force: 1 }; };
  const send = (type, ids) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ids.map(point) });
  return {
    press: (id, x, y) => { down.set(id, { x, y }); return send('touchStart', [id]); },
    move: (id, x, y) => { down.set(id, { x, y }); return send('touchMove', [id]); },
    lift: async (id) => { await send('touchEnd', [id]); down.delete(id); },
    liftAll: async () => { const ids = [...down.keys()]; if (ids.length > 0) await send('touchEnd', ids); down.clear(); },
  };
}

/** the centre of an element, or throw */
async function centre(page, sel) {
  const box = await (await page.$(sel))?.boundingBox();
  if (!box) throw new Error(`not on screen: ${sel}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** in the page: a camera track, one sample per frame — { t, x, y, z, fx, fy, fz } (the view's direction: fx / fz its heading) */
const startTrack = (page) => page.evaluate(() => {
  const w = window;
  w.__mtTrack = [];
  w.__mtRun = (w.__mtRun ?? 0) + 1;
  const run = w.__mtRun;
  const tick = () => {
    if (w.__mtRun !== run) return;
    const c = w.__world.game.camera, q = c.quaternion;
    w.__mtTrack.push({ t: performance.now(), x: c.position.x, y: c.position.y, z: c.position.z, fx: -2 * (q.x * q.z + q.w * q.y), fy: -2 * (q.y * q.z - q.w * q.x), fz: -(1 - 2 * (q.x * q.x + q.y * q.y)) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return performance.now();
});
const mark = (page) => page.evaluate(() => performance.now());
const track = (page) => page.evaluate(() => window.__mtTrack);

/** the samples between two page times */
const between = (tr, a, b) => tr.filter((s) => s.t >= a && s.t <= b);
/** horizontal speed (m/s) and climb rate (m/s) over a window */
function rate(tr, a, b) {
  const w = between(tr, a, b), s0 = w[0], s1 = w[w.length - 1];
  if (s0 === undefined || s1 === undefined || s1.t - s0.t < 1) return { h: 0, v: 0, p: 0, n: w.length };
  const dt = (s1.t - s0.t) / 1000;
  // the stick flies along the view: a view tipped down descends as it flies — `p` is that share of `v`, so a check
  // of the rail's own climb or sink reads v − p
  const h = Math.hypot(s1.x - s0.x, s1.z - s0.z) / dt, fx = (s0.fx + s1.fx) / 2, fy = (s0.fy + s1.fy) / 2, fz = (s0.fz + s1.fz) / 2, fh = Math.hypot(fx, fz);
  const along = (s1.x - s0.x) * fx + (s1.z - s0.z) * fz >= 0 ? 1 : -1; // (flying backward, a view tipped down climbs)
  return { h, v: (s1.y - s0.y) / dt, p: fh > 1e-3 ? (along * h * fy) / fh : 0, n: w.length };
}
/** the slowest horizontal speed over consecutive `ms` slices of [a, b] (a slice needs two frames) — "it never stopped" */
function minRate(tr, a, b, ms = 250) {
  let lo = Infinity;
  for (let t = a; t + ms <= b; t += ms) { const r = rate(tr, t, t + ms); if (r.n >= 2) lo = Math.min(lo, r.h); }
  return lo;
}
/** heading change (degrees) between two page times */
function turned(tr, a, b) {
  const s0 = between(tr, a - 100, a).pop() ?? between(tr, a, b)[0], s1 = between(tr, a, b).pop();
  if (s0 === undefined || s1 === undefined) return 0;
  return Math.abs(Math.atan2(s0.fx * s1.fz - s0.fz * s1.fx, s0.fx * s1.fx + s0.fz * s1.fz)) * 180 / Math.PI;
}

const speedLabel = (page) => page.evaluate(() => document.querySelector('.ws-x-speed')?.textContent ?? '');
/** tap the speed chip until it reads `want` (single finger, nothing else down) — the scenarios start at Normal */
async function speedTo(page, ts, want) {
  const p = await centre(page, '.ws-x-speed');
  for (let i = 0; i < 3 && !(await speedLabel(page)).includes(want); i++) { await ts.press(9, p.x, p.y); await sleep(60); await ts.lift(9); await sleep(350); }
}

async function shot(page, name) {
  if (SHOTS === '') return;
  await page.screenshot({ path: join(resolvePath(SHOTS), `${CHUNK}-${name}.jpg`), type: 'jpeg', quality: 70 });
}

/** push the stick forward (thumb id 1): press on its centre, slide up past the knob's travel */
async function stickForward(ts, stick, dir = -1) {
  await ts.press(1, stick.x, stick.y);
  for (let k = 1; k <= 4; k++) { await ts.move(1, stick.x, stick.y + dir * k * 14); await sleep(16); }
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--mute-audio', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log(`pageerror: ${e.message.slice(0, 200)}`); });
  const t0 = Date.now();
  // the home camera, not a `cam`: every shard's World Explorer opens over its own landmark, clear of the ground
  await page.goto(`${BASE}/?chunk=${CHUNK}&explore=world&tier=phone&touch=1&mute=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.ws-x.show.touch[data-mode="world"] .ws-x-stick') !== null && window.__world?.game !== undefined && document.querySelector('.ws-load') === null, undefined, { timeout: 480000, polling: 1000 });
  await sleep(4000); // the shaders compile, the first frames land
  console.log(`${CHUNK}: World Explorer up in ${Math.round((Date.now() - t0) / 1000)} s`);
  // a click that the browser synthesises (or the relay dispatches) on the speed chip is counted, for the log
  await page.evaluate(() => { document.querySelector('.ws-x-speed')?.addEventListener('click', (e) => { window.__mtClicks = (window.__mtClicks ?? 0) + 1; window.__mtTrusted = e.isTrusted; }); });
  const cdp = await ctx.newCDPSession(page);
  const ts = touchScreen(cdp);
  const stick = await centre(page, '.ws-x-stick'), speed = await centre(page, '.ws-x-speed');
  const up = await centre(page, '.ws-x-up'), down = await centre(page, '.ws-x-down');
  const look = { x: 170, y: 380 }; // the open world: under the readout, left of the rail, above the stick
  await startTrack(page);

  if (ONLY.includes('speed')) {
    await speedTo(page, ts, 'Normal');
    const before = await speedLabel(page);
    await stickForward(ts, stick);
    await sleep(900);
    const a = await mark(page);
    await sleep(600);
    const tapAt = await mark(page);
    await ts.press(2, speed.x, speed.y); // the second thumb, while the first still holds the stick forward
    await sleep(90);
    await ts.lift(2);
    await sleep(900);
    const b = await mark(page);
    await sleep(600);
    const c = await mark(page);
    const after = await speedLabel(page);
    const held = await page.evaluate(() => document.querySelector('.ws-x-stick')?.classList.contains('on') === true);
    await shot(page, 'speed-after-tap');
    await ts.liftAll();
    await sleep(900);
    const d = await mark(page);
    await sleep(500);
    const e = await mark(page);
    const tr = await track(page);
    const pre = rate(tr, a, tapAt), post = rate(tr, b, c), stop = rate(tr, d, e);
    const clicks = await page.evaluate(() => ({ n: window.__mtClicks ?? 0, trusted: window.__mtTrusted }));
    check('speed: a second finger\'s tap changes the speed while the stick is held', before !== after && after.includes('Fast'), `"${before}" → "${after}" (chip clicks ${clicks.n}, trusted ${String(clicks.trusted)})`);
    check('speed: the stick stays held through the tap', held);
    check('speed: the camera never stops flying through the tap', minRate(tr, a, c) > 2, `slowest 250 ms slice ${r2(minRate(tr, a, c))} m/s`);
    check('speed: it flies faster after the tap', post.h > pre.h * 2, `${r2(pre.h)} m/s → ${r2(post.h)} m/s`);
    check('speed: lifting the stick stops it', stop.h < 0.5, `${r2(stop.h)} m/s after release`);
    await speedTo(page, ts, 'Normal');
  }

  if (ONLY.includes('rail')) {
    // backward: the home view faces its landmark, so forward climbs its ground and ▼ meets the floor clamp (Driftwood's
    // crag), which reads as "▼ does nothing"; backward is over open air on every shard
    await stickForward(ts, stick, 1);
    await sleep(700);
    const a = await mark(page);
    await ts.press(3, up.x, up.y); // ▲ held with the other thumb
    await sleep(300);
    const b = await mark(page);
    await sleep(700);
    const c = await mark(page);
    await ts.lift(3);
    await sleep(400);
    const d = await mark(page);
    await sleep(500);
    const e = await mark(page);
    await ts.press(4, down.x, down.y); // then ▼
    await sleep(300);
    const f = await mark(page);
    await sleep(500);
    const g = await mark(page);
    await ts.lift(4);
    await ts.liftAll();
    await sleep(600);
    const tr = await track(page);
    const climb = rate(tr, b, c), level = rate(tr, d, e), sink = rate(tr, f, g);
    check('rail: ▲ climbs while the stick flies', climb.v > 3 && climb.h > 2, `climb ${r2(climb.v)} m/s at ${r2(climb.h)} m/s forward`);
    check('rail: ▲ released, the stick still flies level (along the view)', Math.abs(level.v - level.p) < 1 && level.h > 4, `${r2(level.v)} m/s vertical (the view's own ${r2(level.p)}) at ${r2(level.h)} m/s forward`);
    check('rail: ▼ sinks while the stick flies', sink.v - sink.p < -3 && sink.h > 2, `sink ${r2(sink.v)} m/s (the view's own ${r2(sink.p)}) at ${r2(sink.h)} m/s forward`);
    check('rail: never stopped', minRate(tr, a, g) > 2, `slowest slice ${r2(minRate(tr, a, g))} m/s`);
  }

  if (ONLY.includes('look')) {
    await stickForward(ts, stick);
    await sleep(700);
    const a = await mark(page);
    await ts.press(5, look.x, look.y); // a finger on the world, dragged sideways
    for (let k = 1; k <= 10; k++) { await ts.move(5, look.x + k * 12, look.y); await sleep(30); }
    await ts.lift(5);
    const b = await mark(page);
    await sleep(600);
    const c = await mark(page);
    const held = await page.evaluate(() => document.querySelector('.ws-x-stick')?.classList.contains('on') === true);
    await ts.liftAll();
    await sleep(600);
    const tr = await track(page);
    check('look: a one-finger drag turns the view while the stick flies', turned(tr, a, b) > 15, `turned ${r2(turned(tr, a, b))}°`);
    check('look: the camera never stops flying through the drag', minRate(tr, a, c) > 2, `slowest slice ${r2(minRate(tr, a, c))} m/s`);
    check('look: the stick stays held after the look finger lifts', held);
  }

  if (ONLY.includes('all')) {
    await speedTo(page, ts, 'Normal');
    const before = await speedLabel(page);
    await stickForward(ts, stick);
    await ts.press(3, up.x, up.y);
    await ts.press(5, look.x, look.y);
    await sleep(500);
    const a = await mark(page);
    for (let k = 1; k <= 8; k++) { await ts.move(5, look.x - k * 12, look.y); await sleep(30); }
    await ts.press(2, speed.x, speed.y); // four fingers down
    await sleep(90);
    await ts.lift(2);
    const b = await mark(page);
    await sleep(500);
    const c = await mark(page);
    const after = await speedLabel(page);
    const state = await page.evaluate(() => ({ stick: document.querySelector('.ws-x-stick')?.classList.contains('on') === true, up: document.querySelector('.ws-x-up')?.classList.contains('on') === true }));
    await shot(page, 'all-four-fingers');
    await ts.liftAll();
    await sleep(600);
    const tr = await track(page);
    const climb = rate(tr, a, c);
    check('all: speed tap with stick + ▲ + look down', before !== after, `"${before}" → "${after}"`);
    check('all: ▲ and the stick still held after the tap', state.stick && state.up);
    check('all: turning, climbing and flying at once', turned(tr, a, b) > 10 && climb.v > 3 && minRate(tr, a, c) > 2, `turned ${r2(turned(tr, a, b))}°, climb ${r2(climb.v)} m/s, slowest slice ${r2(minRate(tr, a, c))} m/s`);
    await speedTo(page, ts, 'Normal');
  }
  await ctx.close();
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${CHUNK}: ${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
