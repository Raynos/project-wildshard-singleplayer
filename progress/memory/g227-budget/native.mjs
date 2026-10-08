// G227 one cold Simulator grid route, kernel footprint and labelled GL at entered poses.
// --census=final (default) | none | every. The in-page census (snapshotExpression) walks the scene and every texture and
// buffer; WebKit keeps the 50-300 MB of WebContent it allocates, so a census inflates every LATER reading in the same page
// (grid-base, c2d910073). final: every pose reads the kernel footprint and a light GL total (the tracker's per-context
// sums, no scene walk), and one full census runs after the last pose's reading. none: no census. every: the legacy order
// (a census after each pose's reading), kept only to compare against old receipts.
// Route mode standalone-pine boots ?chunk=pine-hollow and reads its spawn and centre (the grid-base pose) with the same
// sampler, for a like-for-like grid-vs-standalone comparison.
import { spawn, execFileSync } from 'node:child_process';
import WebSocket from 'ws';
import { memoryCategories } from './memory-categories.mjs';
import { waitNativeSample } from './native-samples.mjs';
import { AUDIO_INIT, WASM_INIT, snapshotExpression, heapOwners } from './inspect.mjs';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { installResources } from '../../../scripts/parity/resources.mjs';
import { soakBootPoll } from '../../../scripts/soak/owned.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';
import { publicGridIntentCode, publicGridPlans, readPublicGridWitness, publicGridWitnessFailures } from '../../../scripts/public-grid.mjs';

const argv = process.argv.slice(2);
const censusMode = argv.find(arg => arg.startsWith('--census='))?.slice('--census='.length) ?? 'final';
if (!['final', 'none', 'every'].includes(censusMode)) throw new Error('--census must be final, none or every');
// --gl=every (default): the light GL read follows each pose's footprint samples. --gl=last: no in-page read at all before a
// pose's samples, GL read once after the last pose (footprint-only control; such runs carry GL on the last pose only).
const glMode = argv.find(arg => arg.startsWith('--gl='))?.slice('--gl='.length) ?? 'every';
if (!['every', 'last'].includes(glMode)) throw new Error('--gl must be every or last');
// --vmmap=last (default) | every. vmmap -summary on the WebContent task inflates its later footprint readings by
// hundreds of MB (ruler lane, Pine centre: 478 MB without, 903 MB with a vmmap at each earlier pose), so it runs once,
// after the last pose's reading. every is the old order, for comparison with old receipts only.
const vmmapMode = argv.find(arg => arg.startsWith('--vmmap='))?.slice('--vmmap='.length) ?? 'last';
if (!['every', 'last'].includes(vmmapMode)) throw new Error('--vmmap must be every or last');
const [base, out, dist, routeMode = 'full', memorySaver = 'off', entryEdge = 'north'] = argv.filter(arg => !arg.startsWith('--')), udid = process.env.SIM_UDID;
const standalone = routeMode === 'standalone-pine';
if (standalone && censusMode !== 'none') throw new Error('standalone-pine has no grid for the census: pass --census=none');
const publicGrid = routeMode === 'public-grid';
if (routeMode === 'sun-entry' && !['north', 'east', 'south', 'west'].includes(entryEdge)) throw new Error('Unknown Sun entry edge');
if (publicGrid && memorySaver !== 'off') throw new Error('Public grid measures the shipping Memory saver default OFF');
if (!['off', 'on'].includes(memorySaver)) throw new Error('Memory saver must be off or on');
// GPU textures (Settings ▸ Debug): the build default Auto unless a run pins KTX2 / Images (sky-mem's ASTC A/B)
const tex = process.env.G227_TEX ?? 'auto';
if (!['auto', 'ktx2', 'img'].includes(tex)) throw new Error('G227_TEX must be auto, ktx2 or img');
if (!dist) throw new Error('Pass the owned preview dist directory for the preboot diagnostic helper');
const fixtures = [
  {scope:'global',key:'settings',data:{tier:'phone',fps:'auto',tex,memorySaver,volume:0},merge:true},
  {scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}},
  {scope:'device',key:'devMode',data:!publicGrid},
].map(saveFixtureCode).join(';');
const helper = new URL('g227-safari.html', base).href;
// A preview may serve several cold variants. Remove only this harness's earlier inline fixture before reseeding.
const builtHtml = readFileSync(dist + '/index.html','utf8').replace(/<script(?: data-g227-fixture)?>([\s\S]*?)<\/script>/gu,
  (tag, body) => body.includes('window.__g227Errors=[];') ? '' : tag);
const resourceFixture = ['sky-entry', 'sun-entry'].includes(routeMode) ? `(${installResources.toString()})();` : '';
const resourcePort = ['sky-entry', 'sun-entry'].includes(routeMode) ? ',resources:()=>window.__parityResources()' : '';
const documentHtml = builtHtml.replace('<head>', '<head><script data-g227-fixture>' + resourceFixture + GL_INIT + ';' + WASM_INIT + ';' + AUDIO_INIT + ';' + fixtures + ';' + (publicGrid ? publicGridIntentCode({instance:'driftwood-isle',slug:'driftwood-isle'}) : '') + ';window.__wildshardHarness={seed:357,capture:null'+resourcePort+'};window.__gridAdmissionLongTasks=[];window.__g227Errors=[];window.__g227Warnings=[];{const warn=console.warn;console.warn=(...args)=>{if(window.__g227Warnings.length<100)window.__g227Warnings.push(args.map(String).join(" "));warn.apply(console,args);};}window.addEventListener("error",e=>window.__g227Errors.push(String(e.message)));window.addEventListener("unhandledrejection",e=>window.__g227Errors.push(String(e.reason)));<\/script>');
writeFileSync(dist + '/index.html', documentHtml);
writeFileSync(dist + '/g227-safari.html', documentHtml);
if (!udid) throw new Error('Run through sim-lane.sh');
const report = { version: await (await fetch(new URL('version.json', base))).json(), routeMode, memorySaver, tex, developer:!publicGrid, census: censusMode, glRead: glMode, vmmap: vmmapMode,
  ...(publicGrid ? {publicGrid:'public grid as it would ship once GRID_GATES_PASSED flips'} : {}),
  protocol: 'One cold Safari Simulator route. Three settled one-second kernel physical-footprint samples per pose; live labelled GL (tracker totals) at the same pose; the in-page census only as --census says (final: once, after the last reading). Relative evidence, not physical-phone cap proof.',
  snapshots: [], routes: [] };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
// The light GL read: the tracker's per-context sums. No scene walk, no labelling, no per-resource rows returned.
const lightExpression = `(() => ({
  gl: window.__sc_gl().map(({ gl, resources, top, ...context }) => ({ ...context, unlabelledBytes: resources.reduce((sum, row) => sum + (row.labelled ? 0 : row.bytes), 0) })),
  settings: JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}').keys?.settings?.data,
}))()`;
const phaseFile = out + '.phase', nativeFile = out + '.native.jsonl';
writeFileSync(phaseFile, 'loading');
const simctl = args => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let inspector, sampler, proxy, gamePID, beforeMeasurement = true;
const samplerState = { pid: null, exitCode: null, signal: null, error: null, log: out + '.sampler.log' };
report.sampler = samplerState;
const nativeDetail = process.env.G227_NATIVE_DETAIL === '1';
let evalSequence = 0;
try {
  try { simctl(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Cold first launch. */ }
  report.stage = 'cold-version'; save();
  simctl(['openurl', udid, `${base}version.json`]);
  await sleep(6000);
  const socket = simctl(['getenv', udid, 'RWI_LISTEN_SOCKET']).trim();
  proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
  const connect = async url => {
    inspector?.close(); inspector = webkit(await safariPage(url)); await inspector.opened; await sleep(600);
    return evaluator(inspector.raw);
  };
  let evaluate = await connect(`${base}version.json`);
  report.stage = 'cold-reset'; save();
  await evaluate(`(async () => {for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();for(const k of await caches.keys()) await caches.delete(k);localStorage.clear();sessionStorage.clear();return true;})()`);
  await evaluate(`(() => {${saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex, memorySaver }, merge: true })};${saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } })};${saveFixtureCode({ scope: 'device', key: 'devMode', data: !publicGrid })};return true;})()`);
  const samplerLog = openSync(samplerState.log, 'wx');
  try { sampler = spawn('python3', ['scripts/sim-mem-phases.py', '--device', udid, '--phase-file', phaseFile, '--out', nativeFile, '--max', '1200'], { stdio: ['ignore', samplerLog, samplerLog] }); }
  finally { closeSync(samplerLog); }
  samplerState.pid = sampler.pid ?? null;
  sampler.on('error', error => { samplerState.error = String(error); });
  sampler.on('exit', (code, signal) => { samplerState.exitCode = code; samplerState.signal = signal; });
  if (routeMode === 'control') {
    await evaluate(`(() => { ${GL_INIT}; return true; })()`);
    await evaluate(`(() => { const gl=document.createElement('canvas').getContext('webgl2'); const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,1,1); gl.finish(); window.__g227WarmGL={gl,texture}; return true;})()`);
    await sleep(3000);
    report.stage='isolated-gl-control';save();
    report.glFootprintControl=await footprintControl(evaluate);save();
    await evaluate(`(() => { const {gl,texture}=window.__g227WarmGL;gl.deleteTexture(texture);gl.getExtension('WEBGL_lose_context')?.loseContext();delete window.__g227WarmGL;return true;})()`);
  } else {
  report.stage = 'title-load'; save();
  simctl(['openurl', udid, publicGrid ? `${helper}?chunk=driftwood-isle&skipintro=1&mute=1&nolock=1&sw=0` : standalone ? `${helper}?chunk=pine-hollow&skipintro=1&mute=1&nolock=1&sw=0` : helper]);
  await sleep(3000);
  evaluate = await connect(helper);
  const until = async (expression, ms = 180000) => {
    for (const started = Date.now(); Date.now() - started < ms;) {
      // Title navigation may replace WebKit's process target before the measurement document exists.
      // Reuse the shared exact-error handshake; once fenced, every protocol/game error is fatal.
      const status = await soakBootPoll(() => evaluate(`({ready:Boolean(${expression}),fatal:document.getElementById('wserr')?.innerText ?? null})`), beforeMeasurement);
      if (status !== false) {
        if (status.fatal !== null) throw new Error('Native boot failed: ' + status.fatal);
        if (status.ready) return;
      }
      await sleep(500);
    }
    throw new Error('Readiness timed out: ' + expression);
  };
  if (!publicGrid && !standalone) {
  await until("Boolean(document.querySelector('.ws-main-grid'))");
  report.stage = 'grid-tap'; save();
  // This deliberate title-to-game navigation precedes the measurement document fence.
  await inspector.raw("(setTimeout(() => document.querySelector('.ws-main-grid').click(),100),true)");
  await sleep(3000); evaluate = await connect(helper);
  }
  report.stage = 'grid-load'; save();
  if (standalone) {
    await until("!document.querySelector('.ws-load') && Boolean(window.__wildshard?.world?.player)", 240000);
    await sleep(4000);
  } else {
  await until("!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)", 240000);
  await evaluate('(window.__wildshard.world.hud.enterNow(),true)');
  await until('window.__wsReveal?.endedMs != null', 45000);
  }
  const documentOrigin = await evaluate(`(${gridFloorDocumentIdentity.toString()})()`); report.documentOrigin = documentOrigin; beforeMeasurement = false;
  const snapshot = async label => {
    report.stage = label; writeFileSync(phaseFile, label); save(); await sleep(5000);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1100);
      const sample = await waitNativeSample(() => readFileSync(nativeFile, 'utf8'), () => samplerState,
        { phase: label, pid: gamePID, after: samples.at(-1)?.at });
      gamePID ??= sample.pid; report.gamePID = gamePID; samples.push(sample);
    }
    // Nothing in-page that allocates runs before the samples above. vmmap is out of process.
    const sorted = samples.map(s => s.footprintBytes).sort((a, b) => a - b);
    const vmmapPath = out.replace(/\.json$/u, '') + '.' + label + '.vmmap.txt';
    let vmmap = 'deferred';
    if (vmmapMode === 'every') {
      try { vmmap = execFileSync('vmmap', ['-summary', String(samples[2].pid)], { encoding: 'utf8', timeout: 30000, maxBuffer: 8e6 }); writeFileSync(vmmapPath, vmmap); }
      catch (error) { vmmap = String(error); }
    }
    const light = glMode === 'every' ? await evaluate(lightExpression) : null;
    const glBytes = light === null ? null : light.gl.reduce((sum, context) => sum + context.totalBytes, 0);
    const value = censusMode === 'every' ? await evaluate(snapshotExpression) : {};
    if (publicGrid) {
      value.publicWitness = await evaluate(`(${readPublicGridWitness.toString()})()`);
      const failures = publicGridWitnessFailures(value.publicWitness, false);
      if (failures.length > 0) throw new Error(failures.join('; '));
    }
    if (light !== null && light.settings?.memorySaver !== memorySaver) throw new Error('Memory saver fixture did not activate: expected ' + memorySaver + ', observed ' + light.settings?.memorySaver);
    const detail = {};
    if (nativeDetail) {
      // Original WC/GL samples above stay intact; passive diagnostics happen afterwards, without collecting the heap.
      detail.memoryCategories = await memoryCategories(inspector);
      for (const [name, command, args] of [
        ['vmmapVerbose', 'vmmap', ['-v', String(gamePID)]],
        ['footprint', 'footprint', ['-f', 'bytes', '-p', String(gamePID)]],
      ]) {
        const path = out.replace(/\.json$/u, '') + '.' + label + '.' + name + '.txt';
        try { writeFileSync(path, execFileSync(command, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 16e6 })); detail[name] = { path, pid: gamePID }; }
        catch (error) { detail[name] = { error: String(error), pid: gamePID }; }
      }
    }
    report.snapshots.push({ label, glBytes, light, ...value, native: { samples, medianBytes: sorted[1], minBytes: sorted[0], maxBytes: sorted[2], vmmapPath, vmmapError: vmmap.startsWith('Error:') ? vmmap : null, ...detail } });
    save(); console.log(label, 'native', sorted[1] / 1e6, 'GL', glBytes === null ? 'after last pose' : glBytes / 1e6, 'census', censusMode === 'every' ? 'after this reading' : 'not yet');
  };
  // --census=final: one full census, after the last measured pose's reading, attached to that pose.
  let censusDone = censusMode !== 'final' && glMode === 'every' && vmmapMode === 'every';
  const finalCensus = async () => {
    if (censusDone) return;
    censusDone = true;
    const row = report.snapshots.at(-1);
    if (!row) return;
    if (vmmapMode === 'last') {
      try { writeFileSync(row.native.vmmapPath, execFileSync('vmmap', ['-summary', String(gamePID)], { encoding: 'utf8', timeout: 30000, maxBuffer: 8e6 })); }
      catch (error) { row.native.vmmapError = String(error); }
    }
    if (glMode === 'last') {
      row.light = await evaluate(lightExpression);
      row.glBytes = row.light.gl.reduce((sum, context) => sum + context.totalBytes, 0);
      row.glReadAfterAllReadings = true;
      if (row.light.settings?.memorySaver !== memorySaver) throw new Error('Memory saver fixture did not activate: expected ' + memorySaver + ', observed ' + row.light.settings?.memorySaver);
      save(); console.log(row.label, 'GL (read after the last footprint)', row.glBytes / 1e6);
    }
    if (censusMode !== 'final') return;
    report.stage = 'census:' + row.label; save();
    const value = await evaluate(snapshotExpression);
    const censusGL = value.census.gl.reduce((sum, context) => sum + context.totalBytes, 0);
    Object.assign(row, value, { censusAfterReading: true, censusGLDriftBytes: censusGL - row.glBytes });
    save(); console.log(row.label, 'census GL', censusGL / 1e6, 'model', value.residency.cost.playing / 1e6);
  };
  if (standalone) {
    await snapshot('standalone-spawn');
    await evaluate('(async () => { await window.__wildshard.pose({ x: 0.92, y: 0.55, z: -0.92, yaw: 0, pitch: -0.08 }); return true; })()');
    await snapshot('standalone-centre');
  } else {
  await snapshot('home-settled');
  const state = await evaluate('window.__wildshard.shard.grid.state()');
  const page = { evaluate: expression => evaluate(expression, 180000) };
  if (publicGrid) {
    for (const plan of publicGridPlans(state)) {
      report.stage='route:'+plan.name;writeFileSync(phaseFile,report.stage);save();
      report.routes.push(await runFloorGridRoute(page,plan,documentOrigin));
      await snapshot(plan.name === 'public-road' ? 'public-road' : 'public-template-centre');
    }
    await finalCensus();
    report.publicWitness = await evaluate(`(${readPublicGridWitness.toString()})()`);
    const failures = publicGridWitnessFailures(report.publicWitness,true);
    if (failures.length > 0) throw new Error(failures.join('; '));
  } else if (routeMode === 'sun-entry') {
    const sun = state.cells.find(cell => cell.slug === 'sunscar-dunes');
    if (!sun) throw new Error('Missing Developer Signal Dunes cell');
    const ox = sun.cell[0] * 555, oz = sun.cell[1] * 555;
    const normal = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] }[entryEdge];
    report.sunEntry = { edge: entryEdge, instance: sun.instance };
    report.identity = await evaluate('({build:window.__wildshard.boot.build,tier:window.__wildshard.fingerprint().tier})');
    if (report.identity.build !== report.version.build || report.identity.tier !== 'phone') throw new Error('Sun entered ruler has the wrong build or tier');
    // One initial road pose only. Entry, native-terrain walk to the authored spawn, return and re-entry use real input.
    await evaluate(`(async () => { const api=window.__wildshard, live=api.shard.grid.state().live.live, player=api.requireWorld().player;
      await api.pose({x:${ox + normal[0] * 277.5}-(live.worldFeet.x-player.position.x),y:.55,z:${oz + normal[1] * 277.5}-(live.worldFeet.z-player.position.z),yaw:0,pitch:-.08});return true;})()`);
    await until("window.__wildshard.shard.grid.state().live.live.current===null && window.__wildshard.shard.grid.state().inside===null && window.__wildshard.shard.grid.state().live.live.gameplayReady");
    await evaluate(`(() => { const player=window.__wildshard.requireWorld().player, spawn=player.spawn; window.__sunNativeRecoveries=[];
      player.spawn=function(...args){window.__sunNativeRecoveries.push({time:performance.now(),args});return Reflect.apply(spawn,this,args);};return true;})()`);
    await snapshot('sun-road');
    const drive = async (name, from, to, points) => {
      report.stage = 'route:' + name; writeFileSync(phaseFile, report.stage); save();
      const result = await runFloorGridRoute(page, { name, from, to, movement: 'road-hover',
        waypoints: points.map(point => ({ x: ox + point.x, z: oz + point.z })), requiredResidents: to === null ? [] : [sun.instance] }, documentOrigin);
      report.routes.push(result); save();
      const failures = gridFloorWitnessFailures(result);
      if (failures.length !== 0) throw new Error(failures.join('; '));
    };
    const entry = { x: normal[0] * 210, z: normal[1] * 210 };
    await drive('sun-road-entry', null, sun.instance, [entry]);
    await snapshot('sun-entry');
    await drive('sun-authored-spawn', sun.instance, sun.instance, [{ x: 0, z: 70 }]);
    // Natural camera rotation before the settled reading exposes every direction; no geometry/creature hold or heap collection.
    for (let turn = 0; turn < 12; turn++) {
      await evaluate('(window.__wildshard.requireWorld().player.yaw+=Math.PI/6,true)'); await sleep(100);
    }
    await snapshot('sun-spawn');
    await drive('sun-road-return', sun.instance, null, [entry, { x: normal[0] * 277.5, z: normal[1] * 277.5 }]);
    await snapshot('sun-road-return');
    await drive('sun-reentry', null, sun.instance, [entry]);
    await snapshot('sun-reentry');
    await finalCensus();
    report.recoveries = await evaluate('window.__sunNativeRecoveries');
    const gameErrors = await evaluate('window.__g227Errors');
    const edgeFallbacks = await evaluate("window.__g227Warnings.filter(message=>/edges stay at road level|platform keeps road-level edges|edge.*fallback|fallback.*edge/iu.test(message))");
    if (report.recoveries.length !== 0 || gameErrors.length !== 0 || edgeFallbacks.length !== 0) throw new Error('Sun route had a recovery, game error or edge fallback');
    report.enteredCost = report.snapshots.filter(row => ['sun-entry', 'sun-spawn', 'sun-reentry'].includes(row.label)).map(row => {
      const contexts = row.light.gl, glBytes = row.glBytes;
      if (contexts.length === 0 || glBytes <= 0 || !contexts.every(context => context.reconciled) || contexts.some(context => context.unlabelledBytes > 0)) throw new Error('Sun entered GL census is missing, unreconciled or unlabelled');
      const combinedBytes = row.native.medianBytes + glBytes, highSampleCombinedBytes = row.native.maxBytes + glBytes;
      return { label: row.label, webContentBytes: row.native.medianBytes, labelledGLBytes: glBytes, combinedBytes, highSampleCombinedBytes, withinExplorerCap: highSampleCombinedBytes <= 1e9 };
    });
    report.enteredSettledWorstBytes = Math.max(...report.enteredCost.map(row => row.combinedBytes));
    report.enteredHighSampleBytes = Math.max(...report.enteredCost.map(row => row.highSampleCombinedBytes));
    report.withinExplorerCap = report.enteredHighSampleBytes <= 1e9;
    report.leak = await evaluate('window.__wildshard.leak()');
    report.finalGL = await evaluate('window.__sc_gl().map(({gl,...row})=>row)');
    if (JSON.stringify(report.leak.before) !== JSON.stringify(report.leak.after) || report.leak.disposalErrors.length !== 0
      || Object.values(report.leak.scope).some(count => count !== 0)) throw new Error('Sun final unload failed its exact baseline census or scope fence');
    writeFileSync(phaseFile, 'sun-unloaded'); report.unloadedSamples = [];
    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex++) {
      await sleep(1100);
      report.unloadedSamples.push(await waitNativeSample(() => readFileSync(nativeFile, 'utf8'), () => samplerState,
        { phase: 'sun-unloaded', pid: gamePID, after: report.unloadedSamples.at(-1)?.at }));
    }
    save();
  } else if (routeMode === 'sky-entry') {
    const sky = state.cells.find(cell => cell.slug === 'far-reach');
    if (!sky) throw new Error('Missing Developer Sky Reach cell');
    const ox = sky.cell[0] * 555, oz = sky.cell[1] * 555;
    // The single initial road approach is staged; all subsequent entry, ride and bridge travel is real input.
    await evaluate(`(async () => { const api=window.__wildshard, live=api.shard.grid.state().live.live, player=api.requireWorld().player;
      await api.pose({x:${ox}-(live.worldFeet.x-player.position.x),y:.55,z:${oz + 277.5}-(live.worldFeet.z-player.position.z),yaw:0,pitch:-.08});return true;})()`);
    await until("window.__wildshard.shard.grid.state().live.live.current===null && window.__wildshard.shard.grid.state().inside===null && window.__wildshard.shard.grid.state().live.live.gameplayReady");
    await evaluate(`(() => { const player=window.__wildshard.requireWorld().player, spawn=player.spawn; window.__skyNativeRecoveries=[];
      player.spawn=function(...args){window.__skyNativeRecoveries.push({time:performance.now(),args});return Reflect.apply(spawn,this,args);};return true;})()`);
    await snapshot('sky-road');
    const drive = async (name, from, points) => {
      report.stage = 'route:' + name; writeFileSync(phaseFile, report.stage); save();
      report.routes.push(await runFloorGridRoute(page, { name, from, to: sky.instance, movement: 'road-hover',
        waypoints: points.map(point => ({ x: ox + point.x, z: oz + point.z })), requiredResidents: [sky.instance] }, documentOrigin));
    };
    await drive('sky-socket-lip', null, [{ x: 0, z: 234 }]);
    await snapshot('sky-lip');
    const entry = await evaluate("JSON.parse(JSON.stringify(window.__wildshard.shard.farReach.islets.find(entry=>entry.edge==='north')))");
    report.skyEntry = entry;
    await drive('sky-board', sky.instance, [entry.rest]);
    await snapshot('sky-board');
    report.stage = 'ride:sky-north'; writeFileSync(phaseFile, report.stage); save();
    await evaluate("(window.__wildshard.shard.farReach.interactIslet('north',1),true)");
    await until(`Math.abs(window.__wildshard.shard.farReach.isletAt('north').y-${entry.dock.y})<.01`, (entry.travel + 10) * 1000);
    const riderY = await evaluate('window.__wildshard.requireWorld().player.position.y');
    if (Math.abs(riderY - entry.dock.y) > .5) throw new Error('Sky rider failed to reach its dock');
    // The lift returns after six seconds: disembark normally before the nine-second settled sample.
    // Sample on the stationary gate, rather than making the ruler itself miss the playable dock window.
    await drive('sky-dock-gate', sky.instance, entry.climb.slice(1, 3));
    await snapshot('sky-gate');
    await drive('sky-bridge-island', sky.instance, entry.climb.slice(3));
    await snapshot('sky-island');
    await finalCensus();
    const islandY = await evaluate('window.__wildshard.requireWorld().player.position.y');
    if (Math.abs(islandY - entry.isle.y) > .5) throw new Error('Sky bridge failed to reach playable island ground');
    report.recoveries = await evaluate('window.__skyNativeRecoveries');
    const gameErrors = await evaluate('window.__g227Errors');
    const edgeFallbacks = await evaluate("window.__g227Warnings.filter(message=>/edges stay at road level|platform keeps road-level edges|edge.*fallback|fallback.*edge/iu.test(message))");
    if (report.recoveries.length !== 0 || gameErrors.length !== 0 || edgeFallbacks.length !== 0) throw new Error('Sky route had a recovery, game error or edge fallback');
    report.enteredCost = report.snapshots.filter(row => row.label.startsWith('sky-') && row.label !== 'sky-road').map(row => {
      const glBytes=row.glBytes;
      const combinedBytes=row.native.medianBytes+glBytes;
      const highSampleCombinedBytes=row.native.maxBytes+glBytes;
      return {label:row.label,webContentBytes:row.native.medianBytes,labelledGLBytes:glBytes,combinedBytes,highSampleCombinedBytes,withinExplorerCap:highSampleCombinedBytes<=1e9};
    });
    report.enteredSettledWorstBytes = Math.max(...report.enteredCost.map(row=>row.combinedBytes));
    report.enteredHighSampleBytes = Math.max(...report.enteredCost.map(row=>row.highSampleCombinedBytes));
    report.withinExplorerCap = report.enteredHighSampleBytes <= 1e9;
    report.leak = await evaluate('window.__wildshard.leak()');
    report.finalGL = await evaluate('window.__sc_gl().map(({gl,...row})=>row)');
    if (report.leak.after.bodies !== 0 || report.leak.after.colliders !== 0 || report.leak.disposalErrors.length !== 0
      || Object.values(report.leak.scope).some(count => count !== 0)) throw new Error('Sky final unload leaked native resources or scopes');
    writeFileSync(phaseFile, 'sky-unloaded');
    report.unloadedSamples = [];
    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex++) {
      await sleep(1100);
      report.unloadedSamples.push(await waitNativeSample(() => readFileSync(nativeFile, 'utf8'), () => samplerState,
        { phase: 'sky-unloaded', pid: gamePID, after: report.unloadedSamples.at(-1)?.at }));
    }
    save();
  } else {
  const home = state.cells.find(cell=>cell.instance===state.home), directNalati=state.cells.find(cell=>cell.slug==='nalati-grasslands');
  if (!home || !directNalati) throw new Error('Missing home/Nalati catalogue cell');
  const plans = routeMode.startsWith('nalati') ? [{name:'nalati-direct',from:home.instance,to:directNalati.instance,
    start:{x:230,z:0},waypoints:[{x:directNalati.cell[0]*555-230,z:directNalati.cell[1]*555}],requiredResidents:[directNalati.instance]}]
    : routeMode === 'pine-centre' ? gridFloorPlans(state, 'runtime-travel').slice(0, 1) : gridFloorPlans(state, 'runtime-travel');
  for (const plan of plans) {
    report.stage = 'route:' + plan.name; writeFileSync(phaseFile, report.stage); save();
    report.routes.push(await runFloorGridRoute(page, plan, documentOrigin));
    await snapshot(plan.to + '-entry');
    const cell = state.cells.find(c => c.instance === plan.to);
    report.routes.push(await runFloorGridRoute(page, { name: plan.to + '-centre', from: plan.to, to: plan.to,
      waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }, documentOrigin));
    await snapshot(plan.to + '-centre');
  }
  const heapAt = async label => {
    // Collection happens only after the original pose's footprint/GL sample, in its own experiment.
    report.stage='heap-snapshot';save();
    try {
      await inspector.raw('(() => {const game=window.__wildshard.requireWorld().game;window.__g227SavedFrameGate=game.frameGate;game.frameGate=()=>false;return true;})()');
      await inspector.send('Heap.enable');
      const heap=await inspector.send('Heap.snapshot');
      const path=out.replace(/\.json$/u,'')+'.heap.json';writeFileSync(path,heap.snapshotData);
      report.heap={path,timestamp:heap.timestamp,pose:label};save();
      if (routeMode === 'nalati-centre-heap') {
        const metadata = await heapOwners(inspector, JSON.parse(heap.snapshotData));
        const metadataPath = out.replace(/\.json$/u,'')+'.heap-owners.json';
        writeFileSync(metadataPath,JSON.stringify(metadata,null,2)+'\n');report.heap.ownersPath=metadataPath;save();
      }
      await snapshot(label+'-after-heap');
    } catch(error){report.heap={error:String(error),pose:label};save();}
    finally {await inspector.raw('(() => {const game=window.__wildshard?.world?.game;if(game && window.__g227SavedFrameGate)game.frameGate=window.__g227SavedFrameGate;delete window.__g227SavedFrameGate;return true;})()').catch(()=>null);}
  };
  if (routeMode === 'nalati-centre-heap') {
    await finalCensus();
    await heapAt('nalati-grasslands-centre');
  } else if (routeMode === 'pine-centre') {
    await finalCensus();
  } else {
  // A real-input road-only counterfactual, far beyond the former source's retained ring.
  // It measures the page/platform/cache remainder after owned runtime retirement, not hidden meshes.
  const nalati = state.cells.find(cell => cell.slug === 'nalati-grasslands');
  if (!nalati) throw new Error('Missing Nalati catalogue cell');
  report.stage = 'route:neutral-road'; save();
  report.routes.push(await runFloorGridRoute(page, {name:'neutral-road',from:nalati.instance,to:null,
    waypoints:[{x:277.5,z:0},{x:277.5,z:-277.5},{x:-277.5,z:-277.5}],requiredResidents:[]},documentOrigin));
  await until('window.__wildshard.shard.grid.state().live.live.residents.length === 0',90000);
  await snapshot('neutral-road');
  await finalCensus();
  if(routeMode === 'nalati-heap') {
    await heapAt('neutral-road');
  } else if (routeMode !== 'nalati-route') { report.glFootprintControl = await footprintControl(evaluate); save(); }
  }
  }
  }
  }
} catch (error) { report.diagnostic = await inspector?.raw(`JSON.stringify({url:location.href,origin:performance.timeOrigin,token:window.__frameFloorGridDocumentToken,stop:window.__frameFloorGridStop,grid:window.__wildshard?.shard?.grid?.state(),player:window.__wildshard?.world?.player?.position,body:document.body.innerText.slice(-4000),loading:document.querySelector('.ws-load')?.textContent,saved:(()=>{try{const keys=JSON.parse(localStorage.getItem('wildshard.save.v2.device')??'{"keys":{}}').keys;return Object.fromEntries(['life.lastEnd','life.lastUnload','boot.trace'].map(k=>[k,keys?.[k]?.data??null]));}catch(error){return{error:String(error)};}})()})`).catch(() => null); report.failure = String(error); process.exitCode = 1; console.error(report.failure); }
finally {
  report.errors = await inspector?.raw('JSON.stringify(window.__g227Errors ?? [])').catch(() => null);
  report.warnings = await inspector?.raw('JSON.stringify(window.__g227Warnings ?? [])').catch(() => null);
  inspector?.close(); proxy?.kill('SIGTERM'); writeFileSync(phaseFile, 'done');
  if (sampler) { await Promise.race([new Promise(resolve => sampler.once('exit', resolve)), sleep(3000)]); if (sampler.exitCode === null) sampler.kill('SIGTERM'); }
  try { simctl(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Already exited. */ }
  report.closed = true; save();
}

function evaluator(raw, observe = () => undefined) {
  return async (expression, timeout = 35000) => {
    const key = `__frameFloorEval${++evalSequence}`;
    const origin = await raw(`globalThis.__g227DocumentToken ??= crypto.randomUUID(); globalThis[${JSON.stringify(key)}] = {done:false}; Promise.resolve().then(() => (${expression})).then(value => {globalThis[${JSON.stringify(key)}] = {done:true,value};}, error => {globalThis[${JSON.stringify(key)}] = {done:true,error:String(error)};}); JSON.stringify({timeOrigin:performance.timeOrigin,token:globalThis.__g227DocumentToken})`);
    const identity = JSON.parse(origin);
    const start = Date.now();
    try {
      while (Date.now() - start < timeout) {
        const value = await raw(`JSON.stringify({origin:performance.timeOrigin,token:globalThis.__g227DocumentToken,state:globalThis[${JSON.stringify(key)}] ?? null,progress:window.__frameFloorGridProgress?.() ?? null})`);
        const envelope = typeof value === 'string' ? JSON.parse(value) : null;
        if (envelope?.token !== identity.token) throw Object.assign(new Error('Frame floor document changed during evaluation (navigation or graphics recovery); measurement cannot continue'), { documentOrigin: envelope?.origin });
        report.evaluationOriginDriftMaxMs = Math.max(report.evaluationOriginDriftMaxMs ?? 0, Math.abs(envelope.origin - identity.timeOrigin));
        if (envelope.progress) observe(envelope.progress);
        const state = envelope.state;
        if (state?.done) { if (state.error) throw new Error(state.error); return state.value; }
        await sleep(100);
      }
      throw new Error(`Browser evaluation timed out: ${expression.slice(0, 80)}`);
    } finally { await raw(`delete globalThis[${JSON.stringify(key)}]`).catch(() => { /* A navigated page may have dropped the evaluation envelope. */ }); }
  };
}
function webkit(wsUrl) {
  const ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 }), pending = new Map(), listeners = new Map();
  let seq = 0, target = null;
  const opened = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('close', event => { for (const [id, waiter] of pending) { clearTimeout(waiter.timer); waiter.reject(new Error(`Inspector socket closed ${event.code}: ${event.reason}`)); pending.delete(id); } });
  const inner = (message) => {
    for (const listener of listeners.get(message.method) ?? []) listener(message.params);
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); if (message.error) waiter.reject(new Error(message.error.message)); else waiter.done(message.result); }
  };
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') target = message.params.targetInfo.targetId;
    else if (message.method === 'Target.didCommitProvisionalTarget') target = message.params.newTargetId;
    else if (message.method === 'Target.dispatchMessageFromTarget') inner(JSON.parse(message.params.message));
    else inner(message);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Web Inspector timed out: ${method}`)); }, method === 'Heap.snapshot' ? 300000 : 10000);
    pending.set(id, { done: resolve, reject, timer });
    const message = { id, method, params };
    ws.send(JSON.stringify(target ? { id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } } : message));
  });
  return { opened, send, on: (method, listener) => { const entries = listeners.get(method) ?? new Set(); entries.add(listener); listeners.set(method, entries); return () => { entries.delete(listener); if (entries.size === 0) listeners.delete(method); }; }, raw: async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
    return result.result?.value;
  }, close: () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Inspector closed')); } pending.clear(); listeners.clear(); ws.close(); } };
}
async function safariPage(base) {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = pages.find((p) => p.url?.startsWith(base));
        if (page) return page.webSocketDebuggerUrl;
      } catch { /* Proxy discovery has not announced the Simulator yet. */ }
    }
    await sleep(200);
  }
  throw new Error('Simulator Safari page not exposed by ios_webkit_debug_proxy (ports 9232–9240)');
}

async function footprintControl(evaluate) {
  // A separate offscreen allocation experiment, after all measured route poses.
  // Compare the same WebContent PID and the separately sampled GPU process, then delete everything.
  const controlSample = async label => {
    writeFileSync(phaseFile, label); await sleep(3000);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1100);
      const rows = readFileSync(nativeFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      const latest = rows.findLast(row => row.type === 'sample' && row.phase === label);
      const [pid, values] = Object.entries(latest.pids).sort((a,b) => b[1][0] - a[1][0])[0];
      samples.push({pid:Number(pid),webContentBytes:values[0],gpuProcessBytes:latest.gpu});
    }
    return { samples, webContentBytes: samples.map(s=>s.webContentBytes).sort((a,b)=>a-b)[1],
      gpuProcessBytes: samples.map(s=>s.gpuProcessBytes).sort((a,b)=>a-b)[1] };
  };
  const result = {protocol:'After route poses, a separate offscreen RGBA8 4096x4096 texture (67,108,864 bytes), full-surface shader draw/finished, then deleted. No texture CPU upload. WC and GPU-process physical footprints sampled independently.'};
  result.before = await controlSample('gl-control-before'); 
  result.allocatedBytes = await evaluate(`(() => {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('No WebGL2 control context');
    const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,texture); gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,4096,4096);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete GL control allocation');
    const shader = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('Control shader failed'); return s; };
    const vertex=shader(gl.VERTEX_SHADER,'#version 300 es\\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}');
    const fragment=shader(gl.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;out vec4 colour;void main(){colour=vec4(fract(gl_FragCoord.x*.017),fract(gl_FragCoord.y*.021),fract(gl_FragCoord.x*gl_FragCoord.y*.003),1);}');
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Control program failed');
    gl.useProgram(program);gl.viewport(0,0,4096,4096);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();
    gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    const pixel=new Uint8Array(4);gl.readPixels(1777,1555,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);window.__g227ControlPixel=[...pixel];
    if (gl.getError() !== gl.NO_ERROR) throw new Error('GL control allocation failed');
    window.__g227GLControl = {canvas,gl,texture,framebuffer}; return 4096*4096*4;
  })()`);
  result.during = await controlSample('gl-control-during');
  result.pixel = await evaluate('window.__g227ControlPixel');
  await evaluate('(() => { const bytes=new Uint8Array(67108864);for(let i=0;i<bytes.length;i+=4096)bytes[i]=1;window.__g227CPUControl=bytes;return bytes.length;})()');
  result.cpuPositive = await controlSample('cpu-control-positive');
  await evaluate('(delete window.__g227CPUControl,true)'); 
  await evaluate(`(() => { const {gl,texture,framebuffer}=window.__g227GLControl; gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture); gl.finish(); gl.getExtension('WEBGL_lose_context')?.loseContext(); delete window.__g227GLControl; return true;})()`);
  result.after = await controlSample('gl-control-after'); 
  return result;
}
