// op-look28 scratch: which meshes carry faces in a cell-edge plane (any parent), and the grid's seam features
import { chromium, devices } from 'playwright';
import { saveFixture } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';
const [base] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0 }, merge: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  await page.goto(base, { waitUntil: 'commit' });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => !document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live));
  await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => {
    const w = window.__wildshard.requireWorld(), pitch = 555, out = {};
    const fromRoad = (v) => v - (Math.round((v - pitch / 2) / pitch) * pitch + pitch / 2);
    w.game.rootScene.updateMatrixWorld(true);
    w.game.rootScene.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry?.getAttribute?.('position'), idx = o.geometry?.getIndex?.(); if (!pos) return;
      const chain = []; for (let p = o; p; p = p.parent) chain.push(p.name || p.type);
      const key = `${chain.slice(0, 4).join('<')}${o.isInstancedMesh ? ' [inst]' : ''}`;
      const m = o.matrixWorld.elements, P = (k) => { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k); return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
      const tris = Math.min(idx ? idx.count / 3 : pos.count / 3, 400000);
      let faces = 0, tall = 0;
      for (let t = 0; t < tris; t++) {
        const v = [0, 1, 2].map((q) => P(idx ? idx.getX(t * 3 + q) : t * 3 + q));
        for (const axis of [0, 2]) {
          const rr = v.map((p) => fromRoad(p[axis]));
          if (!rr.every((x) => Math.abs(Math.abs(x) - 27.5) < 0.3)) continue;
          const h = Math.max(...v.map((p) => p[1])) - Math.min(...v.map((p) => p[1]));
          if (h > 0.5) { faces++; tall = Math.max(tall, h); }
        }
      }
      if (faces) out[key] = { faces: (out[key]?.faces ?? 0) + faces, tallest: Math.max(out[key]?.tallest ?? 0, Math.round(tall * 10) / 10) };
    });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await browser.close(); }
