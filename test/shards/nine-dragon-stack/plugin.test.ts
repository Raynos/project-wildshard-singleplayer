import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { App } from '../../../src/engine/app/app';
import type { LevelContext } from '../../../src/engine/level/context';
import type { LevelDriver } from '../../../src/engine/level/load';
import { shardContext, type GameServices } from '../../../src/game/shard/context';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { resolveLevelBounds, type ShardPlayHooks } from '../../../src/game/shard/runtime';
import manifest from '../../../src/shards/nine-dragon-stack/manifest';
import { NdPlugin } from '../../../src/shards/nine-dragon-stack/plugin';
import { ndRuntime } from '../../../src/shards/nine-dragon-stack/runtime/state';
import { Shared } from '../../../src/shards/nine-dragon-stack/look/style';
import { InstanceCuller } from '../../../src/shards/nine-dragon-stack/world/cull';
import { fragmentColliders, fragmentGrappleGuard } from '../../../src/shards/nine-dragon-stack/world/colliders';
import type { NineDragonWorld } from '../../../src/shards/nine-dragon-stack/world/build';
import { FakeGame } from '../../fake/FakeGame';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { entryDeckColliders, entryDeckFloor, portalFloorRows } from '../../../src/shards/nine-dragon-stack/world/floorRows';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { withDecks } from '../../../src/shards/nine-dragon-stack/world/install';
import { Y0 } from '../../../src/shards/nine-dragon-stack/layout';

/** SF8c (G224): the pieces the portal links' declared floors register as (world/install.ts) */
const PIECE_OF = (id: string): string => `nds-${id}`;
const PORTAL_PIECES = ['deck.north', 'deck.east', 'deck.south', 'deck.west', 'square'].map(PIECE_OF);

const noop = (): void => { /* No GPU work in this node contract. */ };
const loaded = new Set<App>();
const built: boolean[] = [];
afterEach(async () => { for (const app of loaded) await app.unloadLevel(); loaded.clear(); });

function setup(): { app: App; world: NineDragonWorld; plugin: NdPlugin; context: (ctx: LevelContext) => ReturnType<typeof shardContext>; fake: FakeGame; hooks: ShardPlayHooks } {
  const app = new App(), fake = new FakeGame();
  app.registryValue = new WorldRegistry();
  app.render = fake.asGame(); app.scene = fake.scene;
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop,
    kit: noop, loadout: noop, play: noop, finish: noop };
  app.levelDriver = driver;
  app.levelAdapters.playground = () => noop;
  app.levelAdapters.debugRow = () => noop;
  const world: NineDragonWorld = { root: new Group(), shared: new Shared(), ctx: { hooks: [] },
    update: vi.fn<() => void>(), cull: vi.fn<() => void>(), culler: new InstanceCuller() };
  const plugin = new NdPlugin((_ctx, caps) => { built.push(caps); return Promise.resolve({ world, camera: fake.camera }); });
  const hooks: ShardPlayHooks = {};
  const game: GameServices = { shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop }, runtime: { world: null, step: null, play: null, interactables: [], overhead: [], objects: {}, hooks, viewer: () => fake.camera.position, horizonVeil: null } };
  loaded.add(app);
  return { app, world, plugin, fake, hooks, context: (ctx) => shardContext(ctx, manifest, game) };
}

describe('Nine Dragon world hook', () => {
  it('registers the same four pieces and update system, and releases the runtime on unload', async () => {
    expect(() => ndRuntime()).toThrow('world hook');
    const { app, world, plugin, fake, context } = setup();
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(context(ctx)) });
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['nds-floors', ...PORTAL_PIECES, 'nds-fronts', 'nds-grapple-guard', 'nds-crossings']);
    const floors = app.registry.get('nds-floors');
    expect(floors).toMatchObject({ name: 'Lantern Square', category: 'buildings', surface: 'stone', solidFloor: true });
    expect(floors?.object).toBe(world.root); expect(floors?.floor).toBe(withDecks);
    const fragment = fragmentColliders();
    expect(floors?.colliders).toEqual(fragment.floors.filter((d) => d !== fragment.square));
    // SF8c (G224): the floors the portal links bind are their own pieces, colliding as the declared rows under their ids
    for (const row of portalFloorRows()) expect(app.registry.get(PIECE_OF(row.id))).toMatchObject({ colliders: row.shapes, colliderOwner: row.id, surface: 'stone' });
    expect(portalFloorRows()).toEqual(source.props?.colliders);
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

  it('SF51-g / G224: the decks are always built (no row), the whole cell is in bounds for each session, the manifest unchanged', async () => {
    const one = setup();
    built.length = 0;
    await one.app.loadLevel(toLevelSpec(manifest), { world: (ctx) => one.plugin.world(one.context(ctx)) });
    // standalone (no grid cube): the decks get their balustrade caps
    expect(built).toEqual([true]);
    const floors = one.app.registry.get('nds-floors');
    expect(one.app.registry.pieces).toHaveLength(4 + PORTAL_PIECES.length);
    expect(floors?.floor).toBe(withDecks);
    expect(one.app.registry.get('nds-fronts')?.colliders).toEqual(fragmentColliders().fronts);
    expect(withDecks(0, 240)).toBe(0); expect(withDecks(5, 0)).toBe(Y0); expect(withDecks(6, -200)).toBeUndefined();
    expect(toLevelSpec(manifest).bounds?.floor).toBe(Y0 - 100);
    // the whole cell; with no player yet (and under the fragment) the fall net is the fragment's own
    expect(resolveLevelBounds(toLevelSpec(manifest).bounds, one.hooks)).toEqual({ x0: -250, x1: 250, z0: -250, z1: 250, floor: Y0 - 100 });
    await one.app.unloadLevel();
  });

  it('SF51-g: each deck carries the 8 x 15 m socket footprint flat at y = 0 with its side walls outside the opening', () => {
    const boxes = entryDeckColliders().flatMap((c) => (c.kind === 'box' ? [c] : []));
    const rects = { north: [-4, 4, 235, 250], south: [-4, 4, -250, -235], east: [235, 250, -4, 4], west: [-250, -235, -4, 4] } as const;
    for (const [x0, x1, z0, z1] of Object.values(rects)) {
      for (let x = x0 + 0.125; x < x1; x += 0.25) for (let z = z0 + 0.125; z < z1; z += 0.25) {
        // the highest box top over the point: exactly the road
        const tops = boxes.filter((b) => Math.abs(x - b.x) <= b.hx && Math.abs(z - b.z) <= b.hz).map((b) => b.y + b.hy);
        expect(Math.max(...tops)).toBeCloseTo(0, 6);
        expect(entryDeckFloor(x, z)).toBe(0);
      }
    }
    // 16 deck boxes: a slab, two parapets and an end wall each (G224: no lift shaft)
    expect(boxes).toHaveLength(16);
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
