import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the unchanged committed native terrain source in the offline writer.
import { readFileSync } from 'node:fs';
import { Mesh } from 'three';
import { bakeNalatiGround, nalatiGroundSource } from '../src/shards/nalati-grasslands/generators/nalatiGroundSource';
import { readSourceModel } from '../src/sdk/bake/skinned';

test('Nalati ground error bounds every actual Float64-to-Float32 position conversion', async () => {
  const source = nalatiGroundSource(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')));
  const tiles = bakeNalatiGround(source), isMesh = (node: unknown): node is Mesh => node instanceof Mesh;
  let rounded = 0, exact = 0;
  for (const row of tiles) {
    const { gltf } = await readSourceModel(row.bytes), meshes: Mesh[] = [];
    gltf.scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
    try {
      expect(meshes).toHaveLength(1);
      const geometry = meshes[0]?.geometry, position = geometry?.getAttribute('position');
      if (position === undefined) throw new Error('Missing encoded native ground positions');
      expect(position.count * 3).toBe(row.tile.positions.length);
      let maximum = 0;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const x = row.tile.positions[vertex * 3], y = row.tile.positions[vertex * 3 + 1], z = row.tile.positions[vertex * 3 + 2];
        if (x === undefined || y === undefined || z === undefined) throw new Error('Missing original native position');
        maximum = Math.max(maximum, Math.hypot(x - position.getX(vertex), y - position.getY(vertex), z - position.getZ(vertex)));
      }
      expect(row.geometricError).toBe(maximum);
      if (maximum > 0) rounded++; else exact++;
    } finally {
      for (const mesh of meshes) { mesh.geometry.dispose(); for (const material of [mesh.material].flat()) material.dispose(); }
    }
  }
  expect(rounded).toBeGreaterThan(0);
  expect(rounded + exact).toBe(tiles.length);
});
