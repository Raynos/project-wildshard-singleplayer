#!/usr/bin/env node
// SHARD-PLATFORM M3: Driftwood Isle's look, a base build against a candidate on identical world pixels (modelled on
// scripts/proof-nalati-look-parity.mjs). One run captures one served build: per tier (phone, desktop), six poses round the
// island (the beach and sea, the wreck, the lookout, the cave and cascade, the vista over the sea, the altar), each a plain
// scene render (no post) with Time of day pinned at midday (paused), every material's time and cloud time at 10, the
// viewmodel hidden, read back whole and hashed, with the render's draws and triangles; the WebGL allocation census's total
// GPU bytes; the linked program count and a hash of every shader source the page compiled; any shader compile error;
// every registered piece's colliders, hashed. Creatures keep moving between captures, so two runs of one build can
// differ by a few hundred pixels: `--raw=<dir>` keeps each frame's RGBA so `--compare` can count the differing pixels.
//   scripts/browser-lane.sh node scripts/proof-driftwood-look-parity.mjs --url=<preview> --output=<summary.json> [--raw=<dir>] [--phase=midday|night]
//   node scripts/proof-driftwood-look-parity.mjs --compare=<base.json>,<candidate.json>
// Add --original-scenes with scripts/bake-loader.mjs to compare all five migrated sites against retained author geometry,
// at every pose in the same frozen frame; independent boots still retain their natural creature differences.
import { chromium, devices } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInit } from './parity/init.mjs';
import { developerSettings } from './debug-settings.mjs';

/** yaw 0 looks south (−z), +π/2 east (−x); x / z in metres */
const POSES = [
  { id: 'beach-sea', x: 100, z: 1, yaw: -Math.PI / 2, pitch: -0.05 },
  { id: 'wreck', x: 130, z: 10, yaw: -Math.PI / 2, pitch: -0.08 },
  { id: 'lookout', x: 93.6, z: 95.9, yaw: Math.PI, pitch: -0.12 },
  { id: 'cave', x: 142, z: 14, yaw: Math.PI, pitch: 0 },
  { id: 'vista', x: -46, z: -100, yaw: 0, pitch: 0.12 },
  { id: 'altar', x: -99, z: 109, yaw: -Math.PI / 4, pitch: -0.05 },
];

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const compare = arg('compare');
if (compare !== undefined) {
  const [a, b] = compare.split(',').map(path => JSON.parse(readFileSync(path, 'utf8')));
  const diffs = [];
  if (a.rows.length !== b.rows.length) diffs.push(`Pose count ${a.rows.length} ≠ ${b.rows.length}`);
  for (const [i, row] of a.rows.entries()) {
    const other = b.rows[i];
    for (const key of ['tier', 'phase', 'pose', 'calls', 'triangles', 'width', 'height']) if (row[key] !== other?.[key]) diffs.push(`${row.tier}/${row.pose}: ${key} ${row[key]} ≠ ${other?.[key]}`);
    if (row.pixels !== other?.pixels) {
      // the differing pixel count when both runs kept their frames
      const fa = row.raw === undefined ? null : row.raw, fb = other?.raw ?? null;
      if (fa !== null && fb !== null && existsSync(fa) && existsSync(fb)) {
        const pa = readFileSync(fa), pb = readFileSync(fb);
        let n = 0;
        for (let p = 0; p < pa.length; p += 4) if (pa[p] !== pb[p] || pa[p + 1] !== pb[p + 1] || pa[p + 2] !== pb[p + 2] || pa[p + 3] !== pb[p + 3]) n++;
        console.log(`${row.tier}/${row.pose}: ${n} of ${pa.length / 4} pixels differ`);
      }
      diffs.push(`${row.tier}/${row.pose}: pixels differ`);
    }
  }
  for (const key of ['gpuBytes', 'colliders', 'pieces', 'colliderCount', 'programs', 'shaders']) for (const tier of Object.keys(a.tiers)) if (a.tiers[tier][key] !== b.tiers[tier]?.[key]) diffs.push(`${tier}: ${key} ${a.tiers[tier][key]} ≠ ${b.tiers[tier]?.[key]}`);
  console.log(diffs.length === 0 ? `driftwood-look-parity: ${a.build} = ${b.build} on ${a.rows.length} poses (draws, triangles), GPU bytes, programs, shader sources and colliders` : diffs.join('\n'));
  process.exit(diffs.length === 0 ? 0 : 1);
}
const url = arg('url'), output = arg('output'), raw = arg('raw'), phase = arg('phase') ?? 'midday';
if (phase !== 'midday' && phase !== 'night') throw new Error('--phase=midday|night');
if (url === undefined || output === undefined) throw new Error('Requires --url=<DEVSERVER preview> --output=<summary.json> (or --compare=a,b)');
if (raw !== undefined) mkdirSync(raw, { recursive: true });
const version = await (await fetch(new URL('/version.json', url))).json();
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originalScenes = [];
if (process.argv.includes('--original-scenes')) {
  const [{ originalHut, originalLookout }, { originalShrine }, { originalWreck }, { originalTrailside }] = await Promise.all([
    import('../src/shards/driftwood-isle/generators/driftwoodHut.mjs'), import('../src/shards/driftwood-isle/generators/driftwoodShrine.mjs'),
    import('../src/shards/driftwood-isle/generators/driftwoodWreck.mjs'), import('../src/shards/driftwood-isle/generators/driftwoodTrailside.mjs'),
  ]);
  const hut = originalHut(), tower = originalLookout(), shrine = originalShrine(), wreck = originalWreck();
  for (const { id, geometries } of [{ id: 'hut', geometries: [hut.kit, hut.flames] }, { id: 'lookout', geometries: [tower.geometry] },
    { id: 'shrine', geometries: [shrine.world.geometry.kit, shrine.world.geometry.water, shrine.world.geometry.glyphs] },
    { id: 'wreck', geometries: [wreck.world.geometry.rocks, wreck.world.geometry.kit, wreck.world.geometry.glow] }, { id: 'trailside', geometries: [originalTrailside().geometry] }]) {
    originalScenes.push({ id, geometries: geometries.map(geometry => {
      const row = { attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }])), index: geometry.index === null ? null : Array.from(geometry.index.array) };
      geometry.dispose(); return row;
    }) });
  }
}
const rows = [], tiers = {}, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const tier of ['phone', 'desktop']) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
    await installInit(context, { lane: 'driftwood-look-parity', sha: version.build, browser: 'chromium', capture: 30, tier });
    await developerSettings(context, { time: phase });
    // every shader source the page compiles, hashed (a byte that moved in any program shows here)
    await context.addInitScript(() => {
      const seen = new Set();
      window.__dlpShaders = seen;
      for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
        const original = Reflect.get(proto, 'shaderSource');
        proto.shaderSource = function shaderSource(shader, source) { seen.add(source); Reflect.apply(original, this, [shader, source]); };
      }
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && /Shader Error|Program Info Log|WebGLProgram/u.test(message.text())) errors.push(message.text().slice(0, 400)); });
    await page.goto(new URL(`/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const w = window.__wildshard?.world;
      return (w?.animals?.animals?.length ?? 0) > 0 && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load');
    }, undefined, { timeout: 400000, polling: 1000 });
    await page.evaluate(() => window.__parity.advance(30));
    tiers[tier] = await page.evaluate(() => {
      const w = window.__wildshard.world, pieces = w.game.app.registry.pieceList();
      const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
      const list = pieces.filter(p => (p.colliders?.length ?? 0) > 0).map(p => ({ id: p.id, active: p.active?.() ?? true, surface: p.surface ?? null, owner: p.colliderOwner ?? null, colliders: copy(p.colliders) })).sort((a, b) => a.id.localeCompare(b.id));
      return { colliderJson: JSON.stringify(list), pieces: list.length, colliderCount: list.reduce((n, r) => n + r.colliders.length, 0) };
    });
    tiers[tier].colliders = sha(tiers[tier].colliderJson); delete tiers[tier].colliderJson;
    if (originalScenes.length > 0) await page.evaluate(sourceRows => {
      const game = window.__wildshard.world.game, registry = game.app.registry, pairs = [];
      for (const row of sourceRows) {
        // drawnInto pieces keep an anchor in the registry; their actual draw remains in the scene.
        const root = row.id === 'wreck' ? game.scene.getObjectByName('wreck-rocks')?.parent : registry.get(row.id)?.object, meshes = [];
        if (root === undefined) throw new Error(`Missing native site: ${row.id}`);
        root.traverse(mesh => { if (mesh.isMesh && mesh.layers.isEnabled(0) && mesh.name !== 'shrine-fireflies') meshes.push(mesh); });
        if (meshes.length !== row.geometries.length) throw new Error(`Native site mesh count differs: ${row.id}`);
        meshes.forEach((mesh, index) => {
          const source = row.geometries[index], baked = mesh.geometry, original = baked.clone();
          const position = baked.getAttribute('position'), authoredPosition = source.attributes.position;
          if (position.array.length !== authoredPosition.array.length || position.array.some((value, i) => value !== authoredPosition.array[i])) throw new Error(`Native site positions differ: ${row.id}`);
          if (Object.keys(baked.attributes).sort().join(',') !== Object.keys(source.attributes).sort().join(',') || JSON.stringify(baked.index === null ? null : Array.from(baked.index.array)) !== JSON.stringify(source.index)) throw new Error(`Native site channels/index differ: ${row.id}`);
          for (const [key, attribute] of Object.entries(source.attributes)) {
            const resident = baked.getAttribute(key);
            if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Native site attribute layout differs: ${row.id}/${key}`);
            // Uploaded static draws release their CPU arrays; reconstruct the authored side independently.
            const Attribute = resident.constructor, ArrayType = resident.array.constructor;
            original.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
          }
          original.computeBoundingBox(); original.computeBoundingSphere(); pairs.push({ mesh, baked, original });
        });
      }
      window.__dlpOriginals = pairs;
    }, originalScenes);

    for (const p of POSES) {
      const { yaw, pitch } = p;
      await page.evaluate(() => { const g = window.__wildshard.world.game; if ('__dlpGate' in window) g.frameGate = window.__dlpGate; });
      await page.evaluate(a => {
        const w = window.__wildshard.world;
        w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch;
      }, { x: p.x, z: p.z, yaw, pitch });
      await page.evaluate(() => window.__parity.advance(180));
      await page.evaluate(() => { const g = window.__wildshard.world.game; if (!('__dlpGate' in window)) window.__dlpGate = g.frameGate; g.frameGate = () => false; });
      await sleep(300);
      const shot = await page.evaluate(async v => {
        const w = window.__wildshard.world, g = w.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene, cam = g.camera;
        // the camera at the player's eye where the spawn put it, looking along the pose (yaw 0 = south, −z; +π/2 = east, −x)
        const at = w.player.position, cp = Math.cos(v.pitch);
        cam.position.set(at.x, at.y + 1.62, at.z); cam.up.set(0, 1, 0);
        cam.lookAt(at.x - Math.sin(v.yaw) * cp * 20, at.y + 1.62 + Math.sin(v.pitch) * 20, at.z - Math.cos(v.yaw) * cp * 20); cam.updateMatrixWorld(true);
        const hidden = [];
        for (const child of cam.children) if (child.visible) { child.visible = false; hidden.push(child); }
        scene.traverse(o => {
          for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
            const u = m.uniforms;
            if (u?.uTime !== undefined && typeof u.uTime.value === 'number') u.uTime.value = 10;
            if (u?.time !== undefined && typeof u.time.value === 'number') u.time.value = 10;
            if (u?.uCloudTime !== undefined && typeof u.uCloudTime.value === 'number') u.uCloudTime.value = 10;
          }
        });
        r.setRenderTarget(null); r.setScissorTest(false);
        const ratio = r.getPixelRatio(); r.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
        r.clear(true, true, true); r.render(scene, cam);
        r.info.reset(); r.clear(true, true, true); r.render(scene, cam);
        const calls = r.info.render.calls, triangles = r.info.render.triangles;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let originalChangedPixels = null;
        if (window.__dlpOriginals !== undefined) {
          for (const pair of window.__dlpOriginals) pair.mesh.geometry = pair.original;
          r.info.reset(); r.clear(true, true, true); r.render(scene, cam);
          const original = new Uint8Array(pixels.length);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, original);
          originalChangedPixels = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] !== original[i] || pixels[i + 1] !== original[i + 1] || pixels[i + 2] !== original[i + 2] || pixels[i + 3] !== original[i + 3]) originalChangedPixels++;
          for (const pair of window.__dlpOriginals) pair.mesh.geometry = pair.baked;
          if (originalChangedPixels !== 0 || r.info.render.calls !== calls || r.info.render.triangles !== triangles) throw new Error(`Original scene parity differs: ${originalChangedPixels} pixels, ${r.info.render.calls}/${calls} draws, ${r.info.render.triangles}/${triangles} triangles`);
        }

        for (const o of hidden) o.visible = true;
        let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 0) lit++;
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
        let bin = ''; for (let i = 0; i < pixels.length; i += 0x8000) bin += String.fromCodePoint(...pixels.subarray(i, i + 0x8000));
        return { player: [Math.round(at.x * 10) / 10, Math.round(at.y * 10) / 10, Math.round(at.z * 10) / 10], width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, calls, triangles, lit, originalChangedPixels, pixels: Array.from(digest, x => x.toString(16).padStart(2, '0')).join(''), data: btoa(bin) };
      }, { yaw, pitch });
      const row = { tier, phase, pose: p.id, player: shot.player, width: shot.width, height: shot.height, calls: shot.calls, triangles: shot.triangles, lit: shot.lit, pixels: shot.pixels, ...(shot.originalChangedPixels === null ? {} : { originalChangedPixels: shot.originalChangedPixels }) };
      if (raw !== undefined) { row.raw = join(raw, `${tier}-${p.id}.rgba`); writeFileSync(row.raw, Buffer.from(shot.data, 'base64')); }
      rows.push(row);
      console.log(`${tier} ${p.id} at ${shot.player.join(',')}: ${shot.calls} draws, ${shot.triangles} triangles, ${shot.lit} lit pixels`);
    }
    if (originalScenes.length > 0) await page.evaluate(() => { for (const pair of window.__dlpOriginals) pair.original.dispose(); delete window.__dlpOriginals; });
    tiers[tier].gpuBytes = await page.evaluate(() => window.__sc_gl().reduce((n, row) => n + row.totalBytes, 0));
    tiers[tier].programs = await page.evaluate(() => window.__wildshard.world.game.renderer.info.programs?.length ?? -1);
    const sources = await page.evaluate(() => [...window.__dlpShaders].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    tiers[tier].shaderCount = sources.length;
    tiers[tier].shaders = sha(sources.join('\u0000'));
    await context.close();
  }
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / DPR2 / Metal; plain scene render, Time of day pinned (paused); 180 controlled frames per pose, time and cloud time 10, viewmodel hidden', tiers, rows }, null, 2)}\n`);
} finally { await browser.close(); }
