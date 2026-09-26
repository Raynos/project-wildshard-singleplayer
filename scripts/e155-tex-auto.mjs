#!/usr/bin/env node
// e155-tex-auto.mjs — E155 × E157 B: with Debug ▸ GPU textures = Auto, every shard BUILT in the page picks its own texture
// mode from its own KTX2 marker (src/boot/gpuFiles.ts), and a shard whose set is not cached never fetches a KTX2 file.
//
//   node scripts/e155-tex-auto.mjs [--url=http://127.0.0.1:5321] [--out=progress/e155]
//
// Phone tier (390×844, touch — written when only the phone had KTX2 stand-ins; the desktop has its own since E173). One browser context (one origin: one service
// worker cache, one localStorage):
//   1. warm-up: a page boots Driftwood and lets the background download (E158) finish — every shard's KTX2 set lands in the
//      worker's cache and its marker (ws.ktx2set.<slug>.phone) is written. The markers are read back.
//   2. first complete, second not: Nalati's marker removed, the background download off (so nothing re-marks). A page
//      boots Driftwood (KTX2 expected) and switches to Nalati in the page (images expected), then back to Driftwood.
//   3. the reverse: Driftwood's marker removed, Nalati's back. Driftwood boots with images, Nalati builds with KTX2.
// Per build: the compressed textures in its scene (> 0 = KTX2, 0 = images) and every /assets/gpu/ request during it (an
// images build must make none; a KTX2 build's must come from the service worker). Muted, Metal, the browser closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5321');
const OUT = resolvePath(flag('out', 'progress/e155'));
mkdirSync(OUT, { recursive: true });
const SLUGS = ['driftwood-isle', 'pine-hollow', 'nalati-grasslands'];
const Q = 'mute=1&nolock=1&touch=1&tier=phone';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const report = { url: URL_BASE, markers: {}, scenarios: [], ok: true, failures: [] };
const fail = (m) => { report.ok = false; report.failures.push(m); console.log(`  FAIL ${m}`); };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const titleUp = (page, slug) => page.waitForFunction((s) => {
    const h = window.__shardHost, hud = document.getElementById('hud');
    return h !== undefined && h.active === s && !h.switching && hud?.classList.contains('intro') === true && document.querySelector('#hud .ws-menu:not(.hide) .ws-menu-play') !== null && document.querySelector('.ws-load') === null;
  }, slug, { timeout: 420000, polling: 250 });
  const compressed = (page) => page.evaluate(() => {
    let n = 0; const seen = new Set();
    window.__world.game.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) for (const v of Object.values(m)) if (v?.isTexture === true && !seen.has(v)) { seen.add(v); if (v.isCompressedTexture === true) n++; } });
    return n;
  });

  // ── 1. warm-up: the background download fills the cache and writes the markers ──
  console.log('── warm-up: boot Driftwood, let the background download finish');
  const warm = await ctx.newPage();
  await warm.goto(`${URL_BASE}/?chunk=driftwood-isle&${Q}`, { waitUntil: 'domcontentloaded' });
  await titleUp(warm, 'driftwood-isle');
  await warm.waitForFunction(() => window.__ws_prefetch !== undefined, undefined, { timeout: 120000 });
  const pre = await warm.evaluate(async () => { const r = await window.__ws_prefetch.done; return { status: r.status, ktx2: Object.fromEntries(Object.entries(r.ktx2).map(([k, v]) => [k, v.complete])) }; });
  report.markers = await warm.evaluate((slugs) => Object.fromEntries(slugs.map((s) => [s, localStorage.getItem(`ws.ktx2set.${s}.phone`)])), SLUGS);
  console.log(`  prefetch ${pre.status}, KTX2 sets complete ${JSON.stringify(pre.ktx2)}\n  markers ${JSON.stringify(report.markers)}`);
  await warm.close();
  if (report.markers['driftwood-isle'] === null || report.markers['nalati-grasslands'] === null) throw new Error('the warm-up wrote no marker for Driftwood / Nalati: nothing to test');

  const scenario = async (name, missing) => {
    console.log(`\n── ${name}: ${missing}'s marker removed, the background download off`);
    const sc = { name, missing, builds: [] };
    const setup = await ctx.newPage();
    await setup.goto(`${URL_BASE}/version.json`);
    await setup.evaluate(({ markers, missing: m }) => {
      for (const [s, v] of Object.entries(markers)) if (v !== null) localStorage.setItem(`ws.ktx2set.${s}.phone`, v);
      localStorage.removeItem(`ws.ktx2set.${m}.phone`);
      const k = 'ws.settings.v1', saved = JSON.parse(localStorage.getItem(k) ?? '{}');
      saved.prefetch = 'off'; saved.tex = 'auto';
      localStorage.setItem(k, JSON.stringify(saved));
    }, { markers: report.markers, missing });
    await setup.close();
    const page = await ctx.newPage();
    const reqs = [];
    page.on('requestfinished', async (r) => { if (r.url().includes('/assets/gpu/')) { const res = await r.response(); reqs.push({ url: r.url().split('/').pop(), sw: res?.fromServiceWorker() ?? false }); } });
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message.slice(0, 200)); });
    const build = async (slug, first) => {
      const at = reqs.length;
      if (first) await page.goto(`${URL_BASE}/?chunk=${slug}&${Q}`, { waitUntil: 'domcontentloaded' });
      else {
        await page.evaluate((k) => { document.querySelector(`#hud .ws-menu:not(.hide) .ws-menu-card[data-i="${k}"]`)?.click(); }, SLUGS.indexOf(slug));
        await sleep(450);
        await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
      }
      await titleUp(page, slug);
      await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
      await page.waitForFunction(() => window.__world?.hud.entered === true, undefined, { timeout: 60000 });
      await sleep(2500);
      const gpu = reqs.slice(at);
      const b = { slug, expect: slug === missing ? 'img' : 'ktx2', compressed: await compressed(page), gpuRequests: gpu.length, gpuFromNetwork: gpu.filter((r) => !r.sw).length };
      sc.builds.push(b);
      console.log(`  ${slug}: ${b.compressed} compressed textures (expected ${b.expect}) · /assets/gpu/ requests ${b.gpuRequests}, from the network ${b.gpuFromNetwork}`);
      if (b.expect === 'ktx2' && b.compressed === 0) fail(`${name}: ${slug}'s set is cached but it built with images`);
      if (b.expect === 'img' && b.compressed > 0) fail(`${name}: ${slug}'s set is not cached but it built with KTX2`);
      if (b.expect === 'img' && b.gpuRequests > 0) fail(`${name}: ${slug} (no cached set) fetched ${b.gpuRequests} KTX2 files`);
      if (b.gpuFromNetwork > 0) fail(`${name}: ${slug} fetched ${b.gpuFromNetwork} KTX2 files past the service worker`);
      await page.evaluate(() => { window.__world.hud.exitToMenu(); });
      await sleep(500);
    };
    await build('driftwood-isle', true);
    await build('nalati-grasslands', false);
    // back to Driftwood (resident): it keeps the mode it was built with
    await page.evaluate((k) => { document.querySelector(`#hud .ws-menu:not(.hide) .ws-menu-card[data-i="${k}"]`)?.click(); }, SLUGS.indexOf('driftwood-isle'));
    await sleep(450);
    await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
    await page.waitForFunction(() => window.__shardHost.active === 'driftwood-isle' && window.__world?.hud.entered === true, undefined, { timeout: 60000 });
    const back = await compressed(page), was = sc.builds[0]?.compressed ?? -1;
    console.log(`  back to driftwood-isle (resident): ${back} compressed textures (built with ${was})`);
    if (back !== was) fail(`${name}: Driftwood's texture mode changed on a resident return (${was} → ${back})`);
    sc.errors = errors;
    if (errors.length > 0) fail(`${name}: page errors ${errors.slice(0, 2).join(' | ')}`);
    report.scenarios.push(sc);
    await page.close();
  };
  await scenario('first complete, second not', 'nalati-grasslands');
  await scenario('first not, second complete', 'driftwood-isle');
} catch (e) {
  fail(`the run threw: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser.close();
}
writeFileSync(resolvePath(OUT, 'tex-auto-report.json'), JSON.stringify(report, null, 1));
console.log(`\n${report.ok ? 'PASS' : 'FAIL'}`);
for (const f of report.failures) console.log(`  - ${f}`);
process.exit(report.ok ? 0 : 1);
