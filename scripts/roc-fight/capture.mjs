#!/usr/bin/env node
// G393 baseline (sp-o130): the Storm Roc fight in a real served build, on the capture clock with pinned randomness
// (scripts/parity/init.mjs: Math.random seeded, the game advances 1/30 s per drawn frame and only when the harness
// releases frames), as an iPhone 16 Pro portrait page. The page has no tape replay, so the fight is staged as play reaches
// it (`farReach.stage('quest-crown')`: the quest done, the bridge raised) with the player at the crown's south rim, and an
// in-page pilot plays the canonical tape's own `crown` leg (test/proof/far-reach/witness.ts) once per frame: hold the crown
// under the bird (never past 17 m from its middle), face it, aim at it, swing and GUST every frame.
// Two page sessions per capture: pass A runs the whole fight and logs every frame (no shots); pass B replays it, checks
// its log is identical (determinism inside the run) and shoots (a) the key beats as a 15 fps clip (approach, every
// encounter change, the first stoops of each phase, the fall) and (b) fixed-frame stills for a contact sheet, each with
// a burned-in label (build SHA, frame, tick, beat, Roc HP). With `--tree=<export>` it also writes the canonical headless
// facts of that source tree (scripts/roc-fight/facts.mjs: the witness tape, G354's 26,469-tick fight).
//   scripts/browser-lane.sh --max 40 node scripts/roc-fight/capture.mjs --url=<preview> --out=<dir> [--label=BEFORE] [--tree=<serve-build src export>]
// Writes <out>/facts.json, <out>/clip.mp4, <out>/sheet.jpg, <out>/frames.json.gz (the per-frame log).
import { chromium, devices } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { installInit } from '../parity/init.mjs';

const arg = (/** @type {string} */ name) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), outArg = arg('out'), label = arg('label') ?? 'BEFORE', tree = arg('tree');
if (url === undefined || outArg === undefined) throw new Error('Requires --url=<preview> --out=<dir> [--label=BEFORE] [--tree=<export>]');
const out = resolve(outArg), shots = join(out, 'shots');
/** Fixed stills, in frames from the fight's first frame (30 frames a second): the same frames for every build. */
const STILLS = [15, 90, 300, 600, 1200, 1800, 2400, 3000, 3600, 4200, 4800, 5400];
/** The fight's frame budget (past it the pilot failed): 15 minutes of game time. */
const MAX_FRAMES = 27_000;
/** Frames played after the Roc's fall. */
const AFTER = 150;
/** Clip windows round each beat, in frames: [before, after]. */
const WINDOW = { start: [0, 150], change: [30, 90], stoop: [30, 45], victory: [45, 150] };
/** Stoops shown per phase. */
const STOOPS_PER_PHASE = 2;

mkdirSync(shots, { recursive: true });
const version = /** @type {{ build: string }} */ (await (await fetch(new URL('/version.json', url))).json());
const sha = version.build.slice(0, 9);

/**
 * In page: stage the crown and install the pilot and the frame log. `window.__roc` holds the log; the pilot runs inside
 * the harness frame gate, so it acts exactly once per drawn frame, before the frame's simulation steps.
 */
function stage() {
  const probe = window.__wildshard, w = probe.requireWorld(), fr = probe.shard.farReach, g = w.game, input = g.app.input;
  const CROWN = { x: 0, z: -190, y: 44 }, REACH = 17, EYE = 1.68;
  for (const animal of w.animals.animals) animal.harnessHold = false;
  fr.stage('quest-crown');
  probe.combat.equip('far-fan');
  w.player.spawn(CROWN.x, CROWN.z + 14, 0, CROWN.y + 0.5); w.player.pitch = 0;
  const log = [], state = { frame: 0, on: true, error: '' }, health = () => Number(probe.state().player.health);
  const read = () => {
    const roc = fr.roc, boss = fr.boss, p = w.player;
    return [state.frame, roc ? Math.round(roc.hp * 100) / 100 : -1, boss ? String(boss.state) : '', boss ? Number(boss.phase) : -1, boss ? Number(boss.attempts) : -1,
      Math.round(health() * 100) / 100, roc ? Math.round(roc.position.y * 100) / 100 : 0, roc?.alive === true ? 1 : 0,
      w.animals.animals.filter(a => a.kind === 'galeWisp' && a.alive).length,
      Math.round(p.position.x * 100) / 100, Math.round(p.position.z * 100) / 100, roc ? Math.round(roc.position.x * 100) / 100 : 0, roc ? Math.round(roc.position.z * 100) / 100 : 0];
  };
  const pilot = () => {
    const roc = fr.roc, p = w.player;
    if (!state.on || roc === null || !roc.alive) { p.touchMove = { x: 0, y: 0 }; return; }
    // the witness tape's crown leg, on the page's player
    const rx = roc.position.x - CROWN.x, rz = roc.position.z - CROWN.z, off = Math.hypot(rx, rz);
    const grounded = roc.position.y < CROWN.y + 3, follow = grounded || roc.speed < 0.5, k = !follow ? 0 : off > REACH ? REACH / off : 1;
    const gx = CROWN.x + rx * k - p.position.x, gz = CROWN.z + rz * k - p.position.z, d = Math.hypot(gx, gz), near = grounded ? 2 : 1;
    const yaw = Math.atan2(p.position.x - roc.position.x, p.position.z - roc.position.z);
    p.yaw = yaw;
    p.pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(roc.position.y - (p.position.y + EYE), Math.hypot(roc.position.x - p.position.x, roc.position.z - p.position.z))));
    if (d > near) {
      // the world direction in the stick's frame (x right, y forward; yaw 0 looks along -z)
      const mx = gx / d, mz = gz / d, fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
      p.touchMove = { x: mx * sx + mz * sz, y: mx * fx + mz * fz };
    } else p.touchMove = { x: 0, y: 0 };
    input.press('attack'); input.press('far.gust');
  };
  const gate = g.frameGate.bind(g);
  // a pilot error must not stop the frame loop (the harness would wait forever): it is recorded and the pilot stands down
  g.frameGate = () => {
    const open = gate();
    if (open) { try { if (state.error === '') pilot(); log.push(read()); } catch (error) { state.error = String(error); } state.frame++; }
    return open;
  };
  window.__roc = { log, state, read };
}

/** In page: a burned-in label over the canvas (the screenshot carries it). */
function overlay(/** @type {string} */ text) {
  let el = document.getElementById('roc-label');
  if (el === null) {
    el = document.createElement('div'); el.id = 'roc-label';
    el.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:6px 10px;font:700 15px/1.3 ui-monospace,Menlo,monospace;color:#fff;background:rgba(0,0,0,0.62);white-space:pre-wrap;pointer-events:none';
    document.body.append(el);
  }
  el.textContent = text;
}

/** @param {import('playwright').Browser} browser */
async function session(browser) {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'roc-fight', sha: version.build, browser: 'chromium', capture: 30, tier: 'phone' });
  const page = await context.newPage(), errors = /** @type {string[]} */ ([]);
  page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=far-reach&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world;
    return (w?.animals?.animals?.length ?? 0) > 0 && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load') && (window.__wildshard?.shard?.farReach?.roc ?? null) !== null;
  }, undefined, { timeout: 400_000, polling: 1000 });
  // settle the arrival a fixed number of frames, then stage the crown
  await page.evaluate(() => window.__parity.advance(30));
  await page.evaluate(stage);
  return { context, page, errors };
}

/** @typedef {[number, number, string, number, number, number, number, number, number, number, number, number, number]} Row */
/** @param {import('playwright').Page} page @param {number} frames */
const advance = async (page, frames) => {
  const error = await page.evaluate(async n => { await window.__parity.advance(n); return window.__roc?.state.error ?? ''; }, frames);
  if (error !== '') throw new Error(`Pilot failed in page: ${error}`);
};
/** @param {import('playwright').Page} page @returns {Promise<Row[]>} */
const rows = page => page.evaluate(() => window.__roc.log);

/** The beats a frame log shows. @param {Row[]} log */
function beats(log) {
  /** @type {{ frame: number; kind: string; text: string }[]} */
  const list = [{ frame: 0, kind: 'start', text: 'approach' }];
  const perPhase = new Map();
  let low = false, victory = null;
  for (const [i, row] of log.entries()) {
    const prev = log.at(i - 1);
    if (i === 0 || prev === undefined) continue;
    if (row[2] !== prev[2] || row[3] !== prev[3] || row[4] !== prev[4]) {
      list.push({ frame: row[0], kind: 'change', text: `${row[2]} · phase ${String(row[3] + 1)}${row[4] > 1 ? ` · attempt ${String(row[4])}` : ''}` });
      if (row[2] === 'victory' && victory === null) victory = row[0];
    }
    const isLow = row[7] === 1 && row[6] < 44 + 3;
    if (isLow && !low) {
      const n = (perPhase.get(row[3]) ?? 0) + 1; perPhase.set(row[3], n);
      if (n <= STOOPS_PER_PHASE) list.push({ frame: row[0], kind: 'stoop', text: `stoop ${String(n)} · phase ${String(row[3] + 1)}` });
    }
    low = isLow;
  }
  if (victory !== null) list.push({ frame: victory, kind: 'victory', text: 'the fall' });
  return { list, victory };
}

/** Facts of a page frame log. @param {Row[]} log @param {number | null} victory */
function pageFacts(log, victory) {
  const changes = [], hits = [], stoops = [];
  let low = false;
  for (const [i, row] of log.entries()) {
    const prev = log.at(i - 1);
    if (i === 0 || prev === undefined) continue;
    if (row[2] !== prev[2] || row[3] !== prev[3] || row[4] !== prev[4]) changes.push({ frame: row[0], tick: row[0] * 2, state: row[2], phase: row[3], attempts: row[4], rocHp: row[1] });
    if (row[5] < prev[5]) hits.push({ frame: row[0], damage: Math.round((prev[5] - row[5]) * 100) / 100 });
    const isLow = row[7] === 1 && row[6] < 47; if (isLow && !low) stoops.push(row[0]); low = isLow;
  }
  return {
    clock: '30 page frames a second (capture clock); tick = frame × 2 (60 Hz fixed step)',
    fightFrames: victory, fightTicks: victory === null ? null : victory * 2, framesLogged: log.length, attempts: log.at(-1)?.[4] ?? null,
    changes, hitsTaken: hits.length, damageTaken: Math.round(hits.reduce((n, h) => n + h.damage, 0) * 100) / 100, minPlayerHp: Math.min(...log.map(row => row[5])),
    stoops: stoops.length, stoopFrames: stoops,
    // no player HP here: it regenerates on the wall clock (facts.deterministic)
    rocHpEvery300: log.filter(row => row[0] % 300 === 0).map(row => ({ frame: row[0], rocHp: row[1], phase: row[3], wisps: row[8] })),
  };
}

/** @param {{ frame: number; kind: string }[]} list @param {number} end */
function windows(list, end) {
  /** @type {[number, number][]} */
  const spans = list.map(beat => { const [a, b] = WINDOW[/** @type {keyof typeof WINDOW} */ (beat.kind)]; return [Math.max(0, beat.frame - a), Math.min(end, beat.frame + b)]; });
  spans.sort((x, y) => x[0] - y[0]);
  /** @type {[number, number][]} */
  const merged = [];
  for (const span of spans) { const last = merged.at(-1); if (last !== undefined && span[0] <= last[1] + 2) last[1] = Math.max(last[1], span[1]); else merged.push([...span]); }
  return merged;
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
/** @type {Row[]} */
let logA;
let found;
try {
  // pass A: the whole fight, logged
  {
    const { context, page, errors } = await session(browser);
    let victory = null;
    for (let done = 0; done < MAX_FRAMES && victory === null; done += 300) {
      await advance(page, 300);
      victory = await page.evaluate(() => window.__roc.log.find(row => row[2] === 'victory')?.[0] ?? null);
    }
    if (victory === null) throw new Error(`No victory within ${String(MAX_FRAMES)} frames`);
    const have = await page.evaluate(() => window.__roc.log.length);
    if (have < victory + AFTER + 1) await advance(page, victory + AFTER + 1 - have);
    logA = (await rows(page)).slice(0, victory + AFTER + 1);
    if (errors.length > 0) throw new Error(`Page errors: ${errors.join(' | ')}`);
    await context.close();
    found = beats(logA);
    console.log(`pass A: victory at frame ${String(victory)}, ${String(found.list.length)} beats`);
  }
  // pass B: the same fight again, shot
  const end = logA.length - 1, spans = windows(found.list, end);
  /** @type {Map<number, string>} */
  const wanted = new Map();
  for (const [a, b] of spans) for (let f = a; f <= b; f += 2) wanted.set(f, 'clip');
  for (const f of STILLS) if (f <= end) wanted.set(f, wanted.has(f) ? 'both' : 'still');
  const frames = [...wanted.keys()].sort((x, y) => x - y);
  const beatAt = (/** @type {number} */ frame) => { let text = ''; for (const beat of found.list) if (beat.frame <= frame) text = beat.text; return text; };
  const { context, page, errors } = await session(browser);
  let clipIndex = 0;
  for (const frame of frames) {
    const have = await page.evaluate(() => window.__roc.log.length);
    if (frame + 1 > have) await advance(page, frame + 1 - have);
    const row = logA.at(frame);
    if (row === undefined) continue;
    // the player's HP is left out: its regeneration runs on the wall clock (see facts.deterministic)
    const text = `${label} ${sha} · f${String(frame)} · tick ${String(frame * 2)} · +${(frame / 30).toFixed(1)}s\n${beatAt(frame)} · Roc ${String(row[1])} HP · ${row[2]} p${String(row[3] + 1)}`;
    await page.evaluate(overlay, text);
    const kind = wanted.get(frame);
    if (kind === 'clip' || kind === 'both') await page.screenshot({ path: join(shots, `clip-${String(clipIndex++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 85, scale: 'css' });
    if (kind === 'still' || kind === 'both') await page.screenshot({ path: join(shots, `still-${String(STILLS.indexOf(frame)).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 90, scale: 'css' });
  }
  const have = await page.evaluate(() => window.__roc.log.length);
  if (have < logA.length) await advance(page, logA.length - have);
  const logB = (await rows(page)).slice(0, logA.length);
  if (errors.length > 0) throw new Error(`Page errors: ${errors.join(' | ')}`);
  await context.close();
  // the fight's own state (every column but the player's HP) must repeat exactly; the player's HP regenerates on the
  // wall clock (not the capture clock), so between two passes it may differ by a regen step and is reported apart
  const fight = (/** @type {Row | undefined} */ row) => JSON.stringify(row?.filter((_, i) => i !== 5));
  const firstDiff = logA.findIndex((row, i) => fight(row) !== fight(logB.at(i))), same = firstDiff === -1 && logA.length === logB.length;
  const hpFrames = logA.filter((row, i) => row[5] !== logB.at(i)?.[5]).length;
  console.log(`pass B: ${String(clipIndex)} clip frames, fight log ${same ? 'identical' : `differs from frame ${String(firstDiff)}`}, player HP differs on ${String(hpFrames)} frames`);
  // the clip (15 fps, ≤ 4 MB) and the contact sheet (6 × 2, half size)
  const ff = (/** @type {string[]} */ args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}`); };
  ff(['-framerate', '15', '-i', join(shots, 'clip-%05d.jpg'), '-vf', 'scale=402:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, 'clip.mp4')]);
  ff(['-framerate', '1', '-i', join(shots, 'still-%02d.jpg'), '-vf', 'scale=268:-2,tile=6x2:padding=4:color=black', '-frames:v', '1', '-q:v', '5', join(out, 'sheet.jpg')]);
  /** @type {Record<string, unknown>} */
  const facts = { label, build: version.build, url, profile: 'iPhone 16 Pro portrait, DPR 2, chromium headless, Metal, muted; capture clock 30 fps; Math.random pinned (scripts/parity/init.mjs)',
    stills: STILLS, beats: found.list, deterministic: { passes: 2, fightIdentical: same, firstDifferentFrame: same ? null : firstDiff, playerHpFramesDiffering: hpFrames, note: 'player HP regeneration runs on the wall clock; every other logged column repeats exactly' }, page: pageFacts(logA, found.victory) };
  if (tree !== undefined) {
    const result = spawnSync(process.execPath, ['--import', join(resolve(tree), 'scripts/sim-node-loader.mjs'), new URL('facts.mjs', import.meta.url).pathname, `--tree=${resolve(tree)}`], { cwd: resolve(tree), encoding: 'utf8', maxBuffer: 1 << 26 });
    if (result.status !== 0) throw new Error(`facts.mjs failed: ${result.stderr.slice(-2000)}`);
    facts.headless = JSON.parse(result.stdout);
  }
  writeFileSync(join(out, 'facts.json'), `${JSON.stringify(facts, null, 1)}\n`);
  writeFileSync(join(out, 'frames.json.gz'), gzipSync(JSON.stringify({ columns: ['frame', 'rocHp', 'bossState', 'phase', 'attempts', 'playerHp', 'rocY', 'rocAlive', 'wisps', 'playerX', 'playerZ', 'rocX', 'rocZ'], rows: logA })));
  if (process.argv.includes('--keep-shots')) console.log(`shots kept in ${shots}`); else rmSync(shots, { recursive: true, force: true });
  console.log(JSON.stringify({ out, clipBytes: readFileSync(join(out, 'clip.mp4')).length, sheetBytes: readFileSync(join(out, 'sheet.jpg')).length, deterministic: same }));
} finally { await browser.close(); }
