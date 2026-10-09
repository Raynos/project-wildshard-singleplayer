// barrel-page.mjs <base> [shot.jpg] (through scripts/browser-lane.sh, a served build): boot Driftwood on the page (muted, iPhone 16 Pro), push the tide puzzle's barrel onto plate b by the
// stick alone (the headless test's closed-loop push, frame by frame), and report where it went and the plate flag.
import { chromium, devices } from 'playwright';
const BASE = process.argv[2], SHOT = process.argv[3];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/?chunk=driftwood-isle&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 180000, polling: 250 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow?.(); });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async () => {
    const probe = window.__wildshard, w = probe.world, p = w.player, adv = probe.shard.driftwood?.adventure ?? probe.shard['driftwood.adventure'] ?? probe.shard.driftwood?.['adventure'], kit = adv.kit, flags = adv.flags;
    const live = (id) => { const lv = kit.lives.find((l) => l.def.id === id); if (!lv) throw new Error(`no ${id}`); return lv; };
    const barrel = live('tide-barrel'), body = barrel.body.rb, home = { x: barrel.home?.x ?? body.translation().x, z: barrel.home?.z ?? body.translation().z };
    const plateLive = live('tide-plate-b'), plateB = { x: plateLive.position.x, z: plateLive.position.z };
    for (const a of w.animals.animals) a.harnessHold = true; // the crabs keep still (the headless test clears them)
    const log = [], at = () => body.translation();
    let frames = 0;
    function* steer(x, z) { const m = Math.hypot(x, z); if (m > 1e-6) p.yaw = Math.atan2(-x, -z); p.touchMove.x = 0; p.touchMove.y = Math.min(1, m); yield; }
    function* walk(points) {
      for (const q of points) for (let t = 0; t < 240; t++) {
        const dx = q.x - p.position.x, dz = q.z - p.position.z, d = Math.hypot(dx, dz); if (d < 0.25) break;
        const k = Math.min(1, d / 0.8) / d; yield* steer(dx * k, dz * k);
      }
    }
    function* push() {
      p.spawn(home.x + 0.9, home.z - 2.5, 0); yield; yield;
      let stuck = 0;
      for (let move = 0; move < 16; move++) {
        const c = at(), dx = plateB.x - c.x, dz = plateB.z - c.z, d = Math.hypot(dx, dz);
        if (d < 0.35 || (d < 0.7 && flags.has('plate:tide-plate-b'))) return;
        const q = body.rotation(), ax = 2 * (q.x * q.y - q.w * q.z), ay = 1 - 2 * (q.x * q.x + q.z * q.z), az = 2 * (q.y * q.z + q.w * q.x), al = Math.hypot(ax, az);
        let ux = dx / d, uz = dz / d, far = d;
        if (Math.abs(ay) < 0.7 && al > 1e-6) {
          const hx = ax / al, hz = az / al, along = dx * hx + dz * hz, across = -dx * hz + dz * hx;
          if (Math.abs(along) >= Math.abs(across)) { const s = Math.sign(along); ux = hx * s; uz = hz * s; far = Math.abs(along); }
          else { const s = Math.sign(across); ux = -hz * s; uz = hx * s; far = Math.abs(across); }
        }
        log.push({ move, c: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], lying: Math.abs(ay) < 0.7, u: [+ux.toFixed(2), +uz.toFixed(2)], far: +far.toFixed(2) });
        const p0 = p.position, side = (p0.x - c.x) * -uz + (p0.z - c.z) * ux >= 0 ? 1 : -1;
        if ((p0.x - c.x) * ux + (p0.z - c.z) * uz > -0.6) yield* walk([{ x: c.x - uz * side * 1.4 + ux * 0.2, z: c.z + ux * side * 1.4 + uz * 0.2 }, { x: c.x - uz * side * 1.2 - ux * 1.2, z: c.z + ux * side * 1.2 - uz * 1.2 }]);
        yield* walk([{ x: c.x - ux * 1.3, z: c.z - uz * 1.3 }]);
        let rest = 0, last = at();
        for (let tick = 0; tick < 900 && rest < 30; tick++) {
          const b = at(), pp = p.position, gone = (b.x - c.x) * ux + (b.z - c.z) * uz;
          if (gone >= far - 0.05) break;
          const lat = (pp.x - b.x) * -uz + (pp.z - b.z) * ux, speed = far - gone > 1.2 ? 0.3 : 0.12;
          yield* steer(ux * speed + uz * lat * 2, uz * speed - ux * lat * 2);
          rest = Math.hypot(b.x - last.x, b.z - last.z) < 1e-3 && Math.hypot(pp.x - b.x, pp.z - b.z) < 1 ? rest + 1 : 0; last = b;
        }
        for (let tick = 0; tick < 45; tick++) yield* steer(0, 0);
        const moved = at(); stuck = Math.hypot(moved.x - c.x, moved.z - c.z) < 0.1 ? stuck + 1 : 0;
        if (stuck < 2) continue;
        log.push({ move, wedged: true });
        for (let tick = 0; tick < 400; tick++) { const b = at(), pp = p.position, ex = b.x - pp.x, ez = b.z - pp.z, e = Math.hypot(ex, ez); if (Math.hypot(b.x - home.x, b.z - home.z) < 0.5) break; yield* steer(ex / e, ez / e); }
        stuck = 0;
        yield* walk([{ x: plateB.x - 0.4, z: plateB.z - 1.1 }, { x: home.x - 0.9, z: home.z + 2 }]);
      }
    }
    const t0 = performance.now(), gen = push();
    await new Promise((resolve) => {
      let stop = () => {};
      stop = w.game.watchFrames(() => {
        if (w.hud.paused) return;
        frames++;
        if (gen.next().done) { p.touchMove.x = 0; p.touchMove.y = 0; stop(); resolve(); }
      });
    });
    for (let i = 0; i < 60; i++) await new Promise((r) => requestAnimationFrame(r));
    const end = at();
    return { log, frames, seconds: (performance.now() - t0) / 1000, home, plateB, end: [+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)],
      fromPlate: +Math.hypot(end.x - plateB.x, end.z - plateB.z).toFixed(2), plateDown: flags.has('plate:tide-plate-b'), sleeping: body.isSleeping(),
      player: [+p.position.x.toFixed(2), +p.position.z.toFixed(2)] };
  });
  if (SHOT) await page.screenshot({ path: SHOT, type: 'jpeg', quality: 70 });
  console.log(JSON.stringify({ ...result, errors }, null, 1));
} finally { await browser.close(); }
