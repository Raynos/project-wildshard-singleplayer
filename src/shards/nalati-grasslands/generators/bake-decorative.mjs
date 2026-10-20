import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decorativeRows } from './decorative.ts';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const writer = byteWriter(process.argv.includes('--check'), 'nalati-decorative');
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/decorative.generated.json'), jsonBytes(withPortableMath(() => decorativeRows(new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')))))));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/decorative.generated.json'), jsonBytes(withPortableMath(() => decorativeRows(new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')))))));
const places = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/places.json'), 'utf8'));
const scenes = Object.fromEntries(places.rows.filter(row => !row.name.startsWith('actor:')).map(row => {
  const nodes = row.meshes.map((mesh, i) => ({ kind: 'mesh', id: `mesh-${i}`, geometry: `mesh-${i}`, material: mesh.material,
    missing: 'empty', ...(mesh.name === '' ? {} : { name: mesh.name }), castShadow: mesh.material !== 'yard', receiveShadow: true, ...(mesh.material === 'yard' ? { renderOrder: 1 } : {}) }));
  const children = row.meshes.map((mesh, i) => ({ slot: mesh.slot, id: `mesh-${i}` })).sort((a, b) => a.slot - b.slot).map(child => child.id);
  if (row.group !== null) nodes.unshift({ kind: 'group', id: 'root', ...(row.group === '' ? {} : { name: row.group }), children });
  return [row.name, { version: 1, root: row.group === null ? 'mesh-0' : 'root', nodes,
    materials: [...new Set(row.meshes.map(mesh => mesh.material))].map(id => ({ id, kind: 'port', source: id })) }];
}));
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/poiScenes.generated.json'), jsonBytes(scenes));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/poiScenes.generated.json'), jsonBytes(scenes));
writer.finish();
