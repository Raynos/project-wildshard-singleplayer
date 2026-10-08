// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle fixture uses the production native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { Animal } from '../src/engine/entities/AnimalView';
import { CreatureBodies } from '../src/engine/physics/creatures';
import { SaveStore } from '../src/engine/saves/store';
import { regionalRuntimeCheckpoint } from '../src/game/grid/runtimeCheckpoint';
import { MemoryStorage } from './setup';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { WorldRegistry } from '../src/engine/world/registry';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type RegionalRuntimeRequest, type RegionalRuntimeFactoryPorts } from '../src/game/grid/regionalRuntime';
import { HybridRuntimeSession } from '../src/game/shardfile/hybrid';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { EnteredEquipment } from '../src/game/grid/enteredEquipment';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { ShardPlayHost, ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { Progress } from '../src/game/Progress';
import { Inventory } from '../src/game/Inventory';
import { progressSave, inventorySave } from '../src/game/saves';
import { installEnteredRuntimeService } from '../src/game/shard/retainedHooks';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import pineSource from '../src/shards/pine-hollow/shard.config';
import { fakeWorld } from './fake/world';
import { SIM_LEVEL } from './fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const noop = (): void => undefined;

function fixture(continuation?: RegionalRuntimeFactoryPorts['continuation']) {
  const app = new App(), scope = app.engineScope.child('grid.page'), scene = new Scene(), home = new Physics(rapier);
  const homeRegistry = new WorldRegistry(); app.registryValue = homeRegistry; app.levelScope = scope;
  // Renderer, controls and unbuilt scene fields are explicit test doubles. Only composition/lifecycle is claimed here;
  // the native destination, registry, equipment, saves, scopes and entered systems below are real implementations.
  const candidate: unknown = Object.create(Game.prototype);
  if (!(candidate instanceof Game)) throw new Error('Invalid fixture Game prototype');
  for (const [key, value] of Object.entries({ _composer: null, rootScene: scene, sceneFrames: [], renderer: {}, levelScope: scope })) Reflect.defineProperty(candidate, key, { value, writable: true });
  const game = candidate;
  const player = { position: new Vector3() } as Player;
  const world = { game, player, physics: home, registry: homeRegistry, chunk: PINE_HOLLOW } as ShardWorld;
  const play = withOwner(scope, () => ({ nolock: true, progress: new Progress('driftwood-isle'), inventory: new Inventory('driftwood-isle') })) as ShardPlayHost;
  const runtime: ShardRuntime = { world, play, step: null, hooks: { checkpoint: () => { throw new Error('Death/reset hook is not a border checkpoint'); } },
    objects: { home: true }, overhead: [new Group()], interactables: [], viewer: () => player.position, horizonVeil: null };
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(installation.context, PINE_HOLLOW, { shard: PINE_HOLLOW, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  const allocator = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const admitted = { source: pineSource, assets: new Map<string, Uint8Array>(), cached: false };
  const claim = allocator.reserve({ id: 'sim:pine-hollow', category: 'sim', owner: 'pine-hollow', bytes: regionalRuntimeAccountedBytes(admitted, PINE_HOLLOW), distance: 0, needed: true });
  if (claim === null) throw new Error('Fixture whole-runtime lease refused');
  const road = new EquipmentService(new EmptyEquipment(), { scope }), equipment = new EnteredEquipment(road);
  const request: RegionalRuntimeRequest = { cell: { instance: 'pine-hollow', slug: 'pine-hollow', cell: [1, 0], origin: { x: 555, y: 0, z: 0 } },
    admitted, manifest: PINE_HOLLOW, allocator, claim, scope, page: { world, play, context, equipment } };
  let nativeCheckpoints = 0, nativeDurable = true, destroyed = false;
  const host = createSimHost({ ...SIM_LEVEL, id: 'pine-hollow', entities: [], quests: [], ground: { size: 500, height: 0 } }, { rapier, playerBody: false });
  const region = { host, dispose: () => { destroyed = true; host.dispose(); } };
  const animals = new AnimalManager(scene, fakeWorld().sky, world.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
  // Foundation double supplies no blood/rig build; the real shell updates its built manager on entered ticks.
  const herd = vi.spyOn(animals, 'update').mockImplementation(noop);
  const calls: string[] = [], regional = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, ...(continuation === undefined ? {} : { continuation }), prepareFoundation: prepared => Promise.resolve({ region,
    ground: { heightAt: () => 0, waterSurfaceAt: () => null },
    world: view => {
      const regionalScene = new Scene(); view.root.add(regionalScene);
      const regionalGame = new Proxy(game, { get: (target, key, receiver) => {
        if (key === 'scene') return regionalScene;
        if (key === 'levelScope') return prepared.scope;
        const value: unknown = Reflect.get(target, key, receiver); return value;
      } });
      return { ...world, physics: host.physics, registry: view.registry, game: regionalGame };
    },
    enter: entry => { calls.push('binding.enter'); const prior = app.levelScope; app.levelScope = prepared.scope;
      entry.onDispose(() => { app.levelScope = prior; calls.push('binding.leave'); }); },
    afterWorld: () => { calls.push('shell.world'); },
    afterKit: () => { calls.push('shell.kit'); return Promise.resolve({ animals, wearSkin: noop }); },
    checkpoint: () => { nativeCheckpoints++; return nativeDurable; },
  }) });
  return { app, scope, home, homeRegistry, world, play, runtime, road, equipment, request, claim, allocator, host, calls, regional, herd, animals,
    nativeCheckpoints: () => nativeCheckpoints, refuse: () => { nativeDurable = false; }, destroyed: () => destroyed };
}

it('requires a real foundation and exact whole-runtime lease before constructing a regional view', async () => {
  const f = fixture();
  try {
    await expect(createRegionalRuntimeFactory({ home: { x: 0, z: 0 } })(f.request)).rejects.toThrow('binding is not prepared');
    expect(f.world.game.scene.children).toHaveLength(0); expect(f.homeRegistry.pieces).toHaveLength(0);
    f.claim.release(); await expect(f.regional(f.request)).rejects.toThrow('whole-runtime lease');
  } finally { f.host.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
  expect(f.allocator.entries()).toEqual([]);
});

it('composes two retained entries with real equipment, instance saves, destination colliders and refusal-preserving checkpoints', async () => {
  const f = fixture(), before = Object.getOwnPropertyDescriptors(f.runtime);
  const prepared = await f.regional(f.request), root = f.world.game.scene.children[0];
  const fire = vi.fn(noop); f.equipment.service.onFire = fire;
  let builds = 0, ticks = 0, local: ShardPlayHost | null = null;
  class Runtime extends ShardPlugin {
    override world(ctx: ShardContext): void {
      builds++; f.calls.push('trusted.world');
      expect(ctx.app.registry).not.toBe(f.homeRegistry);
      ctx.piece({ id: 'region.deck', name: 'Deck', category: 'props', file: 'runtime/index.ts', colliders: [{ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 0.5, hz: 1 }] });
    }
    override kit(ctx: ShardContext): void {
      f.calls.push('trusted.kit');
      ctx.rows.spawnTable({ id: 'regional.spawn', table: { mode: 'each', rows: [{ item: { kind: 'boar' }, weight: 1 }] } });
      const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing local runtime');
      rt.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), rifle: null, secondary: null });
    }
    override play(ctx: ShardContext): void {
      f.calls.push('trusted.play');
      const world = ctx.game.runtime?.world;
      if (world === undefined || world === null || ctx.app.levelScope === null) throw new Error('Missing regional world');
      expect(world.game.levelScope).not.toBe(f.world.game.levelScope);
      expect(world.game.registrationScope).toBe(world.game.levelScope);
      const spawner = ctx.app.encounters.spawn('regional.spawn', ctx.app.levelScope, { create: value => value, retire: noop });
      expect(spawner.spawn({ tags: [] }, { x: 0, z: 0, yaw: 0 }, () => 0.5)).toEqual([{ kind: 'boar' }]);
      world.game.onUpdate(() => { ticks++; }, 'world.impacts');
      local = ctx.game.runtime?.play ?? null;
      if (local === null) throw new Error('Missing regional play host');
      expect(local.inventory).not.toBe(f.play.inventory); expect(local.progress).not.toBe(f.play.progress);
      expect(local.inventory.chunkId).toBe('pine-hollow');
      installEnteredRuntimeService(ctx, entry => { ctx.app.addSystem({ id: 'regional.test.tick', phase: 'update', run: noop }, entry); });
    }
  }
  const session = new HybridRuntimeSession(new Map([['pine-hollow', prepared.resident]]), [
    { slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => { f.calls.push('module'); return Promise.resolve({ default: Runtime }); } },
  ], f.scope);
  try {
    expect(prepared.checkpoint()).toBe(false); await session.prepare('pine-hollow');
    expect(f.calls).toEqual(['module']); expect(root?.visible).toBe(false); expect(f.host.hasPlayerMotor).toBe(false);
    for (let visit = 0; visit < 2; visit++) {
      prepared.loadout.interior(); expect(await session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' })).toBe(true);
      expect(root?.visible).toBe(true); expect(prepared.checkpoint()).toBe(true);
      expect(f.equipment.service.current).not.toBe(f.road.current);
      f.equipment.service.current.onFire?.(); expect(fire).toHaveBeenCalledTimes(visit + 1);
      expect(f.home.world.colliders.len()).toBe(0); expect(f.host.physics.world.colliders.len()).toBe(2);
      const seen = f.herd.mock.calls.length; // E452: the page loop ticks the regional herd only while entered
      expect(f.app.systemsByPhase().update.map(system => system.id)).toContain('grid.runtime.pine-hollow.animals');
      for (const system of f.app.systemsByPhase().update) system.run(1 / 60, visit);
      expect(f.herd.mock.calls.length).toBe(seen + 1);
      prepared.loadout.stow(); session.leave();
      expect(f.equipment.service.current).toBe(f.road.current);
      expect(root?.visible).toBe(false); expect(f.app.registry).toBe(f.homeRegistry);
      expect(Object.getOwnPropertyDescriptors(f.runtime)).toEqual(before);
      expect(f.app.systemsByPhase().update.map(system => system.id)).not.toContain('grid.runtime.pine-hollow.animals');
      for (let tick = 0; tick < 600; tick++) for (const system of f.app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(ticks).toBe(visit + 1); expect(f.herd.mock.calls.length).toBe(seen + 1); // parked on leave
    }
    expect(builds).toBe(1); expect(f.calls.filter(call => call === 'binding.enter')).toHaveLength(2);
    expect(f.calls.filter(call => call === 'trusted.play')).toHaveLength(1);
    const progress = vi.spyOn(progressSave, 'write').mockReturnValue(false), inventory = vi.spyOn(inventorySave, 'write');
    const saved = f.nativeCheckpoints(); expect(prepared.checkpoint()).toBe(false);
    expect(progress).toHaveBeenCalledOnce(); expect(inventory).toHaveBeenCalledOnce(); expect(f.nativeCheckpoints()).toBe(saved + 1);
    progress.mockRestore(); inventory.mockRestore(); f.refuse(); expect(prepared.checkpoint()).toBe(false);
  } finally { prepared.region.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
  expect(f.destroyed()).toBe(true); expect(f.world.game.scene.children).toHaveLength(0);
  expect(f.homeRegistry.pieces).toHaveLength(0); expect(f.allocator.entries()).toEqual([]);
  expect(Object.getOwnPropertyDescriptors(f.runtime)).toEqual(before);
});

it('disposes a real destination admitted after its owner leaves without running a world stage', async () => {
  const f = fixture(); let finish = noop, disposed = 0;
  const barrier = new Promise<void>(resolve => { finish = resolve; });
  const factory = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, prepareFoundation: async () => {
    await barrier;
    return { region: { host: f.host, dispose: () => { disposed++; f.host.dispose(); } },
      ground: { heightAt: () => 0, waterSurfaceAt: () => null },
      world: () => { throw new Error('Late admission must not build a world'); }, enter: noop,
      afterKit: () => Promise.reject(new Error('Late admission must not build creatures')), checkpoint: () => false,
    };
  } });
  const pending = factory(f.request);
  f.scope.dispose(); finish();
  await expect(pending).rejects.toThrow('left during foundation admission');
  expect(disposed).toBe(1); expect(f.world.game.scene.children).toHaveLength(0);
  f.home.dispose(); f.claim.release(); expect(f.allocator.entries()).toEqual([]);
});

it('parents a newly admitted neighbour at the page root while another region is entered', async () => {
  const f = fixture(), entered = f.scope.child('entered-other-region'), other = new Scene();
  f.world.game.rootScene.add(other);
  f.world.game.bindScene(other, entered);
  expect(f.world.game.scene).toBe(other);
  try {
    const prepared = await f.regional(f.request);
    const root = f.world.game.rootScene.children.find(child => child !== other);
    expect(root).toBeInstanceOf(Group);
    expect(other.children).toEqual([]);
    entered.dispose(); other.visible = false; f.world.game.rootScene.remove(other);
    expect(f.world.game.scene).toBe(f.world.game.rootScene);
    expect(root?.parent).toBe(f.world.game.rootScene);
    prepared.region.dispose();
  } finally { f.scope.dispose(); f.home.dispose(); f.claim.release(); }
  expect(f.world.game.rootScene.children).toEqual([]);
  expect(f.allocator.entries()).toEqual([]);
});


function addBoar(animals: AnimalManager, id: string): Animal {
  const model = animals.factory.model('boar');
  const animal = new Animal(animals.factory.instantiate(model, 0.5), model, 0.5, 1, id);
  animal.position.set(0, 0, 5); animals.animals.push(animal); return animal;
}
function emptyKit(ctx: ShardContext): void {
  const runtime = ctx.game.runtime; if (runtime === undefined) throw new Error('Missing regional runtime');
  runtime.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), rifle: null, secondary: null });
}

it('keeps lazy native creature hitboxes and motors resident across two entered updates and 600 parked ticks', async () => {
  const f = fixture(), animal = addBoar(f.animals, 'resident.boar');
  const bodies = new CreatureBodies<Animal>(f.host.physics);
  f.herd.mockImplementation(() => { bodies.sync(f.animals.animals, new Vector3()); });
  class Runtime extends ShardPlugin { override kit(ctx: ShardContext): void { emptyKit(ctx); } }
  const prepared = await f.regional(f.request);
  const session = new HybridRuntimeSession(new Map([['pine-hollow', prepared.resident]]), [
    { slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) },
  ], f.scope);
  let handles: number[] = [];
  try {
    for (let visit = 0; visit < 2; visit++) {
      expect(await session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' })).toBe(true);
      for (const system of f.app.systemsByPhase().update) system.run(1 / 60, visit);
      f.host.physics.step();
      expect(animal.motor).not.toBeNull(); expect(bodies.bodies).toBe(1);
      animal.motor?.move(animal.position, { x: 0.01, y: 0, z: 0 }, false);
      const current: number[] = []; f.host.physics.world.forEachCollider(collider => { current.push(collider.handle); }); current.sort((a, b) => a - b);
      if (visit === 0) handles = current; else expect(current).toEqual(handles);
      const calls = f.herd.mock.calls.length; session.leave();
      expect(f.host.physics.world.colliders.len()).toBe(handles.length);
      for (let tick = 0; tick < 600; tick++) for (const system of f.app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(f.herd.mock.calls).toHaveLength(calls);
      for (const handle of handles) expect(f.host.physics.world.colliders.contains(handle)).toBe(true);
    }
  } finally { prepared.region.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
  expect(Object.values(f.scope.census).every(value => value === 0)).toBe(true);
  expect(f.allocator.entries()).toEqual([]);
});

it('restores a durable play-created creature only after the complete trusted herd exists, before readiness', async () => {
  const local = new MemoryStorage();
  for (let visit = 0; visit < 2; visit++) {
    const continuation = regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-hollow', shard: 'pine-hollow' }, 1);
    const f = fixture(continuation); addBoar(f.animals, 'initial.boar');
    let encounter: Animal | undefined;
    class Runtime extends ShardPlugin {
      override kit(ctx: ShardContext): void { emptyKit(ctx); }
      override play(): void { encounter = addBoar(f.animals, 'play.encounter'); }
    }
    const prepared = await f.regional(f.request);
    const session = new HybridRuntimeSession(new Map([['pine-hollow', prepared.resident]]), [
      { slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) },
    ], f.scope);
    try {
      expect(await session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' })).toBe(true);
      expect(session.state().ready).toBe(true);
      if (encounter === undefined) throw new Error('Trusted play did not create encounter');
      if (visit === 0) { encounter.hp -= 1; encounter.position.x = 12; }
      else { expect(encounter.hp).toBe(encounter.maxHp - 1); expect(encounter.position.x).toBe(12); }
      expect(prepared.checkpoint()).toBe(true); session.leave();
    } finally { prepared.region.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
    expect(f.allocator.entries()).toEqual([]);
  }
});

it('refuses every checkpoint after failed strict restore without replacing the last complete roster', async () => {
  const local = new MemoryStorage(), continuation = regionalRuntimeCheckpoint(new SaveStore({ local, session: null }), { id: 'pine-hollow', shard: 'pine-hollow' }, 1);
  const f = fixture(continuation); addBoar(f.animals, 'initial.boar'); addBoar(f.animals, 'missing.encounter');
  expect(continuation.checkpoint(f.animals)).toBe(true);
  const wire = (): (string | null)[] => Array.from({ length: local.length }, (_, index) => {
    const key = local.key(index); return key === null ? null : local.getItem(key);
  });
  const before = wire(); f.animals.animals.pop();
  class Runtime extends ShardPlugin { override kit(ctx: ShardContext): void { emptyKit(ctx); } }
  const prepared = await f.regional(f.request), session = new HybridRuntimeSession(new Map([['pine-hollow', prepared.resident]]), [
    { slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) },
  ], f.scope);
  try {
    await expect(session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' })).rejects.toThrow('Missing stable runtime creature');
    expect(session.state().ready).toBe(false); expect(prepared.checkpoint()).toBe(false);
    expect(f.nativeCheckpoints()).toBe(0); expect(wire()).toEqual(before);
    session.leave(); expect(prepared.checkpoint()).toBe(false); expect(wire()).toEqual(before);
  } finally { prepared.region.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
  expect(wire()).toEqual(before); expect(f.allocator.entries()).toEqual([]);
});


it('keeps entered gameplay and checkpoint unready until the real page warm-up finishes', async () => {
  const f = fixture(); let release = noop;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const warm = vi.spyOn(f.world.game, 'warmEnteredFrame').mockReturnValue(barrier);
  class Runtime extends ShardPlugin { override kit(ctx: ShardContext): void { emptyKit(ctx); } }
  const prepared = await f.regional(f.request);
  const session = new HybridRuntimeSession(new Map([['pine-hollow', prepared.resident]]), [
    { slug: 'pine-hollow', entry: 'runtime/index.ts', load: () => Promise.resolve({ default: Runtime }) },
  ], f.scope);
  try {
    const pending = session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' });
    for (let tick = 0; tick < 100 && warm.mock.calls.length === 0; tick++) await Promise.resolve();
    expect(warm).toHaveBeenCalledOnce();
    expect(session.state().ready).toBe(false); expect(prepared.checkpoint()).toBe(false);
    expect(session.timings().current?.hook).toBe('afterPlay');
    release(); expect(await pending).toBe(true);
    expect(session.state().ready).toBe(true); expect(prepared.checkpoint()).toBe(true);
    session.leave(); expect(await session.enter({ instance: 'pine-hollow', slug: 'pine-hollow' })).toBe(true);
    expect(warm).toHaveBeenCalledOnce(); // Retained programs are reused without replaying the trusted hooks.
  } finally { release(); prepared.region.dispose(); f.scope.dispose(); f.home.dispose(); f.claim.release(); }
});
