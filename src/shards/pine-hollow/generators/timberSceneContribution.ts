/** Final timber draws, shadow proxies and native placement facts; no page-side weld. */
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import { Matrix4, Object3D } from 'three';
import baked from '../data/timberScenes.generated.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import plumbing from '../data/plumbing.json' with { type: 'json' };
import { TIMBER_MATERIALS } from './timberMaterials';
import type { TimberSceneCopy } from './timberScenes';

type Draw = Omit<TimberSceneCopy['draws'][number], 'sphere'> & { readonly sphere: readonly number[] };
type Proxy = Omit<TimberSceneCopy['proxies'][number], 'sphere'> & { readonly sphere: readonly number[] };

const distances = plumbing.knobs.find(row => row.id === 'pine.cabinDetailDist');
const shadows = plumbing.knobs.find(row => row.id === 'pine.cabinDetailShadows');
if (distances === undefined || typeof distances.phone !== 'number' || typeof distances.desktop !== 'number'
  || shadows === undefined || typeof shadows.phone !== 'boolean' || typeof shadows.desktop !== 'boolean') throw new Error('Missing timber band rows');
const names = { 'fire-lookout': 'Fire lookout', 'zipline-landing': 'Zipline landing', 'creek-footbridge': 'Creek footbridge' };
export const TIMBER_MODEL_ROWS: unknown[] = Object.entries(names).map(([key, name]) => ({ key, id: `pine-hollow/${key}`, name,
  category: 'buildings', pipeline: 'code', surface: 'wood', file: 'data/timberScenes.generated.json', assembly: 'objects',
  defaults: { site: 'turntable' }, choices: (key === 'fire-lookout' ? ['turntable'] : ['world', 'turntable']).map(site => {
    const copy = baked.copies.find(row => row.identity === `${key}${key !== 'fire-lookout' && site === 'turntable' ? '-turntable' : ''}`);
    if (copy === undefined) throw new Error(`Missing timber copy: ${key}/${site}`);
    const band = (until: number | undefined) => until === undefined ? {} : { until: { knob: distances.id, multiply: until, add: copy.pad } };
    const draw = (row: Draw) => ({ id: row.geometry, library: 'timbers', model: row.geometry, material: `timber.${row.material}`,
      castShadow: row.until === 1 && row.castShadow ? { knob: shadows.id } : row.castShadow,
      receiveShadow: row.receiveShadow, renderOrder: row.renderOrder, sphere: row.sphere, ...band(row.until) });
    const proxy = (row: Proxy) => ({ id: row.geometry, library: 'timbers', model: row.geometry, material: 'timber.iron', depthOnly: true,
      sphere: row.sphere, ...(row.until === 2 ? band(row.until) : {}) });
    return { id: site, params: { site }, size: [1, 1, 1], colliders: copy.row.colliders, draws: [
      ...copy.draws.map(draw), ...copy.proxies.map(proxy),
    ] };
  }) }));
for (const row of [{ key: 'zip-cable', name: 'Zip-line cable', shelf: false }, { key: 'token-shelf', name: 'Token shelf', shelf: true }]) {
  TIMBER_MODEL_ROWS.push({ key: row.key, id: `pine-hollow/${row.key}`, name: row.name, category: 'props', pipeline: 'code',
    ...(row.shelf ? { surface: 'wood' } : {}), file: 'data/timberScenes.generated.json', assembly: 'parts', defaults: {},
    choices: [{ id: 'only', params: {}, size: [1, 1, 1], colliders: [], draws: [{ id: row.key, library: 'timbers', model: row.key,
      material: row.shelf ? 'tokens' : 'timber.iron', receiveShadow: row.shelf }] }] });
}

const sites = [
  { key: 'fire-lookout', id: 'pine-lookout', frame: authored.placements.lookout.matrix, site: 'turntable' },
  { key: 'zipline-landing', id: 'pine-zip-landing', frame: authored.placements.landing.matrix, site: 'world' },
  { key: 'creek-footbridge', id: 'pine-footbridge', frame: authored.placements.bridge.matrix, site: 'world' },
] as const;
export const TIMBER_PLACEMENTS = sites.map(row => parseWorldScenePlacement({ id: `timbers.${row.key}`, model: row.key, draw: 'single',
  poses: [{ x: row.frame[12], y: row.frame[13], z: row.frame[14], params: { site: row.site },
    ...(row.key === 'creek-footbridge' ? { yxz: { yaw: authored.placements.bridge.yaw, yawAtan2: authored.placements.bridge.turn, scale: 1 } } : { matrix: row.frame }) }],
  piece: { id: row.id, solidFloor: true, floors: authored.landmarks.timberFloors[row.id], floorPolicy: 'highest' } }));
const [x, y, z] = authored.landmarks.zip.top;
TIMBER_PLACEMENTS.push(parseWorldScenePlacement({ id: 'timbers.zip-cable', model: 'zip-cable', draw: 'single',
  poses: [{ x, y, z, yxz: { yaw: 0, scale: 1 } }], piece: { id: 'pine-zip-cable' } }));
const ranger = authored.cabins.buildings.find(row => row.id === 'cabin-1');
if (ranger === undefined) throw new Error('Missing ranger mantel frame');
const room = new Object3D(); room.position.fromArray(ranger.at); room.rotation.y = ranger.rot; room.updateWorldMatrix(true, false);
const shelf = room.matrixWorld.clone().multiply(new Matrix4().makeTranslation(-0.6, 1.78, -3.02));
TIMBER_PLACEMENTS.push(parseWorldScenePlacement({ id: 'timbers.token-shelf', model: 'token-shelf', draw: 'single',
  poses: [{ x: shelf.elements[12], y: shelf.elements[13], z: shelf.elements[14], matrix: shelf.elements }], piece: { id: 'pine-hollow/token-shelf' } }));
const hashes = new Map(Object.entries(baked.geometryHashes)), canonical = new Map<string, string>(), files = new Map<string, string>();
export const TIMBER_BLOBS: typeof baked.blobs = [];
for (const blob of baked.blobs) {
  const hash = hashes.get(blob.source); if (hash === undefined) throw new Error(`Missing timber hash: ${blob.source}`);
  let name = canonical.get(hash);
  if (name === undefined) { name = blob.name; canonical.set(hash, name); TIMBER_BLOBS.push(blob); }
  files.set(blob.name, name);
}
const model = (row: typeof baked.geometry[number]) => {
  const file = files.get(row.file); if (file === undefined) throw new Error(`Missing timber blob: ${row.file}`);
  return { ...row, file };
};
export const TIMBER_LIBRARY = { id: 'timbers', kind: 'owned' as const, models: baked.geometry.map(model) };
export const TIMBER_SURFACES = [...TIMBER_MATERIALS, { id: 'tokens', kind: 'lowpoly', variant: 'default', properties: {} }];
