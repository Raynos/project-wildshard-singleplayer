#!/usr/bin/env node
// creature-motion.mjs — a shard's creatures LIVE, their own AI moving them: a herd bolting, a boar's charge, a bear's
// charge, the King's thralls walking at night — a frame every `--dt` s from a tracking camera, one row per scene.
// Shard-agnostic stand-in for Nalati's scripts/nalati-creature-motion.mjs (which needs Nalati's dev pages): each scene
// spawns its subjects through the live AnimalManager (`animals.spawn`) near the player and sets their AI going
// (PINE-HOLLOW-REMASTER PH-M1 / PH-M2).
//
//   node scripts/creature-motion.mjs --chunk=pine-hollow [--scenes=herd,boar,bear,thralls] [--creatures=glb|proc]
//   [--tier=desktop] [--frames=6 --dt=0.4] [--out=progress/pine-hollow-creatures-motion.jpg] [--url=http://127.0.0.1:5176]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const CHUNK = flag('chunk', 'pine-hollow');
/**
 * per chunk: where the player stands (the scenes spawn around it) and the scenes — `spawn`: [kind, variant, dx, dz] off
 * the player (a scene's own `at` overrides where; `lead` puts the camera ahead of / behind them, `eye` shoots from the player's own eye, `dt` its own frame gap); `ai`: the state every subject is put in once spawned ('flee' / 'charge' / 'wander'); `q`: the scene's query
 */
const CHUNKS = {
  'pine-hollow': {
    at: { x: 6, z: -150 },
    scenes: {
      herd: { at: { x: -40, z: 60 }, q: 'tod=day&clock=1e6', ai: 'flee', wait: 0.3, eye: true, dt: 0.3, spawn: [['deer', 'hind', -3, -24], ['deer', 'stag', 0, -27], ['deer', 'hind', 3, -25], ['deer', 'white-hind', -5, -29], ['deer', 'hind', 5, -30], ['deer', 'big-stag', 1, -32]] },
      boar: { q: 'tod=day&clock=1e6', ai: 'charge', wait: 0.3, spawn: [['boar', 'boar', 2, -26]] },
      bear: { q: 'tod=golden&clock=1e6', ai: 'charge', wait: 0.3, spawn: [['bear', 'brown', 2, -28]] },
      thralls: { at: { x: -40, z: 60 }, q: 'tod=dusk&clock=1e6', ai: 'charge', wait: 0.2, dt: 0.22, spawn: [['elk', 'thrall', 0, -16], ['boar', 'thrall', -3.5, -13], ['boar', 'thrall', 3.5, -14]] },
    },
  },
};
const CFG = CHUNKS[CHUNK];
if (!CFG) throw new Error(`creature-motion: no table for chunk '${CHUNK}'`);
const URL_BASE = flag('url', 'http://127.0.0.1:5176');
const OUT = resolvePath(ROOT, flag('out', `progress/${CHUNK}-creatures-motion.jpg`));
const TIER = flag('tier', 'desktop');
const LOOK = flag('creatures', 'glb');
const SCENES = flag('scenes', Object.keys(CFG.scenes).join(',')).split(',');
const FRAMES = Number(flag('frames', '6')), DT = Number(flag('dt', '0.4'));
const W = TIER === 'phone' ? 390 : 960, H = TIER === 'phone' ? 844 : 540;
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const sc of SCENES) {
    const s = CFG.scenes[sc];
    if (!s) continue;
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    const q = [`chunk=${CHUNK}`, 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', 'perf=0', `tier=${TIER}`, `creatures=${LOOK}`, `x=${(s.at ?? CFG.at).x}`, `z=${(s.at ?? CFG.at).z}`, 'yaw=0', s.q].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"]{display:none!important}' });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(({ spawn, ai, at, lead, eye }) => {
      const w = window.__world, am = w.animals, cam = w.game.camera;
      // clear the stage: every other animal within 60 m of the scene hides
      for (const a of am.animals) if (Math.hypot(a.position.x - at.x, a.position.z - at.z) < 60) { a.mesh.visible = false; a.hidden = true; }
      const subjects = spawn.map(([k, v, dx, dz]) => am.spawn(k, at.x + dx, at.z + dz, Math.PI, v));
      for (const a of subjects) { const br = am.brains.get(a); if (br && ai !== 'wander') { br.chargeCd = 0; am.enter(a, br, ai); } }
      // a tracking camera beside the subjects (their centroid, side-on to their heading, eased), set after the game's own
      const st = { cx: 0, cy: 0, cz: 0, hx: 0, hz: -1, init: false };
      w.game.onUpdate((dt) => {
        let x = 0, y = 0, z = 0, n = 0, vx = 0, vz = 0, r = 1.5;
        for (const a of subjects) {
          if (!a.alive) continue;
          x += a.position.x; y += a.position.y; z += a.position.z; n++;
          vx += Math.sin(a.yaw); vz += Math.cos(a.yaw);
          r = Math.max(r, (a.mesh.geometry.boundingSphere?.radius ?? 1) * a.scale * 0.7);
        }
        if (n === 0) return;
        x /= n; y /= n; z /= n;
        let spread = 0;
        for (const a of subjects) spread = Math.max(spread, Math.hypot(a.position.x - x, a.position.z - z));
        r = Math.max(r, spread * 0.9);
        const k = st.init ? Math.min(1, dt * 8) : 1;
        st.cx += (x - st.cx) * k; st.cy += (y - st.cy) * k; st.cz += (z - st.cz) * k;
        const hl = Math.hypot(vx, vz);
        if (hl > 0.3) { st.hx += (vx / hl - st.hx) * Math.min(1, dt); st.hz += (vz / hl - st.hz) * Math.min(1, dt); }
        st.init = true;
        const hn = Math.hypot(st.hx, st.hz) || 1, sx = -st.hz / hn, sz = st.hx / hn;
        const d = Math.max(4.5, r * 2.6);
        if (Math.abs(cam.fov - 40) > 0.01) { cam.fov = 40; cam.updateProjectionMatrix(); }
        if (eye) {   // the hunter's own view: from where the player stands, eased onto the group (a herd bolting away)
          if (Math.abs(cam.fov - 32) > 0.01) { cam.fov = 32; cam.updateProjectionMatrix(); }
          cam.position.set(at.x, w.player.position.y + 1.65, at.z); cam.lookAt(st.cx, st.cy + 0.9, st.cz);
          for (const c of cam.children) c.visible = false;
          return;
        }
        cam.position.set(st.cx + sx * d + (st.hx / hn) * d * lead, st.cy + Math.max(1.4, d * 0.22), st.cz + sz * d + (st.hz / hn) * d * lead);
        cam.lookAt(st.cx, st.cy + Math.min(1.4, r * 0.35), st.cz);
        for (const c of cam.children) c.visible = false;
      });
      return { subjects: subjects.map((a) => `${a.kind}:${a.variant}${a.model.hull ? ' (hull)' : ''}`) };
    }, { spawn: s.spawn, ai: s.ai, at: s.at ?? CFG.at, lead: s.lead ?? 0.45, eye: s.eye === true });
    await page.waitForTimeout(s.wait * 1000);
    const cells = [];
    for (let f = 0; f < FRAMES; f++) {
      cells.push((await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64'));
      await page.waitForTimeout((s.dt ?? DT) * 1000);
    }
    console.log(sc, JSON.stringify(info), errs.slice(0, 2).join(' | '));
    rows.push({ label: `${sc} · ${LOOK} · ${info.subjects.join(', ')}`, cells });
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
  }, { rs: rows, w: Math.round(W * 0.4), h: Math.round(H * 0.4) });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT.slice(ROOT.length + 1)}`);
} finally {
  await browser.close();
}
