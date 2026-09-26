#!/usr/bin/env node
// loadout-shots.mjs — Pine Hollow's loadout on the phone (PINE-HOLLOW-REMASTER PH-C11): iPhone 16 Pro portrait (390×844 @3,
// touch, tier=phone, day), four labelled sheets in progress/:
//   pine-hollow-loadout-01-rifle.jpg    the lever-action on its cabin pickup · side-on · hip · iron sights · the tube reload
//   pine-hollow-loadout-01-cycle.jpg    the lever cycle, frame by frame (hip, the cycle held at u = 0 … 0.9) + sighted mid-throw
//   pine-hollow-loadout-01-longbow.jpg  the Warden's Longbow: side-on · at rest · drawn · drawn + AIM (the drop arc) · the loose
//   pine-hollow-loadout-01-strip.jpg    the touch weapon strip + ammo strip per weapon, the pitch / broadhead bolt kinds
//
//   node scripts/loadout-shots.mjs [--url=http://localhost:4311]     (a `vite preview` of a clean export — see pine-hollow-perf.mjs)
// One headless Chromium on Metal (--mute-audio, &mute=1), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4311');
const OUT = resolvePath(ROOT, 'progress');
mkdirSync(OUT, { recursive: true });
const iphone = devices['iPhone 16 Pro'];
const Q = ['chunk=pine-hollow', 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', 'tier=phone', 'touch', 'tod=day', 'clock=1e6'].join('&');

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } })).newPage();
  await debugSettings(page, { tracers: false }); // E162: a saved Debug option, not a URL switch
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await page.goto(`${URL_BASE}/?${Q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.game && window.__lever && window.__longbow), null, { timeout: 300000, polling: 1000 });
  await page.waitForTimeout(9000);
  const js = (s) => page.evaluate(s);
  const shot = async (label, wait = 900) => { await page.waitForTimeout(wait); return { label, b64: (await page.screenshot({ type: 'jpeg', quality: 82 })).toString('base64') }; };
  const home = "window.__world.player.spawn(0, -200, Math.PI); window.__world.player.pitch = -0.02";

  // ── the rifle ──
  const rifle = [];
  // first: the pickup. Its orb lights the item's materials, which are the viewmodel's own (one program) until it is taken;
  // the rifle is unlocked here by hand, so that glow is taken off again before the viewmodel frames
  // its pickup: the orb on cabin 1's floor, found by its steel; stand inside, 1.8 m off, facing it
  await js("window.__weapons.visible = false");
  const found = await js(`(() => {
    const w = window.__world; let at = null;
    w.game.scene.traverse((m) => { if (at || !m.isMesh || m.material?.name !== 'lever-steel') return; let p = m; while (p.parent && p.parent !== w.game.scene) p = p.parent; if (p === w.game.camera || p.position.y < -100) return; at = m.getWorldPosition(new m.position.constructor()); });
    if (!at) return null;
    // the room side of the pickup (cabin 1's floor, away from the door wall), facing it
    for (const k of [12, 14, 0, 4]) { const a = k / 16 * Math.PI * 2, x = at.x + Math.sin(a) * 2.2, z = at.z + Math.cos(a) * 2.2;
      if (w.cabins?.floorHeightAt(x, z) !== undefined) { w.player.spawn(x, z, Math.atan2(-(at.x - x), -(at.z - z))); w.player.pitch = -0.25; return { x, z }; } }
    return null; })()`);
  if (found) rifle.push(await shot('the cabin pickup · "Take the lever-action"', 3000));
  await js('window.__weapons.visible = true');

  await js("window.__world.game.camera.traverse((m) => { if (m.isMesh && m.material?.name?.startsWith('lever')) { m.material.emissive.setRGB(0, 0, 0); m.material.emissiveIntensity = 1; } })");
  await js(`${home}; window.__weapons.unlock('rifle'); window.__weapons.select('rifle', true); window.__lever.inspect = 1.6; window.__lever.inspectYaw = Math.PI / 2`);
  rifle.push(await shot('side-on · the loading gate', 1500));
  await js('window.__lever.inspect = 0');
  rifle.push(await shot('hip', 1200));
  await js('window.__weapons.adsHeld = true');
  rifle.push(await shot('iron sights · bead in the buckhorn', 1500));
  await js('window.__weapons.adsHeld = false; window.__lever.tube = 2; window.__lever.reload()');
  rifle.push(await shot('reload · one round through the gate', 820));

  // ── the lever cycle strip ──
  const cycle = [];
  await page.waitForTimeout(3000);
  for (const u of [0, 0.12, 0.26, 0.46, 0.66, 0.9]) { await js(`window.__lever.freezeCycle = ${u}`); cycle.push(await shot(`the lever · u ${u.toFixed(2)}`, 700)); }
  await js('window.__lever.freezeCycle = null; window.__weapons.adsHeld = true'); await page.waitForTimeout(1200);
  await js('window.__lever.freezeCycle = 0.46'); cycle.push(await shot('sighted, the lever thrown', 800));
  await js('window.__lever.freezeCycle = null; window.__weapons.adsHeld = false');

  // ── the longbow ──
  const bow = [];
  await js("window.__weapons.unlock('bow'); window.__weapons.select('bow', true); window.__longbow.inspect = 1; window.__longbow.inspectYaw = 1.2");
  bow.push(await shot("the Warden's Longbow · yew, horn nocks", 1500));
  await js('window.__longbow.inspect = 0');
  bow.push(await shot('at rest', 1500));
  await js('window.__weapons.altHeld = true');
  bow.push(await shot('drawn (FIRE held)', 1500));
  await js('window.__weapons.adsHeld = true');
  bow.push(await shot('drawn + AIM · the drop arc', 1500));
  await js('window.__weapons.altHeld = false');
  bow.push(await shot('the loose · the follow-through', 180));
  await js('window.__weapons.adsHeld = false');

  // ── the strip + the bolt kinds ──
  const strip = [];
  await js(`${home}; window.__weapons.select('crossbow', true)`);
  strip.push(await shot('crossbow · iron bolts', 1200));
  await js("window.__loadout.addAmmo('pitch', 10); window.__loadout.selectBolt('pitch')");
  strip.push(await shot('pitch-tipped bolts loaded', 1200));
  await js("window.__loadout.addAmmo('broadhead', 8); window.__loadout.selectBolt('broadhead')");
  strip.push(await shot('broadheads loaded', 1200));
  await js("window.__weapons.select('rifle', true)");
  strip.push(await shot('lever-action · cartridges', 1200));
  await js("window.__weapons.select('bow', true)");
  strip.push(await shot('longbow · arrows', 1200));

  const sheet = async (name, list) => {
    const comp = await (await browser.newContext()).newPage();
    const b64 = await comp.evaluate(async ({ cells, w, h }) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const G = 4, LAB = 18;
      const c = document.createElement('canvas'); c.width = cells.length * (w + G) + G; c.height = h + LAB + G;
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < cells.length; i++) {
        x.drawImage(await load(`data:image/jpeg;base64,${cells[i].b64}`), G + i * (w + G), LAB, w, h);
        x.font = '600 11px ui-monospace, monospace'; x.fillStyle = '#9fe6ff'; x.fillText(cells[i].label, G + i * (w + G), 13);
      }
      for (let qq = 0.85; qq >= 0.35; qq -= 0.05) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.3).split(',')[1];
    }, { cells: list, w: 300, h: 650 });
    await comp.close();
    writeFileSync(resolvePath(OUT, `pine-hollow-loadout-01-${name}.jpg`), Buffer.from(b64, 'base64'));
    console.log(`wrote progress/pine-hollow-loadout-01-${name}.jpg`);
  };
  await sheet('rifle', rifle); await sheet('cycle', cycle); await sheet('longbow', bow); await sheet('strip', strip);
  console.log('page errors:', errs.slice(0, 3).join(' | ') || 'none');
} finally {
  await browser.close();
}
