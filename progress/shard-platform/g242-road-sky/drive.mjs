// G242 (SHARD-PLATFORM, E455; Jake's pick B "grid dawn"): the road's own dome and key light, blended across the 16 m
// cell-edge band into each shard's own sky. From ../g232-grade/drive.mjs: a Developer-ON grid boot, a pose onto the road
// only, then held input into the cell (never a teleport inside it). Captures on the road, on the edge line, just inside and
// deep inside; at each stop the frame's readout (road sky share, region skies, owner), the shared key light, the program
// count, GL MB and shader errors. Then back to the road (the road read-back must be exact) and in again (the shard's look
// must be exact on re-entry).
//   scripts/browser-lane.sh node progress/shard-platform/g242-road-sky/drive.mjs --url=<preview> --out=<dir> --scene=<nalati|pine|driftwood> [--video]
// --video: one continuous drive road → edge → inside recorded at 540 px wide (no stops, no read-back).
import { writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), scene = arg('scene'), video = process.argv.includes('--video');
if (!base || !out || !scene) throw new Error('Pass --url, --out and --scene');
mkdirSync(out, { recursive: true });
const E = -Math.PI / 2, N = Math.PI, W = Math.PI / 2, S = 0; // forward = (-sin yaw, -cos yaw): +x east, +z north
/** a road pose (grid metres), then stops: held-input waypoints and the shots there (yaw, pitch) */
const SCENES = {
  nalati: { road: { x: 277.5, z: -60, yaw: E }, edge: 305, stops: [
    { name: 'road', at: [{ x: 277.5, z: -40 }], shots: [['road-along', S, 0.04], ['road-cell', E, 0.04]] },
    { name: 'edge', at: [{ x: 277.5, z: 0 }, { x: 305, z: 0 }], shots: [['edge', E, 0.04]] },
    { name: 'inside', at: [{ x: 330, z: 0 }], shots: [['inside', E, 0.04]] },
    { name: 'deep', at: [{ x: 470, z: 0 }], shots: [['deep', E, 0.05]] },
  ], back: [{ x: 330, z: 0 }, { x: 277.5, z: 0 }], again: [{ x: 330, z: 0 }], videoRoute: { from: { x: 268, z: -50, yaw: N }, to: [{ x: 277.5, z: -10 }, { x: 283, z: 0 }, { x: 360, z: 0 }] } },
  pine: { road: { x: -60, z: 277.5, yaw: N }, edge: 305, stops: [
    { name: 'road', at: [{ x: -40, z: 277.5 }], shots: [['road-along', E, 0.04], ['road-cell', N, 0.04]] },
    { name: 'edge', at: [{ x: 0, z: 277.5 }, { x: 0, z: 305 }], shots: [['edge', N, 0.04]] },
    { name: 'inside', at: [{ x: 0, z: 330 }], shots: [['inside', N, 0.04]] },
    { name: 'deep', at: [{ x: 0, z: 470 }], shots: [['deep', N, 0.05]] },
  ], back: [{ x: 0, z: 330 }, { x: 0, z: 277.5 }], again: [{ x: 0, z: 330 }] },
  driftwood: { road: { x: 277.5, z: 60, yaw: W }, edge: 250, stops: [
    { name: 'road', at: [{ x: 277.5, z: 40 }], shots: [['road-along', S, 0.04], ['road-cell', W, 0.04]] },
    { name: 'edge', at: [{ x: 277.5, z: 0 }, { x: 250, z: 0 }], shots: [['edge', W, 0.04]] },
    { name: 'inside', at: [{ x: 225, z: 0 }], shots: [['inside', W, 0.04]] },
  ], back: [{ x: 277.5, z: 0 }], again: [{ x: 225, z: 0 }], videoRoute: { from: { x: 283, z: 70, yaw: S }, to: [{ x: 280, z: 8 }, { x: 272, z: 0 }, { x: 205, z: 0 }] } },
};
const plan = SCENES[scene];
if (!plan) throw new Error(`Unknown scene ${scene}`);
const report = { base, scene, video, stops: [], drives: [], errors: [], console: [], shaderErrors: 0, poses: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], ...(video ? { recordVideo: { dir: out, size: { width: 540, height: 1174 } } } : {}) });
  await context.addInitScript(GL_INIT);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  page.on('console', m => {
    const text = m.text();
    if (/THREE\.WebGLProgram|Shader Error|shader error/iu.test(text)) report.shaderErrors++;
    if (m.type() === 'error' || m.type() === 'warning') report.console.push(text.slice(0, 300));
  });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.waitForTimeout(2000);
  const pose = road => page.evaluate(async road => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: road.x - origin.x, y: 0.55, z: road.z - origin.z, yaw: road.yaw, pitch: 0 });
  }, road);
  const driveTo = (waypoints, speed = 15) => page.evaluate(async ([waypoints, speed]) => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    const oldLimit = player.hoverSpeedLimit; let distance = 100;
    player.setHover(true); input.clear();
    player.hoverSpeedLimit = () => Math.min(speed, oldLimit(), Math.max(3, distance * 1.5));
    const started = performance.now();
    try {
      return await new Promise(resolve => {
        let stopWatch = () => undefined, waypoint = 0;
        const finish = why => { stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: (performance.now() - started) / 1000, feet: s.live?.live?.worldFeet, current: s.live?.live?.current ?? null }); };
        const timer = setTimeout(() => finish('timeout'), 120000);
        stopWatch = world.game.watchFrames(() => {
          const s = api.shard.grid.state(), active = s.live.live, feet = active.worldFeet;
          const target = waypoints[waypoint];
          if (!target) { clearTimeout(timer); finish('arrived'); return; }
          const dx = target.x - feet.x, dz = target.z - feet.z; distance = Math.hypot(dx, dz);
          if (distance < 1.5) { waypoint++; input.clear(); return; }
          if (!active.gameplayReady) { input.clear(); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
    } finally { input.clear(); player.hoverSpeedLimit = oldLimit; }
  }, [waypoints, speed]);
  /** the shared light and fog as drawn, the frame's road sky / region skies / owner, programs, GL MB */
  const lookState = () => page.evaluate(() => {
    const api = window.__wildshard, game = api.world.game, scene = game.rootScene, sky = game.sky;
    const r5 = n => Math.round(n * 1e5) / 1e5, v = x => x.toArray().map(r5);
    const lights = [];
    scene.traverse(o => { if ((o.isDirectionalLight || o.isHemisphereLight) && o.visible) lights.push([o.type, r5(o.intensity), v(o.color), o.groundColor ? v(o.groundColor) : null]); });
    const f = api.shard.grid.state().frame;
    const gl = typeof window.__sc_gl === 'function' ? window.__sc_gl() : [];
    return { sunDir: v(sky.sunDir), lightDirection: v(sky.csm.lightDirection), lights, fog: scene.fog ? v(scene.fog.color) : null, environmentIntensity: r5(scene.environmentIntensity ?? 1),
      frame: f === undefined ? null : { owner: f.owner, highway: f.highway, roadSky: f.roadSky, air: f.air, skies: f.skies, chain: { owner: f.chain.owner, weight: f.chain.weight } },
      programs: game.renderer.info.programs?.length ?? null, programNames: (game.renderer.info.programs ?? []).map(p => (p.name ? `${p.name}#${p.cacheKey.length}` : `#${p.cacheKey}`)).sort(), glMB: Math.round(gl.reduce((s, c) => s + c.totalBytes, 0) / 1e4) / 100 };
  });
  if (video) {
    const route = plan.videoRoute ?? { from: plan.road, to: plan.stops.flatMap(s => s.at) };
    await pose(route.from);
    await page.evaluate(() => { const pl = window.__wildshard.world.player; pl.pitch = 0.04; });
    await page.waitForTimeout(6000);
    report.drives.push(await driveTo(route.to, 9));
    await page.waitForTimeout(2500);
    report.end = await lookState();
  } else {
    await pose(plan.road);
    await page.waitForTimeout(5000);
    report.road = { before: await lookState() };
    for (const stop of plan.stops) {
      const drive = await driveTo(stop.at);
      report.drives.push({ phase: stop.name, ...drive });
      if (drive.why !== 'arrived') throw new Error(`Drive to ${stop.name} did not arrive: ${JSON.stringify(drive)}`);
      await page.waitForTimeout(stop.name === 'road' ? 2500 : 6000);
      const shots = [];
      for (const [name, yaw, pitch] of stop.shots) {
        await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: join(out, `${scene}-${name}.jpg`), type: 'jpeg', quality: 72 });
        shots.push(name);
      }
      report.stops.push({ name: stop.name, drive, shots, look: await lookState() });
    }
    // back to the road: the road's look must be what it was before entering
    const back = await driveTo(plan.back);
    report.drives.push({ phase: 'back', ...back });
    if (back.why !== 'arrived') throw new Error(`Drive back did not arrive: ${JSON.stringify(back)}`);
    await page.waitForTimeout(6000);
    await page.evaluate(([y]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = 0.04; }, [plan.road.yaw]);
    report.road.after = await lookState();
    const keyOf = s => JSON.stringify([s.sunDir, s.lightDirection, s.lights, s.fog, s.environmentIntensity, s.frame?.owner, s.frame?.roadSky, s.frame?.air]);
    report.road.exact = keyOf(report.road.after) === keyOf(report.road.before);
    // and in again: the shard's own look must be what it was on the first entry
    const again = await driveTo(plan.again);
    report.drives.push({ phase: 'again', ...again });
    await page.waitForTimeout(6000);
    const first = report.stops.find(s => s.name === 'inside')?.look ?? null;
    report.inside = { again: await lookState() };
    // a clocked shard's sun moves between visits, so the static parts compare exactly and the clocked ones are listed
    report.inside.exactOwner = first !== null && JSON.stringify([first.frame?.owner, first.frame?.roadSky, first.frame?.chain]) === JSON.stringify([report.inside.again.frame?.owner, report.inside.again.frame?.roadSky, report.inside.again.frame?.chain]);
    report.inside.exactLight = first !== null && keyOf(first) === keyOf(report.inside.again);
  }
  await context.close();
  if (video) {
    const webm = readdirSync(out).find(f => f.endsWith('.webm'));
    if (webm) renameSync(join(out, webm), join(out, `${scene}-drive.webm`));
  }
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `drive-${scene}${video ? '-video' : ''}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), shaderErrors: report.shaderErrors, roadExact: report.road?.exact ?? null, inside: report.inside ? { owner: report.inside.exactOwner, light: report.inside.exactLight } : null,
  stops: report.stops.map(s => ({ stop: s.name, programs: s.look.programs, glMB: s.look.glMB, roadSky: s.look.frame?.roadSky, owner: s.look.frame?.owner, skies: s.look.frame?.skies })), road: report.road ? { programs: report.road.before.programs, glMB: report.road.before.glMB, roadSky: report.road.before.frame?.roadSky, after: report.road.after?.programs } : null }));
if (report.failure) process.exitCode = 1;
