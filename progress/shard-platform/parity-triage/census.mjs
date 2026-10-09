// parity-triage: boot census (textures by GL label, scene named, boot render memory) for <sha> <shard> <tier> <out.json>
import { writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { installInit } = await import(`${ROOT}/scripts/parity/init.mjs`);
const { developerSettings, hideDeveloperOverlays } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { cachedTree, serve } = await import(`${ROOT}/scripts/parity/serve.mjs`);
const { browserPool } = await import(`${ROOT}/scripts/parity/pool.mjs`);

const [sha, shard, tier, out, settingsJson] = process.argv.slice(2);
const extra = settingsJson ? JSON.parse(settingsJson) : {};
const isUrl = sha.startsWith('http');
const exported = isUrl ? null : await cachedTree(ROOT, sha);
const preview = isUrl ? { url: sha, close: () => {} } : await serve(exported.tree, sha, 'hit' in exported);
const pool = browserPool(ROOT, 1, 'metal');
try {
  const browser = await pool.browser(0);
  const context = await browser.newContext(tier === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' } : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await installInit(context, { lane: 'm5', sha, browser: browser.version(), capture: 30, accelerated: true, tier });
  await developerSettings(context, { time: 'midday', weather: 'clear', ...extra });
  await context.addInitScript(hideDeveloperOverlays);
  const page = await context.newPage(); page.setDefaultTimeout(240000); const logs=[]; page.on('console',(m)=>{if(['warning','error'].includes(m.type()))logs.push(m.type()+': '+m.text().slice(0,300));});
  const params = new URLSearchParams({ chunk: shard, tier, skipintro: '1', nolock: '1', mute: '1', weather: 'clear', ...(tier === 'phone' ? { touch: '1' } : {}), sw: '0' });
  await page.goto(`${preview.url}/?${params}`);
  await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load'));
  const boot = await page.evaluate(() => window.__wildshard.boot);
  if (process.env.AB) { await page.evaluate((code) => { const g = window.__wildshard.requireWorld().game; (new Function('g', code))(g); }, process.env.AB); }
  await page.evaluate(() => window.__parity.advance(30));
  const census = await page.evaluate((process_detail) => {
    const g = window.__wildshard.requireWorld().game;
    const contexts = window.__sc_gl().map(({ gl, ...r }) => r);
    const rows = contexts.flatMap((c) => c.resources.map((r) => ({ ...r })));
    const named = [];
    g.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { const chain=[];let p=o.parent;while(p&&chain.length<4){chain.push(p.name||p.type);p=p.parent;} const gp=o.geometry?.attributes?.position; o.updateWorldMatrix(true,false); const e=o.matrixWorld.elements; named.push(`${o.parent?.name ?? ''}/${o.name}|${o.type}|vis=${o.visible}` + (process_detail ? `|${chain.join('<')}|${o.geometry?.type}|${(Array.isArray(o.material)?o.material.map(m=>m.type).join(','):o.material?.type)}|v=${gp?.count}|at=${e[12].toFixed(1)},${e[13].toFixed(1)},${e[14].toFixed(1)}|cast=${o.castShadow}` : '')); } });
    const progs = (g.renderer.info.programs ?? []).map((p) => p.name ?? '').sort();
    const gl = g.renderer.getContext();
    const srcs = (g.renderer.info.programs ?? []).map((p) => { const sh = gl.getAttachedShaders(p.program) ?? []; return { name: p.name, key: p.cacheKey, src: sh.map((x) => gl.getShaderSource(x)).join('\n//----\n') }; });
    return { srcs, memory: g.renderer.info.memory, rows, named: named.sort(), progs: (g.renderer.info.programs ?? []).map((p) => `${p.name}|${p.cacheKey?.slice(0,80)}`).sort() };
  }, Boolean(process.env.DETAIL));
  writeFileSync(out, JSON.stringify({ logs, sha, shard, tier, boot: { render: boot.render, gpuBytes: boot.gpuBytes, scene: boot.scene }, census }, null, 1));
  console.log(`${sha} ${shard}.${tier}: textures ${census.memory.textures} rows ${census.rows.length}`);
  await context.close();
} finally { await pool.close(); preview.close(); exported?.cleanup(); }
