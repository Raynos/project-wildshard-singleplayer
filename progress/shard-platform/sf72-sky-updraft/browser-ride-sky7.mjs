// SF72 Sky Reach: ride the hoverboard from the windmill deck up the updraft in the real page (muted, iPhone 16 Pro),
// recording every fixed step: y, v.y, the impulse's y, hoverAir / hoverBob, touchdowns (onLand) and health.
// usage: node ride.mjs <base-url> <out.json>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/Users/raynos/projects/games/wildshard-singleplayer/package.json');
const { chromium, devices } = require('playwright');
const [BASE, OUT] = process.argv.slice(2);
if (!BASE || !OUT) throw new Error('usage: node ride.mjs <base-url> <out.json>');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  await page.goto(`${BASE}/?chunk=far-reach&tier=low&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 180000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 180000, polling: 250 });
  await page.waitForFunction(() => window.__wsReveal === undefined || (window.__wsReveal.endedMs ?? null) !== null, null, { timeout: 60000, polling: 250 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  console.error('state', await page.evaluate(() => ({ app: window.__wildshard.world.game.app.state, reveal: window.__wsReveal ?? null, pos: window.__wildshard.world.player.position })));
  const result = await page.evaluate(async () => {
    const probe = window.__wildshard, w = probe.world, p = w.player, input = w.game.app.input;
    // the tape's legs: the windmill deck a few metres short of the ramp's foot, then the ramp's run and the step
    const U = { x0: -11.532610907286722, z0: -75.17221681643402, x1: -54.548951612765755, z1: -116.84429687486683 };
    const ux = U.x1 - U.x0, uz = U.z1 - U.z0, ul = Math.hypot(ux, uz);
    const foot = { x: U.x0 - ux / ul * 4, z: U.z0 - uz / ul * 4 };
    const path = [{ x: U.x0, z: U.z0 }, { x: U.x1, z: U.z1 }, { x: -64, z: -126 }];
    for (let tries = 0; ; tries++) {
      p.spawn(foot.x, foot.z, Math.atan2(-ux, -uz), 30.02); // the windmill deck (y 30): groundHeightAt is the sea floor under an isle
      p.velocity.set(0, 0, 0); input.clear();
      for (let f = 0; f < 20; f++) await new Promise((r) => requestAnimationFrame(r));
      if (Math.hypot(p.position.x - foot.x, p.position.z - foot.z) < 0.5) break;
      if (tries > 10) throw new Error(`spawn did not take: ${p.position.x}, ${p.position.z}`);
    }
    const health = () => probe.state().player.health;
    const rows = [], lands = [];
    let tick = 0, wi = 0, done = false, died = null, last = null;
    const origLand = p.onLand;
    p.onLand = (hard) => { lands.push({ tick, hard, speed: p.hoverLanded, y: p.position.y }); origLand?.(hard); };
    const origStep = p.step.bind(p);
    p.step = (dt, command) => {
      // the same command path as a thumb: yaw toward the next point, the stick held forward
      const wp = path[wi];
      if (wp !== undefined && p.hover) {
        const dx = wp.x - p.position.x, dz = wp.z - p.position.z;
        if (Math.hypot(dx, dz) < 1.5) wi++;
        p.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', wi < path.length);
      }
      const imp = p.impulseVelocity.y;
      origStep(dt, command);
      tick++;
      if (last !== null && died === null && Math.hypot(p.position.x - last.x, p.position.z - last.z) > 5) died = tick; // respawned
      last = { x: p.position.x, z: p.position.z };
      rows.push([tick, +dt.toFixed(5), +p.position.x.toFixed(3), +p.position.y.toFixed(3), +p.position.z.toFixed(3), +p.velocity.y.toFixed(3), +imp.toFixed(3), p.hoverAir ? 1 : 0, +p.hoverBob.toFixed(3), p.hover ? 1 : 0, health(), wi]);
    };
    input.press('hover'); // the HOVER button's own action
    const t0 = performance.now();
    await new Promise((resolve) => {
      const check = () => {
        if (died !== null || p.position.y < 20 || wi >= path.length || tick > 60 * 25 || performance.now() - t0 > 60000) { done = true; resolve(); return; }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    input.clear(); p.step = origStep; p.onLand = origLand;
    const minHealth = Math.min(...rows.map((r) => r[10]));
    return { done, died, minHealth, rows, lands, end: { x: p.position.x, y: p.position.y, z: p.position.z, health: health(), wi } };
  });
  result.errors = errors;
  result.columns = ['tick', 'dt', 'x', 'y', 'z', 'vy', 'impulseY', 'hoverAir', 'hoverBob', 'hover', 'health', 'waypoint'];
  writeFileSync(OUT, JSON.stringify(result));
  const minVy = Math.min(...result.rows.map((r) => r[5])), maxY = Math.max(...result.rows.map((r) => r[3]));
  console.log(JSON.stringify({ died: result.died, minHealth: result.minHealth, ticks: result.rows.length, lands: result.lands.length, hard: result.lands.filter((l) => l.hard).length, minVy, maxY, end: result.end, errors }));
  await ctx.close();
} finally { await browser.close(); }
