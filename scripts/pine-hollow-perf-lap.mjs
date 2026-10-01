#!/usr/bin/env node
// pine-hollow-perf-lap.mjs — the PERF LAP (E350 F-J1, src/ui/perfLap.ts) run headless, the way Jake runs it on the phone:
// phone tier (iPhone 16 Pro, touch), the fps pill → PERF LAP, wait for the summary. Then checks the lap was safe:
//   - no save changed (every localStorage key but the perf panel's own, before vs after: quest flags, the journal, the
//     elites' lairs, the boss, the last place …)
//   - the player is back where they stood
//   - a key press mid-lap cancels it (the player back again, the summary says CANCELLED)
//   - a fight refuses it (music forced to combat → the refusal text)
// Prints the summary; `--shot=<dir>` saves the status line mid-lap and the panel with the result (PNG).
//
//   node scripts/pine-hollow-perf-lap.mjs --url=http://127.0.0.1:4400 --shot=/path/to/dir
//
// Serve a clean HEAD build (scripts/serve-build.sh --head). One headless Chromium on Metal, muted, closed at the end;
// wrap it in scripts/browser-lane.sh.
import { writeFileSync, mkdirSync } from 'node:fs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const SHOT = flag('shot', '');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) process.exitCode = 1; };
try {
  const iphone = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext({ ...iphone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const q = ['chunk=pine-hollow', 'mute=1', 'skipintro=1', 'nolock=1', 'sw=0', 'tier=phone', 'touch', 'perf=1'].join('&');
  await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && Boolean(window.__perfLapRun), undefined, { timeout: 300000, polling: 500 });
  await sleep(10000);
  const build = await page.evaluate(() => fetch('/version.json').then((r) => r.json()).catch(() => null));
  console.log('build', JSON.stringify(build));
  const pos = () => page.evaluate(() => { const p = window.__wildshard.world.player; return { x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw }; });
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.5 && Math.abs(a.yaw - b.yaw) < 1e-3;
  // the JSON paths that differ (a save's value is JSON: name what changed inside it, not only the key). A save written
  // for the first time holds its defaults: missing and empty ('', 0, false, [], {}) read the same
  const empty = (v) => v === undefined || v === null || v === '' || v === 0 || v === false || (typeof v === 'object' && Object.keys(v).length === 0);
  const paths = (a, b, at, out) => {
    if (a === b || (empty(a) && empty(b))) return out;
    if ((a === undefined || a === null) && typeof b === 'object') return paths({}, b, at, out);
    if ((b === undefined || b === null) && typeof a === 'object') return paths(a, {}, at, out);
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) { out.push(`${at}: ${JSON.stringify(a ?? null).slice(0, 60)} → ${JSON.stringify(b ?? null).slice(0, 60)}`); return out; }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) paths(a[key], b[key], `${at}.${key}`, out);
    return out;
  };
  const parse = (s) => { try { return JSON.parse(s); } catch { return s; } };
  const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => paths(parse(a[key] ?? 'null'), parse(b[key] ?? 'null'), key, []));

  // the saves at the lap's first and last tick, in the page (a boar the journal spots at the spawn a second before the
  // tap is not the lap's); play time (`playS`) runs on through a lap like any time in the world
  await page.evaluate(() => {
    const snap = () => Object.fromEntries(Object.keys(localStorage).filter((k) => !k.startsWith('ws.perf')).sort().map((k) => [k, localStorage.getItem(k)]));
    const run = window.__perfLapRun, start = run.start.bind(run), done = run.onDone;
    window.__lapSaves = {};
    run.start = (rec) => { window.__lapSaves = { before: snap() }; return start(rec); };
    run.onDone = (t) => { window.__lapSaves.after = snap(); done?.(t); };
  });
  const lapSaves = () => page.evaluate(() => window.__lapSaves);
  const own = (d) => d.filter((line) => !/\.playS: /.test(line));
  const list = (d) => (d.length > 0 ? d.join(' | ') : 'none');

  // ── the lap: pill → PERF LAP ──
  const p0 = await pos();
  await page.locator('.ws-perf').click();
  await page.locator('.ws-perf-lap').click();
  // where it stands at each spot (the lookout's catwalk must hold the player)
  const seen = [];
  const t0 = Date.now();
  let shotTaken = false;
  while (Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => ({ status: document.querySelector('.ws-perf-lap-status')?.textContent ?? '', hidden: document.querySelector('.ws-perf-lap-status')?.hidden ?? true, done: Boolean(window.__perfLap), p: { x: window.__wildshard.world.player.position.x, y: window.__wildshard.world.player.position.y, z: window.__wildshard.world.player.position.z } }));
    if (s.done) break;
    if (!s.hidden && s.status.includes('REC')) {
      const id = s.status.split(' · ')[1];
      if (!seen.some((x) => x.id === id)) seen.push({ id, ...s.p });
      if (SHOT && !shotTaken && s.status.includes('KING')) { mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: `${SHOT}/lap-running.png` }); shotTaken = true; }
    }
    await sleep(1000);
  }
  const text = await page.evaluate(() => window.__perfLap?.text ?? '');
  console.log(`\n${text}\n`);
  for (const s of seen) console.log(`  at ${s.id}: ${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}`);
  check(text.includes('6/6 spots') && !text.includes('CANCELLED'), 'the lap ran all six spots');
  const p1 = await pos(), ls = await lapSaves();
  const lapDiff = diff(ls.before, ls.after);
  console.log(`saves the lap changed: ${list(lapDiff)}`);
  check(own(lapDiff).length === 0, `no save changed (play time aside) (${list(own(lapDiff))})`);
  check(near(p0, p1), `the player is back (${JSON.stringify(p0)} → ${JSON.stringify(p1)})`);
  if (SHOT) {
    await page.evaluate(() => { document.querySelector('.ws-perf-lap-out')?.scrollIntoView({ block: 'start' }); });
    await sleep(600);
    await page.screenshot({ path: `${SHOT}/lap-result.png` });
    writeFileSync(`${SHOT}/lap-summary.txt`, `${text}\n`);
  }

  // ── a key cancels ──
  await page.evaluate(() => { window.__perfLap = undefined; });
  const p2 = await pos();
  await page.locator('.ws-perf-lap').click();
  await sleep(6000);
  await page.keyboard.press('KeyW');
  await page.waitForFunction(() => Boolean(window.__perfLap), undefined, { timeout: 10000 });
  const cancelled = await page.evaluate(() => window.__perfLap?.text ?? '');
  const p3 = await pos();
  check(cancelled.includes('CANCELLED: touch / key'), 'a key press cancels the lap');
  check(near(p2, p3), 'the cancelled lap puts the player back');
  const ls2 = await lapSaves();
  check(own(diff(ls2.before, ls2.after)).length === 0, `the cancelled lap changed no save (${list(own(diff(ls2.before, ls2.after)))})`);

  // ── a fight refuses it ──
  const refused = await page.evaluate(() => {
    const w = window.__wildshard?.world; w.music.state.mode = 'combat';
    const why = window.__perfLapRun.start(false);
    w.music.state.mode = 'calm';
    return why;
  });
  check(refused === 'PERF LAP: not mid-fight', `mid-fight refuses (${refused})`);
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
} finally {
  await browser.close();
}
