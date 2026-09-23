#!/usr/bin/env node
// nalati-parity.mjs — the Nalati look-pass parity harness (docs/design/nalati/look-pass.md § Harness).
//
// Opens the running dev server in headless Chromium on the host GPU (ANGLE → Metal), loads the Nalati shard ONCE per
// tier, then re-poses the player at each reference pose (the six poses of look-pass.md) and writes a side-by-side
// JPEG — engine | mockup, same height — to progress/nalati-look/<tag>-<pose>-<tier>.jpg (≤ 500 KB each), plus the
// frame time / draw calls / triangles measured at that pose (uncapped frame rate, so the ms is the real cost).
//
//   node scripts/nalati-parity.mjs                                  # every pose, desktop + phone, tag "latest"
//   node scripts/nalati-parity.mjs --tag=01-aerial                  # name the set (before/after shots per commit)
//   node scripts/nalati-parity.mjs --poses=camp,plateau --tiers=phone
//   node scripts/nalati-parity.mjs --engine-only                    # engine frames only (no mockup half)
//   node scripts/nalati-parity.mjs --url=http://127.0.0.1:5188 --query=foo=1 --settle=6
//
// One browser, closed at the end (the machine allows at most 3 game browsers — check `pgrep -fl chrome`).
// Needs the dev server (this worktree: http://127.0.0.1:5188). A load takes 60–120 s headless; each pose ~10 s.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve as resolvePath, join } from 'node:path';

const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-look');
const ART = resolvePath(ROOT, 'art/nalati-grasslands');

/**
 * The reference poses (look-pass.md). x / z in engine metres (+z north, −x east), yaw 0 = facing south (−z),
 * +π/2 = east, −π/2 = west, π = north; pitch radians (+ = up). `phone` overrides the yaw / pitch for the narrow
 * portrait frame (the mockups ARE portrait phone frames; the desktop frame is wider, so it may centre differently).
 * `time` sets the day clock (DayNight.ts phases or an hour).
 */
export const POSES = [
  // NE of the camp looking SSW: the rail + horses on the left, yurts ahead, the Kunes beyond, the escarpment, the range + planet
  { id: 'camp', mockup: 'round-1/1-art-style/style-B-painterly.png', what: 'the master frame: road, yurts, horses, spruce, river, peaks, planet',
    x: 72, z: 228, yaw: -0.62, pitch: -0.14, phone: { yaw: -0.62, pitch: -0.22 } },
  // on the plateau south of the rim, looking SSW across the grass to the snow range and the planet
  { id: 'plateau', mockup: 'round-2/1-combat/combat-C-bow-foot.png', what: 'grass carpet, flowers, wind',
    x: 40, z: -50, yaw: -0.3, pitch: -0.1 },
  // the horse plains, looking south over the herd to the range
  { id: 'horses', mockup: 'round-2/2-creatures/horses-1-wild-herd.png', what: 'open plateau, creatures, distance',
    x: 150, z: -62, yaw: -0.1, pitch: -0.06 },
  // the valley floor north of the Kunes, looking south up the waterfall ravine: river, gravel, spruce gullies, the rim
  { id: 'gully', mockup: 'round-1/5-concept-art/concept-3-river-gorge.png', what: 'trees, river, slope, rock',
    x: 64, z: 203, yaw: 0.05, pitch: 0.04 },
  // across the hitching rail from the tied horse, looking east over the camp edge to the sheep pasture (golden hour)
  { id: 'rail', mockup: 'round-2/2-creatures/taming-3-bonded.png', what: 'camp detail, props, close models',
    x: 80.5, z: 207, yaw: 1.35, pitch: -0.08, time: 'golden' },
  // the kurgan field at golden hour, the great kurgan ahead, the range behind
  { id: 'kurgan', mockup: 'round-2/4-named-elites/elite-2-kokbori-sky-wolf.png', what: 'stones, dusk light',
    x: -128, z: -62, yaw: 0.22, pitch: -0.02, time: 'golden' },
];

const TIERS = {
  desktop: { viewport: { width: 1600, height: 900 }, dpr: 1, query: 'tier=desktop' },
  phone: { viewport: { width: 390, height: 844 }, dpr: 1.5, query: 'tier=phone', touch: true },
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
const SETTLE = Number(flag('settle', '5')) * 1000;
const TIMEOUT = Number(flag('timeout', '240')) * 1000;
const ENGINE_ONLY = has('engine-only');
const wantPoses = flag('poses', POSES.map((p) => p.id).join(',')).split(',');
const wantTiers = flag('tiers', 'desktop,phone').split(',');
const poses = POSES.filter((p) => wantPoses.includes(p.id));
mkdirSync(OUT, { recursive: true });

// ── browser: headless Chromium on Metal, frame rate uncapped (frame ms = the real cost, not the vsync wait) ──
const udd = mkdtempSync(join(tmpdir(), 'nalati-parity-'));
const chrome = spawn(chromium.executablePath(), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--use-angle=metal', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit', 'about:blank',
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const first = poses[0];
    if (!first) break;
    const q = `chunk=nalati-grasslands&nolock=1&skipintro=1&weather=clear&clock=0&perf=0&${T.query}&x=${first.x}&z=${first.z}&yaw=${first.yaw}${EXTRA ? `&${EXTRA}` : ''}`;
    const t0 = Date.now();
    console.error(`[${tierName}] loading ${URL_BASE}/?${q}`);
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await ready(page);
    console.error(`[${tierName}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s${errors.length ? ` — page errors: ${errors.join(' | ')}` : ''}`);
    const queue = [...poses], tries = new Map();
    for (const p of queue) {
      const yaw = (tierName === 'phone' && p.phone?.yaw !== undefined) ? p.phone.yaw : p.yaw;
      const pitch = (tierName === 'phone' && p.phone?.pitch !== undefined) ? p.phone.pitch : p.pitch;
      await ready(page);
      await page.evaluate(({ x, z, yaw, pitch, time }) => {
        const w = window.__world, wx = window.__weather;
        window.__parityHour ??= wx.clock.hour; // the def's own sun (the clock starts there)
        w.player.spawn(x, z, yaw); w.player.pitch = pitch;
        wx.clock.set(time ?? window.__parityHour);
        wx.clock.paused = true;
      }, { x: p.x, z: p.z, yaw, pitch, time: p.time ?? null });
      await sleep(SETTLE); // streaming (grass ring, LODs), the look lerps, shadows settle
      const perf = await page.evaluate((pose) => new Promise((resolve, reject) => {
        if (!window.__world) { reject(new Error('reloaded')); return; }
        const g = window.__world.game;
        setTimeout(() => {
          const ms = Array.from(g.frameMs).filter((v) => v > 0).sort((a, b) => a - b);
          const q = (f) => ms[Math.min(ms.length - 1, Math.floor(ms.length * f))] ?? 0;
          resolve({ p50: q(0.5), p95: q(0.95), fps: g.stats.fps, calls: g.lastFrame.calls, tris: g.lastFrame.triangles });
        }, 2500);
      }), p.id).catch((e) => { console.error(`  ${p.id}: ${String(e).slice(0, 80)} — the page reloaded (HMR); re-run this pose`); return null; });
      if (!perf) { const n = (tries.get(p.id) ?? 0) + 1; tries.set(p.id, n); if (n < 3) queue.push(p); continue; }
      const shot = await page.screenshot({ type: 'png' });
      const name = `${TAG}-${p.id}-${tierName}.jpg`;
      const jpg = await composite(page, shot, ENGINE_ONLY ? null : resolvePath(ART, p.mockup), `${p.id} · ${tierName} · ${perf.p50.toFixed(1)} ms p50 / ${perf.p95.toFixed(1)} p95 · ${perf.calls} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
      writeFileSync(resolvePath(OUT, name), jpg);
      const row = { tag: TAG, pose: p.id, tier: tierName, x: p.x, z: p.z, yaw, pitch, time: p.time ?? null, ...perf, file: `progress/nalati-look/${name}`, kb: Math.round(jpg.length / 1024) };
      results.push(row);
      console.log(`${p.id.padEnd(8)} ${tierName.padEnd(7)} p50 ${perf.p50.toFixed(1).padStart(5)} ms · p95 ${perf.p95.toFixed(1).padStart(5)} ms · ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris → ${row.file} (${row.kb} KB)`);
    }
    if (errors.length) console.error(`[${tierName}] page errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close().catch(() => undefined);
  cleanup();
}
writeFileSync(resolvePath(OUT, `${TAG}-perf.json`), `${JSON.stringify(results, null, 2)}\n`);

/** engine PNG (+ mockup, scaled to the same height) → one JPEG ≤ 500 KB, composed in a blank page's canvas */
async function composite(page, enginePng, mockupPath, caption) {
  const eng = `data:image/png;base64,${enginePng.toString('base64')}`;
  const mock = mockupPath ? `data:image/png;base64,${readFileSync(mockupPath).toString('base64')}` : null;
  const p2 = await page.context().newPage();
  try {
    const b64 = await p2.evaluate(async ({ eng, mock, caption }) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const a = await load(eng); const b = mock ? await load(mock) : null;
      const H = Math.min(1100, a.height);
      const aw = Math.round(a.width * (H / a.height)), bw = b ? Math.round(b.width * (H / b.height)) : 0;
      const gap = b ? 8 : 0;
      const c = document.createElement('canvas'); c.width = aw + gap + bw; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#111'; g.fillRect(0, 0, c.width, H);
      g.imageSmoothingQuality = 'high';
      g.drawImage(a, 0, 0, aw, H);
      if (b) g.drawImage(b, aw + gap, 0, bw, H);
      g.font = '600 14px ui-monospace, monospace'; const tw = g.measureText(caption).width;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, H - 24, tw + 16, 24);
      g.fillStyle = '#9fe6ff'; g.fillText(caption, 8, H - 7);
      if (b) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(aw + gap, H - 24, 76, 24); g.fillStyle = '#ffd98a'; g.fillText('MOCKUP', aw + gap + 8, H - 7); }
      for (let q = 0.86; q >= 0.4; q -= 0.06) {
        const url = c.toDataURL('image/jpeg', q);
        if (url.length * 0.75 < 490 * 1024) return url.split(',')[1];
      }
      return c.toDataURL('image/jpeg', 0.35).split(',')[1];
    }, { eng, mock, caption });
    return Buffer.from(b64, 'base64');
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

function sleep(ms) { return new Promise((r) => { setTimeout(r, ms); }); }
