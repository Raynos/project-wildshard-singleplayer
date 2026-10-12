import type { PlaceholderSource } from '@wildshard/format/placeholderSource';

/**
 * Sky Reach's steer for its generated far / near placeholders (G348: declared here as data, read by the generic bakes;
 * no per-shard table outside this folder).
 */
export const PLACEHOLDER = {
  far: { look: { module: 'generators/farLook.ts', export: 'farLook' }, grid: { module: 'generators/farLook.ts', export: 'farGrid' }, parts: { module: 'generators/farLook.ts', export: 'farParts' } },
} as const satisfies PlaceholderSource;
