#!/usr/bin/env node
// nine-dragon-capture.mjs — E169, shard 4 "Nine Dragon Stack": captures the clean-room spawn (dev/nine-dragon.html) for
// the level select's COMING SOON card and for the round-5 art review. One headless Chromium (Metal, muted), driven
// through the page's own API (window.__nd: ready, shot, hud, style, time, pixelRatio, snapshot, bench, stats) — no
// URL switches. The dev server must be up (default http://localhost:5173).
//
//   node scripts/nine-dragon-capture.mjs [--url=http://localhost:5173] [--only=cards,teasers,hud,board,bench] [--time=6.5] [--v1=<dir of v1 hud-*.jpg>]
//
// Writes:
//   src/chunks/thumbs/nine-dragon-stack{,-portrait,-landscape}.jpg          card art, no HUD (640×360, 1024×1536, 1600×900)
//   src/chunks/teasers/nine-dragon-stack/0N-<name>-{portrait,landscape}.jpg  slideshow screens, no HUD
//   art/nine-dragon-stack/round-5-cleanroom/hud-<shot>.jpg                  in-game frames WITH the HUD, iPhone portrait 1206×2622
//   art/nine-dragon-stack/round-5-cleanroom/mockup-vs-cleanroom.jpg         mockup | clean-room, spawn and Well edge
//   art/nine-dragon-stack/round-5-cleanroom/v1-vs-v2.jpg                    (with --v1) v1 | v2 | mockup, spawn and Well edge
// The look loop (docs/design/LOOK-LOOP.md), with --round=<n> (writes art/nine-dragon-stack/round-8-look-loop-<n>/):
//   --only=loop      capture-<k>.jpg for the 9 loop cameras (FP 1-6: portrait 402x874 @2, no HUD; 7-9: aerial
//                    1600x900) + sheet-ingame-3x3.jpg (rows: FP 1-3, FP 4-6, aerials 7-9)
//   --only=sheets    sheet-target-3x3.jpg from target-<k>.jpg (same cell order; skipped with --targets=<an earlier
//                    round's dir>, when the round chases those), and with --before / --after (dirs, default this
//                    round) board.jpg: BEFORE | AFTER | TARGET for FP 1, FP 6 and aerial 7
//   --only=warmcool  warm-vs-cool.jpg: spawn and well-edge, A blue hour | B warm silk, portrait
//   --only=mock      the four round-6 mockup views WITH the HUD (iPhone portrait 402x874 @3): mock-A (spawn),
//                    mock-B (well-edge), mock-C (stair-street), mock-D (well-down) + sheet-mockups.jpg (capture | mockup)
//   --only=eye       eye-check.jpg (with --prev=<dir of the previous round>): previous | this round | target for
//                    capture-1, 2, 6 and mock-A..D (the mockups are the targets of those four). Look at it before a report.
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
const ROUND = flag('round', '');
const LOOP = ROUND === '' ? '' : join(ROOT, 'art/nine-dragon-stack', `round-8-look-loop-${ROUND}`);
if (LOOP !== '') mkdirSync(LOOP, { recursive: true });
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

const b64 = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;

/**
 * Lay images out on a canvas in the page: rows of cells, each row one height, a label over each cell. `rows` is a
 * list of { h, cells: [{ src, label, w }] }. Written as JPEG, the quality stepped down until it is under `maxKB`.
 */
async function layout(page, rows, out, maxKB, what) {
  let q = 0.88, buf = null;
  for (; q >= 0.5; q -= 0.06) {
    const url = await page.evaluate(async ([rs, qq]) => {
      const G = 10, LAB = 34;
      const W = Math.max(...rs.map((r) => r.cells.reduce((a, c) => a + c.w + G, G)));
      const H = rs.reduce((a, r) => a + r.h + LAB + G, G);
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d');
      c.fillStyle = '#0d1b26';
      c.fillRect(0, 0, W, H);
      c.font = '600 22px "JetBrains Mono", monospace';
      c.textBaseline = 'middle';
      let y = G;
      for (const r of rs) {
        let x = G;
        for (const cell of r.cells) {
          const img = new Image();
          img.src = cell.src;
          await img.decode();
          const k = Math.min(cell.w / img.width, r.h / img.height);
          const dw = img.width * k, dh = img.height * k;
          c.drawImage(img, x + (cell.w - dw) / 2, y + LAB + (r.h - dh) / 2, dw, dh);
          c.fillStyle = '#8fe3ff';
          c.fillText(cell.label, x + 2, y + LAB / 2);
          x += cell.w + G;
        }
        y += r.h + LAB + G;
      }
      return cv.toDataURL('image/jpeg', qq);
    }, [rows, q]);
    buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (buf.length <= maxKB * 1024) break;
  }
  writeFileSync(out, buf);
  written.push(`${out.slice(ROOT.length + 1)}  ${what}  ${Math.round(buf.length / 1024)} KB`);
  console.log('wrote', out.slice(ROOT.length + 1), Math.round(buf.length / 1024), 'KB');
}

/** the four round-6 mockups the loop also answers to (Jake judges the shard against them), with their shots */
const MOCK_VIEWS = [
  { id: 'A', shot: 'spawn', mock: 'style-A-jiehua-neon.jpg', label: 'spawn' },
  { id: 'B', shot: 'well-edge', mock: 'comp-B-well-edge.jpg', label: 'well edge' },
  { id: 'C', shot: 'stair-street', mock: 'comp-C-stair-street.jpg', label: 'stair street' },
  { id: 'D', shot: 'well-down', mock: 'comp-D-well-down.jpg', label: 'well down' },
];

const LOOP_NAMES = ['FP front, paifang', 'FP left, across the Well', 'FP right, stall + towers', 'FP back, stair-street', 'FP up, canyon + screen',
  'FP down, the Well', 'aerial, the square', 'aerial, up the shaft', 'aerial, across the Well'];
/** the 3x3 sheet: FP 1-3, FP 4-6 (portrait cells), aerials 7-9 (landscape cells) */
const sheet3 = (files, labels) => [
  { h: 900, cells: [0, 1, 2].map((i) => ({ src: b64(files[i]), label: labels[i], w: 414 })) },
  { h: 900, cells: [3, 4, 5].map((i) => ({ src: b64(files[i]), label: labels[i], w: 414 })) },
  { h: 350, cells: [6, 7, 8].map((i) => ({ src: b64(files[i]), label: labels[i], w: 622 })) },
];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  // ── the look loop: 9 frozen cameras, no HUD ──
  if (LOOP !== '' && (ONLY.has('loop') || ONLY.has('warmcool'))) {
    const fp = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 });
    const page = await open(fp);
    await page.evaluate(() => { window.__nd.pixelRatio(2); window.__nd.hud(false); window.__nd.style('jiehua'); });
    const files = [];
    if (ONLY.has('loop')) {
      const stats = [];
      for (let k = 1; k <= 6; k++) {
        await page.evaluate((n) => window.__nd.shot(n), `loop-${k}`);
        await page.waitForTimeout(300);
        const out = join(LOOP, `capture-${k}.jpg`);
        await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
        const st = await page.evaluate(() => window.__nd.stats());
        stats.push(`loop-${k}: ${st.calls} calls, ${Math.round(st.triangles / 1000)}k tris`);
        files.push(out);
      }
      const god = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
      const gp = await open(god);
      await gp.evaluate(() => { window.__nd.pixelRatio(1); window.__nd.hud(false); window.__nd.style('jiehua'); });
      for (let k = 7; k <= 9; k++) {
        await gp.evaluate((n) => window.__nd.shot(n), `loop-${k}`);
        await gp.waitForTimeout(300);
        const out = join(LOOP, `capture-${k}.jpg`);
        await gp.screenshot({ path: out, type: 'jpeg', quality: 88 });
        const st = await gp.evaluate(() => window.__nd.stats());
        stats.push(`loop-${k}: ${st.calls} calls, ${Math.round(st.triangles / 1000)}k tris`);
        files.push(out);
      }
      await god.close();
      await layout(page, sheet3(files, LOOP_NAMES.map((n, i) => `${i + 1} ${n}`)), join(LOOP, 'sheet-ingame-3x3.jpg'), 490, 'the 9 loop captures');
      writeFileSync(join(LOOP, 'stats.txt'), `${stats.join('\n')}\n`);
      console.log(stats.join('\n'));
    }
    if (ONLY.has('warmcool')) {
      const cells = [];
      for (const s of ['spawn', 'well-edge']) {
        for (const [look, lab] of [['jiehua', 'A blue hour'], ['silk', 'B warm silk']]) {
          await page.evaluate(([st, n]) => { window.__nd.style(st); return window.__nd.shot(n); }, [look, s]);
          await page.waitForTimeout(300);
          const url = await page.evaluate(() => window.__nd.snapshot(804, 1748, 0.9));
          cells.push({ src: url, label: `${lab}, ${s}`, w: 402 });
        }
      }
      await page.evaluate(() => { window.__nd.style('jiehua'); });
      await layout(page, [{ h: 874, cells }], join(LOOP, 'warm-vs-cool.jpg'), 600, 'A blue hour | B warm silk, spawn and well-edge');
    }
    await fp.close();
  }
  // ── the four mockup views, WITH the HUD, and capture | mockup ──
  if (LOOP !== '' && ONLY.has('mock')) {
    const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await open(context);
    await page.evaluate(() => { window.__nd.pixelRatio(3); window.__nd.hud(true); window.__nd.style('jiehua'); });
    const cells = [];
    for (const v of MOCK_VIEWS) {
      await page.evaluate((n) => window.__nd.shot(n), v.shot);
      await page.waitForTimeout(400);
      // the frame at 1400 px tall (the round folders stay small), the canvas + DOM HUD composited by the screenshot
      const raw = await page.screenshot({ type: 'jpeg', quality: 90 });
      const small = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const H = 1400, W = Math.round(img.width * H / img.height);
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const c = cv.getContext('2d');
        c.imageSmoothingQuality = 'high';
        c.drawImage(img, 0, 0, W, H);
        return cv.toDataURL('image/jpeg', 0.82);
      }, `data:image/jpeg;base64,${raw.toString('base64')}`);
      const out = join(LOOP, `mock-${v.id}.jpg`);
      writeFileSync(out, Buffer.from(small.slice(small.indexOf(',') + 1), 'base64'));
      console.log('wrote', out.slice(ROOT.length + 1));
      cells.push({ src: small, label: `${v.id} ${v.label}: in game`, w: 414 }, { src: b64(join(MOCKS, v.mock)), label: `${v.id} mockup`, w: 414 });
    }
    await layout(page, [{ h: 900, cells: cells.slice(0, 4) }, { h: 900, cells: cells.slice(4) }], join(LOOP, 'sheet-mockups.jpg'), 700, 'in game | mockup, the four round-6 views');
    await context.close();
  }
  // ── the eye check: previous round | this round | target (capture-1, 2, 6; the four mockup views) ──
  if (LOOP !== '' && ONLY.has('eye')) {
    const PREV = resolve(ROOT, flag('prev', ''));
    const TG = resolve(ROOT, flag('targets', 'art/nine-dragon-stack/round-8-look-loop-1'));
    const ctx0 = await browser.newContext({ viewport: { width: 400, height: 400 } });
    const page = await ctx0.newPage();
    await page.goto('about:blank');
    const tri = (a, b, c, lab) => [
      { src: b64(a), label: `${lab} prev`, w: 300 }, { src: b64(b), label: `${lab} now`, w: 300 }, { src: b64(c), label: `${lab} target`, w: 300 },
    ];
    const t = [
      ...[1, 2, 6].map((k) => tri(join(PREV, `capture-${k}.jpg`), join(LOOP, `capture-${k}.jpg`), join(TG, `target-${k}.jpg`), `${k}`)),
      ...MOCK_VIEWS.map((v) => tri(join(PREV, `mock-${v.id}.jpg`), join(LOOP, `mock-${v.id}.jpg`), join(MOCKS, v.mock), v.id)),
    ];
    const rows = [];
    for (let i = 0; i < t.length; i += 2) rows.push({ h: 652, cells: [...t[i], ...(t[i + 1] ?? [])] });
    await layout(page, rows, join(LOOP, 'eye-check.jpg'), 950, 'previous | now | target: capture-1, 2, 6 and mock-A..D');
    await ctx0.close();
  }
  if (LOOP !== '' && ONLY.has('sheets')) {
    const ctx0 = await browser.newContext({ viewport: { width: 400, height: 400 } });
    const page = await ctx0.newPage();
    await page.goto('about:blank');
    // a round chases its own targets, or an earlier round's (--targets=<dir>: Jake kept round 1's)
    const TG = resolve(ROOT, flag('targets', LOOP));
    if (TG === LOOP) {
      const tg = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => join(LOOP, `target-${k}.jpg`));
      await layout(page, sheet3(tg, LOOP_NAMES.map((n, i) => `${i + 1} target, ${n}`)), join(LOOP, 'sheet-target-3x3.jpg'), 490, 'the 9 codex targets');
    }
    // the board: BEFORE (--before, default this round's captures) | AFTER (--after, default this round) | TARGET
    const BEFORE = flag('before', ''), AFTER = flag('after', '');
    if (BEFORE !== '' || AFTER !== '') {
      const bd = resolve(ROOT, BEFORE === '' ? LOOP : BEFORE), ad = resolve(ROOT, AFTER === '' ? LOOP : AFTER);
      const cellsFor = (k, w) => [
        { src: b64(join(bd, `capture-${k}.jpg`)), label: `BEFORE ${k}`, w },
        { src: b64(join(ad, `capture-${k}.jpg`)), label: `AFTER ${k}`, w },
        { src: b64(join(TG, `target-${k}.jpg`)), label: `TARGET ${k}`, w },
      ];
      await layout(page, [{ h: 900, cells: cellsFor(1, 414) }, { h: 900, cells: cellsFor(6, 414) }, { h: 350, cells: cellsFor(7, 622) }],
        join(LOOP, 'board.jpg'), 600, 'BEFORE | AFTER | TARGET, FP 1, FP 6, aerial 7');
    }
    await ctx0.close();
  }

  // ── card art + slideshow screens (no HUD) ──
  const portrait = [], landscape = [];
  if (ONLY.has('cards')) {
    portrait.push({ shot: 'spawn-card', style: 'jiehua', out: join(THUMBS, 'nine-dragon-stack-portrait.jpg'), w: 1024, h: 1536, maxKB: 350 });
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
    // ── the boards: mockup | clean-room (spawn, Well edge); and, given --v1=<dir>, v1 | v2 | mockup ──
    const board = async (panels, rows, out, what) => {
      const url = await page.evaluate(async ([list, nrows]) => {
        const H = 1400, W = Math.round(H * 402 / 874), G = 16, TOP = 64;
        const per = Math.ceil(list.length / nrows);
        const cv = document.createElement('canvas');
        cv.width = per * W + (per + 1) * G;
        cv.height = nrows * (H + TOP) + G;
        const c = cv.getContext('2d');
        c.fillStyle = '#0d1b26';
        c.fillRect(0, 0, cv.width, cv.height);
        c.font = '600 26px "JetBrains Mono", monospace';
        c.textBaseline = 'middle';
        for (let i = 0; i < list.length; i++) {
          const img = new Image();
          img.src = list[i][0];
          await img.decode();
          const x = G + (i % per) * (W + G), y = Math.floor(i / per) * (H + TOP);
          c.drawImage(img, x, y + TOP, W, H);
          c.strokeStyle = 'rgba(143, 227, 255, 0.6)';
          c.lineWidth = 2;
          c.strokeRect(x, y + TOP, W, H);
          c.fillStyle = list[i][1].startsWith('MOCKUP') ? '#9fb2bd' : '#8fe3ff';
          c.fillText(list[i][1], x + 4, y + TOP / 2);
        }
        return cv.toDataURL('image/jpeg', 0.86);
      }, [panels, rows]);
      writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      written.push(`${out.slice(ROOT.length + 1)}  ${what}`);
      console.log('wrote', out.slice(ROOT.length + 1));
    };
    if (ONLY.has('board')) {
      await board([
        [b64(join(MOCKS, 'style-A-jiehua-neon.jpg')), 'MOCKUP · spawn (round-6 style A)'],
        [b64(join(ART, 'hud-spawn.jpg')), 'CLEAN-ROOM · spawn'],
        [b64(join(MOCKS, 'comp-B-well-edge.jpg')), 'MOCKUP · Well edge (round-6 comp B)'],
        [b64(join(ART, 'hud-well-edge.jpg')), 'CLEAN-ROOM · well-edge'],
      ], 1, join(ART, 'mockup-vs-cleanroom.jpg'), 'mockup | clean-room, spawn and Well edge (HUD on)');
      const V1 = flag('v1', '');
      if (V1 !== '') {
        await board([
          [b64(join(V1, 'hud-spawn.jpg')), 'V1 · spawn'],
          [b64(join(ART, 'hud-spawn.jpg')), 'V2 · spawn'],
          [b64(join(MOCKS, 'style-A-jiehua-neon.jpg')), 'MOCKUP · spawn'],
          [b64(join(V1, 'hud-well-edge.jpg')), 'V1 · well-edge'],
          [b64(join(ART, 'hud-well-edge.jpg')), 'V2 · well-edge'],
          [b64(join(MOCKS, 'comp-B-well-edge.jpg')), 'MOCKUP · Well edge'],
        ], 2, join(ART, 'v1-vs-v2.jpg'), 'v1 | v2 | mockup, spawn and Well edge (HUD on)');
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${written.join('\n')}`);
