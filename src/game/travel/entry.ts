import type { ShardEntryMode, ShardManifest } from '../shard/manifest';
import { shardEntry, shardEntries } from '../shard/entryMode';
import { legacyShardFor, shardEntryManifest } from '../shard/legacy';

type EntrySource = Pick<ShardManifest, 'slug' | 'legacy' | 'entries' | 'load'>;
/** Resolve an enter request against the actual registered entry inventory. */
export function resolveTravelEntry<T extends EntrySource>(manifests: readonly T[], manifest: T,
  read: (source: Pick<EntrySource, 'slug' | 'entries' | 'load'>) => ShardEntryMode = shardEntry): T | undefined {
  const copy = legacyShardFor(manifests, manifest.slug);
  // Match the deck: a registered copy supplies the legacy entry even when the
  // primary's own data-only metadata correctly declares no native loader.
  const available = copy === undefined ? manifest
    : { ...manifest, entries: { ...shardEntries(manifest), legacy: true } };
  return shardEntryManifest(manifests, manifest.slug, read(available));
}
