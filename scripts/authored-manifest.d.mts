import type { ShardProduct } from './shard-outputs.mjs';

export function shardManifestPath(root: string, slug: string): string;
/** A product's discovery module: its folder's, or one per declared output (SF88g). */
export function productManifestPath(root: string, product: Pick<ShardProduct, 'slug' | 'folder' | 'output'>): string;
export function authoredManifestSource(root: string, slug: string, options?: { generation?: boolean; metadataOnly?: boolean; folder?: string; composed?: Record<string, unknown> | null }): string;
