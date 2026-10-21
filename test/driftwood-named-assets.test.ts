import { expect, test } from 'vitest';
import lateReadRows from '../src/shards/driftwood-isle/data/boot-lateReads.generated.json' with { type: 'json' };
import { resolveBootFiles, bootLateReads } from '../src/engine/boot/filePolicy';
import { DRIFTWOOD_BOOT_FILES } from '../src/shards/driftwood-isle/generators/bootRecipes';
import { GPU_FILES } from '../src/shards/driftwood-isle/ktx2.generated';

test('only the five migrated public prefetch groups retire; remaining boot content stays selected', () => {
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    const previous = resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, mode, GPU_FILES);
    const migrated = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, mode, GPU_FILES)));
    const remaining = bootLateReads(lateReadRows, tier, mode);
    expect(remaining).toEqual(previous.filter(url => !migrated.has(url)));
    expect(remaining).toContain('/assets/lut/driftwood-isle.bin');
    expect(remaining.every(url => !migrated.has(url))).toBe(true);
  }
});
