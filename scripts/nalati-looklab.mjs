#!/usr/bin/env node
// nalati-looklab.mjs — the Nalati Look Lab's before | after sheets and the phone budget (NALATI-MERGE L2–L4).
//
// The variants are live (src/nalati/look/lab.ts), so each pose is shot twice on ONE page — the variant off, then on —
// and nothing else moves between the two frames (clock paused, weather clear, the same camera).
//
//   node scripts/nalati-looklab.mjs --variant=terrainShadow --url=http://127.0.0.1:5194
//       → progress/nalati-merge/look-lab/<variant>-sheet.jpg (phone portrait + desktop, off | on per pose, < 500 KB)
//         and <variant>-frames/*.jpg (every frame) + <variant>.json (calls / tris / frame ms per frame)
//   --tiers=phone,desktop   which tiers (phone: 390×844 @3 — the renderer caps it at the tier's 2× — touch HUD;
//                           desktop: 1600×900 @1)
//   --only=<pose ids>       a subset; --settle=<s> per frame (default 6)
//   --budget                the L4 run instead: the phone tier at the four first-person camp poses of
//                           art/nalati-grasslands/round-4-camp-9angle/poses.json, every variant off / each on / all on,
//                           calls, triangles and the frame ms (p50 / p95) → look-lab/budget.json + budget.md
//
// One headless Chromium on Metal (vsync on), muted, closed at the end. Check `pgrep -fl chrome-headless-shell` first
// (AGENTS.md: at most 3 game browsers on the machine).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const has = (n) => argv.includes(`--${n}`);
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const VARIANT = flag('variant', 'terrainShadow');
const BUDGET = has('budget');
const TIERS = flag('tiers', BUDGET ? 'phone' : 'phone,desktop').split(',');
const SETTLE = Number(flag('settle', '6')) * 1000;
const ONLY = flag('only', '').split(',').filter(Boolean);
const OUT = resolvePath(ROOT, 'progress/nalati-merge/look-lab');
mkdirSync(OUT, { recursive: true });

// poses: 'fp' = the player stands at (x, z) facing yaw / pitch (the eye, the HUD); 'god' = a free camera `cam` → `at`
// (the player parked at `px, pz` so the streaming stays there). `hour` = the day clock (16.22 = the def's golden
// afternoon; 17.5 = dusk, the sun ~6° up). `near` = aim the free camera at the nearest instance of a named mesh.
const CAMP9 = JSON.parse(readFileSync(resolvePath(ROOT, 'art/nalati-grasslands/round-4-camp-9angle/poses.json'), 'utf8'));
const campFp = CAMP9.poses.filter((p) => p.mode === 'fp').map((p) => ({ id: `camp-${p.id}`, mode: 'fp', x: p.camera.x, z: p.camera.z, yaw: p.camera.yaw, pitch: p.camera.pitch }));
const SETS = {
  // the sun sets in the WNW: every shot looks away from it, across the shadows
  terrainShadow: [
    { id: 'plateau-dusk-fp', mode: 'fp', x: 150, z: 30, yaw: 1.9, pitch: -0.06, hour: 17.75 },
    { id: 'rim-dusk-fp', mode: 'fp', x: 60, z: 60, yaw: 2.2, pitch: -0.04, hour: 17.75 },
    { id: 'eagle-dusk-god', mode: 'god', cam: [330, 150, 160], at: [60, 10, 30], fov: 55, px: 150, pz: 60, hour: 17.75 },
    { id: 'crags-dusk-god', mode: 'god', cam: [300, 220, -60], at: [-40, 30, -120], fov: 55, px: 100, pz: -60, hour: 17.75 },
    { id: 'top-dusk-god', mode: 'god', cam: [40, 470, 30], at: [0, 0, -5], fov: 62, px: 0, pz: 30, hour: 17.75 },
  ],
  terrainAO: [
    { id: 'escarpment-god', mode: 'god', cam: [-120, 60, 250], at: [40, 10, 120], fov: 55, px: 20, pz: 200, hour: 16.22 },
    { id: 'valley-gully-fp', mode: 'fp', x: 30, z: 175, yaw: -0.4, pitch: 0.05, hour: 16.22 },
    { id: 'bowl-god', mode: 'god', cam: [-170, 150, 150], at: [60, 20, -20], fov: 55, px: 0, pz: 40, hour: 16.22 },
    { id: 'camp-golden-fp', mode: 'fp', x: campFp[0].x, z: campFp[0].z, yaw: campFp[0].yaw, pitch: campFp[0].pitch, hour: 16.22 },
  ],
  modelShade: [
    { id: 'camp-props-fp', mode: 'fp', x: campFp[0].x, z: campFp[0].z, yaw: campFp[0].yaw, pitch: campFp[0].pitch, hour: 16.22 },
    { id: 'boulder-near', mode: 'god', near: { mesh: 'nalati-dress-boulder', dist: 4.5, up: 2.4 }, px: 20, pz: 150, hour: 16.22, fov: 50 },
    { id: 'boulder-tall-near', mode: 'god', near: { mesh: 'nalati-dress-boulder-tall', dist: 5, up: 2.6 }, px: 20, pz: 150, hour: 16.22, fov: 50 },
    { id: 'snow-boulder-near', mode: 'god', near: { mesh: 'nalati-dress-boulder', dist: 4.5, up: 2.4 }, px: -110, pz: -60, hour: 16.22, fov: 50 },
  ],
};
const VARIANTS = ['terrainShadow', 'terrainAO', 'modelShade'];
const poses = (BUDGET ? campFp.map((p) => Object.assign(p, { hour: 16.22 })) : SETS[VARIANT] ?? []).filter((p) => ONLY.length === 0 || ONLY.includes(p.id));
if (poses.length === 0) { console.error(`no poses for --variant=${VARIANT}`); process.exit(1); }

const TIER_CTX = {
  phone: { viewport: { width: 390, height: 844 }, dpr: 3, touch: true },
  desktop: { viewport: { width: 1600, height: 900 }, dpr: 1, touch: false },
};
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const tier of TIERS) {
    const tc = TIER_CTX[tier];
    const ctx = await browser.newContext({ viewport: tc.viewport, deviceScaleFactor: tc.dpr, hasTouch: tc.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', `tier=${tier}`, tc.touch ? 'touch' : '',
      `x=${poses[0].px ?? poses[0].x}`, `z=${poses[0].pz ?? poses[0].z}`].filter(Boolean).join('&');
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__weather && window.__lookLab), undefined, { timeout: 300000, polling: 1000 });
    console.error(`[${tier}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length > 0 ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    await page.evaluate(() => {
      window.__weather.clock.paused = true;
      window.__lab = { pose: null, saved: null };
      window.__world.game.onUpdate(() => {
        const s = window.__lab, p = s.pose, cam = window.__world.game.camera;
        if (!p) { if (s.saved) { cam.children.forEach((c, i) => { c.visible = s.saved[i]; }); s.saved = null; } return; }
        s.saved ??= cam.children.map((c) => c.visible);
        cam.position.set(p.x, p.y, p.z);
        cam.lookAt(p.ax, p.ay, p.az);
        if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
        for (const c of cam.children) c.visible = false;
      });
    });
    await sleep(SETTLE * 2);
    const setAll = (st) => page.evaluate((s) => { for (const [k, v] of Object.entries(s)) window.__lookLab.set(k, v); }, st);
    const measure = () => page.evaluate(() => new Promise((resolve) => {
      const gm = window.__world.game;
      setTimeout(() => {
        const ms = Array.from(gm.frameMs).filter((v) => v > 0).sort((a, b) => a - b);
        const pct = (f) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
        resolve({ p50: pct(0.5), p95: pct(0.95), calls: gm.lastFrame.calls, tris: gm.lastFrame.triangles });
      }, 2500);
    }));
    let hudTag = null;
    for (const p of poses) {
      // place: the player (fp) or the free camera (god); the clock. First person keeps the HUD (the real frame)
      await page.evaluate((a) => {
        const w = window.__world;
        window.__weather.clock.set(a.hour ?? 16.22);
        window.__lab.pose = null;
        if (a.mode === 'fp') { w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch; }
        else w.player.spawn(a.px ?? 0, a.pz ?? 0, 0);
      }, p);
      if (p.mode === 'fp' && hudTag) { await hudTag.evaluate((n) => { n.remove(); }); hudTag = null; }
      if (p.mode === 'god') {
        hudTag ??= await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
        await sleep(SETTLE);
        const ok = await page.evaluate((a) => {
          let cam = a.cam, at = a.at;
          if (a.near) {
            const m = window.__world.game.scene.getObjectByName(a.near.mesh);
            if (m?.isInstancedMesh !== true || m.count === 0) return false;
            const pl = window.__world.game.camera.position;
            const mat = m.matrixWorld.clone(), v = m.position.clone();
            let best = null, bd = Infinity;
            for (let i = 0; i < m.count; i++) {
              m.getMatrixAt(i, mat); v.setFromMatrixPosition(mat).applyMatrix4(m.matrixWorld);
              const d = Math.hypot(v.x - pl.x, v.z - pl.z);
              if (d > 6 && d < bd) { bd = d; best = v.clone(); }
            }
            if (!best) return false;
            const dx = pl.x - best.x, dz = pl.z - best.z, l = Math.hypot(dx, dz) || 1;
            cam = [best.x + (dx / l) * a.near.dist, best.y + a.near.up, best.z + (dz / l) * a.near.dist];
            at = [best.x, best.y + 0.4, best.z];
          }
          window.__lab.pose = { x: cam[0], y: cam[1], z: cam[2], ax: at[0], ay: at[1], az: at[2], fov: a.fov ?? 55 };
          return true;
        }, p);
        if (!ok) { console.error(`[${tier}] ${p.id}: no target, skipped`); continue; }
      }
      const states = BUDGET
        ? [{ label: 'none', st: {} }, ...VARIANTS.map((k) => ({ label: k, st: { [k]: true } })), { label: 'all', st: Object.fromEntries(VARIANTS.map((k) => [k, true])) }]
        : [{ label: 'off', st: { [VARIANT]: false } }, { label: 'on', st: { [VARIANT]: true } }];
      for (const { label, st } of states) {
        await setAll(Object.fromEntries(VARIANTS.map((k) => [k, st[k] ?? false])));
        await sleep(SETTLE);
        const perf = await measure();
        const file = `${BUDGET ? 'budget' : VARIANT}-frames/${tier}-${p.id}-${label}.jpg`;
        mkdirSync(resolvePath(OUT, file, '..'), { recursive: true });
        writeFileSync(resolvePath(OUT, file), await page.screenshot({ type: 'jpeg', quality: 86, scale: 'css' }));
        rows.push({ tier, pose: p.id, state: label, ...perf, file });
        console.log(`${tier.padEnd(7)} ${p.id.padEnd(22)} ${label.padEnd(13)} p50 ${perf.p50.toFixed(1).padStart(5)} · p95 ${perf.p95.toFixed(1).padStart(5)} ms · ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
      }
    }
    await setAll(Object.fromEntries(VARIANTS.map((k) => [k, false])));
    if (errors.length > 0) console.error(`[${tier}] page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }

  if (BUDGET) {
    writeFileSync(resolvePath(OUT, 'budget.json'), JSON.stringify(rows, null, 1));
    const md = ['# Nalati Look Lab — the phone budget (L4)', '',
      'Phone tier, 390×844 @3 (the renderer caps it at the tier\'s 2× render scale), the four first-person camp poses, golden',
      'afternoon, headless Chromium on the Mac GPU (Metal, vsync on): the frame ms are not an iPhone reading (16.7 = keeping up'];
    md.push('with 60 Hz); the calls / triangles carry over. Budget: ≤ 150 calls, ≤ 2.0 M triangles.', '', '| pose | variants | p50 ms | p95 ms | calls | tris (M) |', '|---|---|---|---|---|---|');
    for (const r of rows) md.push(`| ${r.pose} | ${r.state} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.calls} | ${(r.tris / 1e6).toFixed(2)} |`);
    writeFileSync(resolvePath(OUT, 'budget.md'), `${md.join('\n')}\n`);
  } else {
    writeFileSync(resolvePath(OUT, `${VARIANT}.json`), JSON.stringify(rows, null, 1));
    // ── the sheet: per pose one row — phone off | on, desktop off | on ──
    const ids = [...new Set(rows.map((r) => r.pose))];
    const cell = (tier, pose, state) => rows.find((r) => r.tier === tier && r.pose === pose && r.state === state);
    const data = (r) => (r ? `data:image/jpeg;base64,${readFileSync(resolvePath(OUT, r.file)).toString('base64')}` : null);
    const sheetRows = ids.map((id) => ({ id, cells: ['phone', 'desktop'].flatMap((t) => ['off', 'on'].map((s) => { const r = cell(t, id, s); return r ? { src: data(r), label: `${t} · ${s.toUpperCase()} · ${r.calls} calls · ${(r.tris / 1e6).toFixed(2)} M · p50 ${r.p50.toFixed(1)} ms` } : null; })) }));
    const page = await (await browser.newContext()).newPage();
    const b64 = await page.evaluate(async (a) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const PW = 280, PH = 606, DW = 760, DH = 428, G = 6, LH = 18;
      const RH = Math.max(PH, DH) + LH;
      const c = document.createElement('canvas'); c.width = G * 5 + PW * 2 + DW * 2; c.height = 30 + a.rows.length * (RH + G) + G;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
      g.font = '600 14px ui-monospace, monospace'; g.fillStyle = '#ffd98a'; g.fillText(a.title, G, 20);
      g.font = '600 12px ui-monospace, monospace';
      for (let i = 0; i < a.rows.length; i++) {
        const row = a.rows[i], y = 30 + i * (RH + G);
        const xs = [G, G * 2 + PW, G * 3 + PW * 2, G * 4 + PW * 2 + DW];
        for (let k = 0; k < 4; k++) {
          const cl = row.cells[k];
          if (!cl) continue;
          const img = await load(cl.src);
          const w = k < 2 ? PW : DW, h = k < 2 ? PH : DH;
          g.drawImage(img, xs[k], y, w, h);
          g.fillStyle = cl.label.includes(' ON ') ? '#ffd98a' : '#9fe6ff';
          // the phone cells are narrow: their labels short; the first desktop cell carries the pose's name
          g.fillText(k === 2 ? `${row.id} · ${cl.label}` : k < 2 ? cl.label.split(' · ').slice(1, 3).join(' · ') : cl.label, xs[k], y + h + 14);
        }
      }
      for (let qy = 0.86; qy >= 0.35; qy -= 0.04) { const u = c.toDataURL('image/jpeg', qy); if (u.length * 0.75 < 490 * 1024) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.3).split(',')[1];
    }, { rows: sheetRows, title: `Nalati Look Lab · ${VARIANT} · off | on at the same pose, phone (390×844, 2× render) and desktop (1600×900)` });
    writeFileSync(resolvePath(OUT, `${VARIANT}-sheet.jpg`), Buffer.from(b64, 'base64'));
    console.log(`→ progress/nalati-merge/look-lab/${VARIANT}-sheet.jpg`);
  }
} finally {
  await browser.close();
}
