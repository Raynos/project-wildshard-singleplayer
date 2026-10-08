// E435 / SF50-g: cold entry, return to the road and re-entry through each native Signal Dunes socket.
// Only the first road approach is seeded; every later crossing uses held input and the production motor.
// Run through browser-lane.sh: node capture.mjs <pinned-preview-url> <scratch-report.json> [edge]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
import { installResources } from '../../../../scripts/parity/resources.mjs';
import { GL_INIT } from '../../../../scripts/parity/glbytes.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures } from '../../../../scripts/frame-floor-grid.mjs';

const [base, out, only] = process.argv.slice(2);
if (!base || !out || (only !== undefined && !['north', 'east', 'south', 'west'].includes(only))) throw new Error('Expected pinned preview URL, scratch report path and optional valid edge');
const started = Date.now();
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'Production build, Developer ON, phone tier/2x, one muted Metal iPhone 16 Pro portrait browser. Four cold contexts. One road pose per context; real-input entry, road return and re-entry, no later teleport, creature freeze or crossing reload. Labelled GL and allocator cost only; native WebContent pending.', entries: [], errors: [], consoleErrors: [], warnings: [], documents: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const snapshot = page => page.evaluate(() => {
  const api = window.__wildshard, grid = api.shard.grid, world = api.requireWorld();
  return { state: grid.state(), residency: grid.residency(), gl: window.__sc_gl().map(({ gl, ...row }) => row),
    position: { ...world.player.position }, accent: document.querySelector('#hud')?.style.getPropertyValue('--ws-cyan'),
    actors: api.shard.sunscar?.creatures?.all().map(actor => ({ id: actor.entityId, kind: actor.kind, hp: actor.hp, alive: actor.alive })),
    // Read existing geometry metadata and matrices only; no released attribute accessor is touched.
    presentation: (() => { const bands = [], planes = []; world.game.scene.traverse(object => {
      if (object.name === 'haze-band') bands.push({ visible: object.visible, colour: object.material.uniforms.uColour.value.toArray(), opacity: object.material.uniforms.uOpacity.value });
      if (object.geometry?.type === 'PlaneGeometry') planes.push({ name: object.name, width: object.geometry.parameters.width,
        height: object.geometry.parameters.height, worldX: object.matrixWorld.elements[12], worldZ: object.matrixWorld.elements[14] });
    }); return { bands, planes }; })() };
});
try {
  for (const edge of ['north', 'east', 'south', 'west'].filter(edge => !only || edge === only)) {
    const row = { edge, snapshots: [], routes: [], trace: [], errors: [], consoleErrors: [], warnings: [], documents: [] };
    report.entries.push(row); report.stage = `${edge}:boot`; save();
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', error => { row.errors.push(String(error)); save(); });
    page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); if (message.type() === 'warning') row.warnings.push(message.text()); });
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) row.documents.push(request.url()); });
    try {
      await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
      await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on' }, merge: true });
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
      const cell = state.cells.find(cell => cell.slug === 'sunscar-dunes'); if (!cell) throw new Error('Missing Developer Signal Dunes cell');
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
        window.__sf50Recoveries = [];
        player.spawn = function(...args) { window.__sf50Recoveries.push({ time: performance.now(), args, stack: new Error('Unexpected route recovery').stack }); return Reflect.apply(spawn, this, args); };
      });
      row.snapshots.push({ label: 'road-initial', ...await snapshot(page) }); save();
      const shot = async label => page.screenshot({ path: join(dirname(out), `${edge}-${label}.jpg`), type: 'jpeg', quality: 72 });
      await shot('road');
      const drive = async (name, from, to, distance) => {
        report.stage = `${edge}:${name}`; save();
        const plan = { name: `${edge}-${name}`, from, to, movement: 'road-hover',
          waypoints: [{ x: ox + normal[0] * distance, z: oz + normal[1] * distance }],
          requiredResidents: to === null ? [] : [cell.instance] };
        const result = await runFloorGridRoute(page, plan, row.document);
        row.routes.push(result);
        const failures = gridFloorWitnessFailures(result);
        if (failures.length !== 0) throw new Error(failures.join('; '));
        await page.waitForTimeout(1500);
        const reading = await snapshot(page);
        const unlabelledBytes = reading.gl.flatMap(context => context.resources).filter(resource => !resource.labelled).reduce((sum, resource) => sum + resource.bytes, 0);
        if (!reading.gl.every(context => context.reconciled) || unlabelledBytes !== 0) throw new Error('Unreconciled or unlabelled GL at route stop');
        row.snapshots.push({ label: name, ...reading }); save();
        await shot(name);
        return reading;
      };
      // The original native terrain stays flat through the authored 15 m entry footprint and onward to this playable pose.
      const entered = await drive('entry', null, cell.instance, 210);
      await drive('road-return', cell.instance, null, 277.5);
      const reentered = await drive('reentry', null, cell.instance, 210);
      row.authoredIdentityPreserved = JSON.stringify(entered.actors?.map(actor => actor.id).sort()) === JSON.stringify(reentered.actors?.map(actor => actor.id).sort());
      row.enteredActorsPresent = entered.actors?.length > 0 && reentered.actors?.length === entered.actors.length;
      row.orchid = entered.accent?.toLowerCase() === '#e989e1' && reentered.accent?.toLowerCase() === '#e989e1';
      row.warmBandPresent = entered.presentation.bands.some(band => band.visible && band.colour.every((value, index) => Math.abs(value - [0.95, 0.45, 0.1][index]) < 1e-6));
      row.recoveries = await page.evaluate(() => window.__sf50Recoveries);
      row.leak = await page.evaluate(() => window.__wildshard.leak());
      row.finalGL = await page.evaluate(() => window.__sc_gl().map(({ gl, ...row }) => row));
      row.edgeFallbacks = row.warnings.filter(message => /edges stay at road level|platform keeps road-level edges|edge.*fallback|fallback.*edge/iu.test(message));
      row.pass = row.edgeFallbacks.length === 0 && row.recoveries.length === 0 && row.authoredIdentityPreserved && row.enteredActorsPresent && row.orchid && row.warmBandPresent
        && row.errors.length === 0 && row.consoleErrors.length === 0 && row.documents.length === row.bootDocuments
        && row.leak.disposalErrors.length === 0 && row.leak.after.bodies === 0 && row.leak.after.colliders === 0
        && Object.values(row.leak.scope).every(count => count === 0);
      save(); console.log(JSON.stringify({ edge, pass: row.pass, errors: row.errors, consoleErrors: row.consoleErrors, playingMB: reentered.state.playingMB }));
      if (!row.pass) throw new Error('Entry/return/reentry/unload conjunction failed');
    } catch (error) {
      row.failure = String(error.stack ?? error); row.pass = false;
      row.last = await page.evaluate(() => ({ state: window.__wildshard?.shard?.grid?.state(), body: document.body.innerText.slice(-8000), url: location.href })).catch(() => null);
      row.recoveries = await page.evaluate(() => window.__sf50Recoveries).catch(() => null);
      row.failedLeak = await page.evaluate(() => window.__wildshard?.leak()).catch(error => String(error));
      save(); throw error;
    } finally { await context.close(); row.closed = true; save(); }
  }
  report.pass = report.entries.length === (only ? 1 : 4) && report.entries.every(row => row.pass);
} catch (error) { report.failure = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
finally { await browser.close(); report.closed = true; report.seconds = (Date.now() - started) / 1000; save(); console.log(JSON.stringify({ pass: report.pass, failure: report.failure, seconds: report.seconds })); }
