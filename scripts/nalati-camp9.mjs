#!/usr/bin/env node
// nalati-camp9.mjs — the Nalati camp 9-angle measurement (art/nalati-grasslands/round-4-camp-9angle, poses.json).
//
// Re-shoots the nine fixed cameras round the nomad camp — 4 first-person at the phone tier (390×844 @1.5, touch HUD)
// and 5 free cameras from above (1600×900 @1, HUD hidden, still the phone tier) — measures each (frame p50 / p95,
// draw calls, triangles) and writes, per tag, to progress/nalati-look/camp9/:
//   <tag>-<n>-<id>.jpg          the engine frame (≤ 500 KB)
//   <tag>-sheet-engine.jpg      the nine engine frames, 3×3
//   <tag>-sheet-pairs.jpg       engine | target for each of the nine, 3×3 (the target = the round-4 codex remaster)
//   <tag>-budget.json / .md     frame ms, calls, tris per angle vs the phone budget (≤ 150 calls / ≤ 2.0 M tris)
//
//   node scripts/nalati-camp9.mjs --tag=v2-step1
//   node scripts/nalati-camp9.mjs --tag=x --only=1,5 --query=foo=1 --desktop   # a subset; --desktop = tier=desktop for all
//
// One headless Chromium on Metal, vsync on (AGENTS.md), two page loads (the FP context, the free-camera context),
// closed at the end. Needs the dev server (this worktree: http://127.0.0.1:5188).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const SET = resolvePath(ROOT, 'art/nalati-grasslands/round-4-camp-9angle');
const OUT = resolvePath(ROOT, 'progress/nalati-look/camp9');
const DEF = JSON.parse(readFileSync(resolvePath(SET, 'poses.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const has = (name) => argv.includes(`--${name}`);
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const SETTLE = Number(flag('settle', '7')) * 1000;
const TIMEOUT = Number(flag('timeout', '240')) * 1000;
const TIER = has('desktop') ? 'desktop' : 'phone';
const only = flag('only', '').split(',').filter(Boolean).map(Number);
const poses = DEF.poses.filter((p) => only.length === 0 || only.includes(p.n));
mkdirSync(OUT, { recursive: true });

const P = DEF.anchorP;
const query = (touch) => [
  'chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', `tier=${TIER}`, touch ? 'touch' : '',
  `x=${P.x}`, `z=${P.z}`, 'yaw=-0.95', 'pitch=-0.1', EXTRA,
].filter(Boolean).join('&');

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const groups = [
    { mode: 'fp', viewport: { width: 390, height: 844 }, dpr: 1.5, touch: true },
    { mode: 'god', viewport: { width: 1600, height: 900 }, dpr: 1, touch: false },
  ];
  for (const g of groups) {
    const list = poses.filter((p) => p.mode === g.mode);
    if (list.length === 0) continue;
    const ctx = await browser.newContext({ viewport: g.viewport, deviceScaleFactor: g.dpr, hasTouch: g.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const t0 = Date.now();
    await page.goto(`${URL_BASE}/?${query(g.touch)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: TIMEOUT, polling: 1000 });
    console.error(`[${g.mode}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length > 0 ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    await page.evaluate(() => {
      window.__weather.clock.paused = true;
      if (window.__cam9) return;
      window.__cam9 = { pose: null, saved: null };
      window.__world.game.onUpdate(() => {
        const s = window.__cam9, p = s.pose, cam = window.__world.game.camera;
        if (!p) { if (s.saved) { cam.children.forEach((c, i) => { c.visible = s.saved[i]; }); s.saved = null; } return; }
        s.saved ??= cam.children.map((c) => c.visible);
        cam.position.set(p.x, p.y, p.z); cam.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
        if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
        for (const c of cam.children) c.visible = false;
      });
    });
    if (g.mode === 'god') await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
    await new Promise((resolve) => { setTimeout(resolve, SETTLE * 2); }); // the first frames after a load: streaming, compiles
    for (const p of list) {
      const c = p.camera;
      await page.evaluate((a) => {
        const w = window.__world;
        if (a.god) {
          w.player.spawn(a.px, a.pz, -0.95);
          window.__cam9.pose = { x: a.x, y: a.y, z: a.z, yaw: a.yaw, pitch: a.pitch, fov: a.fov };
        } else {
          window.__cam9.pose = null;
          w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch;
        }
      }, { god: g.mode === 'god', px: P.x, pz: P.z, x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, fov: c.fovV });
      await new Promise((resolve) => { setTimeout(resolve, SETTLE); });
      const perf = await page.evaluate(() => new Promise((resolve) => {
        const gm = window.__world.game;
        setTimeout(() => {
          const ms = Array.from(gm.frameMs).filter((v) => v > 0).sort((a, b) => a - b);
          const pct = (f) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
          resolve({ p50: pct(0.5), p95: pct(0.95), calls: gm.lastFrame.calls, tris: gm.lastFrame.triangles });
        }, 2500);
      }));
      const shot = await page.screenshot({ type: 'jpeg', quality: 86, scale: 'css' });
      const file = `${TAG}-${p.n}-${p.id}.jpg`;
      writeFileSync(resolvePath(OUT, file), shot);
      const row = { n: p.n, id: p.id, mode: p.mode, ...perf, file: `progress/nalati-look/camp9/${file}`, target: `art/nalati-grasslands/round-4-camp-9angle/${p.mockup}` };
      rows.push(row);
      console.log(`${String(p.n).padEnd(2)} ${p.id.padEnd(11)} p50 ${perf.p50.toFixed(1).padStart(5)} ms · p95 ${perf.p95.toFixed(1).padStart(5)} ms · ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
    }
    await ctx.close();
  }

  // ── the sheets: nine engine frames, and engine | target per angle ──
  rows.sort((a, b) => a.n - b.n);
  const cells = rows.map((r) => ({
    label: `${r.n} ${r.id} · ${r.p50.toFixed(1)} / ${r.p95.toFixed(1)} ms · ${r.calls} calls · ${(r.tris / 1e6).toFixed(2)} M`,
    engine: `data:image/jpeg;base64,${readFileSync(resolvePath(ROOT, r.file)).toString('base64')}`,
    target: existsSync(resolvePath(ROOT, r.target)) ? `data:image/jpeg;base64,${readFileSync(resolvePath(ROOT, r.target)).toString('base64')}` : null,
  }));
  const page = await (await browser.newContext()).newPage();
  for (const pairs of [false, true]) {
    const b64 = await page.evaluate(async (args) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const CW = args.pairs ? 900 : 620, CH = 690, G = 6;
      const c = document.createElement('canvas'); c.width = CW * 3 + G * 4; c.height = CH * 3 + G * 4;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high'; g.font = '600 13px ui-monospace, monospace';
      const fit = (img, x, y, w, h) => { const k = Math.min(w / img.width, h / img.height); const dw = img.width * k, dh = img.height * k; g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
      for (let i = 0; i < args.cells.length; i++) {
        const cell = args.cells[i];
        const x = G + (i % 3) * (CW + G), y = G + Math.floor(i / 3) * (CH + G);
        const eng = await load(cell.engine);
        if (args.pairs && cell.target) {
          const tgt = await load(cell.target);
          fit(eng, x, y, CW / 2 - 2, CH - 22); fit(tgt, x + CW / 2 + 2, y, CW / 2 - 2, CH - 22);
        } else fit(eng, x, y, CW, CH - 22);
        g.fillStyle = '#9fe6ff'; g.fillText(cell.label + (args.pairs ? '   engine | target' : ''), x + 4, y + CH - 6);
      }
      g.fillStyle = '#ffd98a'; g.fillText(args.title, G + 4, c.height - 1);
      for (let q = 0.85; q >= 0.4; q -= 0.05) { const u = c.toDataURL('image/jpeg', q); if (u.length * 0.75 < 490 * 1024) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.35).split(',')[1];
    }, { cells, pairs, title: `${TAG} · tier=${TIER}` });
    writeFileSync(resolvePath(OUT, `${TAG}-sheet-${pairs ? 'pairs' : 'engine'}.jpg`), Buffer.from(b64, 'base64'));
  }
} finally {
  await browser.close();
}

// ── the budget table ──
const B = { calls: 150, tris: 2.0e6 };
const md = [
  `# camp 9-angle — ${TAG}, tier=${TIER}`, '',
  'Frame ms: headless Chromium on the Mac GPU, vsync-capped (16.7 = keeping up) — not an iPhone reading; the calls / tris carry over.', '',
  '| n | angle | p50 ms | p95 ms | calls | tris (M) | budget |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.n} | ${r.id} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.calls} | ${(r.tris / 1e6).toFixed(2)} | ${r.calls <= B.calls && r.tris <= B.tris ? 'ok' : 'OVER'} |`),
  '',
].join('\n');
writeFileSync(resolvePath(OUT, `${TAG}-budget.json`), `${JSON.stringify(rows, null, 2)}\n`);
writeFileSync(resolvePath(OUT, `${TAG}-budget.md`), md);
console.log(`\n${md}\nsheets: progress/nalati-look/camp9/${TAG}-sheet-engine.jpg, ${TAG}-sheet-pairs.jpg`);
