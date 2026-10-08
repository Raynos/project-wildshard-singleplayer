// SF63 cumulus (SHARD-PLATFORM, E435): why Driftwood's layered cumulus ring is not seen inside its grid cell. A Developer-ON
// grid boot, a pose onto the road, a held-input drive to the entry stop, then the layered dome's draw state (render order,
// depth, blend, world position vs the camera, the camera's near / far) and every visible depth-writing mesh past 600 m,
// with a screenshot per experiment (as is; clouds depth test off; clouds after everything).
// scripts/browser-lane.sh node progress/shard-platform/sf63-cumulus/probe.mjs --url=<preview> --out=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), out = arg('out'), experiments = arg('exp') !== '0';
if (!base || !out) throw new Error('Pass --url and --out');
mkdirSync(out, { recursive: true });
const W = Math.PI / 2;
const report = { base, errors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', e => { report.errors.push(e.message); });
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  await page.locator('.ws-main-grid').click({ timeout: 300_000 });
  await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => { const api = window.__wildshard; return window.__wsReveal?.endedMs != null && api.world.game.app.state === 'play' && !api.world.hud.paused && !document.querySelector('#hud.ws-grid-revealing'); }, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async road => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player.position;
    const origin = { x: live.worldFeet.x - p.x, z: live.worldFeet.z - p.z };
    await api.pose({ x: road.x - origin.x, y: 0.55, z: road.z - origin.z, yaw: road.yaw, pitch: 0 });
  }, { x: 277.5, z: 0, yaw: W });
  await page.waitForTimeout(5000);
  report.drive = await page.evaluate(async waypoints => {
    const api = window.__wildshard, world = api.world, player = world.player, input = world.game.app.input;
    const oldLimit = player.hoverSpeedLimit; let distance = 100;
    player.setHover(true); input.clear();
    player.hoverSpeedLimit = () => Math.min(15, oldLimit(), Math.max(3, distance * 1.5));
    try {
      return await new Promise(resolve => {
        let stopWatch = () => undefined, waypoint = 0;
        const finish = why => { stopWatch(); input.clear(); resolve({ why, feet: api.shard.grid.state().live?.live?.worldFeet }); };
        const timer = setTimeout(() => finish('timeout'), 120000);
        stopWatch = world.game.watchFrames(() => {
          const active = api.shard.grid.state().live.live, feet = active.worldFeet, target = waypoints[waypoint];
          if (!target) { clearTimeout(timer); finish('arrived'); return; }
          const dx = target.x - feet.x, dz = target.z - feet.z; distance = Math.hypot(dx, dz);
          if (distance < 1.5) { waypoint++; input.clear(); return; }
          if (!active.gameplayReady) { input.clear(); return; }
          player.yaw = Math.atan2(-dx, -dz); input.setHeld('move.forward', true);
        });
      });
    } finally { input.clear(); player.hoverSpeedLimit = oldLimit; }
  }, [{ x: 230, z: 0 }]);
  await page.waitForTimeout(6000);
  await page.evaluate(() => { const pl = window.__wildshard.world.player; pl.yaw = Math.PI / 2; pl.pitch = 0.05; });
  await page.waitForTimeout(2500);
  const state = () => page.evaluate(() => {
    const api = window.__wildshard, game = api.world.game, cam = game.camera, scene = game.rootScene, r1 = n => Math.round(n * 10) / 10;
    const c = cam.getWorldPosition(new cam.position.constructor());
    const layered = [];
    scene.traverse(o => {
      if (o.renderOrder !== -9.5) return;
      const wp = o.getWorldPosition(new cam.position.constructor()), m = o.material;
      let shown = true; for (let n = o; n; n = n.parent) if (!n.visible) shown = false;
      layered.push({ name: o.name || o.type, uuid: o.uuid.slice(0, 8), id: o.id, shown, layers: o.layers.mask, parent: o.parent === scene ? 'scene' : (o.parent?.name || o.parent?.type), dist: r1(wp.distanceTo(c)),
        geoR: o.geometry?.boundingSphere ? r1(o.geometry.boundingSphere.radius) : (o.geometry?.computeBoundingSphere(), r1(o.geometry?.boundingSphere?.radius ?? 0)),
        mat: m ? { type: m.type, transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite, blending: m.blending, blendAlpha: m.blendAlpha, side: m.side, visible: m.visible, colorWrite: m.colorWrite } : null });
    });
    const writers = [];
    scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let shown = true; for (let n = o; n; n = n.parent) if (!n.visible) shown = false;
      if (!shown) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const bs = o.geometry.boundingSphere; if (!bs) return;
      const centre = bs.center.clone().applyMatrix4(o.matrixWorld), radius = bs.radius * o.matrixWorld.getMaxScaleOnAxis();
      const far = centre.distanceTo(c) + radius;
      if (far < 600) return;
      let root = null; for (let n = o; n; n = n.parent) if (n.name?.startsWith('region:')) root = n.name;
      writers.push({ name: o.name || o.type, root, renderOrder: o.renderOrder, far: r1(far), radius: r1(radius), transparent: m?.transparent, depthWrite: m?.depthWrite, depthTest: m?.depthTest, type: m?.type });
    });
    return { camera: { pos: [r1(c.x), r1(c.y), r1(c.z)], near: cam.near, far: cam.far, layers: cam.layers.mask }, frame: api.shard.grid.state().frame?.skies ?? null, layered, writers: writers.sort((a, b) => b.far - a.far).slice(0, 60) };
  });
  report.state = await state();
  await page.screenshot({ path: join(out, 'probe-asis.jpg'), type: 'jpeg', quality: 72 });
  if (experiments) {
    // each experiment from the as-is state, undone after its shot
    const run = (what) => page.evaluate(what => {
      const scene = window.__wildshard.world.game.rootScene, undo = [];
      let dome = null, clouds = null;
      scene.traverse(o => { if (o.renderOrder === -9.5 && o.parent === scene) dome = o; });
      dome?.traverse(o => { if (o !== dome && o.isMesh) clouds = o; });
      if (what === 'dome-hidden' && dome) { dome.material.visible = false; undo.push(() => { dome.material.visible = true; }); }
      if (what === 'dome-first' && dome) { dome.renderOrder = -9.6; undo.push(() => { dome.renderOrder = -9.5; }); }
      if (what === 'clouds-last' && clouds) { clouds.renderOrder = 1000; undo.push(() => { clouds.renderOrder = -9.5; }); }
      if (what.startsWith('hide:')) {
        const name = what.slice(5);
        scene.traverse(o => { if (o.name === name && o.visible) { o.visible = false; undo.push(() => { o.visible = true; }); } });
      }
      window.__cumulusUndo = () => { for (const u of undo) u(); };
      return undo.length;
    }, what);
    const names = ['dome-hidden', 'dome-first', 'clouds-last', 'hide:cloud-sea', 'hide:grid-soft-wall', 'hide:haze-band', 'hide:grid-seam-curtain', 'hide:road-sky'];
    report.experiments = {};
    for (const name of names) {
      report.experiments[name] = await run(name);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `probe-${name.replace(':', '-')}.jpg`), type: 'jpeg', quality: 72 });
      await page.evaluate(() => { window.__cumulusUndo?.(); });
    }
    report.order = await page.evaluate(() => {
      const game = window.__wildshard.world.game, r = game.renderer, list = r.renderLists.get(game.rootScene, 0);
      return list ? list.transparent.slice(0, 12).map(i => [i.object.name || i.object.type, i.object.id, i.renderOrder, i.z]) : null;
    });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, 'probe.json'), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors.slice(0, 5), drive: report.drive, camera: report.state?.camera, layered: report.state?.layered }));
