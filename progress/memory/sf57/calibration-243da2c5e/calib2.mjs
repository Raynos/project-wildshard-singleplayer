// SF57 calibration probe 2: per-owner labelled GL + the engine's RAM attribution, public grid home vs standalone
// Driftwood, texture mode img (the Simulator's mode), Chromium "iPhone 16 Pro", muted. Lists the allocator's claims.
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { publicGridIntentCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/public-grid.mjs';
import { GL_INIT } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/parity/glbytes.mjs';
import { debugSettings } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4402';
const OUT = process.argv[3] ?? 'calib2.json';
const pages = (process.argv[4] ?? 'standalone,public').split(',');
const out = [];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
for (const page0 of pages) {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(GL_INIT);
  await context.addInitScript({ content: 'window.__wildshardHarness={seed:357,capture:null};' });
  await debugSettings(context, { tex: 'img' });
  if (page0 === 'public') await context.addInitScript(publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction((p) => {
    const api = window.__wildshard; if (!api?.world) return false;
    if (p === 'standalone') return api.state?.().appState === 'play';
    const s = api.shard?.grid?.state?.(); const live = s?.live?.live;
    return live?.current === 'driftwood-isle' && live.gameplayReady === true && s.rings?.inFlight === 0;
  }, page0, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow?.(); });
  await page.waitForTimeout(15000);
  const r = await page.evaluate(() => {
    window.gc?.();
    const ctx = window.__sc_gl();
    const byOwner = {}, byAsset = {};
    let total = 0;
    for (const c of ctx) for (const res of c.resources) {
      total += res.bytes;
      const o = res.owner; byOwner[o] = (byOwner[o] ?? 0) + res.bytes;
      const a = `${res.owner} | ${res.asset.split('/').slice(0, 3).join('/')} | ${res.kind}`; byAsset[a] = (byAsset[a] ?? 0) + res.bytes;
    }
    const api = window.__wildshard;
    const mem = typeof api.memory === 'function' ? api.memory() : null;
    const ram = {}, gpu = {};
    for (const a of mem?.allocations ?? []) { const t = a.domain === 'ram' ? ram : gpu; t[a.owner] = (t[a.owner] ?? 0) + a.bytes; }
    const res = api.shard?.grid?.residency?.();
    const claims = res ? res.claims.map(c => ({ id: c.id, category: c.category, bytes: c.bytes, accounted: c.accountedBytes, coveredBy: c.coveredBy ?? null })) : null;
    const heap = performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null;
    return { textures: api.textures?.(), total, byOwner, byAsset, ram, gpu, memTotals: mem?.totals ?? null, unattributed: mem?.unattributed ?? null, claims, accounted: res?.cost?.accounted ?? null, heap };
  });
  const mb = (x) => +(x / 1e6).toFixed(2);
  const sortMb = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, mb(v)]));
  const row = { page: page0, mode: r.textures?.mode, why: r.textures?.why, glMB: mb(r.total), glByOwner: sortMb(r.byOwner), glByAsset: sortMb(r.byAsset),
    ramByOwner: sortMb(r.ram), gpuAttrByOwner: sortMb(r.gpu), memTotals: r.memTotals, unattributed: r.unattributed, heapMB: r.heap && { used: mb(r.heap.used), total: mb(r.heap.total) },
    accountedMB: r.accounted === null ? null : mb(r.accounted), claims: r.claims, errors: errors.slice(0, 5) };
  out.push(row);
  console.error(page0, row.mode, row.glMB, row.accountedMB);
  await context.close();
}
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
await browser.close();
