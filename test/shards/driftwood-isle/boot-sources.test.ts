import { afterEach, describe, expect, it } from 'vitest';
import { chunkFiles } from '../../../src/engine/boot/manifest';
import { bootFetches } from '../../../src/engine/boot/prefetch';
import { registerGpuFiles } from '../../../src/engine/boot/gpuFiles';
import { initializeTier, TIER } from '../../../src/engine/core/tier';
import manifest from '../../../src/shards/driftwood-isle/manifest';
import { GPU_FILES } from '../../../src/shards/driftwood-isle/ktx2.generated';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';

const original = TIER;
afterEach(() => { initializeTier(original); });

describe('Driftwood boot sources (E357 S4.1, 08 §6.1 step 7)', () => {
  it.each([['phone', 'img'], ['phone', 'ktx2'], ['desktop', 'img'], ['desktop', 'ktx2']] as const)('%s / %s: only the island\'s baked reads', (tier, tex) => {
    initializeTier(tier);
    registerGpuFiles(GPU_FILES);
    const files = chunkFiles(manifest, tex);
    expect(files).toMatchObject({ sky: [], trees: [], cabins: [], props: Object.values(FIXED_MODEL_FILES), art: [], music: [], sfx: [] });
    expect(files.props).toEqual([
      '/assets/driftwood-isle/baked/fixed-models/captain-hat.glb',
      '/assets/driftwood-isle/baked/fixed-models/sea-glass-chime.glb',
    ]);
    expect(files.terrain).toHaveLength(1);
    expect(files.terrain.every((url) => url.includes('/baked/driftwood-isle/terrain'))).toBe(true);
    expect(files.baked.length).toBeGreaterThan(0);
    expect(files.baked.every((url) => url.includes('/baked/driftwood-isle/tex/'))).toBe(true);
    expect(files.physics[0]).toBe('/assets/physics/rapier.wasm');
    expect(bootFetches(manifest, files)).toEqual([...files.baked, ...files.terrain, ...files.props]);
  });
});
