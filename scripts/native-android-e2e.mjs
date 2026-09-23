#!/usr/bin/env node
/**
 * Headless Android E2E (docs/plans/NATIVE-APPS.md N-B). Boots a task-owned emulator with no window, installs the
 * debug APK (scripts/native-android.sh debug), and drives the real app:
 *
 *   1. offline cold boot → the title (airplane mode on: the game must never need the network)
 *   2. ENTER WORLD (a real `adb input tap` on the button's on-screen rect) → in the world
 *   3. Android Back → the pause menu opens (ws:back); Back again → it closes
 *   4. Home → relaunch → still paused (ws:background)
 *   5. saves survive WebView storage eviction: write a `ws.*` key, force-stop, delete the WebView's localStorage on
 *      disk (what the OS may do under storage pressure), relaunch → the key is back (the Preferences mirror)
 *
 * The page is observed (and located) through the debuggable WebView's DevTools socket with a minimal CDP client
 * (Runtime.evaluate over the WebSocket — Playwright's connectOverCDP needs browser-level CDP a WebView lacks);
 * every input is a native adb event. Screens → .native-build/android-e2e/*.png, a JSON report beside them.
 *   node scripts/native-android-e2e.mjs [--apk path] [--avd wildshard_api36] [--gpu host|swiftshader_indirect]
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({ options: {
  apk: { type: 'string', default: 'android/app/build/outputs/apk/debug/app-debug.apk' },
  avd: { type: 'string', default: 'wildshard_api36' },
  gpu: { type: 'string', default: 'host' },
  port: { type: 'string', default: '5580' },
} });
const PKG = 'com.jakeverbaten.wildshard_singleplayer';
const SDK = process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
const SERIAL = `emulator-${opt.port}`;
const OUT = '.native-build/android-e2e';
mkdirSync(OUT, { recursive: true });

// every adb call is bounded: a wedged emulator must fail the run, not hang it (installs get longer)
const adb = (...args) => execFileSync(join(SDK, 'platform-tools/adb'), ['-s', SERIAL, ...args], { encoding: 'utf8', timeout: args[0] === 'install' ? 300_000 : 60_000 }).trim();
const shot = (name) => { writeFileSync(join(OUT, `${name}.png`), execFileSync(join(SDK, 'platform-tools/adb'), ['-s', SERIAL, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20, timeout: 60_000 })); };
const report = { serial: SERIAL, avd: opt.avd, gpu: opt.gpu, steps: [] };
const step = (name, ok, detail = {}) => { report.steps.push({ name, ok, ...detail }); console.info(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(detail)); if (!ok) throw new Error(`step failed: ${name}`); };

async function waitFor(fn, ms, every = 1000) {
  const end = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* not yet */ }
    if (Date.now() > end) return null;
    await sleep(every);
  }
}

/** CDP session on the app's WebView page (the socket name carries the app's pid, so re-resolve after relaunch). */
async function attach() {
  const pid = await waitFor(() => adb('shell', 'pidof', PKG), 30_000);
  if (!pid) throw new Error('app not running');
  const sock = await waitFor(() => adb('shell', 'cat', '/proc/net/unix').includes(`webview_devtools_remote_${pid}`), 60_000);
  if (!sock) throw new Error('no WebView devtools socket (is this the debug APK?)');
  execFileSync(join(SDK, 'platform-tools/adb'), ['-s', SERIAL, 'forward', 'tcp:9335', `localabstract:webview_devtools_remote_${pid}`]);
  const target = await waitFor(async () => {
    const list = await (await fetch('http://127.0.0.1:9335/json')).json();
    return list.find((t) => t.type === 'page' && t.url.startsWith('https://localhost'));
  }, 30_000);
  if (!target) throw new Error('no app page over CDP');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => { const msg = JSON.parse(String(m.data)); pending.get(msg.id)?.(msg); pending.delete(msg.id); };
  /** page.evaluate(fn, arg): runs `(fn)(arg)` in the page, awaits it, returns the JSON value */
  const evaluate = (fn, arg) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) => {
      if (msg.error || msg.result?.exceptionDetails) reject(new Error(JSON.stringify(msg.error ?? msg.result.exceptionDetails)));
      else resolve(msg.result?.result?.value);
    });
    ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression: `(${fn})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true } }));
  });
  return { browser: { close: () => { ws.close(); } }, page: { evaluate } };
}

/** A native tap at the centre of `selector` (CSS px → device px via devicePixelRatio). */
async function tapEl(page, selector) {
  const r = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, dpr: devicePixelRatio }; }, selector);
  if (!r) throw new Error(`no element ${selector}`);
  adb('shell', 'input', 'tap', String(Math.round(r.x * r.dpr)), String(Math.round(r.y * r.dpr)));
}

/** the uncaught-exception modal (src/ui/ErrorModal.ts) is on screen — any step that shows it fails */
const errorShown = (page) => page.evaluate(() => { const e = document.querySelector('#ws-error'); return e !== null && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; });
const menuOpen = (page) => page.evaluate(() => { const m = document.querySelector('.ws-gmenu'); return m !== null && getComputedStyle(m).pointerEvents !== 'none' && getComputedStyle(m).opacity !== '0'; });
const launch = () => adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);

const emu = spawn(join(SDK, 'emulator/emulator'), ['-avd', opt.avd, '-port', opt.port, '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot', '-gpu', opt.gpu], { stdio: 'ignore' });
let exitCode = 0;
try {
  const booted = await waitFor(() => adb('shell', 'getprop', 'sys.boot_completed') === '1', 240_000, 2000);
  step('emulator booted', booted !== null);
  adb('shell', 'settings', 'put', 'global', 'window_animation_scale', '0');
  adb('shell', 'settings', 'put', 'secure', 'immersive_mode_confirmations', 'confirmed'); // the one-time "Viewing full screen" notice eats the first tap
  console.info('installing', opt.apk);
  adb('install', '-r', '-g', opt.apk);
  console.info('installed');
  adb('shell', 'pm', 'clear', PKG);
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  adb('shell', 'svc', 'wifi', 'disable'); adb('shell', 'svc', 'data', 'disable');

  // 1. offline cold boot → title
  const t0 = Date.now();
  launch();
  let { browser, page } = await attach();
  // the title's buttons exist under the loading panel, so "booted" = the panel (.ws-load) is gone and ENTER WORLD is laid out
  const title = await waitFor(() => page.evaluate(() => document.querySelector('.ws-load') === null && (document.querySelector('.ws-menu-enter')?.getBoundingClientRect().width ?? 0) > 0), 600_000, 2000);
  const webgl2 = await page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
  // after the boot the updater asks its channel for a newer bundle (src/native/ota.ts) — expected, and it fails offline
  const requests = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !n.startsWith('https://localhost')));
  const otaChecks = requests.filter((n) => n.startsWith('https://wildshard-updates.vercel.app/'));
  const external = requests.filter((n) => !otaChecks.includes(n));
  shot('1-title');
  step('offline cold boot reaches the title', title !== null && external.length === 0, { seconds: Math.round((Date.now() - t0) / 1000), webgl2, externalRequests: external, otaChecks });

  // 2. ENTER WORLD by native tap
  await tapEl(page, '.ws-menu-enter');
  const entered = await waitFor(() => page.evaluate(() => !document.querySelector('#hud')?.classList.contains('intro')), 30_000);
  await sleep(10_000);
  shot('2-in-world');
  const crashed = await errorShown(page);
  step('ENTER WORLD tap enters the world (no error modal)', entered !== null && !crashed, { errorModal: crashed });

  // 3. Android Back → pause menu; Back → closed
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  const paused = await waitFor(() => menuOpen(page), 10_000, 300);
  shot('3-back-paused');
  step('Back opens the pause menu', paused !== null);
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  const closed = await waitFor(async () => !(await menuOpen(page)), 10_000, 300);
  step('Back again closes it', closed !== null);

  // 4. Home → relaunch → paused
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await sleep(3000);
  launch();
  await sleep(3000);
  const stillPaused = await waitFor(() => menuOpen(page), 10_000, 300);
  shot('4-back-from-home');
  step('coming back from Home lands paused (no error modal)', stillPaused !== null && !(await errorShown(page)));

  // 5. saves survive WebView localStorage eviction
  const stamp = `e2e-${Date.now()}`;
  await page.evaluate((v) => { localStorage.setItem('ws.e2e', v); }, stamp);
  await sleep(1500); // the mirror write is async
  browser.close();
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'run-as', PKG, 'rm', '-rf', 'app_webview/Default/Local Storage');
  launch();
  ({ browser, page } = await attach());
  const restored = await waitFor(() => page.evaluate(() => localStorage.getItem('ws.e2e')), 60_000);
  step('a save survives WebView storage eviction', restored === stamp, { restored });
  await waitFor(() => page.evaluate(() => document.querySelector('.ws-load') === null), 600_000, 2000);
  shot('5-relaunched');
  browser.close();
} catch (error) {
  exitCode = 1;
  report.error = String(error);
  console.error(error);
} finally {
  writeFileSync(join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  try { adb('emu', 'kill'); } catch { emu.kill(); }
}
process.exit(exitCode);
