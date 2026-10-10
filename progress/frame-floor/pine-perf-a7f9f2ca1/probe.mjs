// op-pineperf probe: Pine Hollow standalone, the floor's desktop setup (1440x900 @2, desktop tier, Developer on).
//   scripts/browser-lane.sh node probe.mjs --url=<base> [--poses=spawn,cabin,pond] [--dev=1] [--exp=cpu,gpu,gpupass,gpusec,stats,cpuprof,alloc,...]
import { chromium } from 'playwright';
import { saveFixtureCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url'), exps = arg('exp', 'cpu,gpu,gpupass,gpusec,stats').split(',').filter(Boolean), n = Number(arg('n', '240'));
const poseNames = arg('poses', 'spawn,cabin,pond').split(',');
const fixture = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'desktop', fps: 'auto', ...Object.fromEntries(arg('set', '').split(',').filter(Boolean).map(kv => kv.split('='))) }, merge: true }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: arg('dev', '1') !== '0' }),
].join(';');
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const load = () => Number(String(require_os().loadavg()[0]).slice(0, 5));
function require_os() { return globalThis.__os; }
globalThis.__os = await import('node:os');
const out = { base, rows: {} };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript({ content: `${fixture};window.__wildshardHarness={seed:357,capture:null};` });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await page.goto(`${base}/?chunk=${arg('chunk', 'pine-hollow')}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game !== undefined && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.waitForTimeout(4000);
  out.version = await page.evaluate(() => fetch('/version.json').then(r => r.json()).catch(() => null));
  const poses = await page.evaluate(async () => {
    const w = window.__wildshard.world;
    const authored = await w.game.level.capturePoses?.() ?? {};
    const list = Object.entries(authored).flatMap(([name, c]) => c.probe ? [{ ...c.probe, name: c.probe.name ?? name }] : []);
    return [{ name: 'spawn', x: w.player.position.x, y: w.player.position.y, z: w.player.position.z, yaw: w.player.yaw, pitch: w.player.pitch }, ...list];
  });
  // install instrumentation once
  await page.evaluate(() => {
    const g = window.__wildshard.world.game, c = g.composer, r = g.renderer, gl = r.getContext();
    const S = window.__pp = { cur: 'other', rec: false, pass: new Map(), draws: new Map(), tris: new Map(), active: false, timing: null };
    for (const p of c.passes) {
      const name = p.name || p.constructor.name; const orig = p.render.bind(p);
      p.render = (...a) => { const t = performance.now(); const prev = S.cur; S.cur = name; try { return orig(...a); } finally { S.cur = prev; if (S.rec) S.pass.set(name, (S.pass.get(name) ?? 0) + performance.now() - t); } };
    }
    const sm = r.shadowMap, smr = sm.render.bind(sm);
    sm.render = (...a) => { const prev = S.cur; S.cur = 'shadow'; try { return smr(...a); } finally { S.cur = prev; } };
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = gl[k].bind(gl);
      gl[k] = (...a) => { if (S.rec) { S.draws.set(S.cur, (S.draws.get(S.cur) ?? 0) + 1); const cnt = k.startsWith('drawElements') ? a[1] : a[2]; const inst = k.endsWith('Instanced') ? a.at(-1) : 1; S.tris.set(S.cur, (S.tris.get(S.cur) ?? 0) + cnt * inst / 3); } return o(...a); };
    }
  });
  const sample = (n) => page.evaluate((n) => new Promise((resolve) => {
    const g = window.__wildshard.world.game, S = window.__pp; let count = g.frameCount, first = true, last = 0;
    const iv = [], work = [], upd = [], ren = [], passes = [];
    S.rec = true; S.pass.clear();
    const tick = (ts) => {
      if (g.frameCount !== count) {
        if (!first) { iv.push(ts - last); const i = (g.frameI + 119) % 120; work.push(g.workMs[i]); upd.push(g.updateMs[i]); ren.push(g.renderMs[i]); passes.push(Object.fromEntries([...S.pass].map(([k, v]) => [k, v]))); }
        S.pass.clear(); first = false; count = g.frameCount; last = ts;
      }
      if (iv.length < n) { requestAnimationFrame(tick); return; }
      S.rec = false;
      const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
      const keys = Object.keys(passes.at(-1) ?? {});
      resolve({ p50iv: pct(iv, 0.5), p95iv: pct(iv, 0.95), over20: iv.filter(x => x > 20).length, work50: pct(work, 0.5), work95: pct(work, 0.95), upd50: pct(upd, 0.5), upd95: pct(upd, 0.95), ren50: pct(ren, 0.5), ren95: pct(ren, 0.95),
        passCpu: Object.fromEntries(keys.map(k => [k, [pct(passes.map(p => p[k] ?? 0), 0.5), pct(passes.map(p => p[k] ?? 0), 0.95)]])) });
    };
    requestAnimationFrame(tick);
  }), n);
  // GPU timer over a set of (label, object, method) targets; never nests
  const gpuTime = (spec, frames = 240) => page.evaluate(({ spec, frames }) => new Promise((resolve) => {
    const g = window.__wildshard.world.game, S = window.__pp, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) { resolve('no ext'); return; }
    const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined);
    const colour = g.composer.passes.filter(p => p.name === 'EffectPass')[0];
    const targets = [];
    if (spec === 'frame') targets.push(['frame', g.composer, 'render']);
    if (spec === 'passes') g.composer.passes.forEach((p, i) => targets.push([`${i}:${p.name || p.constructor.name}`, p, 'render']));
    if (spec === 'sections') {
      targets.push(['shadow', g.renderer.shadowMap, 'render']);
      if (ao) { for (const q of ['depthDownsampleQuad', 'effectShaderQuad', 'poissonBlurQuad', 'accumulationQuad', 'effectCompositerQuad', 'copyQuad']) if (ao[q]) targets.push([`ao.${q}`, ao[q], 'render']); }
      if (colour) for (const e of colour.effects) if (typeof e.update === 'function') targets.push([`fx.update.${e.name || e.constructor.name}`, e, 'update']);
    }
    const pending = [], ms = new Map(), restore = [];
    for (const [name, obj, key] of targets) {
      const orig = obj[key]; restore.push(() => { obj[key] = orig; });
      obj[key] = function (...a) { if (S.active) return orig.apply(this, a); S.active = true; const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); try { return orig.apply(this, a); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); S.active = false; pending.push([name, q, g.frameCount]); } };
    }
    const start = g.frameCount;
    const perFrame = new Map();
    const poll = () => {
      while (pending.length > 0 && gl.getQueryParameter(pending[0][1], gl.QUERY_RESULT_AVAILABLE)) { const [name, q, f] = pending.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { const key = `${name}|${f}`; perFrame.set(key, (perFrame.get(key) ?? 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); } gl.deleteQuery(q); }
      if (g.frameCount - start < frames) { requestAnimationFrame(poll); return; }
      for (const r of restore) r();
      for (const [key, v] of perFrame) { const name = key.split('|')[0]; if (!ms.has(name)) ms.set(name, []); ms.get(name).push(v); }
      const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
      resolve(Object.fromEntries([...ms].map(([k, v]) => [k, [pct(v, 0.5), pct(v, 0.95), v.length]])));
    };
    requestAnimationFrame(poll);
  }), { spec, frames });
  const stats = () => page.evaluate(() => new Promise((resolve) => {
    const g = window.__wildshard.world.game, S = window.__pp; S.draws.clear(); S.tris.clear(); S.rec = true;
    const start = g.frameCount;
    const done = () => { if (g.frameCount - start < 60) { requestAnimationFrame(done); return; } S.rec = false; const f = g.frameCount - start;
      const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined);
      let nodes = 0, visible = 0, meshes = 0, casters = 0; g.rootScene.traverse(o => { nodes++; }); g.rootScene.traverseVisible(o => { visible++; if (o.isMesh || o.isInstancedMesh) { meshes++; if (o.castShadow) casters++; } });
      resolve({ draws: Object.fromEntries([...S.draws].map(([k, v]) => [k, Math.round(v / f)])), ktris: Object.fromEntries([...S.tris].map(([k, v]) => [k, Math.round(v / f / 1000)])), nodes, visible, meshes, casters,
        ao: ao ? { ...Object.fromEntries(Object.entries(ao.configuration).filter(([, v]) => typeof v !== 'object')), autoDetect: ao.autoDetectTransparency } : null,
        passes: g.composer.passes.map(p => `${p.name || p.constructor.name}:${p.enabled}`), effects: g.composer.passes.filter(p => p.effects).map(p => p.effects.map(e => e.name || e.constructor.name)),
        size: [g.renderer.domElement.width, g.renderer.domElement.height], programs: g.renderer.info.programs.length,
        shadow: { type: g.renderer.shadowMap.type, auto: g.renderer.shadowMap.autoUpdate } });
    };
    requestAnimationFrame(done);
  }));
  for (const pn of poseNames) {
    const pose = poses.find(p => p.name === pn);
    if (!pose) { out.rows[pn] = 'no pose'; continue; }
    await page.evaluate(p => window.__wildshard.pose(p), pose);
    await page.waitForTimeout(Number(arg('settle', '4000')));
    const row = { pose, load0: load() };
    for (const e of exps) {
      if (e === 'cpu') row.cpu = await sample(n);
      else if (e === 'gpu') row.gpu = await gpuTime('frame');
      else if (e === 'gpupass') row.gpupass = await gpuTime('passes');
      else if (e === 'gpusec') row.gpusec = await gpuTime('sections');
      else if (e === 'stats') row.stats = await stats();
      else if (e.startsWith('abl')) {
        // interleaved A/B: base vs each variant, frame GPU timer, twice
        const variants = (arg('variants', 'novol,norays,nobloom,nolut,nochroma,nonoise,noao,nosmaa,noshadowupd,aocopy')).split(',');
        const apply = (v, on) => page.evaluate(([v, on]) => {
          const g = window.__wildshard.world.game, c = g.composer;
          const colour = c.passes.filter(p => p.name === 'EffectPass')[0], smaa = c.passes.filter(p => p.name === 'EffectPass')[1];
          const ao = c.passes.find(p => p.configuration?.aoRadius !== undefined);
          const W = window.__abl ??= {};
          const drop = (re) => { if (on) { W.orig = colour.effects.slice(); colour.setEffects(colour.effects.filter(x => !re.test(x.name || x.constructor.name))); colour.recompile(); } else { colour.setEffects(W.orig); colour.recompile(); } };
          if (v === 'novol') drop(/Volumetric/u);
          if (v === 'norays') drop(/GodRays/u);
          if (v === 'nobloom') drop(/Bloom/u);
          if (v === 'nolut') drop(/LUT/u);
          if (v === 'nochroma') drop(/Chromatic/u);
          if (v === 'nonoise') drop(/Noise/u);
          if (v === 'nograde') drop(/Grade|HueSat|Brightness|Vignette|ToneMapping/u);
          if (v === 'noao') ao.enabled = !on;
          if (v === 'nosmaa') smaa.enabled = !on;
          if (v === 'noshadowupd') g.renderer.shadowMap.autoUpdate = !on;
          if (v === 'aocopy') { if (on) { W.cq = ao.copyQuad.render; ao.copyQuad.render = () => {}; } else ao.copyQuad.render = W.cq; }
          if (v === 'noprepass') { if (on) { W.rt = ao.configuration.transparencyAware; ao.configuration.transparencyAware = false; } else ao.configuration.transparencyAware = W.rt; }
          if (v === 'aosamples8') ao.configuration.aoSamples = on ? 8 : 16;
          if (v === 'bloomhalflum') { const b = colour.effects.find(x => /Bloom/u.test(x.name)); b.luminancePass.resolution.scale = on ? 0.5 : 1; }
          if (v === 'smaalow') { const e2 = smaa.effects[0]; e2.applyPreset(on ? 0 : 2); }
          if (v === 'denoise4') ao.configuration.denoiseSamples = on ? 4 : 8;
          return true;
        }, [v, on]);
        const res = {};
        for (const v of variants) {
          const a = [], b = [];
          for (let k = 0; k < 2; k++) {
            await page.waitForTimeout(300); a.push((await gpuTime('frame', 120)).frame?.[0]);
            await apply(v, true); await page.waitForTimeout(600); b.push((await gpuTime('frame', 120)).frame?.[0]); await apply(v, false);
          }
          const m = x => Math.round(x.reduce((s, y) => s + y, 0) / x.length * 100) / 100;
          res[v] = { base: m(a), variant: m(b), delta: Math.round((m(a) - m(b)) * 100) / 100, raw: [a, b] };
          console.error(`[abl] ${pn} ${v} ${JSON.stringify(res[v])}`);
        }
        row.abl = res;
      }
      else if (e === 'cpuparts') {
        row.cpuparts = await page.evaluate(() => new Promise((resolve) => {
          const g = window.__wildshard.world.game, r = g.renderer, scene = g.rootScene, S = window.__pp;
          const acc = new Map(), cnt = new Map(), restore = [];
          const add = (k, t) => { acc.set(k, (acc.get(k) ?? 0) + t); cnt.set(k, (cnt.get(k) ?? 0) + 1); };
          const wrap = (obj, key, label) => { const o = obj[key]; restore.push(() => { obj[key] = o; }); obj[key] = function (...a) { const t = performance.now(); try { return o.apply(this, a); } finally { add(typeof label === 'function' ? label(a, this) : label, performance.now() - t); } }; };
          wrap(scene, 'updateMatrixWorld', () => `umw@${S.cur}`);
          wrap(r, 'render', (a) => `render@${S.cur}:${a[0] === scene ? 'root' : (a[0].name || a[0].type)}`);
          wrap(r.shadowMap, 'render', 'shadowMap.render');
          const start = g.frameCount;
          const done = () => { if (g.frameCount - start < 120) { requestAnimationFrame(done); return; } const f = g.frameCount - start; for (const x of restore.reverse()) x();
            resolve(Object.fromEntries([...acc].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, [Math.round(v / f * 100) / 100, Math.round(cnt.get(k) / f * 10) / 10]]))); };
          requestAnimationFrame(done);
        }));
      }
      else if (e === 'prepass') {
        row.prepass = await page.evaluate(() => {
          const g = window.__wildshard.world.game, cam = g.camera, rows = [];
          const fr = new (g.camera.projectionMatrix.constructor === Object ? Object : Object)();
          g.rootScene.traverseVisible((o) => {
            const m = o.material; if (m === undefined) return;
            const arr = Array.isArray(m);
            const t = arr ? m.some(x => x.transparent) : m.transparent;
            const noAo = !!o.userData.cannotReceiveAO;
            if (!t && !noAo) return;
            const dw = arr ? m.map(x => x.depthWrite) : m.depthWrite;
            rows.push({ name: o.name || '', type: o.type, mat: arr ? 'array' : (m.name || m.type), dw, noAo, treat: o.userData.treatAsOpaque === true, layers: o.layers.test(cam.layers), parent: (o.parent?.name || o.parent?.type) + '/' + (o.parent?.parent?.name || ''), count: o.count ?? null, tris: o.geometry?.index ? o.geometry.index.count / 3 : null, fc: o.frustumCulled, alphaTest: arr ? null : m.alphaTest });
          });
          return rows;
        });
      }
      else if (e === 'shadowcensus') {
        row.shadowcensus = await page.evaluate(() => {
          const g = window.__wildshard.world.game, lights = [];
          g.rootScene.traverse((o) => { if (o.isLight && o.castShadow) lights.push({ name: o.name, type: o.type, visible: o.visible, intensity: o.intensity, map: o.shadow?.mapSize?.x, auto: o.shadow?.autoUpdate, needs: o.shadow?.needsUpdate, cam: o.shadow?.camera ? [o.shadow.camera.left, o.shadow.camera.right, o.shadow.camera.near, o.shadow.camera.far].map(x => Math.round(x)) : null }); });
          let casters = 0, castersVisible = 0, nodes = 0; const types = {};
          g.rootScene.traverse((o) => { nodes++; types[o.type] = (types[o.type] ?? 0) + 1; if (o.castShadow) casters++; });
          g.rootScene.traverseVisible((o) => { if (o.castShadow && o.isMesh) castersVisible++; });
          return { lights, casters, castersVisible, nodes, types };
        });
      }
      else if (e === 'cpuabl') {
        const variants = arg('cvariants', 'bones,bmsort,noumwprepass').split(',');
        const apply = (v, on) => page.evaluate(([v, on]) => {
          const g = window.__wildshard.world.game, scene = g.rootScene, W = window.__cabl ??= {};
          if (v === 'bones') {
            if (on) { W.hid = []; const hasR = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite || o.isLight || o.children.some(hasR); scene.traverse(o => { if (o.isBone && o.visible && !o.children.some(hasR)) { /* only top-most */ } }); const walk = (o) => { if (o.isBone && o.visible && !hasR2(o)) { o.visible = false; W.hid.push(o); return; } for (const c of o.children) walk(c); }; const hasR2 = (o) => o.children.some(c => c.isMesh || c.isLine || c.isPoints || c.isSprite || c.isLight || hasR2(c)); walk(scene); W.n = W.hid.length; }
            else { for (const o of W.hid) o.visible = true; }
          }
          if (v === 'bmsort') { if (on) { W.bm = []; scene.traverse(o => { if (o.isBatchedMesh && o.sortObjects) { W.bm.push(o); o.sortObjects = false; } }); W.nbm = W.bm.length; } else for (const o of W.bm) o.sortObjects = true; }
          if (v === 'bmcull') { if (on) { W.bc = []; scene.traverse(o => { if (o.isBatchedMesh && o.perObjectFrustumCulled) { W.bc.push(o); o.perObjectFrustumCulled = false; } }); } else for (const o of W.bc) o.perObjectFrustumCulled = true; }
          if (v === 'noumwprepass') {
            const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined), r = g.renderer;
            if (on) { W.rr = r.render; r.render = function (sc, cam) { if (window.__pp.cur === 'Pass' && sc === scene) { const a = sc.matrixWorldAutoUpdate; sc.matrixWorldAutoUpdate = false; try { return W.rr.call(this, sc, cam); } finally { sc.matrixWorldAutoUpdate = a; } } return W.rr.call(this, sc, cam); }; }
            else r.render = W.rr;
          }
          return { n: W.n, nbm: W.nbm };
        }, [v, on]);
        const res = {};
        for (const v of variants) {
          const a = [], b = []; let info;
          for (let k = 0; k < 3; k++) {
            await page.waitForTimeout(300); a.push(await sample(120));
            info = await apply(v, true); await page.waitForTimeout(500); b.push(await sample(120)); await apply(v, false);
          }
          const m = (x, f) => Math.round(x.reduce((s, y) => s + y[f], 0) / x.length * 100) / 100;
          res[v] = { info, work50: [m(a, 'work50'), m(b, 'work50')], ren50: [m(a, 'ren50'), m(b, 'ren50')], work95: [m(a, 'work95'), m(b, 'work95')] };
          console.error(`[cabl] ${pn} ${v} ${JSON.stringify(res[v])}`);
        }
        row.cpuabl = res;
      }
      else if (e.startsWith('pixcuts:')) { await page.evaluate((v) => { window.__pixCuts = v; for (const k of ['__aoCut3','__aoCut4','__aoCut5']) delete window[k]; }, e.slice(8).replaceAll('+', ',')); }
      else if (e === 'pixdiff') {
        row.pixdiff = await page.evaluate(async () => {
          const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene;
          const ao = g.composer.passes.find(p => p.configuration?.aoRadius !== undefined);
          const proto = ao ? Object.getPrototypeOf(ao) : null;
          const mine = ao ? { render: ao.render, rt: ao.renderTransparency } : null;
          const oldRT = (renderer) => {
            const opaqueMulti = [], lean = [];
            scene.traverseVisible((o) => { const m = o.material; if (m === undefined) return; if (Array.isArray(m)) { if (o.isMesh && m.every((x) => !x.transparent)) opaqueMulti.push(o); return; } if (m.transparent && !m.depthWrite && o.userData.treatAsOpaque !== true) lean.push(o); });
            for (const o of opaqueMulti) o.visible = false; for (const o of lean) o.userData.treatAsOpaque = true;
            const auto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
            try { proto.renderTransparency.call(ao, renderer); } finally { renderer.shadowMap.autoUpdate = auto; for (const o of opaqueMulti) o.visible = true; for (const o of lean) delete o.userData.treatAsOpaque; }
          };
          const allBones = (o) => o.isBone && o.children.every(allBones);
          const hidden = []; scene.traverse((o) => { if (o.isBone && !o.visible && allBones(o)) hidden.push(o); });
          const useOld = (bones) => { if (ao) { ao.render = proto.render.bind(ao); ao.renderTransparency = oldRT; ao.autoDetectTransparency = true; } if (bones) for (const o of hidden) o.visible = true; };
          const useNew = () => { if (ao) { ao.render = mine.render; ao.renderTransparency = mine.rt; } for (const o of hidden) o.visible = false; };
          g.hold = true;
          await new Promise(res => setTimeout(res, 300));
          const w = r.domElement.width, h = r.domElement.height;
          const realNow = performance.now.bind(performance);
          const shot = () => { performance.now = () => 123456.5; try { if (g.volumetrics) Reflect.set(g.volumetrics, 'frame', 7); g.composer.render(0); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; } finally { performance.now = realNow; } };
          const diff = (a, b) => { let n = 0, max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > 0) { n++; if (d > max) max = d; } } return { bytes: n, max }; };
          const res = { hiddenBones: hidden.length };
          const cuts = (window.__pixCuts ?? '').split(',').filter(Boolean);
          for (const c of cuts) window[c] = false;
          let renders = 0;
          try {
            useOld(true); shot(); const a1 = shot(); const a2 = shot();
            const rr = r.render; r.render = function (...x) { if (x[0] === scene) renders++; return rr.apply(this, x); };
            let b1, b2, oldNoBones, rNew;
            try { useNew(); shot(); renders = 0; b1 = shot(); rNew = renders; b2 = shot(); useOld(false); shot(); renders = 0; oldNoBones = shot(); res.rendersOld = renders; } finally { r.render = rr; }
            useOld(true); shot(); const a3 = shot();
            Object.assign(res, { size: [w, h], oldVsOld: diff(a1, a2), oldVsOldLater: diff(a1, a3), newVsNew: diff(b1, b2), oldVsNew: diff(a1, b1), oldBonesHiddenVsOld: diff(a1, oldNoBones), sceneRendersNew: rNew });
          } finally { useNew(); g.hold = false; }
          return res;
        });
        console.error(`[pixdiff] ${pn} ${await page.evaluate(() => window.__pixCuts ?? '')} ${JSON.stringify(row.pixdiff)}`);
      }
      else if (e === 'mwchange') {
        row.mwchange = await page.evaluate(() => new Promise((resolve) => {
          const g = window.__wildshard.world.game, r = g.renderer, scene = g.rootScene, S = window.__pp;
          const rr = r.render; const found = new Map(); let n = 0;
          r.render = function (sc, cam) {
            if (S.cur === 'Pass' && sc === scene && n < 40) {
              n++;
              const all = []; scene.traverse(o => all.push([o, o.matrixWorld.elements.slice()]));
              scene.updateMatrixWorld();
              for (const [o, m] of all) { const e = o.matrixWorld.elements; let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(e[i] - m[i])); if (d > 0) { const path = []; for (let p = o; p && path.length < 5; p = p.parent) path.push(p.name || p.type); const k = path.join('<'); const f = found.get(k) ?? { n: 0, max: 0, visible: o.visible }; f.n++; f.max = Math.max(f.max, d); found.set(k, f); } }
            }
            return rr.apply(this, arguments);
          };
          setTimeout(() => { r.render = rr; resolve({ calls: n, changed: [...found].sort((a, b) => b[1].n - a[1].n).slice(0, 30) }); }, 2000);
        }));
      }
      else if (e === 'mineab') {
        const setOld = (on) => page.evaluate((on) => {
          const scene = window.__wildshard.world.game.rootScene, W = window.__mab ??= {};
          const allBones = (o) => o.isBone && o.children.every(allBones);
          if (on) { window.__aoCut3 = false; window.__aoCut4 = false; window.__aoCut5 = false; W.h = []; scene.traverse((o) => { if (o.isBone && !o.visible && allBones(o)) { W.h.push(o); o.visible = true; } }); }
          else { delete window.__aoCut3; delete window.__aoCut4; delete window.__aoCut5; for (const o of W.h) o.visible = false; }
        }, on);
        const reps = Number(arg('reps', '3')); const A = { gpu: [], work50: [], work95: [], ren50: [] }, B = { gpu: [], work50: [], work95: [], ren50: [] };
        const one = async (T) => { const c = await sample(120); T.work50.push(c.work50); T.work95.push(c.work95); T.ren50.push(c.ren50); T.gpu.push((await gpuTime('frame', 120)).frame?.[0]); };
        for (let k = 0; k < reps; k++) { await setOld(true); await page.waitForTimeout(400); await one(A); await setOld(false); await page.waitForTimeout(400); await one(B); }
        const m = x => Math.round(x.reduce((s, y) => s + y, 0) / x.length * 100) / 100;
        row.mineab = Object.fromEntries(Object.keys(A).map(k => [k, { old: m(A[k]), new: m(B[k]), raw: [A[k], B[k]] }]));
        console.error(`[mineab] ${pn} ${JSON.stringify(Object.fromEntries(Object.entries(row.mineab).map(([k, v]) => [k, [v.old, v.new]])))}`);
      }
      else if (e === 'gpuloop') {
        // uncoupled from vsync: the game held, the composer rendered K times back to back, each target timed
        row.gpuloop = await page.evaluate(async (variants) => {
          const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
          const c = g.composer, colour = c.passes.filter(p => p.name === 'EffectPass')[0], smaa = c.passes.filter(p => p.name === 'EffectPass')[1];
          const ao = c.passes.find(p => p.configuration?.aoRadius !== undefined);
          const fx = (re) => colour.effects.find(x => re.test(x.name));
          const px = new Uint8Array(4);
          const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const run = async (targets, K) => {
            const qs = [], restore = [];
            for (const [name, obj, key] of targets) { const o = obj[key]; restore.push(() => { obj[key] = o; }); obj[key] = function (...a) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); try { return o.apply(this, a); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push([name, q]); } }; }
            const walls = [];
            try { for (let k = 0; k < K; k++) { sync(); const t = performance.now(); c.render(0); sync(); walls.push(performance.now() - t); } } finally { for (const x of restore) x(); }
            await new Promise(res => setTimeout(res, 300));
            const ms = {};
            for (const [n, q] of qs) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { (ms[n] ??= []).push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); } gl.deleteQuery(q); }
            const med = (v) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)] * 100) / 100; };
            return { wall: med(walls), ...Object.fromEntries(Object.entries(ms).map(([k, v]) => [k, med(v)])) };
          };
          g.hold = true; await new Promise(res => setTimeout(res, 300));
          const out = {};
          try {
            out.frame = await run([['frame', c, 'render']], 25);
            out.passes = await run(c.passes.map((p, i) => [`${i}:${p.name}`, p, 'render']), 25);
            const upd = colour.effects.filter(x => typeof x.update === 'function').map(x => [`upd.${x.name}`, x, 'update']);
            out.updates = await run(upd, 25);
            const bloom = fx(/Bloom/u);
            out.bloomParts = await run([['lum', bloom.luminancePass, 'render'], ['mip', bloom.mipmapBlurPass, 'render']], 25);
            for (const v of variants) {
              const W = {};
              const set = (on) => {
                if (v === 'nobloom' || v === 'novol' || v === 'norays') { const re = { nobloom: /Bloom/u, novol: /Volumetric/u, norays: /GodRays/u }[v]; if (on) { W.o = colour.effects.slice(); colour.setEffects(colour.effects.filter(x => !re.test(x.name))); } else colour.setEffects(W.o); colour.recompile(); }
                if (v === 'noao') ao.enabled = !on;
                if (v === 'nosmaa') smaa.enabled = !on;
                if (v === 'bloomlev6') { const b = fx(/Bloom/u); b.mipmapBlurPass.levels = on ? 6 : 8; }
                if (v === 'bloomhalflum') { fx(/Bloom/u).luminancePass.resolution.scale = on ? 0.5 : 1; }
              };
              const a = [], b = [];
              for (let k = 0; k < 2; k++) { a.push((await run([['frame', c, 'render']], 15)).frame); set(true); c.render(0); b.push((await run([['frame', c, 'render']], 15)).frame); set(false); c.render(0); }
              out[v] = { base: a, variant: b };
            }
          } finally { g.hold = false; }
          return out;
        }, arg('loopvariants', 'nobloom,novol,norays,noao,nosmaa').split(',').filter(Boolean));
        console.error(`[gpuloop] ${pn} ${JSON.stringify(row.gpuloop)}`);
      }
      else if (e === 'micro') {
        row.micro = await page.evaluate(async () => {
          const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), c = g.composer;
          const colour = c.passes.filter(p => p.name === 'EffectPass')[0], smaa = c.passes.filter(p => p.name === 'EffectPass')[1];
          const ao = c.passes.find(p => p.configuration?.aoRadius !== undefined);
          const fx = (re) => colour.effects.find(x => re.test(x.name));
          const px = new Uint8Array(4); const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const inBuf = c.inputBuffer, outBuf = c.outputBuffer;
          const time = (fn, K = 40) => { sync(); fn(); sync(); const t = performance.now(); for (let k = 0; k < K; k++) fn(); sync(); return Math.round((performance.now() - t) / K * 1000) / 1000; };
          g.hold = true; await new Promise(res => setTimeout(res, 300));
          const bloom = fx(/Bloom/u), rays = fx(/GodRays/u), out = {};
          try {
            out.empty = time(() => {});
            out.composer = time(() => c.render(0), 20);
            out.scenePass = time(() => c.passes[0].render(r, inBuf, outBuf, 0, false), 20);
            out.aoPass = time(() => ao.render(r, inBuf, outBuf, 0, false), 20);
            out.colourPass = time(() => colour.render(r, inBuf, outBuf, 0, false), 20);
            out.smaaPass = time(() => smaa.render(r, inBuf, outBuf, 0, false), 20);
            out.bloomUpdate = time(() => bloom.update(r, inBuf, 0));
            out.bloomLum = time(() => bloom.luminancePass.render(r, inBuf));
            out.bloomMip = time(() => bloom.mipmapBlurPass.render(r, bloom.luminancePass.renderTarget));
            out.raysUpdate = time(() => rays.update(r, inBuf, 0));
            const cpuOnly = (fn, K = 20) => { sync(); let tot = 0; for (let k = 0; k < K; k++) { const t = performance.now(); fn(); tot += performance.now() - t; } sync(); return Math.round(tot / K * 1000) / 1000; };
            out.scenePassCpu = cpuOnly(() => c.passes[0].render(r, inBuf, outBuf, 0, false));
            out.composerCpu = cpuOnly(() => c.render(0));
            const sm = r.shadowMap; sm.autoUpdate = false;
            out.scenePassNoShadow = time(() => c.passes[0].render(r, inBuf, outBuf, 0, false), 20);
            out.scenePassNoShadowCpu = cpuOnly(() => c.passes[0].render(r, inBuf, outBuf, 0, false));
            sm.autoUpdate = true;
            out.shadowOnly = time(() => { sm.needsUpdate = true; sm.render(sm.__lights ?? [], g.rootScene, g.camera); }, 20);
            // fill-rate: the scene into a quarter-area target
            const small = inBuf.clone(); small.setSize(inBuf.width / 2, inBuf.height / 2);
            out.scenePassHalfRes = time(() => c.passes[0].render(r, small, outBuf, 0, false), 20);
            small.dispose();
            out.lumSize = [bloom.luminancePass.renderTarget.width, bloom.luminancePass.renderTarget.height, bloom.luminancePass.renderTarget.texture.type, bloom.luminancePass.renderTarget.texture.generateMipmaps, bloom.luminancePass.renderTarget.texture.minFilter];
            out.mips = bloom.mipmapBlurPass.downsamplingMipmaps.map(m => [m.width, m.height, m.texture.type, m.texture.generateMipmaps, m.texture.minFilter]);
          } finally { g.hold = false; }
          return out;
        });
        console.error(`[micro] ${pn} ${JSON.stringify(row.micro)}`);
      }
      else if (e === 'boxing') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
        const res = {};
        for (const which of ['fresh', 'scene', 'plainarr']) {
          await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
          await page.evaluate((which) => {
            const g = window.__wildshard.world.game, M = g.camera.matrix.constructor;
            let a, b, o;
            if (which === 'fresh') { a = new M(); b = new M(); o = new M(); a.makeRotationX(0.3); b.makeTranslation(1.5, 2.25, 3.125); }
            else if (which === 'scene') { const nodes = []; g.rootScene.traverse(n => nodes.push(n)); const n = nodes.find(x => x.isBone) ?? nodes[nodes.length - 1]; a = n.matrix; b = n.parent.matrixWorld; o = n.matrixWorld.clone(); o.elements = n.matrixWorld.elements; }
            else { a = new M(); b = new M(); a.makeRotationX(0.3); b.makeTranslation(1.5, 2.25, 3.125); o = new M(); o.elements = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1.5]; }
            const save = o.elements.slice();
            for (let i = 0; i < 100000; i++) o.multiplyMatrices(a, b);
            for (let i = 0; i < 16; i++) o.elements[i] = save[i];
          }, which);
          const { profile } = await cdp.send('HeapProfiler.stopSampling');
          let tot = 0; const walk = (nd) => { tot += nd.selfSize; for (const c of nd.children) walk(c); }; walk(profile.head);
          res[which] = Math.round(tot / 1024);
        }
        row.boxing = res;
        console.error(`[boxing] KB per 100k multiplies ${JSON.stringify(res)}`);
      }
      else if (e === 'mmspeed') {
        row.mmspeed = await page.evaluate(() => {
          const g = window.__wildshard.world.game, M = g.camera.matrix.constructor, P = M.prototype;
          const src = P.multiplyMatrices.toString().replace(/^multiplyMatrices/, 'function');
          const fresh = (0, eval)('(' + src + ')');
          const fresh2 = (0, eval)('(' + src + ')');
          const a = new M().makeRotationX(0.3), b = new M().makeTranslation(1.5, 2.25, 3.125), o = new M();
          const o2 = { elements: [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1.5] };
          const t = (fn, obj) => { for (let i = 0; i < 20000; i++) fn.call(obj, a, b); const s = performance.now(); for (let i = 0; i < 300000; i++) fn.call(obj, a, b); return Math.round((performance.now() - s) / 300000 * 1e6) + ' ns'; };
          const ue = (fn) => { const m = new M(); return 0; };
          return { original: t(P.multiplyMatrices, o), freshSameObjs: t(fresh, o), freshPlainArray: t(fresh2, o2), src: src.slice(0, 120) };
        });
        console.error(`[mmspeed] ${pn} ${JSON.stringify(row.mmspeed)}`);
      }
      else if (e === 'umwsplit') {
        row.umwsplit = await page.evaluate(() => {
          const g = window.__wildshard.world.game, scene = g.rootScene;
          scene.updateMatrixWorld();
          const out = [];
          for (const c of scene.children) {
            let n = 0, bones = 0; c.traverse(o => { n++; if (o.isBone) bones++; });
            const t = performance.now(); for (let k = 0; k < 50; k++) c.updateMatrixWorld(true); const ms = (performance.now() - t) / 50;
            out.push({ name: c.name || c.type, ctor: c.constructor.name, n, bones, ms: Math.round(ms * 1000) / 1000, auto: c.matrixAutoUpdate });
          }
          return out.sort((a, b) => b.ms - a.ms).slice(0, 20);
        });
        console.error(`[umwsplit] ${pn} ${JSON.stringify(row.umwsplit)}`);
      }
      else if (e === 'animals') {
        row.animals = await page.evaluate(() => new Promise((res) => {
          const g = window.__wildshard.world.game, grp = g.rootScene.children.find(c => c.name === 'animals');
          const samples = []; let f0 = g.frameCount;
          const tick = () => { if (g.frameCount !== f0) { samples.push({ ...grp.last }); f0 = g.frameCount; } if (samples.length < 30) requestAnimationFrame(tick); else {
            let perAnimal = []; for (const c of grp.children) { let n = 0; c.traverse(() => n++); perAnimal.push(n); }
            res({ last: samples.slice(-5), kids: grp.children.length, nodesPerKid: perAnimal.slice(0, 10), total: perAnimal.reduce((a, b) => a + b, 0) }); } };
          requestAnimationFrame(tick);
        }));
        console.error(`[animals] ${pn} ${JSON.stringify(row.animals)}`);
      }
      else if (e === 'animstill') {
        row.animstill = await page.evaluate(() => new Promise((res) => {
          const g = window.__wildshard.world.game, grp = g.rootScene.children.find(c => c.name === 'animals');
          const snap = () => grp.children.map(c => { const a = []; c.traverse(o => { if (o.isBone || o === c) a.push(...o.matrix.elements); }); return a; });
          let prev = null, f0 = g.frameCount; const stats = [];
          const tick = () => {
            if (g.frameCount !== f0) { f0 = g.frameCount; const cur = snap(); if (prev) { let still = 0, rootOnly = 0; cur.forEach((a, i) => { const b = prev[i]; if (!b || a.length !== b.length) return; let rootSame = true, bonesSame = true; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { if (k < 16) rootSame = false; else bonesSame = false; } if (rootSame && bonesSame) still++; else if (bonesSame) rootOnly++; }); stats.push([still, rootOnly, grp.last.updated]); } prev = cur; }
            if (stats.length < 20) requestAnimationFrame(tick); else res(stats);
          };
          requestAnimationFrame(tick);
        }));
        console.error(`[animstill] ${pn} still,rootOnly,updated ${JSON.stringify(row.animstill.slice(-8))}`);
      }
      else if (e === 'animexact') {
        row.animexact = await page.evaluate(() => new Promise((res) => {
          const g = window.__wildshard.world.game, grp = g.rootScene.children.find(c => c.name === 'animals');
          const results = []; let f0 = g.frameCount;
          const r = g.renderer, rr = r.render;
          // right after the scene pass's walk, compare every animal node's matrixWorld with a forced full walk
          r.render = function (sc, cam) {
            const out = rr.apply(this, arguments);
            if (sc === g.rootScene && window.__pp.cur === 'RenderPass' && results.length < 20) {
              const before = []; grp.traverse(o => before.push(o.matrixWorld.elements.slice()));
              const last = { ...grp.last };
              for (const c of grp.children) c.updateMatrixWorld(true);
              let diff = 0, i = 0; grp.traverse(o => { const b = before[i++]; for (let k = 0; k < 16; k++) if (b[k] !== o.matrixWorld.elements[k]) { diff++; break; } });
              results.push([last.skipped, last.updated, diff]);
            }
            return out;
          };
          const tick = () => { if (results.length < 20) requestAnimationFrame(tick); else { r.render = rr; res(results); } };
          requestAnimationFrame(tick);
        }));
        console.error(`[animexact] ${pn} skipped,updated,nodesDiffering ${JSON.stringify(row.animexact.slice(-10))}`);
      }
      else if (e === 'cpuprof') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
        await page.waitForTimeout(4000);
        const { profile } = await cdp.send('Profiler.stop');
        const byId = new Map(profile.nodes.map(nd => [nd.id, nd])); const parent = new Map();
        for (const nd of profile.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
        const self = new Map(), total = new Map(), counts = new Map();
        for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
        const label = nd => `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.split('/').pop()}:${nd.callFrame.lineNumber}`;
        for (const [id, c] of counts) { const nd = byId.get(id); self.set(label(nd), (self.get(label(nd)) ?? 0) + c); const seen = new Set(); let cur = id; while (cur !== undefined) { const l = label(byId.get(cur)); if (!seen.has(l)) { seen.add(l); total.set(l, (total.get(l) ?? 0) + c); } cur = parent.get(cur); } }
        const ns = profile.samples.length;
        const under = (pat) => { const m = new Map(); let tot = 0; for (const [id, c] of counts) { let cur = id, hit = false; while (cur !== undefined) { if (pat.test(label(byId.get(cur)))) { hit = true; break; } cur = parent.get(cur); } if (!hit) continue; tot += c; const l = label(byId.get(id)); m.set(l, (m.get(l) ?? 0) + c); } return { pct: (100 * tot / ns).toFixed(1), self: [...m].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${(100 * v / ns).toFixed(2)}% ${k}`) }; };
        row.cpuunder = { shadow: under(/^sm\.render /u), systemDt: under(/^systemDt /u), umw: under(/^updateMatrixWorld three/u) };
        const kids = (pat) => { const m = new Map(); for (const [id, c] of counts) { let cur = id, prev = undefined; while (cur !== undefined) { if (pat.test(label(byId.get(cur)))) break; prev = cur; cur = parent.get(cur); } if (cur === undefined || prev === undefined) continue; const l = label(byId.get(prev)); m.set(l, (m.get(l) ?? 0) + c); } return [...m].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(100 * v / ns).toFixed(2)}% ${k}`); };
        row.cpukids = { runPhase: kids(/^runPhase /u), frame: kids(/^s session.*:2143$/u), systemDt: kids(/^systemDt /u) };
        row.cpuprof = { samples: ns, self: [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(100 * v / ns).toFixed(1)}% ${k}`), total: [...total].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([k, v]) => `${(100 * v / ns).toFixed(1)}% ${k}`) };
      } else if (e === 'alloc') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
        await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
        const f0 = await page.evaluate(() => window.__wildshard.world.game.frameCount);
        await page.waitForTimeout(4000);
        const { profile } = await cdp.send('HeapProfiler.stopSampling');
        const f1 = await page.evaluate(() => window.__wildshard.world.game.frameCount);
        const by = new Map(); let totalBytes = 0;
        const walk = (nd, path) => { const file = nd.callFrame.url.split('/').pop(); const fn = nd.callFrame.functionName || '(anon)'; const key = `${fn} ${file}:${nd.callFrame.lineNumber}`; const p2 = [...path, key].slice(-3); if (nd.selfSize > 0) { totalBytes += nd.selfSize; const k = p2.join(' < '); by.set(k, (by.get(k) ?? 0) + nd.selfSize); } for (const c of nd.children) walk(c, p2); };
        walk(profile.head, []);
        const frames = f1 - f0;
        row.alloc = { frames, kbPerFrame: Math.round(totalBytes / frames / 102.4) / 10, top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / frames / 1024).toFixed(1)}KB/f ${k}`) };
      }
    }
    row.load1 = load();
    out.rows[pn] = row;
    console.error(`[probe] ${pn} done ${JSON.stringify({ cpu: row.cpu && [row.cpu.p50iv, row.cpu.p95iv, row.cpu.work50, row.cpu.work95], gpu: row.gpu?.frame })}`);
  }
  out.errs = errs.slice(0, 20);
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
