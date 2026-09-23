#!/usr/bin/env node
// e54-gpu-recovery.mjs — the app-switch GPU drills (E54 / E61, src/core/GpuRecovery.ts + src/ui/Resume.ts), on a phone viewport:
//
//   chromium  WEBGL_lose_context: loseContext → 1.5 s → restoreContext. The 2D canvases survive, so the game must
//             restore IN PLACE: the resume screen while lost, then the pause menu, then it plays (move + look).
//             Then a hide → show (visibilitychange + pagehide / pageshow): the resume screen goes up while hidden
//             (with a still of the frame) and drops once a frame is drawn; paused into the menu.
//   webkit    SIGKILL of WebKit's GPU process — what iOS does to a backgrounded home-screen app. The WebGL context AND
//             every 2D canvas are wiped, so the game must RELOAD on the resume screen (never the first-boot loader),
//             skip the title and land where the player stood, under the pause menu. Prints kill → back in ms.
//
//   node scripts/e54-gpu-recovery.mjs [--url=https://wildshard-singleplayer.vercel.app] [--out=<dir>] [--only=chromium|webkit]
//
// Exit code = number of failed checks. JPEG shots land in --out (default: the OS temp dir).
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const origin = arg('url', 'https://wildshard-singleplayer.vercel.app');
const out = arg('out', mkdtempSync(join(tmpdir(), 'e54-')));
const only = arg('only', '');
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function open(engine, args, query) {
  const browser = await engine.launch({ headless: true, args });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.text().includes('[gl]')) console.log(`   ${m.text()}`); });
  await page.goto(origin + query);
  await page.waitForFunction(() => window.__world !== undefined, null, { timeout: 300_000, polling: 500 });
  await page.evaluate(() => { const h = window.__world.hud; if (!h.entered) h.enter(); }); // the title's ENTER WORLD
  await wait(2000);
  return { browser, page };
}

const state = (page) => page.evaluate(() => {
  const shown = (sel) => { const e = document.querySelector(sel); if (!e) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05; };
  const w = window.__world;
  const base = { resume: shown('.ws-resume'), loader: shown('.ws-load'), mark: window.__e54 === 1 };
  if (!w) return { ...base, world: false };
  const g = w.game, p = w.player;
  return {
    ...base, world: true, lost: g.renderer.getContext().isContextLost(), hold: g.hold, calls: g.lastFrame.calls,
    paused: w.hud.paused, entered: w.hud.entered, title: document.getElementById('hud')?.classList.contains('intro') ?? false,
    shot: (document.querySelector('.ws-resume-shot')?.style.backgroundImage ?? '').startsWith('url("data:image/jpeg'),
    pos: [p.position.x, p.position.z].map((v) => Math.round(v * 10) / 10), yaw: Math.round(p.yaw * 100) / 100,
  };
}).catch(() => null);
/** every Playwright WebKit GPU process on the machine (other agents may run their own) */
function webkitGpuPids() {
  const rows = execSync('ps -axo pid=,command=').toString().split('\n').map((l) => /^(\d+)\s+(.*)$/.exec(l.trim())).filter((m) => m !== null);
  return rows.filter((m) => m[2].includes('ms-playwright/webkit') && m[2].includes('WebKit.GPU')).map((m) => Number(m[1]));
}
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80 }).catch(() => undefined);

if (only !== 'webkit') {
  console.log('── chromium: WEBGL_lose_context (in-place restore) + hide / show ──');
  const { browser, page } = await open(chromium, ['--use-angle=metal'], '/?skipintro&nolock&weapon=sword&touch&tier=phone');
  await shot(page, 'c1-before');
  const hide = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent(h ? 'pagehide' : 'pageshow', { persisted: true }));
  }, hidden);
  await hide(true); await wait(600);
  let s = await state(page);
  await shot(page, 'c2-hidden-resume-screen');
  check(s?.paused === true && s.resume && s.shot, 'hide: paused into the menu, resume screen up with a still of the frame');
  const t0 = Date.now();
  await hide(false);
  await page.waitForFunction(() => !document.querySelector('.ws-resume')?.classList.contains('show'), null, { timeout: 5000, polling: 16 }).catch(() => undefined);
  const back = Date.now() - t0;
  s = await state(page);
  check(s !== null && !s.resume && s.calls > 0 && s.paused, `show: resume screen gone in ${back} ms, drawing, menu up`);
  await page.evaluate(() => { window.__world.hud.setPaused(false); });
  await page.evaluate(() => { window.__lx = window.__world.game.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lx.loseContext(); });
  await wait(400);
  s = await state(page);
  await shot(page, 'c3-lost');
  check(s?.lost === true && s.hold && s.resume && s.paused, 'lost: loop held, resume screen up, paused');
  await wait(1500);
  await page.evaluate(() => { window.__lx.restoreContext(); });
  await wait(4000);
  s = await state(page);
  await shot(page, 'c4-restored');
  check(s?.lost === false && !s.hold && !s.resume && s.calls > 0 && s.paused, 'restored in place: drawing again, under the pause menu');
  await page.evaluate(() => { window.__world.hud.setPaused(false); });
  const a = await state(page);
  await page.keyboard.down('KeyW'); await wait(1500); await page.keyboard.up('KeyW');
  await page.evaluate(() => { window.__world.player.yaw += 0.8; }); await wait(600);
  const b = await state(page);
  await shot(page, 'c5-played');
  check(a !== null && b !== null && Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) > 2 && b.yaw !== a.yaw, `plays after: moved ${JSON.stringify(a?.pos)} → ${JSON.stringify(b?.pos)}, yaw ${a?.yaw} → ${b?.yaw}`);
  await browser.close();
}

if (only !== 'chromium') {
  console.log('── webkit: GPU process killed (reload on the resume screen, where the player stood) ──');
  // WebKit's GPU process isn't our child (it hangs off launchd), so ours are the ones that appear while this browser starts
  const gpuBefore = new Set(webkitGpuPids());
  const { browser, page } = await open(webkit, [], '/?nolock&weapon=sword&touch&tier=phone'); // no skipintro: the title must be skipped by the reload itself
  await page.evaluate(() => { const p = window.__world.player; p.position.set(6, 2, -215); p.yaw = 2.6; window.__e54 = 1; }); // __e54: gone once the page reloads
  await wait(1500);
  const a = await state(page);
  await shot(page, 'w1-before');
  // as on the phone: the app goes to the background (the still is taken), the GPU process dies there, the app comes back
  const vis = (h) => page.evaluate((hh) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hh ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hh });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  await vis(true);
  const gpu = webkitGpuPids().filter((pid) => !gpuBefore.has(pid));
  check(gpu.length > 0, `found WebKit's GPU process (${gpu.length})`);
  for (const pid of gpu) process.kill(pid, 'SIGKILL');
  await wait(300);
  const t0 = Date.now();
  await vis(false).catch(() => undefined);
  let loaderSeen = false, resumeSeen = false, reloaded = false, backAt = -1, midShot = false;
  while (Date.now() - t0 < 120_000) {
    const s = await state(page);
    if (s) {
      loaderSeen ||= s.loader && !s.mark;
      resumeSeen ||= s.resume;
      reloaded ||= !s.mark;
      if (reloaded && s.resume && !midShot) { midShot = true; await shot(page, 'w2-reloading-resume-screen'); }
      if (reloaded && s.world && !s.resume && s.calls > 0) { backAt = Date.now() - t0; break; }
    }
    await wait(40);
  }
  await wait(300);
  const b = await state(page);
  await shot(page, 'w3-back');
  const url = await page.evaluate(() => location.search);
  const nav = await page.evaluate(() => ({ origin: performance.timeOrigin, dcl: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd ?? 0) }));
  check(backAt > 0, `back in the world ${backAt} ms after coming back (reload started at +${Math.round(nav.origin - t0)} ms, DOMContentLoaded +${nav.dcl} ms after that)`);
  check(resumeSeen && !loaderSeen, `the resume screen covered the reload; the first-boot loader never showed (resume ${resumeSeen}, loader ${loaderSeen})`);
  check(b !== null && b.entered && b.paused && !b.title, 'no title: straight into the world, under the pause menu');
  check(a !== null && b !== null && Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) < 1.5 && Math.abs(b.yaw - a.yaw) < 0.05, `same spot: ${JSON.stringify(a?.pos)} → ${JSON.stringify(b?.pos)}`);
  check(!/glreload|at=/.test(url), `address cleaned (${url})`);
  await browser.close();
}
console.log(`shots: ${out}`);
process.exit(failed);
