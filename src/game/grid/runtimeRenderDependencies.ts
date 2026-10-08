import type { Scope } from '@wildshard/engine/app/scope';
import type { ResidencyAllocator } from './allocator';
import type { RuntimeRenderDependency } from './runtimeRenderPlan';

/** One admitted reference. Share resources by scope identity; never attach a shared resource to a tile's scope. */
export interface RuntimeRenderDependencyLease { readonly scope: Scope; release: () => void }
interface SharedDependency { readonly scope: Scope; readonly jsBytes: number; readonly gpuBytes: number; readonly holders: Set<RuntimeRenderDependencyLease> }

/**
 * G208 explicit page owner, constructed before its region/tile consumers. The one allocator charges each stable
 * dependency identity once; every consumer holds it against eviction. Builders allocate shared resources once into
 * the supplied dependency scope (which may outlive the first tile). Last-reference disposal frees those resources
 * before releasing the charge. No global caches/install side effects or release-time discounts.
 */
export class RuntimeRenderDependencies {
  private readonly resources = new Map<string, SharedDependency>();
  private readonly scope: Scope;
  constructor(private readonly allocator: ResidencyAllocator, pageScope: Scope) {
    if (pageScope.disposed) throw new Error('Runtime render page is disposed');
    this.scope = pageScope.child('runtime-render:dependencies');
    this.scope.onDispose(() => {
      const errors: unknown[] = [];
      for (const shared of this.resources.values()) for (const holder of shared.holders) {
        try { holder.release(); } catch (error) { errors.push(error); }
      }
      if (errors.length > 0) throw new AggregateError(errors, 'Runtime render dependency cleanup failed');
    });
  }

  /** Refuse before resource allocation; a null lease leaves the coarse parent showing. */
  acquire(dependency: RuntimeRenderDependency, owner: string): RuntimeRenderDependencyLease | null {
    this.assertActive();
    const bytes = dependency.jsBytes + dependency.gpuBytes;
    if (!/^[a-z0-9][a-z0-9._:-]{0,159}$/u.test(dependency.id) || !Number.isSafeInteger(dependency.jsBytes) || dependency.jsBytes < 0
      || !Number.isSafeInteger(dependency.gpuBytes) || dependency.gpuBytes < 0 || !Number.isSafeInteger(bytes)) throw new RangeError('Invalid runtime render dependency');
    let shared = this.resources.get(dependency.id);
    if (shared !== undefined && (shared.jsBytes !== dependency.jsBytes || shared.gpuBytes !== dependency.gpuBytes)) throw new Error('Runtime render dependency changed shape');
    const claim = this.allocator.reserve({ id: `runtime-render:dependency:${dependency.id}`, category: 'library', bytes, owner, distance: 0, needed: false });
    if (claim === null) return null;
    if (this.scope.disposed) { claim.release(); throw new Error('Runtime render dependency owner was disposed during admission'); }
    const unhold = claim.hold();
    if (shared === undefined) {
      shared = { scope: this.scope.child(dependency.id), jsBytes: dependency.jsBytes, gpuBytes: dependency.gpuBytes, holders: new Set() };
      this.resources.set(dependency.id, shared);
    }
    const resource = shared;
    let released = false;
    const holder: RuntimeRenderDependencyLease = Object.freeze({ scope: resource.scope, release: (): void => {
      if (released) return;
      released = true; resource.holders.delete(holder);
      try {
        if (resource.holders.size === 0) { this.resources.delete(dependency.id); resource.scope.dispose(); }
      } finally { unhold(); claim.release(); }
    } });
    resource.holders.add(holder);
    return holder;
  }

  /** Page teardown; outstanding holders become idempotent and cannot resurrect admission. */
  dispose(): void { this.scope.dispose(); }
  private assertActive(): void { if (this.scope.disposed) throw new Error('Runtime render dependency owner is disposed'); }
}
