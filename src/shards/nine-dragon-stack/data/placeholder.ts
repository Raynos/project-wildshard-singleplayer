import type { PlaceholderSource } from '@wildshard/format/placeholderSource';

/**
 * Nine Dragon Stack's steer for its generated far / near placeholders (G348: declared here as data, read by the generic bakes;
 * no per-shard table outside this folder).
 */
export const PLACEHOLDER = {
  far: { look: { module: 'look/far.ts', export: 'farLook' }, grid: { module: 'look/far.ts', export: 'farGrid' } },
} as const satisfies PlaceholderSource;
