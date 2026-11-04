import type { ShardManifest } from '../shard/manifest';

/** An enter request reaches the shard it names; a frozen copy is never entered (LD5 removed the LEGACY choice). */
export function resolveTravelEntry<T extends Pick<ShardManifest, 'slug' | 'legacy'>>(manifest: T): T | undefined {
  return manifest.legacy === true ? undefined : manifest;
}
