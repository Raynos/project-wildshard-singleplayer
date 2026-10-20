import { expect, test } from 'vitest';
import { DataTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { parseWorldScenes } from '../src/format/worldScenes';
import { applyTextureSampler } from '../src/game/shardfile/clientMaterials';
import textures from '../src/shards/nine-dragon-stack/data/signTextureSources.json' with { type: 'json' };

test('sign product rows bind the original three textures with the original GPU mip samplers', () => {
  const rows = parseWorldScenes({ version: 1, libraries: [], materials: [], steps: [], lent: textures }).lent;
  expect(rows.map(row => row.kind === 'product' ? row.publish : undefined)).toEqual(['signs.mono', 'signs.colour', 'signs.sdf']);
  for (const row of rows) {
    if (row.kind !== 'product') throw new Error('Sign atlas needs a product texture');
    const texture = new DataTexture(new Uint8Array(4), 1, 1); applyTextureSampler(texture, row.sampler);
    expect(texture.generateMipmaps).toBe(true); expect(texture.mipmaps).toEqual([]);
    expect(texture.minFilter).toBe(LinearMipmapLinearFilter); expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.anisotropy).toBe(row.param === 'sdf' ? 4 : 8);
    expect(row.looks).toEqual([row.param === 'sdf' ? 'nine-neon-tube' : 'nine-neon']);
    texture.dispose();
  }
});
