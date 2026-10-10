// SHARD-PLATFORM op-look25 (E435, SF63 / G158): each shard in a grid cell against SHARD SELECT, at the same pose.
// Per shard, one muted Metal iPhone 16 Pro portrait context per shot, Developer on, phone tier / 2x, Memory saver on
// (op-frame21's setup):
//   select  the shard standalone (SHARD SELECT's boot: ?chunk=<slug>); its spawn pose (feet + view heading) is read here
//   grid-A  the shard in the grid (entered from the road at its home-side edge, frame-floor's `cell` plan; the home shard
//           stays where it boots), posed at that same local pose, the Debug row gridCellComposite off
//   grid-B  the same with the row on (the cell runs the composite its look declares)
// Each shot's readout: the frame owner's chain, the page's colour pass, and (Nine Dragon) its world frame, crowd and cards.
//   SERVE_OWNER=op-look25 scripts/serve-build.sh --rev <sha> --devserver --name look25
//   scripts/browser-lane.sh --max 40 node progress/shard-platform/look25/capture.mjs <preview-url> <out-dir> <slug,...> [select,off,on]
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute, gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';

const [base, out, slugs, modes = 'select,off,on'] = process.argv.slice(2);
if (!base || !out || !slugs) throw new Error('usage: capture.mjs <preview-url> <out-dir> <slug,...> [select,off,on]');
mkdirSync(out, { recursive: true });
const report = { version: await (await fetch(new URL('version.json', base))).json(), started: new Date().toISOString(), shards: {} };
const save = () => writeFileSync(join(out, 'capture.json'), `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });

async function context(row, composite) {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0, gridCellComposite: composite }, merge: true });
  await saveFixture(ctx, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await ctx.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { row.errors.push(String(error.stack ?? error).slice(0, 400)); });
  page.on('console', (msg) => { if (msg.type() === 'error' && row.consoleErrors < 400) { row.consoleErrors++; if (row.consoleSamples.length < 6) row.consoleSamples.push(msg.text().slice(0, 300)); } });
  return { ctx, page };
}

/** pose the player at local feet `p` with its view along the world angle `p.heading` (atan2(dir.x, dir.z)), calibrated */
const poseAt = (page, p) => page.evaluate(async (p) => {
  const api = window.__wildshard, w = api.requireWorld?.() ?? api.world;
  const look = async (yaw) => {
    await api.pose({ x: p.x, y: p.y, z: p.z, yaw, pitch: p.pitch ?? -0.05 });
    await new Promise((r) => { requestAnimationFrame(() => { requestAnimationFrame(r); }); });
    const cam = w.game.camera, v = cam.getWorldDirection(cam.position.clone());
    return Math.atan2(v.x, v.z);
  };
  const a0 = await look(0), a1 = await look(Math.PI / 2), turn = Math.sign(Math.sin(a1 - a0)) || 1;
  await look((p.heading - a0) * turn);
}, p);

/** what the frame draws: chain, colour pass, and Nine Dragon's frame / crowd / cards where its runtime is up */
const readout = (page) => page.evaluate(() => {
  const api = window.__wildshard, w = api.requireWorld?.() ?? api.world, s = api.shard?.grid?.state?.() ?? null;
  const passes = w.game.composer.passes, p = w.player.position;
  const colour = passes.find((pass) => (pass.effects ?? []).some((e) => /ToneMapping|Jiehua|Neutral|Display/i.test(e.name ?? '')));
  const nine = {};
  w.game.rootScene.traverse((o) => {
    if (o.name === 'crowd' && o.isInstancedMesh) { nine.crowd = (nine.crowd ?? 0) + (o.visible ? o.count : 0); }
    const u = o.material?.uniforms;
    if (u?.uRootAt && nine.frame === undefined) nine.frame = u.uRootAt.value.toArray().map((v) => Math.round(v));
    if (u?.uCam && nine.cam === undefined && u.uRootAt) nine.cam = u.uCam.value.toArray().map((v) => Math.round(v * 10) / 10);
    if (u?.uCam && !u.uRootAt && o.material.vertexShader && !/viewmodel|vm/i.test(o.name ?? '')) { nine.camNoRoot = (nine.camNoRoot ?? 0) + 1; (nine.camNoRootNames ??= []).length < 8 && nine.camNoRootNames.push(o.name); }
    if (u?.uCardOn) nine.cardSets = (nine.cardSets ?? 0) + 1;
    if (o.material?.isShaderMaterial && /uniform vec3 uRootAt/.test(o.material.vertexShader ?? '') && !u?.uRootAt) nine.unlinked = (nine.unlinked ?? 0) + 1;
  });
  return { local: [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100), inside: s?.inside ?? null, owner: s?.frame?.owner ?? null, chain: s?.frame?.chain ?? null,
    passes: passes.map((pass) => `${pass.name}${pass.enabled ? '' : '(off)'}`), colour: (colour?.effects ?? []).map((e) => `${e.name}@${Math.round((e.blendMode?.opacity?.value ?? -1) * 100) / 100}`),
    nine: Object.keys(nine).length > 0 ? nine : null };
});

async function standalone(row, slug) {
  const { ctx, page } = await context(row, 'off');
  try {
    await page.goto(new URL(`?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`, base).href, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load')));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow?.());
    await page.waitForTimeout(8000);
    // its spawn pose: the feet and the heading the camera looks along
    const pose = await page.evaluate(() => {
      const w = window.__wildshard.world, p = w.player.position, cam = w.game.camera, v = cam.getWorldDirection(cam.position.clone());
      return { x: p.x, y: p.y, z: p.z, heading: Math.atan2(v.x, v.z) };
    });
    row.pose ??= pose;
    await poseAt(page, row.pose);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(out, `${slug}-select.png`) });
    return { name: `${slug}-select`, frame: await readout(page) };
  } finally { await ctx.close(); }
}

async function gridHome(row, slug, composite) {
  const { ctx, page } = await context(row, composite);
  try {
    await page.goto(base, { waitUntil: 'commit' });
    await page.locator('.ws-main-grid').click();
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null);
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const cell = state.cells.find((c) => c.slug === slug && c.instance === state.home) ?? state.cells.find((c) => c.slug === slug);
    if (!cell) throw new Error(`No ${slug} cell (a DEVSERVER build with Developer on?)`);
    let route = null;
    if (cell.instance !== state.home) {
      const [plan] = gridFloorPlans(state, 'cell', { cell: slug });
      // off the home cell onto the road at the plan's start (page-local), then the plan drives in with held input
      await page.evaluate(async (p) => {
        const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.requireWorld().player;
        const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
        await api.pose({ x: p.x - origin.x, y: 0.55, z: p.z - origin.z, yaw: 0, pitch: -0.05 });
      }, plan.start);
      await page.waitForFunction(() => { const s = window.__wildshard.shard.grid.state(); return s.live.live.current === null && s.inside === null && s.live.live.gameplayReady; });
      const doc = await page.evaluate(gridFloorDocumentIdentity);
      const result = await runFloorGridRoute(page, plan, doc);
      route = gridFloorWitnessFailures(result);
      await page.waitForFunction((inst) => { const l = window.__wildshard.shard.grid.state().live.live; return l.current === inst && l.gameplayReady && l.pending.length === 0; }, cell.instance, { timeout: 180000 });
    }
    await poseAt(page, row.pose);
    await page.evaluate(() => { const w = window.__wildshard.requireWorld(), at = w.player.position.clone(); const tick = () => { w.player.position.copy(at); w.player.velocity.set(0, 0, 0); requestAnimationFrame(tick); }; tick(); });
    await page.waitForTimeout(4000);
    const name = `${slug}-grid-${composite === 'on' ? 'B' : 'A'}`;
    await page.screenshot({ path: join(out, `${name}.png`) });
    const frame = await readout(page);
    // PROBE=1: what else draws over the cell (the page's colour effects but the cell's own display; the page's own scene
    // objects outside the cell's region root), one shot with each switched off
    const probes = [];
    if (process.env.PROBE === '1') {
      for (const probe of ['effects', 'page-objects']) {
        const touched = await page.evaluate((probe) => {
          const w = window.__wildshard.requireWorld(), names = [];
          if (probe === 'effects') for (const pass of w.game.composer.passes) for (const e of pass.effects ?? []) {
            if (/Jiehua|Neutral/.test(e.name ?? '') || !e.blendMode?.opacity) continue;
            if (e.blendMode.opacity.value > 0) { names.push(e.name); e.blendMode.opacity.value = 0; }
          }
          if (probe === 'page-objects') for (const o of w.game.rootScene.children) {
            let region = false; o.traverse((c) => { if (/^region-scene/.test(c.name ?? '')) region = true; });
            if (!region && o.visible && !o.isCamera && !o.isLight) { names.push(`${o.type}:${o.name}`); o.visible = false; }
          }
          return names;
        }, probe);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: join(out, `${name}-probe-${probe}.png`) });
        probes.push({ probe, touched });
      }
    }
    return { name, home: cell.instance === state.home, route, frame, probes };
  } finally { await ctx.close(); }
}

try {
  for (const slug of slugs.split(',')) {
    const row = { errors: [], consoleErrors: 0, consoleSamples: [], shots: {} }; report.shards[slug] = row; save();
    const steps = { select: () => standalone(row, slug), off: () => gridHome(row, slug, 'off'), on: () => gridHome(row, slug, 'on') };
    for (const mode of ['select', ...modes.split(',').filter((m) => m !== 'select')]) {
      try { const shot = await steps[mode](); row.shots[shot.name] = shot; } catch (error) { (row.failures ??= []).push(`${mode}: ${String(error.stack ?? error).slice(0, 1200)}`); }
      save();
    }
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.shards).map(([k, v]) => [k, { pose: v.pose, failures: v.failures, errors: v.errors.length, console: v.consoleErrors,
  shots: Object.fromEntries(Object.entries(v.shots).map(([n, s]) => [n, { owner: s.frame?.owner, colour: s.frame?.colour, nine: s.frame?.nine, local: s.frame?.local, route: s.route }])) }]))));
