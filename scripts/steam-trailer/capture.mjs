// E168 Steam trailer — deterministic in-engine capture.
//
//   node scripts/steam-trailer/capture.mjs <outDir> [--shots driftwood,nalati,pine] [--only a,b] [--sub 2] [--scale 2]
//        [--base http://localhost:5173/] [--frames N] [--dry] [--portrait]
//
// What makes it a trailer capture rather than a screen recording:
//   * the game's clock is replaced by a fixed step and the frame loop is gated, so exactly one frame is simulated and drawn
//     per capture — smooth 60 fps however slow the GPU is;
//   * it renders at `scale` × 1920×1080 (Settings ▸ Render scale "native" + deviceScaleFactor), downsampled later with
//     Lanczos: supersampled anti-aliasing on every edge, foliage and thin rope;
//   * each output frame is `sub` sub-frames 1/(60·sub) s apart; edit.mjs averages them (tmix) = a real shutter's motion
//     blur, not a post blur;
//   * cinematic shots drive the camera on a spline rig (dolly / crane / orbit / push-in, eased, with fov and roll keys)
//     from a late system that runs after the player's own camera update; gameplay shots drive the player's inputs;
//   * the HUD, debug chips and error chips are hidden, the viewmodel is hidden on rig shots (unless the rig says
//     `viewmodel: true`);
//   * --portrait (E169 F3, the phone cut): a 1080×1920 frame, each shot's own `portrait: { … }` merged over it (its rig,
//     setup, ticks: a portrait frame is re-posed, not cropped).
// Frames land in <outDir>/<shot>/<nnnnnn>.jpg at 60·sub fps; <outDir>/<shot>/meta.json records the pose track and events.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const OUT = argv[0];
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i === -1 ? d : argv[i + 1]; };
const flag = (k) => argv.includes(`--${k}`);
const FPS = 60;
const SUB = Number(opt('sub', '2'));
const SCALE = Number(opt('scale', '2'));
const BASE = opt('base', 'http://localhost:5190/'); // a `vite preview` of a clean export of HEAD: the dev server's HMR reloads every open page when anyone edits src/
const SETS = opt('shots', 'driftwood,nalati,pine').split(',');
const ONLY = opt('only', '') ? opt('only', '').split(',') : [];
const MAXF = Number(opt('frames', '0'));
const DRY = flag('dry'); // one still per shot (first, middle, last frame): the shot-list review pass
const PORTRAIT = flag('portrait');
const VIEW = PORTRAIT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
// --edl <edl.json>: write only the frames the cut uses (+ 0.25 s handles); the sim still runs every frame from 0
const EDL = opt('edl', '') ? JSON.parse((await import('node:fs')).readFileSync(opt('edl', ''), 'utf8')) : null;
const keep = (name, i) => !EDL || EDL.clips.some((c) => c.shot === name && i >= Math.floor((c.in - 0.25) * FPS) && i < Math.ceil((c.in + c.dur + 0.25) * FPS));

const shots = [];
for (const s of SETS) shots.push(...(await import(`./shots/${s}.mjs`)).shots.map((x) => (PORTRAIT && x.portrait ? { ...x, ...x.portrait } : x)));

// ── in-page runtime ─────────────────────────────────────────────────────────────────────────────────────────────
// Installed once per page. window.__tr.rig = { keys: [{ t, p:[x,y,z], l:[x,y,z], fov, roll }], ease } drives the camera.
const RUNTIME = String.raw`(() => {
  const w = window.__world, g = w.game, cam = g.camera;
  const tr = window.__tr = { go: 0, t: 0, rig: null, dt: 1 / 60, lastPose: null, armed: false, vt: 0 };
  // The clock advances only on a frame the gate let through (the loop also reads getDelta on skipped frames — the old
  // capture's elapsedTime drift), and performance.now / Date.now follow the same virtual time, so the code that reads the
  // wall clock (animal reactions, the gallop bob) runs at sim speed. A tiny per-call creep keeps any time-budget loop finite.
  g.frameGate = () => { if (tr.go > 0) { tr.go--; tr.armed = true; return true; } return false; };
  g.clock.getDelta = () => { if (!tr.armed) return 0; tr.armed = false; g.clock.elapsedTime += tr.dt; tr.vt += tr.dt; return tr.dt; };
  const pn0 = performance.now(), dn0 = Date.now(); let creep = 0;
  performance.now = () => pn0 + tr.vt * 1000 + (creep += 0.0002);
  Date.now = () => Math.round(dn0 + tr.vt * 1000);
  // centripetal-ish Catmull-Rom on a key array, time-parametrised with a smoothstep per span edge
  const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
  const easeIO = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const sample = (keys, t, field) => {
    if (t <= keys[0].t) return keys[0][field];
    const n = keys.length; if (t >= keys[n - 1].t) return keys[n - 1][field];
    let i = 0; while (i < n - 2 && t > keys[i + 1].t) i++;
    const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)];
    let u = (t - b.t) / (c.t - b.t);
    const val = (k) => k[field];
    if (typeof val(b) === 'number') return cr(val(a) ?? val(b), val(b), val(c), val(d) ?? val(c), u);
    return [0, 1, 2].map((j) => cr(val(a)[j], val(b)[j], val(c)[j], val(d)[j], u));
  };
  tr.pose = (t) => {
    const r = tr.rig; if (!r) return;
    const T = r.ease ? r.keys[0].t + easeIO((t - r.keys[0].t) / (r.keys.at(-1).t - r.keys[0].t)) * (r.keys.at(-1).t - r.keys[0].t) : t;
    const p = sample(r.keys, T, 'p'), l = sample(r.keys, T, 'l');
    const fov = r.keys[0].fov !== undefined ? sample(r.keys, T, 'fov') : cam.fov;
    const roll = r.keys[0].roll !== undefined ? sample(r.keys, T, 'roll') : 0;
    // a hand-held breath: two slow incommensurate sines, a few cm and a fraction of a degree
    const hh = r.handheld ?? 0.25;
    p[0] += Math.sin(t * 0.73) * 0.03 * hh; p[1] += Math.sin(t * 1.11 + 1) * 0.025 * hh; p[2] += Math.sin(t * 0.57 + 2) * 0.03 * hh;
    cam.position.set(p[0], p[1], p[2]);
    cam.up.set(0, 1, 0); cam.lookAt(l[0], l[1], l[2]);
    cam.rotateZ(roll + Math.sin(t * 0.41) * 0.0025 * hh);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // keep the world streaming around the camera: the player stands under it
    // (on the ground, not at its old height: a player left inside the terrain or under the sea reads as submerged — the
    // underwater grade and fog came on over dry land in the first scout)
    if (r.carryPlayer !== false) { const pl = w.player; pl.position.set(p[0], tr.ground(p[0], p[2]) + 0.05, p[2]); if (pl.velocity) pl.velocity.set(0, 0, 0); }
    if (!r.viewmodel) for (const c of cam.children) c.visible = false; // the viewmodel and the swim hands (Hands.update re-shows them while "swimming" under the rig)
    tr.lastPose = { p, l, fov, roll };
  };
  // rel: key heights are metres above the ground (or the water, whichever is higher) at that key; relLook likewise
  tr.ground = (x, z) => { const h = window.__hf?.heightAt(x, z) ?? 0, sea = w.chunk?.ocean?.level ?? w.ocean?.level; return typeof sea === 'number' ? Math.max(h, sea) : h; };
  tr.setRig = (rig) => {
    if (!rig) { tr.rig = null; return; }
    const keys = rig.keys.map((k) => ({ ...k,
      p: rig.rel ? [k.p[0], k.p[1] + tr.ground(k.p[0], k.p[2]), k.p[2]] : k.p,
      l: rig.relLook ? [k.l[0], k.l[1] + tr.ground(k.l[0], k.l[2]), k.l[2]] : k.l }));
    tr.rig = { ...rig, keys };
  };
  // tr.hide = ['object name', …]: kept invisible every frame (their owners re-show them in update, this runs after)
  tr.hide = []; let hidden = [], hiddenKey = '';
  g.onLate(() => {
    if (tr.rig) tr.pose(tr.t);
    const key = tr.hide.join('|');
    if (key !== hiddenKey) { hiddenKey = key; hidden = tr.hide.flatMap((n) => g.scene.getObjectsByProperty('name', n)); }
    for (const o of hidden) o.visible = false;
  }, 'trailer-rig');
  // the chunk boundary (Boundary.ts: the staging server's 1 px cyan edge lines, corner beams and road gates) is a play-space
  // cue, not scenery: it reads as a hairline scratch across a cinematic frame
  if (w.boundary?.group) w.boundary.group.visible = false;
  tr.step = () => new Promise((res) => { tr.go = 1; requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res))); });
  const css = document.createElement('style');
  css.textContent = '#hud, .ws-perf, .ws-debug, .ws-update, #wserr, #wserr-chip, .ws-toast, .ws-toasts, .ws-chip, .ws-game-lock, .ws-game-lockcand, .ws-game-lockedge, .ws-game-speed, .ws-game-smear, .ws-combat-hurt { display: none !important; }';
  document.head.appendChild(css);
  tr.showHud = (on) => { css.disabled = !!on; };
  return 'ok';
})()`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--headless=new', '--mute-audio', '--enable-gpu-rasterization'],
});
const report = [];
const want = shots.filter((s) => (ONLY.length === 0 || ONLY.includes(s.name)) && (!EDL || EDL.clips.some((c) => c.shot === s.name)));
// shots with the same url + init share one page load (a boot is 1–2 min); each shot re-runs its setup and warm-up
const groups = [];
for (const s of want) {
  const key = `${s.url}|${s.init ?? ''}`;
  const g = groups.find((x) => x.key === key);
  if (g) g.shots.push(s); else groups.push({ key, shots: [s] });
}
const have = (s) => {
  const dir = `${OUT}/${s.name}`;
  return !DRY && existsSync(`${dir}/meta.json`) && JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8')).done === true;
};
for (const grp of groups) {
  const todo = grp.shots.filter((s) => { if (have(s)) { console.log(`[${s.name}] have it`); return false; } return true; });
  if (todo.length === 0) continue;
  const first = todo[0];
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ws.gfx.v1', JSON.stringify({ dpr: 'native', aa: 'on' })); } catch { /* storage off */ }
  });
  if (first.init) await ctx.addInitScript(first.init);
  const page = await ctx.newPage();
  let errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.log(`[${first.name}…] pageerror`, e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log(`[nav] ${f.url()}`); });
  const url = `${BASE}?skipintro=1&nolock=1&mute=1&perf=0&sw=0&tier=desktop&${first.url}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__world?.game), null, { timeout: 300000 });
  await page.evaluate(RUNTIME);
  console.log(`[group ${first.url}] booted in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const s of todo) {
    errors = [];
    const dir = `${OUT}/${s.name}`;
    mkdirSync(dir, { recursive: true });
    const n = MAXF > 0 ? MAXF : Math.round(s.secs * FPS);
    // world-side setup (spawn, hide the viewmodel …), the rig's first pose, then let the world stream in around it at
    // 1/60 steps before the capture clock takes over
    await page.evaluate(`(() => { const tr = window.__tr; tr.rig = null; tr.t = 0; tr.dt = 1 / 60; tr.showHud(false); tr.hide = []; })()`);
    // a boss / elite spawns a beat into play: step the world until the shot's subject exists
    if (s.waitFor) for (let k = 0; k < 900 && !(await page.evaluate(s.waitFor)); k++) await page.evaluate('window.__tr.step()');
    if (s.setup) await page.evaluate(s.setup);
    if (s.rig) await page.evaluate((rig) => { window.__tr.setRig(rig); }, s.rig);
    for (let k = 0; k < (s.warm ?? 240); k++) {
      if (s.warmTick) await page.evaluate(s.warmTick(k));
      await page.evaluate('window.__tr.step()');
    }
    if (s.afterWarm) await page.evaluate(s.afterWarm);
    const probe = s.probe ? await page.evaluate(s.probe) : null; // what the shot found (its prey, its subject) → meta.json
    // speed < 1 = slow motion shot in engine: the sim steps less per frame, every frame is real (no interpolation);
    // t (rig keys, ticks) is sim time
    const SP = s.speed ?? 1;
    await page.evaluate((dt) => { window.__tr.dt = dt; }, SP / (FPS * SUB));
    const tc = Date.now();
    const picks = DRY ? new Set([0, Math.floor(n / 2), n - 1]) : null;
    let idx = 0;
    const poses = [];
    for (let i = 0; i < n; i++) {
      for (let sb = 0; sb < SUB; sb++) {
        const t = (i * SUB + sb) / (FPS * SUB) * SP;
        const tick = s.tick ? s.tick(t, i, sb, SP / (FPS * SUB)) : '';
        await page.evaluate(`(async () => { window.__tr.t = ${t}; ${tick}; await window.__tr.step(); })()`);
        if (picks ? picks.has(i) && sb === 0 : keep(s.name, i)) {
          await page.screenshot({ path: `${dir}/${String(DRY ? i : idx).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 95 });
        }
        idx++;
      }
      if (i % 30 === 0) poses.push(await page.evaluate('window.__tr.lastPose'));
    }
    const secs = (Date.now() - tc) / 1000;
    console.log(`[${s.name}] ${n} frames × ${SUB} in ${secs.toFixed(0)} s (${(secs / n).toFixed(2)} s/frame)${errors.length > 0 ? ` — ${errors.length} errors` : ''}`);
    writeFileSync(`${dir}/meta.json`, JSON.stringify({ name: s.name, shard: s.shard, frames: n, sub: SUB, fps: FPS, scale: SCALE, view: VIEW, url, errors, poses, probe, done: !DRY }, null, 1));
    report.push({ name: s.name, frames: n, secs, errors: errors.length });
  }
  await ctx.close();
}
writeFileSync(`${OUT}/capture-report-${Date.now()}.json`, JSON.stringify(report, null, 1));
await browser.close();
