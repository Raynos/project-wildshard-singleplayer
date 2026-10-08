// G227 platform atlas (E435): GL bytes by label and fixed-pose captures of the grid's road signs, before / after.
// node progress/shard-platform/platform-atlas/capture.mjs <base url> <out dir> <label>
// Run through scripts/browser-lane.sh. One muted Chromium/Metal "iPhone 16 Pro", phone tier, dpr 2, Developer ON.
// Per pose: the full frame (HUD hidden) and the same frame with every drawable but `grid-signs` hidden (signs only: what the
// atlas change touches, with no animated water / sky / creatures in the comparison).
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const [base, out, label] = process.argv.slice(2);
if (!base || !out || !label) throw new Error('usage: capture.mjs <base> <out> <label>');
mkdirSync(out, { recursive: true });
const layout = JSON.parse(readFileSync(join(import.meta.dirname, 'signs.json'), 'utf8'));
const report = { label, version: await (await fetch(new URL('version.json', base))).json(), poses: [], gl: null, errors: [] };
const save = () => writeFileSync(join(out, `${label}.json`), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(GL_INIT);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', (error) => { report.errors.push(String(error)); });
  await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 });
  await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
  await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
    || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
  const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
  await page.evaluate(() => window.__wildshard.world.hud.enterNow());
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
  await page.waitForTimeout(6000);
  report.gl = await page.evaluate(() => {
    const rows = window.__sc_gl().flatMap((c) => c.resources).filter((r) => /grid-signs|grid-open-plot-(billboards|signs|holo-cards)/u.test(r.asset) && r.kind === 'texture');
    const total = window.__sc_gl().reduce((sum, c) => sum + c.totalBytes, 0), tex = window.__sc_gl().reduce((sum, c) => sum + c.texBytes, 0);
    return { totalMB: total / 1e6, textureMB: tex / 1e6, atlases: rows.map((r) => ({ asset: r.asset, MB: r.bytes / 1e6, level0: r.subresources?.find((s) => s.level === 0) })) };
  });
  save();
  await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  // the frame the player lives in, and the yaw convention (forward at yaw 0 and yaw pi/2)
  const frame = await page.evaluate(async () => {
    const api = window.__wildshard, live = api.shard.grid.state().live.live, p = api.world.player;
    const origin = { x: live.worldFeet.x - p.position.x, z: live.worldFeet.z - p.position.z };
    const dir = async (yaw) => { await api.pose({ x: p.position.x, z: p.position.z, yaw, pitch: 0 }); await new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); });
      const c = api.world.game.camera, m = c.matrixWorld.elements; return { x: -m[8], z: -m[10] }; };
    const home = { x: p.position.x, z: p.position.z, yaw: p.yaw };
    const d0 = await dir(0), d90 = await dir(Math.PI / 2);
    return { origin, worldFeet: live.worldFeet, current: live.current, home, d0, d90 };
  });
  report.frame = frame; save();
  const yawFor = (v) => Math.atan2(v.x * frame.d90.x + v.z * frame.d90.z, v.x * frame.d0.x + v.z * frame.d0.z);
  // the signs nearest the start, the biggest boards first among them, read from three distances
  const feet = frame.worldFeet;
  const near = layout.signs.map((s) => ({ ...s, d: Math.hypot(s.at.x - feet.x, s.at.z - feet.z) })).sort((a, b) => a.d - b.d).slice(0, 6).sort((a, b) => b.lines - a.lines);
  const poses = [];
  for (const [k, s] of near.slice(0, 3).entries()) for (const dist of [7, 22, 70]) {
    const at = { x: s.at.x + s.facing.x * dist, z: s.at.z + s.facing.z * dist };
    poses.push({ name: `sign${k}-${dist}m`, x: at.x - frame.origin.x, z: at.z - frame.origin.z, yaw: yawFor({ x: -s.facing.x, z: -s.facing.z }), pitch: 0 });
  }
  // inside the start cell: the spawn, looking at the nearest sign and along the start's own heading
  poses.push({ name: 'cell-spawn-heading', x: frame.home.x, z: frame.home.z, yaw: frame.home.yaw, pitch: 0 });
  { const s = near[0]; poses.push({ name: 'cell-spawn-to-sign', x: frame.home.x, z: frame.home.z, yaw: yawFor({ x: s.at.x - feet.x, z: s.at.z - feet.z }), pitch: 0 }); }
  for (const pose of poses) {
    await page.evaluate((p) => window.__wildshard.pose(p), pose);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `${label}-${pose.name}-full.png`) });
    const shown = await page.evaluate(() => new Promise((resolve) => {
      const scene = window.__wildshard.world.game.rootScene, hidden = [];
      let signs = 0;
      scene.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && o.visible) { if (o.name === 'grid-signs') signs++; else { o.visible = false; hidden.push(o); } } });
      window.__atlasHidden = hidden;
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(signs)));
    }));
    await page.screenshot({ path: join(out, `${label}-${pose.name}-signs.png`) });
    await page.evaluate(() => { for (const o of window.__atlasHidden) o.visible = true; window.__atlasHidden = []; });
    report.poses.push({ ...pose, signMeshes: shown }); save();
  }
} catch (error) {
  report.failure = String(error); save(); console.error(report.failure); process.exitCode = 1;
} finally { await browser.close(); save(); }
