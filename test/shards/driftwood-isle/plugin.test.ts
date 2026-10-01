import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App, type LevelDriver, type World } from '#engine';
import { shardContext, toLevelSpec, type GameServices, type ShardRuntime } from '#game';
import manifest, { OCEAN } from '#shards/driftwood-isle/manifest';
import { DriftwoodPlugin } from '#shards/driftwood-isle/plugin';
import { driftwoodWorld, noDriftwoodWorld } from '#shards/driftwood-isle/world/build';

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
    const calls: World[] = [];
    const plugin = new DriftwoodPlugin((world) => { calls.push(world); return Promise.resolve(built); });
    const game: GameServices = { runtime, shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } };
    loaded.add(app);
    expect(driftwoodWorld(runtime)).toEqual(noDriftwoodWorld());
    await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)) });
    expect(calls).toEqual([bootstrapped]);
    expect(driftwoodWorld(runtime)).toBe(built);
    expect(app.world.water.sea?.level).toBe(OCEAN.level);
    expect(app.world.water.surfaceAt(0, -194)).toBeCloseTo(OCEAN.level, 0);
    await app.unloadLevel(); loaded.delete(app);
    expect(app.world.water.sea).toBeNull();
  });

});
