#!/usr/bin/env node
// Trusted SF72 metadata only (Driftwood Isle): the real native browser recipes remain the shipping source. Captures the
// hybrid boot's native floor (Rapier's terrain heightfield exactly as the page built it, the sea cave's cuts included),
// every solid fixed world collider (pier, jetties, entry landings and decks, hut, lookout, wreck, shrine, cove, trail,
// boulders, palms, edge walls), the registry pieces' metadata, and the creature roster at load in the manager's order
// (model-derived simulation specs, seeds, scales, herds, spawn points) with the habitat the enemy policies read (palm
// perches and bases in palm order, the troops' placement input; the wreck hold and its floor; the crab sites). The declared
// movers (the moored boat, the rope bridge's chain) are bodies, not baked world. Two independent same-page captures must
// match exactly. Then the altar is used (`used:altar`): the Drowned Captain's native spec and his pool (where the finale
// spawns him, at his spawn yaw) are read off the body the finale spawned; his draws and id are the stream's at play time.
// scripts/browser-lane.sh node scripts/bake-driftwood-physics.mjs --url=<clean candidate preview> [--revision=<sha>] [--inputs=<clean tree>] [--census]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { driftwoodPhysicsInputs } from './driftwood-physics-inputs.mjs';
import { saveFixture } from './debug-settings.mjs';

const root = resolve(import.meta.dirname, '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url');
if (url === undefined) throw new Error('bake-driftwood-physics requires a clean-candidate --url');
const census = process.argv.includes('--census');
const revision = arg('revision') ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const inputsRoot = resolve(arg('inputs') ?? root);
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Driftwood bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  // the sailor is placed last, after his head's preload (creatures/Enemies.ts)
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world;
    return (w?.animals?.animals ?? []).some(a => a.kind === 'sailor') && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const capture = (wantCensus) => {
    const w = window.__wildshard.world, g = w.game, physics = g.app.physics, animals = w.animals;
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    // the hunting brain's memories (src/engine/ai/hunt.ts, the manager's private `hunt`)
    const hunt = animals.hunt;
    // the manager's list at load, in its own order; `at` is where the manager placed it (its legacy brain's first goal,
    // which a self-thinking species never moves), not where it has walked since
    const actors = animals.animals.map(a => {
      if (!a.simSpec) throw new Error(`Missing native simulation spec: ${a.entityId}`);
      const b = hunt.memory(a);
      return { id: a.entityId, kind: a.kind, variant: a.variant, herd: a.herd, spec: copy(a.simSpec), seed: a.seed, scale: a.scale,
        at: b === undefined ? null : { x: b.tx, z: b.tz } };
    });
    // herd centres are not placement facts (the manager recentres them as members move): only kind and membership
    const herds = animals.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.entityId) }));
    const v3 = p => ({ x: p.x, y: p.y, z: p.z });
    const hab = animals.habitat, hold = hab.hold, shell = g.app.debug.snapshot().driftwood;
    // the hold's floor (the wreck's deck and hull floor, Wreck.floorHeightAt) on a 0.5 m lattice over its guard disc
    const floor = [];
    if (hold) for (let dz = -hold.guardR; dz <= hold.guardR; dz += 0.5) for (let dx = -hold.guardR; dx <= hold.guardR; dx += 0.5) {
      const y = hold.floorAt(hold.x + dx, hold.z + dz); floor.push(y === undefined ? null : y);
    }
    const habitat = { perches: (hab.perches ?? []).map(v3), perchBases: (hab.perchBases ?? []).map(v3),
      hold: hold ? { x: hold.x, z: hold.z, r: hold.r, guardR: hold.guardR, step: 0.5, floor } : null,
      crabSites: copy(shell.objects.cove?.crabSites ?? []),
      placed: copy(shell.objects.enemies?.placed ?? null), practice: shell.objects.enemies?.practiceCrab?.entityId ?? null };
    const pieces = g.app.registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: piece.colliders.length, active: piece.active?.() ?? true };
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      if (piece.follows !== undefined) row.follows = true;
      return row;
    });
    const grounds = [], solids = [], kinds = {};
    const b64 = floats => {
      const bytes = new Uint8Array(floats.buffer.slice(floats.byteOffset, floats.byteOffset + floats.byteLength));
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    physics.world.forEachCollider(c => {
      const shape = c.shapeType(), groups = c.collisionGroups() >>> 0, body = c.parent()?.bodyType() ?? null, key = `${shape}:${body ?? 'none'}:${(groups >>> 16).toString(2)}`;
      kinds[key] = (kinds[key] ?? 0) + 1;
      const t = c.translation(), r = c.rotation();
      if (shape === 7 /* HeightField */) {
        const s = c.heightfieldScale();
        grounds.push({ rows: c.heightfieldNRows(), cols: c.heightfieldNCols(), scale: { x: s.x, y: s.y, z: s.z }, at: { x: t.x, y: t.y, z: t.z }, friction: c.friction(), groups, heights: b64(c.heightfieldHeights()) });
        return;
      }
      // the world's solid native fixed geometry only: creature volumes, capsules, projectiles, sensors and the declared
      // movers' bodies (boat: kinematic, bridge planks: dynamic; RigidBodyType Fixed = 1) are the runtime's own
      if (((groups >>> 16) & 1) === 0 || c.isSensor() || (body !== null && body !== 1)) return;
      const row = { shape, groups, friction: c.friction(), at: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w] };
      if (shape === 1) { const h = c.halfExtents(); row.half = [h.x, h.y, h.z]; }
      else if (shape === 2) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 10) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 0) row.radius = c.radius();
      else if (shape === 6 || shape === 9) { row.vertices = b64(c.vertices()); if (shape === 6) row.indices = btoa(String.fromCodePoint(...new Uint8Array(c.indices().buffer.slice(0)))); }
      else throw new Error(`Unbaked native collider shape ${shape}`);
      solids.push(row);
    });
    return wantCensus ? { kinds, actors: actors.map(a => `${a.kind}.${a.variant}.${a.herd}`), herds: herds.length, habitat: { ...habitat, hold: habitat.hold && { ...habitat.hold, floor: habitat.hold.floor.filter(y => y !== null).length }, perches: habitat.perches.length, perchBases: habitat.perchBases.length }, pieces: pieces.length, solids: solids.length, solidBytes: JSON.stringify(solids).length, grounds: grounds.map(gr => ({ ...gr, heights: gr.heights.length })) }
      : { actors, herds, habitat, pieces, grounds, solids };
  };
  if (census) { console.log(JSON.stringify(await page.evaluate(capture, true), null, 1)); console.log(JSON.stringify(errors)); }
  else {
    const first = await page.evaluate(capture, false), second = await page.evaluate(capture, false);
    // the finale's captain: set the altar's flag, read his body before any frame moves him, then his spec once more
    const captain = await page.evaluate(() => {
      const w = window.__wildshard.world, snap = w.game.app.debug.snapshot(), adv = window.__adventure ?? snap['driftwood.adventure'] ?? snap.adventure;
      adv.flags.set('used:altar');
      const a = adv.finale.captain(); if (!a?.simSpec) throw new Error('Missing the captain after the altar');
      return { spec: structuredClone(a.simSpec), pool: { x: a.mem.poolX, z: a.mem.poolZ, yaw: a.yaw }, arena: a.mem.arena };
    });
    const again = await page.evaluate(() => {
      const w = window.__wildshard.world, snap = w.game.app.debug.snapshot(), adv = window.__adventure ?? snap['driftwood.adventure'] ?? snap.adventure;
      return structuredClone(adv.finale.captain()?.simSpec ?? null);
    });
    if (JSON.stringify(again) !== JSON.stringify(captain.spec)) throw new Error('Native Driftwood captain spec changed between captures');
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      const moved = Object.keys(first).filter(key => JSON.stringify(first[key]) !== JSON.stringify(second[key]));
      const rows = moved.flatMap(key => Array.isArray(first[key]) ? first[key].flatMap((row, i) => JSON.stringify(row) === JSON.stringify(second[key][i]) ? [] : [{ key, i, a: JSON.stringify(row).slice(0, 300), b: JSON.stringify(second[key][i]).slice(0, 300) }]).slice(0, 4) : [{ key }]);
      throw new Error(`Native Driftwood metadata changed between independent captures: ${JSON.stringify(rows)}`);
    }
    if (errors.length > 0 || first.actors.length === 0 || first.pieces.length === 0 || first.grounds.length !== 1) throw new Error(`Invalid native Driftwood bake: ${JSON.stringify(errors)} ${first.grounds.length}`);
    const [ground] = first.grounds;
    const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: driftwoodPhysicsInputs(inputsRoot), ground, solids: first.solids,
      actors: first.actors, herds: first.herds, habitat: first.habitat, pieces: first.pieces, captain };
    writeFileSync(resolve(root, 'src/shards/driftwood-isle/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
    console.log(`bake-driftwood-physics: ${first.actors.length} native bodies + the captain, ${first.solids.length} solid world colliders (${first.pieces.length} registry pieces), floor ${ground.rows}x${ground.cols}, exact repeated browser equality`);
  }
  await context.close();
} finally { await browser.close(); }
