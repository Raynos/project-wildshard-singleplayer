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
      '/assets/driftwood-isle/baked/fixed-models/trailside.glb',
      '/assets/driftwood-isle/baked/fixed-models/cove-structure.glb',
      '/assets/driftwood-isle/baked/fixed-models/cove-rocks.glb',
      '/assets/driftwood-isle/baked/fixed-models/cove-glow.glb',
      '/assets/driftwood-isle/baked/fixed-models/cove-pools.glb',
      '/assets/driftwood-isle/baked/fixed-models/iron-sword-blade.glb',
      '/assets/driftwood-isle/baked/fixed-models/iron-sword-fittings.glb',
      '/assets/driftwood-isle/baked/fixed-models/captain-hat.glb',
      '/assets/driftwood-isle/baked/fixed-models/sailcloth-cape.glb',
      '/assets/driftwood-isle/baked/fixed-models/boat-hull.glb',
      '/assets/driftwood-isle/baked/fixed-models/boat-sail.glb',
      '/assets/driftwood-isle/baked/fixed-models/boat-gear.glb',
      '/assets/driftwood-isle/baked/fixed-models/trade-counter.glb',
      '/assets/driftwood-isle/baked/fixed-models/trophy-plaques.glb',
      '/assets/driftwood-isle/baked/fixed-models/trophy-drop.glb',
      '/assets/driftwood-isle/baked/fixed-models/sea-glass-chime.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-tuft.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-fern.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-hibiscus.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-daisy.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-pebble.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-shells.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-starfish.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-bush.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-tuftFar.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-fernFar.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-hibiscusFar.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-daisyFar.glb',
      '/assets/driftwood-isle/baked/fixed-models/cover-bushFar.glb',

    ]);
    expect(files.terrain).toHaveLength(1);
    expect(files.terrain.every((url) => url.includes('/baked/driftwood-isle/terrain'))).toBe(true);
    expect(files.baked.length).toBeGreaterThan(0);
    expect(files.baked.every((url) => url.includes('/baked/driftwood-isle/tex/'))).toBe(true);
    expect(files.physics[0]).toBe('/assets/physics/rapier.wasm');
    expect(bootFetches(manifest, files)).toEqual([...files.baked, ...files.terrain, ...files.props]);
  });
});
