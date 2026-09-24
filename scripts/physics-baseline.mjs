#!/usr/bin/env node
// physics-baseline.mjs — the PHYSICS.md ruler: P0 records it before a line of Rapier, every later phase re-runs it.
//
// Builds the production bundle (or reuses dist/), serves it with `vite preview` on its own port and opens it in
// headless Chromium on the host GPU (Metal via ANGLE), phone tier (390×844, ?tier=phone). Two modes:
//
//   poses — the seven PLAY-PERF poses at 4× CPU: per frame, the JS ms of every game updater together, of
//           `player.update` and `animals.update` alone, of the composer render, the rAF interval, and the
//           composer frame's draw calls / triangles. Reported as p50 / p95 over --frames frames.
//   walk  — the fixed route per shard (scripts/physics-route.json): each leg teleports to its start, then an
//           in-page autopilot faces the next waypoint and holds W (Space at `jump` waypoints) until it is within
//           0.8 m, recording every frame's feet position, vertical speed and ground / platform / swim / slide flags.
//           A leg that makes < 0.3 m of progress in 2 s is logged as stuck at that waypoint and skipped on.
//           `--video` records a webm of each shard's walk.
//
// Writes progress/physics/<label>-<build>.json (everything) and prints a markdown table. `--compare a.json b.json`
// prints before / after for two result files.
//
//   node scripts/physics-baseline.mjs                         # build, poses + walk, label p0
//   node scripts/physics-baseline.mjs --no-build --mode=walk --video
//   node scripts/physics-baseline.mjs --label=p2 --mode=walk
//   node scripts/physics-baseline.mjs --compare progress/physics/p0-x.json progress/physics/p2-y.json
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';

const { chromium } = await import('playwright');

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT_DIR = resolvePath(ROOT, 'progress/physics');
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const has = (name) => argv.includes(`--${name}`);

const POSES = [
  { shard: 'pine-hollow', name: 'gate', q: 'x=0&z=-200&yaw=3.1416' },
  { shard: 'pine-hollow', name: 'cabin', q: 'x=-14&z=-62&yaw=3.1416' },
  { shard: 'pine-hollow', name: 'pond', q: 'x=-56&z=95&yaw=3.1416' },
  { shard: 'driftwood-isle', name: 'pier', q: '' },
  { shard: 'driftwood-isle', name: 'beach', q: 'x=-10&z=-150&yaw=4.3' },
  { shard: 'driftwood-isle', name: 'wreck', q: 'x=105&z=0&yaw=-1.5708' },
  { shard: 'driftwood-isle', name: 'shrine', q: 'x=-86&z=92&yaw=2.47' },
];

// ── compare ──
if (has('compare')) {
  const [a, b] = argv.filter((x) => x.endsWith('.json')).map((p) => JSON.parse(readFileSync(p, 'utf8')));
  if (!a || !b) { console.error('--compare a.json b.json'); process.exit(2); }
  console.log(`before ${a.label} ${a.build} → after ${b.label} ${b.build}\n`);
  console.log('| pose | update p50 ms | player p50 | animals p50 | render p50 | calls | tris M |\n|---|---|---|---|---|---|---|');
  for (const pa of a.poses ?? []) {
    const pb = (b.poses ?? []).find((p) => p.shard === pa.shard && p.name === pa.name);
    const c = (k, f = (v) => v) => `${f(pa[k])} → ${pb ? f(pb[k]) : 'n/a'}`;
    console.log(`| ${pa.shard} ${pa.name} | ${c('updateP50')} | ${c('playerP50')} | ${c('animalsP50')} | ${c('renderP50')} | ${c('calls')} | ${c('trisM')} |`);
  }
  console.log('\n| leg | end (x, y, z) | max y | stuck | time s |\n|---|---|---|---|---|');
  for (const la of a.walk ?? []) {
    const lb = (b.walk ?? []).find((l) => l.shard === la.shard && l.name === la.name);
    const e = (l) => l ? `${l.end.x}, ${l.end.y}, ${l.end.z}` : 'n/a';
    console.log(`| ${la.shard} ${la.name} | ${e(la)} → ${e(lb)} | ${la.maxY} → ${lb?.maxY ?? 'n/a'} | ${la.stuck.length} → ${lb?.stuck.length ?? 'n/a'} | ${la.seconds} → ${lb?.seconds ?? 'n/a'} |`);
  }
  process.exit(0);
}

const MODE = flag('mode', 'poses,walk').split(',');
const LABEL = flag('label', 'p0');
const CPU = Number(flag('cpu', '4'));
const WALK_CPU = Number(flag('walk-cpu', '1'));
const FRAMES = Number(flag('frames', '300'));
const PORT = Number(flag('port', '4176'));
const SETTLE_MS = Number(flag('settle', '4000'));
const TIMEOUT_MS = Number(flag('timeout', '240')) * 1000;
const ONLY = flag('shard', '');
const VIDEO = has('video');
// --trails: instead of the fixed route, walk every path of the shard (its TRAILS after the entry roads) end to end,
// both ways, a waypoint every 3 m — the stricter 0.35 m / 40° controller must not get stuck on a path players use
const TRAILS = has('trails');
const SERVE = resolvePath(flag('serve', ROOT)); // the checkout whose dist/ is served (a clean export of an older commit, for a same-session before / after)

const waitFor = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await new Promise((resolve) => { setTimeout(resolve, 250); }); } throw new Error(what); };

// ── build + preview ──
if (!has('no-build')) { console.error('> pnpm build'); execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' }); }
else if (!existsSync(resolvePath(SERVE, 'dist/index.html'))) { console.error('dist/ missing; drop --no-build'); process.exit(2); }
let listening = false, exited = null;
// vite itself, not `npx vite`: killing an npx wrapper leaves the server holding the port
const preview = spawn(process.execPath, [resolvePath(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: SERVE, stdio: ['ignore', 'pipe', 'pipe'] });
// oxlint-disable-next-line no-control-regex -- stripping vite's ANSI colours (it bolds the port number)
preview.stdout.on('data', (d) => { if (String(d).replaceAll(/\u001B\[[\d;]*m/g, '').includes(`:${PORT}/`)) listening = true; });
preview.stderr.on('data', (d) => { process.stderr.write(`[preview] ${d}`); });
preview.on('exit', (code) => { exited = code ?? 'signal'; });
const cleanup = () => { if (!preview.killed) preview.kill('SIGTERM'); };
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(130); });
await waitFor(() => { if (exited !== null) { console.error(`vite preview exited (${exited}) — is port ${PORT} taken? --port=<free>`); process.exit(2); } return listening; }, 20_000, 'vite preview did not come up');
const BASE = `http://localhost:${PORT}`;
let build = 'unknown';
try { build = (await (await fetch(`${BASE}/version.json`, { cache: 'no-store' })).json()).build ?? build; } catch { /* keep 'unknown' */ }
console.error(`> physics-baseline ${LABEL} build=${build} modes=${MODE.join(',')} cpu=${CPU}× (walk ${WALK_CPU}×)`);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const result = { label: LABEL, build, date: new Date().toISOString(), cpu: CPU, walkCpu: WALK_CPU, frames: FRAMES, poses: [], walk: [] };

async function openGame(shard, q, { cpu, video }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: join(OUT_DIR, '.video-tmp'), size: { width: 390, height: 844 } } } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${BASE}/?chunk=${shard}&tier=phone&skipintro=1&nolock=1&sw=0${q ? `&${q}` : ''}`, { waitUntil: 'commit', timeout: TIMEOUT_MS });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__world !== undefined, null, { timeout: TIMEOUT_MS, polling: 250 });
  await page.waitForTimeout(SETTLE_MS);
  return { ctx, page, errors };
}

// ── poses ──
if (MODE.includes('poses')) {
  for (const pose of POSES) {
    if (ONLY && pose.shard !== ONLY) continue;
    console.error(`> pose ${pose.shard} ${pose.name}`);
    const { ctx, page, errors } = await openGame(pose.shard, pose.q, { cpu: CPU, video: false });
    try {
      const r = await page.evaluate(async (frames) => {
        const w = window.__world, g = w.game;
        const cur = { update: 0, fixed: 0, player: 0, animals: 0, render: 0 };
        const wrap = (obj, key, bucket) => { const orig = obj[key]; obj[key] = function timed(...a) { const t = performance.now(); try { return orig.apply(this, a); } finally { cur[bucket] += performance.now() - t; } }; };
        wrap(w.player, 'update', 'player'); wrap(w.animals, 'update', 'animals'); wrap(g.composer, 'render', 'render');
        const ups = g.updaters;
        for (let i = 0; i < ups.length; i++) { const f = ups[i]; ups[i] = (dt, t) => { const s = performance.now(); f(dt, t); cur.update += performance.now() - s; }; }
        // P2+: the frame phases (Game.onInput / onFixed) — the player's move and the physics step run there, not in `updaters`
        const timeAll = (list, bucket) => { for (let i = 0; i < list.length; i++) { const f = list[i]; list[i] = (dt) => { const s = performance.now(); f(dt); cur[bucket] += performance.now() - s; }; } };
        if (g.fixed) { timeAll(g.fixed.pre, 'fixed'); timeAll(g.fixed.step, 'fixed'); timeAll(g.fixed.post, 'fixed'); }
        if (g.inputs) timeAll(g.inputs, 'fixed');
        if (w.player.step) wrap(w.player, 'step', 'player');
        const rows = [];
        let last = performance.now();
        for (let n = 0; n < frames; n++) {
          await new Promise((resolve) => { requestAnimationFrame(() => { resolve(undefined); }); });
          const now = performance.now();
          rows.push({ ...cur, js: cur.update + cur.fixed, frame: now - last, calls: g.lastFrame.calls, tris: g.lastFrame.triangles });
          last = now; cur.update = 0; cur.fixed = 0; cur.player = 0; cur.animals = 0; cur.render = 0;
        }
        return { rows, animals: w.animals.animals.length, pos: { x: w.player.position.x, y: w.player.position.y, z: w.player.position.z } };
      }, FRAMES);
      const pct = (k, p) => { const v = r.rows.map((x) => x[k]).sort((a, b) => a - b); return Math.round(v[Math.min(v.length - 1, Math.floor(v.length * p))] * 100) / 100; };
      result.poses.push({
        shard: pose.shard, name: pose.name, animals: r.animals,
        updateP50: pct('js', 0.5), updateP95: pct('js', 0.95), fixedP50: pct('fixed', 0.5), fixedP95: pct('fixed', 0.95), playerP50: pct('player', 0.5), playerP95: pct('player', 0.95),
        animalsP50: pct('animals', 0.5), animalsP95: pct('animals', 0.95), renderP50: pct('render', 0.5), renderP95: pct('render', 0.95),
        frameP50: pct('frame', 0.5), frameP95: pct('frame', 0.95), calls: pct('calls', 0.5), trisM: Math.round(pct('tris', 0.5) / 1e4) / 100, errors,
      });
    } finally { await ctx.close(); }
  }
}

// ── walk ──
if (MODE.includes('walk')) {
  const route = JSON.parse(readFileSync(resolvePath(ROOT, 'scripts/physics-route.json'), 'utf8'));
  for (const [shard, legs] of Object.entries(route)) {
    if (shard.startsWith('$') || (ONLY && shard !== ONLY)) continue;
    const first = legs[0];
    const { ctx, page, errors } = await openGame(shard, `x=${first.start.x}&z=${first.start.z}&yaw=${first.start.yaw}`, { cpu: WALK_CPU, video: VIDEO });
    if (TRAILS) {
      const paths = (await page.evaluate(() => window.__hf.TRAILS)).slice(4);
      legs.length = 0;
      paths.forEach((path, i) => {
        for (const dir of ['fwd', 'back']) {
          const pts = dir === 'fwd' ? path : [...path].reverse();
          const wps = [];
          for (let k = 1; k < pts.length; k++) {
            const [ax, az] = pts[k - 1], [bx, bz] = pts[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
            for (let j = 1; j <= n; j++) wps.push({ x: ax + (bx - ax) * j / n, z: az + (bz - az) * j / n });
          }
          const [sx, sz] = pts[0];
          legs.push({ name: `path${i}-${dir}`, start: { x: sx, z: sz, yaw: Math.atan2(-(wps[0].x - sx), -(wps[0].z - sz)) }, waypoints: wps, timeout: 240 });
        }
      });
    }
    console.error(`> walk ${shard} (${legs.length} legs)`);
    try {
      for (const leg of legs) {
        const r = await page.evaluate(async (legIn) => {
          const w = window.__world, p = w.player;
          p.keys.clear();
          p.velocity.set(0, 0, 0);
          p.spawn(legIn.start.x, legIn.start.z, legIn.start.yaw);
          if (typeof legIn.start.y === 'number') p.position.y = legIn.start.y; // spawn() puts the feet on the terrain; a deck start needs its floor
          p.pitch = -0.12;
          if (w.animals.__frozen !== true) { w.animals.update = () => undefined; w.animals.__frozen = true; } // no creature in the way of the route (they are the poses' job)
          await new Promise((resolve) => { setTimeout(resolve, 600); }); // land, settle the camera
          const trace = [], stuck = [];
          let wi = 0, t = 0, jumpT = 0, lastProg = { t: 0, d: Infinity };
          const t0 = performance.now();
          await new Promise((resolve) => {
            w.game.onUpdate((dt) => {
              if (wi >= legIn.waypoints.length || t > (legIn.timeout ?? 60)) { if (wi !== -1) { p.keys.clear(); wi = -1; resolve(undefined); } return; }
              if (wi < 0) return;
              t += dt;
              const wp = legIn.waypoints[wi];
              const dx = wp.x - p.position.x, dz = wp.z - p.position.z, d = Math.hypot(dx, dz);
              trace.push([Math.round(t * 1000) / 1000, Number(p.position.x.toFixed(3)), Number(p.position.y.toFixed(3)), Number(p.position.z.toFixed(3)), Number(p.velocity.y.toFixed(2)), p.onGround ? 1 : 0, p.onPlatform ? 1 : 0, p.swimming ? 1 : 0, p.sliding ? 1 : 0, wi]);
              if (d < 0.8) { wi++; lastProg = { t, d: Infinity }; p.keys.delete('Space'); return; }
              if (d < lastProg.d - 0.3) lastProg = { t, d };
              else if (t - lastProg.t > 2) { // no progress for 2 s: log it and skip on to the next waypoint
                stuck.push({ wp: wi, x: Number(p.position.x.toFixed(2)), y: Number(p.position.y.toFixed(2)), z: Number(p.position.z.toFixed(2)) });
                p.spawn(wp.x, wp.z, p.yaw); wi++; lastProg = { t, d: Infinity }; return;
              }
              p.yaw = Math.atan2(-dx, -dz);
              p.keys.add('KeyW');
              if (wp.jump === true && d < 1.6 && jumpT === 0) { p.keys.add('Space'); jumpT = 1; }
              else if (jumpT > 0 && jumpT++ > 3) { p.keys.delete('Space'); }
              if (wp.jump !== true) jumpT = 0;
            });
          });
          return { trace, stuck, wall: Math.round(performance.now() - t0) };
        }, leg);
        const ys = r.trace.map((s) => s[2]);
        const last = r.trace.at(-1) ?? [0, Number.NaN, Number.NaN, Number.NaN];
        const speeds = [];
        for (let i = 1; i < r.trace.length; i++) { const a = r.trace[i - 1], b = r.trace[i], dt = b[0] - a[0]; if (dt > 0 && b[5] === 1) speeds.push(Math.hypot(b[1] - a[1], b[3] - a[3]) / dt); }
        speeds.sort((a, b) => a - b);
        const summary = {
          shard, name: leg.name, frames: r.trace.length, seconds: Math.round((last[0] ?? 0) * 10) / 10,
          end: { x: last[1], y: last[2], z: last[3] }, expectY: leg.expect?.y ?? null, maxY: Math.round(Math.max(...ys) * 100) / 100,
          groundSpeedP50: Math.round((speeds[Math.floor(speeds.length / 2)] ?? 0) * 100) / 100,
          airFrames: r.trace.filter((s) => s[5] === 0).length, swimFrames: r.trace.filter((s) => s[7] === 1).length, slideFrames: r.trace.filter((s) => s[8] === 1).length,
          stuck: r.stuck, trace: r.trace,
        };
        result.walk.push(summary);
        console.error(`  ${leg.name}: ${summary.seconds}s end y ${summary.end.y} (expect ${summary.expectY ?? '?'}) stuck ${summary.stuck.length}`);
      }
      result.walkErrors = [...(result.walkErrors ?? []), ...errors.map((e) => `${shard}: ${e}`)];
    } finally {
      const video = page.video();
      await ctx.close();
      if (video) {
        const src = await video.path();
        const dst = join(OUT_DIR, `${LABEL}-walk-${shard}.mp4`);
        // the raw webm is ~10 MB a shard: re-encode small (half size, h264) so the clips can live in git
        try { execSync(`ffmpeg -y -loglevel error -i "${src}" -vf scale=196:-2 -c:v libx264 -crf 34 -preset slow -pix_fmt yuv420p -an "${dst}"`); rmSync(src); }
        catch { renameSync(src, dst.replace(/\.mp4$/, '.webm')); }
        console.error(`  video ${dst}`);
      }
    }
  }
  const tmp = join(OUT_DIR, '.video-tmp');
  if (existsSync(tmp) && readdirSync(tmp).length === 0) rmSync(tmp, { recursive: true });
}

await browser.close();
mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `${LABEL}-${build}.json`);
// a poses run and a walk run of the same build share one file: keep what this run didn't measure
if (existsSync(file)) {
  const prev = JSON.parse(readFileSync(file, 'utf8'));
  if (result.poses.length === 0) result.poses = prev.poses ?? [];
  if (result.walk.length === 0) result.walk = prev.walk ?? [];
}
writeFileSync(file, `${JSON.stringify(result)}\n`);

console.log(`\n### ${LABEL} — build ${build}, phone tier 390×844, ${CPU}× CPU (walk ${WALK_CPU}×), ${FRAMES} frames per pose\n`);
if (result.poses.length > 0) {
  console.log('| pose | animals | frame JS ms p50 / p95 | of it: input + fixed steps | player | animals.update | render | rAF ms p50 / p95 | calls | tris M |\n|---|---|---|---|---|---|---|---|---|---|');
  for (const p of result.poses) console.log(`| ${p.shard} ${p.name} | ${p.animals} | ${p.updateP50} / ${p.updateP95} | ${p.fixedP50 ?? 0} / ${p.fixedP95 ?? 0} | ${p.playerP50} / ${p.playerP95} | ${p.animalsP50} / ${p.animalsP95} | ${p.renderP50} / ${p.renderP95} | ${p.frameP50} / ${p.frameP95} | ${p.calls} | ${p.trisM} |`);
}
if (result.walk.length > 0) {
  console.log('\n| leg | s | end (x, y, z) | expect y | max y | ground speed p50 m/s | air / swim / slide frames | stuck |\n|---|---|---|---|---|---|---|---|');
  for (const l of result.walk) console.log(`| ${l.shard} ${l.name} | ${l.seconds} | ${l.end.x}, ${l.end.y}, ${l.end.z} | ${l.expectY ?? '—'} | ${l.maxY} | ${l.groundSpeedP50} | ${l.airFrames} / ${l.swimFrames} / ${l.slideFrames} | ${l.stuck.length > 0 ? l.stuck.map((s) => `wp${s.wp}@${s.x},${s.y},${s.z}`).join(' ') : '—'} |`);
}
console.log(`\n→ ${file}`);
cleanup();
process.exit(0); // the preview child would keep the event loop alive
