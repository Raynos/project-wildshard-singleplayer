import type { BufferGeometry } from 'three';
import type { App } from '@wildshard/engine/app/app';
import type { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { TIER } from '@wildshard/engine/core/tier';
import type { ShardProduct } from './shardProduct';

type Assets = Pick<App['assets'], 'register' | 'acquireResource' | 'evictCached'>;
interface Source {
  readonly file: string;
  readonly segments?: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
}
/** A construction lease lends only independent mutable copies; completion releases its source claim. */
export interface WorldSceneGeometry {
  readonly copy: () => BufferGeometry;
  readonly done: () => void;
}
const templates = new WeakMap<Assets, Map<string, BufferGeometry>>();
function requireLive(owner: Scope): void {
  if (owner.disposed || owner.disposing) throw new Error('World scene geometry owner is disposed or retiring');
}
function lease(owner: Scope, assets: Assets, source: BufferGeometry): WorldSceneGeometry {
  requireLive(owner);
  const release = assets.acquireResource(source);
  if (release === null) throw new Error('World scene geometry has retired');
  let geometry: BufferGeometry | undefined = source;
  let forget = (): void => undefined;
  const done = (): void => {
    if (geometry === undefined) return;
    geometry = undefined; forget(); release();
  };
  forget = owner.capture('disposers', done);
  return { done, copy: () => {
    requireLive(owner);
    if (geometry === undefined) throw new Error('World scene geometry construction has finished');
    return geometry.clone();
  } };
}

/** Cache only completed immutable GLB geometry under its admitted addresses and decoder profile.
 * Each consumer has its own cancellable construction lease. No pending load or entered owner is shared. */
export async function readWorldSceneGeometry(owner: Scope, product: Pick<ShardProduct, 'url' | 'file'>, row: Source, assets: Assets): Promise<WorldSceneGeometry> {
  requireLive(owner);
  const url = product.url(row.file), segments = row.segments?.map(file => product.url(file)) ?? [];
  const ordered = Object.entries(row.attributes ?? {}), channels = [...ordered].sort(([a], [b]) => a.localeCompare(b));
  // Independent renames commute; chained or overwritten destinations keep the decoder's authored order.
  const destinations = ordered.map(([, to]) => to);
  const orderedAliases = new Set(destinations).size !== destinations.length || destinations.some(to => Object.hasOwn(row.attributes ?? {}, to));
  const key = JSON.stringify([url, segments, TIER, channels, orderedAliases ? ordered : null]);
  let memo = templates.get(assets);
  if (memo === undefined) { memo = new Map(); templates.set(assets, memo); }
  const ready = memo.get(key);
  if (ready !== undefined) return lease(owner, assets, ready);
  const intake = createOwnedGeometry(url, row.attributes);
  await intake.load(await product.file(row.file), row.segments === undefined ? undefined : await Promise.all(row.segments.map(file => product.file(file))));
  const geometry = intake.take();
  let asset: string | undefined;
  let temporary = true;
  try {
    requireLive(owner);
    // Concurrent cold readers decode privately; only a completed live winner is shared.
    const winner = memo.get(key);
    if (winner !== undefined) { temporary = false; geometry.dispose(); return lease(owner, assets, winner); }
    const id = `scene:${geometry.uuid}`;
    withOwner(owner, () => assets.register(id, geometry, { retain: true, cache: true, reusable: true }));
    asset = id;
    const held = lease(owner, assets, geometry);
    const cache = memo;
    cache.set(key, geometry);
    cacheUntilDisposed(geometry, () => { if (cache.get(key) === geometry) cache.delete(key); });
    return held;
  } catch (error) {
    if (asset !== undefined) assets.evictCached(asset); else if (temporary) geometry.dispose();
    throw error;
  }
}
