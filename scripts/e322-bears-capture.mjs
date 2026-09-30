#!/usr/bin/env node
// e322-bears-capture.mjs — E322 F-M2's board: Pine Hollow's bears posed in the real build, Debug ▸ Bear fix A (today) vs
// B (the stub-tail flap pressed away, the coats measured onto real bear tones), iPhone 16 Pro portrait (touch, phone
// tier, muted, Metal). Per variant, per bear (brown, Grizzled Sow, black): a rear three-quarter (the tail) and a side-on
// (the coat), the bear frozen at idle in daylight, the herds hidden; plus a bear-less frame of each view, so a
// bear mask (frame − empty frame) can measure the coat's rendered hue against the reference photo.
//   scripts/browser-lane.sh --max 20 node scripts/e322-bears-capture.mjs --url=http://127.0.0.1:4400 --out=<dir> [--variants=a,b] [--bears=brown,sow,black]
// Writes <out>/<variant>-<bear>-<view>.png and <out>/empty-<bear>-<view>.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e322-bears'));
const ONLY = flag('variants', 'a,b').split(',');
mkdirSync(OUT, { recursive: true });
const SPOT = { x: 6, z: -178 };
const WANT = flag('bears', 'brown,sow,black').split(',');
const BEARS = [['brown', 'brown'], ['sow', 'brown-old'], ['black', 'black']].filter(([n]) => WANT.includes(n));
// camera per view, relative to the bear (facing −X: its nose at −x, rump at +x): [dx, dy, dz, look dy]
const VIEWS = { rear: [5.6, 1.9, -4.4, 0.7], side: [0, 1.3, -10, 0.7] };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const { defaultBrowserType: _b, ...iphone } = devices['iPhone 16 Pro'];
  for (const variant of ONLY) {
    const ctx = await browser.newContext(iphone);
    await debugSettings(ctx, { pineBearFix: variant, creatures: 'models' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 200)); });
    page.on('console', (m) => { if (m.type() === 'warning' && /creature|bear|rig/i.test(m.text())) console.log('[warn]', m.text().slice(0, 200)); });
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&mute=1&nolock=1&skipintro=1&sw=0&tod=day&clock=1e6&x=${SPOT.x}&z=${SPOT.z + 30}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals) && window.__world?.hud?.entered === true, undefined, { timeout: 300000, polling: 1000 });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"]{display:none!important}' });
    await page.evaluate(() => {
      const w = window.__world, cam = w.game.camera;
      window.__e322 = { bear: null, pose: null };
      const st = window.__e322;
      w.animals.group.visible = false;
      w.game.onUpdate(() => {
        if (st.bear) { st.bear.debugGait = { gait: 'idle', phase: 0 }; st.bear.gaitW.fill(0); st.bear.update(1e-4, 0.5, true); }
        if (!st.pose) return;
        const p = st.pose;
        cam.position.set(p.x, p.y, p.z); cam.lookAt(p.tx, p.ty, p.tz);
        if (Math.abs(cam.fov - 40) > 0.01) { cam.fov = 40; cam.updateProjectionMatrix(); }
        for (const c of cam.children) c.visible = false;
      });
    });
    for (const [name, id] of BEARS) {
      const info = await page.evaluate(({ id: vid, spot }) => {
        const w = window.__world, st = window.__e322, am = w.animals;
        if (st.bear) { st.bear.mesh.parent?.remove(st.bear.mesh); st.bear = null; }
        const a = am.spawn('bear', spot.x, spot.z, -Math.PI / 2, vid);
        am.animals.splice(am.animals.indexOf(a), 1);   // no AI: it stands where it is put
        a.mesh.parent?.remove(a.mesh);
        w.game.scene.add(a.mesh);
        st.bear = a;
        const m = am.factory.model('bear', vid), sh = m.fur.sheenColor; return { variant: vid, scale: a.scale, y: a.position.y, sheen: [sh.r, sh.g, sh.b].map((v) => v.toFixed(3)).join(','), fix: localStorage.getItem('ws.settings.v1') };
      }, { id, spot: SPOT });
      for (const [view, [dx, dy, dz, ly]] of Object.entries(VIEWS)) {
        await page.evaluate(({ spot, dx: ox, dy: oy, dz: oz, ly: oly, s }) => {
          const st = window.__e322, y = st.bear.position.y;
          st.pose = { x: spot.x + ox * s, y: y + oy * s, z: spot.z + oz * s, tx: spot.x + (ox > 1 ? 0.25 * s : 0), ty: y + oly * s, tz: spot.z };
        }, { spot: SPOT, dx, dy, dz, ly, s: info.scale / 1.6 });
        await page.waitForTimeout(1800);
        writeFileSync(`${OUT}/${variant}-${name}-${view}.png`, await page.screenshot({ type: 'png' }));
        if (variant === ONLY[0]) {
          await page.evaluate(() => { window.__e322.bear.mesh.visible = false; });
          await page.waitForTimeout(800);
          writeFileSync(`${OUT}/empty-${name}-${view}.png`, await page.screenshot({ type: 'png' }));
          await page.evaluate(() => { window.__e322.bear.mesh.visible = true; });
        }
      }
      console.log(variant, name, JSON.stringify(info));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
