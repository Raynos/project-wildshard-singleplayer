// G242 floor attribution probe: desktop floor conditions (1440x900 @2, desktop tier, fps auto, Developer on), grid entered by the
// title tap, posed at the floor's grid-crossroads; then timing samples and experiments.
//   scripts/browser-lane.sh node progress/shard-platform/g242-road-sky/floor-probe.mjs --url=<serve-build base> [--pose=grid-crossroads|grid-deck-north] [--exp=gl,gpu,programs,nodome,nolayers,nocsm2]
import { chromium } from 'playwright';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';
const arg = (k, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg('url'), exps = arg('exp', '').split(',').filter(Boolean), poseName = arg('pose', 'grid-crossroads');
const POSES = { 'grid-crossroads': { name: 'grid-crossroads', x: 240, y: 6, z: 240, yaw: -Math.PI * 0.75, pitch: -0.12 }, 'grid-deck-north': { name: 'grid-deck-north', x: 0, y: 3, z: 262, yaw: Math.PI, pitch: -0.05 } };
const fixture = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'desktop', fps: 'auto' }, merge: true }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
].join(';');
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { base };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript({ content: `${fixture};window.__wildshardHarness={seed:357,capture:null};` });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  page.on('console', m => { const t = m.text(); if (/shader|WebGLProgram|road sky/iu.test(t)) errs.push(t.slice(0, 200)); });
  await page.goto(`${base}/?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.locator('.ws-main-grid').click({ timeout: 240_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid !== undefined && window.__wildshard.world?.game?.app?.state !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForTimeout(4000);
  out.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.evaluate(p => window.__wildshard.pose(p), POSES[poseName]);
  await page.waitForTimeout(3000);
  const sample = (n) => page.evaluate((n) => new Promise((resolve) => {
    const g = window.__wildshard.world.game; let count = g.frameCount, first = true, last = 0;
    const iv = [], work = [], upd = [], ren = [], calls = [];
    const tick = (ts) => {
      if (g.frameCount !== count) {
        if (!first) { iv.push(ts - last); const i = (g.frameI + 119) % 120; work.push(g.workMs[i]); upd.push(g.updateMs[i]); ren.push(g.renderMs[i]); calls.push(g.lastFrame.calls); }
        first = false; count = g.frameCount; last = ts;
      }
      if (iv.length < n) { requestAnimationFrame(tick); return; }
      const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
      resolve({ p50iv: pct(iv, 0.5), p95iv: pct(iv, 0.95), over17: iv.filter(x => x > 20).length, work50: pct(work, 0.5), work95: pct(work, 0.95), upd50: pct(upd, 0.5), upd95: pct(upd, 0.95), ren50: pct(ren, 0.5), ren95: pct(ren, 0.95), calls: [Math.min(...calls), Math.max(...calls)],
        seq: iv.map(x => x > 20 ? 'X' : '.').join('') });
    };
    requestAnimationFrame(tick);
  }), n);
  out.state = await page.evaluate(() => {
    const api = window.__wildshard, g = api.world.game, s = api.shard.grid.state();
    let dome = null; g.rootScene.traverse(o => { if (o.name === 'road-sky') dome = { visible: o.visible, parent: o.parent?.type, order: o.renderOrder }; });
    const layers = [...(g.sky.layers ?? [])].map(l => l.state());
    return { frame: s.frame ?? null, owner: s.frame?.owner, roadSky: s.frame?.roadSky, dome, layers, programs: g.renderer.info.programs.length, feet: s.live?.live?.worldFeet, current: s.live?.live?.current ?? null, lightDir: g.sky.csm.lightDirection.toArray().map(v => +v.toFixed(3)) };
  });
  out.base0 = await sample(240);
  out.base1 = await sample(240);
  for (const e of exps) {
    if (e === 'nodome') await page.evaluate(() => { const g = window.__wildshard.world.game; g.rootScene.traverse(o => { if (o.name === 'road-sky') { o.visible = false; Object.defineProperty(o, 'visible', { get: () => false, set: () => {}, configurable: true }); } }); });
    if (e === 'nolayers') await page.evaluate(() => { const g = window.__wildshard.world.game; for (const l of g.sky.layers) { l.__w = l.weight; l.weight = 0; Object.defineProperty(l, 'weight', { get: () => 0, set: () => {}, configurable: true }); } });
    if (e === 'nocsm2') await page.evaluate(() => { const sky = window.__wildshard.world.game.sky; const orig = sky.csm.update.bind(sky.csm); let n = 0; sky.csm.update = () => { if (++n % 2 === 0) return; orig(); }; });
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
    if (e === 'gpu') {
      out.gpu = await page.evaluate(() => new Promise((resolve) => {
        const g = window.__wildshard.world.game, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) { resolve('no ext'); return; }
        const c = g.composer, orig = c.render, pending = [], ms = [];
        c.render = function (...a) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); try { return orig.apply(this, a); } finally { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); } };
        const poll = () => {
          while (pending.length > 0 && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) { const q = pending.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
          if (ms.length < 240) { requestAnimationFrame(poll); return; }
          c.render = orig;
          const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return Math.round(s[Math.max(0, Math.ceil(s.length * p) - 1)] * 100) / 100; };
          resolve({ gpu50: pct(ms, 0.5), gpu95: pct(ms, 0.95), gpuMax: pct(ms, 1) });
        };
        requestAnimationFrame(poll);
      }));
      continue;
    }
    if (e === 'programs') { out.programsAfter = await page.evaluate(() => window.__wildshard.world.game.renderer.info.programs.length); continue; }
    await page.waitForTimeout(1000);
    out[e] = await sample(240);
  }
  out.errs = errs.slice(0, 20);
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
