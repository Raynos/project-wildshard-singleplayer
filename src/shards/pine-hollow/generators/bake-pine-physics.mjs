#!/usr/bin/env node
// DS1.5: execute Pine's authored native recipes without drawing; Node is the canonical physics producer.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { pinePhysicsInputs } from '../../../../scripts/pine-physics-inputs.mjs';

const root = resolvePath(import.meta.dirname, '../../../..');
const moduleAt = path => import(pathToFileURL(resolvePath(root, path)).href);
const environment = installBakeEnvironment(root);
// Nondrawing panel identities let the actual quest constructor retain its native collider registration.
const uiNames = ['Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement'];
const uiBefore = new Map(uiNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
class BakeElement { value = ''; }
class BakeInput extends BakeElement {}
class BakeButton extends BakeElement {}
Object.assign(globalThis, { Element: BakeElement, HTMLElement: BakeElement, HTMLInputElement: BakeInput, HTMLButtonElement: BakeButton });
const element = tag => {
  const node = tag === 'input' ? new BakeInput() : tag === 'button' ? new BakeButton() : new BakeElement();
  Object.defineProperties(node, Object.getOwnPropertyDescriptors(environment.element()));
  return Object.assign(node, { prepend: () => undefined, replaceChildren: () => undefined, contains: () => false, blur: () => undefined });
};
Object.defineProperty(document, 'createElement', { value: element, configurable: true });
Object.defineProperty(document, 'createElementNS', { value: (_namespace, tag) => element(tag), configurable: true });
const readMetadata = (animals, physics, registry, fight, fx) => {
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    // the manager's list at load, in its own order: every body the page simulates before the player moves
    const actors = animals.animals.map(a => {
      if (!a.simSpec) throw new Error(`Missing native simulation spec: ${a.entityId}`);
      return { id: a.entityId, kind: a.kind, variant: a.variant, herd: a.herd, spec: copy(a.simSpec), seed: a.seed, scale: a.scale,
        scripted: a.scripted === true };
    });
    // the Antler King's prewarm (runtime/antlerKing.ts `prewarm`): his body and a thrall of each kind, spawned before the
    // lair elites and parked out of the manager's list: their ids and draws come between the herds and the elites
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
    const herds = animals.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.entityId) }));
    // the forest's trunks as the hunting brain's placement reads them (HuntGround.trees: x, z, r), in the forest's order
    const trees = animals.forest.trees.map(t => [t.x, t.z, t.r]);
    // Exact shelter inputs: the shipped tree heights and the already-built RainFx crown texture's CPU readings.
    const rain = { fx };
    if (typeof rain.fx.coverAt !== 'function') throw new Error('Missing Pine rain crown-cover reader');
    const shelterTrees = animals.forest.trees.map(t => [t.x, t.z, t.r, t.height, rain.fx.coverAt(t.x, t.z)]);
    // The query tag is the authority: registry object identity and declared string ownership are distinct.
    const ownerKeys = new Map(), ownerIds = new Set();
    for (const piece of registry.pieceList()) {
      const key = `piece:${piece.id}`;
      if (typeof piece.id !== 'string' || piece.id.length === 0 || piece.id.length > 256 || /[\r\n]/u.test(piece.id) || ownerIds.has(key)) throw new Error('Ambiguous baked Pine piece owner');
      ownerKeys.set(piece, key); ownerIds.add(key);
    }
    const pieces = registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
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
      const tag = physics.colliderTag(c), owner = tag?.owner;
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
    return { actors, parked, kingHit, herds, trees, shelterTrees, pieces, grounds, solids };
  };
try {
  const THREE = await import('three');
  const noop = () => undefined;
  const sky = new Proxy({ setupMaterial: noop, csm: { lights: [new THREE.DirectionalLight()], update: noop },
    hemi: new THREE.HemisphereLight(), sunDisc: new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial()),
    planet: new THREE.Group(), clouds: null, dayNight: { dusk: 0, night: 0 }, viewCamera: new THREE.PerspectiveCamera(), sunDir: new THREE.Vector3(0, 1, 0) },
    { get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color') ? new THREE.Color(1, 1, 1)
      : typeof key === 'string' && key.endsWith('Dir') ? new THREE.Vector3(0, 1, 0) : undefined });
  (await moduleAt('src/engine/core/tier.ts')).initializeTier('phone');
  const { default: manifest } = await moduleAt('src/shards/pine-hollow/manifest.ts');
  (await moduleAt('src/game/shard/list.ts')).installShards([manifest]);
  (await moduleAt('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  const { PineHollow } = await moduleAt('src/shards/pine-hollow/runtime/index.ts');
  const contexts = [];
  class CapturePine extends PineHollow {
    async world(ctx) { sky.sceneRoot = ctx.game.runtime.world.game.scene; await super.world(ctx); contexts.push({ ctx, cabins: this.cabins, landmarks: this.landmarks }); }
  }
  const { Terrain, terrainChunkGeometry } = await moduleAt('src/engine/world/Terrain.ts');
  const captures = [], spots = [];
  await visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: CapturePine }) },
    { root, sky, element: environment.element, tier: 'phone', practiceArena: true,
      installKit: async () => {
        const context = contexts[0]?.ctx;
        if (context === undefined) throw new Error('Pine world did not complete before kit');
        (await moduleAt('src/game/systems/species/install.ts')).installKitSpecies();
        (await moduleAt('src/shards/pine-hollow/runtime/antlerKing.ts')).registerKing();
        const { PINE_SPECIES, pineElk } = await moduleAt('src/shards/pine-hollow/species/rows.ts');
        context.rows.species([...PINE_SPECIES, pineElk()]);
        context.rows.speciesLook((await moduleAt('src/shards/pine-hollow/species/looks.ts')).pineLooks());
        context.rows.spawnTable((await moduleAt('src/shards/pine-hollow/combat/spawns.ts')).PINE_SPAWNS);
        context.rows.item((await moduleAt('src/shards/pine-hollow/data/questInventory.ts')).PINE_BAG_ITEMS);
        context.rows.feat((await moduleAt('src/shards/pine-hollow/data/questInventory.ts')).PINE_FEATS);
      },
      nativeTerrain: readFileSync(resolvePath(root, 'public/assets/baked/pine-hollow/terrain.bin')),
      createTerrain: async () => {
        const field = await moduleAt('src/engine/world/Heightfield.ts');
        const terrain = new Terrain(); terrain.mesh = new THREE.Mesh(terrainChunkGeometry(field), new THREE.MeshBasicMaterial());
        return terrain;
      },
      visit: async ({ scene, forest, registry, physics }) => {
        const native = contexts[0];
        if (native === undefined) throw new Error('Missing native Pine world');
        const ctx = native.ctx, runtime = ctx.game.runtime, world = runtime.world;
        (await moduleAt('src/engine/physics/terrain.ts')).addEdgeWalls(physics);
        (await moduleAt('src/engine/physics/entrySockets.ts')).installEntrySockets(physics, ctx.scope, [{ x: 0, z: 0 }]);
        const { addPiece } = await moduleAt('src/engine/physics/pieces.ts');
        const additions = [];
        registry.onAdd(piece => {
          if (piece.object !== undefined) scene.add(piece.object);
          additions.push(addPiece(physics, piece));
          if (piece.floor !== undefined && piece.solidFloor !== true) world.player.platforms.push(piece.floor);
        });
        await (await moduleAt('src/shards/pine-hollow/models/wildlife.ts')).preloadPineWildlife();
        const { AnimalManager } = await moduleAt('src/engine/entities/AnimalManager.ts');
        const animals = await new AnimalManager(scene, sky, forest).buildAsync(() => Promise.resolve());
        const { swapRolledElites, makePineElites } = await moduleAt('src/shards/pine-hollow/combat/elites.ts');
        swapRolledElites(animals);
        Object.assign(world.player, { velocity: new THREE.Vector3(), yaw: 0, pitch: 0, carried: false });
        const { canReach } = await moduleAt('src/engine/ai/reach.ts');
        const { lineOfSight } = await moduleAt('src/engine/physics/query.ts');
        const { PINE_DAY } = await moduleAt('src/shards/pine-hollow/look/dayKeys.ts');
        const dusk = () => PINE_DAY.curves.dusk(PINE_DAY.start);
        const night = () => PINE_DAY.curves.night(PINE_DAY.start);
        const combat = { game: world.game, sky, player: world.player, animals, reach: (actor, target) => canReach(actor, target, physics), god: false,
          hurt: noop, stun: noop, trauma: noop, sound: noop, shot: noop, toast: noop, feed: noop,
          addItem: noop, ownSkin: noop, skinModel: () => new THREE.Group(), dusk, night, longbow: null };
        const { Elites } = await moduleAt('src/game/Elite.ts');
        const { EliteBar } = await moduleAt('src/engine/ui/EliteBar.ts');
        const elites = new Elites({ scene, camera: world.game.camera, renderer: world.game.renderer, player: world.player,
          condition: rule => rule === 'always' || (rule === 'dusk' ? dusk() > 0.5 : rule === 'night' ? night() > 0.5 : false),
          addInteractable: it => runtime.interactables.push(it), removeInteractable: noop,
          toast: noop, sting: noop, pickupHum: noop, ownSkin: noop, canSee: (from, to) => lineOfSight(physics, from, to, 0.6) }, new EliteBar(), manifest.slug);
        makePineElites(combat, elites);
        const { AntlerKingFight } = await moduleAt('src/shards/pine-hollow/runtime/antlerKing.ts');
        const fight = new AntlerKingFight(combat); fight.prewarm();
        elites.initialize();
        runtime.play = { animals };
        const { Inventory } = await moduleAt('src/game/Inventory.ts');
        const { Progress } = await moduleAt('src/game/Progress.ts');
        const { SkinLocker } = await moduleAt('src/game/cosmetics/locker.ts');
        const { Audio } = await moduleAt('src/engine/audio/Audio.ts');
        (await moduleAt('src/game/models/interact.ts')).installKitProps();
        const { installPineQuest } = await moduleAt('src/shards/pine-hollow/quest/index.ts');
        await installPineQuest({ ctx, game: world.game, sky, player: world.player, animals,
          hud: { toast: noop, killFeed: noop, holdPause: false }, audio: new Audio(), music: { sting: noop },
          inventory: new Inventory(manifest.slug), progress: new Progress(manifest.slug), skins: new SkinLocker(manifest.slug), wearSkin: noop,
          weapons: { visible: true, setEnabled: noop }, crossbow: { addBolts: noop }, menu: { isOpen: false, close: noop },
          interactables: runtime.interactables, registry, cabins: native.cabins, landmarks: native.landmarks, trees: forest.trees,
          fullMap: { setQuest: noop, setPois: noop, setZones: noop, setFeatures: noop }, compendium: null,
          chunkId: manifest.slug, params: new URLSearchParams(), touchUi: () => true, nolock: true });
        if (process.argv.includes('--spots')) {
          const { pineRifleFloor } = await moduleAt('src/shards/pine-hollow/quest/rifleFloor.ts');
          const { WeaponPickup } = await moduleAt('src/engine/player/WeaponPickup.ts');
          const position = pineRifleFloor(native.cabins);
          if (position === null) throw new Error('Pine rifle cabin is absent');
          // Only the nondrawing presentation mesh is empty; the native pickup owns the floor/eye point and radius.
          const drop = new WeaponPickup({ scene, item: new THREE.Group(), position, tier: 'common', prompt: 'Take the lever-action', scale: 1.3 });
          runtime.interactables.push(drop.interactable);
          const { readPineSpots } = await import('./pineSpots.mjs');
          const first = readPineSpots(window.__pineQuest, runtime.interactables);
          const second = readPineSpots(window.__pineQuest, runtime.interactables);
          if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Pine native spots changed between reads');
          spots.push(first);
          drop.dispose();
        }
        (await moduleAt('src/shards/pine-hollow/world/places.ts')).placePineHollowSets(registry);
        for (const piece of additions) piece.sync();
        const { RainFx } = await moduleAt('src/shards/pine-hollow/runtime/looks/rainFx.ts');
        const { PINE_RAIN, PINE_RAIN_PROGRAMS } = await moduleAt('src/shards/pine-hollow/runtime/looks/weatherLook.ts');
        const { SEED } = await moduleAt('src/engine/core/config.ts');
        const fx = new RainFx({ name: 'pine-weather', sky, trees: forest.trees, roofAt: (x, z) => native.cabins.floorHeightAt(x, z) !== undefined,
          phone: true, seed: SEED, look: PINE_RAIN, programs: PINE_RAIN_PROGRAMS }).build();
        captures.push(readMetadata(animals, physics, registry, fight, fx));
      },
    });
  const captured = captures[0];
  if (captured === undefined || captured.grounds.length !== 1 || captured.actors.length === 0) throw new Error('Native Pine capture did not complete');
  const inputs = pinePhysicsInputs(root), digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const { grounds, ...metadata } = captured;
  const result = { version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer',
    notice: 'DO NOT EDIT: regenerate with generators/bake-pine-physics.mjs. revision identifies recipe inputs.', inputs, ground: grounds[0], ...metadata };
  if (process.argv.includes('--spots')) {
    const rows = spots[0];
    if (rows === undefined) throw new Error('Native Pine spots were not captured');
    const writer = byteWriter(process.argv.includes('--check'), 'bake-pine-spots');
    writer.put(resolvePath(root, 'src/shards/pine-hollow/runtime/spots.baked.json'), `${JSON.stringify({ version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer', notice: 'DO NOT EDIT: regenerate with generators/bake-pine-spots.mjs.', ...rows }, null, 1)}\n`);
    writer.finish();
    console.log(`bake-pine-spots: ${rows.rows.length} native rows, speakers, board, lanterns, zipline and rifle, Node canonical`);
  } else {
    const writer = byteWriter(process.argv.includes('--check'), 'bake-pine-physics');
    writer.put(resolvePath(root, 'src/shards/pine-hollow/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`); writer.finish();
    console.log(`bake-pine-physics: ${result.actors.length} native actors, ${result.parked.length} King prewarm bodies, ${result.solids.length} world solids, Node canonical`);
  }

} finally {
  try { (await moduleAt('src/engine/app/resources.ts')).pageScope.dispose(); } finally {
    for (const name of uiNames) { const previous = uiBefore.get(name); if (previous === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, previous); }
    environment.dispose();
  }
}
