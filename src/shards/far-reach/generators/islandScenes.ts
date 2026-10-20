import { MeshBasicMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { bakeSkyIsles } from './isles';
import { ISLES } from './layout';
import { RISING_ISLETS } from './risingIslets';
import isleProps from '../data/props.json' with { type: 'json' };
import { fallGeometry } from './fallGeometry';

// The same original shapes and normal calculation as isleProps/islandMesh. The twelve static islands are read from
// the shardfile's baked L0 tiles (isleProps.ts: each island whole, partitioned over the tiles), moved back
// into the island's own frame; only the moving islets and the fall stay owned scene geometry.
// Geometry is identity-space; scene rows retain all placement doubles.
const baked = bakeSkyIsles(), pack = new GeometryPack(baked.bin, packedRows(baked.rows), 'island scenes');
const material = new MeshBasicMaterial();
export const SKY_ISLAND_BLOBS: NamedBlob[] = [];
const models: { readonly id: string; readonly file: string }[] = [];
const tiled = [...ISLES, ...RISING_ISLETS.map(entry => entry.gate)];
for (const [index, id] of baked.rows.isles.entries()) {
  if (tiled.some(isle => isle.id === id)) continue;
  const file = `world/geometry/${id.replaceAll('.', '-')}.glb`, geometry = pack.geometry(index);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  try { SKY_ISLAND_BLOBS.push(nameBlob(file, 'glb', compressGlb(staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }], id)))); }
  finally { geometry.dispose(); }
  models.push({ id, file });
}
const fall = fallGeometry(1, 1);
try {
  const file = 'world/geometry/fall.glb';
  SKY_ISLAND_BLOBS.push(nameBlob(file, 'glb', compressGlb(staticGlb([{ geometry: fall, material, nativeAttributes: true, compactIndex: true }], 'fall'))));
  models.push({ id: 'fall', file });
} finally { fall.dispose(); material.dispose(); }
export const SKY_ISLAND_LIBRARY = { id: 'islands', kind: 'owned', models } as const;
/** The static islands as whole parts of the baked tiles (`library: 'isle-tiles'`), each in its own frame. A partitioned
 * island may span tiles: the reader reads each file once and reassembles every island from its parts. */
export const SKY_ISLE_TILES = { id: 'isle-tiles', kind: 'whole', models: tiled.map(isle => ({ id: isle.id, part: `isle_${isle.id.replace('.', '-')}`,
  files: isleProps.props.tiles.map(tile => tile.file), matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0 - isle.x, 0 - isle.y, 0 - isle.z, 1] })) } as const;
