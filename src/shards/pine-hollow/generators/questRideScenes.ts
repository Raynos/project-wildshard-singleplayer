// oxlint-disable-next-line import/no-nodejs-modules -- Read the retained code-part bake at author time only.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Decode the retained bake before emitting ordinary scene assets.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Refuse a code-part packet that differs from its authored receipt.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- This is a Node input URL, not a Vite runtime asset expression.
import { URL as FileURL } from 'node:url';
import { MeshStandardMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { nameBlob } from '@wildshard/sdk/blobs';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import packed from '../data/codeParts.json' with { type: 'json' };
import { FIGURE_CATALOGUE } from './figureCatalogue';

const bytes = Uint8Array.from(inflateSync(readFileSync(new FileURL(`../../../../public${packed.url}`, import.meta.url))));
if (createHash('sha256').update(bytes).digest('hex') !== packed.sha256) throw new Error('Quest ride code-part hash differs');
const pack = new GeometryPack(bytes, packedRows(packed.rows), 'quest rides');
const surface = FIGURE_CATALOGUE.material;
if (surface === undefined) throw new Error('Quest rides need their original figure surface');
const material = new MeshStandardMaterial({ ...surface, vertexColors: true });
const models = [
  { id: 'trolley', part: 'zip-trolley', index: packed.parts['zip-trolley'], file: 'models/quest/trolley.glb' },
  { id: 'canoe', part: 'canoe-ride', index: packed.parts.canoe, file: 'models/quest/canoe.glb' },
];
export const QUEST_RIDE_BLOBS = models.map(row => {
  const geometry = pack.geometry(row.index);
  try { return nameBlob(row.file, 'glb', staticGlb([{ geometry, material, compactIndex: true, nativeAttributes: true }], row.id)); }
  finally { geometry.dispose(); }
});
material.dispose();
const scene = parseWorldScene({ scene: { version: 1, root: 'root', nodes: [
  { kind: 'group', id: 'root', children: models.map(row => row.id) },
  ...models.map(row => ({ kind: 'mesh', id: row.id, geometry: row.id, material: 'body', missing: 'empty',
    name: row.part, castShadow: true, visible: row.id !== 'canoe' })),
], materials: [{ kind: 'port', id: 'body', source: 'body' }] }, imports: [] });
QUEST_RIDE_BLOBS.push(nameBlob('scenes/quest-rides.json', 'json', new TextEncoder().encode(JSON.stringify(scene))));
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
