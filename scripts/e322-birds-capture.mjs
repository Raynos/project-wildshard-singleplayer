#!/usr/bin/env node
// e322-birds-capture.mjs — E322 F-M5's A/B board frames (Debug ▸ Creatures & NPCs ▸ Bird fix): the three Pine Hollow birds
// in the game's real Model Explorer on the phone tier (iPhone 16 Pro portrait, 3×), each variant a fresh page load:
//   owl     the specimen switched to its FLYING pose (the card shows it perched), seen side-on and from below-front
//   wood    the perched woodpecker with a stand-in trunk at its bark (life/index.ts: the bark 0.05 m in front of the pose
//           point), side-on and three-quarter
//   raven   the perched raven close (the phone's atlas: B loads birds-b.phone.glb)
//
//   scripts/browser-lane.sh node scripts/e322-birds-capture.mjs --url=http://127.0.0.1:<port> --out=<dir>
//
// Writes <out>/<variant>-<shot>.png. One headless Chromium on Metal, muted, closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { debugSettings } from './debug-settings.mjs';

const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = flag('out', '/tmp/e322-birds');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const { chromium, devices } = await import('playwright');
const iphone = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

/** the shots: card id, the pose override, the camera (offset from the bird, metres) */
const SHOTS = [
  { name: 'owl-side', card: 'pine-hollow/great-grey-owl', fly: true, cam: [5.6, 0.0, 0.5], fov: 30 },
  { name: 'owl-below', card: 'pine-hollow/great-grey-owl', fly: true, cam: [2.8, -2.0, 4.3], fov: 34 },
  { name: 'wood-side', card: 'pine-hollow/pileated-woodpecker', trunk: true, cam: [0.85, 0.05, -0.12], fov: 40 },
  { name: 'wood-q34', card: 'pine-hollow/pileated-woodpecker', trunk: true, cam: [0.6, 0.15, -0.6], fov: 40 },
  { name: 'raven', card: 'pine-hollow/raven', cam: [1.5, 0.45, 1.35], fov: 32 },
];

try {
  for (const v of ['a', 'b']) {
    const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } });
    await debugSettings(ctx, { pineBirdFix: v });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error(`[pageerror] ${e.message.slice(0, 300)}`));
    const t0 = Date.now();
    await page.goto(`${BASE}/?chunk=pine-hollow&tier=phone&touch=1&mute=1&nolock=1&sw=0&explore=model`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('.ws-x-grid .ws-x-model').length > 0 && window.__world !== undefined, undefined, { timeout: 480_000, polling: 1000 });
    console.error(`[${v}] explorer in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    // the camera override: after the explorer places its own camera, every frame
    await page.evaluate(() => {
      const w = window.__world;
      window.__bc = null;
      w.game.onLate(() => {
        const c = window.__bc, cam = w.game.camera;
        if (!c) return;
        cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.updateMatrixWorld(true);
        if (Math.abs(cam.fov - c.fov) > 0.01) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
      });
    });
    let shown = '';
    for (const s of SHOTS) {
      if (s.card !== shown) {
        await page.evaluate((id) => {
          const q = (sel) => document.querySelector(sel);
          if (q('.ws-x-models')?.dataset.view === 'model') q('.ws-x-back')?.click();
          window.__bc = null;
          const card = [...document.querySelectorAll('.ws-x-grid .ws-x-model')].find((c) => c.dataset.id === id);
          card?.click();
        }, s.card);
        shown = s.card;
        await sleep(7000); // the generated birds land (ws:model-ready) and the explorer settles
      }
      const ok = await page.evaluate((shot) => {
        const w = window.__world, scene = w.game.scene;
        const shownOf = (o) => { let at = o; while (at !== null) { if (!at.visible) return false; at = at.parent; } return true; };
        const found = [];
        scene.traverse((o) => { if (o.name === 'pine-wildlife' && o.isInstancedMesh && o.count > 0 && shownOf(o)) found.push(o); });
        const mesh = found.at(-1);
        if (mesh === undefined) return 'no specimen';
        const M = w.game.camera.matrixWorld.constructor, V = w.game.camera.position.constructor;
        const inst = new M(); mesh.getMatrixAt(0, inst);
        const world = new M().multiplyMatrices(mesh.matrixWorld, inst);
        const p = new V().setFromMatrixPosition(world);
        const g = mesh.geometry;
        if (shot.fly) {
          // the flying pose: wings spread (fold 0), legs tucked, level; the spread model (aAnim2.w = 1)
          const a = g.getAttribute('aAnim'), b = g.getAttribute('aAnim2');
          a.setXYZW(0, 0.05, 0, 0, 0); b.setXYZW(0, b.getX(0), 1, 0, 1);
          a.needsUpdate = true; b.needsUpdate = true;
          const k = new V().setFromMatrixScale(inst);
          inst.makeScale(k.x, k.y, k.z); inst.setPosition(new V().setFromMatrixPosition(inst).add(new V(0, 0.35, 0)));
          mesh.setMatrixAt(0, inst); mesh.instanceMatrix.needsUpdate = true;
          p.y += 0.35;
        }
        if (shot.trunk && !window.__trunk) {
          // a stand-in trunk: its bark 0.05 m in front of the pose point (the bird faces +z at rest), radius 0.3
          const plains = [], stds = [];
          scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) plains.push(o); if (o.material?.type === 'MeshStandardMaterial') stds.push(o.material); });
          const plain = plains[0], std = stds[0];
          if (plain === undefined || std === undefined) return 'no mesh to clone';
          const Geo = mesh.geometry.getIndex().constructor, A = g.getAttribute('position').constructor, BG = plain.geometry.constructor;
          const R = 0.3, H = 3, N = 40, pos = [], nor = [], idx = [];
          for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI * 2, x = Math.sin(t), z = Math.cos(t); pos.push(x * R, -H / 2, z * R, x * R, H / 2, z * R); nor.push(x, 0, z, x, 0, z); }
          for (let i = 0; i < N; i++) { const a0 = i * 2; idx.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3); }
          const geo = new BG();
          geo.setAttribute('position', new A(new Float32Array(pos), 3)); geo.setAttribute('normal', new A(new Float32Array(nor), 3));
          geo.setIndex(new Geo(new Uint16Array(idx), 1));
          const mat = std.clone(); mat.map = null; mat.normalMap = null; mat.color.setRGB(0.16, 0.11, 0.075); mat.roughness = 0.95; mat.metalness = 0; mat.vertexColors = false;
          const MeshCtor = plain.constructor;
          const trunk = new MeshCtor(geo, mat);
          trunk.position.set(p.x, p.y, p.z + 0.05 + R);
          mesh.parent.add(trunk);
          window.__trunk = trunk;
        }
        if (!shot.trunk && window.__trunk) { window.__trunk.removeFromParent(); window.__trunk = null; }
        const look = [p.x, p.y + (shot.fly ? 0 : 0.02), p.z];
        window.__bc = { pos: [p.x + shot.cam[0], p.y + shot.cam[1], p.z + shot.cam[2]], look, fov: shot.fov };
        return 'ok';
      }, s);
      if (ok !== 'ok') { console.error(`  ${v}-${s.name}: ${ok}`); continue; }
      await page.addStyleTag({ content: '.ws-x, .ws-x *, #hud, .ws-touch { visibility: hidden !important; }' });
      await sleep(1500);
      writeFileSync(`${OUT}/${v}-${s.name}.png`, await page.screenshot({ type: 'png' }));
      await page.evaluate(() => { document.querySelectorAll('style').forEach((st) => { if (st.textContent.includes('.ws-x, .ws-x *')) st.remove(); }); });
      console.error(`  ${v}-${s.name}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
