// SF57 spike probe (Chromium, desktop): drive the shipped public cells circuit and attribute WC-side allocation bursts.
// node probe.mjs <base> <out.json> [circuits=2]
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { GL_INIT } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/parity/glbytes.mjs';
import { installResources } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/parity/resources.mjs';
import { saveFixtureCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
import { soakGridEntry, ownedSoakPlans } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/owned.mjs';
import { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/frame-floor-grid.mjs';

const [base, outFile, circuitsArg = '2', mode = 'census'] = process.argv.slice(2);
const circuits = Number(circuitsArg);
const entry = soakGridEntry('shipped');
const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: false }), entry.fixture].join(';');
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const out = { base, timeline: [], routes: [], profiles: [] };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await context.addInitScript(`if(!sessionStorage.getItem('sf57probe')){localStorage.clear();sessionStorage.setItem('sf57probe','1');}${mode === 'census' ? GL_INIT + ';' : ''}(${installResources.toString()})();window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources(),gpuBytes:()=>(window.__sc_gl?.()??[]).reduce((sum,c)=>sum+c.totalBytes,0)};${fixtures}`);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  const cdp = await context.newCDPSession(page);
  await page.goto(`${base}${entry.query}`);
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live, null, { timeout: 240000, polling: 1000 });
  await page.evaluate('(window.__wildshard.world.hud.enterNow(),true)');
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 60000, polling: 500 });
  const state = await page.evaluate('window.__wildshard.shard.grid.state()');
  const route = ownedSoakPlans(state, 'cells', 'catalogue', entry.home);
  const documentOrigin = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
  await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(documentOrigin)})`);
  await cdp.send('HeapProfiler.enable');
  const t0 = Date.now();
  let label = 'idle', polling = true;
  const poll = (async () => {
    while (polling) {
      try {
        const heap = await cdp.send('Runtime.getHeapUsage');
        const pm = await page.evaluate('({u:performance.memory.usedJSHeapSize,t:performance.memory.totalJSHeapSize,inside:window.__wildshard.shard.grid.state().inside,cur:window.__wildshard.shard.grid.state().live.live.current})');
        out.timeline.push({ t: (Date.now() - t0) / 1000, label, used: heap.usedSize, total: heap.totalSize, embedder: heap.embedderHeapUsedSize, backing: heap.backingStorageSize, inside: pm.inside, cur: pm.cur });
      } catch { /* navigation */ }
      await new Promise((r) => setTimeout(r, 100));
    }
  })();
  for (let c = 0; c < circuits; c++) {
    for (const plan of route.plans) {
      label = `${c}:${plan.name}`;
      const start = (Date.now() - t0) / 1000;
      const exitWindow = plan.name === 'template-3-to-template-4' || plan.name === 'template-4-to-template-5';
      const driving = runFloorGridRoute(page, plan, documentOrigin);
      let profile = { head: { callFrame: { functionName: 'none', url: '', lineNumber: 0, columnNumber: 0 }, selfSize: 0, children: [] } };
      if (exitWindow) {
        // the exit: from the moment the player leaves the cell interior, 5 s; the control: 5 s on the open road 25 s in
        if (plan.name === 'template-3-to-template-4') { while ((out.timeline.at(-1)?.inside ?? null) !== null) await new Promise((r) => setTimeout(r, 50)); }
        else await new Promise((r) => setTimeout(r, 25000));
        out.routes.push({ label: label + ':window', start: (Date.now() - t0) / 1000 });
        await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
        await new Promise((r) => setTimeout(r, 5000));
        profile = (await cdp.send('HeapProfiler.stopSampling')).profile;
      }
      const witness = await driving;
      // aggregate self size by top-3 frames
      const agg = new Map();
      const walk = (node, stack) => {
        const frame = `${node.callFrame.functionName || '(anon)'}@${node.callFrame.url.split('/').pop()}:${node.callFrame.lineNumber}:${node.callFrame.columnNumber}`;
        const s = [...stack, frame];
        if (node.selfSize > 0) { const key = s.slice(-6).join(' < '); agg.set(key, (agg.get(key) ?? 0) + node.selfSize); }
        for (const child of node.children) walk(child, s);
      };
      walk(profile.head, []);
      const total = [...agg.values()].reduce((a, b) => a + b, 0);
      out.profiles.push({ label, total, top: [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ mb: Math.round(v / 1e5) / 10, stack: k })) });
      out.routes.push({ label, start, end: (Date.now() - t0) / 1000, failures: witness.failures ?? null, after: witness.after?.live?.live?.current ?? null });
      console.log(label, ((Date.now() - t0) / 1000).toFixed(1), 'sampled MB', (total / 1e6).toFixed(1));
      writeFileSync(outFile, JSON.stringify(out));
    }
  }
  polling = false; await poll;
} finally {
  writeFileSync(outFile, JSON.stringify(out));
  await browser.close();
}
