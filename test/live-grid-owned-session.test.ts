// oxlint-disable-next-line import/no-nodejs-modules -- The live composition drives the shipped native Physics.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Scene, PerspectiveCamera } from 'three';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { createSimHost } from '../src/engine/sim';
import { fakeWorld } from './fake/world';
import { Animal } from '../src/engine/entities/AnimalView';
import nalatiSource from '../src/shards/nalati-grasslands/shard.config';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { WorldRegistry } from '../src/engine/world/registry';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { GridAssembly } from '../src/game/grid/assembly';
import { gridCells } from '../src/game/grid/boot';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { PageResidency } from '../src/game/grid/pageResidency';
import * as foundation from '../src/game/grid/regionalWorld';
import * as products from '../src/game/grid/products';
import { regionalRuntimeAccountedBytes } from '../src/game/grid/regionalRuntime';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { ShardPlugin } from '../src/game/shard/plugin';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import type { ShardPlayHost, ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { findShard } from '../src/game/shard/registry';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import source from '../src/shards/pine-hollow/shard.config';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const noop = (): void => undefined;

it('retires each owned runtime before the next foundation and rebuilds its durable herd on return', async () => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer), app = new App(), scope = app.engineScope.child('page');
  app.levelScope = scope;
  const pageHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier: R });
  const globals = ['window', 'document'].map(name => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (prior === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, prior); };
  });
  const initial = pageHost.physics.world.colliders.len(), assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('pine-hollow'), target = assembly.cell('nalati-grasslands');
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) }), owner = new PageResidency(allocator);
  const residency = owner.admitHome(home.instance, regionalRuntimeAccountedBytes({ source }, PINE_HOLLOW)); scope.onDispose(() => { owner.dispose(); });
  const scene = new Scene(), registry = new WorldRegistry(); app.registryValue = registry;
  const game = { scene, rootScene: scene, renderer: {}, get levelScope() { return app.levelScope ?? scope; } } as Game;
  const player = { position: pageHost.player.position, camera: new PerspectiveCamera() } as Player;
  const world = { game, player, physics: pageHost.physics, registry, chunk: PINE_HOLLOW } as ShardWorld;
  const play = { nolock: true } as ShardPlayHost;
  const runtime: ShardRuntime = { world, play, step: null, hooks: {}, objects: {}, overhead: [], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(installation.context, PINE_HOLLOW, { shard: PINE_HOLLOW, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  let worlds = 0, plays = 0, disposed = 0;
  class Runtime extends ShardPlugin {
    override world(ctx: ShardContext): void { worlds++; ctx.piece({ id: 'runtime.deck', name: 'Deck', category: 'props', file: 'runtime/index.ts', colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 2, hy: 0.5, hz: 2 }] }); }
    override kit(ctx: ShardContext): void { const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing runtime'); rt.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), rifle: null, secondary: null }); }
    override play(): void { plays++; }
  }
  const trusted = PINE_HOLLOW.trustedRuntime; if (trusted === undefined) throw new Error('Missing trusted entry');
  for (const cell of [home, target]) {
    const registered = findShard(cell.slug); if (registered === undefined) throw new Error('Missing registered manifest');
    vi.spyOn(registered, 'load').mockResolvedValue({ default: Runtime, resolveTrustedRuntime: entry => {
      if (entry !== 'runtime/index.ts') throw new Error('Unknown fixture entry'); return Runtime;
    } });
  }
  const release = vi.fn();
  const productReads = vi.spyOn(products, 'gridShardfileProduct').mockImplementation(identity => identity !== home.slug && identity !== target.slug ? null : Promise.resolve({
    admitted: { source: identity === home.slug ? source : nalatiSource, assets: new Map(), cached: false }, release,
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const regions: ReturnType<typeof createSimHost>[] = [];
  const herds: AnimalManager[] = [];
  vi.spyOn(foundation, 'createRegionalWorldFoundation').mockImplementation(ports => request => {
    // View/terrain/rig construction is a declared foundation double; native host, grid installs, lease, scopes,
    // registry, trusted lifecycle, equipment and checkpoint writers remain the real production implementations.
    expect(regions.every(prior => prior.scope.disposed)).toBe(true);
    const host = createSimHost({ ...SIM_LEVEL, id: request.cell.slug, entities: [], quests: [] }, { rapier: R, playerBody: false, scope: request.scope.child('native-foundation') });
    regions.push(host); ports.install?.(host, request);
    const animals = new AnimalManager(scene, fakeWorld().sky, world.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
    const model = animals.factory.model('boar');
    const animal = new Animal(animals.factory.instantiate(model, 0.5), model, 0.5, 1, 'creature:0');
    animal.position.set(0, 0, 5); animals.animals.push(animal); herds.push(animals);
    request.scope.onDispose(() => { animal.retireBody(); });
    vi.spyOn(animals, 'update').mockImplementation(noop);
    return Promise.resolve({ region: { host, dispose: () => { disposed++; host.dispose(); } }, ground: { heightAt: () => 0, waterSurfaceAt: () => null },
      world: view => ({ ...world, registry: view.registry, physics: host.physics }),
      enter: entered => { const prior = app.levelScope; app.levelScope = request.scope; entered.onDispose(() => { app.levelScope = prior; }); },
      afterKit: () => Promise.resolve({ animals, wearSkin: noop }), checkpoint: () => ports.checkpoint(host, request) });
  });
  const traveller = { position: pageHost.player.position, yaw: 0, motor: pageHost.releasePlayerMotor(), camera: player.camera, hoverSpeedLimit: null,
    bindFrame: (_physics: typeof pageHost.physics, motor: typeof pageHost.player.motor) => { traveller.motor = motor; } };
  gridCells.enter({ instance: home.instance, slug: home.slug }); // bootPageMode publishes this before the owned shell exists
  let beforeFixed = noop;
  const session = new LiveGridSession({ assembly, home, physics: pageHost.physics, scope, walls: new ReadinessWalls(pageHost.physics, [], scope), strips: [], allocator, residency,
    neighbourEdges: () => [], rimEdges: () => [] }, {
    ownedHome: true, traveller, health: pageHost.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: app.events,
    saves: app.saves, checkpoint: () => true, catalogue: [], runtimePage: () => ({ world, play, context }), setPhysics: noop,
    onFixedPre: run => { beforeFixed = run; }, onFixedPost: noop, onInput: noop, onUpdate: noop,
  });
  const wait = async (ready: () => boolean): Promise<void> => {
    for (let turn = 0; turn < 100 && !ready(); turn++) { beforeFixed(); await Promise.resolve(); }
    expect(ready(), JSON.stringify(session.state())).toBe(true);
  };
  const leave = async (): Promise<void> => {
    traveller.position.set(268, 0.5, 0); // past motor hysteresis, on the neutral road
    await wait(() => session.live.current() === null);
    expect(session.live.state().residents).toEqual([]);
    expect(gridCells.cell).toBeNull(); expect(app.registryValue).toBe(registry);
    expect(regions.every(host => host.scope.disposed)).toBe(true);
    expect(allocator.entries().filter(row => row.category === 'sim' && row.owner !== 'platform').every(row => row.id === 'sim:platform.highway')).toBe(true);
  };
  const enter = async (cell: typeof home): Promise<void> => {
    traveller.position.set(cell.origin.x, 0.5, cell.origin.z);
    await wait(() => session.live.current() === cell.instance);
    gridCells.enter({ instance: cell.instance, slug: cell.slug });
    await wait(() => session.gameplayReady());
    expect(session.live.state().residents).toEqual([cell.instance]);
  };
  try {
    expect(session.live.current()).toBeNull();
    await session.live.prefetch([home.instance, target.instance]);
    expect(regions).toHaveLength(0); expect([worlds, plays]).toEqual([0, 0]);
    await session.enterInitialHome();
    expect(session.live.current()).toBe(home.instance); expect([worlds, plays]).toEqual([1, 1]);
    const first = herds[0]?.animals[0]; if (first === undefined) throw new Error('Missing first native herd');
    first.hp = 55; first.position.set(12, 0, 34);
    expect(session.live.checkpoint(home.instance)).toBe(true);
    await leave();
    await enter(target); expect([worlds, plays]).toEqual([2, 2]);
    expect(herds[1]?.animals[0]?.hp).not.toBe(55);
    await leave();
    await enter(home); expect([worlds, plays]).toEqual([3, 3]);
    const restored = herds[2]?.animals[0];
    expect(restored?.hp).toBe(55); expect(restored?.position.toArray()).toEqual([12, 0, 34]);
    expect(regions.filter(host => !host.scope.disposed)).toHaveLength(1);
    expect(() => { scope.dispose(); }).not.toThrow();
    expect(session.live.current()).toBeNull(); expect(disposed).toBe(3);
    expect(regions.every(host => host.scope.disposed)).toBe(true);
    expect(release).toHaveBeenCalledTimes(productReads.mock.results.filter(result => result.type === 'return' && result.value !== null).length); expect(scene.children).toHaveLength(0);
  } finally {
    gridCells.leave(); scope.dispose(); pageHost.attachPlayerMotor(traveller.motor);
    expect(pageHost.physics.world.colliders.len()).toBe(initial); pageHost.dispose();
    for (const restore of globals) restore();
  }
  expect(allocator.entries()).toEqual([]);
});
