#!/usr/bin/env node
// SF57: each selected production layout has a 60-minute cell drive and a separate 60-minute road-only drive.
// --layouts=shipped runs the M2 layout; the default shipped,dev also prepares the M3 Developer evidence.
// node scripts/soak/soak.mjs --rev=<pushed SHA> --prepare [--out=<directory>]
// --prepared=<manifest.json> reuses pinned previews, without rebuilding, after a preparation-parent restart.
// A long-lived parent retains both previews. --prepare writes its manifest and waits for <directory>/GO.
// No document navigation, manual eviction or GC is allowed between drive start and the final leak census.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { GL_INIT } from '../parity/glbytes.mjs';
import { installSoakGl } from './gl.mjs';
import { installResources } from '../parity/resources.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';
import { soakRoute, soakCatalogue, validateSoakCatalogue, gradeSoak } from './route.ts';
import { installSoakDrive } from './drive.mjs';

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
  return { opened, close: () => ws.close(), evaluate: async (expression) => {
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
async function until(driver, expression, timeout = 240000, observe = () => Promise.resolve()) {
  const start = Date.now();
  while (Date.now() - start < timeout) { await observe(); if (await driver.evaluate(expression)) return; await sleep(1000); }
  throw new Error(`Safari condition timed out: ${expression}`);
}
async function worker() {
  const udid = process.env.SIM_UDID;
  if (!udid) throw new Error('Run the worker inside scripts/sim-lane.sh');
  const base = flag('base'), layout = flag('layout'), out = flag('out'), sha = flag('rev'), leg = flag('leg', 'cells');
  if (leg !== 'cells' && leg !== 'road') throw new Error('Unknown soak leg');
  const name = `${layout}-${leg}`;
  const xcrun = (args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
  const phaseFile = join(out, `${name}.phase`), nativeFile = join(out, `${name}-native.jsonl`);
  const glFile = join(out, `${name}-gl.jsonl`), glRows = [];
  writeFileSync(glFile, '');
  const result = { schema: 2, purpose: 'REHEARSAL: conversions not prepared', engineBase: 300_000_000, measurement: 'WebContent phys_footprint + live labelled GL API allocations; GPU process separate', sha, layout, leg, device: udid, surface: 'iPhone 17 Pro Simulator Safari', entries: [], crossroads: [], evictions: [], windows: [], errors: [], events: [], leak: null };
  let proxy, sampler, driver;
  const phase = (value) => writeFileSync(phaseFile, value);
  const collectGl = async () => {
    if (!driver) return;
    const rows = await driver.evaluate('window.__sf57GL?.splice(0) ?? []');
    for (const row of rows) { glRows.push(row); appendFileSync(glFile, `${JSON.stringify(row)}\n`); }
  };
  const measuredWait = async (seconds) => { for (let second = 0; second < seconds; second++) { await sleep(1000); await collectGl(); } };
  try {
    try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* First cold launch. */ }
    proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${xcrun(['getenv', udid, 'RWI_LISTEN_SOCKET'])}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
    proxy.on('error', (error) => { result.errors.push(String(error)); });
    xcrun(['openurl', udid, `${base}version.json`]); driver = await connect(`${base}version.json`);
    await driver.evaluate(`${GL_INIT};window.__sf57Errors=[];(${installSoakGl.toString()})();localStorage.clear();sessionStorage.clear();window.__sf57GL.push(window.__sf57ReadGL());true`);
    await collectGl();
    phase('loading');
    sampler = spawn('python3', [join(root, 'scripts/sim-mem-phases.py'), '--device', udid, '--phase-file', phaseFile, '--out', nativeFile, '--interval', '1', '--max', '2500'], { stdio: ['ignore', 'inherit', 'inherit'] });
    /** @type {{ error: string | null }} */ const samplerResult = { error: null };
    const samplerClosed = new Promise((resolve) => { sampler.on('error', (error) => { samplerResult.error = String(error); resolve(); }); sampler.on('close', (code) => { if (code !== 0) samplerResult.error = `Native sampler exited ${code}`; resolve(); }); });
    const gameUrl = `${base}sf57-safari.html?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0`;
    // Replace the cold inspection tab before measurement; do not leave an extra version tab resident.
    await driver.evaluate(`setTimeout(()=>location.replace(${JSON.stringify(gameUrl)}),100);true`);
    driver.close(); driver = null;
    driver = await connect(`${base}sf57-safari.html`);
    await until(driver, `Boolean(window.__wildshard?.shard?.grid?.simulation && !document.querySelector('.ws-load'))`, 240000, collectGl);
    result.metadata = await driver.evaluate(`(() => {const p=window.__wildshard,w=p.world;w.hud.enterNow();return {href:location.href,clock:w.game.app.clock.mode,renderScale:w.game.renderer.getPixelRatio(),viewport:[innerWidth,innerHeight],userAgent:navigator.userAgent,boot:p.boot,state:p.shard.grid.state()};})()`);
    if (result.metadata.clock !== 'live' || result.metadata.renderScale !== 2) throw new Error('Soak must use live clock and 2x render scale');
    const cells = result.metadata.state.cells;
    result.catalogue = cells.map((cell) => cell.instance);
    result.expected = leg === 'road' ? [] : result.catalogue;
    const catalogue = JSON.parse(execFileSync('git', ['show', `${sha}:src/game/grid/singleplayer.json`], { cwd: root, encoding: 'utf8' })).grid;
    if (layout !== 'shipped' && layout !== 'dev') throw new Error('Unknown soak layout');
    const wanted = soakCatalogue(catalogue, layout);
    if (!validateSoakCatalogue(cells, wanted)) throw new Error(`Wrong ${layout} catalogue: ${result.catalogue}`);
    result.route = soakRoute(cells, 555, leg);
    await driver.evaluate(`window.__wildshard.pose({name:'sf57.initial-road',x:277.5,y:2,z:0,yaw:0});true`);
    phase('baseline-0'); await measuredWait(10);
    const initialStart = Date.now() / 1000; await measuredWait(10);
    result.windows.push({ cycle: 0, start: initialStart, end: Date.now() / 1000 });
    phase('drive');
    const driveStart = Date.now(); result.driveStarted = new Date(driveStart).toISOString();
    await driver.evaluate(`(${installSoakDrive.toString()})(${JSON.stringify(result.route)},3600)`);
    let windowStart = null;
    for (;;) {
      await sleep(1000); await collectGl();
      const state = await driver.evaluate(`(() => {const s=window.__sf57;return {done:s.done,elapsed:s.elapsed,cycles:s.cycles,index:s.index,state:s.state,events:s.events.splice(0),errors:window.__sf57Errors,documentId:window.__sf57DocumentId};})()`);
      if (state.documentId !== result.documentId && result.documentId !== undefined) throw new Error('Document changed during the soak');
      result.documentId = state.documentId; result.seconds = state.elapsed; result.circuits = state.cycles; result.lastState = state.state;
      for (const event of state.events) {
        result.events.push(event);
        if (event.type === 'entry') result.entries.push(event);
        if (event.type === 'eviction') result.evictions.push(event);
        if (event.type === 'crossroads') result.crossroads.push(event.id);
        if (event.type === 'failure') result.errors.push(event.error);
        if (event.type === 'settle-start') { windowStart = { cycle: event.cycle + 1, start: driveStart / 1000 + event.seconds + 10 }; phase(`settle-${event.cycle + 1}`); }
        if (event.type === 'settle-end' && windowStart) { result.windows.push({ ...windowStart, end: driveStart / 1000 + event.seconds }); windowStart = null; phase('drive'); }
      }
      result.errors = [...new Set([...result.errors, ...state.errors])];
      if (Math.floor(state.elapsed) % 60 === 0) console.log(JSON.stringify({ layout, seconds: state.elapsed, cycle: state.cycles, waypoint: state.index, current: state.state?.live?.live?.current, evictions: result.evictions.length }));
      if (state.done) break;
      if (Date.now() - driveStart > 1850000) throw new Error('Drive exceeded real-time deadline');
    }
    phase('unloaded');
    await driver.evaluate(`window.__sf57.stop();window.__wildshard.leak().then(value=>{window.__sf57Leak=value;},error=>{window.__sf57Leak={error:String(error)};});true`);
    await until(driver, 'Boolean(window.__sf57Leak)', 60000, collectGl);
    result.leak = await driver.evaluate('window.__sf57Leak'); await measuredWait(20);
    await driver.evaluate('clearInterval(window.__sf57GLTimer);true');
    result.errors = [...new Set([...result.errors, ...await driver.evaluate('window.__sf57Errors')])];
    phase('done'); await samplerClosed; sampler = null;
    if (samplerResult.error) throw new Error(samplerResult.error);
  } catch (error) {
    result.failure = String(error.stack ?? error); result.errors.push(result.failure);
    if (driver) await driver.evaluate('window.__sf57?.stop();true').catch(() => undefined);
  } finally {
    phase('done');
    if (sampler) { await sleep(1500); sampler.kill('SIGTERM'); }
    driver?.close(); proxy?.kill('SIGTERM');
  }
  const native = existsSync(nativeFile) ? readFileSync(nativeFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  const samples = native.filter((row) => row.type === 'sample').map((row) => {
    const elapsed = Date.parse(row.t) / 1000;
    const gl = glRows.reduce((nearest, candidate) => !nearest || Math.abs(candidate.at - elapsed) < Math.abs(nearest.at - elapsed) ? candidate : nearest, null);
    row.elapsed = elapsed;
    if (gl && Math.abs(gl.at - elapsed) <= 1.5) row.gl = gl;
    return row;
  });
  result.grade = gradeSoak({ samples, windows: result.windows, seconds: result.seconds ?? 0, circuits: result.circuits ?? 0,
    evictions: result.evictions.length, errors: result.errors, leak: result.leak?.after ? result.leak : null,
    expected: result.expected ?? [], entries: result.entries, crossroads: result.crossroads, engineBase: result.engineBase, rehearsal: true, leg });
  result.nativeSummary = native.find((row) => row.type === 'summary');
  result.glFile = glFile; result.glSamples = glRows.length; result.nativeFile = nativeFile; result.sampleCount = samples.length;
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ layout, ...result.grade, failure: result.failure }));
}
async function drivePrepared(manifest) {
  const { sha, out, bases } = manifest;
  while (!existsSync(join(out, 'GO'))) await sleep(1000);
  for (const { layout, base } of bases) {
    for (const leg of ['cells', 'road']) {
      await run(join(root, 'scripts/sim-lane.sh'), ['run', '--max', '40', `sf57-sp-x1-${layout}-${process.pid}`, process.execPath, import.meta.filename,
        '--worker', `--base=${base}`, `--layout=${layout}`, `--leg=${leg}`, `--out=${out}`, `--rev=${sha}`], { cwd: out, echo: true });
    }
  }
  console.log(`SF57 DONE ${out}`);
}
async function closePreviews(bases) {
  for (const { base } of bases) await run(join(root, 'scripts/serve-build.sh'), ['stop', new URL(base).port]).catch(() => undefined);
}
function writeHelper(base, layout) {
  const record = readFileSync(join(process.env.HOME, '.dev-servers', new URL(base).port), 'utf8').trim().split(' ');
  const dist = join(record[2], 'dist'), html = readFileSync(join(dist, 'index.html'), 'utf8');
  const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' } }),
    saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    saveFixtureCode({ scope: 'device', key: 'devMode', data: layout === 'dev' })].join(';');
  const pins = `${GL_INIT};(${installResources.toString()})();window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources(),gpuBytes:()=>window.__sc_gl().reduce((sum,c)=>sum+c.totalBytes,0)};window.__sf57Errors=[];window.__sf57DocumentId=Date.now()+':'+Math.random();window.addEventListener('error',e=>window.__sf57Errors.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__sf57Errors.push(String(e.reason)));(${installSoakGl.toString()})();${fixtures};${saveFixtureCode({ scope: 'device', key: 'gridIntent.once', data: { instance: 'driftwood-isle', slug: 'driftwood-isle', at: 0 } })};(() => {const key='wildshard.save.v2.device',doc=JSON.parse(localStorage.getItem(key));doc.keys['gridIntent.once'].data.at=Date.now();doc.keys['titleArrival.once']={v:1,data:{slug:'driftwood-isle',mode:'enter',at:Date.now()}};localStorage.setItem(key,JSON.stringify(doc));})();`;
  writeFileSync(join(dist, 'sf57-safari.html'), html.replace('<head>', `<head><script>${pins}</script>`));
}
async function prepare() {
  const sha = execFileSync('git', ['rev-parse', flag('rev', 'origin/main')], { cwd: root, encoding: 'utf8' }).trim();
  const out = resolvePath(flag('out', `/private/tmp/claude-501/sp-builders/sp-x1/sf57-${process.pid}`)); mkdirSync(out, { recursive: true });
  const bases = [], manifest = { sha, out, bases };
  const layouts = flag('layouts', 'shipped,dev').split(',');
  if (layouts.length === 0 || new Set(layouts).size !== layouts.length || layouts.some((layout) => layout !== 'shipped' && layout !== 'dev')) throw new Error('Select shipped and/or dev layouts');
  try {
    for (const layout of layouts) {
      const base = await run(join(root, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `sf57-${layout}-${process.pid}`, '--hours', '3'],
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
