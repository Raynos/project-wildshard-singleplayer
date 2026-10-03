// gputime.mjs <url>: GPU ms per composer frame (EXT_disjoint_timer_query_webgl2) at the mock views, meadow on and off.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
const REPO = '/Users/raynos/projects/games/wildshard-singleplayer';
const { chromium } = await import(join(REPO, 'node_modules/playwright/index.mjs'));
const { saveFixture } = await import(join(REPO, 'scripts/debug-settings.mjs'));
const URL_BASE = process.argv[2];
const shots = JSON.parse(readFileSync(join(REPO, 'art/far-reach/progress/cameras.json'), 'utf8')).shots.filter((s) => ['mock-A-spawn-look', 'mock-B-quest-start', 'mock-C-hands-fan', 'mock-proposal-B'].includes(s.id));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const D = Math.PI / 180;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 0x2545f491, capture: null, lane: 'local', sha: '', browser: 'chromium', errors: [], saves: { read: [], written: [] }, audioRequests: [], gpuBytes: () => ({ textures: 0, renderbuffers: 0, buffers: 0, total: 0 }) }; });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/?chunk=far-reach&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player && window.__wildshard?.world?.game) && document.querySelector('.ws-load') === null, undefined, { timeout: 480000, polling: 1000 });
  await sleep(4000);
  await page.evaluate(() => {
    const g = window.__wildshard.world.game, gl = g.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), comp = g._composer;
    const orig = comp.render.bind(comp), pending = []; window.__gpu = [];
    comp.render = (...a) => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig(...a); gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q);
      for (let i = pending.length - 1; i >= 0; i--) { const p = pending[i]; if (gl.getQueryParameter(p, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) window.__gpu.push(gl.getQueryParameter(p, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(p); pending.splice(i, 1); } } };
    let m = null; g.scene.traverse((o) => { if (o.name === 'far.meadow') m = o; }); window.__meadow = m;
  });
  for (const s of shots) {
    await page.evaluate((p) => { window.__wildshard.pose(p); }, { x: s.x, z: s.z, yaw: s.yaw * D, pitch: (s.pitch ?? -4) * D, ...(s.y === undefined ? {} : { y: s.y }) });
    const row = [];
    for (const on of [true, false]) {
      await page.evaluate((v) => { window.__meadow.visible = v; window.__gpu = []; }, on);
      await sleep(3000);
      const t = await page.evaluate(() => { const a = [...window.__gpu].sort((x, y) => x - y); return { n: a.length, p50: a[Math.floor(a.length / 2)], p90: a[Math.floor(a.length * 0.9)] }; });
      row.push(`${on ? 'meadow' : 'none'} p50 ${t.p50?.toFixed(2)} p90 ${t.p90?.toFixed(2)} (n ${t.n})`);
    }
    console.log(s.id.padEnd(20), row.join(' | '));
  }
} finally { await browser.close(); }
