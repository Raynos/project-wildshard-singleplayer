// Receipt-only diagnostic: existing shipped route, allocation sampling and bounded large-buffer constructor records.
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { createWriteStream, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { saveFixtureCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
import { soakGridEntry, ownedSoakPlans, soakWitnessFailures } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/soak/owned.mjs';
import { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw Error('base and output prefix required');
const entry = soakGridEntry('shipped');
const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: false }), entry.fixture].join(';');
const result = { base, version: await (await fetch(new URL('version.json', base))).json(), routes: [], samples: [], errors: [], buffers: null, profile: null };
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
let cdp, polling = false, poll;
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await context.addInitScript(`localStorage.clear();sessionStorage.clear();window.__wildshardHarness={seed:357,capture:null};${fixtures};
    window.__checkpointBuffers={active:false,rows:[],bytes:0,count:0};
    for(const name of ['Uint8Array','Int32Array']){const Original=globalThis[name];globalThis[name]=new Proxy(Original,{construct(target,args){const value=Reflect.construct(target,args,target);const d=window.__checkpointBuffers;if(d.active&&value.byteLength>=65536&&!(args[0] instanceof ArrayBuffer)){d.bytes+=value.byteLength;d.count++;if(d.rows.length<64)d.rows.push({name,bytes:value.byteLength,at:performance.now(),stack:new Error().stack});}return value;}});}`);
  const page = await context.newPage();
  page.on('pageerror', error => result.errors.push(String(error.stack ?? error)));
  cdp = await context.newCDPSession(page);
  await page.goto(`${base}${entry.query}`);
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live, null, { timeout: 240000 });
  await page.evaluate('(window.__wildshard.world.hud.enterNow(),true)');
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 60000 });
  const route = ownedSoakPlans(await page.evaluate('window.__wildshard.shard.grid.state()'), 'cells', 'catalogue', entry.home);
  const identity = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
  await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(identity)})`);
  await cdp.send('HeapProfiler.enable');
  const snapshot = async label => {
    const stream = createWriteStream(`${out}-${label}.heapsnapshot`);
    const write = ({ chunk }) => stream.write(chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', write);
    try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
    finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', write); await new Promise(resolve => stream.end(resolve)); }
  };
  for (const plan of route.plans) {
    const measured = plan.name === 'template-2-to-template-3';
    if (measured) {
      await snapshot('before'); // Stationary: outside travel, never part of the Simulator ruler.
      await page.evaluate('window.__checkpointBuffers.active=true');
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      polling = true;
      poll = (async () => { while (polling) { result.samples.push({ at: Date.now(), ...await cdp.send('Runtime.getHeapUsage') }); await sleep(100); } })();
    }
    const start = Date.now(), witness = await runFloorGridRoute(page, plan, identity);
    result.routes.push({ name: plan.name, start, end: Date.now(), trace: witness.trace, failures: soakWitnessFailures(witness) });
    console.log(plan.name, witness.elapsedSeconds, result.routes.at(-1).failures);
    if (measured) {
      polling = false; await poll;
      result.profile = (await cdp.send('HeapProfiler.stopSampling')).profile;
      result.buffers = await page.evaluate('(window.__checkpointBuffers.active=false,window.__checkpointBuffers)');
      await snapshot('after');
      break;
    }
  }
} catch (error) { result.errors.push(String(error.stack ?? error)); }
finally { polling = false; await poll?.catch(() => undefined); writeFileSync(`${out}.json`, JSON.stringify(result)); await browser.close(); }
