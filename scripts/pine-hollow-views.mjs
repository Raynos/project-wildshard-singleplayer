#!/usr/bin/env node
// pine-hollow-views.mjs — the Pine Hollow 9-angle capture (PH-0.5; the method of art/driftwood-isle/round-4-remaster/README.md).
//
// Reads a cameras JSON (default art/pine-hollow/round-0-baseline/cameras.json) and, per anchor, shoots
//   1-4  first person at P: FRONT / LEFT / RIGHT / BACK — phone tier, iPhone 16 Pro (UA, DPR 3, touch) at 390×844, HUD on
//   5    TOP, straight down on P with the front heading up           — desktop tier 1600×900, HUD hidden, fov 72°
//   6-9  DIAG front / left / right / back, looking down at P          — same
// and writes <out>/<anchor>-sheet.jpg (3×3, ≤ 490 KB) plus each frame to --frames=<dir> (default: <tmpdir>/pine-hollow-views,
// not committed). The first run fills in each anchor's `cameras` (ground height from the live
// heightfield) and writes them back into the JSON; every later run shoots those exact cameras, so a before / after pair is
// the same frame. Pine Hollow has no day clock yet (a fixed HDRI sunset), so `tod` / `clock` in the query only matter once
// PH-L2 lands; the cloud layer and the wind still move between shots.
//
//   node scripts/pine-hollow-views.mjs                                   # all anchors, dev server on :5176
//   node scripts/pine-hollow-views.mjs --only=gate,pond --tag=after --query=foo=1
//   node scripts/pine-hollow-views.mjs --cameras=art/pine-hollow/round-1-x/cameras.json --out=art/pine-hollow/round-1-x
//
// One headless Chromium on Metal, muted (AGENTS.md), two page loads per run (the FP context, the god context), closed at
// the end. Animals are calmed (`animals.calm`) so the den's bears don't charge the camera.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, relative } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const CAMS = resolvePath(ROOT, flag('cameras', 'art/pine-hollow/round-0-baseline/cameras.json'));
const OUT = resolvePath(ROOT, flag('out', relative(ROOT, resolvePath(CAMS, '..'))));
const FRAMES = resolvePath(ROOT, flag('frames', resolvePath(tmpdir(), 'pine-hollow-views')));
const URL_BASE = flag('url', 'http://localhost:5176');
const TAG = flag('tag', '');
const EXTRA = flag('query', '');
const SETTLE = Number(flag('settle', '4')) * 1000;
const TIMEOUT = Number(flag('timeout', '300')) * 1000;
const only = flag('only', '').split(',').filter(Boolean);
const DEF = JSON.parse(readFileSync(CAMS, 'utf8'));
const anchors = DEF.anchors.filter((a) => only.length === 0 || only.includes(a.id));
mkdirSync(OUT, { recursive: true }); mkdirSync(FRAMES, { recursive: true });

const SHOTS = ['fp-front', 'fp-left', 'fp-right', 'fp-back', 'top', 'diag-front', 'diag-left', 'diag-right', 'diag-back'];
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** the nine cameras of one anchor, from P, faceTo and the ground height at P */
function camerasFor(a, groundY) {
  const f = Math.atan2(-(a.faceTo.x - a.P.x), -(a.faceTo.z - a.P.z));
  const dir = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const G = DEF.god, P = a.P;
  const fp = (n, yaw) => ({ n, id: SHOTS[n - 1], mode: 'fp', x: P.x, z: P.z, yaw: r3(yaw), pitch: DEF.fp.pitch });
  const [fx, fz] = dir(f), [lx, lz] = dir(f + Math.PI / 2);
  const god = (n, px, pz, up, look) => ({ n, id: SHOTS[n - 1], mode: 'god', pos: [r3(px), r3(groundY + up), r3(pz)], look: look.map(r3), fovV: G.fovV });
  const at = [P.x, groundY, P.z];
  return [
    fp(1, f), fp(2, f + Math.PI / 2), fp(3, f - Math.PI / 2), fp(4, f + Math.PI),
    { ...god(5, P.x, P.z, G.topUp, at), up: [r3(fx), 0, r3(fz)] },
    god(6, P.x - fx * G.diagOut, P.z - fz * G.diagOut, G.diagUp, [P.x + fx * 20, groundY, P.z + fz * 20]),
    god(7, P.x + lx * G.diagOut, P.z + lz * G.diagOut, G.diagUp, at),
    god(8, P.x - lx * G.diagOut, P.z - lz * G.diagOut, G.diagUp, at),
    god(9, P.x + fx * G.diagOut, P.z + fz * G.diagOut, G.diagUp, at),
  ];
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = new Map(); // anchor id → [{ n, id, file, calls, tris }]
try {
  const iphone = devices['iPhone 16 Pro'];
  const groups = [
    { mode: 'fp', ctx: { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: DEF.fp.viewport[0], height: DEF.fp.viewport[1] } }, query: DEF.fp.query },
    { mode: 'god', ctx: { viewport: { width: DEF.god.viewport[0], height: DEF.god.viewport[1] }, deviceScaleFactor: 1 }, query: DEF.god.query },
  ];
  let resolved = false;
  for (const g of groups) {
    const ctx = await browser.newContext(g.ctx);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const first = anchors[0];
    const url = `${URL_BASE}/?${[DEF.query, g.query, `x=${first.P.x}`, `z=${first.P.z}`, EXTRA].filter(Boolean).join('&')}`;
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__hf && window.__world.animals), undefined, { timeout: TIMEOUT, polling: 1000 });
    console.error(`[${g.mode}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length > 0 ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    // resolve the cameras once (ground height at each P) and write them back
    if (!resolved) {
      for (const a of anchors) {
        if (a.cameras) continue;
        const gy = await page.evaluate(([x, z]) => window.__hf.heightAt(x, z), [a.P.x, a.P.z]);
        a.groundY = Math.round(gy * 1000) / 1000;
        a.cameras = camerasFor(a, a.groundY);
      }
      writeFileSync(CAMS, `${JSON.stringify(DEF, null, 2)}\n`);
      resolved = true;
    }
    await page.evaluate(() => {
      const w = window.__world;
      w.animals.calm = true;
      if (window.__v9) return;
      window.__v9 = { pose: null, saved: null };
      // posed last in the frame (after the player's camera), so nothing moves it between frames
      w.game.onLate(() => {
        const s = window.__v9, p = s.pose, cam = w.game.camera;
        if (!p) return;
        for (const ch of cam.children) ch.visible = false; // the viewmodel (crossbow / hands) re-shows itself each update
        cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.up) cam.up.set(p.up[0], p.up[1], p.up[2]); else cam.up.set(0, 1, 0);
        cam.lookAt(p.look[0], p.look[1], p.look[2]); cam.up.set(0, 1, 0);
        cam.updateMatrixWorld(true);
        if (Math.abs(cam.fov - p.fovV) > 0.01) { cam.fov = p.fovV; cam.updateProjectionMatrix(); }
      });
    });
    if (g.mode === 'god') await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
    await sleep(SETTLE * 2); // the first frames after a load: streaming, compiles
    for (const a of anchors) {
      const list = (a.cameras ?? []).filter((c) => c.mode === g.mode);
      for (const c of list) {
        await page.evaluate((cc) => {
          const w = window.__world;
          if (cc.mode === 'god') {
            w.player.spawn(cc.look[0], cc.look[2], 0);
            w.freeCamera = true; // the forest / grass LOD around the eye, the player parked
            window.__v9.pose = cc;
          } else {
            window.__v9.pose = null; w.freeCamera = false;
            w.player.spawn(cc.x, cc.z, cc.yaw); w.player.pitch = cc.pitch;
            // the elites ignore `calm` (an elk's head filled the pond's FP back): park anything within 24 m 70 m out, held
            for (const an of w.animals.animals) {
              const dx = an.position.x - cc.x, dz = an.position.z - cc.z, d = Math.hypot(dx, dz);
              if (!an.alive || d > 24) continue;
              const k = 70 / Math.max(d, 0.01);
              an.driven = true; an.speed = 0;
              an.position.set(cc.x + dx * k, window.__hf.heightAt(cc.x + dx * k, cc.z + dz * k), cc.z + dz * k);
            }
          }
        }, c);
        await sleep(SETTLE);
        const perf = await page.evaluate(() => ({ calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles }));
        const shot = await page.screenshot({ type: 'jpeg', quality: 84, scale: 'css' });
        const file = resolvePath(FRAMES, `${TAG ? `${TAG}-` : ''}${a.id}-${c.n}-${c.id}.jpg`);
        writeFileSync(file, shot);
        const row = { n: c.n, id: c.id, file, ...perf };
        shots.set(a.id, [...(shots.get(a.id) ?? []), row]);
        console.log(`${a.id.padEnd(6)} ${String(c.n)} ${c.id.padEnd(11)} ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
      }
    }
    await ctx.close();
  }

  // ── one 3×3 sheet per anchor: row 1 FP front / left / right, row 2 FP back / TOP / DIAG front, row 3 DIAG left / right / back
  const page = await (await browser.newContext()).newPage();
  for (const a of anchors) {
    const rows = (shots.get(a.id) ?? []).sort((x, y) => x.n - y.n);
    const cells = rows.map((r) => ({ label: `${r.n} ${r.id} · ${r.calls} calls · ${(r.tris / 1e6).toFixed(2)} M`, src: `data:image/jpeg;base64,${readFileSync(r.file).toString('base64')}` }));
    const b64 = await page.evaluate(async (args) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const CW = 640, CH = 560, G = 6, TOPBAR = 26;
      const c = document.createElement('canvas'); c.width = CW * 3 + G * 4; c.height = CH * 3 + G * 4 + TOPBAR;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high';
      g.font = '600 15px ui-monospace, monospace'; g.fillStyle = '#ffd98a'; g.fillText(args.title, G + 4, 19);
      g.font = '600 13px ui-monospace, monospace';
      for (let i = 0; i < args.cells.length; i++) {
        const cell = args.cells[i];
        const x = G + (i % 3) * (CW + G), y = TOPBAR + G + Math.floor(i / 3) * (CH + G);
        const img = await load(cell.src);
        const k = Math.min(CW / img.width, (CH - 22) / img.height), dw = img.width * k, dh = img.height * k;
        g.drawImage(img, x + (CW - dw) / 2, y + (CH - 22 - dh) / 2, dw, dh);
        g.fillStyle = '#9fe6ff'; g.fillText(cell.label, x + 4, y + CH - 6);
      }
      for (let q = 0.86; q >= 0.4; q -= 0.04) { const u = c.toDataURL('image/jpeg', q); if (u.length * 0.75 < 490 * 1024) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.35).split(',')[1];
    }, { cells, title: `Pine Hollow · ${a.name} · P (${a.P.x}, ${a.P.z}) · ${TAG === '' ? 'baseline' : TAG} · FP phone 390×844 · god desktop 1600×900` });
    const out = resolvePath(OUT, `${TAG ? `${TAG}-` : ''}${a.id}-sheet.jpg`);
    writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`sheet: ${relative(ROOT, out)}`);
  }
} finally {
  await browser.close();
}
