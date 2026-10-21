import { nameBlob } from '@wildshard/sdk/blobs';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import models from '../data/questRideModels.json' with { type: 'json' };
import { FIGURE_CATALOGUE } from './figureCatalogue';

const surface = FIGURE_CATALOGUE.material;
if (surface === undefined) throw new Error('Quest rides need their original figure surface');
export const QUEST_RIDE_MODEL_BLOBS = models.map(row => ({ name: row.file, kind: 'glb', source: row.source }));
const scene = parseWorldScene({ scene: { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: models.map(row => row.id) },
  ...models.map(row => ({ kind: 'mesh', id: row.id, geometry: row.id, material: 'body', missing: 'empty',
    name: row.part, castShadow: true, visible: row.id !== 'canoe' })),
], materials: [{ kind: 'port', id: 'body', source: 'body' }] }, imports: [] });
export const QUEST_RIDE_BLOBS = [nameBlob('scenes/quest-rides.json', 'json', new TextEncoder().encode(JSON.stringify(scene)))];
export const QUEST_RIDE_LIBRARY: WorldScenesSection['libraries'][number] = {
  id: 'quest-rides', kind: 'owned', models: models.map(row => ({ id: row.id, file: row.file, attributes: {} })),
};
export const QUEST_RIDE_MATERIAL: WorldScenesSection['materials'][number] = {
  id: 'quest-rides', kind: 'standard', sky: true,
  properties: { vertexColors: true, roughness: surface.roughness, metalness: surface.metalness },
};
export const QUEST_RIDE_STEP: WorldScenesSection['steps'][number] = {
  id: 'quest-rides', scene: 'scenes/quest-rides.json',
  geometry: Object.fromEntries(models.map(row => [row.id, { library: 'quest-rides', model: row.id }])),
  materials: { body: 'quest-rides' }, registry: [], bounds: [], instanceAttributes: [],
  publish: { trolley: { kind: 'mesh', part: 'trolley' }, canoe: { kind: 'mesh', part: 'canoe' } },
};
