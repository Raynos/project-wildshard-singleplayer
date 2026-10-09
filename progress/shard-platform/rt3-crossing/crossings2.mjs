// rt3-crossing (part 2: full program keys, per-frame program census, --profile=<slugs> CPU profiles per leg): time each grid crossing (Chromium, iPhone 16 Pro, muted, Developer on, phone tier, 2x, 4x CPU).
// Route: Driftwood home -> Pine -> Nalati -> Sky Reach -> Driftwood (re-entry), through the real fixed-step road drive.
//   scripts/browser-lane.sh node crossings.mjs --base=http://127.0.0.1:44xx/ --out=<dir> [--cpu=4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute, gridFloorWitnessFailures } = await import(`${ROOT}/scripts/frame-floor-grid.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (name, d) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d;
const PROFILE = flag('profile', ''); const BASE = flag('base'), OUT = flag('out'), CPU = Number(flag('cpu', '4')), ONLY = flag('only', '');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const fixtures = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0, time: 'midday' } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
].join(';');
function plansFor(state) {
  const pitch = 555, half = pitch / 2, inset = 230;
  const home = state.cells.find(c => c.instance === state.home);
  const by = slug => state.cells.find(c => c.slug === slug);
  const seq = [by('pine-hollow'), by('nalati-grasslands'), by('far-reach'), home].filter(Boolean);
  const origin = cell => ({ x: cell.cell[0] * pitch, z: cell.cell[1] * pitch });
  const h = origin(home); const plans = [];
  let source = home, portal = { x: h.x, z: h.z + half };
  for (const cell of seq) {
    const s = origin(source), d = origin(cell), dx = s.x - d.x, dz = s.z - d.z;
    const horizontal = cell !== home && Math.abs(dx) >= Math.abs(dz);
    const sign = cell === home ? 1 : Math.sign(horizontal ? dx : dz) || 1;
    const nextPortal = horizontal ? { x: d.x + sign * half, z: d.z } : { x: d.x, z: d.z + sign * half };
    const destination = horizontal ? { x: d.x + sign * inset, z: d.z } : { x: d.x, z: d.z + sign * inset };
    const waypoints = [portal];
    if (portal.x !== nextPortal.x || portal.z !== nextPortal.z) {
      const intersection = (p, toward) => Number.isInteger(p.x / pitch) ? { x: p.x + (Math.sign(toward.x - p.x) || 1) * half, z: p.z } : { x: p.x, z: p.z + (Math.sign(toward.z - p.z) || 1) * half };
      const a = intersection(portal, nextPortal), b = intersection(nextPortal, portal);
      waypoints.push(a, { x: b.x, z: a.z }, b, nextPortal);
    }
    waypoints.push(destination);
    const unique = waypoints.filter((p, i) => i === 0 || p.x !== waypoints[i - 1].x || p.z !== waypoints[i - 1].z);
    plans.push({ name: `${source.instance}-to-${cell.instance}`, from: source.instance, to: cell.instance, slug: cell.slug, origin: d,
      movement: 'road-hover', hoverMaxSpeed: 30, waypoints: unique, requiredResidents: [cell.instance], retiredResidents: [source.instance] });
    source = cell; portal = nextPortal;
  }
  return { reference: { x: h.x, z: h.z + inset }, plans };
}
// in-page sampler: 10 Hz state + every frame gap + long tasks with the hybrid hook running at their start
const SAMPLER = () => {
  if (window.__rt3) return;
  const rows = [], gaps = [], tasks = [];
  const hook = () => { try { const t = window.__wildshard.shard.grid.state().live?.runtimeTiming?.current; return t ? `${t.instance}:${t.hook}` : null; } catch { return null; } };
  try { new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push({ t: e.startTime, ms: e.duration, hook: hook() }); }).observe({ type: 'longtask', buffered: false }); } catch {}
  let last = performance.now(); const progs = []; let seen = new Set();
  const progScan = () => { try { const list = window.__wildshard.world.game.renderer.info.programs ?? []; for (const p of list) { if (!seen.has(p)) { seen.add(p); progs.push({ t: performance.now(), name: p.name, key: String(p.cacheKey), id: p.id, hook: hook(), gr: (() => { try { return window.__wildshard.shard.grid.state().live?.live?.gameplayReady ?? null; } catch { return null; } })() }); } } } catch {} };
  let plen = 0; const frame = (now) => { try { const n = window.__wildshard.world.game.renderer.info.programs?.length ?? 0; if (n !== plen) { plen = n; progScan(); } } catch {} const dt = now - last; last = now; if (dt > 100) gaps.push({ t: now - dt, ms: dt, hook: hook() }); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  setInterval(() => {
    progScan();
    try {
      const g = window.__wildshard.shard.grid, s = g.state(), l = s.live;
      rows.push({ t: performance.now(), cur: l?.live?.current ?? null, inside: s.inside ?? null, gr: l?.live?.gameplayReady ?? null, phase: l?.crossing?.phase, target: l?.crossing?.target ?? null,
        pend: l?.live?.pending ?? [], res: l?.live?.residents ?? [], feet: l?.live?.worldFeet ? { x: Math.round(l.live.worldFeet.x), z: Math.round(l.live.worldFeet.z) } : null,
        screens: s.screens?.shown?.map(x => x.instance) ?? null, hook: hook() });
    } catch (e) { rows.push({ t: performance.now(), err: String(e).slice(0, 120) }); }
  }, 100);
  window.__rt3 = { rows, gaps, tasks, progs, completed: () => { try { return window.__wildshard.shard.grid.state().live?.runtimeTiming?.completed ?? []; } catch { return []; } } };
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const result = { base: BASE, cpu: CPU, legs: [], errors: [], console: [] };
const save = () => { writeFileSync(join(OUT, 'result.json'), `${JSON.stringify(result, null, 1)}\n`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(`${fixtures};window.__wildshardHarness={seed:357,capture:null};`);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  page.on('console', (m) => { if (m.type() === 'error') result.console.push(m.text().slice(0, 300)); });
  page.setDefaultTimeout(600000);
  const t0 = Date.now();
  await page.goto(`${BASE}?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')), null, { timeout: 600000, polling: 500 });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const tClick = Date.now();
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100); });
  // cold grid start: record the loading screen's step line over time
  const loadLines = [];
  for (;;) {
    const st = await page.evaluate(() => ({ load: Boolean(document.querySelector('.ws-load')), text: document.querySelector('.ws-load')?.innerText?.split('\n').filter(l => /step|%/u.test(l)).slice(0, 3).join(' | ') ?? '', live: Boolean(window.__wildshard?.shard?.grid?.state().live?.live) })).catch(() => ({ load: true, text: 'navigating', live: false }));
    loadLines.push({ s: (Date.now() - tClick) / 1000, text: st.text });
    if (!st.load && st.live) break;
    if (Date.now() - tClick > 300000) throw new Error('grid did not load');
    await sleep(250);
  }
  result.coldLoad = { seconds: (Date.now() - tClick) / 1000, lines: loadLines };
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 60000, polling: 500 });
  result.version = await page.evaluate(() => fetch('/version.json').then((r) => r.json()));
  const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const route = plansFor(state);
  result.route = route.plans.map(p => p.name);
  const documentOrigin = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
  await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(documentOrigin)})`);
  await page.evaluate(`(${SAMPLER.toString()})()`);
  await sleep(4000);
  for (const plan of route.plans) {
    if (ONLY && !plan.slug.includes(ONLY) && plan.to !== state.home) continue;
    const prof = PROFILE && PROFILE.split(',').some(x => plan.slug.includes(x)) ? await context.newCDPSession(page) : null;
    if (prof) { await prof.send('Profiler.enable'); await prof.send('Profiler.setSamplingInterval', { interval: 1000 }); await prof.send('Profiler.start'); }
    const start = await page.evaluate(() => performance.now());
    let failure = null;
    try {
      const witness = await runFloorGridRoute(page, plan, documentOrigin);
      const f = gridFloorWitnessFailures(witness); if (f.length) failure = f.join('; ');
    } catch (e) { failure = String(e).slice(0, 400); }
    // stand inside until gameplay is ready (max 40 s)
    await page.waitForFunction((to) => { const l = window.__wildshard.shard.grid.state().live?.live; return l?.current === to && l.gameplayReady; }, plan.to, { timeout: 40000, polling: 100 }).catch(() => {});
    await sleep(2500);
    const data = await page.evaluate((st) => ({ rows: window.__rt3.rows.filter(r => r.t >= st), gaps: window.__rt3.gaps.filter(r => r.t >= st), tasks: window.__rt3.tasks.filter(r => r.t >= st), progs: window.__rt3.progs.filter(r => r.t >= st), completed: window.__rt3.completed().filter(r => r.start >= st) }), start);
    if (prof) { const { profile } = await prof.send('Profiler.stop'); writeFileSync(join(OUT, `${plan.slug}.cpuprofile`), JSON.stringify(profile)); }
    result.legs.push({ name: plan.name, to: plan.to, slug: plan.slug, origin: plan.origin, start, failure, ...data }); save();
    console.log(plan.name, failure ?? 'ok', data.rows.length);
  }
} catch (error) { result.failure = String(error?.stack ?? error); console.error(result.failure); }
finally { save(); await browser.close(); }
