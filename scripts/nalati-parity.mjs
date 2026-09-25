#!/usr/bin/env node
// nalati-parity.mjs — the Nalati look-pass parity harness (docs/design/nalati/look-pass.md § Harness).
//
// Opens the running dev server in headless Chromium on the host GPU (ANGLE → Metal), loads the Nalati shard ONCE per
// tier, then re-poses the player at each reference pose (the six poses of look-pass.md) and writes a side-by-side
// JPEG — engine | mockup, same height — to progress/nalati-look/<tag>-<pose>-<tier>.jpg (≤ 500 KB each), plus the
// frame time / draw calls / triangles measured at that pose (vsync-capped: ~16.7 ms = keeping up at 60). When a
// paint-over target exists for the pose (art/nalati-grasslands/round-5-paintover/<pose>-<tier>.jpg, scripts/nalati-paintover.mjs)
// it is shown between the two: engine | paint-over | mockup.
//
//   node scripts/nalati-parity.mjs                                  # every pose, desktop + phone, tag "latest"
//   node scripts/nalati-parity.mjs --tag=01-aerial                  # name the set (before/after shots per commit)
//   node scripts/nalati-parity.mjs --poses=camp,plateau --tiers=phone
//   node scripts/nalati-parity.mjs --engine-only                    # engine frames only (no mockup half)
//   node scripts/nalati-parity.mjs --pose=40,-50,0,-0.9 --tiers=desktop  # one ad-hoc pose x,z,yaw,pitch[,time]
//   node scripts/nalati-parity.mjs --pose=... --eval='window.__gradeV2.uV2Sat.value = 1.15'      # try a value live
//   node scripts/nalati-parity.mjs --tiers=po-desktop,po-phone --engine-frames   # the paint-over sources (1536×1024 / 1024×1536)
//   node scripts/nalati-parity.mjs --url=http://127.0.0.1:5188 --query=foo=1 --settle=6
//
// One browser, closed at the end (the machine allows at most 3 game browsers — check `pgrep -fl chrome`).
// Needs the dev server (this worktree: http://127.0.0.1:5188). A load takes 60–120 s headless; each pose ~10 s.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve as resolvePath, join } from 'node:path';
import { POSES } from './nalati-poses.mjs';

const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-look');
const ART = resolvePath(ROOT, 'art/nalati-grasslands');
/** paint-over targets (scripts/nalati-paintover.mjs): <pose>-<tier>.jpg, their engine sources in engine/ */
const PAINTOVER = resolvePath(ART, 'round-5-paintover');



const TIERS = {
  desktop: { viewport: { width: 1600, height: 900 }, dpr: 1, query: 'tier=desktop' },
  phone: { viewport: { width: 390, height: 844 }, dpr: 1.5, query: 'tier=phone', touch: true },
  // the paint-over capture frames: the image model's sizes (1536×1024 landscape, 1024×1536 portrait = the mockups' frame)
  'po-desktop': { viewport: { width: 1536, height: 1024 }, dpr: 1, query: 'tier=desktop' },
  'po-phone': { viewport: { width: 512, height: 768 }, dpr: 2, query: 'tier=phone', touch: true },
};

const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const has = (name) => argv.includes(`--${name}`);
if (has('help')) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const TAG = flag('tag', 'latest');
const EXTRA = flag('query', '');
const EVAL = flag('eval', ''); // JS run in the page after each pose is set (e.g. a uniform override to test a look change live)
const SETTLE = Number(flag('settle', '5')) * 1000;
const TIMEOUT = Number(flag('timeout', '240')) * 1000;
const ENGINE_ONLY = has('engine-only');
const ENGINE_FRAMES = has('engine-frames'); // also save each raw engine frame (JPEG) to art/nalati-grasslands/round-5-paintover/engine/ — the paint-over sources
const wantPoses = flag('poses', POSES.map((p) => p.id).join(',')).split(',');
const wantTiers = flag('tiers', 'desktop,phone').split(',');
const adhoc = flag('pose', '');
// --pose=x,z,yaw,pitch[,time] — one ad-hoc pose (engine only), e.g. to look straight down at the cloud shadows
const poses = adhoc ? [(() => { const [x, z, yaw, pitch, time] = adhoc.split(','); return { id: 'adhoc', mockup: null, x: Number(x), z: Number(z), yaw: Number(yaw), pitch: Number(pitch ?? 0), time: time === undefined ? undefined : (Number.isFinite(Number(time)) ? Number(time) : time) }; })()]
  : POSES.filter((p) => wantPoses.includes(p.id));
mkdirSync(OUT, { recursive: true });

// ── browser: headless Chromium on Metal (vsync-capped: a p50 at 16.7 ms = keeping up; watch the p95 and the budget) ──
const udd = mkdtempSync(join(tmpdir(), 'nalati-parity-'));
const chrome = spawn(chromium.executablePath(), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--use-angle=metal', '--ignore-gpu-blocklist', 'about:blank', // vsync on (AGENTS.md: no uncapped frame rate on the shared box)
], { stdio: 'ignore' });
const cleanup = () => { try { chrome.kill(); } catch { /* gone */ } try { rmSync(udd, { recursive: true, force: true }); } catch { /* busy */ } };
process.on('SIGINT', () => { cleanup(); process.exit(130); });
const portFile = join(udd, 'DevToolsActivePort');
for (let i = 0; i < 150 && !(existsSync(portFile) && Number(readFileSync(portFile, 'utf8').split('\n')[0]) > 0); i++) await sleep(100);
const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

const results = [];
try {
  for (const tierName of wantTiers) {
    const T = TIERS[tierName];
    if (!T) { console.error(`unknown tier ${tierName}`); continue; }
    const ctx = await browser.newContext({ viewport: T.viewport, deviceScaleFactor: T.dpr, hasTouch: Boolean(T.touch), isMobile: false });
    const page = await ctx.newPage();
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const first = poses.at(0);
    if (first === undefined) break;
    const q = `chunk=nalati-grasslands&nolock=1&skipintro=1&weather=clear&clock=0&perf=0&${T.query}&x=${first.x}&z=${first.z}&yaw=${first.yaw}${EXTRA ? `&${EXTRA}` : ''}`;
    const t0 = Date.now();
    console.error(`[${tierName}] loading ${URL_BASE}/?${q}`);
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    console.error(`[${tierName}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length > 0 ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    const queue = [...poses], tries = new Map();
    for (const p of queue) {
      const yaw = (tierName.endsWith('phone') && p.phone?.yaw !== undefined) ? p.phone.yaw : p.yaw;
      const pitch = (tierName.endsWith('phone') && p.phone?.pitch !== undefined) ? p.phone.pitch : p.pitch;
      await ready(page);
      await page.evaluate((a) => {
        const w = window.__world, wx = window.__weather;
        window.__parityHour ??= wx.clock.hour; // the def's own sun (the clock starts there)
        w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch;
        wx.clock.set(a.time ?? window.__parityHour);
        wx.clock.paused = true;
      }, { x: p.x, z: p.z, yaw, pitch, time: p.time ?? null });
      if (EVAL) await page.evaluate(EVAL);
      await sleep(SETTLE); // streaming (grass ring, LODs), the look lerps, shadows settle
      const perf = await page.evaluate(() => new Promise((resolve, reject) => {
        if (!window.__world) { reject(new Error('reloaded')); return; }
        const g = window.__world.game;
        setTimeout(() => {
          const ms = Array.from(g.frameMs).filter((v) => v > 0).sort((a, b) => a - b);
          const pct = (f) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
          resolve({ p50: pct(0.5), p95: pct(0.95), fps: g.stats.fps, calls: g.lastFrame.calls, tris: g.lastFrame.triangles });
        }, 2500);
      })).catch((/** @type {unknown} */ e) => { console.error(`  ${p.id}: ${String(e).slice(0, 80)} — the page reloaded (HMR); re-run this pose`); return null; });
      if (!perf) { const n = (tries.get(p.id) ?? 0) + 1; tries.set(p.id, n); if (n < 3) queue.push(p); continue; }
      const shot = await page.screenshot({ type: 'png' });
      const name = `${TAG}-${p.id}-${tierName}.jpg`;
      const targets = [];
      if (!ENGINE_ONLY) {
        const po = paintoverFor(p.id, tierName);
        if (po) targets.push({ path: po, label: 'PAINT-OVER' });
        if (p.mockup) targets.push({ path: resolvePath(ART, p.mockup), label: 'MOCKUP' });
      }
      const { side: jpg, engine } = await composite(page, shot, targets, `${p.id} · ${tierName} · ${perf.p50.toFixed(1)} ms p50 / ${perf.p95.toFixed(1)} p95 · ${perf.calls} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
      writeFileSync(resolvePath(OUT, name), jpg);
      if (ENGINE_FRAMES) { mkdirSync(resolvePath(PAINTOVER, 'engine'), { recursive: true }); writeFileSync(resolvePath(PAINTOVER, 'engine', `${p.id}-${tierName}.jpg`), engine); }
      const row = { tag: TAG, pose: p.id, tier: tierName, x: p.x, z: p.z, yaw, pitch, time: p.time ?? null, ...perf, file: `progress/nalati-look/${name}`, kb: Math.round(jpg.length / 1024) };
      results.push(row);
      console.log(`${p.id.padEnd(8)} ${tierName.padEnd(7)} p50 ${perf.p50.toFixed(1).padStart(5)} ms · p95 ${perf.p95.toFixed(1).padStart(5)} ms · ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris → ${row.file} (${row.kb} KB)`);
    }
    if (errors.length > 0) console.error(`[${tierName}] page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close().catch(() => undefined);
  cleanup();
}
// merge into the tag's perf file (a partial re-run replaces only its own pose × tier rows)
const perfFile = resolvePath(OUT, `${TAG}-perf.json`);
const prev = existsSync(perfFile) ? JSON.parse(readFileSync(perfFile, 'utf8')) : [];
const merged = [...prev.filter((r) => !results.some((n) => n.pose === r.pose && n.tier === r.tier)), ...results];
writeFileSync(perfFile, `${JSON.stringify(merged, null, 2)}\n`);

/** the paint-over target for a pose × tier (scripts/nalati-paintover.mjs), if one was made: exact tier, else its capture tier */
function paintoverFor(pose, tier) {
  for (const t of [tier, `po-${tier}`, tier.replace(/^po-/, '')]) {
    const f = resolvePath(PAINTOVER, `${pose}-${t}.jpg`);
    if (existsSync(f)) return f;
  }
  return null;
}

/** a data URL for an image file (png / jpg) */
function dataUrl(path) { return `data:image/${path.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(path).toString('base64')}`; }

/**
 * engine PNG + the targets (paint-over, mockup — each scaled to the same height, labelled) → one JPEG ≤ 500 KB,
 * composed in a blank page's canvas. Also returns the engine frame as a JPEG (the paint-over source, `--engine-frames`).
 */
async function composite(page, enginePng, targets, caption) {
  const eng = `data:image/png;base64,${enginePng.toString('base64')}`;
  const panels = targets.map((t) => ({ src: dataUrl(t.path), label: t.label }));
  const p2 = await page.context().newPage();
  try {
    const out = await p2.evaluate(async (args) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const a = await load(args.eng);
      const imgs = [];
      for (const pn of args.panels) imgs.push({ img: await load(pn.src), label: pn.label });
      const H = Math.min(1100, a.height);
      const aw = Math.round(a.width * (H / a.height));
      const ws = imgs.map((p) => Math.round(p.img.width * (H / p.img.height)));
      const gap = 8;
      const c = document.createElement('canvas'); c.width = aw + ws.reduce((s, w) => s + w + gap, 0); c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, H);
      g.imageSmoothingQuality = 'high';
      g.drawImage(a, 0, 0, aw, H);
      g.font = '600 14px ui-monospace, monospace';
      const tag = (x, text, color) => { const tw = g.measureText(text).width; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, H - 24, tw + 16, 24); g.fillStyle = color; g.fillText(text, x + 8, H - 7); };
      tag(0, args.caption, '#9fe6ff');
      let x = aw + gap;
      imgs.forEach((p, i) => { const w = ws[i] ?? 0; g.drawImage(p.img, x, 0, w, H); tag(x, p.label, '#ffd98a'); x += w + gap; });
      let side = null;
      for (let q = 0.86; q >= 0.4; q -= 0.06) {
        const url = c.toDataURL('image/jpeg', q);
        if (url.length * 0.75 < 490 * 1024) { side = url.split(',')[1]; break; }
      }
      const e = document.createElement('canvas'); e.width = a.width; e.height = a.height;
      e.getContext('2d').drawImage(a, 0, 0);
      return { side: side ?? c.toDataURL('image/jpeg', 0.35).split(',')[1], engine: e.toDataURL('image/jpeg', 0.92).split(',')[1] };
    }, { eng, panels, caption });
    return { side: Buffer.from(out.side, 'base64'), engine: Buffer.from(out.engine, 'base64') };
  } finally { await p2.close(); }
}

/** the game is up (and, after an HMR full reload, up again) */
async function ready(page) {
  const up = () => page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: TIMEOUT, polling: 1000 });
  try { await up(); } catch {
    // a reload that never came back (an HMR full reload mid-boot, a transient compile error in someone's file): load again
    console.error('  the game did not come up — reloading');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await up();
  }
}

function sleep(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }
