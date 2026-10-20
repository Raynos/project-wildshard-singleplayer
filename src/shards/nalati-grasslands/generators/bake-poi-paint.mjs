// Retain the exact Mac/V8 float bytes of the former live callers; readers are portable.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { shepherdBody, shepherdArm } from './shepherd.ts';
import { letteringGeometry } from './signLettering.ts';
import { boardSpots } from './painted.ts';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { parseBakedTerrain, bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { snoutGeometry, snoutAt } from './glacierSnout.ts';
import { fitRock } from './fittedRock.ts';
import { hullCandidates, hullAt } from './solid.ts';
import { writeGeometry, join } from './geometryWriter.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = file => JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data', file), 'utf8'));
const signs = read('places.json').rows.find(row => row.name === 'roads').anchors.signposts;
const defaults = read('campCatalogue.json').find(row => row.key === 'signpostBaked').model.defaults;
const posts = signs.map(s => ({ spots: boardSpots(s.x, s.z, s.y, s.boards), boards: s.boards }));
const grid = parseBakedTerrain(Uint8Array.from(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin'))).buffer);
if (grid === null) throw new Error('Missing native glacier terrain');
const ground = bakedSamplers(grid).heightAt, glacierSnout = snoutAt(ground);
const glacier = snoutGeometry(ground), glacierSpecimen = glacier.clone();
glacierSpecimen.translate(-glacierSnout.x, -glacierSnout.y, -glacierSnout.z);
glacierSpecimen.computeBoundingSphere(); glacierSpecimen.computeBoundingBox();
const meshes = [
  ['shepherd-body', shepherdBody()], ['shepherd-arm', shepherdArm()],
  ['sign-labels:roads', letteringGeometry(posts)],
  ['sign-labels:specimen', letteringGeometry([{ spots: boardSpots(0, 0, 0, defaults.boards), boards: defaults.boards }])],
  ['glacier-snout:world', glacier], ['glacier-snout:specimen', glacierSpecimen],
];
const contacts = {};
for (const tier of ['phone', 'desktop']) {
  const layers = {};
  for (const [name, file, half, list] of [
    ['boulder', 'boulder-1', [1, 0.74, 1], read('dressing-boulder.generated.json').filter((_, i) => i % 3 !== 2)],
    ['boulder-tall', 'boulder-2', [0.9, 0.95, 0.9], read('dressing-boulder.generated.json').filter((_, i) => i % 3 === 2)],
    ['slab', 'boulder-3', [1.45, 0.5, 0.95], read('dressing-slab.generated.json')],
  ]) {
    const source = await readSourceModel(readFileSync(resolve(root, `public/assets/nalati/baked/painted-models/${file}${tier === 'phone' ? '.phone' : ''}.glb`)));
    const mesh = source.gltf.scene.children.find(child => child instanceof THREE.Mesh);
    if (mesh === undefined) throw new Error(`Missing prepared rock ${file}`);
    mesh.geometry.deleteAttribute('_paint_clone');
    mesh.geometry.computeBoundingBox();
    const geometry = fitRock({ geometry: mesh.geometry, box: mesh.geometry.boundingBox }, half);
    const candidates = hullCandidates(geometry), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const hulls = list.filter(it => it.solid === true).map(it => {
      matrix.compose(p.set(it.x, it.y, it.z), q.setFromEuler(e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), s.set(it.sx, it.sy, it.sz));
      const hull = hullAt(candidates, matrix, 'rock');
      return hull;
    });
    const points = Float32Array.from(hulls.flatMap(hull => Array.from(hull.points)));
    layers[name] = { origins: hulls.map(hull => [hull.x, hull.y, hull.z, hull.points.length]),
      points: deflateSync(Buffer.from(points.buffer), { level: 9 }).toString('base64') };
    meshes.push([`dressing:${tier}:${name}`, geometry]);
    source.gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const mat of Array.isArray(child.material) ? child.material : [child.material]) mat.dispose(); } });
  }
  contacts[tier] = layers;
}
let totalBytes = 0;
const fingerprint = createHash('sha256');
const rows = meshes.map(([key, geometry]) => {
  const blocks = [], row = writeGeometry(geometry, blocks, key), bytes = join(blocks);
  totalBytes += bytes.length; fingerprint.update(bytes); geometry.dispose();
  return { key, geometry: row, data: deflateSync(bytes, { level: 9 }).toString('base64') };
});
const writer = byteWriter(process.argv.includes('--check'), 'nalati-poi-paint');
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/poiPaint.json'), jsonBytes({ bin: fingerprint.digest('hex'), bytes: totalBytes, rows, glacierSnout, contacts }));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/poiPaint.json'), jsonBytes({ bin: fingerprint.digest('hex'), bytes: totalBytes, rows, glacierSnout, contacts }));
writer.finish();
console.log(`${rows.length} fixed paint meshes, ${totalBytes} raw bytes`);
