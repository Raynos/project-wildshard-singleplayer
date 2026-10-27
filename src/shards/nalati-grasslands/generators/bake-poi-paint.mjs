// Explicit physics authoring only. Normal product construction never invokes this command.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { bakeModelPaint } from './modelPaint.mjs';
import { fitRock } from './fittedRock.ts';
import { hullCandidates, hullAt } from './solid.ts';
import { nativeNalatiDressingPlacements } from './nativeDressingPlacements.mjs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

if (!process.argv.includes('--rebake-contacts')) throw new Error('Contact authoring requires --rebake-contacts');
const root = resolve(import.meta.dirname, '../../../..');
const placements = await nativeNalatiDressingPlacements(file => readFileSync(resolve(root, file)));
const placementRows = key => {
  const bytes = placements.get(`dressing-${key}.json`);
  if (bytes === undefined) throw new Error(`Missing native contact placements: ${key}`);
  return JSON.parse(new TextDecoder().decode(bytes));
};
const contacts = {}, sources = [], writer = byteWriter(process.argv.includes('--check'), 'nalati-poi-contacts');
for (const tier of ['phone', 'desktop']) {
  const layers = {};
  for (const [name, file, half, list] of [
    ['boulder', 'boulder-1', [1, 0.74, 1], placementRows('boulder').filter((_, i) => i % 3 !== 2)],
    ['boulder-tall', 'boulder-2', [0.9, 0.95, 0.9], placementRows('boulder').filter((_, i) => i % 3 === 2)],
    ['slab', 'boulder-3', [1.45, 0.5, 0.95], placementRows('slab')],
  ]) {
    const authored = readFileSync(resolve(root, `public/assets/nalati/models/${file}${tier === 'phone' ? '.phone' : ''}.glb`));
    const source = await readSourceModel(await bakeModelPaint(authored, file));
    const mesh = source.gltf.scene.children.find(child => child instanceof THREE.Mesh);
    if (mesh === undefined) throw new Error(`Missing prepared rock ${file}`);
    mesh.geometry.deleteAttribute('_paint_clone'); mesh.geometry.computeBoundingBox();
    const geometry = fitRock({ geometry: mesh.geometry, box: mesh.geometry.boundingBox }, half);
    const candidates = hullCandidates(geometry), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const hulls = list.filter(it => it.solid === true).map(it => {
      matrix.compose(p.set(it.x, it.y, it.z), q.setFromEuler(e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), s.set(it.sx, it.sy, it.sz));
      return hullAt(candidates, matrix, 'rock');
    });
    const points = Float32Array.from(hulls.flatMap(hull => Array.from(hull.points)));
    const blockPath = `data/poi-contacts-${tier}-${name}.bin`, blobName = `models/contacts/${tier}-${name}.bin`;
    writer.put(resolve(root, 'src/shards/nalati-grasslands', blockPath), deflateSync(Buffer.from(points.buffer), { level: 9 }));
    sources.push({ name: blobName, kind: 'bin', source: blockPath, options: { decoded: points.byteLength } });
    layers[name] = { origins: hulls.map(hull => [hull.x, hull.y, hull.z, hull.points.length]), file: blobName };
    geometry.dispose();
    source.gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const mat of Array.isArray(child.material) ? child.material : [child.material]) mat.dispose(); } });
  }
  contacts[tier] = layers;
}
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/poiContacts.json'), jsonBytes({ contacts, sources }));
writer.finish();
