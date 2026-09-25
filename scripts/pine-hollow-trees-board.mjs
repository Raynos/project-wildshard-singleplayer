#!/usr/bin/env node
// pine-hollow-trees-board.mjs — PH-B4's taste board: "Pine Hollow trees — which?" A = the Blender species set (default),
// B = today's runtime pines (`?trees=v1`).
//
//   node scripts/pine-hollow-trees-board.mjs --url=http://localhost:4187 [--out=art/pine-hollow/round-12-trees] [--only=fp|lineup|compose]
//
// Per letter: a LINEUP (desktop 1600×900, noon, the forest hidden, one of every variant standing in a row in the King's
// clearing — the same light for all), and FP phone tiles (iPhone 16 Pro UA, 390×844 @3, `tier=phone&touch`, HUD on) at the
// Hollow, the old-growth, the King's clearing and the Ridge, at day and at golden hour. Frames go to --frames (scratch);
// the board (PIL: labels + layout, JPEG ≤ 600 KB) to <out>/board.jpg, the lineups to <out>/lineup-{A,B}.jpg.
// One headless Chromium on Metal, muted (--mute-audio + mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4187');
const OUT = resolvePath(ROOT, flag('out', 'art/pine-hollow/round-12-trees'));
const FRAMES = resolvePath(flag('frames', resolvePath(tmpdir(), 'pine-hollow-trees')));
const ONLY = flag('only', '');
const SETTLE = Number(flag('settle', '5')) * 1000;
mkdirSync(OUT, { recursive: true }); mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** FP poses (yaw faces (−sin yaw, −cos yaw)); pitch a touch up so the crowns are in frame */
const POSES = [
  { id: 'hollow', label: 'THE HOLLOW', x: -30, z: -78, yaw: 2.6, pitch: 0.12 },
  { id: 'oldgrowth', label: 'THE OLD-GROWTH', x: 108, z: -122, yaw: 3.1416, pitch: 0.25 },
  { id: 'clearing', label: "THE KING'S CLEARING", x: 150, z: -5, yaw: 0.0, pitch: 0.12 },
  { id: 'ridge', label: 'THE RIDGE', x: 110, z: 178, yaw: 0.6, pitch: 0.02 },
];
const TODS = ['day', 'golden'];
const LETTERS = [{ id: 'A', q: '' }, { id: 'B', q: 'trees=v1' }];

async function ready(page) {
  await page.waitForFunction(() => Boolean(window.__world && window.__hf && window.__world.animals && window.__world.forest), undefined, { timeout: 300000, polling: 1000 });
  await page.evaluate(() => { window.__world.animals.calm = true; });
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const iphone = devices['iPhone 16 Pro'];
  if (ONLY === '' || ONLY === 'fp') for (const L of LETTERS) for (const tod of TODS) {
    const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const p0 = POSES[0];
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&skipintro=1&nolock=1&tier=phone&touch&mute=1&sw=0&tod=${tod}&clock=1000000&x=${p0.x}&z=${p0.z}&${L.q}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await sleep(SETTLE * 2);
    for (const p of POSES) {
      await page.evaluate((pp) => { const w = window.__world; w.player.spawn(pp.x, pp.z, pp.yaw); w.player.pitch = pp.pitch; }, p);
      await sleep(SETTLE);
      const perf = await page.evaluate(() => ({ calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles }));
      const file = `${FRAMES}/${L.id}-${p.id}-${tod}.jpg`;
      writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 88, scale: 'css' }));
      console.log(`${L.id} ${tod.padEnd(6)} ${p.id.padEnd(9)} ${perf.calls} calls · ${(perf.tris / 1e6).toFixed(2)} M`);
    }
    await ctx.close();
  }
  if (ONLY === '' || ONLY === 'lineup') for (const L of LETTERS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&skipintro=1&nolock=1&tier=desktop&mute=1&sw=0&tod=day&clock=1000000&x=150&z=-80&${L.q}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
    await sleep(SETTLE * 2);
    // one of every variant, in a row across the King's clearing (bare ground), the forest hidden: every species, one light
    await page.evaluate(() => {
      const w = window.__world, f = w.forest, fac = f.factory;
      let Mesh = null, Group = null;
      w.game.scene.traverse((o) => { if (!Mesh && o.isMesh && !o.isBatchedMesh && !o.isInstancedMesh && !o.isSkinnedMesh) Mesh = o.constructor; if (!Group && o.isGroup) Group = o.constructor; });
      f.group.visible = false;
      const row = new Group();
      const order = fac.variants.map((v, i) => i);
      const widths = fac.variants.map((v) => { v.cardsHi.computeBoundingBox(); const b = v.cardsHi.boundingBox; return Math.max(2.5, Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) * 0.8); });
      const total = widths.reduce((a, b) => a + b * 2, 0);
      // the row stands across the sun's azimuth and the camera looks at it from the sun's side: every tree front-lit
      const sd = w.sky.sunDir, sl = Math.hypot(sd.x, sd.z) || 1, sx = sd.x / sl, sz = sd.z / sl;
      const rx = -sz, rz = sx, cx = 150, cz = -30;
      let off = total / 2;
      for (const i of order) {
        const v = fac.variants[i], r = widths[i];
        off -= r;
        const g = new Group();
        const crown = new Mesh(v.cardsHi, fac.needleMaterial), twigs = new Mesh(v.twigs, fac.twigMaterial), trunk = new Mesh(v.trunk, fac.barkMaterial);
        crown.customDepthMaterial = fac.needleDepth; twigs.customDepthMaterial = fac.twigDepth;
        for (const m of [trunk, crown, twigs]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(m); }
        const x = cx + rx * off, z = cz + rz * off;
        g.position.set(x, window.__hf.heightAt(x, z) - 0.2, z);
        row.add(g);
        off -= r;
      }
      w.game.scene.add(row);
      const cam = w.game.camera;
      w.player.spawn(cx + sx * 40, cz + sz * 40, 0); w.freeCamera = true;
      const d = Math.max(total * 0.5, 45), gy = window.__hf.heightAt(cx, cz);
      w.game.onLate(() => {
        for (const ch of cam.children) ch.visible = false;
        cam.fov = 56; cam.updateProjectionMatrix();
        cam.position.set(cx + sx * d, gy + 12, cz + sz * d); cam.lookAt(cx, gy + 16, cz); cam.updateMatrixWorld(true);
      });
    });
    await sleep(SETTLE * 2);
    writeFileSync(`${OUT}/lineup-${L.id}.jpg`, await page.screenshot({ type: 'jpeg', quality: 86 }));
    console.log(`lineup ${L.id}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (ONLY !== '' && ONLY !== 'compose') process.exit(0); // a partial capture: no board (--only=compose: the board from the frames on disk)

// ── the board: A | B side by side, portrait — per letter the lineup, then per spot a day + golden pair of phone tiles
// (PIL: the labels and the layout; JPEG stepped down until ≤ 600 KB)
const PY = String.raw`
import json, sys
from PIL import Image, ImageDraw, ImageFont
a = json.loads(sys.argv[1])
def font(sz):
    for f in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try: return ImageFont.truetype(f, sz)
        except OSError: pass
    return ImageFont.load_default()
BG, COL, GAP, PAD = (16, 18, 22), 560, 14, 18
tile_w = (COL - GAP) // 2
tile_h = int(tile_w * 844 / 390)
line_h = int(COL * 900 / 1600)
rows = len(a['poses'])
H = 70 + 150 + 40 + line_h + rows * (34 + tile_h) + 60
W = PAD * 2 + COL * 2 + 30
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
d.text((PAD, 14), 'Pine Hollow trees — which?', font=font(42), fill=(255, 208, 110))
d.text((PAD, 64), 'iPhone 16 Pro · tier=phone&touch · the Hollow, the old-growth, the King’s clearing, the Ridge · day | golden hour', font=font(15), fill=(150, 185, 200))
for ci, L in enumerate(a['letters']):
    x0 = PAD + ci * (COL + 30)
    y = 88
    d.text((x0 + 8, y), L['id'], font=font(140), fill=(255, 255, 255))
    d.text((x0 + 120, y + 60), L['sub'], font=font(24), fill=(143, 216, 255))
    y += 162
    d.text((x0, y), 'the lineup — every variant, noon, one light', font=font(15), fill=(255, 208, 110)); y += 22
    im = Image.open(L['lineup']).convert('RGB').resize((COL, line_h), Image.LANCZOS)
    img.paste(im, (x0, y)); y += line_h + 12
    for p in a['poses']:
        d.text((x0, y), p['label'] + '  ·  day  |  golden', font=font(16), fill=(255, 208, 110)); y += 22
        for k, t in enumerate(a['tods']):
            im = Image.open(f"{a['frames']}/{L['id']}-{p['id']}-{t}.jpg").convert('RGB').resize((tile_w, tile_h), Image.LANCZOS)
            dd = ImageDraw.Draw(im)
            dd.rectangle((0, tile_h - 58, 54, tile_h), fill=(16, 18, 22))
            dd.text((10, tile_h - 58), L['id'], font=font(48), fill=(255, 255, 255))
            img.paste(im, (x0 + k * (tile_w + GAP), y))
        y += tile_h + 12
d.line((PAD + COL + 15, 100, PAD + COL + 15, H - 40), fill=(120, 200, 230), width=2)
d.text((PAD, H - 34), 'A = the Blender species set (Scots pine, fir, old-growth giants, birch, snags, saplings; the default)   B = ?trees=v1 (today’s runtime pines)', font=font(14), fill=(150, 185, 200))
for q in (88, 82, 76, 70, 64, 58, 52):
    img.save(a['out'], quality=q, optimize=True)
    import os
    if os.path.getsize(a['out']) <= 600 * 1024: break
print(a['out'], os.path.getsize(a['out']) // 1024, 'KB')
`;
const args = {
  out: `${OUT}/board.jpg`, frames: FRAMES, tods: TODS, poses: POSES.map((p) => ({ id: p.id, label: p.label })),
  letters: [
    { id: 'A', sub: 'the Blender species set', lineup: `${OUT}/lineup-A.jpg` },
    { id: 'B', sub: "today's pines (?trees=v1)", lineup: `${OUT}/lineup-B.jpg` },
  ],
};
console.log(execFileSync('python3', ['-c', PY, JSON.stringify(args)]).toString().trim());
