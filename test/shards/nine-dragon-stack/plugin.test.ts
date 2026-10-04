import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { App, type LevelContext, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, type GameServices } from '#game';
import manifest from '#shards/nine-dragon-stack/manifest';
import { NdPlugin } from '#shards/nine-dragon-stack/plugin';
import { ndRuntime } from '#shards/nine-dragon-stack/runtime';
import { Shared } from '#shards/nine-dragon-stack/look/style';
import { InstanceCuller } from '#shards/nine-dragon-stack/world/cull';
import { fragmentColliders, fragmentFloor, fragmentGrappleGuard } from '#shards/nine-dragon-stack/world/colliders';
import type { NineDragonWorld } from '#shards/nine-dragon-stack/world/build';
import { FakeGame } from '../../fake/FakeGame';
import { WorldRegistry } from '#engine-internal/world/registry';

const noop = (): void => { /* No GPU work in this node contract. */ };
const loaded = new Set<App>();
afterEach(async () => { for (const app of loaded) await app.unloadLevel(); loaded.clear(); });

function setup(): { app: App; world: NineDragonWorld; plugin: NdPlugin; context: (ctx: LevelContext) => ReturnType<typeof shardContext>; fake: FakeGame } {
  const app = new App(), fake = new FakeGame();
  app.registryValue = new WorldRegistry();
  app.render = fake.asGame(); app.scene = fake.scene;
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop,
    kit: noop, loadout: noop, play: noop, finish: noop };
  app.levelDriver = driver;
  app.levelAdapters.playground = () => noop;
  const world: NineDragonWorld = { root: new Group(), shared: new Shared(), ctx: { hooks: [] },
    update: vi.fn<() => void>(), cull: vi.fn<() => void>(), culler: new InstanceCuller() };
  const plugin = new NdPlugin(() => Promise.resolve({ world, camera: fake.camera }));
  const game: GameServices = { shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
  loaded.add(app);
  return { app, world, plugin, fake, context: (ctx) => shardContext(ctx, manifest, game) };
}

describe('Nine Dragon world hook', () => {
  it('registers the same four pieces and update system, and releases the runtime on unload', async () => {
    expect(() => ndRuntime()).toThrow('world hook');
    const { app, world, plugin, fake, context } = setup();
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(context(ctx)) });
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['nds-floors', 'nds-fronts', 'nds-grapple-guard', 'nds-crossings']);
    const floors = app.registry.get('nds-floors');
    expect(floors).toMatchObject({ name: 'Lantern Square', category: 'buildings', surface: 'stone', solidFloor: true });
    expect(floors?.object).toBe(world.root); expect(floors?.floor).toBe(fragmentFloor);
    expect(floors?.colliders).toEqual(fragmentColliders().floors);
    expect(app.registry.get('nds-fronts')?.colliders).toEqual(fragmentColliders().fronts);
    const guard = app.registry.get('nds-grapple-guard');
    expect(guard?.colliders).toEqual(fragmentGrappleGuard());
    expect(app.events.census().listeners).toBe(1);
    app.events.emit('explore.turntable', { on: true, key: { x: 1, y: 0, z: 0 } });
    app.events.flush('update');
    expect(world.shared.u.uDry.value).toBe(1);
    app.events.emit('explore.turntable', { on: false });
    app.events.flush('update');
    const runtime = ndRuntime(); expect(runtime.world).toBe(world); expect(runtime.camera).toBe(fake.camera);
    expect(guard?.active?.()).toBe(true); runtime.guardOpen = true; expect(guard?.active?.()).toBe(false);
    const system = app.systemsByPhase().update[0];
    expect(system).toMatchObject({ id: 'shard.nd.world', phase: 'update', after: ['engine.player.update'] });
    system?.run(0.1, 7); expect(world.update).toHaveBeenCalledWith(7, fake.camera);
    runtime.cull(); expect(world.cull).toHaveBeenCalledWith(fake.camera);
    const ambient = world.shared.u.uLpAmb.value;
    runtime.specimenLight(true); expect(world.shared.u.uLpAmb.value).toBeGreaterThan(ambient);
    await app.unloadLevel();
    expect(app.events.census().listeners).toBe(0);
    expect(world.shared.u.uLpAmb.value).toBe(ambient); expect(runtime.guardOpen).toBe(false);
    expect(app.registry.pieces).toEqual([]); expect(app.systemsByPhase().update).toEqual([]);
    expect(() => ndRuntime()).toThrow('world hook');
    runtime.cull(); expect(world.cull).toHaveBeenCalledOnce();
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(context(ctx)) });
    expect(ndRuntime()).not.toBe(runtime);
  });

  it.each(['world', 'kit', 'play'] as const)('releases the world when the %s hook throws', async (stage) => {
    const { app, plugin, context } = setup();
    const hooks = {
      world: async (ctx: LevelContext): Promise<void> => { await plugin.world(context(ctx)); },
      [stage]: async (ctx: LevelContext): Promise<void> => {
        if (stage === 'world') await plugin.world(context(ctx));
        throw new Error(`fixture ${stage}`);
      },
    };
    await expect(app.loadLevel(toLevelSpec(manifest), hooks)).rejects.toThrow(`fixture ${stage}`);
    expect(app.registry.pieces).toEqual([]); expect(app.systemsByPhase().update).toEqual([]);
    expect(() => ndRuntime()).toThrow('world hook');
  });
});
