// cold grid start probe: where the 'Weapons · HUD' step spends its time (Chromium iPhone 16 Pro, 4x CPU, muted)
import { writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const BASE = process.argv[2], OUT = process.argv[3];
const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0, time: 'midday' } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }), saveFixtureCode({ scope: 'device', key: 'devMode', data: true })].join(';');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = { console: [], requests: [], steps: [] };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(`${fixtures};window.__wildshardHarness={seed:357,capture:null};
    (()=>{const t=[];window.__lt=t;try{new PerformanceObserver(l=>{for(const e of l.getEntries())t.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask'})}catch{}})();`);
  const page = await context.newPage();
  page.on('console', (m) => { out.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('requestfinished', (r) => { const u = r.url(); if (/viewmodel|worker|ktx2|sword|weapon/iu.test(u)) out.requests.push(u.slice(-90)); });
  await page.goto(`${BASE}?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')), null, { timeout: 600000, polling: 500 });
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100); });
  const t0 = Date.now(); let prof = 0;
  for (;;) {
    const st = await page.evaluate(() => ({ text: document.querySelector('.ws-load')?.innerText?.split('\n').filter(l => /step/u.test(l)).slice(0, 1).join('') ?? '', done: !document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid), now: performance.now() })).catch(() => ({ text: 'nav', done: false, now: 0 }));
    out.steps.push([(Date.now() - t0) / 1000, Math.round(st.now), st.text]);
    if (prof === 0 && /Animals|Weapons/u.test(st.text)) { const c2 = await context.newCDPSession(page); await c2.send('Profiler.enable'); await c2.send('Profiler.setSamplingInterval', { interval: 2000 }); await c2.send('Profiler.start'); prof = c2; }
    if (prof && prof !== 1 && /Title art|Shaders · 1/u.test(st.text)) { const { profile } = await prof.send('Profiler.stop'); writeFileSync(OUT + '.cpuprofile', JSON.stringify(profile)); prof = 1; }
    if (st.done || Date.now() - t0 > 120000) break;
    await new Promise(r => setTimeout(r, 200));
  }
  out.longtasks = await page.evaluate(() => window.__lt);
  out.timing = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /viewmodel|worker|blob:/iu.test(e.name)).map(e => [e.name.slice(-80), Math.round(e.startTime), Math.round(e.duration)]));
} finally { writeFileSync(OUT, JSON.stringify(out, null, 1)); await browser.close(); }
