import { riderGeometry } from './ghostFigure.ts';
// Retain the exact Mac/V8 float bytes of the former live callers; readers are portable.
import { readFileSync } from 'node:fs';
import { bakeModelPaint } from './modelPaint.mjs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { shepherdBody, shepherdArm } from './shepherd.ts';
import { letteringGeometry } from './signLettering.ts';
import { nalatiRoadSignposts } from './roadSigns.ts';
import { boardSpots } from './painted.ts';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { parseBakedTerrain, bakedSamplers } from '@wildshard/engine/world/BakedTerrain';
import { snoutGeometry, snoutAt } from './glacierSnout.ts';
import { fitRock } from './fittedRock.ts';
import { hullCandidates, hullAt } from './solid.ts';
import { writeGeometry, join } from './geometryWriter.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { nativeNalatiDressingPlacements } from './nativeDressingPlacements.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const read = file => JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data', file), 'utf8'));
const defaults = read('campCatalogue.json').find(row => row.key === 'signpostBaked').model.defaults;
const grid = parseBakedTerrain(Uint8Array.from(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin'))).buffer);
if (grid === null) throw new Error('Missing native glacier terrain');
const ground = bakedSamplers(grid).heightAt, glacierSnout = snoutAt(ground);
const posts = nalatiRoadSignposts(ground).map(s => ({ spots: boardSpots(s.x, s.z, s.y, s.boards), boards: s.boards }));
const glacier = snoutGeometry(ground), glacierSpecimen = glacier.clone();
glacierSpecimen.translate(-glacierSnout.x, -glacierSnout.y, -glacierSnout.z);
glacierSpecimen.computeBoundingSphere(); glacierSpecimen.computeBoundingBox();
const meshes = [
  ['ghost-rider', riderGeometry()], ['ghost-captain', riderGeometry(true)],
  ['shepherd-body', shepherdBody()], ['shepherd-arm', shepherdArm()],
  ['sign-labels:roads', letteringGeometry(posts)],
  ['sign-labels:specimen', letteringGeometry([{ spots: boardSpots(0, 0, 0, defaults.boards), boards: defaults.boards }])],
  ['glacier-snout:world', glacier], ['glacier-snout:specimen', glacierSpecimen],
];
// Shape conversion retains the native contact bake. Its explicit authoring mode is a separate physics change.
const rebakeContacts=process.argv.includes('--rebake-contacts'),retained=read('poiContacts.json');
const placements=rebakeContacts?await nativeNalatiDressingPlacements(file=>readFileSync(resolve(root,file))):new Map();
const placementRows=key=>{
  const bytes=placements.get(`dressing-${key}.json`);
  if(bytes===undefined)throw new Error(`Missing native contact placements: ${key}`);
  return JSON.parse(new TextDecoder().decode(bytes));
};
const contacts=rebakeContacts?{}:retained.contacts;
const sources=rebakeContacts?[]:retained.sources,writer = byteWriter(process.argv.includes('--check'), 'nalati-poi-paint');
for (const tier of ['phone', 'desktop']) {
  const layers = {};
  for (const [name, file, half, list] of [
    ['boulder', 'boulder-1', [1, 0.74, 1], rebakeContacts?placementRows('boulder').filter((_, i) => i % 3 !== 2):[]],
    ['boulder-tall', 'boulder-2', [0.9, 0.95, 0.9], rebakeContacts?placementRows('boulder').filter((_, i) => i % 3 === 2):[]],
    ['slab', 'boulder-3', [1.45, 0.5, 0.95], rebakeContacts?placementRows('slab'):[]],
  ]) {
    const authored = readFileSync(resolve(root, `public/assets/nalati/models/${file}${tier === 'phone' ? '.phone' : ''}.glb`));
    const source = await readSourceModel(await bakeModelPaint(authored, file));
    const mesh = source.gltf.scene.children.find(child => child instanceof THREE.Mesh);
    if (mesh === undefined) throw new Error(`Missing prepared rock ${file}`);
    mesh.geometry.deleteAttribute('_paint_clone');
    mesh.geometry.computeBoundingBox();
    const geometry = fitRock({ geometry: mesh.geometry, box: mesh.geometry.boundingBox }, half);
    if(rebakeContacts){
    const candidates = hullCandidates(geometry), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const hulls = list.filter(it => it.solid === true).map(it => {
      matrix.compose(p.set(it.x, it.y, it.z), q.setFromEuler(e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ')), s.set(it.sx, it.sy, it.sz));
      const hull = hullAt(candidates, matrix, 'rock');
      return hull;
    });
    const points = Float32Array.from(hulls.flatMap(hull => Array.from(hull.points)));
    const blockPath=`data/poi-contacts-${tier}-${name}.bin`,blobName=`models/contacts/${tier}-${name}.bin`;
    writer.put(resolve(root,'src/shards/nalati-grasslands',blockPath),deflateSync(Buffer.from(points.buffer),{level:9}));
    sources.push({name:blobName,kind:'bin',source:blockPath,options:{decoded:points.byteLength}});
    layers[name] = { origins: hulls.map(hull => [hull.x, hull.y, hull.z, hull.points.length]),file:blobName };
    }
    meshes.push([`dressing:${tier}:${name}`, geometry]);
    source.gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const mat of Array.isArray(child.material) ? child.material : [child.material]) mat.dispose(); } });
  }
  if(rebakeContacts)contacts[tier] = layers;
}
let totalBytes = 0;
const fingerprint = createHash('sha256');
const rows = meshes.map(([key, geometry], index) => {
  const blocks = [], row = writeGeometry(geometry, blocks, key), bytes = join(blocks);
  totalBytes += bytes.length; fingerprint.update(bytes); geometry.dispose();
  const file = `data/poi-shape-${index}.bin`;
  writer.put(resolve(root, 'src/shards/nalati-grasslands', file), bytes);
  let bounds;
  if(key==='glacier-snout:world'){
    const positions=row.attrs[0];if(positions?.[0]!=='position'||positions[1]!=='f32'||positions[2]!==3||positions[3])throw new Error('Glacier bounds require its first float32 position channel');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),box=new THREE.Box3(),point=new THREE.Vector3();
    for(let i=0;i<row.count;i++)box.expandByPoint(point.set(view.getFloat32(i*12,true),view.getFloat32(i*12+4,true),view.getFloat32(i*12+8,true)));
    bounds=[box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z];
  }
  const result={key,geometry:row,file,name:`models/shapes/paint-${index}.bin`};
  if(bounds!==undefined)Object.assign(result,{bounds});return result;
});
if(rebakeContacts)writer.put(resolve(root,'src/shards/nalati-grasslands/data/poiContacts.json'),jsonBytes({contacts,sources}));
const fingerprintHex = fingerprint.digest('hex');
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/poiPaint.json'), jsonBytes({ bin: fingerprintHex, bytes: totalBytes, rows, glacierSnout, contacts,sources }));
writer.put(resolve(root, 'src/shards/nalati-grasslands/data/poiPaint.json'), jsonBytes({ bin: fingerprintHex, bytes: totalBytes, rows, glacierSnout, contacts,sources }));
writer.finish();
console.log(`${rows.length} fixed paint meshes, ${totalBytes} raw bytes`);
