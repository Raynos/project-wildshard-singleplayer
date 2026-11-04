import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { retried } from '@wildshard/engine/boot/retry';

type Identity = Pick<ShardManifest, 'slug' | 'legacy'>;
type Loaders = Readonly<Record<string, (() => Promise<ShardManifest>) | undefined>>;
export interface SelectedManifests {
  readonly manifests: readonly ShardManifest[];
}

/** Prepare only the selected world's original manifest. A flagged frozen copy is never prepared (LD6 retired the last
 * one, LD8 its content-identity pairing); the loaded manifest must be the one selected. */
export async function selectedManifests(selected: Identity, loaders: Loaders, beforeLoad: (slug: string) => void): Promise<SelectedManifests> {
  if (selected.legacy === true) throw new Error('Selected shard is a frozen copy');
  const load = Object.hasOwn(loaders, selected.slug) ? loaders[selected.slug] : undefined;
  if (load === undefined) throw new Error('Missing selected discovery loader');
  beforeLoad(selected.slug);
  const manifest = await retried(load);
  if (new Map([[selected.slug, load]]).get(manifest.slug) !== load || manifest.legacy === true) throw new Error('Selected discovery identity differs');
  return { manifests: [manifest] };
}

/** A native grid prepares every catalogue world. The original loaders preserve placements, object values and
 * declaration order; a frozen copy in the catalogue refuses the whole set. */
export async function gridManifests(rows: readonly Identity[], loaders: Loaders, beforeLoad: (slug: string) => void): Promise<SelectedManifests> {
  const indexed = new Map<string, Identity>(rows.map(row => [row.slug, row]));
  if (indexed.size !== rows.length) throw new Error('Grid catalogue has duplicate identities');
  if (rows.some(row => row.legacy === true)) throw new Error('Grid catalogue has a frozen copy');
  if (rows.length === 0) throw new Error('Grid catalogue has no native manifests');
  // Validate the complete request set before starting any loader.
  for (const row of rows) {
    if (!Object.hasOwn(loaders, row.slug) || typeof loaders[row.slug] !== 'function') throw new Error('Missing grid discovery loader');
  }
  const prepared = await Promise.all(rows.map(row => selectedManifests(row, loaders, beforeLoad)));
  return { manifests: prepared.flatMap(row => row.manifests).sort((a, b) => a.order - b.order) };
}
