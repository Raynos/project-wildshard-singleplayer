#!/usr/bin/env node
// shard-progress.mjs — one progress capture of a shard (E387, Jake 2026-10-02: "progress photos and progress videos and
// time lapse videos of shard five and shard six being built … we definitely should").
//
// Shoots the shard's fixed progress cameras (`art/<slug>/progress/cameras.json`) on a served build, iPhone portrait
// (390×844 @3, phone tier, touch HUD), and records one short real-resolution clip (canvas.captureStream, the memory note
// "game video capture"): a slow orbit around the clip's centre. Every run writes the same frames, so
// `scripts/shard-timelapse.py <slug>` can line them up into time-lapses.
//
//   scripts/serve-build.sh --name prog          # → http://127.0.0.1:<port>/ (or serve an export of an older SHA)
//   scripts/browser-lane.sh --max 20 node scripts/shard-progress.mjs --shard=sunscar-dunes --url=http://127.0.0.1:<port> \
//     --sha=<sha the build is> [--label="loop 3"] [--no-clip]
//
// Output: progress/<slug>/<YYYYMMDD-HHMM>-<sha8>/<shot>.jpg (780×1688, ≤ ~300 KB), clip.mp4 (540 px wide), meta.json.
// The stamp is the commit's date (git), so a back-filled old SHA sorts where it belongs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveFixture } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SLUG = flag('shard', '');
const URL_BASE = flag('url', '');
if (!SLUG || !URL_BASE) { console.error('usage: shard-progress.mjs --shard=<slug> --url=<served build> --sha=<sha> [--label=…] [--no-clip]'); process.exit(2); }
const SHA = execFileSync('git', ['rev-parse', flag('sha', 'HEAD')], { cwd: ROOT, encoding: 'utf8' }).trim();
const LABEL = flag('label', '');
const CLIP = !argv.includes('--no-clip');
/** --cameras=<file>: another cameras file (a test of the harness); default the shard's committed one */
const CAMS = JSON.parse(readFileSync(flag('cameras', join(ROOT, 'art', SLUG, 'progress', 'cameras.json')), 'utf8'));
const when = execFileSync('git', ['show', '-s', '--format=%cd', '--date=format:%Y%m%d-%H%M', SHA], { cwd: ROOT, encoding: 'utf8' }).trim();
/** --root=<dir>: write the capture there instead of the repo's progress/ (a scratch comparison, E397) */
const OUT = join(flag('root', join(ROOT, 'progress')), SLUG, `${when}-${SHA.slice(0, 8)}`);
mkdirSync(OUT, { recursive: true });
const TMP = join(tmpdir(), `shard-progress-${SLUG}-${SHA.slice(0, 8)}`);
mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const D = Math.PI / 180;

/** a full-res PNG → a 780 px wide JPEG in the progress folder */
const store = (png, name) => {
  const src = join(TMP, `${name}.png`); writeFileSync(src, png);
  execFileSync('sips', ['-Z', '1688', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', src, '--out', join(OUT, `${name}.jpg`)], { stdio: 'ignore' });
};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [], shots = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true }); // experimental shards enter only in developer mode
  // the probe's `pose` control needs the harness object (as the parity runner installs it)
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 0x2545f491, capture: null, lane: 'local', sha: '', browser: 'chromium', errors: [], saves: { read: [], written: [] }, audioRequests: [], gpuBytes: () => ({ textures: 0, renderbuffers: 0, buffers: 0, total: 0 }) }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const t0 = Date.now();
  await page.goto(`${URL_BASE}/?chunk=${SLUG}&tier=phone&touch=1&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player && window.__wildshard?.world?.game) && document.querySelector('.ws-load') === null,
    undefined, { timeout: 480000, polling: 1000 });
  const loadS = Math.round((Date.now() - t0) / 1000);
  await sleep(6000);
  store(await page.screenshot({ type: 'png' }), 'first-frame'); shots.push('first-frame');
  // a free camera posed last in the frame (after the player's), the viewmodel hidden; null = the player's own view
  await page.evaluate(() => {
    const w = window.__wildshard.world, cam = w.game.camera;
    try { w.animals.calm = true; } catch { /* a shard without animals */ }
    window.__prog = null;
    // what a free-camera shot changed, put back when the player's view returns (sky-reach, E399: after an aerial the
    // viewmodel stayed hidden and the fov stayed 72 for every later first-person shot)
    const hidden = new Set(); let fov = null;
    w.game.onLate(() => {
      const v = window.__prog;
      if (!v) {
        if (hidden.size > 0) { for (const c of hidden) c.visible = true; hidden.clear(); }
        if (fov !== null) { cam.fov = fov; cam.updateProjectionMatrix(); fov = null; }
        return;
      }
      if (fov === null) fov = cam.fov;
      cam.position.set(v.pos[0], v.pos[1], v.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[1], v.look[2]);
      if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
      for (const c of cam.children) if (c.visible) { c.visible = false; hidden.add(c); }
      cam.updateMatrixWorld(true);
    });
  });
  const hud = (on) => page.evaluate((v) => { const h = document.getElementById('hud'); if (h) h.style.visibility = v ? '' : 'hidden'; }, on);
  const staged = {};
  for (const s of CAMS.shots) {
    // creatures are calmed so they don't fill the frame; a shot whose subject IS a creature in action (a boss's stalk)
    // sets `"calm": false`, since calm cancels the behaviour (mockup council round 1, seat A)
    await page.evaluate((calm) => { try { window.__wildshard.world.animals.calm = calm; } catch { /* no animals */ } }, s.calm !== false);
    // E399: a shot may stage real quest state first (`stage`), through the shard's exposed handle (`expose` at the top of
    // cameras.json): e.g. the waymarks lit, the state a player reaches. Recorded in meta.json for the council to check.
    if (s.stage !== undefined) {
      const ok = await page.evaluate(([name, stage]) => {
        const h = window.__wildshard.shard?.[name];
        if (typeof h?.stage !== 'function') return false;
        h.stage(stage); return true;
      }, [CAMS.expose, s.stage]);
      if (!ok) errors.push(`shot ${s.id}: no stage() on __wildshard.shard.${String(CAMS.expose)}`);
      staged[s.id] = s.stage;
    }
    if (s.god) {
      await page.evaluate((g) => { window.__prog = g; }, { fov: 72, ...s.god }); await hud(false);
    } else {
      await page.evaluate((p) => { window.__prog = null; const pl = window.__wildshard.world.player; try { pl.health = pl.maxHealth ?? 100; } catch { /* */ } window.__wildshard.pose(p); },
        { x: s.x, z: s.z, yaw: s.yaw * D, pitch: (s.pitch ?? -4) * D, ...(s.y === undefined ? {} : { y: s.y }) });
      await hud(true);
    }
    await sleep(s.settle ?? 3000);
    if (!s.god) { // a pose with no floor under it falls and respawns: flag it rather than store a wrong frame silently
      const at = await page.evaluate(() => { const q = window.__wildshard.world.player.position; return [q.x, q.z]; });
      if (Math.hypot(at[0] - s.x, at[1] - s.z) > 4) errors.push(`shot ${s.id}: the player is at (${at.map((v) => v.toFixed(1)).join(', ')}), not (${s.x}, ${s.z}): no floor there?`);
    }
    store(await page.screenshot({ type: 'png' }), s.id); shots.push(s.id);
  }
  // the clip: a slow orbit, recorded from the canvas at its real resolution
  if (CLIP && CAMS.clip) {
    await hud(false);
    const b64 = await page.evaluate(async (c) => {
      const canvas = document.querySelector('canvas'); if (!canvas) throw new Error('no canvas');
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8_000_000 });
      const parts = []; rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
      const start = performance.now();
      const step = () => {
        const t = (performance.now() - start) / 1000 / c.secs, a = c.startDeg * Math.PI / 180 + t * c.sweepDeg * Math.PI / 180;
        window.__prog = { pos: [c.center[0] + Math.sin(a) * c.radius, c.center[1] + c.height, c.center[2] + Math.cos(a) * c.radius], look: c.center, fov: c.fov ?? 60 };
        if (t < 1) requestAnimationFrame(step);
      };
      rec.start(250); step();
      await new Promise((resolve) => { setTimeout(resolve, c.secs * 1000); });
      rec.stop(); await new Promise((resolve) => { rec.onstop = resolve; });
      const buf = new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCodePoint(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, CAMS.clip);
    const webm = join(TMP, 'clip.webm'); writeFileSync(webm, Buffer.from(b64, 'base64'));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', webm, '-vf', 'scale=540:-2,format=yuv420p', '-c:v', 'libx264', '-b:v', '900k', '-maxrate', '1200k', '-bufsize', '2400k', '-r', '30', '-movflags', '+faststart', join(OUT, 'clip.mp4')]);
  }
  // the compiled programs after every view was drawn (E397: a program-key collision shows up as a lower count)
  const programs = await page.evaluate(() => window.__wildshard.world.game.renderer?.info?.programs?.length ?? null).catch(() => null);
  writeFileSync(join(OUT, 'meta.json'), `${JSON.stringify({ shard: SLUG, sha: SHA, when, label: LABEL, loadSeconds: loadS, shots, clip: CLIP && Boolean(CAMS.clip), programs, staged, active: CAMS.shots.filter((x) => x.calm === false).map((x) => x.id), cameras: execFileSync('git', ['hash-object', flag('cameras', join(ROOT, 'art', SLUG, 'progress', 'cameras.json'))], { encoding: 'utf8' }).trim(), pageErrors: errors }, null, 1)}\n`);
  console.log(`progress: ${OUT.slice(ROOT.length + 1)} · ${shots.length} shots${CLIP && CAMS.clip ? ' + clip' : ''} · load ${loadS} s${errors.length > 0 ? ` · ${errors.length} page errors` : ''}`);
} finally {
  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}
