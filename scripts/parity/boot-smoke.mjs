#!/usr/bin/env node
// Required push-CI smoke against Vite's built dist, using the real title and session owners.
// No skipintro, injected world, gameplay service stubs, harness scheduler, or screenshot readiness oracle.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserPool } from './pool.mjs';
import { serve } from './serve.mjs';
import { saveFixture } from '../debug-settings.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures } from '../frame-floor-grid.mjs';

/** A locked experimental card is not a public gameplay entry. Its direct chunk
 * page must still hydrate under the unwaived public playing envelope (call44).
 * @param {{shard:string,appState:string,entered?:boolean,playerValid:boolean,fatal:string[],frame:number,renderFrame:number}} observation */
export function publicPolicyAdmission(observation) {
  const developer = Object.hasOwn(document.documentElement.dataset, 'dev');
  const play = document.querySelector('.ws-menu-play'), alternate = document.querySelector('.ws-menu-shardfile');
  const locked = play !== null && play.hasAttribute('disabled') && /coming soon/iu.test(play.textContent) &&
    (alternate === null || alternate.hasAttribute('hidden') || alternate.hasAttribute('disabled'));
  const admitted = !developer && locked && observation.shard === 'nine-dragon-stack' && observation.appState === 'title' &&
    observation.entered === false && observation.playerValid && Number.isFinite(observation.renderFrame) && observation.renderFrame > 0 && observation.frame > 0 && observation.fatal.length === 0 && document.querySelector('#hud') !== null;
  return { admitted, developer, locked, frame: observation.frame, renderFrame: observation.renderFrame };
}

/** Browser-side observation; also exercised against fatal and incomplete boot fixtures. */
export function bootObservation() {
  const fatal = [...document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')].map(node => node.textContent || 'fatal');
  const probe = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard);
  if (!probe?.world) return { fatal, ready: false, frame: -1, shard: '', grid: null, appState: 'unavailable', playerValid: false, renderFrame: -1 };
  const world = probe.requireWorld(), state = probe.state();
  const { grid: exposed } = world.game.app.debug.snapshot();
  const grid = typeof exposed === 'object' && exposed !== null && 'state' in exposed && typeof exposed.state === 'function' ? exposed.state() : null;
  const hud = document.querySelector('#hud');
  const revealing = document.querySelector('.ws-grid-reveal') !== null;
  const entered = world.hud.entered && !world.hud.paused, frameGate = world.game.frameGate();
  const playerValid = [state.player.pos.x, state.player.pos.y, state.player.pos.z, state.player.health].every(Number.isFinite) && state.player.health > 0;
  const ready = state.appState === 'play' && entered && frameGate && hud !== null && !hud.classList.contains('intro') && !revealing &&
    playerValid;
  return { fatal, ready, entered, revealing, frameGate, frame: probe.app.clock.frame, shard: probe.shard.slug, grid, appState: state.appState, playerValid, renderFrame: world.game.renderer.info.render.frame };
}

/** @param {import('playwright').Page} page @param {string[]} faults @param {() => Promise<boolean>} condition @param {string} label @param {number} deadline */
async function until(page, faults, condition, label, deadline) {
  while (Date.now() < deadline) {
    if (faults.length > 0) throw new Error(faults.join('\n'));
    const observed = await page.evaluate(bootObservation);
    if (observed.fatal.length > 0) throw new Error(`Fatal boot: ${observed.fatal.join('\n')}`);
    if (await condition()) return;
    await new Promise(resolve => { setTimeout(resolve, 100); });
  }
  throw new Error(`Boot deadline: ${label}; ${JSON.stringify(await page.evaluate(bootObservation))}`);
}

/** Preserve the original report behind a static-preview transport failure, including lifecycle diagnostics.
 * @param {string} url @param {string} method @param {string|null} body @returns {unknown} */
export function bootErrorReport(url, method, body) {
  if (new URL(url).pathname !== '/api/errors' || method !== 'POST') return null;
  try { return JSON.parse(body ?? 'null'); } catch { return { malformed: body }; }
}

/** Lifecycle reports describe navigation/frame health and never raise the game's error UI.
 * Keep their full payloads as evidence; only the explicit nonfatal diagnostic is acknowledged.
 * @param {unknown} report @param {boolean} observedGridNavigation */
export function bootLifecycleDiagnostic(report, observedGridNavigation) {
  return observedGridNavigation && typeof report === 'object' && report !== null && 'system' in report && report.system === 'lifecycle' &&
    'fatal' in report && report.fatal === false && 'message' in report && typeof report.message === 'string' &&
    /^boot after the last page ended on "hide" \(nav navigate\): \d+ frames \/ 6s$/u.test(report.message);
}

/** Read the actual built title's installed catalogue, without loading or injecting a world. */
export function bootCatalogue() {
  /** @type {unknown} */ const installed = Reflect.get(globalThis, Symbol.for('game.shards'));
  if (!Array.isArray(installed) || installed.length === 0) throw new Error('Missing built title shard catalogue');
  return installed.map((/** @type {unknown} */ row) => {
    if (typeof row !== 'object' || row === null || !('slug' in row) || typeof row.slug !== 'string' ||
      !('status' in row) || typeof row.status !== 'string') throw new Error('Invalid built title shard catalogue row');
    return { slug: row.slug, status: row.status, legacy: 'legacy' in row && row.legacy === true };
  });
}

/** Retire earlier GPU contexts before the grid's two-document boot.
 * @template T @param {{browser:(slot:number)=>Promise<T>,release:(slot:number)=>Promise<void>}} pool
 * @param {'standalone'|'grid'|'public-policy'} mode @returns {Promise<T>} */
export async function bootCaseBrowser(pool, mode) {
  if (mode === 'grid') await pool.release(0);
  return pool.browser(0);
}

/** Every public primary enters through its real public button; experimental primaries enter with Developer on.
 * @param {readonly {slug:string,status:string,legacy:boolean}[]} catalogue
 * @param {'all'|'public'|'developer'} [group]
 * @returns {readonly (readonly ['standalone'|'grid'|'public-policy',string,boolean])[]} */
export function bootCases(catalogue, group = 'all') {
  if (!['all', 'public', 'developer'].includes(group)) throw new Error('Unknown boot case group');
  const seen = new Set();
  for (const row of catalogue) {
    if (!/^[a-z0-9_-]+$/u.test(row.slug) || seen.has(row.slug) || !['live', 'earlyAccess', 'experimental', 'hidden'].includes(row.status)) throw new Error('Invalid or duplicate built title shard');
    seen.add(row.slug);
  }
  const primary = catalogue.filter(row => !row.legacy && row.status !== 'hidden' && !row.slug.startsWith('_'));
  if (!primary.some(row => row.slug === 'sunscar-dunes')) throw new Error('Signal page-ready case is missing from the built catalogue');
  const publicRows = primary.filter(row => row.status !== 'experimental');
  const home = publicRows.at(0)?.slug;
  if (home === undefined) throw new Error('No public shard page-ready cases');
  if (!primary.some(row => row.slug === 'nine-dragon-stack')) throw new Error('Nine Developer-off page-ready case is missing from the built catalogue');
  // Direct Nine chunk hydration uses the public playing envelope even while
  // its experimental picker card stays locked. The Developer case separately
  // proves entered gameplay; admission is never labelled public gameplay.
  const publicCases = primary.filter(row => row.status !== 'experimental' || row.slug === 'nine-dragon-stack')
    .map(row => /** @type {const} */ ([row.status === 'experimental' ? 'public-policy' : 'standalone', row.slug, false]));
  const developerCases = [...primary.filter(row => row.status === 'experimental').map(row => /** @type {const} */ (['standalone', row.slug, true])), /** @type {const} */ (['grid', home, false])];
  return group === 'public' ? publicCases : group === 'developer' ? developerCases : [...publicCases, ...developerCases];
}

/** Plan a genuine road crossing into the actual Signal cell, never a home/title substitute.
 * @param {unknown} state @returns {import('../frame-floor-grid.mjs').FloorGridPlan} */
export function bootSignalRoadPlan(state) {
  if (typeof state !== 'object' || state === null || !('cells' in state) || !Array.isArray(state.cells)) throw new Error('Missing grid cell catalogue');
  const targets = state.cells.filter((/** @type {unknown} */ row) => typeof row === 'object' && row !== null && 'slug' in row && row.slug === 'sunscar-dunes');
  const target = /** @type {unknown} */ (targets.at(0));
  if (targets.length !== 1 || typeof target !== 'object' || target === null || !('instance' in target) || typeof target.instance !== 'string' || target.instance.length === 0 ||
    !('cell' in target) || !Array.isArray(target.cell) || target.cell.length !== 2) throw new Error('Signal grid cell is missing or ambiguous');
  const x = /** @type {unknown} */ (target.cell[0]), z = /** @type {unknown} */ (target.cell[1]);
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isSafeInteger(x) || !Number.isSafeInteger(z)) throw new Error('Invalid Signal grid address');
  // Let the owned home checkpoint and leave commit on the neutral road midpoint
  // before approaching Signal. The nearby border can already select Signal.
  return { name: 'boot-signal-road-entry', from: null, to: target.instance, movement: 'road-hover',
    start: { x: x * 555, z: z * 555 + 277.5 }, waypoints: [{ x: x * 555, z: z * 555 + 245 }],
    requiredResidents: [target.instance], finishOnArrival: true };
}

/** A ready home or prepared-only destination cannot satisfy the road-entry gate.
 * @param {import('../frame-floor-grid.mjs').FloorGridWitness} witness */
export function verifyBootSignalRoad(witness) {
  const failures = gridFloorWitnessFailures(witness);
  const cell = witness.after.cells.find(row => row.instance === witness.plan.to);
  if (witness.plan.from !== null || cell?.slug !== 'sunscar-dunes') failures.push('Required Signal road entry was not driven');
  if (!witness.trace.some(row => row.current === null)) failures.push('No actual road frame was observed');
  if (failures.length > 0) throw new Error(`Signal road entry: ${failures.join('; ')}`);
}

/** Keep the existing home deadline and give this additional mandatory crossing its own unchanged 90-second budget.
 * @param {import('playwright').Page} page @param {string[]} faults */
async function bootSignalRoad(page, faults) {
  const deadline = Date.now() + 90000;
  const plan = bootSignalRoadPlan((await page.evaluate(bootObservation)).grid);
  const documentOrigin = await page.evaluate(gridFloorDocumentIdentity);
  let finished = false;
  const route = (async () => {
    try { return { witness: await runFloorGridRoute(page, plan, documentOrigin) }; }
    catch (error) { return { error }; }
    finally { finished = true; }
  })();
  await until(page, faults, () => Promise.resolve(finished), 'Signal road entry', deadline);
  const result = await route;
  if ('error' in result) throw result.error instanceof Error ? result.error : new Error(String(result.error));
  verifyBootSignalRoad(result.witness);
  const initial = await page.evaluate(bootObservation);
  await until(page, faults, async () => { const observed = await page.evaluate(bootObservation); return observed.ready && observed.frame >= initial.frame + 10; }, 'Signal ten live gameplay frames', deadline);
  return result.witness;
}

/** @param {import('playwright').Browser} browser @param {string} base */
async function discoverCatalogue(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  try {
    await saveFixture(context, { scope: 'device', key: 'devMode', data: false });
    const page = await context.newPage(), url = new URL(base);
    for (const [key, value] of Object.entries({ tier: 'phone', touch: '1', mute: '1', nolock: '1', sw: '0' })) url.searchParams.set(key, value);
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.ws-main-logo').waitFor({ timeout: 30000 });
    return await page.evaluate(bootCatalogue);
  } finally { await context.close(); }
}

/** Browser-side: the first world collider within 3 m above the player's head in the live physics (null: open sky). */
export function spawnOverhead() {
  const probe = window.__wildshard;
  const physics = probe.requireWorld().physics, feet = probe.state().player.pos;
  // from just above the 1.8 m capsule (its own body is not overhead), solid, sensors (water volumes) skipped
  const from = feet.y + 1.9, hit = physics.world.castRay(new physics.R.Ray({ x: feet.x, y: from, z: feet.z }, { x: 0, y: 1, z: 0 }), 3, true, physics.R.QueryFilterFlags.EXCLUDE_SENSORS);
  return hit === null ? null : { feet, overheadY: from + hit.timeOfImpact };
}

/** `developer`: a standalone case with Developer on, for a shard that is still Developer-only (Signal Dunes: SF57's composer
 * coverage broke its boot on main, 9fb0cca1d, and no public case could see it).
 * @param {import('playwright').Browser} browser @param {string} base @param {'standalone'|'grid'|'public-policy'} mode @param {string} out @param {string} [shard] @param {boolean} [developer] */
export async function bootCase(browser, base, mode, out, shard = 'driftwood-isle', developer = false) {
  // CI's macOS runner renders the phone tier at ~0.3 fps, so a case needs more than a minute of wall clock.
  const started = Date.now(), deadline = started + 90000;
  /** @type {{initial:number|null,final:number|null}} */
  const gameplayFrames = {initial:null,final:null};
  const receipt = mode !== 'grid' && shard !== 'driftwood-isle' ? shard : mode;
  /** @type {Record<string, number>} */ const phases = {};
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // Both ordinary documents read the same device choice. Standalone proves the public default too.
  await saveFixture(context, { scope: 'device', key: 'devMode', data: mode === 'grid' || developer });
  // Existing probe permission for the one initial road pose; no scheduler or service is replaced.
  if (mode === 'grid') await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  // Static dist has no serverless API. Acknowledge telemetry and recorded nonfatal lifecycle diagnostics only.
  let telemetryPosts = 0;
  await context.route(new URL('/api/telemetry', base).href, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    telemetryPosts++; await route.fulfill({ status: 204 });
  });
  let gridNavigationIntent = false, gridNavigationObserved = false;
  await context.route(new URL('/api/errors', base).href, async route => {
    const request = route.request();
    const report = bootErrorReport(request.url(), request.method(), request.postData());
    if (bootLifecycleDiagnostic(report, gridNavigationObserved)) { await route.fulfill({ status: 204 }); return; }
    await route.continue();
  });
  const page = await context.newPage();
  page.on('framenavigated', frame => {
    if (gridNavigationIntent && frame === page.mainFrame()) gridNavigationObserved = true;
  });
  /** @type {string[]} */ const faults = [];
  /** @type {unknown[]} */ const reports = [];
  let lifecycleReports = 0;
  page.on('request', request => {
    const report = bootErrorReport(request.url(), request.method(), request.postData());
    if (new URL(request.url()).pathname !== '/api/errors' || request.method() !== 'POST') return;
    reports.push(report);
    if (bootLifecycleDiagnostic(report, gridNavigationObserved)) lifecycleReports++;
    else faults.push(`Game error report: ${JSON.stringify(report)}`);
  });
  page.on('pageerror', error => faults.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') faults.push(`console: ${message.text()} ${JSON.stringify(message.location())}`); });
  page.on('crash', () => faults.push('Page crashed'));
  page.on('response', response => { if (response.status() >= 400) faults.push(`HTTP ${response.status()}: ${response.url()}`); });
  // Remember a transient fatal even if the UI later removes it or the grid navigates to a new document.
  await context.addInitScript(() => {
    const seen = new Set();
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')) {
        const text = node.textContent || 'fatal';
        if (!seen.has(text)) { seen.add(text); console.error(`BOOT_FATAL: ${text}`); }
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  try {
    const url = new URL(base);
    for (const [key, value] of Object.entries({ tier: 'phone', touch: '1', mute: '1', nolock: '1', sw: '0' })) url.searchParams.set(key, value);
    if (mode !== 'grid') url.searchParams.set('chunk', shard);
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await until(page, faults, async () => await page.locator('.ws-main-logo').isVisible() && !(await page.locator('.ws-load').isVisible()), 'rendered usable title', deadline);
    phases.titleMs = Date.now() - started;
    if (mode !== 'grid') {
      await page.locator('.ws-main-select').click();
      // Admission enables the entry asynchronously. Developer cases prove the primary SHARDFILE,
      // while public cases use their sole ENTER WORLD; frozen LEGACY is a separate historical entry.
      if (mode === 'public-policy') {
        if (developer || shard !== 'nine-dragon-stack') throw new Error('Invalid public-policy admission case');
        await until(page, faults, async () => {
          const observed = await page.evaluate(bootObservation), admission = await page.evaluate(publicPolicyAdmission, observed);
          return admission.admitted;
        }, 'Developer-off Nine public-policy hydration and initial draw', deadline);
        const observation = await page.evaluate(bootObservation), admission = await page.evaluate(publicPolicyAdmission, observation);
        const result = { mode, phases, admission, telemetryPosts, lifecycleReports, gridNavigationObserved,
          elapsedMs: Date.now() - started, ...observation, faults, reports };
        if (!admission.admitted || faults.length > 0 || reports.length > 0) throw new Error(JSON.stringify(result));
        writeFileSync(join(out, `${receipt}.json`), `${JSON.stringify(result, null, 2)}\n`);
        return result;
      }
      const play = page.locator('.ws-menu-play'), shardfile = page.locator('.ws-menu-shardfile');
      await play.waitFor();
      await until(page, faults, async () => await play.isEnabled() || (await shardfile.isVisible() && await shardfile.isEnabled()), 'available shard entry', deadline);
      const viaShardfile = await shardfile.isVisible() && await shardfile.isEnabled();
      await (viaShardfile ? shardfile : play).click();
    } else {
      // The real grid button writes its one-shot intent and deliberately changes the document.
      gridNavigationIntent = true;
      await page.locator('.ws-main-grid').click();
    }
    let revealSkipped = false;
    await until(page, faults, async () => {
      const value = await page.evaluate(bootObservation);
      // Skip the grid's sky-down reveal with the player's own tap: it still waits for the rings and the home handoff,
      // but its 7 s camera path no longer costs minutes of wall clock on a runner that draws a frame every few seconds.
      if (value.revealing === true && !revealSkipped) {
        revealSkipped = await page.locator('.ws-grid-reveal').dispatchEvent('pointerdown').then(() => true, () => false);
      }
      if (!value.ready) return false;
      if (mode === 'standalone') return value.shard === shard && value.grid === null;
      const grid = value.grid;
      if (typeof grid !== 'object' || grid === null || !('home' in grid) || typeof grid.home !== 'string' || grid.home.length === 0 ||
        !('inside' in grid) || grid.home !== grid.inside || !('ringsReady' in grid) || grid.ringsReady !== true ||
        !('cells' in grid) || !Array.isArray(grid.cells) || !grid.cells.some((/** @type {unknown} */ cell) => typeof cell === 'object' && cell !== null && 'instance' in cell && 'shows' in cell && cell.instance === grid.home && cell.shows === 'playing')) return false;
      const session = 'live' in grid ? grid.live : null;
      const live = typeof session === 'object' && session !== null && 'live' in session ? session.live : null;
      return typeof live === 'object' && live !== null && 'current' in live && live.current === grid.home && 'gameplayReady' in live && live.gameplayReady === true;
    }, `${mode} gameplay`, deadline);
    phases.gameplayMs = Date.now() - started;
    const initial = await page.evaluate(bootObservation);
    gameplayFrames.initial = initial.frame;
    phases.framesStartMs = Date.now() - started;
    if (mode === 'grid') { // E463: the settled home spawn stands on its deck / ground, never under a collider (Driftwood's pier)
      const overhead = await page.evaluate(spawnOverhead);
      if (overhead !== null) throw new Error(`grid spawn is under a collider: ${JSON.stringify(overhead)}`);
    }
    await until(page, faults, async () => (await page.evaluate(bootObservation)).frame >= initial.frame + 10, 'ten live gameplay frames', deadline);
    gameplayFrames.final = (await page.evaluate(bootObservation)).frame;
    phases.framesCompleteMs = Date.now() - started;
    const road = mode === 'grid' ? await bootSignalRoad(page, faults) : null;
    const result = { mode, phases, gameplayFrames, road, telemetryPosts, lifecycleReports, gridNavigationObserved, elapsedMs: Date.now() - started, ...await page.evaluate(bootObservation), faults, reports };
    if (faults.length > 0 || result.fatal.length > 0) throw new Error(JSON.stringify(result));
    writeFileSync(join(out, `${receipt}.json`), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } catch (error) {
    await page.screenshot({ path: join(out, `${receipt}-failure.jpg`), type: 'jpeg', quality: 70 }).catch(() => undefined);
    const observation = await page.evaluate(bootObservation).catch(() => null);
    gameplayFrames.final = observation?.frame ?? null;
    phases.failedMs = Date.now() - started;
    writeFileSync(join(out, `${receipt}.json`), `${JSON.stringify({ mode, phases, gameplayFrames, elapsedMs: Date.now() - started, faults, reports, lifecycleReports, gridNavigationObserved, error: String(error), observation }, null, 2)}\n`);
    throw error;
  } finally { await context.close(); }
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const option = (/** @type {string} */ name) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const out = resolvePath(option('out') ?? 'boot-smoke-results'); mkdirSync(out, { recursive: true });
  const external = option('url');
  if (external === undefined && !existsSync(join(root, 'dist/index.html'))) throw new Error('Build dist before running boot smoke');
  const preview = external === undefined ? await serve(root, '', true) : null;
  const base = external ?? preview?.url;
  if (!base) throw new Error('No built preview');
  const pool = browserPool(root, 1, option('angle') ?? (process.platform === 'darwin' ? 'metal' : 'swiftshader'));
  try {
    const browser = await pool.browser(0);
    const group = option('case-group') ?? 'all';
    if (group !== 'all' && group !== 'public' && group !== 'developer') throw new Error('usage: --case-group=all|public|developer');
    const catalogue = await discoverCatalogue(browser, base), cases = bootCases(catalogue, group);
    writeFileSync(join(out, 'cases.json'), `${JSON.stringify({ group, catalogue, cases }, null, 2)}\n`);
    for (const [mode, shard, developer] of cases) {
      const isolated = await bootCaseBrowser(pool, mode);
      const result = await bootCase(isolated, base, mode, out, shard, developer);
      console.log(`${mode}: ${mode === 'public-policy' ? 'public-policy admission' : 'gameplay'} PASS in ${result.elapsedMs}ms, frame=${result.frame}, faults=${result.faults.length}`);
    }
  } finally { try { await pool.close(); } finally { preview?.close(); } }
}
if (process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url) await main();
