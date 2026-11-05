// oxlint-disable-next-line import/no-nodejs-modules -- The bake's inputs are the checkout's own files.
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { expect, test } from 'vitest';
import declared from '../outputs.json' with { type: 'json' };
import { outputs } from './product';
import { readImagePixels, writeImagePixels } from '@wildshard/sharddev/bake/image';
import { normalizeWorldGlb } from '@wildshard/sharddev/bake/world';
import { ideaWorld } from './plotBake.mjs';

test('every plot product has no beam graph or beam-height rows', () => {
  expect(Object.keys(outputs)).toEqual(declared.outputs.map(row => row.slug));
  for (const output of Object.values(outputs)) {
    for (const retired of ['beam', 'hologram', 'floor', 'kerb', 'plinth', 'frame', 'rim', 'sign'])
      expect(output.look.materials).not.toHaveProperty(retired);
    expect(Object.values(output.world.materials).some(id =>
      ['hologram', 'floor', 'kerb', 'plinth', 'frame', 'rim', 'sign'].includes(id))).toBe(false);
    expect(output.look.materials).toHaveProperty('billboard');
    expect(output.world.farMode).toBe('replace');
    expect(output.world.materials).not.toHaveProperty('Beam');
    expect(output.world.far).toBe('far_');
  }
});

test('all baked plot worlds omit corner beacons and near/far beam geometry', async () => {
  const io = new NodeIO(), read = (path: string): Uint8Array => new Uint8Array(readFileSync(path));
  for (const row of declared.outputs) {
    expect(row, row.slug).toHaveProperty('layout');
    const bytes = await ideaWorld(row, read, { readImagePixels, writeImagePixels, normalizeWorldGlb });
    const doc = await io.readBinary(bytes), nodes = doc.getRoot().listNodes(), names = nodes.map(node => node.getName());
    // G641: a tiled plot (a row with a layout) stands its landmark and its tiles in the far proxy instead of a hologram
    for (const name of ['far_landmark', 'far_tiles']) expect(names, row.slug).toContain(name);
    expect(names, row.slug).not.toContain('far_hologram');
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
    // a tiled plot (a row with a layout, NM9) builds its house courts out to its corner tiles' corners; it has no beacons
    const slug = row.slug;
    if (!('layout' in row)) expect(cornerVerticesAboveFloor, slug).toBe(0);
  }
}, 300_000);


test('a plot without a tiled layout refuses before reading retired art', async () => {
  let reads = 0;
  const read = (): Uint8Array => { reads++; return new Uint8Array(); };
  await expect(ideaWorld({ slug: 'open-plot-test', idea: 'test', name: 'Test', accent: 'periwinkle' }, read,
    { readImagePixels, writeImagePixels, normalizeWorldGlb })).rejects.toThrow('a plot needs its tiled layout');
  expect(reads).toBe(0);
});


test.each([false, true])('the retired placeholder flag refuses before art reads (%s)', async placeholder => {
  let reads = 0;
  const read = (): Uint8Array => { reads++; return new Uint8Array(); };
  const retired = { slug: 'open-plot-test', idea: 'test', name: 'Test', accent: 'periwinkle', layout: 'test', placeholder };
  await expect(ideaWorld(retired, read, { readImagePixels, writeImagePixels, normalizeWorldGlb }))
    .rejects.toThrow('placeholder worlds are retired');
  expect(reads).toBe(0);
});
