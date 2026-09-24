#!/usr/bin/env node
// king-phases.mjs — the Antler King's fight, one frame per phase, from the player's own view (PINE-HOLLOW-REMASTER PH-M3):
// `?boss=antler-king&bossPhase=<n>&bossGod=1` (night forced, you at the stones' N gap), after the intro settles.
//
//   node scripts/king-phases.mjs [--creatures=glb|proc] [--out=progress/pine-hollow-M3-king-phases.jpg]
//   [--url=http://127.0.0.1:5176] [--tier=desktop|phone] [--wait=14] [--from=15: metres out from the King] [--cells=<dir>: each frame as its own JPEG]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5176');
const LOOK = flag('creatures', 'glb');
const TIER = flag('tier', 'desktop');
const WAIT = Number(flag('wait', '14'));
const OUT = resolvePath(ROOT, flag('out', `progress/pine-hollow-M3-king-phases-${LOOK}.jpg`));
const CELLS = flag('cells', '');
mkdirSync(dirname(OUT), { recursive: true });
if (CELLS) mkdirSync(CELLS, { recursive: true });
const iphone = devices['iPhone 16 Pro'];
const CTX = TIER === 'phone'
  ? { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }
  : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = [];
try {
  for (const phase of [1, 2, 3]) {
    const page = await (await browser.newContext(CTX)).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
    const q = ['chunk=pine-hollow', 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', `tier=${TIER}`, TIER === 'phone' ? 'touch' : '', `creatures=${LOOK}`,
      'boss=antler-king', `bossPhase=${phase}`, 'bossGod=1', `from=${flag('from', '15')}`].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals && window.__antlerKing), undefined, { timeout: 300000, polling: 1000 });
    await page.waitForTimeout(WAIT * 1000);
    const info = await page.evaluate(() => { const k = window.__antlerKing.fight ?? {}; return { mode: k.mode, phase: k.phase, calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles }; });
    const b64 = (await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64');
    if (CELLS) writeFileSync(resolvePath(CELLS, `king-${LOOK}-${TIER}-p${phase}.jpg`), Buffer.from(b64, 'base64'));
    shots.push({ label: `phase ${phase} · ?creatures=${LOOK} · ${TIER} · ${info.mode} · ${info.calls} calls ${(info.tris / 1e6).toFixed(2)} M tris`, b64 });
    console.log(phase, JSON.stringify(info), errs.slice(0, 2).join(' | '));
    await page.close();
  }
  const comp = await (await browser.newContext()).newPage();
  const W = TIER === 'phone' ? 390 : 640, H = TIER === 'phone' ? 844 : 360;
  const b64 = await comp.evaluate(async ({ list, w, h }) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const G = 4, LAB = 20;
    const c = document.createElement('canvas'); c.width = list.length * (w + G) + G; c.height = h + LAB + G;
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) {
      x.drawImage(await load(`data:image/jpeg;base64,${list[i].b64}`), G + i * (w + G), LAB, w, h);
      x.font = '600 12px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(list[i].label, G + i * (w + G), 14);
    }
    for (let qq = 0.85; qq >= 0.35; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.3).split(',')[1];
  }, { list: shots, w: W, h: H });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT.slice(ROOT.length + 1)}`);
} finally {
  await browser.close();
}
