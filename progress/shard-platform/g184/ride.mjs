// SHARD-PLATFORM SF51-p (G184): walk and ride Nine Dragon's north lantern lift in a real browser (iPhone 16 Pro portrait,
// muted), with the nineDragonEntries row ON: from the north landing deck (y 0) through the end wall's door into the resting
// cage, ride it up (the KinematicMover carries the player; no teleport) to the winch house, step out onto the north street
// (y 125) and walk it; then back into the cage, ride it down and step out onto the deck. Captures into this folder, a JSON
// report, and the deck legs (deck <-> resting cage, both ways) as a physics-baseline route (entries-route.json).
// Run: scripts/browser-lane.sh node progress/shard-platform/g184/ride.mjs --url=<served build>
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { walkPhysicsLeg } from '../../../scripts/physics-walk.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const URL0 = arg('url', 'http://127.0.0.1:4400/').replace(/\/$/u, ''), OUT = import.meta.dirname;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const report = { build: null, date: new Date().toISOString(), legs: [], rides: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { report.errors.push(String(e)); });
  await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.nine-dragon-stack.nineDragonEntries', data: 'on' });
  await page.goto(`${URL0}/?chunk=nine-dragon-stack&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 180000 });
  // the cage: the kinematic body in the north shaft (its gates ride the same pose); the lift is driven only as a player
  // drives it, by the USE action on its "Ride the lift" prompt
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world; if (document.querySelector('.ws-load') || w === undefined) return false;
    let found = false; w.physics.world.bodies.forEach((b) => { const t = b.translation(); if (b.isKinematic() && Math.abs(t.x - 2.4) < 0.5 && Math.abs(t.z + 231.6) < 0.5) found = true; });
    return found;
  }, null, { timeout: 240000, polling: 250 });
  report.build = await page.evaluate(() => window.__wildshard.version ?? null);
  let lastY = Number.NaN;
  const lift = async () => {
    const at = await page.evaluate(() => { let out = null; window.__wildshard.world.physics.world.bodies.forEach((b) => { const t = b.translation(); if (out === null && b.isKinematic() && Math.abs(t.x - 2.4) < 0.5 && Math.abs(t.z + 231.6) < 0.5) out = { x: t.x, y: t.y, z: t.z }; }); return out; });
    const moving = Number.isFinite(lastY) && Math.abs(at.y - lastY) > 1e-4; lastY = at.y; return { ...at, moving };
  };
  const player = () => page.evaluate(() => { const p = window.__wildshard.world.player; return { x: p.position.x, y: p.position.y, z: p.position.z, onPlatform: p.onPlatform }; });
  const face = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
  const shot = async (name, yaw, pitch) => {
    await page.evaluate(([y, p]) => { const pl = window.__wildshard.world.player; if (y !== null) pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    await sleep(350); await page.screenshot({ path: join(OUT, `north-${name}.jpg`), type: 'jpeg', quality: 72 });
  };
  const walk = async (name, start, waypoints, timeout = 40) => {
    const r = await page.evaluate(walkPhysicsLeg, { start, waypoints, timeout });
    const leg = { name, stuck: r.stuck, end: r.trace.at(-1) }; report.legs.push(leg); return leg;
  };
  const ride = async (name, toY) => {
    await page.evaluate(() => { window.__wildshard.world.game.app.input.press('use'); });
    const out = { name, samples: [], maxGap: 0, maxBelow: 0 };
    for (let t0 = Date.now(); Date.now() - t0 < 30000; await sleep(250)) {
      const [c, p] = [await lift(), await player()]; out.samples.push([Number(c.y.toFixed(2)), Number(p.y.toFixed(2))]);
      out.maxGap = Math.max(out.maxGap, Math.hypot(p.x - c.x, p.z - c.z)); out.maxBelow = Math.max(out.maxBelow, c.y - p.y);
      if (out.samples.length === 30) await shot(`2-${name}`, face({ x: 0, z: 0 }, { x: 0, z: toY > 1 ? 1 : -1 }), 0.1);
      if (!c.moving && Math.abs(c.y - toY) < 0.01 && out.samples.length > 4) break;
    }
    const p = await player(); out.end = p; out.onTop = Math.abs(p.y - toY) < 0.2; report.rides.push(out); return out;
  };
  const bottom = await lift(); // the cage rests at the deck
  // leg 1: the deck, through the end wall's door, into the resting cage
  await walk('deck to cage', { x: bottom.x, z: -247, yaw: Math.PI, y: 0.3 }, [{ x: bottom.x, z: -236 }, { x: bottom.x, z: bottom.z }]);
  await shot('1-cage', Math.PI, 0.05);
  const up = await ride('up', 125);
  // leg 2: out of the docked cage onto the north street, and down it
  const top = await player();
  await walk('cage to street', { x: top.x, z: top.z, yaw: Math.PI, y: top.y }, [{ x: top.x, z: -226 }, { x: 6.5, z: -215 }]);
  await shot('3-street', Math.PI, -0.02);
  // leg 3: back up the street into the cage, ride it down, step out onto the deck
  await walk('street to cage', { x: 6.5, z: -215, yaw: 0, y: 125.3 }, [{ x: top.x, z: -226 }, { x: top.x, z: up.end.z }]);
  const down = await ride('down', 0);
  const low = await player();
  await walk('cage to deck', { x: low.x, z: low.z, yaw: 0, y: low.y }, [{ x: low.x, z: -240 }, { x: 0, z: -246 }]);
  await shot('4-deck', Math.PI, 0.05);
  report.end = await player();
  console.log(JSON.stringify({ legs: report.legs.map((l) => [l.name, l.stuck.length, l.end]), up: { onTop: up.onTop, maxGap: up.maxGap.toFixed(2), maxBelow: up.maxBelow.toFixed(2), end: up.end }, down: { onTop: down.onTop, maxGap: down.maxGap.toFixed(2), end: down.end }, end: report.end, errors: report.errors.length }));
  await ctx.close();
} finally { await browser.close(); }
writeFileSync(join(OUT, 'ride.json'), `${JSON.stringify(report, null, 1)}\n`);
writeFileSync(join(OUT, 'entries-route.json'), `${JSON.stringify({
  $doc: "SHARD-PLATFORM SF51-p (G184): Nine Dragon's north landing deck to its resting lantern-lift cage and back, with the nineDragonEntries row ON (the ride itself is ride.mjs's). Generated by progress/shard-platform/g184/ride.mjs. Run: scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=nine-dragon-stack --route=progress/shard-platform/g184/entries-route.json --device-save=debug.plugin.nine-dragon-stack.nineDragonEntries=on --url=<served build>",
  'nine-dragon-stack': [
    { name: 'north deck in', start: { x: 2.4, z: -247, yaw: Number(Math.PI.toFixed(2)), y: 0.3 }, waypoints: [{ x: 2.4, z: -236 }, { x: 2.4, z: -231.6 }] },
    { name: 'north deck out', start: { x: 2.4, z: -231.6, yaw: 0, y: 0.3 }, waypoints: [{ x: 2.4, z: -240 }, { x: 0, z: -246 }] },
  ] }, null, 1)}\n`);
