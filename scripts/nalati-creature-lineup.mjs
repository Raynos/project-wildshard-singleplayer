#!/usr/bin/env node
// nalati-creature-lineup.mjs — every wolf / horse coat side by side (dev/nalati-creatures.html?scene=lineup), frozen
// at a few gait phases, for the picked model creatures: one sheet, rows = (look × pose).
//   node scripts/nalati-creature-lineup.mjs [--url=http://127.0.0.1:5192] [--out=progress/…jpg] [--tier=desktop]
//   [--poses=idle:0,walk:0.25,gallop:0.3] [--looks=glb] [--q=extra=1]
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { browserBakeBytes } from './bake-output.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5192');
const OUT = resolvePath(ROOT, flag('out', 'progress/nalati-look/creatures/lineup.jpg'));
const TIER = flag('tier', 'desktop');
const POSES = flag('poses', 'idle:0,gallop:0.3').split(',').map((p) => p.split(':'));
const LOOKS = ['glb'];
if (flag('looks', 'glb') !== 'glb') throw new Error('E136: procedural creature selection was retired; capture the picked models.');
const EXTRA = flag('q', '');
const W = 1600, H = 700;
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const shots = [];
try {
  for (const look of LOOKS) for (const [gait, phase] of POSES) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'perf=0', 'weather=clear', 'clock=0', `tier=${TIER}`,
      `scene=${flag('scene', 'lineup')}`, `gait=${gait}`, `phase=${phase}`, `x=${flag('x', '-60')}`, `z=${flag('z', '60')}`, 'yaw=3.14', 'pitch=-0.05', EXTRA].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/dev/nalati-creatures.html?${q}`);
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.animals), undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
    await page.waitForTimeout(9000);
    shots.push({ label: `${look} · ${gait} ${phase}`, bytes: await page.screenshot({ type: 'jpeg', quality: 85 }) });
    console.log(`${look} ${gait} ${phase}`);
    await page.close();
  }
  const comp = await (await browser.newContext()).newPage();
  const inputs = new Map(shots.map((shot, i) => [String(i), shot.bytes]));
  const url = `https://lineup-images.invalid/${randomUUID()}/`, pattern = `${url}*`;
  const images = shots.map((shot, i) => ({ label: shot.label, src: `${url}${i}` }));
  /** @param {import('playwright').Route} route */
  const read = async route => {
    const request = route.request(), bytes = request.method() === 'GET' ? inputs.get(request.url().slice(url.length)) : undefined;
    await route.fulfill({ status: bytes === undefined ? 404 : 200, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'image/jpeg' }, body: bytes ?? 'Missing lineup image' });
  };
  await comp.route(pattern, read);
  try {
    const sink = await browserBakeBytes(comp, { maxFiles: 1 });
    try {
      const size = await comp.evaluate(async ({ list, w, h, output }) => {
        const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
        const G = 4, LAB = 22;
        const c = document.createElement('canvas'); c.width = w; c.height = list.length * (h + LAB + G);
        const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < list.length; i++) {
          const im = await load(list[i].src);
          const y = i * (h + LAB + G);
          x.drawImage(im, 0, y + LAB, w, h);
          x.font = '600 16px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(list[i].label, 6, y + 16);
        }
        const encode = quality => new Promise((resolve, reject) => {
          c.toBlob(blob => {
            if (blob === null) reject(new Error('Lineup JPEG encoding refused'));
            else resolve(blob);
          }, 'image/jpeg', quality);
        });
        let image;
        for (let qq = 0.8; qq >= 0.4; qq -= 0.05) {
          const blob = await encode(qq);
          // Keep the original data-URL size test, including its prefix and padding.
          if ((23 + 4 * Math.ceil(blob.size / 3)) * 0.75 < 4.5e5) { image = blob; break; }
        }
        image ??= await encode(0.35);
        const response = await fetch(output, { method: 'POST', body: image });
        if (!response.ok) throw new Error('Lineup byte upload refused');
        return image.size;
      }, { list: images, output: `${sink.url}board`, w: 1100, h: Math.round(1100 * H / W) });
      const bytes = sink.take('board');
      if (bytes.byteLength !== size) throw new Error('Incomplete lineup JPEG');
      writeFileSync(OUT, bytes);
    } finally { await sink.dispose(); }
  } finally { await comp.unroute(pattern, read); }
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
