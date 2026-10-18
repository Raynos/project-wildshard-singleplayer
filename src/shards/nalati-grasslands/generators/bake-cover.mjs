// Small-model construction runs offline; the client borrows immutable packed shapes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { fitRock } from './fittedRock.ts';
import { wingGeo, halfBirdGeo, buildMarmotGeometry } from './ambientGeometry.ts';
import { writeGeometry, join } from './geometryWriter.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const root = resolve(import.meta.dirname, '../../../..'), shard = resolve(import.meta.dirname, '..');
const read = path => JSON.parse(readFileSync(resolve(shard, path), 'utf8'));
const dressing = read('data/dressingGeos.json');
const lanes = inflateSync(readFileSync(resolve(root, 'public/assets/nalati/baked/dressing.bin')));
const raw = new Uint8Array(lanes.length), words = raw.length / 4;
for (let b = 0; b < 4; b++) for (let i = 0; i < words; i++) raw[i * 4 + b] = lanes[b * words + i];
const bytesOf = geometry => geometry.attrs.reduce((sum, [, type, size]) => sum + Math.ceil(geometry.count * size * (type === 'f32' ? 4 : type === 'u8' || type === 'i8' ? 1 : 2) / 4) * 4, 0) + geometry.indexCount * 4;
const sources = new Map(); let offset = 0;
for (const row of dressing.rows) { const bytes = bytesOf(row.geometry); sources.set(row.key, { geometry: row.geometry, bytes: raw.slice(offset, offset + bytes) }); offset += bytes; }
if (offset !== raw.length) throw new Error('Cover shapes do not cover dressing bytes');
for (const tier of ['phone', 'desktop']) for (const [name, model, half] of [['boulder', 'boulder-1', [1, 0.74, 1]], ['boulder-tall', 'boulder-2', [0.9, 0.95, 0.9]], ['slab', 'boulder-3', [1.45, 0.5, 0.95]]]) {
  const loaded = await readSourceModel(readFileSync(resolve(root, `public/assets/nalati/baked/painted-models/${model}${tier === 'phone' ? '.phone' : ''}.glb`)));
  const mesh = loaded.gltf.scene.children.find(child => child instanceof THREE.Mesh);
  if (mesh === undefined) throw new Error(`Missing prepared cover rock ${model}`);
  mesh.geometry.deleteAttribute('_paint_clone'); mesh.geometry.computeBoundingBox();
  const geometry = fitRock({ geometry: mesh.geometry, box: mesh.geometry.boundingBox }, half), parts = [];
  const row = writeGeometry(geometry, parts, name); sources.set(`dressing:${tier}:${name}`, { geometry: row, bytes: join(parts) }); geometry.dispose();
  loaded.gltf.scene.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); } });
}
const file = 'src/shards/nalati-grasslands/generators/bake-cover.mjs';
const materials = {
  rock: { id: 'nalati-dress-rock', family: 'painterly', rim: 0.3, bands: 0.8 },
  shrub: { id: 'nalati-dress-shrub', family: 'painterly', rim: 0.5, bands: 0.7, sway: 0.05 },
  flower: { id: 'nalati-dress-flower', family: 'painterly', rim: 0.45, bands: 0.6, sway: 0.3 },
  reed: { id: 'nalati-dress-reed', family: 'painterly', rim: 0.5, bands: 0.6, sway: 0.1 },
  butterfly: { id: 'nalati-butterfly', family: 'painterly', rim: 0.3, bands: 0.5 },
  raptor: { id: 'nalati-raptor', family: 'painterly', rim: 0.6, bands: 0.6 },
  marmot: { id: 'nalati-marmot', family: 'painterly', rim: 0.8, bands: 0.85 },
};
const hue = ['#f08a2a', '#f4f1e2', '#7fa0f0', '#f2d23c', '#f4f1e2', '#e9702a'];
const sites = read('data/ambientSites.json');
const flock = (seed, count, scale, centre, radius, altitude, speed, butterfly = false) => ({
  seed, count, scale, foot: 0.35, wingbeat: 'beat',
  flight: { wave: 0.7, amplitude: butterfly ? 0.2 : 3, pitch: 0.7, pitchRate: 4, bank: 0.5, bankLimit: 0.75, bankRate: 2.5 },
  wingbeats: { beat: { phase: [butterfly ? 12 : 5.5, 1], amplitude: butterfly ? 1.15 : 0.55, foldPhase: 0.6, foldAmplitude: 0, rest: [0.12, 0], rates: [6, 6], glide: butterfly ? [0.2, 0.8] : [3, 9], beats: [2, 4] } },
  wheeling: { centre, radius, loops: [[0, 0]], loopRadius: [0.6, 1], speed: [speed, speed], altitude: [altitude, altitude], bodyScale: [0.9, 1.1], bodyAltitude: [0, 0], perchAfter: [8, 18], bank: 0.5,
    wheel: { xAmplitude: 0.05, xFrequency: 2, zScale: 1, zAmplitude: 0.05, zFrequency: 3, altitudeFrequency: 0.7, altitudeAmplitude: butterfly ? 0.25 : 3, detailFrequency: 1.7, detailAmplitude: butterfly ? 0.1 : 0.5 } },
  perch: butterfly ? { share: 0.25, flush: 2.2, flushJitter: [1, 1], settle: 0.3, clear: 4, idle: [0.6, 2.2], every: [3, 7], hop: { chance: 0, duration: 0.3, height: 0.2, turn: 0.9 }, head: { rate: 0, range: 0, duration: [0.3, 0.3] }, takeoff: { duration: 1.2, out: 5, up: 2, beats: 6, bank: 0.2 }, landing: { speed: 1.3, minimum: 1, rise: 0.6, flare: 0.8, bank: 0.2 } } : null,
  guide: null, call: null, scavenge: null, visit: null, channels: [['flap', 0, 0, 0], null], attributes: ['aAnim', null], system: { id: `ambient.${seed}`, after: [], before: [] },
});
const profiles = {};
for (const phone of [true, false]) {
  const blocks = [], rows = [], catalogue = [];
  const add = (key, name, shape, material, params = {}, variants = [], id = key, category = 'nature') => {
    catalogue.push({ key, model: { id: `nalati-grasslands/${id}`, name, file, category, pipeline: key === 'boulder' || key === 'slab' ? ['hunyuan', 'code'] : 'code', defaults: params, variants,
      ...(key === 'stone' ? { surface: 'stone' } : key === 'boulder' || key === 'slab' ? { surface: 'rock' } : category === 'creatures' ? { surface: 'flesh' } : {}) }, source: { kind: 'packed' } });
    for (const p of [params, ...variants.map(variant => ({ ...params, ...variant.params }))]) {
      const geometry = typeof shape === 'function' ? shape(p) : shape;
      let part;
      if (typeof geometry === 'string') { const source = sources.get(geometry); if (source === undefined) throw new Error(`Missing cover geometry ${geometry}`); blocks.push(source.bytes); part = source.geometry; }
      else { part = writeGeometry(geometry, blocks, key); geometry.dispose(); }
      rows.push({ key: `nalati-grasslands/${id} ${JSON.stringify(p)}`, parts: [{ material: (key === 'boulder' || key === 'slab') && p.source === 'generated' ? (key === 'slab' ? 'boulder-3' : p.tall ? 'boulder-2' : 'boulder-1') : material, geometry: part }] });
    }
  };
  add('boulder', 'Boulder', p => p.source === 'code' ? `boulder:${phone ? 2 : 3}` : `dressing:${phone ? 'phone' : 'desktop'}:${p.tall ? 'boulder-tall' : 'boulder'}`, 'rock', { source: 'generated', tall: false }, [{ id: 'round', label: 'Hunyuan3D-2', params: {} }, { id: 'tall', label: 'Hunyuan3D-2 · tall', params: { tall: true } }, { id: 'code', label: 'Code', params: { source: 'code' } }]);
  add('slab', 'Outcrop slab', p => p.source === 'code' ? `slab:${phone ? 2 : 3}` : `dressing:${phone ? 'phone' : 'desktop'}:slab`, 'rock', { source: 'generated', tall: false }, [{ id: 'generated', label: 'Hunyuan3D-2', params: {} }, { id: 'code', label: 'Code', params: { source: 'code' } }]);
  for (const [key, id, name, shape, material] of [
    ['stone', 'stone', 'Fieldstone / cobble', 'stone', 'rock'], ['juniper', 'juniper', 'Juniper', 'juniper', 'shrub'],
    ['wildRose', 'wild-rose', 'Wild rose', phone ? 'rose:lite' : 'rose', 'shrub'], ['dwarfWillow', 'dwarf-willow', 'Dwarf willow', 'willow', 'shrub'],
    ['lupin', 'lupin', 'Sage / lupin drift', phone ? 'lupin:lite' : 'lupin', 'flower'], ['daisy', 'daisy', 'Edelweiss / buttercup drift', 'daisy', 'flower'], ['reeds', 'reed', 'Reeds', 'reed', 'reed'],
  ]) add(key, name, shape, material, {}, [], id);
  const pair = (half, angle, scale, tint, pitch, roll) => {
    const body = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, roll, 'YXZ')), new THREE.Vector3().setScalar(scale));
    const right = half().applyMatrix4(new THREE.Matrix4().multiplyMatrices(body, new THREE.Matrix4().makeRotationZ(angle)));
    const left = half().applyMatrix4(new THREE.Matrix4().multiplyMatrices(body, new THREE.Matrix4().makeScale(-1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(-angle))));
    // Keep the two mirrored halves as one indexed shape, including the original painted vertex tint.
    const geometry = new THREE.BufferGeometry(), positions = [], normals = [], colors = [], indices = [];
    for (const part of [right, left]) {
      const first = positions.length / 3;
      for (const name of ['position', 'normal', 'color']) { const attribute = part.getAttribute(name), target = name === 'position' ? positions : name === 'normal' ? normals : colors; for (let i = 0; i < attribute.count; i++) target.push(attribute.getX(i) * (name === 'color' ? tint.r : 1), attribute.getY(i) * (name === 'color' ? tint.g : 1), attribute.getZ(i) * (name === 'color' ? tint.b : 1)); }
      for (let i = 0; i < part.index.count; i++) indices.push(first + part.index.getX(i)); part.dispose();
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); return geometry;
  };
  add('butterfly', 'Butterfly', p => pair(wingGeo, 1, 2.8, new THREE.Color(p.hue), -0.25, 0), 'butterfly', { hue: hue[0] }, ['orange', 'cream', 'blue', 'gold', 'rust'].map((id, i) => ({ id, label: id, params: { hue: hue[[0, 1, 2, 3, 5][i]] } })), 'butterfly', 'creatures');
  add('raptor', 'Raptor', p => pair(halfBirdGeo, 0.4, p.scale, new THREE.Color(1, 1, 1), 0.05, 0.32), 'raptor', { scale: 1.3 }, [{ id: 'kite', label: 'Kite', params: { scale: 1.3 } }, { id: 'eagle', label: 'Eagle', params: { scale: 1.7 } }], 'raptor', 'creatures');
  add('marmot', 'Grey marmot', () => buildMarmotGeometry(), 'marmot', {}, [], 'marmot', 'creatures');
  for (const [key, build, material] of [['wing', wingGeo, 'butterfly'], ['halfBird', halfBirdGeo, 'raptor'], ['marmot', buildMarmotGeometry, 'marmot']]) { const geometry = build(); rows.push({ key, parts: [{ material, geometry: writeGeometry(geometry, blocks, key) }] }); geometry.dispose(); }
  const bin = join(blocks), shuffled = new Uint8Array(bin.length), n = bin.length / 4;
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) shuffled[b * n + i] = bin[i * 4 + b];
  const tier = phone ? 'phone' : 'desktop', url = `/assets/nalati/baked/cover-${tier}.bin`;
  profiles[tier] = { catalogue, packed: { bin: url, bytes: bin.length, rows } };
  profiles[tier].life = [
    { kind: 'butterfly', perches: sites, row: { ...flock(0xb077, phone ? 14 : 30, 2.8, { x: 0, z: 0 }, 6, 0.7, 1.3, true), wheeling: null, perch: null,
      visit: { enter: [0, 1], stay: [0, 1], every: 0.001, near: [2.2, 45], from: { kind: 'behind', back: 4, up: 1 }, speed: 1.3, lift: 0.6, approach: [0, 0], cling: 0, sag: 0.1,
        pose: { pitch: 0.25, body: 0, legs: 0, stand: 0.5, peck: 0 }, sway: 0, stare: 0, stareTurn: 0, look: [0, 0], within: 55, callCue: null, flushCall: false, gain: 0, call: null,
        acts: { first: [0.6, 2.2], every: [0.6, 2.2], hitch: [0, 0], call: 0, drum: null }, flush: 2.2, flushLegs: 0, relocate: [4, 12], aim: false, leave: 55, leaveWait: 0.001,
        depart: { distance: 8, up: [1, 2], speed: 4.5, lift: 1, spread: 0.8 } } } },
    ...[{ x: 60, z: 140, alt: 30, r: 48 }, { x: -60, z: -110, alt: 34, r: 40 }, { x: 110, z: -60, alt: 40, r: 34 }].map((spot, i) => ({ kind: 'raptor', perches: [], row: flock(0x9011e + i, 1, i === 2 ? 1.7 : 1.3, { x: spot.x, z: spot.z }, spot.r, spot.alt, 9) })),
  ];
  profiles[tier].bytes = shuffled;
}
const writer = byteWriter(process.argv.includes('--check'), 'nalati-cover');
for (const name of ['boulder-1', 'boulder-2', 'boulder-3']) {
  const glb = readFileSync(resolve(root, `public/assets/nalati/baked/painted-models/${name}.glb`)), size = glb.readUInt32LE(12), document = JSON.parse(glb.subarray(20, 20 + size).toString()), binary = 28 + size;
  const image = document.images[0], view = document.bufferViews[image.bufferView], url = `/assets/nalati/baked/cover-${name}.webp`;
  if (image.mimeType !== 'image/webp') throw new Error('Prepared cover atlas must be WebP');
  writer.put(resolve(root, `public${url}`), glb.subarray(binary + (view.byteOffset ?? 0), binary + (view.byteOffset ?? 0) + view.byteLength));
  materials[name] = { id: `nalati-cover-${name}`, family: 'painterly', rim: 0.3, bands: 0.8, texture: { url, phoneUrl: url, name } };
}
for (const [tier, profile] of Object.entries(profiles)) { writer.put(resolve(root, `public/assets/nalati/baked/cover-${tier}.bin`), deflateSync(profile.bytes, { level: 9 })); delete profile.bytes; }
writer.put(resolve(shard, 'boot/cover.generated.json'), jsonBytes({ ...profiles, materials, butterflies: { phone: 14, desktop: 30 }, hue, flyScale: 2.8, raptors: 3 }));
writer.finish();
