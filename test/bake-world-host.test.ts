// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- Capture witnesses use original committed native bytes.
import { readFileSync } from 'node:fs';
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
import { Terrain, terrainChunkGeometry } from '../src/engine/world/Terrain';
import { bakedSamplers, bakedUndergrowth } from '../src/engine/world/BakedTerrain';
import { heightAt } from '../src/engine/world/Heightfield';
import { prepareNativeTerrain } from '../scripts/bake/nativeWorld.mjs';

const source = () => emptyShardfileSource(emptyShardfile({ slug: 'bake-host-fixture', name: 'Bake host fixture', author: 'Fixture', revision: 1, seed: 73 }));
const root = cwd();

describe('shared authored world capture guard', () => {
  it('refuses mismatched native identity and unbounded placement data before changing the selected samplers', async () => {
    const bytes = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), seed = view.getUint32(16, true);
    const before = heightAt(37.5, -17.5);
    await expect(prepareNativeTerrain({ ...source(), seed: seed ^ 1 }, { root, bytes })).rejects.toThrow('original WSTR256 terrain and seed');
    const trailer = new Uint8Array(24 + 256 ** 2 * 8 + 24); trailer.set(bytes.subarray(0, trailer.length));
    const tail = new DataView(trailer.buffer), end = 24 + 256 ** 2 * 8;
    tail.setUint32(end, 0x4c505357, true); tail.setUint32(end + 4, 1, true); tail.setUint32(end + 12, 0xffffffff, true);
    await expect(prepareNativeTerrain({ ...source(), seed }, { root, bytes: trailer })).rejects.toThrow('placement bounds');
    expect(heightAt(37.5, -17.5)).toBe(before);
    expect(app.physics).toBeNull(); expect(app.levelScope).toBeNull();
  });

  it('selects original native samplers and placement decisions before the real terrain and authored world', async () => {
    const bytes = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
    const seed = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16, true);
    const manifest = { ...source(), seed }, { sky } = fakeWorld();
    const material = new MeshStandardMaterial();
    let terrain: Terrain | undefined, sampled = 0;
    const result = await visitAuthoredWorld({ ...manifest, load: () => Promise.resolve({ default: class {
      world(): void { sampled = heightAt(37.5, -17.5); }
    } }) }, { root, sky, element: () => document.createElement('canvas'), nativeTerrain: bytes,
      createTerrain: ({ ground, native, forest }) => {
        if (native === null) throw new Error('Missing original native payload');
        expect(ground).toEqual(native.heights);
        expect(bakedUndergrowth()).toEqual(native.undergrowth);
        expect(heightAt(37.5, -17.5)).toBe(bakedSamplers(native).heightAt(37.5, -17.5));
        terrain = new Terrain(); terrain.mesh = new Mesh(terrainChunkGeometry(bakedSamplers(native)), material);
        terrain.applyCanopy(forest.canopyMap);
        const positions: unknown = terrain.mesh.geometry.getAttribute('position');
        if (!(positions instanceof BufferAttribute)) throw new Error('Missing actual terrain positions');
        expect(positions.count).toBe(256 ** 2);
        const triangles = terrain.mesh.geometry.index?.count ?? 0;
        expect(terrain.punch((ax, _ay, az) => ax > 200 && az > 200)).toBeGreaterThan(0);
        expect(terrain.mesh.geometry.index?.count).toBeLessThan(triangles);
        return terrain;
      },
      visit: ({ terrain: captured }) => { expect(captured).toBe(terrain); expect(sampled).toBe(heightAt(37.5, -17.5)); },
    });
    expect(result.ground).toBeNull(); // This fixture is render-only, with the collision owner declared separately.
    terrain?.mesh.geometry.dispose(); material.dispose();
    expect(app.physics).toBeNull(); expect(app.levelScope).toBeNull();
  });

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
