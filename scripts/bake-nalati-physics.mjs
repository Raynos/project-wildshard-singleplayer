#!/usr/bin/env node
// Trusted SF72 metadata only (Nalati Grasslands): the real native browser recipes remain the shipping source. Captures the
// standalone level's native floor (the terrain heightfield collider exactly as the page built it), its edge walls and every
// solid world collider (POIs, crags, outcrops, the kurgan, the bridge, the camps, props), the registry pieces' metadata,
// the lone spruces' trunk circles, and the bodies AnimalManager simulates at load (Wildlife's wolf pack, the wild herd with
// its stallion, the flock's dog and the camp's two saddled horses) with their model-derived simulation specs, seeds, scales,
// herd membership, tick-0 spots, headings and memories, and the declared groups' tick-0 continuations. Two independent same-page captures must match exactly.
// scripts/browser-lane.sh node scripts/bake-nalati-physics.mjs --url=<clean candidate preview> [--revision=<sha>] [--census]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { nalatiPhysicsInputs } from './nalati-physics-inputs.mjs';
import { saveFixture } from './debug-settings.mjs';

const root = resolve(import.meta.dirname, '..');
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
if (url === undefined) throw new Error('bake-nalati-physics requires a clean-candidate --url');
const census = process.argv.includes('--census');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice(11)
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Nalati bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  // tick 0: every body's spot and heading the frame it first exists, before any frame callback runs after its spawn (the
  // manager thinks and moves it from the next frame on), checked against the renderer-free boot roster
  // (test/shards/nalati-grasslands/boot-roster.test.ts). Read on first sight, so a body spawned later is caught at its own
  // tick 0. The one exception is the shepherd's horse (creatures/sheepRaid.ts): ride.ts builds him before the page exposes
  // its manager, and his ring has turned him a frame's worth by first sight (his spot is still exact)
  // the harness pin: the page's random streams from the level's own seed (session.ts pageSeed), as a renderer-free host
  // seeds them, instead of the live page's per-load salt; the groups' setup draws on the 'ai' stream are then the host's
  await page.addInitScript(() => { window.__wildshardHarness = { seed: 0x4a1a, capture: null }; });
  // The same first sight reads each body's memory (the group policies' setup draws: a wolf's role, offset and ring) and
  // each declared group's continuation (PackBrain / HerdBrain `snapshot()`: the herd's first grazing spot, Argymaq's
  // adoption), before any of them decides: the renderer-free runtime's groups are checked against them on the 'ai' stream
  await page.addInitScript(() => {
    const seen = new Map(), groups = new Map(), raf = window.requestAnimationFrame.bind(window);
    window.__nalatiSpawns = seen; window.__nalatiGroups = groups;
    window.requestAnimationFrame = onFrame => raf(time => {
      for (const a of window.__wildshard?.world?.animals?.animals ?? []) {
        if (!seen.has(a.entityId)) seen.set(a.entityId, { id: a.entityId, at: [a.position.x, a.position.y, a.position.z], yaw: a.yaw, mem: { ...a.mem } });
      }
      const wildlife = window.__wildshard?.world?.game?.app?.debug?.snapshot?.().nalati?.wildlife;
      for (const [kind, list] of [['pack', wildlife?.packs ?? []], ['herd', wildlife?.herds ?? []]]) list.forEach((group, i) => {
        const key = `${kind}:${i}`;
        if (!groups.has(key)) groups.set(key, { kind, members: group.members.map(m => m.entityId), state: group.snapshot() });
      });
      onFrame(time);
    });
  });
  await page.goto(new URL('/?chunk=nalati-grasslands&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world;
    return (w?.animals?.animals?.length ?? 0) > 0 && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load');
  }, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const capture = (wantCensus) => {
    const w = window.__wildshard.world, g = w.game, physics = g.app.physics;
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    // the manager's list at load, in its own order: every body the page simulates before the player moves
    const actors = w.animals.animals.map(a => {
      if (!a.simSpec) throw new Error(`Missing native simulation spec: ${a.entityId}`);
      return { id: a.entityId, kind: a.kind, variant: a.variant, herd: a.herd, spec: copy(a.simSpec), seed: a.seed, scale: a.scale,
        scripted: a.scripted === true };
    });
    // herd membership is a placement fact; positions and herd centres are not (the page ticks and recentres between captures)
    const herds = w.animals.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.entityId) }));
    // the lone spruces as the hunting brain's placement reads them (HuntGround.trees: x, z, r), in the forest's order
    const trees = (w.animals.forest?.trees ?? []).map(t => [t.x, t.z, t.r]);
    const pieces = g.app.registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: piece.colliders.length, active: piece.active?.() ?? true };
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      // the camp's people walk (campPeople.ts movers): their followers are runtime actors, never baked world poses
      if (piece.follows !== undefined && piece.category !== 'people') {
        piece.follows.updateWorldMatrix(true, false);
        row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
      }
      return row;
    });
    // the floor: Rapier's own heightfield, column-major, exactly as built
    const grounds = [], solids = [], kinds = {};
    const b64 = floats => {
      const bytes = new Uint8Array(floats.buffer.slice(floats.byteOffset, floats.byteOffset + floats.byteLength));
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    physics.world.forEachCollider(c => {
      const shape = c.shapeType(), groups = c.collisionGroups() >>> 0, key = `${shape}:${c.parent()?.bodyType() ?? 'none'}:${(groups >>> 16).toString(2)}`;
      kinds[key] = (kinds[key] ?? 0) + 1;
      const t = c.translation(), r = c.rotation();
      if (shape === 7 /* HeightField */) {
        const s = c.heightfieldScale();
        grounds.push({ rows: c.heightfieldNRows(), cols: c.heightfieldNCols(), scale: { x: s.x, y: s.y, z: s.z }, at: { x: t.x, y: t.y, z: t.z }, friction: c.friction(), groups, heights: b64(c.heightfieldHeights()) });
        return;
      }
      // the world's solid native geometry only: creature hit volumes, the player's and the creatures' movement capsules,
      // projectiles and sensors are the runtime's own allocations, never baked world
      if (((groups >>> 16) & 1) === 0 || c.isSensor()) return;
      // a capsule on a kinematic body is a walking camp person's (campPeople.ts), a runtime mover like the creatures
      if (shape === 2 && c.parent()?.bodyType() === 2) return;
      const row = { shape, groups, friction: c.friction(), body: c.parent()?.bodyType() ?? null, at: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w] };
      if (shape === 1) { const h = c.halfExtents(); row.half = [h.x, h.y, h.z]; }
      else if (shape === 2) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 0) row.radius = c.radius();
      else if (shape === 6 || shape === 9) { row.vertices = b64(c.vertices()); if (shape === 6) row.indices = btoa(String.fromCodePoint(...new Uint8Array(c.indices().buffer.slice(0)))); }
      else throw new Error(`Unbaked native collider shape ${shape}`);
      solids.push(row);
    });
    const spawns = actors.map(a => { const row = window.__nalatiSpawns.get(a.id); if (row === undefined) throw new Error(`No tick-0 spawn for ${a.id}`); return row; });
    const groups = [...window.__nalatiGroups.values()];
    // the grass the senses read before trampling (grassBaseHeightAt), at every body's tick-0 spot and on a 48² grid at an
    // off-lattice pitch (the 4 m lattice's interpolation, the trail beds, the yurt floors, the water): the renderer-free field's check
    const grassBase = g.app.debug.snapshot()['harness.shard.nalati-grasslands'].grassBase;
    const points = [...spawns.map(row => [row.at[0], row.at[2]]), ...Array.from({ length: 48 * 48 }, (_v, i) => [-247.3 + (i % 48) * 10.37, -246.1 + Math.floor(i / 48) * 10.41])];
    const grass = points.map(([x, z]) => [x, z, grassBase(x, z)]);
    if (!wantCensus) return { actors, herds, trees, pieces, grounds, solids, spawns, groups, grass };
    const nalati = g.app.debug.snapshot().nalati;
    return { kinds, actors: actors.map(a => `${a.id} ${a.kind}.${a.variant} herd ${a.herd}${a.scripted ? ' scripted' : ''}`), herds, trees: trees.length, pieces: pieces.length, solids: solids.length,
      solidBytes: JSON.stringify(solids).length, grounds: grounds.map(gr => ({ rows: gr.rows, cols: gr.cols, scale: gr.scale, at: gr.at, friction: gr.friction, groups: gr.groups, heights: gr.heights.length })),
      spawns, groups, clock: nalati?.weather?.clock?.dayPhase ?? null, elites: (nalati?.elites?.scripts ?? []).map(s => s.animal?.entityId ?? null) };
  };
  if (census) { console.log(JSON.stringify(await page.evaluate(capture, true), null, 1)); console.log(JSON.stringify(errors)); }
  else {
    const first = await page.evaluate(capture, false), second = await page.evaluate(capture, false);
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      const moved = Object.keys(first).filter(key => JSON.stringify(first[key]) !== JSON.stringify(second[key]));
      const rows = moved.flatMap(key => Array.isArray(first[key]) ? first[key].flatMap((row, i) => JSON.stringify(row) === JSON.stringify(second[key][i]) ? [] : [{ key, i, a: JSON.stringify(row).slice(0, 300), b: JSON.stringify(second[key][i]).slice(0, 300) }]).slice(0, 4) : [{ key }]);
      throw new Error(`Native Nalati metadata changed between independent captures: ${JSON.stringify(rows)}`);
    }
    if (errors.length > 0 || first.actors.length === 0 || first.pieces.length === 0 || first.grounds.length !== 1) throw new Error(`Invalid native Nalati bake: ${JSON.stringify(errors)} ${first.grounds.length}`);
    const [ground] = first.grounds;
    const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: nalatiPhysicsInputs(root), ground, solids: first.solids, actors: first.actors, herds: first.herds, trees: first.trees, pieces: first.pieces, spawns: first.spawns, groups: first.groups, grass: first.grass };
    writeFileSync(resolve(root, 'src/shards/nalati-grasslands/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
    console.log(`bake-nalati-physics: ${first.actors.length} native bodies, ${first.trees.length} trees, ${first.solids.length} solid world colliders (${first.pieces.length} registry pieces), floor ${ground.rows}x${ground.cols}, exact repeated browser equality`);
  }
  await context.close();
} finally { await browser.close(); }
