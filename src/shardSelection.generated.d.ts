import type { ShardManifest } from '@wildshard/game/shard/manifest';

/** The selected discovery loaders (D25): written with the shard list by scripts/gen-shards.mjs, never committed. */
export declare const SHARD_LOADERS: Readonly<Record<string, () => Promise<ShardManifest>>>;
/** Each frozen legacy copy's primary shard. */
export declare const LEGACY_CONTENT_IDENTITIES: Readonly<Record<string, string>>;
