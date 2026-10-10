// SF63 parity (SHARD-PLATFORM, E435): each shard inside its grid cell against the same shard from SHARD SELECT, at the same
// shard-local poses, on one tier. The grid half is sf63-pine-post/drive.mjs's drive (a Developer-ON grid boot, a pose onto the
// road only, then held input into the cell, never a teleport inside it); the standalone half poses SHARD SELECT at the poses
// the drive actually stopped at (playtest-2-drivein/standalone.mjs). The HUD is hidden in both for the shot. Each pose gets
// an image diff (mean absolute error per channel on a 390-px-wide copy, and the mean colour of each side) and the post chain
// each side drew (bloom, vignette, AO, tone, the grade) and its shadow rig. Both clocks are parked at midday (Settings ▸ Time of day).
// scripts/browser-lane.sh node progress/shard-platform/sf63-parity/capture.mjs --url=<preview> --out=<dir> --tag=<t> --scene=<nalati|driftwood|pine> --tier=<phone|desktop>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), scene = arg('scene'), tier = arg('tier') || 'phone';
if (!base || !out || !tag || !scene) throw new Error('Pass --url, --out, --tag, --scene and --tier');
mkdirSync(out, { recursive: true });
const E = -Math.PI / 2, N = Math.PI, W = Math.PI / 2; // forward = (-sin yaw, -cos yaw): +x east, +z north
const SCENES = {
  nalati: { card: 'Nalati Grasslands', road: { x: 277.5, z: 0, yaw: E }, stops: [
    { at: [{ x: 322, z: 0 }], shots: [['nalati-entry-e', E, 0.3], ['nalati-entry-n', N, 0.03]] },
    { at: [{ x: 470, z: 0 }], shots: [['nalati-inside-e', E, 0.05], ['nalati-inside-w', W, 0.03]] },
  ] },
  driftwood: { card: 'Driftwood Isle', road: { x: 277.5, z: 0, yaw: W }, stops: [
    { at: [{ x: 230, z: 0 }], shots: [['driftwood-entry-w', W, 0.05]] },
    // G254: beside the wreck's open hold over the shallows (where the earlier drives stalled: the board rode the seabed)
    { at: [{ x: 160, z: 0 }], shots: [['driftwood-wreck-w', W, 0.08]] },
    // finish2: round the wreck's hull (the board no longer rides over it at z 0: it stalled at x 157)
    { at: [{ x: 162, z: -14 }, { x: 120, z: -14 }, { x: 120, z: 0 }], shots: [['driftwood-inside-w', W, 0.08], ['driftwood-inside-n', N, 0.08]] },
  ] },
  pine: { card: 'Pine Hollow', road: { x: 0, z: 277.5, yaw: N }, stops: [
    { at: [{ x: 0, z: 330 }], shots: [['pine-entry-n', N, 0.05]] },
    { at: [{ x: 0, z: 470 }, { x: 60, z: 555 }, { x: 120, z: 555 }], shots: [['pine-forest-e', E, 0.05], ['pine-forest-n', N, 0.05]] },
  ] },
};
const plan = SCENES[scene];
if (!plan) throw new Error(`Unknown scene ${scene}`);
const query = `?tier=${tier}&mute=1&nolock=1&sw=0&weather=clear`;
const report = { base, tag, scene, tier, grid: { stops: [], errors: [], shaderErrors: 0 }, standalone: { shots: [], errors: [], shaderErrors: 0 }, poses: [], diffs: [] };
const hideHud = page => page.addStyleTag({ content: '#hud, .ws-toast, .ws-hints, .ws-minimap, .ws-touch, .ws-grid-banner { visibility: hidden !important; }' });
/** the post chain the frame draws: the engine chain's knobs (bloom, vignette, AO), the grid frame's carried chain, programs */
const chainProbe = page => page.evaluate(() => {
  const api = window.__wildshard, game = api.world.game, r = n => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n ?? null);
  const post = game.post, composer = game.composer ?? game._composer;
  const passes = (composer?.passes ?? []).map(p => p.name + (p.effects ? `[${p.effects.map(e => e.name).join(',')}]` : '') + (p.enabled ? '' : '(off)'));
  const ao = (composer?.passes ?? []).find(p => p.configuration && 'aoRadius' in p.configuration);
  return {
    passes, programs: game.renderer.info.programs?.length ?? null,
    bloom: post?.bloom ? [r(post.bloom.intensity), r(post.bloom.luminanceMaterial.threshold), r(post.bloom.luminanceMaterial.smoothing)] : null,
    vignette: r(post?.vignette?.darkness), saturation: r(post?.saturation?.saturation), contrast: r(post?.contrast?.contrast), brightness: r(post?.contrast?.brightness),
    ao: ao ? { enabled: ao.enabled, intensity: r(ao.configuration.intensity), radius: r(ao.configuration.aoRadius) } : null,
    frame: api.shard?.grid?.state?.().frame?.chain ?? null,
    // the shadow rig and the key light as drawn: sun direction (toward the sun), each casting light's map and frustum
    shadows: (() => {
      const lights = [], cam = game.camera.position;
      game.rootScene.traverse(o => { if (o.isDirectionalLight && o.visible) { const d = o.position.clone().sub(o.target.position).normalize(); lights.push({ name: o.name, intensity: r(o.intensity), cast: o.castShadow, dir: d.toArray().map(r), map: o.shadow?.map ? [o.shadow.map.width, o.shadow.map.height] : null, frustum: o.castShadow ? [r(o.shadow.camera.left), r(o.shadow.camera.right), r(o.shadow.camera.far)] : null, fromCam: o.castShadow ? r(o.target.position.distanceTo(cam)) : null }); } });
      // the visible meshes that cast and receive (a grid region's under its `region:` root; SHARD SELECT: all)
      let meshes = 0, cast = 0, receive = 0;
      game.rootScene.traverseVisible(o => { if (!o.isMesh) return; let region = false; for (let n = o; n; n = n.parent) if (n.name?.startsWith('region:')) region = true; if (api.shard?.grid && !region) return; meshes++; if (o.castShadow) cast++; if (o.receiveShadow) receive++; });
      return { enabled: game.renderer.shadowMap.enabled, autoUpdate: game.renderer.shadowMap.autoUpdate, lights, meshes, cast, receive };
    })(),
  };
});
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const watch = (page, side) => {
  page.on('pageerror', e => { side.errors.push(e.message.slice(0, 300)); });
  page.on('console', m => { if (/THREE\.WebGLProgram|Shader Error|shader error/iu.test(m.text())) side.shaderErrors++; });
};
try {
  // ── the grid: drive into the cell
  {
    const context = await browser.newContext(devices['iPhone 16 Pro']);
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await debugSettings(context, { time: 'midday' }); // Settings ▸ Time of day: both clocks parked at the same hour
    await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
    const page = await context.newPage(); watch(page, report.grid);
    await page.goto(`${base}/${query}`, { waitUntil: 'commit', timeout: 300_000 });
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
    report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
    await hideHud(page);
    await page.waitForTimeout(2000);
    await page.evaluate(async road => {
      const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
      const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
      await api.pose({ x: road.x - origin.x, y: 0.55, z: road.z - origin.z, yaw: road.yaw, pitch: 0 });
    }, plan.road);
    await page.waitForTimeout(5000);
    report.grid.road = { chain: await chainProbe(page) };
    for (const stop of plan.stops) {
      const drive = await page.evaluate(async waypoints => {
        const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
        const oldLimit = player.hoverSpeedLimit; let distance = 100;
        player.setHover(true); input.clear();
        player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
        const started = performance.now();
        try {
          return await new Promise(resolve => {
            let stopWatch = () => undefined, waypoint = 0;
            const finish = why => { stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: Math.round((performance.now() - started) / 100) / 10, feet: s.live?.live?.worldFeet, current: s.live?.live?.current ?? null }); };
            const timer = setTimeout(() => finish('timeout'), 120000);
            stopWatch = world.game.watchFrames(() => {
              const active = api.shard.grid.state().live.live, feet = active.worldFeet, target = waypoints[waypoint];
              if (!target) { clearTimeout(timer); finish('arrived'); return; }
              const dx = target.x - feet.x, dz = target.z - feet.z; distance = Math.hypot(dx, dz);
              if (distance < 1.5) { waypoint++; input.clear(); return; }
              if (!active.gameplayReady) { input.clear(); return; }
              player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
            });
          });
        } finally { input.clear(); player.hoverSpeedLimit = oldLimit; }
      }, stop.at);
      await page.waitForTimeout(6000);
      for (const [name, yaw, pitch] of stop.shots) {
        await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: join(out, `${name}-${tier}-grid.jpg`), type: 'jpeg', quality: 80 });
        const pose = await page.evaluate(() => { const p = window.__wildshard.world.player.position, r = n => Math.round(n * 100) / 100; return [r(p.x), r(p.z), r(p.y)]; });
        report.poses.push([name, pose[0], pose[1], yaw, pitch, pose[2]]);
      }
      report.grid.stops.push({ drive, chain: await chainProbe(page) });
    }
    await context.close();
  }
  // ── SHARD SELECT: the same shard alone, at the poses the drive stopped at
  {
    const context = await browser.newContext(devices['iPhone 16 Pro']);
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    await debugSettings(context, { time: 'midday' }); // Settings ▸ Time of day: both clocks parked at the same hour
    await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
    const page = await context.newPage(); watch(page, report.standalone);
    await page.goto(`${base}/${query}`, { waitUntil: 'commit', timeout: 300_000 });
    await page.waitForSelector('.ws-main-select', { timeout: 300_000 }); await page.locator('.ws-main-select').click();
    await page.evaluate(name => { const card = [...document.querySelectorAll('.ws-menu-card')].find(e => e.querySelector('b')?.textContent === name); if (!card) throw new Error('Missing shard card'); document.querySelector(`.ws-menu-dots i[data-i="${card.dataset.i}"]`)?.click(); }, plan.card);
    await page.locator('.ws-menu-play').click();
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'), undefined, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await hideHud(page);
    await page.waitForTimeout(8000);
    for (const [name, x, z, yaw, pitch, y] of report.poses) {
      await page.evaluate(p => window.__wildshard.pose(p), { x, z, y, yaw, pitch });
      await page.evaluate(() => { window.__wildshard.world.player.setHover(true); }); // on the board, as the grid drive arrives
      await page.waitForTimeout(6000);
      await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(out, `${name}-${tier}-standalone.jpg`), type: 'jpeg', quality: 80 });
      report.standalone.shots.push(name);
    }
    report.standalone.chain = await chainProbe(page);
    await context.close();
  }
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); }
// ── the per-pose diff: MAE (0–255) on 390-px copies, and each side's mean colour
const meanRGB = f => execFileSync('magick', [f, '-resize', '390x', '-format', '%[fx:255*mean.r] %[fx:255*mean.g] %[fx:255*mean.b]', 'info:']).toString().trim().split(' ').map(n => Math.round(Number(n) * 10) / 10);
for (const [name] of report.poses) {
  const a = join(out, `${name}-${tier}-standalone.jpg`), b = join(out, `${name}-${tier}-grid.jpg`);
  if (!report.standalone.shots.includes(name)) continue;
  let mae = null;
  try { execFileSync('magick', ['compare', '-metric', 'MAE', '(', a, '-resize', '390x', ')', '(', b, '-resize', '390x', ')', 'null:'], { stdio: ['ignore', 'pipe', 'pipe'] }); mae = 0; }
  catch (e) { const m = /^([\d.e+-]+)/u.exec(String(e.stderr)); mae = m ? Math.round(Number(m[1]) / 257 * 10) / 10 : null; }
  report.diffs.push({ pose: name, mae, standalone: meanRGB(a), grid: meanRGB(b) });
}
writeFileSync(join(out, `parity-${scene}-${tier}-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ failure: report.failure ?? null, gridErrors: report.grid.errors.slice(0, 3), standaloneErrors: report.standalone.errors.slice(0, 3), shader: [report.grid.shaderErrors, report.standalone.shaderErrors], diffs: report.diffs, gridChain: report.grid.stops.at(-1)?.chain, standaloneChain: report.standalone.chain }));
if (report.failure) process.exitCode = 1;
