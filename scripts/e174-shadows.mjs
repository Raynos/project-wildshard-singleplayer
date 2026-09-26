#!/usr/bin/env node
// e174-shadows.mjs — Driftwood's phone shadow maps, variant by variant (E174; src/world/shadowVariants.ts).
//
//   memory   a fresh load per variant (the saved Debug pick, so the boot path): every GL texture the page allocates, by
//            size and format (the scorecard's tally: texImage / texStorage / deleteTexture), after the world settles
//   frames   one page, the loop held (`game.frameGate`) at each pose: every variant switched LIVE on the same frozen frame
//            (sky.shadowMaps.apply, the Debug picker's own path), so a screenshot differs only by its shadows. Per variant
//            and pose: a device-pixel PNG, the GPU ms a frame (pine-hollow-gpu.mjs's throughput clock: 12 composer frames
//            back to back, one real sync, ÷ 12; rounds alternate the variants so the box's drift cancels), and the rAF
//            frame p50 / p95 with the loop running (vsync-pinned headless: 60 fps says little)
//   sanity   GL errors after every switch, and the page's console errors
//
//   node scripts/e174-shadows.mjs --url=http://localhost:4417 --out=/tmp/e174 [--poses=pier,planks] [--no-memory]
//
// Serve a build with `vite preview`. One headless Chromium on Metal, muted, closed at the end. Writes <out>/result.json and
// <out>/<pose>-<variant>.png. The board: scripts/e174-board.py.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const has = (name) => argv.includes(`--${name}`);
const URL_BASE = flag('url', 'http://localhost:4417');
const OUT = flag('out', '/tmp/e174');
const VARIANTS = ['a', 'b', 'c', 'd'];
const ROUNDS = Number(flag('rounds', '6'));
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
mkdirSync(OUT, { recursive: true });

// the scorecard's three Driftwood poses (scripts/scorecard.mjs POSES) + two where the shadows are the picture; `time` is the
// Debug ▸ Time of day hold (the scorecard pins midday), `pitch` looks down (rad)
const ALL_POSES = [
  { name: 'pier', time: 'midday' },
  { name: 'beach', x: -10, z: -150, yaw: 4.3, time: 'midday' },
  { name: 'wreck', x: 105, z: 0, yaw: -1.5708, time: 'midday' },
  { name: 'planks', time: 'golden', pitch: -0.55 },
  // palm fronds' shadows on the sand at your feet (the near cascade, 0–7 m) and the rocks' behind
  { name: 'palms', x: 17, z: -138, yaw: 2.7, time: 'golden', pitch: -0.45 },
  // the beach at golden hour: the driftwood's shadow near, the fence and the jetty in the far cascade (22–80 m)
  { name: 'shore', x: 25, z: -134, yaw: 1.16, time: 'golden', pitch: -0.3 },
];
const want = flag('poses', '');
const POSES = ALL_POSES.filter((p) => want === '' || want.split(',').includes(p.name));

const INIT = (variant) => `(() => {
  try { const k = 'ws.settings.v1'; const cur = JSON.parse(localStorage.getItem(k) || '{}'); Object.assign(cur, { time: 'midday', weather: 'clear', prefetch: 'off', dwShadows: '${variant}' }); localStorage.setItem(k, JSON.stringify(cur)); } catch {}
  let seed = 0x2545f491 >>> 0;
  Math.random = function random() { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // GPU texture bytes at the WebGL API (the scorecard's tally, textures only): per texture, level 0's size + format
  const SIZED = { 0x8229: 1, 0x822b: 2, 0x8051: 4, 0x8058: 4, 0x8c43: 4, 0x881b: 8, 0x881a: 8, 0x822e: 4, 0x8230: 8, 0x8814: 16, 0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8cad: 8, 0x8c3a: 4, 0x822d: 2, 0x822f: 4 };
  const BLOCK = {}; for (let i = 0; i < 14; i++) { BLOCK[0x93b0 + i] = 1; BLOCK[0x93d0 + i] = 1; }
  const ASTC = [[4, 4], [5, 4], [5, 5], [6, 5], [6, 6], [8, 5], [8, 6], [8, 8], [10, 5], [10, 6], [10, 8], [10, 10], [12, 10], [12, 12]];
  const bytes = (ifmt, w, h, d, type) => {
    const a = ifmt >= 0x93b0 && ifmt < 0x93be ? ASTC[ifmt - 0x93b0] : ifmt >= 0x93d0 && ifmt < 0x93de ? ASTC[ifmt - 0x93d0] : null;
    if (a) return Math.ceil(w / a[0]) * Math.ceil(h / a[1]) * 16 * d;
    if (ifmt === 0x83f0 || ifmt === 0x83f1 || ifmt === 0x8c4c || ifmt === 0x8c4d || ifmt === 0x9274 || ifmt === 0x9275) return Math.ceil(w / 4) * Math.ceil(h / 4) * 8 * d;
    if (ifmt === 0x83f2 || ifmt === 0x83f3 || ifmt === 0x8e8c || ifmt === 0x8e8d || ifmt === 0x9278) return Math.ceil(w / 4) * Math.ceil(h / 4) * 16 * d;
    return w * h * d * (SIZED[ifmt] ?? (type === 0x1406 ? 16 : type === 0x140b ? 8 : 4));
  };
  const tex = new Map(); window.__e174tex = tex;
  const bound = (gl, target) => target === 0x0de1 ? gl.getParameter(0x8069) : target === 0x806f ? gl.getParameter(0x806a) : target === 0x8c1a ? gl.getParameter(0x8c1d) : (target === 0x8513 || (target >= 0x8515 && target <= 0x851a)) ? gl.getParameter(0x8514) : null;
  const put = (gl, target, level, info) => { const t = bound(gl, target); if (!t) return; let e = tex.get(t); if (!e) { e = new Map(); tex.set(t, e); } e.set((target >= 0x8515 && target <= 0x851a ? target - 0x8515 : 0) * 64 + level, info); };
  for (const proto of [WebGL2RenderingContext.prototype]) {
    const wrap = (name, after) => { const orig = proto[name]; proto[name] = function wrapped(...a) { const r = orig.apply(this, a); try { after(this, a); } catch {} return r; }; };
    wrap('texImage2D', (gl, a) => { if (a.length < 8) { const s = a[5]; const w = s?.naturalWidth || s?.videoWidth || s?.width || 0, h = s?.naturalHeight || s?.videoHeight || s?.height || 0; put(gl, a[0], a[1], { w, h, ifmt: a[2], b: bytes(a[2], w, h, 1, a[4]) }); return; } put(gl, a[0], a[1], { w: a[3], h: a[4], ifmt: a[2], b: bytes(a[2], a[3], a[4], 1, a[7]) }); });
    wrap('texImage3D', (gl, a) => { put(gl, a[0], a[1], { w: a[3], h: a[4], d: a[5], ifmt: a[2], b: bytes(a[2], a[3], a[4], a[5], a[8]) }); });
    wrap('compressedTexImage2D', (gl, a) => { put(gl, a[0], a[1], { w: a[3], h: a[4], ifmt: a[2], b: bytes(a[2], a[3], a[4], 1) }); });
    wrap('texStorage2D', (gl, a) => { const faces = a[0] === 0x8513 ? [0x8515, 0x8516, 0x8517, 0x8518, 0x8519, 0x851a] : [a[0]]; for (const f of faces) for (let l = 0; l < a[1]; l++) { const w = Math.max(1, a[3] >> l), h = Math.max(1, a[4] >> l); put(gl, f, l, { w, h, ifmt: a[2], b: bytes(a[2], w, h, 1) }); } });
    wrap('texStorage3D', (gl, a) => { for (let l = 0; l < a[1]; l++) { const w = Math.max(1, a[3] >> l), h = Math.max(1, a[4] >> l); put(gl, a[0], l, { w, h, d: a[5], ifmt: a[2], b: bytes(a[2], w, h, a[5]) }); } });
    wrap('generateMipmap', (gl, a) => { const t = bound(gl, a[0]); const e = t && tex.get(t); const l0 = e && e.get(0); if (!l0) return; let w = l0.w, h = l0.h; for (let l = 1; w > 1 || h > 1; l++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); e.set(l, { ...l0, w, h, b: bytes(l0.ifmt, w, h, l0.d || 1) }); } });
    wrap('deleteTexture', (gl, a) => { tex.delete(a[0]); });
  }
  window.__e174mem = () => {
    let total = 0; const shadow = []; const top = [];
    for (const e of tex.values()) { let b = 0; for (const i of e.values()) b += i.b; total += b; const l0 = e.get(0); if (!l0) continue; const row = [b, l0.w + 'x' + l0.h, '0x' + l0.ifmt.toString(16)]; top.push(row); if (l0.w === l0.h && l0.w >= 1024 && (l0.ifmt === 0x81a5 || l0.ifmt === 0x81a6 || l0.ifmt === 0x8058)) shadow.push(row); }
    top.sort((x, y) => y[0] - x[0]);
    return { total, shadow, top: top.slice(0, 16) };
  };
})();`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio', '--ignore-gpu-blocklist'] });
const result = { url: URL_BASE, at: new Date().toISOString(), memory: {}, poses: {}, errors: [] };
const newPage = async (variant) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT(variant));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('E174')) result.errors.push(`[${variant}] ${m.type()}: ${m.text().slice(0, 300)}`); });
  // (serviceWorkers: 'block' leaves the page's worker registration undefined: its "reading 'waiting'" error is that)
  page.on('pageerror', (e) => { if (!e.message.includes("reading 'waiting'")) result.errors.push(`[${variant}] pageerror: ${e.message}`); });
  await page.goto(`${URL_BASE}/?chunk=driftwood-isle&skipintro=1&nolock=1&mute=1&weather=clear&touch=1&tier=phone`);
  await page.waitForFunction(() => { const w = window.__world; return Boolean(w?.chunk && w.game && w.sky) && document.querySelector('.ws-load') === null; }, null, { timeout: 240_000, polling: 500 });
  await page.evaluate(() => { const a = window.__world?.animals; if (a) a.calm = true; });
  await sleep(6000);
  return { ctx, page };
};

try {
  // ── memory: a fresh load per variant ──
  if (!has('no-memory')) for (const v of VARIANTS) {
    const { ctx, page } = await newPage(v);
    const m = await page.evaluate(() => ({ ...window.__e174mem(), variant: window.__world.sky.shadowMaps?.variant ?? null, canvas: [window.__world.game.renderer.domElement.width, window.__world.game.renderer.domElement.height] }));
    result.memory[v] = m;
    console.error(`memory ${v}: GL textures ${(m.total / 2 ** 20).toFixed(1)} MiB · shadow maps ${m.shadow.map((s) => `${s[1]} ${s[2]}`).join(', ')} · running ${m.variant}`);
    await ctx.close();
  }

  // ── frames: one page, every variant live on the same frozen frame ──
  const { ctx, page } = await newPage('a');
  await page.evaluate(() => {
    const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext();
    const px = new Uint8Array(4);
    const P = {};
    window.__e174 = P;
    P.render = () => { g.composer.render(1 / 60); };
    P.sync = () => { r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(true, false, false); r.setScissorTest(false); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    P.throughput = (k) => { P.render(); P.sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) P.render(); P.sync(); return (performance.now() - t0) / k; };
    P.hold = (on) => { g.frameGate = on ? () => false : () => true; };
    P.set = (v) => { w.sky.shadowMaps.apply(v); w.sky.warmShadows(); P.render(); P.render(); const e = gl.getError(); return e; };
    P.mem = () => window.__e174mem();
  });
  for (const pose of POSES) {
    console.error(`> pose ${pose.name}`);
    await page.evaluate((p) => {
      const w = window.__world, pl = w.player, s = w.chunk.spawn;
      window.__e174.hold(false);
      w.sky.shadowMaps.apply('a');
      // the Time of day hold (Settings ▸ Debug): through the menu's own setter is not reachable here, so the clock's
      w.sky.dayNight?.setTime?.(p.time);
      pl.spawn(p.x ?? s.x, p.z ?? s.z, p.yaw ?? s.yaw);
      const ph = w.physics;
      if (ph?.R) {
        const x = pl.position.x, z = pl.position.z, top = pl.position.y + 2.5;
        const hit = ph.world.castRay(new ph.R.Ray({ x, y: top, z }, { x: 0, y: -1, z: 0 }), 2.6, true, ph.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => c.parent()?.isFixed() ?? true);
        if (hit) pl.position.y = Math.max(pl.position.y, top - hit.timeOfImpact);
        pl.prevFeet?.copy(pl.position);
      }
      pl.pitch = p.pitch ?? 0;
      pl.velocity?.set(0, 0, 0);
      pl.keys?.clear();
    }, pose);
    await sleep(5000);
    // rAF frame times, loop running, per variant (live switch, 3 s settle, 4 s sample)
    const raf = {};
    for (const v of VARIANTS) {
      raf[v] = await page.evaluate(async (vv) => {
        window.__world.sky.shadowMaps.apply(vv);
        await new Promise((resolve) => { setTimeout(resolve, 3000); }); // a live switch stalls the next second or two on Metal (new maps)
        const iv = []; let last = performance.now(); const end = last + 4000;
        await new Promise((resolve) => { const tick = () => { const n = performance.now(); iv.push(n - last); last = n; if (n >= end) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        iv.shift(); iv.sort((x, y) => x - y);
        return { p50: iv[Math.floor(iv.length * 0.5)], p95: iv[Math.floor(iv.length * 0.95)], frames: iv.length };
      }, v);
    }
    // hold the frame; each variant on it: screenshot, GL error, memory; then the GPU clock in alternating rounds
    await page.evaluate(() => { window.__world.sky.shadowMaps.apply('a'); window.__e174.hold(true); });
    await sleep(300);
    const rows = {};
    for (const v of VARIANTS) {
      const r = await page.evaluate((vv) => { const e = window.__e174.set(vv); const m = window.__e174.mem(); return { glError: e, texMiB: m.total / 2 ** 20, shadow: m.shadow }; }, v);
      await sleep(250);
      const file = join(OUT, `${pose.name}-${v}.png`);
      await page.screenshot({ path: file, type: 'png', scale: 'device' });
      rows[v] = { ...r, shot: file, raf: raf[v], gpu: [] };
    }
    for (let k = 0; k < ROUNDS; k++) for (const v of k % 2 === 0 ? VARIANTS : [...VARIANTS].reverse()) {
      const ms = await page.evaluate((vv) => { window.__e174.set(vv); for (let i = 0; i < 10; i++) window.__e174.render(); window.__e174.sync(); return window.__e174.throughput(12); }, v);
      rows[v].gpu.push(ms);
    }
    for (const v of VARIANTS) {
      const g = [...rows[v].gpu].sort((x, y) => x - y);
      rows[v].gpuMs = g[Math.floor(g.length / 2)];
      console.error(`  ${v}: gpu ${rows[v].gpuMs.toFixed(2)} ms/frame · raf p50/p95 ${rows[v].raf.p50.toFixed(1)}/${rows[v].raf.p95.toFixed(1)} · tex ${rows[v].texMiB.toFixed(1)} MiB · glError ${rows[v].glError}`);
    }
    result.poses[pose.name] = rows;
    await page.evaluate(() => { window.__world.sky.shadowMaps.apply('a'); window.__e174.hold(false); });
  }
  await ctx.close();
} finally {
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 1));
  await browser.close();
}
if (result.errors.length > 0) console.error(`page errors:\n  ${result.errors.slice(0, 20).join('\n  ')}`);
