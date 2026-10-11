#!/usr/bin/env node
// DS1.5: build the real authored world and its finite native creature models in Node; never import a recorded physics bake.
// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-physics.mjs [--check]
import { createHash } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { driftwoodSpotsInputs } from '../../../../scripts/driftwood-spots-inputs.mjs';
import { readDriftwoodSpots } from './driftwoodSpots.mjs';
import { driftwoodPhysicsInputs } from '../../../../scripts/driftwood-physics-inputs.mjs';

const spotsOnly = process.argv.includes('--spots');
const root = resolvePath(import.meta.dirname, '../../../..');
const at = path => import(pathToFileURL(resolvePath(root, path)).href);
const environment = installBakeEnvironment(root);
// Nondrawing UI lifetime adapters; the actual quest constructors still place their native colliders.
const element = () => Object.assign(environment.element(), { prepend: () => undefined });
Object.defineProperty(document, 'createElement', { value: element, configurable: true });
Object.defineProperty(document, 'createElementNS', { value: element, configurable: true });
const noop = () => undefined;
const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
const poseOf = a => {
      const model = a.model;
      if (!model?.bones || !a.bones) throw new Error(`Missing actual Driftwood rig: ${a.entityId}`);
      const defs = model.bones;
      if (defs.length === 0 || defs.length > 32) throw new Error(`Unbounded native rig: ${a.entityId}`);
      const joints = defs.map((def, index) => {
        const parent = def.parent === null ? -1 : defs.findIndex(row => row.name === def.parent);
        if (parent >= index || (def.parent !== null && parent < 0) || !a.bones[def.name]) throw new Error(`Invalid actual rig chain: ${a.entityId}:${def.name}`);
        const p = parent < 0 ? [0, 0, 0] : defs[parent].pos;
        const position = [def.pos[0] - p[0], def.pos[1] - p[1], def.pos[2] - p[2]];
        const skeleton = a.mesh.skeleton, bone = a.bones[def.name], actual = skeleton.bones.indexOf(bone), inverse = skeleton.boneInverses[actual];
        if (!inverse) throw new Error(`Missing actual inverse bind: ${a.entityId}:${def.name}`);
        const local = inverse.clone().invert();
        if (parent >= 0) { const ancestor = a.bones[defs[parent].name], parentInverse = skeleton.boneInverses[skeleton.bones.indexOf(ancestor)]; if (!parentInverse) throw new Error('Missing actual parent inverse bind'); local.premultiply(parentInverse); }
        const e = local.elements, expected = [1,0,0,0,0,1,0,0,0,0,1,0,...position,1];
        if (e.some((value, k) => Math.abs(value - expected[k]) > 1e-12)) throw new Error(`Actual rig rest differs from its model: ${a.entityId}:${def.name}`);
        return { name: def.name, parent, position, order: 'XYZ', scale: [1, 1, 1] };
      });
      return { joints, custom: model.species.rig === 'custom', ...(model.species.gait === undefined ? {} : { gait: copy(model.species.gait) }), ...(model.species.pose === undefined ? {} : { pose: copy(model.species.pose) }) };
    };

const readMetadata = (animals, physics, registry, runtime) => {
 const hunt = animals.hunt;
    const actors = animals.animals.map(a => {
      if (!a.simSpec) throw new Error(`Missing native simulation spec: ${a.entityId}`);
      const b = hunt.memory(a);
      return { id: a.entityId, kind: a.kind, variant: a.variant, herd: a.herd, spec: copy(a.simSpec), seed: a.seed, scale: a.scale, pose: poseOf(a),
        at: b === undefined ? null : { x: b.tx, z: b.tz } };
    });
    // herd centres are not placement facts (the manager recentres them as members move): only kind and membership
    const herds = animals.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.entityId) }));
    const v3 = p => ({ x: p.x, y: p.y, z: p.z });
    const hab = animals.habitat, hold = hab.hold, shell = runtime;
    // the hold's floor (the wreck's deck and hull floor, Wreck.floorHeightAt) on a 0.5 m lattice over its guard disc
    const floor = [];
    if (hold) for (let dz = -hold.guardR; dz <= hold.guardR; dz += 0.5) for (let dx = -hold.guardR; dx <= hold.guardR; dx += 0.5) {
      const y = hold.floorAt(hold.x + dx, hold.z + dz); floor.push(y === undefined ? null : y);
    }
    const habitat = { perches: (hab.perches ?? []).map(v3), perchBases: (hab.perchBases ?? []).map(v3),
      hold: hold ? { x: hold.x, z: hold.z, r: hold.r, guardR: hold.guardR, step: 0.5, floor } : null,
      crabSites: copy(shell.objects.cove?.crabSites ?? []),
      placed: copy(shell.objects.enemies?.placed ?? null), practice: shell.objects.enemies?.practiceCrab?.entityId ?? null };
    const pieces = registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: piece.colliders.length, active: piece.active?.() ?? true };
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      if (piece.follows !== undefined) row.follows = true;
      return row;
    });
    const grounds = [], solids = [];
    const registered = registry.pieceList();
    const ownerId = owner => {
      if (typeof owner === 'string') return `string:${owner}`;
      const piece = registered.find(p => p === owner);
      if (piece === undefined) throw new Error('Static collider owner is not an actual registered piece');
      return `piece:${piece.id}`;
    };
    const b64 = floats => {
      const bytes = new Uint8Array(floats.buffer.slice(floats.byteOffset, floats.byteOffset + floats.byteLength));
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCodePoint(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    physics.world.forEachCollider(c => {
      const shape = c.shapeType(), groups = c.collisionGroups() >>> 0, body = c.parent()?.bodyType() ?? null;
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
      const tag = physics.colliderTag(c);
      if (tag !== undefined) {
        row.material = tag.material;
        if (tag.owner !== undefined && tag.owner !== null) row.owner = ownerId(tag.owner);
      }
      if (shape === 1) { const h = c.halfExtents(); row.half = [h.x, h.y, h.z]; }
      else if (shape === 2) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 10) { row.halfHeight = c.halfHeight(); row.radius = c.radius(); }
      else if (shape === 0) row.radius = c.radius();
      else if (shape === 6 || shape === 9) { row.vertices = b64(c.vertices()); if (shape === 6) row.indices = btoa(String.fromCodePoint(...new Uint8Array(c.indices().buffer.slice(0)))); }
      else throw new Error(`Unbaked native collider shape ${shape}`);
      solids.push(row);
    });

 if (grounds.length !== 1) throw new Error("Missing the actual native ground");
 return { ground: grounds[0], solids, actors, herds, habitat, pieces };
};

try {
  const captures=[];
  const THREE = await import('three');
  const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
    hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
    planet: new THREE.Group(), clouds: null, dayNight: null, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
  { get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color')
    ? new THREE.Color(1, 1, 1) : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
  (await at('src/engine/core/tier.ts')).initializeTier('phone');
  const { default: manifest } = await at('src/shards/driftwood-isle/manifest.ts');
  (await at('src/game/shard/list.ts')).installShards([manifest]);
  (await at('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  const { default: NativePlugin } = await at('src/shards/driftwood-isle/runtime/index.ts');
  const contexts = [];
  class CaptureDriftwood extends NativePlugin {
    async world(ctx) { await super.world(ctx); contexts.push(ctx); }
  }
  const { Terrain, terrainChunkGeometry } = await at('src/engine/world/Terrain.ts');
  const { readFileSync } = await import('node:fs');
  await visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: CaptureDriftwood }) },
  { root, sky, element: environment.element, tier: 'phone', practiceArena: true,
    installKit: async () => {
      const ctx=contexts[0];if (ctx===undefined)throw new Error('Native world missing before kit');
      (await at('src/shards/driftwood-isle/creatures/install.ts')).installDriftwoodCreatures(ctx);
    },
    nativeTerrain: readFileSync(resolvePath(root, 'public/assets/baked/driftwood-isle/terrain.bin')),
    createTerrain: async () => {
      const field = await at('src/engine/world/Heightfield.ts');
      const terrain = new Terrain();terrain.mesh = new THREE.Mesh(terrainChunkGeometry(field), new THREE.MeshBasicMaterial());
      return terrain;
    },
    visit: async ({ scene, forest, registry, physics }) => {
      const ctx = contexts[0];if (ctx === undefined) throw new Error('No actual Driftwood world');
      const runtime = ctx.game.runtime;
      const world = runtime.world;
      (await at('src/engine/physics/terrain.ts')).addEdgeWalls(physics);
      (await at('src/engine/physics/entrySockets.ts')).installEntrySockets(physics,ctx.scope,[{x:0,z:0}]);
      const { Bodies, BODY_CAP } = await at('src/engine/physics/bodies.ts');
      const { setActiveBodies } = await at('src/engine/physics/active.ts');
      setActiveBodies(new Bodies(physics,world.player.position,BODY_CAP.phone).attach(world.game));
      ctx.scope.onDispose(() => { setActiveBodies(null); });
      const { addPiece } = await at('src/engine/physics/pieces.ts');
      const addedPieces = [];
      registry.onAdd(piece => {
        if (piece.object !== undefined) scene.add(piece.object);
        addedPieces.push(addPiece(physics,piece));
        if (piece.floor !== undefined && piece.solidFloor !== true) world.player.platforms.push(piece.floor);
      });
      (await at('src/game/systems/species/install.ts')).installKitSpecies();
      const { preloadCaptainMesh } = await at('src/shards/driftwood-isle/species/captainMesh.ts');
      const { preloadSailorHead } = await at('src/shards/driftwood-isle/species/sailor.ts');
      await Promise.all([preloadCaptainMesh(),preloadSailorHead()]);
      const { AnimalManager } = await at('src/engine/entities/AnimalManager.ts');
      const animals = await new AnimalManager(scene,sky,forest).buildAsync(() => Promise.resolve());
      runtime.hooks.animalsReady(animals);
      await new Promise(resolve => { setImmediate(resolve); });
      if (!animals.animals.some(actor => actor.kind==='sailor')) throw new Error('Native sailor did not complete preload');
      const { driftwoodWorld } = await at('src/shards/driftwood-isle/world/build.ts');
      const built=driftwoodWorld(runtime);
      const { Inventory } = await at('src/game/Inventory.ts');
      const { Audio } = await at('src/engine/audio/Audio.ts');
      (await at('src/game/models/interact.ts')).installKitProps();
      const { installAdventure } = await at('src/shards/driftwood-isle/quest/adventure.ts');
      Object.assign(world.player,{velocity:new THREE.Vector3(),yaw:0,pitch:0,carried:false});
      runtime.play={animals};
      let ironDrop;
      if (spotsOnly) {
        // The page's actual loadout row owns the pickup factory and its native point/radius.
        const { driftwoodLoadoutRows } = await at('src/shards/driftwood-isle/loadout/rows.ts');
        const pickup = driftwoodLoadoutRows(world, runtime)[1].pickup;
        if (pickup === undefined) throw new Error('Missing native iron sword pickup');
        ironDrop = pickup.create('wreck.deck', pickup.prompt);
        if (ironDrop === null) throw new Error('The actual wreck has no sword drop');
        runtime.interactables.push(ironDrop.interactable);
        // Derive the reward direction through the page's real planet constructor, never a copied trig law.
        const { SkyBackdropView } = await at('src/engine/world/skyBackdrop.ts');
        const visual = new SkyBackdropView(scene, world.game.renderer, ctx.scope, sky);
        scene.fog = new THREE.Fog(0xffffff, 1, 1000);
        visual.configure(world.game.level, null);
        visual.buildPlanet();
        sky.planetDir = visual.planetDir;
      }
      const adventure = await installAdventure(ctx,{game:world.game,sky,player:world.player,registry,chunk:manifest,
        prompts:runtime.interactables,hud:{toast:noop},audio:new Audio(),music:{sting:noop},inventory:new Inventory(manifest.slug),animals,
        ...(ironDrop === undefined ? {} : {ironDrop}),pois:{hut:built.hut,lookout:built.lookout,wreck:built.wreck,shrine:built.shrine,cave:built.cove}});
      // The real interaction constructor refreshes closed boxes after registering them. Apply the page's
      // piece sync once before reading settled static geometry, without advancing AI or simulation clocks.
      for (const piece of addedPieces) piece.sync();
      if (spotsOnly) {
        // The real loot presentation installs the shop, making Maren's existing prompt reachable.
        const { driftwoodLootPresentation } = await at('src/shards/driftwood-isle/loot/presentation.ts');
        const { Owned } = await at('src/game/loot/Owned.ts');
        const { Purse } = await at('src/game/loot/Purse.ts');
        const view = await driftwoodLootPresentation({ adventure, owned: new Owned(manifest.slug), audio: new Audio(), scope: ctx.scope, toast: noop, hold: noop });
        const shop = view.shop(new Purse(manifest.slug));
        if (shop === null) throw new Error('Missing actual Driftwood shop');
        ctx.scope.onDispose(() => shop.dispose());
      }
      if (spotsOnly) { captures.push(readDriftwoodSpots(adventure, runtime, registry)); return; }
      const captured=readMetadata(animals,physics,registry,runtime);
      adventure.flags.set('used:altar');
      const captain=adventure.finale.captain();if(captain===null)throw new Error('Actual Captain failed to spawn');
      captured.captain={spec:copy(captain.simSpec),pose:poseOf(captain),pool:{x:captain.mem.poolX,z:captain.mem.poolZ,yaw:captain.yaw},arena:captain.mem.arena};
      if(captured.actors.length!==34 || captured.solids.length===0)throw new Error('Invalid native Driftwood roster');
      captures.push(captured);
    },
  });
  const captured = captures[0];
  if(captured===undefined)throw new Error('Actual Driftwood capture did not complete');
  const inputs = spotsOnly ? driftwoodSpotsInputs(root) : driftwoodPhysicsInputs(root), digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const label = spotsOnly ? 'bake-driftwood-spots' : 'bake-driftwood-physics';
  const result={version:1,revision:digest.slice(0,40),build:`node-${digest}`,profile:'Node / phone / no renderer',notice:`DO NOT EDIT: regenerate with generators/${label}.mjs. revision identifies the recipe inputs.`,inputs,...captured};
  const writer=byteWriter(process.argv.includes('--check'),label);
  writer.put(resolvePath(root,`src/shards/driftwood-isle/runtime/${spotsOnly ? 'spots' : 'physics'}.baked.json`),`${JSON.stringify(result)}\n`);writer.finish();
  if (spotsOnly) console.log(`${label}: ${captured.rows.length} native rows and ${captured.promptRegistrations.length} ordered prompts, Node canonical`);
  else console.log(`bake-driftwood-physics: ${captured.actors.length} actual native actors, ${captured.solids.length} fixed solids and Captain, Node canonical`);
} finally {
  try {(await at('src/engine/app/resources.ts')).pageScope.dispose();}finally{environment.dispose();}
}
