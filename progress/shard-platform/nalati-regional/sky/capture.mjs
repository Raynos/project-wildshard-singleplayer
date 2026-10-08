// E435 / G223 (SF48-g): the page's one sky before entering Nalati, inside it, and on the road after leaving, twice.
// Real input through Nalati's west entry and back (from sf48/regional-runtime.mjs); at each stop the camera faces the
// same way and the shared light is read (sky rig, painterly, grade chain, volumetrics, frame) and a frame captured.
// Run through scripts/browser-lane.sh against a pinned `scripts/serve-build.sh --head` preview.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { installResources } from '../../../../scripts/parity/resources.mjs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const flag = (name, fallback) => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), output = flag('out', 'sky.json'), shots = flag('shots', '.');
const visits = Number(flag('visits', '2'));
if (base === '') throw new Error('Pass --url=<pinned preview> and --out=<receipt>');
let page;
const result = { diagnostic: true, base, started: new Date().toISOString(), errors: [], consoleErrors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(installResources);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
  page = await context.newPage();
  page.on('pageerror', error => { result.errors.push(error.message); console.log('pageerror:', error.message); });
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  result.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  result.boot = await page.evaluate(() => window.__wildshard.shard.grid.state());
  console.log('grid booted');
  const routing = page.evaluate(async (visits) => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    const read = () => api.shard.grid.state();
    const destination = read().cells.find(cell => cell.slug === 'nalati-grasslands');
    if (!destination) throw new Error('Nalati is missing from the actual grid catalogue');
    const origin = destination.origin ?? { x: destination.cell[0] * 555, z: destination.cell[1] * 555 };
    const road = { x: origin.x - 277.5, z: origin.z };
    const interior = { x: origin.x - 231, z: origin.z };
    const initial = read().live.live, frameOrigin = { x: initial.worldFeet.x - player.position.x, z: initial.worldFeet.z - player.position.z };
    input.clear(); player.velocity.set(0, 0, 0); player.setHover(false);
    player.spawn(road.x - frameOrigin.x, road.z - frameOrigin.z, -Math.PI / 2); player.position.y = 0.5; player.prevFeet.copy(player.position);
    const wait = async (predicate, label) => {
      const until = performance.now() + 180_000;
      while (!predicate(read())) {
        if (performance.now() > until) throw new Error(`${label} timed out: ${JSON.stringify(read().live)}`);
        await new Promise(resolve => { setTimeout(resolve, 100); });
      }
    };
    await wait(state => state.live.live.current === null && player.onGround, 'Initial road frame');
    const observations = [], legs = [];
    const observe = label => {
      const state = read(), app = world.game.app;
      return { label, current: state.live.live.current, ready: state.live.live.gameplayReady, feet: state.live.live.worldFeet,
        systems: Object.fromEntries(Object.entries(app.systemsByPhase()).map(([phase, systems]) => [phase, systems.map(system => system.id)])),
        activeLevel: world.game.level.id, appState: app.state, hudPaused: world.hud.paused, playerEnabled: player.enabled, census: app.levelScope?.census ?? null, grid: state };
    };
    const light = () => {
      const sky = world.sky, post = world.game.post, march = world.game.volumetrics?.marchUniforms ?? null, round = n => Math.round(n * 1e5) / 1e5;
      const arr = v => v.toArray().map(round);
      const halo = sky.sunDisc.children.find(c => c.isSprite) ?? null;
      return {
        sunDir: arr(sky.sunDir), sunColor: arr(sky.sunColor), lights: sky.csm.lights.map(l => [arr(l.color), round(l.intensity), l.shadow.mapSize.x]), mapSize: sky.csm.shadowMapSize,
        hemi: [arr(sky.hemi.color), arr(sky.hemi.groundColor), round(sky.hemi.intensity)],
        disc: [sky.sunDisc.visible, arr(sky.sunDisc.scale), sky.sunDisc.material.color ? arr(sky.sunDisc.material.color) : null], halo: halo ? [arr(halo.scale), round(halo.material.opacity)] : null,
        painterly: Object.fromEntries(Object.entries(window.__painterly).filter(([k]) => k !== 'uPTime').map(([k, u]) => [k, typeof u.value === 'number' ? round(u.value) : arr(u.value)])),
        grade: post ? [post.saturation.saturation, post.contrast.contrast, post.contrast.brightness].map(round) : null,
        volumetrics: march ? Object.fromEntries(['uSunDir', 'uSunColor', 'uFogColor', 'uHeight', 'uFalloff', 'uDensity', 'uStrength'].map(k => [k, typeof march[k].value === 'number' ? round(march[k].value) : arr(march[k].value)])) : null,
      };
    };
    const frame = () => read().frame ?? null;
    const settle = async () => { for (let i = 0; i < 90; i++) await new Promise(resolve => { requestAnimationFrame(resolve); }); };
    const pose = async (yaw) => { input.clear(); player.yaw = yaw; player.pitch = 0.12; await settle(); };
    const stop = async label => { await pose(-Math.PI / 2); const o = { label, ...observe(label), light: light(), frame: frame() }; delete o.systems; delete o.grid; observations.push(o); window.__skyStop = label; await new Promise(resolve => { window.__skyShot = resolve; }); };
    // the page's own clock is held still, so a road-after difference can only be what the region left behind
    const clock = world.game.app.dayCycle;
    if (clock) clock.paused = true;
    await stop('road.before');
    async function walk(target, entered) {
      const trace = [], stuck = [], start = read().live.live, startWall = performance.now();
      let elapsed = 0, lastDistance = Infinity, lastAdvance = 0;
      let failure;
      try { await new Promise((resolve, reject) => {
        let stop = () => undefined;
        const timeout = setTimeout(() => { finish(new Error('Real-input Nalati walk timed out')); }, 180_000);
        function finish(error) { input.clear(); stop(); clearTimeout(timeout); if (error) reject(error); else resolve(); }
        stop = world.game.watchFrames(dt => {
          try {
            elapsed += dt;
            const state = read().live.live, feet = state.worldFeet;
            trace.push({ t: elapsed, ...feet, current: state.current, ready: state.gameplayReady, appState: world.game.app.state, hudPaused: world.hud.paused, motor: player.motor.collider.isEnabled() });
            if (![feet.x, feet.y, feet.z].every(Number.isFinite) || feet.y < -0.25) { finish(new Error('Traveller fell or became nonfinite')); return; }
            const dx = target.x - feet.x, dz = target.z - feet.z, distance = Math.hypot(dx, dz);
            const expected = entered ? destination.instance : null;
            if (distance < 0.8 && state.current === expected && state.gameplayReady) { finish(); return; }
            if (state.gameplayReady === false) { input.clear(); lastAdvance = elapsed; return; }
            if (distance < lastDistance - 0.2) { lastDistance = distance; lastAdvance = elapsed; }
            else if (elapsed - lastAdvance > 3) { stuck.push({ ...feet, current: state.current }); finish(new Error('Traveller stuck; no recovery teleport')); return; }
            player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
          } catch (error) { finish(error); }
        });
      });
      } catch (error) { failure = String(error?.stack ?? error); }
      const end = read().live.live;
      legs.push({ entered, start, end, trace: trace.filter((_, index) => index % 6 === 0), stuck, failure: failure ?? null, wallMs: performance.now() - startWall });
      if (failure) throw new Error(failure);
    }
    try {
      for (let visit = 0; visit < visits; visit++) {
        await walk(interior, true); await stop(`inside.${visit}`);
        await walk(road, false); await stop(`road.after.${visit}`);
      }
      window.__skyStop = 'done';
      return { destination, road, interior, observations, legs, end: read() };
    } catch (error) { window.__skyStop = 'done'; return { destination, road, interior, observations, legs, failure: String(error?.stack ?? error), end: read() }; } finally { input.clear(); }
   }, visits);
  for (;;) {
    const label = await page.waitForFunction(() => window.__skyStop ?? null, null, { timeout: 600_000, polling: 250 }).then(h => h.jsonValue());
    if (label === 'done') break;
    await page.screenshot({ path: join(shots, `${label}.jpg`), type: 'jpeg', quality: 70 });
    await page.evaluate(() => { window.__skyStop = null; window.__skyShot(); });
  }
  result.route = await routing;
  const stops = result.route.observations ?? [];
  const before = stops.find(o => o.label === 'road.before');
  result.compare = stops.filter(o => o.label.startsWith('road.after')).map(o => ({ label: o.label, sameLight: JSON.stringify(o.light) === JSON.stringify(before?.light),
    differs: Object.keys(o.light).filter(k => JSON.stringify(o.light[k]) !== JSON.stringify(before?.light[k])) }));
  result.inside = stops.filter(o => o.label.startsWith('inside')).map(o => ({ label: o.label, differs: Object.keys(o.light).filter(k => JSON.stringify(o.light[k]) !== JSON.stringify(before?.light[k])) }));
  if (result.route.failure) result.failure = result.route.failure;
  try { result.leak = await page.evaluate(() => window.__wildshard.leak()); }
  catch (error) { result.leakFailure = String(error?.stack ?? error); }
  await context.close();
} catch (error) {
  result.failure = String(error?.stack ?? error);
  if (page && !page.isClosed()) {
    result.diagnosticState = await page.evaluate(() => ({ text: document.body.textContent?.slice(0, 2000), grid: window.__wildshard?.shard?.grid?.state() })).catch(error => ({ failure: String(error) }));
    await page.screenshot({ path: output.replace(/\.json$/u, '.jpg'), type: 'jpeg', quality: 72 }).catch(() => undefined);
  }
}
finally { await browser.close(); writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); }
console.log(JSON.stringify({ failure: result.failure ?? null, errors: result.errors, consoleErrors: result.consoleErrors.length,
  legs: result.route?.legs.length ?? 0, compare: result.compare ?? null, inside: result.inside ?? null, disposalErrors: result.leak?.disposalErrors ?? null }));
if (result.failure || result.leakFailure || result.errors.length || result.leak?.disposalErrors.length) process.exitCode = 1;
