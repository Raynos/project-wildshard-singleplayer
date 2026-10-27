#!/usr/bin/env node
// Cheap deterministic world-scene sources: restore the retained native water, bake the existing spray quad offline and lay
// the beaver pool's still and trickle meshes from its baked rows (baked here since GR8; the pool view reads them, G4).
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { streamGeometry } from './streamCodec.ts';
import { bakeStreamRows } from './bake-pine-streams.mjs';
import { bakeBeaverPool } from './beaverPool.ts';
import { pineCragGround } from './bake-pine-crags.mjs';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const project = new URL('../', import.meta.url);
// GR8 G23: the water's raw binary and rows are baked here over the page's ground (no scheduler job, no stored bin)
const { rows: streamRows, bin: original } = bakeStreamRows();
const water = streamGeometry(original, streamRows), quad = new PlaneGeometry(1, 1), placeholder = new MeshStandardMaterial();
/** one pool mesh as generators/beaverPool.ts `pinePoolShapes` draws it: its blocks, indexed, with vertex normals */
const pool = (row) => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(row.position, 3))
    .setAttribute('uv', new Float32BufferAttribute(row.uv, 2)).setAttribute('aWater', new Float32BufferAttribute(row.aWater, 4));
  geometry.setIndex(row.index); geometry.computeVertexNormals(); return geometry;
};
// GR8: the pool is baked here over the page's ground (no scheduler job, no stored rows)
const poolRows = bakeBeaverPool(pineCragGround().heightAt);
const still = pool(poolRows.still), trickle = pool(poolRows.trickle);
const writer = byteWriter(process.argv.includes('--check'), 'pine-scene-models');
try {
  writer.put(fileURLToPath(new URL('assets/stream-scenes/water.glb', project)), staticGlb([{ geometry: water, material: placeholder, compactIndex: true, customAttributes: { _AWATER: 'aWater' } }]));
  writer.put(fileURLToPath(new URL('assets/stream-scenes/quad.glb', project)), staticGlb([{ geometry: quad, material: placeholder, compactIndex: true }]));
  writer.put(fileURLToPath(new URL('assets/pool-scenes/still.glb', project)), staticGlb([{ geometry: still, material: placeholder, customAttributes: { _AWATER: 'aWater' } }]));
  writer.put(fileURLToPath(new URL('assets/pool-scenes/trickle.glb', project)), staticGlb([{ geometry: trickle, material: placeholder, customAttributes: { _AWATER: 'aWater' } }]));
  writer.finish();
} finally { water.dispose(); quad.dispose(); still.dispose(); trickle.dispose(); placeholder.dispose(); }
