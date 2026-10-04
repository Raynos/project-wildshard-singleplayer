import { afterEach, describe, expect, it } from 'vitest';
import { chunkFiles } from '#engine-internal/boot/manifest';
import { bootFetches } from '#engine-internal/boot/prefetch';
import { registerGpuFiles } from '#engine-internal/boot/gpuFiles';
import { initializeTier, TIER } from '#engine-internal/core/tier';
import manifest from '#shards/driftwood-isle/manifest';
import { GPU_FILES } from '#shards/driftwood-isle/ktx2.generated';

const original = TIER;
afterEach(() => { initializeTier(original); });

describe('Driftwood boot sources (E357 S4.1, 08 §6.1 step 7)', () => {
  it.each([['phone', 'img'], ['phone', 'ktx2'], ['desktop', 'img'], ['desktop', 'ktx2']] as const)('%s / %s: only the island\'s baked reads', (tier, tex) => {
    initializeTier(tier);
    registerGpuFiles(GPU_FILES);
    const files = chunkFiles(manifest, tex);
    // what the engine's open-water / low-poly branches gave (verified file for file against them when they moved here)
    expect(files).toMatchObject({ sky: [], trees: [], cabins: [], props: [], art: [], music: [], sfx: [] });
    expect(files.terrain).toHaveLength(1);
    expect(files.terrain.every((url) => url.includes('/baked/driftwood-isle/terrain'))).toBe(true);
    expect(files.baked.length).toBeGreaterThan(0);
    expect(files.baked.every((url) => url.includes('/baked/driftwood-isle/tex/'))).toBe(true);
    expect(files.physics[0]).toBe('/assets/physics/rapier.wasm');
    expect(bootFetches(manifest, files)).toEqual([...files.baked, ...files.terrain]);
  });
});
