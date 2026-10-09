// SF57 spike probe (iOS Simulator Safari): one public cells circuit with WebKit memory categories + GC events + native
// footprint, with the soak's GL census pins (mode=census) or without them (mode=plain). Run inside scripts/sim-lane.sh.
// node simprobe.mjs <base> <dist> <outdir> <census|plain> [circuits=1]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
const R = '/Users/raynos/projects/games/wildshard-singleplayer';
const { soakInspector } = await import(`${R}/scripts/soak/inspector.mjs`);
const { GL_INIT } = await import(`${R}/scripts/parity/glbytes.mjs`);
const { installSoakGl, installSoakWasm, installLoadingGlJournal, installSoakDiagnostics } = await import(`${R}/scripts/soak/gl.mjs`);
const { installResources } = await import(`${R}/scripts/parity/resources.mjs`);
const { saveFixtureCode } = await import(`${R}/scripts/debug-settings.mjs`);
const { ownedSoakPlans, soakAsyncEvaluator, soakGridEntry } = await import(`${R}/scripts/soak/owned.mjs`);
const { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute } = await import(`${R}/scripts/frame-floor-grid.mjs`);

const [base, dist, out, mode, circuitsArg = '1'] = process.argv.slice(2);
const udid = process.env.SIM_UDID; if (!udid) throw new Error('run inside sim-lane');
mkdirSync(out, { recursive: true });
const entry = soakGridEntry('shipped');
const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: false }), entry.fixture].join(';');
const census = mode === 'census';
const pins = `${census ? `${GL_INIT};` : ''}(${installSoakWasm.toString()})();(${installResources.toString()})();window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources(),gpuBytes:()=>(window.__sc_gl?.()??[]).reduce((sum,c)=>sum+c.totalBytes,0)};window.__sf57Errors=[];window.__sf57DocumentId=Date.now()+':'+Math.random();(${installSoakDiagnostics.toString()})();${census ? `(${installLoadingGlJournal.toString()})();(${installSoakGl.toString()})();` : ''}${fixtures};`;
const page = `sf57-probe-${mode}.html`;
writeFileSync(join(dist, page), readFileSync(join(dist, 'index.html'), 'utf8').replace(/<script data-sf57-fixture>[\s\S]*?<\/script>/gu, '').replace('<head>', `<head><script data-sf57-fixture>${pins}</script>`));
const xcrun = (args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
async function connect(prefix) {
  for (let attempt = 0; attempt < 120; attempt++) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const p = pages.find((e) => e.url?.startsWith(prefix));
        if (p) { const d = soakInspector(p.webSocketDebuggerUrl); await d.opened; await sleep(500); return d; }
      } catch { /* discovery */ }
    }
    await sleep(500);
  }
  throw new Error('inspector did not expose the page');
}
const until = async (driver, expression, timeout = 240000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) { try { if (await driver.evaluate(expression)) return; } catch { /* boot */ } await sleep(1000); }
  throw new Error(`timed out: ${expression}`);
};
const result = { mode, routes: [], categories: [], gcs: [], errors: [] };
let proxy, sampler, driver;
const phaseFile = join(out, `${mode}.phase`), nativeFile = join(out, `${mode}-native.jsonl`);
try {
  try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* cold */ }
  proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${xcrun(['getenv', udid, 'RWI_LISTEN_SOCKET'])}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
  xcrun(['openurl', udid, `${base}version.json`]); driver = await connect(`${base}version.json`);
  await driver.evaluate('localStorage.clear();sessionStorage.clear();true');
  writeFileSync(phaseFile, 'loading');
  sampler = spawn('python3', [join(R, 'scripts/sim-mem-phases.py'), '--device', udid, '--phase-file', phaseFile, '--out', nativeFile, '--interval', '1', '--sample-interval-high', '--max', '1500'], { stdio: ['ignore', 'inherit', 'inherit'] });
  await driver.evaluate(`setTimeout(()=>location.replace(${JSON.stringify(`${base}${page}${entry.query}`)}),100);true`);
  driver.close(); driver = await connect(`${base}${page}`);
  await until(driver, 'Boolean(!document.querySelector(".ws-load") && window.__wildshard?.shard?.grid?.state().live?.live)');
  await driver.evaluate('(window.__wildshard.world.hud.enterNow(),true)');
  await until(driver, 'window.__wsReveal?.endedMs != null', 45000);
  const drain = async () => { if (census) await driver.evaluate('(window.__sf57GL?.splice(0),window.__sf57GLEvents?.splice(0),window.__sf57GLUploads?.splice(0),true)'); };
  const state = await driver.evaluate('window.__wildshard.shard.grid.state()');
  const route = ownedSoakPlans(state, 'cells', 'catalogue', entry.home);
  const origin = await driver.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
  const pageApi = { evaluate: soakAsyncEvaluator((e) => driver.evaluate(e), drain) };
  await pageApi.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(origin)})`);
  driver.on('Memory.trackingUpdate', (p) => { result.categories.push({ at: Date.now() / 1000, ts: p.event.timestamp, c: Object.fromEntries(p.event.categories.map((x) => [x.type, x.size])) }); });
  driver.on('Heap.garbageCollected', (p) => { result.gcs.push({ at: Date.now() / 1000, ...p.collection }); });
  await driver.send('Memory.enable'); await driver.send('Memory.startTracking');
  await driver.send('Heap.enable');
  writeFileSync(phaseFile, 'baseline'); for (let i = 0; i < 10; i++) { await sleep(1000); await drain(); }
  writeFileSync(phaseFile, 'drive');
  for (let c = 0; c < Number(circuitsArg); c++) for (const plan of route.plans) {
    const start = Date.now() / 1000;
    console.log(c, plan.name, new Date().toISOString());
    const w = await runFloorGridRoute(pageApi, plan, origin);
    result.routes.push({ cycle: c, name: plan.name, start, end: Date.now() / 1000, trace: w.trace?.map((p) => ({ s: p.seconds, x: p.x, z: p.z, cur: p.current })) });
    writeFileSync(join(out, `${mode}.json`), JSON.stringify(result));
  }
  writeFileSync(phaseFile, 'settle'); for (let i = 0; i < 10; i++) { await sleep(1000); await drain(); }
  await driver.send('Memory.stopTracking').catch(() => undefined);
} catch (error) { result.errors.push(String(error?.stack ?? error)); console.log('ERROR', error); }
finally {
  writeFileSync(phaseFile, 'done'); await sleep(2000);
  writeFileSync(join(out, `${mode}.json`), JSON.stringify(result));
  try { driver?.close(); } catch { /* closed */ }
  sampler?.kill(); proxy?.kill();
  try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* gone */ }
}
