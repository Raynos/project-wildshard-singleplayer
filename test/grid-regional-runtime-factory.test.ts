// oxlint-disable-next-line import/no-nodejs-modules -- This lifecycle fixture uses the production native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { Group, Scene, Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { withOwner } from '../src/engine/app/ownership';
import { createLevelInstallation } from '../src/engine/level/installation';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { AnimalManager } from '../src/engine/entities/AnimalManager';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { WorldRegistry } from '../src/engine/world/registry';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type RegionalRuntimeRequest } from '../src/game/grid/regionalRuntime';
import { HybridRuntimeSession } from '../src/game/shardfile/hybrid';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
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
import { SIM_LEVEL } from './fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const noop = (): void => undefined;

function fixture() {
  const app = new App(), scope = app.engineScope.child('grid.page'), scene = new Scene(), home = new Physics(rapier);
  const homeRegistry = new WorldRegistry(); app.registryValue = homeRegistry; app.levelScope = scope;
  // Renderer, controls and unbuilt scene fields are explicit test doubles. Only composition/lifecycle is claimed here;
  // the native destination, registry, equipment, saves, scopes and entered systems below are real implementations.
  const game = { scene, renderer: {}, levelScope: scope } as Game;
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
  const request: RegionalRuntimeRequest = { cell: { instance: 'pine-hollow', slug: 'pine-hollow', cell: [1, 0], origin: { x: 555, y: 0, z: 0 } },
    admitted, manifest: PINE_HOLLOW, allocator, claim, scope, page: { world, play, context } };
  let nativeCheckpoints = 0, nativeDurable = true, destroyed = false;
  const host = createSimHost({ ...SIM_LEVEL, id: 'pine-hollow', entities: [], quests: [], ground: { size: 500, height: 0 } }, { rapier, playerBody: false });
  const region = { host, dispose: () => { destroyed = true; host.dispose(); } };
  const animals = new AnimalManager(scene, world.sky, world.forest, { style: 'toon', render: { waitForModels: false, lowPoly: true, furRim: false, tintRange: 0, oneMaterial: true } });
  const calls: string[] = [], regional = createRegionalRuntimeFactory({ home: { x: 0, z: 0 }, prepareFoundation: prepared => Promise.resolve({ region,
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
  return { app, scope, home, homeRegistry, world, play, runtime, request, claim, allocator, host, calls, regional,
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
  let builds = 0, ticks = 0, local: ShardPlayHost | null = null;
  class Runtime extends ShardPlugin {
    override world(ctx: ShardContext): void {
      builds++; f.calls.push('trusted.world');
      expect(ctx.app.registry).not.toBe(f.homeRegistry);
      ctx.piece({ id: 'region.deck', name: 'Deck', category: 'props', file: 'runtime/index.ts', colliders: [{ kind: 'box', x: 0, y: 1, z: 0, hx: 1, hy: 0.5, hz: 1 }] });
    }
    override kit(ctx: ShardContext): void {
      f.calls.push('trusted.kit');
      const rt = ctx.game.runtime; if (rt === undefined) throw new Error('Missing local runtime');
      rt.buildEquipment = () => Promise.resolve({ primary: new EmptyEquipment(), rifle: null, secondary: null });
    }
    override play(ctx: ShardContext): void {
      f.calls.push('trusted.play'); local = ctx.game.runtime?.play ?? null;
      if (local === null) throw new Error('Missing regional play host');
      expect(local.inventory).not.toBe(f.play.inventory); expect(local.progress).not.toBe(f.play.progress);
      expect(local.inventory.chunkId).toBe('pine-hollow');
      installEnteredRuntimeService(ctx, entry => { ctx.app.addSystem({ id: 'regional.test.tick', phase: 'update', run: () => { ticks++; } }, entry); });
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
      expect(f.home.world.colliders.len()).toBe(0); expect(f.host.physics.world.colliders.len()).toBe(2);
      for (const system of f.app.systemsByPhase().update) system.run(1 / 60, visit);
      prepared.loadout.stow(); session.leave();
      expect(root?.visible).toBe(false); expect(f.app.registry).toBe(f.homeRegistry);
      expect(Object.getOwnPropertyDescriptors(f.runtime)).toEqual(before);
      for (let tick = 0; tick < 600; tick++) for (const system of f.app.systemsByPhase().update) system.run(1 / 60, tick);
      expect(ticks).toBe(visit + 1);
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
