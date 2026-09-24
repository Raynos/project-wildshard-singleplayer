#!/usr/bin/env node
// npc-shots.mjs — Pine Hollow's people at 2 m on the phone (PINE-HOLLOW-REMASTER PH-M4): for each NPC the player is set
// down 2 m in front of them, facing them, and the frame is shot (iPhone 16 Pro, 390×844 @3, touch, tier=phone), then
// again while they talk (their talk clip; the ranger's point comes 5.5 s into a talk). One sheet: <out>.
//
//   node scripts/npc-shots.mjs [--npcs=glb|proc] [--out=progress/pine-hollow-M4-npcs-phone-glb.jpg] [--url=http://127.0.0.1:5176]
//   [--cells=<dir>: every frame as its own JPEG] [--dist=2]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5176');
const LOOK = flag('npcs', 'glb');
const DIST = Number(flag('dist', '2'));
const OUT = resolvePath(ROOT, flag('out', `progress/pine-hollow-M4-npcs-phone-${LOOK}.jpg`));
const CELLS = flag('cells', '');
mkdirSync(dirname(OUT), { recursive: true });
if (CELLS) mkdirSync(CELLS, { recursive: true });
const iphone = devices['iPhone 16 Pro'];
/** the quest's dev starts that put the player by each person (src/pinehollow/quest: ?quest=ranger / hamlet) */
const SHOTS = [['ranger', 'ranger'], ['hamlet', 'trader'], ['hamlet', 'miller']];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = [];
try {
  for (const [quest, kind] of SHOTS) {
    const page = await (await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } })).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    const q = ['chunk=pine-hollow', 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', 'tier=phone', 'touch', `npcs=${LOOK}`, `quest=${quest}`, 'tod=day', 'clock=1e6'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((k) => Boolean(window.__world?.game?.scene.getObjectByName(`npc-${k}`)), kind, { timeout: 300000, polling: 1000 });
    await page.waitForTimeout(4000);
    const place = () => page.evaluate(([k, d]) => {
      const w = window.__world, g = w.game.scene.getObjectByName(`npc-${k}`);
      if (!g) return null;
      const yaw = g.rotation.y, x = g.position.x + Math.sin(yaw) * d, z = g.position.z + Math.cos(yaw) * d;
      w.player.spawn(x, z, yaw);   // facing (−sin yaw, −cos yaw): back at them
      w.player.pitch = -0.08;
      return { x, z };
    }, [kind, DIST]);
    await place();
    await page.waitForTimeout(2500);
    await place();   // they turn to face you: set down square again
    await page.waitForTimeout(1200);
    const idle = (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64');
    // talking: the figure's own flag (the quest sets it for a dialogue)
    await page.evaluate((k) => { const pq = window.__pineQuest; const p = pq?.people?.find((x) => x.kind === k); if (p) p.fig.talking = true; }, kind);
    await page.waitForTimeout(kind === 'ranger' ? 7000 : 2200);
    const talk = (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64');
    for (const [tag, b64] of [['idle', idle], ['talk', talk]]) {
      if (CELLS) writeFileSync(resolvePath(CELLS, `npc-${LOOK}-${kind}-${tag}.jpg`), Buffer.from(b64, 'base64'));
      shots.push({ label: `${kind} · ${tag} · ${DIST} m · ?npcs=${LOOK}`, b64 });
    }
    console.log(kind, errs.slice(0, 2).join(' | '));
    await page.close();
  }
  const comp = await (await browser.newContext()).newPage();
  const b64 = await comp.evaluate(async ({ list, w, h }) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const G = 4, LAB = 18;
    const c = document.createElement('canvas'); c.width = list.length * (w + G) + G; c.height = h + LAB + G;
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) {
      x.drawImage(await load(`data:image/jpeg;base64,${list[i].b64}`), G + i * (w + G), LAB, w, h);
      x.font = '600 11px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(list[i].label, G + i * (w + G), 13);
    }
    for (let qq = 0.85; qq >= 0.35; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.3).split(',')[1];
  }, { list: shots, w: 300, h: 650 });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT.slice(ROOT.length + 1)}`);
} finally {
  await browser.close();
}
