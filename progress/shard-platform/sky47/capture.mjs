// SHARD-PLATFORM sp-o2 sky47 (G321, from op-sky46's capture.mjs): every grid cell's own sky, one shot inside its cell and one
// on its 16 m edge band (standing on the edge line: the cell's owner weight 0.5), facing the cell's centre, with the frame's
// sky readout (the region skies hung, their weights and bytes). One muted Metal context per surface: iPhone 16 Pro portrait
// (phone tier, 2x) or desktop (1440x900, desktop tier); Developer on. Cells are entered from the road by frame-floor's `cell`
// plan (held input), the home cell is posed in directly.
//   SERVE_OWNER=sp-o2 scripts/serve-build.sh --name sky47      (from /private/tmp/sp-lanes/sp-o2)
//   scripts/browser-lane.sh --max 40 node progress/shard-platform/sky47/capture.mjs <preview-url> <out-dir> <phone|desktop> [cell,...]
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const [base, out, surface = 'phone', only = ''] = process.argv.slice(2);
if (!base || !out || !['phone', 'desktop'].includes(surface)) throw new Error('usage: capture.mjs <preview-url> <out-dir> <phone|desktop> [cell,...]');
const PITCH = 555, HALF = 250, INSIDE = 200;
mkdirSync(out, { recursive: true });
const report = { version: await (await fetch(new URL('version.json', base))).json(), surface, started: new Date().toISOString(), cells: {}, errors: [], consoleErrors: 0, consoleSamples: [] };
const save = () => writeFileSync(join(out, `capture-${surface}.json`), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const phone = surface === 'phone';

const ctx = await browser.newContext(phone ? { ...devices['iPhone 16 Pro'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: phone ? 'phone' : 'desktop', fps: 'auto', tex: 'auto', volume: 0 }, merge: true });
await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: phone ? '2' : '1', aa: 'auto' } });
await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
const page = await ctx.newPage(); page.setDefaultTimeout(240000);
page.on('pageerror', (error) => { report.errors.push(String(error.stack ?? error).slice(0, 400)); });
page.on('console', (msg) => { if (msg.type() === 'error' && report.consoleErrors < 400) { report.consoleErrors++; if (report.consoleSamples.length < 8) report.consoleSamples.push(msg.text().slice(0, 300)); } });

const hideDev = () => page.evaluate(() => {
  for (const e of document.querySelectorAll('[class*="ws-grid-budget"], [class*="ws-memory"]')) {
    let p = e; while (p.parentElement && p.parentElement !== document.body && !['fixed', 'absolute'].includes(getComputedStyle(p).position)) p = p.parentElement;
    p.style.display = 'none';
  }
});
/** page-local = grid world − (live world feet − player position) */
const toLocal = (p) => page.evaluate((p) => {
  const api = window.__wildshard, live = api.shard.grid.state().live.live, q = api.requireWorld().player.position;
  return { x: p.x - (live.worldFeet.x - q.x), z: p.z - (live.worldFeet.z - q.z) };
}, p);
/** pose the feet at grid-world `p` (on the ground there) looking along world `heading`, held every frame */
const holdAt = async (p, heading, pitch = 0.06, y = 0.55) => {
  const local = await toLocal(p);
  await page.evaluate(async ({ local, heading, pitch, y }) => {
    const api = window.__wildshard, w = api.requireWorld();
    window.__holdAt = null;
    const look = async (yaw) => {
      await api.pose({ x: local.x, y, z: local.z, yaw, pitch });
      await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); });
      const cam = w.game.camera, v = cam.getWorldDirection(cam.position.clone());
      return Math.atan2(v.x, v.z);
    };
    const a0 = await look(0), a1 = await look(Math.PI / 2), turn = Math.sign(Math.sin(a1 - a0)) || 1;
    await look((heading - a0) * turn);
    await new Promise((r) => { setTimeout(r, y > 1 ? 4000 : 600); }); // a drop from above lands on its own ground first
    window.__holdAt = w.player.position.clone();
    if (window.__holding) return;
    window.__holding = true;
    const tick = () => { if (window.__holdAt) { w.player.position.copy(window.__holdAt); w.player.velocity.set(0, 0, 0); } requestAnimationFrame(tick); };
    tick();
  }, { local, heading, pitch, y });
};
const release = () => page.evaluate(() => { window.__holdAt = null; });
const readout = () => page.evaluate(() => {
  const api = window.__wildshard, s = api.shard.grid.state(), w = api.requireWorld(), sc = w.game.rootScene, r3 = (c) => (c?.toArray ? c.toArray().map((n) => Math.round(n * 1000) / 1000) : null);
  const light = w.sky?.csm?.lights?.[0];
  return { inside: s.inside, owner: s.frame?.owner ?? null, skies: s.frame?.skies ?? null, weights: s.frame?.weights ?? null, roadSky: s.frame?.roadSky ?? null, horizon: s.frame?.horizon ?? null,
    key: r3(light?.color), keyI: Math.round((light?.intensity ?? 0) * 1000) / 1000, fog: r3(sc.fog?.color), env: sc.environment ? `${sc.environment.image?.width ?? '?'}x${sc.environment.image?.height ?? '?'}@${Math.round(sc.environmentIntensity * 100) / 100}` : null,
    live: s.live?.live?.current ?? null };
});
const shoot = async (name) => { await hideDev(); await page.waitForTimeout(300); const path = join(out, `${name}-${surface}.png`); await page.screenshot({ path }); return path; };

try {
  await page.goto(base, { waitUntil: 'commit' });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
  const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
  await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
  const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const home = state.cells.find((c) => c.instance === state.home);
  const order = only === '' ? state.cells.map((c) => c.instance) : only.split(',');
  for (const id of order) {
    const cell = state.cells.find((c) => c.instance === id || c.slug === id);
    const row = { slug: cell?.slug, shots: {} }; report.cells[id] = row; save();
    try {
      if (!cell) throw new Error(`no cell ${id}`);
      const c = { x: cell.cell[0] * PITCH, z: cell.cell[1] * PITCH }, h = { x: home.cell[0] * PITCH, z: home.cell[1] * PITCH };
      // the edge that faces home (the far side of home for the home cell itself)
      let dx = Math.sign(h.x - c.x), dz = Math.sign(h.z - c.z);
      if (dx === 0 && dz === 0) dz = 1;
      if (dx !== 0 && dz !== 0) dx = 0;
      const heading = Math.atan2(-dx, -dz);
      if (cell.instance !== state.home) {
        await release();
        const [plan] = gridFloorPlans(await page.evaluate(() => window.__wildshard.shard.grid.state()), 'cell', { cell: cell.instance });
        await page.evaluate(async (p) => {
          const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.requireWorld().player;
          await api.pose({ x: p.x - (live.worldFeet.x - player.position.x), y: 0.55, z: p.z - (live.worldFeet.z - player.position.z), yaw: 0, pitch: -0.05 });
        }, plan.start);
        await page.waitForFunction(() => { const s = window.__wildshard.shard.grid.state(); return s.live.live.current === null && s.inside === null && s.live.live.gameplayReady; });
        try {
          const result = await runFloorGridRoute(page, plan, await page.evaluate(gridFloorDocumentIdentity));
          row.route = gridFloorWitnessFailures(result);
        } catch (error) {
          // a cell entered by a portal or a lift (Sky Reach's islet): the flat drive stops at its edge; stand inside instead
          row.route = [`drive: ${String(error).slice(0, 160)}`];
          await holdAt({ x: c.x + dx * INSIDE, z: c.z + dz * INSIDE }, heading);
        }
        await page.waitForFunction((inst) => { const l = window.__wildshard.shard.grid.state().live.live; return l.current === inst && l.gameplayReady && l.pending.length === 0; }, cell.instance, { timeout: 180000 });
      }
      // the home cell's world stands at its own datum (Driftwood's island is shifted): drop onto its ground from above
      const drop = cell.instance === state.home ? 40 : 0.55;
      await holdAt({ x: c.x + dx * INSIDE, z: c.z + dz * INSIDE }, heading, 0.06, drop);
      await page.waitForTimeout(5000);
      row.shots.inside = { path: await shoot(`${cell.instance}-inside`), frame: await readout() };
      await holdAt({ x: c.x + dx * HALF, z: c.z + dz * HALF }, heading, 0.06, drop);
      await page.waitForTimeout(4000);
      row.shots.edge = { path: await shoot(`${cell.instance}-edge`), frame: await readout() };
    } catch (error) { row.failure = String(error.stack ?? error).slice(0, 1200); }
    save();
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.cells).map(([k, v]) => [k, { failure: v.failure?.slice(0, 200), route: v.route, inside: v.shots.inside?.frame, edge: v.shots.edge?.frame }])), null, 1));
console.log('errors', report.errors.length, 'console', report.consoleErrors);
