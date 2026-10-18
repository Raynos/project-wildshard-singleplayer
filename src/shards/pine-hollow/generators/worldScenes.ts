import * as v from 'valibot';
import { CaveRowsSchema } from './sections';
import { Matrix4 } from 'three';
import { CRAG_CAVE_ROWS } from './cragSceneContribution';
import { MODEL_SCENES, MODEL_BLOBS, SCENE_MODELS, SCENE_PLACEMENTS } from './sceneModelRows';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import spray from '../data/sprayPuffs.json' with { type: 'json' };
import { SPRAY_LOOK } from './streamLook';
import waterRows from '../data/waterLook.json' with { type: 'json' };

const { surfaces: WATER_SURFACES } = waterRows;

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const count = spray.at.length / 3;
if (!Number.isInteger(count) || count > 64) throw new Error('Invalid authored waterfall spray count');
const matrices = Array.from({ length: count }, (_, i) => new Matrix4().makeTranslation(spray.at[i * 3] ?? 0, spray.at[i * 3 + 1] ?? 0, spray.at[i * 3 + 2] ?? 0).elements).flat();
const recipe = { scene: { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: ['water', 'spray'] },
  { kind: 'mesh', id: 'water', geometry: 'water', material: 'water', missing: 'empty', name: WATER_SURFACES.creek.name, receiveShadow: true, renderOrder: WATER_SURFACES.creek.renderOrder },
  { kind: 'mesh', id: 'spray', geometry: 'quad', material: 'spray', missing: 'empty', name: 'waterfall-spray', renderOrder: 7, frustumCulled: false, instances: count, matrices },
], materials: [{ kind: 'port', id: 'water', source: 'water' }, { kind: 'port', id: 'spray', source: 'spray' }] }, imports: [] };
v.parse(CaveRowsSchema, CRAG_CAVE_ROWS);
export const SCENE_BLOBS = [nameBlob('world/crag-cave.json', 'json', encode(CRAG_CAVE_ROWS)), nameBlob('scenes/streams.json', 'json', encode(recipe)),
  nameBlob('models/world-scenes.json', 'json', encode(SCENE_MODELS)),
  ...SCENE_PLACEMENTS.map(row => nameBlob(`scenes/placements/${row.id}.json`, 'json', encode(row)))];
export const SCENE_MODEL_BLOBS = [
  { name: 'models/stream-water.glb', kind: 'glb', source: 'assets/stream-scenes/water.glb' },
  { name: 'models/stream-quad.glb', kind: 'glb', source: 'assets/stream-scenes/quad.glb' },
  ...MODEL_BLOBS,
];
/** Ordered stream assembly plus named raw-model placement sets, over shared material slots. */
export const WORLD_SCENES: WorldScenesSection = {
  version: 1, catalogue: 'models/world-scenes.json', placements: MODEL_SCENES.placements, batches: MODEL_SCENES.batches,
  libraries: [...MODEL_SCENES.libraries, { id: 'streams', kind: 'owned', models: [
    { id: 'water', file: 'models/stream-water.glb', attributes: { _awater: 'aWater' } },
    { id: 'quad', file: 'models/stream-quad.glb', attributes: {} },
  ] }],
  materials: [...MODEL_SCENES.materials, { id: 'water', kind: 'look', look: WATER_SURFACES.creek.look }, { id: 'spray', kind: 'look', look: SPRAY_LOOK }],
  steps: [{ id: 'streams', scene: 'scenes/streams.json',
    geometry: { water: { library: 'streams', model: 'water' }, quad: { library: 'streams', model: 'quad' } },
    materials: { water: 'water', spray: 'spray' }, registry: [], bounds: [],
    instanceAttributes: [{ part: 'spray', name: 'aSeed', width: 4, values: spray.seed }, { part: 'spray', name: 'aSize', width: 3, values: spray.size }],
    publish: { water: { kind: 'object', part: 'water' }, spray: { kind: 'object', part: 'spray' } },
  }],
};
