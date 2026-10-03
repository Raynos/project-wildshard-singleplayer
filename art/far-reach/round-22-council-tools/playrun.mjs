// playrun.mjs <url> [out.json]: the crown route as ONE ordinary play run (council round 8, X4): from the spawn on foot over
// the rope bridge to the windmill isle, on the board up the updraft to the high step, on foot to the winch, the winch turned
// with the interact key (E), the bridge waited for, then on foot over the raised bridge into the crown's arena. One load,
// no teleports: each leg starts where the last one ended (scripts/physics-walk.mjs's autopilot: face the next waypoint,
// hold W). The only staged state is the quest a player has when the winch unlocks ('quest-winch': the notes read, the
// roost quiet, the vanes turning). Prints each leg and the run's totals; writes out.json when given.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const REPO = '/Users/raynos/projects/games/wildshard-singleplayer';
const { chromium } = await import(join(REPO, 'node_modules/playwright/index.mjs'));
const { saveFixture } = await import(join(REPO, 'scripts/debug-settings.mjs'));
const { walkPhysicsLeg } = await import(join(REPO, 'scripts/physics-walk.mjs'));
const [URL_BASE, OUT] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const lerp = (a, b, n) => Array.from({ length: n }, (_, i) => ({ x: a.x + (b.x - a.x) * (i + 1) / n, z: a.z + (b.z - a.z) * (i + 1) / n }));
// layout.ts: SPAWN (0, -5.5); the windmill rope bridge on x 0; UPDRAFT (-11.5, -75.2) to (-54.6, -116.8); WINCH (-60.8, -136.4);
// FALLEN_BRIDGE (-55.8, -134.2) to (-13.0, -177.0); the crown (0, -190), its arena radius 18
const LEGS = [
  { name: 'spawn to the windmill isle (on foot, the rope bridge)', waypoints: [{ x: 0, z: -12 }, ...lerp({ x: 0, z: -12 }, { x: 0, z: -50 }, 8), { x: -5, z: -58 }, { x: -9.5, z: -70 }, { x: -10.6, z: -74 }], timeout: 90 },
  { name: 'the updraft (board)', hover: true, waypoints: lerp({ x: -10.6, z: -74 }, { x: -57.5, z: -119.6 }, 10), timeout: 90 },
  { name: 'to the winch (on foot)', waypoints: [{ x: -59.5, z: -128 }, { x: -60.5, z: -134.5 }], timeout: 30 },
  { name: 'over the raised bridge into the arena (on foot)', waypoints: [{ x: -57.5, z: -132.5 }, ...lerp({ x: -55.8, z: -134.2 }, { x: -13.0, z: -177.0 }, 14), { x: -6, z: -181 }], timeout: 120 },
];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { legs: [], winch: null, arena: null };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/?chunk=far-reach&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player) && document.querySelector('.ws-load') === null, undefined, { timeout: 480000, polling: 1000 });
  await sleep(4000);
  await page.evaluate(() => { window.__wildshard.shard?.farReach?.stage?.('quest-winch'); try { window.__wildshard.world.animals.calm = true; } catch { /* */ } });
  const here = () => page.evaluate(() => { const p = window.__wildshard.world.player; return { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw }; });
  for (const leg of LEGS) {
    let at = await here();
    if (leg.name.startsWith('over the raised bridge')) {
      // the winch, turned in play: the interact key at the handle, then wait for the bridge
      await page.keyboard.press('KeyE');
      const t0 = Date.now();
      const raised = await page.waitForFunction(() => window.__wildshard.shard?.farReach?.built?.state?.raised === true, undefined, { timeout: 30000, polling: 250 }).then(() => true, () => false);
      out.winch = { raised, seconds: (Date.now() - t0) / 1000, at };
      // the quest holds the camera on the raised bridge for 5 s (quest/install.ts REWARD_VIEW, its player placed at the view)
      await sleep(6000);
      console.log(JSON.stringify({ winch: out.winch }));
      at = await here();
    }
    const start = { x: at.x, z: at.z, yaw: at.yaw, y: at.y, ...(leg.hover ? { hover: true } : {}) };
    const r = await page.evaluate(walkPhysicsLeg, { start, waypoints: leg.waypoints, timeout: leg.timeout });
    const ys = r.trace.map((s) => s[2]), end = r.trace[r.trace.length - 1];
    const row = { leg: leg.name, from: [at.x, at.y, at.z].map((v) => +v.toFixed(2)), to: [end[1], end[2], end[3]], maxY: Math.max(...ys), minY: Math.min(...ys), stuck: r.stuck, seconds: r.wall / 1000 };
    out.legs.push(row); console.log(JSON.stringify(row));
  }
  out.arena = await page.evaluate(() => { const p = window.__wildshard.world.player.position; return { at: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), fromCrownCentre: +Math.hypot(p.x, p.z + 190).toFixed(2) }; });
  console.log(JSON.stringify({ arena: out.arena }));
} finally { await browser.close(); }
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
