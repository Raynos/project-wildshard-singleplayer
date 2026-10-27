
import codeParts from '../data/codeParts.json' with { type: 'json' };
import * as v from 'valibot';
import { CaveRowsSchema } from './sections';
import { Matrix4 } from 'three';
import { cragScene } from './cragSceneContribution';
import { CaveInteriorSchema } from '@wildshard/format/caveInterior';
import { CRAG_LOOK, CAVE_LOOK } from './cragLook';
import * as layout from './layout';
import { sceneModelRows } from './sceneModelRows';
import { cabinScene } from './cabinSceneContribution';
import { nameBlob, nameMeshoptBlob, type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { pineWorldSceneModels } from './bake-world-scene-models.mjs';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import spray from '../data/sprayPuffs.json' with { type: 'json' };
import { SPRAY_LOOK } from './streamLook';
import waterRows from '../data/waterLook.json' with { type: 'json' };
import { QUEST_RIDE_BLOBS, QUEST_RIDE_LIBRARY, QUEST_RIDE_MATERIAL, QUEST_RIDE_STEP, questRideModels } from './questRideScenes';
import { perSources, type PineSources } from './pineSources';

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
// the beaver pool's still surface and dam trickle (G4): their geometry for the pool view (world/beaverPool.ts draws them
// on its own water surfaces), published as `pool.still` / `pool.trickle`; the world never adds this group
const poolRecipe = { scene: { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: ['still', 'trickle'] },
  ...(['still', 'trickle'] as const).map(id => ({ kind: 'mesh', id, geometry: id, material: 'water', missing: 'empty', name: `pine-pool-${id}` })),
], materials: [{ kind: 'port', id: 'water', source: 'water' }] }, imports: [] };
/** The rows `worldScenes` makes. */
export interface WorldScenes {
  readonly SCENE_BLOBS: NamedBlobType[];
  readonly SCENE_RAW_MODELS: NamedBlobType[];
  readonly SCENE_PACKED_MODELS: NamedBlobType[];
  readonly WORLD_SCENES: WorldScenesSection;
}
/** D65: the world scene rows and blobs over the program's sources, made once per sources. */
export const worldScenes: (sources: PineSources) => Promise<WorldScenes> = perSources(async (sources: PineSources): Promise<WorldScenes> => {
  const { CRAG_CAVE_ROWS } = await cragScene(sources), { CABIN_JSON_BLOBS } = await cabinScene(sources);
  const { MODEL_SCENES, SCENE_MODELS, SCENE_PLACEMENTS, PROP_RAW_MODELS, PROP_PACKED_MODELS } = await sceneModelRows(sources);
  const { raw: QUEST_RIDE_RAW_MODELS, packed: QUEST_RIDE_PACKED_MODELS } = await questRideModels(sources);
  v.parse(CaveRowsSchema, CRAG_CAVE_ROWS);
  /** The bear cave (G483 world scene assembly): its baked interior, its mouth's frame, its look near the mouth and its rock. */
  const CAVE_INTERIOR = v.parse(CaveInteriorSchema, { product: 'pine-hollow', file: 'world/crag-cave.json', roof: { url: codeParts.url, rows: codeParts.rows, part: codeParts.parts['cave-roof'] }, look: CAVE_LOOK,
    frame: { x: layout.BEAR_CAVE.x, z: layout.BEAR_CAVE.z, yaw: layout.BEAR_CAVE.rot }, rock: { look: CRAG_LOOK, fill: 'caveFill', pbr: 'mossy_rock', grit: 'rock_ground' } });
  const SCENE_BLOBS: NamedBlobType[] = [nameBlob('world/crag-cave.json', 'json', encode(CRAG_CAVE_ROWS)), nameBlob('world/cave-interior.json', 'json', encode(CAVE_INTERIOR)), nameBlob('scenes/streams.json', 'json', encode(recipe)), nameBlob('scenes/pool.json', 'json', encode(poolRecipe)),
    nameBlob(SPRAY, 'bin', new Uint8Array(Float32Array.from([...matrices, ...spray.seed, ...spray.size]).buffer)),
    ...CABIN_JSON_BLOBS, ...QUEST_RIDE_BLOBS,
    nameBlob('models/world-scenes.json', 'json', encode(SCENE_MODELS)),
    ...SCENE_PLACEMENTS.map(row => nameBlob(`scenes/placements/${row.id}.json`, 'json', encode(row)))];
  // GR8 G27: the stream water and quad and the pool's still and trickle, built here (no scheduler job, no stored files):
  // raw for the map assembly, meshopt-named for the output as their `meshopt: true` sources were.
  const rawModels = [...pineWorldSceneModels(sources)];
  /** The four raw world-scene models, named as the map assembly reads them. */
  const SCENE_RAW_MODELS: NamedBlobType[] = [...rawModels.map(([name, bytes]) => nameBlob(name, 'glb', bytes)), ...PROP_RAW_MODELS, ...QUEST_RIDE_RAW_MODELS];
  /** The same four, meshopt-named as the output publishes them. */
  const SCENE_PACKED_MODELS: NamedBlobType[] = [...await Promise.all(rawModels.map(([name, bytes]) => nameMeshoptBlob(name, bytes))), ...PROP_PACKED_MODELS, ...QUEST_RIDE_PACKED_MODELS];
  /** Ordered stream assembly plus named raw-model placement sets, over shared material slots. */
  const WORLD_SCENES: WorldScenesSection = {
    version: 1, catalogue: 'models/world-scenes.json', placements: MODEL_SCENES.placements, batches: MODEL_SCENES.batches, welds: MODEL_SCENES.welds,
    libraries: [...MODEL_SCENES.libraries, QUEST_RIDE_LIBRARY, { id: 'streams', kind: 'owned', models: [
      { id: 'water', file: 'models/stream-water.glb', attributes: { _awater: 'aWater' } },
      { id: 'quad', file: 'models/stream-quad.glb', attributes: {} },
    ] }, { id: 'pool', kind: 'owned', models: [
      { id: 'still', file: 'models/pool-still.glb', attributes: { _awater: 'aWater' } },
      { id: 'trickle', file: 'models/pool-trickle.glb', attributes: { _awater: 'aWater' } },
    ] }],
    materials: [...MODEL_SCENES.materials, QUEST_RIDE_MATERIAL, { id: 'water', kind: 'look', look: WATER_SURFACES.creek.look }, { id: 'spray', kind: 'look', look: SPRAY_LOOK }],
    steps: [QUEST_RIDE_STEP, { id: 'streams', scene: 'scenes/streams.json',
      geometry: { water: { library: 'streams', model: 'water' }, quad: { library: 'streams', model: 'quad' } },
      materials: { water: 'water', spray: 'spray' }, registry: [], bounds: [],
      instanceAttributes: [{ part: 'spray', target: 'instanceMatrix', width: 16, packet: sprayPacket(0) },
        { part: 'spray', name: 'aSeed', width: 4, packet: sprayPacket(16) }, { part: 'spray', name: 'aSize', width: 3, packet: sprayPacket(20) }],
      publish: { water: { kind: 'object', part: 'water' }, spray: { kind: 'object', part: 'spray' } },
    }, { id: 'pool', scene: 'scenes/pool.json', geometry: { still: { library: 'pool', model: 'still' }, trickle: { library: 'pool', model: 'trickle' } },
      materials: { water: 'water' }, registry: [], bounds: [], instanceAttributes: [],
      publish: { still: { kind: 'object', part: 'still' }, trickle: { kind: 'object', part: 'trickle' } },
    }],
  };
  return { SCENE_BLOBS, SCENE_RAW_MODELS, SCENE_PACKED_MODELS, WORLD_SCENES };
});
