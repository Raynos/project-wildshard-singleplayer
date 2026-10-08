#!/usr/bin/env node
// SF57: each production layout has cell and road-only drives (30 minutes; 60 after a picked content cut).
// --content-cut=<JSON receipt with receipt/sourceRevision/approvedBy=Jake> selects G186; invisible savings never do.
// --qualifying is supplied only after the layout conversions are prepared; all route/refusal gates still apply.
// --dry-run runs five minutes and never qualifies; --legs=cells selects just the cell leg.
// --layouts=shipped runs the M2 layout; the default shipped,dev also prepares the M3 Developer evidence.
// node scripts/soak/soak.mjs --rev=<pushed SHA> --prepare [--out=<directory>]
// --prepared=<manifest.json> reuses pinned previews, without rebuilding, after a preparation-parent restart.
// --borrowed-preview with --prepared retains another owner's explicitly shared preview after cleanup.
// --route-scope=prepared rehearses D/P/N/templates only; omitted catalogue coverage remains open, never qualifying.
// A long-lived parent retains both previews. --prepare writes its manifest and waits for <directory>/GO.
// No document navigation, manual eviction or GC is allowed between drive start and the final leak census.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { GL_INIT } from '../parity/glbytes.mjs';
import { installSoakGl, installSoakWasm, installLoadingGlJournal } from './gl.mjs';
import { installResources } from '../parity/resources.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';
import { soakCatalogue, validateSoakCatalogue, gradeSoak, parseSoakContentCut } from './route.ts';
import { ownedSoakPlans, soakRunPolicy, joinSoakSamples, soakAsyncEvaluator, soakLapMemory, soakGamePid, releaseSoakPreviews, soakRouteScope, soakBootPoll } from './owned.mjs';
import { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute, gridFloorWitnessFailures } from '../frame-floor-grid.mjs';

const root = resolvePath(import.meta.dirname, '../..');
const flag = (name, fallback = '') => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'], ...options });
  let output = '';
  child.stdout.on('data', (data) => { output += data; if (options.echo) process.stdout.write(data); });
  child.on('error', reject); child.on('close', (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} exited ${code}`)));
});
function inspector(url) {
  const ws = new WebSocket(url), pending = new Map();
  let serial = 0, target = null;
  const opened = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const receive = (message) => {
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result); }
  };
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') target = message.params.targetInfo.targetId;
    else if (message.method === 'Target.didCommitProvisionalTarget') target = message.params.newTargetId;
    else if (message.method === 'Target.dispatchMessageFromTarget') receive(JSON.parse(message.params.message));
    else receive(message);
  });
  return { opened, close: () => { for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('Inspector closed')); } pending.clear(); ws.close(); }, evaluate: async (expression) => {
    const result = await new Promise((resolve, reject) => {
      const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('Safari inspector timeout')); }, 10000);
      pending.set(id, { resolve, reject, timer });
      const message = { id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } };
      ws.send(JSON.stringify(target ? { id: ++serial, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } } : message));
    });
    if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
    return result.result?.value;
  } };
}
async function connect(base) {
  for (let attempt = 0; attempt < 120; attempt++) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = pages.find((entry) => entry.url?.startsWith(base));
        if (page) { const driver = inspector(page.webSocketDebuggerUrl); await driver.opened; await sleep(500); return driver; }
      } catch { /* Simulator discovery is asynchronous. */ }
    }
    await sleep(500);
  }
  throw new Error('Simulator Safari inspector did not expose this preview');
}
async function until(driver, expression, timeout = 240000, observe = () => Promise.resolve(), beforeMeasurement = false) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await soakBootPoll(async () => {
      await observe();
      const failure = await driver.evaluate("document.querySelector('#wserr .msg')?.textContent ?? null");
      if (failure) throw new Error(`Owned-shell load failed: ${failure}`);
      return await driver.evaluate(expression);
    }, beforeMeasurement)) return;
    await sleep(1000);
  }
  throw new Error(`Safari condition timed out: ${expression}`);
}
async function worker() {
  const udid = process.env.SIM_UDID;
  if (!udid) throw new Error('Run the worker inside scripts/sim-lane.sh');
  const base = flag('base'), layout = flag('layout'), out = flag('out'), sha = flag('rev'), leg = flag('leg', 'cells');
  if (leg !== 'cells' && leg !== 'road') throw new Error('Unknown soak leg');
  const name = `${layout}-${leg}`;
  const contentCut = flag('content-cut-data') === '' ? null : parseSoakContentCut(JSON.parse(flag('content-cut-data')));
  const policy = soakRunPolicy(process.argv.includes('--dry-run'), contentCut);
  const rehearsal = policy.dryRun || !process.argv.includes('--qualifying');
  const routeScope = soakRouteScope(flag('route-scope', 'catalogue'), process.argv.includes('--qualifying'));
  const duration = policy.seconds;
  const xcrun = (args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
  const phaseFile = join(out, `${name}.phase`), nativeFile = join(out, `${name}-native.jsonl`);
  const glFile = join(out, `${name}-gl.jsonl`), glRows = [], glEvents = [], glEventsFile = join(out, `${name}-gl-events.jsonl`);
  if (existsSync(glFile) || existsSync(glEventsFile) || existsSync(nativeFile) || existsSync(join(out, `${name}.json`))) throw new Error('Soak evidence already exists; use a fresh output directory');
  writeFileSync(glFile, '');
  writeFileSync(glEventsFile, '');
  const result = { schema: 3, purpose: policy.dryRun ? 'DRY RUN: never qualifies as a thirty-minute soak' : rehearsal ? 'REHEARSAL: conversions not prepared' : 'QUALIFYING: prepared conversions, continuous route', policy, contentCut, engineBase: 300_000_000, measurement: 'Playing: fixed game WebContent PID physical footprint / per-sample interval high + live labelled GL. Loading: conservative all-WebContent overlap + GL. Phase maxima remain separate summary; all-WebContent and GPU process also printed separately.', sha, layout, leg, device: udid, surface: 'portrait iPhone Simulator Safari', entries: [], crossroads: [], evictions: [], windows: [], errors: [], events: [], routes: [], leak: null };
  let proxy, sampler, driver;
  const phase = (value) => writeFileSync(phaseFile, value);
  let lastResidents = [];
  const collectGl = async () => {
    if (!driver) return;
    // Drain both journals in one protocol response so a boot process swap cannot lose a drained half.
    const { rows, events, errors } = await driver.evaluate('({rows:window.__sf57GL?.splice(0) ?? [],events:window.__sf57GLEvents?.splice(0) ?? [],errors:window.__sf57Errors ?? []})');
    for (const row of events) {
      glEvents.push(row); appendFileSync(glEventsFile, `${JSON.stringify(row)}\n`);
    }
    for (const row of rows) {
      for (const instance of lastResidents) if (!row.residents.includes(instance)) result.evictions.push({ at: row.at, cycle: row.cycle, instance, residents: row.residents });
      lastResidents = row.residents;
      glRows.push(row); appendFileSync(glFile, `${JSON.stringify(row)}\n`);
    }
    result.errors = [...new Set([...result.errors, ...errors])];
  };
  const measuredWait = async (seconds) => { for (let second = 0; second < seconds; second++) { await sleep(1000); await collectGl(); } };
  try {
    try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* First cold launch. */ }
    proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${xcrun(['getenv', udid, 'RWI_LISTEN_SOCKET'])}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
    proxy.on('error', (error) => { result.errors.push(String(error)); });
    xcrun(['openurl', udid, `${base}version.json`]); driver = await connect(`${base}version.json`);
    await driver.evaluate(`${GL_INIT};window.__sf57Errors=[];localStorage.clear();sessionStorage.clear();(${installLoadingGlJournal.toString()})();(${installSoakGl.toString()})();window.__sf57GL.push(window.__sf57ReadGL());true`);
    await collectGl();
    phase('loading');
    sampler = spawn('python3', [join(root, 'scripts/sim-mem-phases.py'), '--device', udid, '--phase-file', phaseFile, '--out', nativeFile, '--interval', '1', '--sample-interval-high', '--max', String(policy.samplerSeconds)], { stdio: ['ignore', 'inherit', 'inherit'] });
    /** @type {{ error: string | null }} */ const samplerResult = { error: null };
    const samplerClosed = new Promise((resolve) => { sampler.on('error', (error) => { samplerResult.error = String(error); resolve(); }); sampler.on('close', (code) => { if (code !== 0) samplerResult.error = `Native sampler exited ${code}`; resolve(); }); });
    const gameUrl = `${base}sf57-safari.html?mute=1&nolock=1&sw=0`;
    // Replace the cold inspection tab before measurement; do not leave an extra version tab resident.
    await driver.evaluate(`setTimeout(()=>location.replace(${JSON.stringify(gameUrl)}),100);true`);
    driver.close(); driver = null;
    driver = await connect(`${base}sf57-safari.html`);
    await until(driver, `Boolean(document.querySelector('.ws-main-grid'))`, 240000, collectGl, true);
    await driver.evaluate(`setTimeout(()=>document.querySelector('.ws-main-grid').click(),100);true`);
    // Title-to-grid navigation is intentional and precedes the single measurement-document fence.
    driver.close(); driver = null; await sleep(3000); driver = await connect(base);
    await until(driver, `Boolean(!document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live)`, 240000, collectGl, true);
    await driver.evaluate('(window.__wildshard.world.hud.enterNow(),true)');
    await until(driver, 'window.__wsReveal?.endedMs != null', 45000, collectGl, true);
    result.metadata = await driver.evaluate(`(() => {const p=window.__wildshard,w=p.world;return {href:location.href,clock:w.game.app.clock.mode,level:w.game.level.id,renderScale:w.game.renderer.getPixelRatio(),viewport:[innerWidth,innerHeight],userAgent:navigator.userAgent,boot:p.boot,state:p.shard.grid.state(),settings:JSON.parse(localStorage.getItem('wildshard.save.v2.global')).keys.settings.data,developer:JSON.parse(localStorage.getItem('wildshard.save.v2.device')).keys.devMode.data};})()`);
    if (result.metadata.clock !== 'live' || result.metadata.renderScale !== 2 || result.metadata.level !== 'platform.grid') throw new Error('Soak requires the owned shell, live clock and 2x render scale');
    if (result.metadata.developer !== (layout === 'dev')) throw new Error('Wrong Developer setting');
    const cells = result.metadata.state.cells;
    result.catalogue = cells.map(cell => cell.instance);
    result.expected = leg === 'road' ? [] : result.catalogue;
    const catalogue = JSON.parse(execFileSync('git', ['show', `${sha}:src/game/grid/singleplayer.json`], { cwd: root, encoding: 'utf8' })).grid;
    if (layout !== 'shipped' && layout !== 'dev') throw new Error('Unknown soak layout');
    if (!validateSoakCatalogue(cells, soakCatalogue(catalogue, layout))) throw new Error(`Wrong ${layout} catalogue: ${result.catalogue}`);
    result.routeScope = routeScope;
    result.route = ownedSoakPlans(result.metadata.state, leg, routeScope);
    result.openCoverage = result.route.omitted ?? [];
    result.documentOrigin = await driver.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
    result.documentId = await driver.evaluate('window.__sf57DocumentId');
    const page = { evaluate: soakAsyncEvaluator(expression => driver.evaluate(expression), collectGl) };
    const first = result.route.plans[0];
    await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...first, start: result.route.reference })},${JSON.stringify(result.documentOrigin)})`);
    await collectGl();
    result.listenerBaseline = await driver.evaluate('window.__parityResources().listenerDetails');
    await driver.evaluate('window.__sf57MarkGLCycle(0);true');
    phase('baseline-0'); await measuredWait(10);
    result.gamePid = soakGamePid(readFileSync(nativeFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
    const initialStart = Date.now() / 1000; await measuredWait(10);
    result.windows.push({ cycle: 0, start: initialStart, end: Date.now() / 1000 });
    const driveStart = Date.now(); result.driveStarted = new Date(driveStart).toISOString(); result.circuits = 0;
    phase('drive');
    let complete = false;
    while (!complete) {
      const cycle = result.circuits;
      await driver.evaluate(`window.__sf57MarkGLCycle(${cycle});true`);
      // The first warm-up lap also drives every one of the sixteen crossroads; later laps repeat the exact cell loop.
      const plans = [...result.route.plans, ...(cycle === 0 ? result.route.coveragePlans ?? [] : [])];
      for (const plan of plans) {
        result.stage = plan.name;
        writeFileSync(join(out, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
        console.log(JSON.stringify({ layout, cycle, route: plan.name, seconds: (Date.now() - driveStart) / 1000 }));
        const witness = await runFloorGridRoute(page, plan, result.documentOrigin);
        const failures = gridFloorWitnessFailures(witness);
        result.routes.push({ cycle, ...witness, failures });
        if (plan.crossroads) result.crossroads.push(plan.crossroads);
        if (plan.to !== null && plan.to !== plan.from) result.entries.push({ cycle, instance: plan.to, admitted: failures.length === 0, feet: witness.after.live.live.worldFeet });
        if (failures.length > 0) throw new Error(`${plan.name}: ${failures.join('; ')}`);
        result.seconds = (Date.now() - driveStart) / 1000;
        writeFileSync(join(out, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
        // Finish the fenced leg; a completed last leg still receives its lap count and settled baseline below.
        if (result.seconds >= duration && plan !== plans.at(-1)) { complete = true; break; }
      }
      if (!complete) {
        result.circuits++;
        phase(`settle-${result.circuits}`); await measuredWait(10);
        const start = Date.now() / 1000; await measuredWait(10);
        result.windows.push({ cycle: result.circuits, start, end: Date.now() / 1000 });
        result.seconds = (Date.now() - driveStart) / 1000;
        if (result.seconds >= duration) complete = true;
        else phase('drive');
      }
    }
    result.seconds = (Date.now() - driveStart) / 1000;
    result.lastState = await driver.evaluate('window.__wildshard.shard.grid.state()');
    result.listenerBeforeUnload = await driver.evaluate('window.__parityResources().listenerDetails');
    phase('unloaded');
    await driver.evaluate(`window.__wildshard.leak().then(value=>{window.__sf57Leak=value;},error=>{window.__sf57Leak={error:String(error)};});true`);
    await until(driver, 'Boolean(window.__sf57Leak)', 60000, collectGl);
    result.leak = await driver.evaluate('window.__sf57Leak');
    result.listenerAfter = await driver.evaluate('window.__parityResources().listenerDetails');
    await measuredWait(20);
    result.errors = [...new Set([...result.errors, ...await driver.evaluate('window.__sf57Errors')])];
    phase('done'); await samplerClosed; sampler = null;
    await driver.evaluate('window.__sf57StopGLJournal();clearInterval(window.__sf57GLTimer);true'); await collectGl();
    if (samplerResult.error) throw new Error(samplerResult.error);
  } catch (error) {
    result.failure = String(error.stack ?? error); result.errors.push(result.failure);
    if (driver) {
      await driver.evaluate('window.__sf57StopGLJournal?.();true').catch(() => undefined); await collectGl().catch(() => undefined);
      result.diagnostic = await driver.evaluate('JSON.stringify({url:location.href,documentId:window.__sf57DocumentId,stop:window.__frameFloorGridStop,state:window.__wildshard?.shard?.grid?.state(),errors:window.__sf57Errors,body:document.body.innerText.slice(-4000)})').catch(() => null);
      result.listenerBeforeUnload = await driver.evaluate('window.__parityResources?.().listenerDetails').catch(() => null);
      await driver.evaluate('window.__wildshard?.world?.game.app.input.clear();true').catch(() => undefined);
      if (await driver.evaluate('Boolean(window.__wildshard?.world?.game)') && !(await driver.evaluate('Boolean(window.__sf57Leak)'))) {
        phase('unloaded');
        try {
          await driver.evaluate('window.__wildshard?.leak().then(value=>{window.__sf57Leak=value;},error=>{window.__sf57Leak={error:String(error)};});true');
          await until(driver, 'Boolean(window.__sf57Leak)', 60000, collectGl);
          result.leak = await driver.evaluate('window.__sf57Leak');
          result.listenerAfter = await driver.evaluate('window.__parityResources().listenerDetails');
          await measuredWait(5);
        } catch (cleanupError) { result.cleanupError = String(cleanupError); }
      }
    }
  } finally {
    phase('done');
    if (sampler) { await sleep(1500); sampler.kill('SIGTERM'); }
    driver?.close(); proxy?.kill('SIGTERM');
    try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Already closed. */ }
  }
  const native = existsSync(nativeFile) ? readFileSync(nativeFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  const samples = joinSoakSamples(native, glRows, result.gamePid ?? null, glEvents);
  result.glSampling = { journal: samples.filter(row => row.gl?.source === 'complete GL allocation journal').length,
    observed: samples.filter(row => row.gl !== undefined && row.gl.source === undefined).length,
    missing: samples.filter(row => row.gl === undefined).length,
    policy: 'Complete reconciled mutation coverage with explicit cycle markers may supply exact GL bytes; reconstructed rows have null allocator and no settled state. Calibration uses real samples only; the actual-census join stays at 1.5 seconds.' };
  result.grade = gradeSoak({ samples, windows: result.windows, seconds: result.seconds ?? 0, circuits: result.circuits ?? 0,
    evictions: result.evictions.length, errors: result.errors, leak: result.leak?.after ? result.leak : null,
    expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase, rehearsal, leg, contentCut });
  result.perLap = soakLapMemory(samples, result.circuits ?? 0);
  result.functionalPass = result.failure === undefined && result.errors.length === 0 && (result.seconds ?? 0) >= duration
    && result.routes.length > 0 && result.routes.every(route => route.failures.length === 0) && result.grade.sampling && result.grade.leakZero;
  if (!result.functionalPass) process.exitCode = 1;
  result.nativeSummary = native.find((row) => row.type === 'summary');
  result.glFile = glFile; result.glSamples = glRows.length; result.nativeFile = nativeFile; result.sampleCount = samples.length;
  result.glEventsFile = glEventsFile; result.glEvents = glEvents.length;
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ layout, ...result.grade, failure: result.failure }));
}
async function drivePrepared(manifest) {
  const { sha, out, bases } = manifest;
  const routeScope = soakRouteScope(manifest.routeScope ?? 'catalogue', manifest.rehearsal === false);
  const contentCut = manifest.contentCut === null || manifest.contentCut === undefined ? null : parseSoakContentCut(manifest.contentCut);
  while (!existsSync(join(out, 'GO'))) await sleep(1000);
  const policy = soakRunPolicy(manifest.dryRun === true, contentCut);
  for (const { layout, base } of bases) {
    for (const leg of manifest.legs ?? ['cells', 'road']) {
      await run(join(root, 'scripts/sim-lane.sh'), ['run', '--max', String(policy.leaseMinutes), `sf57-sp-x3-${layout}-${process.pid}`, process.execPath, import.meta.filename,
        '--worker', ...(policy.dryRun ? ['--dry-run'] : []), `--base=${base}`, `--layout=${layout}`, `--leg=${leg}`, `--out=${out}`, `--rev=${sha}`, `--route-scope=${routeScope}`, ...(manifest.rehearsal === false ? ['--qualifying'] : []), ...(contentCut === null ? [] : [`--content-cut-data=${JSON.stringify(contentCut)}`])], { cwd: out, echo: true });
    }
  }
  console.log(`SF57 DONE ${out}`);
}
async function closePreviews(bases) {
  await releaseSoakPreviews(bases, async base => { await run(join(root, 'scripts/serve-build.sh'), ['stop', new URL(base).port]); },
    process.argv.includes('--borrowed-preview'));
}
function writeHelper(base, layout) {
  const record = readFileSync(join(process.env.HOME, '.dev-servers', new URL(base).port), 'utf8').trim().split(' ');
  const dist = join(record[2], 'dist'), html = readFileSync(join(dist, 'index.html'), 'utf8')
    .replaceAll(/<script data-sf57-fixture>[\s\S]*?<\/script>/gu, '');
  const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    saveFixtureCode({ scope: 'device', key: 'devMode', data: layout === 'dev' })].join(';');
  const pins = `${GL_INIT};(${installSoakWasm.toString()})();(${installResources.toString()})();window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources(),gpuBytes:()=>window.__sc_gl().reduce((sum,c)=>sum+c.totalBytes,0)};window.__sf57Errors=[];{const error=console.error;console.error=(...args)=>{window.__sf57Errors.push(args.map(String).join(' '));error.apply(console,args);};}window.__sf57DocumentId=Date.now()+':'+Math.random();window.addEventListener('error',e=>window.__sf57Errors.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__sf57Errors.push(String(e.reason)));(${installLoadingGlJournal.toString()})();(${installSoakGl.toString()})();${fixtures};`;
  const helper = html.replace('<head>', `<head><script data-sf57-fixture>${pins}</script>`);
  // The ordinary main-menu action can return to index.html before any measurement begins.
  writeFileSync(join(dist, 'index.html'), helper);
  writeFileSync(join(dist, 'sf57-safari.html'), helper);
}
async function prepare() {
  const sha = execFileSync('git', ['rev-parse', flag('rev', 'origin/main')], { cwd: root, encoding: 'utf8' }).trim();
  const out = resolvePath(flag('out', `/private/tmp/claude-501/sp-builders/sp-x3/sf57-${process.pid}`)); mkdirSync(out, { recursive: true });
  const cutPath = flag('content-cut');
  const contentCut = cutPath === '' ? null : parseSoakContentCut(JSON.parse(readFileSync(resolvePath(cutPath), 'utf8')));
  if (contentCut !== null) {
    // A local draft is not the receipt for this pinned run.
    execFileSync('git', ['cat-file', '-e', `${sha}:${contentCut.receipt}`], { cwd: root });
    execFileSync('git', ['merge-base', '--is-ancestor', contentCut.sourceRevision, sha], { cwd: root });
  }
  const routeScope = soakRouteScope(flag('route-scope', 'catalogue'), process.argv.includes('--qualifying'));
  const bases = [], manifest = { sha, out, bases, contentCut, routeScope, dryRun: process.argv.includes('--dry-run'), legs: flag('legs', 'cells,road').split(','), rehearsal: process.argv.includes('--dry-run') ? true : !process.argv.includes('--qualifying') };
  if (manifest.legs.length === 0 || new Set(manifest.legs).size !== manifest.legs.length || manifest.legs.some(leg => leg !== 'cells' && leg !== 'road')) throw new Error('Select cells and/or road legs');
  const layouts = flag('layouts', 'dev,shipped').split(',');
  if (layouts.length === 0 || new Set(layouts).size !== layouts.length || layouts.some((layout) => layout !== 'shipped' && layout !== 'dev')) throw new Error('Select shipped and/or dev layouts');
  try {
    for (const layout of layouts) {
      const base = await run(join(root, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `sf57-${layout}-${process.pid}`, '--hours', contentCut === null ? '3' : '6'],
        { cwd: out, env: { ...process.env, CLAUDE_CODE_SESSION_ID: `sf57-${layout}-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') } });
      const version = await (await fetch(`${base}version.json`)).json();
      if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error('Preview pin mismatch');
      bases.push({ layout, base, version });
      writeHelper(base, layout);
    }
    writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`PREPARED ${join(out, 'manifest.json')} — waiting for coordinator quiet; touch ${join(out, 'GO')} only after go`);
    await drivePrepared(manifest);
  } finally { await closePreviews(bases); }
}
if (process.argv.includes('--borrowed-preview') && (!flag('prepared') || process.argv.includes('--prepare'))) throw new Error('Borrowed previews require --prepared');
if (process.argv.includes('--worker')) await worker();
else if (process.argv.includes('--prepare')) await prepare();
else if (flag('prepared')) {
  const manifest = JSON.parse(readFileSync(flag('prepared'), 'utf8'));
  try {
    for (const { base, version, layout } of manifest.bases) {
      if (JSON.stringify(await (await fetch(`${base}version.json`)).json()) !== JSON.stringify(version)) throw new Error('Prepared preview changed');
      writeHelper(base, layout);
    }
    console.log(`PREPARED (reused) ${flag('prepared')} — waiting for GO`);
    await drivePrepared(manifest);
  } finally { await closePreviews(manifest.bases); }
}
else throw new Error('Supply --prepare --rev=<pushed SHA>; its long-lived parent starts the lane after GO');
