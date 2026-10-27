// Cheap deterministic world-scene sources: restore the retained native water, the spray quad and the beaver pool's
// still and trickle meshes from their baked rows. GR8 G27: `pineWorldSceneModels` gives the four GLBs by product name;
// worldScenes.ts names them in memory (no scheduler job, no stored files under assets/).
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { streamGeometry } from './streamCodec.ts';
import { bakeStreamRows } from './bake-pine-streams.mjs';
import { bakeBeaverPool } from './beaverPool.ts';
import { pineCragGround } from './bake-pine-crags.mjs';

/** one pool mesh as generators/beaverPool.ts `pinePoolShapes` draws it: its blocks, indexed, with vertex normals */
const pool = (row) => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(row.position, 3))
    .setAttribute('uv', new Float32BufferAttribute(row.uv, 2)).setAttribute('aWater', new Float32BufferAttribute(row.aWater, 4));
  geometry.setIndex(row.index); geometry.computeVertexNormals(); return geometry;
};

/** The world scenes' four raw models (stream water and spray quad, pool still and trickle) by product name. */
export function pineWorldSceneModels() {
  const { rows, bin } = bakeStreamRows(), water = streamGeometry(bin, rows), quad = new PlaneGeometry(1, 1), placeholder = new MeshStandardMaterial();
  const poolRows = bakeBeaverPool(pineCragGround().heightAt), still = pool(poolRows.still), trickle = pool(poolRows.trickle);
  try {
    return new Map([
      ['models/stream-water.glb', staticGlb([{ geometry: water, material: placeholder, compactIndex: true, customAttributes: { _AWATER: 'aWater' } }])],
      ['models/stream-quad.glb', staticGlb([{ geometry: quad, material: placeholder, compactIndex: true }])],
      ['models/pool-still.glb', staticGlb([{ geometry: still, material: placeholder, customAttributes: { _AWATER: 'aWater' } }])],
      ['models/pool-trickle.glb', staticGlb([{ geometry: trickle, material: placeholder, customAttributes: { _AWATER: 'aWater' } }])],
    ]);
  } finally { water.dispose(); quad.dispose(); still.dispose(); trickle.dispose(); placeholder.dispose(); }
}
