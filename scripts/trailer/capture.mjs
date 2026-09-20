// Deterministic gameplay capture for the trailer: the game's clock is replaced by a fixed 1/30 s step and the
// render loop is gated so exactly ONE frame renders per screenshot — smooth 30 fps footage regardless of how
// slow the headless GPU is. No engine changes: everything is monkey-patched through window.__world.
//   node capture.mjs <outDir> [shotName...]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] ?? 'frames';
const ONLY = process.argv.slice(3);
const FPS = 30;
const BASE = 'http://localhost:5173/';
const W = 1600, H = 900;

// yaw convention (Player.ts): forward = (−sin yaw, −cos yaw); π faces +Z (north)
const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

const INSTALL = `(() => {
  const w = window.__world, g = w.game;
  window.__go = 0;
  g.frameGate = () => { if (window.__go > 0) { window.__go--; return true; } return false; };
  g.clock.getDelta = () => { g.clock.elapsedTime += 1 / ${FPS}; return 1 / ${FPS}; };
  for (const sel of ['.ws-perf', '.ws-debug', '.ws-update', '#ws-error']) document.querySelectorAll(sel).forEach((e) => e.remove());
  for (const el of document.body.querySelectorAll('*')) if (el.children.length === 0 && el.textContent?.trim() === 'DBG') el.remove();
  window.__step = () => new Promise((res) => { window.__go = 1; requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res))); });
  window.__tp = (x, z, yaw, pitch, y) => { const p = w.player; p.position.set(x, y ?? (window.__hf.heightAt(x, z)), z); p.yaw = yaw; p.pitch = pitch ?? 0; if (p.velocity) p.velocity.set(0, 0, 0); };
  return 'installed';
})()`;

// ── shots ────────────────────────────────────────────────────────────────────────────────────────────────
// Each: url params, seconds, setup (in-page JS), tick(i) → in-page JS run before frame i renders.
const D = 'chunk=driftwood-isle&nolock=1&skipintro=1&tier=desktop';
const P = 'nolock=1&skipintro=1&tier=desktop';
const shots = [
  // Pine Hollow — the scripted tour (the first shard)
  { name: 'pine-trail', url: `${P}&tour=1`, secs: 7, setup: `window.__world.tour.active = true;`, tick: (i) => `window.__world.tour.time = ${(i / FPS).toFixed(4)};` },
  { name: 'pine-hollow', url: `${P}&tour=1`, secs: 6, setup: `window.__world.tour.active = true;`, tick: (i) => `window.__world.tour.time = ${(9 + i / FPS).toFixed(4)};` },
  { name: 'pine-ridge', url: `${P}&tour=1`, secs: 7, setup: `window.__world.tour.active = true;`, tick: (i) => `window.__world.tour.time = ${(23 + i / FPS).toFixed(4)};` },

  // Driftwood Isle — the pier, walking in
  { name: 'pier-walk', url: `${D}&x=0&z=-233&yaw=3.1416&pitch=0.02`, secs: 7,
    setup: `window.__world.player.keys.add('KeyW');`,
    tick: (i) => `window.__world.player.yaw = ${(Math.PI + Math.sin(i / FPS * 0.6) * 0.06).toFixed(4)}; window.__world.player.pitch = ${(0.02 + Math.sin(i / FPS * 0.9) * 0.01).toFixed(4)};` },
  // planet + gulls: slow tilt up from the beach to the gas giant (azimuth 36° = north-east)
  { name: 'planet', url: `${D}&x=0&z=-222&yaw=3.1416&pitch=0.05`, secs: 6,
    setup: `window.__world.crossbow.model.visible = false;`,
    tick: (i) => { const k = ease(Math.min(1, i / (FPS * 5))); return `window.__world.player.yaw = ${lerp(Math.PI, Math.PI - 36 * Math.PI / 180, k).toFixed(4)}; window.__world.player.pitch = ${lerp(0.05, 0.62, k).toFixed(4)};`; } },
  // beach: boars by the pier's landing
  { name: 'boars', url: `${D}&x=45&z=-140&yaw=3.1416&pitch=-0.02`, secs: 6,
    setup: `(() => { const w = window.__world, hf = window.__hf, lvl = w.chunk.ocean.level; const boars = w.animals.animals.filter((a) => a.kind === 'boar' && a.alive && Math.hypot(a.position.x - 45, a.position.z - 150 * -1) < 40);
      const b = boars[0]; if (!b) return; let best = null; for (let k = 0; k < 24; k++) { const ang = k / 24 * Math.PI * 2, r = 7; const x = b.position.x + Math.cos(ang) * r, z = b.position.z + Math.sin(ang) * r; const h = hf.heightAt(x, z); if (h > lvl + 0.6 && (!best || h < best.h)) best = { x, z, h }; }
      if (best) window.__tp(best.x, best.z, Math.atan2(-(b.position.x - best.x), -(b.position.z - best.z)), -0.04); window.__boar = b; })();`,
    tick: () => `(() => { const b = window.__boar; if (b) { const p = window.__world.player; const want = Math.atan2(-(b.position.x - p.position.x), -(b.position.z - p.position.z)); p.yaw += (want - p.yaw) * 0.05; } })();` },
  // sword: three-hit combo then the heavy on the nearest boar
  { name: 'combo', url: `${D}&x=45&z=-160&yaw=3.1416&pitch=-0.05`, secs: 7,
    setup: `(() => { const w = window.__world; const boar = w.animals.animals.filter((a) => a.kind === 'boar' && a.alive).sort((a, b) => a.position.distanceTo(w.player.position) - b.position.distanceTo(w.player.position))[0];
      if (boar) { const dx = boar.position.x - 0, dz = boar.position.z - 0; const d = Math.hypot(boar.position.x, boar.position.z); const px = boar.position.x + 1.7 * Math.sin(0.7), pz = boar.position.z - 1.7 * Math.cos(0.7); window.__tp(px, pz, Math.atan2(-(boar.position.x - px), -(boar.position.z - pz)), -0.12); window.__boar = boar; } })();`,
    tick: (i) => { const w = 'window.__world'; let s = `(() => { const b = window.__boar; if (b) { const p = ${w}.player; p.yaw = Math.atan2(-(b.position.x - p.position.x), -(b.position.z - p.position.z)); } })();`;
      if (i === 8 || i === 22 || i === 36) s += `${w}.crossbow.tryFire();`;
      if (i === 70) s += `${w}.crossbow.adsHeld = true;`;
      if (i === 88) s += `${w}.crossbow.adsHeld = false;`;
      return s; } },
  // off the pier: swim, then dive to the reef
  { name: 'swim', url: `${D}&x=9&z=-226&yaw=2.6&pitch=0.0`, secs: 5,
    setup: `window.__world.player.keys.add('KeyW');`,
    tick: (i) => `window.__world.player.yaw = ${(2.6 + i / FPS * 0.05).toFixed(4)};` },
  { name: 'dive', url: `${D}&x=46&z=-199&yaw=3.1416&pitch=-0.15`, secs: 7,
    setup: `window.__world.player.keys.add('KeyW');`,
    tick: (i) => `${i === 15 ? `window.__world.player.diveHeld = true;` : i === 15 + FPS * 2.6 ? `window.__world.player.diveHeld = false;` : ``} window.__world.player.pitch = ${lerp(-0.15, -0.55, Math.min(1, i / (FPS * 3))).toFixed(4)}; window.__world.player.yaw = ${(Math.PI + i / FPS * 0.12).toFixed(4)};` },
  // the plank stairs and rope fences up to the hut
  { name: 'stairs', url: `${D}&x=-30&z=-150&yaw=${yawTo(-30, -150, -30, -104).toFixed(4)}&pitch=0.1`, secs: 7,
    setup: `window.__world.player.keys.add('KeyW');`,
    tick: () => `` },
  // the rope bridge over the tidal creek
  { name: 'bridge', url: `${D}&x=13&z=11&yaw=${yawTo(13, 11, 32, 30).toFixed(4)}&pitch=-0.08`, secs: 7,
    setup: `window.__world.player.keys.add('KeyW');`,
    tick: (i) => `window.__world.player.pitch = ${(-0.05 + Math.sin(i / FPS * 0.8) * 0.03).toFixed(4)};` },
  // the lookout: the whole island from the headland
  { name: 'lookout', url: `${D}&x=92&z=102&yaw=${yawTo(92, 102, 0, -230).toFixed(4)}&pitch=-0.14`, secs: 6,
    setup: `window.__world.crossbow.model.visible = false;`,
    tick: (i) => `window.__world.player.yaw = ${(yawTo(92, 102, 0, -230) + ease(Math.min(1, i / (FPS * 6))) * 0.7).toFixed(4)};` },
  // wreck cove: the drowned sailor rises in the hold, the iron sword glowing behind
  { name: 'wreck', url: `${D}&x=149&z=4&yaw=0&pitch=-0.1`, secs: 7,
    setup: `(() => { const w = window.__world, hf = window.__hf, lvl = w.chunk.ocean.level; const h = w.animals.enemyWorld?.hold; if (!h) return; let best = null;
      for (let k = 0; k < 36; k++) { const ang = k / 36 * Math.PI * 2, r = 9.5; const x = h.x + Math.cos(ang) * r, z = h.z + Math.sin(ang) * r; if (h.floorAt(x, z) !== undefined) continue; const g = hf.heightAt(x, z); if (g > lvl + 0.4 && (!best || g < best.g)) best = { x, z, g }; }
      if (best) window.__tp(best.x, best.z, Math.atan2(-(h.x - best.x), -(h.z - best.z)), -0.02); w.player.keys.add('KeyW'); window.__hold = h; })();`,
    tick: (i) => `${i === 75 ? `window.__world.player.keys.delete('KeyW');` : ``}(() => { const w = window.__world; const s = w.animals.animals.find((a) => a.kind === 'sailor' && a.alive); if (s && ${i} > 60) { const p = w.player; const dx = s.position.x - p.position.x, dz = s.position.z - p.position.z; let want = Math.atan2(-dx, -dz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.08; p.pitch += ((Math.atan2(s.position.y + 1.0 - (p.position.y + 1.68), Math.hypot(dx, dz))) - p.pitch) * 0.08; } })();${i === 170 ? `window.__world.crossbow.tryFire();` : ``}` },
  // the ring shrine: glyphs, fireflies, the planet through the ring
  { name: 'shrine', url: `${D}&x=-88&z=94&yaw=${yawTo(-88, 94, -98, 108).toFixed(4)}&pitch=0.12`, secs: 6,
    setup: `window.__world.shrine?.setDusk?.(1); window.__world.player.keys.add('KeyW');`,
    tick: (i) => `window.__world.player.pitch = ${lerp(0.12, 0.42, ease(Math.min(1, i / (FPS * 6)))).toFixed(4)};` },
  // hero: back at the pier's end at the very end
  { name: 'hero', url: `${D}&x=0&z=-218&yaw=2.95&pitch=0.12`, secs: 5,
    setup: `window.__world.crossbow.model.visible = false;`,
    tick: (i) => `window.__world.player.yaw = ${(2.95 + i / FPS * 0.02).toFixed(4)};` },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--headless=new'] });
const manifest = [];
for (const s of shots) {
  if (ONLY.length > 0 && !ONLY.includes(s.name)) continue;
  const dir = `${OUT}/${s.name}`; mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(`[${s.name}] pageerror`, e.message));
  await page.goto(`${BASE}?${s.url}`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__world) && Boolean(window.__hf), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(INSTALL);
  await page.evaluate(s.setup);
  // settle: a few gated frames so the first captured frame is not the spawn pop
  for (let k = 0; k < 8; k++) await page.evaluate(`window.__step()`);
  const n = Math.round(s.secs * FPS);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(`(async () => { ${s.tick(i)} await window.__step(); })()`);
    await page.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log(`[${s.name}] ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  manifest.push({ name: s.name, frames: n });
  await page.close();
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
await browser.close();
