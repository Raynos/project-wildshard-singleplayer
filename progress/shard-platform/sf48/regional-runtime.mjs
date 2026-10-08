// E435 / SF48-g: one initial road placement, then real input through Nalati's west entry and back, twice.
// Run through scripts/browser-lane.sh against a pinned scripts/serve-build.sh preview. No stuck recovery teleports.
import { writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { installResources } from '../../../scripts/parity/resources.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const flag = (name, fallback) => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = flag('url', ''), output = flag('out', 'nalati-regional-runtime.json');
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
  result.route = await page.evaluate(async () => {
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
    observations.push(observe('road.before'));
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
      for (let visit = 0; visit < 2; visit++) {
        await walk(interior, true); observations.push(observe(`inside.${visit}`));
        await walk(road, false); observations.push(observe(`road.${visit}`));
      }
      return { destination, road, interior, observations, legs, end: read() };
    } catch (error) { return { destination, road, interior, observations, legs, failure: String(error?.stack ?? error), end: read() }; } finally { input.clear(); }
  });
  if (result.route.failure) result.failure = result.route.failure;
  await page.screenshot({ path: output.replace(/\.json$/u, '.jpg'), type: 'jpeg', quality: 72 });
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
console.log(JSON.stringify({ failure: result.failure ?? null, errors: result.errors, consoleErrorCount: result.consoleErrors.length,
  firstConsoleErrors: result.consoleErrors.slice(0, 3), legs: result.route?.legs.length ?? 0,
  disposalErrorCount: result.leak?.disposalErrors.length ?? null, firstDisposalErrors: result.leak?.disposalErrors.slice(0, 4) ?? null }));
if (result.failure || result.leakFailure || result.errors.length || result.leak?.disposalErrors.length) process.exitCode = 1;
