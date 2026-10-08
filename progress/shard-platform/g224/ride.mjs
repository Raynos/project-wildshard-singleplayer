// SHARD-PLATFORM G224: ride Nine Dragon's portals in a real browser (iPhone 16 Pro portrait, muted, Developer ON): for
// each of the four road-height decks, stand on the deck, walk in along it (the normal move input, no teleport of ours)
// until its ring sends you to Lantern Square, then walk from the arrival across the square into the portal out, which
// sends you back to the deck you came in by. Captures and a JSON report into this folder, and a portrait video of the
// whole run (video.webm, transcoded to video.mp4 by the caller).
// Run: scripts/browser-lane.sh node progress/shard-platform/g224/ride.mjs --url=<served build>
import { chromium, devices } from 'playwright';
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const URL0 = arg('url', 'http://127.0.0.1:4400/').replace(/\/$/u, ''), OUT = import.meta.dirname;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const report = { build: null, date: new Date().toISOString(), rides: [], errors: [] };
// the deck frames (world/portalPlan.ts): edge midpoint and inward axis
const DECKS = [
  { edge: 'north', mx: 0, mz: 250, ix: 0, iz: -1 }, { edge: 'east', mx: 250, mz: 0, ix: -1, iz: 0 },
  { edge: 'south', mx: 0, mz: -250, ix: 0, iz: 1 }, { edge: 'west', mx: -250, mz: 0, ix: 1, iz: 0 },
];
const SQUARE_PORTAL = { x: 12, z: -20 };
// the walked route from the arrival up the square (world/portalPlan.ts SQUARE_ROUTE)
const ROUTE = [{ x: 5.5, z: 2 }, { x: 6, z: -14 }, { x: 12, z: -17 }];
let video = null;
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'], recordVideo: { dir: OUT, size: { width: 540, height: 1174 } } });
  const page = await ctx.newPage();
  video = page.video();
  page.on('pageerror', (e) => { report.errors.push(String(e)); });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await page.goto(`${URL0}/?chunk=nine-dragon-stack&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => { const w = window.__wildshard?.world; return w !== undefined && document.querySelector('.ws-load') === null && w.player !== undefined; }, null, { timeout: 240000, polling: 250 });
  await sleep(2500);
  report.build = await page.evaluate(() => window.__wildshard.version ?? null);
  const player = () => page.evaluate(() => { const p = window.__wildshard.world.player; return { x: Number(p.position.x.toFixed(2)), y: Number(p.position.y.toFixed(2)), z: Number(p.position.z.toFixed(2)), yaw: Number(p.yaw.toFixed(3)) }; });
  const shot = async (name) => { await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 70 }); };
  /** hold forward toward (x, z) with the normal input until a portal moves the player (a jump > 20 m in one frame) */
  const walkInto = (target, via = []) => page.evaluate(async ({ x, z, via }) => {
    const w = window.__wildshard.world, p = w.player, input = w.game.app.input;
    input.clear();
    let last = p.position.clone(), t = 0, minY = p.position.y, from = null, to = null, wi = 0;
    await new Promise((resolve) => {
      let stop = () => undefined;
      stop = w.game.watchFrames((dt) => {
        t += dt;
        const q = p.position;
        if (from === null && q.distanceTo(last) > 20) { from = { x: last.x, y: last.y, z: last.z }; to = { x: q.x, y: q.y, z: q.z, yaw: p.yaw }; input.clear(); }
        const wp = via[wi] ?? { x, z };
        if (wi < via.length && Math.hypot(wp.x - q.x, wp.z - q.z) < 0.8) wi++;
        if (from === null) { minY = Math.min(minY, q.y); p.yaw = Math.atan2(-(wp.x - q.x), -(wp.z - q.z)); input.setHeld('move.forward', true); }
        last = q.clone();
        if ((from !== null && t > 0) || t > 30) { input.clear(); stop(); resolve(undefined); }
      });
    });
    return { teleported: from !== null, from, to, seconds: Math.round(t * 100) / 100, minY };
  }, { ...target, via });
  for (const d of DECKS) {
    // stand on the deck 3 m in from the edge (inside the standalone balustrade), facing in toward the ring
    await page.evaluate(({ x, z, yaw }) => { const p = window.__wildshard.world.player; p.spawn(x, z, yaw, 0); p.pitch = 0.05; }, { x: d.mx + d.ix * 3, z: d.mz + d.iz * 3, yaw: Math.atan2(-d.ix, -d.iz) });
    await sleep(1200);
    await shot(`${d.edge}-1-deck`);
    const inRide = await walkInto({ x: d.mx + d.ix * 20, z: d.mz + d.iz * 20 });
    await sleep(900); // the fade back
    const arrived = await player();
    await page.evaluate(() => { window.__wildshard.world.player.pitch = 0; });
    await sleep(300); await shot(`${d.edge}-2-square`);
    // across the square into the portal out
    const outRide = await walkInto({ x: SQUARE_PORTAL.x, z: SQUARE_PORTAL.z - 3 }, ROUTE);
    await sleep(900);
    const landed = await player();
    await shot(`${d.edge}-3-back`);
    const rideOk = inRide.teleported && Math.abs(arrived.y - 125) < 0.3 && outRide.teleported && Math.abs(landed.y) < 0.3
      && Math.abs(landed.x - (d.mx + d.ix * 10)) < 0.5 && Math.abs(landed.z - (d.mz + d.iz * 10)) < 0.5;
    report.rides.push({ edge: d.edge, ok: rideOk, in: inRide, arrived, out: outRide, landed });
    console.error(`${d.edge}: ${rideOk ? 'ok' : 'FAIL'} in ${inRide.seconds}s -> square (${arrived.x}, ${arrived.y}, ${arrived.z}); out ${outRide.seconds}s -> (${landed.x}, ${landed.y}, ${landed.z})`);
  }
  // one look back at the square's ring from the arrival
  await page.evaluate(() => { const p = window.__wildshard.world.player; p.spawn(0.95, 7.5, -12 * Math.PI / 180, 125); p.pitch = 0.04; });
  await sleep(1200); await shot('square-ring');
  await ctx.close();
} catch (e) { report.errors.push(String(e?.stack ?? e)); } finally { await browser.close(); }
if (video !== null) { try { renameSync(await video.path(), join(OUT, 'video.webm')); } catch (e) { report.errors.push(`video: ${e}`); } }
report.ok = report.rides.length === 4 && report.rides.every((r) => r.ok) && report.errors.length === 0;
writeFileSync(join(OUT, 'ride.json'), `${JSON.stringify(report, null, 2)}\n`);
console.error(`G224 portals: ${report.rides.filter((r) => r.ok).length}/4 rides ok, ${report.errors.length} errors`);
