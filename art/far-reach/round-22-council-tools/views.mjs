// views.mjs <url> <outdir> [extra-shots.json] [--only=id,id] [--tier=phone|desktop]: the progress cameras
// (art/far-reach/progress/cameras.json) plus extra shots, iPhone portrait, as shard-progress.mjs shoots them; JPEG. No clip.
// An extra shot may carry `eval` (a JS string run in the page before the settle).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/Users/raynos/projects/games/wildshard-singleplayer';
const { chromium } = await import(join(REPO, 'node_modules/playwright/index.mjs'));
const { saveFixture } = await import(join(REPO, 'scripts/debug-settings.mjs'));
const [URL_BASE, OUT, extra] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const tier = (process.argv.find((a) => a.startsWith('--tier=')) ?? '--tier=phone').slice(7);
mkdirSync(OUT, { recursive: true });
let shots = JSON.parse(readFileSync(join(REPO, 'art/far-reach/progress/cameras.json'), 'utf8')).shots;
if (extra && extra.endsWith('.json')) shots = shots.concat(JSON.parse(readFileSync(extra, 'utf8')));
if (only.length) shots = shots.filter((s) => only.includes(s.id));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const D = Math.PI / 180;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 0x2545f491, capture: null, lane: 'local', sha: '', browser: 'chromium', errors: [], saves: { read: [], written: [] }, audioRequests: [], gpuBytes: () => ({ textures: 0, renderbuffers: 0, buffers: 0, total: 0 }) }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('far-reach'))) errors.push('console: ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto(`${URL_BASE}/?chunk=far-reach&tier=${tier}&touch=1&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world?.player && window.__wildshard?.world?.game) && document.querySelector('.ws-load') === null, undefined, { timeout: 480000, polling: 1000 });
  console.log('loaded in', Math.round((Date.now() - t0) / 1000), 's');
  await sleep(5000);
  const shot = async (name) => { const p = join(OUT, `${name}.png`); writeFileSync(p, await page.screenshot({ type: 'png' }));
    execFileSync('sips', ['-Z', '1688', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', p, '--out', join(OUT, `${name}.jpg`)], { stdio: 'ignore' });
    execFileSync('rm', [p]); console.log('shot', name); };
  if (!only.length || only.includes('first-frame')) await shot('first-frame');
  await page.evaluate(() => {
    const w = window.__wildshard.world, cam = w.game.camera;
    try { w.animals.calm = true; } catch { /* */ }
    window.__prog = null;
    // a god view hides the viewmodel and widens the fov; the next player pose gets both back (they stayed hidden before)
    const hidden = new Set(); let fov0 = null;
    w.game.onLate(() => { const v = window.__prog;
      if (!v) { if (hidden.size) { for (const c of hidden) c.visible = true; hidden.clear(); } if (fov0 !== null) { cam.fov = fov0; cam.updateProjectionMatrix(); fov0 = null; } return; }
      if (fov0 === null) fov0 = cam.fov;
      cam.position.set(v.pos[0], v.pos[1], v.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[1], v.look[2]);
      if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov = v.fov; cam.updateProjectionMatrix(); }
      for (const c of cam.children) if (c.visible) { c.visible = false; hidden.add(c); } cam.updateMatrixWorld(true); });
  });
  const hud = (on) => page.evaluate((v) => { const h = document.getElementById('hud'); if (h) h.style.visibility = v ? '' : 'hidden'; }, on);
  for (const s of shots) {
    await page.evaluate((calm) => { try { window.__wildshard.world.animals.calm = calm; } catch { /* */ } }, s.calm !== false);
    // a shot's `stage` (E399, as shard-progress): real game state set through the shard's exposed handle before the pose
    if (s.stage !== undefined) await page.evaluate((st) => { const h = window.__wildshard.shard?.farReach; if (typeof h?.stage === 'function') h.stage(st); else console.log('no stage()'); }, s.stage);
    if (s.god) { await page.evaluate((g) => { window.__prog = g; }, { fov: 72, ...s.god }); await hud(false); }
    else { await page.evaluate((p) => { window.__prog = null; window.__wildshard.pose(p); }, { x: s.x, z: s.z, yaw: s.yaw * D, pitch: (s.pitch ?? -4) * D, ...(s.y === undefined ? {} : { y: s.y }) }); await hud(true); }
    if (s.eval) await page.evaluate(s.eval);
    await sleep(s.settle ?? 2500);
    await shot(s.id);
  }
  const info = await page.evaluate(() => { try { const r = window.__wildshard.world.game.renderer.info; return { render: r.render, memory: r.memory }; } catch { return null; } });
  console.log('renderer', JSON.stringify(info));
} finally { await browser.close(); if (errors.length) console.log('ERRORS', JSON.stringify(errors, null, 1)); }
