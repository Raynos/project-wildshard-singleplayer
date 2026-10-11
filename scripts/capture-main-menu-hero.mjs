/** G332: real canvas-only hero candidates; never changes the shipped menu or scene look.
 * node scripts/capture-main-menu-hero.mjs --out=<scratch directory>
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

mkdirSync(out, { recursive: true });
if (args.includes('--worker')) {
  if (process.env.HERO_CAPTURE_LANE !== '1') throw new Error('Run through this command’s browser-lane launcher');
  await capture(flag('base', ''));
} else {
  requireNoQuiet();
  const scratch = join(out, 'build'); mkdirSync(scratch, { recursive: true });
  let base;
  try {
    base = (await command(join(root, 'scripts/serve-build.sh'), ['--head', '--name', 'main-menu-hero', '--hours', '1'], scratch,
      { ...process.env, SERVE_OWNER: 'sp-x2-g332' })).split('\n').at(-1);
    requireNoQuiet();
    await command(join(root, 'scripts/browser-lane.sh'), ['--max', '20', process.execPath, script, '--worker', `--base=${base}`, `--out=${out}`], root,
      { ...process.env, HERO_CAPTURE_LANE: '1' });
    console.log(`Canvas candidates and pinned capture.json: ${out}`);
  } finally {
    if (base) await command(join(root, 'scripts/serve-build.sh'), ['stop', new URL(base).port], root, { ...process.env, SERVE_OWNER: 'sp-x2-g332' });
  }
}
