// E435 / G223 (pine-visuals): Pine Hollow standalone vs Pine entered from the grid, at the same cell-local poses.
// grid: boot INFINITE WILDSHARD, spawn on the road east of Pine, walk in through its east entry with real input, stop at
// each pose (same yaw / pitch), capture a frame and a scene census (what is drawn: the grid cell root, its far proxy and
// tiles, the region's own root, terrain, forest). standalone: `?chunk=pine-hollow&x=&z=&yaw=` at the same local poses.
// Run through scripts/browser-lane.sh against a `scripts/serve-build.sh --head` preview:
//   node capture.mjs --url=http://127.0.0.1:44xx --mode=grid|standalone --out=<receipt.json> --shots=<dir> [--prefix=<label>]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const flag = (name, fallback) => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), mode = flag('mode', 'grid'), output = flag('out', `${mode}.json`), shots = flag('shots', '.'), prefix = flag('prefix', mode);
if (base === '') throw new Error('Pass --url=<pinned preview>');
// cell-local poses (Pine's own level coordinates); the grid walk enters at the east socket (x = +250, z = 0)
const ALL_POSES = [
  { label: 'east-inside', x: 231, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep', x: 180, z: 0, yaw: Math.PI / 2, pitch: 0.05 },
  { label: 'east-deep-left', x: 180, z: 0, yaw: Math.PI / 2 + 0.7, pitch: 0.05 },
];
const POSES = ALL_POSES.slice(0, Number(flag('poses', String(ALL_POSES.length))));
const result = { diagnostic: true, base, mode, started: new Date().toISOString(), errors: [], consoleErrors: [], stops: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let page;
// what the frame draws, read from the page (runs in the browser)
const census = () => {
  const api = window.__wildshard, game = api.world.game, scene = game.rootScene, player = api.world.player;
  const cam = game.camera ?? api.world.camera;
  const shown = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
  const tree = (o, depth) => ({ name: o.name || o.type, visible: o.visible, shown: shown(o), meshes: (() => { let m = 0, v = 0; o.traverse(c => { if (c.isMesh || c.isInstancedMesh) { m++; if (shown(c)) v++; } }); return [m, v]; })(),
    ...(depth > 0 ? { children: o.children.filter(c => c.name).slice(0, 24).map(c => tree(c, depth - 1)) } : {}) });
  const top = scene.children.filter(c => /grid-cell:pine|region:pine/u.test(c.name)).map(c => tree(c, 2));
  // the region's own scene subtree, every child (named or not): what of Pine's world is drawn
  const region = scene.getObjectByName('region-scene:pine-hollow');
  const parts = region ? region.children.map(c => { const t = tree(c, 0); return `${t.name}:${t.shown ? 'shown' : 'hidden'}:${t.meshes.join('/')}`; }) : null;
  const live = api.shard?.grid?.state().live?.live ?? null;
  const field = game.level?.id;
  return { level: field, feet: player.position.toArray().map(n => Math.round(n * 100) / 100), world: live?.worldFeet ?? null, current: live?.current ?? null,
    ready: live?.gameplayReady ?? null, camera: cam ? cam.position.toArray().map(n => Math.round(n * 100) / 100) : null,
    info: game.renderer?.info?.render ? { calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles } : null,
    pine: top, parts, frame: api.shard?.grid?.state().frame ?? null };
};
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  page = await context.newPage();
  page.on('pageerror', error => { result.errors.push(error.message); console.log('pageerror:', error.message); });
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text().slice(0, 400)); });
  const settle = () => page.evaluate(async () => { for (let i = 0; i < 90; i++) await new Promise(resolve => { requestAnimationFrame(resolve); }); });
  if (mode === 'standalone') {
    for (const pose of POSES) {
      await page.goto(`${base}/?chunk=pine-hollow&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1&x=${pose.x}&z=${pose.z}&yaw=${pose.yaw}&pitch=${pose.pitch}`, { waitUntil: 'commit', timeout: 300_000 });
      await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.state === 'play' && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
      await page.evaluate(p => { const w = window.__wildshard.world, pl = w.player; w.game.app.input.clear(); pl.yaw = p.yaw; pl.pitch = p.pitch; const clock = w.game.app.dayCycle; if (clock) clock.paused = true; }, pose);
      await settle();
      result.stops.push({ ...pose, census: await page.evaluate(census) });
      await page.screenshot({ path: join(shots, `${prefix}.${pose.label}.jpg`), type: 'jpeg', quality: 70 });
    }
  } else {
    await page.goto(`${base}/?tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
    result.version = await page.evaluate(async () => (await fetch('/version.json')).json());
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
    console.log('grid booted');
    const walk = (target, label) => page.evaluate(async ({ target, label }) => {
      const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input, read = () => api.shard.grid.state();
      const pine = read().cells.find(cell => cell.slug === 'pine-hollow');
      const origin = pine.origin ?? { x: pine.cell[0] * 555, z: pine.cell[1] * 555 };
      const goal = { x: origin.x + target.x, z: origin.z + target.z };
      if (label === 'road') {
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
          if (d < 0.8 && s.current === 'pine-hollow' && s.gameplayReady) { input.clear(); stop(); resolve({ ok: true, elapsed, feet: f }); return; }
          if (!s.gameplayReady) { input.clear(); lastAdvance = elapsed; if (elapsed > 240) { stop(); resolve({ ok: false, why: 'not ready', feet: f, issues: s.issues }); } return; }
          if (d < best - 0.2) { best = d; lastAdvance = elapsed; } else if (elapsed - lastAdvance > 4) { input.clear(); stop(); resolve({ ok: false, why: 'stuck', feet: f, current: s.current }); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
    }, { target, label });
    result.road = await walk({ x: 277.5, z: 0 }, 'road');
    for (const pose of POSES) {
      const leg = await walk({ x: pose.x, z: pose.z }, pose.label);
      console.log(pose.label, JSON.stringify(leg));
      await page.evaluate(p => { const w = window.__wildshard.world, pl = w.player; w.game.app.input.clear(); pl.yaw = p.yaw; pl.pitch = p.pitch; const clock = w.game.app.dayCycle; if (clock) clock.paused = true; }, pose);
      await settle();
      result.stops.push({ ...pose, leg, census: await page.evaluate(census) });
      await page.screenshot({ path: join(shots, `${prefix}.${pose.label}.jpg`), type: 'jpeg', quality: 70 });
      if (!leg.ok) break;
    }
  }
  const probe = flag('probe', '');
  if (probe !== '') result.probe = await page.evaluate(readFileSync(probe, 'utf8')).catch(error => String(error));
  await context.close();
} catch (error) {
  result.failure = String(error?.stack ?? error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(shots, `${prefix}.failure.jpg`), type: 'jpeg', quality: 70 }).catch(() => undefined);
} finally { await browser.close(); writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); }
console.log(JSON.stringify({ failure: result.failure ?? null, errors: result.errors, stops: result.stops.map(s => ({ label: s.label, ok: s.leg?.ok ?? true, current: s.census.current })) }));
if (result.failure) process.exitCode = 1;
