// SHARD-PLATFORM op-look25 (E435, SF23 open item): do the neighbours' far-proxy skirts still hide G90's retaining walls?
// One muted Metal iPhone 16 Pro portrait context, Developer on, phone tier / 2x. In the grid it finds the seam's tallest
// retaining-wall faces (vertical triangles 27.5 m off a road centre line, the cell-edge plane, more than 5 m tall, outside
// any region root), poses on the road centre facing each one from 22 m, and shoots it twice: as drawn, and with every far
// proxy hidden (what the wall alone looks like there). Readout: the wall's span and which cell's proxy stands behind it.
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/look25/wall.mjs <preview-url> <out-dir> [count]
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out, count = '3'] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: wall.mjs <preview-url> <out-dir> [count]');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { version: await (await fetch(new URL('version.json', base))).json(), walls: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0 }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  await page.goto(base, { waitUntil: 'commit' });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => !document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live));
  await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
  await page.waitForTimeout(6000);
  // the retaining walls: vertical faces in the cell-edge plane (27.5 m off a road centre line), > 5 m tall, page meshes only
  const walls = await page.evaluate((n) => {
    const w = window.__wildshard.requireWorld(), pitch = 555, found = [];
    const fromRoad = (v) => v - (Math.round((v - pitch / 2) / pitch) * pitch + pitch / 2);
    const regional = (o) => { for (let p = o; p; p = p.parent) if (/^region|far/i.test(p.name ?? '')) return true; return false; };
    w.game.rootScene.updateMatrixWorld(true);
    w.game.rootScene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || regional(o)) return;
      const pos = o.geometry?.getAttribute?.('position'), idx = o.geometry?.getIndex?.();
      if (!pos || pos.count < 3) return;
      const m = o.matrixWorld.elements, P = (k) => { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
      const tris = idx ? idx.count / 3 : pos.count / 3;
      for (let t = 0; t < tris; t++) {
        const a = P(idx ? idx.getX(t * 3) : t * 3), b = P(idx ? idx.getX(t * 3 + 1) : t * 3 + 1), c = P(idx ? idx.getX(t * 3 + 2) : t * 3 + 2);
        for (const axis of [0, 2]) {
          const r = [a, b, c].map((v) => fromRoad(v[axis]));
          if (!r.every((v) => Math.abs(Math.abs(v) - 27.5) < 0.05 && Math.sign(v) === Math.sign(r[0]))) continue;
          const lo = Math.min(a[1], b[1], c[1]), hi = Math.max(a[1], b[1], c[1]);
          if (hi - lo < 5) continue;
          const other = 2 - axis, along = (a[other] + b[other] + c[other]) / 3;
          found.push({ mesh: o.name, axis: axis === 0 ? 'x' : 'z', plane: a[axis], side: Math.sign(r[0]), along, lo, hi });
        }
      }
    });
    // one per 60 m stretch, tallest first
    found.sort((p, q) => (q.hi - q.lo) - (p.hi - p.lo));
    const picked = [];
    for (const f of found) if (picked.every((p) => p.axis !== f.axis || Math.abs(p.plane - f.plane) > 1 || Math.abs(p.along - f.along) > 60)) picked.push(f);
    return { total: found.length, picked: picked.slice(0, n) };
  }, Number(count));
  report.total = walls.total;
  for (const [i, wall] of walls.picked.entries()) {
    // on the road centre, 27.5 m back from the face, looking straight at it (the face's normal points at the road)
    const road = wall.plane - wall.side * 27.5, feet = wall.axis === 'x' ? { x: road + wall.side * 5.5, z: wall.along } : { x: wall.along, z: road + wall.side * 5.5 };
    const dir = wall.axis === 'x' ? { x: wall.side, z: 0 } : { x: 0, z: wall.side };
    await page.evaluate(async ({ feet, dir }) => {
      const api = window.__wildshard, w = api.requireWorld(), live = api.shard.grid.state().live.live;
      const origin = { x: live.worldFeet.x - w.player.position.x, z: live.worldFeet.z - w.player.position.z };
      const look = async (yaw) => { await api.pose({ x: feet.x - origin.x, y: 0.55, z: feet.z - origin.z, yaw, pitch: 0.12 }); await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); }); const v = w.game.camera.getWorldDirection(w.game.camera.position.clone()); return Math.atan2(v.x, v.z); };
      const a0 = await look(0), a1 = await look(Math.PI / 2), turn = Math.sign(Math.sin(a1 - a0)) || 1;
      await look((Math.atan2(dir.x, dir.z) - a0) * turn);
      const at = w.player.position.clone(); const tick = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick();
    }, { feet, dir });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(out, `wall-${i}-drawn.png`) });
    const hidden = await page.evaluate(() => {
      const w = window.__wildshard.requireWorld(), hid = [];
      w.game.rootScene.traverse((o) => { if (/far/i.test(o.name ?? '') && o.visible && o.isMesh) { o.visible = false; hid.push(o.name); } });
      return hid;
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `wall-${i}-no-proxy.png`) });
    await page.evaluate((names) => { const w = window.__wildshard.requireWorld(); w.game.rootScene.traverse((o) => { if (names.includes(o.name)) o.visible = true; }); }, hidden);
    report.walls.push({ ...wall, feet, hidden: [...new Set(hidden)] });
  }
  await ctx.close();
} finally { await browser.close(); writeFileSync(join(out, 'wall.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify(report));
