// E435 / SF48-g: four actual midpoint walks, then a fresh page on the same persisted storage.
// Only initial road placements use spawn; each socket/inward/return leg uses normal input. No stuck recovery.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, devices } from 'playwright';
import { installResources } from '../../../scripts/parity/resources.mjs';
import { captureCaughtRestore } from './caught-restore.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const flag = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = flag('url', ''), out = flag('out', '.');
if (!base) throw new Error('Pass --url and --out');
mkdirSync(out, { recursive: true });
const report = { started: new Date().toISOString(), base, pages: [], errors: [], consoleErrors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(installResources);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
  for (let visit = 0; visit < 2; visit++) {
    const page = await context.newPage();
    page.on('pageerror', e => { report.errors.push({ visit, error: e.message }); console.log('pageerror', e.message.slice(0, 180)); });
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ visit, error: m.text() }); });
    const receipt = { visit, freshPage: visit === 1, legs: [] }; report.pages.push(receipt);
    const detachCaught = flag('caught', 'off') === 'on' ? await captureCaughtRestore(context, page, receipt) : async () => undefined;
    await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
    receipt.version = await page.evaluate(async () => (await fetch('/version.json')).json());
    receipt.storageBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('wildshard.save.')).map(k => [k, localStorage.getItem(k)])));
    if (visit === 1) {
      const key = 'wildshard.save.v2.nalati-grasslands', prior = report.pages[0].storageAfter?.[key], fresh = receipt.storageBefore[key];
      if (typeof prior !== 'string' || prior !== fresh) throw new Error('Fresh page did not retain the exact Nalati document');
      receipt.persistedNalati = { bytes: Buffer.byteLength(fresh), sha256: createHash('sha256').update(fresh).digest('hex'), identical: true };
    }
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
    console.log('boot', visit);
    for (const edge of ['west', 'south', 'east', 'north']) {
      const route = await page.evaluate(async edge => {
        const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
        const read = () => api.shard.grid.state(), live = () => read().live.live;
        const cell = read().cells.find(c => c.slug === 'nalati-grasslands');
        if (!cell) throw new Error('No Nalati cell');
        const origin = { x: cell.cell[0] * 555, z: cell.cell[1] * 555 };
        const dirs = { west: [-1, 0], south: [0, -1], east: [1, 0], north: [0, 1] }, [sx, sz] = dirs[edge];
        const road = { x: origin.x + sx * 277.5, z: origin.z + sz * 277.5 };
        const target = { x: origin.x + sx * 218.5, z: origin.z + sz * 218.5 };
        const frame = { x: live().worldFeet.x - player.position.x, z: live().worldFeet.z - player.position.z };
        input.clear(); player.velocity.set(0, 0, 0); player.setHover(false);
        player.spawn(road.x - frame.x, road.z - frame.z, Math.atan2(sx, sz)); player.position.y = 0.5; player.prevFeet.copy(player.position);
        const until = performance.now() + 180_000;
        while (!(live().current === null && player.onGround && live().gameplayReady)) {
          if (performance.now() > until) throw new Error(`Road placement not ready: ${JSON.stringify(live())}`);
          await new Promise(r => { setTimeout(r, 100); });
        }
        const legs = [], observations = [];
        async function walk(to, entering) {
          const trace = [], stuck = [], start = live().worldFeet, t0 = performance.now();
          let elapsed = 0, best = Infinity, lastAdvance = 0, failure = null;
          try { await new Promise((resolve, reject) => {
            let unwatch = () => undefined;
            const timer = setTimeout(() => { finish(new Error('Walk timeout')); }, 180_000);
            const caught = setInterval(() => { if (window.__sf48RestoreException) finish(new Error(window.__sf48RestoreException)); }, 100);
            function finish(e) { input.clear(); unwatch(); clearTimeout(timer); clearInterval(caught); if (e) reject(e); else resolve(); }
            unwatch = world.game.watchFrames(dt => {
              try {
                elapsed += dt; const state = live(), feet = state.worldFeet;
                trace.push({ t: elapsed, ...feet, current: state.current, ready: state.gameplayReady, grounded: player.onGround });
                if (![feet.x, feet.y, feet.z].every(Number.isFinite) || feet.y < -0.25) { finish(new Error('Fall/nonfinite')); return; }
                const dx = to.x - feet.x, dz = to.z - feet.z, distance = Math.hypot(dx, dz);
                if (distance < 0.25 && state.current === (entering ? cell.instance : null) && state.gameplayReady) { finish(); return; }
                if (!state.gameplayReady) { input.clear(); lastAdvance = elapsed; return; }
                if (distance < best - 0.2) { best = distance; lastAdvance = elapsed; }
                else if (elapsed - lastAdvance > 3) { stuck.push({ ...feet, current: state.current }); finish(new Error('Stuck without recovery')); return; }
                player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
              } catch (e) { finish(e); }
            });
          }); } catch (e) { failure = String(e?.stack ?? e); }
          const end = live();
          const depth = 250 - ((end.worldFeet.x - origin.x) * sx + (end.worldFeet.z - origin.z) * sz);
          legs.push({ entering, start, end: end.worldFeet, current: end.current, ready: end.gameplayReady, appState: world.game.app.state, hudPaused: world.hud.paused, crossing: read().live.crossing, grounded: player.onGround, depth, elapsed, wallMs: performance.now() - t0, stuck, failure, trace: trace.filter((_, i) => i % 6 === 0) });
          if (failure) throw new Error(failure);
          if (entering && (depth < 30 || Math.abs(end.worldFeet.y) > 0.1)) throw new Error(`Entry is not 30m inward on y=0: ${depth},${end.worldFeet.y}`);
          observations.push({ entering, systems: Object.fromEntries(Object.entries(world.game.app.systemsByPhase()).map(([phase, rows]) => [phase, rows.map(r => r.id)])) });
        }
        try { await walk(target, true); await walk(road, false); return { edge, origin, road, target, legs, observations }; }
        catch (e) { return { edge, origin, road, target, legs, observations, failure: String(e?.stack ?? e) }; }
        finally { input.clear(); }
      }, edge);
      receipt.legs.push(route);
      console.log('edge', visit, edge, route.failure ?? 'PASS', route.legs.map(l => ({ depth: l.depth, y: l.end.y, stuck: l.stuck.length })));
      await page.screenshot({ path: join(out, `page-${visit}-${edge}.jpg`), type: 'jpeg', quality: 65 });
      if (route.failure) { receipt.failure = route.failure; break; }
    }
    // Normal unload flushes the regional continuation. A NEW page below reads the same origin's persisted document.
    receipt.leak = await page.evaluate(() => window.__wildshard.leak());
    receipt.storageAfter = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('wildshard.save.')).map(k => [k, localStorage.getItem(k)])));
    await detachCaught();
    await page.close();
    if (receipt.failure) break;
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, 'walk.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.length, consoleErrors: report.consoleErrors.length, pages: report.pages.map(p => ({ visit: p.visit, failure: p.failure ?? null, routes: p.legs.length, disposalErrors: p.leak?.disposalErrors?.length ?? null })) }));
if (report.failure || report.errors.length || report.consoleErrors.length || report.pages.length !== 2 || report.pages.some(p => p.failure || p.legs.length !== 4 || p.leak?.disposalErrors?.length)) process.exitCode = 1;
