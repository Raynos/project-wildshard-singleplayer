import { shardContext, type GameServices } from '../../../src/game/shard/context';
import type { ShardRuntime } from '../../../src/game/shard/runtime';
import { toLevelSpec } from '../../../src/game/shard/spec';
import type { ShardWorld as World } from '../../../src/game/shard/world';
import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { App } from '../../../src/engine/app/app';
import type { World as EngineWorld } from '../../../src/engine/core/bootstrap';
import type { LevelDriver } from '../../../src/engine/level/load';
import manifest, { OCEAN } from '../../../src/shards/driftwood-isle/manifest';
import { DriftwoodPlugin } from '../../../src/shards/driftwood-isle/plugin';
import { driftwoodWorld, noDriftwoodWorld } from '../../../src/shards/driftwood-isle/world/build';
import { islandSystems } from '../../../src/shards/driftwood-isle/world/systems';

const noop = (): void => { /* no GPU work in this node contract */ };
const loaded = new Set<App>();
afterEach(async () => { for (const app of loaded) await app.unloadLevel(); loaded.clear(); });

describe('Driftwood world hook (E357 S4.1)', () => {
  it('has the sea (the manifest\'s ground.water, from level.data), hands the built world to the shell and drops the sea with the level', async () => {
    const app = new App();
    const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };
    app.levelDriver = driver;
    // the hook reads only `world` and `viewer` off the shell; the stub builder never touches the bootstrapped world
    const bootstrapped = {} as World;
    const runtime: ShardRuntime = { world: bootstrapped, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
    const built = { ...noDriftwoodWorld(), palmSpecs: [] };
    // G173 (E450): the world hook always frees the built world's static JS vertex copies as they upload (no row)
    const hutMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    Object.assign(built, { hut: { group: hutMesh } });
    const calls: EngineWorld[] = [];
    const plugin = new DriftwoodPlugin((world) => { calls.push(world); return Promise.resolve(built); });
    const game: GameServices = { runtime, shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
    loaded.add(app);
    expect(driftwoodWorld(runtime)).toEqual(noDriftwoodWorld());
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)) });
    expect(calls).toEqual([bootstrapped]);
    expect(driftwoodWorld(runtime)).toBe(built);
    for (const a of Object.values(hutMesh.geometry.attributes)) if (a instanceof BufferAttribute) a.onUploadCallback();
    expect(hutMesh.geometry.getAttribute('normal').array.length).toBe(0);
    expect(hutMesh.geometry.getAttribute('position').array.length).toBeGreaterThan(0);
    expect(app.world.water.sea?.level).toBe(OCEAN.level);
    expect(app.world.water.surfaceAt(0, -194)).toBeCloseTo(OCEAN.level, 0);
    await app.unloadLevel(); loaded.delete(app);
    expect(app.world.water.sea).toBeNull();
  });

  it('registers the island\'s per-frame systems in main.ts\'s old order, before the world updater, and drops them with the level', async () => {
    const app = new App();
    const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: noop, world: noop, kit: noop, loadout: noop, play: noop, finish: noop };
    app.levelDriver = driver;
    const calls: string[] = [];
    const part = (name: string): { update: (dt: number) => void } => ({ update: () => { calls.push(name); } });
    const view = { player: { position: new Vector3(1, 2, 3) }, game: { alpha: 0.25 } };
    const deck = { awake: true };
    const parts = { ocean: part('ocean'), boat: part('boat'), palms: part('palms'), seabed: part('seabed'), cove: part('cove'), shrine: part('shrine'),
      gulls: { update: (_dt: number, at: Vector3): void => { calls.push(`gulls@${at.x}`); } },
      bridge: { setPoses: (d: { awake: boolean }, alpha: number): void => { calls.push(`bridge:${String(d === deck)}@${alpha}`); } }, bridgeDeck: deck };
    const runtime: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
    const game: GameServices = { runtime, shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
    loaded.add(app);
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => { islandSystems(shardContext(ctx, manifest, game), view, parts); } });
    const update = app.systemsByPhase().update;
    expect(update.map((s) => s.id)).toEqual(['shard.driftwood.ocean', 'shard.driftwood.boat', 'shard.driftwood.palms', 'shard.driftwood.gulls',
      'shard.driftwood.bridge.pose', 'shard.driftwood.seabed', 'shard.driftwood.cove', 'shard.driftwood.shrine']);
    for (const s of update) expect(s.before).toEqual(['main.world']);
    for (const s of update) s.run(1 / 60, 0);
    expect(calls).toEqual(['ocean', 'boat', 'palms', 'gulls@1', 'bridge:true@0.25', 'seabed', 'cove', 'shrine']);
    await app.unloadLevel(); loaded.delete(app);
    expect(app.systemsByPhase().update).toEqual([]);
  });
});
