// lapse.mjs — one authoring time-lapse stage: one historical build at one SHA, filmed by a free camera along its slice
// of the lapse's camera path (PROGRESS-TRAILER §3.1, §3.3, row PT5; E468). No player view: the camera is posed after
// each frame's update, the viewmodel and every DOM element but the main canvas are hidden.
//
//   render a stage's slice (60 fps frames numbered on the lapse's own timeline, plus its sheet still):
//     scripts/browser-lane.sh --max 20 node scripts/progress-trailer/lapse.mjs render --lapse=scripts/progress-trailer/lapses/driftwood.mjs \
//       --stage=<sha prefix> --url=http://127.0.0.1:<port> --out=<scratch>/lapses [--dry] [--scale=1]
//   scout: stills of any build at given poses (no lapse file needed):
//     … lapse.mjs stills --url=… --out=<dir> --query='chunk=…' --poses='[{"cam":[x,y,z],"at":[x,y,z],"fov":50}, …]' [--spawn='[x,z,yaw]']
//   the contact sheet and the clip: lapse-cut.mjs (no browser).
//
// A lapse module (scripts/progress-trailer/lapses/<name>.mjs) exports `lapse` = { name, seconds, query, fov, spawn?,
//   path: [key, …], stages: [{ sha, t0, t1, query?, path? }], sheetT }:
//   - a key is { t, cam: [x, y, z], at: [x, y, z], fov? } or { t, orbit: { c: [x, y, z], r, h, az } } (az in degrees,
//     cam = c + (r sin az, h, r cos az), looking at c; orbit keys interpolate on the arc) or, last only,
//     { t, player: [x, z, yaw, pitch] }: the player's own first-person camera after `player.spawn(x, z, yaw)` — the path
//     eases into it and from its time on the game's camera is released (viewmodel back), so the stage's last frame is a
//     play take's frame 0 at the same SHA and pose;
//   - a stage films path time [t0, t1) of its own `path` (default the lapse's) at its SHA; `sheetT` is the path time all
//     stages are stilled at for the contact sheet;
//   - `spawn` [x, z, yaw] moves the player before the warm-up (the world streams around the player); default: the build's own.
// The page runs on Playwright's fake clock and the game's delta is pinned to 1/60 per frame by the era adapter take.mjs
// uses (legacy: window.__world, the THREE clock's getDelta; app: window.__wildshard.world, app.clock.setCapture); the
// runner asserts one camera-hook call per frame and refuses a path faster than §3.3 (≤ 3 m/s, ≤ 5°/s of view turn).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stageFacts } from './lapse-cut.mjs';

const HERE = import.meta.dirname;
const REPO = resolve(HERE, '../..');
const require = createRequire(join(REPO, 'package.json'));

const MODE = process.argv[2];
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FPS = 60, W = 1920, H = 1080;
const MAX_SPEED = 3, MAX_TURN = 5; // §3.3: m/s of camera travel, °/s of view-direction turn

const lerp = (a, b, u) => a + (b - a) * u;
const lerp3 = (a, b, u) => a.map((x, k) => lerp(x, b[k], u));
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const orbitPose = (o) => {
  const az = (o.az * Math.PI) / 180;
  return { cam: [o.c[0] + o.r * Math.sin(az), o.c[1] + o.h, o.c[2] + o.r * Math.cos(az)], at: o.c };
};

/** The pose at path time t: { cam, at, fov } or { release: true } once a player key's time is reached. */
export function poseAt(path, t, fov0, resolved) {
  const keys = path.map((k) => (k.player && resolved ? { ...k, ...resolved } : k));
  const last = keys.at(-1);
  if (last.player && t >= last.t - 1e-9) return { release: true };
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u0 = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const u = b.player ? ease(u0) : u0; // a crane eases into the take's pose
  const fov = lerp(a.fov ?? fov0, b.fov ?? fov0, u);
  if (a.orbit && b.orbit) {
    const o = { c: lerp3(a.orbit.c, b.orbit.c, u), r: lerp(a.orbit.r, b.orbit.r, u), h: lerp(a.orbit.h, b.orbit.h, u), az: lerp(a.orbit.az, b.orbit.az, u) };
    return { ...orbitPose(o), fov };
  }
  const pa = a.orbit ? orbitPose(a.orbit) : a, pb = b.orbit ? orbitPose(b.orbit) : b;
  return { cam: lerp3(pa.cam, pb.cam, u), at: lerp3(pa.at, pb.at, u), fov };
}

/** The path's worst camera speed (m/s) and view turn (°/s) over [t0, t1), sampled per frame. */
function pathRates(path, t0, t1, fov0, resolved) {
  let speed = 0, turn = 0, prev = null;
  for (let t = t0; t < t1 - 1e-9; t += 1 / FPS) {
    const p = poseAt(path, t, fov0, resolved);
    if (p.release) break;
    const d = p.at.map((x, k) => x - p.cam[k]), n = Math.hypot(...d), dir = d.map((x) => x / n);
    if (prev) {
      speed = Math.max(speed, Math.hypot(...p.cam.map((x, k) => x - prev.cam[k])) * FPS);
      const dot = Math.min(1, dir.reduce((s, x, k) => s + x * prev.dir[k], 0));
      turn = Math.max(turn, ((Math.acos(dot) * 180) / Math.PI) * FPS);
    }
    prev = { cam: p.cam, dir };
  }
  return { speed: Math.round(speed * 100) / 100, turn: Math.round(turn * 100) / 100 };
}

// ── the page side ─────────────────────────────────────────────────────────────────────────────────────────────────
// The era adapter and the free camera (from take.mjs and v1's install-world.js): the hook runs after the frame's update
// (game.onLate where it exists, else game.onUpdate), so the pose wins over the player camera; it counts frames.
const INSTALL = `(() => {
  const app = window.__wildshard?.world, w = app ?? window.__world, g = w.game, cam = g.camera;
  const era = app?.game?.app?.clock?.setCapture ? 'app' : 'legacy';
  window.__lapse = { frames: 0, pose: null, release: false, era };
  if (era === 'app') {
    g.app.clock.setCapture(60);
  } else if (g.clock?.getDelta) {
    let t = g.clock.elapsedTime ?? 0;
    g.clock.getDelta = () => { t += 1 / 60; g.clock.elapsedTime = t; return 1 / 60; };
  }
  if (window.__weather?.clock) window.__weather.clock.paused = true;
  const hook = typeof g.onLate === 'function' ? g.onLate.bind(g) : g.onUpdate.bind(g);
  // the game's own state of what we override, captured on the first posed frame and handed back on release (the
  // viewmodel's children as the game left them: forcing them all visible shows inactive gear)
  const own = { fov: cam.fov, far: cam.far, vis: new Map() };
  let posed = false;
  hook(() => {
    const L = window.__lapse; L.frames++;
    const v = L.pose;
    if (!v || L.release) {
      if (posed) {
        for (const [c, on] of own.vis) c.visible = on;
        cam.fov = own.fov; cam.far = own.far; cam.updateProjectionMatrix();
        posed = false;
      }
      return;
    }
    if (!posed) { own.fov = cam.fov; own.far = cam.far; own.vis = new Map(cam.children.map((c) => [c, c.visible])); }
    posed = true;
    cam.position.set(v.cam[0], v.cam[1], v.cam[2]); cam.lookAt(v.at[0], v.at[1], v.at[2]);
    if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.far = Math.max(cam.far, 6000); cam.updateProjectionMatrix(); }
    for (const c of cam.children) c.visible = false;
  });
  return { era, hook: typeof g.onLate === 'function' ? 'onLate' : 'onUpdate', spawn: w.player.position.toArray().map((x) => Math.round(x * 10) / 10) };
})()`;
const SPAWN = (s) => `(() => { const w = window.__wildshard?.world ?? window.__world; w.player.spawn(${s[0]}, ${s[1]}, ${s[2] ?? 0}); if (${s.length > 3}) w.player.pitch = ${s[3] ?? 0}; return w.player.position.toArray().map((x) => Math.round(x * 10) / 10); })()`;
// the player's own camera once released: where a play take's frame 0 sees from
const READ_CAM = `(() => {
  const w = window.__wildshard?.world ?? window.__world, cam = w.game.camera;
  cam.updateMatrixWorld(true);
  const p = cam.getWorldPosition(cam.position.clone()), d = cam.getWorldDirection(cam.position.clone());
  return { cam: p.toArray(), at: p.clone().addScaledVector(d, 10).toArray(), fov: cam.fov };
})()`;

async function openBuild(url) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(arg('scale', '1')) })).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  await page.clock.install();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('Boolean((window.__wildshard?.world ?? window.__world)?.game)', undefined, { timeout: 300000, polling: 1000 });
  return { browser, page, errors };
}

async function hideDom(page) {
  await page.evaluate(() => {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = c; }
    }
    if (best) best.dataset.main = '1';
  });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas[data-main] { visibility: visible !important; } html, body { background: #000 !important; }' });
}

/** one frame: pose (or release), step the fake clock until the hook has run once, screenshot */
async function shoot(page, pose, file, steps) {
  await page.evaluate(`window.__lapse.release = ${Boolean(pose.release)}; window.__lapse.pose = ${JSON.stringify(pose.release ? null : pose)}`);
  const before = await page.evaluate('window.__lapse.frames');
  let after = before;
  for (let k = 0; k < 40 && after === before; k++) { await page.clock.runFor(4); after = await page.evaluate('window.__lapse.frames'); }
  steps.push(after - before);
  if (file) await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

async function loadLapse() {
  const file = resolve(arg('lapse'));
  return { file, lapse: (await import(pathToFileURL(file).href)).lapse };
}

async function render() {
  const { file, lapse } = await loadLapse();
  const want = arg('stage');
  const stage = lapse.stages.find((s) => s.sha.startsWith(want)) ?? lapse.stages.find((s) => want.startsWith(s.sha));
  if (!stage) throw new Error(`no stage ${want} in ${file}`);
  const url = arg('url'), DRY = process.argv.includes('--dry');
  const served = (await (await fetch(`${url}/SHA`)).text()).trim();
  if (!served.startsWith(stage.sha)) throw new Error(`${url} serves ${served}, not ${stage.sha}`);
  const path = stage.path ?? lapse.path, fov0 = lapse.fov ?? 50;
  const facts = stageFacts(served);
  const dir = join(resolve(arg('out', 'lapses')), lapse.name, facts.short);
  mkdirSync(dir, { recursive: true });
  const receipt = { lapse: lapse.name, stage: facts, url: `${url}/?${stage.query ?? lapse.query}`, t0: stage.t0, t1: stage.t1, sheetT: lapse.sheetT, errors: [], steps: [] };
  const { browser, page, errors } = await openBuild(receipt.url);
  receipt.errors = errors;
  try {
    receipt.install = await page.evaluate(INSTALL);
    const spawn = stage.spawn ?? lapse.spawn;
    if (spawn) receipt.spawned = await page.evaluate(SPAWN(spawn));
    const playerKey = path.at(-1).player;
    let resolved = null;
    if (playerKey && stage.t1 > path.at(-1).t - 1e-9) {
      // the crane's end: the player's own camera at the take's spawn, read after it settles (and the world streams there)
      receipt.spawned = await page.evaluate(SPAWN(playerKey));
      await page.evaluate('window.__lapse.release = true');
      await page.waitForTimeout(6000);
      resolved = await page.evaluate(READ_CAM);
      receipt.playerCam = resolved;
    }
    receipt.rates = pathRates(path, stage.t0, stage.t1, fov0, resolved);
    const first = poseAt(path, stage.t0, fov0, resolved);
    await page.evaluate(`window.__lapse.release = ${Boolean(first.release)}; window.__lapse.pose = ${JSON.stringify(first.release ? null : first)}`);
    await page.waitForTimeout((lapse.warmSec ?? 14) * 1000); // stream the world in at the slice's first pose (real time)
    await hideDom(page);
    await page.clock.pauseAt(Date.now() + 1000);
    const f0 = Math.round(stage.t0 * FPS), f1 = Math.round(stage.t1 * FPS);
    for (let f = f0; f < f1; f++) {
      const keep = !DRY || f === f0 || f === f1 - 1 || (f - f0) % 30 === 0;
      await shoot(page, poseAt(path, f / FPS, fov0, resolved), keep ? join(dir, `${String(f).padStart(6, '0')}.jpg`) : null, receipt.steps);
    }
    // the contact sheet's still: every stage at the same pose of the lapse's main path
    if (lapse.sheetT !== undefined) {
      const pose = poseAt(lapse.path, lapse.sheetT, fov0, null);
      for (let k = 0; k < 20; k++) await shoot(page, pose, null, []); // let the move settle (temporal AA, LOD)
      await shoot(page, pose, join(dir, 'sheet.jpg'), []);
    }
  } finally {
    await browser.close();
  }
  const bad = receipt.steps.filter((d) => d !== 1).length;
  receipt.problems = [
    ...(bad ? [`${bad} frames did not run the camera hook exactly once`] : []),
    ...(errors.length > 0 ? [`${errors.length} page errors`] : []),
    ...(receipt.rates.speed > MAX_SPEED ? [`camera ${receipt.rates.speed} m/s > ${MAX_SPEED}`] : []),
    ...(receipt.rates.turn > MAX_TURN ? [`view turns ${receipt.rates.turn}°/s > ${MAX_TURN}`] : []),
  ];
  receipt.accepted = receipt.problems.length === 0;
  receipt.steps = { frames: receipt.steps.length, bad };
  writeFileSync(join(dir, 'receipt.json'), JSON.stringify(receipt, null, 1));
  console.info(`${receipt.accepted ? 'ACCEPTED' : 'REFUSED'} ${dir} ${JSON.stringify({ install: receipt.install, rates: receipt.rates, problems: receipt.problems, errors: errors.slice(0, 3) })}`);
}

async function stills() {
  const url = arg('url'), out = resolve(arg('out', 'stills')), poses = JSON.parse(arg('poses', '[]'));
  mkdirSync(out, { recursive: true });
  const served = (await (await fetch(`${url}/SHA`)).text()).trim();
  const { browser, page, errors } = await openBuild(`${url}/?${arg('query')}`);
  const info = { sha: served };
  try {
    info.install = await page.evaluate(INSTALL);
    if (arg('spawn')) info.spawned = await page.evaluate(SPAWN(JSON.parse(arg('spawn'))));
    await page.evaluate(`window.__lapse.pose = ${JSON.stringify({ fov: 50, ...poses[0] })}`);
    await page.waitForTimeout(Number(arg('warm', '14')) * 1000);
    await hideDom(page);
    await page.clock.pauseAt(Date.now() + 1000);
    for (const [i, p] of poses.entries()) {
      for (let k = 0; k < 20; k++) await shoot(page, { fov: 50, ...p }, null, []);
      await shoot(page, { fov: 50, ...p }, join(out, `${served.slice(0, 9)}-${i}.jpg`), []);
    }
  } finally {
    await browser.close();
  }
  console.info(JSON.stringify({ ...info, errors: errors.slice(0, 5) }));
}

const MODES = { render, stills };
if (!(MODE in MODES)) throw new Error(`lapse.mjs <${Object.keys(MODES).join(' | ')}> …`);
await MODES[MODE]();
