// SF69 probe: the floor's desktop setup (1440x900 @2, desktop tier, fps auto, Developer on), grid entered by the title tap,
// then timing at a pose with experiments.
//   scripts/browser-lane.sh node progress/shard-platform/sf69/probe.mjs --url=<serve-build base> [--pose=spawn|grid-crossroads|grid-deck-north|grid-deck-east|template]
//     [--n=240] [--settle=3000] [--dev=0] [--chunk=<slug> (standalone)] [--nosample=1] [--exp=gpu,gpupass,cands,prof,cpuprof,alloc,pixdiff,noao,notransp,set:<game field>=0|1,...]
import { chromium } from 'playwright';
import { saveFixtureCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url'), exps = arg('exp', '').split(',').filter(Boolean), poseName = arg('pose', 'spawn'), n = Number(arg('n', '240'));
const chunk = arg('chunk', '');
const POSES = { 'pine-cabin': { name: 'pine-cabin', x: -14, y: 2.11, z: -62, yaw: Math.PI, pitch: 0 }, 'template': { name: 'template', x: 547, y: 2, z: 530, yaw: Math.PI * 0.9, pitch: -0.1 }, 'grid-crossroads': { name: 'grid-crossroads', x: 240, y: 6, z: 240, yaw: -Math.PI * 0.75, pitch: -0.12 }, 'grid-deck-north': { name: 'grid-deck-north', x: 0, y: 3, z: 262, yaw: Math.PI, pitch: -0.05 }, 'grid-deck-east': { name: 'grid-deck-east', x: 277.5, y: 1.7, z: -40, yaw: 0, pitch: -0.08 } };
const fixture = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'desktop', fps: 'auto', ...Object.fromEntries(arg('set','').split(',').filter(Boolean).map(kv => kv.split('='))) }, merge: true }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: arg('dev', '1') !== '0' }),
].join(';');
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { base, pose: poseName };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript({ content: `${fixture};window.__wildshardHarness={seed:357,capture:null};` });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  if (chunk) {
    await page.goto(`${base}/?chunk=${chunk}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.game !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240_000 });
  } else {
    await page.goto(`${base}/?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ws-main-grid').click({ timeout: 240_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && window.__wildshard.world?.game?.app?.state !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  }
  await page.waitForTimeout(4000);
  const spawn = await page.evaluate(() => { const w = window.__wildshard.world; return { name: 'spawn', x: w.player.position.x, y: w.player.position.y, z: w.player.position.z, yaw: w.player.yaw, pitch: w.player.pitch }; });
  out.spawn = spawn;
  const pose = poseName === 'spawn' ? spawn : POSES[poseName];
  await page.evaluate(p => window.__wildshard.pose(p), pose);
  await page.waitForTimeout(Number(arg('settle', '3000')));
  out.afterPose = await page.evaluate(async () => { const g = window.__wildshard.world.game, f0 = g.frameCount, t0 = performance.now(); while (g.frameCount - f0 < 60 && performance.now() - t0 < 60000) await new Promise(r => setTimeout(r, 200)); return { frames: g.frameCount - f0, ms: Math.round(performance.now() - t0), inside: window.__wildshard.shard?.grid?.state().inside ?? null, loading: Boolean(document.querySelector('.ws-load')) }; });
  // per-pass CPU timing + per-frame breakdown
  await page.evaluate(() => {
    const g = window.__wildshard.world.game, c = g.composer;
    window.__sf69 = { pass: new Map(), rec: false };
    for (const p of c.passes) {
      const name = p.name || p.constructor.name; const orig = p.render.bind(p);
      p.render = (...a) => { const t = performance.now(); window.__sf69.cur = name; try { return orig(...a); } finally { if (window.__sf69.rec) { const m = window.__sf69.pass; m.set(name, (m.get(name) ?? 0) + performance.now() - t); } } };
    }
  });
  const sample = (n) => page.evaluate((n) => new Promise((resolve) => {
    const g = window.__wildshard.world.game; let count = g.frameCount, first = true, last = 0;
    const iv = [], work = [], upd = [], ren = [], calls = [], passes = [];
    window.__sf69.rec = true;
    const tick = (ts) => {
      if (g.frameCount !== count) {
        if (!first) { iv.push(ts - last); const i = (g.frameI + 119) % 120; work.push(g.workMs[i]); upd.push(g.updateMs[i]); ren.push(g.renderMs[i]); calls.push(g.lastFrame.calls); passes.push(Object.fromEntries([...window.__sf69.pass].map(([k, v]) => [k, Math.round(v * 10) / 10]))); }
        window.__sf69.pass.clear();
        first = false; count = g.frameCount; last = ts;
      }
      if (iv.length < n) { requestAnimationFrame(tick); return; }
      window.__sf69.rec = false;
      const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
      const keys = Object.keys(passes.at(-1) ?? {});
      const passP = Object.fromEntries(keys.map(k => [k, [pct(passes.map(p => p[k] ?? 0), 0.5), pct(passes.map(p => p[k] ?? 0), 0.95)]]));
      const xs = iv.map((x, i) => x > 20 ? i : -1).filter(i => i >= 0);
      resolve({ p50iv: pct(iv, 0.5), p95iv: pct(iv, 0.95), over20: xs.length, work50: pct(work, 0.5), work95: pct(work, 0.95), upd50: pct(upd, 0.5), upd95: pct(upd, 0.95), ren50: pct(ren, 0.5), ren95: pct(ren, 0.95), calls: [Math.min(...calls), Math.max(...calls)], passP,
        gaps: xs.slice(1).map((x, i) => x - xs[i]).join(','),
        xWork: xs.slice(0, 8).map(i => [Math.round(work[i] * 10) / 10, Math.round(upd[i] * 10) / 10, Math.round(ren[i] * 10) / 10, Math.round((work[i - 1] ?? 0) * 10) / 10]) });
    };
    requestAnimationFrame(tick);
  }), n);
  out.state = await page.evaluate(() => { const g = window.__wildshard.world.game; return { programs: g.renderer.info.programs.length, passes: g.composer.passes.map(p => `${p.name || p.constructor.name}:${p.enabled}`), size: [g.renderer.domElement.width, g.renderer.domElement.height] }; });
  if (arg('nosample', '') !== '1') out.base0 = await sample(n);
  for (const e of exps) {
    if (e.startsWith('set:')) { const [k, v] = e.slice(4).split('='); await page.evaluate(([k, v]) => { window.__wildshard.world.game[k] = v === '1'; }, [k, v]); await page.waitForTimeout(1000); out[e] = await sample(n); continue; }
    if (e === 'base') { out[`base${Object.keys(out).length}`] = await sample(n); continue; }
    if (e === 'noao') await page.evaluate(() => { for (const p of window.__wildshard.world.game.composer.passes) if (/N8AO/u.test(p.constructor.name) || p.configuration?.aoRadius !== undefined) p.enabled = false; });
    if (e === 'ao') await page.evaluate(() => { for (const p of window.__wildshard.world.game.composer.passes) if (p.configuration?.aoRadius !== undefined) p.enabled = true; });
    if (e === 'notransp') await page.evaluate(() => { for (const p of window.__wildshard.world.game.composer.passes) if (p.configuration?.aoRadius !== undefined) { p.__rt = p.renderTransparency; p.renderTransparency = () => {}; } });
    if (e === 'transp') await page.evaluate(() => { for (const p of window.__wildshard.world.game.composer.passes) if (p.__rt) p.renderTransparency = p.__rt; });
    if (e === 'gl') {
      out.gl = await page.evaluate(() => new Promise((resolve) => {
        const g = window.__wildshard.world.game, gl = g.renderer.getContext(), proto = Object.getPrototypeOf(gl), counts = {}, saved = {};
        for (const k of Object.getOwnPropertyNames(proto)) { const d = Object.getOwnPropertyDescriptor(proto, k); if (typeof d?.value !== 'function') continue; saved[k] = gl[k]; gl[k] = function (...a) { counts[k] = (counts[k] ?? 0) + 1; return saved[k].apply(this, a); }; }
        const start = g.frameCount;
        const check = () => { if (g.frameCount - start < 120) { requestAnimationFrame(check); return; } for (const k of Object.keys(saved)) delete gl[k]; resolve(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / (g.frameCount - start)).toFixed(2)]).sort((a, b) => b[1] - a[1]))); };
        requestAnimationFrame(check);
      }));
      continue;
    }
    if (e === 'gpu' || e === 'gpupass') {
      out[e] = await page.evaluate((perPass) => new Promise((resolve) => {
        const g = window.__wildshard.world.game, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) { resolve('no ext'); return; }
        const targets = perPass ? g.composer.passes.map((p) => [p.name || p.constructor.name, p]) : [['frame', g.composer]];
        const pending = [], ms = new Map(), restore = [];
        for (const [name, obj] of targets) {
          const orig = obj.render; restore.push(() => { obj.render = orig; });
          obj.render = function (...a) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); try { return orig.apply(this, a); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push([name, q]); } };
        }
        let frames = 0; const start = g.frameCount;
        const poll = () => {
          while (pending.length > 0 && gl.getQueryParameter(pending[0][1], gl.QUERY_RESULT_AVAILABLE)) { const [name, q] = pending.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { if (!ms.has(name)) ms.set(name, []); ms.get(name).push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); } gl.deleteQuery(q); }
          frames = g.frameCount - start;
          if (frames < 240) { requestAnimationFrame(poll); return; }
          for (const r of restore) r();
          const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
          resolve(Object.fromEntries([...ms].map(([k, v]) => [k, [pct(v, 0.5), pct(v, 0.95), v.length]])));
        };
        requestAnimationFrame(poll);
      }), e === 'gpupass');
      continue;
    }
    if (e === 'cands') {
      out.cands = await page.evaluate(() => {
        const g = window.__wildshard.world.game, cam = g.camera, T = cam.projectionMatrix.constructor;
        const m4 = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
        const fr = new (Object.getPrototypeOf(g.camera).constructor === Object ? Object : window.__sf69Frustum ?? Object)();
        void fr; void T;
        const rows = []; let visible = 0, mats = 0;
        g.rootScene.traverseVisible((o) => {
          visible++;
          const m = o.material; if (m === undefined) return; mats++;
          const arr = Array.isArray(m);
          const pass2 = arr ? m.some(x => x.transparent) : (m.transparent && m.depthWrite && o.userData.treatAsOpaque !== true);
          const pass1 = !!o.userData.cannotReceiveAO || (!arr && m.transparent && !m.depthWrite && o.userData.treatAsOpaque !== true);
          if (pass1 || pass2) rows.push({ name: o.name || o.type, type: o.type, pass2, pass1, layers: o.layers.test(cam.layers), fc: o.frustumCulled, mat: arr ? 'array' : (m.name || m.type), parent: o.parent?.name || o.parent?.type });
        });
        void m4;
        return { visible, mats, n: rows.length, rows: rows.slice(0, 40) };
      });
      continue;
    }
    if (e === 'prof') {
      out.prof = await page.evaluate(() => new Promise((resolve) => {
        const g = window.__wildshard.world.game, r = g.renderer, acc = {}, restore = [];
        const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined);
        const wrap = (obj, k, label) => { const o = obj[k]; restore.push(() => { obj[k] = o; }); obj[k] = function (...a) { if (window.__sf69.cur !== 'Pass') return o.apply(this, a); const t = performance.now(); try { return o.apply(this, a); } finally { acc[label] = (acc[label] ?? 0) + performance.now() - t; } }; };
        wrap(r, 'setRenderTarget', 'setRT'); wrap(r, 'clear', 'clear'); wrap(r, 'render', 'render'); if (ao.depthCopyPass) wrap(ao.depthCopyPass, 'render', 'copy');
        wrap(ao, 'renderTransparency', 'prepassTotal');
        const gl = r.getContext(); for (const k of ['texSubImage2D','texImage2D','bindFramebuffer','framebufferTexture2D','clear','drawArrays','drawElements','useProgram','invalidateFramebuffer','getParameter','getError','checkFramebufferStatus','readPixels','blitFramebuffer','uniform1i','bindTexture']) { const o = gl[k]; if (typeof o !== 'function') continue; const fn = o.bind(gl); restore.push(() => { delete gl[k]; }); gl[k] = (...a) => { if (window.__sf69.cur !== 'Pass') return fn(...a); const t = performance.now(); try { return fn(...a); } finally { acc['gl.' + k] = (acc['gl.' + k] ?? 0) + performance.now() - t; acc['n.' + k] = (acc['n.' + k] ?? 0) + 1; } }; }
        const start = g.frameCount;
        const done = () => { if (g.frameCount - start < 120) { requestAnimationFrame(done); return; } const f = g.frameCount - start; for (const x of restore.reverse()) x(); resolve(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v / f * 100) / 100]))); };
        requestAnimationFrame(done);
      }));
      continue;
    }
    if (e === 'cpuprof') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
      await page.waitForTimeout(3000);
      const { profile } = await cdp.send('Profiler.stop');
      const byId = new Map(profile.nodes.map(nd => [nd.id, nd])); const parent = new Map();
      for (const nd of profile.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
      const self = new Map(), total = new Map(); const counts = new Map();
      for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
      const label = nd => `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.split('/').pop()}:${nd.callFrame.lineNumber}`;
      for (const [id, c] of counts) { const nd = byId.get(id); self.set(label(nd), (self.get(label(nd)) ?? 0) + c); const seen = new Set(); let cur = id; while (cur !== undefined) { const l = label(byId.get(cur)); if (!seen.has(l)) { seen.add(l); total.set(l, (total.get(l) ?? 0) + c); } cur = parent.get(cur); } }
      const n = profile.samples.length;
      out.cpuprof = { samples: n, self: [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${(100 * v / n).toFixed(1)}% ${k}`), total: [...total].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => `${(100 * v / n).toFixed(1)}% ${k}`) };
      continue;
    }
    if (e === 'alloc') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      const f0 = await page.evaluate(() => window.__wildshard.world.game.frameCount);
      await page.waitForTimeout(4000);
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      const f1 = await page.evaluate(() => window.__wildshard.world.game.frameCount);
      const by = new Map(); let totalBytes = 0;
      const walk = (nd, stack) => { const file = nd.callFrame.url.split('/').pop().replace(/-[A-Za-z0-9_]{8}\.js$/u, ''); const own = nd.selfSize; totalBytes += own; const fn = nd.callFrame.functionName || '(anon)'; const key = `${file}:${fn}`; if (own > 0) by.set(key, (by.get(key) ?? 0) + own); for (const c of nd.children) walk(c, null); };
      walk(profile.head, null);
      const frames = f1 - f0;
      out.alloc = { frames, kbPerFrame: Math.round(totalBytes / frames / 102.4) / 10, byOwnerKbPerFrame: Object.fromEntries([...by].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, Math.round(v / frames / 102.4) / 10])) };
      continue;
    }
    if (e === 'pixdiff') {
      out.pixdiff = await page.evaluate(async () => {
        const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext();
        const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined);
        const proto = Object.getPrototypeOf(ao);
        const mine = { render: ao.render, rt: ao.renderTransparency };
        // HEAD semantics: n8ao's own render + its renderTransparency under the old Game.ts wrapper (opaque multi hidden, lean tagged)
        const oldRT = (renderer) => {
          const opaqueMulti = [], lean = [];
          g.rootScene.traverseVisible((o) => { const m = o.material; if (m === undefined) return; if (Array.isArray(m)) { if (o.isMesh && m.every((x) => !x.transparent)) opaqueMulti.push(o); return; } if (m.transparent && !m.depthWrite && o.userData.treatAsOpaque !== true) lean.push(o); });
          for (const o of opaqueMulti) o.visible = false; for (const o of lean) o.userData.treatAsOpaque = true;
          const auto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
          try { proto.renderTransparency.call(ao, renderer); } finally { renderer.shadowMap.autoUpdate = auto; for (const o of opaqueMulti) o.visible = true; for (const o of lean) delete o.userData.treatAsOpaque; }
        };
        const useOld = () => { ao.render = proto.render.bind(ao); ao.renderTransparency = oldRT; ao.autoDetectTransparency = true; };
        const useNew = (_still, skip) => { ao.render = mine.render; ao.renderTransparency = mine.rt; g.aoSkipEmptyTransparency = skip; };
        g.hold = true;
        await new Promise(res => setTimeout(res, 200));
        const w = r.domElement.width, h = r.domElement.height;
        const realNow = performance.now.bind(performance);
        const shot = () => { performance.now = () => 123456.5; try { g.composer.render(0); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; } finally { performance.now = realNow; } };
        const diff = (a, b) => { let n = 0, max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > 0) { n++; if (d > max) max = d; } } return { bytes: n, max }; };
        const res = {};
        try {
          useOld(); shot(); const a1 = shot(); const a2 = shot();
          let renders = 0; const rr = r.render; r.render = function (...x) { if (x[0] === g.rootScene) renders++; return rr.apply(this, x); };
          let b1, b3, leanRenders;
          try { useNew(false, false); shot(); renders = 0; b1 = shot(); leanRenders = renders; useNew(false, true); shot(); renders = 0; b3 = shot(); } finally { r.render = rr; }
          useOld(); shot(); const a3 = shot();
          let hash = 0; for (let i = 0; i < a1.length; i += 997) hash = (hash * 31 + a1[i]) | 0;
          Object.assign(res, { size: [w, h], hash, oldVsOld: diff(a1, a2), oldVsOldLater: diff(a1, a3), leanPrepass: diff(a1, b1), withSkip: diff(a1, b3), sceneRendersLean: leanRenders, sceneRendersWithSkip: renders, skipped: renders < leanRenders, state: JSON.stringify(window.__wildshard.shard?.grid?.state().inside ?? null) });
        } finally { useNew(true, true); g.hold = false; }
        return res;
      });
      continue;
    }
    if (e === 'pose:template') {
      const p = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return JSON.stringify(Object.keys(s)).slice(0, 400) + ' ' + JSON.stringify(s.cells ?? s.live?.cells ?? null).slice(0, 1500); });
      out.templateProbe = p; continue;
    }
    if (e === 'programs') { out.programsAfter = await page.evaluate(() => window.__wildshard.world.game.renderer.info.programs.length); continue; }
    await page.waitForTimeout(1000);
    out[e] = await sample(n);
  }
  out.errs = errs.slice(0, 20);
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
