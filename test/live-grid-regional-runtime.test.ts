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

it('admits a whole-cost runtime, runs hooks only after the real interior event, checkpoints and returns both worlds to baseline', async () => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer), app = new App(), scope = app.engineScope.child('page');
  app.levelScope = scope;
  const pageHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier: R });
  const globals = ['window', 'document'].map(name => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: new EventTarget() });
    return () => { if (prior === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, prior); };
  });
  const initial = pageHost.physics.world.colliders.len(), assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle'), target = assembly.cell('pine-hollow');
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) }), owner = new PageResidency(allocator);
  const residency = owner.admitHome(home.instance, 1_000_000); scope.onDispose(() => { owner.dispose(); });
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
  const registered = findShard(target.slug); if (registered === undefined) throw new Error('Missing registered manifest');
  vi.spyOn(registered, 'load').mockResolvedValue({ default: Runtime, resolveTrustedRuntime: entry => {
    if (entry !== 'runtime/index.ts') throw new Error('Unknown fixture entry'); return Runtime;
  } });
  const release = vi.fn();
  vi.spyOn(products, 'gridShardfileProduct').mockReturnValue(Promise.resolve({ admitted: { source, assets: new Map(), cached: false }, release,
    options: { base: 'https://fixture.invalid/', offline: false, firstParty: true, fetch: () => Promise.reject(new Error('No network')), hash: () => Promise.reject(new Error('Already admitted')) } }));
  const regions: ReturnType<typeof createSimHost>[] = [];
  let aimBodies: AnimalManager['animals'] = [];
  vi.spyOn(foundation, 'createRegionalWorldFoundation').mockImplementation(ports => request => {
    // View/terrain/rig construction is a declared foundation double; native host, grid installs, lease, scopes,
    // registry, trusted lifecycle, equipment and checkpoint writers remain the real production implementations.
    const host = createSimHost({ ...SIM_LEVEL, id: target.slug, entities: [], quests: [] }, { rapier: R, playerBody: false });
    regions.push(host); ports.install?.(host, request);
    const animals = new AnimalManager(scene, world.sky, world.forest, { style: 'toon' }); aimBodies = animals.animals; vi.spyOn(animals, 'update').mockImplementation(noop);
    return Promise.resolve({ region: { host, dispose: () => { disposed++; host.dispose(); } }, ground: { heightAt: () => 0, waterSurfaceAt: () => null },
      world: view => ({ ...world, registry: view.registry, physics: host.physics }),
      enter: entered => { const prior = app.levelScope; app.levelScope = request.scope; entered.onDispose(() => { app.levelScope = prior; }); },
      afterKit: () => Promise.resolve({ animals, wearSkin: noop }), checkpoint: () => ports.checkpoint(host, request) });
  });
  const traveller = { position: pageHost.player.position, yaw: 0, motor: pageHost.releasePlayerMotor(), camera: player.camera, hoverSpeedLimit: null,
    bindFrame: (_physics: typeof pageHost.physics, motor: typeof pageHost.player.motor) => { traveller.motor = motor; } };
  const session = new LiveGridSession({ assembly, home, physics: pageHost.physics, scope, walls: new ReadinessWalls(pageHost.physics, [], scope), strips: [], allocator, residency,
    neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: pageHost.player.health, equipment: new EquipmentService(new EmptyEquipment(), { scope }), events: app.events,
    saves: app.saves, checkpoint: () => true, catalogue: [], runtimePage: () => ({ world, play, context }), setPhysics: noop,
    onFixedPre: noop, onFixedPost: noop, onInput: noop, onUpdate: noop,
  });
  try {
    await session.live.prefetch([target.instance]); expect(worlds).toBe(0); expect(plays).toBe(0);
    const claim = allocator.entries().find(row => row.id === `sim:${target.instance}`);
    expect(claim).toMatchObject({ bytes: regionalRuntimeAccountedBytes({ source }, PINE_HOLLOW), refs: 1, holds: 0 });
    expect(session.aimAnimals()).toEqual([]); expect(session.aimAnimals()).not.toBe(aimBodies);
    const prepared = await session.live.prepare(home.instance, target.instance); prepared.commit();
    traveller.position.set(0, 0.5, 0); expect(session.gameplayReady()).toBe(false);
    gridCells.enter({ instance: target.instance, slug: target.slug });
    for (let i = 0; i < 50 && !session.gameplayReady(); i++) await Promise.resolve();
    expect(session.gameplayReady()).toBe(true); expect([worlds, plays]).toEqual([1, 1]);
    expect(session.aimAnimals()).toBe(aimBodies);
    traveller.position.z = -260; expect(session.aimAnimals()).not.toBe(aimBodies);
    traveller.position.z = 0; expect(session.aimAnimals()).toBe(aimBodies);
    expect(session.live.checkpoint(target.instance)).toBe(true);
    gridCells.leave(); expect(app.registryValue).toBe(registry);
    expect(session.aimAnimals()).toEqual([]); expect(session.aimAnimals()).not.toBe(aimBodies);
    const leave = await session.live.prepare(target.instance, null); leave.commit();
    expect(session.live.unload(target.instance)).toBe(true); expect(disposed).toBe(1); expect(release).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
    expect(regions.every(host => host.scope.disposed)).toBe(true);
  } finally {
    gridCells.leave(); scope.dispose(); pageHost.attachPlayerMotor(traveller.motor);
    expect(pageHost.physics.world.colliders.len()).toBe(initial); pageHost.dispose();
    for (const restore of globals) restore();
  }
  expect(allocator.entries()).toEqual([]);
});
