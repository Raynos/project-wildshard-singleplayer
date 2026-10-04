// SF50-g / SF51-g: a shard's four midpoint entries on its live standalone world (?chunk=<slug>, the trusted runtime).
// (1) scans each 8 x 15 m socket footprint (shard-local, north = +z) with downward rays through the live physics world:
// any static surface above road height, a floor missing or under it, or water over it is a blocker; (2) walks the route
// file's legs edge <-> shard with the physics walk. A standalone shard's authored play bounds (Signal Dunes' +-200 m) would
// respawn a player at the 250 m edge; the grid's traversal owns horizontal limits instead (engine/world/bounds.ts: `grid()`),
// so the walk lifts the bounds system the same way, and only for the walk. Its runtime cells can't be walked in the grid
// yet (liveSession refuses a runtime-source cell until its hybrid admission, M3), so this standalone walk is the proof.
// scripts/browser-lane.sh node progress/shard-platform/sf50/entries.mjs --slug=<slug> --route=<file> --url=<served build> --out=<dir>
//   [--settings=<option>=<value>,…]  (core Settings picks, scripts/debug-settings.mjs)
//   [--device-save=<key>=<value>]…  (an authored Debug row's device slot, e.g. debug.plugin.nine-dragon-stack.nineDragonEntries=on)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { walkPhysicsLeg } = await import(`${ROOT}/scripts/physics-walk.mjs`);
const { debugSettings, saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', '.'), SLUG = flag('slug', ''), ROUTE = flag('route', '');
const SETTINGS = Object.fromEntries(flag('settings', '').split(',').filter(Boolean).map((kv) => kv.split('=')));
const DEVICE = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--device-save=')).map((a) => { const kv = a.slice(14), i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
const route = ROUTE ? JSON.parse(readFileSync(`${ROOT}/${ROUTE}`, 'utf8'))[SLUG] ?? [] : [];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { base: BASE, slug: SLUG, settings: SETTINGS, deviceSaves: DEVICE, footprints: [], legs: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  if (Object.keys(SETTINGS).length > 0) await debugSettings(ctx, SETTINGS);
  for (const [key, data] of Object.entries(DEVICE)) await saveFixture(ctx, { scope: 'device', key, data });
  try { result.build = (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build; } catch { /* unknown */ }
  await page.goto(`${BASE}/?chunk=${SLUG}&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
  await page.waitForTimeout(4000);
  result.footprints = await page.evaluate(() => {
    const w = window.__wildshard.world, ph = w.physics, R = ph.R, water = w.game.app.world.water;
    // the standalone level's chunk-edge walls (engine/physics/terrain.ts addEdgeWalls: 1 m thick, 0.8 m inside the edge, -60..400
    // m) yield to the platform in the grid (grid/session.ts), so they are no blocker of a socket footprint
    const edgeWall = (c) => { const he = c.shapeType() === 1 ? c.halfExtents() : null; return he !== null && Math.max(he.x, he.z) > 200 && Math.min(he.x, he.z) <= 1.5 && he.y > 200; };
    const rects = { north: [-4, 4, 235, 250], south: [-4, 4, -250, -235], east: [235, 250, -4, 4], west: [-250, -235, -4, 4] };
    return Object.entries(rects).map(([edge, [x0, x1, z0, z1]]) => {
      let rays = 0, maxY = -Infinity, minY = Infinity, above = 0, below = 0, wet = 0; const blockers = [];
      for (let x = x0 + 0.125; x < x1; x += 0.25) for (let z = z0 + 0.125; z < z1; z += 0.25) {
        rays++;
        const hit = ph.world.castRay(new R.Ray({ x, y: 200, z }, { x: 0, y: -1, z: 0 }), 400, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => !edgeWall(c));
        const y = hit === null ? -Infinity : 200 - hit.timeOfImpact;
        maxY = Math.max(maxY, y); minY = Math.min(minY, y);
        if (y > 0.02) { above++; if (blockers.length < 6) blockers.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(3) }); }
        else if (y < -0.02) { below++; if (blockers.length < 6) blockers.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: Number.isFinite(y) ? +y.toFixed(3) : 'none' }); }
        const surface = water?.surfaceAt?.(x, z) ?? null;
        if (surface !== null && surface >= y) wet++;
      }
      return { edge, rays, maxY: Number.isFinite(maxY) ? +maxY.toFixed(3) : null, minY: Number.isFinite(minY) ? +minY.toFixed(3) : null, above, below, wet, blockers };
    });
  });
  for (const f of result.footprints) console.log(`footprint ${f.edge}: ${f.rays} rays, y ${f.minY}..${f.maxY}, above ${f.above}, below ${f.below}, wet ${f.wet}`, f.blockers.length ? JSON.stringify(f.blockers) : '');
  if (route.length > 0) {
    result.boundsLifted = await page.evaluate(() => { const app = window.__wildshard.world.game.app; const had = app.systems.delete('engine.world.bounds'); app.sorted = null; return had; });
    for (const leg of route) {
      const r = await page.evaluate(walkPhysicsLeg, leg);
      const last = r.trace.at(-1) ?? [0, NaN, NaN, NaN], ys = r.trace.map((s) => s[2]);
      const summary = { name: leg.name, seconds: Math.round(last[0] * 10) / 10, end: { x: last[1], y: last[2], z: last[3] }, stuck: r.stuck,
        airFrames: r.trace.filter((s) => s[5] === 0).length, swimFrames: r.trace.filter((s) => s[7] === 1).length, minY: Math.min(...ys), maxY: Math.max(...ys) };
      result.legs.push(summary);
      console.log(`${leg.name}: ${summary.seconds}s end ${[summary.end.x, summary.end.y, summary.end.z].map((v) => Number(v).toFixed(2)).join(', ')} y ${summary.minY}..${summary.maxY} stuck ${r.stuck.length} air ${summary.airFrames} swim ${summary.swimFrames}`);
    }
  }
  await ctx.close();
} finally { await browser.close(); writeFileSync(`${OUT}/entries-walk.json`, `${JSON.stringify(result, null, 1)}\n`); }
