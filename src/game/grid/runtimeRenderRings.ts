import type { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { RingCatalogue, RingPorts, RingTile, RingView } from './rings';
import type { RuntimeRenderChunk, RuntimeRenderInventory, RuntimeRenderPorts } from './runtimeRenderPlan';
import type { RuntimeRenderDependencies, RuntimeRenderDependencyLease } from './runtimeRenderDependencies';

/** Opaque prepared tile; only the adapter that prepared it can publish or discard it. */
export interface RuntimeRenderPrepared<T> { readonly scope: Scope; readonly parts: readonly { readonly chunk: RuntimeRenderChunk; readonly data: T }[] }
interface Part<T> { readonly chunk: RuntimeRenderChunk; readonly scope: Scope; data: { value: T } | null; view: RingView | null }
interface Work<T> { readonly scope: Scope; readonly parts: readonly Part<T>[]; readonly shared: ReadonlyMap<string, RuntimeRenderDependencyLease>; closed: boolean; close: () => void }

/**
 * G208 bridge to the existing parent-first rings. The regional host owns the checked opaque residual separately.
 * Rings reserve all tile-component bytes before fetch; this adapter reserves every shared dependency before any
 * renderer prepares. Construct the page dependency owner first and pass that same owner to all regional adapters.
 * Cancellation retires allocations before component/dependency charges. No live whole-claim discount or boot switch.
 */
export function runtimeRenderRings<T>(instance: string, inventory: RuntimeRenderInventory, shared: RuntimeRenderDependencies,
  regionScope: Scope, renderer: RuntimeRenderPorts<T>): { readonly catalogue: RingCatalogue; readonly ports: RingPorts<RuntimeRenderPrepared<T>> } {
  if (instance.length === 0 || regionScope.disposed) throw new Error('Invalid runtime render region');
  const work = new Map<string, Work<T>>();
  const available = (): boolean => !regionScope.disposed;
  const chunks = (tile: RingTile): readonly RuntimeRenderChunk[] => {
    if (tile.instance !== instance) throw new Error('Runtime render tile belongs to another region');
    return inventory.tile(tile.level, tile.x, tile.z);
  };
  const catalogue: RingCatalogue = (owner, level, x, z) => {
    if (owner !== instance || !available()) return null;
    const rows = inventory.tile(level, x, z); if (rows.length === 0) return null;
    const footprint = inventory.footprint(rows.map((row) => row.id));
    return footprint.chunkJsBytes + footprint.chunkGpuBytes;
  };
  const ports: RingPorts<RuntimeRenderPrepared<T>> = {
    fetch: (tile, done) => {
      if (!available() || work.has(tile.key)) { done(new Error('Runtime render region is disposed or already preparing')); return; }
      const rows = chunks(tile), footprint = inventory.footprint(rows.map((row) => row.id));
      if (rows.length === 0) { done(new Error('Runtime render tile has no presentation components')); return; }
      const dependencies = new Map<string, RuntimeRenderDependencyLease>();
      for (const dependency of footprint.dependencies) {
        let holder: RuntimeRenderDependencyLease | null;
        try { holder = shared.acquire(dependency, instance); } catch (error) {
          for (const acquired of dependencies.values()) acquired.release();
          done(error instanceof Error ? error : new Error(String(error))); return;
        }
        if (holder === null) {
          for (const acquired of dependencies.values()) acquired.release();
          done(new Error(`Runtime render dependency admission deferred: ${dependency.id}`)); return;
        }
        dependencies.set(dependency.id, holder);
      }
      if (regionScope.disposed) {
        for (const holder of dependencies.values()) holder.release();
        done(new Error('Runtime render region was disposed during admission')); return;
      }
      const scope = regionScope.child(tile.key), parts: Part<T>[] = [], publishedParts: { chunk: RuntimeRenderChunk; data: T }[] = [];
      const operation: Work<T> = { scope, parts, shared: dependencies, closed: false, close: () => {
        if (operation.closed) return;
        operation.closed = true; if (work.get(tile.key) === operation) work.delete(tile.key);
        const errors: unknown[] = [];
        const clean = (run: () => void): void => { try { run(); } catch (error) { errors.push(error); } };
        for (const part of parts) {
          const view = part.view, data = part.data; part.view = null; part.data = null;
          if (view !== null) clean(() => view.dispose());
          else if (data !== null) clean(() => renderer.discard(part.chunk, data.value));
        }
        publishedParts.length = 0;
        clean(() => scope.dispose());
        for (const holder of dependencies.values()) clean(() => holder.release());
        if (errors.length > 0) throw new AggregateError(errors, 'Runtime render tile cleanup failed');
      } };
      work.set(tile.key, operation); scope.onDispose(operation.close);
      // LIFO external teardown retires child allocations before the close callback releases shared claims.
      for (const chunk of rows) parts.push({ chunk, scope: scope.child(chunk.id), data: null, view: null });
      let left = parts.length;
      for (const part of parts) {
        if (operation.closed) break;
        let reported = false;
        const complete = (result: T | Error): void => {
          if (reported) return; reported = true;
          if (operation.closed) { if (!(result instanceof Error)) renderer.discard(part.chunk, result); return; }
          if (result instanceof Error) { operation.close(); done(result); return; }
          part.data = { value: result }; left--;
          if (left === 0) {
            for (const ready of parts) { if (ready.data === null) throw new Error('Incomplete runtime render tile'); publishedParts.push({ chunk: ready.chunk, data: ready.data.value }); }
            done({ scope, parts: publishedParts });
          }
        };
        try {
          withOwner(part.scope, () => renderer.prepare(part.chunk, part.scope, complete, { scope: (id) => {
            if (operation.closed || !part.chunk.dependencyIds.includes(id)) throw new Error('Runtime render dependency is not admitted for this component');
            const dependency = operation.shared.get(id); if (dependency === undefined) throw new Error('Unknown runtime render dependency');
            return dependency.scope;
          } }));
        } catch (error) { complete(error instanceof Error ? error : new Error(String(error))); }
      }
    },
    upload: (tile, prepared) => {
      const operation = work.get(tile.key);
      if (operation === undefined || operation.closed || operation.scope !== prepared.scope) throw new Error('Runtime render preparation no longer belongs to this tile');
      try {
        for (const part of operation.parts) {
          const data = part.data;
          if (data === null) throw new Error('Runtime render component is not prepared');
          part.view = withOwner(part.scope, () => renderer.upload(part.chunk, data.value, part.scope));
          part.data = null;
        }
      } catch (error) { operation.close(); throw error; }
      return { mask: (excluded) => { for (const part of operation.parts) part.view?.mask(excluded); },
        shadow: (enabled) => { for (const part of operation.parts) part.view?.shadow(enabled); }, dispose: operation.close };
    },
    discard: (_tile, prepared) => {
      const operation = [...work.values()].find((candidate) => candidate.scope === prepared.scope);
      if (operation !== undefined) operation.close();
    },
    cancel: (tile) => { work.get(tile.key)?.close(); },
  };
  return { catalogue, ports };
}
