import { MeshBasicMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import { bakeSignalSkirt } from './skirt';

// Read the original pack at build time. Lossless GLB encoding retains every
// vertex, normal, colour and index; the ordinary Z2 host owns the live copies.
const baked = bakeSignalSkirt(), pack = new GeometryPack(baked.bytes, packedRows(baked.rows), 'skirt');
const material = new MeshBasicMaterial();
export const SIGNAL_SKIRT_BLOBS: NamedBlob[] = [];
const models: { readonly id: string; readonly file: string }[] = [], steps: WorldScenesSection['steps'] = [];
for (const [index, cube] of (['standalone', 'cell'] as const).entries()) {
  const id = `skirt-${cube}`, file = `world/geometry/${id}.glb`, scene = 'world/scenes/skirt.json';
  const geometry = pack.geometry(index);
  try { SIGNAL_SKIRT_BLOBS.push(nameBlob(file, 'glb', compressGlb(staticGlb([{ geometry, material, compactIndex: true }], id)))); }
  finally { geometry.dispose(); }
  models.push({ id, file });
  const recipe = parseWorldScene({ scene: { version: 1, root: 'root', nodes: [
    { id: 'root', kind: 'group', children: ['skirt'] },
    // Z2 admits the required geometry and material before constructing this
    // private scene; its legacy mesh policy is unreachable for missing inputs.
    { id: 'skirt', kind: 'mesh', geometry: 'skirt', material: 'sand', receiveShadow: false, castShadow: false, renderOrder: -1, missing: 'empty' },
  ], materials: [{ id: 'sand', kind: 'port', source: 'sand' }] }, imports: [] });
  if (index === 0) SIGNAL_SKIRT_BLOBS.push(nameBlob(scene, 'json', new TextEncoder().encode(JSON.stringify(recipe))));
  steps.push({ id, cube, scene, geometry: { skirt: { library: 'skirt', model: id } }, materials: { sand: 'sand' },
    registry: [], publish: {}, instanceAttributes: [], bounds: [] });
}
material.dispose();
export const SIGNAL_SKIRT_LIBRARY = { id: 'skirt', kind: 'owned', models };
export const SIGNAL_SKIRT_STEPS = steps;
