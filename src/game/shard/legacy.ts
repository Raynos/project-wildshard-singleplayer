import type { ShardManifest, ShardEntryMode } from './manifest';
import type { SaveStore } from '@wildshard/engine/saves/store';

type EntryIdentity = Pick<ShardManifest, 'slug' | 'legacy'>;

/** Find only an explicitly frozen copy of an existing ordinary manifest. A suffix alone grants no legacy privilege. */
export function legacyShardFor<T extends EntryIdentity>(manifests: readonly T[], slug: string): T | undefined {
  const registry = new Map<string, T>(manifests.map(manifest => [manifest.slug, manifest]));
  const base = registry.get(slug);
  if (base === undefined || base.legacy === true) return undefined;
  const copy = registry.get(`${slug}-legacy`);
  return copy?.legacy === true ? copy : undefined;
}

/** Resolve the existing picker choice to its independent folder; before a copy exists the old entry path remains unchanged. */
export function shardEntryManifest<T extends EntryIdentity>(manifests: readonly T[], slug: string, mode: ShardEntryMode): T | undefined {
  const manifest = new Map<string, T>(manifests.map(row => [row.slug, row])).get(slug);
  if (manifest === undefined) return undefined;
  if (manifest.legacy === true) return mode === 'legacy' ? manifest : undefined;
  return mode === 'legacy' ? legacyShardFor(manifests, slug) ?? manifest : manifest;
}

/** The existing primary picker card represents its frozen copy too; only a registered, flagged pair can resume it. */
export function primaryShardManifest<T extends EntryIdentity>(manifests: readonly T[], manifest: T): T {
  if (manifest.legacy !== true) return manifest;
  const primary = new Map<string, T>(manifests.map(row => [row.slug, row])).get(manifest.slug.slice(0, -'-legacy'.length));
  return primary !== undefined && legacyShardFor(manifests, primary.slug) === manifest ? primary : manifest;
}

/** A frozen copy is discoverable for an explicit LEGACY entry, while the ordinary picker and grid use the primary manifest. */
export function ordinaryShardManifests<T extends EntryIdentity>(manifests: readonly T[]): readonly T[] {
  return manifests.filter(manifest => manifest.legacy !== true);
}

/** Retirement-only migration: copy missing local entries from the frozen copy, preserving newer primary progress and profile data. Call when deleting the legacy folder, never while the two entries coexist. */
export function migrateRetiredLegacySave(store: SaveStore, primarySlug: string): boolean {
  if (primarySlug.endsWith('-legacy')) throw new Error('Legacy migration requires a primary shard');
  return store.mergeShardEntries(`${primarySlug}-legacy`, primarySlug);
}
