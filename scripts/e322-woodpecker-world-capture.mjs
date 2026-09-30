#!/usr/bin/env node
// e322-woodpecker-world-capture.mjs — E322 F-M5's woodpecker board frames in the world (Debug ▸ Creatures & NPCs ▸ Bird
// fix): the woodpecker called onto a real Pine Hollow trunk (`__pineLife.woodNow()`), the camera held beside it (side-on,
// three-quarter, wide), phone tier, iPhone 16 Pro portrait, midday, the HUD hidden. Each variant is a fresh page load;
// the perch comes out the same for both.
//
//   scripts/browser-lane.sh node scripts/e322-woodpecker-world-capture.mjs <url> <out dir> [a,b]   (SX / SZ: the spawn)
//
// Writes <out>/<variant>-<shot>.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { debugSettings } from './debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const [BASE, OUT, VARS = 'a,b'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const SHOTS = [
  { name: 'side', cam: [0.85, 0.05, -0.12], fov: 40 },
  { name: 'q34', cam: [0.6, 0.15, -0.6], fov: 40 },
  { name: 'wide', cam: [1.6, 0.35, -1.5], fov: 40 },
];
const SX = Number(process.env.SX ?? '100'), SZ = Number(process.env.SZ ?? '-60');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const v of VARS.split(',')) {
    const iphone = devices['iPhone 16 Pro'];
    const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 402, height: 874 } });
    await debugSettings(ctx, { pineBirdFix: v, time: 'midday', weather: 'clear', prefetch: 'off' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log(`PAGEERROR ${e.message.slice(0, 300)}`); });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`CONSOLE ${m.type()} ${m.text().slice(0, 200)}`); });
    await page.goto(`${BASE}/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=phone&touch&x=${SX}&z=${SZ}&yaw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.game) && Boolean(window.__pineLife), undefined, { timeout: 300000, polling: 500 });
    await sleep(8000);
    await page.evaluate(() => { window.__world.animals.calm = true; window.__pineLife.woodNow(); });
    let perched = false;
    for (let i = 0; i < 40 && !perched; i++) { await sleep(1000); perched = await page.evaluate(() => window.__pineLife.wood.mode === 'perch'); }
    const pose = await page.evaluate(() => { const p = window.__pineLife.wood.pose; return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch }; });
    console.log(`[${v}] perched=${perched} ${JSON.stringify(pose)}`);
    await page.evaluate(() => {
      const w = window.__world;
      window.__bc = null;
      w.game.onLate(() => {
        const c = window.__bc, cam = w.game.camera;
        if (!c) return;
        cam.position.set(c.pos[0], c.pos[1], c.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.updateMatrixWorld(true);
        if (Math.abs(cam.fov - c.fov) > 0.01) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
      });
    });
    await page.addStyleTag({ content: '#hud, .ws-touch, .ws-hud, [class*="ws-hud"], [class*="minimap"] { visibility: hidden !important; }' });
    for (const s of SHOTS) {
      await page.evaluate((shot) => {
        const p = window.__pineLife.wood.pose, c = Math.cos(p.yaw), sn = Math.sin(p.yaw);
        // +z of the offset = the bird's facing (sin yaw, cos yaw) (toward the trunk), +x = (cos yaw, −sin yaw)
        const [ox, oy, oz] = shot.cam;
        window.__bc = { pos: [p.x + ox * c + oz * sn, p.y + oy, p.z - ox * sn + oz * c], look: [p.x, p.y + 0.02, p.z], fov: shot.fov };
      }, s);
      await sleep(1200);
      writeFileSync(`${OUT}/${v}-${s.name}.png`, await page.screenshot({ type: 'png' }));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
