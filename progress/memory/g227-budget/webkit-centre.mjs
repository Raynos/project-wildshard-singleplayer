// Local WebKit phone-tier RETAINER attribution only. Simulator WC + labelled GL remain the memory ruler.
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { webkit, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute } from '../../../scripts/frame-floor-grid.mjs';
import { AUDIO_INIT, WASM_INIT, snapshotExpression, heapOwners } from './inspect.mjs';
import { CPU_INIT, cpuOwnersExpression } from '../../../scripts/memory/cpuOwners.mjs';

const [base, out, slug = 'nalati-grasslands', memorySaver = 'on'] = process.argv.slice(2);
const cpuOwners = process.argv.includes('--cpu-owners');
if (!base || !out || !['pine-hollow', 'nalati-grasslands'].includes(slug) || !['on', 'off'].includes(memorySaver)) {
  throw new Error('Pass BASE OUT_JSON [pine-hollow|nalati-grasslands] [on|off]; wrap with browser-lane.sh');
}
const report = { protocol: 'Mac Playwright WebKit at phone tier: retainer attribution, NOT a Simulator or physical-iPhone memory total.',
  slug, memorySaver, cpuOwners, routes: [], snapshots: [] };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const timeout = async (promise, ms) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Local heap diagnostic timed out')), ms); })]); }
  finally { clearTimeout(timer); }
};
let browser, page;
try {
  report.version = await (await fetch(new URL('version.json', base))).json(); save();
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const fixtures = [
    {scope:'global',key:'settings',data:{tier:'phone',fps:'auto',tex:'auto',memorySaver,volume:0},merge:true},
    {scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}}, {scope:'device',key:'devMode',data:true},
  ].map(saveFixtureCode).join(';');
  await context.addInitScript({ content: (cpuOwners ? CPU_INIT + ';' : '') + GL_INIT + ';' + WASM_INIT + ';' + AUDIO_INIT + ';' + fixtures + ';window.__wildshardHarness={seed:357,capture:null};window.__gridAdmissionLongTasks=[];' });
  page = await context.newPage();
  report.errors = []; report.warnings = [];
  page.on('pageerror', error => { report.errors.push(String(error)); save(); });
  page.on('console', message => { if (message.type() === 'warning') report.warnings.push(message.text()); });
  // Diagnostic-only local protocol: in-process Playwright exposes its WebKit page delegate.
  // Fail closed if a future Playwright changes this seam; never fall back to a different engine.
  const impl = page._connection.toImpl?.(page);
  if (!impl?.delegate) throw new Error('Playwright local WebKit delegate unavailable');
  const send = (method, params) => impl.delegate._session.send(method, params);
  report.stage = 'local-protocol'; save();
  // A query-bearing URL is a selected-shard boot in bootRoute; the plain title is required for the real grid tap.
  // Phone controls/tier and silence are seeded in settings, not selected through a boot URL.
  await page.goto(base);
  const probe = await send('Runtime.evaluate', { expression: '1+1', returnByValue: true });
  if (probe.result.value !== 2) throw new Error('Local WebKit protocol probe failed');
  report.stage = 'grid-entry'; save();
  await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')) || Boolean(document.getElementById('wserr')), undefined, { timeout: 180000 });
  if (await page.locator('#wserr').count()) throw new Error('Title boot failed: ' + await page.locator('#wserr').innerText());
  await page.locator('.ws-main-grid').click();
  report.stage = 'grid-load'; save();
  await page.waitForFunction(() => Boolean(document.getElementById('wserr')) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), undefined, { timeout: 240000 });
  if (await page.locator('#wserr').count()) throw new Error('Grid boot failed: ' + await page.locator('#wserr').innerText());
  await page.evaluate(() => window.__wildshard.world.hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, undefined, { timeout: 45000 });
  const origin = await page.evaluate(gridFloorDocumentIdentity);
  report.documentIdentity = origin;
  const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const home = state.cells.find(cell => cell.instance === state.home), target = state.cells.find(cell => cell.slug === slug);
  if (!home || !target) throw new Error('Missing catalogue home/target');
  const plans = slug === 'pine-hollow' ? [gridFloorPlans(state, 'runtime-travel')[0]] : [{ name: 'nalati-direct', from: home.instance,
    to: target.instance, start: {x:230,z:0}, waypoints: [{x:target.cell[0]*555-230,z:target.cell[1]*555}], requiredResidents: [target.instance] }];
  for (const plan of plans) {
    report.stage = 'route:' + plan.name; save();
    report.routes.push(await runFloorGridRoute(page, plan, origin));
  }
  report.stage = 'route:centre'; save();
  report.routes.push(await runFloorGridRoute(page, { name: slug + '-centre', from: target.instance, to: target.instance,
    waypoints: [{x:target.cell[0]*555,z:target.cell[1]*555}], requiredResidents: [target.instance] }, origin));
  await sleep(8000);
  if (cpuOwners) report.cpuBeforeHeap = await page.evaluate(cpuOwnersExpression);
  const snapshot = await page.evaluate(snapshotExpression);
  if (snapshot.settings?.memorySaver !== memorySaver) throw new Error('Memory saver setting mismatch');
  report.snapshots.push({ label: slug + '-centre', ...snapshot }); save();
  // The heap command collects. Freeze only after the unchanged original pose census, then restore in finally.
  await page.evaluate(() => { const game = window.__wildshard.world.game; window.__g227SavedFrameGate = game.frameGate; game.frameGate = () => false; });
  try {
    report.stage = 'heap-snapshot'; save();
    await send('Heap.enable');
    const heap = await timeout(send('Heap.snapshot'), 300000);
    const path = out.replace(/\.json$/u, '') + '.heap.json';
    writeFileSync(path, heap.snapshotData);
    report.heap = { path, timestamp: heap.timestamp, pose: slug + '-centre', transport: 'local Playwright WebKit pipe' }; save();
    report.stage = 'heap-owners'; save();
    if (cpuOwners) { report.cpuAfterHeap = await page.evaluate(cpuOwnersExpression); save(); }
    const owners = await heapOwners({ send }, JSON.parse(heap.snapshotData));
    const ownersPath = out.replace(/\.json$/u, '') + '.heap-owners.json';
    writeFileSync(ownersPath, JSON.stringify(owners, null, 2) + '\n'); report.heap.ownersPath = ownersPath;
  } finally {
    await page.evaluate(() => { const game = window.__wildshard?.world?.game; if (game && window.__g227SavedFrameGate) game.frameGate = window.__g227SavedFrameGate; delete window.__g227SavedFrameGate; }).catch(() => undefined);
  }
} catch (error) {
  report.failure = String(error); process.exitCode = 1;
  report.diagnostic = await page?.evaluate(() => ({ url: location.href, origin: performance.timeOrigin, token: window.__frameFloorGridDocumentToken, body: document.body.innerText.slice(-3000) })).catch(() => null);
} finally {
  await browser?.close(); report.closed = true; save();
}
