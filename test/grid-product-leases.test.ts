import { describe, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { ProductLeases } from '../src/game/grid/productLeases';
import { productResidentBytes } from '../src/game/shardfile/productCost';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { CONTENT_CAPS as C } from '../src/engine/core/config';

const source = emptyShardfile({ slug: 'leased-product', name: 'Leased product', author: 'Test', revision: 1, seed: 58 });
const bytes = productResidentBytes(source);
const allocatorForOne = (): ResidencyAllocator => new ResidencyAllocator({ playing: C.engineBase + C.overlap + Math.ceil(bytes * C.residentFactor) });

describe('grid product leases', () => {
  it('bills owned wire aliases and the parsed source in the product category', () => {
    const copy = structuredClone(source), hash = 'a'.repeat(64);
    copy.files = [{ hash, kind: 'binary', compressed: 1000, decoded: 1000, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }];
    copy.requires.commons = [hash]; copy.requires.commonsWire[hash] = 1000;
    expect(productResidentBytes(copy) - bytes).toBeGreaterThan(2000);
    expect(bytes).toBeGreaterThan(JSON.stringify(source).length * 2);
    const allocator = allocatorForOne(), lease = allocator.reserve({ id: 'product', owner: 'page', category: 'product', bytes, distance: 0, needed: true });
    expect(lease).not.toBeNull(); expect(allocator.cost().input.products).toBe(bytes); expect(allocator.cost().accounted).toBe(bytes);
    lease?.release(); expect(allocator.cost().input.products).toBe(0);
  });
  it('shares one admission across template copies and protects it until the final consumer releases', async () => {
    const allocator = allocatorForOne(), cache = new ProductLeases<{ source: typeof source }>(allocator, 'page'); let loads = 0;
    const load = (reserve: (s: typeof source) => void) => { loads++; reserve(source); return Promise.resolve({ source }); };
    const leases = await Promise.all(Array.from({ length: 6 }, () => cache.acquire('template', load)));
    expect(loads).toBe(1); expect(new Set(leases.map(lease => lease.value)).size).toBe(1);
    expect(allocator.entries()).toHaveLength(1); expect(allocator.entries()[0]?.needed).toBe(true);
    for (const lease of leases.slice(0, 5)) lease.release();
    expect(allocator.entries()[0]?.needed).toBe(true);
    leases[5]?.release(); expect(allocator.entries()[0]?.needed).toBe(false);
    cache.dispose(); expect(allocator.entries()).toHaveLength(0);
  });
  it('evicts unused cached products under the same envelope and re-admits on revisiting', async () => {
    const allocator = allocatorForOne(), cache = new ProductLeases<number>(allocator, 'page'); let loads = 0;
    const load = (reserve: (s: typeof source) => void) => { reserve(source); return Promise.resolve(++loads); };
    const first = await cache.acquire('one', load); first.release();
    const second = await cache.acquire('two', load);
    expect(allocator.entries().map(row => row.id)).toEqual(['product:page:two']); second.release();
    const revisit = await cache.acquire('one', load); expect(revisit.value).toBe(3); revisit.release();
    cache.dispose(); expect(allocator.entries()).toHaveLength(0);
  });
  it('refuses a second active product before any immutable asset read and preserves the existing claim', async () => {
    const allocator = allocatorForOne(), cache = new ProductLeases<number>(allocator, 'page'); let reads = 0;
    const load = (reserve: (s: typeof source) => void) => { reserve(source); return Promise.resolve(++reads); };
    const held = await cache.acquire('one', load);
    await expect(cache.acquire('two', load)).rejects.toThrow('residency admission deferred');
    expect(reads).toBe(1); expect(allocator.entries().map(row => row.id)).toEqual(['product:page:one']);
    cache.dispose(); expect(allocator.entries()).toHaveLength(1); held.release(); held.release();
    expect(allocator.entries()).toHaveLength(0);
  });
  it('forgets failed admission and refuses loaders that omit or repeat the pre-asset reservation', async () => {
    const allocator = allocatorForOne(), cache = new ProductLeases<number>(allocator, 'page');
    await expect(cache.acquire('one', reserve => { reserve(source); return Promise.reject(new Error('Invalid asset')); })).rejects.toThrow('Invalid asset');
    expect(allocator.entries()).toHaveLength(0);
    await expect(cache.acquire('one', () => Promise.resolve(1))).rejects.toThrow('omitted');
    await expect(cache.acquire('one', reserve => { reserve(source); reserve(source); return Promise.resolve(1); })).rejects.toThrow('reserved twice');
    expect(allocator.entries()).toHaveLength(0);
    const accepted = await cache.acquire('one', reserve => { reserve(source); return Promise.resolve(2); });
    accepted.release(); cache.dispose(); expect(allocator.entries()).toHaveLength(0);
  });
  it('releases an in-flight product if its page disposes before admission finishes', async () => {
    const allocator = allocatorForOne(), cache = new ProductLeases<number>(allocator, 'page');
    let complete: (() => void) | undefined;
    const loading = cache.acquire('one', async reserve => { reserve(source); await new Promise<void>(resolve => { complete = resolve; }); return 1; });
    await Promise.resolve(); expect(allocator.entries()).toHaveLength(1); cache.dispose(); complete?.();
    await expect(loading).rejects.toThrow('disposed during admission'); expect(allocator.entries()).toHaveLength(0);
  });
});
