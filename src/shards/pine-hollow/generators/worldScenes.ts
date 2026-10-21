import codeParts from '../data/codeParts.json' with { type: 'json' };
import * as v from 'valibot';
import { CaveRowsSchema } from './sections';
import { Matrix4 } from 'three';
import { CRAG_CAVE_ROWS } from './cragSceneContribution';
import { CaveInteriorSchema } from '@wildshard/format/caveInterior';
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import layout from '../data/layout.generated.json' with { type: 'json' };
import { MODEL_SCENES, MODEL_BLOBS, SCENE_MODELS, SCENE_PLACEMENTS } from './sceneModelRows';
import { CABIN_JSON_BLOBS } from './cabinSceneContribution';
import { TREE_SET_BLOB } from './treeSet';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import spray from '../data/sprayPuffs.json' with { type: 'json' };
import { SPRAY_LOOK } from './streamLook';
import waterRows from '../data/waterLook.json' with { type: 'json' };
import { QUEST_RIDE_BLOBS, QUEST_RIDE_MODEL_BLOBS, QUEST_RIDE_LIBRARY, QUEST_RIDE_MATERIAL, QUEST_RIDE_STEP } from './questRideScenes';

const { surfaces: WATER_SURFACES } = waterRows;

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const count = spray.at.length / 3;
if (!Number.isInteger(count) || count > 64) throw new Error('Invalid authored waterfall spray count');
// the spray's instance columns (matrices, seeds, sizes) as one float32 product packet
const matrices = Array.from({ length: count }, (_, i) => new Matrix4().makeTranslation(spray.at[i * 3] ?? 0, spray.at[i * 3 + 1] ?? 0, spray.at[i * 3 + 2] ?? 0).elements).flat();
const SPRAY = 'scenes/streams-spray.bin', sprayPacket = (offset: number) => ({ file: SPRAY, storage: 'f32' as const, byteOffset: count * offset * 4, count });
const recipe = { scene: { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: ['water', 'spray'] },
  { kind: 'mesh', id: 'water', geometry: 'water', material: 'water', missing: 'empty', name: WATER_SURFACES.creek.name, receiveShadow: true, renderOrder: WATER_SURFACES.creek.renderOrder },
  { kind: 'mesh', id: 'spray', geometry: 'quad', material: 'spray', missing: 'empty', name: 'waterfall-spray', renderOrder: 7, frustumCulled: false, instances: count },
], materials: [{ kind: 'port', id: 'water', source: 'water' }, { kind: 'port', id: 'spray', source: 'spray' }] }, imports: [] };
v.parse(CaveRowsSchema, CRAG_CAVE_ROWS);
/** The bear cave (G483 world scene assembly): its baked interior, its mouth's frame, its look near the mouth and its rock. */
const CAVE_INTERIOR = v.parse(CaveInteriorSchema, { product: 'pine-hollow', file: 'world/crag-cave.json', roof: { url: codeParts.url, rows: codeParts.rows, part: codeParts.parts['cave-roof'] }, look: CAVE_LOOK,
  frame: { x: layout.BEAR_CAVE.x, z: layout.BEAR_CAVE.z, yaw: layout.BEAR_CAVE.rot }, rock: { look: CRAG_LOOK, fill: 'caveFill', pbr: 'mossy_rock', grit: 'rock_ground' } });
export const SCENE_BLOBS = [nameBlob('world/crag-cave.json', 'json', encode(CRAG_CAVE_ROWS)), nameBlob('world/cave-interior.json', 'json', encode(CAVE_INTERIOR)), nameBlob('scenes/streams.json', 'json', encode(recipe)),
  nameBlob(SPRAY, 'bin', new Uint8Array(Float32Array.from([...matrices, ...spray.seed, ...spray.size]).buffer)),
  ...CABIN_JSON_BLOBS, TREE_SET_BLOB, ...QUEST_RIDE_BLOBS,
  nameBlob('models/world-scenes.json', 'json', encode(SCENE_MODELS)),
  ...SCENE_PLACEMENTS.map(row => nameBlob(`scenes/placements/${row.id}.json`, 'json', encode(row)))];
export const SCENE_MODEL_BLOBS = [
  { name: 'models/stream-water.glb', kind: 'glb', source: 'assets/stream-scenes/water.glb' },
  { name: 'models/stream-quad.glb', kind: 'glb', source: 'assets/stream-scenes/quad.glb' },
  ...MODEL_BLOBS, ...QUEST_RIDE_MODEL_BLOBS,
];
/** Ordered stream assembly plus named raw-model placement sets, over shared material slots. */
export const WORLD_SCENES: WorldScenesSection = {
  version: 1, catalogue: 'models/world-scenes.json', placements: MODEL_SCENES.placements, batches: MODEL_SCENES.batches, welds: MODEL_SCENES.welds,
  libraries: [...MODEL_SCENES.libraries, QUEST_RIDE_LIBRARY, { id: 'streams', kind: 'owned', models: [
    { id: 'water', file: 'models/stream-water.glb', attributes: { _awater: 'aWater' } },
    { id: 'quad', file: 'models/stream-quad.glb', attributes: {} },
  ] }],
  materials: [...MODEL_SCENES.materials, QUEST_RIDE_MATERIAL, { id: 'water', kind: 'look', look: WATER_SURFACES.creek.look }, { id: 'spray', kind: 'look', look: SPRAY_LOOK }],
  steps: [QUEST_RIDE_STEP, { id: 'streams', scene: 'scenes/streams.json',
    geometry: { water: { library: 'streams', model: 'water' }, quad: { library: 'streams', model: 'quad' } },
    materials: { water: 'water', spray: 'spray' }, registry: [], bounds: [],
    instanceAttributes: [{ part: 'spray', target: 'instanceMatrix', width: 16, packet: sprayPacket(0) },
      { part: 'spray', name: 'aSeed', width: 4, packet: sprayPacket(16) }, { part: 'spray', name: 'aSize', width: 3, packet: sprayPacket(20) }],
    publish: { water: { kind: 'object', part: 'water' }, spray: { kind: 'object', part: 'spray' } },
  }],
};
