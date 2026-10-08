// G232 (SHARD-PLATFORM SF63, E435): sf63/drive.mjs plus the frame's carried grade chain (`frame.chain`: owner, weight,
// LUT drawn, the page grade values) on the road before entry, at each stop and after driving back out, and each shot's
// player pose in shard-local metres (`poses`, for ../playtest-2-drivein/standalone.mjs at the same spots).
// From SF63 (SHARD-PLATFORM, E435), from playtest round 2's drive-in: a Developer-ON grid boot, a pose onto the road only, then a
// held-input drive into the cell (never a teleport inside it), and the captures at each stop, with the region look census
// ([region look] lines), shader errors, the renderer's program count and GL bytes at each stop.
// SF63 part 2: GL MB from the GL byte census (scripts/parity/glbytes.mjs `__sc_gl`, the readout pine-sky2 used), the region
// look's live uniforms inside the cell (its origin, toon / painted-fog values, sampled twice to show the per-frame drive),
// and the page read-back: the road's shared light and a road material's uniforms before entry and after driving back out.
// scripts/browser-lane.sh node progress/shard-platform/g232-grade/drive.mjs --url=<preview> --out=<dir> --tag=<before|after> --scene=<plot|nalati|pine> [--settings='{"regionSky":"own"}']
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), tag = arg('tag'), scene = arg('scene'), settings = JSON.parse(arg('settings') || 'null');
if (!base || !out || !tag || !scene) throw new Error('Pass --url, --out, --tag and --scene');
mkdirSync(out, { recursive: true });
const E = -Math.PI / 2, N = Math.PI, W = Math.PI / 2, S = 0; // forward = (-sin yaw, -cos yaw): +x east, +z north
/** each scene: a road pose (grid metres), the held-input waypoints into the cell, then the shots (yaw, pitch) at each stop */
const SCENES = {
  plot: { road: { x: 555, z: -277.5, yaw: S }, stops: [
    { at: [{ x: 555, z: -330 }], shots: [['plot-entry-s', S, 0.12]] },
    { at: [{ x: 555, z: -470 }], shots: [['plot-mid-s', S, 0.08], ['plot-mid-n', N, 0.08], ['plot-mid-e', E, 0.08], ['plot-mid-w', W, 0.08]] },
  ] },
  nalati: { road: { x: 277.5, z: 0, yaw: E }, stops: [
    { at: [{ x: 322, z: 0 }], shots: [['nalati-entry-road-e', E, 0.3], ['nalati-entry-n', N, 0.03], ['nalati-entry-w', W, 0.03]] },
    { at: [{ x: 470, z: 0 }], shots: [['nalati-inside-e', E, 0.05], ['nalati-inside-n', N, 0.03], ['nalati-inside-w', W, 0.03]] },
  ], back: [{ x: 322, z: 0 }, { x: 277.5, z: 0 }] },
  driftwood: { road: { x: 277.5, z: 0, yaw: W }, stops: [
    { at: [{ x: 230, z: 0 }], shots: [['driftwood-entry-w', W, 0.05]] },
    { at: [{ x: 120, z: 0 }], shots: [['driftwood-inside-w', W, 0.08], ['driftwood-inside-n', N, 0.08]] },
  ], back: [{ x: 230, z: 0 }, { x: 277.5, z: 0 }] },
  pine: { road: { x: 0, z: 277.5, yaw: N }, stops: [
    { at: [{ x: 0, z: 330 }], shots: [['pine-entry-n', N, 0.05]] },
    { at: [{ x: 0, z: 470 }, { x: 60, z: 555 }], shots: [['pine-forest-e', E, 0.05]] },
    { at: [{ x: 120, z: 555 }], shots: [['pine-forest-120-e', E, 0.05], ['pine-forest-120-n', N, 0.05]] },
  ], back: [{ x: 60, z: 555 }, { x: 0, z: 470 }, { x: 0, z: 330 }, { x: 0, z: 277.5 }] },
};
const plan = SCENES[scene];
if (!plan) throw new Error(`Unknown scene ${scene}`);
const report = { base, tag, scene, stops: [], errors: [], console: [], look: [], shaderErrors: 0, poses: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await context.addInitScript(GL_INIT);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  if (settings !== null) await debugSettings(context, settings); // a Debug row (pause ▸ Settings ▸ Debug), never a URL switch
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  page.on('console', m => {
    const text = m.text();
    if (text.startsWith('[region look]')) report.look.push(text);
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
  // the road pose (grid metres → the live home frame)
  await page.evaluate(async road => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: road.x - origin.x, y: 0.55, z: road.z - origin.z, yaw: road.yaw, pitch: 0 });
  }, plan.road);
  await page.waitForTimeout(5000);
  const driveTo = waypoints => page.evaluate(async waypoints => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
      const oldLimit = player.hoverSpeedLimit; let distance = 100;
      player.setHover(true); input.clear();
      player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
      const started = performance.now();
      try {
        return await new Promise(resolve => {
          let stopWatch = () => undefined, waypoint = 0;
          const finish = why => { stopWatch(); input.clear(); const s = api.shard.grid.state(); resolve({ why, seconds: (performance.now() - started) / 1000, feet: s.live?.live?.worldFeet, current: s.live?.live?.current ?? null, inside: s.inside ?? null }); };
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
    }, waypoints);
  // the page's own look as the road sees it: the shared light and every value of a road material's uniforms (clocks aside)
  const pageState = uuid => page.evaluate(uuid => {
    const api = window.__wildshard, game = api.world.game, scene = game.rootScene, props = game.renderer.properties;
    const r6 = n => Math.round(n * 1e6) / 1e6, val = v => (typeof v === 'number' ? r6(v) : v?.isColor || v?.isVector2 || v?.isVector3 || v?.isVector4 ? v.toArray().map(r6) : undefined);
    const inRegion = o => { for (let n = o; n; n = n.parent) if (n.name?.startsWith('region:')) return true; return false; };
    const lights = [];
    scene.traverse(o => { if ((o.isDirectionalLight || o.isHemisphereLight) && o.visible) lights.push([o.type, r6(o.intensity), val(o.color), o.groundColor ? val(o.groundColor) : null]); });
    let road = null;
    scene.traverse(o => {
      if (road !== null || !o.isMesh || !o.visible || inRegion(o) || (uuid !== undefined && o.uuid !== uuid)) return;
      const u = props.get(o.material)?.uniforms;
      if (!u || !('fogDistDensity' in u)) return;
      const values = {};
      for (const [k, x] of Object.entries(u)) { if (/time|Time/u.test(k)) continue; const v = val(x?.value); if (v !== undefined) values[k] = v; }
      road = { uuid: o.uuid, mesh: o.name || o.type, material: o.material.type, program: props.get(o.material)?.currentProgram?.cacheKey?.slice(-60) ?? null, values };
    });
    return { lights, fog: scene.fog ? val(scene.fog.color) : null, environmentIntensity: r6(scene.environmentIntensity ?? 1), road, programs: game.renderer.info.programs?.length ?? null };
  }, uuid);
  // the region look's live uniforms inside the cell (a patched material of the current region)
  const lookState = () => page.evaluate(() => {
    const api = window.__wildshard, game = api.world.game, props = game.renderer.properties, live = api.shard.grid.state().live?.live;
    const r4 = n => Math.round(n * 1e4) / 1e4, val = v => (typeof v === 'number' ? r4(v) : v?.toArray ? v.toArray().map(r4) : v?.isTexture ? `texture:${v.name || v.uuid.slice(0, 8)}` : v === null ? null : undefined);
    let found = null;
    game.rootScene.traverse(o => {
      if (found !== null || !o.isMesh) return;
      let root = null; for (let n = o; n; n = n.parent) if (n.name?.startsWith('region:')) root = n.name;
      if (root === null || !root.endsWith(live?.current ?? '?')) return;
      const u = props.get(Array.isArray(o.material) ? o.material[0] : o.material)?.uniforms;
      if (!u || !('wsLookOrigin' in u)) return;
      const pick = {};
      for (const k of ['wsLookOrigin', 'uToonNight', 'uToonLift', 'uFogNear', 'uCloudTime', 'fogV2', 'fogEdgeV2', 'fogCloudOff', 'fogCloudTex', 'uV2KeyTint', 'fogDistDensity', 'fogHeightDensity']) if (k in u) pick[k] = val(u[k].value);
      found = { root, mesh: o.name || o.type, uniforms: pick };
    });
    return found;
  });
  const glMB = () => page.evaluate(() => { const gl = typeof window.__sc_gl === 'function' ? window.__sc_gl() : []; return Math.round(gl.reduce((s, c) => s + c.totalBytes, 0) / 1e4) / 100; });
  const chainState = () => page.evaluate(() => window.__wildshard.shard.grid.state().frame?.chain ?? null);
  report.road = { before: await pageState(), glMB: await glMB(), chain: await chainState() };
  for (const stop of plan.stops) {
    const drive = await driveTo(stop.at);
    await page.waitForTimeout(6000);
    const shots = [];
    for (const [name, yaw, pitch] of stop.shots) {
      await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(out, `${name}-${tag}.jpg`), type: 'jpeg', quality: 72 });
      shots.push(name);
      const pose = await page.evaluate(() => { const p = window.__wildshard.world.player.position, r = n => Math.round(n * 100) / 100; return [r(p.x), r(p.z), r(p.y)]; });
      report.poses.push([name, pose[0], pose[1], yaw, pitch, pose[2]]);
    }
    // the frames the stop was seen in: the player is region-local inside a cell, the camera is in the page's home frame
    const probe = await page.evaluate(() => {
      const api = window.__wildshard, c = api.world.game.camera.position, p = api.world.player.position, r = api.world.game.renderer;
      const gpu = window.__wildshardHarness?.gpuBytes?.() ?? null;
      const lookPrograms = {};
      for (const program of r.info.programs ?? []) { const id = /\|look:([\w-]+)/u.exec(program.cacheKey ?? '')?.[1]; if (id) lookPrograms[id] = (lookPrograms[id] ?? 0) + 1; }
      return { player: [p.x, p.y, p.z], camera: [c.x, c.y, c.z], programs: r.info.programs?.length ?? null, lookPrograms, memory: { ...r.info.memory },
        glMB: gpu === null ? null : Math.round(gpu.total / 1e5) / 10, skies: api.shard.grid.state().frame?.skies ?? null };
    });
    const look = await lookState(); await page.waitForTimeout(1000); const look2 = await lookState();
    report.stops.push({ drive, shots, probe: { ...probe, glMB: await glMB() }, look: [look, look2], chain: await chainState() });
  }
  if (plan.back) {
    const drive = await driveTo(plan.back);
    await page.waitForTimeout(6000);
    const after = await pageState(report.road.before.road?.uuid);
    // the look's shared uniforms only: three refreshes a material's own values (diffuse, roughness, scene fog near / far) at
    // its next draw, so a road mesh not yet drawn at the first read still holds three's defaults there
    const OWN = new Set(['diffuse', 'opacity', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'envMapIntensity', 'fogColor', 'fogNear', 'fogFar', 'fogDensity', 'flipEnvMap', 'ior', 'refractionRatio', 'reflectivity', 'specular', 'shininess', 'alphaTest', 'lightMapIntensity', 'aoMapIntensity', 'normalScale', 'displacementScale', 'displacementBias', 'bumpScale']);
    const look = road => Object.fromEntries(Object.entries(road?.values ?? {}).filter(([k]) => !OWN.has(k) && !/Transform$/u.test(k)));
    const same = JSON.stringify(after.lights) === JSON.stringify(report.road.before.lights) && JSON.stringify(look(after.road)) === JSON.stringify(look(report.road.before.road)) && after.fog?.join() === report.road.before.fog?.join() && after.environmentIntensity === report.road.before.environmentIntensity;
    const chainAfter = await chainState();
    report.road.after = after; report.road.back = drive; report.road.glMBAfter = await glMB(); report.road.chainAfter = chainAfter;
    report.road.readBackExact = same && JSON.stringify(chainAfter) === JSON.stringify(report.road.chain);
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `drive-${scene}-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), shaderErrors: report.shaderErrors, look: report.look, road: { glMB: report.road?.glMB, glMBAfter: report.road?.glMBAfter, chain: report.road?.chain, chainAfter: report.road?.chainAfter, readBackExact: report.road?.readBackExact ?? null }, poses: report.poses, stops: report.stops.map(s => ({ programs: s.probe.programs, glMB: s.probe.glMB, drive: s.drive.why, chain: s.chain })) }));
if (report.failure) process.exitCode = 1;
