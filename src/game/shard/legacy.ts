import type { ShardManifest } from './manifest';

type EntryIdentity = Pick<ShardManifest, 'slug' | 'legacy'>;

/** The ordinary picker, summary and grid never show a frozen copy (LD5: nothing enters one any more). */
export function ordinaryShardManifests<T extends EntryIdentity>(manifests: readonly T[]): readonly T[] {
  return manifests.filter(manifest => manifest.legacy !== true);
}
