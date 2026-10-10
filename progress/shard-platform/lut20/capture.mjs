// SHARD-PLATFORM op-lut20 (E435): does each shard's learned colour LUT draw in the grid, and in SHARD SELECT?
// Per shard (Signal Dunes, Nalati, Nine Dragon), one muted Metal iPhone 16 Pro portrait context per run, Developer on,
// phone tier / 2x, Memory saver on (SF19b's setup):
//   grid-A  home in the grid (driven in from the midpoint road to 14 m inside the edge, facing in), the Debug row
//           gridDeclaredLut off (A: the grid as it was)
//   grid-B  the same pose with the row on (B: the cell carries the LUT its look declares, ExtendLook.lut)
//   select  the shard standalone (SHARD SELECT's boot: ?chunk=<slug>), at its spawn, for comparison
// Each shot's readout: the grid frame owner's chain (owner, weight, lut) or, standalone, whether a LUT draws (the engine
// chain's LUT effect from the sky's LUT, or the shard's own composite's LUT amount where it applies one).
//   SERVE_OWNER=op-lut20 scripts/serve-build.sh --rev <sha> --devserver --name lut20-after
//   scripts/browser-lane.sh --max 40 node progress/shard-platform/lut20/capture.mjs <preview-url> <scratch-dir> [slug]
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const [base, out, only] = process.argv.slice(2);
if (!base || !out) throw new Error('usage: capture.mjs <preview-url> <out-dir> [slug]');
mkdirSync(out, { recursive: true });
/** each shard and the edge it is approached from (the outward normal of that edge) */
const SHARDS = [
  { slug: 'sunscar-dunes', normal: [1, 0] },
  { slug: 'nalati-grasslands', normal: [-1, 0] },
  // Nine Dragon's city stands at +125 m (Lantern Square), out of sight from the road edge: its shots are posed at its own
  // spawn frame (manifest spawn, the cell's local frame) once home, the pose SHARD SELECT boots at
  { slug: 'nine-dragon-stack', normal: [0, 1], local: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180), pitch: 0 } },
].filter((row) => !only || row.slug === only);
const report = { version: await (await fetch(new URL('version.json', base))).json(), started: new Date().toISOString(), shards: {} };
const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function context(row, lut) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0, gridDeclaredLut: lut }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { row.errors.push(String(error.stack ?? error).slice(0, 400)); });
  return { ctx, page };
}

async function gridHome(row, slug, normal, lut, local) {
  const { ctx, page } = await context(row, lut);
  try {
    await page.goto(base, { waitUntil: 'commit' });
    await page.locator('.ws-main-grid').click();
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
    const cell = (await page.evaluate(() => window.__wildshard.shard.grid.state())).cells.find((c) => c.slug === slug);
    if (!cell) throw new Error(`No ${slug} cell (a DEVSERVER build with Developer on?)`);
    const ox = cell.cell[0] * 555, oz = cell.cell[1] * 555, at = (d) => ({ x: ox + normal[0] * d, z: oz + normal[1] * d });
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
    const route = gridFloorWitnessFailures(result);
    if (local) await page.evaluate(async (p) => { await window.__wildshard.pose(p); }, local);
    // hold the player still at home so A and B frame the same pose
    await page.evaluate(() => { const w = window.__wildshard.requireWorld(), at = w.player.position.clone(); const tick = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick(); });
    await page.waitForTimeout(4000);
    const name = `${slug}-grid-${lut === 'on' ? 'B' : 'A'}`;
    await page.screenshot({ path: join(out, `${name}.png`) });
    // B's run also shoots A in the same frame: the carried LUT's effect held at opacity 0 (what A draws) a few frames on,
    // so the pair differs only by the LUT, not by the rain, crowd and clock of two page loads
    let same = null;
    if (lut === 'on') {
      same = await page.evaluate(() => {
        const passes = window.__wildshard.requireWorld().game.composer.passes;
        for (const pass of passes) for (const e of pass.effects ?? []) {
          const t = e.uniforms?.get?.('lut')?.value;
          if (typeof t?.name === 'string' && t.name.endsWith('-declared-lut')) { Object.defineProperty(e.blendMode.opacity, 'value', { get: () => 0, set: () => undefined }); return t.name; }
        }
        return null;
      });
      if (same !== null) { await page.waitForTimeout(150); await page.screenshot({ path: join(out, `${slug}-grid-A-same.png`) }); }
    }
    const frame = await page.evaluate(() => { const s = window.__wildshard.shard.grid.state(), p = window.__wildshard.requireWorld().player.position; return { local: [p.x, p.y, p.z], feet: s.feet, inside: s.inside, owner: s.frame?.owner, chain: s.frame?.chain }; });
    return { name, route, frame, sameFrameA: same };
  } finally { await ctx.close(); }
}

async function standalone(row, slug) {
  const { ctx, page } = await context(row, 'off');
  try {
    await page.goto(new URL(`?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`, base).href, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load')));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
    await page.waitForTimeout(8000);
    await page.screenshot({ path: join(out, `${slug}-select.png`) });
    const lut = await page.evaluate(() => {
      const game = window.__wildshard.world.game, nd = window.__wildshard.shard?.['nd.render'];
      return { skyLut: game.sky?.lut?.name ?? null, compositeLutAmount: nd?.jiehua?.uniforms?.get?.('uLutAmt')?.value ?? nd?.jiehua?.grade?.uLutAmt?.value ?? null };
    });
    return { name: `${slug}-select`, lut };
  } finally { await ctx.close(); }
}

try {
  for (const { slug, normal, local } of SHARDS) {
    const row = { errors: [], shots: {} }; report.shards[slug] = row; save();
    for (const step of [() => gridHome(row, slug, normal, 'off', local), () => gridHome(row, slug, normal, 'on', local), () => standalone(row, slug)]) {
      try { const shot = await step(); row.shots[shot.name] = shot; } catch (error) { (row.failures ??= []).push(String(error.stack ?? error).slice(0, 1200)); }
      save();
    }
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.shards).map(([k, v]) => [k, { failures: v.failures, errors: v.errors.length,
  shots: Object.fromEntries(Object.entries(v.shots).map(([n, s]) => [n, s.frame ? { owner: s.frame.owner, chain: s.frame.chain?.owner, weight: s.frame.chain?.weight, lut: s.frame.chain?.lut, route: s.route } : s.lut])) }]))));
