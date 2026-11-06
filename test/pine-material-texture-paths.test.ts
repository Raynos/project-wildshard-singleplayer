import { expect, test } from 'vitest';
import { registerGpuFiles, setTexturePolicy, standIn, texModeWhy } from '../src/engine/client/boot/gpuFiles';
import { GPU_FILES as ENGINE_GPU_FILES } from '../src/engine/client/boot/ktx2.generated';
import { initializeTier, TIER } from '../src/engine/client/core/tier';
import { pineKtx2Tables } from '../src/shards/pine-hollow/generators/bootInventory';
import mounts from '../src/shards/pine-hollow/mounts.json' with { type: 'json' };
import { GPU_FILES as PINE_GPU_FILES } from '../src/shards/pine-hollow/ktx2.generated';
import { originalPineAstcAliases } from './fixtures/pine-astc';

test('Pine phone material paths read the ASTC6 overlay in shard and grid', () => {
  const astc = originalPineAstcAliases();
  const materials = Object.entries(astc).filter(([source]) => source.endsWith('.phone.glb')
    && (/\/(?:dead_tree_trunk|rock_moss_set_01|tree_stump_01)\//u.test(source) || source.includes('/pine-hollow-hero/')));
  expect(materials).toHaveLength(11);
  const tables = pineKtx2Tables(astc), originalTier = TIER;
  const fourByFour = { ...ENGINE_GPU_FILES.phone, ...PINE_GPU_FILES.phone }, shipped = JSON.stringify(mounts);
  try {
    initializeTier('phone');
    setTexturePolicy('ktx2', 'pine-hollow');
    expect(texModeWhy()).toEqual({ mode: 'ktx2', why: 'auto: level tier texture policy' });
    registerGpuFiles(tables.shard);
    for (const [source, selectedInShard] of materials) {
      expect(standIn(source, texModeWhy().mode)).toBe(selectedInShard);
      expect(standIn(source, 'img')).toBeUndefined();
      // S4: what a phone picks is what the shard ships: its 4×4 twin left the mounts, so a read of it would find nothing
      expect(shipped).toContain(selectedInShard);
      expect(shipped).not.toContain(fourByFour[source]);
    }
    registerGpuFiles(tables.grid);
    for (const [source, selectedInGrid] of materials) {
      expect(standIn(source, texModeWhy().mode)).toBe(selectedInGrid);
      expect(standIn(source, 'img')).toBeUndefined();
    }
    expect(tables.grid.desktop).toEqual(PINE_GPU_FILES.desktop);
  } finally {
    registerGpuFiles(ENGINE_GPU_FILES);
    registerGpuFiles(PINE_GPU_FILES);
    initializeTier(originalTier);
    setTexturePolicy(undefined);
  }
});
