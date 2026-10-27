import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { decodeBuildDeflate, encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import { MapAssembly, mapModelBytes } from '@wildshard/sdk/bake/mapAssembly';
import { MapRaster } from '@wildshard/sdk/bake/mapRaster';
import { bakedGeometryBytes, readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { readNativeScalarField, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakeForestPlacements, nativeTerrainQueries } from '@wildshard/sdk/bake/forest';
import { mapCloth } from './mapCloth.mjs';
import { bakeDressing } from './dressingGeometryRows.ts';
import { decorativeRowsOnGround } from './decorative.ts';
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { nativeNalatiDressingPlacements } from './nativeDressingPlacements.mjs';
import { nalatiPoiPaintFromInputs, POI_PAINT_INPUTS } from './poiPaintProgram.ts';
import { nalatiGeographySources, nalatiGeographyRows } from './geographySource.ts';
import { nalatiCragRock } from './cragRockProgram.ts';
import { nalatiSprucePool, SPRUCE_REST } from './sprucePool.ts';

// GR6: a pure producer. The caller supplies every input as bytes by its repository path (`source(path)`); no file, script,
// format or engine service is read here.
const SHARD = 'src/shards/nalati-grasslands/';
const mapJson = bytes => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  (_key, value) => value === '-0' ? -0 : value === 'Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value);
/** A baked geometry block, expanded when its row asks (the map's original reader). */
function mapGeometry(bytes, offset, row) {
  const geometry = readBakedGeometry(bytes, offset, row);
  if (!row.expand || geometry.index === null) return geometry;
  const expanded = geometry.toNonIndexed(); geometry.dispose(); return expanded;
}
/** A pool GLB's local templates by node name: positions and colours only, in each node's own space. */
async function mapPool(bytes) {
  const doc = await new MapRaster(1, {}).document(bytes), result = new Map();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (mesh === null) continue;
    if (mesh.listPrimitives().length !== 1) throw new Error('Map pool requires one primitive');
    const primitive = mesh.listPrimitives()[0], geometry = new BufferGeometry();
    for (const [semantic, name] of [['POSITION', 'position'], ['COLOR_0', 'color']]) {
      const attribute = primitive.getAttribute(semantic); if (attribute === null) continue;
      const data = []; for (let i = 0; i < attribute.getCount(); i++) data.push(...attribute.getElement(i, []).slice(0, 3));
      geometry.setAttribute(name, new Float32BufferAttribute(data, 3));
    }
    const indices = primitive.getIndices(); if (indices !== null) geometry.setIndex(Array.from(indices.getArray()));
    const id = node.getName() === '' ? mesh.getName() : node.getName(); if (result.has(id)) throw new Error(`Duplicate map pool geometry ${id}`); result.set(id, geometry);
  }
  return result;
}
const pose = p => new Matrix4().compose(new Vector3(p.x, p.y, p.z), new Quaternion().setFromEuler(new Euler(p.pitch ?? p.tiltX ?? 0, p.rot ?? p.yaw ?? 0, p.roll ?? p.tiltZ ?? 0, 'YXZ')),
  new Vector3(p.sx ?? p.scale ?? p.s ?? 1, p.sy ?? p.scale ?? p.s ?? 1, p.sz ?? p.scale ?? p.s ?? 1));

/** Paint only requested authored models once per assembly; no public painted-model input. */
function ownedModelReader(source) {
  const models = new Map();
  return async row => {
    const path = typeof row.url === 'string' ? row.url : row.url?.file;
    const prefix = typeof row.url === 'string' ? '/assets/nalati/baked/painted-models/' : 'models/painted/';
    if (typeof path !== 'string') throw new Error('Map model requires a declared source');
    if (!path.startsWith(prefix)) {
      if (typeof row.url !== 'string') throw new Error('Map model requires its painted file');
      return mapModelBytes(source(`public${path}`), row.geometrySlot ?? 0);
    }
    const name = path.slice(prefix.length);
    let bytes = models.get(name);
    if (bytes === undefined) {
      const { nalatiModelPaintProgram } = await import('./modelPaintProgram.ts');
      const files = await nalatiModelPaintProgram({ cached: (step, make) => {
        const inputs = new Map();
        for (const input of step.inputs ?? []) inputs.set(input, source(`public${input}`));
        return Promise.resolve(make(inputs));
      } }, [name]);
      bytes = files.get(name);
      if (bytes === undefined) throw new Error(`Missing owned map model ${name}`);
      models.set(name, bytes);
    }
    if (typeof row.url !== 'string' && bytes.byteLength !== row.url.bytes) throw new Error(`Map model byte count differs: ${name}`);
    return mapModelBytes(bytes, row.geometrySlot ?? 0);
  };
}

/** Read a prepared scalar file from its owned bank; the modern map never consumes inline content.
 * @param {unknown} source @param {ReadonlyMap<string, Uint8Array>} directory */
export function readNalatiMapScalar(source, directory) {
  if (source === null || typeof source !== 'object' || !('file' in source) || typeof source.file !== 'string')
    throw new Error('Nalati map requires named binary scalar files');
  const bytes = directory.get(source.file);
  if (bytes === undefined) throw new Error(`Missing owned geography channel ${source.file}`);
  return bytes;
}

/** Native construction and the defining row preparation own map geometry/metadata.
 * The raw words never cross a compressed public or prepared-runtime handoff. */
async function nativeMapPlaces(paint, geography, source) {
  const { nativeNalatiPlaces } = await import('./bake-nalati-painted.mjs');
  const { nalatiRuntimeRows } = await import('./runtimeRows.ts');
  const { nalatiSpecimenRows } = await import('./specimenRows.ts');
  const made = await nativeNalatiPlaces(geography);
  const places = { rows: made.places.rows, bytes: made.places.bin.byteLength };
  const prepared = nalatiRuntimeRows({ places, paint }).runtime;
  const specimens = nalatiSpecimenRows(mapJson(source(`${SHARD}data/campCatalogue.json`)), mapJson(source(`${SHARD}data/campMaterials.json`)),
    { rows: made.specimens.rows, bytes: made.specimens.bin.byteLength });
  return { prepared, bytes: made.places.bin, specimens };
}

/** @param {(path: string) => Uint8Array} source every input by its repository path */
export async function nalatiMapAssembly(source) {
  const read = file => mapJson(source(`${SHARD}${file}`));
  const geographyFiles = nalatiGeographySources();
  const paintFiles = await nalatiPoiPaintFromInputs(new Map(POI_PAINT_INPUTS.map(file => [file, source(`public${file}`)])));
  const document = paintFiles.get('data/poiPaint.json');
  if (document === undefined) throw new Error('Missing owned map paint');
  const fixed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(document));
  const assembly = new MapAssembly(), { prepared, bytes, specimens } = await nativeMapPlaces(fixed, geographyFiles, source);
  const placements = await nativeNalatiDressingPlacements(file => source(file), geographyFiles);
  const asset = ownedModelReader(source);
  const terrain = readNativeTerrain(source('public/assets/baked/nalati-grasslands/terrain.bin')), native = terrain.grid;
  const ground = terrain.heightAt, cloth = [];
  const actor = key => { const row = fixed.rows.find(candidate => candidate.key === key); if (row === undefined) throw new Error(`Missing map paint ${key}`); const lane = paintFiles.get(row.file); if (lane === undefined) throw new Error(`Missing owned map paint ${row.file}`); return mapGeometry(lane, 0, row.geometry); };
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
  const balbal = await asset(specimens.assets.balbal), size = read('data/modelMetrics.json').sizes.balbal[1], k = 2.15 / size;
  balbal.rotateY(Math.PI).scale(k, k, k);
  const statues = prepared.places.rows.find(row => row.name === 'kurgans').anchors.balbalSpots;
  assembly.add('balbals', balbal, statues.map(p => pose({ ...p, y: ground(p.x, p.z) - .18 * (p.scale ?? 1), roll: p.tilt ?? 0 })));
  const decorative = withPortableMath(() => decorativeRowsOnGround(ground)).desktop;
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
  const dressingBytes = bakeDressing().bin;
  for (const [name, key] of [['boulder', 'boulder'], ['boulder-tall', 'boulder'], ['slab', 'slab'], ['stone', 'stone'], ['juniper', 'juniper'], ['rose', 'rose'], ['willow', 'willow'], ['lupin', 'lupin'], ['daisy', 'daisy'], ['reed', 'reed']]) {
    const placementBytes = placements.get(`dressing-${key}.json`);
    if (placementBytes === undefined) throw new Error(`Missing native map dressing: ${key}`);
    let list = JSON.parse(new TextDecoder().decode(placementBytes));
    if (name === 'boulder') list = list.filter((_, i) => i % 3 !== 2);
    if (name === 'boulder-tall') list = list.filter((_, i) => i % 3 === 2);
    const fitted = ['boulder', 'boulder-tall', 'slab'].includes(name);
    const row = prepared.dressing.rows.find(candidate => candidate.key === name);
    const geometry = fitted ? actor(`dressing:desktop:${name}`) : mapGeometry(dressingBytes, row.offset, row.geometry);
    assembly.add(`dressing:${name}`, geometry, list.map(pose));
  }
  // the crag bank: both tiers' lane-shuffled blocks in one deflate stream
  const cragRows = nalatiCragRock(source('public/assets/baked/nalati-grasslands/terrain.bin')).rows, crags = cragRows.desktop;
  const cragWords = Math.max(...['phone', 'desktop'].flatMap(tier => cragRows[tier].meshes.map(mesh => mesh.offset + bakedGeometryBytes(mesh.row))));
  const cragLanes = decodeBuildDeflate(source('public/assets/nalati/baked/crags.bin'), cragWords), cragBytes = new Uint8Array(cragLanes.length);
  for (let b = 0, n = cragLanes.length / 4; b < 4; b++) for (let i = 0; i < n; i++) cragBytes[i * 4 + b] = cragLanes[b * n + i];
  for (const mesh of crags.meshes) assembly.add(mesh.key, mapGeometry(cragBytes, mesh.offset, mesh.row));
  // The engine's pure forest placer reads exactly the same native samples and
  // baked geography mask as the page. No shard manifest or runtime is imported.
  const geography = nalatiGeographyRows(), layout = read('boot/layout.generated.json'), discovery = read('data/discovery.json');
  const channel = key => readNativeScalarField(key === 'pond' ? geography.ground.mask : geography.channels[key], geographyFiles).sample;
  const trails = [layout.S_ROAD_PTS, layout.N_ROAD_PTS, layout.E_ROAD_PTS, layout.W_ROAD_PTS, layout.SKY_ROAD, layout.CAMP_SPUR,
    ...layout.BOWL_TRACKS, layout.EAGLE_TRAIL, layout.CAVE_TRAIL, layout.ARGYMAQ_TRAIL];
  const { grid: _grid, ...samplers } = terrain;
  const field = { ...nativeTerrainQueries(native.seed, { trails, cabinSites: [] }, () => geography.river.level), ...samplers, pondMask: channel('pond') };
  const spruce = SPRUCE_REST;
  const trees = bakeForestPlacements({ ...field, seed: native.seed, treeCount: 1400, forest: { ...discovery.forest, mask: channel('forest') } },
    spruce.variants.map(row => ({ trunkRadius: row.trunk, height: row.height }))).trees;
  const shapes = await mapPool(nalatiSprucePool());
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

/** Native map painting consumes owned bytes, without a source-file handoff.
 * @param {(path: string) => Uint8Array} source every input by its repository path */
export async function nalatiMapFiles(source) {
  const { assembly } = await nalatiMapAssembly(source);
  try {
    const { json, binary } = assembly.pack();
    return new Map([['map/assembly.json', json], ['map/geometry.bin', encodeBuildBytes(binary, 'deflate', 6, 'native')]]);
  } finally { for (const shape of assembly.shapes) { shape.geometry.dispose(); shape.material.dispose(); } }
}
