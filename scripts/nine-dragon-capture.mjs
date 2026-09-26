#!/usr/bin/env node
// nine-dragon-capture.mjs — E169, shard 4 "Nine Dragon Stack": captures the clean-room spawn (dev/nine-dragon.html) for
// the level select's COMING SOON card and for the round-5 art review. One headless Chromium (Metal, muted), driven
// through the page's own API (window.__nd: ready, shot, hud, style, time, pixelRatio, snapshot, bench, stats) — no
// URL switches. The dev server must be up (default http://localhost:5173).
//
//   node scripts/nine-dragon-capture.mjs [--url=http://localhost:5173] [--only=cards,teasers,hud,board,bench] [--time=6.5]
//
// Writes:
//   src/chunks/thumbs/nine-dragon-stack{,-portrait,-landscape}.jpg          card art, no HUD (640×360, 1024×1536, 1600×900)
//   src/chunks/teasers/nine-dragon-stack/0N-<name>-{portrait,landscape}.jpg  slideshow screens, no HUD
//   art/nine-dragon-stack/round-5-cleanroom/hud-<shot>.jpg                  in-game frames WITH the HUD, iPhone portrait 1206×2622
//   art/nine-dragon-stack/round-5-cleanroom/mockup-vs-cleanroom.jpg         mockup | clean-room, spawn and Well edge
// No-HUD art is rendered at 1.5× the output size and downscaled in the page (supersampled lines), then JPEG'd under a
// byte cap (quality steps down until it fits).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const ROOT = resolve(import.meta.dirname, '..');
const PAGE = `${flag('url', 'http://localhost:5173')}/dev/nine-dragon.html`;
const ONLY = new Set(flag('only', 'cards,teasers,hud,board,bench').split(','));
const TIME = Number(flag('time', '6.5'));
const THUMBS = join(ROOT, 'src/chunks/thumbs');
const TEASERS = join(ROOT, 'src/chunks/teasers/nine-dragon-stack');
const ART = join(ROOT, 'art/nine-dragon-stack/round-5-cleanroom');
const MOCKS = join(ROOT, 'art/nine-dragon-stack/round-6-baseline-hud');
for (const d of [THUMBS, TEASERS, ART]) mkdirSync(d, { recursive: true });

const written = [];

async function open(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`console: ${m.text().slice(0, 300)}`); });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__nd !== undefined, undefined, { timeout: 120000 });
  await page.evaluate(() => window.__nd.ready);
  await page.evaluate((t) => { window.__nd.time(t); }, TIME);
  return page;
}

/** a JPEG data URL → file, stepping the quality down until it is under the cap */
async function snap(page, out, w, h, maxKB) {
  let q = 0.88, buf = null;
  for (; q >= 0.5; q -= 0.04) {
    const url = await page.evaluate(([ww, hh, qq]) => window.__nd.snapshot(ww, hh, qq), [w, h, q]);
    buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (buf.length <= maxKB * 1024) break;
  }
  writeFileSync(out, buf);
  written.push(`${out.slice(ROOT.length + 1)}  ${w}×${h}  ${Math.round(buf.length / 1024)} KB  q${Math.round(q * 100)}`);
  console.log('wrote', out.slice(ROOT.length + 1), Math.round(buf.length / 1024), 'KB');
}

/** render no-HUD art in one orientation: every job is { shot, style, out, w, h, maxKB } */
async function artPass(browser, viewport, jobs) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 3 });
  const page = await open(context);
  await page.evaluate(() => { window.__nd.pixelRatio(3); window.__nd.hud(false); });
  for (const j of jobs) {
    await page.evaluate(([s, st]) => { window.__nd.style(st); return window.__nd.shot(s); }, [j.shot, j.style]);
    await page.waitForTimeout(250);
    await snap(page, j.out, j.w, j.h, j.maxKB);
  }
  await context.close();
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  // ── card art + slideshow screens (no HUD) ──
  const portrait = [], landscape = [];
  if (ONLY.has('cards')) {
    portrait.push({ shot: 'spawn', style: 'jiehua', out: join(THUMBS, 'nine-dragon-stack-portrait.jpg'), w: 1024, h: 1536, maxKB: 350 });
    landscape.push({ shot: 'spawn-wide', style: 'jiehua', out: join(THUMBS, 'nine-dragon-stack-landscape.jpg'), w: 1600, h: 900, maxKB: 350 });
    landscape.push({ shot: 'spawn-wide', style: 'jiehua', out: join(THUMBS, 'nine-dragon-stack.jpg'), w: 640, h: 360, maxKB: 70 });
  }
  if (ONLY.has('teasers')) {
    const set = [['01-well-edge', 'well-edge', 'well-edge-wide', 'jiehua'], ['02-well-down', 'well-down', 'well-down-wide', 'jiehua'],
      ['03-canyon-up', 'canyon-up', 'canyon-up', 'jiehua'], ['04-sutra', 'spawn', 'spawn-wide', 'sutra']];
    for (const [name, p, l, style] of set) {
      portrait.push({ shot: p, style, out: join(TEASERS, `${name}-portrait.jpg`), w: 1024, h: 1536, maxKB: 350 });
      landscape.push({ shot: l, style, out: join(TEASERS, `${name}-landscape.jpg`), w: 1600, h: 900, maxKB: 350 });
    }
  }
  if (portrait.length > 0) await artPass(browser, { width: 683, height: 1024 }, portrait);
  if (landscape.length > 0) await artPass(browser, { width: 1067, height: 600 }, landscape);

  // ── in-game frames with the HUD: iPhone portrait 402×874 at 3× ──
  if (ONLY.has('hud') || ONLY.has('bench') || ONLY.has('board')) {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await open(context);
    await page.evaluate(() => { window.__nd.pixelRatio(3); window.__nd.hud(true); window.__nd.style('jiehua'); });
    for (const s of ['spawn', 'well-edge', 'stair-street']) {
      await page.evaluate((n) => window.__nd.shot(n), s);
      await page.waitForTimeout(400);
      const out = join(ART, `hud-${s}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
      const st = await page.evaluate(() => window.__nd.stats());
      written.push(`${out.slice(ROOT.length + 1)}  1206×2622 (402×874 @3×), HUD on  draw calls ${st.calls}, ${Math.round(st.triangles / 1000)}k tris`);
      console.log('wrote', out.slice(ROOT.length + 1), 'calls', st.calls);
    }
    if (ONLY.has('bench')) {
      await page.evaluate(() => { window.__nd.hud(false); return window.__nd.shot('spawn'); });
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.__nd.bench(60)));
      const st = await page.evaluate(() => window.__nd.stats());
      runs.sort((a, b) => a - b);
      console.log(`bench spawn ${st.width}×${st.height}: ${runs.map((x) => x.toFixed(2)).join(' / ')} ms/frame (median ${runs[1].toFixed(2)}), ${st.calls} draw calls, ${st.triangles} tris`);
    }
    // ── the board: mockup | clean-room, for the spawn and the Well's edge ──
    if (ONLY.has('board')) {
      const b64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
      const panels = [
        [b64(join(MOCKS, 'style-A-jiehua-neon.jpg')), 'MOCKUP · spawn (round-6 style A)'],
        [b64(join(ART, 'hud-spawn.jpg')), 'CLEAN-ROOM · spawn'],
        [b64(join(MOCKS, 'comp-B-well-edge.jpg')), 'MOCKUP · Well edge (round-6 comp B)'],
        [b64(join(ART, 'hud-well-edge.jpg')), 'CLEAN-ROOM · well-edge'],
      ];
      const url = await page.evaluate(async (list) => {
        const H = 1400, W = Math.round(H * 402 / 874), G = 16, TOP = 64;
        const cv = document.createElement('canvas');
        cv.width = list.length * W + (list.length + 1) * G;
        cv.height = H + TOP + G;
        const c = cv.getContext('2d');
        c.fillStyle = '#0d1b26';
        c.fillRect(0, 0, cv.width, cv.height);
        c.font = '600 26px "JetBrains Mono", monospace';
        c.textBaseline = 'middle';
        for (let i = 0; i < list.length; i++) {
          const img = new Image();
          img.src = list[i][0];
          await img.decode();
          const x = G + i * (W + G);
          c.drawImage(img, x, TOP, W, H);
          c.strokeStyle = 'rgba(143, 227, 255, 0.6)';
          c.lineWidth = 2;
          c.strokeRect(x, TOP, W, H);
          c.fillStyle = i % 2 === 0 ? '#9fb2bd' : '#8fe3ff';
          c.fillText(list[i][1], x + 4, TOP / 2);
        }
        return cv.toDataURL('image/jpeg', 0.86);
      }, panels);
      const out = join(ART, 'mockup-vs-cleanroom.jpg');
      writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      written.push(`${out.slice(ROOT.length + 1)}  mockup | clean-room, spawn and Well edge (HUD on)`);
      console.log('wrote', out.slice(ROOT.length + 1));
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${written.join('\n')}`);
