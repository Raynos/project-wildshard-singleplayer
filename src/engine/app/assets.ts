import type { Disposable3 } from './scope';

export interface AssetRecord { key: string; refs: number; retained: boolean }
export type AssetCensus = readonly AssetRecord[];
interface Entry<T> { resource: T; refs: number; retained: boolean }

/** Shared resources are released by consumers; only this service disposes them. */
export class AssetService<T extends Disposable3 = Disposable3> {
  private entries = new Map<string, Entry<T>>();
  private managed = new WeakSet();

  register(key: string, resource: T, opts?: { retain?: boolean }): T {
    if (this.entries.has(key)) throw new Error(`Asset already registered: ${key}`);
    this.entries.set(key, { resource, refs: 0, retained: opts?.retain ?? false });
    this.managed.add(resource);
    return resource;
  }
  acquire(key: string): T {
    const entry = this.entries.get(key);
    if (!entry) throw new Error(`Unknown asset: ${key}`);
    entry.refs++;
    return entry.resource;
  }
  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry || entry.refs === 0) throw new Error(`Asset has no reference to release: ${key}`);
    entry.refs--;
    if (entry.refs === 0 && !entry.retained) {
      this.entries.delete(key);
      this.managed.delete(entry.resource);
      entry.resource.dispose();
    }
  }
  retained(): AssetCensus {
    return [...this.entries].map(([key, entry]) => ({ key, refs: entry.refs, retained: entry.retained }));
  }
  retainedResources(): readonly T[] { return [...this.entries.values()].filter((entry) => entry.retained).map((entry) => entry.resource); }
  has(key: string): boolean { return this.entries.has(key); }
  isAcquired(resource: object): boolean { return this.managed.has(resource); }
}
