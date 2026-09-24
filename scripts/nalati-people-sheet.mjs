#!/usr/bin/env node
// nalati-people-sheet.mjs — NALATI-MERGE D2: the camp's people, procedural | Blender pipeline | image-to-3D pipeline, at
// the same first-person pose, live on ONE page (the Look Lab's `campPeople` pick swaps them in the next frame; the
// clock is paused, the weather clear). Per figure: the player 4.5 m in front of it, facing it (each figure turns to you,
// the head follows, the cook stirs). The draw calls and triangles per state are measured on the phone tier.
//
//   node scripts/nalati-people-sheet.mjs --url=http://127.0.0.1:5189 [--tiers=desktop,phone] [--only=elder,cook]
//   → progress/nalati-merge/d/people-sheet.jpg (< 500 KB) + people-frames/*.jpg + people.json
// One headless Chromium on Metal (--mute-audio), closed at the end.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5189');
const TIERS = flag('tiers', 'desktop,phone').split(',');
const ONLY = flag('only', '').split(',').filter(Boolean);
const OUT = resolvePath(ROOT, 'progress/nalati-merge/d');
mkdirSync(resolvePath(OUT, 'people-frames'), { recursive: true });
const PEOPLE = [
  { id: 'elder', label: 'Baqyt Ata', dist: 4.2 }, { id: 'herderGate', label: 'Dauren', dist: 4.2 }, { id: 'herderRail', label: 'Erlan', dist: 4.2 },
  { id: 'child', label: 'Ayan', dist: 6 }, { id: 'cook', label: 'Gulnar Apa', dist: 4.6 },
].filter((p) => ONLY.length === 0 || ONLY.includes(p.id));
const STATES = [{ v: 'proc', label: 'PROCEDURAL' }, { v: 'blender', label: 'BLENDER' }, { v: 'gen', label: 'IMAGE-TO-3D' }];
const TIER_CTX = { phone: { viewport: { width: 390, height: 844 }, dpr: 3, touch: true }, desktop: { viewport: { width: 1280, height: 800 }, dpr: 1, touch: false } };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const tier of TIERS) {
    const tc = TIER_CTX[tier];
    const ctx = await browser.newContext({ viewport: tc.viewport, deviceScaleFactor: tc.dpr, hasTouch: tc.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('camp people')) errors.push(m.text().slice(0, 200)); });
    const q = ['chunk=nalati-grasslands', 'mute=1', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', `tier=${tier}`, tc.touch ? 'touch' : '', 'x=88', 'z=205'].filter(Boolean).join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__weather && window.__lookLab), undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '.ws-dialog,[class*="banner"]{display:none!important}' });
    await page.evaluate(() => { window.__weather.clock.paused = true; window.__weather.clock.set(16.22); });
    // load both model looks once before shooting (the first pick fetches + rigs them)
    for (const s of STATES.slice(1)) { await page.evaluate((v) => window.__lookLab.people(v), s.v); await sleep(6000); }
    for (const p of PEOPLE) {
      const at = await page.evaluate(async (a) => {
        const { CAMP_PEOPLE } = await import('/src/game/quest/nalati.ts');
        const spot = CAMP_PEOPLE[a.id];
        const x = a.id === 'child' ? spot.x + 2.3 : spot.x, z = spot.z;
        // stand `dist` m out along the figure's own facing (yaw 0 = +z), look back at it
        const px = x + Math.sin(spot.yaw) * a.dist, pz = z + Math.cos(spot.yaw) * a.dist;
        const yaw = Math.atan2(px - x, pz - z);
        window.__world.player.spawn(px, pz, yaw);
        window.__world.player.pitch = -0.08;
        return { px, pz, yaw };
      }, p);
      await sleep(5000);
      for (const s of STATES) {
        await page.evaluate((v) => window.__lookLab.people(v), s.v);
        await sleep(3500);
        const perf = await page.evaluate(() => ({ calls: window.__world.game.lastFrame.calls, tris: window.__world.game.lastFrame.triangles }));
        const file = `people-frames/${tier}-${p.id}-${s.v}.jpg`;
        writeFileSync(resolvePath(OUT, file), await page.screenshot({ type: 'jpeg', quality: 86, scale: 'css' }));
        rows.push({ tier, person: p.id, label: p.label, state: s.v, ...perf, file, at });
        console.log(`${tier.padEnd(7)} ${p.id.padEnd(11)} ${s.v.padEnd(8)} ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
      }
    }
    await page.evaluate(() => window.__lookLab.people('proc'));
    if (errors.length > 0) console.error(`[${tier}] errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
  writeFileSync(resolvePath(OUT, 'people.json'), JSON.stringify(rows, null, 1));
  // the sheet: a row per figure — desktop proc | blender | gen, then the phone's three
  const ids = [...new Set(rows.map((r) => r.person))];
  const cell = (tier, id, st) => rows.find((r) => r.tier === tier && r.person === id && r.state === st);
  const sheetRows = ids.map((id) => ({
    id, label: cell(TIERS[0], id, 'proc')?.label ?? id,
    cells: TIERS.flatMap((t) => STATES.map((s) => { const r = cell(t, id, s.v); return r ? { tier: t, src: `data:image/jpeg;base64,${readFileSync(resolvePath(OUT, r.file)).toString('base64')}`, cap: `${s.label} · ${r.calls} calls · ${(r.tris / 1e6).toFixed(2)} M` } : null; })),
  }));
  const comp = await (await browser.newContext()).newPage();
  const b64 = await comp.evaluate(async (a) => {
    const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const DW = 480, DH = 300, PW = 180, PH = 390, G = 6, LH = 16, TOP = 28;
    const RH = Math.max(DH, PH) + LH + 18;
    const c = document.createElement('canvas'); c.width = G * 7 + DW * 3 + PW * 3; c.height = TOP + a.rows.length * (RH + G);
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = '600 14px ui-monospace, monospace'; g.fillStyle = '#ffd98a'; g.fillText(a.title, G, 19);
    for (let i = 0; i < a.rows.length; i++) {
      const row = a.rows[i], y = TOP + i * (RH + G);
      g.font = '600 13px ui-sans-serif, system-ui'; g.fillStyle = '#ffd98a'; g.fillText(row.label, G, y + 13);
      let x = G;
      for (const cl of row.cells) {
        if (!cl) continue;
        const w = cl.tier === 'phone' ? PW : DW, h = cl.tier === 'phone' ? PH : DH;
        g.drawImage(await load(cl.src), x, y + 18, w, h);
        g.font = '600 10px ui-monospace, monospace'; g.fillStyle = '#9fe6ff';
        g.fillText(cl.tier === 'phone' ? cl.cap.split(' · ')[0] : cl.cap, x, y + 18 + h + 12);
        x += w + G;
      }
    }
    for (let qy = 0.86; qy >= 0.3; qy -= 0.04) { const u = c.toDataURL('image/jpeg', qy); if (u.length * 0.75 < 490 * 1024) return u.split(',')[1]; }
    return c.toDataURL('image/jpeg', 0.3).split(',')[1];
  }, { rows: sheetRows, title: 'NALATI-MERGE D2 · the camp\'s people: procedural (today) | Blender pipeline | image-to-3D — Look Lab ▸ Camp people · desktop, then phone' });
  writeFileSync(resolvePath(OUT, 'people-sheet.jpg'), Buffer.from(b64, 'base64'));
  console.log('→ progress/nalati-merge/d/people-sheet.jpg');
} finally {
  await browser.close();
}
