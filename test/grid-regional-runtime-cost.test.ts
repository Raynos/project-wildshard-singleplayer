import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { regionalRuntimeAccountedBytes } from '../src/game/grid/regionalRuntime';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';

const imagesFirst = { webContentMB: 570, glMB: 623, engineBaseMB: 299, rev: '6c0aaea4f', device: 'Measured fixture', evidence: 'progress/memory/fixture.json' };
const cost = { ...imagesFirst, webContentMB: 600, glMB: 236, imagesFirst };
const source = { ...emptyShardfile({ slug: 'pine-hollow', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }), runtime: { entry: 'runtime/index.ts', cost } };
const manifest = { slug: 'pine-hollow' as const, runtimeCost: cost };

it('charges the complete measured runtime rather than an empty shardfile simulation', () => {
  const bytes = regionalRuntimeAccountedBytes({ source }, manifest);
  expect(bytes).toBe(runtimeAccountedBytes(cost)); expect(bytes).toBeGreaterThan(source.budgets.sim.resident);
  const strict = new ResidencyAllocator(), developer = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const home = { id: 'sim:home', category: 'sim' as const, owner: 'home', bytes: 450_000_000, distance: 0, needed: true };
  const region = { ...home, id: 'sim:regional-fixture', owner: source.identity.slug, bytes };
  const publicHome = strict.reserve(home), developerHome = developer.reserve(home);
  expect(publicHome).not.toBeNull(); expect(developerHome).not.toBeNull(); expect(strict.reserve(region)).toBeNull();
  const full = developer.reserve(region);
  expect(full).not.toBeNull(); expect(developer.cost().accounted).toBe(home.bytes + bytes);
  expect(developer.memory.reports().some(report => report.playingOverBytes > 0)).toBe(true);
  full?.release(); publicHome?.release(); developerHome?.release();
  expect(strict.entries()).toEqual([]); expect(developer.entries()).toEqual([]);
});

it('refuses missing, mismatched and understated measurement provenance without discarding images-first', () => {
  expect(() => regionalRuntimeAccountedBytes({ source }, { ...manifest, slug: 'nalati-grasslands' })).toThrow('identity');
  expect(() => regionalRuntimeAccountedBytes({ source: { ...source, runtime: null } }, manifest)).toThrow('measurements');
  expect(() => regionalRuntimeAccountedBytes({ source }, { slug: manifest.slug })).toThrow('measurements');
  expect(() => regionalRuntimeAccountedBytes({ source: { ...source, runtime: { entry: 'runtime/index.ts', cost: { ...cost, glMB: 1 } } } }, manifest)).toThrow('differs');
  expect(() => regionalRuntimeAccountedBytes({ source }, { ...manifest, runtimeCost: { ...imagesFirst, webContentMB: cost.webContentMB, glMB: cost.glMB } })).toThrow('differs');
});

it('charges the probe-selected image fallback without changing compressed provenance or the strict cap', () => {
  const compressed = regionalRuntimeAccountedBytes({ source }, manifest, 'ktx2');
  const fallback = regionalRuntimeAccountedBytes({ source }, manifest, 'img');
  expect(compressed).toBe(runtimeAccountedBytes(cost));
  expect(fallback).toBe(runtimeAccountedBytes(imagesFirst));
  expect(fallback).toBeGreaterThan(compressed);
  const allocator = new ResidencyAllocator();
  expect(allocator.reserve({ id: 'sim:pine-hollow', category: 'sim', owner: 'pine-hollow',
    bytes: fallback, needed: true, distance: 0 })).toBeNull();
  expect(allocator.entries()).toEqual([]);
  expect(() => regionalRuntimeAccountedBytes({ source }, { ...manifest,
    runtimeCost: { ...cost, imagesFirst: { ...imagesFirst, glMB: 1 } } }, 'img')).toThrow('differs');
});
