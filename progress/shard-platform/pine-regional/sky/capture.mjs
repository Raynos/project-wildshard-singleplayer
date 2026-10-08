// E435 / G223 (pine-sky): Pine Hollow standalone vs Pine entered from the grid with Settings ▸ Debug ▸ Region sky on A (one
// grid sky) or B (the region's own), at the same cell-local poses; a WebGL byte census at every stop; and the road sky read
// before entry, after leaving and after re-entering + leaving again (it must come back exactly).
// Grown from ../visuals/capture.mjs. Run through scripts/browser-lane.sh against a `scripts/serve-build.sh --head` (or `--rev`) preview; `--dev=0` boots without Developer:
//   node capture.mjs --url=http://127.0.0.1:44xx --mode=grid|standalone --sky=shared|own --out=<receipt.json> --shots=<dir> [--prefix=<label>]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { debugSettings, saveFixture } from '../../../../scripts/debug-settings.mjs';
import { GL_INIT } from '../../../../scripts/parity/glbytes.mjs';

const flag = (name, fallback) => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), mode = flag('mode', 'grid'), sky = flag('sky', 'shared'), output = flag('out', `${mode}.json`), shots = flag('shots', '.'), prefix = flag('prefix', `${mode}-${sky}`), dev = flag('dev', '1') === '1';
if (base === '') throw new Error('Pass --url=<pinned preview>');
// cell-local poses (Pine's own level coordinates); the grid walk enters at the east socket (x = +250, z = 0)
const POSES = [
  { label: 'east-inside', x: 231, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep', x: 180, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep-up', x: 180, z: 0, yaw: Math.PI / 2 + 0.7, pitch: 0.35 },
];
const ROAD = { label: 'road', x: 277.5, z: 0, yaw: Math.PI / 2, pitch: 0.05 };
const result = { diagnostic: true, base, mode, sky, dev, started: new Date().toISOString(), errors: [], consoleErrors: [], stops: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let page;
// what the frame draws and what lights it (runs in the browser)
const census = () => {
  const api = window.__wildshard, game = api.world.game, scene = game.rootScene, player = api.world.player;
  const r6 = n => Math.round(n * 1e6) / 1e6;
  const col = c => (c ? [r6(c.r), r6(c.g), r6(c.b)] : null);
  // the shared sky state a layered backdrop moves (key light, fill, fog, environment): exact values, so leave / re-enter can be compared
  const lights = [];
  // sky lights only (key, fill, ambient): a region's lamps are its world, not its sky; the key's direction, not its follow-the-player position
  scene.traverse(o => { if ((o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight) && o.visible) lights.push({ type: o.type, name: o.name, intensity: r6(o.intensity), color: col(o.color), ...(o.groundColor ? { ground: col(o.groundColor) } : {}), ...(o.isDirectionalLight ? { dir: (() => { const v = o.position.clone().sub(o.target.position).normalize(); return v.toArray().map(n => Math.round(n * 1e4) / 1e4); })() } : {}) }); });
  const fog = scene.fog ? { color: col(scene.fog.color), near: scene.fog.near ?? null, far: scene.fog.far ?? null, density: scene.fog.density ?? null } : null;
  const shared = { lights, fog, environment: scene.environment?.uuid ?? null, environmentIntensity: r6(scene.environmentIntensity ?? 1), background: scene.background?.isColor ? col(scene.background) : (scene.background?.uuid ?? null) };
  const gl = typeof window.__sc_gl === 'function' ? window.__sc_gl().map(({ gl: _gl, resources, ...c }) => ({ totalBytes: c.totalBytes, texBytes: c.texBytes, bufBytes: c.bufBytes, rbBytes: c.rbBytes, textures: c.textures, buffers: c.buffers })) : [];
  const grid = api.shard?.grid?.state();
  const live = grid?.live?.live ?? null;
  return { level: game.level?.id, feet: player.position.toArray().map(n => Math.round(n * 100) / 100), world: live?.worldFeet ?? null, current: live?.current ?? null,
    ready: live?.gameplayReady ?? null, info: game.renderer?.info?.render ? { calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles } : null,
    glMB: Math.round(gl.reduce((s, c) => s + c.totalBytes, 0) / 1e4) / 100, gl, shared,
    screens: grid?.screens ? JSON.parse(JSON.stringify(grid.screens)) : null, frame: grid?.frame ? { roadSky: grid.frame.roadSky ?? null, skies: grid.frame.skies ?? null, owner: grid.frame.owner ?? null } : null };
};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await context.addInitScript(GL_INIT);
  if (dev) await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await debugSettings(context, { regionSky: sky });
  page = await context.newPage();
  page.on('pageerror', error => { result.errors.push(error.message); console.log('pageerror:', error.message); });
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text().slice(0, 400)); });
  const settle = () => page.evaluate(async () => { for (let i = 0; i < 90; i++) await new Promise(resolve => { requestAnimationFrame(resolve); }); });
  const hold = pose => page.evaluate(p => { const w = window.__wildshard.world, pl = w.player; w.game.app.input.clear(); pl.yaw = p.yaw; pl.pitch = p.pitch; const clock = w.game.app.dayCycle; if (clock) clock.paused = true; }, pose);
  const stop = async (pose, extra = {}, label = pose.label) => {
    await hold(pose); await settle();
    const c = await page.evaluate(census);
    result.stops.push({ ...pose, label, ...extra, census: c });
    await page.screenshot({ path: join(shots, `${prefix}.${label}.jpg`), type: 'jpeg', quality: 70 });
    return c;
  };
  if (mode === 'standalone') {
    for (const pose of POSES) {
      await page.goto(`${base}/?chunk=pine-hollow&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1&x=${pose.x}&z=${pose.z}&yaw=${pose.yaw}&pitch=${pose.pitch}`, { waitUntil: 'commit', timeout: 300_000 });
      await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.state === 'play' && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
      await stop(pose);
    }
  } else {
    await page.goto(`${base}/?tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
    result.version = await page.evaluate(async () => (await fetch('/version.json')).json());
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
    result.setting = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /settings/u.test(k)) ?? '') ?? 'null')?.regionSky ?? null).catch(() => null);
    console.log('grid booted');
    // walk to a cell-local target with real input; `inside` = finish inside Pine (true) or back on the road (false)
    const walk = (target, label, inside) => page.evaluate(async ({ target, label, inside }) => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input, read = () => api.shard.grid.state();
      const pine = read().cells.find(cell => cell.slug === 'pine-hollow');
      const origin = pine.origin ?? { x: pine.cell[0] * 555, z: pine.cell[1] * 555 };
      const goal = { x: origin.x + target.x, z: origin.z + target.z };
      if (label === 'spawn') {
        const initial = read().live.live, frameOrigin = { x: initial.worldFeet.x - player.position.x, z: initial.worldFeet.z - player.position.z };
        input.clear(); player.velocity.set(0, 0, 0); player.setHover(false);
        player.spawn(goal.x - frameOrigin.x, goal.z - frameOrigin.z, Math.PI / 2); player.position.y = 0.5; player.prevFeet.copy(player.position);
        const until = performance.now() + 60_000;
        while (!(read().live.live.current === null && player.onGround)) { if (performance.now() > until) throw new Error('road spawn timed out'); await new Promise(r => { setTimeout(r, 100); }); }
        return { ok: true };
      }
      return await new Promise(resolve => {
        let elapsed = 0, best = Infinity, lastAdvance = 0;
        const stop = world.game.watchFrames(dt => {
          elapsed += dt;
          const s = read().live.live, f = s.worldFeet, dx = goal.x - f.x, dz = goal.z - f.z, d = Math.hypot(dx, dz);
          const there = inside ? (s.current === 'pine-hollow' && s.gameplayReady) : s.current === null;
          if (d < 0.8 && there) { input.clear(); stop(); resolve({ ok: true, elapsed, feet: f }); return; }
          if (inside && !s.gameplayReady) { input.clear(); lastAdvance = elapsed; if (elapsed > 240) { stop(); resolve({ ok: false, why: 'not ready', feet: f, issues: s.issues }); } return; }
          if (d < best - 0.2) { best = d; lastAdvance = elapsed; } else if (elapsed - lastAdvance > 4) { input.clear(); stop(); resolve({ ok: false, why: 'stuck', feet: f, current: s.current }); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
    }, { target, label, inside });
    result.spawn = await walk(ROAD, 'spawn', false);
    await settle();
    // Pine's readiness on the road (a waiting / refused cell explains a stuck walk)
    result.pineOnRoad = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(), live = s.live?.live; const cell = s.cells.find(c => c.slug === 'pine-hollow');
      return JSON.parse(JSON.stringify({ cell, issues: live?.issues ?? null, ready: live?.ready ?? null }, (k, v) => (typeof v === 'function' ? undefined : v))); }).catch(error => String(error));
    const before = await stop(ROAD, {}, 'road-before');
    // every GL resource on the road before entry (an A / B difference here is not the region's sky, which is not built yet)
    result.roadResources = await page.evaluate(() => window.__sc_gl().flatMap(c => c.resources.map(r => [r.kind, r.bytes, r.owner, r.asset].join('|'))));
    for (const pose of POSES) {
      const leg = await walk(pose, pose.label, true);
      console.log(pose.label, JSON.stringify(leg));
      await stop(pose, { leg });
      if (!leg.ok) break;
    }
    // leave, re-enter, leave: the road sky must come back exactly each time
    const out1 = await walk(ROAD, 'leave', false);
    const after = await stop(ROAD, { leg: out1 }, 'road-after-leave');
    const back = await walk(POSES[0], 're-enter', true);
    await stop(POSES[0], { leg: back }, 're-enter.east-inside');
    const out2 = await walk(ROAD, 'leave-2', false);
    const after2 = await stop(ROAD, { leg: out2 }, 'road-after-re-enter');
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    result.roadSky = { exactAfterLeave: same(before.shared, after.shared), exactAfterReEnter: same(before.shared, after2.shared),
      skiesOnRoad: [before.frame?.skies, after.frame?.skies, after2.frame?.skies], glMB: [before.glMB, after.glMB, after2.glMB] };
  }
  await context.close();
} catch (error) {
  result.failure = String(error?.stack ?? error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(shots, `${prefix}.failure.jpg`), type: 'jpeg', quality: 70 }).catch(() => undefined);
} finally { await browser.close(); writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); }
console.log(JSON.stringify({ failure: result.failure ?? null, errors: result.errors, roadSky: result.roadSky ?? null, stops: result.stops.map(s => ({ label: s.label, ok: s.leg?.ok ?? true, current: s.census.current, glMB: s.census.glMB, skies: s.census.frame?.skies })) }));
if (result.failure) process.exitCode = 1;
