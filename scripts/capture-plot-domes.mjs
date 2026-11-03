// Shared G726/OP4 capture: scripts/browser-lane.sh --max 30 node scripts/capture-night-market-domes.mjs --base=URL --pin=SHA --out=DIR [--milestone=RM2|RM3|END] [--domes=A1,A2,D1,D2] [--clip=<view>]
// Existing free camera only: no forced tile residency, changed world visibility, lens defaults, fog or far plane.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { devices } from 'playwright';
import { createHash } from 'node:crypto';
import { readCapturePlans, ringJunctionPlan, selectDomeViews } from './open-plots/capture-inputs.mjs';
import { makeDomeBoards } from './open-plots/boards.mjs';
import { settledDomeReadExpression } from './open-plots/settled-read.mjs';
import { launchMemoryBrowser } from './chromium-memory-browser.mjs';
import { saveFixture, harnessPins } from './debug-settings.mjs';
import { domeGroundAnchor, domeWorldCamera, assertDomeAnchorReady, domeResidencySettled } from './dome-cameras.mjs';
import { frameFloorSettingsCode } from './frame-floor-settings.mjs';
import { FLOOR_GRID_ENTER, floorGridBenchmarkUrl } from './frame-floor-navigation.mjs';
import { gridFloorPlans, gridFloorDeclaredPlan, gridFloorDocumentIdentity, stageFloorGrid, driveFloorGrid, gridFloorWitnessFailures, floorGridEntryRoute } from './frame-floor-grid.mjs';
import { chromiumProcessPeaks, ownedResidencyBytes } from './grid-ready-memory.mjs';

/** One browser, any ordered list of plots. Every dome still earns its own normal grid entry.
 * @param {{base:string,pin:string,out:string,targets:readonly import('./open-plots/capture-inputs.mjs').CapturePlot[],milestone?:'RM2'|'RM3'|'END'|'OP4',domes?:readonly string[],viewSelection?:Readonly<Record<string,readonly number[]>>,clip?:number,flatOutput?:boolean,junction?:{x:number,z:number}} options */
export async function capturePlotDomes(options) {
const {base, pin, out, targets, milestone = 'OP4', domes = ['A1','A2','B1','B2','C1','C2','D1','D2'], clip = 0, flatOutput = false} = options;
if (!base || !/^[a-f0-9]{40}$/u.test(pin) || !out || targets.length === 0) throw new Error('Requires base, full pin, out and plots');
if (!['RM2', 'RM3', 'END', 'OP4'].includes(milestone)) throw new Error('Invalid dome milestone');
if (options.junction !== undefined && (!Number.isInteger(options.junction.x-0.5) || !Number.isInteger(options.junction.z-0.5))) throw new Error('Invalid road junction lattice');
if (!Number.isInteger(clip) || clip < 0 || clip > 9) throw new Error('Invalid clip view');
if (new Set(targets.map(row => row.slug)).size !== targets.length || new Set(targets.map(row => row.instance)).size !== targets.length) throw new Error('Duplicate capture target');
const admitted = targets.map(target => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(target.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(target.instance)) throw new Error('Invalid capture identity');
  if (flatOutput && targets.length !== 1) throw new Error('Flat capture output needs one target');
  const folder = flatOutput ? out : join(out, target.slug);
  if (existsSync(join(folder, 'capture.json')) || (!flatOutput && existsSync(folder))) throw new Error(`Capture output already exists: ${folder}`);
  return {target, folder, plans: readCapturePlans(target, domes, process.cwd(), pin).map(manifest => ({
    cameras: manifest.cameras, file: manifest.file, sha256: manifest.sha256,
    selectedViews: selectDomeViews(manifest.cameras, options.viewSelection?.[`${target.slug}/${manifest.cameras.dome.slice(0,2)}`]),
  }))};
});
const keys = new Set(admitted.flatMap(({target,plans}) => plans.map(plan => `${target.slug}/${plan.cameras.dome.slice(0,2)}`)));
if (Object.keys(options.viewSelection ?? {}).some(key => !keys.has(key))) throw new Error('Unknown capture view selection');
const label = milestone === 'RM2' ? 'RM2 BASELINE' : milestone === 'RM3' ? 'RM3 KIT PARITY' : milestone === 'END' ? 'PLAN-END READING' : 'OP4 BATCH';
const version = await (await fetch(new URL('/version.json', base))).json();
if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served SHA differs');
mkdirSync(out, { recursive: true });
const batch = {source: pin, version, requestedDomes: domes, viewSelection: options.viewSelection ?? null,
  completionScope: options.viewSelection === undefined ? 'all-nine-views' : 'requested-view-selection', complete: false, plots: []};
const saveBatch = () => writeFileSync(join(out, 'batch.json'), JSON.stringify(batch, null, 2));
saveBatch();
function noQuiet() { if (existsSync('.git/quiet')) throw new Error('Official Simulator quiet is active; capture refuses'); }
noQuiet();
const memoryBrowser = await launchMemoryBrowser(['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist']);
const { browser } = memoryBrowser;
try {
  const session = await browser.newBrowserCDPSession();
  for (const {target, folder: plotFolder, plans} of admitted) {
  const {instance, slug} = target;
  const report = { source: pin, version, slug, instance, milestone, protocol: {
    device: 'iPhone 16 Pro', tier: 'phone', renderScale: 2, viewport: [402, 603], horizontalFov: 62,
    framing: '2:3 portrait dome viewport; exact committed eye/look, physical anchor at its ground projection',
    scene: 'Shipping tiles and LOD; normal grid entry and physical anchor; camera override leaves normal streaming live',
    counts: '120 live drawn frames per view, whole composer calls/triangles; descriptive camera reading, no frame-floor acceptance',
    memory: 'Effective plot residency claims per view; separate page-wide Chromium CDP private-footprint sample after each dome; no forced GC',
  }, domes: [] };
  mkdirSync(plotFolder, {recursive: true});
  const save = () => writeFileSync(join(plotFolder, 'capture.json'), JSON.stringify(report, null, 2));
  save();
  const plotReceipt = {slug, instance, cameras: target.cameras, report: flatOutput ? 'capture.json' : join(slug, 'capture.json'), complete: false};
  batch.plots.push(plotReceipt); saveBatch();
  for (const manifest of plans) {
    const plan = manifest.cameras;
    noQuiet();
    const folder = join(plotFolder, plan.dome); mkdirSync(folder, { recursive: true });
    const { defaultBrowserType: _browserType, ...phone } = devices['iPhone 16 Pro'];
    const context = await browser.newContext({ ...phone, viewport: { width: 402, height: 603 } });
    const row = { dome: plan.dome, cameras: plan, cameraFile: manifest.file, cameraSha256: manifest.sha256,
      requestedViews: manifest.selectedViews.map(view => view.n), complete: false, errors: [], views: [] };
    report.domes.push(row); save();
    try {
      await context.addInitScript({ content: frameFloorSettingsCode({ tier: 'phone', fps: 'auto' }) });
      await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
      await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
      await harnessPins(context, { seed: 357, browser: 'Chromium / iPhone 16 Pro', lane: 'open-plots-domes' });
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
      if (market?.slug !== slug) throw new Error(`Requested cell is not ${slug}`);
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
      assertDomeAnchorReady((await settledCaptureState(page, (_argument, grid) => grid, null)).state, anchor);
      await page.evaluate(async at => {
        const api = window.__wildshard, world = api.requireWorld(), live = api.shard.grid.state().live.live;
        await api.pose({ x: at.x - (live.worldFeet.x - world.player.position.x), z: at.z - (live.worldFeet.z - world.player.position.z), yaw: 0, pitch: 0 });
      }, anchor);
      assertDomeAnchorReady((await settledCaptureState(page, (_argument, grid) => grid, null)).state, anchor);
      await page.evaluate(installDomeCamera);
      await page.addStyleTag({ content: 'body *{visibility:hidden!important}canvas[data-dome-canvas],#dome-caption{visibility:visible!important}#dome-caption{position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#071521e8;color:white;padding:7px;font:11px sans-serif;text-align:center;pointer-events:none}' });
      const origin = { x: market.cell[0] * (initial.pitch ?? 555), z: market.cell[1] * (initial.pitch ?? 555) };
      for (const view of manifest.selectedViews) {
        noQuiet();
        const camera = domeWorldCamera(view, origin, 2 / 3);
        await page.evaluate(pose => { window.__plotDome = pose; }, camera);
        await page.waitForTimeout(2000);
        const beforeSample = await waitForDomeResidency(page);
        const sample = await page.evaluate(sampleDomeFrames);
        const {state, wait:beforeImage} = await settledCaptureState(page, ({ownInstance, ownSlug}, grid) => {
          const api = window.__wildshard, world = api.requireWorld();
          const live = grid.live.live, renderOrigin = grid.live.renderOrigin, position = world.game.camera.position;
          const dx = live.worldFeet.x - world.player.position.x - renderOrigin.x, dz = live.worldFeet.z - world.player.position.z - renderOrigin.z;
          return { grid, claims: api.shard.grid.residency().claims.filter(claim => claim.owner === ownInstance || claim.id === `product:grid:${ownSlug}`), frame: world.game.frameCount,
            renderScale: world.game.renderer.getPixelRatio(), tier: api.boot.tier, clock: api.app.clock.mode,
            camera: { world: [position.x + dx, position.y, position.z + dz], fov: world.game.camera.fov, aspect: world.game.camera.aspect, far: world.game.camera.far },
            contextLost: world.game.renderer.getContext().isContextLost() };
        }, {ownInstance: instance, ownSlug: slug});
        const current = await page.evaluate(gridFloorDocumentIdentity);
        if (current.token !== identity.token || state.contextLost || row.errors.length > 0) throw new Error('Capture document/context failed');
        if (state.renderScale !== 2 || state.tier !== 'phone' || state.clock !== 'live') throw new Error('Phone profile changed');
        if (state.camera.world.some((word, index) => Math.abs(word - camera.eye[index]) > 1e-4)
          || Math.abs(state.camera.fov - camera.fov) > 1e-4 || Math.abs(state.camera.aspect - 2 / 3) > 1e-6) throw new Error('Dome camera framing changed');
        try { assertDomeAnchorReady(state.grid, anchor); }
        catch (error) { row.refusal = {phase:'post-sample-anchor',view:view.n,sample,state,document:current}; save(); throw error; }
        if (Math.hypot(state.grid.live.live.worldFeet.x - anchor.x, state.grid.live.live.worldFeet.z - anchor.z) > 0.5) throw new Error('Physical dome streaming anchor drifted');
        const ownBytes = ownedResidencyBytes(state.claims, instance, market.slug);
        if (ownBytes <= 0) throw new Error(`Missing ${slug} residency claims`);
        await page.evaluate(text => { document.querySelector('#dome-caption').textContent = text; },
          `${label} · ${slug} · ${plan.dome} · ${view.n} ${view.name} · ${pin.slice(0, 7)}\n${sample.maxCalls} draws · ${sample.maxTriangles} tris · ${(ownBytes / 1048576).toFixed(1)} MiB claims`);
        await page.screenshot({ path: join(folder, `view-${view.n}.jpg`), type: 'jpeg', quality: 74, scale: 'css' });
        row.views.push({ n: view.n, name: view.name, requestedCamera: camera, sample, settledWaits: {beforeSample,beforeImage}, state, ownedResidencyBytes: ownBytes,
          imageSha256: createHash('sha256').update(readFileSync(join(folder, `view-${view.n}.jpg`))).digest('hex') });
        if (view.n === clip) for (let k = 0; k < 10; k++) {
          await page.waitForTimeout(500);
          await page.screenshot({ path: join(folder, `clip-${view.n}-${String(k)}.jpg`), type: 'jpeg', quality: 74, scale: 'css' });
        }
        save();
      }
      row.pageProcessBytes = await processMemory(session);
      row.complete = row.views.length === manifest.selectedViews.length;
      row.fullNineViews = row.views.length === 9; save();
      console.info(JSON.stringify({ dome: row.dome, complete: row.complete, pageProcessBytes: row.pageProcessBytes,
        maxCalls: Math.max(...row.views.map(view => view.sample.maxCalls)), maxTriangles: Math.max(...row.views.map(view => view.sample.maxTriangles)) }));
    } catch (error) { row.errors.push(String(error)); save(); throw error; }
    finally { await context.close(); }
  }
  // A selected subset completes only its requested scope. The existing board
  // admission still refuses anything except all nine ordered, hash-bound views.
  if (plans.every(plan => plan.selectedViews.length === 9)) await makeDomeBoards(plotFolder);
  else { report.boardsDeferred = true; save(); }
  plotReceipt.complete = true; saveBatch();
  }
  if (options.junction !== undefined) batch.junction = await captureRingJunction(browser, session, {base, pin, out, lattice: options.junction}, noQuiet);
  batch.complete = true; saveBatch();
  return batch;
} finally { await memoryBrowser.close(); }
}

/** Four fixed views from one real ring junction; coverage is explicit, never a fictitious one-frame panorama. */
async function captureRingJunction(browser, session, options, noQuiet) {
  noQuiet();
  const {base, pin, out, lattice} = options;
  const folder = join(out, 'junction'); mkdirSync(folder, {recursive:true});
  const report = {source:pin, lattice, complete:false, protocol:'One road anchor; four fixed 62-degree horizontal views at actual standing eye height. Shipping rings, no forced residency. All-neighbour coverage is across these views, not all four in one frame.', errors:[], views:[]};
  const save = () => writeFileSync(join(folder, 'junction.json'), JSON.stringify(report, null, 2)); save();
  const {defaultBrowserType:_browserType, ...phone} = devices['iPhone 16 Pro'];
  const context = await browser.newContext({...phone, viewport:{width:402,height:603}});
  try {
    await context.addInitScript({content:frameFloorSettingsCode({tier:'phone',fps:'auto'})});
    await saveFixture(context, {scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
    await saveFixture(context, {scope:'device',key:'devMode',data:true});
    await harnessPins(context, {seed:357,browser:'Chromium / iPhone 16 Pro',lane:'open-plots-junction'});
    const page = await context.newPage(); page.setDefaultTimeout(180000);
    page.on('pageerror', error => {report.errors.push(error.message);});
    await page.goto(floorGridBenchmarkUrl(base), {waitUntil:'load'});
    await page.locator('.ws-main-grid').click();
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live?.gameplayReady, undefined, {timeout:240000});
    await page.evaluate(FLOOR_GRID_ENTER);
    await page.waitForFunction(() => !document.querySelector('#hud')?.classList.contains('ws-grid-revealing'));
    const initial = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const {anchor, neighbours} = ringJunctionPlan(initial, lattice);
    report.anchor = anchor; report.neighbours = neighbours;
    const identity = await page.evaluate(gridFloorDocumentIdentity);
    const seed = {name:'open-plots-ring-junction',from:null,to:null,start:anchor,waypoints:[],requiredResidents:[]};
    await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify(seed)},${JSON.stringify(identity)},(${driveFloorGrid.toString()}))`);
    assertDomeAnchorReady((await settledCaptureState(page, (_argument, grid) => grid, null)).state, anchor);
    const height = await page.evaluate(() => window.__wildshard.requireWorld().game.camera.position.y);
    await page.evaluate(installDomeCamera);
    await page.addStyleTag({content:'body *{visibility:hidden!important}canvas[data-dome-canvas],#dome-caption{visibility:visible!important}#dome-caption{position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#071521e8;color:white;padding:7px;font:11px sans-serif;text-align:center;pointer-events:none}'});
    for (const neighbour of neighbours) {
      noQuiet();
      const pitch = initial.pitch ?? 555;
      const view = {n:1,name:neighbour.instance,eye:[anchor.x,height,anchor.z],look:[neighbour.cell[0]*pitch,height,neighbour.cell[1]*pitch],yaw:0,pitch:0,hfov:62};
      const camera = domeWorldCamera(view, {x:0,z:0}, 2/3);
      await page.evaluate(pose => {window.__plotDome = pose;}, camera);
      await page.waitForTimeout(2000);
      const beforeSample = await waitForDomeResidency(page);
      const sample = await page.evaluate(sampleDomeFrames);
      const {state, wait:beforeImage} = await settledCaptureState(page, ({target, neighbours:targets, pitch:latticePitch}, grid) => {
        const api = window.__wildshard, world = api.requireWorld(), renderedCamera = world.game.camera;
        const live = grid.live.live, origin = grid.live.renderOrigin;
        const dx = live.worldFeet.x - world.player.position.x - origin.x, dz = live.worldFeet.z - world.player.position.z - origin.z;
        // Project the declared cell centre through the actual unchanged camera matrices.
        const point = renderedCamera.position.clone().set(target.cell[0]*latticePitch-dx, renderedCamera.position.y, target.cell[1]*latticePitch-dz).project(renderedCamera);
        const coverage = targets.map(cellTarget => {
          const centre = renderedCamera.position.clone().set(cellTarget.cell[0]*latticePitch-dx,renderedCamera.position.y,cellTarget.cell[1]*latticePitch-dz).project(renderedCamera);
          const cell = grid.cells.find(row => row.instance === cellTarget.instance), drawn = cell?.drawn;
          return {instance:cellTarget.instance,drawn,centreNdc:[centre.x,centre.y,centre.z],centreInFrustum:Math.abs(centre.x)<=1 && Math.abs(centre.y)<=1 && centre.z>=-1 && centre.z<=1,
            drawnLayer:drawn !== undefined && (drawn.far === true || drawn.near === true || drawn.l1+drawn.l0>0)};
        });
        return {grid, coverage, claims:api.shard.grid.residency().claims, cell:grid.cells.find(row => row.instance === target.instance),
          centreNdc:[point.x,point.y,point.z], centreInFrustum:Math.abs(point.x)<=1 && Math.abs(point.y)<=1 && point.z>=-1 && point.z<=1,
          renderScale:world.game.renderer.getPixelRatio(),tier:api.boot.tier,clock:api.app.clock.mode,
          camera:{world:[renderedCamera.position.x+dx,renderedCamera.position.y,renderedCamera.position.z+dz],fov:renderedCamera.fov,aspect:renderedCamera.aspect,far:renderedCamera.far},
          contextLost:world.game.renderer.getContext().isContextLost()};
      }, {target:neighbour,neighbours,pitch});
      const current = await page.evaluate(gridFloorDocumentIdentity);
      if (current.token !== identity.token || state.contextLost || report.errors.length > 0) throw new Error('Junction document/context failed');
      if (state.renderScale !== 2 || state.tier !== 'phone' || state.clock !== 'live') throw new Error('Junction phone profile changed');
      if (state.camera.world.some((word,index) => Math.abs(word-camera.eye[index])>1e-4) || Math.abs(state.camera.fov-camera.fov)>1e-4 || Math.abs(state.camera.aspect-2/3)>1e-6) throw new Error('Junction camera framing changed');
      assertDomeAnchorReady(state.grid, anchor);
      if (Math.hypot(state.grid.live.live.worldFeet.x-anchor.x,state.grid.live.live.worldFeet.z-anchor.z)>0.5) throw new Error('Junction physical anchor drifted');
      const drawn = state.cell?.drawn;
      if (drawn === undefined || !(drawn.far === true || drawn.near === true || drawn.l1+drawn.l0>0) || !state.centreInFrustum) throw new Error(`Junction neighbour lacks drawn-layer/frustum witness: ${neighbour.instance}`);
      const ownBytes = ownedResidencyBytes(state.claims, neighbour.instance, neighbour.slug);
      if (ownBytes <= 0) throw new Error(`Junction neighbour lacks residency: ${neighbour.instance}`);
      await page.evaluate(text => {document.querySelector('#dome-caption').textContent=text;}, `OP4 JUNCTION · ${neighbour.instance} · ${pin.slice(0,7)} · 62° HFOV · phone 2×`);
      const file = join(folder, `${neighbour.instance}.jpg`);
      await page.screenshot({path:file,type:'jpeg',quality:74,scale:'css'});
      report.views.push({instance:neighbour.instance,requestedCamera:camera,sample,settledWaits:{beforeSample,beforeImage},state,ownedResidencyBytes:ownBytes,imageSha256:createHash('sha256').update(readFileSync(file)).digest('hex')}); save();
    }
    report.coverage = neighbours.map(neighbour => ({instance:neighbour.instance,covered:report.views.some(view => view.state.coverage.some(row => row.instance === neighbour.instance && row.drawnLayer && row.centreInFrustum))}));
    report.allCentresInOneFrame = report.views.some(view => view.state.coverage.every(row => row.drawnLayer && row.centreInFrustum));
    if (report.coverage.some(row => !row.covered)) throw new Error('Incomplete junction neighbour coverage');
    report.pageProcessBytes = await processMemory(session);
    report.complete = report.views.length === 4; save();
    return report;
  } catch(error) {report.errors.push(String(error));save();throw error;}
  finally {await context.close();}
}

/** Use the existing 180-second readiness bound; samples retain their separate 15-second cap. */
async function waitForDomeResidency(page) {
  const start = Date.now();
  const ready = await page.waitForFunction(`(${domeResidencySettled.toString()})(window.__wildshard.shard.grid.state())`, undefined, {timeout:180000});
  await ready.dispose();
  return {wallMs:Date.now()-start,pending:[],crossing:'settled',inFlight:0,queued:0};
}

/** The returned state is the actual snapshot that passed readiness, not a later CDP read. */
export async function settledCaptureState(page, reader, argument) {
  const start = Date.now();
  const ready = await page.waitForFunction(settledDomeReadExpression(reader.toString(), argument), undefined, {timeout:180000});
  try { return {state:await ready.jsonValue(),wait:{wallMs:Date.now()-start,pending:[],crossing:'settled',inFlight:0,queued:0}}; }
  finally { await ready.dispose(); }
}

/** Same world-to-render-origin conversion as the existing hero capture; no scene or streamer mutation. */
export function installDomeCamera() {
  const api = window.__wildshard, world = api.requireWorld();
  world.freeCamera = true; world.player.keys.clear(); world.game.viewmodel.visible = false;
  world.game.renderer.domElement.dataset.domeCanvas = 'true';
  const caption = document.createElement('div'); caption.id = 'dome-caption'; document.body.append(caption);
  world.game.onLate(() => {
    const pose = window.__plotDome;
    if (pose === undefined) return;
    const state = api.shard.grid.state(), live = state.live.live, origin = state.live.renderOrigin;
    const dx = live.worldFeet.x - world.player.position.x - origin.x, dz = live.worldFeet.z - world.player.position.z - origin.z;
    const camera = world.game.camera;
    camera.position.set(pose.eye[0] - dx, pose.eye[1], pose.eye[2] - dz);
    camera.lookAt(pose.look[0] - dx, pose.look[1], pose.look[2] - dz);
    if (Math.abs(camera.fov - pose.fov) > 1e-6) { camera.fov = pose.fov; camera.updateProjectionMatrix(); world.sky.csm.updateFrustums(); }
    camera.updateMatrixWorld(true); world.game.viewmodel.visible = false;
  }, 'harness.plot-dome');
}

/** Observe completed real draws; never adds a render or a fixed step to manufacture a budget result. */
export async function sampleDomeFrames() {
  const game = window.__wildshard.requireWorld().game, start = performance.now(), rows = [];
  let previous = game.frameCount;
  while (rows.length < 120) {
    await new Promise(resolve => { requestAnimationFrame(resolve); });
    if (performance.now() - start > 15000) throw new Error('Dome did not draw 120 frames');
    if (game.frameCount === previous) continue;
    previous = game.frameCount;
    rows.push({ frame: previous, at: game.frameRafTime, calls: game.lastFrame.calls, triangles: game.lastFrame.triangles });
  }
  const intervals = rows.slice(1).map((row,index) => row.at-rows[index].at);
  if (intervals.some(delta => !Number.isFinite(delta) || delta <= 0)) throw new Error('Dome drawn-frame clock is not increasing');
  const sorted = [...intervals].sort((a,b) => a-b);
  return { rows, meanFps:1000*intervals.length/intervals.reduce((sum,delta) => sum+delta,0), p95FrameMs:sorted[Math.ceil(sorted.length*0.95)-1], maxCalls: Math.max(...rows.map(row => row.calls)), maxTriangles: Math.max(...rows.map(row => row.triangles)) };
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
