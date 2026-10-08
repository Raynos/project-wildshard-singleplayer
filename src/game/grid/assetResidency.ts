import type { App } from '@wildshard/engine/app/app';
import type { Disposable3, Scope } from '@wildshard/engine/app/scope';
import type { ResidencyAllocator, ResidencyLease } from './allocator';

type AssetPort = Parameters<App['assets']['bindResidency']>[0];
/** Renderer composition supplies concrete allocation identities; Node residency imports no rendering module. */
export type AssetAllocationReader = (resource: Disposable3) => readonly { identity: object; bytes: number; kind: 'cpu' | 'gpu' }[];
interface Allocation { readonly lease: ResidencyLease; refs: number; covering: string | undefined }
const bridges = new WeakMap<ResidencyAllocator, AssetResidencyBridge>();

/** One page's retained allocation bridge: CPU backing stores, GPU attributes and texture source/sampler pairs are
 * deduplicated by identity. A whole-runtime claim covers only resources actually registered/drawn in its owner scope. */
export class AssetResidencyBridge implements AssetPort {
  private readonly allocations = new Map<object, Allocation>();
  private readonly owners = new Map<Scope, string>();
  private sequence = 0;
  private readonly allocator: ResidencyAllocator;
  private readonly readAllocations: AssetAllocationReader;
  private readonly readOwner: () => Scope | null;
  constructor(allocator: ResidencyAllocator, readAllocations: AssetAllocationReader, readOwner: () => Scope | null = () => null) {
    this.allocator = allocator; this.readAllocations = readAllocations; this.readOwner = readOwner;
    if (bridges.has(allocator)) throw new Error('Allocator already has an asset bridge');
    bridges.set(allocator, this);
  }
  /** Bind the reviewed whole-runtime claim to a resident scope, never merely to whichever shard is current. */
  cover(scope: Scope, claim: ResidencyLease): void {
    if (scope.disposed || !this.allocator.entries().some(entry => entry.id === claim.id && entry.category === 'sim')) throw new Error('Cache coverage requires a live runtime');
    const old = this.owners.get(scope);
    if (old !== undefined && old !== claim.id) throw new Error('Runtime cache coverage changed identity');
    if (old !== undefined) return;
    this.owners.set(scope, claim.id);
    scope.onDispose(() => { this.owners.delete(scope); });
  }
  private covering(scope: Scope | null): string | undefined {
    if (scope === null || scope.disposed) return undefined;
    for (const [owner, claim] of this.owners) if (scope.belongsTo(owner) && this.allocator.has(claim)) return claim;
    return undefined;
  }
  /** AssetService calls this before adopting a cache; refusal releases every partially prepared allocation. */
  register(_key: string, resource: Disposable3, owner: Scope | null): ReturnType<AssetPort['register']> {
    const held: Allocation[] = [], covering = this.covering(owner ?? this.readOwner());
    try {
      for (const row of this.readAllocations(resource)) {
        let entry = this.allocations.get(row.identity);
        if (entry === undefined) {
          const lease = this.allocator.reserve({ id: `commons:retained:${String(++this.sequence)}:${row.kind}`, category: 'commons', owner: 'platform',
            bytes: row.bytes, distance: 0, needed: true, ...(covering === undefined ? {} : { coveredBy: covering }) });
          if (lease === null) throw new Error('Retained cache admission deferred by the shared budget');
          entry = { lease, refs: 0, covering }; this.allocations.set(row.identity, entry);
        }
        entry.refs++; held.push(entry);
      }
    } catch (error) { this.release(held); throw error; }
    let live = true;
    const observe = (scope: Scope | null): void => {
      if (!live) return;
      const next = this.covering(scope);
      if (next === undefined) return; // Parent retirement itself exposes the bytes; a page draw cannot hide them.
      for (const entry of held) if (entry.covering !== next) {
        entry.lease.update({ coveredBy: next }); entry.covering = next;
      }
    };
    try { observe(owner ?? this.readOwner()); }
    catch (error) { live = false; this.release(held); throw error; }
    return { observe, release: () => { if (live) { live = false; this.release(held); } } };
  }
  private release(held: readonly Allocation[]): void {
    for (const entry of held) if (--entry.refs === 0) {
      entry.lease.release();
      for (const [identity, candidate] of this.allocations) if (candidate === entry) { this.allocations.delete(identity); break; }
    }
  }
  /** Detach only with the actual renderer owner; unloading a level alone must not uncharge still-live cached GPU data. */
  dispose(): void {
    for (const entry of this.allocations.values()) entry.lease.release();
    this.allocations.clear(); this.owners.clear(); bridges.delete(this.allocator);
  }
}

/** Regional factories can bind coverage only after obtaining their reviewed whole-runtime lease. No bridge means no
 * renderer cache exists in that Node/headless composition; the actual browser owner installs it before content boots. */
export function coverRuntimeAssets(allocator: ResidencyAllocator, scope: Scope, claim: ResidencyLease): void {
  bridges.get(allocator)?.cover(scope, claim);
}
