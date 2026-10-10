// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle fixture uses the production native Rapier binary.
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { DataTexture, Fog, Group, Mesh, MeshLambertMaterial, PlaneGeometry, Scene, Vector3 } from 'three';
import { ownSceneResource } from '../src/engine/app/sceneOwnership';
import { registerSpecies, speciesDef } from '../src/engine/entities/species/registry';
import { App } from '../src/engine/app/app';
import { withOwner } from '../src/engine/app/ownership';
import { Scope } from '../src/engine/app/scope';
import { setTexturePolicy, texMode, gpuFile } from '../src/engine/boot/gpuFiles';
import { initializeTier } from '../src/engine/core/tier';
import { saveSetting } from '../src/engine/ui/Settings';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import type { SimHost } from '../src/engine/sim';
import { activeLevel, configureLevel } from '../src/engine/level/selection';
import { heightAt } from '../src/engine/world/Heightfield';
import type { TerrainField } from '../src/engine/level/data';
import type { LevelSpec } from '../src/engine/level/spec';
import { WorldRegistry } from '../src/engine/world/registry';
import { Terrain } from '../src/engine/world/Terrain';
import { SkyRig } from '../src/engine/world/skyRig';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type RegionalRuntimeRequest } from '../src/game/grid/regionalRuntime';
import { createRegionalView } from '../src/game/grid/regionalView';
import { createRegionalWorldFoundation, regionalWorldCensus } from '../src/game/grid/regionalWorld';
import { regionGrade, type FrameLookContribution, type FrameLookPort } from '../src/game/grid/frameLook';
import type { SkyBackdropFactory, TerrainPainter } from '../src/engine/render/look';
import { shardContext } from '../src/game/shard/context';
import type { ShardPlayHost, ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { toLevelSpec } from '../src/game/shard/spec';
import { Progress } from '../src/game/Progress';
import { Inventory } from '../src/game/Inventory';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import pineSource from '../src/shards/pine-hollow/shard.config';
import { fakeWorld } from './fake/world';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const noop = (): void => undefined;
const priorDocument: unknown = Reflect.get(globalThis, 'document');
afterEach(() => { if (priorDocument === undefined) Reflect.deleteProperty(globalThis, 'document'); else Reflect.set(globalThis, 'document', priorDocument); });
const field = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, trails: [], cabinSites: [], pond: null });

/** Node cannot fetch the ground's image layers: the drawn ground is one real mesh; heights and colliders stay real. */
const drawnGround = (): Promise<Terrain> => { const terrain = new Terrain(); terrain.group.add(new Mesh()); return Promise.resolve(terrain); };
/** The real Game scene binding (getter + bindScene) on an instance without a WebGL context; the rest are doubles. */
function pageGame(scope: Scope): Game {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  for (const [key, value] of Object.entries({ _composer: null, rootScene: new Scene(), sceneFrames: [], renderer: { extensions: { has: () => false } }, levelScope: scope })) Reflect.defineProperty(game, key, { value, writable: true });
  return game;
}

function fixture() {
  const home = { ...toLevelSpec(PINE_HOLLOW), id: 'home', ground: { terrain: field(3) }, spawns: [] }; configureLevel(home);
  const app = new App(), scope = app.engineScope.child('grid.page'), homePhysics = new Physics(rapier);
  const homeRegistry = new WorldRegistry(); app.registryValue = homeRegistry; app.levelScope = scope;
  const game = pageGame(scope), doubles = fakeWorld();
  const player = { position: new Vector3() } as Player;
  const world = { game, player, sky: doubles.sky, forest: doubles.forest, physics: homePhysics, registry: homeRegistry, chunk: PINE_HOLLOW } as ShardWorld;
  const play = withOwner(scope, () => ({ nolock: true, progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') })) as ShardPlayHost;
  // Presentation-only canvas port; terrain, forest, creatures, physics and scopes are real.
  Reflect.set(globalThis, 'document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => undefined }), fillStyle: '', fillRect: () => undefined }) }) });
  const runtime: ShardRuntime = { world, play, step: null, hooks: {}, objects: {}, overhead: [], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(installation.context, PINE_HOLLOW, { shard: PINE_HOLLOW, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const admitted = { source: pineSource, assets: new Map<string, Uint8Array>(), cached: false };
  const claim = allocator.reserve({ id: 'sim:pine-hollow', category: 'sim', owner: 'pine-hollow', bytes: regionalRuntimeAccountedBytes(admitted, PINE_HOLLOW), distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture whole-runtime lease refused');
  const request: RegionalRuntimeRequest = { cell: { instance: 'pine-hollow', slug: 'pine-hollow', cell: [1, 0], origin: { x: 555, y: 0, z: 0 } },
    admitted, manifest: PINE_HOLLOW, allocator, claim, scope, page: { world, play, context } };
  // The region's level: Pine's identity with a flat 30 m test field and two real boar herds (no baked assets in Node).
  const pine = toLevelSpec(PINE_HOLLOW); Reflect.deleteProperty(pine, 'assets'); Reflect.deleteProperty(pine, 'trees');
  const region: LevelSpec = { ...pine, ground: { terrain: field(30) }, seed: 435, faunaTuning: {},
    creatureStyle: 'toon' as const, creatures: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true },
    spawns: [-100, 100].map((x) => ({ kind: 'boar', count: 1, variants: ['boar'], canopy: false, trailBand: [0, 150] as [number, number], anchor: { x, z: 100, rMin: 0, rMax: 1 } })) };
  let saves = 0;
  const foundation = createRegionalWorldFoundation({ rapier, level: () => region, terrain: drawnGround, pause: () => Promise.resolve(), checkpoint: () => { saves++; return true; } });
  return { app, scope, game, world, homePhysics, homeRegistry, request, claim, allocator, foundation, home, region, saves: () => saves };
}

it('yields between collision, terrain, tree and forest batches without rebinding the page', async () => {
  const f = fixture(), levels: string[] = [];
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround,
    pause: () => { levels.push(activeLevel().id); expect(f.game.scene).toBe(f.game.rootScene); return Promise.resolve(); }, checkpoint: () => true });
  try {
    const prepared = await foundation(f.request);
    expect(levels).toEqual(['home', 'home', 'home', 'home', 'home']);
    expect(prepared.region.host.hasPlayerMotor).toBe(false);
    prepared.region.dispose();
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
});

it('retires partial native allocation if a presentation boundary cancels the foundation', async () => {
  const f = fixture(); let host: SimHost | undefined, batches = 0;
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround,
    install: created => { host = created; }, pause: () => { if (++batches === 2) f.scope.dispose(); return Promise.resolve(); }, checkpoint: () => true });
  try {
    await expect(foundation(f.request)).rejects.toThrow('building its collision');
    if (host === undefined) throw new Error('Missing allocated native batch');
    expect(host.scope.disposed).toBe(true); expect(host.physics.world.colliders).toBeUndefined();
    expect(f.homePhysics.world.colliders.len()).toBe(0);
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
});

it('builds the region with its own cold measured texture policy and overlay before restoring the home', async () => {
  const f = fixture(); initializeTier('phone'); saveSetting('tex', 'auto'); setTexturePolicy('img', 'home');
  const source = '/assets/regional-fixture.webp', target = '/assets/regional-fixture.ktx2';
  const request: RegionalRuntimeRequest = { ...f.request, manifest: { ...f.request.manifest,
    ktx2: () => Promise.resolve({ GPU_FILES: { phone: { [source]: target }, desktop: {} } }) } };
  let loaded = false;
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region,
    terrain: async () => { await Promise.resolve(); expect(texMode()).toBe('ktx2'); expect(gpuFile(source)).toBe(target); loaded = true; return drawnGround(); },
    pause: () => Promise.resolve(), checkpoint: () => true });
  try {
    expect(texMode()).toBe('img');
    const prepared = await foundation(request); expect(loaded).toBe(true); expect(texMode()).toBe('img');
    const entered = f.scope.child('entered'); prepared.enter(entered);
    expect(texMode()).toBe('ktx2'); expect(gpuFile(source)).toBe(target);
    entered.dispose(); expect(texMode()).toBe('img'); prepared.region.dispose(); expect(texMode()).toBe('img');
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); setTexturePolicy(undefined); saveSetting('tex', 'auto'); }
});

it('restores the home texture policy when a destination asset build fails before entry', async () => {
  const f = fixture(); initializeTier('phone'); saveSetting('tex', 'auto'); setTexturePolicy('img', 'home');
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region,
    terrain: async () => { await Promise.resolve(); expect(texMode()).toBe('ktx2'); throw new Error('Destination texture failure'); },
    pause: () => Promise.resolve(), checkpoint: () => true });
  try { await expect(foundation(f.request)).rejects.toThrow('Destination texture failure'); expect(texMode()).toBe('img'); }
  finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); setTexturePolicy(undefined); saveSetting('tex', 'auto'); }
});

it('owns a bodyless destination, its terrain collider and a scene subtree that game.scene resolves only while entered', async () => {
  const f = fixture();
  const prepared = await f.foundation({ ...f.request, scope: f.scope.child('grid.runtime:pine-hollow') });
  try {
    const host = prepared.region.host;
    expect(host.physics).not.toBe(f.homePhysics); expect(host.embedded).toBe(false); expect(host.hasPlayerMotor).toBe(false);
    expect(host.physics.world.colliders.len()).toBe(1); expect(f.homePhysics.world.colliders.len()).toBe(0);
    expect(prepared.ground.heightAt(0, 0)).toBe(30); expect(heightAt(0, 0)).toBe(3); expect(activeLevel()).toBe(f.home);
    const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: host.physics, slot: f.app,
      assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope: f.request.scope, ground: prepared.ground });
    const world = prepared.world(view);
    expect(world.game).toBe(f.game); expect(world.player).toBe(f.world.player); expect(world.physics).toBe(host.physics); expect(world.registry).toBe(view.registry);
    expect(world.terrain.group.parent?.parent).toBe(view.root); expect(f.game.scene).toBe(f.game.rootScene);
    const prepare = prepared.prepare;
    if (prepare === undefined) throw new Error('Missing regional construction binding');
    const before = f.app.systemIds(f.scope);
    for (let turn = 0; turn < 30; turn++) {
      const construction = f.scope.child('construction'); prepare(construction); view.prepare(construction);
      expect(activeLevel()).toBe(f.region); expect(heightAt(0, 0)).toBe(30);
      expect(f.game.scene).not.toBe(f.game.rootScene); expect(view.root.visible).toBe(false);
      expect(f.app.systemIds(f.scope)).toEqual(before);
      construction.dispose(); expect(activeLevel()).toBe(f.home); expect(heightAt(0, 0)).toBe(3);
      expect(f.game.scene).toBe(f.game.rootScene); expect(f.app.registry).not.toBe(view.registry);
    }
    const entry = new Scope('entered');
    prepared.enter(entry); view.enter(entry);
    const regional = f.game.scene;
    expect(regional).not.toBe(f.game.rootScene); expect(regional.parent).toBe(view.root);
    expect(activeLevel()).toBe(f.region); expect(heightAt(0, 0)).toBe(30); expect(f.app.levelScope).not.toBe(f.scope);
    // Content a runtime adds to game.scene in its frame-local coordinates draws at the cell's render offset.
    const prop = new Mesh(); prop.position.set(1, 0, 2); f.game.scene.add(prop); prop.updateMatrixWorld(true);
    expect(prop.getWorldPosition(new Vector3()).toArray()).toEqual([556, 0, 2]);
    const { animals } = await prepared.afterKit(f.request.page.context, world);
    expect(animals.animals.map(animal => animal.position.y)).toEqual([30, 30]);
    expect(f.game.rootScene.children).toEqual([view.root]); expect(regional.children.length).toBeGreaterThan(2);
    expect(f.app.systemsByPhase().update.map(system => system.id)).toContain('grid.runtime.pine-hollow.forest');
    expect(prepared.checkpoint()).toBe(true); expect(f.saves()).toBe(1);
    entry.dispose();
    expect(f.game.scene).toBe(f.game.rootScene); expect(activeLevel()).toBe(f.home); expect(heightAt(0, 0)).toBe(3);
    expect(view.root.visible).toBe(false); expect(regionalWorldCensus(prepared)?.sceneBound).toBe(false);
    expect(f.app.systemsByPhase().update.map(system => system.id)).not.toContain('grid.runtime.pine-hollow.forest');
  } finally { prepared.region.dispose(); f.request.scope.dispose(); }
  expect(regionalWorldCensus(prepared)).toEqual({ bodies: 0, colliders: 0, sceneBound: false, parented: false, disposed: true });
  expect(f.game.rootScene.children).toHaveLength(0); expect(prepared.checkpoint()).toBe(false);
  f.homePhysics.dispose(); f.claim.release(); expect(f.allocator.entries()).toEqual([]);
});

it('lets createRegionalRuntimeFactory admit Pine on the foundation, and returns the page to baseline on leave', async () => {
  const f = fixture();
  const regional = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, prepareFoundation: f.foundation });
  const prepared = await regional(f.request);
  try {
    expect(prepared.region.host.physics.world.colliders.len()).toBe(1);
    const root = f.game.rootScene.children[0];
    expect(root).toBeInstanceOf(Group); expect(root?.visible).toBe(false); expect(root?.position.x).toBe(555);
    expect(prepared.queries.heightAt(10, 10)).toBe(30);
  } finally { prepared.region.dispose(); }
  expect(f.game.rootScene.children).toHaveLength(0); expect(f.homeRegistry.pieces).toHaveLength(0);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); expect(f.allocator.entries()).toEqual([]);
});

it('releases everything it allocated when the runtime leaves during preparation', async () => {
  const f = fixture(), scope = f.scope.child('grid.runtime:pine-hollow');
  const leaving = vi.fn(() => { scope.dispose(); return Promise.resolve(null); });
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround, navmesh: leaving, pause: () => Promise.resolve(), checkpoint: () => true });
  await expect(foundation({ ...f.request, scope })).rejects.toThrow();
  expect(leaving).toHaveBeenCalledOnce(); expect(f.game.rootScene.children).toHaveLength(0);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
});

it("paints the region's ground with its own level's look painter on its own heightfield, owned by the resident (E452)", async () => {
  const f = fixture(), seen: { height: number; global: number; owner: Scope | null }[] = [];
  const dispose = vi.fn<() => void>();
  const painter: TerrainPainter = { build: (terrain, ground, owner) => {
    seen.push({ height: ground.heightAt(0, 0), global: heightAt(0, 0), owner });
    const mesh = new Mesh(new PlaneGeometry(1, 1), new MeshLambertMaterial()); owner.own(mesh.geometry); owner.own(mesh.material);
    terrain.mesh = mesh; terrain.group.add(mesh); return Promise.resolve();
  } };
  const resolveLook = vi.fn(() => Promise.resolve({ compose: () => ({}), terrainPainter: painter, dispose }));
  const level: LevelSpec = { ...f.region, look: resolveLook };
  const scope = f.scope.child('grid.runtime:pine-hollow');
  const foundation = createRegionalWorldFoundation({ rapier, level: () => level, pause: () => Promise.resolve(), checkpoint: () => true, look: null });
  const prepared = await foundation({ ...f.request, scope });
  const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: prepared.region.host.physics, slot: f.app,
    assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope, ground: prepared.ground });
  const world = prepared.world(view);
  // the region's field (30 m), never the home's (3 m); the painter's mesh is the region's drawn ground
  expect(seen).toHaveLength(1); expect(seen[0]?.height).toBe(30); expect(seen[0]?.global).toBe(3);
  expect(world.terrain.mesh.parent?.parent?.parent).toBe(view.root);
  const owner = seen[0]?.owner;
  expect(owner?.disposed).toBe(false);
  expect(resolveLook).toHaveBeenCalledOnce(); expect(dispose).not.toHaveBeenCalled();
  const entry = scope.child('entered'); prepared.enter(entry); entry.dispose();
  expect(dispose).not.toHaveBeenCalled();
  prepared.region.dispose(); scope.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  expect(owner?.disposed).toBe(true); expect(f.game.rootScene.children).toHaveLength(0);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
});

it('retires a look that resolves after its resident left without allocating a native destination', async () => {
  const f = fixture(), dispose = vi.fn<() => void>(), installed = vi.fn<() => void>();
  const level: LevelSpec = { ...f.region, look: async () => {
    await Promise.resolve(); f.scope.dispose();
    return { compose: () => ({}), dispose };
  } };
  const foundation = createRegionalWorldFoundation({ rapier, level: () => level, terrain: drawnGround, install: installed,
    pause: () => Promise.resolve(), checkpoint: () => true });
  try {
    await expect(foundation(f.request)).rejects.toThrow('loading its look');
    expect(dispose).toHaveBeenCalledOnce(); expect(installed).not.toHaveBeenCalled();
    expect(f.homePhysics.world.colliders.len()).toBe(0);
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
});

it('hands the same resolved look backdrop to the regional sky and keeps it alive until resident retirement', async () => {
  const f = fixture(), dispose = vi.fn<() => void>();
  const backdrop = vi.fn<SkyBackdropFactory>(() => { throw new Error('The fixture sky only admits the backdrop factory'); });
  const resolveLook = vi.fn(() => Promise.resolve({ compose: () => ({}), backdrop, dispose }));
  const level: LevelSpec = { ...f.region, look: resolveLook };
  let delivered: SkyBackdropFactory | undefined;
  let finishSky = (): void => { throw new Error('Sky build has not started'); };
  const skyBuilt = new Promise<null>(resolve => { finishSky = () => { resolve(null); }; });
  Object.setPrototypeOf(f.world.sky, SkyRig.prototype);
  Reflect.set(f.world.sky, 'scopeLevelLook', () => null);
  Reflect.set(f.world.sky, 'layeredBackdrop', (factory: SkyBackdropFactory) => { delivered = factory; return skyBuilt; });
  const look: FrameLookPort = { contribute: () => noop, sky: () => noop };
  const foundation = createRegionalWorldFoundation({ rapier, level: () => level, terrain: drawnGround,
    pause: () => Promise.resolve(), checkpoint: () => true, light: null, look });
  try {
    const prepared = await foundation(f.request);
    const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: prepared.region.host.physics, slot: f.app,
      assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope: f.scope, ground: prepared.ground });
    prepared.world(view);
    await vi.waitFor(() => { expect(delivered).toBe(backdrop); });
    expect(resolveLook).toHaveBeenCalledOnce(); expect(dispose).not.toHaveBeenCalled();
    let warmed = false;
    const warm = Promise.resolve(prepared.beforeWarm?.()).then(() => { warmed = true; return true; });
    await Promise.resolve(); expect(warmed).toBe(false);
    finishSky(); await warm; expect(warmed).toBe(true);
    prepared.region.dispose(); expect(dispose).toHaveBeenCalledOnce();
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
});

it('borrows the sky environment created by attachment without taking or repeating its native disposal', async () => {
  const f = fixture(), environment = new DataTexture(), disposed = vi.fn<() => void>();
  f.allocator.markMeasuredPage(f.claim.id);
  environment.addEventListener('dispose', disposed);
  const skyOwner = f.scope.child('fixture sky'); ownSceneResource(environment, skyOwner);
  const holder = new Scene();
  Object.setPrototypeOf(f.world.sky, SkyRig.prototype);
  Reflect.set(f.world.sky, 'scopeLevelLook', () => null);
  Reflect.set(f.world.sky, 'layeredBackdrop', () => Promise.resolve({
    backdrop: { dispose: noop, gpuBytes: () => 4, gpuCeiling: () => 4, lut: null },
    layer: { holder, attach: () => { holder.environment = environment; }, weight: 0, state: () => ({ weight: 0, drawn: false, bytes: 4 }),
      dispose: () => { skyOwner.dispose(); } },
  }));
  const level: LevelSpec = { ...f.region, look: () => Promise.resolve({ compose: () => ({}), backdrop: () => { throw new Error('The fixture sky owns its build'); } }) };
  const look: FrameLookPort = { contribute: () => noop, sky: () => noop };
  const foundation = createRegionalWorldFoundation({ rapier, level: () => level, terrain: drawnGround,
    pause: () => Promise.resolve(), checkpoint: () => true, light: null, look });
  try {
    const prepared = await foundation(f.request);
    const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: prepared.region.host.physics, slot: f.app,
      assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope: f.scope, ground: prepared.ground });
    prepared.world(view); await prepared.beforeWarm?.();
    const scene = view.root.children.find(child => child instanceof Scene);
    if (!(scene instanceof Scene)) throw new Error('Missing regional scene');
    expect(scene.environment).toBe(environment); expect(disposed).not.toHaveBeenCalled();
    prepared.region.dispose();
    expect(scene.environment).toBeNull(); expect(disposed).toHaveBeenCalledOnce();
  } finally { f.scope.dispose(); f.homePhysics.dispose(); f.claim.release(); }
});

it("contributes its own fog object and its level's grade to the one grid frame while resident, and releases them (E452)", async () => {
  const f = fixture(), live: { instance: string; look: FrameLookContribution; released: boolean }[] = [];
  const port: FrameLookPort = { contribute: (instance, look) => { const row = { instance, look, released: false }; live.push(row); return () => { row.released = true; }; } };
  f.game.rootScene.fog = new Fog(0x8899aa, 10, 400);
  const scope = f.scope.child('grid.runtime:pine-hollow');
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround, pause: () => Promise.resolve(), checkpoint: () => true, look: port });
  const prepared = await foundation({ ...f.request, scope });
  expect(live).toHaveLength(0); // nothing before composition
  const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: prepared.region.host.physics, slot: f.app,
    assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope, ground: prepared.ground });
  prepared.world(view);
  expect(live.map(row => row.instance)).toEqual(['pine-hollow']);
  expect(live[0]?.look.grade).toEqual(regionGrade(f.region));
  const entry = new Scope('entered'); prepared.enter(entry);
  // what the runtime's weather writes (game.scene.fog while entered) is the fog the frame reads; the page's fog is untouched
  const fog = f.game.scene.fog;
  expect(fog).not.toBe(f.game.rootScene.fog); expect(live[0]?.look.fog).toBe(fog);
  entry.dispose(); expect(live[0]?.released).toBe(false);
  prepared.region.dispose();
  expect(live[0]?.released).toBe(true);
  f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
});

it("swaps its light on the page's one sky on every entry, after the scene binding goes back on leave (G223)", async () => {
  const f = fixture(), events: string[] = [];
  const light = (entry: Scope): void => { events.push(`hold:${String(f.game.scene === f.game.rootScene)}`); entry.onDispose(() => { events.push(`restore:${String(f.game.scene === f.game.rootScene)}`); }); };
  const scope = f.scope.child('grid.runtime:pine-hollow');
  const foundation = createRegionalWorldFoundation({ rapier, level: () => f.region, terrain: drawnGround, pause: () => Promise.resolve(), checkpoint: () => true, look: null, light });
  const prepared = await foundation({ ...f.request, scope });
  const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene, physics: prepared.region.host.physics, slot: f.app,
    assets: f.app.assets, allocator: f.allocator, claim: f.claim, scope, ground: prepared.ground });
  prepared.world(view);
  for (const name of ['entered:1', 'entered:2']) { const entry = new Scope(name); prepared.enter(entry); entry.dispose(); }
  // held before the region's scene is bound, put back once it is unbound: the page's light is the last thing restored
  expect(events).toEqual(['hold:true', 'restore:true', 'hold:true', 'restore:true']);
  prepared.region.dispose(); f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
});


it('keeps a custom thinker at its legacy cadence after regional async construction and re-entry', async () => {
  const f = fixture(), original = speciesDef('boar'), think = vi.fn<NonNullable<typeof original.think>>();
  registerSpecies({ ...original, think });
  const prepared = await f.foundation(f.request);
  const view = createRegionalView({ cell: f.request.cell, home: { x: 0, z: 0 }, scene: f.game.rootScene,
    physics: prepared.region.host.physics, slot: f.app, assets: f.app.assets, allocator: f.allocator,
    claim: f.claim, scope: f.request.scope, ground: prepared.ground });
  try {
    const world = prepared.world(view), { animals } = await prepared.afterKit(f.request.page.context, world);
    expect(animals.animals).toHaveLength(2);
    for (let visit = 0; visit < 2; visit++) {
      const entry = f.scope.child(`thinker.entry.${visit}`); prepared.enter(entry); view.enter(entry);
      const before = think.mock.calls.length;
      for (let tick = 0; tick < 60; tick++) animals.update(1 / 60, tick / 60, new Vector3());
      expect(think.mock.calls.length - before).toBe(20); // Two real actors, ten brain ticks each, full-frame bodies.
      expect(animals.animals.map(actor => animals.scheduler.brainHz('legacy', actor))).toEqual([10, 10]);
      entry.dispose();
    }
  } finally {
    registerSpecies(original); prepared.region.dispose(); f.scope.dispose(); f.homePhysics.dispose(); f.claim.release();
  }
});
