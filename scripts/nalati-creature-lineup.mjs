#!/usr/bin/env node
// nalati-creature-lineup.mjs — every wolf / horse coat side by side (dev/nalati-creatures.html?scene=lineup), frozen
// at a few gait phases, for ?creatures=proc and ?creatures=glb: one sheet, rows = (look × pose).
//   node scripts/nalati-creature-lineup.mjs [--url=http://127.0.0.1:5192] [--out=progress/…jpg] [--tier=desktop]
//   [--poses=idle:0,walk:0.25,gallop:0.3] [--looks=proc,glb] [--q=extra=1]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5192');
const OUT = resolvePath(ROOT, flag('out', 'progress/nalati-look/creatures/lineup.jpg'));
const TIER = flag('tier', 'desktop');
const POSES = flag('poses', 'idle:0,gallop:0.3').split(',').map((p) => p.split(':'));
const LOOKS = flag('looks', 'proc,glb').split(',');
const EXTRA = flag('q', '');
const W = 1600, H = 700;
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = [];
try {
  for (const look of LOOKS) for (const [gait, phase] of POSES) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'perf=0', 'weather=clear', 'clock=0', `tier=${TIER}`, `creatures=${look}`,
      `scene=${flag('scene', 'lineup')}`, `gait=${gait}`, `phase=${phase}`, `x=${flag('x', '-60')}`, `z=${flag('z', '60')}`, 'yaw=3.14', 'pitch=-0.05', EXTRA].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/dev/nalati-creatures.html?${q}`);
    await page.waitForFunction(() => Boolean(window.__world?.animals), undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
    await page.waitForTimeout(9000);
    shots.push({ label: `${look} · ${gait} ${phase}`, b64: (await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64') });
    console.log(`${look} ${gait} ${phase}`);
    await page.close();
  }
  const comp = await (await browser.newContext()).newPage();
  const b64 = await comp.evaluate(async ({ list, w, h }) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const G = 4, LAB = 22;
    const c = document.createElement('canvas'); c.width = w; c.height = list.length * (h + LAB + G);
    const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) {
      const im = await load(`data:image/jpeg;base64,${list[i].b64}`);
      const y = i * (h + LAB + G);
      x.drawImage(im, 0, y + LAB, w, h);
      x.font = '600 16px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(list[i].label, 6, y + 16);
    }
    for (let qq = 0.8; qq >= 0.4; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.5e5) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.35).split(',')[1];
  }, { list: shots, w: 1100, h: Math.round(1100 * H / W) });
  writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
