// route.mjs <url>: the moved route's two crossings as real play (council round 7, X3 / X4): the updraft ridden on the
// board from the windmill isle's north rim up to the high step, and the crown bridge walked on foot from the step to the
// crown once its winch has raised it (stage 'quest-crown', the state a player has after the winch). Uses the engine
// harness's own autopilot (scripts/physics-walk.mjs: face the next waypoint, hold W). Prints each leg's end, its highest
// and lowest feet and any stuck waypoint; writes <out>.json when a second arg is given.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const REPO = '/Users/raynos/projects/games/wildshard-singleplayer';
const { chromium } = await import(join(REPO, 'node_modules/playwright/index.mjs'));
const { saveFixture } = await import(join(REPO, 'scripts/debug-settings.mjs'));
const { walkPhysicsLeg } = await import(join(REPO, 'scripts/physics-walk.mjs'));
const [URL_BASE, OUT] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
// the spans from layout.ts (UPDRAFT: windmill (0, -64) to the step (-64, -126); FALLEN_BRIDGE: the step to the crown (0, -190))
const lerp = (a, b, n) => Array.from({ length: n }, (_, i) => ({ x: a.x + (b.x - a.x) * (i + 1) / n, z: a.z + (b.z - a.z) * (i + 1) / n }));
const legs = [
  { name: 'updraft (board)', start: { x: -7.5, z: -71.3, yaw: Math.atan2(-(-54.6 + 7.5), -(-116.8 + 71.3)), y: 30, hover: true },
    waypoints: [...lerp({ x: -7.5, z: -71.3 }, { x: -57.5, z: -119.6 }, 10)], expect: 44, timeout: 90 },
  { name: 'crown bridge (on foot, raised)', start: { x: -59.0, z: -131.0, yaw: Math.atan2(-(-12.9 + 59), -(-177 + 131)), y: 44 },
    waypoints: [...lerp({ x: -59.0, z: -131.0 }, { x: -9.5, z: -180.5 }, 14)], expect: 44, timeout: 120 },
];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/?chunk=far-reach&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player) && document.querySelector('.ws-load') === null, undefined, { timeout: 480000, polling: 1000 });
  await sleep(4000);
  await page.evaluate(() => { window.__wildshard.shard?.farReach?.stage?.('quest-crown'); });
  await sleep(1000);
  for (const leg of legs) {
    const r = await page.evaluate(walkPhysicsLeg, leg);
    const ys = r.trace.map((s) => s[2]);
    const end = r.trace[r.trace.length - 1];
    const row = { leg: leg.name, end, maxY: Math.max(...ys), minY: Math.min(...ys), stuck: r.stuck, expectY: leg.expect, seconds: r.wall / 1000 };
    results.push(row); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); }
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
