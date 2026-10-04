// SF46 part 2: walk Driftwood's four midpoint entries road <-> shard inside the live grid (INFINITE WILDSHARD), hybrid row ON.
// scripts/browser-lane.sh node progress/shard-platform/sf46/grid-walk.mjs --url=<served build> --out=<json>
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { walkPhysicsLeg } = await import(`${ROOT}/scripts/physics-walk.mjs`);
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', 'grid-walk.json'), ROW = flag('row', 'on');
const route = JSON.parse(readFileSync(`${ROOT}/progress/shard-platform/sf46/entries-route.json`, 'utf8'))['driftwood-isle'];
const ROAD = 262; // on the edge road, past the cell edge (cells pitch 555 m)
const out = (p) => (Math.abs(p.x) > Math.abs(p.z) ? { x: Math.sign(p.x) * ROAD, z: p.z } : { x: p.x, z: Math.sign(p.z) * ROAD });
const legs = route.filter((l) => / (in|out)$/u.test(l.name)).map((l) => {
  if (l.name.endsWith(' in')) { const s = out(l.start); return { ...l, name: `${l.name} (road)`, start: { x: s.x, z: s.z, yaw: l.start.yaw }, waypoints: [{ x: l.start.x, z: l.start.z }, ...l.waypoints] }; }
  return { ...l, name: `${l.name} (road)`, waypoints: [...l.waypoints, out(l.waypoints.at(-1))] };
});
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { row: ROW, base: BASE, legs: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: ROW });
  await page.goto(`${BASE}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300000 });
  await page.locator('.ws-main-grid').waitFor({ timeout: 300000 });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live !== undefined, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForTimeout(4000);
  result.grid = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(); return { home: s.home, cells: s.cells.map((c) => `${c.slug}@${c.cell.join(',')}`), live: s.live?.live?.current, residents: s.live?.live?.residents }; });
  result.sea = await page.evaluate(() => ({ level: window.__wildshard.world.game.app.world.water.sea?.level ?? null }));
  console.log(JSON.stringify(result.grid), JSON.stringify(result.sea));
  // warm-up: the first seconds after entering, the walk input does not take yet (the first leg logged a stuck per waypoint)
  { const warm = legs.find((l) => l.name.startsWith('north in')); if (warm) for (let k = 0; k < 6; k++) { const r = await page.evaluate(walkPhysicsLeg, { ...warm, waypoints: warm.waypoints.slice(0, 2) }); result.warmup = { tries: k + 1, stuck: r.stuck.length }; console.log('warm-up stuck', r.stuck.length); if (r.stuck.length === 0) break; } }
  for (const leg of legs) {
    const r = await page.evaluate(walkPhysicsLeg, leg);
    const last = r.trace.at(-1) ?? [0, NaN, NaN, NaN];
    const summary = { trace: r.trace.filter((_, i) => i % 6 === 0), name: leg.name, seconds: Math.round(last[0] * 10) / 10, end: { x: last[1], y: last[2], z: last[3] }, stuck: r.stuck,
      swimFrames: r.trace.filter((s) => s[7] === 1).length, airFrames: r.trace.filter((s) => s[5] === 0).length, minY: Math.min(...r.trace.map((s) => s[2])), maxY: Math.max(...r.trace.map((s) => s[2])) };
    result.legs.push(summary);
    console.log(`${leg.name}: ${summary.seconds}s end ${[summary.end.x, summary.end.y, summary.end.z].map((v) => v.toFixed(2)).join(', ')} stuck ${r.stuck.length} swim ${summary.swimFrames}`);
  }
  await ctx.close();
} finally { await browser.close(); writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`); }
