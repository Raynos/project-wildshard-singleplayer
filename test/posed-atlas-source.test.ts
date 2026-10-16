// SHARD-PLATFORM W2a (sp-o288): a posed draw names exactly one atlas source, the GLB model or its own KTX2 file.
import { expect, it } from 'vitest';
import { posedAssets } from '@wildshard/game/plugin/geometry';

const row = { geometry: '/blob/rest', name: 'wildlife', channels: [{ name: 'position', source: 'position', width: 3 }], ranges: [{ kind: 0, start: 0, count: 3, box: [0, 0, 0, 1, 1, 1] }] };

it('refuses a posed draw with both atlas sources or neither, before any file is read', async () => {
  await expect(posedAssets({ ...row, atlasModel: '/assets/birds.glb', atlas: '/blob/birds.base.ktx2' })).rejects.toThrow('exactly one atlas source');
  await expect(posedAssets(row)).rejects.toThrow('exactly one atlas source');
});
