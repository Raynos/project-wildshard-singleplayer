// parity-triage: does the page answer from the SF67 geometry table? <url> <shard> <tier> <chromium|webkit> <served|blocked> <out.json>
// Run through scripts/browser-lane.sh. Muted, iPhone 16 Pro for the phone tier, Developer on (the parity fixture).
import { writeFileSync } from 'node:fs';
import { chromium, webkit, devices } from 'playwright';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { developerSettings, hideDeveloperOverlays } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const [url, shard, tier, engine, mode, out] = process.argv.slice(2);
const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(tier === 'phone' ? { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' } : { viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await developerSettings(context, { time: 'midday', weather: 'clear' });
  await context.addInitScript(hideDeveloperOverlays);
  const tables = [];
  await context.route(/\/geometry\.bin(\?|$)/, async (route) => {
    if (mode === 'blocked') { tables.push({ url: route.request().url(), status: 'blocked' }); await route.abort(); return; }
    const response = await route.fetch(); const body = await response.body();
    tables.push({ url: route.request().url(), status: response.status(), bytes: body.length });
    await route.fulfill({ response, body });
  });
  const page = await context.newPage(); page.setDefaultTimeout(300000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/?${new URLSearchParams({ chunk: shard, tier, skipintro: '1', nolock: '1', mute: '1', weather: 'clear', sw: '0', ...(tier === 'phone' ? { touch: '1' } : {}) })}`);
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'));
  const result = await page.evaluate(() => {
    const g = window.__wildshard.requireWorld().game;
    let h = 0x811c9dc5 >>> 0, meshes = 0, verts = 0;
    g.scene.traverse((o) => {
      const p = o.geometry?.attributes?.position; if (!p || !o.isMesh) return;
      meshes++; verts += p.count;
      const a = p.array; const u = new Uint32Array(a.buffer, a.byteOffset, (a.byteLength >> 2));
      for (let i = 0; i < u.length; i += 7) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; }
    });
    return { meshes, verts, positionHash: h.toString(16), props: window.__wildshard.boot?.stepMs?.props ?? null };
  });
  writeFileSync(out, JSON.stringify({ shard, tier, engine, mode, tables, errors, ...result }, null, 1));
  console.log(`${shard}.${tier} ${engine} ${mode}: tables ${JSON.stringify(tables.map((t) => t.status))} meshes ${result.meshes} verts ${result.verts} hash ${result.positionHash} props ${result.props} ms errors ${errors.length}`);
} finally { await browser.close(); }
