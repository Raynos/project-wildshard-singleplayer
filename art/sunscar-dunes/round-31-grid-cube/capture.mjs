// SHARD-PLATFORM SF50 / G99 (E435): Signal Dunes inside its 500 m cube. Captures the live standalone world (phone tier,
// iPhone 16 Pro, muted) from three views, each twice:
//   A  as it ships standalone (the dune skirt to 520 m, the four horizon ranges at 470-600 m);
//   B  what it draws as a grid cell: the platform's gridLevel drops its horizon rings and the plugin cuts the skirt back to
//      the cube (ctx.cube). Signal Dunes can't run live in the grid yet (a runtime-source cell, M3), so B is rendered in
//      the standalone world: the ring meshes hidden and four clip planes at +-250 m on the sand material (the painted
//      ground ends at 240 m, so only the skirt is cut; the grid's clipped skirt is the same surface out to 250 m).
// Past 250 m, B shows the bare sky and fog; in the grid the road, its G94 haze band and the neighbours stand there.
// scripts/browser-lane.sh node art/sunscar-dunes/round-31-grid-cube/capture.mjs --url=<served build> --out=<dir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', '.');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const toJpeg = (png, jpg) => {
  const tmp = `${jpg}.png`; writeFileSync(tmp, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp, '--out', jpg], { stdio: 'ignore' });
  execFileSync('rm', ['-f', tmp]);
};
// shard-local metres; y of 'g' = the terrain there + 1.6 m ('g+n': n metres more)
const VIEWS = [
  { id: 'spawn', pos: [0, 'g', 70], look: [8, 'g+6', -75] },
  { id: 'west-edge', pos: [-205, 'g', 18], look: [-420, 'g+2', 0] },
  { id: 'aerial', pos: [330, 260, 470], look: [0, 0, -20] },
];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const result = { base: BASE, views: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  try { result.build = (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build; } catch { /* unknown */ }
  await page.goto(`${BASE}/?chunk=sunscar-dunes&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, null, { timeout: 240000, polling: 250 });
  await page.evaluate(() => {
    const w = window.__wildshard.world, cam = w.game.camera;
    try { w.animals.calm = true; } catch { /* none */ }
    const st = document.createElement('style'); st.textContent = 'body *{visibility:hidden!important} canvas.__game{visibility:visible!important}';
    w.game.renderer.domElement.classList.add('__game'); document.head.append(st);
    window.__hv = null;
    w.game.onLate(() => {
      const v = window.__hv; if (!v) return;
      cam.position.set(v.pos[0], v.pos[1], v.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[1], v.look[2]);
      cam.far = Math.max(cam.far, 3000); cam.updateProjectionMatrix();
      for (const ch of cam.children) ch.visible = false;
      cam.updateMatrixWorld(true);
    });
    // the out-of-cube parts, found by shape: the skirt (a 1040 m plane) and the horizon group (its ring meshes, r >= 460 m)
    const scene = w.game.scene, meshes = [];
    scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const skirt = meshes.find((m) => m.geometry?.parameters?.width === 1040) ?? null;
    const rings = meshes.filter((m) => { m.geometry.computeBoundingSphere(); const s = m.geometry.boundingSphere; return m !== skirt && m.material?.type === 'MeshLambertMaterial' && s !== null && s.radius >= 460 && s.radius < 800 && Math.hypot(s.center.x, s.center.z) < 50; }); // the ring strips (their hidden feet run deep, so the sphere sits low)
    // three's clipping copies each plane's normal and constant (WebGLClipping), so {normal: Vector3, constant} planes do
    const V3 = cam.position.constructor, plane = (nx, nz) => ({ normal: new V3(nx, 0, nz), constant: 250 });
    window.__big = meshes.map((m) => { m.geometry.computeBoundingSphere(); const s = m.geometry.boundingSphere; return { name: m.name, parent: m.parent?.name || m.parent?.type, idx: scene.children.indexOf(m.parent), r: s ? Math.round(s.radius) : null, c: s ? [Math.round(s.center.x), Math.round(s.center.y), Math.round(s.center.z)] : null, side: m.material?.side, type: m.material?.type, vis: m.visible, pos: [Math.round(m.position.x), Math.round(m.position.y), Math.round(m.position.z)] }; }).filter((e) => (e.r ?? 0) > 300);
    window.__cube = { skirt, rings, planes: [plane(-1, 0), plane(1, 0), plane(0, -1), plane(0, 1)] };
    return { skirt: skirt !== null, rings: rings.length };
  }).then((found) => { result.found = found; console.log('found', JSON.stringify(found)); });
  console.log('big', JSON.stringify(await page.evaluate(() => window.__big)));
  if (process.argv.includes('--probe')) { await browser.close(); process.exit(0); }
  await sleep(6000);
  for (const v of VIEWS) {
    const y = async (x, z, spec) => {
      if (typeof spec === 'number') return spec;
      const feet = await page.evaluate(([px, pz]) => window.__wildshard.world.chunk.ground.terrain.heightAt(px, pz), [x, z]); // the manifest's terrain field
      return feet + 1.6 + (spec === 'g' ? 0 : Number(spec.slice(2)));
    };
    const pos = [v.pos[0], await y(v.pos[0], v.pos[2], v.pos[1]), v.pos[2]], look = [v.look[0], await y(Math.max(-238, Math.min(238, v.look[0])), Math.max(-238, Math.min(238, v.look[2])), v.look[1]), v.look[2]];
    await page.evaluate((hv) => { window.__hv = hv; }, { pos, look });
    for (const variant of ['A', 'B']) {
      const reach = await page.evaluate((b) => {
        const { skirt, rings, planes } = window.__cube, renderer = window.__wildshard.world.game.renderer;
        for (const r of rings) r.visible = !b;
        if (skirt) {
          renderer.localClippingEnabled = b;
          skirt.material.clippingPlanes = b ? planes : null;
          skirt.material.needsUpdate = true;
        }
        return { rings: rings.filter((r) => r.visible).length, clipped: Boolean(skirt?.material.clippingPlanes?.length) };
      }, variant === 'B');
      await sleep(variant === 'A' ? 5000 : 3000);
      const file = join(OUT, `${v.id}-${variant}.jpg`);
      toJpeg(await page.screenshot({ type: 'png' }), file);
      result.views.push({ id: v.id, variant, pos: pos.map((n) => +n.toFixed(2)), look: look.map((n) => +n.toFixed(2)), ...reach });
      console.log('captured', v.id, variant, JSON.stringify(reach));
    }
  }
  await ctx.close();
} finally { await browser.close(); writeFileSync(join(OUT, 'capture.json'), `${JSON.stringify(result, null, 1)}\n`); }
