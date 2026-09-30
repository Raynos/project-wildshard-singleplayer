#!/usr/bin/env node
// e322-king-rig-capture.mjs — E322 F-M1's board: the Antler King in his clearing by day, Debug ▸ Antler King rig A (today:
// the Bark Warden hull on the elk's bones) vs B (his own upright rig, src/pinehollow/kingRig.ts), iPhone 16 Pro portrait
// (touch, phone tier, muted, Metal). Per variant three held poses — idle, the charge (the lane's gallop) and the rearing
// strike (the stomp's wind-up at its top; A's is the elk's charge wind-up, the only strike it has) — from a three-quarter
// front camera, the HUD hidden. The King is the fight's own (dressed: lanterns, ribcage), made present by day.
//   lockf -k ~/.browser-lane/e322.lock scripts/browser-lane.sh --max 20 node scripts/e322-king-rig-capture.mjs --url=http://127.0.0.1:4400 --out=<dir>
// Writes <out>/<variant>-<pose>.jpg and prints each frame's rig, draws and triangles.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e322-king-rig'));
const ONLY = flag('variants', 'a,b').split(',');
mkdirSync(OUT, { recursive: true });
const C = { x: 150, z: -30 };   // KINGS_CLEARING (src/chunks/pineHollowLayout.ts)
/** per pose: A's hold, B's hold (Animal.debugGait, or an attack held at a progress) */
const POSES = {
  idle: { a: { gait: 'idle', phase: 0 }, b: { gait: 'idle', phase: 0 } },
  charge: { a: { gait: 'gallop', phase: 0.3 }, b: { gait: 'charge', phase: 0.1 } },
  strike: { a: { gait: 'idle', phase: 0, attack: 0.7 }, b: { gait: 'strike', phase: 0.46 } },
};
// the camera: three-quarter front (he faces +z), eye height, looking at his chest
const CAM = { dx: -15, dz: 14, h: 1.7, look: 4.2, fov: 55 };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const { defaultBrowserType: _b, ...iphone } = devices['iPhone 16 Pro'];
  for (const variant of ONLY) {
    const ctx = await browser.newContext(iphone);
    await debugSettings(ctx, { pineKingRig: variant, creatures: 'models' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 200)); });
    page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && /king|rig|creature/i.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 200)); });
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&mute=1&nolock=1&skipintro=1&sw=0&tod=day&clock=1e6&x=${C.x + CAM.dx}&z=${C.z + CAM.dz + 4}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals && window.__antlerKing) && window.__world?.hud?.entered === true, undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"]{display:none!important}' });
    const info = await page.evaluate(({ c, cam: cm }) => {
      const w = window.__world, f = window.__antlerKing.fight;
      f.setPresent(true);
      const k = f.king;
      k.place(c.x, c.z, 0);
      const camera = w.game.camera;
      window.__e322k = { hold: null };
      w.game.onUpdate(() => {
        const st = window.__e322k;
        if (st.hold) {
          k.debugGait = { gait: st.hold.gait, phase: st.hold.phase };
          if (st.hold.attack !== undefined) { if (k.attackPhase < 0) k.startAttack(1000); k.attackT = st.hold.attack * 1000; } else k.cancelAttack();
        }
        k.lookWeight = 0;
        const y = k.position.y;
        camera.position.set(c.x + cm.dx, y + cm.h, c.z + cm.dz); camera.lookAt(c.x, y + cm.look, c.z);
        if (Math.abs(camera.fov - cm.fov) > 0.01) { camera.fov = cm.fov; camera.updateProjectionMatrix(); }
        for (const ch of camera.children) ch.visible = false;
      });
      const geo = k.mesh.geometry;
      return { custom: k.custom, bones: k.mesh.skeleton.bones.length, verts: geo.getAttribute('position').count, scale: k.scale, hp: k.maxHp, hull: !geo.hasAttribute('furLen') };
    }, { c: C, cam: CAM });
    console.log(variant, JSON.stringify(info));
    for (const [pose, hold] of Object.entries(POSES)) {
      await page.evaluate((h) => { window.__e322k.hold = h; }, hold[variant]);
      await page.waitForTimeout(2500);
      const lf = await page.evaluate(() => { const f = window.__world.game.lastFrame; return { calls: f.calls, tris: f.triangles }; });
      writeFileSync(`${OUT}/${variant}-${pose}.jpg`, await page.screenshot({ type: 'jpeg', quality: 88 }));
      console.log(variant, pose, JSON.stringify(lf));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
