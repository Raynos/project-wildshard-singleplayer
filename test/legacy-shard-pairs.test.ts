import { expect, it } from 'vitest';
import { legacyShardFor, ordinaryShardManifests, shardEntryManifest } from '../src/game/shard/legacy';
import { parseShardSlug } from '../src/game/shard/slug';

it('resolves a frozen copy only for LEGACY and preserves the primary entry', () => {
  const primary = { slug: parseShardSlug('coast') };
  const legacy = { slug: parseShardSlug('coast-legacy'), legacy: true as const };
  const manifests = [primary, legacy];
  expect(legacyShardFor(manifests, 'coast')).toBe(legacy);
  expect(shardEntryManifest(manifests, 'coast', 'legacy')).toBe(legacy);
  expect(shardEntryManifest(manifests, 'coast', 'shardfile')).toBe(primary);
  expect(shardEntryManifest(manifests, 'coast-legacy', 'shardfile')).toBeUndefined();
  expect(ordinaryShardManifests(manifests)).toEqual([primary]);
});

it('does not treat an arbitrary suffix or orphan manifest as a frozen pair', () => {
  const primary = { slug: parseShardSlug('coast') };
  const suffix = { slug: parseShardSlug('coast-legacy') };
  const orphan = { slug: parseShardSlug('hill-legacy'), legacy: true as const };
  expect(legacyShardFor([primary, suffix, orphan], 'coast')).toBeUndefined();
  expect(legacyShardFor([primary, suffix, orphan], 'hill')).toBeUndefined();
  expect(shardEntryManifest([primary, suffix, orphan], 'coast', 'legacy')).toBe(primary);
  expect(shardEntryManifest([primary], 'missing', 'legacy')).toBeUndefined();
});
