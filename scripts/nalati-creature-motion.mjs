#!/usr/bin/env node
// nalati-creature-motion.mjs — the creatures LIVE, their own AI moving them: a herd stampeding, a pack hunting, the flock
// with a wolf through it, each named elite — a frame every `--dt` s from the player's camera, one row per scene.
//   node scripts/nalati-creature-motion.mjs [--url=http://127.0.0.1:5192] [--out=progress/…jpg] [--tier=desktop]
//   [--scenes=herd,pack,flock,aqbars,kokbori,argymaq,qyran] [--creatures=glb|proc] [--x=-55 --z=60] [--frames=6 --dt=0.4]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5192');
const OUT = resolvePath(ROOT, flag('out', 'progress/nalati-look/creatures/motion.jpg'));
const TIER = flag('tier', 'desktop');
const LOOK = flag('creatures', 'glb');
const SCENES = flag('scenes', 'herd,pack,flock,aqbars,kokbori,argymaq,qyran').split(',');
const FRAMES = Number(flag('frames', '6')), DT = Number(flag('dt', '0.4'));
const X = flag('x', '-55'), Z = flag('z', '60');
const W = TIER === 'phone' ? 390 : 960, H = TIER === 'phone' ? 844 : 540;
mkdirSync(dirname(OUT), { recursive: true });

/** scene → page + query (+ how long to let it develop first) */
const SETUP = {
  herd: { page: 'dev/nalati-creatures.html', q: 'scene=herd&dist=28&stampede=5', wait: 6, kinds: ['horse'] },
  pack: { page: 'dev/nalati-creatures.html', q: 'scene=pack&dist=26&hunt=1', wait: 7, kinds: ['wolf'] },
  flock: { page: 'dev/nalati-creatures.html', q: 'scene=flock&dist=14&wolf=1', wait: 9, kinds: ['sheep'] },
  aqbars: { page: 'dev/nalati-elites.html', q: 'elite=aqbars', wait: 6, kinds: ['leopard'] },
  kokbori: { page: 'dev/nalati-elites.html', q: 'elite=kokbori', wait: 6, kinds: ['kokbori'] },
  argymaq: { page: 'dev/nalati-elites.html', q: 'elite=argymaq', wait: 6, kinds: ['argymaq'] },
  qyran: { page: 'dev/nalati-elites.html', q: 'elite=qyran', wait: 6, kinds: ['eagle'] },
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const sc of SCENES) {
    const s = SETUP[sc];
    if (!s) continue;
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    await debugSettings(page, { creatures: LOOK === 'proc' ? 'proc' : 'models' }); // E162: a saved Debug option, not a URL switch
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'perf=0', 'weather=clear', `tier=${TIER}`, `x=${X}`, `z=${Z}`, 'yaw=3.14', 'pitch=-0.08', s.q].join('&');
    await page.goto(`${URL_BASE}/${s.page}?${q}`);
    await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
    await page.waitForTimeout(s.wait * 1000);
    // a tracking camera on the scene's subjects (their centroid, side-on to their heading, eased), set after the game's
    // own camera each frame
    await page.evaluate((kinds) => {
      const w = window.__world, cam = w.game.camera;
      const st = { cx: 0, cy: 0, cz: 0, hx: 1, hz: 0, init: false };
      const anchorRef = [];
      // the group: the subject nearest the player now, and every one of its kind within 30 m of it each frame
      const pp = w.player.position;
      let best = Infinity;
      for (const a of w.animals.animals) {
        if (!kinds.includes(a.kind) || a.variant.startsWith('camp')) continue;
        const d = Math.hypot(a.position.x - pp.x, a.position.z - pp.z);
        if (d < best) { best = d; anchorRef[0] = a; }
      }
      const inGroup = (a) => {
        const an = anchorRef[0];
        return an !== undefined && kinds.includes(a.kind) && a.alive && !a.variant.startsWith('camp') && Math.hypot(a.position.x - an.position.x, a.position.z - an.position.z) < 30;
      };
      w.game.onUpdate((dt) => {
        let x = 0, y = 0, z = 0, n = 0, vx = 0, vz = 0, r = 2;
        if (kinds[0] === 'sheep') {
          const f = w.wildlife?.flocks?.[0];
          if (!f) return;
          const p = new w.THREE.Vector3(); f.positions(0, p);
          x = f.cx; z = f.cz; y = p.y - 0.6; r = 6;
        } else {
          for (const a of w.animals.animals) {
            if (!inGroup(a)) continue;
            x += a.position.x; y += a.position.y; z += a.position.z; n++;
            vx += Math.sin(a.yaw); vz += Math.cos(a.yaw);
            r = Math.max(r, (a.mesh.geometry.boundingSphere?.radius ?? 1) * a.scale);
          }
          if (n === 0) return;
          x /= n; y /= n; z /= n;
          let spread = 0;
          for (const a of w.animals.animals) if (inGroup(a)) spread = Math.max(spread, Math.hypot(a.position.x - x, a.position.z - z));
          r = Math.max(r, spread * 0.8);
        }
        const k = st.init ? Math.min(1, dt * 3) : 1;
        st.cx += (x - st.cx) * k; st.cy += (y - st.cy) * k; st.cz += (z - st.cz) * k;
        const hl = Math.hypot(vx, vz);
        if (hl > 0.3) { st.hx += (vx / hl - st.hx) * Math.min(1, dt); st.hz += (vz / hl - st.hz) * Math.min(1, dt); }
        st.init = true;
        const hn = Math.hypot(st.hx, st.hz) || 1, sx = -st.hz / hn, sz = st.hx / hn;   // the heading's side
        const d = Math.max(4, r * 2.4);
        if (Math.abs(cam.fov - 40) > 0.01) { cam.fov = 40; cam.updateProjectionMatrix(); }
        cam.position.set(st.cx + sx * d - (st.hx / hn) * d * 0.35, st.cy + Math.max(1.6, d * 0.28), st.cz + sz * d - (st.hz / hn) * d * 0.35);
        cam.lookAt(st.cx, st.cy + Math.min(2, r * 0.4), st.cz);
        for (const c of cam.children) c.visible = false;
      });
    }, s.kinds).catch(() => console.log('cam: no subjects'));
    await page.waitForTimeout(500);
    const cells = [];
    for (let f = 0; f < FRAMES; f++) {
      cells.push((await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64'));
      await page.waitForTimeout(DT * 1000);
    }
    const info = await page.evaluate(() => {
      const w = window.__world; const n = w.animals.animals.length; let glb = 0;
      for (const a of w.animals.animals) if (a.model.map) glb++;
      return { animals: n, glb, calls: w.game.lastFrame.calls };
    }).catch(() => ({}));
    console.log(sc, JSON.stringify(info), errs.slice(0, 2).join(' | '));
    rows.push({ label: `${sc} · ${LOOK} · ${JSON.stringify(info)}`, cells });
    await page.close();
  }
  const comp = await (await browser.newContext()).newPage();
  const b64 = await comp.evaluate(async ({ rs, w, h }) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const G = 4, LAB = 20, cols = Math.max(...rs.map((r) => r.cells.length));
    const c = document.createElement('canvas'); c.width = cols * (w + G) + G; c.height = rs.length * (h + LAB + G);
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let r = 0; r < rs.length; r++) {
      const y = r * (h + LAB + G);
      x.font = '600 14px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(rs[r].label, G, y + 15);
      for (let i = 0; i < rs[r].cells.length; i++) x.drawImage(await load(`data:image/jpeg;base64,${rs[r].cells[i]}`), G + i * (w + G), y + LAB, w, h);
    }
    for (let qq = 0.8; qq >= 0.35; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.3).split(',')[1];
  }, { rs: rows, w: Math.round(W * 0.34), h: Math.round(H * 0.34) });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
