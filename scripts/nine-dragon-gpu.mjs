#!/usr/bin/env node
// nine-dragon-gpu.mjs — E283, where Nine Dragon Stack's GPU milliseconds go on the phone frame (the method of
// scripts/pine-hollow-gpu.mjs, read its header for why it is built this way).
//
//   node scripts/nine-dragon-gpu.mjs --url=http://localhost:4173 [--poses=A,B,C,D] [--rounds=10] [--subtract=all|none|a,b]
//
// Jake's phone frame: an iPhone 17 Pro home-screen PWA, 402×812 CSS px, tier phone → the game's DPR 2 (804×1624).
// Each pose is one of the four mockup cameras (src/chunks/nine-dragon-stack/mockupCameras.ts), posed through a late hook
// while the game runs (the culler and the LODs settle on it), then the loop is paused (`game.frameGate`) and the frozen
// frame is timed: 12 composer frames back to back, one real GPU sync (a fresh 1-px clear + readPixels of the canvas), wall
// time ÷ 12, the p20 of several rounds (other GPU clients only add time). `cpu` is the median CPU submit of one frame: a
// frame that reads ≈ its cpu is CPU-bound here, not GPU-bound.
//
// SUBTRACT — what the frame saves without a thing (base and toggled rounds alternate; the medians' difference):
//   - `vm` the viewmodel (the camera's children), `hud-less` is not a GPU thing and is not here;
//   - every top-level child of the fragment's root (`nine-dragon-stack`), grouped by name (`kit:<name>`, `screens`, `sky` …);
//   - every other scene child with a name (`scene:<name>`: the look's instanced halos, streak cards …);
//   - every composer pass after the first, by index and class (`pass:<i>:<class>`) — switched off (`enabled = false`).
// The M5 Max's GPU is ~7–9× wider than the A19 Pro's and the phone throttles ~2× under sustained load, so read the
// numbers as ratios (this build against that, this group against the frame), not as phone milliseconds.
//
// One headless Chromium on Metal, muted; it holds one of the pass's two browser slots (.git/nine-dragon-browser-{1,2}.lock).
import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const base = flag('url', 'http://localhost:4173');
const ROUNDS = Number(flag('rounds', '10'));
const SUB = flag('subtract', 'all');
const poseKeys = flag('poses', 'A,B,C,D').split(',');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function takeSlot() {
  for (;;) {
    for (const n of [1, 2]) {
      const p = join(ROOT, `.git/nine-dragon-browser-${n}.lock`);
      if (existsSync(p)) {
        const pid = Number(readFileSync(p, 'utf8').trim());
        if (pid && alive(pid)) continue;
        try { unlinkSync(p); } catch { /* raced */ }
      }
      try { const fd = openSync(p, 'wx'); writeSync(fd, String(process.pid)); closeSync(fd); return p; } catch { /* raced */ }
    }
    await sleep(5000);
  }
}
const slot = await takeSlot();
const release = () => { try { if (readFileSync(slot, 'utf8').trim() === String(process.pid)) unlinkSync(slot); } catch { /* gone */ } };
process.on('exit', release);

const { MOCKUP_CAMERAS } = await import(join(ROOT, 'src/chunks/nine-dragon-stack/mockupCameras.ts'));

/** in the page, once: window.__gpu — the clock, the toggles */
function installProbe() {
  const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext(), composer = g.composer;
  const P = {};
  window.__gpu = P;
  P.render = () => { const t0 = performance.now(); composer.render(1 / 30); return performance.now() - t0; };
  const px = new Uint8Array(4);
  P.sync = () => {
    r.setRenderTarget(null);
    r.setScissor(0, 0, 1, 1); r.setScissorTest(true);
    r.clear(true, false, false);
    r.setScissorTest(false);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  };
  P.throughput = (k) => { P.render(); P.sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) P.render(); P.sync(); return (performance.now() - t0) / k; };
  P.cpuSubmit = (k) => { P.sync(); const a = []; for (let i = 0; i < k; i++) a.push(P.render()); P.sync(); a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 0; };
  P.toggles = new Map();
  P.toggles.set('null', () => undefined);
  const vm = [...g.camera.children];
  P.toggles.set('vm', (on) => { for (const o of vm) o.visible = !on; });
  const root = g.scene.getObjectByName('nine-dragon-stack');
  const byName = (list, prefix) => {
    const m = new Map();
    for (const o of list) { const k = `${prefix}${o.name === '' ? o.type : o.name}`; const l = m.get(k) ?? []; l.push(o); m.set(k, l); }
    for (const [k, l] of m) {
      const vis = l.map((o) => o.visible);
      P.toggles.set(k, (on) => { l.forEach((o, i) => { o.visible = on ? false : (vis[i] ?? true); }); });
    }
  };
  if (root) byName(root.children, 'kit:');
  byName(g.scene.children.filter((o) => o !== root && o !== g.camera && o.name !== ''), 'scene:');
  composer.passes.forEach((pass, i) => {
    if (i === 0) return;
    const was = pass.enabled;
    P.toggles.set(`pass:${i}:${pass.name === undefined || pass.name === '' ? (pass.constructor?.name ?? 'pass') : pass.name}`, (on) => { pass.enabled = on ? false : was; });
  });
}

async function runBase(rounds) {
  const P = window.__gpu, all = [];
  const nf = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); });
  P.throughput(4);
  for (let i = 0; i < rounds; i++) { all.push(P.throughput(12)); await nf(); }
  all.sort((x, y) => x - y);
  const at = (f) => all[Math.min(all.length - 1, Math.floor(all.length * f))] ?? 0;
  return { p20: at(0.2), p50: at(0.5), cpu: P.cpuSubmit(8) };
}

async function runAB([name, n]) {
  const P = window.__gpu, toggle = P.toggles.get(name);
  if (toggle === undefined) return null;
  const nf = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); });
  const b = [], o = [];
  try {
    for (let i = 0; i < n; i++) {
      toggle(false); b.push(P.throughput(12)); await nf();
      toggle(true); o.push(P.throughput(12)); await nf();
    }
  } finally { toggle(false); }
  const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 0; };
  const mb = med(b), mo = med(o);
  return { base: mb, off: mo, delta: mb - mo };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.info(`pageerror: ${e.message.slice(0, 300)}`));
  await page.goto(`${base}/?chunk=nine-dragon-stack&skipintro=1&tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.chunk?.slug === 'nine-dragon-stack' && (window.__world.game?.lastFrame?.calls ?? 0) > 60 && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
  await sleep(6000);
  await page.evaluate(() => {
    const w = window.__world;
    window.__ndg = { pose: null };
    w.game.onLate(() => {
      const p = window.__ndg.pose, cam = w.game.camera;
      if (!p) return;
      cam.position.set(p.eye[0], p.eye[1], p.eye[2]);
      cam.up.set(0, 1, 0);
      cam.lookAt(p.look[0], p.look[1], p.look[2]);
      cam.updateMatrixWorld(true);
    });
    w.freeCamera = true;
  });
  const size = await page.evaluate(() => { const c = window.__world.game.renderer.domElement; return `${c.width}×${c.height}`; });
  console.info(`buffer ${size} · ${base}`);
  for (const k of poseKeys) {
    const c = MOCKUP_CAMERAS[k];
    const yaw = (c.yaw * Math.PI) / 180, pitch = (c.pitch * Math.PI) / 180;
    const look = [c.eye[0] + Math.sin(yaw) * Math.cos(pitch) * 20, c.eye[1] + Math.sin(pitch) * 20, c.eye[2] - Math.cos(yaw) * Math.cos(pitch) * 20];
    await page.evaluate(() => { const g = window.__world.game; if (window.__ndGate !== undefined) g.frameGate = window.__ndGate; });
    await page.evaluate((v) => {
      const w = window.__world;
      try { w.player.position.set(v.eye[0], Math.max(125, v.eye[1] - 1.62), v.eye[2]); w.player.velocity.set(0, 0, 0); } catch { /* */ }
      window.__ndg.pose = v;
    }, { eye: c.eye, look });
    await sleep(2500);
    await page.evaluate(() => { const g = window.__world.game; window.__ndGate ??= g.frameGate; g.frameGate = () => false; });
    await sleep(300);
    await page.evaluate(installProbe);
    const b = await page.evaluate(runBase, ROUNDS * 2);
    const f = await page.evaluate(() => { const g = window.__world.game, rd = g.renderer; rd.info.reset(); g.composer.render(1 / 30); return { calls: rd.info.render.calls, tris: rd.info.render.triangles }; });
    console.info(`\nmockup ${k}: GPU ${b.p20.toFixed(2)} ms/frame (p50 ${b.p50.toFixed(2)}) · cpu submit ${b.cpu.toFixed(2)} ms · ${f.calls} draws · ${(f.tris / 1e6).toFixed(2)} M tris`);
    if (SUB === 'none') continue;
    const names = await page.evaluate(() => [...window.__gpu.toggles.keys()]);
    const want = SUB === 'all' ? names : names.filter((n) => SUB.split(',').some((s) => n.includes(s)));
    const rows = [];
    for (const n of want) {
      const ab = await page.evaluate(runAB, [n, Math.max(4, Math.round(ROUNDS / 2))]);
      if (ab !== null) rows.push({ n, ...ab });
    }
    rows.sort((x, y) => y.delta - x.delta);
    for (const r of rows) console.info(`  ${r.delta >= 0 ? ' ' : ''}${r.delta.toFixed(2).padStart(6)} ms  ${((100 * r.delta) / b.p20).toFixed(0).padStart(4)} %  ${r.n}`);
  }
} finally {
  await browser.close();
  release();
}
