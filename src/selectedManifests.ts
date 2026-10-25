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
