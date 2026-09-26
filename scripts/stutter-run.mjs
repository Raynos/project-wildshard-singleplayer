#!/usr/bin/env node
// stutter-run.mjs — E186 (Jake, iPhone, Driftwood: "very periodic big stutters, like 20 skipped frames"): run the player
// across Driftwood Isle in real time at the phone tier and record, per drawn frame, what the frame cost and what happened
// in it, so a periodic spike can be pinned to the event that repeats with it.
//
//   node scripts/stutter-run.mjs --base=http://localhost:4291 --label=before [--secs=45] [--cpu=4] [--out=<dir>]
//     [--walk] (4.3 m/s instead of the 7.2 m/s sprint) [--eval='<js run in the page before the run>'] [--reps=1]
//
// Per drawn frame: the interval since the last one, the main-thread ms inside animation-frame callbacks (the game loop),
// composer.render's CPU ms, the GPU ms of composer.render (EXT_disjoint_timer_query_webgl2, matched back to its frame),
// bytes uploaded at the WebGL API (bufferData / bufferSubData, texture uploads), programs linked, framebuffer binds, draw
// calls, triangles, the JS heap (a drop = a GC ran), long tasks, the ground cover's refills (near, every 4 m) and far
// swaps (every 8 m), a sun shadow fade running, the three slowest updaters of the frame, the player's position.
// The player runs the waypoints below with the real controller (W + Shift, steered by yaw), not teleports. Headless
// Chromium, ANGLE Metal, muted, iPhone portrait 390×844 @3, touch, the phone tier. Output: <out>/<label>.json + a summary.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium, webkit } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a === undefined ? d : a.slice(n.length + 3); };
const has = (n) => argv.includes(`--${n}`);
const BASE = flag('base', 'http://localhost:4291');
const LABEL = flag('label', 'run');
const SECS = Number(flag('secs', '45'));
const CPU = Number(flag('cpu', '4'));
const OUT = resolvePath(flag('out', 'progress/e186'));
const EVAL = flag('eval', '');
const REPS = Number(flag('reps', '1'));
const WALK = has('walk');
/** A/B in one page (interleaved, `reps` rounds): each variant sets window.__e186mode before its run. The ground cover's
 *  attributes are patched so a mode can change what their uploads send (base = as built; live = the near refill uploads only
 *  the live count; noup = the cover uploads nothing — plants freeze, the upper bound of what its uploads cost) */
const VARIANTS = flag('variants', 'base').split(',');
const HEAPPROF = has('heapprof');
/** --settings=coverRange:500,coverFar:on — saved Debug options (debug-settings.mjs), set before the page loads */
const SETTINGS = Object.fromEntries(flag('settings', '').split(',').filter(Boolean).map((kv) => kv.split(':')));
mkdirSync(OUT, { recursive: true });

// spawn pier → the Blender cove → the plateau's flank → the interior → east → back down into the cove
const PATH = [[0, -235], [0, -205], [0, -170], [-40, -120], [-70, -40], [-20, 20], [50, 40], [40, -60], [0, -150], [-30, -190], [30, -190], [0, -120]];

const INIT = `(() => {
  const W = window, C = W.__e186 = { buf: 0, bufN: 0, bufMax: 0, tex: 0, texN: 0, links: 0, fb: 0, sync: 0 };
  const P = WebGL2RenderingContext.prototype;
  const bpe = (a) => (a && a.BYTES_PER_ELEMENT) || 1;
  const wrap = (name, bytes, kind) => { const f = P[name]; if (typeof f !== 'function') return; P[name] = function (...a) { const b = bytes(a); if (kind === 'buf') { C.buf += b; C.bufN++; if (b > C.bufMax) C.bufMax = b; } else if (kind === 'tex') { C.tex += b; C.texN++; } return f.apply(this, a); }; };
  wrap('bufferData', (a) => (typeof a[1] === 'number' ? a[1] : a[1] ? (a[1].byteLength ?? 0) : 0), 'buf');
  wrap('bufferSubData', (a) => { const d = a[2]; if (!d) return 0; if (a[4] !== undefined && a[4] > 0) return a[4] * bpe(d); return d.byteLength - (a[3] ?? 0) * bpe(d); }, 'buf');
  const px = (a) => { const d = a.find((x) => x && typeof x === 'object' && 'byteLength' in x); if (d) return d.byteLength; const img = a.find((x) => x && typeof x === 'object' && ('width' in x)); return img ? img.width * img.height * 4 : 0; };
  for (const n of ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'compressedTexImage3D', 'compressedTexSubImage3D']) wrap(n, px, 'tex');
  const lp = P.linkProgram; P.linkProgram = function (...a) { C.links++; return lp.apply(this, a); };
  const bf = P.bindFramebuffer; P.bindFramebuffer = function (...a) { C.fb++; return bf.apply(this, a); };
  for (const n of ['readPixels', 'getBufferSubData', 'clientWaitSync', 'finish']) { const f = P[n]; P[n] = function (...a) { C.sync++; return f.apply(this, a); }; }
  W.__e186long = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__e186long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  const rawRAF = W.requestAnimationFrame.bind(W); W.__e186raw = rawRAF; W.__e186cpu = 0;
  W.requestAnimationFrame = (cb) => rawRAF((t) => { const s = performance.now(); try { cb(t); } finally { W.__e186cpu += performance.now() - s; } });
})();`;

// --engine=webkit: Playwright's WebKit — Safari's WebGL path (the GPU process, its IPC stream, ANGLE Metal), the closest this Mac gets to the iPhone; no CPU throttling or GPU timers there
const WEBKIT = flag('engine', 'chromium') === 'webkit';
const browser = WEBKIT ? await webkit.launch() : await chromium.launch({ args: ['--use-angle=metal', '--mute-audio', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const summary = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  if (Object.keys(SETTINGS).length > 0) await debugSettings(page, SETTINGS);
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message.slice(0, 200)); });
  const url = `${BASE}/?chunk=driftwood-isle&skipintro=1&nolock=1&mute=1&touch=1&tier=phone`;
  console.error(`> ${LABEL}: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const w = window.__world, hud = document.getElementById('hud'); return Boolean(w?.game && w.player) && document.querySelector('.ws-load') === null && !(hud?.classList.contains('intro')); }, undefined, { timeout: 300_000, polling: 1000 });
  await page.waitForTimeout(10_000); // shaders, the Blender island, the horizon paintings land
  await page.evaluate(() => { const a = window.__world?.animals; if (a) a.calm = true; });
  if (EVAL) await page.evaluate(EVAL);
  if (VARIANTS.length > 1 || VARIANTS[0] !== 'base') await page.evaluate(() => {
    window.__world.game.scene.traverse((mesh) => {
      if (!mesh.isInstancedMesh || !mesh.name.startsWith('ground-cover')) return;
      const g = mesh.geometry, attrs = [mesh.instanceMatrix, mesh.instanceColor, g.getAttribute('aGround'), g.getAttribute('aCover'), g.getAttribute('aNrm'), g.getAttribute('aBorn')];
      for (const a of attrs) if (a) Object.defineProperty(a, 'needsUpdate', { configurable: true, get() { return false; }, set(v) {
        if (!v) return;
        const m = window.__e186mode;
        if (m === 'noup') return;
        if (m === 'live' && !mesh.name.endsWith('-far')) { this.clearUpdateRanges(); this.addUpdateRange(0, Math.max(1, mesh.count * this.itemSize)); }
        this.version++;
      } });
    });
  });
  const cdp = WEBKIT ? null : await ctx.newCDPSession(page);
  for (let rep = 0; rep < REPS; rep++) for (const mode of VARIANTS) {
    await page.evaluate((m) => { window.__e186mode = m; }, mode);
    // back to the start, settled (a teleport, not measured)
    await page.evaluate(() => {
      // the shard's spawn on the pier; spawn() puts the feet on the terrain under the deck — land on the deck (scorecard.mjs)
      const w = window.__world, pl = w.player, s = w.chunk.spawn, ph = w.physics;
      pl.spawn(s.x, s.z, s.yaw);
      if (ph?.R) {
        const x = pl.position.x, z = pl.position.z, top = pl.position.y + 2.5;
        const hit = ph.world.castRay(new ph.R.Ray({ x, y: top, z }, { x: 0, y: -1, z: 0 }), 2.6, true, ph.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => c.parent()?.isFixed() ?? true);
        if (hit) pl.position.y = Math.max(pl.position.y, top - hit.timeOfImpact);
        pl.prevFeet?.copy(pl.position);
      }
      pl.velocity?.set(0, 0, 0); pl.keys?.clear();
    });
    await page.waitForTimeout(4000);
    if (cdp && CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    // --heapprof: V8's sampling heap profiler over the run, garbage included — who allocates what the GC then collects
    if (cdp && HEAPPROF) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const r = await page.evaluate(async ([path, secs, walk]) => {
      const W = window, w = W.__world, g = w.game, pl = w.player, gl = g.renderer.getContext(), C = W.__e186;
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      let cover = null; g.scene.traverse((o) => { if (o.name === 'ground-cover') cover = o.userData.stats ?? null; });
      const fade = w.sky?.shadowFade ?? null;
      // the slowest updaters per frame
      const sys = new Map();
      const lists = [g.inputs, g.updaters, g.lates].filter(Boolean);
      const restore = [];
      for (const list of lists) for (const s of list) { const fn = s.fn; restore.push([s, fn]); s.fn = (...a) => { const t0 = performance.now(); try { return fn(...a); } finally { const d = performance.now() - t0; sys.set(s.label, (sys.get(s.label) ?? 0) + d); } }; }
      const fixedFn = g.runFixed; let fixedMs = 0;
      if (typeof fixedFn === 'function') g.runFixed = (...a) => { const t0 = performance.now(); try { return fixedFn.apply(g, a); } finally { fixedMs += performance.now() - t0; } };
      const frames = [], pending = [];
      const composer = g.composer, orig = composer.render.bind(composer);
      let lastEnd = performance.now(), prev = { ...C }, prevNear = cover?.nearRefillMs ?? 0, prevFarCount = cover?.farCount ?? 0, prevFarCells = cover?.farCells ?? 0, prevFarFrames = cover?.farJobFrames ?? 0;
      let nearN = 0, farN = 0;
      composer.render = (dt) => {
        if (ext) for (let q = pending[0]; q !== undefined; q = pending[0]) {
          if (!gl.getQueryParameter(q[0], gl.QUERY_RESULT_AVAILABLE)) break;
          pending.shift();
          const f = frames[q[1]];
          if (f && !gl.getParameter(ext.GPU_DISJOINT_EXT)) f.gpu = gl.getQueryParameter(q[0], gl.QUERY_RESULT) / 1e6;
          gl.deleteQuery(q[0]);
        }
        const t0 = performance.now();
        let q = null;
        if (ext && pending.length < 8) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
        orig(dt);
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push([q, frames.length]); }
        const t1 = performance.now();
        const top = [...sys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => [k, Math.round(v * 10) / 10]);
        sys.clear();
        // the ground cover's events: a near refill rewrites nearRefillMs (always a fresh float); a far swap moves farCount / farCells
        let near = 0, farSwap = 0;
        if (cover) {
          if (cover.nearRefills !== undefined) { near = cover.nearRefills - nearN; nearN = cover.nearRefills; } else if (cover.nearRefillMs !== prevNear) near = 1;
          if (cover.farSwaps !== undefined) { farSwap = cover.farSwaps - farN; farN = cover.farSwaps; } else if (cover.farCount !== prevFarCount || cover.farCells !== prevFarCells || (cover.farJobFrames < prevFarFrames)) farSwap = 1;
          prevNear = cover.nearRefillMs; prevFarCount = cover.farCount; prevFarCells = cover.farCells; prevFarFrames = cover.farJobFrames;
        }
        const p = pl.position;
        frames.push({
          t: t1, dt: t1 - lastEnd, cpu: W.__e186cpu, render: t1 - t0, gpu: -1, fixed: fixedMs,
          buf: C.buf - prev.buf, bufN: C.bufN - prev.bufN, bufMax: C.bufMax, tex: C.tex - prev.tex, links: C.links - prev.links, fb: C.fb - prev.fb, sync: C.sync - prev.sync,
          calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles,
          heap: performance.memory ? performance.memory.usedJSHeapSize : 0,
          near, farSwap, farJob: cover ? cover.farJobFrames : 0, fade: fade ? (fade.busy ? 1 : 0) : -1, top,
          x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10,
        });
        C.bufMax = 0; prev = { ...C }; W.__e186cpu = 0; fixedMs = 0; lastEnd = t1;
      };
      // run the path: W + Shift, the yaw turned toward the next waypoint every frame
      let wi = 1;
      pl.keys.add('KeyW'); if (!walk) pl.keys.add('ShiftLeft');
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const p = pl.position, wp = path[wi];
          if (wp) {
            const dx = wp[0] - p.x, dz = wp[1] - p.z;
            if (Math.hypot(dx, dz) < 4) wi = (wi + 1) % path.length;
            else pl.yaw = Math.atan2(-dx, -dz);
          }
          if (performance.now() - t0 < secs * 1000) W.__e186raw(tick); else resolve();
        };
        W.__e186raw(tick);
      });
      pl.keys.clear();
      composer.render = orig;
      for (const [s, fn] of restore) s.fn = fn;
      if (typeof fixedFn === 'function') g.runFixed = fixedFn;
      const long = W.__e186long.filter(([s]) => s >= t0 - 100);
      return { frames: frames.slice(1), long, wi };
    }, [PATH, SECS, WALK]);
    if (cdp && CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    let alloc = null;
    if (cdp && HEAPPROF) {
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      // self bytes per allocation site: the innermost three script frames (a builtin — subarray, join — is named after them)
      const self = new Map();
      const walk = (n, stack) => {
        const cf = n.callFrame, own = cf.url !== '';
        const key = `${cf.functionName === '' ? '(anon)' : cf.functionName} ${cf.url.split('/').pop().replace(/-[\w-]{8}\.js$/, '')}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
        const st = own ? [...stack, key] : stack;
        if (n.selfSize > 0) {
          const site = `${own ? '' : `[${cf.functionName}] `}${st.slice(-3).reverse().join(' < ')}`;
          self.set(site, (self.get(site) ?? 0) + n.selfSize);
        }
        for (const c of n.children) walk(c, st);
      };
      walk(profile.head, []);
      const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, Math.round(v / 1024)]);
      alloc = { selfKB: top(self), totalKB: Math.round([...self.values()].reduce((a, b) => a + b, 0) / 1024) };
    }
    const tag = `${LABEL}${VARIANTS.length > 1 ? `-${mode}` : ''}${REPS > 1 ? `-r${rep + 1}` : ''}`;
    writeFileSync(`${OUT}/${tag}.json`, JSON.stringify({ label: tag, url, cpu: CPU, secs: SECS, walk: WALK, eval: EVAL, errors, alloc, ...r }));
    summary.push(summarize(tag, r.frames, r.long));
  }
  await ctx.close();
} finally { await browser.close(); }
for (const s of summary) console.log(s);

function summarize(tag, F, long) {
  const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0; };
  const dts = F.map((f) => f.dt), secs = (F.at(-1).t - F[0].t) / 1000;
  const p50 = q(dts, 0.5), spikes = F.filter((f) => f.dt > Math.max(50, 2 * p50));
  const gpu = F.filter((f) => f.gpu >= 0).map((f) => f.gpu);
  const r1 = (v) => Math.round(v * 10) / 10;
  const L = [];
  L.push(`${tag}: ${F.length} frames / ${r1(secs)} s · frame p50 ${r1(p50)} p95 ${r1(q(dts, 0.95))} p99 ${r1(q(dts, 0.99))} max ${r1(Math.max(...dts))} ms · spikes (>max(50, 2×p50)) ${spikes.length} (${r1(spikes.length / secs * 30)} / 30 s) · gpu p50 ${r1(q(gpu, 0.5))} p95 ${r1(q(gpu, 0.95))} max ${r1(Math.max(0, ...gpu))}`);
  const sum = (k) => F.reduce((s, f) => s + f[k], 0);
  L.push(`  uploads: buffers ${r1(sum('buf') / 1e6 / secs)} MB/s (${Math.round(sum('bufN') / secs)} calls/s), textures ${r1(sum('tex') / 1e6 / secs)} MB/s · links ${sum('links')} · near refills ${sum('near')} · far swaps ${sum('farSwap')} · fade frames ${F.filter((f) => f.fade === 1).length} · long tasks ${long.length} (max ${Math.round(Math.max(0, ...long.map((l) => l[1])))} ms)`);
  const by = (pred) => { const on = F.filter(pred), off = F.filter((f) => !pred(f)); return `${on.length} fr: dt p50 ${r1(q(on.map((f) => f.dt), 0.5))} / p95 ${r1(q(on.map((f) => f.dt), 0.95))}, cpu p50 ${r1(q(on.map((f) => f.cpu), 0.5))}, gpu p50 ${r1(q(on.filter((f) => f.gpu >= 0).map((f) => f.gpu), 0.5))} vs rest dt p50 ${r1(q(off.map((f) => f.dt), 0.5))} gpu ${r1(q(off.filter((f) => f.gpu >= 0).map((f) => f.gpu), 0.5))}`; };
  L.push(`  near-refill frames: ${by((f) => f.near > 0)}`);
  L.push(`  far-swap frames:    ${by((f) => f.farSwap > 0)}`);
  L.push(`  fade frames:        ${by((f) => f.fade === 1)}`);
  L.push(`  big upload (>1 MB): ${by((f) => f.buf > 1e6)}`);
  for (const s of spikes.slice(0, 25)) L.push(`   spike ${r1(s.dt)} ms @${r1((s.t - F[0].t) / 1000)}s cpu ${r1(s.cpu)} render ${r1(s.render)} gpu ${r1(s.gpu)} buf ${r1(s.buf / 1e6)} MB tex ${r1(s.tex / 1e6)} MB links ${s.links} near ${s.near} far ${s.farSwap} fade ${s.fade} calls ${s.calls} top ${JSON.stringify(s.top)}`);
  return L.join('\n');
}
