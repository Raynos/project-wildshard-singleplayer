// pine-hollow-hero-shots.mjs — PH-S1's hero captures (art/hero-images/round-4-pine-hollow-in-engine/README.md): a god camera posed in
// game.onLate, every DOM layer but the game canvas hidden, the weapon hidden, the clock frozen, DPR 2 (1600×900 → 3200×1800,
// 1024×1536 → 2048×3072 PNGs). Needs the vite DEV server (it imports /src/world/Heightfield.ts for ground heights).
// A view: { id, query, cam: [x, dy, z], at: [x, dy, z] (dy over the ground there), fov, fovP (portrait), atKing / atKingP
// (aim at the Antler King's live position + dy), kOff: [dx, dz], spawn: false (keep the player), hideAnimals: <m>,
// settle: <ms>, burst: <n>, burstGap: <ms>, sizes: 'land' | 'port' | 'land,port', eval: <js> }. Grade + export: see the README.
//   node scripts/pine-hollow-hero-shots.mjs --views=art/hero-images/round-4-pine-hollow-in-engine/views.json --out=<dir> [--only=king] [--url=http://localhost:5176]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:5176');
const OUT = resolvePath(flag('out', 'raw')); mkdirSync(OUT, { recursive: true });
const ONLY = flag('only', '').split(',').filter(Boolean);
const SIZES = flag('sizes', 'land,port').split(',');
const DIM = { land: { width: 1600, height: 900 }, port: { width: 1024, height: 1536 } };
const all = JSON.parse(readFileSync(resolvePath(flag('views', 'views.json')), 'utf8'));
const list = all.filter((v) => ONLY.length === 0 || ONLY.some((o) => v.id.includes(o)));
const groups = new Map();
for (const v of list) { const q = v.query; if (!groups.has(q)) groups.set(q, []); groups.get(q).push(v); }
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const [q, views] of groups) {
    const ctx = await browser.newContext({ viewport: DIM[SIZES[0]], deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem('ws.gfx.v1', JSON.stringify({ dpr: '2', aa: 'on' })); } catch { /* */ } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const url = `${URL_BASE}/?chunk=pine-hollow&mute=1&nolock=1&skipintro=1&sw=0&perf=0&tier=desktop&clock=1000000&${q}`;
    console.log('load', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals && window.__world?.game), undefined, { timeout: 300000, polling: 1000 });
    await page.evaluate(async () => {
      const w = window.__world, cam = w.game.camera;
      window.__hf = await import('/src/world/Heightfield.ts');
      try { w.animals.calm = true; } catch { /* */ }
      const st = document.createElement('style'); st.textContent = 'body *{visibility:hidden!important} canvas.__game{visibility:visible!important}';
      w.game.renderer.domElement.classList.add('__game'); document.head.append(st);
      window.__cv = null;
      w.game.onLate(() => {
        const v = window.__cv; if (!v) return;
        cam.position.set(v.cam[0], v.cam[1], v.cam[2]);
        let at = v.at;
        if (v.atKing) { const k = window.__antlerKing?.fight?.king; if (k) at = [k.position.x + (v.kOff?.[0] ?? 0), k.position.y + v.atKing, k.position.z + (v.kOff?.[1] ?? 0)]; }
        cam.lookAt(at[0], at[1], at[2]);
        if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.far = Math.max(cam.far, 6000); cam.updateProjectionMatrix(); }
        for (const c of cam.children) c.visible = false;
        if (v.hideAnimals) for (const a of w.animals.animals) { if (a.kind !== 'antler-king' && a.position.distanceTo(cam.position) < v.hideAnimals) { a.mesh.visible = false; if (a.mesh.parent && a.mesh.parent !== w.game.scene) a.mesh.parent.visible = false; } }
      });
    });
    await sleep(10000);
    for (const v of views) {
      // absolute heights from the heightfield: cam [x, dy, z] over the ground at (x, z); at [x, dy, z] likewise
      const r = await page.evaluate((vv) => {
        const h = window.__hf.heightAt;
        const cam = [vv.cam[0], (vv.camAbs ? 0 : h(vv.cam[0], vv.cam[2])) + vv.cam[1], vv.cam[2]];
        const at = [vv.at[0], (vv.atAbs ? 0 : h(vv.at[0], vv.at[2])) + vv.at[1], vv.at[2]];
        if (vv.spawn !== false) window.__world.player.spawn(vv.cam[0], vv.cam[2], 0);
        window.__cv = { ...vv, cam, at };
        return { cam, at };
      }, v);
      await sleep(v.settle ?? 6000);
      if (v.eval) { await page.evaluate(v.eval); await sleep(1000); }
      for (const s of (v.sizes ? v.sizes.split(",") : SIZES)) {
        const fov = s === 'port' ? (v.fovP ?? v.fov * 1.35) : v.fov;
        await page.setViewportSize(DIM[s]);
        await page.evaluate(([f, ak]) => { window.__cv = { ...window.__cv, fov: f, ...(ak !== undefined && ak !== null ? { atKing: ak } : {}) }; }, [fov, s === 'port' ? (v.atKingP ?? null) : (v.atKing ?? null)]);
        await sleep(2500);
        const n = v.burst ?? 1;
        for (let i = 0; i < n; i++) {
          writeFileSync(resolvePath(OUT, n > 1 ? `${v.id}-${i}-${s}.png` : `${v.id}-${s}.png`), await page.screenshot({ type: 'png' }));
          if (i < n - 1) await sleep(v.burstGap ?? 2500);
        }
        console.log('captured', v.id, s, JSON.stringify(r));
      }
      await page.setViewportSize(DIM[SIZES[0]]);
    }
    if (errors.length > 0) console.log('page errors:', errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally { await browser.close(); }
