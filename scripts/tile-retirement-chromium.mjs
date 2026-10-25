#!/usr/bin/env node
// T1: browser-lane.sh --max 35 node scripts/tile-retirement-chromium.mjs --base=URL --pin=SHA --out=DIR
// One warm DW/Sky round trip, then five measured returns. No forced GC or navigation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { devices } from 'playwright';
import { launchMemoryBrowser } from './chromium-memory-browser.mjs';
import { chromiumProcessPeaks } from './grid-ready-memory.mjs';
import { saveFixture, harnessPins } from './debug-settings.mjs';
import { frameFloorSettingsCode } from './frame-floor-settings.mjs';
import { floorGridBenchmarkUrl, FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures,
  readFloorGridEntryways } from './frame-floor-grid.mjs';
import { soakPortalPlan } from './soak/owned.mjs';
import { tileRetirementRoute, tileRetirementTracker, gradeTileRetirement, readRetirementBoundary, seedTileRetirementHome, readRetirementResources, readRetirementProgramBuilds } from './tile-retirement-proof.mjs';

const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
if (process.argv.includes('--help')) {
  console.info('scripts/browser-lane.sh --max 35 node scripts/tile-retirement-chromium.mjs --base=URL --pin=FULL_SHA --out=FRESH_DIR');
  console.info('T1 only: warm DW/Sky once, then five held-input round trips; >=20 observed tile lifetimes, zero ghosts, each return within 20 MB. No FPS/Simulator/soak clearance.');
  console.info('--diagnostic=resources adds renderer/ledger/heap reads; diagnostic receipts cannot claim acceptance.');
  process.exit(0);
}
const base = arg('base'), pin = arg('pin'), out = arg('out');
const diagnostic = arg('diagnostic');
if (diagnostic !== undefined && diagnostic !== 'resources') throw new Error('Unknown retirement diagnostic');
if (!base || !pin || !/^[a-f0-9]{40}$/u.test(pin) || !out) throw new Error('Requires --base, --pin and --out');
if (existsSync(resolvePath(out, 'receipt.json'))) throw new Error('Retirement evidence already exists; use a fresh directory');
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served source differs from requested pin');
mkdirSync(out, { recursive: true });
const receipt = { source: pin, complete: false, acceptanceEligible: diagnostic === undefined, errors: [], routes: [], boundaries: [],
  protocol: { device: 'iPhone 16 Pro', tier: 'phone', cpu: 4, renderScale: 2, developer: true,
    roundTrips: 5, warmupRoundTrips: 1, settleSeconds: 45, forcedGC: false, inspectorBodyBytes: 0,
    toolHashes: Object.fromEntries(['tile-retirement-chromium.mjs', 'tile-retirement-proof.mjs', 'frame-floor-grid.mjs',
      'soak/owned.mjs', 'grid-ready-memory.mjs', 'chromium-memory-browser.mjs'].map(path =>
      [path, createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex')])),
    memory: 'One dedicated Chromium: renderer + GPU private footprint. Browser overhead separate. Endpoint dumps, no FPS claim.',
    diagnostic: diagnostic ?? null,
    backingStorage: diagnostic === undefined ? null : 'CDP backingStorageSize includes ArrayBuffers and external strings; ledger RAM allocations are tracked identities only. No forced GC.',
    cycles: 'Observed render claim acquisition/removal lifetimes at 1 Hz; missed lifetimes undercount, never interpolate.' } };
const write = () => writeFileSync(resolvePath(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
const memoryBrowser = await launchMemoryBrowser(['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist']);
let stopPoll = false, polling;
process.once('SIGTERM', () => { stopPoll = true; void memoryBrowser.close(); });
try {
  const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
  const context = await memoryBrowser.browser.newContext(phone), page = await context.newPage();
  const browserSession = await memoryBrowser.browser.newBrowserCDPSession(), cdp = await context.newCDPSession(page);
  page.on('pageerror', error => { receipt.errors.push(error.message); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await context.addInitScript({ content: frameFloorSettingsCode({ tier: 'phone', fps: 'auto' }) });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await harnessPins(context, { seed: 357, browser: 'Chromium / iPhone 16 Pro', lane: 'sp-x9-tile-retirement' });
  await page.goto(floorGridBenchmarkUrl(base), { waitUntil: 'load' });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady,
    undefined, { timeout: 240_000 });
  await page.evaluate(FLOOR_GRID_ENTER);
  await page.waitForFunction(() => !document.querySelector('#hud')?.classList.contains('ws-grid-revealing'),
    undefined, { timeout: 30_000 });
  const profile = await page.evaluate(() => ({ tier: window.__wildshard.boot.tier,
    clock: window.__wildshard.app.clock.mode, renderScale: window.__wildshard.world.game.renderer.getPixelRatio() }));
  if (profile.tier !== 'phone' || profile.clock !== 'live' || profile.renderScale !== 2)
    throw new Error('Wrong phone profile');
  const identity = await page.evaluate(gridFloorDocumentIdentity);
  const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const route = tileRetirementRoute(state), cells = state.cells.filter(cell => ['driftwood-isle', 'far-reach'].includes(cell.slug));
  const entryways = new Map();
  for (const cell of cells) entryways.set(cell.slug,
    await page.evaluate(`(${readFloorGridEntryways.toString()})(${JSON.stringify(`/shardfiles/${cell.slug}/shard.json`)})`));
  const plans = route.plans.map(plan => soakPortalPlan(plan, state.cells, entryways, state.pitch));
  await page.evaluate(`(${seedTileRetirementHome.toString()})(${JSON.stringify(route.reference)},
    ${JSON.stringify(identity)},(${gridFloorDocumentIdentity.toString()}))`);

  const read = () => page.evaluate(`(${readRetirementBoundary.toString()})(${JSON.stringify(identity)},
    (${gridFloorDocumentIdentity.toString()}))`);
  const tracker = tileRetirementTracker();
  polling = (async () => {
    while (!stopPoll) {
      try { tracker.observe((await read()).keys); }
      catch (error) { receipt.errors.push(`Retirement sampler: ${String(error)}`); stopPoll = true; }
      if (!stopPoll) await sleep(1000);
    }
  })();
  const dump = async label => {
    const events = [], collect = event => { events.push(...event.value); };
    browserSession.on('Tracing.dataCollected', collect);
    try {
      await browserSession.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: {
        includedCategories: ['disabled-by-default-memory-infra'], memoryDumpConfig: { triggers: [] } } });
      const dumped = await browserSession.send('Tracing.requestMemoryDump', { levelOfDetail: 'detailed', deterministic: false });
      const completed = new Promise(resolve => { browserSession.once('Tracing.tracingComplete', resolve); });
      await browserSession.send('Tracing.end'); await completed;
      if (!dumped.success) throw new Error('Process memory dump failed');
      writeFileSync(resolvePath(out, `${label}-memory.json`), JSON.stringify(events));
      return chromiumProcessPeaks(events);
    } finally { browserSession.off('Tracing.dataCollected', collect); }
  };
  const boundary = async label => {
    // Forty-five seconds exceeds the original 30-second ghost grace. Never
    // trigger GC, change the ring, evict a cache or navigate to make it pass.
    const programStart = diagnostic === undefined ? undefined : await page.evaluate(() => ({ at: performance.now(),
      builds: window.__wildshard.world.game.nodeBuilds?.builds ?? null,
      programs: window.__wildshard.world.game.renderer.info.programs?.length ?? null }));
    await sleep(45_000);
    const deadline = Date.now() + 120_000;
    let row = await read();
    while ((!row.ready || !row.controls || row.pending !== 0 || row.retiring !== 0 || row.inFlight !== 0 || row.queued !== 0) && Date.now() < deadline) {
      await sleep(1000); row = await read();
    }
    let resources;
    if (diagnostic !== undefined) {
      const heap = await cdp.send('Runtime.getHeapUsage');
      resources = { ...await page.evaluate(readRetirementResources), heap,
        programSteady: { start: programStart, end: await page.evaluate(readRetirementProgramBuilds) } };
      writeFileSync(resolvePath(out, `${label}-resources.json`), JSON.stringify(resources, null, 2));
    }
    const result = { ...row, process: await dump(label), ...(resources === undefined ? {} : { resources }) };
    receipt.boundaries.push({ label, ...result }); write();
    console.info(JSON.stringify({ boundary: label, ...result, keys: undefined, resources: undefined }));
    return result;
  };
  const roundTrip = async round => {
    for (const plan of plans) {
      const witness = await runFloorGridRoute(page, plan, identity);
      const failures = gridFloorWitnessFailures(witness);
      receipt.routes.push({ round, witness, failures }); write();
      if (failures.length > 0) throw new Error(`Retirement route refused: ${failures.join('; ')}`);
    }
  };
  await roundTrip('warmup');
  const baseline = await boundary('baseline'), returns = [];
  for (let round = 1; round <= 5; round++) { await roundTrip(round); returns.push(await boundary(`return-${round}`)); }
  stopPoll = true; await polling;
  receipt.cycles = tracker.result();
  receipt.grade = gradeTileRetirement({ baseline, returns, cycles: receipt.cycles.cycles, errors: receipt.errors });
  receipt.complete = true;
  if (!receipt.grade.pass) process.exitCode = 2;
} catch (error) { receipt.errors.push(String(error)); process.exitCode = 2; }
finally {
  stopPoll = true;
  await memoryBrowser.close();
  await polling;
  write();
}

