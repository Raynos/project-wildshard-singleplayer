// SHARD-PLATFORM op-look30 (from op-look28's, E435, SF63 / G158): each shard in a grid cell against SHARD SELECT, at the same pose.
// op-look30 adds: a hidden shard (slug `_…`, the template) or SELECT_MENU=1 enters standalone the way SHARD SELECT does (main
// menu ▸ SHARD SELECT ▸ its card ▸ ENTER WORLD, or SHARDFILE for a shardfile-only shard with Developer on; no URL switch);
// PROBE=4 BAND="x0,x1,y0,y1" (screen fractions): one clip of that band per visible scene object (top level, and two levels into
// the region and shard roots) hidden in turn, `<shot>-band-<k>.png` beside a `-band-base.png` (band.py ranks them);
// the frame's chain readout includes op-look30's `bypass` (how far a whole-chain composite fades the page's colour effects).
// Per shard, one muted Metal iPhone 16 Pro portrait context per shot, Developer on, phone tier / 2x, Memory saver on
// (op-frame21's setup):
//   select  the shard standalone (SHARD SELECT's boot: ?chunk=<slug>); its spawn pose (feet + view heading) is read here
//   grid-A  the shard in the grid (entered from the road at its home-side edge, frame-floor's `cell` plan; the home shard
//           stays where it boots), posed at that same local pose, the Debug row gridCellComposite off
//   grid-B  the same with the row on (the cell runs the composite its look declares)
// Each shot's readout: the frame owner's chain, the page's colour pass, and (Nine Dragon) its world frame, crowd and cards.
//   SERVE_OWNER=op-look30 scripts/serve-build.sh --rev <sha> --devserver --name look30
//   scripts/browser-lane.sh --max 40 node progress/shard-platform/look30/capture.mjs <preview-url> <out-dir> <slug[:cell],...> [select,off,on]
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
  await ctx.addInitScript((dump) => { window.__wildshardHarness = { seed: 357, capture: null }; window.__ndDump = dump; }, process.env.NINE_DUMP === '1');
  await ctx.route('**/api/errors', (route) => route.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { row.errors.push(String(error.stack ?? error).slice(0, 400)); });
  page.on('console', (msg) => { if (msg.type() === 'error' && row.consoleErrors < 400) { row.consoleErrors++; if (row.consoleSamples.length < 6) row.consoleSamples.push(msg.text().slice(0, 300)); } });
  return { ctx, page };
}

/** hide the grid's Developer memory card before a shot (op-look25's grid shots: it covered Nine's blade signs and cables) */
const hideDev = (page) => page.evaluate(() => {
  for (const e of document.querySelectorAll('[class*="ws-grid-budget"], [class*="ws-memory"]')) {
    let p = e; while (p.parentElement && p.parentElement !== document.body && !['fixed', 'absolute'].includes(getComputedStyle(p).position)) p = p.parentElement;
    p.style.display = 'none';
  }
});
const shoot = async (page, path) => { await hideDev(page); await page.waitForTimeout(200); await page.screenshot({ path }); };

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
  // NINE_DUMP=1: the shared uniforms (numbers and vectors) of the first program carrying uRootAt, and every Nine mesh's visibility
  if (window.__ndDump) {
    let mat = null; const meshes = {};
    w.game.rootScene.traverse((o) => {
      const u = o.material?.uniforms; if (u?.uRootAt && mat === null) mat = u;
      if (o.isMesh && /^(kit:|neon|signs|facade|sky|steam|sheets|canopy|streaks|screens)/.test(o.name ?? '')) {
        let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
        const k = o.name; meshes[k] = (meshes[k] ? meshes[k] + ',' : '') + (vis ? 'V' : 'h') + (o.frustumCulled ? '' : 'nf') + (o.count !== undefined ? '#' + o.count : '');
      }
    });
    const uni = {};
    if (mat) for (const [k, v] of Object.entries(mat)) {
      const x = v.value;
      if (typeof x === 'number') uni[k] = Math.round(x * 1e4) / 1e4;
      else if (x?.toArray && !x.isTexture && !x.isMatrix4 && !x.isMatrix3) uni[k] = x.toArray().map((n) => Math.round(n * 1e3) / 1e3);
      else if (Array.isArray(x) && x.length < 12) uni[k] = x.map((e) => (e?.toArray ? e.toArray().map((n) => Math.round(n * 1e3) / 1e3) : e));
    }
    nine.uniforms = uni; nine.meshes = meshes;
    // the scene, camera and renderer state the cell draws under, and the canopy's / a kit's own material
    const sc = w.game.rootScene, cam = w.game.camera, r = w.game.renderer ?? w.game.render?.renderer;
    const col = (c) => (c?.isColor ? c.toArray().map((n) => Math.round(n * 1e3) / 1e3) : c?.isTexture ? 'tex' : c ?? null);
    nine.scene = { fog: sc.fog ? { type: sc.fog.type ?? (sc.fog.isFog ? 'Fog' : 'FogExp2'), color: col(sc.fog.color), near: sc.fog.near, far: sc.fog.far, density: sc.fog.density } : null,
      background: col(sc.background), environment: col(sc.environment), cam: { near: cam.near, far: cam.far, fov: cam.fov },
      renderer: r ? { toneMapping: r.toneMapping, exposure: r.toneMappingExposure, out: r.outputColorSpace } : null };
    const mats = {};
    sc.traverse((o) => {
      if (!o.isMesh || !/^(canopy|kit:north-shops|facade-shell|sky)$/.test(o.name ?? '') || mats[o.name]) return;
      const m = o.material, own = {};
      for (const [k, v] of Object.entries(m.uniforms ?? {})) { if (mat && mat[k] === v) continue; const x = v.value; own[k] = typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : x?.toArray && !x.isTexture ? x.toArray().map((n) => Math.round(n * 1e3) / 1e3) : x?.isTexture ? 'tex' : typeof x; }
      mats[o.name] = { type: m.type, fog: m.fog, toneMapped: m.toneMapped, transparent: m.transparent, defines: m.defines, own, prog: m.version };
    });
    nine.mats = mats;
  }
  return { local: [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100), inside: s?.inside ?? null, owner: s?.frame?.owner ?? null, chain: s?.frame?.chain ?? null,
    passes: passes.map((pass) => `${pass.name}${pass.enabled ? '' : '(off)'}`), colour: (colour?.effects ?? []).map((e) => `${e.name}@${Math.round((e.blendMode?.opacity?.value ?? -1) * 100) / 100}`),
    nine: Object.keys(nine).length > 0 ? nine : null };
});

/** a shard card's name on SHARD SELECT (the deck labels cards by name only) */
const CARD_NAMES = { _template: 'Template shard' };

/** SHARD SELECT's own way in: main menu ▸ SHARD SELECT ▸ the shard's card ▸ ENTER WORLD (SHARDFILE where it is the only entry) */
async function enterFromSelect(page, slug) {
  await page.goto(base, { waitUntil: 'commit' });
  await page.locator('.ws-main-select').click();
  const name = process.env.SELECT_NAME ?? CARD_NAMES[slug];
  if (name === undefined) throw new Error(`No SHARD SELECT card name for ${slug} (SELECT_NAME=…)`);
  // the deck's track is transformed and captures the pointer for its swipe: tap the card through its own click listener
  // (tapped again on each poll: the deck may still be settling after it opens)
  await page.waitForFunction((name) => {
    if (document.querySelector('.ws-menu-card.selected b')?.textContent === name) return true;
    [...document.querySelectorAll('.ws-menu-card')].find((c) => c.querySelector('b')?.textContent === name)?.click();
    return false;
  }, name, { polling: 500, timeout: 60000 });
  const which = await page.evaluate(() => {
    const play = document.querySelector('.ws-menu-play'), file = document.querySelector('.ws-menu-shardfile');
    return play !== null && !play.disabled ? 'play' : file !== null && !file.hidden && !file.disabled ? 'shardfile' : null;
  });
  if (which === null) throw new Error(`${slug}: neither ENTER WORLD nor SHARDFILE is enabled (Developer on?)`);
  await page.locator(which === 'play' ? '.ws-menu-play' : '.ws-menu-shardfile').click();
  return which;
}

async function standalone(row, slug) {
  const { ctx, page } = await context(row, 'off');
  try {
    if (slug.startsWith('_') || process.env.SELECT_MENU === '1') row.selectEntry = await enterFromSelect(page, slug);
    else await page.goto(new URL(`?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`, base).href, { waitUntil: 'commit' });
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
    await shoot(page, join(out, `${slug}-select.png`));
    return { name: `${slug}-select`, frame: await readout(page), level: await page.evaluate(() => window.__wildshard.world?.level?.id ?? null) };
  } finally { await ctx.close(); }
}

async function gridHome(row, slug, composite, cellSlug = slug) {
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
    const cell = state.cells.find((c) => c.slug === cellSlug && c.instance === state.home) ?? state.cells.find((c) => c.slug === cellSlug || c.instance === cellSlug);
    if (!cell) throw new Error(`No ${slug} cell (a DEVSERVER build with Developer on?)`);
    let route = null;
    if (cell.instance !== state.home) {
      const [plan] = gridFloorPlans(state, 'cell', { cell: cell.slug });
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
    await shoot(page, join(out, `${name}.png`));
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
        await shoot(page, join(out, `${name}-probe-${probe}.png`));
        probes.push({ probe, touched });
      }
    }
    if (process.env.PROBE === '3') {
      // the scene fog off: one shot
      await page.evaluate(() => { const sc = window.__wildshard.requireWorld().game.rootScene; window.__fogUndo = sc.fog; sc.fog = null; });
      await page.waitForTimeout(1500);
      await shoot(page, join(out, `${name}-nofog.png`));
      await page.evaluate(() => { window.__wildshard.requireWorld().game.rootScene.fog = window.__fogUndo; });
    }
    if (process.env.PROBE === '4') {
      // which object draws a band of the screen: hide each in turn, clip the band
      const [x0, x1, y0, y1] = (process.env.BAND ?? '0,0.4,0.48,0.56').split(',').map(Number), vp = page.viewportSize();
      const clip = { x: Math.round(x0 * vp.width), y: Math.round(y0 * vp.height), width: Math.round((x1 - x0) * vp.width), height: Math.round((y1 - y0) * vp.height) };
      await page.screenshot({ path: join(out, `${name}-band-base.png`), clip });
      const list = await page.evaluate(() => {
        const w = window.__wildshard.requireWorld(), list = [];
        const walk = (o, path, depth) => { for (const c of o.children) { if (!c.visible || c.isCamera || c.isLight) continue; const n = `${path}/${c.name || c.type}`; list.push({ uuid: c.uuid, name: n }); if (depth < 3 && c.children.length > 0 && (depth > 0 || /region|shard|world|root|far|proxy|horizon|sky/i.test(c.name ?? ''))) walk(c, n, depth + 1); } };
        walk(w.game.rootScene, '', 0);
        return list;
      });
      for (const [k, t] of list.entries()) {
        await page.evaluate((u) => { const o = window.__wildshard.requireWorld().game.rootScene.getObjectByProperty('uuid', u); if (o) o.visible = false; }, t.uuid);
        await page.waitForTimeout(350);
        await page.screenshot({ path: join(out, `${name}-band-${k}.png`), clip });
        await page.evaluate((u) => { const o = window.__wildshard.requireWorld().game.rootScene.getObjectByProperty('uuid', u); if (o) o.visible = true; }, t.uuid);
        probes.push({ k, ...t });
      }
    }
    if (process.env.PROBE === '2') {
      const toggles = await page.evaluate(() => {
        const w = window.__wildshard.requireWorld(), list = [];
        w.game.composer.passes.forEach((pass, i) => {
          (pass.effects ?? []).forEach((e, j) => { if (e.blendMode?.opacity && e.blendMode.opacity.value > 0) list.push({ kind: 'effect', i, j, name: e.name }); });
          if (i > 0 && pass.enabled) list.push({ kind: 'pass', i, name: pass.name });
        });
        const group = (o, path) => { for (const c of o.children) { if (!c.visible || c.isCamera || c.isLight) continue; const n = `${path}/${c.name || c.type}`; list.push({ kind: 'object', uuid: c.uuid, name: n }); if (/^region|nine-dragon/.test(c.name ?? '') && path.split('/').length < 4) group(c, n); } };
        group(w.game.rootScene, '');
        return list;
      });
      for (const [k, t] of toggles.entries()) {
        await page.evaluate((t) => {
          const w = window.__wildshard.requireWorld(), passes = w.game.composer.passes;
          if (t.kind === 'effect') { const e = passes[t.i].effects[t.j]; window.__probeUndo = [e.blendMode.opacity.value]; e.blendMode.opacity.value = 0; }
          if (t.kind === 'pass') { passes[t.i].enabled = false; }
          if (t.kind === 'object') { const o = w.game.rootScene.getObjectByProperty('uuid', t.uuid); if (o) o.visible = false; }
        }, t);
        await page.waitForTimeout(900);
        await shoot(page, join(out, `${name}-p${k}.png`));
        await page.evaluate((t) => {
          const w = window.__wildshard.requireWorld(), passes = w.game.composer.passes;
          if (t.kind === 'effect') passes[t.i].effects[t.j].blendMode.opacity.value = window.__probeUndo[0];
          if (t.kind === 'pass') passes[t.i].enabled = true;
          if (t.kind === 'object') { const o = w.game.rootScene.getObjectByProperty('uuid', t.uuid); if (o) o.visible = true; }
        }, t);
        probes.push({ k, ...t });
      }
    }
    return { name, home: cell.instance === state.home, route, frame, probes };
  } finally { await ctx.close(); }
}

try {
  for (const entry of slugs.split(',')) {
    const [slug, cellSlug = slug] = entry.split(':'); // op-look28: <standalone slug>:<its grid cell's slug or instance> (the template's cell is template-2)
    const row = { errors: [], consoleErrors: 0, consoleSamples: [], shots: {} }; report.shards[slug] = row; save();
    const steps = { select: () => standalone(row, slug), off: () => gridHome(row, slug, 'off', cellSlug), on: () => gridHome(row, slug, 'on', cellSlug) };
    for (const mode of ['select', ...modes.split(',').filter((m) => m !== 'select')]) {
      try { const shot = await steps[mode](); row.shots[shot.name] = shot; } catch (error) { (row.failures ??= []).push(`${mode}: ${String(error.stack ?? error).slice(0, 1200)}`); }
      save();
    }
  }
} finally { await browser.close(); report.finished = new Date().toISOString(); save(); }
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.shards).map(([k, v]) => [k, { pose: v.pose, failures: v.failures, errors: v.errors.length, console: v.consoleErrors,
  shots: Object.fromEntries(Object.entries(v.shots).map(([n, s]) => [n, { owner: s.frame?.owner, colour: s.frame?.colour, nine: s.frame?.nine, local: s.frame?.local, route: s.route }])) }]))));
