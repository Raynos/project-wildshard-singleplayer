#!/usr/bin/env node
// SF0: live drawn-frame baseline, never a deterministic/capture-clock or CPU-throttled run.
// node scripts/frame-floor.mjs [--shards=a,b] [--surface=desktop|sim|both] [--frames=120] [--device=<name>] [--rev=<sha>] [--setting=key=value] [--device-save=key=value]
// --shards=grid: INFINITE WILDSHARD, entered the way a player does (the title's grid entry tapped, Developer on; no URL
// switch), measured at the home cell's spawn and the heaviest of its parity cameras plus three highway-deck views.
// Owns a clean, pinned HEAD preview, browser/simulator lanes and their cleanup. Exit 2 = floor misses;
// exit 3 = incomplete measurement. --regrade=<baseline> reapplies current floor policy without rerendering.
// Results: progress/frame-floor/<measured-short-sha>.json.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { saveFixtureCode } from './debug-settings.mjs';
import { gridFloorPlans, stageFloorGrid, driveFloorGrid, gridFloorWitnessFailures, installFloorGridProgress, gridFloorRuntimeFailure, gridFloorDocumentIdentity } from './frame-floor-grid.mjs';
import { GL_INIT } from './parity/glbytes.mjs';
import { publicGridIntentCode, publicGridPlans, readPublicGridWitness, publicGridWitnessFailures } from './public-grid.mjs';

const ROOT = resolvePath(import.meta.dirname, '..');
const SCRIPT = import.meta.filename;
const ALL = ['_template', 'driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'sunscar-dunes', 'far-reach', 'nine-dragon-stack', 'grid'];
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const shards = flag('shards', ALL.join(',')).split(',');
const surface = flag('surface', 'both');
const frames = Number(flag('frames', '120'));
const settleMs = Number(flag('settle', '2')) * 1000;
const device = flag('device', 'frame-floor-iphone-17-pro');
const developer = flag('developer', 'on');
if (!['on', 'off'].includes(developer)) throw new Error('Developer must be on or off');
const publicGrid = developer === 'off' && shards.includes('grid');
if (publicGrid && shards.length !== 1) throw new Error('Public grid requires its own floor run');
const gridScenario = flag('grid-scenario', 'baseline');
// Allocation hooks only for diagnostic travel runs; ordinary standing baselines remain uninstrumented.
const travelGl = gridScenario === 'baseline' ? '' : GL_INIT;
if (!['baseline', 'template', 'runtime-travel', 'sun-entry', 'all'].includes(gridScenario) || (gridScenario !== 'baseline' && !shards.includes('grid'))) throw new Error('Invalid grid scenario');
if (publicGrid && gridScenario === 'sun-entry') throw new Error('Signal Dunes entered floor requires Developer mode');
if (args.includes('--help')) {
  console.log('node scripts/frame-floor.mjs [--shards=a,b] [--surface=desktop|sim|both] [--developer=on|off] [--frames=120] [--settle=2] [--device=<name>] [--rev=<sha>] [--setting=key=value] [--device-save=key=value] [--grid-scenario=baseline|template|runtime-travel|sun-entry|all]\nRuns an isolated clean pinned export; desktop uncapped at 1440×900/2×, Safari iPhone 17 Pro phone tier/2×. Grid scenarios drive actual input and require frame/interior/residency witnesses. Public grid seeds only the existing tap intent; admission remains hard. Owns its lanes. Exit 2: floor miss, 3: incomplete.');
  process.exit(0);
}
if (shards.length === 0 || shards.some((s) => !ALL.includes(s)) || new Set(shards).size !== shards.length || !['desktop', 'sim', 'both'].includes(surface) || !Number.isInteger(frames) || frames < 30 || frames > 600 || !Number.isFinite(settleMs) || settleMs < 1000 || settleMs > 10000) throw new Error('Invalid shards, surface, frames (30–600) or settle (1–10 seconds)');

const ERROR_SCRIPT = `window.__frameFloorErrors=[];window.addEventListener('error',e=>window.__frameFloorErrors.push(String(e.message).slice(0,240)));window.addEventListener('unhandledrejection',e=>window.__frameFloorErrors.push(String(e.reason).slice(0,240)));`;
const CONSOLE_SCRIPT = `window.__frameFloorConsole=[];for(const level of ['log','info','warn','error']){const original=console[level].bind(console);console[level]=(...args)=>{window.__frameFloorConsole.push({level,text:args.map(value=>String(value)).join(' ').slice(0,1000)});if(window.__frameFloorConsole.length>100)window.__frameFloorConsole.shift();original(...args);};}`;
const settingArgs = args.filter((arg) => arg.startsWith('--setting='));
const picks = Object.fromEntries(settingArgs.map((arg) => {
  const match = /^--setting=([a-zA-Z][a-zA-Z0-9.]*)=([^=]+)$/u.exec(arg);
  if (!match || ['tier', 'fps'].includes(match[1])) throw new Error('Invalid Debug setting; tier and fps belong to the floor protocol');
  return [match[1], match[2]];
}));
if (publicGrid && Object.hasOwn(picks, 'memorySaver') && picks.memorySaver !== 'off') throw new Error('Public grid measures the shipping Memory saver default OFF');
const settings = { ...picks, ...(publicGrid ? {memorySaver:'off'} : {}), tier: surface === 'sim' ? 'phone' : 'desktop', fps: 'auto' };
const deviceSaveArgs = args.filter((arg) => arg.startsWith('--device-save='));
const deviceSaves = Object.fromEntries(deviceSaveArgs.map((arg) => {
  const match = /^--device-save=([a-zA-Z][a-zA-Z0-9._-]*)=(.+)$/u.exec(arg);
  if (!match) throw new Error('Invalid device save; expected key=value');
  return [match[1], match[2]];
}));
const systemArgs = args.filter((arg) => arg.startsWith('--expect-system='));
const expectedSystems = systemArgs.map((arg) => {
  const match = /^--expect-system=([a-zA-Z0-9_-]+):([a-zA-Z0-9._-]+)=(on|off)$/u.exec(arg);
  if (!match || !shards.includes(match[1])) throw new Error('Expected system must name a measured shard:system=on|off');
  return { shard: match[1], id: match[2], present: match[3] === 'on' };
});
const fixture = (tier) => [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { ...settings, tier }, merge: true }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: developer === 'on' }),
  ...Object.entries(deviceSaves).map(([key, data]) => saveFixtureCode({ scope: 'device', key, data })),
  ...(publicGrid ? [publicGridIntentCode({instance:'driftwood-isle',slug:'driftwood-isle'})] : []),
].join(';');
const query = (shard) => (shard === 'grid' && !publicGrid ? '?mute=1&nolock=1&sw=0' : `?chunk=${encodeURIComponent(shard === 'grid' ? 'driftwood-isle' : shard)}&mute=1&skipintro=1&nolock=1&sw=0`); // the public pre-release probe seeds only the existing intent
/** Highway-deck views around the grid's home cell (home-frame metres): a neighbour's far proxy across the deck, a crossroads, the north gap. */
const GRID_POSES = [{ name: 'grid-deck-east', x: 277.5, y: 1.7, z: -40, yaw: 0, pitch: -0.08 }, { name: 'grid-crossroads', x: 240, y: 6, z: 240, yaw: -Math.PI * 0.75, pitch: -0.12 }, { name: 'grid-deck-north', x: 0, y: 3, z: 262, yaw: Math.PI, pitch: -0.05 }];
const errorText = (e) => e instanceof Error ? e.message : String(e);

// Jake's SF0 clarification (2026-10-04): allow vsync quantization, retain the original strict verdict.
function assess(result, surfaceName) {
  const floorFps = surfaceName === 'desktop' ? 60 : 30;
  const strictMs = surfaceName === 'desktop' ? 16.7 : 33.3;
  const limitMs = surfaceName === 'desktop' ? 17.5 : 35;
  const medianFpsRounded = Math.round(result.medianFps);
  const cpuLimitMs = 1000 / floorFps / 4;
  const cpuPass = result.cpu?.enabled === true && result.cpu.frames === result.frames && result.cpu.owners.length > 0 && result.cpu.owners.every(owner => Number.isFinite(owner.p95Ms) && owner.p95Ms <= cpuLimitMs);
  const valid = result.skipped === 0 && result.contextLost === false;
  const pass = valid && cpuPass && medianFpsRounded >= floorFps && result.p95Ms <= limitMs;
  const strictP95Pass = result.p95Ms <= strictMs;
  const strictPass = valid && medianFpsRounded >= floorFps && strictP95Pass;
  const miss = pass ? null : !valid ? 'invalid measurement' : !cpuPass ? 'content CPU share / missing ownership measurement' : result.p95Ms > limitMs || result.medianFps < floorFps * 0.95 || result.workP95Ms > 1000 / floorFps ? 'frame cost / scheduling' : 'timing quantization';
  return { floorFps, medianFpsRounded, strictMs, limitMs, cpuLimitMs, cpuPass, pass, strictP95Pass, strictPass, miss };
}
function grade(record) {
  record.criteria = { medianFps: 'Integer-rounded median >= 60 desktop / >= 30 Simulator; raw medianFps retained', p95Ms: '<= 17.5 desktop / <= 35.0 Simulator; 1.05 times the nominal frame period', strictP95Ms: '<= 16.7 desktop / <= 33.3 Simulator', cpu: 'Each trusted content owner p95 <= one quarter frame: 4.167 ms desktop / 8.333 ms Simulator; shell and harness observers excluded' };
  for (const result of record.results) for (const shard of result.rows) {
    for (const row of shard.rows ?? []) Object.assign(row, assess(row, result.surface));
    if (shard.complete) shard.pass = !shard.runtimeFailure && (shard.rows ?? []).every((row) => row.pass) && shard.errors.length === 0;
  }
  record.complete = record.results.every((result) => result.rows.every((shard) => shard.complete));
  record.pass = record.complete && record.underTenMinutes && record.results.every((result) => result.rows.every((shard) => shard.pass));
  return record;
}
function printVerdict(record) {
  for (const surfaceResult of record.results) for (const shard of surfaceResult.rows) {
    const misses = (shard.rows ?? []).filter((row) => !row.pass).map((row) => `${row.pose.name}: ${row.medianFps} fps / p95 ${row.p95Ms} ms (${row.miss})`);
    console.log(`${surfaceResult.surface} ${shard.shard}: ${shard.pass ? 'PASS' : 'FAIL'}${misses.length > 0 ? ` — ${misses.join('; ')}` : shard.error ? ` — ${shard.error}` : ''}`);
  }
}

// All browser-side helpers execute identically in Chromium and Mobile Safari, with real time and live gameplay.
function status() {
  const w = window.__wildshard?.world;
  // A boot failure renders the shell's load-failure screen (src/engine/ui/errorScreen.ts) without a game: fail fast with its message.
  const failure = document.querySelector('.ws-load-error');
  return { ready: Boolean(w?.game && !document.querySelector('.ws-load')), error: document.querySelector('#wserr .msg')?.textContent ?? (failure ? `Load failure: ${[...failure.querySelectorAll('h1,p')].map(node => node.textContent).join(' — ')}` : undefined),
    level: w?.game.level.id, clock: w?.game.app.clock.mode, entered: w?.hud?.entered };
}
function metadata() {
  const w = window.__wildshard.world, g = w.game, gl = g.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  const saved = JSON.parse(localStorage.getItem('wildshard.save.v2.global') ?? '{}');
  const deviceSaved = JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}');
  return { renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
    viewport: [innerWidth, innerHeight], devicePixelRatio, renderScale: g.renderer.getPixelRatio(), canvas: [g.canvas.width, g.canvas.height], developer: Object.hasOwn(document.documentElement.dataset,'dev'),
    settings: saved.keys?.settings?.data, gfx: saved.keys?.gfx?.data, deviceSaves: Object.fromEntries(Object.entries(deviceSaved.keys ?? {}).map(([key, value]) => [key, value.data])), clock: g.app.clock.mode,
    bootTrace: deviceSaved.keys?.['boot.trace']?.data, console: window.__frameFloorConsole ?? [],
    systems: Object.values(g.app.systemsByPhase()).flat().map((system) => system.id),
    spawn: { name: 'spawn', x: w.player.position.x, y: w.player.position.y, z: w.player.position.z, yaw: w.player.yaw, pitch: w.player.pitch }, userAgent: navigator.userAgent };
}
async function cameras() {
  const authored = await window.__wildshard.world.game.level.capturePoses?.() ?? {};
  return Object.entries(authored).flatMap(([name, c]) => c.probe ? [{ ...c.probe, name: c.probe.name ?? name }] : c.feet ? [{ name, x: c.feet[0], y: c.feet[1], z: c.feet[2], yaw: -c.yaw * Math.PI / 180, pitch: c.pitch * Math.PI / 180 }] : []);
}
function sample(n) {
  const g = window.__wildshard.world.game, meter = g.app?.cpu;
  if (!meter) return Promise.reject(new Error('Content CPU meter unavailable; use an SF62-capable pin'));
  meter.enabled = true;
  return new Promise((resolve, reject) => {
    const interval = [], callbackInterval = [], ring = [], work = [], calls = [], triangles = [], cpuOwners = new Map();
    let cpuFrames = 0, cpuFrame = -1;
    let count = g.frameCount, last = 0, lastCallback = 0, skipped = 0, first = true;
    let raf = 0;
    const timeout = setTimeout(() => { cancelAnimationFrame(raf); reject(new Error(`Drawn-frame sampler stalled (${interval.length}/${n})`)); }, 30000);
    const tick = (timestamp) => {
      const now = performance.now();
      if (g.frameCount !== count) {
        const delta = g.frameCount - count;
        if (!first) {
          // rAF's shared vsync timestamp grades drawn cadence; callback time also includes preceding game work.
          interval.push(timestamp - last); callbackInterval.push(now - lastCallback); skipped += Math.max(0, delta - 1);
          const i = (g.frameI + g.frameMs.length - 1) % g.frameMs.length;
          ring.push(g.frameMs[i]); work.push(g.workMs[i]); calls.push(g.lastFrame.calls); triangles.push(g.lastFrame.triangles);
          const cpu = meter.snapshot();
          if (cpu.enabled && cpu.frame > cpuFrame && cpu.owners.length > 0) {
            cpuFrame = cpu.frame; cpuFrames++;
            for (const owner of cpu.owners) {
              if (!cpuOwners.has(owner.id)) cpuOwners.set(owner.id, { ms: [], calls: 0 });
              const row = cpuOwners.get(owner.id); row.ms.push(owner.ms); row.calls += owner.calls;
            }
          }
        }
        first = false; count = g.frameCount; last = timestamp; lastCallback = now;
      }
      if (interval.length < n) { raf = requestAnimationFrame(tick); return; }
      clearTimeout(timeout);
      const pct = (v, p) => { const sorted = [...v].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]; };
      const round = (v) => Math.round(v * 1000) / 1000;
      resolve({ frames: interval.length, skipped, medianFps: round(1000 / pct(interval, 0.5)), p50Ms: round(pct(interval, 0.5)),
        p95Ms: round(pct(interval, 0.95)), p99Ms: round(pct(interval, 0.99)), maxMs: round(pct(interval, 1)),
        callbackP95Ms: round(pct(callbackInterval, 0.95)), callbackP99Ms: round(pct(callbackInterval, 0.99)), callbackMaxMs: round(pct(callbackInterval, 1)),
        gameP95Ms: round(pct(ring, 0.95)), workP95Ms: round(pct(work, 0.95)), calls: pct(calls, 0.5), triangles: pct(triangles, 0.5),
        position: { x: window.__wildshard.world.player.position.x, y: window.__wildshard.world.player.position.y, z: window.__wildshard.world.player.position.z },
        cpu: { enabled: meter.snapshot().enabled, frames: cpuFrames, owners: [...cpuOwners].map(([id, row]) => ({ id, samples: row.ms.length, p95Ms: pct(row.ms, 0.95), maxMs: pct(row.ms, 1), calls: row.calls })) },
        contextLost: g.renderer.getContext().isContextLost() });
    };
    raf = requestAnimationFrame(tick);
  });
}

// Runtime.evaluate on Safari does not await JavaScript promises. Poll an explicit result envelope;
// Target.* multiplexing is supported; a new document invalidates the measurement rather than replaying it.
let evalSequence = 0;
let evaluationOriginDriftMaxMs = 0;
function evaluator(raw, observe = () => undefined) {
  return async (expression, timeout = 35000) => {
    const key = `__frameFloorEval${++evalSequence}`;
    const origin = JSON.parse(await raw(`globalThis[${JSON.stringify(key)}] = {done:false}; Promise.resolve().then(() => (${expression})).then(value => {globalThis[${JSON.stringify(key)}] = {done:true,value};}, error => {globalThis[${JSON.stringify(key)}] = {done:true,error:String(error)};}); JSON.stringify((${gridFloorDocumentIdentity.toString()})())`));
    const start = Date.now();
    try {
      while (Date.now() - start < timeout) {
        const value = await raw(`JSON.stringify({identity:(${gridFloorDocumentIdentity.toString()})(),state:globalThis[${JSON.stringify(key)}] ?? null,progress:window.__frameFloorGridProgress?.() ?? null})`);
        const envelope = typeof value === 'string' ? JSON.parse(value) : null;
        if (envelope?.identity?.token !== origin.token) throw Object.assign(new Error('Frame floor document changed during evaluation (navigation or graphics recovery); measurement cannot continue'), { documentOrigin: envelope?.identity?.timeOrigin });
        evaluationOriginDriftMaxMs = Math.max(evaluationOriginDriftMaxMs, Math.abs(envelope.identity.timeOrigin - origin.timeOrigin));
        if (envelope.progress) observe(envelope.progress);
        const state = envelope.state;
        if (state?.done) { if (state.error) throw new Error(state.error); return state.value; }
        await sleep(100);
      }
      throw new Error(`Browser evaluation timed out: ${expression.slice(0, 80)}`);
    } finally { await raw(`delete globalThis[${JSON.stringify(key)}]`).catch(() => { /* A navigated page may have dropped the evaluation envelope. */ }); }
  };
}
async function waitReady(evaluate) {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    const state = await evaluate(`(${status.toString()})()`);
    if (state.error) throw new Error(state.error);
    if (state.ready) return;
    await sleep(200);
  }
  throw new Error('Game loading did not finish within 90 seconds');
}
/** The title's INFINITE WILDSHARD tap (shown with Developer on), then the grid page: its session readout and the world entered. */
async function enterGrid(driver) {
  const start = Date.now();
  if (publicGrid) {
    while (Date.now() - start < 240000) {
      const state = await driver.evaluate(`(() => { const s = (${status.toString()})(); return { ...s, grid: window.__wildshard?.shard?.grid !== undefined }; })()`);
      if (state.error) throw new Error(state.error);
      if (state.ready && state.grid) { await driver.evaluate('(window.__wildshard.world.hud.enterNow(), true)'); return; }
      await sleep(300);
    }
    throw new Error('Public grid did not finish loading within 240 seconds');
  }
  while (!(await driver.evaluate("Boolean(document.querySelector('.ws-main-grid'))").catch(() => false))) {
    if (Date.now() - start > 90000) throw new Error('The title never showed INFINITE WILDSHARD');
    await sleep(300);
  }
  await sleep(800);
  await driver.evaluate("(setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100), true)"); // the tap navigates: return first
  await driver.followed();
  while (Date.now() - start < 240000) {
    const state = await driver.evaluate(`(() => { const s = (${status.toString()})(); return { ...s, grid: window.__wildshard?.shard?.grid !== undefined }; })()`).catch(() => null); // mid-navigation
    if (state?.error) throw new Error(state.error);
    if (state?.ready && state.grid) { await driver.evaluate('(window.__wildshard.world.hud.enterNow(), true)'); return; }
    await sleep(300);
  }
  throw new Error('The grid did not finish loading within 240 seconds');
}
async function measureShard(driver, shard, deadline) {
  const start = Date.now(), floorMs = surface === 'sim' ? 33.3 : 16.7;
  const rows = [], scenarios = [];
  try {
    await driver.load(shard);
    if (shard === 'grid') await enterGrid(driver);
    await waitReady(driver.evaluate);
    const documentOrigin = await driver.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
    if (shard === 'grid' && gridScenario !== 'baseline') await driver.evaluate(`(${installFloorGridProgress.toString()})()`);
    await sleep(settleMs);
    const meta = await driver.evaluate(`(${metadata.toString()})()`);
    if (meta.developer !== (developer === 'on') || meta.deviceSaves.devMode !== (developer === 'on') || meta.clock !== 'live' || meta.renderScale !== 2 || meta.settings.tier !== (surface === 'sim' ? 'phone' : 'desktop') || meta.settings.fps !== 'auto' || Object.entries(picks).some(([key, value]) => meta.settings[key] !== value) || Object.entries(deviceSaves).some(([key, value]) => meta.deviceSaves[key] !== value)) throw new Error(`Invalid measurement configuration: ${JSON.stringify(meta)}`);
    for (const expected of expectedSystems.filter((row) => row.shard === shard)) if (meta.systems.includes(expected.id) !== expected.present) throw new Error(`Activation witness failed: ${expected.id} expected ${expected.present ? 'on' : 'off'}; installed ${meta.systems.join(', ')}`);
    if (surface === 'sim' && (meta.viewport[0] >= meta.viewport[1] || !meta.userAgent.includes('iPhone'))) throw new Error('Simulator must be portrait iPhone Safari');
    if (surface === 'desktop' && !meta.renderer.includes('ANGLE Metal Renderer')) throw new Error(`Metal required, got ${meta.renderer}`);
    if (publicGrid) {
      if (meta.settings.memorySaver !== 'off') throw new Error('Public grid Memory saver must be saved OFF');
      meta.publicGrid = await driver.evaluate(`(${readPublicGridWitness.toString()})()`);
      const failures = publicGridWitnessFailures(meta.publicGrid, false);
      if (failures.length > 0) throw new Error(failures.join('; '));
    }
    const declared = [...await driver.evaluate(`(${cameras.toString()})()`), ...(shard === 'grid' ? GRID_POSES : [])];
    const candidates = declared.length > 0 ? declared : [{ ...meta.spawn, name: 'spawn-reverse', yaw: meta.spawn.yaw + Math.PI }];
    const scan = [];
    for (const pose of candidates) {
      if (Date.now() > deadline) throw new Error('Ten-minute run budget exhausted');
      await driver.evaluate(`window.__wildshard.pose(${JSON.stringify(pose)})`);
      await sleep(500);
      const result = await driver.evaluate(`(${sample.toString()})(24)`);
      scan.push({ pose, p95Ms: result.p95Ms, workP95Ms: result.workP95Ms, calls: result.calls, triangles: result.triangles });
    }
    // Rank authored standing parity cameras on the surface itself; no shard-name camera table to go stale.
    const heaviest = [...scan].sort((a, b) => b.p95Ms - a.p95Ms || b.workP95Ms - a.workP95Ms || b.triangles - a.triangles).slice(0, 2);
    for (const pose of [meta.spawn, ...heaviest.map((r) => r.pose)]) {
      if (Date.now() > deadline) throw new Error('Ten-minute run budget exhausted');
      await driver.evaluate(`window.__wildshard.pose(${JSON.stringify(pose)})`);
      await sleep(settleMs);
      const result = await driver.evaluate(`(${sample.toString()})(${frames})`);
      rows.push({ pose, ...result, ...assess(result, surface) });
      console.log(`${surface} ${shard} ${pose.name}: ${result.medianFps} fps, p95 ${result.p95Ms} ms, p99 ${result.p99Ms} ms — ${rows.at(-1).pass ? 'PASS' : 'FAIL'}`);
    }
    if (shard === 'grid' && gridScenario !== 'baseline') {
      // Standing camera probes did not cross: reset only the initial source pose, then use real input at every seam.
      const state = await driver.evaluate('window.__wildshard.shard.grid.state()');
      for (const plan of publicGrid ? publicGridPlans(state) : gridFloorPlans(state, gridScenario)) {
        if (Date.now() > deadline) throw new Error('Ten-minute run budget exhausted');
        // Camera probes can leave the owned shell on the road. Finish source admission before measuring motion.
        await driver.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(plan)},${JSON.stringify(documentOrigin)})`, 130000);
        const moving = (async () => {
          try { return { value: await driver.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(plan)},${JSON.stringify(documentOrigin)})`, 160000) }; }
          catch (error) { return { error: error instanceof Error ? error : new Error('Grid floor drive failed', { cause: error }) }; }
        })();
        await sleep(1000);
        const motion = await driver.evaluate(`(${sample.toString()})(${frames})`);
        const driven = await moving; if (driven.error) throw driven.error;
        const witness = driven.value, failures = gridFloorWitnessFailures(witness);
        if (failures.length > 0) throw new Error(`${plan.name}: ${failures.join('; ')}`);
        scenarios.push(witness);
        rows.push({ pose: { name: `grid-${plan.name}-travel` }, ...motion, ...assess(motion, surface) });
        await sleep(settleMs);
        const standing = await driver.evaluate(`(${sample.toString()})(${frames})`);
        rows.push({ pose: { name: `grid-${plan.name}` }, ...standing, ...assess(standing, surface) });
        console.log(`${surface} grid ${plan.name}: travel ${motion.medianFps} fps / ${motion.p95Ms} ms; interior ${standing.medianFps} fps / ${standing.p95Ms} ms; residents=${witness.after.live.live.residents.join(',')}`);
      }
    }
    if (publicGrid) {
      meta.publicGridFinal = await driver.evaluate(`(${readPublicGridWitness.toString()})()`);
      const failures = publicGridWitnessFailures(meta.publicGridFinal, true);
      if (failures.length > 0) throw new Error(failures.join('; '));
    }
    const errors = await driver.errors();
    return { shard, complete: true, pass: rows.every((r) => r.pass) && errors.length === 0, seconds: (Date.now() - start) / 1000,
      floorMs, evaluationOriginDriftMaxMs, metadata: meta, cameraSource: declared.length > 0 ? 'manifest standing parity cameras' : 'no declared parity cameras; reversed spawn fallback', scan, rows, scenarios, lastRoute: driver.progress(), errors };
  } catch (error) {
    console.error(`${surface} ${shard}: ${errorText(error)}`);
    const diagnostic = await driver.evaluate(`(() => { const app = window.__wildshard?.world?.game?.app; const saved = JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}'); return { documentOrigin: performance.timeOrigin, lastEnd: saved.keys?.['life.lastEnd']?.data, lastUnload: saved.keys?.['life.lastUnload']?.data, url: location.href, readyState: document.readyState, state: app?.state, modal: document.querySelector('#wserr .msg')?.textContent, stack: document.querySelector('#wserr pre')?.textContent, loading: document.querySelector('.ws-load')?.textContent?.slice(-3000), bootTrace: saved.keys?.['boot.trace']?.data, systems: app ? Object.values(app.systemsByPhase()).flat().map(system => system.id) : [], console: window.__frameFloorConsole ?? [], resources: performance.getEntriesByType('resource').slice(-20).map(row => ({ name: row.name, duration: row.duration })) }; })()`).catch(() => null);
    const lastRoute = driver.progress(), runtimeFailure = gridFloorRuntimeFailure(lastRoute, diagnostic ?? { documentOrigin: error?.documentOrigin });
    return { shard, complete: runtimeFailure !== null, pass: false, seconds: (Date.now() - start) / 1000, error: errorText(error),
      evaluationOriginDriftMaxMs, errors: await driver.errors().catch(() => []), rows, scenarios, lastRoute, runtimeFailure, diagnostic };
  } finally { await driver.unload(); }
}

function webkit(wsUrl) {
  const ws = new WebSocket(wsUrl), pending = new Map();
  let seq = 0, target = null;
  const opened = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const inner = (message) => {
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
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Web Inspector timed out: ${method}`)); }, 10000);
    pending.set(id, { done: resolve, reject, timer });
    const message = { id, method, params };
    ws.send(JSON.stringify(target ? { id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } } : message));
  });
  return { opened, raw: async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
    return result.result?.value;
  }, close: () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Inspector closed')); } pending.clear(); ws.close(); } };
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
async function worker() {
  const base = flag('base', ''), deadline = Number(flag('deadline', '0')), rows = [];
  let browser, context, page, proxy, inspector;
  let lastRoute = null;
  const observe = progress => { lastRoute = progress; };
  try {
    let driver;
    if (surface === 'desktop') {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
      context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await context.addInitScript({ content: `${fixture('desktop')};window.__wildshardHarness={seed:357,capture:null};${ERROR_SCRIPT}${CONSOLE_SCRIPT}${travelGl}` });
      let errors = [];
      driver = {
        load: async (shard) => { errors = []; page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message.slice(0, 240))); page.on('console', (message) => { if (message.type() === 'error' && message.text().includes('[faults]')) errors.push(message.text().slice(0, 1000)); }); await page.goto(`${base}${query(shard)}`, { waitUntil: 'domcontentloaded' }); },
        evaluate: evaluator((expr) => page.evaluate(expr), observe), errors: () => Promise.resolve(errors), progress: () => lastRoute, followed: () => page.waitForURL((u) => !u.search.includes('mute=1') || u.search.includes('chunk='), { timeout: 60000 }).catch(() => undefined),
        unload: async () => { await page?.close(); },
      };
    } else {
      const udid = process.env.SIM_UDID;
      if (!udid) throw new Error('Safari worker must run inside scripts/sim-lane.sh run');
      const xcrun = (tail) => execFileSync('xcrun', ['simctl', ...tail], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      // An owned fresh tab prevents accumulated worlds across shards. Safari is terminated between loads.
      const socket = xcrun(['getenv', udid, 'RWI_LISTEN_SOCKET']).trim();
      proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
      proxy.on('error', (error) => { console.error(`Inspector proxy: ${errorText(error)}`); });
      let evaluate, currentUrl;
      const connect = async (url) => {
        inspector?.close(); inspector = undefined;
        currentUrl = url;
        inspector = webkit(await safariPage(url)); await inspector.opened; await sleep(500);
        evaluate = evaluator(inspector.raw, observe);
      };
      // A timed-out evaluation may already have started movement or an async admission. Reconnect for diagnostics,
      // but never replay it: losing the document/target invalidates that route's witnesses.
      const retryEvaluate = async (expr, timeout) => {
        try { return await evaluate(expr, timeout); }
        catch (error) {
          if (!errorText(error).includes('Web Inspector timed out: Runtime.evaluate')) throw error;
          console.log('Safari inspector target swapped; reconnecting');
          await connect(currentUrl);
          const documentOrigin = await inspector.raw('performance.timeOrigin').catch(() => undefined);
          throw Object.assign(new Error('Safari inspector lost the active evaluation; refusing to replay the measurement', { cause: error }), { documentOrigin });
        }
      };
      driver = {
        load: async (shard) => {
          inspector?.close(); inspector = undefined;
          try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Safari is not running on first boot. */ }
          xcrun(['openurl', udid, `${base}version.json`]);
          await connect(`${base}version.json`);
          await retryEvaluate(`(() => { ${fixture('phone')}; return true; })()`);
          // Reconnect after navigation: an inspector evaluation envelope can disappear in a WebContent process swap.
          // The helper sets live pose pins before the clean build's modules boot.
          inspector.close(); inspector = undefined;
          const gameUrl = `${base}frame-floor-safari.html${query(shard)}`;
          xcrun(['openurl', udid, gameUrl]);
          await connect(gameUrl);
        },
        evaluate: retryEvaluate, errors: () => retryEvaluate('window.__frameFloorErrors ?? []'), progress: () => lastRoute, unload: () => { inspector?.close(); inspector = undefined; },
        // the tap's fresh document (same helper page, so the pins stay): reconnect to whatever page the helper path now holds
        followed: async () => { await sleep(1500); await connect(`${base}frame-floor-safari.html`); },
      };
    }
    for (const shard of shards) { lastRoute = null; evaluationOriginDriftMaxMs = 0; rows.push(await measureShard(driver, shard, deadline)); }
  } catch (error) {
    for (const shard of shards.filter((s) => !rows.some((r) => r.shard === s))) rows.push({ shard, complete: false, pass: false, error: errorText(error) });
  } finally {
    inspector?.close(); proxy?.kill('SIGTERM'); await context?.close(); await browser?.close();
  }
  writeFileSync(flag('worker-out', ''), JSON.stringify({ surface, rows }));
}
function run(command, argv, options = {}) {
  return new Promise((resolve, reject) => {
    const { echo, ...spawnOptions } = options;
    const child = spawn(command, argv, { stdio: ['ignore', 'pipe', 'inherit'], ...spawnOptions });
    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data; if (echo) process.stdout.write(data); });
    child.on('error', reject); child.on('close', (code) => { if (code !== 0) reject(new Error(`${command} exited ${code}`)); else resolve(stdout.trim()); });
  });
}
async function main() {
  const regrade = flag('regrade', '');
  if (regrade) {
    const path = resolvePath(ROOT, regrade);
    if (!path.startsWith(`${join(ROOT, 'progress/frame-floor')}/`) || !path.endsWith('.json')) throw new Error('Regrade must name a progress/frame-floor JSON');
    const record = grade(JSON.parse(readFileSync(path, 'utf8')));
    writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
    printVerdict(record);
    process.exitCode = record.complete ? record.pass ? 0 : 2 : 3;
    return;
  }
  const start = Date.now(), sha = execFileSync('git', ['rev-parse', flag('rev', 'HEAD')], { cwd: ROOT, encoding: 'utf8' }).trim();
  const runId = `${process.pid}-${Date.now()}`;
  const scratch = `/private/tmp/claude-501/sp-builders/sp-x1/frame-floor-${runId}`;
  mkdirSync(scratch, { recursive: true });
  const results = [], temporary = [];
  let base;
  try {
    base = await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `frame-floor-${runId}`, '--hours', '1'], { cwd: scratch });
    const version = await (await fetch(`${base}version.json`)).json();
    if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error(`Preview build id does not match ${sha}: ${JSON.stringify(version)}`);
    // Safari cannot inject a pre-navigation script with its inspector protocol. Add pins to a COPY of the clean
    // entry HTML in the served dist only. Compiled JS/assets and all gameplay remain byte-identical to the export.
    const registry = readFileSync(join(process.env.HOME, '.dev-servers', new URL(base).port), 'utf8').trim().split(' ');
    const dist = join(registry[2], 'dist'), html = readFileSync(join(dist, 'index.html'), 'utf8');
    const helper = join(dist, 'frame-floor-safari.html');
    writeFileSync(helper, html.replace('<head>', `<head><script>window.__wildshardHarness={seed:357,capture:null};${ERROR_SCRIPT}${CONSOLE_SCRIPT}${travelGl}</script>`));
    for (const s of surface === 'both' ? ['desktop', 'sim'] : [surface]) {
      const out = join(scratch, `frame-floor-${s}-${sha.slice(0, 9)}.json`); temporary.push(out);
      const workerArgs = [SCRIPT, '--worker', `--surface=${s}`, `--developer=${developer}`, `--base=${base}`, `--shards=${shards.join(',')}`, `--grid-scenario=${gridScenario}`, `--frames=${frames}`, `--settle=${settleMs / 1000}`, `--deadline=${start + 600000}`, `--worker-out=${out}`, ...settingArgs, ...deviceSaveArgs, ...systemArgs];
      const lane = s === 'desktop' ? ['--max', '10', process.execPath, ...workerArgs] : ['run', '--max', '10', device, process.execPath, ...workerArgs];
      await run(join(ROOT, `scripts/${s === 'desktop' ? 'browser' : 'sim'}-lane.sh`), lane, { cwd: scratch, echo: true });
      results.push(JSON.parse(readFileSync(out, 'utf8')));
    }
    const elapsedSeconds = (Date.now() - start) / 1000;
    const complete = results.every((r) => r.rows.every((row) => row.complete));
    const pass = complete && elapsedSeconds < 600 && results.every((r) => r.rows.every((row) => row.pass));
    const record = grade({ schema: 2, sha, runId, device, when: new Date().toISOString(), elapsedSeconds, underTenMinutes: elapsedSeconds < 600,
      frames, settleMs, shards, surface, developer, ...(publicGrid ? {publicGrid:'public grid as it would ship once GRID_GATES_PASSED flips'} : {}), settings, deviceSaves, expectedSystems, gridScenario, travelGlCensus: travelGl !== '', harnessRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), complete, pass, desktopCap: 'Settings fps=auto: no game cap; display/vsync remains enabled',
      simulatorCap: `Shipped phone-tier 30 fps cap; Simulator Safari on ${device}`,
      measurement: 'Live game; rAF timestamps between observed drawn frameCount changes grade cadence; performance.now callback intervals retained as diagnostics, Game.frameMs/workMs and game.lastFrame retained. No frame limiter bypass, CPU throttling or capture clock.',
      limitations: ['Stationary spawn and two heaviest scanned standing parity cameras; this is a baseline, not proof of every gameplay moment.', 'Simulator readings measure Mac-backed Mobile Safari, not physical iPhone performance.', 'Safari helper HTML adds live harness pins; travel scenarios also install diagnostic WebGL allocation hooks before boot. Travel GL figures are API allocations, not native WebContent memory, and must not be added to the playing model as another claim.'], results });
    const directory = join(ROOT, 'progress/frame-floor'); mkdirSync(directory, { recursive: true });
    const output = join(directory, `${sha.slice(0, 9)}-${runId}.json`);
    writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    printVerdict(record);
    console.log(`Baseline ${output}: ${elapsedSeconds.toFixed(1)} seconds, complete=${record.complete}, pass=${record.pass}`);
    process.exitCode = record.complete ? record.pass ? 0 : 2 : 3;
  } finally {
    if (base) await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port], { cwd: scratch });
    for (const out of temporary) rmSync(out, { force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}
await (args.includes('--worker') ? worker() : main());
