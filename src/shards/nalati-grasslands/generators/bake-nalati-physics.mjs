#!/usr/bin/env node
// DS1.5: execute Nalati's authored native recipes without drawing; Node is the canonical physics producer.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { installBakeEnvironment } from '../../../../scripts/bake/environment.mjs';
import { visitAuthoredWorld } from '../../../../scripts/bake/worldHost.mjs';
import { nalatiPhysicsInputs } from '../../../../scripts/nalati-physics-inputs.mjs';

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
const readMetadata = (w, wildlife, spawnRows, groupRows, flockRows) => {
 const g = w.game, physics = g.app.physics;
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
    const forest = w.animals.forest, trees = (forest?.trees ?? []).map(t => [t.x, t.z, t.r]);
    // the lightning's view (world/installWeather.ts): the same forest's tops (base + height, its `exposed`) and the yurts
    // its shelter rule reads (NalatiWeather.yurts)
    if (forest !== w.forest) throw new Error('The hunting brain and the weather read different forests');
    const tops = (forest?.trees ?? []).map(t => t.y + t.height);
    const weather = g.app.debug.snapshot().nalati?.weather;
    if (!Array.isArray(weather?.yurts)) throw new Error('No Nalati weather yurts');
    const actualLedges = g.app.debug.snapshot().nalati?.pois?.cragLedges;
    if (!Array.isArray(actualLedges) || actualLedges.length > 6) throw new Error('Missing actual bounded Crags ledges');
    const ledges = actualLedges.map(({ x, y, z, r }) => ({ x, y, z, r }));
    const yurts = weather.yurts.map(y => [y.x, y.z, y.r]);
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
    const spawns = actors.map(a => { const row = spawnRows.find(spawn => spawn.id === a.id); if (row === undefined) throw new Error(`No tick-0 spawn for ${a.id}`); return row; });
    const groups = groupRows, flocks = flockRows, marmots = wildlife.marmots?.tickZero;
    if (marmots?.bands.frame !== 0) throw new Error('No exact tick-zero marmot keeper');
    // the grass the senses read before trampling (grassBaseHeightAt), at every body's tick-0 spot and on a 48² grid at an
    // off-lattice pitch (the 4 m lattice's interpolation, the trail beds, the yurt floors, the water): the renderer-free field's check
    const grassBase = g.app.debug.snapshot()['harness.shard.nalati-grasslands'].grassBase;
    const points = [...spawns.map(row => [row.at[0], row.at[2]]), ...Array.from({ length: 48 * 48 }, (_v, i) => [-247.3 + (i % 48) * 10.37, -246.1 + Math.floor(i / 48) * 10.41])];
    const grass = points.map(([x, z]) => [x, z, grassBase(x, z)]);
    return { actors, herds, trees, tops, yurts, pieces, grounds, solids, spawns, groups, flocks, ledges, marmots, grass };
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
  const { default: manifest } = await moduleAt('src/shards/nalati-grasslands/manifest.ts');
  (await moduleAt('src/game/shard/list.ts')).installShards([manifest]);
  (await moduleAt('src/game/shard/registry.ts')).setActiveChunk(manifest.slug);
  // The page equality oracle pins this same seed before native group construction.
  (await moduleAt('src/engine/app/runtime.ts')).app.rng.seed(0x4a1a);
  const { NalatiPlugin } = await moduleAt('src/shards/nalati-grasslands/runtime/index.ts');
  const contexts = [];
  class CaptureNalati extends NalatiPlugin {
    async world(ctx) {
      Object.assign(ctx.app.levelAdapters, { hud: { disc: () => ({ button: element('button'), dispose: noop }), widget: () => noop, relabel: () => noop, verb: () => noop, pin: () => noop }, inputContext: (def, owner = ctx.scope) => { ctx.app.input.register(def, owner); return noop; } });
      sky.sceneRoot = ctx.game.runtime.world.game.scene; await super.world(ctx); contexts.push(ctx); }
  }
  const { Terrain, terrainChunkGeometry } = await moduleAt('src/engine/world/Terrain.ts');
  const captures = [];
  await visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: CaptureNalati }) }, {
    root, sky, element: environment.element, tier: 'phone', practiceArena: true,
    installKit: async () => {
      const ctx = contexts[0]; if (ctx === undefined) throw new Error('Nalati world did not complete before kit');
      (await moduleAt('src/game/systems/species/install.ts')).installKitSpecies();
      const { NALATI_SPECIES, NALATI_LOOKS } = await moduleAt('src/shards/nalati-grasslands/species/rows.ts');
      ctx.rows.species(NALATI_SPECIES); ctx.rows.speciesLook(NALATI_LOOKS);
      ctx.rows.feat((await moduleAt('src/shards/nalati-grasslands/data/feats.ts')).NALATI_FEATS);
    },
    nativeTerrain: readFileSync(resolvePath(root, 'public/assets/baked/nalati-grasslands/terrain.bin')),
    createTerrain: async () => {
      const field = await moduleAt('src/engine/world/Heightfield.ts');
      const terrain = new Terrain(); terrain.mesh = new THREE.Mesh(terrainChunkGeometry(field), new THREE.MeshBasicMaterial()); return terrain;
    },
    visit: async ({ scene, forest, registry, physics }) => {
      const ctx = contexts[0]; if (ctx === undefined) throw new Error('Missing native Nalati world');
      const runtime = ctx.game.runtime, world = runtime.world, rt = runtime.objects.nalati;
      (await moduleAt('src/engine/physics/terrain.ts')).addEdgeWalls(physics);
      const { addPiece } = await moduleAt('src/engine/physics/pieces.ts');
      const additions = [];
      // Native bootstrap installs trunks before the platform entry sockets, then authored pieces.
      const forestPiece = registry.pieceList().find(piece => piece.id === 'forest');
      if (forestPiece !== undefined) { forestPiece.surface = 'wood'; additions.push(addPiece(physics, forestPiece)); }
      (await moduleAt('src/engine/physics/entrySockets.ts')).installEntrySockets(physics, ctx.scope, [{ x: 0, z: 0 }]);
      registry.onAdd(piece => { if (piece === forestPiece) return; if (piece.object !== undefined) scene.add(piece.object); additions.push(addPiece(physics, piece)); });
      const { AnimalManager } = await moduleAt('src/engine/entities/AnimalManager.ts');
      const animals = await new AnimalManager(scene, sky, forest).buildAsync(() => Promise.resolve());
      Object.assign(world.player, { velocity: new THREE.Vector3(), yaw: 0, pitch: 0, carried: false, crouching: false, dash: noop });
      await rt.attachAnimalsSliced(animals, () => Promise.resolve());
      rt.bindPlay({ kit: null, health01: () => 1, toast: noop, flash: noop, hurt: noop });
      const wildlife = rt.wildlife;
      const common = { animals, setWeaponsEnabled: noop, refill: noop, interactables: runtime.interactables, params: new URLSearchParams(),
        toast: noop, feed: noop, pickupHum: noop, music: noop };
      rt.boss.bind({ ...common, bow: null, upgradeBow: noop });
      rt.elites.bind({ ...common, wildlife, taming: rt.ride?.taming ?? null, ghosts: null, record: noop, sound: noop, sting: noop });
      rt.titan.bind({ ...common, wildlife, ride: rt.ride, sabre: null, upgradeSabre: noop, hurt: noop, record: noop, ownSkin: noop });
      rt.elites.initialize();
      const { installNalatiAdventure } = await moduleAt('src/shards/nalati-grasslands/adventure.ts');
      const quest = installNalatiAdventure({ ctx, ...world, prompts: runtime.interactables, hud: { toast: noop }, audio: { weaponSwap: noop },
        music: { sting: noop }, fullMap: { setPois: noop, setQuest: noop }, ride: rt.ride, animals, nalati: rt });
      if (quest !== null) await quest.people.ready;
      for (const piece of additions) piece.sync();
      const spawnRows = animals.animals.map(a => ({ id: a.entityId, at: a.position.toArray(), yaw: a.yaw, mem: { ...a.mem } }));
      const groupRows = [['pack', wildlife.packs], ['herd', wildlife.herds]].flatMap(([kind, list]) => list.map(group => ({ kind, members: group.members.map(a => a.entityId), state: group.snapshot() })));
      const point = new THREE.Vector3();
      const flockRows = wildlife.flocks.map(f => ({ n: f.n, cx: f.cx, cz: f.cz, members: Array.from({ length: f.n }, (_v, i) => ({ at: f.positions(i, point).toArray(), yaw: f.headingOf(i) })) }));
      captures.push(readMetadata({ ...world, animals }, wildlife, spawnRows, groupRows, flockRows));
    },
  });
  const captured = captures[0];
  if (captured === undefined || captured.grounds.length !== 1 || captured.actors.length === 0) throw new Error('Native Nalati capture did not complete');
  const inputs = nalatiPhysicsInputs(root), digest = createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
  const { grounds, ...metadata } = captured;
  const result = { version: 1, revision: digest.slice(0, 40), build: `node-${digest}`, profile: 'Node / phone / no renderer',
    notice: 'DO NOT EDIT: regenerate with generators/bake-nalati-physics.mjs. revision identifies recipe inputs.', inputs, ground: grounds[0], ...metadata };
  const writer = byteWriter(process.argv.includes('--check'), 'bake-nalati-physics');
  writer.put(resolvePath(root, 'src/shards/nalati-grasslands/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`); writer.finish();
  console.log(`bake-nalati-physics: ${result.actors.length} native actors, ${result.solids.length} world solids, Node canonical`);
} finally {
  try { (await moduleAt('src/engine/app/resources.ts')).pageScope.dispose(); } finally {
    for (const name of uiNames) { const previous = uiBefore.get(name); if (previous === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, previous); }
    environment.dispose();
  }
}
