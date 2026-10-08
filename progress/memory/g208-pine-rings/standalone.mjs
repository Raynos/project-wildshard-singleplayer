// G208: classify Pine's whole presentation (standalone SHARD SELECT boot, level frame = cell frame) into L1 ring chunks,
// shared dependencies and cell-wide (non-streaming) drawables, beside the labelled GL census.
// scripts/browser-lane.sh --max 15 node progress/memory/g208-pine-rings/standalone.mjs <base> <out.json> <preflight.iife.js>
// The bundle is src/game/grid/runtimeRenderPreflight.ts as an IIFE named `__g208` (rolldown, format iife).
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
const [base, out, bundle] = process.argv.slice(2);
const version = await (await fetch(new URL('version.json', base))).json();
const report = { version, errors: [] };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
try {
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto' }, merge: true });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(GL_INIT);
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}?chunk=pine-hollow&touch=1&tier=phone&mute=1&sw=0&nolock=1`, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.hud) && !document.querySelector('.ws-load'), null, { timeout: 180000 });
  await page.evaluate(() => window.__wildshard.world.hud.enterNow());
  await page.waitForTimeout(20000);
  await page.addScriptTag({ content: readFileSync(bundle, 'utf8') });
  const claim = 804_680_577; // sim:pine-hollow in the grid allocator (runtimeAccountedBytes of PINE_RUNTIME_COST)
  report.preflight = await page.evaluate((claimBytes) => window.__g208.preflightRenderPlan(window.__wildshard.world.game.scene, { id: 'pine-hollow', claimBytes }), claim);
  const gl = await page.evaluate(() => window.__sc_gl());
  const byOwner = {};
  for (const ctx of gl) for (const r of ctx.resources ?? []) { const k = `${r.kind}:${r.owner}`; byOwner[k] = (byOwner[k] ?? 0) + r.bytes; }
  report.gl = { totals: gl.map(c => ({ texBytes: c.texBytes, rbBytes: c.rbBytes, bufBytes: c.bufBytes, textures: c.textures, buffers: c.buffers })), byOwner };
  report.js = await page.evaluate(() => ({ heap: performance.memory?.usedJSHeapSize ?? null }));
  await page.screenshot({ path: out.replace(/\.json$/u, '') + '.jpg', type: 'jpeg', quality: 62 });
} catch (error) { report.failure = String(error); console.log('FAIL', report.failure); }
finally { save(); await context.close(); await browser.close(); }
