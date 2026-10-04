// G144 hybrid-mem (E435): Driftwood in Playwright WebKit (JSC, like Safari): playable + turn + settle; WebContent footprint samples
//   scripts/browser-lane.sh node progress/shard-platform/mem-trim/webkit-footprint.mjs --url=... --hybrid=on|off --copies=on|off [--settle=30]
const R = new URL('../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { webkit, devices } = await import(`${R}/node_modules/playwright/index.mjs`);
const { saveFixtureCode } = await import(`${R}/scripts/debug-settings.mjs`);
const { execSync } = await import('node:child_process');
const flag = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const URL_BASE = flag('url', ''), HYBRID = flag('hybrid', 'off'), COPIES = flag('copies', 'on'), SETTLE = Number(flag('settle', '30'));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const before = new Set(execSync('pgrep -f com.apple.WebKit.WebContent || true').toString().split('\n').filter(Boolean));
const browser = await webkit.launch({});
const footprints = () => {
  const pids = execSync('pgrep -f com.apple.WebKit.WebContent || true').toString().split('\n').filter((p) => p && !before.has(p));
  return pids.map((pid) => { try { const o = execSync(`footprint -p ${pid} 2>/dev/null | grep -m1 -i "footprint"`).toString(); const m = o.match(/([\d.]+)\s*(MB|GB|KB)/); return m ? +(Number(m[1]) * (m[2] === 'GB' ? 1024 : m[2] === 'KB' ? 1 / 1024 : 1)).toFixed(1) : o.trim(); } catch { return null; } });
};
try {
  const d = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext({ userAgent: d.userAgent, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(saveFixtureCode({ scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodGpuOnlyCopies', data: COPIES }));
  await page.addInitScript(saveFixtureCode({ scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: HYBRID }));
  page.on('pageerror', (e) => { console.log('pageerror', String(e).slice(0, 200)); });
  await page.goto(`${URL_BASE}/?chunk=driftwood-isle&skipintro=1&nolock=1&mute=1&touch=1&tier=phone`, { waitUntil: 'commit', timeout: 180_000 });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world) && !document.querySelector('.ws-load'), null, { timeout: 300_000, polling: 500 });
  await page.evaluate(async () => { const p = window.__wildshard.world.player; for (let k = 0; k < 8; k++) { p.yaw = (p.yaw ?? 0) + Math.PI / 4; await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); }); } });
  const series = [];
  for (let s = 0; s < SETTLE; s += 5) { await sleep(5000); series.push(footprints()); }
  const info = await page.evaluate(() => { const g = window.__wildshard.world.game; const m = g.renderer.info.memory; return { geometries: m.geometries, textures: m.textures, calls: g.renderer.info.render.calls }; });
  console.log(JSON.stringify({ hybrid: HYBRID, copies: COPIES, footprintMB: series, ...info }));
  await ctx.close();
} finally { await browser.close(); }
