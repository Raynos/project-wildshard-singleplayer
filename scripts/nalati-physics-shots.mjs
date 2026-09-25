#!/usr/bin/env node
// nalati-physics-shots.mjs — the physics debug view (`?physics=debug`: every Rapier collider as lines) over Nalati's POIs,
// for NALATI-MERGE P1's before / after. One muted headless page (desktop 1280×720), the free camera parked at a
// three-quarter view over each POI; writes progress/nalati-merge/p1/<tag>-<shot>.jpg and <tag>-counts.json (collider
// counts, legacy bridge boxes, floor functions, registry pieces).
//
// --xray: the colliders drawn over everything (no depth test), coloured by material and without the terrain's
// heightfield: wood / planks orange, rock / stone grey-blue, felt white, earth brown, sand tan, metal cyan, flesh red.
// --navmesh: the baked navmesh instead (`?navmesh=debug`, NALATI-MERGE P3) — the polys a creature paths on, over the world.
//
//   node scripts/nalati-physics-shots.mjs --tag=before [--url=http://127.0.0.1:5188] [--only=camp,bridge] [--xray]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const TAG = flag('tag', 'latest');
const OUT = resolvePath(flag('out', 'progress/nalati-merge/p1'));
const only = flag('only', '').split(',').filter(Boolean);
const XRAY = argv.includes('--xray');
const NAVMESH = argv.includes('--navmesh');
mkdirSync(OUT, { recursive: true });

// [name, target x, target z, target lift over the ground, camera offset x, height over the target, offset z]
const SHOTS = [
  ['camp', 88, 212, 1, -26, 16, -22],
  ['camp-close', 92, 208, 1, -10, 7, -12],
  ['bridge', 0, null, 0, -16, 9, -14],
  ['kurgans', -106, 84, 1, 22, 20, -22],
  ['great-kurgan', -170, 75, 2, 16, 7, 10],
  ['eagle-rock', 180, 85, 8, -30, 14, -26],
  ['leopard-cave', 138, -68, 1, -12, 8, 14],
  ['summer-camp', -91, -26, 1, 16, 10, -16],
  ['dungeon', -40, -95, null, 0, 14, 20],
  ['eagle-access', 169, 50, 0, 22, 12, -10],
  ['eagle-stair-foot', 174.5, 38, 0, 8, 5, -6],
  ['cave-stair', 150, -60, 0, 9, 7, 7],
  ['cave-access', 150, -45, 0, 22, 14, 8],
  ['cave-start', 176, 6, 0, 8, 5, 8],
  ['watchtower-stair', -186, -35, 2, 10, 8, 16],
  // NALATI-MERGE P3 / P4: the camp and the bowl from above, the footpaths up to Eagle Rock, the cave and Argymaq
  ['camp-top', 80, 208, 0, -2, 55, -22],
  ['bowl-top', 40, 40, 0, -8, 120, -70],
  ['eagle-trail', 178, 58, 0, -34, 26, -28],
  ['cave-trail', 128, -56, 0, -4, 24, 24],
  ['argymaq-trail', -176, -46, 0, 14, 26, 28],
];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&mute=1&nolock=1&skipintro=1&${NAVMESH ? 'navmesh' : 'physics'}=debug&time=12&clock=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world), undefined, { timeout: 240000, polling: 1000 });
  await new Promise((resolve) => { setTimeout(resolve, 6000); });
  const counts = await page.evaluate(() => {
    const w = window.__world, ph = w.physics.world;
    const kinds = {};
    ph.colliders.forEach((c) => { const k = c.shape.type; kinds[k] = (kinds[k] ?? 0) + 1; });
    return {
      colliders: ph.colliders.len(), byShape: kinds, legacyBoxes: w.player.colliders.length, floorFunctions: w.player.platforms.length,
      pieces: w.registry.pieces.map((p) => `${p.id}:${(p.colliders ?? []).length}`), models: w.registry.models().map((m) => `${m.category}/${m.id}`),
    };
  });
  writeFileSync(resolvePath(OUT, `${TAG}-counts.json`), `${JSON.stringify(counts, null, 1)}\n`);
  if (XRAY) {
    await page.evaluate(() => {
      const w = window.__world, ph = w.physics.world, dbg = w.game.scene.getObjectByName('physics-debug'), tagOf = window.__physics?.tagOf;
      if (!dbg || !tagOf) return;
      const COL = { wood: [1, 0.55, 0.1], planks: [1, 0.75, 0.2], rock: [0.55, 0.7, 1], stone: [0.8, 0.85, 0.95], felt: [1, 1, 1], earth: [0.6, 0.35, 0.15], sand: [0.95, 0.8, 0.5], metal: [0.2, 1, 1], flesh: [1, 0.2, 0.2], ground: [0.3, 0.9, 0.3] };
      const pos = [], col = [];
      for (const [m, c] of Object.entries(COL)) {
        const { vertices } = ph.debugRender(undefined, (k) => k.shape.type !== 7 && (tagOf(k)?.material ?? 'wood') === m);
        for (let i = 0; i < vertices.length; i += 3) { pos.push(vertices[i], vertices[i + 1] + 0.02, vertices[i + 2]); col.push(c[0], c[1], c[2]); }
      }
      const Attr = dbg.geometry.attributes.position.constructor;
      const g = dbg.geometry.clone();
      g.setAttribute('position', new Attr(new Float32Array(pos), 3));
      g.setAttribute('color', new Attr(new Float32Array(col), 3));
      g.computeBoundingSphere();
      const Lines = dbg.constructor;
      const lines = new Lines(g, dbg.material.clone());
      lines.material.depthTest = false; lines.material.opacity = 1; lines.renderOrder = 999; lines.frustumCulled = false;
      dbg.visible = false;
      dbg.parent.add(lines);
    });
  }
  console.log(`colliders ${counts.colliders} · legacy boxes ${counts.legacyBoxes} · floor functions ${counts.floorFunctions} · pieces ${counts.pieces.length} · models ${counts.models.length}`);
  for (const [name, tx, tz0, lift, ox, oy, oz] of SHOTS) {
    if (only.length > 0 && !only.includes(name)) continue;
    await page.evaluate(([px, pz0, up, dx, dy, dz]) => {
      const w = window.__world, hf = window.__hf;
      // the bridge: its deck's centre (z from the mesh's bounds); the dungeon: its floor (y 140)
      let pz = pz0;
      if (pz === null) { const b = w.game.scene.getObjectByName('nalati-bridge'); if (b) { b.geometry.computeBoundingBox(); const bb = b.geometry.boundingBox; pz = (bb.min.z + bb.max.z) / 2; } else pz = 160; }
      const py = up === null ? 140 : hf.heightAt(px, pz) + up;
      // park the camera: the player stops posing it, the HUD and the viewmodel hide
      w.player.update = () => undefined;
      if (!document.getElementById('shots-css')) { const st = document.createElement('style'); st.id = 'shots-css'; st.textContent = '*{visibility:hidden!important} canvas{visibility:visible!important}'; document.head.append(st); }
      const cam = w.game.camera;
      for (const c of cam.children) c.visible = false;
      cam.position.set(px + dx, py + dy, pz + dz);
      cam.lookAt(px, py, pz);
      cam.updateMatrixWorld();
    }, [tx, tz0, lift, ox, oy, oz]);
    await new Promise((resolve) => { setTimeout(resolve, 2500); });
    writeFileSync(resolvePath(OUT, `${TAG}${XRAY ? '-xray' : ''}${NAVMESH ? '-navmesh' : ''}-${name}.jpg`), await page.screenshot({ type: 'jpeg', quality: 72 }));
    console.log(`  ${name}`);
  }
  if (errors.length > 0) console.log(`page errors:\n  ${errors.slice(0, 5).join('\n  ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
