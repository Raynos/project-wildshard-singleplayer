import { MeshBasicMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { bakeSkyIsles } from './isles';
import { fallGeometry } from './fallGeometry';

// The same original shapes and normal calculation as isleProps/islandMesh.
// Geometry is identity-space; scene rows retain all placement doubles.
const baked = bakeSkyIsles(), pack = new GeometryPack(baked.bin, packedRows(baked.rows), 'island scenes');
const material = new MeshBasicMaterial();
export const SKY_ISLAND_BLOBS: NamedBlob[] = [];
const models: { readonly id: string; readonly file: string }[] = [];
for (const [index, id] of baked.rows.isles.entries()) {
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
