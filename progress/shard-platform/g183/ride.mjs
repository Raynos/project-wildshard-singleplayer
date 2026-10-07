// SHARD-PLATFORM SF49-g (G183): walk and ride each of Sky Reach's four Rising Islet entries in a real browser (iPhone 16 Pro
// portrait, muted), with the farReachEntries row ON: from the stone lip at the road socket's far edge onto the resting islet,
// ride it up its chains to the gate isle (the KinematicMover carries the player; no teleport), then walk the gate isle, the
// rope bridge and onto the island's ground. Captures per entry into this folder; a JSON report; and the static legs
// (gate isle → bridge → island, both ways) as a physics-baseline route (entries-route.json).
// Run: scripts/browser-lane.sh node progress/shard-platform/g183/ride.mjs --url=<served build> [--edge=north]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { walkPhysicsLeg } from '../../../scripts/physics-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const URL0 = arg('url', 'http://127.0.0.1:4402/').replace(/\/$/u, ''), ONLY = arg('edge', ''), OUT = import.meta.dirname;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = { build: null, date: new Date().toISOString(), entries: [] }, route = { $doc: '', 'far-reach': [] };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
try {
  for (const edge of ['north', 'east', 'south', 'west']) {
    if (ONLY !== '' && ONLY !== edge) continue;
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => { errors.push(String(e)); });
    await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.far-reach.farReachEntries', data: 'on' });
    await page.goto(`${URL0}/?chunk=far-reach&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 180000 });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined && window.__wildshard?.shard?.farReach?.islets?.length === 4, null, { timeout: 180000, polling: 250 });
    const entry = await page.evaluate((e) => JSON.parse(JSON.stringify(window.__wildshard.shard.farReach.islets.find((x) => x.edge === e))), edge);
    const out = { edge, isle: entry.isle.id, travel: entry.travel, legs: [], ride: null, errors };
    const shot = async (name, yaw, pitch) => {
      await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; if (y !== null) pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
      await sleep(350); await page.screenshot({ path: join(OUT, `${edge}-${name}.jpg`), type: 'jpeg', quality: 72 });
    };
    const islet = () => page.evaluate((e) => window.__wildshard.shard.farReach.isletAt(e), edge);
    const player = () => page.evaluate(() => { const p = window.__wildshard.world.player.position; return { x: p.x, y: p.y, z: p.z }; });
    const face = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
    // wait for the islet to come back to rest, so the whole 6 s rest is ahead
    for (let seen = false, t0 = Date.now(); Date.now() - t0 < 90000; await sleep(100)) {
      const p = await islet(); if (p.y > 0.5) seen = true; if (seen && p.y < 0.001) break;
    }
    // leg 1: the lip (road height, the socket's far edge) onto the resting islet
    const lip = entry.board[0], board = await page.evaluate(walkPhysicsLeg, { start: { x: lip.x, z: lip.z, yaw: face(lip, entry.rest), y: 0.3 }, waypoints: entry.board.slice(1).map((p) => ({ x: p.x, z: p.z })), timeout: 20 });
    out.legs.push({ name: 'board', stuck: board.stuck.length, end: board.trace.at(-1) });
    await shot('1-islet', face(entry.rest, entry.dock), 0.25);
    // the ride: stand still; the islet carries the player up its chains to the gate isle
    const ride = { samples: [], maxGap: 0 };
    for (let t0 = Date.now(); Date.now() - t0 < (entry.travel + 9) * 1000; await sleep(250)) {
      const [i, p] = [await islet(), await player()]; ride.samples.push([Number(i.y.toFixed(2)), Number(p.y.toFixed(2))]);
      ride.maxGap = Math.max(ride.maxGap, Math.hypot(p.x - i.x, p.z - i.z)); if (Math.abs(i.y - entry.dock.y) < 0.01) break;
      if (ride.samples.length === Math.round(entry.travel * 2)) await shot('2-ride', face(entry.rest, entry.dock), 0.35);
    }
    const docked = await player(); ride.docked = docked; ride.onTop = docked.y > entry.dock.y - 0.2; out.ride = ride;
    await shot('3-docked', face(entry.dock, entry.gate), 0.05);
    // leg 2: the docked islet onto the gate isle, across the rope bridge, onto the island's ground
    const climb = await page.evaluate(walkPhysicsLeg, { start: { x: docked.x, z: docked.z, yaw: face(docked, entry.gate), y: docked.y }, waypoints: entry.climb.slice(1).map((p) => ({ x: p.x, z: p.z })), timeout: 140 });
    out.legs.push({ name: 'climb', stuck: climb.stuck.length, end: climb.trace.at(-1), seconds: climb.trace.at(-1)?.[0] });
    const end = await player(); out.end = end; out.onIsland = Math.abs(end.y - entry.isle.y) < 0.5;
    await shot('4-island', face(entry.climb.at(-2), entry.climb.at(-1)), -0.05);
    report.entries.push(out);
    // the static legs for physics-baseline: from the gate isle across the bridge onto the island, and back
    const g = entry.climb[2], wps = entry.climb.slice(3).map((p) => ({ x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)) }));
    route['far-reach'].push({ name: `${edge} in`, start: { x: Number(g.x.toFixed(2)), z: Number(g.z.toFixed(2)), yaw: Number(face(g, entry.climb[3]).toFixed(2)), y: entry.gate.y + 0.3 }, waypoints: wps });
    const back = [...wps].reverse(), last = back[0];
    route['far-reach'].push({ name: `${edge} out`, start: { ...last, yaw: Number(face(last, back[1]).toFixed(2)), y: entry.isle.y + 0.3 }, waypoints: [...back.slice(1), { x: Number(g.x.toFixed(2)), z: Number(g.z.toFixed(2)) }] });
    console.log(JSON.stringify({ edge, isle: out.isle, board: out.legs[0], ride: { onTop: ride.onTop, maxGap: ride.maxGap.toFixed(2), docked }, climb: out.legs[1], onIsland: out.onIsland, errors: errors.length }));
    await ctx.close();
  }
} finally { await browser.close(); }
route.$doc = "SHARD-PLATFORM SF49-g (G183): Sky Reach's Rising Islet entries' static legs with the farReachEntries row ON: from each gate isle's middle across its rope bridge onto the island's ground, and back. (The islet ride itself is ride.mjs's.) Generated by progress/shard-platform/g183/ride.mjs. Run: scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=far-reach --route=progress/shard-platform/g183/entries-route.json --device-save=debug.plugin.far-reach.farReachEntries=on --url=<served build>";
const suffix = ONLY === '' ? '' : `-${ONLY}`;
writeFileSync(join(OUT, `ride${suffix}.json`), `${JSON.stringify(report, null, 1)}\n`);
if (ONLY === '') writeFileSync(join(OUT, 'entries-route.json'), `${JSON.stringify(route, null, 1)}\n`);
