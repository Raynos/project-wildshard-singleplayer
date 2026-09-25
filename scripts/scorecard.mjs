#!/usr/bin/env node
// scorecard.mjs — the regression scorecard (docs/design/scorecard.md). One table of every variable the big merges trade
// against each other (E155/E159 shard residency, E157 KTX2 textures + baked PMREM, E158/E161 prefetch + cache GC):
// memory, downloads, time, frame rate, the look, and the shard-switch route. A baseline is recorded on main before
// any of them merges; every merge reruns the scorecard on the merged tree and must be at or better than the baseline
// on every row, unless the user re-budgets that row in scorecard.budget.json.
//
// Per shard (driftwood-isle, nalati-grasslands, pine-hollow) × viewport (phone = iPhone portrait 390×844 @3, touch,
// ?tier=phone; desktop = 1600×900 @1, ?tier=desktop), in one headless Chromium on the host GPU (ANGLE Metal, muted):
//   load     cold (fresh context, service worker allowed) then warm (second load, same context): transfer bytes and
//            request count to playable, cold bytes until the network goes quiet (a background prefetch lands there),
//            time to play (bench-load's playMs: `.ws-load` gone and `window.__world` set) and the longest main-thread
//            task before it.
//   memory   on the warm page, settled, after a forced GC: JS heap (CDP Performance.getMetrics); GPU bytes counted at the
//            WebGL API (every texImage / texStorage / compressedTexImage / renderbufferStorage / bufferData, by internal
//            format and block size, minus deletes — render targets and PMREM included); a scene traversal estimate of the
//            material textures (w × h × bytes per texel × mips; compressed by block size); renderer.info counts.
//   poses    3 fixed poses per shard (from scripts/physics-baseline.mjs): teleport, settle, then ~10 s of frames: fps,
//            p95 frame interval, p50 / p95 main-thread ms inside requestAnimationFrame callbacks, draw calls,
//            triangles; then a screenshot (JPEG) — SSIM against the goldens in progress/scorecard/baseline/.
//   switch   per viewport, a fresh context: cold Driftwood → menu → Nalati → menu → Pine Hollow → menu → Driftwood.
//            Per switch: whether the page navigated (a document marker survives an in-page switch), whether the
//            loading screen showed, ms from ENTER WORLD to playable, bytes downloaded, the longest task, heap and GPU
//            bytes once settled. Then the Cache Storage total (navigator.storage.estimate) after all three shards.
//   retouch  (--retouch) a second build of the same tree with one texture re-encoded, served on the same origin after
//            the first: the bytes a returning player re-downloads for that one-texture change.
// Pinned so frames are comparable: time of day = midday + weather clear (the saved Settings the game reads), Nalati's
// storm cycle ?weather=clear, Math.random seeded (a fixed mulberry32 stream from the first script on), ?skipintro.
//
//   node scripts/scorecard.mjs --export=HEAD --tag=baseline --runs=2 --goldens --retouch   # the baseline (see the doc)
//   node scripts/scorecard.mjs --export=HEAD --tag=e155 --compare=baseline                 # a merge: exit 1 on a regression
//   node scripts/scorecard.mjs --url=http://localhost:4173 --tag=try --shards=pine-hollow --viewports=phone --no-switch
//   node scripts/scorecard.mjs --compare=baseline --against=e155                            # re-print a verdict, no browser
//
// Output: progress/scorecard/<tag>.json (every row + raw), progress/scorecard/<tag>.md (the tables), the pose shots in
// progress/scorecard/<tag>/ (the goldens when --goldens: progress/scorecard/baseline/).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve as resolvePath, join } from 'node:path';
import { createServer } from 'node:net';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT_DIR = resolvePath(ROOT, 'progress/scorecard');
const BUDGET_FILE = resolvePath(ROOT, 'scorecard.budget.json');
const SHARDS = ['driftwood-isle', 'nalati-grasslands', 'pine-hollow'];
const NAMES = { 'driftwood-isle': 'Driftwood Isle', 'nalati-grasslands': 'Nalati Grasslands', 'pine-hollow': 'Pine Hollow' };
const VIEWPORTS = {
  phone: { ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, query: 'touch=1&tier=phone' },
  desktop: { ctx: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, query: 'tier=desktop' },
};
// three stable poses per shard (scripts/physics-baseline.mjs POSES); no x = the shard's own spawn
const POSES = {
  'driftwood-isle': [{ name: 'pier' }, { name: 'beach', x: -10, z: -150, yaw: 4.3 }, { name: 'wreck', x: 105, z: 0, yaw: -1.5708 }],
  'nalati-grasslands': [{ name: 'camp', x: 60, z: 214, yaw: -1.5708 }, { name: 'bridge', x: 0, z: 200, yaw: 0 }, { name: 'plains', x: 65, z: 0, yaw: 3.1416 }],
  'pine-hollow': [{ name: 'gate', x: 0, z: -200, yaw: 3.1416 }, { name: 'cabin', x: -14, z: -62, yaw: 3.1416 }, { name: 'pond', x: -56, z: 95, yaw: 3.1416 }],
};
const ROUTE = ['driftwood-isle', 'nalati-grasslands', 'pine-hollow', 'driftwood-isle'];
const NETS = {
  wifi: { latency: 20, down: 30e6 / 8, up: 15e6 / 8 },
  '4g': { latency: 170, down: 9e6 / 8, up: 1.5e6 / 8 },
  none: null,
};
// the texture --retouch re-encodes when none is named: a Pine Hollow ground normal map (inside the phone boot pack; a file of its own on desktop)
const RETOUCH_DEFAULT = '/assets/tex/leafy_grass/nor_gl_1k.jpg';
const RETOUCH_SHARD = 'pine-hollow';

const HELP = `scorecard — the regression scorecard (docs/design/scorecard.md)

  node scripts/scorecard.mjs [flags]

  where the game comes from (one of):
  --export=<ref>        git archive <ref> into /tmp/scorecard-<sha>, node_modules symlinked, vite build, vite preview
  --serve=<dir>         vite preview of <dir>/dist (a clean export you built)
  --url=<origin>        a server that is already running (no --retouch)
  --port=4281           the preview port (the next free one is taken)

  --tag=<name>          output name (default: the build id)            --runs=1      repeat everything, report the median
  --shards=a,b          default all three                               --viewports=phone,desktop
  --sample=10           seconds of frames per pose                      --settle=5    seconds after a teleport / load
  --net=wifi            wifi | 4g | none (CDP throttle, service worker too)   --cpu=1  CDP CPU throttle
  --no-poses --no-switch --no-load --no-4g   skip a section             --retouch[=/assets/…]   the one-texture-change row
  --goldens             write the pose shots as the goldens (progress/scorecard/baseline/)
  --compare=<tag|file>  check this run against a baseline; exit 1 on a regression or a missed enforced rule
  --against=<tag|file>  with --compare and no browser: compare two existing result files
  --timeout=240         seconds per load`;

// ── args ──
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const has = (name) => argv.some((x) => x.split('=')[0] === `--${name}`);
if (has('help')) { console.log(HELP); process.exit(0); }
const RUNS = Math.max(1, Number(flag('runs', '1')));
const ONLY_SHARDS = flag('shards', SHARDS.join(',')).split(',').filter((s) => SHARDS.includes(s));
const ONLY_VPS = flag('viewports', 'phone,desktop').split(',').filter((v) => v in VIEWPORTS);
const SAMPLE_MS = Number(flag('sample', '10')) * 1000;
const SETTLE_MS = Number(flag('settle', '5')) * 1000;
const NET = flag('net', 'wifi');
const CPU = Number(flag('cpu', '1'));
const TIMEOUT_MS = Number(flag('timeout', '240')) * 1000;
const COMPARE = flag('compare', '');
const AGAINST = flag('against', '');
const GOLDENS = has('goldens');
const RETOUCH_ARG = flag('retouch', '');
const RETOUCH = has('retouch') ? (RETOUCH_ARG === '' ? RETOUCH_DEFAULT : RETOUCH_ARG) : '';
if (!(NET in NETS)) { console.error(`--net=${NET}: wifi | 4g | none`); process.exit(2); }

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
const loadResult = (x) => JSON.parse(readFileSync(x.endsWith('.json') ? resolvePath(x) : join(OUT_DIR, `${x}.json`), 'utf8'));

if (COMPARE && AGAINST) { // no browser: verdict of two result files
  const { text, regressions } = compareResults(loadResult(COMPARE), loadResult(AGAINST));
  console.log(text);
  process.exit(regressions > 0 ? 1 : 0);
}

// ── where the game comes from ──
const children = [];
const cleanup = () => { for (const c of children) if (!c.killed) c.kill('SIGTERM'); };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

let SERVE = flag('serve', '');
if (has('export')) SERVE = exportTree(flag('export', 'HEAD'));
let URL_BASE = flag('url', '').replace(/\/$/, '');
let PORT = 0;
let preview = null;
if (!URL_BASE) {
  if (!SERVE) { console.error('pass --export=<ref>, --serve=<dir> or --url=<origin>'); process.exit(2); }
  PORT = await freePort(Number(flag('port', '4281')));
  preview = await startPreview(join(SERVE, 'dist'), PORT);
  URL_BASE = `http://localhost:${PORT}`;
} else if (RETOUCH) { console.error('--retouch needs --export or --serve (it serves two builds on one origin)'); process.exit(2); }
const build = await buildIdOf(URL_BASE);
const TAG = flag('tag', build);
const SHOT_DIR = join(OUT_DIR, TAG);
const GOLDEN_DIR = join(OUT_DIR, 'baseline');
console.error(`> scorecard ${URL_BASE} build=${build} tag=${TAG} runs=${RUNS} net=${NET} cpu=${CPU}× shards=${ONLY_SHARDS.join(',')} viewports=${ONLY_VPS.join(',')}`);

// ── the in-page instrument, installed before any script of the page runs ──
const INIT_SCRIPT = `(() => {
  const W = window;
  // pins: the saved Settings the game reads (time of day frozen at midday, Pine Hollow's weather clear), a seeded Math.random
  try { const k = 'ws.settings.v1'; const cur = JSON.parse(localStorage.getItem(k) || '{}'); cur.time = 'midday'; cur.weather = 'clear'; localStorage.setItem(k, JSON.stringify(cur)); } catch {}
  let seed = 0x2545f491 >>> 0;
  Math.random = function random() { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // load timing (bench-load's definitions) + long tasks with their epoch start
  W.__bench_play = 0; W.__sc_long = [];
  const epoch = () => performance.timeOrigin + performance.now();
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) W.__sc_long.push([performance.timeOrigin + e.startTime, Math.round(e.duration), Math.round(e.startTime)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  // readiness: playable = no loading screen, a world, not on the title / menu; __sc_ready = the shard + when it became so
  W.__sc_loadSeen = 0; let loadOn = false, wasReady = false;
  setInterval(() => {
    const load = document.querySelector('.ws-load') !== null;
    if (load && !loadOn) W.__sc_loadSeen++;
    loadOn = load;
    const w = W.__world; const slug = w && w.chunk ? w.chunk.slug : null; const hud = document.getElementById('hud');
    if (!W.__bench_play && !load && w) W.__bench_play = Math.round(performance.now());
    const ok = !!slug && !load && !(hud && hud.classList.contains('intro'));
    if (ok && (!wasReady || !W.__sc_ready || W.__sc_ready.slug !== slug)) W.__sc_ready = { slug, at: epoch() };
    wasReady = ok;
  }, 25);
  // main-thread ms inside requestAnimationFrame callbacks (the game loop), summed per frame while sampling
  const rawRAF = W.requestAnimationFrame.bind(W); W.__sc_rawRAF = rawRAF; W.__sc_cpuAcc = 0; W.__sc_cpuOn = false;
  W.requestAnimationFrame = (cb) => rawRAF((t) => { if (!W.__sc_cpuOn) { cb(t); return; } const s = performance.now(); try { cb(t); } finally { W.__sc_cpuAcc += performance.now() - s; } });
  // GPU bytes at the WebGL API, per context: textures (per face + level), renderbuffers, buffers
  const SIZED = { 0x8229: 1, 0x822b: 2, 0x8051: 4, 0x8058: 4, 0x8c43: 4, 0x8c41: 4, 0x822d: 2, 0x822f: 4, 0x881b: 8, 0x881a: 8, 0x822e: 4, 0x8230: 8, 0x8815: 16, 0x8814: 16,
    0x8c3a: 4, 0x8c3d: 4, 0x8059: 4, 0x8d62: 2, 0x8056: 2, 0x8057: 2, 0x8232: 1, 0x8231: 1, 0x8234: 2, 0x8233: 2, 0x8236: 4, 0x8235: 4, 0x823a: 4, 0x823c: 8, 0x8d7c: 4, 0x8d76: 8,
    0x8d70: 16, 0x8d82: 16, 0x8f94: 1, 0x8f95: 2, 0x8f97: 4, 0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8cad: 8, 0x8d48: 1 };
  const COMP = { 0x1908: 4, 0x1907: 4, 0x190a: 2, 0x1909: 1, 0x1906: 1, 0x1902: 1, 0x84f9: 1, 0x1903: 1 };
  const TYPE = { 0x1401: 1, 0x1400: 1, 0x1403: 2, 0x1402: 2, 0x1405: 4, 0x1404: 4, 0x1406: 4, 0x140b: 2, 0x8d61: 2 };
  const PACKED = { 0x8363: 2, 0x8033: 2, 0x8034: 2, 0x84fa: 4, 0x8368: 4, 0x8c3b: 4, 0x8c3e: 4, 0x8dad: 8 };
  const BLOCK = {}; // compressed: [block w, block h, bytes]
  for (const f of [0x83f0, 0x83f1, 0x8c4c, 0x8c4d, 0x8dbb, 0x8dbc, 0x9270, 0x9271, 0x9274, 0x9275, 0x9276, 0x9277, 0x8d64]) BLOCK[f] = [4, 4, 8];
  for (const f of [0x83f2, 0x83f3, 0x8c4e, 0x8c4f, 0x8dbd, 0x8dbe, 0x8e8c, 0x8e8d, 0x8e8e, 0x8e8f, 0x9272, 0x9273, 0x9278, 0x9279]) BLOCK[f] = [4, 4, 16];
  const ASTC = [[4, 4], [5, 4], [5, 5], [6, 5], [6, 6], [8, 5], [8, 6], [8, 8], [10, 5], [10, 6], [10, 8], [10, 10], [12, 10], [12, 12]];
  ASTC.forEach(([bw, bh], i) => { BLOCK[0x93b0 + i] = [bw, bh, 16]; BLOCK[0x93d0 + i] = [bw, bh, 16]; });
  const texelBytes = (ifmt, format, type) => SIZED[ifmt] ?? (PACKED[type] ?? (COMP[ifmt] ?? COMP[format] ?? 4) * (TYPE[type] ?? 1));
  const imgBytes = (ifmt, w, h, d, format, type) => {
    const b = BLOCK[ifmt];
    if (b) return Math.ceil(w / b[0]) * Math.ceil(h / b[1]) * b[2] * d;
    if (ifmt === 0x8c00 || ifmt === 0x8c02) return Math.max(w, 8) * Math.max(h, 8) / 2 * d;
    if (ifmt === 0x8c01 || ifmt === 0x8c03) return Math.max(w, 16) * Math.max(h, 8) / 4 * d;
    return w * h * d * texelBytes(ifmt, format, type);
  };
  const recs = []; const recOf = new WeakMap();
  const rec = (gl) => { let r = recOf.get(gl); if (!r) { r = { gl, tex: new Map(), rb: new Map(), buf: new Map(), compressed: 0 }; recOf.set(gl, r); recs.push(r); } return r; };
  const texBinding = (gl, target) => {
    if (target === 0x0de1) return gl.getParameter(0x8069);
    if (target === 0x8513 || (target >= 0x8515 && target <= 0x851a)) return gl.getParameter(0x8514);
    if (target === 0x806f) return gl.getParameter(0x806a);
    if (target === 0x8c1a) return gl.getParameter(0x8c1d);
    return null;
  };
  const face = (target) => (target >= 0x8515 && target <= 0x851a ? target - 0x8515 : 0);
  const setLevel = (gl, target, level, info) => {
    const t = texBinding(gl, target); if (!t) return;
    const r = rec(gl); let e = r.tex.get(t); if (!e) { e = new Map(); r.tex.set(t, e); }
    e.set(face(target) * 64 + level, info);
  };
  const srcDims = (s) => s ? [s.naturalWidth || s.videoWidth || s.displayWidth || s.codedWidth || s.width || 0, s.naturalHeight || s.videoHeight || s.displayHeight || s.codedHeight || s.height || 0] : [0, 0];
  const BUF_BIND = { 0x8892: 0x8894, 0x8893: 0x8895, 0x8a11: 0x8a28, 0x8f36: 0x8f36, 0x8f37: 0x8f37, 0x88eb: 0x88ed, 0x88ec: 0x88ef, 0x8c8e: 0x8c8f };
  const hook = (proto) => {
    if (!proto) return;
    const wrap = (name, after) => { const orig = proto[name]; if (typeof orig !== 'function') return; proto[name] = function wrapped(...a) { const r = orig.apply(this, a); try { after(this, a); } catch {} return r; }; };
    wrap('texImage2D', (gl, a) => {
      const [target, level, ifmt] = a; let w, h, format, type;
      if (a.length >= 8) { w = a[3]; h = a[4]; format = a[6]; type = a[7]; } else { format = a[3]; type = a[4]; [w, h] = srcDims(a[5]); }
      setLevel(gl, target, level, { w, h, d: 1, ifmt, format, type, bytes: imgBytes(ifmt, w, h, 1, format, type) });
    });
    wrap('texImage3D', (gl, a) => { const [target, level, ifmt, w, h, d, , format, type] = a; setLevel(gl, target, level, { w, h, d, ifmt, format, type, bytes: imgBytes(ifmt, w, h, d, format, type) }); });
    wrap('copyTexImage2D', (gl, a) => { const [target, level, ifmt, , , w, h] = a; setLevel(gl, target, level, { w, h, d: 1, ifmt, bytes: imgBytes(ifmt, w, h, 1) }); });
    wrap('compressedTexImage2D', (gl, a) => { const [target, level, ifmt, w, h] = a; rec(gl).compressed++; setLevel(gl, target, level, { w, h, d: 1, ifmt, bytes: imgBytes(ifmt, w, h, 1) }); });
    wrap('compressedTexImage3D', (gl, a) => { const [target, level, ifmt, w, h, d] = a; rec(gl).compressed++; setLevel(gl, target, level, { w, h, d, ifmt, bytes: imgBytes(ifmt, w, h, d) }); });
    wrap('texStorage2D', (gl, a) => {
      const [target, levels, ifmt, w, h] = a; if (BLOCK[ifmt]) rec(gl).compressed++;
      const faces = target === 0x8513 ? [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851a] : [target];
      for (const f of faces) for (let l = 0; l < levels; l++) { const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l); setLevel(gl, f === target ? target : f, l, { w: lw, h: lh, d: 1, ifmt, bytes: imgBytes(ifmt, lw, lh, 1) }); }
    });
    wrap('texStorage3D', (gl, a) => {
      const [target, levels, ifmt, w, h, d] = a; if (BLOCK[ifmt]) rec(gl).compressed++;
      for (let l = 0; l < levels; l++) { const lw = Math.max(1, w >> l), lh = Math.max(1, h >> l), ld = target === 0x806f ? Math.max(1, d >> l) : d; setLevel(gl, target, l, { w: lw, h: lh, d: ld, ifmt, bytes: imgBytes(ifmt, lw, lh, ld) }); }
    });
    wrap('generateMipmap', (gl, a) => {
      const [target] = a; const t = texBinding(gl, target); const e = t && rec(gl).tex.get(t); if (!e) return;
      for (const [k, info] of [...e]) {
        if (k % 64 !== 0) continue;
        let { w, h, d } = info; const is3d = target === 0x806f;
        for (let l = 1; w > 1 || h > 1 || (is3d && d > 1); l++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); if (is3d) d = Math.max(1, d >> 1); e.set(k + l, { ...info, w, h, d, bytes: imgBytes(info.ifmt, w, h, d, info.format, info.type) }); }
      }
    });
    wrap('deleteTexture', (gl, a) => { recOf.get(gl)?.tex.delete(a[0]); });
    const rbSet = (gl, samples, ifmt, w, h) => { const b = gl.getParameter(0x8ca7); if (b) rec(gl).rb.set(b, w * h * (SIZED[ifmt] ?? 4) * Math.max(1, samples)); };
    wrap('renderbufferStorage', (gl, a) => { rbSet(gl, 1, a[1], a[2], a[3]); });
    wrap('renderbufferStorageMultisample', (gl, a) => { rbSet(gl, a[1], a[2], a[3], a[4]); });
    wrap('deleteRenderbuffer', (gl, a) => { recOf.get(gl)?.rb.delete(a[0]); });
    wrap('bufferData', (gl, a) => {
      const bind = BUF_BIND[a[0]]; const b = bind && gl.getParameter(bind); if (!b) return;
      const s = a[1]; rec(gl).buf.set(b, typeof s === 'number' ? s : (s && s.byteLength) || 0);
    });
    wrap('deleteBuffer', (gl, a) => { recOf.get(gl)?.buf.delete(a[0]); });
  };
  hook(W.WebGL2RenderingContext && W.WebGL2RenderingContext.prototype);
  hook(W.WebGLRenderingContext && W.WebGLRenderingContext.prototype);
  W.__sc_gl = () => recs.filter((r) => !r.gl.isContextLost()).map((r) => {
    let tex = 0, levels = 0; const per = [];
    for (const e of r.tex.values()) { let b = 0, l0 = null; for (const [k, i] of e) { b += i.bytes; levels++; if (k === 0) l0 = i; } tex += b; per.push([b, l0 ? l0.w + 'x' + l0.h + (l0.d > 1 ? 'x' + l0.d : '') : '?', l0 ? '0x' + l0.ifmt.toString(16) : '?', e.size]); }
    per.sort((a, b) => b[0] - a[0]);
    let rb = 0; for (const v of r.rb.values()) rb += v;
    let buf = 0; for (const v of r.buf.values()) buf += v;
    const c = r.gl.canvas; return { gl: r.gl, canvas: c ? [c.width, c.height] : null, texBytes: tex, textures: r.tex.size, levels, top: per.slice(0, 12), rbBytes: rb, bufBytes: buf, buffers: r.buf.size, compressedUploads: r.compressed };
  });
})();`;

// memory, read in the page: the GL tally (the renderer's context vs any other), a scene traversal estimate, renderer.info
const MEMORY = `(() => {
  const W = window; const world = W.__world; const game = world && world.game; const renderer = game && game.renderer;
  const main = renderer && renderer.getContext ? renderer.getContext() : null;
  const gls = W.__sc_gl ? W.__sc_gl() : [];
  const mine = gls.find((g) => g.gl === main) || gls.reduce((a, b) => (!a || b.texBytes > a.texBytes ? b : a), null);
  const others = gls.filter((g) => g !== mine);
  // scene traversal: every texture a material, uniform, background or environment holds (deduped), sized by its image
  const seen = new Set(); let est = 0, n = 0, compressed = 0;
  const BPT = { 1023: 4, 1022: 4, 1028: 1, 1030: 2, 1021: 1, 1024: 2, 1025: 1, 1026: 4 };
  const TYPE = { 1009: 1, 1010: 1, 1011: 2, 1012: 2, 1013: 4, 1014: 4, 1015: 4, 1016: 2, 1017: 2, 1018: 2, 1020: 4 };
  const sizeOf = (t) => {
    const img = t.image || t.source && t.source.data;
    if (t.isCompressedTexture && t.mipmaps && t.mipmaps.length) { compressed++; let b = 0; for (const m of t.mipmaps) b += m.data ? m.data.byteLength : 0; return b * (t.isCubeTexture ? 6 : 1); }
    const one = Array.isArray(img) ? img[0] : img; if (!one) return 0;
    const w = one.naturalWidth || one.videoWidth || one.width || 0, h = one.naturalHeight || one.videoHeight || one.height || 0, d = one.depth || 1;
    const faces = Array.isArray(img) ? img.length : 1;
    const bpt = (BPT[t.format] ?? 4) * (TYPE[t.type] ?? 1);
    const mips = t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1;
    return w * h * d * faces * bpt * mips;
  };
  const add = (t) => { if (!t || !t.isTexture || seen.has(t)) return; seen.add(t); n++; est += sizeOf(t); };
  const scan = (m) => { if (!m) return; for (const k in m) { const v = m[k]; if (v && v.isTexture) add(v); } if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k] && m.uniforms[k].value; if (u && u.isTexture) add(u); else if (Array.isArray(u)) u.forEach(add); } };
  const scene = game && game.scene;
  if (scene) { add(scene.background); add(scene.environment); scene.traverse((o) => { const m = o.material; if (Array.isArray(m)) m.forEach(scan); else scan(m); }); }
  const info = renderer && renderer.info;
  return {
    glTexBytes: mine ? mine.texBytes : null, glTextures: mine ? mine.textures : null, glRbBytes: mine ? mine.rbBytes : null, glBufBytes: mine ? mine.bufBytes : null,
    glCompressedUploads: mine ? mine.compressedUploads : null, canvas: mine ? mine.canvas : null, glTop: mine ? mine.top : null,
    otherContexts: others.length, otherTexBytes: others.reduce((s, g) => s + g.texBytes + g.rbBytes, 0),
    sceneTexBytes: Math.round(est), sceneTextures: n, sceneCompressed: compressed,
    textures: info ? info.memory.textures : null, geometries: info ? info.memory.geometries : null, programs: info && info.programs ? info.programs.length : null,
    slug: world && world.chunk ? world.chunk.slug : null,
  };
})()`;

// ── browser: Chromium launched by hand so the service worker's fetches can be throttled too (bench-load.mjs) ──
await waitForBrowserSlot();
const { browser, chrome, swThrottle } = await launchBrowser();
children.push(chrome);
await swThrottle(NETS[NET]);

const runs = [];
try {
  for (let run = 1; run <= RUNS; run++) {
    console.error(`\n=== run ${run} / ${RUNS} ===`);
    const r = { run, shards: {}, switches: {}, shots: [] };
    if (!has('no-load') || !has('no-poses')) {
      for (const shard of ONLY_SHARDS) for (const vp of ONLY_VPS) {
        r.shards[`${shard}/${vp}`] = await measureShard(shard, vp, run, r.shots);
      }
    }
    if (!has('no-switch')) for (const vp of ONLY_VPS) r.switches[vp] = await switchRoute(vp);
    runs.push(r);
  }
  // SSIM of every shot against its golden (the first run writes the goldens with --goldens)
  await scoreShots(runs);
  if (RETOUCH) runs[0].retouch = await retouchRow();
} finally {
  await within(browser.close(), 10_000);
  chrome.kill();
  cleanup();
}

// ── rows ──
const result = { tag: TAG, build, url: URL_BASE, at: new Date().toISOString(), host: `${process.platform} ${process.arch} node ${process.version}`, net: NET, cpu: CPU, runs: RUNS, sampleMs: SAMPLE_MS, rows: buildRows(runs), raw: runs };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, `${TAG}.json`), `${JSON.stringify(result, null, 1)}\n`);
let md = renderMarkdown(result);
let exitCode = 0;
if (COMPARE) {
  const { text, regressions } = compareResults(loadResult(COMPARE), result);
  md += `\n${text}`;
  exitCode = regressions > 0 ? 1 : 0;
}
writeFileSync(join(OUT_DIR, `${TAG}.md`), md);
console.log(`\n${md}`);
console.error(`> wrote ${rel(join(OUT_DIR, `${TAG}.json`))} and ${rel(join(OUT_DIR, `${TAG}.md`))}`);
process.exit(exitCode);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// measuring

function pageUrl(shard, vp) { return `${URL_BASE}/?chunk=${shard}&skipintro=1&nolock=1&mute=1&weather=clear&${VIEWPORTS[vp].query}`; }

async function newContext(vp) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vp].ctx, serviceWorkers: 'allow' });
  await ctx.addInitScript(INIT_SCRIPT);
  // every finished request of the context: the page's and the service worker's own fetches, with when it finished
  const log = [];
  const inflight = [];
  ctx.on('requestfinished', (req) => {
    inflight.push((async () => {
      const [sizes, res] = await Promise.all([within(req.sizes(), 5000), within(req.response(), 5000)]);
      log.push({ t: Date.now(), url: req.url(), bySW: req.serviceWorker() !== null, fromSW: Boolean(res?.fromServiceWorker()), body: sizes?.responseBodySize ?? 0, headers: sizes?.responseHeadersSize ?? 0 });
    })());
  });
  const net = {
    log,
    mark: () => log.length,
    settle: () => within(Promise.all(inflight), 10_000),
    lastAt: () => (log.length > 0 ? log[log.length - 1].t : 0),
  };
  return { ctx, net };
}

/** net bytes + page request count of the log slice [from, to) (bench-load's accounting: SW fetches + page responses not served by the SW) */
function account(log, from, to = log.length, until = Infinity) {
  let bytes = 0, requests = 0, swFetches = 0;
  const byType = {};
  for (const r of log.slice(from, to)) {
    if (r.t > until || /^(blob|data):/.test(r.url)) continue;
    const ext = (r.url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? 'html').toLowerCase();
    const n = r.body + r.headers;
    if (r.bySW) { swFetches++; bytes += n; byType[ext] = (byType[ext] ?? 0) + n; continue; }
    requests++;
    if (!r.fromSW && r.body > 0) { bytes += n; byType[ext] = (byType[ext] ?? 0) + n; }
  }
  return { bytes, requests, swFetches, byType };
}

async function throttlePage(ctx, page, preset = NET) {
  const cdp = await ctx.newCDPSession(page);
  const net = NETS[preset];
  if (net) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up }); }
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  return cdp;
}

/** one load to playable: bytes, requests, playMs, the longest task before play */
async function load(ctx, net, url, label, preset = NET) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  page.on('dialog', (d) => { void d.dismiss(); });
  await throttlePage(ctx, page, preset);
  const from = net.mark();
  const t0 = Date.now();
  let status = 'ok';
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: TIMEOUT_MS });
    await page.waitForFunction(() => window.__bench_play > 0, null, { timeout: TIMEOUT_MS, polling: 100 });
    await page.waitForTimeout(1500);
  } catch (e) { status = /Timeout/i.test(String(e)) ? 'timeout' : 'error'; errors.push(String(e.message ?? e).split('\n')[0].slice(0, 200)); }
  const m = await page.evaluate(() => {
    const W = window; const play = W.__bench_play ?? 0;
    const long = (W.__sc_long ?? []).filter((e) => e[2] <= play);
    return { playMs: play > 0 ? play : null, playEpoch: play > 0 ? performance.timeOrigin + play : null, longTaskMaxMs: long.reduce((mx, e) => Math.max(mx, e[1]), 0), longTasks: long.length, swController: navigator.serviceWorker.controller !== null };
  }).catch((e) => { errors.push(`collect: ${e.message}`); return {}; });
  await net.settle();
  const toPlay = account(net.log, from, net.log.length, m.playEpoch ? m.playEpoch + 1500 : Infinity);
  console.error(`  ${label.padEnd(34)} ${status} play ${fmtS(m.playMs)} · ${fmtMB(toPlay.bytes)} MB net · ${toPlay.requests} req · longest ${m.longTaskMaxMs ?? '?'} ms · sw=${m.swController} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return { page, status, errors, from, netBytes: toPlay.bytes, requests: toPlay.requests, swFetches: toPlay.swFetches, byType: toPlay.byType, ...m };
}

/** wait until no request has finished for quietMs (a background prefetch / the SW's precache), at most maxMs */
async function waitQuiet(net, quietMs, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await net.settle();
    if (Date.now() - Math.max(net.lastAt(), t0) >= quietMs) return Date.now() - t0;
    await sleep(500);
  }
  return Date.now() - t0;
}

async function memory(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  try { await cdp.send('HeapProfiler.collectGarbage'); } catch { /* not fatal: the heap reads a little high */ }
  await sleep(300);
  await cdp.send('Performance.enable');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (k) => metrics.find((x) => x.name === k)?.value ?? null;
  const m = await page.evaluate(MEMORY);
  await cdp.detach().catch(() => undefined);
  return { heapBytes: get('JSHeapUsedSize'), heapTotalBytes: get('JSHeapTotalSize'), domNodes: get('Nodes'), ...m };
}

async function measureShard(shard, vp, run, shots) {
  console.error(`> ${shard} / ${vp}`);
  const { ctx, net } = await newContext(vp);
  const out = { shard, vp };
  try {
    const url = pageUrl(shard, vp);
    if (!has('no-4g') && NET !== '4g') {
      // cold time to play on Chrome's "Fast 4G" too (bench.budget.json's condition): a fresh context of its own
      const c4 = await newContext(vp);
      await swThrottle(NETS['4g']);
      try {
        const r4 = await load(c4.ctx, c4.net, url, `${shard}/${vp} cold 4g`, '4g');
        out.cold4g = { status: r4.status, playMs: r4.playMs, netBytes: r4.netBytes, longTaskMaxMs: r4.longTaskMaxMs, errors: r4.errors };
        await within(r4.page.close(), 10_000);
      } finally { await swThrottle(NETS[NET]); await within(c4.ctx.close(), 10_000); }
    }
    const cold = await load(ctx, net, url, `${shard}/${vp} cold`);
    // cold bytes until the network is quiet: the SW's precache, a background prefetch of the other shards
    const quietMs = await waitQuiet(net, 5000, 120_000);
    out.cold = { status: cold.status, errors: cold.errors, playMs: cold.playMs, netBytes: cold.netBytes, requests: cold.requests, swFetches: cold.swFetches, longTaskMaxMs: cold.longTaskMaxMs, longTasks: cold.longTasks, byType: cold.byType, swController: cold.swController,
      idleNetBytes: account(net.log, cold.from).bytes, idleWaitMs: quietMs };
    await within(cold.page.close(), 10_000);
    const warm = await load(ctx, net, url, `${shard}/${vp} warm`);
    out.warm = { status: warm.status, errors: warm.errors, playMs: warm.playMs, netBytes: warm.netBytes, requests: warm.requests, swFetches: warm.swFetches, longTaskMaxMs: warm.longTaskMaxMs, longTasks: warm.longTasks, byType: warm.byType, swController: warm.swController };
    const page = warm.page;
    if (warm.status === 'ok') {
      await sleep(SETTLE_MS);
      out.memory = await memory(ctx, page);
      console.error(`    memory heap ${fmtMB(out.memory.heapBytes)} MB · GL tex ${fmtMB(out.memory.glTexBytes)} MB · rb ${fmtMB(out.memory.glRbBytes)} MB · buf ${fmtMB(out.memory.glBufBytes)} MB · scene tex est ${fmtMB(out.memory.sceneTexBytes)} MB · ${out.memory.textures} tex / ${out.memory.geometries} geo / ${out.memory.programs} programs`);
      if (!has('no-poses')) {
        out.poses = [];
        for (const pose of POSES[shard]) out.poses.push(await measurePose(page, shard, vp, pose, run, shots));
      }
    }
    out.pageErrors = [...new Set([...cold.errors, ...warm.errors])];
    await within(page.close(), 10_000);
  } finally { await within(ctx.close(), 10_000); }
  return out;
}

async function measurePose(page, shard, vp, pose, run, shots) {
  await page.evaluate((p) => {
    const w = window.__world, pl = w.player, s = w.chunk.spawn;
    pl.spawn(p.x ?? s.x, p.z ?? s.z, p.yaw ?? s.yaw);
    pl.pitch = 0;
    pl.velocity?.set(0, 0, 0);
    pl.keys?.clear();
  }, pose);
  await sleep(SETTLE_MS);
  const f = await page.evaluate(async (ms) => {
    const W = window, g = W.__world.game;
    const iv = [], cpu = [], calls = [], tris = [];
    W.__sc_cpuAcc = 0; W.__sc_cpuOn = true;
    let last = performance.now();
    const end = last + ms;
    await new Promise((resolve) => {
      const tick = () => {
        const now = performance.now();
        iv.push(now - last); cpu.push(W.__sc_cpuAcc); W.__sc_cpuAcc = 0; last = now;
        if (g.lastFrame) { calls.push(g.lastFrame.calls); tris.push(g.lastFrame.triangles); }
        if (now >= end) resolve(undefined); else W.__sc_rawRAF(tick);
      };
      W.__sc_rawRAF(tick);
    });
    W.__sc_cpuOn = false;
    iv.shift(); cpu.shift();
    const p = W.__world.player.position;
    return { iv, cpu, calls, tris, pos: [p.x, p.y, p.z] };
  }, SAMPLE_MS);
  const mean = f.iv.reduce((s, v) => s + v, 0) / Math.max(1, f.iv.length);
  const row = {
    name: pose.name, frames: f.iv.length, fps: round(1000 / mean, 1), frameP50Ms: round(pct(f.iv, 0.5), 2), frameP95Ms: round(pct(f.iv, 0.95), 2),
    cpuP50Ms: round(pct(f.cpu, 0.5), 2), cpuP95Ms: round(pct(f.cpu, 0.95), 2), calls: pct(f.calls, 0.5), trisK: round(pct(f.tris, 0.5) / 1000, 1), pos: f.pos.map((v) => round(v, 2)),
  };
  const file = `${shard}-${vp}-${pose.name}.jpg`;
  const dir = GOLDENS && run === 1 ? GOLDEN_DIR : SHOT_DIR;
  mkdirSync(dir, { recursive: true });
  const target = join(dir, RUNS > 1 && !(GOLDENS && run === 1) ? file.replace(/\.jpg$/, `.run${run}.jpg`) : file);
  const buf = await page.screenshot({ type: 'jpeg', quality: 80, scale: 'css' });
  writeFileSync(target, buf);
  row.shot = rel(target);
  row.shotKB = Math.round(buf.length / 1024);
  shots.push({ key: `${shard}/${vp}/${pose.name}`, file: target, golden: join(GOLDEN_DIR, file), run });
  console.error(`    pose ${pose.name.padEnd(7)} ${row.fps} fps · p95 ${row.frameP95Ms} ms · cpu p50/p95 ${row.cpuP50Ms}/${row.cpuP95Ms} ms · ${row.calls} calls · ${row.trisK}k tris · ${row.shotKB} KB`);
  return row;
}

/** the switch route: cold A, then menu → B → menu → C → menu → A; each switch timed from ENTER WORLD to playable */
async function switchRoute(vp) {
  console.error(`> switch route / ${vp}: ${ROUTE.join(' → ')}`);
  const { ctx, net } = await newContext(vp);
  const out = { vp, route: ROUTE, steps: [] };
  try {
    const first = await load(ctx, net, pageUrl(ROUTE[0], vp), `switch ${vp} cold ${ROUTE[0]}`);
    out.first = { playMs: first.playMs, netBytes: first.netBytes, status: first.status };
    out.quietMs = await waitQuiet(net, 5000, 120_000); // a background prefetch of the other shards lands here
    out.prefetchBytes = account(net.log, first.from).bytes - first.netBytes;
    const page = first.page;
    for (let i = 1; i < ROUTE.length; i++) {
      const to = ROUTE[i];
      const step = { from: ROUTE[i - 1], to };
      try {
        await page.evaluate(() => { window.__world?.hud?.exitToMenu(); });
        await page.waitForSelector('.ws-menu-card', { state: 'visible', timeout: 20_000 });
        await sleep(900);
        // pick the card (a DOM click: the deck is a transformed track, the target card can sit outside the viewport)
        const picked = await page.evaluate((name) => {
          const card = [...document.querySelectorAll('.ws-menu-card')].find((e) => e.querySelector('b')?.textContent.trim() === name);
          if (!card) return 'no card';
          card.click();
          return document.querySelector('.ws-menu-card.selected b')?.textContent.trim() ?? 'none selected';
        }, NAMES[to]);
        if (picked !== NAMES[to]) throw new Error(`menu: picked "${picked}", wanted "${NAMES[to]}"`);
        await sleep(700);
        const token = `sc${Date.now()}`;
        await page.evaluate((t) => { window.__sc_doc = t; window.__sc_loadSeen = 0; }, token);
        const from = net.mark();
        const t0 = Date.now();
        // ENTER WORLD (a navigation today: the evaluate may lose its context mid-flight)
        await page.evaluate(() => { document.querySelector('.ws-menu-play')?.click(); }).catch(() => undefined);
        const at = await pollReady(page, to, t0);
        step.ms = at > 0 ? Math.round(at - t0) : null;
        step.status = at > 0 ? 'ok' : 'timeout';
        const st = await page.evaluate(({ tok, t }) => ({ same: window.__sc_doc === tok, loadSeen: window.__sc_loadSeen, long: (window.__sc_long ?? []).filter((e) => e[0] >= t).reduce((m, e) => Math.max(m, e[1]), 0) }), { tok: token, t: t0 });
        step.navigated = !st.same;
        step.loadingShown = st.loadSeen > 0;
        step.longTaskMaxMs = st.long;
        await sleep(Math.max(3000, SETTLE_MS));
        await net.settle();
        step.netBytes = account(net.log, from).bytes;
        const mem = await memory(ctx, page);
        step.heapBytes = mem.heapBytes; step.glTexBytes = mem.glTexBytes; step.glBufBytes = mem.glBufBytes; step.glRbBytes = mem.glRbBytes; step.slug = mem.slug;
      } catch (e) { step.status = 'error'; step.error = String(e.message ?? e).split('\n')[0].slice(0, 200); }
      console.error(`  ${step.from} → ${step.to}: ${step.status} ${fmtS(step.ms)} s · navigated ${step.navigated} · loading screen ${step.loadingShown} · ${fmtMB(step.netBytes)} MB net · longest ${step.longTaskMaxMs} ms · heap ${fmtMB(step.heapBytes)} MB · GL tex ${fmtMB(step.glTexBytes)} MB`);
      out.steps.push(step);
    }
    out.storage = await page.evaluate(async () => { const e = await navigator.storage.estimate(); return { usage: e.usage ?? null, caches: e.usageDetails?.caches ?? null }; }).catch(() => null);
    console.error(`  Cache Storage after the route: ${fmtMB(out.storage?.caches)} MB (usage ${fmtMB(out.storage?.usage)} MB)`);
    await within(page.close(), 10_000);
  } finally { await within(ctx.close(), 10_000); }
  return out;
}

/** poll until the page reports `to` playable after t0 (survives a navigation); the epoch ms it became so, 0 on timeout */
async function pollReady(page, to, t0) {
  while (Date.now() - t0 < TIMEOUT_MS) {
    const at = await page.evaluate((slug) => { const r = window.__sc_ready; return r && r.slug === slug ? r.at : 0; }, to).catch(() => 0);
    if (at > t0) return at;
    await sleep(50);
  }
  return 0;
}

/** SSIM of every shot against its golden, computed in a blank page (7×7 uniform window on luma, like skimage's default) */
async function scoreShots(allRuns) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    for (const r of allRuns) for (const s of r.shots) {
      if (!existsSync(s.golden) || s.file === s.golden) { s.ssim = s.file === s.golden ? 1 : null; continue; }
      const res = await page.evaluate(SSIM_FN, { a: readFileSync(s.golden).toString('base64'), b: readFileSync(s.file).toString('base64') });
      s.ssim = typeof res.ssim === 'number' ? round(res.ssim, 4) : null;
      s.note = res.note;
    }
  } finally { await within(ctx.close(), 10_000); }
}
async function SSIM_FN({ a, b }) {
  const decode = (b64) => { const bin = Uint8Array.from(atob(b64), (c) => c.codePointAt(0) ?? 0); return createImageBitmap(new Blob([bin], { type: 'image/jpeg' })); };
  const [ia, ib] = await Promise.all([decode(a), decode(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { ssim: 0, note: `size ${ia.width}×${ia.height} vs ${ib.width}×${ib.height}` };
  const w = ia.width, h = ia.height, W1 = w + 1;
  const luma = (bm) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, w, h).data; const L = new Float64Array(w * h); for (let i = 0; i < w * h; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; return L; };
  const X = luma(ia), Y = luma(ib);
  const integral = (f) => { const S = new Float64Array(W1 * (h + 1)); for (let r = 0; r < h; r++) { let row = 0; for (let c = 0; c < w; c++) { row += f(r * w + c); S[(r + 1) * W1 + c + 1] = S[r * W1 + c + 1] + row; } } return S; };
  const Sx = integral((i) => X[i]), Sy = integral((i) => Y[i]), Sxx = integral((i) => X[i] * X[i]), Syy = integral((i) => Y[i] * Y[i]), Sxy = integral((i) => X[i] * Y[i]);
  const k = 7, N = k * k, cov = N / (N - 1), C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const box = (S, r, c) => S[(r + k) * W1 + c + k] - S[r * W1 + c + k] - S[(r + k) * W1 + c] + S[r * W1 + c];
  let sum = 0, n = 0;
  for (let r = 0; r + k <= h; r++) for (let c = 0; c + k <= w; c++) {
    const mx = box(Sx, r, c) / N, my = box(Sy, r, c) / N;
    const vx = (box(Sxx, r, c) / N - mx * mx) * cov, vy = (box(Syy, r, c) / N - my * my) * cov, vxy = (box(Sxy, r, c) / N - mx * my) * cov;
    sum += ((2 * mx * my + C1) * (2 * vxy + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2)); n++;
  }
  return { ssim: sum / n, note: null };
}

/** --retouch: build the same tree again with one texture re-encoded; load build A (cold + warm), switch the origin to
 *  build B, and count the bytes it takes until a page runs build B (the service worker's update included). */
async function retouchRow() {
  const src = join(SERVE, 'public', RETOUCH);
  if (!existsSync(src)) { console.error(`--retouch: ${src} not found`); return { error: `no ${RETOUCH}` }; }
  const bDir = join(SERVE, 'dist-retouch');
  if (!existsSync(join(bDir, 'index.html'))) {
    const keep = join(SERVE, '.retouch-original');
    copyFileSync(src, keep);
    try {
      // a real edit of the file's bytes: re-encode it (sips), a different size and hash, the same picture
      execSync(`sips -s format jpeg -s formatOptions 85 "${keep}" --out "${src}"`, { stdio: 'ignore' });
      execSync(`node "${join(SERVE, 'node_modules/vite/bin/vite.js')}" build --outDir dist-retouch`, { cwd: SERVE, stdio: ['ignore', 'ignore', 'inherit'] });
    } finally { copyFileSync(keep, src); }
  }
  const out = { texture: RETOUCH, shard: RETOUCH_SHARD, viewports: {} };
  for (const vp of ONLY_VPS) {
    console.error(`> retouch ${RETOUCH} on ${RETOUCH_SHARD} / ${vp}`);
    preview.kill('SIGTERM'); await sleep(800);
    preview = await startPreview(join(SERVE, 'dist'), PORT);
    const buildA = await buildIdOf(URL_BASE);
    const { ctx, net } = await newContext(vp);
    const row = {};
    try {
      const url = pageUrl(RETOUCH_SHARD, vp);
      const a1 = await load(ctx, net, url, `retouch ${vp} A cold`); await waitQuiet(net, 5000, 120_000); await within(a1.page.close(), 10_000);
      const a2 = await load(ctx, net, url, `retouch ${vp} A warm`); await waitQuiet(net, 3000, 60_000); await within(a2.page.close(), 10_000);
      preview.kill('SIGTERM'); await sleep(800);
      preview = await startPreview(bDir, PORT);
      const buildB = await buildIdOf(URL_BASE);
      const from = net.mark();
      // the returning player: load until the page runs build B (its entry script is B's), the waiting worker adopted
      // the way the build pill does (SKIP_WAITING)
      const entryB = /\/assets\/index-[\w-]+\.js/.exec(readFileSync(join(bDir, 'index.html'), 'utf8'))?.[0] ?? '?';
      let loads = 0, running = '';
      while (loads < 4 && !running.endsWith(entryB)) {
        loads++;
        const p = await load(ctx, net, url, `retouch ${vp} B load ${loads}`);
        await waitQuiet(net, 4000, 90_000);
        running = await p.page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.waiting) {
            // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage takes no target origin
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            await new Promise((resolve) => { setTimeout(resolve, 1500); });
          }
          return [...document.scripts].map((x) => x.src).find((x) => x.includes('/assets/index-')) ?? '';
        }).catch(() => '');
        await within(p.page.close(), 10_000);
      }
      await net.settle();
      const acc = account(net.log, from);
      Object.assign(row, { buildA, buildB, loads, reached: running.endsWith(entryB), netBytes: acc.bytes, byType: acc.byType, biggest: net.log.slice(from).filter((r) => r.body > 0 && !(r.fromSW && !r.bySW)).sort((x, y) => y.body - x.body).slice(0, 5).map((r) => [r.url.replace(URL_BASE, ''), r.body]) });
      console.error(`  re-downloaded ${fmtMB(row.netBytes)} MB over ${loads} load(s) · runs B: ${row.reached} · biggest ${row.biggest.map(([u, b]) => `${u} ${fmtMB(b)}`).join(', ')}`);
    } catch (e) { row.error = String(e.message ?? e).split('\n')[0]; } finally { await within(ctx.close(), 10_000); }
    out.viewports[vp] = row;
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// rows: one flat, named list — what --compare walks

/** row kinds and their tolerance live in scorecard.budget.json `kinds` */
function buildRows(allRuns) {
  const acc = new Map(); // key → { kind, label, values[] }
  const put = (key, kind, label, v) => { if (v === null || v === undefined || Number.isNaN(v)) return; let e = acc.get(key); if (!e) { e = { key, kind, label, values: [] }; acc.set(key, e); } e.values.push(v); };
  for (const r of allRuns) {
    for (const s of Object.values(r.shards)) {
      const p = `${s.shard}/${s.vp}`;
      for (const c of ['cold', 'warm']) {
        const L = s[c]; if (L?.status !== 'ok') continue;
        put(`${p}/${c}.netBytes`, 'bytes', `${c} transfer to play`, L.netBytes);
        put(`${p}/${c}.requests`, 'count', `${c} requests`, L.requests);
        put(`${p}/${c}.playMs`, 'time', `${c} time to play`, L.playMs);
        put(`${p}/${c}.longTaskMaxMs`, 'longtask', `${c} longest task`, L.longTaskMaxMs);
        if (c === 'cold') put(`${p}/cold.idleNetBytes`, 'bytes', 'cold transfer until idle', L.idleNetBytes);
      }
      if (s.cold4g?.status === 'ok') put(`${p}/cold4g.playMs`, 'time', 'cold time to play, Fast 4G', s.cold4g.playMs);
      const m = s.memory;
      if (m) {
        put(`${p}/mem.heapBytes`, 'memory', 'JS heap', m.heapBytes);
        put(`${p}/mem.glTexBytes`, 'memory', 'GPU textures (GL)', m.glTexBytes);
        put(`${p}/mem.glRbBytes`, 'memory', 'GPU renderbuffers (GL)', m.glRbBytes);
        put(`${p}/mem.glBufBytes`, 'memory', 'GPU buffers (GL)', m.glBufBytes);
        put(`${p}/mem.sceneTexBytes`, 'memory', 'scene textures (est)', m.sceneTexBytes);
        put(`${p}/mem.textures`, 'objects', 'renderer textures', m.textures);
        put(`${p}/mem.geometries`, 'objects', 'renderer geometries', m.geometries);
        put(`${p}/mem.programs`, 'objects', 'shader programs', m.programs);
      }
      for (const pose of s.poses ?? []) {
        const q = `${p}/pose.${pose.name}`;
        put(`${q}.fps`, 'fps', `${pose.name} fps`, pose.fps);
        put(`${q}.frameP95Ms`, 'frame', `${pose.name} p95 frame`, pose.frameP95Ms);
        put(`${q}.cpuP50Ms`, 'frame', `${pose.name} main-thread p50`, pose.cpuP50Ms);
        put(`${q}.cpuP95Ms`, 'frame', `${pose.name} main-thread p95`, pose.cpuP95Ms);
        put(`${q}.calls`, 'drawcalls', `${pose.name} draw calls`, pose.calls);
        put(`${q}.trisK`, 'drawcalls', `${pose.name} triangles (k)`, pose.trisK);
      }
    }
    for (const s of r.shots) if (typeof s.ssim === 'number') put(`${s.key.replace(/\/([^/]+)$/, '/pose.$1')}.ssim`, 'ssim', 'SSIM vs golden', s.ssim);
    for (const [vp, sw] of Object.entries(r.switches)) {
      put(`switch/${vp}/prefetchBytes`, 'info', 'bytes after the first play, until idle', sw.prefetchBytes);
      sw.steps.forEach((st, i) => {
        const q = `switch/${vp}/${i + 1}.${st.from}>${st.to}`;
        if (st.status !== 'ok') return;
        put(`${q}.ms`, 'time', 'switch to playable', st.ms);
        put(`${q}.netBytes`, 'bytes', 'switch transfer', st.netBytes);
        put(`${q}.longTaskMaxMs`, 'longtask', 'switch longest task', st.longTaskMaxMs);
        put(`${q}.heapBytes`, 'memory', 'JS heap after', st.heapBytes);
        put(`${q}.glTexBytes`, 'memory', 'GPU textures after', st.glTexBytes);
        put(`${q}.navigated`, 'info', 'page navigated', st.navigated ? 1 : 0);
        put(`${q}.loadingShown`, 'info', 'loading screen shown', st.loadingShown ? 1 : 0);
      });
      if (sw.storage?.caches !== null && sw.storage?.caches !== undefined) put(`switch/${vp}/cacheStorageBytes`, 'bytes', 'Cache Storage after all 3 shards', sw.storage.caches);
    }
    for (const [vp, rt] of Object.entries(r.retouch?.viewports ?? {})) if (typeof rt.netBytes === 'number') put(`retouch/${vp}/netBytes`, 'bytes', `re-download after a one-texture change (${r.retouch.shard})`, rt.netBytes);
  }
  const rows = {};
  for (const e of acc.values()) {
    const v = [...e.values].sort((a, b) => a - b);
    const value = e.kind === 'ssim' ? v[0] : pct(v, 0.5); // SSIM: the worst run; the rest: the median
    const spread = v.length > 1 && value !== 0 ? round((v[v.length - 1] - v[0]) / Math.abs(value), 4) : 0;
    rows[e.key] = { kind: e.kind, label: e.label, value, values: e.values, spread };
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// compare

function compareResults(base, now) {
  const kinds = budget.kinds;
  const rebudget = new Map((budget.rebudget ?? []).map((r) => [r.row, r]));
  const lines = [`## compare · ${now.tag} (${now.build}) against ${base.tag} (${base.build})`, '',
    'Band = max(rel, noise × baseline run-to-run spread) × baseline + abs (scorecard.budget.json `kinds`). REGRESS blocks the merge; `info` rows never fail.', '',
    '| row | baseline | now | Δ | band | verdict |', '|---|---|---|---|---|---|'];
  let regressions = 0, improved = 0, passed = 0;
  const keys = [...new Set([...Object.keys(base.rows), ...Object.keys(now.rows)])].sort();
  for (const key of keys) {
    const b = base.rows[key], n = now.rows[key];
    const kind = (b ?? n).kind, k = kinds[kind] ?? kinds.info;
    const fmt = (v) => fmtKind(v, kind);
    if (!b) { lines.push(`| ${key} | — | ${fmt(n.value)} | | | new |`); continue; }
    if (!n) { const miss = k.check !== false; if (miss) regressions++; lines.push(`| ${key} | ${fmt(b.value)} | — | | | ${miss ? '**MISSING**' : 'missing (info)'} |`); continue; }
    const d = n.value - b.value;
    const delta = b.value !== 0 ? `${d >= 0 ? '+' : ''}${(d / Math.abs(b.value) * 100).toFixed(1)} %` : `${d >= 0 ? '+' : ''}${fmt(d)}`;
    let verdict, band = '';
    const rb = rebudget.get(key);
    if (k.check === false) verdict = 'info';
    else if (rb) {
      const ok = ('max' in rb ? n.value <= rb.max : true) && ('min' in rb ? n.value >= rb.min : true);
      band = `re-budgeted ${'max' in rb ? `≤ ${fmt(rb.max)}` : `≥ ${fmt(rb.min)}`}`;
      verdict = ok ? 'pass (re-budget)' : '**REGRESS**';
    } else if (kind === 'ssim') {
      // ≥ 0.98, or — for a pose that moves on its own (grass in the wind) — the baseline's own run-to-run SSIM less a margin
      const min = round(Math.min(k.min, b.value - (k.margin ?? 0.01)), 4);
      band = `≥ ${min}`;
      verdict = n.value >= min ? 'pass' : '**REGRESS**';
    } else {
      const w = Math.max(k.rel ?? 0, (k.noise ?? 0) * (b.spread ?? 0)) * Math.abs(b.value) + (k.abs ?? 0);
      band = `±${fmt(w)}`;
      const worse = k.better === 'higher' ? -d : d;
      verdict = worse > w ? '**REGRESS**' : worse < -w ? 'better' : 'pass';
    }
    if (verdict === '**REGRESS**') regressions++; else if (verdict === 'better') improved++; else if (verdict.startsWith('pass')) passed++;
    lines.push(`| ${key} | ${fmt(b.value)} | ${fmt(n.value)} | ${delta} | ${band} | ${verdict} |`);
  }
  const rules = rulesTable(base, now);
  lines.push('', `**${regressions} row regression${regressions === 1 ? '' : 's'}**, ${improved} better, ${passed} within the band; **${rules.failed} budget rule${rules.failed === 1 ? '' : 's'} missed**.`, '');
  lines.push(rules.text);
  return { text: lines.join('\n'), regressions: regressions + rules.failed };
}

/** the band a row may move by before it counts (scorecard.budget.json `kinds`) */
function bandOf(b, kind) { const k = budget.kinds[kind] ?? {}; return Math.max(k.rel ?? 0, (k.noise ?? 0) * (b.spread ?? 0)) * Math.abs(b.value) + (k.abs ?? 0); }

/** scorecard.budget.json `rules`: an `enforced` rule fails the compare when a matching row misses it; a `proposed` one
 *  only prints. `goal` is printed beside the verdict (a rule enforced as "no worse" whose target is "improve"). */
function rulesTable(base, now) {
  const lines = ['### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)', '', '| rule | row | baseline | now | limit | verdict |', '|---|---|---|---|---|---|'];
  let failed = 0;
  for (const p of budget.rules ?? []) {
    const enforced = p.status === 'enforced';
    const re = new RegExp(`^${p.rows.split('*').map((s) => s.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`)).join('[^/]*')}$`);
    const keys = Object.keys(now.rows).filter((k) => re.test(k));
    if (keys.length === 0) { lines.push(`| ${p.name} | ${p.rows} | | not measured | | n/a (${enforced ? 'enforced' : p.status}) |`); continue; }
    for (const key of keys) {
      const n = now.rows[key], b = base?.rows[key], kind = n.kind;
      let limit, ok;
      if (p.rule === 'max') { limit = `≤ ${fmtKind(p.max, kind)}`; ok = n.value <= p.max; }
      else if (!b) { limit = 'no baseline'; ok = null; }
      else if (p.rule === 'maxFactor') { limit = `≤ ${p.factor}× = ${fmtKind(b.value * p.factor, kind)}`; ok = n.value <= b.value * p.factor; }
      else if (p.rule === 'noWorse') { limit = `≤ ${fmtKind(b.value + bandOf(b, kind), kind)}`; ok = n.value <= b.value + bandOf(b, kind); }
      else if (p.rule === 'improve') { limit = `< ${fmtKind(b.value - bandOf(b, kind), kind)}`; ok = n.value < b.value - bandOf(b, kind); }
      else { limit = `unknown rule ${p.rule}`; ok = null; }
      if (enforced && ok === false) failed++;
      const goal = p.goal === 'improve' && b ? (n.value < b.value - bandOf(b, kind) ? ' · goal (improve): reached' : ' · goal (improve): not yet') : '';
      const verdict = ok === null ? 'n/a' : enforced ? (ok ? 'pass' : '**FAIL**') : ok ? 'meets (proposed)' : 'misses (proposed)';
      lines.push(`| ${p.name} | ${key} | ${b ? fmtKind(b.value, kind) : '—'} | ${fmtKind(n.value, kind)} | ${limit} | ${verdict}${goal} |`);
    }
  }
  return { text: `${lines.join('\n')}\n`, failed };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// report

function renderMarkdown(res) {
  const R = res.rows;
  const v = (k, kind) => (R[k] ? fmtKind(R[k].value, kind ?? R[k].kind) + (R[k].spread > 0.001 && R[k].values.length > 1 ? ` <small>±${(R[k].spread * 50).toFixed(0)}%</small>` : '') : 'n/a');
  let out = `# scorecard ${res.tag} — build ${res.build}, ${res.at.slice(0, 16).replace('T', ' ')}\n\n`;
  out += `${res.url} · headless Chromium, ANGLE Metal, muted · network ${res.net} (service worker throttled too) · CPU ${res.cpu}× · ${res.runs} run${res.runs > 1 ? 's (median; ±x% = half the run-to-run range)' : ''} · ${res.sampleMs / 1000} s of frames per pose · ${res.host}\n\n`;
  out += '## load\n\n| shard / viewport | cold MB to play | cold req | cold MB until idle | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const s of ONLY_SHARDS) for (const vp of ONLY_VPS) {
    const p = `${s}/${vp}`;
    out += `| ${p} | ${v(`${p}/cold.netBytes`)} | ${v(`${p}/cold.requests`)} | ${v(`${p}/cold.idleNetBytes`)} | ${v(`${p}/cold.playMs`)} | ${v(`${p}/cold4g.playMs`)} | ${v(`${p}/cold.longTaskMaxMs`)} | ${v(`${p}/warm.netBytes`)} | ${v(`${p}/warm.requests`)} | ${v(`${p}/warm.playMs`)} | ${v(`${p}/warm.longTaskMaxMs`)} |\n`;
  }
  out += '\n## memory (warm page, settled, after GC)\n\n| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const s of ONLY_SHARDS) for (const vp of ONLY_VPS) {
    const p = `${s}/${vp}/mem`;
    out += `| ${s}/${vp} | ${v(`${p}.heapBytes`)} | ${v(`${p}.glTexBytes`)} | ${v(`${p}.glRbBytes`)} | ${v(`${p}.glBufBytes`)} | ${v(`${p}.sceneTexBytes`)} | ${v(`${p}.textures`)} | ${v(`${p}.geometries`)} | ${v(`${p}.programs`)} |\n`;
  }
  out += '\n## runtime + look (per pose)\n\n| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |\n|---|---|---|---|---|---|---|\n';
  for (const s of ONLY_SHARDS) for (const vp of ONLY_VPS) for (const pose of POSES[s]) {
    const p = `${s}/${vp}/pose.${pose.name}`;
    out += `| ${s}/${vp}/${pose.name} | ${v(`${p}.fps`)} | ${v(`${p}.frameP95Ms`)} | ${v(`${p}.cpuP50Ms`)} / ${v(`${p}.cpuP95Ms`)} | ${v(`${p}.calls`)} | ${v(`${p}.trisK`)} | ${v(`${p}.ssim`)} |\n`;
  }
  const sw = Object.keys(R).filter((k) => k.startsWith('switch/') && k.endsWith('.ms'));
  if (sw.length > 0) {
    out += '\n## switch route (A → menu → B …, from ENTER WORLD to playable)\n\n| viewport / switch | s | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after |\n|---|---|---|---|---|---|---|---|\n';
    for (const k of sw) {
      const q = k.slice(0, -3);
      const yes = (x) => (R[x] ? (R[x].values.every((y) => y === 1) ? 'yes' : R[x].values.every((y) => y === 0) ? 'no' : 'mixed') : 'n/a');
      out += `| ${q.replace('switch/', '')} | ${v(k)} | ${yes(`${q}.navigated`)} | ${yes(`${q}.loadingShown`)} | ${v(`${q}.netBytes`)} | ${v(`${q}.longTaskMaxMs`)} | ${v(`${q}.heapBytes`)} | ${v(`${q}.glTexBytes`)} |\n`;
    }
    for (const vp of ONLY_VPS) if (R[`switch/${vp}/cacheStorageBytes`]) out += `\n- ${vp}: Cache Storage after all three shards: **${v(`switch/${vp}/cacheStorageBytes`)} MB**; downloaded after the first play until idle: ${v(`switch/${vp}/prefetchBytes`, 'bytes')} MB`;
    out += '\n';
  }
  const rt = Object.keys(R).filter((k) => k.startsWith('retouch/'));
  if (rt.length > 0) {
    out += `\n## one-texture change (${res.raw[0].retouch?.texture})\n\n`;
    for (const k of rt) out += `- ${k}: **${v(k)} MB** re-downloaded by a returning player (${JSON.stringify(res.raw[0].retouch.viewports[k.split('/')[1]]?.biggest ?? [])})\n`;
  }
  if (res.runs > 1) {
    // run-to-run noise per row kind: the spread is (max − min) / median of the runs; the band a compare allows is
    // max(rel, noise × spread) × value + abs (scorecard.budget.json `kinds`)
    out += '\n## noise (run to run)\n\n| kind | rows | median spread | max spread | the noisiest row |\n|---|---|---|---|---|\n';
    const byKind = {};
    for (const [key, row] of Object.entries(R)) if (row.values.length > 1 && row.kind !== 'info') (byKind[row.kind] ??= []).push([row.spread, key]);
    for (const [kind, list] of Object.entries(byKind)) {
      list.sort((a, b) => a[0] - b[0]);
      const worst = list[list.length - 1];
      if (kind === 'ssim') { const lows = Object.entries(R).filter(([, r]) => r.kind === 'ssim').map(([k, r]) => [r.value, k]).sort((a, b) => a[0] - b[0]); out += `| ssim (run 2 vs run 1's golden) | ${lows.length} | ${pct(lows.map((x) => x[0]), 0.5)?.toFixed(4)} | min ${lows[0]?.[0].toFixed(4)} | ${lows[0]?.[1]} |\n`; continue; }
      out += `| ${kind} | ${list.length} | ${(pct(list.map((x) => x[0]), 0.5) * 100).toFixed(1)} % | ${(worst[0] * 100).toFixed(1)} % | ${worst[1]} |\n`;
    }
  }
  const errs = [];
  for (const r of res.raw) for (const s of Object.values(r.shards)) if (s.pageErrors?.length) errs.push(`- run ${r.run} ${s.shard}/${s.vp}: ${s.pageErrors.slice(0, 3).join(' · ')}`);
  if (errs.length > 0) out += `\n### page errors\n\n${errs.join('\n')}\n`;
  out += '\nUnits: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.\n';
  if (!COMPARE) out += `\n${rulesTable(null, res).text}`; // with --compare the verdict (rules included) follows
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// infrastructure

function exportTree(ref) {
  const sha = execSync(`git rev-parse --short=8 ${ref}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `scorecard-${sha}`);
  if (!existsSync(join(dir, 'dist', 'index.html'))) {
    mkdirSync(dir, { recursive: true });
    console.error(`> git archive ${ref} (${sha}) → ${dir}`);
    execSync(`git archive ${sha} | tar -x -C "${dir}"`, { cwd: ROOT, stdio: 'inherit', shell: '/bin/bash' });
    const nm = [join(ROOT, 'node_modules'), resolvePath(ROOT, '../../../node_modules')].find((p) => existsSync(join(p, 'vite')));
    if (!nm) { console.error('no node_modules with vite next to this checkout'); process.exit(2); }
    if (!existsSync(join(dir, 'node_modules'))) symlinkSync(nm, join(dir, 'node_modules'));
    console.error('> vite build');
    execSync(`node "${join(dir, 'node_modules/vite/bin/vite.js')}" build`, { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] });
  } else console.error(`> reusing ${dir}/dist`);
  return dir;
}

async function startPreview(distDir, port) {
  // vite itself, not `npx vite`: killing an npx wrapper leaves the server holding the port. --outDir picks the build.
  const root = resolvePath(distDir, '..');
  const vite = join(root, 'node_modules/vite/bin/vite.js');
  let listening = false, exited = null;
  const p = spawn(process.execPath, [vite, 'preview', '--port', String(port), '--strictPort', '--outDir', distDir], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  // oxlint-disable-next-line no-control-regex -- stripping vite's ANSI colours (it bolds the port number)
  p.stdout.on('data', (d) => { if (String(d).replaceAll(/\u001B\[[\d;]*m/g, '').includes(`:${port}/`)) listening = true; });
  p.stderr.on('data', (d) => { process.stderr.write(`[preview] ${d}`); });
  p.on('exit', (code) => { exited = code ?? 'signal'; });
  children.push(p);
  await waitFor(() => { if (exited !== null) throw new Error(`vite preview exited (${exited}) — port ${port} taken?`); return listening; }, 20_000, 'vite preview did not come up');
  await waitFor(async () => (await fetch(`http://localhost:${port}/version.json`)).ok, 20_000, 'vite preview did not serve version.json');
  return p;
}

async function buildIdOf(base) {
  try { return (await (await fetch(`${base}/version.json`, { cache: 'no-store' })).json()).build ?? 'unknown'; } catch { return 'unknown'; }
}

function freePort(start) {
  const tryPort = (p) => new Promise((resolve) => { const s = createServer(); s.once('error', () => resolve(false)); s.listen(p, () => { s.close(() => resolve(true)); }); });
  return (async () => { for (let p = start; p < start + 50; p++) if (await tryPort(p)) return p; throw new Error('no free port'); })();
}

/** AGENTS.md: at most 3 headless browsers machine-wide — wait for a slot (the browser processes, not their helpers) */
async function waitForBrowserSlot() {
  for (let i = 0; ; i++) {
    let n;
    try { n = execSync('ps -axo command', { encoding: 'utf8' }).split('\n').filter((l) => /(chrome-headless-shell|Chromium|Google Chrome for Testing)/.test(l) && l.includes('--headless') && !l.includes('--type=')).length; } catch { n = 0; }
    if (n < 3) return;
    if (i % 6 === 0) console.error(`> ${n} headless browsers running; waiting for a slot (AGENTS.md: at most 3)`);
    await sleep(10_000);
  }
}

async function launchBrowser() {
  const udd = mkdtempSync(join(tmpdir(), 'wildshard-scorecard-'));
  const chromeProc = spawn(chromium.executablePath(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-features=BackForwardCache', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(udd, 'DevToolsActivePort');
  await waitFor(() => existsSync(portFile) && Number(readFileSync(portFile, 'utf8').split('\n')[0]) > 0, 15_000, 'chromium did not open its DevTools port');
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  let id = 0; const pending = new Map(); const swSessions = new Set(); let current = null;
  const send = (method, params, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const apply = (sessionId) => (current ? send('Network.emulateNetworkConditions', { offline: false, latency: current.latency, downloadThroughput: current.down, uploadThroughput: current.up }, sessionId) : send('Network.disable', {}, sessionId));
  const onMessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result); return; }
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      if (targetInfo.type === 'service_worker' && targetInfo.url.startsWith('http://localhost')) {
        swSessions.add(sessionId);
        try { await send('Network.enable', {}, sessionId); await apply(sessionId); } catch (e) { console.error(`  [sw throttle] ${e.message}`); }
      }
      send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => undefined);
    }
    if (m.method === 'Target.detachedFromTarget') swSessions.delete(m.params.sessionId);
  };
  ws.addEventListener('message', (ev) => { void onMessage(ev); });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const cdpBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  // a closed context's worker session may never answer (no detach event reached us): bound each send, drop the dead ones
  const throttle = async (net) => {
    current = net;
    for (const s of swSessions) { // deleting the current entry of a Set while iterating it is safe
      const ok = await within(apply(s).then(() => true, () => false), 3000);
      if (ok !== true) swSessions.delete(s);
    }
  };
  return { browser: cdpBrowser, chrome: chromeProc, swThrottle: throttle };
}

// ── util ──
function pct(xs, p) { const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b); if (v.length === 0) return null; if (p === 0.5 && v.length % 2 === 0) return (v[v.length / 2 - 1] + v[v.length / 2]) / 2; return v[Math.min(v.length - 1, Math.floor(v.length * p))]; }
function round(v, d) { return typeof v === 'number' ? Math.round(v * 10 ** d) / 10 ** d : v; }
function fmtMB(b, d = 2) { return typeof b === 'number' ? (b / 1048576).toFixed(d) : 'n/a'; }
function fmtS(ms) { return typeof ms === 'number' ? (ms / 1000).toFixed(2) : 'n/a'; }
function fmtKind(v, kind) {
  if (typeof v !== 'number') return 'n/a';
  if (kind === 'bytes' || kind === 'memory') return fmtMB(v);
  if (kind === 'time') return fmtS(v);
  if (kind === 'ssim') return v.toFixed(4);
  if (kind === 'frame' || kind === 'fps') return v.toFixed(1);
  return String(Math.round(v * 10) / 10);
}
function rel(p) { return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p; }
function sleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
function within(p, ms) { return Promise.race([Promise.resolve(p).catch(() => null), new Promise((resolve) => { setTimeout(resolve, ms, null).unref(); })]); }
async function waitFor(fn, ms, msg) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return; } catch (e) { if (String(e.message).includes('exited')) throw e; } await sleep(250); } throw new Error(msg); }
