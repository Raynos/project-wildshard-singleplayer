// SF48-g: Nalati's four midpoint entries inside the live grid (INFINITE WILDSHARD, Nalati the home cell).
// One page does three things: (1) scans each 8 x 15 m socket footprint with downward rays through the live physics
// world (any static surface above road height, or water over it, is a blocker), (2) walks every entry road <-> shard
// with the physics walk (the route file's legs), (3) captures portrait frames of each entry from the road and from inside.
// scripts/browser-lane.sh node progress/shard-platform/sf48/grid-entries.mjs --url=<served build> --out=<dir> [--shots=0]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { walkPhysicsLeg } = await import(`${ROOT}/scripts/physics-walk.mjs`);
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', '.'), SHOTS = flag('shots', '1') !== '0', WALK = flag('walk', '1') !== '0';
const SLUG = 'nalati-grasslands';
const route = JSON.parse(readFileSync(`${ROOT}/progress/shard-platform/sf48/entries-route.json`, 'utf8'))[SLUG];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { base: BASE, footprints: [], legs: [], shots: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'device', key: 'debug.global.gridOneFrame', data: 'on' });
  // the title's one-shot tap intent (src/game/grid/intent.ts: at most 60 s old when the boot consumes it), stamped in the page
  await ctx.addInitScript((slug) => {
    if (sessionStorage.getItem('sf48.intent')) return; sessionStorage.setItem('sf48.intent', '1');
    const key = 'wildshard.save.v2.device', doc = JSON.parse(localStorage.getItem(key) ?? '{"keys":{}}'); doc.keys ??= {};
    doc.keys['gridIntent.once'] = { v: 1, data: { instance: slug, slug, at: Date.now() } };
    doc.keys['titleArrival.once'] = { v: 1, data: { slug, mode: 'enter', at: Date.now() } };
    localStorage.setItem(key, JSON.stringify(doc));
  }, SLUG);
  await page.goto(`${BASE}/?chunk=${SLUG}&tier=phone&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'commit', timeout: 300000 });
  try { await page.waitForFunction(() => Boolean(window.__wildshard?.shard?.grid?.state?.().live?.live) && !document.querySelector('.ws-load'), null, { timeout: 180000, polling: 250 }); }
  catch (error) { console.log('not live:', await page.evaluate(() => JSON.stringify({ href: location.href, load: Boolean(document.querySelector('.ws-load')), grid: Boolean(window.__wildshard?.shard?.grid), state: window.__wildshard?.shard?.grid?.state?.() ?? null }).slice(0, 800))); throw error; }
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForTimeout(5000);
  result.grid = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { home: s.home, cells: s.cells.map((c) => `${c.slug}@${c.cell.join(',')}`), live: s.live?.live?.current }; });
  console.log(JSON.stringify(result.grid));
  // (1) the footprints: a 0.25 m lattice of downward rays from 40 m over each 8 x 15 m socket (shard-local, north = +z)
  result.footprints = await page.evaluate(() => {
    const w = window.__wildshard.world, ph = w.physics, R = ph.R;
    const rects = { north: [-4, 4, 235, 250], south: [-4, 4, -250, -235], east: [235, 250, -4, 4], west: [-250, -235, -4, 4] };
    const water = w.game.app.world.water;
    return Object.entries(rects).map(([edge, [x0, x1, z0, z1]]) => {
      let rays = 0, maxY = -Infinity, minY = Infinity, above = 0, wet = 0; const blockers = [];
      for (let x = x0 + 0.125; x < x1; x += 0.25) for (let z = z0 + 0.125; z < z1; z += 0.25) {
        rays++;
        const hit = ph.world.castRay(new R.Ray({ x, y: 40, z }, { x: 0, y: -1, z: 0 }), 80, true, R.QueryFilterFlags.EXCLUDE_SENSORS);
        const y = hit === null ? -Infinity : 40 - hit.timeOfImpact;
        maxY = Math.max(maxY, y); minY = Math.min(minY, y);
        if (y > 0.02) { above++; if (blockers.length < 6) blockers.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(3) }); }
        const surface = water.surfaceAt(x, z);
        if (surface !== null && surface >= y) wet++;
      }
      return { edge, rays, maxY: +maxY.toFixed(3), minY: +minY.toFixed(3), above, wet, blockers };
    });
  });
  for (const f of result.footprints) console.log(`footprint ${f.edge}: ${f.rays} rays, y ${f.minY}..${f.maxY}, above ${f.above}, wet ${f.wet}`, f.blockers.length ? JSON.stringify(f.blockers) : '');
  // the grid's own view of the home after one walk-free step onto the road (admission / refusal / residency)
  const gridState = () => page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return JSON.stringify({ live: s.live?.live ?? null, refusals: s.refusals ?? s.live?.refusals ?? null }).slice(0, 1500); });
  result.stateInside = await gridState(); console.log('inside:', result.stateInside);
  await page.evaluate(() => { window.__wildshard.world.player.spawn(0, 262, 0); });
  await page.waitForTimeout(8000);
  result.stateRoad = await gridState(); console.log('road:', result.stateRoad);
  // (2) the walks
  if (WALK) {
    const warm = route[0];
    for (let k = 0; k < 6; k++) { const r = await page.evaluate(walkPhysicsLeg, { ...warm, waypoints: warm.waypoints.slice(0, 2) }); result.warmup = { tries: k + 1, stuck: r.stuck.length }; if (r.stuck.length === 0) break; }
    for (const leg of route) {
      const r = await page.evaluate(walkPhysicsLeg, leg);
      const last = r.trace.at(-1) ?? [0, NaN, NaN, NaN];
      const summary = { name: leg.name, seconds: Math.round(last[0] * 10) / 10, end: { x: last[1], y: last[2], z: last[3] }, stuck: r.stuck,
        swimFrames: r.trace.filter((s) => s[7] === 1).length, minY: Math.min(...r.trace.map((s) => s[2])), maxY: Math.max(...r.trace.map((s) => s[2])), trace: r.trace.filter((_, i) => i % 8 === 0) };
      result.legs.push(summary);
      console.log(`${leg.name}: ${summary.seconds}s end ${[summary.end.x, summary.end.y, summary.end.z].map((v) => Number(v).toFixed(2)).join(', ')} stuck ${r.stuck.length} swim ${summary.swimFrames}`);
    }
  }
  // (3) the frames: from the edge road looking in, and from 40 m inside looking out (eye height, a slight down pitch)
  if (SHOTS) {
    await page.evaluate(() => { const w = window.__wildshard.world; w.game.app.clock.setTime?.(15); });
    const poses = [];
    for (const [edge, nx, nz] of [['north', 0, 1], ['east', 1, 0], ['south', 0, -1], ['west', -1, 0]]) {
      // yaw: the player looks along -sin(yaw), -cos(yaw) (physics-walk's atan2(-dx, -dz))
      poses.push({ name: `${edge}-road`, x: nx * 268, z: nz * 268, yaw: Math.atan2(nx, nz), pitch: -0.06 });
      poses.push({ name: `${edge}-inside`, x: nx * 205, z: nz * 205, yaw: Math.atan2(-nx, -nz), pitch: -0.05 });
    }
    for (const pose of poses) {
      await page.evaluate((q) => { const w = window.__wildshard.world, p = w.player; p.spawn(q.x, q.z, q.yaw); p.pitch = q.pitch; p.velocity.set(0, 0, 0); }, pose);
      await page.waitForTimeout(3500);
      const file = `${OUT}/${pose.name}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
      result.shots.push(file); console.log('shot', file);
    }
  }
  await ctx.close();
} finally { await browser.close(); writeFileSync(`${OUT}/grid-entries.json`, `${JSON.stringify(result, null, 1)}\n`); }
