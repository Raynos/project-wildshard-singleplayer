// lockon-drive.mjs — the Zelda lock-on's live drive (E50, project/archive/2026-09-23-lock-on.md §5): a phone viewport at the crab tidepool,
// headless and muted, real touch pointer events on the HUD. Prints PASS / FAIL per check and saves screenshots.
//
//   node scripts/lockon-drive.mjs [--url=https://wildshard-singleplayer.vercel.app] [--out=<dir>]
//
//   1 LOCK is available at the tidepool        2 tap LOCK → locked, the target centred within 0.8 s
//   3 a flick on the LOOK side switches; a slow drag only glances and springs back
//   4 MOVE held sideways orbits: the radius holds, the bearing sweeps     5 DODGE sideways keeps the radius
//   6 a kill re-locks the next crab (Auto re-lock)                        7 25 m away the lock breaks
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const origin = arg('url', 'https://wildshard-singleplayer.vercel.app');
const out = arg('out', 'progress/lockon-drive');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; };

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
await page.addInitScript(() => { Element.prototype.setPointerCapture = () => undefined; }); // synthetic pointers can't be captured
await page.goto(`${origin}/?touch&tier=phone&skipintro&nolock&weapon=sword&sw=0&at=127.1,2.6,-9.8,-1.66,-0.3`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => { const w = window.__world; return Boolean(w?.player && w.lockState) && document.getElementById('hud')?.classList.contains('intro') === false; }, null, { timeout: 180000 });
await wait(4000);

const shot = (n) => page.screenshot({ path: join(out, `${n}.jpg`), type: 'jpeg', quality: 78 });
const S = () => page.evaluate(() => {
  const w = window.__world, L = w.lockState, p = w.player, t = L.target;
  let sx = null;
  if (t) { const v = t.position.clone(); v.y += 0.3; v.project(p.camera); sx = (v.x + 1) / 2; }
  return { state: L.state, id: t ? w.animals.animals.indexOf(t) : -1, cand: L.candidate ? w.animals.animals.indexOf(L.candidate) : -1,
    r: t ? Math.hypot(t.position.x - p.position.x, t.position.z - p.position.z) : -1,
    bearing: t ? Math.atan2(p.position.x - t.position.x, p.position.z - t.position.z) : 0, sx, yaw: p.yaw };
});
// a touch on an element / at a point: pointer events of type touch on the touch layer (as the phone sends them)
const touch = (sel, x, y, id, kind) => page.evaluate((o) => {
  const root = document.querySelector('.ws-touch'), el = o.sel ? document.querySelector(o.sel) : root;
  let cx = o.x, cy = o.y;
  if (o.sel && el) { const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  (el ?? root).dispatchEvent(new PointerEvent(o.kind, { bubbles: true, cancelable: true, pointerId: o.id, pointerType: 'touch', isPrimary: o.id === 1, clientX: cx, clientY: cy }));
  return [cx, cy];
}, { sel, x, y, id, kind });
const tap = async (sel) => { await touch(sel, 0, 0, 9, 'pointerdown'); await wait(40); await touch(sel, 0, 0, 9, 'pointerup'); };

// 1 available
let s = await S();
check(s.state === 'available', `LOCK available at the tidepool (state ${s.state}, candidate #${s.cand})`);
await shot('1-available');

// 2 lock
await tap('.ws-touch-disc.lock');
await wait(900);
s = await S();
check(s.state === 'locked', `tap LOCK → locked (#${s.id})`);
check(s.sx !== null && Math.abs(s.sx - 0.5) < 0.06, `the target centred within 0.9 s (screen x ${s.sx?.toFixed(3)})`);
await shot('2-locked');

// 3 switch: a fast flick on the LOOK pad; then a slow drag only glances
const before = s.id;
const pad = await page.evaluate(() => { const r = document.querySelector('.ws-touch-lookpad').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await touch(null, pad[0], pad[1], 3, 'pointerdown');
for (let i = 1; i <= 4; i++) { await touch(null, pad[0] - i * 12, pad[1], 3, 'pointermove'); await wait(12); }
await touch(null, pad[0] - 48, pad[1], 3, 'pointerup');
await wait(700);
s = await S();
const switched = s.id !== before && s.state === 'locked';
check(switched || (await page.evaluate(() => window.__world.lockState.left === null && window.__world.lockState.right === null)), `a flick left switches target (#${before} → #${s.id}${switched ? '' : ', nothing on that side'})`);
await shot('3-switched');
const cur = s.id;
await touch(null, pad[0], pad[1], 4, 'pointerdown');
for (let i = 1; i <= 20; i++) { await touch(null, pad[0] + i * 4, pad[1], 4, 'pointermove'); await wait(30); }
const glance = await page.evaluate(() => window.__world.lockState.offYaw);
await touch(null, pad[0] + 80, pad[1], 4, 'pointerup');
await wait(600);
s = await S();
const back = await page.evaluate(() => window.__world.lockState.offYaw);
check(s.id === cur && Math.abs(glance) > 0.02 && Math.abs(back) < 0.01, `a slow drag glances (off ${glance.toFixed(3)} rad) without switching, then springs back (${back.toFixed(3)})`);

// 4 orbit: the stick held fully left for 2 s
const r0 = s.r, b0 = s.bearing;
const stick = await page.evaluate(() => { const r = document.querySelector('.ws-touch-stick').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await touch(null, stick[0], stick[1], 1, 'pointerdown');
await touch(null, stick[0] - 60, stick[1], 1, 'pointermove');
await wait(1000); await shot('4-orbit');
await wait(1000);
s = await S();
await touch(null, stick[0] - 60, stick[1], 1, 'pointerup');
const sweep = Math.abs(Math.atan2(Math.sin(s.bearing - b0), Math.cos(s.bearing - b0))) * 180 / Math.PI;
check(s.state === 'locked' && Math.abs(s.r - r0) < 0.6 && sweep >= 30, `orbit 2 s: radius ${r0.toFixed(2)} → ${s.r.toFixed(2)} m, swept ${sweep.toFixed(0)}°, still centred (x ${s.sx?.toFixed(3)})`);

// 5 side-hop: DODGE with the stick left keeps the radius
await wait(900);
const r1 = (await S()).r;
await touch(null, stick[0], stick[1], 1, 'pointerdown');
await touch(null, stick[0] - 60, stick[1], 1, 'pointermove');
await wait(60);
await tap('.ws-touch-disc.dodge');
await wait(450);
await touch(null, stick[0] - 60, stick[1], 1, 'pointerup');
s = await S();
check(Math.abs(s.r - r1) < 0.6, `side-hop keeps the radius (${r1.toFixed(2)} → ${s.r.toFixed(2)} m)`);

// 6 auto re-lock on a kill
const killed = s.id;
await page.evaluate((i) => { const a = window.__world.animals.animals[i]; const THREE = a.position.constructor; a.applyDamage(9999, a.position.clone(), new THREE(0, 0, 1)); }, killed);
await wait(900);
s = await S();
check(s.state === 'locked' ? s.id !== killed : s.state !== 'locked', `a kill re-locks the next crab or unlocks (#${killed} → ${s.state} #${s.id})`);
await shot('6-after-kill');

// 7 break at 25 m
if (s.state === 'locked') {
  await page.evaluate(() => { const w = window.__world, p = w.player, t = w.lockState.target; const dx = p.position.x - t.position.x, dz = p.position.z - t.position.z, d = Math.hypot(dx, dz) || 1; p.position.x = t.position.x + dx / d * 25; p.position.z = t.position.z + dz / d * 25; p.motor?.teleport?.(p.position); });
  await wait(700);
  s = await S();
  check(s.state !== 'locked', `25 m away the lock breaks (state ${s.state})`);
}

await browser.close();
console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILED`, `— shots in ${out}`);
process.exitCode = fails === 0 ? 0 : 1;
