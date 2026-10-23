// oxlint-disable-next-line import/no-nodejs-modules -- This artifact test reads the generated GLBs from disk.
import { readFile } from 'node:fs/promises';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve each declared output's generated artifact path.
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, test } from 'vitest';
import declared from '../src/shards/open-plots/outputs.json' with { type: 'json' };
import plot from '../src/shards/open-plots/data/plot.json' with { type: 'json' };
import { outputs } from '../src/shards/open-plots/generators/product';

test('every plot product has no beam graph or beam-height rows', () => {
  expect(plot).not.toHaveProperty('beam');
  expect(Object.keys(outputs)).toEqual(declared.outputs.map(row => row.slug));
  for (const output of Object.values(outputs)) {
    expect(output.look.materials).not.toHaveProperty('beam');
    expect(output.world.materials).not.toHaveProperty('Beam');
    expect(output.world.far).toBe('far_');
  }
});

test('all regenerated plot worlds omit corner beacons and near/far beam geometry', async () => {
  const io = new NodeIO();
  for (const row of declared.outputs) {
    const bytes = new Uint8Array(await readFile(resolve('src/shards/open-plots/assets', row.idea, 'world.glb')));
    const doc = await io.readBinary(bytes), nodes = doc.getRoot().listNodes(), names = nodes.map(node => node.getName());
    expect(names, row.slug).toContain('far_hologram');
    expect(names, row.slug).toContain('ws_terrain_floor');
    expect(names, row.slug).toContain('collide_plot');
    expect(names.some(name => /beam|beacon/iu.test(name)), row.slug).toBe(false);
    expect(doc.getRoot().listMaterials().some(material => /beam/iu.test(material.getName())), row.slug).toBe(false);
    let cornerVerticesAboveFloor = 0;
    for (const node of nodes) {
      const mesh = node.getMesh();
      if (mesh === null) continue;
      for (const primitive of mesh.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION');
        if (positions === null) throw new Error('Missing plot positions');
        const point: number[] = [];
        for (let index = 0; index < positions.getCount(); index++) {
          positions.getElement(index, point);
          const [x, y, z] = point;
          if (x === undefined || y === undefined || z === undefined) throw new Error('Missing plot vertex');
          if (Math.abs(x) > 242 && Math.abs(z) > 242 && y > 1) cornerVerticesAboveFloor++;
        }
      }
    }
    expect(cornerVerticesAboveFloor, row.slug).toBe(0);
  }
});
