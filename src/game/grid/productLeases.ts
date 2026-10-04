import type { ResidencyAllocator, ResidencyLease } from './allocator';
import type { Shardfile } from '../shardfile/schema';
import { productResidentBytes } from '../shardfile/productCost';

/** A caller holds the product while any admitted source or immutable transport bytes are still in use. */
export interface ProductLease<T> { readonly value: T; release: () => void }
interface Entry<T> { promise: Promise<T>; claim: ResidencyLease | undefined; users: number; settled: boolean; failed: boolean }

/** Page-owned product cache. In-flight/active users are pinned; unused products participate in ordinary allocator eviction. */
export class ProductLeases<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private closed = false;
  constructor(private readonly allocator: ResidencyAllocator, private readonly owner: string) {}
  private disposed(): boolean { return this.closed; }
  /** Reserve the source/wire claim before the loader reads immutable assets; concurrent copies share one admission. */
  async acquire(key: string, load: (reserve: (source: Shardfile) => void) => Promise<T>): Promise<ProductLease<T>> {
    if (this.disposed()) throw new Error('Product cache disposed');
    let entry = this.entries.get(key);
    if (entry === undefined) {
      const fresh: Entry<T> = { promise: Promise.resolve().then(async () => {
        try {
          const value = await load(source => {
            if (this.closed || fresh.claim !== undefined) throw new Error('Product admission disposed or reserved twice');
            const claim = this.allocator.reserve({ id: `product:${this.owner}:${key}`, category: 'product', owner: this.owner,
              bytes: productResidentBytes(source), distance: 0, needed: true, evictSync: () => { this.entries.delete(key); fresh.claim = undefined; } });
            if (claim === null) throw new Error('Product residency admission deferred'); fresh.claim = claim;
          });
          if (fresh.claim === undefined) throw new Error('Product loader omitted pre-asset residency admission');
          fresh.settled = true; return value;
        } catch (error) { fresh.failed = true; this.drop(key, fresh); throw error; }
      }), claim: undefined, users: 0, settled: false, failed: false };
      entry = fresh; this.entries.set(key, fresh);
    }
    const held = entry; held.users++; held.claim?.update({ needed: true });
    let released = false;
    const release = (): void => {
      if (released) return; released = true; held.users--;
      if (held.users === 0) {
        if (this.closed || held.failed) this.drop(key, held);
        else if (held.settled) held.claim?.update({ needed: false });
      }
    };
    try {
      const value = await held.promise;
      if (this.disposed()) throw new Error('Product cache disposed during admission');
      return { value, release };
    } catch (error) { release(); throw error; }
  }
  private drop(key: string, entry: Entry<T>): void {
    if (this.entries.get(key) === entry) this.entries.delete(key);
    entry.claim?.release(); entry.claim = undefined;
  }
  /** Forget every unused promise now; active readers retain their claim until their own idempotent release. */
  dispose(): void {
    this.closed = true;
    for (const [key, entry] of this.entries) if (entry.users === 0) this.drop(key, entry);
  }
}
