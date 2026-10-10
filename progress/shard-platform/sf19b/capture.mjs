// SHARD-PLATFORM SF19b (E435): Signal Dunes (G94), Nalati (G96) and Nine Dragon (G95) under the grid's one frame (G158,
// G175's 16 m edge blend), as regression evidence. A DEVSERVER build (Nine Dragon's cell is DEVSERVER-only), Developer on,
// phone tier / 2x, one muted Metal iPhone 16 Pro portrait context per shard, entered from the ordinary title.
// Per shard, on the midpoint road facing it:
//   arrive seeded once on the road deck mid-strip (277.5 m from the cell centre), looking at the shard: the road look owns the
//          frame, the shard shows its far proxy, its haze band and its soft wall's loading screen (a shard standing still on
//          the road is not admitted; admission comes with the approach)
//   home   driven in with the production motor to 236 m (14 m inside the edge, past the blend), facing in (the shard owns the frame)
//   in8 / line / out8   walked back out, held facing in: 8 m inside the edge, on it, 8 m outside it
//   (curve)             the frame's weights against the feet, sampled every 100 ms through the real drive in
// The blend shots hold the pose (free camera, player and camera moved together by the world-feet delta, re-held each frame);
// the frame owner reads the player's feet, so the weights are the real ones at that spot. Writes <out>/<slug>-<shot>.png
// and <out>/capture.json.
//   SERVE_OWNER=op-look19 scripts/serve-build.sh --head --devserver --name sf19b-look
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/sf19b/capture.mjs <preview-url> <scratch-dir> [slug]
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const [base, out, only] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: capture.mjs <preview-url> <out-dir> [slug]');
mkdirSync(out, { recursive: true });
/** each shard and the edge it is approached from (the outward normal of that edge) */
const SHARDS = [
  { slug: 'sunscar-dunes', normal: [1, 0] },
  { slug: 'nalati-grasslands', normal: [-1, 0] },
  { slug: 'nine-dragon-stack', normal: [0, 1] },
].filter((row) => !only || row.slug === only);
const report = { version: await (await fetch(new URL('version.json', base))).json(), started: new Date().toISOString(), shards: {} };
const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const frameReadout = (page) => page.evaluate(() => {
  const s = window.__wildshard.shard.grid.state(), live = s.live?.live;
  const bands = []; window.__wildshard.requireWorld().game.scene.traverse((o) => { if (o.name === 'haze-band') bands.push({ visible: o.visible, colour: o.material.uniforms.uColour.value.toArray() }); });
  return { feet: live?.worldFeet, cells: s.cells.map((c) => `${c.slug}:${c.shows}`), inside: s.inside, current: live?.current, residents: live?.residents, frame: s.frame, bands };
});
try {
  for (const { slug, normal } of SHARDS) {
    const row = { errors: [], shots: {} }; report.shards[slug] = row; save();
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    const page = await context.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', (error) => { row.errors.push(String(error.stack ?? error).slice(0, 400)); });
    try {
      await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
      await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0 }, merge: true });
      await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
      await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
      await context.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
      await page.goto(base, { waitUntil: 'commit' });
      await page.locator('.ws-main-grid').click();
      await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
        || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
      const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
      await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
      await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
      const cell = (await page.evaluate(() => window.__wildshard.shard.grid.state())).cells.find((c) => c.slug === slug);
      if (!cell) throw new Error(`No ${slug} cell (a DEVSERVER build with Developer on?)`);
      row.cell = cell; const ox = cell.cell[0] * 555, oz = cell.cell[1] * 555;
      const at = (d) => ({ x: ox + normal[0] * d, z: oz + normal[1] * d });
      // the yaw that faces the cell centre from the road: try two yaws and read which way the camera turns
      const start = at(277.5);
      const pose = (p) => page.evaluate(async (p) => {
        const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.requireWorld().player;
        const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
        await api.pose({ x: p.x - origin.x, y: 0.55, z: p.z - origin.z, yaw: p.yaw, pitch: -0.05 });
        await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); });
        const cam = api.requireWorld().game.camera, v = cam.getWorldDirection(cam.position.clone());
        return Math.atan2(v.x, v.z);
      }, p);
      const a0 = await pose({ ...start, yaw: 0 }), a1 = await pose({ ...start, yaw: Math.PI / 2 }), turn = Math.sign(Math.sin(a1 - a0)) || 1;
      const yaw = (Math.atan2(-normal[0], -normal[1]) - a0) * turn;
      await pose({ ...start, yaw });
      await page.waitForFunction(() => { const s = window.__wildshard.shard.grid.state(); return s.live.live.current === null && s.inside === null && s.live.live.gameplayReady; });
      const doc = await page.evaluate(gridFloorDocumentIdentity);
      const shot = async (name) => {
        await page.waitForTimeout(2500);
        await page.screenshot({ path: join(out, `${slug}-${name}.png`) });
        row.shots[name] = await frameReadout(page); save();
      };
      await shot('arrive');
      const plan = { name: `${slug}-in`, from: null, to: cell.instance, movement: 'road-hover', waypoints: [at(236)], requiredResidents: [cell.instance] };
      // sample the frame's weights against the feet through the real drive in (the blend's curve, road to home)
      await page.evaluate(() => { const g = window.__wildshard.shard.grid; window.__sf19bCurve = []; window.__sf19bTimer = setInterval(() => { const s = g.state(); window.__sf19bCurve.push({ x: Math.round(s.feet.x * 10) / 10, z: Math.round(s.feet.z * 10) / 10, inside: s.inside, highway: s.frame?.highway, weights: s.frame?.weights }); }, 100); });
      const result = await runFloorGridRoute(page, plan, doc);
      row.curve = await page.evaluate(() => { clearInterval(window.__sf19bTimer); return window.__sf19bCurve; });
      row.route = gridFloorWitnessFailures(result);
      await page.waitForTimeout(2000);
      await shot('home');
      // the blend strip: hold the player (and the camera with it) 8 m out, on the edge, 8 m in, facing in
      for (const [name, d] of [['in8', 242], ['line', 250], ['out8', 258]]) {
        await page.evaluate((p) => {
          const api = window.__wildshard, w = api.requireWorld(), live = api.shard.grid.state().live.live;
          window.__sf19bHold = null; w.freeCamera = true;
          const dx = p.x - live.worldFeet.x, dz = p.z - live.worldFeet.z;
          w.player.position.x += dx; w.player.position.z += dz; w.game.camera.position.x += dx; w.game.camera.position.z += dz;
          const hold = { at: w.player.position.clone() };
          const tick = () => { if (window.__sf19bHold !== hold) return; w.player.position.copy(hold.at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); };
          window.__sf19bHold = hold; tick();
        }, at(d));
        await shot(name);
      }
    } catch (error) { row.failure = String(error.stack ?? error).slice(0, 1200); }
    finally { await context.close(); save(); }
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.shards).map(([k, v]) => [k, { failure: v.failure, errors: v.errors.length, route: v.route, owners: Object.fromEntries(Object.entries(v.shots).map(([n, s]) => [n, s.frame ? { owner: s.frame.owner, highway: Math.round(s.frame.highway * 100) / 100, chain: s.frame.chain.owner, chainWeight: Math.round(s.frame.chain.weight * 100) / 100, lut: s.frame.chain.lut } : null])) }]))));
