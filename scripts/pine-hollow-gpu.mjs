#!/usr/bin/env node
// pine-hollow-gpu.mjs — where Pine Hollow's GPU milliseconds go, per pass and per group, per pose (E142, the heavy FPS lane).
//
// The draw-call and triangle rulers (pine-hollow-perf.mjs / -drawcalls.mjs) count work; a headless page is vsync-pinned,
// so its frame time says nothing about the GPU. This one times the GPU:
//
//   GPU ms/frame — the game's loop is paused (`game.frameGate`) at the pose and the tool draws the frozen frame itself:
//     12 composer frames back to back in one task, then a 1-pixel readPixels of the canvas (a real GPU sync), wall time
//     ÷ 12; the median of several rounds. Stable to ~2 % and it scales with the pixel count (the stones at pixel ratio
//     1 / 2 / 4: 1.34 / 1.89 / 4.12 ms). What does NOT work on ANGLE Metal: EXT_disjoint_timer_query_webgl2 is exposed but
//     over-reads (3.5 ms for that 1.9 ms frame, 25–40 ms once cut per pass — it grows with every command-buffer split, so
//     no per-pass timeline from it), and gl.finish() does not wait for the GPU (1.0 ms at any resolution). Throughput
//     bottoms out at the CPU's submit time (`cpu`, printed beside it): a frame that reads ≈ its submit is CPU-bound here.
//   SUBTRACT (per pass, per group) — tile-based GPUs (every iPhone, the M5 too) shade a pass's pixels at its end, so the
//     honest per-thing number is what the frame saves without it: base and toggled rounds alternate (the GPU is shared
//     with every browser on the box; drift cancels) and the medians' difference is the cost. Passes: `shadow` (the
//     cascade redraw), `depthcopy` (WorldRenderPass's world-depth copy), `chain` (the whole colour chain pass: march +
//     god rays + bloom + the fused grade), its effects one at a time (`vol` the volumetric march + composite, `godrays`,
//     `bloom`, `chroma`, `vignette`, `tone`, `saturation`, `contrast`, `grade` (split-tone), `lut`, `grain`), `smaa` (its
//     pass), `alpha-tested` (every alphaTest material), and the groups (`group:forest-cards` the needle cards,
//     `forest-far` impostors, `forest-bark`, `forest-twigs`, `undergrowth`, `grass`, `terrain`, `water`, `cabins` …).
//     `null` switches nothing: it is the A/B's own noise floor.
//   OVERDRAW — every visible material swapped in place (restored after) to add a constant 1/255 into one channel with no
//     depth test, into an RGBA8 target of the drawing buffer's size: R = opaque, G = alpha-tested (alphaTest > 0: foliage
//     cards, grass), B = transparent. `layers` keeps the alpha test (what survives the discard); `raster` switches it off
//     (every fragment the GPU rasterises and shades before it can discard — the alpha-tested cost). Mean / p50 / p95 /
//     max layers per pixel, and a heat map JPEG of the raster total (`--heat=<dir>`).
//
// The device: iPhone 16 Pro, 402×874 CSS px @3 (the 1206×2622 screen); the game renders at min(3, the tier's dpr) —
// phone dpr 2 → 804×1748. `--size=390x844` (the older rulers' viewport) / `--dpr=` / `--tier=desktop` change it.
//
//   node scripts/pine-hollow-gpu.mjs --url=http://localhost:4391 --tag=baseline
//   node scripts/pine-hollow-gpu.mjs --url=… --poses=stones --subtract=shadow,vol,group:forest-cards --overdraw=0
//   node scripts/pine-hollow-gpu.mjs --url=… --heat=/path/to/dir      # + a heat map JPEG per pose
//
// Serve a clean `git archive HEAD` export with `vite preview` (never the shared dev server). One headless Chromium on
// Metal (`--use-angle=metal`), muted, closed at the end. Writes progress/pine-hollow-gpu-<tag>.json, prints tables.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4391');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const TIER = flag('tier', 'phone');
const SETTLE = Number(flag('settle', '7')) * 1000;
const ROUNDS = Number(flag('rounds', '12'));
/** a pixel ratio to draw at instead of the game's (3 = the iPhone's native 1206×2622): more fill per frame keeps the M5 GPU-bound */
const SCALE = flag('scale', '');
/** '1' = every toggle, '0' = none, else a comma list of toggle names */
const SUBTRACT = flag('subtract', '1');
const OVERDRAW = flag('overdraw', '1') !== '0';
const HEAT = flag('heat', '');
const [VW, VH] = flag('size', TIER === 'phone' ? '402x874' : '1600x900').split('x').map(Number);
const DPR = Number(flag('dpr', TIER === 'phone' ? '3' : '1'));
/** the shard (E189: `--chunk=driftwood-isle` times Driftwood's phone frame with its own poses) */
const CHUNK = flag('chunk', 'pine-hollow');
/** yaw faces (-sin yaw, -cos yaw); +z is north, +x is west on the map */
const DRIFTWOOD_POSES = [
  // the spawn on the pier, facing the island (E189: Jake's standing-still reading, 111 calls · 395 k tris)
  { id: 'pier', x: 0, z: -205, yaw: 3.1416 },
  // the cove's sand under the crag and the rope ladder, facing N into the cover (Jake's 23:32 reading)
  { id: 'cove', x: 0, z: -150, yaw: 3.1416 },
  // the interior grass and ground cover (stutter-run.mjs's waypoints), facing E and N
  { id: 'interior', x: -20, z: 20, yaw: -1.5708 },
  { id: 'flank', x: -70, z: -40, yaw: 3.1416 },
];
const PINE_POSES = [
  { id: 'gate', x: 0, z: -200, yaw: 3.1416 },
  // the Hollow's pine grove N of the crossroads, facing N up the bowl
  { id: 'hollow', x: 6, z: 4, yaw: 2.8 },
  // Jake's spot (E142): inside the King's standing stones, facing W into the old-growth giants past the ring
  { id: 'stones', x: 140, z: -30, yaw: -1.5708 },
  { id: 'oldgrowth', x: 118, z: -118, yaw: 3.6 },
  { id: 'pond', x: -56, z: 95, yaw: 3.1416 },
  // the fire lookout's south catwalk facing down the zipline over the Hollow
  { id: 'lookout', x: 35.53, z: 211.14, yaw: 0.1635, y: 57.46 },
];
const POSES = (CHUNK === 'driftwood-isle' ? DRIFTWOOD_POSES : PINE_POSES).filter((p) => flag('poses', '') === '' || flag('poses', '').split(',').includes(p.id));

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** in the page, once: the probe (window.__gpu) — the throughput clock, the toggles, the groups */
function installProbe() {
  const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext(), composer = g.composer;
  const P = {};
  window.__gpu = P;
  P.render = () => { const t0 = performance.now(); composer.render(1 / 30); return performance.now() - t0; };
  const px = new Uint8Array(4);
  // the sync: a fresh 1-px write to the canvas, then read it back. The write matters — ANGLE only waits on a read whose
  // source has work pending, so with the last pass switched off (SMAA, which draws to the canvas) a bare readPixels
  // returned at once and the frame "saved" 0.94 ms of GPU it never waited for
  P.sync = () => {
    r.setRenderTarget(null);
    r.setScissor(0, 0, 1, 1); r.setScissorTest(true);
    r.clear(true, false, false);
    r.setScissorTest(false);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  };
  /** GPU ms per frame: k frames back to back, one real sync, ÷ k (one frame first, off the clock: a toggle's program switch) */
  P.throughput = (k) => {
    P.render(); P.sync();
    const t0 = performance.now();
    for (let i = 0; i < k; i++) P.render();
    P.sync();
    return (performance.now() - t0) / k;
  };
  P.cpuSubmit = (k) => { P.sync(); const a = []; for (let i = 0; i < k; i++) a.push(P.render()); P.sync(); a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 0; };

  // ── toggles: name → (on) => void, `on` = switched off ──
  P.toggles = new Map();
  P.toggles.set('null', () => undefined);
  P.toggles.set('shadow', (on) => { r.shadowMap.autoUpdate = !on; r.shadowMap.needsUpdate = false; });
  const effName = (e) => {
    const n = (e.name ?? e.constructor?.name ?? 'effect').replace(/Effect$/, '').toLowerCase();
    return ({ volumetrics: 'vol', huesaturation: 'saturation', brightnesscontrast: 'contrast', chromaticaberration: 'chroma', tonemapping: 'tone', lut3d: 'lut', noise: 'grain' })[n] ?? n;
  };
  composer.passes.forEach((pass, i) => {
    const effects = Array.isArray(pass.effects) ? pass.effects : [];
    if (i === 0) {
      // WorldRenderPass reads the composer's stable depth target through its `composer`: an empty stand-in = no copy
      const real = pass.composer;
      if (real !== undefined) P.toggles.set('depthcopy', (on) => { pass.composer = on ? {} : real; });
      return;
    }
    if (/N8AO/i.test(pass.constructor?.name ?? '')) { P.toggles.set('ao', (on) => { pass.enabled = !on; }); return; }
    if (effects.some((e) => effName(e) === 'smaa')) { P.toggles.set('smaa', (on) => { pass.enabled = !on; }); return; }
    if (effects.length === 0) return;
    P.toggles.set('chain', (on) => { pass.enabled = !on; });
    for (const e of effects) {
      const up = e.update, n = effName(e), bf = e.blendMode.blendFunction;
      let off = false;
      e.update = function update(...a) { return off ? undefined : up.apply(this, a); };
      // DST (1): EffectPass leaves the effect out of the fused shader; the blend mode's change event recompiles the pass
      // (the program is cached after the first switch)
      P.toggles.set(n, (on) => { off = on; e.blendMode.blendFunction = on ? 1 : bf; });
    }
  });

  // ── groups: object → the __world key that owns it (BFS, shallowest path wins; pine-hollow-drawcalls.mjs's rule) ──
  const labels = new Map(), seen = new Set();
  const queue = Object.keys(w).filter((k) => k !== 'game' && k !== 'registry' && k !== 'physics').map((k) => [w[k], k, 0]);
  while (queue.length > 0) {
    const [v, path, depth] = queue.shift();
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (v.isObject3D === true) { if (!labels.has(v)) labels.set(v, path); if (v === g.scene) continue; }
    if (v.isMaterial === true || v.isBufferGeometry === true || v.isTexture === true || v instanceof Node || depth >= 3) continue;
    if (Array.isArray(v)) { for (let i = 0; i < Math.min(v.length, 400); i++) queue.push([v[i], `${path}[]`, depth + 1]); continue; }
    if (v instanceof Map) { for (const x of v.values()) queue.push([x, `${path}{}`, depth + 1]); continue; }
    for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch { continue; } if (x !== null && typeof x === 'object') queue.push([x, `${path}.${k}`, depth + 1]); }
  }
  const F = w.forest?.factory;
  const GROUPS = [
    ['terrain', /^terrain/], ['undergrowth', /^under/], ['grass', /^grass/], ['props', /^props/], ['cabins', /^cabin/],
    ['animals', /^(animals|wildlife)/], ['water', /^(water|streams|pond)/], ['sky', /^(sky|horizon)/], ['particles', /^particles/],
    ['viewmodel', /^(crossbow|hands|camera|weapons)/], ['crags', /crag/i], ['boundary', /^boundary/], ['landmarks', /^(lookout|pineLife|landmark)/],
  ];
  P.groupOf = (o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (F !== undefined && m !== undefined) {
      if (m === F.needleMaterial) return 'forest-cards';
      if (m === F.farMaterial) return 'forest-far';
      if (m === F.barkMaterial) return 'forest-bark';
      if (m === F.twigMaterial) return 'forest-twigs';
    }
    for (let p = o; p !== null; p = p.parent) {
      const l = labels.get(p);
      if (l !== undefined) { const hit = GROUPS.find(([, re]) => re.test(l)); return hit ? hit[0] : `other:${l.split(/[.[{]/)[0]}`; }
      if (p === g.camera) return 'viewmodel';
    }
    return 'other:scene';
  };
  P.meshes = () => { const out = []; g.scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh || o.isBatchedMesh || o.isPoints || o.isLine) && o.visible) out.push(o); }); return out; };
  P.groups = () => { const m = new Map(); for (const o of P.meshes()) { const k = P.groupOf(o); const l = m.get(k) ?? []; l.push(o); m.set(k, l); } return m; };
  P.alphaTested = () => P.meshes().filter((o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return m !== undefined && m.alphaTest > 0; });
}

/** in the page: `rounds` × 12-frame throughput → { p20 (the number: other GPU clients only add time), p50, p10, p90 } GPU ms per frame + the CPU submit */
async function runBase(rounds) {
  const P = window.__gpu, all = [];
  const nf = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); });
  P.throughput(4); // warm-up
  for (let i = 0; i < rounds; i++) { all.push(P.throughput(12)); await nf(); }
  all.sort((x, y) => x - y);
  const at = (f) => all[Math.min(all.length - 1, Math.floor(all.length * f))] ?? 0;
  return { p20: at(0.2), p50: at(0.5), p10: at(0.1), p90: at(0.9), n: all.length, cpu: P.cpuSubmit(8) };
}

/** in the page: base and toggled rounds alternate → { base, off, delta } medians (ms per frame) */
async function runAB([name, n]) {
  const P = window.__gpu;
  let toggle = P.toggles.get(name);
  if (toggle === undefined && name === 'alpha-tested') { const l = P.alphaTested(); toggle = (on) => { for (const o of l) o.visible = !on; }; }
  if (toggle === undefined && name.startsWith('group:')) { const l = P.groups().get(name.slice(6)) ?? []; toggle = (on) => { for (const o of l) o.visible = !on; }; }
  if (toggle === undefined) return null;
  const nf = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); });
  const base = [], off = [];
  try {
    for (let i = 0; i < n; i++) {
      toggle(false); base.push(P.throughput(12)); await nf();
      toggle(true); off.push(P.throughput(12)); await nf();
    }
  } finally { toggle(false); }
  // contention from other GPU clients only ever ADDS time: each side is read at its 20th percentile (its quiet rounds)
  const low = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.2)] ?? 0; };
  return { base: low(base), off: low(off), delta: low(base) - low(off), n };
}

/** in the page: overdraw — layers per pixel per channel (R opaque, G alpha-tested, B transparent), with / without the alpha test */
function overdraw(wantHeat) {
  const w = window.__world, g = w.game, r = g.renderer, P = window.__gpu;
  const W = r.domElement.width, H = r.domElement.height;
  const RT = g.composer.inputBuffer.constructor; // THREE.WebGLRenderTarget (no THREE global in the page)
  const rt = new RT(W, H, { depthBuffer: true });
  rt.texture.colorSpace = '';
  const mats = new Map();
  const meshes = P.meshes().filter((o) => (o.renderOrder ?? 0) < 999 && P.groupOf(o) !== 'viewmodel');
  const hidden = [];
  g.scene.traverse((o) => { if (o.visible && (o.renderOrder >= 999 || P.groupOf(o) === 'viewmodel') && o.isMesh) hidden.push(o); });
  for (const o of meshes) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m && !mats.has(m)) mats.set(m, null);
  const channel = (m) => (m.transparent ? 2 : m.alphaTest > 0 ? 1 : 0);
  const patch = (keepAlpha) => {
    for (const m of mats.keys()) {
      const saved = mats.get(m) ?? { obc: m.onBeforeCompile, key: m.customProgramCacheKey, blending: m.blending, bs: m.blendSrc, bd: m.blendDst, be: m.blendEquation, bsa: m.blendSrcAlpha, bda: m.blendDstAlpha, bea: m.blendEquationAlpha, dt: m.depthTest, dw: m.depthWrite, at: m.alphaTest, pa: m.premultipliedAlpha, cw: m.colorWrite };
      mats.set(m, saved);
      const c = channel(m), v = ['0.0', '0.0', '0.0']; v[c] = '1.0';
      m.onBeforeCompile = function onBeforeCompile(s, rr) {
        saved.obc.call(this, s, rr);
        const fs = s.fragmentShader, end = fs.lastIndexOf('}');
        const named = fs.match(/out\s+(?:highp\s+|mediump\s+)?vec4\s+(\w+)/);
        const out = /gl_FragColor/.test(fs) || named === null ? 'gl_FragColor' : named[1];
        s.fragmentShader = `${fs.slice(0, end)}\n  ${out} = vec4(${v.join(', ')}, 0.0) / 255.0;\n}\n`;
      };
      m.customProgramCacheKey = function customProgramCacheKey() { return `${saved.key.call(this)}|od${c}${keepAlpha ? 'k' : 'r'}`; };
      // CustomBlending (5), AddEquation (100), OneFactor (201) both ways: every fragment adds its channel
      m.blending = 5; m.blendEquation = 100; m.blendSrc = 201; m.blendDst = 201; m.blendEquationAlpha = 100; m.blendSrcAlpha = 201; m.blendDstAlpha = 201;
      m.depthTest = false; m.depthWrite = false; m.premultipliedAlpha = false; m.colorWrite = true;
      if (!keepAlpha) m.alphaTest = 0;
      m.needsUpdate = true;
    }
  };
  const restore = () => {
    for (const [m, s] of mats) {
      if (s === null) continue;
      m.onBeforeCompile = s.obc; m.customProgramCacheKey = s.key; m.blending = s.blending; m.blendSrc = s.bs; m.blendDst = s.bd; m.blendEquation = s.be;
      m.blendSrcAlpha = s.bsa; m.blendDstAlpha = s.bda; m.blendEquationAlpha = s.bea; m.depthTest = s.dt; m.depthWrite = s.dw; m.alphaTest = s.at; m.premultipliedAlpha = s.pa; m.colorWrite = s.cw;
      m.needsUpdate = true;
    }
  };
  const colorOwner = [...mats.keys()].find((m) => m.color !== undefined);
  const clearC = colorOwner ? r.getClearColor(colorOwner.color.clone()) : null;
  const bg = g.scene.background, autoSh = r.shadowMap.autoUpdate, clearA = r.getClearAlpha();
  const pass = (keepAlpha) => {
    patch(keepAlpha);
    g.scene.background = null; r.shadowMap.autoUpdate = false;
    for (const o of hidden) o.visible = false;
    const prev = r.getRenderTarget(), ac = r.autoClear;
    try {
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, true, true);
      r.autoClear = false;
      r.render(g.scene, g.camera);
    } finally {
      r.autoClear = ac; r.setRenderTarget(prev);
      for (const o of hidden) o.visible = true;
      g.scene.background = bg; r.shadowMap.autoUpdate = autoSh;
      if (clearC !== null) r.setClearColor(clearC, clearA); else r.setClearAlpha(clearA);
    }
    const out = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, out);
    return out;
  };
  const stats = (buf) => {
    const n = W * H, chans = [0, 1, 2, 3].map(() => new Uint32Array(256));
    for (let i = 0; i < n; i++) {
      const a = buf[i * 4] ?? 0, b = buf[i * 4 + 1] ?? 0, c = buf[i * 4 + 2] ?? 0;
      chans[0][a]++; chans[1][b]++; chans[2][c]++; chans[3][Math.min(255, a + b + c)]++;
    }
    const sum = (h) => {
      let mean = 0, acc = 0, p50 = -1, p95 = -1, max = 0, over4 = 0;
      for (let v = 0; v < 256; v++) { const k = h[v]; if (k === 0) continue; mean += v * k; acc += k; max = v; if (p50 < 0 && acc >= n * 0.5) p50 = v; if (p95 < 0 && acc >= n * 0.95) p95 = v; if (v > 4) over4 += k; }
      return { mean: Number((mean / n).toFixed(2)), p50, p95, max, over4: Number((over4 / n).toFixed(3)) };
    };
    return { opaque: sum(chans[0]), alpha: sum(chans[1]), transparent: sum(chans[2]), total: sum(chans[3]) };
  };
  let kept, raster, heat = null;
  try {
    kept = pass(true);
    raster = pass(false);
  } finally { restore(); rt.dispose(); }
  if (wantHeat) {
    // the raster total at half size: 0 black · 1 blue · 2 cyan · 4 green · 8 yellow · 16 red · 32+ white
    const cw = Math.round(W / 2), ch = Math.round(H / 2);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(cw, ch);
    const ramp = [[0, 0, 0, 0], [1, 20, 40, 160], [2, 0, 150, 200], [4, 20, 190, 60], [8, 240, 220, 30], [16, 230, 40, 20], [32, 255, 255, 255]];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((H - 1 - y * 2) * W + x * 2) * 4; // GL rows are bottom-up
      const v = (raster[si] ?? 0) + (raster[si + 1] ?? 0) + (raster[si + 2] ?? 0);
      let k = 0; while (k < ramp.length - 1 && (ramp[k + 1]?.[0] ?? 0) <= v) k++;
      const a = ramp[k] ?? [0, 0, 0, 0], b = ramp[Math.min(ramp.length - 1, k + 1)] ?? a;
      const f = b[0] === a[0] ? 0 : Math.min(1, (v - a[0]) / (b[0] - a[0]));
      const di = (y * cw + x) * 4;
      img.data[di] = a[1] + (b[1] - a[1]) * f; img.data[di + 1] = a[2] + (b[2] - a[2]) * f; img.data[di + 2] = a[3] + (b[3] - a[3]) * f; img.data[di + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    heat = cv.toDataURL('image/jpeg', 0.8);
  }
  return { w: W, h: H, layers: stats(kept), raster: stats(raster), heat };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { tag: TAG, url: URL_BASE, query: EXTRA, tier: TIER, viewport: `${VW}x${VH}@${DPR}`, scale: SCALE, when: new Date().toISOString(), rows: [] };
const f2 = (x) => (x === undefined ? '—' : x.toFixed(2));
try {
  const iphone = devices['iPhone 16 Pro'];
  const ctxOpts = TIER === 'phone'
    ? { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: DPR, viewport: { width: VW, height: VH } }
    : { viewport: { width: VW, height: VH }, deviceScaleFactor: DPR };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const p0 = POSES[0];
  const q = [`chunk=${CHUNK}`, 'mute=1', 'skipintro=1', 'nolock=1', 'sw=0', `tier=${TIER}`, TIER === 'phone' ? 'touch' : '', `x=${p0.x}`, `z=${p0.z}`, `yaw=${p0.yaw}`, EXTRA].filter(Boolean).join('&');
  const t0 = Date.now();
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: 300000, polling: 500 });
  console.error(`[gpu] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await sleep(SETTLE);
  await page.evaluate(installProbe);
  if (SCALE !== '') await page.evaluate((pr) => { const g = window.__world.game; g.renderer.setPixelRatio(pr); g.resize(); }, Number(SCALE));
  const env = await page.evaluate(() => {
    const g = window.__world.game, gl = g.renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?', buffer: `${g.renderer.domElement.width}x${g.renderer.domElement.height}`, pixelRatio: g.renderer.getPixelRatio() };
  });
  out.env = env;
  console.log(`[gpu] ${env.gpu} · drawing buffer ${env.buffer} (pixel ratio ${env.pixelRatio}) · query ${EXTRA === '' ? '—' : EXTRA}`);
  for (const p of POSES) {
    // the game's own loop runs while the pose settles (LOD buckets, streaming), then stops drawing; the tool draws the frozen frame
    await page.evaluate((pp) => {
      const w = window.__world;
      if (window.__gpuGate !== undefined) w.game.frameGate = window.__gpuGate;
      w.player.spawn(pp.x, pp.z, pp.yaw); w.player.pitch = 0; if (pp.y !== undefined) w.player.position.y = pp.y;
    }, p);
    await sleep(SETTLE);
    await page.evaluate(() => { const g = window.__world.game; window.__gpuGate ??= g.frameGate; g.frameGate = () => false; });
    await sleep(300);
    const base = await page.evaluate(runBase, ROUNDS * 2);
    const draws = await page.evaluate(() => { const g = window.__world.game; return { calls: g.lastFrame.calls, tris: g.lastFrame.triangles }; });
    const row = { pose: p.id, gpu: base.p20, gpuP50: base.p50, gpuP10: base.p10, gpuP90: base.p90, cpu: base.cpu, ...draws, subtract: {}, overdraw: null };
    console.log(`\n${p.id}: GPU ${base.p20.toFixed(2)} ms/frame (p20; p50 ${base.p50.toFixed(2)} · p90 ${base.p90.toFixed(2)}) · cpu submit ${base.cpu.toFixed(2)} ms · ${draws.calls} calls · ${(draws.tris / 1e6).toFixed(2)} M tris`);
    if (SUBTRACT !== '0') {
      const all = await page.evaluate(() => ['null', ...window.__gpu.toggles.keys(), 'alpha-tested', ...[...window.__gpu.groups().keys()].filter((k) => k !== 'viewmodel').map((k) => `group:${k}`)]);
      const names = SUBTRACT === '1' ? [...new Set(all)] : ['null', ...SUBTRACT.split(',')];
      for (const name of names) {
        const ab = await page.evaluate(runAB, [name, ROUNDS]);
        if (ab !== null) row.subtract[name] = ab;
      }
      const sub = Object.entries(row.subtract).sort((x, y) => y[1].delta - x[1].delta);
      console.log(`  saves when off (ms): ${sub.map(([k, v]) => `${k.replace('group:', '')} ${v.delta.toFixed(2)}`).join(' · ')}`);
    }
    if (OVERDRAW) {
      const od = await page.evaluate(overdraw, HEAT !== '');
      if (od.heat !== null) {
        mkdirSync(HEAT, { recursive: true });
        writeFileSync(resolvePath(HEAT, `overdraw-${TAG}-${p.id}.jpg`), Buffer.from(od.heat.split(',')[1], 'base64'));
      }
      delete od.heat;
      row.overdraw = od;
      const L = od.layers, R = od.raster;
      console.log(`  overdraw ${od.w}×${od.h}, layers/px mean (p95): opaque ${L.opaque.mean} (${L.opaque.p95}) · alpha-tested kept ${L.alpha.mean} (${L.alpha.p95}), rasterised ${R.alpha.mean} (${R.alpha.p95}) · transparent ${L.transparent.mean} · total rasterised ${R.total.mean} (p95 ${R.total.p95}, max ${R.total.max}, > 4 layers: ${(R.total.over4 * 100).toFixed(0)} % of px)`);
    }
    out.rows.push(row);
  }
  if (errors.length > 0) console.error(`page errors: ${errors.join(' | ')}`);
  out.errors = errors;
  await ctx.close();
} finally {
  await browser.close();
}
// the summary table (markdown, for E142.md): the frame, then what each pass / group saves when it is off
const cols = ['null', 'shadow', 'depthcopy', 'chain', 'vol', 'godrays', 'bloom', 'lut', 'grade', 'smaa', 'alpha-tested', 'group:forest-cards', 'group:forest-far', 'group:forest-bark', 'group:forest-twigs', 'group:grass', 'group:undergrowth', 'group:terrain', 'group:water']
  .filter((c) => out.rows.some((r) => r.subtract[c] !== undefined));
const lines = [
  `| pose | GPU ms/frame | cpu submit | ${cols.map((c) => c.replace('group:', '')).join(' | ')} | alpha-tested layers (raster) | all layers (raster) |`,
  `|---|---:|---:|${cols.map(() => '---:').join('|')}|---:|---:|`,
];
for (const r of out.rows) lines.push(`| ${r.pose} | ${r.gpu.toFixed(2)} | ${r.cpu.toFixed(2)} | ${cols.map((c) => f2(r.subtract[c]?.delta)).join(' | ')} | ${r.overdraw?.raster.alpha.mean ?? '—'} | ${r.overdraw?.raster.total.mean ?? '—'} |`);
console.log(`\n${lines.join('\n')}`);
out.table = lines.join('\n');
const file = resolvePath(ROOT, `progress/${CHUNK === 'pine-hollow' ? 'pine-hollow' : 'driftwood'}-gpu-${TAG}.json`);
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`→ ${file}`);
