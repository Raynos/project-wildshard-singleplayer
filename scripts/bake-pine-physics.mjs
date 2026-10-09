#!/usr/bin/env node
// Trusted SF72 metadata only (Pine Hollow): the real native browser recipes remain the shipping source. Captures the
// standalone level's native floor (the terrain heightfield collider exactly as the page built it, crag cuts included),
// its edge walls and every solid world collider (trunks, rocks, crags, cabins, props), the registry pieces' metadata, the
// forest's trunk circles the herds' placement reads,
// the forest herds' and the Den's model-derived simulation specs, seeds, scales and herd membership at load, and the Antler
// King's parked prewarm bodies (the King and a thrall of each kind). Two independent same-page captures must match exactly.
// scripts/browser-lane.sh node scripts/bake-pine-physics.mjs --url=<clean candidate preview> [--revision=<sha>] [--census]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pinePhysicsInputs } from './pine-physics-inputs.mjs';
import { saveFixture } from './debug-settings.mjs';

const root = resolve(import.meta.dirname, '..');
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
if (url === undefined) throw new Error('bake-pine-physics requires a clean-candidate --url');
const census = process.argv.includes('--census');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice(11)
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Pine bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world;
    return (w?.animals?.animals?.length ?? 0) > 0 && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
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
    // the Antler King's prewarm (runtime/antlerKing.ts `prewarm`): his body and a thrall of each kind, spawned before the
    // lair elites and parked out of the manager's list: their ids and draws come between the herds and the elites
    const fight = window.__antlerKing?.fight;
    if (fight?.king === undefined || fight.king === null || !Array.isArray(fight.parked)) throw new Error('Missing the Antler King prewarm');
    const parked = [fight.king, ...fight.parked].map(a => {
      if (!a.simSpec) throw new Error(`Missing native simulation spec: ${a.entityId}`);
      return { id: a.entityId, kind: a.kind, variant: a.variant, spec: copy(a.simSpec), seed: a.seed, scale: a.scale };
    });
    // Rest-space hit volumes from the actual loaded King rig, never the stand-in dimensions alone. Inverse binds
    // retain the authored rest even after the parked body's animation has advanced. The cage offset is read from the
    // page's dressAntlerKing instance, then placed on that same rest chest.
    const king = fight.king, skeleton = king.mesh.skeleton;
    const V = king.position.constructor;
    const rest = name => {
      const i = skeleton.bones.findIndex(b => b.name === name), inv = skeleton.boneInverses[i];
      if (i === -1 || !inv) throw new Error(`King rig has no rest ${name}`);
      return inv.clone().invert();
    };
    const local = (at, matrix) => new V(...at).applyMatrix4(matrix).toArray();
    const capsule = (matrix, at, axis, pitch, half) => {
      // Same positive-y pitch convention as the shipping AnimalView capsuleOn law.
      const c = new V(...at), d = axis === 'x' ? new V(half, 0, 0) : new V(0, Math.sin(pitch) * half, Math.cos(pitch) * half);
      return [c.clone().sub(d).applyMatrix4(matrix).toArray(), c.add(d).applyMatrix4(matrix).toArray()];
    };
    const dims = king.dims, fore = dims.fore, chest = king.mesh.getObjectByName('chest'), look = fight.look;
    if (!fore || !chest || !look) throw new Error('King has no authored chest/cage');
    // Read the actual attachment, never the runtime query table that this bake is about to replace.
    const cages = chest.children.filter(child => child.name === 'king-ribcage');
    const cage = cages[0];
    if (cages.length !== 1 || !cage) throw new Error('King cage is not uniquely attached to its chest');
    const cageAt = cage.position.toArray();
    const kingHit = {
      head: local(dims.headAt ?? [0, 0, 0], rest('head')),
      body: capsule(rest('body'), dims.bodyAt ?? [0, 0, 0], 'z', dims.bodyPitch ?? 0, dims.bodyHalfLen),
      fore: capsule(rest(fore.bone), fore.at, 'x', 0, fore.halfLen),
      ribs: local(cageAt, rest('chest')), radius: look.ribcageRadius / king.scale,
    };
    // herd membership is a placement fact; positions and herd centres are not (the page ticks and recentres between
    // captures): the members' placement draws are the next step's (progress/shard-platform/handoffs/sf72-pine.md)
    const herds = w.animals.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.entityId) }));
    // the forest's trunks as the hunting brain's placement reads them (HuntGround.trees: x, z, r), in the forest's order
    const trees = w.animals.forest.trees.map(t => [t.x, t.z, t.r]);
    // The query tag is the authority: registry object identity and declared string ownership are distinct.
    const ownerKeys = new Map(), ownerIds = new Set();
    for (const piece of g.app.registry.pieceList()) {
      const key = `piece:${piece.id}`;
      if (typeof piece.id !== 'string' || piece.id.length === 0 || piece.id.length > 256 || /[\r\n]/u.test(piece.id) || ownerIds.has(key)) throw new Error('Ambiguous baked Pine piece owner');
      ownerKeys.set(piece, key); ownerIds.add(key);
    }
    const pieces = g.app.registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: piece.colliders.length, active: piece.active?.() ?? true };
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      if (piece.follows !== undefined) {
        piece.follows.updateWorldMatrix(true, false);
        row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
      }
      return row;
    });
    // the floor: Rapier's own heightfield, column-major, exactly as built (crag cuts and late resamples included)
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
      const row = { shape, groups, friction: c.friction(), body: c.parent()?.bodyType() ?? null, at: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w] };
      const tag = window.__wildshard.colliderTag(c.handle), owner = tag?.owner;
      if (tag !== undefined) row.material = tag.material;
      if (owner !== null && owner !== undefined) {
        const ownerId = typeof owner === 'string' ? `declared:${owner}` : ownerKeys.get(owner);
        if (ownerId === undefined || !/^(?:piece|declared):[^\r\n]{1,256}$/u.test(ownerId)) throw new Error('Unidentified baked Pine collider owner');
        row.ownerId = ownerId;
      }
      if (shape === 1) { const h = c.halfExtents(); row.half = [h.x, h.y, h.z]; }
      else if (shape === 2) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 0) row.radius = c.radius();
      else if (shape === 6 || shape === 9) { row.vertices = b64(c.vertices()); if (shape === 6) row.indices = btoa(String.fromCodePoint(...new Uint8Array(c.indices().buffer.slice(0)))); }
      else throw new Error(`Unbaked native collider shape ${shape}`);
      solids.push(row);
    });
    return wantCensus ? { kinds, actors: actors.length, herds: w.animals.herds.length, trees: trees.length, pieces: pieces.length, solids: solids.length, solidBytes: JSON.stringify(solids).length, grounds: grounds.map(gr => ({ ...gr, heights: gr.heights.length })) } : { actors, parked, kingHit, herds, trees, pieces, grounds, solids };
  };
  if (census) { console.log(JSON.stringify(await page.evaluate(capture, true), null, 1)); console.log(JSON.stringify(errors)); }
  else {
    const first = await page.evaluate(capture, false), second = await page.evaluate(capture, false);
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      const moved = Object.keys(first).filter(key => JSON.stringify(first[key]) !== JSON.stringify(second[key]));
      const rows = moved.flatMap(key => Array.isArray(first[key]) ? first[key].flatMap((row, i) => JSON.stringify(row) === JSON.stringify(second[key][i]) ? [] : [{ key, i, a: JSON.stringify(row).slice(0, 300), b: JSON.stringify(second[key][i]).slice(0, 300) }]).slice(0, 4) : [{ key }]);
      throw new Error(`Native Pine metadata changed between independent captures: ${JSON.stringify(rows)}`);
    }
    if (errors.length > 0 || first.actors.length === 0 || first.pieces.length === 0 || first.grounds.length !== 1) throw new Error(`Invalid native Pine bake: ${JSON.stringify(errors)} ${first.grounds.length}`);
    const [ground] = first.grounds;
    const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: pinePhysicsInputs(root), ground, solids: first.solids, actors: first.actors, parked: first.parked, kingHit: first.kingHit, herds: first.herds, trees: first.trees, pieces: first.pieces };
    writeFileSync(resolve(root, 'src/shards/pine-hollow/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
    console.log(`bake-pine-physics: ${first.actors.length} native bodies, ${first.trees.length} trees, ${first.solids.length} solid world colliders (${first.pieces.length} registry pieces), floor ${ground.rows}x${ground.cols}, exact repeated browser equality`);
  }
  await context.close();
} finally { await browser.close(); }
