#!/usr/bin/env node
// nalati-chunk-views.mjs — the whole Nalati chunk from god-mode cameras (+ a few first-person views), for the
// world-redesign mockup round (docs/tasks/asks/N9.md). Free camera through window.__world (like nalati-camp9.mjs),
// desktop tier 1600×900, HUD hidden, clock frozen, clear weather.
//
//   node scripts/nalati-chunk-views.mjs --out=art/nalati-grasslands/round-7-world-redesign [--url=http://127.0.0.1:5193]
//   --set=crags   the snow ring + escarpment set (god views of the massifs, first person in Snow Lotus Valley / under the
//                 escarpment); --only=<id substrings, comma-separated>; --tier=phone (390×844) for the phone's calls / tris; --query=<extra url params>
// Each view's draw calls / triangles are printed and written to <out>/views.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const OUT = resolvePath(ROOT, flag('out', 'art/nalati-grasslands/round-7-world-redesign'));
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const SET = flag('set', 'all');
const TIER = flag('tier', 'desktop');
const EXTRA = flag('query', '');
mkdirSync(OUT, { recursive: true });

// camera → look target (x, y, z); +z north, −x east; the slab is ±250
const VIEWS = [
  { id: 'god-1-top', cam: [0, 560, -1], at: [0, 0, 0], fov: 55 },
  { id: 'god-2-from-ne', cam: [-330, 240, 330], at: [0, 10, 0], fov: 50 },
  { id: 'god-3-from-nw', cam: [330, 240, 330], at: [0, 10, 0], fov: 50 },
  { id: 'god-4-from-se', cam: [-330, 240, -330], at: [0, 10, 0], fov: 50 },
  { id: 'god-5-from-sw', cam: [330, 240, -330], at: [0, 10, 0], fov: 50 },
  { id: 'god-6-valley-low', cam: [0, 70, 330], at: [0, 20, 60], fov: 55 },
  { id: 'fp-1-spawn', cam: [0, -6.3, 232], at: [0, -4, 150], fov: 60 },
  { id: 'fp-2-rim', cam: [10, 34, -30], at: [0, 34, -160], fov: 60 },
  { id: 'fp-3-plateau', cam: [60, 36, -120], at: [-150, 50, -190], fov: 60 },
  { id: 'fp-4-eagle-rock', cam: [170, 52, -20], at: [0, 0, 180], fov: 60 },
];
// the snow ring's massifs + the escarpment (docs/design/nalati/layout-v2.md): god views and first person on the ground
const CRAG_VIEWS = [
  { id: 'god-ring-from-n', cam: [0, 180, 60], at: [0, 40, -140], fov: 55 },
  { id: 'god-crags-from-nw', cam: [-40, 150, 20], at: [-190, 60, -120], fov: 55 },
  { id: 'god-west-from-ne', cam: [40, 150, 20], at: [170, 55, -130], fov: 55 },
  { id: 'god-escarp-from-n', cam: [30, 90, 260], at: [30, 10, 110], fov: 55 },
  { id: 'fp-valley-head', cam: [-6, 33, -62], at: [-60, 50, -110], fov: 60 },
  { id: 'fp-valley-mid', cam: [-18, 16, -150], at: [-14, 22, -60], fov: 60 },
  { id: 'fp-valley-south', cam: [-10, 17, -150], at: [-10, 10, -250], fov: 60 },
  { id: 'fp-bowl-to-crags', cam: [-100, 30, 10], at: [-190, 60, -110], fov: 60 },
  { id: 'fp-bowl-to-west', cam: [100, 30, 10], at: [170, 55, -120], fov: 60 },
  { id: 'fp-escarp-below', cam: [-60, -6, 150], at: [-60, 18, 100], fov: 60 },
];
const ONLY = flag('only', '').split(',').filter(Boolean);
const LIST = (SET === 'crags' ? CRAG_VIEWS : VIEWS).filter((v) => ONLY.length === 0 || ONLY.some((o) => v.id.includes(o)));
const SIZE = TIER === 'phone' ? { width: 390, height: 844 } : { width: 1600, height: 900 };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: SIZE })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&mute=1&nolock=1&skipintro=1&weather=clear&clock=0&perf=0&tier=${TIER}${EXTRA ? `&${EXTRA}` : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: 300000, polling: 1000 });
  await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
  await page.evaluate(() => {
    window.__weather.clock.paused = true;
    const w = window.__world, cam = w.game.camera;
    window.__cv = null;
    w.game.onUpdate(() => {
      const v = window.__cv; if (!v) return;
      cam.position.set(v.cam[0], v.cam[1], v.cam[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]);
      if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.far = Math.max(cam.far, 6000); cam.updateProjectionMatrix(); }
      for (const c of cam.children) c.visible = false;
    });
  });
  await new Promise((resolve) => { setTimeout(resolve, 12000); });
  const stats = [];
  for (const v of LIST) {
    await page.evaluate((vv) => {
      window.__cv = vv;
      // stream the world around the camera (grass, dressing and culling follow the player)
      window.__world.player.spawn(vv.cam[0], vv.cam[2], 0);
    }, v);
    await new Promise((resolve) => { setTimeout(resolve, 6000); });
    // a first-person view keeps the eye 1.7 m over the ground under it (the terrain may have moved)
    if (v.id.startsWith('fp-')) {
      await page.evaluate((vv) => { const y = window.__world.player.position.y; window.__cv = { ...vv, cam: [vv.cam[0], y + 1.7, vv.cam[2]] }; }, v);
      await new Promise((resolve) => { setTimeout(resolve, 1500); });
    }
    writeFileSync(resolvePath(OUT, `capture-${v.id}.jpg`), await page.screenshot({ type: 'jpeg', quality: 86 }));
    const perf = await page.evaluate(() => { const g = window.__world.game; return { calls: g.lastFrame.calls, tris: g.lastFrame.triangles }; });
    stats.push({ id: v.id, ...perf });
    console.log(`captured ${v.id.padEnd(20)} ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
  }
  writeFileSync(resolvePath(OUT, 'views.json'), JSON.stringify({ tier: TIER, set: SET, stats }, null, 1));
  if (errors.length > 0) console.log('page errors:', errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
