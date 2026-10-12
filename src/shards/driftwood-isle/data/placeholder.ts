import type { PlaceholderSource } from '@wildshard/format/placeholderSource';

/**
 * Driftwood Isle's steer for its generated far / near placeholders (G348: declared here as data, read by the generic bakes;
 * no per-shard table outside this folder).
 */
export const PLACEHOLDER = {
  ground: { generator: 'generators/groundRows.ts', export: 'driftwoodGroundBytes' },
  far: { look: { module: 'look/far.ts', export: 'farLook' } },
} as const satisfies PlaceholderSource;
