#!/usr/bin/env node
// e54-gpu-recovery.mjs — the app-switch GPU drills (E54, src/core/GpuRecovery.ts), on a phone viewport:
//
//   chromium  WEBGL_lose_context: loseContext → 1.5 s → restoreContext. The 2D canvases survive, so the game must
//             restore IN PLACE: "Restoring graphics" page while lost, then the pause menu, then it plays (move + look).
//             Then a hide → show (visibilitychange + pagehide / pageshow): pauses into the menu, the canvas comes back.
//   webkit    SIGKILL of WebKit's GPU process — what iOS does to a backgrounded home-screen app. The WebGL context AND
//             every 2D canvas are wiped, so the game must RELOAD, keeping the save, where the player stood.
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
const QUERY = '/?skipintro&nolock&weapon=sword&touch&tier=phone';
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failed++; };
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function open(engine, args) {
  const browser = await engine.launch({ headless: true, args });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (/\[gl\]/.test(m.text())) console.log(`   ${m.text()}`); });
  await page.goto(origin + QUERY);
  await page.waitForFunction(() => window.__world !== undefined, null, { timeout: 300_000, polling: 500 });
  await wait(2000);
  return { browser, page };
}

const state = (page) => page.evaluate(() => {
  const w = window.__world; if (!w) return null;
  const g = w.game, p = w.player;
  return {
    lost: g.renderer.getContext().isContextLost(), hold: g.hold, calls: g.lastFrame.calls, canvasHidden: g.canvas.style.visibility === 'hidden',
    page: document.querySelector('.ws-gpu.show .ws-gpu-sub')?.textContent ?? null, paused: w.hud.paused,
    pos: [p.position.x, p.position.z].map((v) => Math.round(v * 10) / 10), yaw: Math.round(p.yaw * 100) / 100,
  };
}).catch(() => null);
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80 });

if (only !== 'webkit') {
  console.log('── chromium: WEBGL_lose_context (in-place restore) ──');
  const { browser, page } = await open(chromium, ['--use-angle=metal']);
  await shot(page, 'c1-before');
  await page.evaluate(() => { window.__lx = window.__world.game.renderer.getContext().getExtension('WEBGL_lose_context'); window.__lx.loseContext(); });
  await wait(400);
  let s = await state(page);
  await shot(page, 'c2-lost');
  check(s?.lost === true && s.hold && s.page !== null && s.canvasHidden && s.paused, 'lost: loop held, restoring page up, canvas hidden, paused');
  await wait(1500);
  await page.evaluate(() => { window.__lx.restoreContext(); });
  await wait(5000);
  s = await state(page);
  await shot(page, 'c3-restored');
  check(s?.lost === false && !s.hold && s.page === null && !s.canvasHidden && s.calls > 0 && s.paused, 'restored in place: drawing again, under the pause menu');
  const hide = (hidden) => page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent(h ? 'pagehide' : 'pageshow', { persisted: true }));
  }, hidden);
  await page.evaluate(() => { window.__world.hud.setPaused(false); });
  await wait(300);
  await hide(true); await wait(800);
  s = await state(page);
  check(s?.paused === true && s.canvasHidden, 'hide: paused into the menu, canvas hidden');
  await hide(false); await wait(1500);
  s = await state(page);
  await shot(page, 'c4-shown');
  check(s?.paused === true && !s.canvasHidden && s.calls > 0, 'show: canvas back, drawing, menu up');
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
  console.log('── webkit: GPU process killed (reload where the player stood) ──');
  const { browser, page } = await open(webkit, []);
  await page.evaluate(() => { const p = window.__world.player; p.position.set(6, 2, -215); p.yaw = 2.6; window.__e54 = 1; }); // __e54: gone once the page reloads
  await wait(1500);
  const a = await state(page);
  await shot(page, 'w1-before');
  const gpu = execSync('ps -axo pid,command').toString().split('\n').filter((l) => l.includes('ms-playwright/webkit') && l.includes('WebKit.GPU'));
  check(gpu.length > 0, `found WebKit's GPU process (${gpu.length})`);
  for (const l of gpu) process.kill(Number(l.trim().split(/\s+/)[0]), 'SIGKILL');
  await wait(150);
  await shot(page, 'w2-lost').catch(() => undefined);
  await page.waitForFunction(() => window.__e54 === undefined && window.__world !== undefined, null, { timeout: 300_000, polling: 500 }).catch(() => undefined);
  await wait(3000);
  const b = await state(page);
  await shot(page, 'w3-reloaded');
  const url = await page.evaluate(() => location.search);
  check(b !== null && !b.lost && b.calls > 0, 'reloaded and drawing');
  check(a !== null && b !== null && Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]) < 1.5 && Math.abs(b.yaw - a.yaw) < 0.05, `same spot: ${JSON.stringify(a?.pos)} → ${JSON.stringify(b?.pos)}`);
  check(!/glreload|at=/.test(url), `address cleaned (${url})`);
  await browser.close();
}
console.log(`shots: ${out}`);
process.exit(failed);
