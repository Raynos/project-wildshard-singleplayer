#!/usr/bin/env node
// pine-hollow-sound-gaps.mjs — the sound-gaps lane's evidence (PINE-HOLLOW-REMASTER A-rows): ONE muted headless browser
// (--mute-audio, &mute=1, audio.muted) drives Pine Hollow through every new sound's trigger and reads `window.__audioLog`
// (src/audio/audioLog.ts) after each:
//   the lever gun dry (leverDry) and loading through the gate (leverRoundIn) · the Warden's Longbow loose (longbowLoose) ·
//   a bolt on a boulder (boltImpact-rock, through Weapons.onImpact with a point on a Props rock hull) · a woodpecker by day
//   (woodpecker_drum / woodpecker_call, flushed) · the ravens' breadcrumbs (raven_caw / raven_pair) · ravens to a kill
//   (croaks, landing, flushed: raven_flap) · the skinning beat (skinCut-a / skinCut-b) · the owl at night (owl_hoot).
// Every page request under /assets/music|sfx after the loading bar is a lazy fetch — the set is decoded at the bar, so none.
//
//   node scripts/pine-hollow-sound-gaps.mjs --url=http://localhost:4331 [--out=progress/pine-hollow-sound-gaps-01.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL0 = flag('url', 'http://localhost:4331');
const OUT = flag('out', 'progress/pine-hollow-sound-gaps-01.json');
const BASE = 'chunk=pine-hollow&tier=phone&skipintro=1&mute=1';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = { url: URL0, when: new Date().toISOString(), steps: [], lazyAudioFetches: [], failedAudio: [], errors: [] };
let ready = false, stepName = 'boot';
page.on('request', (r) => { const u = new URL(r.url()); if (ready && /^\/assets\/(music|sfx)\//.test(u.pathname)) report.lazyAudioFetches.push({ step: stepName, path: u.pathname }); });
page.on('requestfailed', (r) => { const u = new URL(r.url()); if (/^\/assets\/(music|sfx)\//.test(u.pathname)) report.failedAudio.push({ step: stepName, path: u.pathname, err: r.failure()?.errorText }); });
page.on('pageerror', (e) => { report.errors.push(String(e)); });

try {
  const t0 = Date.now();
  await page.goto(`${URL0}/?${BASE}&weapon=lever`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__world !== undefined, null, { timeout: 240_000, polling: 500 });
  ready = true;
  report.bootMs = Date.now() - t0;
  await page.mouse.click(195, 420); // the gesture that resumes the AudioContext; muted three ways
  await page.evaluate(() => { const w = window.__world; w.audio.muted = true; w.hud.onResume?.(); w.audio.muted = true; });
  await sleep(2500);
  report.manifest = await page.evaluate(() => ({ decoded: window.__world.ambience.sfx.decoded.length }));

  const mark = () => page.evaluate(() => window.__audioLog.length);
  const step = async (name, fn, waitMs = 2500) => {
    stepName = name;
    const from = await mark();
    const extra = await fn();
    await sleep(waitMs);
    const log = await page.evaluate((f) => window.__audioLog.slice(f), from);
    report.steps.push({ step: name, log, ...(extra !== undefined ? { extra } : {}) });
    const line = log.filter((e) => e.kind === 'sfx').map((e) => `${e.name}${e.ok === false ? '(!)' : ''}`).join(' ');
    console.log(`· ${name}: ${line === '' ? '(nothing)' : line}${extra !== undefined ? `  ${JSON.stringify(extra)}` : ''}`);
  };

  // ── the lever gun: empty → the hammer's dry click; three rounds through the gate ──
  await step('lever: dry fire on an empty gun', () => page.evaluate(() => {
    const r = window.__lever; r.chambered = false; r.tube = 0; r.state.ammo = 0; r.state.reserve = 0; r.tryFire();
  }), 1200);
  await step('lever: three rounds through the loading gate', () => page.evaluate(() => { const r = window.__lever; r.addRounds(3); r.reload(); }), 5000);

  // ── the Warden's Longbow: a whole shot (draw, loose at full) ──
  await step('longbow: draw + loose', () => page.evaluate(() => {
    const w = window.__weapons; w.unlock('bow'); w.select('bow', true);
    setTimeout(() => { window.__longbow.autoShot = true; }, 800);
  }), 4500);

  // ── a bolt on a boulder: the impact hook with a point on a Props rock hull's top ──
  await step('bolt on rock (Weapons.onImpact, ground → stone probe)', () => page.evaluate(() => {
    const w = window.__world, p = w.player.position;
    const rocks = w.props.colliderDescs().filter((d) => d.surface === 'rock' && d.kind === 'hull');
    let best = null, bd = Infinity;
    for (const d of rocks) { const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < bd) { bd = dd; best = d; } }
    if (!best) return 'no rock';
    let top = 1, ty = -Infinity;
    for (let i = 1; i < best.points.length; i += 3) if (best.points[i] > ty) { ty = best.points[i]; top = i; }
    const pt = p.clone().set(best.x + best.points[top - 1], best.y + ty, best.z + best.points[top + 1]);
    w.player.spawn(pt.x + 4, pt.z + 4, 0);
    window.__weapons.onImpact('ground', pt);
    return { rockAt: [pt.x, pt.y, pt.z].map((v) => Math.round(v * 10) / 10), fromPlayer: Math.round(bd) };
  }), 1500);

  // ── the woodpecker (day): onto a trunk near you, a while to drum / call, then flushed ──
  await step('woodpecker: settles, drums / calls (22 s)', () => page.evaluate(() => { window.__pineLife.woodNow(); }), 22000);
  await step('woodpecker: flushed (walk up to it)', () => page.evaluate(() => {
    const b = window.__pineLife.wood; if (b.mode === 'off') return 'not out';
    window.__world.player.spawn(b.pose.x + 3, b.pose.z + 3, 0); return b.mode;
  }), 3000);

  // ── the ravens' breadcrumbs ──
  await step('ravens: breadcrumbs overtake you', () => page.evaluate(() => { const t = window.__pineLife.crumbs(); return t ? t.id : 'no unvisited place'; }), 3000);

  // ── ravens to a kill: a deer down 25 m off, the ravens now, they land, then you walk up and they lift off ──
  const deer = await page.evaluate(() => {
    const w = window.__world, a = w.animals.animals.find((x) => x.kind === 'deer' && x.alive) ?? w.animals.animals.find((x) => x.alive);
    if (!a) return null;
    w.player.spawn(a.position.x + 25, a.position.z, 0);
    window.__gapDeer = a;
    return { kind: a.kind, at: [Math.round(a.position.x), Math.round(a.position.z)] };
  });
  report.deer = deer;
  await sleep(1500);
  await step('ravens: to a fresh kill (arrive, circle, land)', () => page.evaluate(() => {
    const a = window.__gapDeer; if (!a) return 'no animal';
    const dir = a.position.clone().set(1, 0, 0);
    a.applyDamage(100000, a.position.clone(), dir);
    setTimeout(() => { window.__pineLife.ravensTo(a.position.x, a.position.z); }, 300);
    return a.alive ? 'still alive' : 'down';
  }), 30000);
  await step('ravens: walk up, they lift off', () => page.evaluate(() => {
    const a = window.__gapDeer; if (!a) return 'no animal';
    window.__world.player.spawn(a.position.x + 3, a.position.z, 0);
    return window.__pineLife.ravens.map((r) => r.mode);
  }), 4000);
  await step('skinning beat (two strokes)', () => page.evaluate(() => {
    const a = window.__gapDeer; if (!a) return 'no animal';
    window.__world.pineLife.harvest(a, () => { /* the drops: none in a test */ }); return 'harvest';
  }), 2500);

  // ── the owl (night): the clock to night, the owl onto a snag near you, a hoot or two ──
  await step('night (the clock)', () => page.evaluate(() => { window.__pineQuest.night(); }), 9000);
  await step('owl: perches near you and hoots (25 s)', () => page.evaluate(() => {
    const p = window.__world.player.position; const ok = window.__pineLife.owlNow(p.x, p.z) ? 'on a snag near you' : window.__pineLife.owlNow() && 'on its own round';
    return { ok, night: window.__world.sky.pine?.night };
  }), 25000);
} catch (e) { report.errors.push(`driver: ${String(e)}`); }
await browser.close();

const all = report.steps.flatMap((s) => s.log.map((e) => ({ ...e, step: s.step })));
const saw = (name) => all.some((e) => e.kind === 'sfx' && e.name === name && e.ok !== false);
report.triggers = Object.fromEntries(['leverDry', 'leverRoundIn', 'longbowLoose', 'boltImpact-rock', 'woodpecker_drum', 'woodpecker_call',
  'raven_caw', 'raven_pair', 'raven_flap', 'skinCut-a', 'skinCut-b', 'owl_hoot'].map((n) => [n, saw(n)]));
report.triggers['no audio fetched after the bar'] = report.lazyAudioFetches.length === 0;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
console.log(report.triggers, `\nlazy audio fetches: ${report.lazyAudioFetches.length} · failed: ${report.failedAudio.length} · errors: ${report.errors.length}\n→ ${OUT}`);
