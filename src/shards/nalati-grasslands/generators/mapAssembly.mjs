import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { MapAssembly, mapBinary, mapGeometry, mapModel, mapForest, readMapJson } from '../../../../scripts/map-assembly.mjs';
import { mapPool } from '../../../../scripts/map-world.mjs';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import { mapCloth } from './mapCloth.mjs';

const base = resolve(import.meta.dirname, '..'), root = resolve(base, '../../..');
const read = file => readMapJson(resolve(base, file));
const pose = p => new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromEuler(new Euler(p.pitch ?? p.tiltX ?? 0, p.rot ?? p.yaw ?? 0, p.roll ?? p.tiltZ ?? 0, 'YXZ')),
  new Vector3(p.sx ?? p.scale ?? p.s ?? 1, p.sy ?? p.scale ?? p.s ?? 1, p.sz ?? p.scale ?? p.s ?? 1));
const asset = row => mapModel(resolve(root, `public${row.url}`), row.geometrySlot ?? 0);
const painted = row => mapGeometry(new Uint8Array(inflateSync(Buffer.from(row.data, 'base64'))), 0, row.geometry);

export async function nalatiMapAssembly() {
  const assembly = new MapAssembly(), prepared = read('boot/placeRuntime.generated.json'), specimens = read('data/specimens.generated.json');
  const fixed = read('boot/poiPaint.json'), bytes = mapBinary(resolve(root, 'public/assets/nalati/baked/places.bin'), true);
  const native = parseBakedTerrain(Uint8Array.from(readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin'))).buffer);
  if (native === null) throw new Error('Map requires native Nalati terrain');
  const ground = bakedSamplers(native).heightAt, cloth = [];
  const actor = key => { const row = fixed.rows.find(candidate => candidate.key === key); if (row === undefined) throw new Error(`Missing map paint ${key}`); return painted(row); };
  const names = [...prepared.view.sequence.map(step => step.name), 'outcrops', 'dressing-statics', 'dressing-clutter'];
  for (const name of names) {
    const row = prepared.places.rows.find(candidate => candidate.name === name);
    if (row === undefined) { if (!['balbals', 'farHerds', 'snowLotus', 'glacier'].includes(name)) throw new Error(`Missing map place ${name}`); continue; }
    for (const mesh of row.meshes) assembly.add(`poi:${name}:${mesh.name}`, mapGeometry(bytes, mesh.offset, mesh.geometry));
    // Members with inKit=true already inhabit the meshes above. Model members
    // with inKit=false are the exact prepared instance scenes, never specimens.
    for (const [id, instance] of row.instances) assembly.add(`poi:${name}:model:${id}`, await asset(instance.asset), instance.placements.map(pose));
    cloth.push(...row.effects);
  }
  assembly.add('road-lettering', actor('sign-labels:roads'));
  assembly.add('glacier', actor('glacier-snout:world'));
  const balbal = await asset(specimens.assets.balbal), size = read('boot/modelMetrics.generated.json').sizes.balbal[1], k = 2.15 / size;
  balbal.rotateY(Math.PI).scale(k, k, k);
  const statues = prepared.places.rows.find(row => row.name === 'kurgans').anchors.balbalSpots;
  assembly.add('balbals', balbal, statues.map(p => pose({ ...p, y: ground(p.x, p.z) - .18 * (p.scale ?? 1), roll: p.tilt ?? 0 })));
  const decorative = read('boot/decorative.generated.json').desktop;
  assembly.add('snow-lotus', await asset(specimens.assets.snowLotus), decorative.lotus.poses.map(pose));
  assembly.add('far-herds', await asset(specimens.assets.herdHorse), decorative.horses.member.placements.map(p => new Matrix4().fromArray(p.matrix)));
  const kokpar = read('boot/layout.generated.json').KOKPAR, riders = prepared.places.rows.find(row => row.name === 'kokpar').anchors.riders;
  const c = Math.cos(kokpar.rot), s = Math.sin(kokpar.rot);
  assembly.add('kokpar-riders', await asset(specimens.assets.kokparRider), riders.map((r, i) => {
    const lx = Math.cos(r.t) * kokpar.rx * r.k, lz = Math.sin(r.t) * kokpar.rz * r.k;
    const tx = -Math.sin(r.t) * kokpar.rx, tz = Math.cos(r.t) * kokpar.rz;
    const x = kokpar.x + lx * c + lz * s, z = kokpar.z - lx * s + lz * c, ph = i * 1.7;
    return pose({ x, z, y: ground(x, z) + (.5 + .5 * Math.sin(ph * 2 - .4)) * .16 - .06,
      rot: Math.atan2(tx * c + tz * s, -tx * s + tz * c) + Math.sin(ph) * .025, roll: -.14 + Math.sin(ph) * .03, pitch: Math.sin(ph + 1.1) * .07 });
  }));
  const dressingBytes = mapBinary(resolve(root, 'public/assets/nalati/baked/dressing.bin'), true);
  for (const [name, key] of [['boulder', 'boulder'], ['boulder-tall', 'boulder'], ['slab', 'slab'], ['stone', 'stone'], ['juniper', 'juniper'], ['rose', 'rose'], ['willow', 'willow'], ['lupin', 'lupin'], ['daisy', 'daisy'], ['reed', 'reed']]) {
    let list = read(`data/dressing-${key}.generated.json`);
    if (name === 'boulder') list = list.filter((_, i) => i % 3 !== 2);
    if (name === 'boulder-tall') list = list.filter((_, i) => i % 3 === 2);
    const fitted = ['boulder', 'boulder-tall', 'slab'].includes(name);
    const row = prepared.dressing.rows.find(candidate => candidate.key === name);
    const geometry = fitted ? actor(`dressing:desktop:${name}`) : mapGeometry(dressingBytes, row.offset, row.geometry);
    assembly.add(`dressing:${name}`, geometry, list.map(pose));
  }
  const crags = read('boot/cragRock.generated.json').desktop, cragBytes = mapBinary(resolve(root, 'public/assets/nalati/baked/crags.bin'), true);
  for (const mesh of crags.meshes) assembly.add(mesh.key, mapGeometry(cragBytes, mesh.offset, mesh.row));
  // The engine's pure forest placer reads exactly the same native samples and
  // baked geography mask as the page. No shard manifest or runtime is imported.
  const geography = read('boot/geography.generated.json'), layout = read('boot/layout.generated.json'), discovery = read('data/discovery.json');
  const channel = key => bakedSamplers({ ...native, res: geography.res, size: geography.size,
    heights: new Float32Array(Uint8Array.from(inflateSync(Buffer.from(key === 'pond' ? geography.ground.mask.values.data : geography.channels[key].values.data, 'base64'))).buffer) }).heightAt;
  const trails = [layout.S_ROAD_PTS, layout.N_ROAD_PTS, layout.E_ROAD_PTS, layout.W_ROAD_PTS, layout.SKY_ROAD, layout.CAMP_SPUR,
    ...layout.BOWL_TRACKS, layout.EAGLE_TRAIL, layout.CAVE_TRAIL, layout.ARGYMAQ_TRAIL];
  const field = { ...buildTerrainMetadata(native.seed, { trails, cabinSites: [] }, () => geography.river.level), ...bakedSamplers(native), pondMask: channel('pond') };
  const spruce = read('data/spruceRest.generated.json');
  const trees = mapForest({ slug: 'nalati-grasslands', label: 'map', seed: native.seed, treeCount: 1400 }, field,
    { ...discovery.forest, mask: channel('forest') }, spruce.variants.map(row => ({ trunkRadius: row.trunk, height: row.height })));
  const shapes = await mapPool(resolve(root, `public${spruce.geometry}`));
  for (const i of spruce.variants.keys()) {
    const matrices = trees.filter(tree => tree.variant === i).map(tree => pose({ ...tree, yaw: tree.rot }));
    for (const [part, key] of [['trunk', 'trunk'], ['hi', 'cardsHi'], ['twigs', 'twigs']]) {
      const geometry = shapes.get(`spruce-${i}__${part}`); if (geometry === undefined) throw new Error(`Missing map spruce ${i}/${part}`);
      assembly.add(`spruce:${i}:${key}`, geometry, matrices);
    }
  }
  assembly.add('cloth', mapCloth(cloth, [-.92, -.38, 1]));
  return { assembly, native };
}

if (import.meta.main) { const { assembly } = await nalatiMapAssembly(); assembly.write(resolve(base, 'data/mapAssembly.generated')); }
