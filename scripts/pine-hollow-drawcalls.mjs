#!/usr/bin/env node
// pine-hollow-drawcalls.mjs — where Pine Hollow's draw calls go, per group, per pass, per pose (PINE-HOLLOW-REMASTER PH-P1 / P2).
//
// The play-perf breakdown technique (project/archive/2026-09-22-play-perf.md), scripted: every draw three.js counts
// (`renderer.info.update`, so the sum is exactly `game.lastFrame.calls`) is charged to the object `renderBufferDirect`
// is drawing, and that object to the `__world` entry that owns it (the nearest ancestor reachable from `__world.<key>`
// through ≤ 3 levels of properties: `sky.clouds`, `cabins.groups[]`, `forest.batch` …). The pass is `shadow` (three's
// shadow map draws with a null scene), `main` (the game scene, whatever target) or `post` (any other scene: the
// composer's quads, the sky dome's env re-render). Groups roll labels up into terrain / forest / undergrowth / grass /
// props / cabins / animals / water / sky / particles / viewmodel / boundary / post / other.
//
// Per tier (phone: iPhone 16 Pro 390×844 @3, touch, `tier=phone`; desktop: 1600×900 `tier=desktop`) one page load,
// then per pose: spawn, settle, record `--frames` frames; the frame whose total is the median is the breakdown.
//
//   node scripts/pine-hollow-drawcalls.mjs --url=http://localhost:4191 --tag=before
//   node scripts/pine-hollow-drawcalls.mjs --url=… --tiers=desktop --poses=cabin --detail=40
//
// Writes progress/pine-hollow-drawcalls-<tag>.json and prints group × pass tables. Serve a clean `git archive HEAD`
// export (never the dev server). One headless Chromium on Metal, muted, closed at the end.
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4191');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const SETTLE = Number(flag('settle', '6')) * 1000;
const FRAMES = Number(flag('frames', '9'));
const DETAIL = Number(flag('detail', '12')); // labels listed per pose
const tiers = flag('tiers', 'phone,desktop').split(',').filter(Boolean);
/** pine-hollow-perf.mjs's poses + layout v2's hamlet and lookout (yaw faces (-sin yaw, -cos yaw)) */
const POSES = [
  { id: 'gate', x: 0, z: -200, yaw: 3.1416 },
  { id: 'cabin', x: -14, z: -62, yaw: 3.1416 },
  { id: 'pond', x: -56, z: 95, yaw: 3.1416 },
  { id: 'shore', x: -60, z: 106, yaw: 1.5708 },
  { id: 'hamlet', x: -150, z: -130, yaw: 0 },
  { id: 'lookout', x: 36, z: 208, yaw: 0 },
].filter((p) => flag('poses', '') === '' || flag('poses', '').split(',').includes(p.id));

/** label → group; first match wins */
const GROUPS = [
  ['post', /^post:/], ['terrain', /^terrain/], ['forest', /^forest/], ['undergrowth', /^under/], ['grass', /^grass/],
  ['props', /^props/], ['cabins', /^cabins|^cabin/], ['animals', /^animals/], ['water', /^(water|streams)/],
  ['sky', /^(sky|dome|horizon)/], ['particles', /^particles/], ['viewmodel', /^(crossbow|hands|camera)/], ['boundary', /^boundary/],
];
const groupOf = (label) => (GROUPS.find(([, re]) => re.test(label)) ?? ['other'])[0];

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** in the page: hook the renderer once; returns nothing (state on window.__dc) */
function installHooks() {
  const w = window.__world, g = w.game, r = g.renderer, info = r.info;
  /** the first non-empty name */
  const nameOf = (...xs) => xs.find((x) => typeof x === 'string' && x !== '') ?? '';
  // object → label, BFS over __world (shallowest path wins)
  const labels = new Map();
  const seen = new Set();
  const queue = Object.keys(w).filter((k) => k !== 'game' && k !== 'registry' && k !== 'physics').map((k) => [w[k], k, 0]);
  while (queue.length > 0) {
    const [v, path, depth] = queue.shift();
    if (v === null || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (v.isObject3D === true) { if (!labels.has(v)) labels.set(v, path); if (v === g.scene) continue; }
    if (v.isMaterial === true || v.isBufferGeometry === true || v.isTexture === true || v instanceof Node || depth >= 3) continue;
    if (Array.isArray(v)) { for (let i = 0; i < Math.min(v.length, 400); i++) queue.push([v[i], `${path}[]`, depth + 1]); continue; }
    if (v instanceof Map) { for (const x of v.values()) queue.push([x, `${path}{}`, depth + 1]); continue; }
    for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch { continue; } if (x !== null && typeof x === 'object') queue.push([x, `${path}.${k}`, depth + 1]); }
  }
  const labelOf = (o) => {
    for (let p = o; p !== null; p = p.parent) {
      const l = labels.get(p);
      if (l !== undefined) return l;
      if (p.parent === g.scene) {
        // not reachable from __world: the Horizon rings (ridge0‥n), or name the scene child by its index + a material
        const ridges = []; p.traverse((c) => { if (/^ridge\d/.test(c.material?.name ?? '')) ridges.push(c); });
        if (ridges.length > 0) return 'horizon';
        const mats = new Set(); p.traverse((c) => { const m = Array.isArray(c.material) ? c.material[0] : c.material; if (m !== undefined && mats.size < 3) mats.add(nameOf(m.name, m.type)); });
        return `scene#${g.scene.children.indexOf(p)}:${p.type}${p.name === '' ? '' : ` "${p.name}"`}(${[...mats].join(',')})`;
      }
      if (p === g.camera) return 'camera';
    }
    return `loose:${o.type}${o.name === '' ? '' : ` "${o.name}"`}`;
  };
  const rtIds = new Map();
  const animalOf = new Map((w.animals?.animals ?? []).map((a) => [a.mesh, a]));
  const dc = { frames: [], cur: new Map(), last: [], labels }; // last[0]: the draw renderBufferDirect is making
  window.__dc = dc;
  const origRBD = r.renderBufferDirect;
  r.renderBufferDirect = function renderBufferDirect(camera, scene, geometry, material, object, group) {
    dc.last[0] = { scene, material, object };
    return origRBD.call(this, camera, scene, geometry, material, object, group);
  };
  const origUpdate = info.update;
  info.update = function update(count, mode, inst) {
    const t0 = info.render.triangles;
    origUpdate.call(this, count, mode, inst);
    const d = dc.last[0];
    let pass = 'post', label;
    if (d === undefined) label = 'post:?';
    else if (d.scene === null) { pass = 'shadow'; label = labelOf(d.object); }
    else if (d.scene === g.scene) { pass = 'main'; label = labelOf(d.object); }
    else label = `post:${nameOf(d.material.name, d.material.type)}`;
    let name = d === undefined ? '' : nameOf(d.object.name, d.material.name, d.object.type);
    // an animal: its kind, draw LOD (materials on the mesh) and camera distance band
    const an = d === undefined ? undefined : animalOf.get(d.object);
    if (an !== undefined) {
      const dist = an.position.distanceTo(g.camera.position);
      const parts = Array.isArray(an.mesh.material) ? Math.max(1, an.mesh.geometry.groups.length) : 1; // draws per pass (Animal.setDrawLod)
      name = `${an.kind} ${parts}part ${dist < 45 ? '<45' : dist < 80 ? '45-80' : dist < 100 ? '80-100' : dist < 150 ? '100-150' : '150+'}m`;
    }
    const t = r.getRenderTarget();
    let rt = 'canvas';
    if (t !== null) { let id = rtIds.get(t); if (id === undefined) { id = rtIds.size; rtIds.set(t, id); } rt = `${t.width}x${t.height}#${id}`; }
    const key = `${pass}|${label}|${name}|${rt}`;
    const e = dc.cur.get(key) ?? { pass, label, name, rt, calls: 0, tris: 0 };
    e.calls++; e.tris += info.render.triangles - t0;
    dc.cur.set(key, e);
  };
  const origReset = info.reset;
  info.reset = function reset() {
    if (dc.cur.size > 0) dc.frames.push([...dc.cur.values()]);
    if (dc.frames.length > 60) dc.frames.shift();
    dc.cur = new Map();
    origReset.call(this);
  };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = { tag: TAG, url: URL_BASE, query: EXTRA, when: new Date().toISOString(), rows: [] };
try {
  const iphone = devices['iPhone 16 Pro'];
  const CTX = {
    phone: { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } },
    desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
  };
  for (const tier of tiers) {
    const ctx = await browser.newContext(CTX[tier]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const p0 = POSES[0];
    const q = ['chunk=pine-hollow', 'mute=1', 'skipintro=1', 'nolock=1', 'sw=0', `tier=${tier}`, tier === 'phone' ? 'touch' : '', `x=${p0.x}`, `z=${p0.z}`, `yaw=${p0.yaw}`, EXTRA].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: 300000, polling: 500 });
    await sleep(SETTLE);
    await page.evaluate(installHooks);
    for (const p of POSES) {
      await page.evaluate((pp) => { const w = window.__world; w.player.spawn(pp.x, pp.z, pp.yaw); w.player.pitch = 0; }, p);
      await sleep(SETTLE);
      const frames = await page.evaluate((n) => new Promise((resolve) => {
        const dc = window.__dc; dc.frames.length = 0;
        const tick = () => { if (dc.frames.length < n) { requestAnimationFrame(tick); return; } resolve(dc.frames.slice(0, n)); };
        requestAnimationFrame(tick);
      }), FRAMES);
      const totals = frames.map((f) => f.reduce((a, e) => a + e.calls, 0));
      const order = totals.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]);
      const pick = frames[order[Math.floor(order.length / 2)][1]];
      const entries = pick.map((e) => Object.assign(e, { group: groupOf(e.label) })).sort((a, b) => b.calls - a.calls);
      const groups = {};
      for (const e of entries) {
        const gname = e.group;
        const gr = (groups[gname] ??= { main: 0, shadow: 0, post: 0, tris: 0 });
        gr[e.pass] += e.calls; gr.tris += e.tris;
      }
      const calls = entries.reduce((a, e) => a + e.calls, 0), tris = entries.reduce((a, e) => a + e.tris, 0);
      out.rows.push({ tier, pose: p.id, calls, tris, totalsSeen: totals, groups, entries });
      const gl = Object.entries(groups).sort((a, b) => (b[1].main + b[1].shadow + b[1].post) - (a[1].main + a[1].shadow + a[1].post));
      console.log(`\n${tier} ${p.id}: ${calls} calls · ${(tris / 1e6).toFixed(2)} M tris (frames ${totals.join(' ')})`);
      console.log(`  ${gl.map(([k, v]) => `${k} ${v.main}${v.shadow ? `+${v.shadow}s` : ''}${v.post ? `+${v.post}p` : ''}`).join(' · ')}`);
      const byLabel = new Map();
      for (const e of entries) { const k = `${e.pass} ${e.label}`; byLabel.set(k, (byLabel.get(k) ?? 0) + e.calls); }
      const byRt = new Map();
      for (const e of entries) { const k = `${e.pass}@${e.rt}`; byRt.set(k, (byRt.get(k) ?? 0) + e.calls); }
      console.log(`  targets: ${[...byRt].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
      console.log(`  top: ${[...byLabel].sort((a, b) => b[1] - a[1]).slice(0, DETAIL).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
    }
    if (errors.length > 0) console.error(`[${tier}] page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
const file = resolvePath(ROOT, `progress/pine-hollow-drawcalls-${TAG}.json`);
writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`\n→ progress/pine-hollow-drawcalls-${TAG}.json`);
