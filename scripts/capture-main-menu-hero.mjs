/** G332: real canvas-only hero candidates; never changes the shipped menu or scene look.
 * node scripts/capture-main-menu-hero.mjs [--round=1|aerial|landscape|square] --out=<scratch directory>
 * --round=landscape (G336 round 3): the five landscapeHeroPlan poses at 2560×1440 and 1920×1080, desktop tier, DSF 1.
 * --round=square (G344): squareHeroPlan at a phone-1x lens, the square poses at 2048×2048 and 1440×1440 and the
 *   landscape ones at 2560×1440 and 1920×1080, desktop tier, DSF 1; each pose's fovDegrees is the capture camera's only.
 * --round=near (G342): the near-tier A / B, raw and unlabelled: Debug Neighbour detail A (far proxy) and B (near
 *   placeholder), four road views from the roundabout to each crossroads cell plus SQ-c, on iPhone 16 Pro portrait and
 *   1920×1080 desktop; files <A|B>-<pose>-<device>.png.
 * --round=near also shoots the shipped hero (round 4's SQ-NA-a, entered with --enter, after the road views). Every
 *   frame records each cell's real tier (grid.state().cells[].shows / drawn: near, far proxy, tiles, playing) and the
 *   near tier's own readout (frame.near), for the labels.
 * --round=5 (G372): round5HeroPlan (above Nalati's centre looking toward Driftwood) with Neighbour detail B on.
 * --round=4 (G343): round4HeroPlan (above Driftwood, Nalati and Pine, aimed across the roundabout; never the template)
 *   with Debug Neighbour detail B (near placeholders) on; the square round's sizes and lenses.
 *   --enter stands the player in the cell under the eye first (enterOver); --only=<ids> / --sessions=<keys> narrow a re-shoot.
 * --tree builds the working tree instead of a clean HEAD export (a change not yet committed, e.g. during a push freeze).
 * Owns one clean --head preview and one muted browser-lane capture, then stops both.
 * Entry and calibrated pose follow progress/shard-platform/look28/capture.mjs.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';
import { gridFloorDocumentIdentity } from './frame-floor-grid.mjs';

const root = resolvePath(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const out = resolvePath(flag('out', join(tmpdir(), `main-menu-hero-${process.pid}`)));
const script = import.meta.filename;
const round = flag('round', '1');
if (!['1', 'aerial', 'landscape', 'square', 'near', '4', '5'].includes(round)) throw new Error('Capture round must be 1, aerial, landscape, square, near, 4 or 5');
const serveOwner = process.env.SERVE_OWNER ?? 'sp-x2-g332';

function requireNoQuiet() {
  const quiet = join(root, '.git/quiet');
  if (!existsSync(quiet)) return;
  const reservation = JSON.parse(readFileSync(quiet, 'utf8'));
  if (reservation.owner === process.env.CAPTURE_QUIET_OWNER && String(reservation.pid) === process.env.CAPTURE_QUIET_PID) return;
  throw new Error(`Capture waits for explicit release: ${JSON.stringify(reservation)}`);
}
function command(program, argv, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, argv, { cwd, env, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; if (program.endsWith('browser-lane.sh')) process.stdout.write(chunk); });
    child.on('error', reject);
    child.on('close', code => { if (code === 0) resolve(stdout.trim()); else reject(new Error(`${program} exited ${code}`)); });
  });
}

async function poseAt(page, pose) {
  // The look28 pose convention: heading = atan2(camera direction.x, direction.z).
  await page.evaluate(async p => {
    const api = window.__wildshard, w = api.requireWorld();
    window.__heroFreeze = (window.__heroFreeze ?? 0) + 1;
    const look = async yaw => {
      await api.pose({ x: p.x, y: p.y, z: p.z, yaw, pitch: p.pitch ?? -0.05 });
      await new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); });
      const direction = w.game.camera.getWorldDirection(w.game.camera.position.clone());
      return Math.atan2(direction.x, direction.z);
    };
    const first = await look(0), second = await look(Math.PI / 2);
    await look((p.heading - first) * (Math.sign(Math.sin(second - first)) || 1));
    const held = w.player.position.clone(), generation = window.__heroFreeze;
    const keepCameraPosition = () => {
      if (window.__heroFreeze !== generation) return;
      w.player.position.copy(held); w.player.velocity.set(0, 0, 0);
      requestAnimationFrame(keepCameraPosition);
    };
    keepCameraPosition();
  }, pose);
}

/** G343: stand the player in the cell the hero eye is over and wait until that shard is the entered, ready runtime with
 *  its own L0 / L1 tiles resident, then detach the camera again. The grid admits a cell by the feet's position (look48's
 *  TELEPORT entry): held above the ground until the cell's own colliders exist, then set down on them. */
async function enterOver(page, over) {
  await page.evaluate(() => { window.__heroAerialPose = null; const w = window.__wildshard.requireWorld(); w.freeCamera = false; w.player.keys.clear(); });
  const place = height => page.evaluate(async ({ stand, y }) => {
    const api = window.__wildshard, w = api.requireWorld(), live = api.shard.grid.state().live.live;
    const offset = { x: live.worldFeet.x - w.player.position.x, z: live.worldFeet.z - w.player.position.z };
    await api.pose({ x: stand.x - offset.x, z: stand.z - offset.z, ...(y === null ? {} : { y }), yaw: 0, pitch: 0 });
  }, { stand: over.stand, y: height });
  // an owned runtime crossing commits onto the neutral road first: from one entered cell, back to the roundabout, then in
  if (await page.evaluate(() => window.__wildshard.shard.grid.state().live.live.current !== null)) {
    await page.evaluate(async c => {
      const api = window.__wildshard, w = api.requireWorld(), live = api.shard.grid.state().live.live;
      await api.pose({ x: c.x - (live.worldFeet.x - w.player.position.x), z: c.z - (live.worldFeet.z - w.player.position.z), y: 0, yaw: 0, pitch: 0 });
    }, over.road);
    await page.waitForFunction(() => window.__wildshard.shard.grid.state().live.live.current === null, null, { timeout: 120000, polling: 250 });
  }
  // held high over the cell (above any of its hills) until its own colliders exist, then set down on them
  await place(300);
  await page.waitForFunction(instance => {
    const s = window.__wildshard.shard.grid.state(), l = s.live.live;
    return l.current === instance && s.inside === instance && l.gameplayReady && l.pending.length === 0 && l.residents.includes(instance);
  }, over.instance, { timeout: 240000, polling: 250 });
  await place(null);
  // Settled: the cell is the entered runtime and no tile is in flight or queued, for three polls in a row
  const handle = await page.waitForFunction(instance => {
    const grid = window.__wildshard.shard.grid, s = grid.state(), claims = grid.residency().claims;
    const own = claims.filter(claim => claim.owner === instance);
    const count = category => own.filter(claim => claim.category === category).length;
    const tiles = { l0: count('l0'), l1: count('l1'), sim: count('sim'), rings: s.rings, ringsReady: s.ringsReady };
    // a cell streaming ring tiles has its own l0 / l1 claims; a runtime that streams itself (Driftwood's) holds its sim
    // claims and draws its own ground, so the witness records the tile counts and requires the entered runtime's sim
    const quiet = s.rings.inFlight === 0 && s.rings.queued === 0 && s.ringsReady && tiles.sim > 0 && s.live.live.current === instance;
    window.__heroSettled = quiet ? (window.__heroSettled ?? 0) + 1 : 0;
    return window.__heroSettled >= 3 ? { instance, current: s.live.live.current, inside: s.inside, feet: s.live.live.worldFeet, tiles } : false;
  }, over.instance, { timeout: 180000, polling: 500 }).catch(async error => {
    const census = await page.evaluate(() => {
      const grid = window.__wildshard.shard.grid, rows = {};
      for (const claim of grid.residency().claims) rows[`${claim.owner}/${claim.category}`] = (rows[`${claim.owner}/${claim.category}`] ?? 0) + 1;
      return { rings: grid.state().rings, ringsReady: grid.state().ringsReady, claims: rows };
    });
    throw new Error(`${over.instance} tiles did not settle: ${JSON.stringify(census)} (${String(error)})`);
  });
  const witness = await handle.jsonValue();
  await page.evaluate(() => { const w = window.__wildshard.requireWorld(); w.player.keys.clear(); w.freeCamera = true; w.game.viewmodel.visible = false; });
  return witness;
}

async function capture(base) {
  requireNoQuiet();
  const report = { schema: 'engine-hero-capture/1', version: await (await fetch(new URL('version.json', base))).json(),
    device: 'iPhone 16 Pro', developer: true, renderScale: 2, canvasOnly: true, muted: true,
    clock: 'live', method: 'look28 entry/pose; camera held, no scene, lighting, quality or material changes', shots: [] };
  const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
  const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  try {
    for (const mode of ['grid', 'driftwood-isle', 'pine-hollow']) {
      requireNoQuiet();
      const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
      try {
        await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
        await saveFixture(context, { scope: 'global', key: 'settings', merge: true,
          data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } });
        await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
        await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
        await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(240000);
        page.on('pageerror', error => { errors.push(error.message); });
        page.on('console', message => { if (message.type() === 'error' && message.text().includes('[faults]')) errors.push(message.text()); });
        await page.goto(mode === 'grid' ? base : `${base}?chunk=${mode}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
        if (mode === 'grid') await page.locator('.ws-main-grid').click();
        await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
          || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.world?.game)));
        const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent ?? null);
        if (failure) throw new Error(failure);
        await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
        await page.waitForTimeout(5000);
        const identity = await page.evaluate(gridFloorDocumentIdentity);
        const initial = await page.evaluate(() => {
          const w = window.__wildshard.requireWorld(), p = w.player.position;
          const direction = w.game.camera.getWorldDirection(w.game.camera.position.clone());
          return { grid: window.__wildshard.shard?.grid?.state?.() ?? null,
            pose: { x: p.x, y: p.y, z: p.z, heading: Math.atan2(direction.x, direction.z), pitch: -0.05 } };
        });
        let shots;
        if (mode === 'grid') {
          const home = initial.grid.cells.find(cell => cell.instance === initial.grid.home);
          if (!home) throw new Error('Grid home is not declared');
          const x = home.cell[0] * 555, z = home.cell[1] * 555;
          shots = [
            { id: 'A', name: 'Road spoke', world: true, x: x + 277.5, y: 1.8, z: z + 277.5, heading: 0 },
            { id: 'B', name: 'Crossroads: second spoke', world: true, x: x + 277.5, y: 1.8, z: z + 277.5, heading: -Math.PI / 2 },
            { id: 'C', name: 'Crossroads: east boulevard', world: true, x: x + 277.5, y: 1.8, z: z + 277.5, heading: Math.PI / 2 },
            { id: 'D', name: 'Raised template corner', world: true, x: x + 277.5, y: 35, z: z + 277.5, heading: -Math.PI * 0.75, pitch: -0.25 },
            { id: 'E', name: 'Elevated template block', world: true, x: x + 350, y: 160, z: z + 350, heading: -Math.PI * 0.75, pitch: -0.42 },
            { id: 'F', name: 'Island above the junction', world: true, x: 277.5, y: 80, z: 277.5, heading: -Math.PI * 0.75, pitch: -0.3 },
          ];
        } else shots = [{ id: mode === 'driftwood-isle' ? 'G' : 'H', name: mode === 'driftwood-isle' ? 'Driftwood pier at spawn' : 'Pine forest road at spawn', ...initial.pose }];
        for (const shot of shots) {
          requireNoQuiet();
          const row = { id: shot.id, name: shot.name, mode, requestedPose: shot, errors: [], complete: false };
          report.shots.push(row); save();
          try {
            const pose = shot.world ? await page.evaluate(p => {
              const w = window.__wildshard.requireWorld(), live = window.__wildshard.shard.grid.state().live.live;
              return { ...p, x: p.x - (live.worldFeet.x - w.player.position.x), z: p.z - (live.worldFeet.z - w.player.position.z) };
            }, shot) : shot;
            await poseAt(page, pose); await page.waitForTimeout(3500);
            const current = await page.evaluate(gridFloorDocumentIdentity);
            if (current.token !== identity.token) throw new Error('Document changed; camera witness invalid');
            if (errors.length > 0) throw new Error(errors.join('; '));
            await page.evaluate(() => { window.__wildshard.requireWorld().game.renderer.domElement.dataset.heroCanvas = 'true'; });
            // Hide DOM overlays only. Do not remove any object or alter the actual canvas scene.
            await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas[data-hero-canvas] { visibility: visible !important; }' });
            row.frame = await page.evaluate(() => {
              const w = window.__wildshard.requireWorld();
              return { position: w.player.position.toArray(), grid: window.__wildshard.shard?.grid?.state?.().inside ?? null,
                frameCount: w.game.frameCount, renderScale: w.game.renderer.getPixelRatio(), clock: w.game.app.clock.mode };
            });
            row.file = `${shot.id}.png`;
            await page.locator('canvas[data-hero-canvas]').screenshot({ path: join(out, row.file) });
            row.complete = true;
          } catch (error) { row.errors.push(String(error)); }
          save();
          console.log(`${shot.id}: ${row.complete ? 'captured' : row.errors.join('; ')}`);
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); save(); }
  if (report.shots.length !== 8 || report.shots.some(shot => !shot.complete)) throw new Error('Incomplete hero set; inspect capture.json');
}

async function captureAerial(base) {
  requireNoQuiet();
  const plan = JSON.parse(await command(process.execPath,
    ['--import', join(root, 'scripts/sim-node-loader.mjs'), join(root, 'scripts/main-menu-aerial-plan.mjs'), round === 'near' ? '4' : round], root));
  // --only=<pose id,…> and --sessions=<key,…> (e.g. 2048x2048) narrow a re-shoot; sessions left with no pose are skipped
  const only = flag('only', ''), keys = flag('sessions', '');
  // --enter (round 4): stand the player in the cell under the eye first (its runtime draws at full quality; the
  // lifted eye hands the cell's horizon back to the grid, G343)
  const enter = args.includes('--enter');
  if (only !== '') plan.poses = plan.poses.filter(p => only.split(',').includes(p.id));
  // G343 round 4: the square round's sessions over round4HeroPlan, with the near-placeholder tier on (G342)
  const near = round === 'near', round4 = round === '4' || round === '5', square = round === 'square' || round4, landscape = round === 'landscape' || square || near;
  // Aerial: one phone context per Debug time pick. Landscape: one desktop context per resolution, desktop tier, DSF 1.
  // Square (G344): the same desktop contexts, square resolutions for the square poses and 16:9 for the landscape ones.
  const desktop = (width, height, poses) => ({ key: `${width}x${height}`, poses,
    context: { ...devices['Desktop Chrome'], viewport: { width, height }, deviceScaleFactor: 1 },
    settings: { tier: 'desktop', fps: 'auto', tex: 'auto', volume: 0, ...(round4 ? { nearTier: 'near' } : {}) }, gfx: { dpr: 'native', aa: 'auto' } });
  // G342: from the roundabout to each of the four crossroads cells (the game's own lens), then the shipped hero (NA-a)
  const centre0 = plan.road ?? plan.poses[0].target, nearPoses = [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => ({ id: `road-${i}`, name: `Road view ${i}`,
    eye: { x: centre0.x - sx * 30, y: 22, z: centre0.z - sz * 30 }, target: { x: centre0.x + sx * 240, y: 0, z: centre0.z + sz * 240 } })),
  ...plan.poses.filter(p => p.id === 'SQ-NA-a')];
  const sessions = (near
    ? ['far', 'near'].flatMap(nearTier => [
      { key: `${nearTier === 'far' ? 'A' : 'B'}-iphone`, poses: nearPoses, context: { ...devices['iPhone 16 Pro'] },
        settings: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0, nearTier }, gfx: { dpr: '2', aa: 'auto' } },
      { key: `${nearTier === 'far' ? 'A' : 'B'}-desktop`, poses: nearPoses, context: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
        settings: { tier: 'desktop', fps: 'auto', tex: 'auto', volume: 0, nearTier }, gfx: { dpr: 'native', aa: 'auto' } }])
    : square
    ? [[2048, 2048, 'square'], [1440, 1440, 'square'], [2560, 1440, 'landscape'], [1920, 1080, 'landscape']]
      .map(([width, height, aspect]) => desktop(width, height, plan.poses.filter(p => p.aspect === aspect)))
    : landscape
      ? [[2560, 1440], [1920, 1080]].map(([width, height]) => desktop(width, height, plan.poses))
      : ['golden', 'midday', 'sunset'].map(timePick => ({ key: timePick, poses: plan.poses.filter(p => p.timePick === timePick),
        context: { ...devices['iPhone 16 Pro'] },
        settings: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0, time: timePick }, gfx: { dpr: '2', aa: 'auto' } })))
    .filter(session => session.poses.length > 0 && (keys === '' || keys.split(',').includes(session.key)));
  const expected = landscape ? sessions.reduce((sum, session) => sum + session.poses.length, 0) : 15;
  const report = { schema: 'engine-hero-capture/1', version: await (await fetch(new URL('version.json', base))).json(),
    round, device: landscape ? `Desktop Chrome (${sessions.map(session => session.key.replace('x', '×')).join(', ')}, DSF 1)` : 'iPhone 16 Pro', developer: true,
    renderScale: landscape ? 1 : 2, tier: landscape ? 'desktop' : 'phone', canvasOnly: true, muted: true,
    clock: 'live', camera: `Existing freeCamera flag; fixed detached camera in late phase; player remains on the road${square ? '; per-pose capture-time vertical FOV (fovDegrees) on that camera only, CAMERA_FOV unchanged' : ''}`,
    noViewmodel: true, junction: plan.junction, surrounding: plan.surrounding,
    roadLighting: 'Shipping ROAD_SKY is fixed low dawn; requested Debug time picks do not rewrite that look', shots: [] };
  const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
  const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  try {
    for (const session of sessions) {
      requireNoQuiet();
      const context = await browser.newContext(session.context);
      try {
        await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
        await saveFixture(context, { scope: 'global', key: 'settings', merge: true, data: session.settings });
        await saveFixture(context, { scope: 'global', key: 'gfx', data: session.gfx });
        await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
        await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
        const page = await context.newPage(), errors = [], consoleErrors = [];
        page.setDefaultTimeout(180000);
        page.on('pageerror', error => { errors.push(error.message); });
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('.ws-main-grid').click();
        await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
          || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.world?.game)));
        const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent ?? null);
        if (failure) throw new Error(failure);
        await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
        await page.waitForTimeout(8000);
        const identity = await page.evaluate(gridFloorDocumentIdentity);
        const centre = centre0;
        await page.evaluate(async p => {
          const api = window.__wildshard, w = api.requireWorld(), live = api.shard.grid.state().live.live;
          const offset = { x: live.worldFeet.x - w.player.position.x, z: live.worldFeet.z - w.player.position.z };
          await api.pose({ x: p.x - offset.x, z: p.z - offset.z, y: 0, yaw: 0, pitch: 0 });
        }, centre);
        await page.waitForTimeout(5000);
        await page.evaluate(() => {
          const w = window.__wildshard.requireWorld();
          w.freeCamera = true;
          w.game.viewmodel.visible = false;
          w.player.keys.clear();
          w.game.renderer.domElement.dataset.heroCanvas = 'true';
          // This is the existing free-camera gate, not a player teleported around
          // the sky. Grid origin shifts are resolved anew on every real frame.
          w.game.onLate(() => {
            const p = window.__heroAerialPose;
            if (!p) return;
            const live = window.__wildshard.shard.grid.state().live.live;
            const origin = window.__wildshard.shard.grid.state().live.renderOrigin, dx = live.worldFeet.x - w.player.position.x - origin.x, dz = live.worldFeet.z - w.player.position.z - origin.z;
            w.game.camera.position.set(p.eye.x - dx, p.eye.y, p.eye.z - dz);
            w.game.camera.lookAt(p.target.x - dx, p.target.y, p.target.z - dz);
            // G344: a pose's own lens, held each late phase over whatever lens the road or a cell wrote this frame.
            if (typeof p.fovDegrees === 'number' && Math.abs(w.game.camera.fov - p.fovDegrees) > 1e-4) {
              w.game.camera.fov = p.fovDegrees; w.game.camera.updateProjectionMatrix(); w.sky.csm.updateFrustums();
            }
            w.game.camera.updateMatrixWorld(true);
            w.game.viewmodel.visible = false;
          }, 'harness.hero-aerial');
        });
        await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas[data-hero-canvas] { visibility: visible !important; }' });
        let entered = null;
        for (const shot of session.poses) {
          requireNoQuiet();
          const row = { ...shot, session: session.key, requestedPose: shot, errors: [], complete: false };
          report.shots.push(row); save();
          try {
            // G343: stand the player in the cell the eye is over, so that shard draws its own runtime (not a placeholder)
            // the near round's iPhone sessions never enter (the phone-tier entry from the air times out): the hero view's
            // cell then draws its near placeholder, and the label's tier readout says so
            const enterHere = enter && shot.over !== undefined && !(near && session.key.endsWith('-iphone'));
            if (enterHere && shot.over.instance !== entered?.instance) {
              entered = await enterOver(page, { ...shot.over, road: centre0 });
              console.log(`entered ${shot.over.slug} for ${session.key}: ${JSON.stringify(entered.tiles)}`);
            }
            if (enterHere) row.entered = entered;
            await page.evaluate(p => { window.__heroAerialPose = p; }, shot);
            await page.waitForTimeout(3500);
            const current = await page.evaluate(gridFloorDocumentIdentity);
            if (current.token !== identity.token) throw new Error('Document changed; aerial camera witness invalid');
            if (errors.length > 0) throw new Error(errors.join('; '));
            row.frame = await page.evaluate(() => {
              const w = window.__wildshard.requireWorld(), grid = window.__wildshard.shard.grid.state();
              const live = grid.live.live, dx = live.worldFeet.x - w.player.position.x - grid.live.renderOrigin.x, dz = live.worldFeet.z - w.player.position.z - grid.live.renderOrigin.z;
              const p = w.game.camera.position, direction = w.game.camera.getWorldDirection(p.clone());
              return { cameraWorld: [p.x + dx, p.y, p.z + dz], direction: direction.toArray(), playerWorld: live.worldFeet,
                freeCamera: w.freeCamera, viewmodelVisible: w.game.viewmodel.visible, cells: grid.cells, near: grid.near,
                renderScale: w.game.renderer.getPixelRatio(), frameCount: w.game.frameCount, fov: w.game.camera.fov, aspect: w.game.camera.aspect,
                dayClock: w.sky.dayNight?.snapshot() ?? null, clock: w.game.app.clock.mode };
            });
            if (!row.frame.freeCamera || row.frame.viewmodelVisible) throw new Error('Detached-camera / no-viewmodel witness failed');
            if (enterHere && row.frame.cells.find(cell => cell.instance === shot.over.instance)?.shows !== 'playing') throw new Error(`${shot.over.instance} is not the playing cell under the eye`);
            if (Math.hypot(...row.frame.cameraWorld.map((v, i) => v - [shot.eye.x, shot.eye.y, shot.eye.z][i])) > 0.01) throw new Error('Actual aerial camera differs from requested pose');
            if (typeof shot.fovDegrees === 'number' && Math.abs(row.frame.fov - shot.fovDegrees) > 0.01) throw new Error(`Camera FOV ${row.frame.fov} is not the requested ${shot.fovDegrees}`);
            // a road view is named for the shard it looks at (Jake: every neighbour obvious, e.g. A-road-nalati-iphone)
            const facing = shot.id.startsWith('road-') ? row.frame.cells.find(cell => Math.abs(cell.cell[0] * 555 - shot.target.x) < 277.5 && Math.abs(cell.cell[1] * 555 - shot.target.z) < 277.5) : undefined;
            const name = facing === undefined ? shot.id : `road-${facing.slug.replace(/^_/u, '').split('-')[0]}`;
            row.file = near ? `${session.key.slice(0, 1)}-${name}-${session.key.slice(2)}.png` : landscape ? `${shot.id}-${session.key}.png` : `${shot.id}.png`;
            await page.locator('canvas[data-hero-canvas]').screenshot({ path: join(out, row.file) });
            row.consoleErrors = [...consoleErrors]; row.complete = true;
          } catch (error) { row.errors.push(String(error)); }
          save(); console.log(`${shot.id} ${session.key}: ${row.complete ? 'captured' : row.errors.join('; ')}`);
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); save(); }
  report.shots.sort((a, b) => plan.poses.findIndex(p => p.id === a.id) - plan.poses.findIndex(p => p.id === b.id)); save();
  if (report.shots.length !== expected || report.shots.some(shot => !shot.complete)) throw new Error('Incomplete aerial set; inspect capture.json');
}

mkdirSync(out, { recursive: true });
if (args.includes('--worker')) {
  if (process.env.HERO_CAPTURE_LANE !== '1') throw new Error('Run through this command’s browser-lane launcher');
  await (round === 'aerial' || round === 'landscape' || round === 'square' || round === 'near' || round === '4' || round === '5' ? captureAerial(flag('base', '')) : capture(flag('base', '')));
} else {
  requireNoQuiet();
  const scratch = join(out, 'build'); mkdirSync(scratch, { recursive: true });
  let base;
  try {
    base = (await command(join(root, 'scripts/serve-build.sh'), [...(args.includes('--tree') ? [] : ['--head']), '--name', 'main-menu-hero', '--hours', '1'], scratch,
      { ...process.env, SERVE_OWNER: serveOwner })).split('\n').at(-1);
    requireNoQuiet();
    await command(join(root, 'scripts/browser-lane.sh'), ['--max', '20', process.execPath, script, '--worker', `--round=${round}`, `--base=${base}`, `--out=${out}`,
      ...args.filter(value => /^--(?:only=|sessions=|enter$)/u.test(value))], root,
      { ...process.env, HERO_CAPTURE_LANE: '1' });
    console.log(`Canvas candidates and pinned capture.json: ${out}`);
  } finally {
    if (base) await command(join(root, 'scripts/serve-build.sh'), ['stop', new URL(base).port], root, { ...process.env, SERVE_OWNER: serveOwner });
  }
}
