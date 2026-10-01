#!/usr/bin/env node
// nine-dragon-grapple-touch.mjs — E286: does the Fei Zhua work with REAL touch taps, and does the HUD say so?
//
// Jake plays Nine Dragon as an iOS home-screen PWA on the touch HUD. The grapple rides the baseline LOCK and JUMP discs
// (plan §3.4): with a dragon hook in reach LOCK reads GRAPPLE (gold, pulsing) and a small ◇ marks every hook in reach;
// LOCK locks it (LOCKED, JUMP reads ZIP); JUMP zips. This drives three flows on a phone-sized touch page:
//
//   spawn   mockup A's spot (0.95, 7.5), facing yaw 12: turn (in 6° steps, either way) toward the nearest hook in reach
//   rim     mockup B's spot on the Well's south rim (−19.5, 13.3), facing north: the same turn, then across the Well
//   square  the same spot, looking right from 32° (the (−3.2, −13) mast's hook, E286): across the Well's corner, over the
//           balustrade, onto the square (it must land on the square's floor)
//   stair   mockup C's spot at the stair-street's foot (18, 6), facing east up it
//
// For each: the turn it took to find a hook, the markers on screen, the LOCK / JUMP labels at rest → GRAPPLE → LOCKED + ZIP
// (read from the DOM), a real tap on LOCK then on JUMP (page.touchscreen.tap on the disc's centre), where the player was
// and where it came to rest, and that it stayed there on a floor inside the fragment's bounds (F1) for 2 s after. A JPEG of
// every state goes to --out. Exit 1 when a flow fails.
//
//   node scripts/nine-dragon-grapple-touch.mjs --url=http://127.0.0.1:5173 --out=/tmp/grapple
//   node scripts/nine-dragon-grapple-touch.mjs --flows=rim                     # one flow
//
// One headless Chromium on Metal, muted; it holds one of the Nine Dragon browser slots (.git/nine-dragon-browser-{1,2}.lock)
// like scripts/nine-dragon-domes.mjs, and waits while both are taken.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const base = flag('url', 'http://localhost:4173');
const OUT = resolvePath(flag('out', join(tmpdir(), 'nine-dragon-grapple-touch')));
const pick = flag('flows', 'spawn,rim,square,stair').split(',');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ── the browser slot ──
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function takeSlot() {
  for (;;) {
    for (const n of [1, 2]) {
      const p = join(ROOT, `.git/nine-dragon-browser-${n}.lock`);
      if (existsSync(p)) {
        const pid = Number(readFileSync(p, 'utf8').trim());
        if (pid && alive(pid)) continue;
        try { unlinkSync(p); } catch { /* raced */ }
      }
      try { const fd = openSync(p, 'wx'); writeSync(fd, String(process.pid)); closeSync(fd); return p; } catch { /* raced */ }
    }
    await sleep(5000);
  }
}
const slot = await takeSlot();
const releaseSlot = () => { try { if (readFileSync(slot, 'utf8').trim() === String(process.pid)) unlinkSync(slot); } catch { /* gone */ } };
process.on('exit', releaseSlot);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { releaseSlot(); process.exit(1); });

const { MOCKUP_CAMERAS } = await import(join(ROOT, 'src/shards/nine-dragon-stack/mockupCameras.ts'));
const cam = (k) => ({ x: MOCKUP_CAMERAS[k].eye[0], z: MOCKUP_CAMERAS[k].eye[2], yaw: MOCKUP_CAMERAS[k].yaw, pitch: MOCKUP_CAMERAS[k].pitch });
const FLOWS = [
  { name: 'spawn', mockup: 'A', ...cam('A'), pitch: -4 },
  { name: 'rim', mockup: 'B', ...cam('B'), pitch: -4 },
  // the right-hand search only, from 32°: the mast hook on the square's side, whose landing must be the square's floor
  { name: 'square', mockup: 'B', ...cam('B'), pitch: -4, from: 32, right: true, lands: (p) => p[0] > 0.5 && Math.abs(p[1] - 125) < 0.3 },
  { name: 'stair', mockup: 'C', ...cam('C'), pitch: 4 },
].filter((f) => pick.includes(f.name));

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
/** @type {{ flow: string, ok: boolean }[]} */
const results = [];
/** @type {string[]} */
const rows = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.info(`pageerror: ${e.message.slice(0, 300)}`));
  const toasts = [];
  await page.exposeFunction('__grappleToast', (t) => { toasts.push(t); });
  await page.goto(`${base}/?chunk=nine-dragon-stack&skipintro=1&tier=phone&touch=1&mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.chunk?.slug === 'nine-dragon-stack' && (window.__wildshard.world.game?.lastFrame?.calls ?? 0) > 60 && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
  await sleep(5000);
  await page.evaluate(() => {
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = n.textContent ?? ''; if (/HOOK|FEI|ZIP|MISS/.test(t)) window.__grappleToast(t.slice(0, 80)); } }).observe(document.body, { childList: true, subtree: true });
  });
  /** what the HUD shows and where the player is */
  const state = () => page.evaluate(() => {
    const w = window.__wildshard?.world, p = w.player.position;
    const vis = (el) => el !== null && getComputedStyle(el).display !== 'none';
    const chip = document.querySelector('.ws-dragon-hook');
    const lock = document.querySelector('.ws-touch-disc.lock'), jump = document.querySelector('.ws-touch-disc.jump');
    return {
      pos: [p.x, p.y, p.z].map((v) => Number(v.toFixed(2))), onGround: w.player.onGround,
      chip: vis(chip) ? chip.textContent : null,
      marks: [...document.querySelectorAll('.ws-dragon-mark')].filter(vis).length,
      lock: lock?.querySelector('span')?.textContent ?? null, lockTone: [...(lock?.classList ?? [])].find((c) => c.startsWith('hint-')) ?? null,
      jump: jump?.querySelector('span')?.textContent ?? null, jumpTone: [...(jump?.classList ?? [])].find((c) => c.startsWith('hint-')) ?? null,
    };
  });
  const tap = async (sel) => {
    const box = await (await page.$(sel))?.boundingBox();
    if (!box) throw new Error(`no ${sel}`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  };
  const shot = (flow, tag) => page.screenshot({ path: join(OUT, `${flow.name}-${tag}.jpg`), type: 'jpeg', quality: 80 });
  const pose = (flow, yawDeg) => page.evaluate(([x, z, yaw, pitch]) => {
    const w = window.__wildshard?.world; w.player.spawn(x, z, -yaw * Math.PI / 180, 125); w.player.pitch = pitch * Math.PI / 180;
  }, [flow.x, flow.z, yawDeg, flow.pitch]);
  const turn = (yawDeg) => page.evaluate((yaw) => { window.__wildshard.world.player.yaw = -yaw * Math.PI / 180; }, yawDeg);
  const inBounds = () => page.evaluate(() => {
    const w = window.__wildshard?.world, b = w.chunk.bounds, p = w.player.position;
    return p.y >= b.floor && p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;
  });

  for (const flow of FLOWS) {
    /** @type {{ flow: string, mockup: string, ok: boolean, steps: object[], turn?: number, moved?: number, error?: string, checks?: Record<string, boolean> }} */
    const r = { flow: flow.name, mockup: flow.mockup, ok: false, steps: [] };
    results.push(r);
    await pose(flow, flow.yaw);
    await sleep(1500);
    const rest = await state();
    r.steps.push({ at: 'rest', ...rest });
    await shot(flow, '0-rest');
    // turn toward the nearest hook in reach: 6° steps, alternating right / left, out to a half turn
    let found = null;
    const yaw0 = flow.from ?? flow.yaw;
    for (let k = 0; k <= 30 && found === null; k++) {
      for (const sgn of k === 0 || flow.right === true ? [1] : [1, -1]) {
        const yaw = yaw0 + sgn * 6 * k;
        await turn(yaw);
        await sleep(k === 0 ? 400 : 260);
        const s = await state();
        if (s.lock === 'Grapple') { found = { yaw, turn: yaw - flow.yaw, ...s }; break; }
      }
    }
    if (found === null) {
      r.error = 'no hook in reach within a half turn';
      console.log(JSON.stringify(r));
      rows.push(`| ${flow.name} (${flow.mockup}) | — | — | ${rest.lock}/${rest.jump} → — | ${r.error} | — | NO |`);
      continue;
    }
    await sleep(500);
    r.turn = found.turn;
    const ready = await state();
    r.steps.push({ at: 'grapple', yaw: found.yaw, ...ready });
    await shot(flow, '1-grapple');
    await tap('.ws-touch-disc.lock');
    await sleep(500);
    const locked = await state();
    r.steps.push({ at: 'locked', ...locked });
    await shot(flow, '2-locked');
    const from = locked.pos;
    await tap('.ws-touch-disc.jump');
    await sleep(700);
    await shot(flow, '3-zip');
    const mid = await state();
    r.steps.push({ at: 'zip', ...mid });
    // wait for the zip to end: back to rest labels and on the ground
    let landed = null;
    for (let i = 0; i < 40 && landed === null; i++) {
      await sleep(150);
      const s = await state();
      if (s.onGround && s.jump === 'Jump' && s.lock !== 'Locked') landed = s;
    }
    await sleep(400);
    await shot(flow, '4-landed');
    const settled = landed ?? await state();
    r.steps.push({ at: 'landed', ...settled });
    await sleep(2000);
    const after = await state();
    const inside = await inBounds();
    r.steps.push({ at: 'after-2s', inside, ...after });
    const moved = Math.hypot(after.pos[0] - from[0], after.pos[2] - from[2]);
    // (a landing can settle a little: off a walker's shoulder on a crowded crossing, down a tread)
    const drift = Math.hypot(after.pos[0] - settled.pos[0], after.pos[2] - settled.pos[2]);
    r.moved = Number(moved.toFixed(2));
    r.checks = {
      restLabels: rest.jump === 'Jump' && (rest.lock === 'Lock' || rest.lock === 'Grapple'),
      grappleLit: ready.lock === 'Grapple' && ready.lockTone === 'hint-ready' && ready.chip === '◇ DRAGON HOOK',
      lockedZip: locked.lock === 'Locked' && locked.lockTone === 'hint-active' && locked.jump === 'Zip' && locked.jumpTone === 'hint-active',
      moved: moved > 3,
      landed: landed !== null,
      stayed: inside && after.onGround && drift < 1 && settled.pos[1] - after.pos[1] < 1.5,
      where: flow.lands === undefined || flow.lands(after.pos),
      backToRest: after.jump === 'Jump' && after.lock !== 'Locked',
    };
    r.ok = Object.values(r.checks).every(Boolean);
    console.log(JSON.stringify(r));
    rows.push(`| ${flow.name} (${flow.mockup}) | ${found.turn}° | ${ready.marks} + chip | ${rest.lock}/${rest.jump} → ${ready.lock} → ${locked.lock}/${locked.jump} | (${from.join(', ')}) → (${settled.pos.join(', ')}) | ${r.checks.stayed ? 'yes' : 'NO'} | ${r.ok ? 'yes' : 'NO'} |`);
  }
  console.log(`toasts ${JSON.stringify(toasts)}`);
} finally {
  await browser.close();
}
console.log('\n| flow | turn | markers | labels rest → ready → locked | from → landed | stayed | ok |\n|---|---|---|---|---|---|---|');
for (const row of rows) console.log(row);
console.log(`\nframes: ${OUT}`);
process.exit(results.length > 0 && results.every((r) => r.ok) ? 0 : 1);
