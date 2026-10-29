import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { retried } from '@wildshard/engine/boot/retry';

type Identity = Pick<ShardManifest, 'slug' | 'legacy'>;
type Loaders = Readonly<Record<string, (() => Promise<ShardManifest>) | undefined>>;
export interface SelectedManifests {
  readonly manifests: readonly ShardManifest[];
  readonly contentIdentities: Readonly<Record<string, string>>;
}

/** Prepare only the selected world and, for an inventoried frozen copy, its defining primary.
 * Validate the complete pair before publishing either; a suffix grants no legacy identity. */
export async function selectedManifests(selected: Identity, loaders: Loaders,
  identities: Readonly<Record<string, string>>, beforeLoad: (slug: string) => void): Promise<SelectedManifests> {
  const primary = Object.hasOwn(identities, selected.slug) ? identities[selected.slug] : undefined;
  if ((selected.legacy === true) !== (primary !== undefined)) {
    throw new Error('Selected legacy identity is not inventoried');
  }
  const slugs = primary === undefined ? [selected.slug] : [primary, selected.slug];
  if (new Set(slugs).size !== slugs.length) throw new Error('Selected legacy identity is not inventoried');
  const entries = slugs.map((slug, index) => {
    const load = Object.hasOwn(loaders, slug) ? loaders[slug] : undefined;
    if (load === undefined) throw new Error('Missing selected discovery loader');
    return { slug, load, legacy: selected.legacy === true && index === slugs.length - 1 };
  });
  const manifests = await Promise.all(entries.map(async ({ slug, load, legacy }) => {
    beforeLoad(slug);
    const manifest = await retried(load);
    if (new Map([[slug, load]]).get(manifest.slug) !== load || (manifest.legacy === true) !== legacy) {
      throw new Error('Selected discovery identity differs');
    }
    return manifest;
  }));
  return { manifests, contentIdentities: primary === undefined ? {} : { [selected.slug]: primary } };
}

/** A native grid can enter every primary, but never a frozen standalone copy.
 * Keep its complete runnable primary catalogue without evaluating those copies.
 * The original loaders preserve placements, object values and declaration order;
 * standalone selection still prepares its complete inventoried pair above. */
export async function gridManifests(rows: readonly Identity[], loaders: Loaders,
  identities: Readonly<Record<string, string>>, beforeLoad: (slug: string) => void): Promise<SelectedManifests> {
  const indexed = new Map<string, Identity>(rows.map(row => [row.slug, row]));
  if (indexed.size !== rows.length) throw new Error('Grid catalogue has duplicate identities');
  for (const row of rows) {
    const primary = Object.hasOwn(identities, row.slug) ? identities[row.slug] : undefined;
    if ((row.legacy === true) !== (primary !== undefined)
      || primary !== undefined && (indexed.get(primary) === undefined || indexed.get(primary)?.legacy === true)) {
      throw new Error('Grid legacy identity is not inventoried');
    }
  }
  const native = rows.filter(row => row.legacy !== true);
  if (native.length === 0) throw new Error('Grid catalogue has no native manifests');
  // Validate the complete request set before starting any loader.
  for (const row of native) {
    if (!Object.hasOwn(loaders, row.slug) || typeof loaders[row.slug] !== 'function') throw new Error('Missing grid discovery loader');
  }
  const prepared = await Promise.all(native.map(row => selectedManifests(row, loaders, identities, beforeLoad)));
  return { manifests: prepared.flatMap(row => row.manifests).sort((a, b) => a.order - b.order), contentIdentities: {} };
}
