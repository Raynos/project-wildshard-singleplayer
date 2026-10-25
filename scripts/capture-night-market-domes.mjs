#!/usr/bin/env node
// G726 RM2: scripts/browser-lane.sh --max 30 node scripts/capture-night-market-domes.mjs --base=URL --pin=SHA --out=DIR
// Existing free camera only: no forced tile residency, changed world visibility, lens defaults, fog or far plane.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { devices } from 'playwright';
import sharp from 'sharp';
import { launchMemoryBrowser } from './chromium-memory-browser.mjs';
import { saveFixture, harnessPins } from './debug-settings.mjs';
import { parseDomeCameras, domeGroundAnchor, domeWorldCamera, assertDomeAnchorReady } from './dome-cameras.mjs';
import { frameFloorSettingsCode } from './frame-floor-settings.mjs';
import { FLOOR_GRID_ENTER, floorGridBenchmarkUrl } from './frame-floor-navigation.mjs';
import { gridFloorPlans, gridFloorDeclaredPlan, gridFloorDocumentIdentity, stageFloorGrid, driveFloorGrid, gridFloorWitnessFailures, floorGridEntryRoute } from './frame-floor-grid.mjs';
import { chromiumProcessPeaks, ownedResidencyBytes } from './grid-ready-memory.mjs';

const argument = (name, fallback = '') => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = argument('base'), pin = argument('pin'), out = argument('out'), instance = argument('instance', 'open-plot-nw');
if (!base || !/^[a-f0-9]{40}$/u.test(pin) || !out) throw new Error('Requires --base, full --pin and --out');
const selected = argument('domes', 'A1,A2,D1,D2').split(',');
if (selected.some(value => !/^[A-D][12]$/u.test(value)) || new Set(selected).size !== selected.length) throw new Error('Invalid dome selection');
const source = resolvePath('art/grid/round-63-night-market-domes');
const plans = readdirSync(source, { withFileTypes: true }).filter(row => row.isDirectory()).map(row =>
  parseDomeCameras(JSON.parse(readFileSync(join(source, row.name, 'cameras.json'), 'utf8'))))
  .filter(plan => selected.includes(plan.dome.slice(0, 2)));
if (plans.length !== selected.length) throw new Error('Missing committed dome manifest');
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served SHA differs');
const report = { source: pin, version, instance, protocol: {
  device: 'iPhone 16 Pro', tier: 'phone', renderScale: 2, viewport: [402, 603], horizontalFov: 62,
  framing: '2:3 portrait dome viewport; exact committed eye/look, physical anchor at its ground projection',
  scene: 'Shipping tiles and LOD; normal grid entry before an in-cell pose; existing freeCamera suspends fixed gameplay',
  counts: '120 live drawn frames per view, whole composer calls/triangles; descriptive camera baseline, no frame-floor acceptance',
  memory: 'Effective Night Market residency claims per view; separate page-wide Chromium CDP private-footprint sample after each dome; no forced GC',
}, domes: [] };
mkdirSync(out, { recursive: true });
const save = () => writeFileSync(join(out, 'capture.json'), JSON.stringify(report, null, 2));
function noQuiet() { if (existsSync('.git/quiet')) throw new Error('Official Simulator quiet is active; capture refuses'); }
noQuiet();
const memoryBrowser = await launchMemoryBrowser(['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist']);
const { browser } = memoryBrowser;
try {
  const session = await browser.newBrowserCDPSession();
  for (const plan of plans) {
    noQuiet();
    const folder = join(out, plan.dome); mkdirSync(folder, { recursive: true });
    const { defaultBrowserType: _browserType, ...phone } = devices['iPhone 16 Pro'];
    const context = await browser.newContext({ ...phone, viewport: { width: 402, height: 603 } });
    const row = { dome: plan.dome, cameras: plan, complete: false, errors: [], views: [] };
    report.domes.push(row); save();
    try {
      await context.addInitScript({ content: frameFloorSettingsCode({ tier: 'phone', fps: 'auto' }) });
      await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
      await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
      await harnessPins(context, { seed: 357, browser: 'Chromium / iPhone 16 Pro', lane: 'sp-x6-night-market-domes' });
      const page = await context.newPage();
      page.on('pageerror', error => { row.errors.push(error.message); });
      page.setDefaultTimeout(180000);
      await page.goto(floorGridBenchmarkUrl(base), { waitUntil: 'load' });
      await page.locator('.ws-main-grid').click();
      await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady, undefined, { timeout: 240000 });
      await page.evaluate(FLOOR_GRID_ENTER);
      await page.waitForFunction(() => !document.querySelector('#hud')?.classList.contains('ws-grid-revealing'));
      const initial = await page.evaluate(() => window.__wildshard.shard.grid.state());
      const market = initial.cells.find(cell => cell.instance === instance);
      if (market?.slug !== 'open-plot-night-market') throw new Error('Requested cell is not Night Market');
      const anchor = domeGroundAnchor(plan, initial, instance), identity = await page.evaluate(gridFloorDocumentIdentity);
      row.anchor = anchor;
      row.route = [];
      if (anchor.instance === null) {
        const seed = { name: `${plan.dome}-road-anchor`, from: null, to: null, start: anchor, waypoints: [], requiredResidents: [] };
        await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(seed)},${JSON.stringify(identity)},(${driveFloorGrid.toString()}))`);
      } else {
        const route = floorGridEntryRoute(gridFloorPlans(initial, 'cell', { cell: anchor.instance, roadApproach: true }), anchor.instance);
        for (const candidate of [...route.setup, route.entry]) {
          const current = await page.evaluate(() => window.__wildshard.shard.grid.state());
          const entry = await gridFloorDeclaredPlan(page, current, candidate);
          await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)},(${driveFloorGrid.toString()}))`);
          const witness = await page.evaluate(`(${driveFloorGrid.toString()})(${JSON.stringify(entry)},${JSON.stringify(identity)})`);
          row.route.push(witness);
          const failures = gridFloorWitnessFailures(witness);
          if (failures.length > 0) throw new Error(failures.join('; '));
        }
      }
      await page.waitForFunction(() => {
        const state = window.__wildshard.shard.grid.state();
        return state.live.live.pending.length === 0 && state.live.crossing.phase === 'settled';
      });
      assertDomeAnchorReady(await page.evaluate(() => window.__wildshard.shard.grid.state()), anchor);
      await page.evaluate(async at => {
        const api = window.__wildshard, world = api.requireWorld(), live = api.shard.grid.state().live.live;
        await api.pose({ x: at.x - (live.worldFeet.x - world.player.position.x), z: at.z - (live.worldFeet.z - world.player.position.z), yaw: 0, pitch: 0 });
      }, anchor);
      await page.waitForFunction(() => {
        const state = window.__wildshard.shard.grid.state();
        return state.live.live.gameplayReady && state.live.crossing.phase === 'settled' && state.rings.inFlight === 0 && state.rings.queued === 0;
      });
      assertDomeAnchorReady(await page.evaluate(() => window.__wildshard.shard.grid.state()), anchor);
      await page.evaluate(installDomeCamera);
      await page.addStyleTag({ content: 'body *{visibility:hidden!important}canvas[data-dome-canvas],#dome-caption{visibility:visible!important}#dome-caption{position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#071521e8;color:white;padding:7px;font:11px sans-serif;text-align:center;pointer-events:none}' });
      const origin = { x: market.cell[0] * (initial.pitch ?? 555), z: market.cell[1] * (initial.pitch ?? 555) };
      for (const view of plan.views) {
        noQuiet();
        const camera = domeWorldCamera(view, origin, 2 / 3);
        await page.evaluate(pose => { window.__nightMarketDome = pose; }, camera);
        await page.waitForTimeout(2000);
        const sample = await page.evaluate(sampleDomeFrames);
        const state = await page.evaluate(ownInstance => {
          const api = window.__wildshard, world = api.requireWorld(), grid = api.shard.grid.state();
          const live = grid.live.live, renderOrigin = grid.live.renderOrigin, position = world.game.camera.position;
          const dx = live.worldFeet.x - world.player.position.x - renderOrigin.x, dz = live.worldFeet.z - world.player.position.z - renderOrigin.z;
          return { grid, claims: api.shard.grid.residency().claims.filter(claim => claim.owner === ownInstance || claim.id === 'product:grid:open-plot-night-market'), frame: world.game.frameCount,
            renderScale: world.game.renderer.getPixelRatio(), tier: api.boot.tier, clock: api.app.clock.mode,
            camera: { world: [position.x + dx, position.y, position.z + dz], fov: world.game.camera.fov, aspect: world.game.camera.aspect, far: world.game.camera.far },
            contextLost: world.game.renderer.getContext().isContextLost() };
        }, instance);
        const current = await page.evaluate(gridFloorDocumentIdentity);
        if (current.token !== identity.token || state.contextLost || row.errors.length > 0) throw new Error('Capture document/context failed');
        if (state.renderScale !== 2 || state.tier !== 'phone' || state.clock !== 'live') throw new Error('Phone profile changed');
        if (state.camera.world.some((word, index) => Math.abs(word - camera.eye[index]) > 1e-4)
          || Math.abs(state.camera.fov - camera.fov) > 1e-4 || Math.abs(state.camera.aspect - 2 / 3) > 1e-6) throw new Error('Dome camera framing changed');
        assertDomeAnchorReady(state.grid, anchor);
        if (Math.hypot(state.grid.live.live.worldFeet.x - anchor.x, state.grid.live.live.worldFeet.z - anchor.z) > 0.5) throw new Error('Physical dome streaming anchor drifted');
        const ownBytes = ownedResidencyBytes(state.claims, instance, market.slug);
        if (ownBytes <= 0) throw new Error('Missing Night Market residency claims');
        row.views.push({ n: view.n, name: view.name, requestedCamera: camera, sample, state, ownedResidencyBytes: ownBytes });
        await page.evaluate(text => { document.querySelector('#dome-caption').textContent = text; },
          `${plan.dome} · ${view.n} ${view.name} · ${pin.slice(0, 7)}\n${sample.maxCalls} draws · ${sample.maxTriangles} tris · ${(ownBytes / 1048576).toFixed(1)} MiB claims`);
        await page.screenshot({ path: join(folder, `view-${view.n}.jpg`), type: 'jpeg', quality: 74, scale: 'css' });
        save();
      }
      row.pageProcessBytes = await processMemory(session);
      await sharp({ create: { width: 1206, height: 1809, channels: 3, background: '#071521' } }).composite(plan.views.map(view => ({
        input: join(folder, `view-${view.n}.jpg`), left: ((view.n - 1) % 3) * 402, top: Math.floor((view.n - 1) / 3) * 603,
      }))).jpeg({ quality: 72 }).toFile(join(folder, 'sheet-baseline-3x3.jpg'));
      row.complete = true; save();
      console.info(JSON.stringify({ dome: row.dome, complete: row.complete, pageProcessBytes: row.pageProcessBytes,
        maxCalls: Math.max(...row.views.map(view => view.sample.maxCalls)), maxTriangles: Math.max(...row.views.map(view => view.sample.maxTriangles)) }));
    } catch (error) { row.errors.push(String(error)); save(); throw error; }
    finally { await context.close(); }
  }
} finally { await memoryBrowser.close(); }

/** Same world-to-render-origin conversion as the existing hero capture; no scene or streamer mutation. */
function installDomeCamera() {
  const api = window.__wildshard, world = api.requireWorld();
  world.freeCamera = true; world.player.keys.clear(); world.game.viewmodel.visible = false;
  world.game.renderer.domElement.dataset.domeCanvas = 'true';
  const caption = document.createElement('div'); caption.id = 'dome-caption'; document.body.append(caption);
  world.game.onLate(() => {
    const pose = window.__nightMarketDome;
    if (pose === undefined) return;
    const state = api.shard.grid.state(), live = state.live.live, origin = state.live.renderOrigin;
    const dx = live.worldFeet.x - world.player.position.x - origin.x, dz = live.worldFeet.z - world.player.position.z - origin.z;
    const camera = world.game.camera;
    camera.position.set(pose.eye[0] - dx, pose.eye[1], pose.eye[2] - dz);
    camera.lookAt(pose.look[0] - dx, pose.look[1], pose.look[2] - dz);
    if (Math.abs(camera.fov - pose.fov) > 1e-6) { camera.fov = pose.fov; camera.updateProjectionMatrix(); world.sky.csm.updateFrustums(); }
    camera.updateMatrixWorld(true); world.game.viewmodel.visible = false;
  }, 'harness.night-market-dome');
}

/** Observe completed real draws; never adds a render or a fixed step to manufacture a budget result. */
async function sampleDomeFrames() {
  const game = window.__wildshard.requireWorld().game, start = performance.now(), rows = [];
  let previous = game.frameCount;
  while (rows.length < 120) {
    await new Promise(resolve => { requestAnimationFrame(resolve); });
    if (performance.now() - start > 15000) throw new Error('Dome did not draw 120 frames');
    if (game.frameCount === previous) continue;
    previous = game.frameCount;
    rows.push({ frame: previous, at: game.frameRafTime, calls: game.lastFrame.calls, triangles: game.lastFrame.triangles });
  }
  return { rows, maxCalls: Math.max(...rows.map(row => row.calls)), maxTriangles: Math.max(...rows.map(row => row.triangles)) };
}

async function processMemory(session) {
  const events = [], collect = event => { events.push(...event.value); };
  session.on('Tracing.dataCollected', collect);
  try {
    await session.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], memoryDumpConfig: { triggers: [] } } });
    const dumped = await session.send('Tracing.requestMemoryDump', { levelOfDetail: 'detailed', deterministic: false });
    const complete = new Promise(resolve => { session.once('Tracing.tracingComplete', resolve); });
    await session.send('Tracing.end'); await complete;
    if (!dumped.success) throw new Error('Dome page-process memory dump failed');
    return chromiumProcessPeaks(events);
  } finally { session.off('Tracing.dataCollected', collect); }
}
