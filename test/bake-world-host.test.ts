// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Mesh, PlaneGeometry } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- The shared Node bake host resolves the repository's native engine modules.
import { cwd } from 'node:process';
import { visitAuthoredWorld } from '../scripts/bake/worldHost.mjs';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { emptyShardfile } from '../src/sdk/author';
import { fakeWorld } from './fake/world';
import { app } from '../src/engine/app/runtime';
import { Physics } from '../src/engine/physics/Physics';
import { configureLevel } from '../src/engine/level/selection';
import { toLevelSpec } from '../src/game/shard/spec';
import type { ShardContext } from '../src/game/shard/context';

const source = () => emptyShardfileSource(emptyShardfile({ slug: 'bake-host-fixture', name: 'Bake host fixture', author: 'Fixture', revision: 1, seed: 73 }));
const root = cwd();

describe('shared authored world capture guard', () => {
  it('refuses the navmesh facade for geometry capture before it can create a world or invoke a model', async () => {
    const { sky } = fakeWorld();
    const manifest = source();
    let elements = 0, captures = 0;
    await expect(visitAuthoredWorld(manifest, {
      root: '/unused-capture-guard', sky, element: () => { elements++; throw new Error('Must not create a renderer host'); },
      visit: () => { captures++; },
    })).rejects.toThrow('real terrain builder');
    expect(elements).toBe(0); expect(captures).toBe(0);
  });

  it('disposes native physics on setup failure and unloads scoped pieces when capture rejects', async () => {
    const manifest = source(), { sky } = fakeWorld();
    configureLevel(toLevelSpec(manifest));
    const dispose = vi.spyOn(Physics.prototype, 'dispose');
    const previousDriver = app.levelDriver;
    await expect(visitAuthoredWorld(manifest, { root, sky, element: () => document.createElement('canvas'),
      createTerrain: () => { throw new Error('Terrain setup failed'); },
    })).rejects.toThrow('Terrain setup failed');
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(app.physics).toBeNull(); expect(app.render).toBeNull(); expect(app.levelDriver).toBe(previousDriver);
    let livePieces = 0, removed = 0;
    await expect(visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: class {
      world(ctx: ShardContext): void {
        ctx.piece({ id: 'bake-host-floor', name: 'Floor', category: 'ground', file: 'test/bake-world-host.test.ts',
          colliders: [{ kind: 'box', x: 0, y: -0.5, z: 0, hx: 2, hy: 0.5, hz: 2 }] });
        ctx.scope.onDispose(() => { removed++; });
      }
    } }) }, { root, sky, element: () => document.createElement('canvas'),
      createTerrain: () => ({ mesh: new Mesh(new PlaneGeometry(1, 1)), punch: () => 0 }),
      visit: (world) => { livePieces = world.registry.pieces.length; expect(world.physics).toBe(app.physics); throw new Error('Capture failed'); },
    })).rejects.toThrow('Capture failed');
    expect(livePieces).toBe(1); expect(removed).toBe(1);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(app.levelScope).toBeNull(); expect(app.registry.pieces).toHaveLength(0);
    expect(app.physics).toBeNull(); expect(app.render).toBeNull(); expect(app.levelDriver).toBe(previousDriver);
  });
});
