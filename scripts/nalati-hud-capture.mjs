#!/usr/bin/env node
// nalati-hud-capture.mjs — NALATI-MERGE H2 / H3: the phone HUD (layout D, art/hud/round-12-nalati-merge/D-*.jpg) captured
// in the real build (since E154 the base HUD every shard shares, src/ui/hudSlots.ts), one scene per frame, plus the live rect of every HUD element (<scene>-rects.json), and a side-by-side
// sheet (engine | mockup) of the scenes that have a mockup.
//
//   node scripts/nalati-hud-capture.mjs [--url=http://127.0.0.1:5188] [--out=progress/nalati-merge/h2] [--tag=now]
//                                        [--scenes=foot,saddle,lock,storm,boss,titan,spear,pine,drift] [--desktop]
//                                        [--compose=lock,saddlelock,storm,boss,titan,spear]   (a contact sheet of shots already taken)
//
// Scenes (phone portrait 390×844 at 2×, touch, muted, Metal):
//   foot    on foot, the bow held, crouched in long grass, a storm coming — vs D-foot.jpg
//   saddle  galloping on the camp horse with the sabre, AQBARS THE PALE's banner (?elite=aqbars) — vs D-saddle.jpg
//   lock    on foot with the sabre, LOCK on Kokbori's pack (H3)
//   saddlelock   the same in the saddle
//   storm   in the storm (?weather=storm), the sabre, LIGHTNING — GET LOW up, the lock-on tried on a wolf
//   boss    the Golden King's fight (?boss=golden-king), the sabre, locked on
//   titan   Jel Ata (?boss=storm-titan): mounted, the storm, the boss bar, GET LOW — the stress frame
//   spear   on foot with the spear in long grass (THROW / BRACE / CROUCH / LOCK)
//   pine / drift   Pine Hollow and Driftwood Isle's HUD, to prove they did not move
// Every page is muted (--mute-audio + &mute=1) and rendered on Metal; the browser is closed at the end.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const OUT = resolvePath(flag('out', 'progress/nalati-merge/h2'));
const TAG = flag('tag', 'now');
const DESKTOP = argv.includes('--desktop');
const SCENES = flag('scenes', 'foot,saddle,storm,boss,titan').split(',').filter((x) => x !== '');
// `--compose=lock,storm,…`: no browser game — only lay the already-captured <tag>-<scene>.jpg out as one contact sheet
// (<tag>-scenes.jpg, or scenes.jpg for the default tag), 3 per row at half size, captioned
const COMPOSE = flag('compose', '').split(',').filter((x) => x !== '');
mkdirSync(OUT, { recursive: true });
const MOCKUP = { foot: 'art/hud/round-12-nalati-merge/D-foot.jpg', saddle: 'art/hud/round-12-nalati-merge/D-saddle.jpg' };

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const RECT_SEL = {
  pause: '.ws-touch-pause', status: '.ws-touch-status', vitals: '.ws-game-vitals', bolts: '.ws-game-bolts',
  steed: '.ws-ride-steed.ws-ride-touch', hidden: '.ws-stealth-row', grass: '.ws-stealth-grassrow', pip: '.ws-stealth-pip', note: '.ws-fb-disc', journal: '.ws-cmp-disc',
  minimap: '.ws-minimap', day: '.ws-minimap-day', quest: '.ws-quest-obj', weather: '.ws-game-weather', getlow: '.ws-game-getlow',
  eliteBar: '.ws-elite-bar', eliteBanner: '.ws-elite-banner', bossBar: '.ws-boss-bar', strip: '.ws-touch-strip', pill: '.ws-touch-pill',
  horse: '.ws-ride-horse', hover: '.ws-touch-hover', aim: '.ws-touch-disc.aim', lock: '.ws-touch-disc.lock', dodge: '.ws-touch-disc.dodge',
  jump: '.ws-touch-disc.jump', crouch: '.ws-stealth-crouch', throw: '.ws-touch-disc.throw', brace: '.ws-touch-disc.brace',
  gallop: '.ws-ride-gallop', attack: '.ws-touch-attack', lookpad: '.ws-touch-lookpad', use: '.ws-touch-use',
};
const q = (base) => `${URL_BASE}/?${base}&mute=1&nolock=1&skipintro=1${DESKTOP ? '' : '&touch=1&tier=phone'}`;
const NAL = 'chunk=nalati-grasslands';

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = {};
try {
  const ctx = await browser.newContext(DESKTOP ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const open = async (url, ready) => {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(ready ?? (() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro')), undefined, { timeout: 300000, polling: 1000 });
    await sleep(3000);
    return { page, errors };
  };
  const select = (page, id) => page.evaluate((w) => { const ws = window.__world.weapons; ws.unlock?.(w); ws.select(w, true); }, id);
  const toGrass = (page) => page.evaluate(() => {
    const w = window.__world, s = window.__stealth, p = w.player.position;
    let best = null;
    // a tall stand near the spawn (HIDDEN needs cover ≥ 0.85 crouched: ≥ ~0.92 m of grass) with no wolf or horse within
    // 100 m (anything that notices you reads NOTICED / DETECTED instead), else any long grass
    const quiet = (x, z) => !w.animals.animals.some((a) => a.alive && (a.kind === 'wolf' || a.kind === 'horse' || a.kind === 'kokbori') && Math.hypot(a.position.x - x, a.position.z - z) < 100);
    const tall = (x, z, need) => Math.min(s.grassAt(x, z), s.grassAt(x + 1.5, z), s.grassAt(x - 1.5, z), s.grassAt(x, z + 1.5), s.grassAt(x, z - 1.5)) >= need;
    for (const [need, calm] of [[1.0, true], [0.95, true], [1.0, false]]) for (let r = 4; r < 320 && best === null; r += 3) for (let a = 0; a < 36; a++) {
      const x = p.x + Math.cos(a / 36 * Math.PI * 2) * r, z = p.z + Math.sin(a / 36 * Math.PI * 2) * r;
      if (tall(x, z, need) && (!calm || quiet(x, z))) { best = { x, z }; break; }
    }
    if (best !== null) w.player.spawn(best.x, best.z, w.player.yaw);
    return best;
  });
  const rects = (page) => page.evaluate((sel) => {
    const out = {};
    for (const [k, s] of Object.entries(sel)) {
      const all = [...document.querySelectorAll(s)].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05; });
      if (all.length === 0) continue;
      const r = all[0].getBoundingClientRect();
      out[k] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), (all[0].textContent ?? '').replaceAll(/\s+/g, ' ').trim().slice(0, 40)];
    }
    return out;
  }, RECT_SEL);
  const shoot = async (name, page, errors) => {
    const file = resolvePath(OUT, `${TAG}-${name}${DESKTOP ? '-desktop' : ''}.jpg`);
    const buf = await page.screenshot({ type: 'jpeg', quality: 72 });
    writeFileSync(file, buf);
    const r = await rects(page);
    writeFileSync(resolvePath(OUT, `${TAG}-${name}${DESKTOP ? '-desktop' : ''}-rects.json`), JSON.stringify(r, null, 1));
    shots[name] = buf.toString('base64');
    console.log(`${file}  (${Math.round(buf.length / 1024)} KB)${errors.length > 0 ? `  page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    for (const [k, v] of Object.entries(r)) console.log(`   ${k.padEnd(12)} ${v.slice(0, 4).join(', ').padEnd(22)} ${v[4]}`);
  };

  // a storm chip / GET LOW for the frame: weather.ts only sends on a change, so the event stays until its next tick
  const weatherNow = (page, chip, getLow) => page.evaluate(({ c, g }) => { document.dispatchEvent(new CustomEvent('ws:weather', { detail: { chip: c, getLow: g } })); }, { c: chip, g: getLow });
  // turn the view onto the nearest live wolf / elite / rider / balbal / king in the aim list (what LOCK should take)
  const faceHostile = (page) => page.evaluate(() => {
    const w = window.__world, p = w.player, kinds = new Set(['wolf', 'kokbori', 'leopard', 'eagle', 'ghost-rider', 'balbal', 'golden-king', 'storm-titan']);
    let best = null, bd = Infinity;
    for (const a of w.animals.animals) { if (!a.alive || !kinds.has(a.kind)) continue; const d = Math.hypot(a.position.x - p.position.x, a.position.z - p.position.z); if (d < bd) { bd = d; best = a; } }
    if (best === null) return 'none';
    p.yaw = Math.atan2(-(best.position.x - p.position.x), -(best.position.z - p.position.z)); p.pitch = 0;
    return `${best.kind} ${bd.toFixed(1)} m`;
  });
  // LOCK (the J disc's toggle) until it holds or 5 tries (a cinematic / a swap can eat a tap); the state it ends in
  const lockUntil = async (page) => {
    for (let i = 0; i < 5; i++) {
      const st = await page.evaluate(() => { const w = window.__world; if (w.lockState.state !== 'locked') w.lockSys.toggle(); return w.lockState.state; });
      if (st === 'locked') break;
      await sleep(700);
    }
    return page.evaluate(() => `${window.__world.lockState.state} on ${window.__world.lockState.target?.kind ?? '-'}`);
  };
  const run = async (scene) => {
    if (scene === 'foot') {
      const { page, errors } = await open(q(`${NAL}&time=day&weapon=bow`));
      await select(page, 'bow');
      await toGrass(page);
      await sleep(1600);
      await page.evaluate(() => { window.__stealth.latched = true; window.__world.player.pitch = 0.05; });
      await sleep(3500);
      await weatherNow(page, { title: 'Storm in 0:45', sub: 'Wind 14 m/s', tone: 'soon' }, false);
      await sleep(400);
      await shoot('foot', page, errors); await page.close();
    } else if (scene === 'spear') {
      const { page, errors } = await open(q(`${NAL}&time=day`));
      await select(page, 'spear');
      await toGrass(page);
      await sleep(2500);
      await shoot('spear', page, errors); await page.close();
    } else if (scene === 'saddle') {
      const { page, errors } = await open(q(`${NAL}&time=day&ride=gallop`), () => window.__world?.ride?.mounted === true);
      await select(page, 'sabre');
      await page.evaluate(() => { const w = window.__world; w.ride.mount.touchGallop = true; w.player.touchMove.y = 1; });
      await sleep(4500);
      await page.evaluate(() => { window.__elites?.bar?.banner('Aqbars the Pale', 'Irbis of the Crags'); });
      await sleep(900);
      await shoot('saddle', page, errors);
      await page.evaluate(() => { const w = window.__world; w.ride.mount.touchGallop = false; w.player.touchMove.y = 0; });
      await page.close();
    } else if (scene === 'lock') {
      // on foot with the sabre facing Kokbori's pack (?elite=kokbori): LOCK, then the frame
      const { page, errors } = await open(q(`${NAL}&time=day&elite=kokbori&from=10`));
      await select(page, 'sabre');
      await sleep(2500);
      console.log(`   facing ${await faceHostile(page)}`);
      console.log(`   lock: ${await lockUntil(page)}`);
      await sleep(1200);
      await shoot('lock', page, errors); await page.close();
    } else if (scene === 'saddlelock') {
      // mounted with the sabre, 10 m from Kokbori's pack: LOCK in the saddle (the view tracks, the horse keeps steering)
      const { page, errors } = await open(q(`${NAL}&time=day&ride=gallop&elite=kokbori&from=40`), () => window.__world?.ride?.mounted === true);
      await select(page, 'sabre');
      await sleep(1500);
      console.log(`   ${await page.evaluate(() => {
        const w = window.__world, kinds = new Set(['wolf', 'kokbori']);
        const p = w.player.position; let best = null, bd = Infinity;
        for (const a of w.animals.animals) { if (!a.alive || !kinds.has(a.kind)) continue; const d = Math.hypot(a.position.x - p.x, a.position.z - p.z); if (d < bd) { bd = d; best = a; } }
        if (best === null) return 'no pack';
        const x = best.position.x + 10, z = best.position.z;   // 10 m east of it, the horse facing it (animal yaw: +z at 0)
        w.ride.mount.teleport(x, z, Math.atan2(best.position.x - x, best.position.z - z));
        w.player.yaw = Math.atan2(-(best.position.x - x), -(best.position.z - z)); w.player.pitch = 0;
        return `teleported by ${best.kind}`;
      })}`);
      await sleep(900);
      console.log(`   lock: ${await lockUntil(page)}`);
      await page.evaluate(() => { window.__world.player.touchMove.y = 0.6; });
      await sleep(1800);
      console.log(`   after 1.8 s riding: ${await page.evaluate(() => `${window.__world.lockState.state} mounted=${window.__world.ride.mounted}`)}`);
      await shoot('saddlelock', page, errors);
      await page.evaluate(() => { window.__world.player.touchMove.y = 0; });
      await page.close();
    } else if (scene === 'storm') {
      const { page, errors } = await open(q(`${NAL}&time=day&weather=storm:0.3&elite=kokbori&from=11`));
      await select(page, 'sabre');
      await sleep(1500);
      console.log(`   facing ${await faceHostile(page)}`);
      console.log(`   lock: ${await lockUntil(page)}`);
      await sleep(1200);
      await weatherNow(page, { title: 'Storm 2:10', sub: 'Wind 22 m/s', tone: 'storm' }, true);
      await sleep(500);
      await shoot('storm', page, errors); await page.close();
    } else if (scene === 'boss') {
      const { page, errors } = await open(q(`${NAL}&boss=golden-king`));
      await sleep(9000);
      await page.waitForFunction(() => window.__world?.player !== undefined, undefined, { timeout: 300000, polling: 1000 });
      await select(page, 'sabre');
      await sleep(1500);
      // walk in to wake him (the name card runs ~3.6 s), then turn onto him
      await page.evaluate(() => { window.__world.player.touchMove.y = 1; });
      await sleep(2600);
      await page.evaluate(() => { window.__world.player.touchMove.y = 0; });
      await sleep(7000);
      console.log(`   facing ${await faceHostile(page)}`);
      console.log(`   lock: ${await lockUntil(page)}`);
      await sleep(1200);
      await shoot('boss', page, errors); await page.close();
    } else if (scene === 'titan') {
      const { page, errors } = await open(q(`${NAL}&boss=storm-titan`), () => window.__world?.ride?.mounted === true);
      await sleep(9000);
      await select(page, 'sabre');
      await sleep(1000);
      await page.evaluate(() => { window.__world.lockSys.toggle(); });
      await sleep(1500);
      console.log(`   lock: ${await page.evaluate(() => `${window.__world.lockState.state} on ${window.__world.lockState.target?.kind ?? '-'}`)}`);
      await weatherNow(page, { title: 'Storm 3:40', sub: 'Wind 26 m/s', tone: 'storm' }, true);
      await sleep(500);
      await shoot('titan', page, errors); await page.close();
    } else if (scene === 'pine' || scene === 'drift') {
      const { page, errors } = await open(q(scene === 'pine' ? 'chunk=pine-hollow' : 'chunk=driftwood-isle'));
      await shoot(scene, page, errors); await page.close();
    }
  };
  for (const scene of SCENES) {
    try { await run(scene); } catch (e) { console.log(`scene ${scene} failed: ${String(e).slice(0, 300)}`); }
  }

  // the sheet: each scene with a mockup, engine | mockup, at 390×844 each, captioned
  const pairs = Object.keys(MOCKUP).filter((k) => shots[k] !== undefined && existsSync(MOCKUP[k]));
  if (pairs.length > 0 && !DESKTOP) {
    const strip = await ctx.newPage();
    await strip.setViewportSize({ width: 800, height: 600 });
    const list = pairs.map((k) => ({ name: k, eng: shots[k], mock: readFileSync(MOCKUP[k]).toString('base64') }));
    const b64 = await strip.evaluate(async (ls) => {
      const W = 390, H = 844, CAP = 30;
      const cv = document.createElement('canvas'); cv.width = W * 2 + 12; cv.height = (H + CAP) * ls.length;
      const g = cv.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < ls.length; i++) {
        const y = i * (H + CAP);
        for (const [j, src, lab] of [[0, ls[i].eng, `ENGINE · ${ls[i].name}`], [1, ls[i].mock, `MOCKUP D · ${ls[i].name}`]]) {
          const im = new Image(); im.src = `data:image/jpeg;base64,${src}`; await im.decode();
          g.drawImage(im, j * (W + 12), y + CAP, W, H);
          g.fillStyle = '#8fe3ff'; g.font = 'bold 15px monospace'; g.fillText(lab, j * (W + 12) + 8, y + 21);
        }
      }
      return cv.toDataURL('image/jpeg', 0.7).slice('data:image/jpeg;base64,'.length);
    }, list);
    const file = resolvePath(OUT, `${TAG === 'now' ? 'sheet' : `${TAG}-sheet`}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`${file}  (${Math.round(Buffer.from(b64, 'base64').length / 1024)} KB)`);
  }
  if (COMPOSE.length > 0) {
    const list = COMPOSE.filter((k) => existsSync(resolvePath(OUT, `${TAG}-${k}.jpg`))).map((k) => ({ name: k, b64: readFileSync(resolvePath(OUT, `${TAG}-${k}.jpg`)).toString('base64') }));
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: 800, height: 600 });
    const b64 = await pg.evaluate(async (ls) => {
      const W = 390, H = 844, CAP = 26, PER = 3, rows = Math.ceil(ls.length / PER);
      const cv = document.createElement('canvas'); cv.width = PER * (W + 8); cv.height = rows * (H + CAP);
      const g = cv.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < ls.length; i++) {
        const x = (i % PER) * (W + 8), y = Math.floor(i / PER) * (H + CAP);
        const im = new Image(); im.src = `data:image/jpeg;base64,${ls[i].b64}`; await im.decode();
        g.drawImage(im, x, y + CAP, W, H);
        g.fillStyle = '#8fe3ff'; g.font = 'bold 15px monospace'; g.fillText(`ENGINE · ${ls[i].name}`, x + 8, y + 19);
      }
      return cv.toDataURL('image/jpeg', 0.66).slice('data:image/jpeg;base64,'.length);
    }, list);
    const file = resolvePath(OUT, `${TAG === 'now' ? 'scenes' : `${TAG}-scenes`}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`${file}  (${Math.round(Buffer.from(b64, 'base64').length / 1024)} KB)`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
