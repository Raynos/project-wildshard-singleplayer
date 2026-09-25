#!/usr/bin/env node
// nalati-models-compare.mjs — "yesterday | today | mockup" for the Nalati models, rendered IN the live shard.
//
// For each subject it builds the procedural model the game uses today (the species factory, the POI yurt kit, the
// dressing boulder) and the image-to-3D GLB from public/assets/nalati/models/, stands each in turn on the same spot on
// the balbal knoll (short grass), scales the GLB to the procedural model's height, and shoots both from the same
// 3/4 camera through the game's own renderer, sky, light and post. The third panel is the codex reference image the
// GLB was generated from (the top-left cell of art/nalati-grasslands/round-5-models/<name>-turntable.jpg).
// Output: progress/nalati-look/models/<name>-3up.jpg and models-sheet.jpg.
//
//   node scripts/nalati-models-compare.mjs                 # every subject, desktop tier
//   node scripts/nalati-models-compare.mjs --only=wolf,yurt
//   node scripts/nalati-models-compare.mjs --paint=0        # the GLB's glTF material, not the painterly path
// Needs the dev server (this worktree: http://127.0.0.1:5188). One headless Chromium on Metal, closed at the end.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-look/models');
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const only = flag('only', '').split(',').filter(Boolean);
const PAINT = flag('paint', '1') !== '0'; // --paint=0: the GLB's own glTF material instead of glbPaint.ts

// subject → how to build the procedural twin
const SUBJECTS = [
  { name: 'yurt', proc: { yurt: true }, label: 'Yurt', dist: 14 },
  { name: 'horse-saddled', proc: { kind: 'horse', variant: 'camp-bay' }, label: 'Saddled horse', dist: 5.6 },
  { name: 'horse-wild', proc: { kind: 'horse', variant: 'dun' }, label: 'Wild horse', dist: 5.6 },
  { name: 'wolf', proc: { kind: 'wolf' }, label: 'Wolf', dist: 3.4 },
  { name: 'snow-leopard', proc: { kind: 'leopard' }, label: 'Snow leopard (Aqbars)', dist: 3.4 },
  { name: 'eagle', proc: { kind: 'eagle' }, label: 'Golden eagle (Qyran)', dist: 2.6, sameSize: true },
  { name: 'golden-king', proc: { kind: 'golden-king' }, label: 'The Golden King', dist: 6.2 },
  { name: 'balbal', proc: { kind: 'balbal', variant: 'warrior' }, label: 'Balbal', dist: 5.2 },
  { name: 'boulder-1', proc: { boulder: true }, label: 'Boulder', dist: 5.2 },
].filter((s) => only.length === 0 || only.includes(s.name));

const SPOT = { x: 41, z: -143 }; // on the balbal knoll's flat top, off the central dais (short grass inside the ring)
const W = 900, H = 900;

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', 'tier=desktop', `x=${SPOT.x}`, `z=${SPOT.z + 30}`].join('&');
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: 300000, polling: 1000 });
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="elite"],[class*="banner"]{display:none!important}' });
  await page.evaluate(async (spot) => {
    const w = window.__world;
    window.__weather.clock.paused = true;
    const { THREE, GLTFLoader, MeshoptDecoder } = await import('/src/dev/threeKit.ts');
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const { heightAt } = await import('/src/world/Heightfield.ts');
    const { PaintKit } = await import('/src/world/nalati/paint.ts');
    const { addYurt } = await import('/src/world/nalati/Yurt.ts');
    const { boulderGeo } = await import('/src/world/nalati/dressing/models.ts');
    const { painterlyMaterial } = await import('/src/world/painterly.ts');
    if (w.animals?.group) w.animals.group.visible = false;
    const gy = heightAt(spot.x, spot.z);
    const root = new THREE.Group(); root.position.set(spot.x, gy, spot.z); w.game.scene.add(root);
    const cam = w.game.camera;
    window.__mc = { THREE, loader, root, gy, pose: null, cur: [], paint: spot.paint };
    w.game.onUpdate(() => {
      const p = window.__mc.pose; if (!p) return;
      cam.position.set(p.x, p.y, p.z); cam.lookAt(p.tx, p.ty, p.tz);
      if (Math.abs(cam.fov - 38) > 0.01) { cam.fov = 38; cam.updateProjectionMatrix(); }
      for (const c of cam.children) c.visible = false;
    });
    // builders, run per subject from Node
    window.__mcBuild = async (s) => {
      const mc = window.__mc;
      for (const o of mc.cur) root.remove(o);
      mc.cur = [];
      let proc;
      if (s.proc.yurt) {
        const kit = new PaintKit(0x7a17);
        addYurt(kit, { x: 0, y: 0, z: 0, rot: 0, r: 3.1, flue: true, palette: 0, old: false, base: 'lattice' }, []);
        proc = kit.mesh(w.sky, { ground: () => 0 });
      } else if (s.proc.boulder) {
        proc = new THREE.Mesh(boulderGeo(7, 2).scale(1.4, 1.1, 1.3), painterlyMaterial(w.sky, { vertexColors: true }));
      } else {
        const model = w.animals.factory.model(s.proc.kind, s.proc.variant);
        const rig = w.animals.factory.instantiate(model, 0.5);
        proc = rig.mesh;
      }
      let glb;
      if (mc.paint) {
        // the game's own path: glbPaint.ts (meshopt, the painterly material with the atlas as its map)
        const { loadNalatiModel } = await import('/src/world/nalati/glbPaint.ts');
        const m = await loadNalatiModel(w.sky, s.name);
        glb = new THREE.Group(); const mesh = new THREE.Mesh(m.geometry, m.material); mesh.castShadow = mesh.receiveShadow = true; glb.add(mesh);
      } else {
        const gltf = await mc.loader.loadAsync(`/assets/nalati/models/${s.name}.glb`);
        glb = gltf.scene;
        glb.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; w.sky.setupMaterial?.(o.material); } });
      }
      proc.traverse?.((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // match heights: the GLB takes the procedural model's height
      const bp = new THREE.Box3().setFromObject(proc), bg = new THREE.Box3().setFromObject(glb);
      const hp = bp.max.y - bp.min.y, hg = bg.max.y - bg.min.y;
      if (hg > 0 && hp > 0 && !s.sameSize) glb.scale.setScalar(hp / hg);
      if (s.sameSize && hg > 0) glb.scale.setScalar(Math.max(hp, 0.6) * 1.6 / hg);
      glb.position.y = -new THREE.Box3().setFromObject(glb).min.y;
      proc.position.y -= bp.min.y;
      root.add(proc); root.add(glb);
      mc.cur = [proc, glb];
      const d = s.dist, a = Math.PI * 0.62; // sun (WSW) behind the camera, so the models are front-lit
      mc.pose = { x: spot.x + Math.sin(a) * d, y: mc.gy + Math.max(0.7, hp * 0.62), z: spot.z + Math.cos(a) * d, tx: spot.x, ty: mc.gy + hp * 0.45, tz: spot.z };
      mc.proc = proc; mc.glb = glb;
      return { hp, hg, procTris: 0 };
    };
    window.__mcShow = (which) => { const mc = window.__mc; mc.proc.visible = which === 'proc'; mc.glb.visible = which === 'glb'; };
  }, { ...SPOT, paint: PAINT });
  await new Promise((resolve) => { setTimeout(resolve, 8000); });

  const results = [];
  for (const s of SUBJECTS) {
    try {
      const info = await page.evaluate((subj) => window.__mcBuild(subj), s);
      const shots = {};
      for (const which of ['proc', 'glb']) {
        await page.evaluate((wch) => window.__mcShow(wch), which);
        await new Promise((resolve) => { setTimeout(resolve, 1800); });
        shots[which] = await page.screenshot({ type: 'jpeg', quality: 88 });
      }
      results.push({ s, info, shots });
      console.log(`${s.name}: proc h ${info.hp.toFixed(2)} m, glb h ${info.hg.toFixed(2)} m`);
    } catch (e) { console.log(`${s.name}: FAILED ${e.message.slice(0, 160)}`); }
  }
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 5).join(' | '));

  // compose: yesterday | today | mockup (the turntable's reference cell) per subject, plus one sheet
  const comp = await (await browser.newContext()).newPage();
  const cells = [];
  for (const r of results) {
    const tt = readFileSync(resolvePath(ROOT, `art/nalati-grasslands/round-5-models/${r.s.name}-turntable.jpg`)).toString('base64');
    const b64 = await comp.evaluate(async (a) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const [p, g, t] = await Promise.all([load(a.p), load(a.g), load(a.t)]);
      const S = 600, G = 8, TOP = 34, BOT = 30;
      const c = document.createElement('canvas'); c.width = S * 3 + G * 4; c.height = S + TOP + BOT;
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(p, G, TOP, S, S); x.drawImage(g, G * 2 + S, TOP, S, S);
      // the reference: the turntable's top-left cell (x 5..363, y 62..420 of 1840×794)
      const kx = t.width / 1840, ky = t.height / 794;
      x.drawImage(t, 5 * kx, 62 * ky, 358 * kx, 358 * ky, G * 3 + S * 2, TOP, S, S);
      x.font = '600 20px ui-sans-serif, system-ui'; x.fillStyle = '#ffd98a'; x.fillText(a.label, G, 24);
      x.font = '600 16px ui-monospace, monospace'; x.fillStyle = '#9fe6ff';
      x.fillText('YESTERDAY · procedural, in game', G + 4, TOP + S + 21);
      x.fillText(a.paint ? 'TODAY · generated GLB, painterly, in game' : 'TODAY · generated GLB, glTF material', G * 2 + S + 4, TOP + S + 21);
      x.fillText('MOCKUP · the reference image', G * 3 + S * 2 + 4, TOP + S + 21);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    }, { p: `data:image/jpeg;base64,${r.shots.proc.toString('base64')}`, g: `data:image/jpeg;base64,${r.shots.glb.toString('base64')}`, t: `data:image/jpeg;base64,${tt}`, label: r.s.label, paint: PAINT });
    writeFileSync(resolvePath(OUT, `${r.s.name}-3up.jpg`), Buffer.from(b64, 'base64'));
    cells.push(b64);
  }
  const sheet = await comp.evaluate(async (list) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const imgs = await Promise.all(list.map((b) => load(`data:image/jpeg;base64,${b}`)));
    const w = 1200, h = Math.round(w * imgs[0].height / imgs[0].width), G = 6;
    const c = document.createElement('canvas'); c.width = w * 2 + G * 3; c.height = Math.ceil(imgs.length / 2) * (h + G) + G;
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => x.drawImage(im, G + (i % 2) * (w + G), G + Math.floor(i / 2) * (h + G), w, h));
    for (let qq = 0.8; qq >= 0.4; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 1.4e6) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.35).split(',')[1];
  }, cells);
  writeFileSync(resolvePath(OUT, 'models-sheet.jpg'), Buffer.from(sheet, 'base64'));
  console.log(`wrote ${results.length} × 3-up + models-sheet.jpg to progress/nalati-look/models/`);
} finally {
  await browser.close();
}
