#!/usr/bin/env node
/** G550: audit actual GPU draws while viewing every cell from its road corner.
 * node scripts/check-grid-containment.mjs --url=<serve-build URL> --out=tmp/<task>
 * --baseline records the same route without requiring the new containment fence.
 * --nine-only checks normal road entry in a fresh iPhone 16 Pro browser.
 * One muted Chromium, through browser-lane; never runs the iOS Simulator. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { inspectGridDraw } from '../test/helpers/gridDrawAudit.ts';
import { saveFixtureCode } from './debug-settings.mjs';

const flag = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), output = resolve(flag('out', 'tmp/grid-containment'));
if (!/^http:\/\/127\.0\.0\.1:\d+\/?$/u.test(base)) throw new Error('Use the exact local serve-build URL');
const baseline = process.argv.includes('--baseline'), nineOnly = process.argv.includes('--nine-only');
mkdirSync(output, { recursive: true });
const init = resolve(output, 'init.js');
writeFileSync(init, [
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
  saveFixtureCode({ scope: 'global', key: 'settings', merge: true, data: { tier: nineOnly ? 'phone' : 'desktop', volume: 0 } }),
  'window.__wildshardHarness = { seed: 357, capture: null };',
  `window.__g10Errors = [];
  window.addEventListener('error', event => { window.__g10Errors.push(String(event.message)); });
  window.addEventListener('unhandledrejection', event => { window.__g10Errors.push(String(event.reason)); });
  const priorError = console.error.bind(console);
  console.error = (...args) => { window.__g10Errors.push(args.map(String).join(' ')); priorError(...args); };`,
].join(';\n'));
const env = { ...process.env, AGENT_BROWSER_SESSION: `g10-${process.pid}`, AGENT_BROWSER_ARGS: '--mute-audio,--use-angle=metal,--ignore-gpu-blocklist', AGENT_BROWSER_INIT_SCRIPTS: init, AGENT_BROWSER_DEFAULT_TIMEOUT: '240000' };
const reply = v.object({ success: v.boolean(), error: v.optional(v.unknown()), data: v.optional(v.object({ result: v.optional(v.unknown()) })) });
function noQuiet() { if (existsSync('.git/quiet')) throw new Error(`Quiet active: ${readFileSync('.git/quiet', 'utf8')}`); }
function command(program, args, input) {
  noQuiet();
  const result = spawnSync(program, args, { env, input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${program} ${args[0] ?? ''}: exit ${String(result.status)} ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
function agent(args, input) {
  const result = v.parse(reply, JSON.parse(command('agent-browser', [...args, '--json'], input)));
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.data?.result;
}
function evaluate(source) { return agent(['eval', '--stdin'], source); }
try {
  command('scripts/browser-lane.sh', ['wait']);
  if (nineOnly) agent(['set', 'device', 'iPhone 16 Pro']);
  agent(['open', base]); if (!nineOnly) agent(['set', 'viewport', '1920', '1080']);
  if (evaluate('window.__wildshardHarness?.seed === 357 && Array.isArray(window.__g10Errors)') !== true) throw new Error('Containment harness did not initialize before boot');
  if (nineOnly && evaluate('innerWidth === 402 && innerHeight === 874 && devicePixelRatio === 3') !== true) throw new Error('Expected iPhone 16 Pro 402×874 at 3×');
  agent(['wait', '.ws-main-grid']); agent(['click', '.ws-main-grid']);
  agent(['wait', '--fn', "Boolean(document.querySelector('#wserr .msg')?.textContent) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.world?.game))"]);
  const routes = v.parse(v.array(v.object({ instance: v.string(), x: v.number(), z: v.number() })), evaluate(`(() => {
    const failure = document.querySelector('#wserr .msg')?.textContent; if (failure) throw new Error(failure);
    const h = window.__wildshard, w = h.requireWorld(); w.hud.enterNow();
    const grid = h.shard.grid.state(), home = grid.cells.find(cell => cell.instance === grid.home);
    if (!home) throw new Error('Missing authored home cell');
    const centres = Object.fromEntries(grid.cells.map(cell => [cell.instance, { x: (cell.cell[0] - home.cell[0]) * 555, z: (cell.cell[1] - home.cell[1]) * 555 }]));
    const inspect = ${inspectGridDraw.toString()};
    const state = { audit: true, covered: new Set(), draws: new Map(), issues: new Map(), samples: [], routes: [], nineTall: 0, nineObject: null, source: h.fingerprint().build, pose: null };
    window.__gridContainmentProof = state;
    const renderer = w.game.renderer, original = renderer.renderBufferDirect.bind(renderer);
    renderer.renderBufferDirect = (...args) => {
      const calls = renderer.info.render.calls, result = original(...args);
      if (!state.audit || renderer.info.render.calls === calls) return result;
      const row = inspect(args[4], args[3], renderer, centres);
      if (row) { if (state.nineCamera && row.cell === 'nine-dragon-stack' && row.worldTop > 270 && row.worldTop < 400) { let owner = args[4]; while (owner && owner.name !== 'region:nine-dragon-stack') owner = owner.parent; if (owner && row.worldTop > state.nineTall) { state.nineTall = row.worldTop; state.nineObject = row.object; } } const key = args[4].uuid + ':' + args[3].uuid; state.covered.add(row.cell); state.draws.set(key, row); if (row.issue) state.issues.set(key, row); }
      return result;
    };
    w.game.app.addSystem({ id: 'harness.containment-camera', phase: 'late', core: true, run: () => {
      state.cameraFrames = (state.cameraFrames ?? 0) + 1;
      if (!state.pose && !state.nineCamera) return;
      const at = state.nineCamera ?? state.pose;
      const root = w.game.rootScene.getObjectByName('grid-cell:' + at.instance);
      if (!root) throw new Error('No cell root for observing camera');
      const centre = root.getWorldPosition(root.position.clone());
      if (state.nineCamera) {
        w.game.camera.fov = 90; w.game.camera.updateProjectionMatrix();
        w.game.camera.position.set(centre.x, 4, centre.z + 277.5);
        w.game.camera.lookAt(centre.x, 130, centre.z); w.game.camera.updateMatrixWorld(true); return;
      }
      w.game.camera.position.set(centre.x + 280, 140, centre.z + 280);
      w.game.camera.lookAt(centre.x, 10, centre.z); w.game.camera.updateMatrixWorld(true);
    } }, w.game.engineScope.child('harness.containment-camera'));
    return h.shard.grid.state().cells.map(cell => ({ instance: cell.instance, x: cell.cell[0] * 555, z: cell.cell[1] * 555 }));
  })()`));
  if (routes.length !== 25) throw new Error(`Expected authored 5x5, got ${routes.length}`);
  if (!nineOnly) {
  for (const route of routes) {
    evaluate(`(async () => {
      const h = window.__wildshard, w = h.requireWorld(), feet = h.shard.grid.state().live.live.worldFeet;
      window.__gridContainmentProof.pose = ${JSON.stringify(route)};
      await h.pose({ x: ${route.x + 277.5} - (feet.x - w.player.position.x), z: ${route.z + 277.5} - (feet.z - w.player.position.z), y: 0, yaw: 0, pitch: 0 });
      return true;
    })()`);
    agent(['wait', '--fn', `(() => {
      const s = window.__wildshard.shard.grid.state(), live = s.live?.live;
      return Math.abs(s.feet.x - ${route.x + 277.5}) < 1 && Math.abs(s.feet.z - ${route.z + 277.5}) < 1
        && s.rings.inFlight === 0 && s.rings.queued === 0 && s.near.cells.every(cell => cell.shows !== 'loading')
        && (!live || (live.pending.length === 0 && live.retiring.length === 0));
    })()`]);
    agent(['wait', '--fn', `window.__gridContainmentProof.covered.has(${JSON.stringify(route.instance)})`]);
    evaluate(`(() => {
      const s = window.__wildshard.shard.grid.state();
      window.__gridContainmentProof.routes.push({ instance: ${JSON.stringify(route.instance)}, cells: s.cells, rings: s.rings, near: s.near, live: s.live?.live });
      return true;
    })()`);
  }
  evaluate('window.__gridContainmentProof.audit = false');
  const sampleCost = () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    evaluate(`(() => {
      const w = window.__wildshard.requireWorld(), state = window.__gridContainmentProof;
      state.costScope?.dispose(); state.samples = []; state.costInvalid = false;
      const guardIds = () => w.game.app.systemsByPhase().render.filter(spec => spec.id.startsWith('grid.contain.') || spec.id.startsWith('grid.coarse-contain.')).map(spec => spec.id);
      const guards = guardIds(); state.guards = guards;
      let start = 0; const scope = w.game.levelScope.child('harness.containment-cost'); state.costScope = scope;
      if (!guards.length) {
        w.game.app.addSystem({ id: 'harness.containment-events', phase: 'late', run: () => {
          performance.mark('g10.guard.frame'); performance.mark('g10.guard.end'); state.samples.push(0);
        } }, scope);
        return true;
      }
      w.game.app.addSystem({ id: 'harness.containment-start', phase: 'render', before: guards, run: () => { performance.mark('g10.guard.frame'); start = performance.now(); } }, scope);
      w.game.app.addSystem({ id: 'harness.containment-end', phase: 'render', after: guards, run: () => {
        const elapsed = performance.now() - start; performance.mark('g10.guard.end');
        if (guardIds().some(id => !guards.includes(id))) state.costInvalid = true;
        else state.samples.push(elapsed);
      } }, scope);
      return true;
    })()`);
    agent(['wait', '--fn', 'window.__gridContainmentProof.costInvalid || window.__gridContainmentProof.samples.length >= 600']);
    if (evaluate('window.__gridContainmentProof.costInvalid') === false) break;
    if (attempt === 2) throw new Error('New guard admissions kept invalidating the bounded cost sample');
  }
  };
  sampleCost();
  evaluate('window.__gridContainmentProof.wallSamples = window.__gridContainmentProof.samples.slice()');
  if (!baseline) {
    agent(['profiler', 'start', '--categories', 'disabled-by-default-v8.cpu_profiler,disabled-by-default-v8.cpu_profiler.hires,blink.user_timing']);
    sampleCost();
    agent(['profiler', 'stop', resolve(output, 'guard.trace.json')]);
  }
  const report = evaluate(`(() => {
    const h = window.__wildshard, w = h.requireWorld(), s = window.__gridContainmentProof;
    const samples = s.wallSamples.slice(-600).sort((a,b) => a-b);
    return { build: s.source, errors: window.__g10Errors.filter(error => !/favicon|net::ERR_ABORTED/u.test(error)), baseline: ${baseline}, cells: [...s.covered].sort(), draws: s.draws.size, issues: [...s.issues.values()].slice(0,100), issueCount: s.issues.size,
      routes: s.routes, profiledPhaseMeanMs: s.samples.length ? s.samples.reduce((a,b) => a+b,0)/s.samples.length : null, systems: w.game.app.systemsByPhase().render.map(spec => spec.id), programs: w.game.renderer.info.programs.length, guards: s.guards, guardMeanMs: samples.length ? samples.reduce((a,b) => a+b,0)/samples.length : null,
      guardP95Ms: samples.length ? samples[Math.floor(samples.length*0.95)] : null, viewport: [innerWidth,innerHeight], renderer: h.fingerprint().renderer };
  })()`);
  writeFileSync(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const checked = v.parse(v.object({ cells: v.array(v.string()), draws: v.number(), issueCount: v.number(), programs: v.number(), guardMeanMs: v.nullable(v.number()), errors: v.array(v.string()) }), report);
  if (checked.cells.length !== 25 || checked.draws === 0 || checked.errors.length > 0 || (!baseline && checked.issueCount > 0)) throw new Error(`Containment refused: ${JSON.stringify(checked)}`);
  }
  if (nineOnly) {
  // Functional road-entry view, separate from the matched desktop program/cost sample above.
  // The traveller enters normally; only the observing camera remains on the north road.
  evaluate(`(async () => {
    const h = window.__wildshard, w = h.requireWorld(), state = window.__gridContainmentProof;
    const cell = h.shard.grid.state().cells.find(row => row.instance === 'nine-dragon-stack');
    if (!cell) throw new Error('Nine is absent from the authored grid');
    const x = cell.cell[0] * 555, z = cell.cell[1] * 555, feet = h.shard.grid.state().live.live.worldFeet;
    state.pose = null; state.nineCamera = { x, z, instance: cell.instance }; state.audit = true; state.nineTall = 0;
    await h.pose({ x: x - (feet.x - w.player.position.x), z: z + 277.5 - (feet.z - w.player.position.z), y: 0.55, yaw: 0, pitch: 0 });
    return true;
  })()`);
  agent(['wait', '--fn', 'window.__wildshard.shard.grid.state().live.live.current === null && window.__wildshard.shard.grid.state().live.live.retiring.length === 0']);
  evaluate(`(() => {
    const h = window.__wildshard, w = h.requireWorld(), input = w.game.app.input, state = window.__gridContainmentProof;
    state.nineEntry = 'driving'; let stop = () => undefined;
    const timer = setTimeout(() => { stop(); input.clear(); state.nineEntry = 'timeout'; }, 180000);
    stop = w.game.watchFrames(() => {
      const live = h.shard.grid.state().live.live;
      if (live.current === 'nine-dragon-stack' && live.gameplayReady && live.worldFeet.z < state.nineCamera.z + 239) {
        stop(); clearTimeout(timer); input.clear(); state.nineEntry = 'ready'; return;
      }
      w.player.setHover(live.current === null); w.player.yaw = 0;
      input.setHeld('move.forward', live.gameplayReady);
    });
    return true;
  })()`);
  agent(['wait', '--fn', "['ready','timeout'].includes(window.__gridContainmentProof.nineEntry)"]);
  if (evaluate("window.__gridContainmentProof.nineEntry === 'ready'") !== true) throw new Error('Nine road entry did not complete');
  agent(['wait', '--fn', 'window.__gridContainmentProof.nineTall > 270']);
  agent(['wait', '--fn', "(() => { const title = document.querySelector('.ws-grid-title'); return !title || Number(getComputedStyle(title).opacity) < 0.05; })()"]);
  const nine = v.parse(v.object({ viewport: v.tuple([v.number(), v.number()]), pixelRatio: v.number(), top: v.number(), object: v.string(), cameraFrames: v.number(), current: v.string(), issues: v.array(v.unknown()), programs: v.number(), errors: v.array(v.string()) }), evaluate(`(() => {
    const h = window.__wildshard, w = h.requireWorld(), s = window.__gridContainmentProof;
    const label = document.createElement('div'); label.textContent = 'G10 · iPhone 16 Pro · Nine from the road · ' + s.source;
    Object.assign(label.style, { position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647', background: '#000c', color: 'white', padding: '8px', font: '12px sans-serif' }); document.body.append(label);
    return { viewport: [innerWidth, innerHeight], pixelRatio: devicePixelRatio, top: s.nineTall, object: s.nineObject, cameraFrames: s.cameraFrames, current: h.shard.grid.state().live.live.current, issues: [...s.issues.values()], programs: w.game.renderer.info.programs.length, errors: window.__g10Errors };
  })()`));
  for (const quality of [45, 30, 20]) {
    agent(['screenshot', '--screenshot-format', 'jpeg', '--screenshot-quality', String(quality), resolve(output, 'nine-road.jpg')]);
    if (statSync(resolve(output, 'nine-road.jpg')).size <= 250000) break;
  }
  if (statSync(resolve(output, 'nine-road.jpg')).size > 250000) throw new Error('Phone JPEG exceeds 250 KB');
  writeFileSync(resolve(output, 'nine-road.json'), JSON.stringify(nine, null, 2));
  if (nine.issues.length > 0 || nine.errors.length > 0) throw new Error('Nine road frame has containment or page errors');
  }
  const errors = command('agent-browser', ['errors', '--json']); writeFileSync(resolve(output, 'browser-errors.json'), errors);
  console.info(JSON.stringify(nineOnly ? { nineOnly: true } : evaluate('({ cells: [...window.__gridContainmentProof.covered], issues: window.__gridContainmentProof.issues.size })')));
} catch (error) {
  try { writeFileSync(resolve(output, 'failure.json'), JSON.stringify(evaluate('({ errors: window.__g10Errors, text: document.body.innerText.slice(0,2000), cells: [...window.__gridContainmentProof?.covered ?? []], pose: window.__gridContainmentProof?.pose })'), null, 2)); } catch { /* Preserve the original diagnostic even after a page/browser failure. */ }
  throw error;
} finally { spawnSync('agent-browser', ['close'], { env, encoding: 'utf8' }); }
