// oxlint-disable-next-line import/no-nodejs-modules -- The offline candidate uses Nalati's unchanged committed native authority.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Material, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { contentHash } from '@wildshard/sdk/project';
import { bakeNalatiGround, nalatiGroundSource } from '../scripts/bake/nalatiGroundSource';
import { bakeNalatiWorldRowsLod } from '../scripts/bake/nalatiWorldRows';

it('packs an explicit smaller Nalati L1 candidate with truthful error, unchanged L0/native bytes and surviving painterly channels', async () => {
  const native = readFileSync(new URL('../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url)), nativeHash = contentHash(native);
  const original = bakeNalatiGround(nalatiGroundSource(native)), policy = { targetRatio: 0.25, maxErrorMetres: 0.25 };
  const result = await bakeNalatiWorldRowsLod(native, [], 'nalati.ground', policy);
  expect(result.tiles).toHaveLength(80); expect(result.nativeGround.file).toBe(nativeHash);
  expect(result.assets.get(nativeHash)).toEqual(Uint8Array.from(native)); expect(contentHash(native)).toBe(nativeHash);
  let resident = 0, triangles = 0;
  for (const tile of result.tiles) {
    const previous = original.find(row => row.tile.lod === tile.lod && row.tile.x === tile.x && row.tile.z === tile.z);
    if (previous === undefined) throw new Error('Missing native tile');
    if (tile.lod === 0) { expect(tile.files).toEqual([contentHash(previous.bytes)]); expect(tile.geometricError).toBe(0); }
    else {
      expect(tile.geometricError).toBeGreaterThanOrEqual(0); expect(tile.geometricError).toBeLessThanOrEqual(policy.maxErrorMetres);
      resident += tile.decoded + tile.gpu; triangles += tile.triangles;
    }
  }
  const before = original.filter(row => row.tile.lod === 1);
  expect(resident).toBeLessThan(before.reduce((sum, row) => sum + row.cost.decoded + row.cost.gpu, 0));
  expect(triangles).toBeLessThan(before.reduce((sum, row) => sum + row.cost.triangles, 0));
  expect(result.tiles.some(row => row.lod === 1 && row.geometricError > 0)).toBe(true);
  const first = result.tiles.find(row => row.lod === 1 && row.x === 0 && row.z === 0), source = before.find(row => row.tile.x === 0 && row.tile.z === 0);
  const hash = first?.files[0], bytes = hash === undefined ? undefined : result.assets.get(hash);
  if (bytes === undefined || source === undefined) throw new Error('Missing candidate witness');
  const channels = [['normal', 'normal'], ['color', 'color'], ['surf', '_surf'], ['rdir', '_rdir'], ['zone', '_zone']] as const;
  const originalVertices = new Set(Array.from({ length: source.tile.positions.length / 3 }, (_, i) => JSON.stringify([
    ...source.tile.positions.subarray(i * 3, i * 3 + 3), ...channels.flatMap(([name]) => {
      const channel = source.tile.attributes[name]; if (channel === undefined) throw new Error('Missing source channel');
      return Array.from(channel.values.subarray(i * channel.itemSize, (i + 1) * channel.itemSize));
    }),
  ].map(Math.fround))));
  const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, ''); let checked = 0;
  loaded.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: unknown = object.geometry, material: unknown = object.material;
    if (!(geometry instanceof BufferGeometry)) throw new Error('Missing candidate geometry');
    try {
      const position: unknown = geometry.getAttribute('position');
      if (!(position instanceof BufferAttribute)) throw new Error('Missing candidate positions');
      for (let i = 0; i < position.count; i++) {
        const values = [position.getX(i), position.getY(i), position.getZ(i), ...channels.flatMap(([, semantic]) => {
          const channel: unknown = geometry.getAttribute(semantic);
          if (!(channel instanceof BufferAttribute)) throw new Error(`Missing candidate channel ${semantic}`);
          return Array.from({ length: channel.itemSize }, (_, component) => channel.getComponent(i, component));
        })];
        if (!originalVertices.has(JSON.stringify(values))) throw new Error('Simplified wire changed a surviving position or painted channel');
        checked++;
      }
    } finally { geometry.dispose(); if (material instanceof Material) material.dispose(); }
  });
  expect(checked).toBeGreaterThan(0);
}, 120_000); // Real offline native bakes share CPU in the parallel gate; elapsed time is not a verdict.
