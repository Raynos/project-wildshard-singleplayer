// oxlint-disable-next-line import/no-nodejs-modules -- Read emitted byte fixtures and own disposable content products.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture directory only.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths only.
import { join } from 'node:path';
import * as v from 'valibot';
import { expect, it, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { contentHash, validateProject } from '@wildshard/sdk/project';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { TerrainSchema } from '@wildshard/format/terrain';
import { ShardfileSchema, type Shardfile } from '@wildshard/format/shardSchema';
import { assetCost, validateTerrainAssets } from '@wildshard/format/product';
import { encodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { Scope } from '../src/engine/app/scope';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { bindRuntimeTerrain } from '../src/game/shardfile/runtimeWorld';
import { withoutRuntimeRows } from '../src/game/plugin/headless';
import { clientWorld } from '../src/game/shardfile/clientWorld';
import { clientRingCatalogue } from '../src/game/shardfile/clientRings';
import template from '../src/shards/_template/shard.config';
import pastel from '../src/shards/pastel-plain/shard.config';
import ink from '../src/shards/ink-cel-valley/shard.config';
import signal from '../src/shards/sunscar-dunes/shard.config';
import { shardContent } from '../scripts/shard-platform-content.mjs';

function nativeBytes(): Uint8Array {
  const resolution = 256, count = resolution ** 2, wire = new Uint8Array(24 + count * 8), view = new DataView(wire.buffer);
  wire.set([0x57, 0x53, 0x54, 0x52]); view.setUint32(4, 1, true); view.setUint32(8, resolution, true);
  view.setFloat32(12, 500, true); view.setUint32(16, 123, true);
  for (let i = 0; i < count; i++) { view.setFloat32(24 + i * 4, i === 128 * resolution + 128 ? 3.5 : 0, true); wire[24 + count * 4 + i * 4] = 255; }
  return wire;
}
function fixture(): { source: Shardfile; assets: Map<string, Uint8Array>; native: Uint8Array } {
  const native = nativeBytes(), grid = readNativeTerrain(native).grid;
  const bytes = encodeTerrainTile({ resolution: grid.res, x: -250, z: -250, size: grid.size, heights: grid.heights, splat: grid.splat });
  const hash = contentHash(bytes), file = { hash, kind: 'binary', critical: true, ...assetCost('binary', bytes), compressed: bytes.length, dependencies: [] };
  const base = emptyShardfile({ slug: 'query-fixture', name: 'Query fixture', author: 'Test', revision: 1, seed: 123 });
  const source = v.parse(ShardfileSchema, { ...base, terrain: { version: 1, form: 'query', tiles: [], sampling: { law: 'bilinear', file: hash, normalEpsilon: 1.25, datum: 0 } },
    runtime: { entry: 'runtime/index.ts', binds: ['terrain'] }, budgets: { ...base.budgets, sim: { resident: 2_000_000, compressed: 1_000_000 } }, serverBudget: { tickMicros: 1000, memory: 2_000_000, entities: 1, commandsPerTick: 1 }, files: [file], critical: [hash] });
  return { source, assets: new Map([[hash, bytes]]), native };
}
const reader = (source: Shardfile, assets: Map<string, Uint8Array>): ClientAssets => new ClientAssets(source, assets, {
  base: 'https://query.test/', firstParty: true, offline: true, hash: bytes => Promise.resolve(contentHash(bytes)), fetch: () => Promise.reject(new Error('Unexpected download')),
});

it('admits only runtime-bound zero-tile sampling, deriving its critical reference and charging no GPU bytes', () => {
  const { source, assets } = fixture(), terrain = source.terrain;
  if (terrain?.form !== 'query') throw new Error('Missing query form');
  expect(terrain.collider).toBe(terrain.sampling.file);
  expect(() => validateProject(source, assets)).not.toThrow();
  expect(source.files[0]).toMatchObject({ gpu: 0, draws: 0, triangles: 0 });
  for (const runtime of [null, { entry: 'runtime/index.ts' }, { entry: 'runtime/index.ts', binds: ['state'] }]) {
    expect(() => v.parse(ShardfileSchema, { ...source, runtime })).toThrow();
  }
  expect(() => v.parse(TerrainSchema, { ...terrain, sampling: undefined })).toThrow();
  expect(() => v.parse(TerrainSchema, { ...terrain, tiles: [{ lod: 0, x: 0, z: 0, file: terrain.collider }] })).toThrow();
  expect(() => v.parse(ShardfileSchema, { ...source, critical: [] })).toThrow();
  expect(() => validateTerrainAssets(terrain, new Map(), source)).toThrow();
  const wrong = new Map(assets); wrong.set(terrain.sampling.file, encodeTerrainTile({ resolution: 257, x: -250, z: -250, size: 500, heights: new Float32Array(257 ** 2) }));
  expect(() => validateTerrainAssets(terrain, wrong, source)).toThrow(/sampling profile/u);
  const collider = encodeTerrainTile({ resolution: 257, x: -250, z: -250, size: 500, heights: new Float32Array(257 ** 2) });
  const ref = contentHash(collider); assets.set(ref, collider);
  expect(() => validateTerrainAssets({ ...terrain, collider: ref }, assets, { ...source, critical: [...source.critical, ref] })).not.toThrow();
  expect(() => validateTerrainAssets({ ...terrain, collider: ref }, assets, source)).toThrow(/critical heightfield/u);
});

it('binds native queries while the runtime, data client and ring catalogue allocate no terrain views', async () => {
  const { source, assets, native } = fixture(), scope = new Scope('query-only'), view = vi.fn(() => { throw new Error('Unexpected terrain draw'); });
  try {
    const queries = readNativeTerrain(native), bound = await bindRuntimeTerrain({ scope }, source, { assets: reader(source, assets), x: 0, z: 0, terrain: view });
    for (const [x, z] of [[0, 0], [-249, 73], [300, -340]]) {
      expect(bound.ground.heightAt(x ?? 0, z ?? 0)).toBe(queries.heightAt(x ?? 0, z ?? 0));
      expect(bound.ground.normalAt(x ?? 0, z ?? 0)).toEqual(queries.normalAt(x ?? 0, z ?? 0, 1.25));
      expect(bound.ground.splatAt(x ?? 0, z ?? 0)).toEqual(queries.splatAt(x ?? 0, z ?? 0));
    }
    await bound.refresh(210, -180); expect(bound.fine.size).toBe(0); expect(view).not.toHaveBeenCalled();
    const data = withoutRuntimeRows(source);
    expect(data.terrain).toBeNull(); expect(data.tiles).toEqual([]); expect(data.files).toEqual([]); expect(data.critical).toEqual([]);
    const world = await clientWorld(data, reader(data, new Map()), { scope, x: 0, z: 0,
      views: { terrain: view, props: () => Promise.reject(new Error('Unexpected props draw')), library: () => Promise.reject(new Error('Unexpected library')) } });
    await world.refresh(210, -180); expect(view).not.toHaveBeenCalled();
    const catalogue = clientRingCatalogue(new Map([['query-fixture', { source }]]));
    for (const level of ['l0', 'l1', 'far'] as const) for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) expect(catalogue('query-fixture', level, x, z)).toBeNull();
    expect(scope.census.geometries).toBe(0); expect(scope.census.materials).toBe(0);
  } finally { scope.dispose(); }
});

it('retains every existing emitted rendered terrain section byte-for-byte', () => {
  let count = 0;
  for (const source of [template, pastel, ink, signal]) {
    const terrain = source.terrain;
    if (terrain !== null) { expect(JSON.stringify(v.parse(TerrainSchema, terrain))).toBe(JSON.stringify(terrain)); count++; }
  }
  expect(count).toBeGreaterThan(1);
});

it('counts WSTR only when its whole no-tail grid re-encodes to the exact admitted sampling bytes', () => {
  const { source, assets, native } = fixture(), terrain = source.terrain;
  if (terrain?.sampling === undefined) throw new Error('Missing sampling');
  const root = mkdtempSync(join(tmpdir(), 'query-content-')), folder = join(root, 'public/shardfiles/query-fixture'), retained = join(root, 'public/assets/baked/query-fixture/terrain.bin');
  const emit = (value: unknown): void => { writeFileSync(join(folder, 'shard.json'), JSON.stringify(value)); };
  try {
    mkdirSync(join(folder, 'assets'), { recursive: true }); mkdirSync(join(root, 'public/assets/baked/query-fixture'), { recursive: true });
    const sampling = assets.get(terrain.sampling.file); if (sampling === undefined) throw new Error('Missing sampling bytes');
    writeFileSync(join(folder, 'assets', terrain.sampling.file), sampling); writeFileSync(retained, native); emit(source);
    expect(shardContent('query-fixture', root)).toMatchObject({ status: 'built', privateBinaries: [], files: { platformBinaries: 1 }, colliders: { heightfield: false } });
    emit({ ...source, terrain: null }); expect(shardContent('query-fixture', root).privateBinaries).toHaveLength(2);
    emit({ ...source, runtime: { entry: 'runtime/index.ts' } }); expect(shardContent('query-fixture', root).status).toBe('invalid');
    emit(source);
    const changed = Uint8Array.from(native); new DataView(changed.buffer).setFloat32(24, 1, true); writeFileSync(retained, changed);
    expect(shardContent('query-fixture', root).privateBinaries).toHaveLength(1);
    const tail = new Uint8Array(native.length + 1); tail.set(native); writeFileSync(retained, tail);
    expect(shardContent('query-fixture', root).privateBinaries).toHaveLength(1);
    // A fully parsed placement log still cannot disappear from the sampling-only representation.
    const placement = new Uint8Array(native.length + 24); placement.set(native); placement.set([0x57, 0x53, 0x50, 0x4c], native.length);
    new DataView(placement.buffer).setUint32(native.length + 4, 1, true); writeFileSync(retained, placement);
    expect(readNativeTerrain(placement).grid.undergrowth).not.toBeNull(); expect(shardContent('query-fixture', root).privateBinaries).toHaveLength(1);
    writeFileSync(retained, native); writeFileSync(join(folder, 'assets', terrain.sampling.file), new Uint8Array(sampling.length));
    expect(shardContent('query-fixture', root).status).toBe('invalid');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
