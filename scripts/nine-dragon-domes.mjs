#!/usr/bin/env node
// nine-dragon-domes.mjs — E281, the Nine Dragon Stack mockup pass: each dome's nine target views against the same nine
// views in the engine, plus the four mockup cameras on the phone frame. One tool for every agent in the pass, so every
// before / after is the same frame.
//
//   node scripts/nine-dragon-domes.mjs --url=http://localhost:4173 --out=<dir> [--domes=A1,A2] [--mockups=A,B] [--tag=pass-1]
//
// Per dome (art/nine-dragon-stack/round-15-eight-domes/<dome>/cameras.json): the nine views on a 2:3 portrait frame at
// each view's own horizontal FOV (the targets' frame), no HUD and no viewmodel (everything but the canvas hidden) →
// <out>/<dome>-<n>.jpg and <out>/<dome>-sheet.jpg (three rows of target | engine pairs). Per mockup camera
// (src/chunks/nine-dragon-stack/mockupCameras.ts): the phone frame (402×874 @3, tier phone, touch) with the HUD and the
// viewmodel, as played → <out>/mockup-<K>.jpg and <out>/mockups-sheet.jpg (mockup over engine). Every pose also logs its
// draws / triangles (one composer render), and the run logs the GPU memory the fragment holds (unique geometry bytes,
// texture bytes at RGBA8 with mips, renderer.info.memory) → <out>/<tag>stats.json.
//
// The browser lane (AGENTS.md: at most 3 game browsers on the machine): the run holds one of two slots,
// .git/nine-dragon-browser-{1,2}.lock, and waits while both are taken. One headless Chromium on Metal, muted, closed at
// the end. Poses use a free camera from a late hook, as scripts/nine-dragon-budget.mjs does.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const base = flag('url', 'http://localhost:4173');
const OUT = resolvePath(flag('out', join(tmpdir(), 'nine-dragon-domes')));
const TAG = flag('tag', '');
const ART = join(ROOT, 'art/nine-dragon-stack/round-15-eight-domes');
const ALL = ['A1-spawn-stand', 'A2-gate-look', 'B1-well-edge-stand', 'B2-well-edge-look', 'C1-stair-stand', 'C2-stair-look', 'D1-well-down-stand', 'D2-well-down-look'];
const pick = flag('domes', 'all');
const domes = pick === 'none' ? [] : ALL.filter((d) => pick === 'all' || pick.split(',').includes(d.slice(0, 2)));
const mpick = flag('mockups', 'all');
const mockups = mpick === 'none' ? [] : ['A', 'B', 'C', 'D'].filter((k) => mpick === 'all' || mpick.split(',').includes(k));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ── the browser slot ──
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function takeSlot() {
  for (;;) {
    for (const n of [1, 2]) {
      const p = join(ROOT, `.git/nine-dragon-browser-${n}.lock`);
      if (existsSync(p)) {
        const pid = Number(readFileSync(p, 'utf8').trim());
        if (pid && alive(pid)) continue;
        try { unlinkSync(p); } catch { /* raced */ }
      }
      try { const fd = openSync(p, 'wx'); writeSync(fd, String(process.pid)); closeSync(fd); return p; } catch { /* raced */ }
    }
    await sleep(5000);
  }
}
const slot = await takeSlot();
const release = () => { try { if (readFileSync(slot, 'utf8').trim() === String(process.pid)) unlinkSync(slot); } catch { /* gone */ } };
process.on('exit', release);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { release(); process.exit(1); });

const { MOCKUP_CAMERAS } = await import(join(ROOT, 'src/chunks/nine-dragon-stack/mockupCameras.ts'));
const jpg64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
const save = (p, dataUrl) => { writeFileSync(p, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')); };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const stats = { url: base, when: new Date().toISOString(), poses: {}, memory: null };
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.info(`pageerror: ${e.message.slice(0, 300)}`));
  await page.goto(`${base}/?chunk=nine-dragon-stack&skipintro=1&tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.chunk?.slug === 'nine-dragon-stack' && (window.__world.game?.lastFrame?.calls ?? 0) > 60 && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
  await sleep(6000);
  await page.evaluate(() => {
    const w = window.__world;
    window.__nd = { pose: null, bare: false };
    w.game.onLate(() => {
      const p = window.__nd.pose, cam = w.game.camera;
      if (!p) return;
      cam.position.set(p.eye[0], p.eye[1], p.eye[2]);
      cam.up.set(0, 1, 0);
      cam.lookAt(p.look[0], p.look[1], p.look[2]);
      if (p.hfov) {
        // the target's frame: its horizontal FOV on this viewport's aspect
        cam.fov = (2 * Math.atan(Math.tan((p.hfov * Math.PI) / 360) / cam.aspect) * 180) / Math.PI;
        cam.updateProjectionMatrix();
      }
      for (const c of cam.children) c.visible = !window.__nd.bare;
      cam.updateMatrixWorld(true);
    });
    w.freeCamera = true;
  });
  const pose = async (v, bare) => {
    await page.evaluate(([vv, b]) => {
      const w = window.__world;
      w.freeCamera = true;
      try { w.player.position.set(vv.eye[0], Math.max(125, vv.eye[1] - 1.62), vv.eye[2]); w.player.velocity.set(0, 0, 0); } catch { /* */ }
      window.__nd.pose = vv; window.__nd.bare = b;
    }, [v, bare]);
    await sleep(1500); // the culler, the lantern / crowd LODs and the TAA-free post settle on the new camera
  };
  const frameStats = () => page.evaluate(() => { const g = window.__world.game, rd = g.renderer; rd.info.reset(); g.composer.render(0.016); return { calls: rd.info.render.calls, tris: rd.info.render.triangles }; });

  // the memory the fragment holds (GPU side, estimated from the scene; the phone's process total is E264's job)
  stats.memory = await page.evaluate(() => {
    const g = window.__world.game, geos = new Set(), texs = new Set();
    g.scene.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) for (const v of Object.values(m)) if (v?.isTexture) texs.add(v);
      for (const m of ms) if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) texs.add(u.value);
    });
    let gb = 0;
    for (const geo of geos) {
      for (const a of Object.values(geo.attributes)) gb += a.array?.byteLength ?? a.data?.array?.byteLength ?? 0;
      if (geo.index) gb += geo.index.array.byteLength;
    }
    let tb = 0;
    for (const t of texs) { const im = t.image; const w = im?.width ?? 0, h = im?.height ?? 0; tb += w * h * 4 * (t.generateMipmaps === false ? 1 : 4 / 3); }
    const mem = g.renderer.info.memory, heap = performance.memory?.usedJSHeapSize ?? 0;
    return { geometries: mem.geometries, textures: mem.textures, sceneGeometries: geos.size, sceneTextures: texs.size, geometryMB: Number((gb / 1e6).toFixed(1)), textureMB: Number((tb / 1e6).toFixed(1)), jsHeapMB: Number((heap / 1e6).toFixed(1)) };
  });
  console.info('memory', JSON.stringify(stats.memory));

  // the domes: 2:3 portrait, bare
  // bare: everything but the game's canvas hidden (the HUD, the touch deck, the minimap)
  const bare = (on) => page.evaluate((b) => {
    document.getElementById('nd-bare')?.remove();
    if (!b) return;
    window.__world.game.renderer.domElement.dataset.ndMain = '1';
    const st = document.createElement('style');
    st.id = 'nd-bare';
    st.textContent = '* { visibility: hidden !important; } [data-nd-main] { visibility: visible !important; }';
    document.head.append(st);
  }, on);
  if (domes.length > 0) {
    await page.setViewportSize({ width: 342, height: 513 });
    await bare(true);
    await sleep(1500);
  }
  for (const d of domes) {
    const cams = JSON.parse(readFileSync(`${ART}/${d}/cameras.json`, 'utf8'));
    const pairs = [];
    for (const v of cams.views) {
      await pose({ eye: v.eye, look: v.look, hfov: v.hfov }, true);
      const f = await frameStats();
      stats.poses[`${d.slice(0, 2)}·${v.n}`] = f;
      const file = join(OUT, `${d}-${v.n}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
      const url = jpg64(file);
      pairs.push({ n: v.n, name: v.name, target: jpg64(`${ART}/${d}/target-${v.n}.jpg`), engine: url, f });
      console.info(`${d.slice(0, 2)}·${v.n} ${v.name}: ${f.calls} draws, ${(f.tris / 1e6).toFixed(2)} M tris`);
    }
    const sheet = await page.evaluate(async ([title, ps]) => {
      const load = (src) => new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.src = src; });
      const TW = 300, TH = 450, G = 8, HEAD = 44, LAB = 26;
      const cv = document.createElement('canvas');
      cv.width = G + 6 * (TW + G); cv.height = HEAD + 3 * (TH + LAB + G) + G;
      const c = cv.getContext('2d');
      c.fillStyle = '#0a0f16'; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = '#8fe3ff'; c.font = 'bold 24px sans-serif'; c.fillText(title, G + 4, 30);
      for (const [i, p] of ps.entries()) {
        const col = (i % 3) * 2, row = Math.floor(i / 3);
        const y = HEAD + row * (TH + LAB + G);
        for (const [j, src] of [p.target, p.engine].entries()) {
          const im = await load(src), x = G + (col + j) * (TW + G);
          const s = Math.max(TW / im.width, TH / im.height), w = im.width * s, h = im.height * s;
          c.save(); c.beginPath(); c.rect(x, y, TW, TH); c.clip(); c.drawImage(im, x + (TW - w) / 2, y + (TH - h) / 2, w, h); c.restore();
          c.fillStyle = j ? '#8fe3ff' : '#ffbe5a'; c.font = 'bold 15px sans-serif';
          c.fillText(j ? `engine · ${p.f.calls} dr · ${(p.f.tris / 1e6).toFixed(2)} M` : `${p.n} · ${p.name} · target`, x + 2, y + TH + 18);
        }
      }
      return cv.toDataURL('image/jpeg', 0.85);
    }, [`${d} · target | engine${TAG ? ` · ${TAG}` : ''}`, pairs]);
    save(join(OUT, `${d}-sheet.jpg`), sheet);
  }

  // the mockup cameras: the phone frame, as played
  if (mockups.length > 0) {
    await page.setViewportSize({ width: 402, height: 874 });
    await bare(false);
    await page.evaluate(() => { window.__nd.pose = null; });
    await sleep(1500);
  }
  const mshots = [];
  for (const k of mockups) {
    const c = MOCKUP_CAMERAS[k];
    const y = (c.yaw * Math.PI) / 180, p = (c.pitch * Math.PI) / 180;
    const look = [c.eye[0] + Math.sin(y) * Math.cos(p) * 20, c.eye[1] + Math.sin(p) * 20, c.eye[2] - Math.cos(y) * Math.cos(p) * 20];
    await pose({ eye: c.eye, look }, false);
    const f = await frameStats();
    stats.poses[`mockup ${k}`] = f;
    const file = join(OUT, `mockup-${k}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    mshots.push({ k, mock: jpg64(join(ROOT, 'art/nine-dragon-stack/round-6-baseline-hud', c.mockup)), engine: jpg64(file), f });
    console.info(`mockup ${k}: ${f.calls} draws, ${(f.tris / 1e6).toFixed(2)} M tris`);
  }
  if (mshots.length > 0) {
    const sheet = await page.evaluate(async ([title, ms]) => {
      const load = (src) => new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.src = src; });
      const TW = 360, TH = Math.round((360 * 874) / 402), G = 10, HEAD = 44, LAB = 24;
      const cv = document.createElement('canvas');
      cv.width = G + ms.length * (TW + G); cv.height = HEAD + 2 * (TH + LAB + G) + G;
      const c = cv.getContext('2d');
      c.fillStyle = '#0a0f16'; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = '#8fe3ff'; c.font = 'bold 24px sans-serif'; c.fillText(title, G + 4, 30);
      for (const [i, m] of ms.entries()) {
        const x = G + i * (TW + G);
        for (const [j, src] of [m.mock, m.engine].entries()) {
          const im = await load(src), y = HEAD + j * (TH + LAB + G);
          const s = Math.max(TW / im.width, TH / im.height), w = im.width * s, h = im.height * s;
          c.save(); c.beginPath(); c.rect(x, y, TW, TH); c.clip(); c.drawImage(im, x + (TW - w) / 2, y + (TH - h) / 2, w, h); c.restore();
          c.fillStyle = j ? '#8fe3ff' : '#ffbe5a'; c.font = 'bold 16px sans-serif';
          c.fillText(j ? `${m.k} engine · ${m.f.calls} dr · ${(m.f.tris / 1e6).toFixed(2)} M` : `${m.k} · mockup`, x + 2, y + TH + 18);
        }
      }
      return cv.toDataURL('image/jpeg', 0.85);
    }, [`mockup cameras · mockup / engine${TAG ? ` · ${TAG}` : ''}`, mshots]);
    save(join(OUT, 'mockups-sheet.jpg'), sheet);
  }
  writeFileSync(join(OUT, `${TAG ? `${TAG}-` : ''}stats.json`), `${JSON.stringify(stats, null, 1)}\n`);
} finally {
  await browser.close();
  release();
}
