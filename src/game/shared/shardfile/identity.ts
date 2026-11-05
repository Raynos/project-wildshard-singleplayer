import catalogue from '../grid/singleplayer.json' with { type: 'json' };

const reserved = new Set([...catalogue.placements.map((row) => row.slug.replace(/^_/u, '')), 'global', 'profile', 'device', 'session']);
/** Outside products cannot impersonate a platform shard or a private save namespace. */
export function assertExternalShardSlug(slug: string): void {
  if (reserved.has(slug.replace(/^_/u, ''))) throw new Error('Outside shardfile uses a reserved first-party slug');
}
/** Stable, bounded save key for the exact (origin, slug) pair; paths and revisions do not change progress identity. */
export async function externalShardInstance(base: string, slug: string, hash: (bytes: Uint8Array) => Promise<string>): Promise<string> {
  const url = new URL(base);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Outside shardfiles require an HTTP origin');
  assertExternalShardSlug(slug);
  const identity = await hash(new TextEncoder().encode(JSON.stringify([url.origin, slug])));
  if (!/^[a-f0-9]{64}$/u.test(identity)) throw new Error('Outside shard identity requires a SHA-256 address');
  return `external-${identity}`;
}
