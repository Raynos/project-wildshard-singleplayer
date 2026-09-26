#!/usr/bin/env node
// nine-dragon-budget.mjs — E169 P0-5c, the Nine Dragon Stack partial shard's phone budget ruler
// (art/nine-dragon-stack/budget.md holds the caps). Serve a build (`vite preview`, or the dev server) and run:
//
//   node scripts/nine-dragon-budget.mjs [--url=http://localhost:4173] [--totals]
//
// The phone frame (402×874 @3, tier phone, the shard's portrait FOV) from the eight domes' 72 cameras
// (art/nine-dragon-stack/round-15-eight-domes/<dome>/cameras.json) and the four mockup cameras
// (src/chunks/nine-dragon-stack/mockupCameras.ts), each posed with a free camera from a late hook (the viewmodel on, as
// in play). Pass 1: every pose, the draws / triangles of one composer frame. Pass 2 (skipped with --totals), at each
// dome's own view (5), the mockup cameras and the three worst poses: each top-level child of the fragment rendered alone
// through the whole composer (its extra passes count), minus the empty frame, split into the budget's lanes — by the
// kit's name where a dome names its kits for its region, else by where its triangles / instances stand.
// One headless Chromium, Metal, muted; take the machine's browser lock around it when other agents capture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const base = flag('url', 'http://localhost:4173');
const ART = join(ROOT, 'art/nine-dragon-stack/round-15-eight-domes');
const DOMES = ['A1-spawn-stand', 'A2-gate-look', 'B1-well-edge-stand', 'B2-well-edge-look', 'C1-stair-stand', 'C2-stair-look', 'D1-well-down-stand', 'D2-well-down-look'];
const views = [];
for (const d of DOMES) {
  const cams = JSON.parse(readFileSync(`${ART}/${d}/cameras.json`, 'utf8'));
  for (const v of cams.views) views.push({ id: `${d.slice(0, 2)}·${v.n} ${v.name}`, dome: d, n: v.n, eye: v.eye, look: v.look, kind: v.kind });
}
const { MOCKUP_CAMERAS } = await import(join(ROOT, 'src/chunks/nine-dragon-stack/mockupCameras.ts'));
for (const [k, c] of Object.entries(MOCKUP_CAMERAS)) {
  const y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
  const look = [c.eye[0] + Math.sin(y) * Math.cos(p) * 20, c.eye[1] + Math.sin(p) * 20, c.eye[2] - Math.cos(y) * Math.cos(p) * 20];
  views.push({ id: `mockup ${k}`, dome: 'mockup', n: 5, eye: c.eye, look, kind: 'fp' });
}
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.info(`pageerror: ${e.message.slice(0, 300)}`));
  await page.goto(`${base}/?chunk=nine-dragon-stack&skipintro=1&tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.game?.lastFrame && window.__world.game.lastFrame.calls > 20 && !document.querySelector('.ws-load')), undefined, { timeout: 240000, polling: 1000 });
  await page.evaluate(() => {
    const w = window.__world;
    window.__bud = { pose: null };
    w.game.onLate(() => {
      const p = window.__bud.pose, cam = w.game.camera;
      if (!p) return;
      cam.position.set(p.eye[0], p.eye[1], p.eye[2]);
      cam.up.set(0, 1, 0);
      cam.lookAt(p.look[0], p.look[1], p.look[2]);
      cam.updateMatrixWorld(true);
    });
    w.freeCamera = true;
  });
  const pose = async (v) => {
    await page.evaluate((vv) => {
      const w = window.__world;
      w.freeCamera = true;
      try { w.player.position.set(vv.eye[0], Math.max(125, vv.eye[1] - 1.62), vv.eye[2]); w.player.velocity.set(0, 0, 0); } catch { /* */ }
      window.__bud.pose = vv;
    }, v);
    await sleep(700);
  };
  // pass 1: every pose's total
  const totals = [];
  for (const v of views) {
    await pose(v);
    const r = await page.evaluate(() => { const g = window.__world.game, rd = g.renderer; rd.info.reset(); g.composer.render(0.016); return { calls: rd.info.render.calls, tris: rd.info.render.triangles }; });
    totals.push({ ...v, ...r });
  }
  console.info('pass 1: every pose (phone frame, one composer render)');
  for (const d of [...DOMES, 'mockup']) {
    const t = totals.filter((x) => x.dome === d);
    console.info(`  ${d.padEnd(20)} ${t.map((x) => `${x.n}:${x.calls}/${(x.tris / 1e6).toFixed(2)}`).join('  ')}`);
  }
  const worst = [...totals].sort((a, b) => b.tris - a.tris);
  console.info(`  worst: ${worst.slice(0, 6).map((x) => `${x.id} ${x.calls} dr ${(x.tris / 1e6).toFixed(2)} M`).join(' · ')}`);
  const pick = argv.includes('--totals') ? [] : [...totals.filter((x) => x.n === 5), ...worst.slice(0, 3)].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
  // pass 2: lanes
  const out = [];
  for (const v of pick) {
    await pose(v);
    const r = await page.evaluate(() => {
      const W = window.__world, g = W.game, rd = g.renderer, cam = g.camera;
      const Y0 = 125, SPLIT = 95;
      const LANES = ['A2 square', 'B1/D1 Well rim + galleries', 'B2 crossings + run north', 'D2 lower Well', 'C1 stair foot', 'C2 upper stair', 'towers + street', 'look (shared)', 'viewmodel', 'post chain (empty frame)'];
      const region = (x, y, z) => {
        if (x < 0.3 && x > -38 && z > -110 && z < 24) {
          if (z < -44.1) return y < Y0 + 30 ? 'B2 crossings + run north' : 'towers + street';
          if (y >= Y0 + 6) return 'towers + street';
          return y >= SPLIT ? 'B1/D1 Well rim + galleries' : 'D2 lower Well';
        }
        if (x >= 22 && z > -12 && z < 24) return x < 34.6 ? 'C1 stair foot' : 'C2 upper stair';
        if (x > -2 && x < 26 && z > -30 && z < 26 && y < Y0 + 20) return 'A2 square';
        return 'towers + street';
      };
      const byName = (n) => {
        if (/^kit:well-[cx]-/.test(n)) return 'B2 crossings + run north';
        if (n.startsWith('kit:well-l-')) return 'D2 lower Well';
        if (/^kit:well-(r-|rim)/.test(n)) return 'B1/D1 Well rim + galleries';
        if (/^kit:stair-(terraces|far)/.test(n)) return 'C2 upper stair';
        if (n.startsWith('kit:stair-foot')) return 'C1 stair foot';
        if (/^kit:(paifang|masts|plaza|props|strings|banyan|stall|gate|hawker|shrine)/.test(n) || n === 'props3d' || n === 'canopy') return 'A2 square';
        if (/^kit:(deck|deck2|crown|blades|cables|bridges|monorail)$/.test(n)) return 'towers + street';
        if (/^(neon|signs|streaks|screens|sky|sheets|steam|movers)$/.test(n) || n === 'kit:facade-signs') return 'look (shared)';
        return null;
      };
      // a mesh's triangles per lane (world-space, cached: the fragment is static)
      window.__budCache ??= new Map();
      const cache = window.__budCache;
      const split = (mesh, lane) => {
        const key = mesh.uuid;
        if (!mesh.isInstancedMesh && cache.has(key)) return cache.get(key);
        const res = {};
        const gi = mesh.geometry, pos = gi.attributes.position;
        if (!pos) { cache.set(key, res); return res; }
        const idx = gi.index, nTri = (idx ? idx.count : pos.count) / 3;
        const add = (l, t) => { res[l] = (res[l] ?? 0) + t; };
        mesh.updateWorldMatrix(true, false);
        const mw = mesh.matrixWorld.elements;
        const w = (lx, ly, lz) => [mw[0] * lx + mw[4] * ly + mw[8] * lz + mw[12], mw[1] * lx + mw[5] * ly + mw[9] * lz + mw[13], mw[2] * lx + mw[6] * ly + mw[10] * lz + mw[14]];
        if (lane !== null) add(lane, mesh.isInstancedMesh ? nTri * mesh.count : nTri);
        else if (mesh.isInstancedMesh) {
          const e = mesh.instanceMatrix.array;
          for (let i = 0; i < mesh.count; i++) { const [x, y, z] = w(e[i * 16 + 12], e[i * 16 + 13], e[i * 16 + 14]); add(region(x, y, z), nTri); }
        } else {
          const a = pos.array, st = pos.itemSize === 3 && !pos.isInterleavedBufferAttribute ? 3 : 0;
          for (let t = 0; t < nTri; t++) {
            let sx = 0, sy = 0, sz = 0;
            for (let k = 0; k < 3; k++) {
              const vi = idx ? idx.getX(t * 3 + k) : t * 3 + k;
              if (st) { sx += a[vi * 3]; sy += a[vi * 3 + 1]; sz += a[vi * 3 + 2]; } else { sx += pos.getX(vi); sy += pos.getY(vi); sz += pos.getZ(vi); }
            }
            const [x, y, z] = w(sx / 3, sy / 3, sz / 3);
            add(region(x, y, z), 1);
          }
        }
        if (!mesh.isInstancedMesh) cache.set(key, res);
        return res;
      };
      const root = g.scene.getObjectByName('nine-dragon-stack');
      const vm = cam.children;
      const measure = () => { rd.info.reset(); g.composer.render(0.016); return { calls: rd.info.render.calls, tris: rd.info.render.triangles }; };
      const vis = new Map(); for (const o of [...root.children, ...vm]) vis.set(o, o.visible);
      const all = measure();
      for (const o of [...root.children, ...vm]) o.visible = false;
      const empty = measure();
      const lanes = Object.fromEntries(LANES.map((l) => [l, { calls: 0, tris: 0, kinds: {} }]));
      lanes['post chain (empty frame)'] = { calls: empty.calls, tris: empty.tris, kinds: {} };
      for (const o of root.children) {
        if (!vis.get(o)) continue;
        o.visible = true;
        const m = measure();
        o.visible = false;
        const dc = m.calls - empty.calls, dt = m.tris - empty.tris;
        if (dc <= 0 && dt <= 0) continue;
        const name = o.name === '' ? '?' : o.name;
        const kind = name.startsWith('kit:') ? 'kits' : name.startsWith('inst:') ? 'inst dressing' : name;
        // the child's geometry per lane, then its measured cost in that proportion; its draws by mesh majority
        const geo = {}; let geoSum = 0; const drawLane = {}; let meshes = 0;
        o.traverse((n) => {
          if (!n.isMesh || (n !== o && !n.visible)) return;
          const s = split(n, byName(name));
          let best = null, bt = -1;
          for (const [l, t] of Object.entries(s)) { geo[l] = (geo[l] ?? 0) + t; geoSum += t; if (t > bt) { bt = t; best = l; } }
          if (best !== null) { drawLane[best] = (drawLane[best] ?? 0) + 1; meshes++; }
        });
        if (geoSum === 0) continue;
        for (const [l, t] of Object.entries(geo)) {
          const L = lanes[l];
          const tr = (dt * t) / geoSum;
          L.tris += tr;
          L.kinds[kind] = (L.kinds[kind] ?? 0) + tr;
        }
        for (const [l, c] of Object.entries(drawLane)) lanes[l].calls += (dc * c) / meshes;
      }
      for (const o of vm) o.visible = vis.get(o);
      const mv = measure();
      lanes.viewmodel = { calls: mv.calls - empty.calls, tris: mv.tris - empty.tris, kinds: {} };
      for (const [o, vv] of vis) o.visible = vv;
      return { total: all, lanes };
    });
    out.push({ view: v.id, ...r });
    console.info(`\n${v.id}: total ${r.total.calls} draws · ${(r.total.tris / 1e6).toFixed(2)} M tris`);
    for (const [l, m] of Object.entries(r.lanes)) {
      if (m.calls < 0.5 && m.tris < 500) continue;
      const kinds = Object.entries(m.kinds).filter(([, t]) => t > 5000).sort((a, b) => b[1] - a[1]).map(([k, t]) => `${k} ${(t / 1e3).toFixed(0)}k`).join(', ');
      console.info(`  ${l.padEnd(28)} ${m.calls.toFixed(0).padStart(4)} dr ${(m.tris / 1e6).toFixed(3)} M  ${kinds}`);
    }
  }
  console.info(`\nJSON ${JSON.stringify({ totals: totals.map(({ id, calls, tris }) => ({ id, calls, tris })), lanes: out })}`);
  await ctx.close();
} finally {
  await browser.close();
}
