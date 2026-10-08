#!/usr/bin/env node
// E459: real touch input must mount the platform board, independently of authored items and Developer.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, webkit } from 'playwright';
import { browserPool } from './pool.mjs';
import { serve } from './serve.mjs';
import { saveFixture } from '../debug-settings.mjs';
import { stageFloorGrid } from '../frame-floor-grid.mjs';
import { installLegacyProbeAdapter } from './probe.mjs';

function observe() {
  const api = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard), world = api?.world;
  if (!world) return null;
  const exposed = api.shard.grid;
  const grid = /** @type {import('../frame-floor-grid.mjs').FloorGridState | undefined} */ (typeof exposed === 'object' && exposed !== null && 'state' in exposed && typeof exposed.state === 'function' ? exposed.state() : undefined);
  return { shard: api.shard.slug, state: world.game.app.state, hover: world.player.hover, blend: world.player.hoverBlend,
    tools: world.weapons.tools.map(tool => ({ id: tool.id, enabled: tool.enabled, visible: 'model' in tool && tool.model instanceof Object && 'visible' in tool.model && tool.model.visible === true })),
    allowed: world.game.app.input.allowed('hover'), feet: { x: world.player.position.x, y: world.player.position.y, z: world.player.position.z },
    current: grid?.live.live.current, ready: grid?.live.live.gameplayReady };
}

/** @param {import('playwright').Browser} browser @param {string} base @param {'template'|'road'} mode @param {string} out */
async function run(browser, base, mode, out) {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  // These two catalogue entries are Developer-only; do not substitute the default shard when one is hidden.
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(installLegacyProbeAdapter);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  /** @type {string[]} */ const faults = [];
  page.on('pageerror', error => { faults.push(error.message); });
  let before = null, mounted = null, unmounted = null;
  try {
    const url = new URL(base);
    for (const [key, value] of Object.entries({ tier: 'phone', touch: '1', mute: '1', nolock: '1', sw: '0' })) url.searchParams.set(key, value);
    if (mode === 'template') url.searchParams.set('chunk', '_template');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.ws-main-select').waitFor({ state: 'visible', timeout: 150000 });
    if (mode === 'template') {
      await page.locator('.ws-main-select').tap();
      // SF65's data-only template has a disabled LEGACY button and an explicit SHARDFILE entry.
      const play = page.locator('.ws-menu-play');
      await (await play.isDisabled() ? page.locator('.ws-menu-shardfile') : play).tap();
    } else await page.locator('.ws-main-grid').tap();
    await page.waitForFunction(() => {
      const api = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard);
      return api?.world?.game.app.state === 'play' && !document.querySelector('#hud.intro,.ws-reveal');
    }, undefined, { timeout: 150000 });
    if (mode !== 'template') {
      await page.evaluate(async () => { await window.__wildshard.pose({ x: 277.5, y: 0.55, z: 277.5, yaw: 0, pitch: -0.08 }); });
      await page.waitForFunction(() => {
        const exposed = window.__wildshard.shard.grid;
        const grid = /** @type {import('../frame-floor-grid.mjs').FloorGridState | undefined} */ (typeof exposed === 'object' && exposed !== null && 'state' in exposed && typeof exposed.state === 'function' ? exposed.state() : undefined);
        return grid?.live.live.current === null && grid.live.live.gameplayReady;
      }, undefined, { timeout: 120000 });
      const plan = { name: 'hover-touch-road', from: null, to: null, start: { x: 277.5, z: 277.5 }, waypoints: [] };
      await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(plan)},performance.timeOrigin)`);
    } else if (await page.evaluate(() => window.__wildshard.shard.slug) !== '_template') throw new Error('Template test booted another shard');
    const hover = page.locator('.ws-touch-hover');
    await hover.waitFor({ state: 'visible' });
    before = await page.evaluate(observe);
    await hover.tap();
    await page.waitForFunction(() => {
      const api = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard), world = api?.world;
      return world?.player.hover === true && world.player.hoverBlend > 0.5 &&
        world.weapons.tools.some(tool => tool.id === 'tool.hoverboard' && tool.enabled && 'model' in tool && tool.model instanceof Object && 'visible' in tool.model && tool.model.visible === true);
    }, undefined, { timeout: 5000 });
    mounted = await page.evaluate(observe);
    await hover.tap();
    await page.waitForFunction(() => {
      const api = /** @type {import('../../src/engine/debug/probe').EngineProbe | undefined} */ (window.__wildshard);
      return api?.world?.player.hover === false;
    }, undefined, { timeout: 5000 });
    unmounted = await page.evaluate(observe);
    if (faults.length > 0) throw new Error(faults.join('\n'));
    return { mode, pass: true, before, mounted, unmounted, faults };
  } catch (error) {
    await page.screenshot({ path: join(out, `${mode}-failure.jpg`), type: 'jpeg', quality: 65 }).catch(() => undefined);
    return { mode, pass: false, before, mounted, unmounted, after: await page.evaluate(observe).catch(() => null), error: String(error), faults };
  } finally { await context.close(); }
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const option = (/** @type {string} */ key) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = resolve(option('out') ?? 'boot-smoke-results/hover'); mkdirSync(out, { recursive: true });
const external = option('url'), preview = external === undefined ? await serve(root, '', true) : null;
const base = external ?? preview?.url;
if (!base) throw new Error('No built preview');
const pool = browserPool(root, 1, process.platform === 'darwin' ? 'metal' : 'swiftshader');
const engine = option('engine') ?? 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Unknown browser engine');
// WebKit callers use scripts/browser-lane.sh around this command; Chromium's pool owns its lane itself.
/** @type {import('playwright').Browser | undefined} */ let browser;
try {
  browser = engine === 'webkit' ? await webkit.launch() : await pool.browser(0);
  const results = [];
  for (const mode of /** @type {const} */ (['template', 'road'])) {
    const result = await run(browser, base, mode, out); results.push(result);
    writeFileSync(join(out, `${mode}.json`), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${mode}: ${result.pass ? 'PASS' : 'FAIL'} ${result.error ?? ''}`);
  }
  if (results.some(result => !result.pass)) process.exitCode = 1;
} finally { try { if (engine === 'webkit') await browser?.close(); await pool.close(); } finally { preview?.close(); } }
