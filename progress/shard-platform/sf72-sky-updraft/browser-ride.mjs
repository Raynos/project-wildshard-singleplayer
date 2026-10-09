// The browser half of the updraft ride (muted Chromium, iPhone 16 Pro): stand on the windmill deck, HOVER on, hold the
// stick toward the step along the ramp (the baseline autopilot's input path), log every frame.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.argv[2], out = process.argv[3];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(new URL('/?chunk=far-reach&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async () => {
    const w = window.__wildshard.world, p = w.player, input = w.game.app.input, app = w.game.app;
    const health = () => NaN; void app;
    if (w.animals.__frozen !== true) { w.animals.update = () => undefined; w.animals.__frozen = true; }
    input.clear(); p.velocity.set(0, 0, 0);
    p.spawn(-8.66, -72.39, 2.37); p.position.y = 30; p.prevFeet?.copy(p.position);
    await new Promise(r => setTimeout(r, 1000));
    p.setHover(true);
    await new Promise(r => setTimeout(r, 500));
    const WP = [[-11.53, -75.17], [-54.55, -116.84], [-64, -126]], rows = [], lands = [], hp0 = health();
    const onLand = p.onLand; p.onLand = hard => { lands.push({ t: rows.length, hard, vy: p.hoverLanded, y: p.position.y }); onLand?.(hard); };
    let wi = 0, t = 0;
    await new Promise(resolve => {
      let stop = () => {};
      stop = w.game.watchFrames(dt => {
        if (wi < 0) return;
        t += dt;
        if (wi >= WP.length || t > 20 || p.position.y < 20) { input.clear(); wi = -1; stop(); resolve(); return; }
        const [x, z] = WP[wi], dx = x - p.position.x, dz = z - p.position.z;
        if (Math.hypot(dx, dz) < 0.8) { wi++; return; }
        p.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        rows.push([+t.toFixed(3), +p.position.x.toFixed(2), +p.position.y.toFixed(3), +p.position.z.toFixed(2), +p.velocity.y.toFixed(2), p.hoverAir ? 1 : 0, Math.round(health())]);
      });
    });
    p.onLand = onLand;
    return { host: 'browser', frames: rows.length, end: rows.at(-1), maxY: Math.max(...rows.map(r => r[2])), minVy: Math.min(...rows.map(r => r[4])), landings: lands.length, hard: lands.filter(l => l.hard).length, hp: [hp0, health()], lands: lands.slice(0, 12), rows };
  });
  writeFileSync(out, JSON.stringify({ ...result, errors }));
  const { rows, ...summary } = result; console.log(JSON.stringify(summary));
  for (const r of rows.filter((_, i) => i % 30 === 0)) console.log(JSON.stringify(r));
  await context.close();
} finally { await browser.close(); }
