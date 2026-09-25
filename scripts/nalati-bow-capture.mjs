#!/usr/bin/env node
// nalati-bow-capture.mjs — NALATI-MERGE H4 (the user's ask N18) evidence: the bow's hold-to-draw / release-to-loose /
// let-down / AIM-zoom flow in the real build, phone portrait (390×844, `&touch=1&tier=phone`, real CDP touches on the
// FIRE and AIM discs) and desktop (1280×720, LMB hold / RMB toggle), plus mounted archery and the saddle's horse head.
//
//   node scripts/nalati-bow-capture.mjs [--url=http://127.0.0.1:5195] [--out=progress/nalati-merge/h4] [--frames=<dir>] [--only=phone,desk,saddle]
//
// Frames (each also logs the bow's numbers: draw, quiver, stuck arrows, FOV, AIM):
//   phone  draw-mid (FIRE held 0.3 s, frozen by a hit-stop) · letdown (lifted early: no arrow, the string easing back)
//          full (the ring closed) · loose (lifted at full: the arrow away) · aim-draw (AIM tapped on: zoomed down the
//          arrow, drawn) · aim-off (AIM tapped off) · mounted-draw / mounted-loose (?ride=gallop, galloping)
//   desk   desk-draw-mid · desk-letdown · desk-aim-draw (RMB) · desk-loose
//   saddle saddle-bridge (H2's shot: galloping onto the Kunes bridge with the sabre) — the horse's head on the deck
// → <out>/sheet.jpg (JPEG, kept < 500 KB). Headless, muted (--mute-audio + &mute=1), on Metal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5195');
const OUT = resolvePath(flag('out', 'progress/nalati-merge/h4'));
const ONLY = flag('only', 'phone,desk,saddle').split(',');
const FRAMES = resolvePath(flag('frames', OUT)); // the single frames (only the sheet is committed)
mkdirSync(OUT, { recursive: true }); mkdirSync(FRAMES, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const NAL = 'chunk=nalati-grasslands&time=day&mute=1&nolock=1&skipintro=1';

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = []; // { name, b64, kind: 'phone' | 'desk', note }
try {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const desk = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const open = async (ctx, q, ready) => {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(ready ?? (() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro')), undefined, { timeout: 300000, polling: 1000 });
    await sleep(3000);
    await page.evaluate(() => { const ws = window.__world.weapons; ws.select('bow', true); });
    await sleep(600);
    return { page, errors };
  };
  const bowState = (page) => page.evaluate(() => {
    const w = window.__world, b = w.nalati?.kit?.bow ?? w.weapons.get('bow');
    const kb = w.weapons.current;
    const r = (v) => Math.round(v * 100) / 100;
    return { draw: r(kb.charge ?? 0), quiver: kb.state.ammo, aim: [w.weapons.adsHeld, w.nalati?.kit?.bow?.aimOn === true, r(w.game.camera.fov) < 60].some(Boolean), fov: r(w.game.camera.fov), stuck: b?.stuckCount ?? null, fire: document.querySelector('.ws-touch-attack')?.className.replace('ws-touch-attack', '').trim() ?? '' };
  });
  const shoot = async (page, name, kind, errors, note = '') => {
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    writeFileSync(resolvePath(FRAMES, `${name}.jpg`), buf);
    const s = await bowState(page);
    const line = `draw ${s.draw} · quiver ${s.quiver} · aim ${s.aim ? 'on' : 'off'} · fov ${s.fov}${s.stuck === null ? '' : ` · stuck ${s.stuck}`}${s.fire ? ` · FIRE .${s.fire.split(/\s+/).join('.')}` : ''}`;
    console.log(`${name.padEnd(15)} ${line}${note ? `  — ${note}` : ''}${errors.length > 0 ? `  page errors: ${errors.slice(0, 2).join(' | ')}` : ''}`);
    shots.push({ name, kind, b64: buf.toString('base64'), note: note || line });
    return s;
  };
  const freeze = (page, s) => page.evaluate((sec) => { window.__world.game.hitStop(sec); }, s);
  // real touches (CDP), so the discs get real pointer events with capture
  const touchKit = async (page) => {
    const cdp = await page.context().newCDPSession(page);
    const centre = (sel) => page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    return {
      down: async (sel, id = 1) => { const c = await centre(sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id }] }); },
      up: async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
      tap: async (sel) => { const c = await centre(sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 5 }] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    };
  };
  const FIRE = '.ws-touch-attack', AIM = '.ws-touch-disc.aim';

  if (ONLY.includes('phone')) {
    const { page, errors } = await open(phone, `${NAL}&touch=1&tier=phone`);
    const t = await touchKit(page);
    await t.down(FIRE); await sleep(300); await freeze(page, 3);
    await shoot(page, 'draw-mid', 'phone', errors, 'FIRE held 0.3 s — the ring part-filled');
    await t.up(); await sleep(150);
    await shoot(page, 'letdown', 'phone', errors, 'lifted early: no arrow, the string eases back');
    await sleep(3500);
    await t.down(FIRE); await sleep(1100);
    await shoot(page, 'full', 'phone', errors, 'held to full: the ring closed');
    await t.up(); await sleep(40); await freeze(page, 1.5);
    await shoot(page, 'loose', 'phone', errors, 'lifted at full: the arrow away');
    await sleep(2500);
    await t.tap(AIM); await sleep(800);
    await t.down(FIRE); await sleep(1100);
    await shoot(page, 'aim-draw', 'phone', errors, 'AIM on: zoomed down the arrow, drawn');
    await t.up(); await sleep(900);
    await t.tap(AIM); await sleep(800);
    await shoot(page, 'aim-off', 'phone', errors, 'AIM tapped off: back to the hip view');
    await page.close();

    const m = await open(phone, `${NAL}&touch=1&tier=phone&ride=gallop`, () => window.__world?.ride?.mounted === true);
    const mt = await touchKit(m.page);
    await m.page.evaluate(() => { const w = window.__world; w.weapons.select('bow', true); w.ride.mount.touchGallop = true; w.player.touchMove.y = 1; });
    await sleep(2500);
    await mt.down(FIRE); await sleep(1300);
    await shoot(m.page, 'mounted-draw', 'phone', m.errors, 'galloping, drawn (0.9 s draw from the saddle)');
    await mt.up(); await sleep(40); await freeze(m.page, 1.5);
    await shoot(m.page, 'mounted-loose', 'phone', m.errors, 'loosed at the gallop');
    await m.page.close();
  }

  if (ONLY.includes('desk')) {
    const { page, errors } = await open(desk, NAL);
    await page.mouse.move(640, 360);
    await page.mouse.down({ button: 'left' }); await sleep(300); await freeze(page, 3);
    await shoot(page, 'desk-draw-mid', 'desk', errors, 'LMB held 0.3 s');
    await page.mouse.up({ button: 'left' }); await sleep(150);
    await shoot(page, 'desk-letdown', 'desk', errors, 'LMB up early: let down, no arrow');
    await sleep(3500);
    await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await sleep(800);
    await page.mouse.down({ button: 'left' }); await sleep(1100);
    await shoot(page, 'desk-aim-draw', 'desk', errors, 'RMB toggled AIM on, LMB held to full');
    await page.mouse.up({ button: 'left' }); await sleep(40); await freeze(page, 1.5);
    await shoot(page, 'desk-loose', 'desk', errors, 'LMB up at full: the loose (aimed)');
    await page.close();
  }

  if (ONLY.includes('saddle')) {
    // H2's saddle shot, on the Kunes bridge (the sabre, galloping north from ?ride=gallop): the horse's head and ears must
    // be in the frame on the deck too (Animal.levelGround — the body no longer pitches to the gully under the deck)
    const { page, errors } = await open(phone, `${NAL}&touch=1&tier=phone&ride=gallop`, () => window.__world?.ride?.mounted === true);
    await page.evaluate(() => { const w = window.__world; w.weapons.select('sabre', true); w.ride.mount.touchGallop = true; w.player.touchMove.y = 1; });
    await page.waitForFunction(() => window.__world.ride.mount.horse?.levelGround === true, undefined, { timeout: 15000, polling: 50 }).catch(() => { console.log('never reached the bridge'); });
    await sleep(350);
    const info = await page.evaluate(() => {
      const w = window.__world, m = w.ride.mount, h = m.horse, cam = w.game.camera;
      const r = (v) => Math.round(v * 100) / 100;
      const fwd = -((cam.position.x - h.position.x) * Math.sin(h.yaw) + (cam.position.z - h.position.z) * Math.cos(h.yaw)); // + = the eye behind the horse's origin
      return { gait: m.gait, onBridge: h.levelGround, eyeBehind: r(fwd), eyeUp: r(cam.position.y - h.position.y), bodyPitchDeg: r(h.mesh.rotation.x * 57.3) };
    });
    await shoot(page, 'saddle-bridge', 'phone', errors, `on the bridge deck at a gallop — ${JSON.stringify(info)}`);
    await page.close();
  }

  // ── the sheet: phone frames 4 to a row (0.75×), desktop frames 2 to a row, a caption over each ──
  const pg = await desk.newPage();
  const make = (q) => pg.evaluate(async ({ list, q: quality }) => {
    const PS = 0.75, PW = 390 * PS, PH = 844 * PS, DW = 584, DH = 328, CAP = 34, GAP = 8, PER = 4;
    const ph = list.filter((s) => s.kind === 'phone'), dk = list.filter((s) => s.kind === 'desk');
    const W = PER * (PW + GAP);
    const H = Math.ceil(ph.length / PER) * (PH + CAP) + Math.ceil(dk.length / 2) * (DH + CAP);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, W, H);
    const cap = (text, sub, x, y, w) => {
      g.fillStyle = '#8fe3ff'; g.font = 'bold 13px monospace'; g.fillText(text.toUpperCase(), x + 6, y + 14);
      g.fillStyle = '#c8d6de'; g.font = '10px monospace';
      let s = sub; while (g.measureText(s).width > w - 12 && s.length > 4) s = s.slice(0, -2);
      g.fillText(s === sub ? s : `${s}…`, x + 6, y + 28);
    };
    let y = 0;
    for (let i = 0; i < ph.length; i++) {
      const x = (i % PER) * (PW + GAP); if (i > 0 && i % PER === 0) y += PH + CAP;
      const im = new Image(); im.src = `data:image/jpeg;base64,${ph[i].b64}`; await im.decode();
      g.drawImage(im, x, y + CAP, PW, PH); cap(ph[i].name, ph[i].note, x, y, PW);
    }
    if (ph.length > 0) y += PH + CAP;
    for (let i = 0; i < dk.length; i++) {
      const x = (i % 2) * (DW + GAP); if (i > 0 && i % 2 === 0) y += DH + CAP;
      const im = new Image(); im.src = `data:image/jpeg;base64,${dk[i].b64}`; await im.decode();
      g.drawImage(im, x, y + CAP, DW, DH); cap(dk[i].name, dk[i].note, x, y, DW);
    }
    return cv.toDataURL('image/jpeg', quality).slice('data:image/jpeg;base64,'.length);
  }, { list: shots, q });
  let quality = 0.72, buf = Buffer.from(await make(quality), 'base64');
  while (buf.length > 490 * 1024 && quality > 0.3) { quality -= 0.08; buf = Buffer.from(await make(quality), 'base64'); }
  const file = resolvePath(OUT, 'sheet.jpg');
  writeFileSync(file, buf);
  console.log(`${file}  (${Math.round(buf.length / 1024)} KB, q ${quality.toFixed(2)})`);
  await pg.close();
} finally {
  await browser.close();
}
