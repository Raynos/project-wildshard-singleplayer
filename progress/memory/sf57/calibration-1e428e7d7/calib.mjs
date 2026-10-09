// SF57 calibration probe: labelled live GL (and the allocator's claims) for Driftwood standalone and the public grid home,
// in each texture mode (Settings ▸ Debug ▸ GPU textures), Chromium "iPhone 16 Pro", muted. GL only: WebContent needs the Simulator.
import { chromium, devices } from '/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs';
import { publicGridIntentCode } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/public-grid.mjs';
import { GL_INIT } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/parity/glbytes.mjs';
import { debugSettings } from '/Users/raynos/projects/games/wildshard-singleplayer/scripts/debug-settings.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4402';
const out = [];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-unsafe-swiftshader'] });
for (const page0 of ['standalone', 'public']) for (const tex of ['img', 'ktx2']) {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(GL_INIT);
  await context.addInitScript({ content: 'window.__wildshardHarness={seed:357,capture:null};' });
  await debugSettings(context, { tex });
  if (page0 === 'public') await context.addInitScript(publicGridIntentCode({ instance: 'driftwood-isle', slug: 'driftwood-isle' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction((p) => {
    const api = window.__wildshard; if (!api?.world) return false;
    if (p === 'standalone') return api.state?.().appState === 'play';
    const s = api.shard?.grid?.state?.(); const live = s?.live?.live;
    return live?.current === 'driftwood-isle' && live.gameplayReady === true && s.rings?.inFlight === 0;
  }, page0, { timeout: 120000, polling: 250 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow?.(); });
  await page.waitForTimeout(12000);
  const r = await page.evaluate(() => {
    const gl = window.__sc_gl();
    const sum = (k) => gl.reduce((s, x) => s + x[k], 0);
    const s = window.__wildshard.shard?.grid?.state?.();
    return { textures: window.__wildshard.textures?.(), tex: sum('texBytes'), rb: sum('rbBytes'), buf: sum('bufBytes'), accounted: s?.accountedBytes ?? null };
  });
  const total = r.tex + r.rb + r.buf;
  out.push({ page: page0, pick: tex, mode: r.textures?.mode, why: r.textures?.why, glMB: +(total / 1e6).toFixed(1), texMB: +(r.tex / 1e6).toFixed(1), rbMB: +(r.rb / 1e6).toFixed(1), bufMB: +(r.buf / 1e6).toFixed(1), accountedMB: r.accounted === null ? null : +(r.accounted / 1e6).toFixed(1), errors: errors.slice(0, 3) });
  console.error(JSON.stringify(out[out.length - 1]));
  await context.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
