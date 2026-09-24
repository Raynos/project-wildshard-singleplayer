#!/usr/bin/env node
// nalati-models-merge-compare.mjs — NALATI-MERGE D1 / D2: every model made both ways, compared IN the live shard.
//
// Per subject: the procedural model the game draws today | the Blender pipeline's model (main's way: modelled from code
// in Blender, or an image-to-3D mesh through scripts/img2mesh/driftwood_post.py — faceted, one colour per facet, Cycles AO
// in the vertex alpha) | the image-to-3D pipeline's model (Nalati's way: TRELLIS.2 / Hunyuan3D-2 with its base-colour
// atlas) | the reference image. Each stands on the same spot on the balbal knoll, scaled to the procedural model's height,
// shot from the same 3/4 camera (sun behind it) through the game's renderer, sky, light and post; the candidates go
// through glbPaint.ts's own path (rawFromGltf → the painterly material), so what the sheet shows is what the game draws.
// The candidate files are read from disk and handed to the page (they need not be served).
//
//   node scripts/nalati-models-merge-compare.mjs --url=http://127.0.0.1:5189 [--only=yurt,golden-king] [--cands=<dir>]
// <dir> (default ~/ml/img2mesh/out/nalati-merge/final) holds <name>.blender.glb and <name>.gen.glb (desktop files);
// the reference is <dir>/<name>.ref.jpg. Output: progress/nalati-merge/d/<name>-4up.jpg + models-sheet.jpg.
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { homedir } from 'node:os';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-merge/d');
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5189');
const CANDS = flag('cands', resolvePath(homedir(), 'ml/img2mesh/out/nalati-merge/final'));
const only = flag('only', '').split(',').filter(Boolean);
// a close-up pass: --dist=<m> overrides every subject's camera distance, --eye=<m> puts the camera at eye height (first
// person), --tag=<s> names the outputs <name>-4up-<tag>.jpg
const DIST = Number(flag('dist', '0')), EYE = Number(flag('eye', '0')), TAG = flag('tag', '');

// subject → how to build the procedural twin; `dist` the camera distance (m)
const SUBJECTS = [
  { name: 'yurt', proc: { yurt: true }, label: 'Yurt', dist: 17 },
  { name: 'golden-king', proc: { kind: 'golden-king', variant: 'king' }, label: 'The Golden King', dist: 5.6 },
  { name: 'collie', proc: { kind: 'sheepdog', variant: 'collie' }, label: 'Sheepdog (collie)', dist: 2.8, side: true },
  { name: 'ghost-horse', proc: { kind: 'ghost-rider', variant: 'captain' }, label: "Qara Batyr's ghost horse", dist: 6.2, side: true },
  { name: 'elder', proc: { person: 'elder' }, label: 'Baqyt Ata (the elder)', dist: 4.6 },
  { name: 'herder-dauren', proc: { person: 'herderGate' }, label: 'Dauren (the gate herder)', dist: 4.6 },
  { name: 'herder-erlan', proc: { person: 'herderRail' }, label: 'Erlan (the rail herder)', dist: 4.6 },
  { name: 'child', proc: { person: 'child' }, label: 'Ayan (the child)', dist: 3.4 },
  { name: 'cook', proc: { person: 'cook' }, label: 'Gulnar Apa (the cook)', dist: 4.4 },
].filter((s) => only.length === 0 || only.includes(s.name));
const PIPES = [
  { id: 'blender', caption: 'BLENDER · main\'s pipeline, in game' },
  { id: 'gen', caption: 'IMAGE-TO-3D · atlas, in game' },
];

const SPOT = (() => { const [x, z] = flag('spot', '62,188').split(',').map(Number); return { x: x ?? 62, z: z ?? 188 }; })(); // open meadow west of the camp
const W = 720, H = 900;

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
    const { painterlyMaterial } = await import('/src/world/painterly.ts');
    const { rawFromGltf } = await import('/src/world/nalati/glbPaint.ts');
    const people = await import('/src/nalati/campPeople.ts');
    if (w.animals?.group) w.animals.group.visible = false;
    const gy = heightAt(spot.x, spot.z);
    const root = new THREE.Group(); root.position.set(spot.x, gy, spot.z); w.game.scene.add(root);
    const cam = w.game.camera;
    window.__mc = { pose: null, cur: [], shown: [] };
    w.game.onUpdate(() => {
      const p = window.__mc.pose; if (!p) return;
      cam.position.set(p.x, p.y, p.z); cam.lookAt(p.tx, p.ty, p.tz);
      if (Math.abs(cam.fov - 34) > 0.01) { cam.fov = 34; cam.updateProjectionMatrix(); }
      for (const c of cam.children) c.visible = false;
    });
    const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.codePointAt(0) ?? 0).buffer;
    window.__mcBuild = async (s, cands) => {
      const mc = window.__mc;
      for (const o of mc.cur) root.remove(o);
      mc.cur = [];
      let proc;
      if (s.proc.yurt) {
        const kit = new PaintKit(0x7a17);
        addYurt(kit, { x: 0, y: 0, z: 0, rot: Math.PI, r: 3.1, flue: true, palette: 0, old: false, base: 'lattice' }, []);
        proc = kit.mesh(w.sky, { ground: () => 0 });
      } else if (s.proc.person) {
        proc = people.personPreview(w.sky, s.proc.person);
      } else {
        const model = w.animals.factory.model(s.proc.kind, s.proc.variant);
        const rig = w.animals.factory.instantiate(model, 0.5);
        proc = rig.mesh;
      }
      proc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const bp = new THREE.Box3().setFromObject(proc);
      const hp = bp.max.y - bp.min.y;
      proc.position.y -= bp.min.y;
      root.add(proc); mc.cur.push(proc);
      const shown = { proc };
      const info = { hp, cands: {} };
      for (const [id, b64] of Object.entries(cands)) {
        const gltf = await loader.parseAsync(fromB64(b64), '');
        const r = rawFromGltf(gltf.scene, `${s.name}.${id}`);
        const mesh = new THREE.Mesh(r.geometry, painterlyMaterial(w.sky, { map: r.map, rim: 0.35, bands: 0.8 }));
        mesh.castShadow = mesh.receiveShadow = true;
        const g = new THREE.Group(); g.add(mesh);
        const hg = r.box.max.y - r.box.min.y;
        if (hg > 0 && hp > 0) g.scale.setScalar(hp / hg);
        g.position.y = -r.box.min.y * g.scale.y;
        root.add(g); mc.cur.push(g); shown[id] = g;
        const idx = r.geometry.getIndex();
        info.cands[id] = { h: hg, tris: (idx ? idx.count : r.geometry.getAttribute('position').count) / 3, map: r.map ? `${r.map.image?.width}²` : 'vertex colours' };
      }
      mc.shown = shown;
      const d = s.distOverride > 0 ? s.distOverride : s.dist, a = Math.PI * 0.62; // the sun (WSW) behind the camera: front-lit
      // turn the subject to the camera: a figure / the yurt 3/4 from the front, a quadruped 3/4 from its flank
      root.rotation.y = a - (s.side ? 1.05 : 0.45);
      const eye = s.eye > 0 ? s.eye : Math.max(0.7, hp * 0.6);
      mc.pose = { x: spot.x + Math.sin(a) * d, y: gy + eye, z: spot.z + Math.cos(a) * d, tx: spot.x, ty: gy + (s.eye > 0 ? Math.min(s.eye, hp * 0.55) : hp * 0.47), tz: spot.z };
      return info;
    };
    window.__mcShow = (which) => { for (const [k, o] of Object.entries(window.__mc.shown)) o.visible = k === which; };
  }, SPOT);
  await new Promise((resolve) => { setTimeout(resolve, 8000); });

  const results = [];
  for (const s of SUBJECTS) {
    const cands = {};
    for (const p of PIPES) { const f = resolvePath(CANDS, `${s.name}.${p.id}.glb`); if (existsSync(f)) cands[p.id] = readFileSync(f).toString('base64'); }
    try {
      const info = await page.evaluate(([subj, c]) => window.__mcBuild(subj, c), [{ ...s, distOverride: DIST, eye: EYE }, cands]);
      const shots = {};
      for (const which of ['proc', ...PIPES.map((p) => p.id).filter((id) => id in cands)]) {
        await page.evaluate((wch) => window.__mcShow(wch), which);
        await new Promise((resolve) => { setTimeout(resolve, 1800); });
        shots[which] = (await page.screenshot({ type: 'jpeg', quality: 88 })).toString('base64');
      }
      results.push({ s, info, shots });
      console.log(`${s.name}: proc h ${info.hp.toFixed(2)} m · ${Object.entries(info.cands).map(([k, v]) => `${k} ${Math.round(v.tris)} tris ${v.map}`).join(' · ')}`);
    } catch (e) { console.log(`${s.name}: FAILED ${e.message.slice(0, 200)}`); }
  }
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 5).join(' | '));

  const comp = await (await browser.newContext()).newPage();
  const cells = [];
  for (const r of results) {
    const refFile = resolvePath(CANDS, `${r.s.name}.ref.jpg`);
    const ref = existsSync(refFile) ? `data:image/jpeg;base64,${readFileSync(refFile).toString('base64')}` : null;
    const panels = [{ src: `data:image/jpeg;base64,${r.shots.proc}`, cap: 'PROCEDURAL · today, in game' }];
    for (const p of PIPES) if (r.shots[p.id]) panels.push({ src: `data:image/jpeg;base64,${r.shots[p.id]}`, cap: `${p.caption} · ${Math.round(r.info.cands[p.id].tris)} tris` });
    if (ref) panels.push({ src: ref, cap: 'REFERENCE · codex image_gen', square: true });
    const b64 = await comp.evaluate(async (a) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const imgs = await Promise.all(a.panels.map((p) => load(p.src)));
      const PW = 480, PH = 600, G = 8, TOP = 34, BOT = 30;
      const c = document.createElement('canvas'); c.width = (PW + G) * imgs.length + G; c.height = PH + TOP + BOT;
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, i) => {
        const X = G + i * (PW + G);
        if (a.panels[i].square) { x.fillStyle = '#e9e6e1'; x.fillRect(X, TOP, PW, PH); x.drawImage(im, X, TOP + (PH - PW) / 2, PW, PW); }
        else x.drawImage(im, X, TOP, PW, PH);
        x.font = '600 14px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(a.panels[i].cap, X + 4, TOP + PH + 20);
      });
      x.font = '600 20px ui-sans-serif, system-ui'; x.fillStyle = '#ffd98a'; x.fillText(a.label, G, 24);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    }, { panels, label: TAG ? `${r.s.label} · ${TAG}` : r.s.label });
    writeFileSync(resolvePath(OUT, `${r.s.name}-4up${TAG ? `-${TAG}` : ''}.jpg`), Buffer.from(b64, 'base64'));
    cells.push(b64);
  }
  if (cells.length > 1) {
    const sheet = await comp.evaluate(async (list) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const imgs = await Promise.all(list.map((b) => load(`data:image/jpeg;base64,${b}`)));
      const w = 1500, G = 6;
      const hs = imgs.map((im) => Math.round(w * im.height / im.width));
      const c = document.createElement('canvas'); c.width = w + G * 2; c.height = hs.reduce((s, h) => s + h + G, G);
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      let y = G;
      imgs.forEach((im, i) => { x.drawImage(im, G, y, w, hs[i]); y += hs[i] + G; });
      for (let qq = 0.8; qq >= 0.3; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.3).split(',')[1];
    }, cells);
    writeFileSync(resolvePath(OUT, only.length > 0 ? `sheet-${only.join('-')}.jpg` : 'models-sheet.jpg'), Buffer.from(sheet, 'base64'));
  }
  console.log(`wrote ${results.length} × 4-up to progress/nalati-merge/d/`);
} finally {
  await browser.close();
}
