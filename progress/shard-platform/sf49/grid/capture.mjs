// E435 / SF49-g: a cold grid admission through every road socket, ridden lift, rope bridge and playable island.
// Only the declared initial road approach is seeded. All measured traversal uses held input and the normal RIDE prompt.
// Run through browser-lane.sh: node capture.mjs <pinned-preview-url> <scratch-report.json> [edge]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
import { installResources } from '../../../../scripts/parity/resources.mjs';
import { GL_INIT } from '../../../../scripts/parity/glbytes.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute } from '../../../../scripts/frame-floor-grid.mjs';

const [base, out, only] = process.argv.slice(2);
if (!base || !out) throw new Error('Expected pinned preview URL and scratch report path');
const started = Date.now();
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'Production build, Developer ON, phone tier/2x, one muted Metal iPhone 16 Pro portrait browser. Four cold contexts. One road pose per context; no later teleport, creature freeze or crossing reload. Labelled GL and allocator cost only; native WebContent pending.', entries: [], errors: [], consoleErrors: [], warnings: [], documents: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const snapshot = page => page.evaluate(() => {
  const api = window.__wildshard, grid = api.shard.grid, world = api.requireWorld();
  return { state: grid.state(), residency: grid.residency(), gl: window.__sc_gl().map(({ gl, ...row }) => row),
    position: { ...world.player.position }, islets: api.shard.farReach?.islets?.map(entry => ({ edge: entry.edge, position: api.shard.farReach.isletAt(entry.edge) })) };
});
try {
  for (const edge of ['north', 'east', 'south', 'west'].filter(edge => !only || edge === only)) {
    const row = { edge, snapshots: [], routes: [], trace: [], ride: [], errors: [], consoleErrors: [], warnings: [], documents: [] };
    report.entries.push(row); report.stage = `${edge}:boot`; save();
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', error => { row.errors.push(String(error)); save(); });
    page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); if (message.type() === 'warning') row.warnings.push(message.text()); });
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) row.documents.push(request.url()); });
    try {
      await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
      await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
      await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
      await context.addInitScript(installResources); await context.addInitScript(GL_INIT);
      await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
      await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
      await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit' });
      await page.locator('.ws-main-grid').click();
      await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
        || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
      const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
      await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
      await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
      const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
      const cell = state.cells.find(cell => cell.slug === 'far-reach'); if (!cell) throw new Error('Missing Developer Sky cell');
      row.cell = cell; const ox = cell.cell[0] * 555, oz = cell.cell[1] * 555;
      const normal = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] }[edge];
      // Initial staging only: checkpoint the boot home through the normal crossing onto the target road frame.
      const start = { x: ox + normal[0] * 277.5, z: oz + normal[1] * 277.5 };
      await page.evaluate(async start => {
        const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.requireWorld().player;
        const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
        await api.pose({ x: start.x - origin.x, y: 0.55, z: start.z - origin.z, yaw: 0, pitch: -0.08 });
      }, start);
      await page.waitForFunction(() => { const state = window.__wildshard.shard.grid.state(); return state.live.live.current === null && state.inside === null && state.live.live.gameplayReady; });
      row.document = await page.evaluate(gridFloorDocumentIdentity); row.bootDocuments = row.documents.length;
      await page.evaluate(() => { const player = window.__wildshard.requireWorld().player, spawn = player.spawn;
        window.__sf49Recoveries = [];
        player.spawn = function(...args) { window.__sf49Recoveries.push({ time: performance.now(), args, stack: new Error('Unexpected route recovery').stack }); return Reflect.apply(spawn, this, args); };
      });
      row.snapshots.push({ label: 'road-initial', ...await snapshot(page) }); save();
      report.stage = `${edge}:road-entry`; save();
      const approach = { name: `${edge}-road-to-lip`, from: null, to: cell.instance, movement: 'road-hover',
        waypoints: [{ x: ox + normal[0] * 234, z: oz + normal[1] * 234 }], requiredResidents: [cell.instance] };
      const drive = async plan => {
        let polling = false;
        const timer = setInterval(async () => {
          if (polling || row.trace.length >= 600) return;
          polling = true;
          try {
            row.trace.push(await page.evaluate(() => { const api = window.__wildshard, state = api.shard.grid.state(), player = api.requireWorld().player;
              return { time: performance.now(), position: { ...player.position }, mode: player.mode, grounded: player.onGround,
                current: state.live.live.current, worldFeet: state.live.live.worldFeet, inside: state.inside,
                ready: state.live.live.gameplayReady, playingMB: state.playingMB }; }));
            save();
          } catch (error) { row.traceError = String(error); }
          finally { polling = false; }
        }, 1000);
        try { return await runFloorGridRoute(page, plan, row.document); }
        finally { clearInterval(timer); }
      };
      row.routes.push(await drive(approach));
      await page.waitForFunction(() => window.__wildshard.shard.farReach?.islets?.length === 4);
      const entry = await page.evaluate(edge => JSON.parse(JSON.stringify(window.__wildshard.shard.farReach.islets.find(entry => entry.edge === edge))), edge);
      row.entry = entry;
      const walk = async (name, points) => {
        row.routes.push(await drive({ name, from: cell.instance, to: cell.instance, movement: 'road-hover',
          waypoints: points.map(point => ({ x: ox + point.x, z: oz + point.z })), requiredResidents: [cell.instance] })); save();
      };
      await walk(`${edge}-board`, [entry.rest]);
      const shot = async label => { await page.screenshot({ path: join(dirname(out), `${edge}-${label}.jpg`), type: 'jpeg', quality: 72 }); };
      await shot('board'); row.snapshots.push({ label: 'board', ...await snapshot(page) }); save();
      report.stage = `${edge}:ride`; save();
      row.gateOpenAtRest = await page.evaluate(edge => window.__wildshard.shard.farReach.isletGateShut(edge) === false, edge);
      await page.evaluate(edge => { window.__wildshard.shard.farReach.interactIslet(edge, 1); }, edge);
      const rideStart = Date.now();
      while (Date.now() - rideStart < (entry.travel + 10) * 1000) {
        const pose = await page.evaluate(edge => { const api = window.__wildshard, player = api.requireWorld().player, islet = api.shard.farReach.isletAt(edge); return {
          document: window.__frameFloorGridDocumentToken, player: { ...player.position }, onPlatform: player.onPlatform, islet, gateShut: api.shard.farReach.isletGateShut(edge) }; }, edge);
        if (pose.document !== row.document.token) throw new Error('Document changed during lift ride');
        row.ride.push(pose); save();
        if (Math.abs(pose.islet.y - entry.dock.y) < 0.01) break;
        await page.waitForTimeout(250);
      }
      const docked = row.ride.at(-1);
      if (!docked || Math.abs(docked.player.y - entry.dock.y) > 0.5) throw new Error('Rider did not reach the docked islet');
      row.gateShutAway = row.ride.some(pose => pose.gateShut);
      await shot('docked');
      report.stage = `${edge}:bridge`; save();
      await walk(`${edge}-gate-bridge-island`, entry.climb.slice(1));
      await page.waitForTimeout(1500); await shot('island'); row.snapshots.push({ label: 'island', ...await snapshot(page) });
      const end = await page.evaluate(() => ({ ...window.__wildshard.requireWorld().player.position }));
      row.onIsland = Math.abs(end.y - entry.isle.y) < 0.5;
      row.recoveries = await page.evaluate(() => window.__sf49Recoveries);
      row.leak = await page.evaluate(() => window.__wildshard.leak());
      row.finalGL = await page.evaluate(() => window.__sc_gl().map(({ gl, ...row }) => row));
      row.edgeFallbacks = row.warnings.filter(message => /edges stay at road level|platform keeps road-level edges|edge.*fallback|fallback.*edge/iu.test(message));
      row.pass = row.edgeFallbacks.length === 0 && row.recoveries.length === 0 && row.onIsland && row.gateOpenAtRest && row.gateShutAway && row.errors.length === 0 && row.consoleErrors.length === 0
        && row.documents.length === row.bootDocuments && row.leak.disposalErrors.length === 0 && row.leak.after.bodies === 0
        && row.leak.after.colliders === 0 && Object.values(row.leak.scope).every(count => count === 0);
      save(); console.log(JSON.stringify({ edge, pass: row.pass, errors: row.errors, consoleErrors: row.consoleErrors, playingMB: row.snapshots.at(-1).state.playingMB }));
      if (!row.pass) throw new Error('Entry route/unload conjunction failed');
    } catch (error) {
      row.failure = String(error.stack ?? error); row.pass = false;
      row.last = await page.evaluate(() => ({ state: window.__wildshard?.shard?.grid?.state(), body: document.body.innerText.slice(-8000), url: location.href })).catch(() => null);
      row.recoveries = await page.evaluate(() => window.__sf49Recoveries).catch(() => null);
      row.failedLeak = await page.evaluate(() => window.__wildshard?.leak()).catch(error => String(error));
      save(); throw error;
    } finally { await context.close(); row.closed = true; save(); }
  }
  report.pass = report.entries.length === (only ? 1 : 4) && report.entries.every(row => row.pass);
} catch (error) { report.failure = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
finally { await browser.close(); report.closed = true; report.seconds = (Date.now() - started) / 1000; save(); console.log(JSON.stringify({ pass: report.pass, failure: report.failure, seconds: report.seconds })); }
