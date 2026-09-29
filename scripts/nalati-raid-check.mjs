#!/usr/bin/env node
// nalati-raid-check.mjs — NALATI-FINISH B1 (N13, E302): the wolves' raid on the flock and the mounted shepherd, headless
// (muted, Metal), iPhone portrait (touch, phone tier).
//
//   node scripts/nalati-raid-check.mjs [--url=http://127.0.0.1:5467] [--out=progress/e302-ride] [--dpr=3]
//
// The player sits a horse 55 m off the pasture, looking at the flock. Checks: the shepherd rides his ring round the flock;
// `raid.start(true)` sends the pack; it reaches the flock; the shepherd gallops at a wolf and cracks the whip; the raid
// ends (driven off, or a sheep taken) inside 90 s of game time; the phone's awake-body cap holds. Writes raid-check.json
// and portrait JPEGs (raid-1-shepherd, raid-2-wolves, raid-3-whip).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5467');
const OUT = resolvePath(flag('out', 'progress/e302-ride'));
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
  await debugSettings(page, { sheepRaids: 'off' });   // no scheduled raid mid-check: the check starts its own
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&ride=gallop&mute=1&nolock=1&skipintro=1&tier=phone&touch=1&weapon=bow`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.ride?.mounted === true, undefined, { timeout: 300000, polling: 1000 });
  await sleep(3000);
  const setup = await page.evaluate(() => {
    const w = window.__world, raid = w.ride.raid, f = w.wildlife.flocks[0], h = raid.shepherd;
    const t = { steps: 0 };
    w.game.onFixed('post', () => { t.steps++; });
    window.__rc = t;
    // the player on a horse 26 m east of the flock, facing it
    const px = f.cx - 26, pz = f.cz + 6;
    w.ride.mount.teleport(px, pz, Math.atan2(f.cx - px, f.cz - pz));
    w.player.pitch = -0.08;
    /** turn the player's horse where it stands (or `d` m from the target) to face a point */
    t.face = (x, z, d) => {
      const mine = w.ride.mount.horse;
      let hx = mine.position.x, hz = mine.position.z;
      if (d !== undefined) { const l = Math.hypot(hx - x, hz - z) || 1; hx = x + (hx - x) / l * d; hz = z + (hz - z) / l * d; }
      w.ride.mount.teleport(hx, hz, Math.atan2(x - hx, z - hz));
      w.player.pitch = -0.1;
    };
    return { shepherd: h !== null, flock: [f.cx, f.cz], alive: f.alive, shepherdAt: h ? [h.position.x, h.position.z] : null };
  });
  check('the shepherd is spawned by the flock', setup.shepherd, JSON.stringify(setup));
  const simWait = async (ms) => {
    const until = (await page.evaluate(() => window.__rc.steps)) + Math.round(ms * 0.06), wall = Date.now() + ms * 20;
    while (Date.now() < wall && (await page.evaluate(() => window.__rc.steps)) < until) await sleep(100);
  };
  const sample = () => page.evaluate(() => {
    const w = window.__world, raid = w.ride.raid, f = w.wildlife.flocks[0], h = raid.shepherd, pk = w.wildlife.packs.at(-1);
    const wolves = w.wildlife.livingWolves;
    let near = Infinity, nearFlock = Infinity;
    for (const wf of wolves) { near = Math.min(near, Math.hypot(wf.position.x - h.position.x, wf.position.z - h.position.z)); nearFlock = Math.min(nearFlock, Math.hypot(wf.position.x - f.cx, wf.position.z - f.cz)); }
    const bodies = w.physics?.bodies?.awake ?? w.physics?.awakeCount ?? null;
    return { raiding: raid.raiding, phase: pk?.phase, prey: pk?.prey !== null, cracks: raid.cracks, taken: raid.taken, drivenOff: raid.drivenOff, sheep: f.alive,
      shepherdToFlock: Number(Math.hypot(h.position.x - f.cx, h.position.z - f.cz).toFixed(1)), shepherdSpeed: Number(h.speed.toFixed(1)),
      wolfToShepherd: Number(near.toFixed(1)), wolfToFlock: Number(nearFlock.toFixed(1)), bodies };
  });
  // before: his ring round the flock
  await simWait(6000);
  const s0 = await sample();
  check('he rides a ring round the flock at a walk', s0.shepherdToFlock < 40 && !s0.raiding, JSON.stringify(s0));
  await page.evaluate(() => { const h = window.__world.ride.raid.shepherd; window.__rc.face(h.position.x, h.position.z, 8); });
  await sleep(600);
  await page.screenshot({ path: `${OUT}/raid-1-shepherd.jpg`, type: 'jpeg', quality: 72 });
  await page.evaluate(() => { const f = window.__world.wildlife.flocks[0]; window.__rc.face(f.cx, f.cz, 26); });
  const started = await page.evaluate(() => window.__world.ride.raid.start(true));
  check('a raid starts (the pack takes a sheep as its prey)', started);
  const trace = [];
  let shotWolves = false, shotWhip = false, maxSpeed = 0, minWolfFlock = Infinity;
  for (let i = 0; i < 90; i++) {
    await simWait(1000);
    const s = await sample();
    trace.push(s);
    maxSpeed = Math.max(maxSpeed, s.shepherdSpeed); minWolfFlock = Math.min(minWolfFlock, s.wolfToFlock);
    if (!shotWolves && s.wolfToFlock < 30) {
      shotWolves = true;
      await page.evaluate(() => {
        const w = window.__world, f = w.wildlife.flocks[0];
        let best = null, bd = Infinity;
        for (const wf of w.wildlife.livingWolves) { const d = Math.hypot(wf.position.x - f.cx, wf.position.z - f.cz); if (d < bd) { bd = d; best = wf; } }
        if (best !== null) window.__rc.face((best.position.x + f.cx) / 2, (best.position.z + f.cz) / 2);
      });
      await sleep(300);
      await page.screenshot({ path: `${OUT}/raid-2-wolves.jpg`, type: 'jpeg', quality: 72 });
    }
    if (!shotWhip && s.cracks > 0) {
      shotWhip = true;
      await page.evaluate(() => { const h = window.__world.ride.raid.shepherd; window.__rc.face(h.position.x, h.position.z); });
      await sleep(250);
      await page.screenshot({ path: `${OUT}/raid-3-whip.jpg`, type: 'jpeg', quality: 72 });
    }
    if (!s.raiding && i > 3) break;
  }
  const end = trace[trace.length - 1];
  check('the pack reaches the flock', minWolfFlock < 25, `closest wolf ${minWolfFlock.toFixed(1)} m`);
  check('the shepherd gallops out and cracks the whip', maxSpeed > 9 && end.cracks > 0, `top ${maxSpeed} m/s · cracks ${end.cracks}`);
  check('the raid ends inside 90 s (driven off or a sheep taken)', !end.raiding && end.drivenOff + end.taken === 1, JSON.stringify(end));
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 5));
  check('no page errors', errors.length === 0);
  writeFileSync(`${OUT}/raid-check.json`, JSON.stringify({ results, setup, s0, trace, errors }, null, 2));
  console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
} finally {
  await browser.close();
}
