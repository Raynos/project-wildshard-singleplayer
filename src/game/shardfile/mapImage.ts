import type { Shardfile } from '@wildshard/format/shardSchema';
import type { ResidencyAllocator } from '../grid/allocator';
import { stillImageUrl } from './stillImage';

/** Lease the admitted map's conservative image residency before decoding or retaining its inert URL. */
export function leaseMapImage(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, allocator: ResidencyAllocator,
  scope: { readonly disposed: boolean; onDispose: (fn: () => void) => void }): string | undefined {
  const map = source.map;
  if (map === undefined) return undefined;
  if (scope.disposed) throw new Error('Map owner disposed');
  const file = source.files.find(row => row.hash === map.image), bytes = assets.get(map.image);
  if (file?.kind !== 'image' || bytes === undefined) throw new Error('Missing admitted map image');
  const lease = reserveMapImage(source, allocator, scope);
  try { return stillImageUrl(bytes); }
  catch (error) { lease.release(); throw error; }
}

/** Reserve a validated map independently of a trusted runtime's opaque memory claim. */
export function reserveMapImage(source: Shardfile, allocator: ResidencyAllocator, scope: { readonly disposed: boolean; onDispose: (fn: () => void) => void }): { release: () => void } {
  if (scope.disposed) throw new Error('Map owner disposed');
  const map = source.map, file = source.files.find(row => row.hash === map?.image);
  if (map === undefined || file?.kind !== 'image') throw new Error('Missing admitted map image');
  const lease = allocator.reserve({ id: `library:${source.identity.slug}:${map.image}`, category: 'library', owner: 'platform', bytes: file.decoded + file.gpu, distance: 0, needed: true });
  if (lease === null) throw new Error('Map residency admission deferred');
  scope.onDispose(() => { lease.release(); });
  return lease;
}
