// SHARD-PLATFORM op-frame21 (E435, SF63 / G158): does a shard's own post composite (ExtendLook.cell) draw in the grid?
// Per shard (Nine Dragon: the Jiehua composite; Sky Reach: its NEUTRAL tone curve), one muted Metal iPhone 16 Pro portrait
// context per run, Developer on, phone tier / 2x, Memory saver on (op-lut20's setup):
//   grid-A  home in the grid (driven in from the midpoint road, then posed at its own spawn frame), the Debug row
//           gridCellComposite off (A: the grid as it was)
//   grid-B  the same pose with the row on (B: the cell runs the composite its look declares)
//   select  the shard standalone (SHARD SELECT's boot: ?chunk=<slug>), at the same local pose, for comparison
// Each shot's readout: the grid frame owner's chain (owner, weight, post knobs) and whether the composite is in the page's
// colour pass with its opacity, and the side passes before it.
//   SERVE_OWNER=op-frame21 scripts/serve-build.sh --rev <sha> --devserver --name frame21-B
//   scripts/browser-lane.sh --max 40 node progress/shard-platform/frame21/capture.mjs <preview-url> <scratch-dir> [slug]
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
  // Nine Dragon's city stands at +125 m (Lantern Square), out of sight from the road edge: its shots are posed at its own
  // spawn frame (manifest spawn, the cell's local frame) once home, the pose SHARD SELECT boots at
  { slug: 'nine-dragon-stack', normal: [0, 1], local: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180), pitch: 0 } },
  // Sky Reach: on the north sky dock (G200's dock pose), looking back in over the islands
  { slug: 'far-reach', normal: [0, 1], local: { x: -1.2, y: 0.3, z: 236.5, yaw: 0, pitch: -0.05 } },
].filter((row) => !only || row.slug === only);
const report = { version: await (await fetch(new URL('version.json', base))).json(), started: new Date().toISOString(), shards: {} };
const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function context(row, lut) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0, gridCellComposite: lut }, merge: true });
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
    // the cell's runtime entered and settled (no loading card over the frame)
    await page.waitForFunction((inst) => { const l = window.__wildshard.shard.grid.state().live.live; return l.current === inst && l.gameplayReady && l.pending.length === 0; }, cell.instance, { timeout: 180000 });
    // hold the player still at home so A and B frame the same pose
    await page.evaluate(() => { const w = window.__wildshard.requireWorld(), at = w.player.position.clone(); const tick = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick(); });
    await page.waitForTimeout(4000);
    const name = `${slug}-grid-${lut === 'on' ? 'B' : 'A'}`;
    await page.screenshot({ path: join(out, `${name}.png`) });
    const frame = await page.evaluate(() => {
      const s = window.__wildshard.shard.grid.state(), p = window.__wildshard.requireWorld().player.position, passes = window.__wildshard.requireWorld().game.composer.passes;
      const colour = passes.find((pass) => (pass.effects ?? []).some((e) => e.name === 'ToneMappingEffect' || e.constructor?.name === 'ToneMappingEffect'));
      const effects = (colour?.effects ?? []).map((e) => `${e.name}@${Math.round((e.blendMode?.opacity?.value ?? -1) * 100) / 100}`);
      return { local: [p.x, p.y, p.z], feet: s.feet, inside: s.inside, owner: s.frame?.owner, chain: s.frame?.chain, passes: passes.map((pass) => `${pass.name}${pass.enabled ? '' : '(off)'}`), colour: effects };
    });
    return { name, route, frame };
  } finally { await ctx.close(); }
}

async function standalone(row, slug, local) {
  const { ctx, page } = await context(row, 'off');
  try {
    await page.goto(new URL(`?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`, base).href, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load')));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
    await page.waitForTimeout(8000);
    if (local) { await page.evaluate(async (p) => { await window.__wildshard.pose(p); }, local); await page.waitForTimeout(4000); }
    await page.screenshot({ path: join(out, `${slug}-select.png`) });
    const lut = await page.evaluate(() => {
      const game = window.__wildshard.world.game, nd = window.__wildshard.shard?.['nd.render'];
      return { skyLut: game.sky?.lut?.name ?? null, compositeLutAmount: nd?.jiehua?.uniforms?.get?.('uLutAmt')?.value ?? nd?.jiehua?.grade?.uLutAmt?.value ?? null,
        passes: game.composer.passes.map((pass) => `${pass.name}:${(pass.effects ?? []).map((e) => e.name).join('+')}`) };
    });
    return { name: `${slug}-select`, lut };
  } finally { await ctx.close(); }
}

try {
  for (const { slug, normal, local } of SHARDS) {
    const row = { errors: [], shots: {} }; report.shards[slug] = row; save();
    for (const step of [() => gridHome(row, slug, normal, 'off', local), () => gridHome(row, slug, normal, 'on', local), () => standalone(row, slug, local)]) {
      try { const shot = await step(); row.shots[shot.name] = shot; } catch (error) { (row.failures ??= []).push(String(error.stack ?? error).slice(0, 1200)); }
      save();
    }
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.shards).map(([k, v]) => [k, { failures: v.failures, errors: v.errors.length,
  shots: Object.fromEntries(Object.entries(v.shots).map(([n, s]) => [n, s.frame ? { owner: s.frame.owner, chain: s.frame.chain?.owner, weight: s.frame.chain?.weight, post: s.frame.chain?.post, passes: s.frame.passes, colour: s.frame.colour, route: s.route } : s.lut])) }]))));
