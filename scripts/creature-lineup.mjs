#!/usr/bin/env node
// creature-lineup.mjs — every coat of a shard's creatures side by side, IN the live shard: one row per species, each
// variant an Animal from the game's own factory (no AI) standing in a line, frozen at one gait phase, shot side-on.
// Shard-agnostic stand-in for Nalati's scripts/nalati-creature-lineup.mjs (which needs Nalati's dev page): the chunk
// picks the spot and the species rows (PINE-HOLLOW-REMASTER PH-M1: every rarity coat + the King's thralls).
//
//   node scripts/creature-lineup.mjs --chunk=pine-hollow [--creatures=glb|proc] [--gait=idle:0] [--tier=desktop]
//   [--out=progress/pine-hollow-creatures-lineup.jpg] [--url=http://127.0.0.1:5176] [--q=tod=golden]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const CHUNK = flag('chunk', 'pine-hollow');
const CHUNKS = {
  'pine-hollow': {
    spot: { x: 6, z: -178 }, q: 'tod=day&clock=1e6',
    rows: [
      ['deer', ['hind', 'stag', 'white-hind', 'white-stag', 'big-stag', 'piebald', 'ghost']],
      ['elk', ['cow', 'bull', 'big-bull', 'pale', 'imperial', 'thrall']],
      ['boar', ['boar', 'sow', 'black', 'big', 'scarback', 'ironhide', 'thrall']],
      ['bear', ['black', 'black-blaze', 'brown', 'black-old', 'brown-old']],
    ],
  },
};
const CFG = CHUNKS[CHUNK];
if (!CFG) throw new Error(`creature-lineup: no table for chunk '${CHUNK}'`);
const URL_BASE = flag('url', 'http://127.0.0.1:5176');
const LOOK = flag('creatures', 'glb');
const TIER = flag('tier', 'desktop');
const [GAIT, PHASE] = flag('gait', 'idle:0').split(':');
const OUT = resolvePath(ROOT, flag('out', `progress/${CHUNK}-creatures-lineup-${LOOK}.jpg`));
const W = 1600, H = 520;
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = [];
try {
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  const q = [`chunk=${CHUNK}`, 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', 'perf=0', `tier=${TIER}`, `creatures=${LOOK}`, `x=${CFG.spot.x}`, `z=${CFG.spot.z + 30}`, CFG.q, flag('q', '')].filter(Boolean).join('&');
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"]{display:none!important}' });
  await page.evaluate(async ({ spot, gait, phase }) => {
    const w = window.__world;
    const { Animal } = await import('/src/entities/Animal.ts');
    const { heightAt } = await import('/src/world/Heightfield.ts');
    w.animals.group.visible = false;
    const cam = w.game.camera;
    const st = { list: [], pose: { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 }, ready: false };
    window.__ln = st;
    window.__lnRow = (kind, variants) => {
      for (const a of st.list) a.mesh.parent?.remove(a.mesh);
      st.list.length = 0;
      const f = w.animals.factory;
      // each at its variant's own mid scale, spaced by its body length
      const made = variants.map((v) => { const m = f.model(kind, v); const vd = m.variantDef; return { m, s: (vd.scale[0] + vd.scale[1]) / 2 }; });
      const lens = made.map(({ m, s }) => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return (b.max.z - b.min.z) * s; });
      const gap = Math.max(...lens) * 0.28;
      const total = lens.reduce((a, b) => a + b, 0) + gap * (lens.length - 1);
      let x = spot.x + total / 2, hMax = 0;   // +X is the camera's left: the first variant stands leftmost
      made.forEach(({ m, s }, i) => {
        const rig = f.instantiate(m, 0.5);
        const a = new Animal(rig, m, 7 + i, s);
        a.prepareMaterial = (mm) => w.sky.setupMaterial(mm);
        const len = lens[i] ?? 1;
        a.place(x - len / 2, spot.z, -Math.PI / 2);   // facing −X (walking left to right on the sheet reads their order), side-on to the camera
        a.sampleTerrain?.();
        rig.mesh.castShadow = true; rig.mesh.receiveShadow = true;
        w.game.scene.add(rig.mesh);
        st.list.push(a);
        m.geometry.computeBoundingBox();
        hMax = Math.max(hMax, (m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y) * s);
        x -= len + gap;
      });
      const gy = heightAt(spot.x, spot.z);
      const d = Math.max(total * 0.95, hMax * 3.6);
      st.pose = { x: spot.x, y: gy + hMax * 0.55, z: spot.z - d, tx: spot.x, ty: gy + hMax * 0.45, tz: spot.z };
      st.ready = true;
      return { n: st.list.length, total, hMax };
    };
    w.game.onUpdate(() => {
      for (const a of st.list) {
        a.debugGait = { gait, phase };
        a.gaitW.fill(0);
        a.update(1e-4, 0.5, true);
      }
      if (!st.ready) return;
      const p = st.pose;
      cam.position.set(p.x, p.y, p.z); cam.lookAt(p.tx, p.ty, p.tz);
      if (Math.abs(cam.fov - 22) > 0.01) { cam.fov = 22; cam.updateProjectionMatrix(); }
      for (const c of cam.children) c.visible = false;
    });
  }, { spot: CFG.spot, gait: GAIT, phase: Number(PHASE) });
  for (const [kind, variants] of CFG.rows) {
    const info = await page.evaluate(([k, v]) => window.__lnRow(k, v), [kind, variants]);
    await page.waitForTimeout(1500);
    shots.push({ label: `${kind}: ${variants.join(' · ')}   (?creatures=${LOOK}, ${TIER})`, b64: (await page.screenshot({ type: 'jpeg', quality: 88 })).toString('base64') });
    console.log(kind, JSON.stringify(info));
  }
  if (errs.length > 0) console.log('page errors:', errs.slice(0, 3).join(' | '));
  const comp = await (await browser.newContext()).newPage();
  const b64 = await comp.evaluate(async ({ list, w, h }) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const G = 4, LAB = 22;
    const c = document.createElement('canvas'); c.width = w; c.height = list.length * (h + LAB + G);
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) {
      const im = await load(`data:image/jpeg;base64,${list[i].b64}`);
      const y = i * (h + LAB + G);
      x.drawImage(im, 0, y + LAB, w, h);
      x.font = '600 15px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(list[i].label, 6, y + 16);
    }
    for (let qq = 0.85; qq >= 0.35; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.3).split(',')[1];
  }, { list: shots, w: 1400, h: Math.round(1400 * H / W) });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT.slice(ROOT.length + 1)}`);
} finally {
  await browser.close();
}
