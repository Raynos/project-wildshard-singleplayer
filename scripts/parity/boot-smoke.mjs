#!/usr/bin/env node
// Required push-CI smoke against Vite's built dist, using the real title and session owners.
// No skipintro, injected world, gameplay service stubs, harness scheduler, or screenshot readiness oracle.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserPool } from './pool.mjs';
import { serve } from './serve.mjs';
import { saveFixture } from '../debug-settings.mjs';

/** Browser-side observation; also exercised against fatal and incomplete boot fixtures. */
export function bootObservation() {
  const fatal = [...document.querySelectorAll('#wserr,.ws-load-error,.ws-game-dev-alert,[data-boot-fatal]')].map(node => node.textContent || 'fatal');
  const probe = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard);
  if (!probe?.world) return { fatal, ready: false, frame: -1, shard: '', grid: null };
  const world = probe.requireWorld(), state = probe.state();
  const { grid: exposed } = world.game.app.debug.snapshot();
  const grid = typeof exposed === 'object' && exposed !== null && 'state' in exposed && typeof exposed.state === 'function' ? exposed.state() : null;
  const hud = document.querySelector('#hud');
  const revealing = document.querySelector('.ws-grid-reveal') !== null;
  const entered = world.hud.entered && !world.hud.paused, frameGate = world.game.frameGate();
  const ready = state.appState === 'play' && entered && frameGate && hud !== null && !hud.classList.contains('intro') && !revealing &&
    [state.player.pos.x, state.player.pos.y, state.player.pos.z, state.player.health].every(Number.isFinite) && state.player.health > 0;
  return { fatal, ready, entered, revealing, frameGate, frame: probe.app.clock.frame, shard: probe.shard.slug, grid };
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

/** Browser-side: the first world collider within 3 m above the player's head in the live physics (null: open sky). */
export function spawnOverhead() {
  const probe = window.__wildshard;
  const physics = probe.requireWorld().physics, feet = probe.state().player.pos;
  // from just above the 1.8 m capsule (its own body is not overhead), solid, sensors (water volumes) skipped
  const from = feet.y + 1.9, hit = physics.world.castRay(new physics.R.Ray({ x: feet.x, y: from, z: feet.z }, { x: 0, y: 1, z: 0 }), 3, true, physics.R.QueryFilterFlags.EXCLUDE_SENSORS);
  return hit === null ? null : { feet, overheadY: from + hit.timeOfImpact };
}

/** @param {import('playwright').Browser} browser @param {string} base @param {'standalone'|'grid'} mode @param {string} out @param {string} [shard] */
export async function bootCase(browser, base, mode, out, shard = 'driftwood-isle') {
  // CI's macOS runner renders the phone tier at ~0.3 fps, so a case needs more than a minute of wall clock.
  const started = Date.now(), deadline = started + 90000;
  const receipt = mode === 'standalone' && shard !== 'driftwood-isle' ? shard : mode;
  /** @type {Record<string, number>} */ const phases = {};
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // Both ordinary documents read the same device choice. Standalone proves the public default too.
  await saveFixture(context, { scope: 'device', key: 'devMode', data: mode === 'grid' });
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
    if (mode === 'standalone') url.searchParams.set('chunk', shard);
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await until(page, faults, async () => await page.locator('.ws-main-logo').isVisible() && !(await page.locator('.ws-load').isVisible()), 'rendered usable title', deadline);
    phases.titleMs = Date.now() - started;
    if (mode === 'standalone') {
      await page.locator('.ws-main-select').click();
      await page.locator('.ws-menu-play').click();
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
    if (mode === 'grid') { // E463: the settled home spawn stands on its deck / ground, never under a collider (Driftwood's pier)
      const overhead = await page.evaluate(spawnOverhead);
      if (overhead !== null) throw new Error(`grid spawn is under a collider: ${JSON.stringify(overhead)}`);
    }
    await until(page, faults, async () => (await page.evaluate(bootObservation)).frame >= initial.frame + 10, 'ten live gameplay frames', deadline);
    const result = { mode, phases, telemetryPosts, lifecycleReports, gridNavigationObserved, elapsedMs: Date.now() - started, ...await page.evaluate(bootObservation), faults, reports };
    if (faults.length > 0 || result.fatal.length > 0) throw new Error(JSON.stringify(result));
    writeFileSync(join(out, `${receipt}.json`), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } catch (error) {
    await page.screenshot({ path: join(out, `${receipt}-failure.jpg`), type: 'jpeg', quality: 70 }).catch(() => undefined);
    writeFileSync(join(out, `${receipt}.json`), `${JSON.stringify({ mode, phases, elapsedMs: Date.now() - started, faults, reports, lifecycleReports, gridNavigationObserved, error: String(error), observation: await page.evaluate(bootObservation).catch(() => null) }, null, 2)}\n`);
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
    for (const [mode, shard] of /** @type {const} */ ([['standalone', 'driftwood-isle'], ['standalone', 'pine-hollow'], ['grid', 'driftwood-isle']])) {
      const result = await bootCase(browser, base, mode, out, shard);
      console.log(`${mode}: gameplay PASS in ${result.elapsedMs}ms, frame=${result.frame}, faults=${result.faults.length}`);
    }
  } finally { try { await pool.close(); } finally { preview?.close(); } }
}
if (process.argv[1] && pathToFileURL(resolvePath(process.argv[1])).href === import.meta.url) await main();
