#!/usr/bin/env node
// nalati-creature-strip.mjs — every gait of a Nalati creature as a frame strip, rendered IN the live shard, so a rig is
// judged in motion (plan A1 step 5: the creature GLBs skinned to the procedural skeletons, ?creatures=glb).
//
// For each subject it makes one Animal (the game's own factory + Animal.ts, no AI), stands it on the balbal knoll and
// poses it frame by frame: idle, walk / trot / gallop at 4–5 phases each, the attack at 3 points and the death at 3,
// each shot side-on (and the gallop also 3/4 from the front). Output: one sheet per subject,
// progress/nalati-look/creatures/<kind>-<variant>-<tag>.jpg (rows = gaits, columns = phases).
//
//   node scripts/nalati-creature-strip.mjs --only=wolf:grey,horse:dun --tag=glb           # ?creatures=glb
//   node scripts/nalati-creature-strip.mjs --only=wolf:grey --tag=proc --creatures=proc
//   --url=http://127.0.0.1:5192  --tier=phone
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-look/creatures');
mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5192');
const TAG = flag('tag', 'glb');
const CREATURES = flag('creatures', 'glb');
const TIER = flag('tier', 'desktop');
const EXTRA = flag('q', '');
const BAKE = flag('bake', '0') === '1'; // --bake=1 [--hull=wolf] [--bakeopts={"seedR":0.05}]: bake the hull live (use with --creatures=proc)
const only = flag('only', 'wolf:grey,horse:dun').split(',').filter(Boolean);

const SPOT = { x: Number(flag('sx', '41')), z: Number(flag('sz', '-150')) };
const CW = 420, CH = 300; // one cell

const ROWS_ALL = [
  { label: 'views', frames: [{ gait: 'idle', phase: 0, t: 0.5, view: 'front' }, { gait: 'idle', phase: 0, t: 0.5, view: 'back' }, { gait: 'idle', phase: 0, t: 0.5, view: 'right' }, { gait: 'idle', phase: 0, t: 0.5, view: 'under' }] },
  { label: 'idle', frames: [{ gait: 'idle', phase: 0, t: 0.5 }, { gait: 'idle', phase: 0, t: 2.1 }, { gait: 'graze', phase: 0, t: 1 }] },
  { label: 'walk', frames: [0, 0.25, 0.5, 0.75].map((phase) => ({ gait: 'walk', phase })) },
  { label: 'trot', frames: [0, 0.25, 0.5, 0.75].map((phase) => ({ gait: 'trot', phase })) },
  { label: 'gallop', frames: [0, 0.2, 0.4, 0.6, 0.8].map((phase) => ({ gait: 'gallop', phase })) },
  { label: 'gallop 3/4', frames: [0, 0.2, 0.4, 0.6, 0.8].map((phase) => ({ gait: 'gallop', phase, view: 'front' })) },
  { label: 'attack', frames: [0.15, 0.45, 0.6, 0.85].map((attack) => ({ gait: 'idle', phase: 0, attack })) },
  { label: 'death', frames: [0.25, 0.55, 1].map((death) => ({ gait: 'idle', phase: 0, death })) },
];

const ROWSEL = flag('rows', '');
const ROWS = ROWSEL ? ROWS_ALL.filter((r) => ROWSEL.split(',').includes(r.label)) : ROWS_ALL;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: CW, height: CH }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[strip]')) console.log('  page:', m.text().slice(0, 200)); });
  const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', `tier=${TIER}`,
    `creatures=${CREATURES}`, `x=${SPOT.x}`, `z=${SPOT.z + 30}`, EXTRA].filter(Boolean).join('&');
  const t0 = Date.now();
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world && window.__weather && window.__world.animals), undefined, { timeout: 300000, polling: 1000 });
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="elite"],[class*="banner"],[class*="toast"]{display:none!important}' });
  await page.evaluate(async (spot) => {
    const w = window.__world;
    window.__weather.clock.paused = true;
    const { Animal } = await import('/src/entities/Animal.ts');
    const { heightAt } = await import('/src/world/Heightfield.ts');
    const { loadModelRaw } = await import('/src/world/nalati/glbPaint.ts');
    const { THREE } = await import('/src/dev/threeKit.ts');
    if (w.animals?.group) w.animals.group.visible = false;
    if (w.wildlife?.group) w.wildlife.group.visible = false;
    const gy = heightAt(spot.x, spot.z);
    const cam = w.game.camera;
    window.__cs = { cur: null, frame: null, pose: null, gy };
    const st = window.__cs;
    window.__csLoad = async (names) => { for (const n of names) await loadModelRaw(n); };
    window.__csMake = async (kind, variant, bake) => {
      if (st.cur) { st.cur.mesh.parent?.remove(st.cur.mesh); }
      const f = w.animals.factory;
      let model = f.model(kind, variant);
      let report = null;
      if (bake) {
        // the offline bake, live (creatureRigBake.ts on the procedural model — run with --creatures=proc)
        const { bakeCreatureRig } = await import('/src/entities/creatureRigBake.ts');
        const raw = await loadModelRaw(bake.hull);
        const r = bakeCreatureRig(model.geometry, raw.geometry, model.bones, bake.opts ?? {});
        const g = r.geometry; g.clearGroups(); g.addGroup(0, g.index ? g.index.count : g.getAttribute('position').count, 0);
        model = { ...model, geometry: g, map: raw.map };
        report = r.report;
      }
      if (bake?.weights) {
        // weight view: each bone its own colour, blended by the skin weights (no atlas)
        const pal = (b) => { const n = model.bones[b]?.name ?? ''; const c = new THREE.Color();
          if (n.startsWith('FL')) c.setHSL(0.0, 0.9, 0.3 + 0.15 * ['shoulder', 'carpus', 'fetlock'].indexOf(n.slice(3)));
          else if (n.startsWith('FR')) c.setHSL(0.13, 0.9, 0.3 + 0.15 * ['shoulder', 'carpus', 'fetlock'].indexOf(n.slice(3)));
          else if (n.startsWith('BL')) c.setHSL(0.33, 0.9, 0.25 + 0.15 * ['hip', 'stifle', 'hock'].indexOf(n.slice(3)));
          else if (n.startsWith('BR')) c.setHSL(0.75, 0.9, 0.3 + 0.15 * ['hip', 'stifle', 'hock'].indexOf(n.slice(3)));
          else if (n.startsWith('tail')) c.setHSL(0.9, 0.9, 0.5 + 0.1 * (Number(n.slice(4)) || 1));
          else if (n.startsWith('neck') || n.startsWith('mane')) c.setHSL(0.58, 0.8, 0.45);
          else if (n === 'head' || n === 'jaw' || n.startsWith('ear')) c.setHSL(0.5, 0.9, 0.6);
          else if (n === 'belly') c.setRGB(0.3, 0.3, 0.3); else c.setRGB(0.85, 0.85, 0.85);
          return c; };
        const g = model.geometry.clone(), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), n = si.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) { const w2 = sw.getComponent(i, c); if (w2 <= 0) continue; const k = pal(si.getComponent(i, c)); col[i * 3] += k.r * w2; col[i * 3 + 1] += k.g * w2; col[i * 3 + 2] += k.b * w2; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        model = { ...model, geometry: g, map: null };
      }
      const rig = f.instantiate(model, 0.5);
      const a = new Animal(rig, model, 7, 1);
      a.prepareMaterial = (m) => w.sky.setupMaterial(m);
      a.place(spot.x, spot.z, Math.PI / 2); // facing +X: the camera stands on its left side
      a.sampleTerrain?.();
      rig.mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      w.game.scene.add(rig.mesh);
      st.cur = a;
      const box = new THREE_BOX(rig.mesh);
      return { hull: Boolean(model.map), h: box.h, len: box.len, report };
    };
    function THREE_BOX(mesh) {
      mesh.updateMatrixWorld(true);
      const g = mesh.geometry; g.computeBoundingBox();
      const b = g.boundingBox;
      return { h: b.max.y - b.min.y, len: b.max.z - b.min.z };
    }
    w.game.onUpdate(() => {
      const a = st.cur, fr = st.frame;
      if (!a || !fr) return;
      a.debugGait = { gait: fr.gait, phase: fr.phase };
      a.attackT = fr.attack !== undefined ? fr.attack : -1; a.attackDur = 1;
      if (fr.death !== undefined) { a.alive = false; a.state = 'dead'; a.deathT = fr.death; a.deathSide = 1; }
      else { a.alive = true; a.state = 'idle'; a.deathT = -1; }
      a.gaitW.fill(0);
      a.update(1e-4, fr.t ?? 1, true);
      if (fr.death !== undefined) a.deathT = fr.death;
      const p = st.pose; if (!p) return;
      cam.position.set(p.x, p.y, p.z); cam.lookAt(p.tx, p.ty, p.tz);
      if (Math.abs(cam.fov - 36) > 0.01) { cam.fov = 36; cam.updateProjectionMatrix(); }
      for (const c of cam.children) c.visible = false;
    });
    window.__csFrame = (fr, h, len) => {
      st.frame = fr;
      const d = Math.max(h, len) * 1.55 + 0.4;
      const ty = st.gy + h * 0.5;
      if (fr.view === 'back') {
        const a = -Math.PI / 2 - 0.5; // from behind-left
        st.pose = { x: spot.x + Math.sin(a) * d, y: ty + h * 0.3, z: spot.z + Math.cos(a) * d, tx: spot.x, ty, tz: spot.z };
      } else if (fr.view === 'right') {
        st.pose = { x: spot.x, y: ty + h * 0.12, z: spot.z + d, tx: spot.x, ty, tz: spot.z };
      } else if (fr.view === 'under') {
        st.pose = { x: spot.x + 0.3, y: st.gy + h * 0.12, z: spot.z - d * 0.8, tx: spot.x, ty: st.gy + h * 0.3, tz: spot.z };
      } else if (fr.view === 'front') {
        const a = Math.PI / 2 + 0.75; // 3/4 from the front-left (the animal faces +X)
        st.pose = { x: spot.x + Math.sin(a) * d, y: ty + h * 0.35, z: spot.z + Math.cos(a) * d, tx: spot.x, ty, tz: spot.z };
      } else {
        st.pose = { x: spot.x, y: ty + h * 0.12, z: spot.z - d, tx: spot.x, ty, tz: spot.z }; // the animal's left side (it faces +X)
      }
    };
  }, SPOT);

  for (const subj of only) {
    const [kind, variant] = subj.split(':');
    const hullNames = { horse: ['horse-wild', 'horse-saddled'], wolf: ['wolf'], leopard: ['snow-leopard'], eagle: ['eagle'], 'golden-king': ['golden-king'], sheep: ['sheep'] }[kind] ?? [];
    if (CREATURES === 'glb') await page.evaluate(async (n) => { const { loadCreatureRig } = await import('/src/entities/glbCreatures.ts'); for (const x of n) await loadCreatureRig(x).catch(() => null); }, hullNames);
    const bake = BAKE ? { hull: flag('hull', hullNames[kind === 'horse' && variant.startsWith('camp') ? 1 : 0]), opts: JSON.parse(flag('bakeopts', '{}')), weights: flag('weights', '0') === '1' } : null;
    if (bake) await page.evaluate((n) => window.__csLoad(n), [bake.hull]);
    const info = await page.evaluate(([k, v, b]) => window.__csMake(k, v, b), [kind, variant, bake]);
    console.log(`${subj}: hull ${info.hull} h ${info.h.toFixed(2)} len ${info.len.toFixed(2)}${info.report ? ` bake ${JSON.stringify(info.report)}` : ''}`);
    const rows = [];
    for (const row of ROWS) {
      const cells = [];
      for (const fr of row.frames) {
        await page.evaluate(([f, h, l]) => window.__csFrame(f, h, l), [fr, info.h, info.len]);
        await page.waitForTimeout(350);
        cells.push((await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64'));
      }
      rows.push({ label: row.label, cells, frames: row.frames });
    }
    const comp = await (await browser.newContext()).newPage();
    const b64 = await comp.evaluate(async ({ rows: rs, cw, ch, title }) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const maxC = Math.max(...rs.map((r) => r.cells.length));
      const G = 4, LW = 0, TOP = 28, LAB = 20;
      const c = document.createElement('canvas'); c.width = maxC * (cw + G) + G + LW; c.height = TOP + rs.length * (ch + LAB + G);
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      x.font = '600 18px ui-sans-serif, system-ui'; x.fillStyle = '#ffd98a'; x.fillText(title, G, 20);
      for (let r = 0; r < rs.length; r++) {
        const row = rs[r];
        const y = TOP + r * (ch + LAB + G);
        for (let i = 0; i < row.cells.length; i++) {
          const im = await load(`data:image/jpeg;base64,${row.cells[i]}`);
          x.drawImage(im, G + i * (cw + G), y + LAB, cw, ch);
          const f = row.frames[i];
          const tag = f.attack !== undefined ? `attack ${f.attack}` : f.death !== undefined ? `death ${f.death}` : `${f.gait} ${f.phase}`;
          x.font = '600 13px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(`${row.label} · ${tag}`, G + i * (cw + G) + 2, y + 15);
        }
      }
      for (let qq = 0.85; qq >= 0.4; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 1.2e6) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.35).split(',')[1];
    }, { rows, cw: CW, ch: CH, title: `${subj} · ${TAG} (?creatures=${CREATURES}, ${TIER})` });
    await comp.close();
    const out = resolvePath(OUT, `${kind}-${variant}-${TAG}.jpg`);
    writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`  wrote ${out}`);
  }
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 5).join(' | '));
} finally {
  await browser.close();
}
