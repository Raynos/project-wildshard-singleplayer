// SHARD-PLATFORM op-frame22 (E435, SF63 / G158): op-frame21's Sky Reach B shot kept a "Loading" card on screen after the
// cell reported ready. Re-run that pose (north sky dock, local -1.2 / 0.3 / 236.5, yaw 0) with the gridCellComposite row
// off (A) and on (B), and at each of three moments after the cell reports ready (0 s, 4 s, 15 s) record a screenshot and
// what could be the card: the DOM loading screen, the grid's 3D cell screens (G217), the feet, and the fixed overlays' text.
//   SERVE_OWNER=op-frame22 scripts/serve-build.sh --rev <sha> --devserver --name frame22
//   scripts/browser-lane.sh --max 30 node progress/shard-platform/frame22/sky-loading.mjs <preview-url> <scratch-dir>
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: sky-loading.mjs <preview-url> <out-dir>');
mkdirSync(out, { recursive: true });
const slug = 'far-reach', normal = [0, 1], local = { x: -1.2, y: 0.3, z: 236.5, yaw: 0, pitch: -0.05 };
const report = { version: await (await fetch(new URL('version.json', base))).json(), started: new Date().toISOString(), runs: {} };
const save = () => writeFileSync(join(out, 'sky-loading.json'), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

function readout() {
  const api = window.__wildshard, s = api.shard.grid.state(), l = s.live.live, p = api.requireWorld().player.position;
  const load = document.querySelector('.ws-load');
  const overlays = [...document.querySelectorAll('body *')].filter((e) => {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    const t = e.textContent ?? ''; return /load/iu.test(t) && t.length < 400 && e.children.length < 8;
  }).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 80), text: (e.textContent ?? '').trim().slice(0, 160) }));
  return { local: [p.x, p.y, p.z], feet: l.worldFeet, current: l.current, inside: s.inside, gameplayReady: l.gameplayReady, pending: l.pending,
    residents: l.residents, screens: s.screens, wsLoad: load ? { text: (load.textContent ?? '').trim().slice(0, 300), classes: load.className } : null, overlays };
}

async function run(lut) {
  const row = { errors: [], console: [], shots: [] }; report.runs[lut] = row; save();
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0, gridCellComposite: lut }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { row.errors.push(String(error.stack ?? error).slice(0, 400)); });
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') row.console.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  try {
    await page.goto(new URL('?mute=1', base).href, { waitUntil: 'commit' });
    await page.locator('.ws-main-grid').click();
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
    const cell = (await page.evaluate(() => window.__wildshard.shard.grid.state())).cells.find((c) => c.slug === slug);
    if (!cell) throw new Error(`No ${slug} cell`);
    const ox = cell.cell[0] * 555, oz = cell.cell[1] * 555, at = (d) => ({ x: ox + normal[0] * d, z: oz + normal[1] * d });
    // op-frame21's approach: posed once on the road beside its edge facing in, then held input into the cell
    const pose = (p) => page.evaluate(async (p) => {
      const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.requireWorld().player;
      const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
      await api.pose({ x: p.x - origin.x, y: 0.55, z: p.z - origin.z, yaw: p.yaw, pitch: -0.05 });
      await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); });
      const cam = api.requireWorld().game.camera, v = cam.getWorldDirection(cam.position.clone());
      return Math.atan2(v.x, v.z);
    }, p);
    const start = at(277.5);
    const a0 = await pose({ ...start, yaw: 0 }), a1 = await pose({ ...start, yaw: Math.PI / 2 }), turn = Math.sign(Math.sin(a1 - a0)) || 1;
    await pose({ ...start, yaw: (Math.atan2(-normal[0], -normal[1]) - a0) * turn });
    await page.waitForFunction(() => { const s = window.__wildshard.shard.grid.state(); return s.live.live.current === null && s.inside === null && s.live.live.gameplayReady; });
    const doc = await page.evaluate(gridFloorDocumentIdentity);
    const result = await runFloorGridRoute(page, { name: `${slug}-in`, from: null, to: cell.instance, movement: 'road-hover', waypoints: [at(236)], requiredResidents: [cell.instance] }, doc);
    row.route = gridFloorWitnessFailures(result);
    await page.evaluate(async (p) => { await window.__wildshard.pose(p); }, local);
    await page.waitForFunction((inst) => { const l = window.__wildshard.shard.grid.state().live.live; return l.current === inst && l.gameplayReady && l.pending.length === 0; }, cell.instance, { timeout: 180000 });
    await page.evaluate(() => { const w = window.__wildshard.requireWorld(), p = w.player.position.clone(); const tick = () => { w.player.position.copy(p); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick(); });
    let last = 0;
    for (const t of [0, 4, 15]) {
      await page.waitForTimeout((t - last) * 1000); last = t;
      const name = `sky-${lut === 'on' ? 'B' : 'A'}-${String(t)}s`;
      await page.screenshot({ path: join(out, `${name}.png`) });
      row.shots.push({ name, ...(await page.evaluate(readout)) }); save();
    }
  } catch (error) { row.failure = String(error.stack ?? error).slice(0, 1200); } finally { await ctx.close(); save(); }
}

try { for (const lut of ['off', 'on']) await run(lut); } finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.runs).map(([k, v]) => [k, { failure: v.failure, errors: v.errors.length,
  shots: v.shots.map((s) => ({ name: s.name, current: s.current, ready: s.gameplayReady, screens: s.screens, wsLoad: s.wsLoad, overlays: s.overlays.length })) }]))));
