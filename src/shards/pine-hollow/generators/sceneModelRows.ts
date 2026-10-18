/** Final model/placement rows. All shape, rest-pose and contact work belongs to the offline producers. */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { modelPoseMatrix } from '@wildshard/engine/models/placementBatch';
import { parseWorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import heroes from '../data/heroScenes.generated.json' with { type: 'json' };
import heroRows from '../data/heroRows.json' with { type: 'json' };
import props from '../data/propScenes.generated.json' with { type: 'json' };
import scatter from '../data/props.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };

import { CRAG_MODEL_ROWS, CRAG_PLACEMENT_ROWS, CRAG_BATCH_ROWS, CRAG_LIBRARY, CRAG_MATERIAL, CRAG_MODEL_BLOBS } from './cragSceneContribution';

import { TIMBER_MODEL_ROWS, TIMBER_PLACEMENTS, TIMBER_LIBRARY, TIMBER_BLOBS, TIMBER_SURFACES } from './timberSceneContribution';
import { CABIN_MODEL_ROWS, CABIN_PLACEMENTS, CABIN_LIBRARIES, CABIN_BLOBS, CABIN_MATERIALS, CABIN_WELDS } from './cabinSceneContribution';

const materials: unknown[] = [CRAG_MATERIAL, ...TIMBER_SURFACES, ...CABIN_MATERIALS];
const models: unknown[] = [...CRAG_MODEL_ROWS, ...TIMBER_MODEL_ROWS, ...CABIN_MODEL_ROWS];
const placements: unknown[] = [...CRAG_PLACEMENT_ROWS, ...TIMBER_PLACEMENTS, ...CABIN_PLACEMENTS];
for (const source of heroes.sources) for (const level of ['near', 'far'] as const) materials.push({
  id: `heroes.${source.id}.${level}`, kind: 'source', load: 'placement', url: source.material[level], aliases: heroes.materialAliases, anisotropy: 4, envMapIntensity: 0.8,
});
materials.push({ id: 'heroes.arch.dark', kind: 'standard', sky: true, properties: { color: 0x040404, roughness: 1, metalness: 0 } });
for (const row of heroRows.models) {
  const arch = row.key === 'cave-arch';
  const choices = row.sources.flatMap(id => {
    const source = heroes.sources.find(candidate => candidate.id === id);
    if (source === undefined) throw new Error(`Missing hero rest shape: ${id}`);
    return (arch ? [false, true] : [false]).map(closed => {
      const draw = (level: 'near' | 'far') => [{ id: level, library: 'heroes', model: arch && !closed ? source.open?.[level] ?? source[level] : source[level],
        material: `heroes.${id}.${level}`, castShadow: level === 'near', receiveShadow: true },
      ...(closed && source.closed !== undefined ? [{ id: 'dark', library: 'heroes', model: source.closed.plane, material: 'heroes.arch.dark', castShadow: false, receiveShadow: false }] : [])];
      return { id: arch ? closed ? 'closed' : 'open' : id, params: arch ? { closed } : { kind: id }, size: [1, 1, 1],
        draws: draw('near'), lods: [{ from: row.far, draws: draw('far') }], colliders: closed ? source.closed?.colliders ?? source.colliders : source.colliders };
    });
  });
  models.push({ key: row.key, id: `pine-hollow/${row.key}`, name: row.name, category: row.category, pipeline: 'trellis', surface: row.surface,
    file: 'data/heroRows.json', assembly: 'parts', defaults: arch ? { closed: false } : { kind: row.sources[0] },
    variants: arch ? [{ id: 'open', label: 'Open (the cave behind)', params: { closed: false } }, { id: 'closed', label: 'Closed (no cave)', params: { closed: true } }]
      : row.sources.length > 1 ? row.sources.map(kind => ({ id: kind, label: `Stone ${kind.slice(-1).toUpperCase()}`, params: { kind } })) : [], choices });
}

const heroCull = { lodBy: 'set', flat: true, from: 'origin', far: { phone: 220, desktop: 260 } };
interface Pose { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly pitch?: number; readonly roll?: number }
function heroPlacement(id: string, model: string, kind: string, sites: readonly Pose[], variant?: string) {
  const front = Object.entries(heroRows.front).find(([key]) => key === kind)?.[1];
  if (front === undefined) throw new Error(`Missing hero facing: ${kind}`);
  placements.push({ id: `heroes.${id}`, model, draw: 'instanced', cull: heroCull,
    poses: sites.map(site => ({ x: site.x, y: site.y, z: site.z, matrix: modelPoseMatrix({ ...site, yaw: site.yaw + front }).elements.map(value => value === 0 ? 0 : value),
      ...(variant === undefined ? {} : { variant }) })) });
}
for (const stone of authored.landmarks.stones) heroPlacement(stone.kind, 'standing-stone', stone.kind, stone.places, stone.kind);
heroPlacement('waystone', 'waystone', 'waystone', authored.landmarks.waystones);
heroPlacement('beaver-dam', 'beaver-dam', 'beaver-dam', authored.landmarks.dam);
heroPlacement('canoe', 'canoe', 'canoe', authored.landmarks.canoe);
heroPlacement('contract-board', 'contract-board', 'contract-board', authored.landmarks.board);
heroPlacement('cave-arch', 'cave-arch', 'cave-arch', [authored.landmarks.arch]);
heroPlacement('closed-arch', 'cave-arch', 'cave-arch', [authored.landmarks.arch], 'closed');

const sourceRows = [
  { key: 'rocks', url: 'rock_moss_set_01', name: 'Mossy boulder', id: 'mossy-boulder', surface: 'rock' },
  { key: 'stumps', url: 'tree_stump_01', name: 'Tree stump', id: 'tree-stump', surface: 'wood' },
  { key: 'log', url: 'dead_tree_trunk', name: 'Fallen log', id: 'fallen-log', surface: 'wood' },
] as const;
for (const source of sourceRows) {
  const shapes = source.key === 'rocks' ? authored.propShapes.rocks : source.key === 'stumps' ? authored.propShapes.stumps : authored.propShapes.log.parts;
  const draw = (shape: typeof shapes[number], i: number) => ({ id: shape.name, library: 'props', model: shape.name,
    material: source.key === 'rocks' ? 'props.rocks' : `props.${source.key}.${i}`, sphere: shape.sphere, castShadow: true, receiveShadow: true });
  const materialParts = source.key === 'rocks' ? [0] : shapes.map((_row, i) => i);
  for (const i of materialParts) materials.push({ id: source.key === 'rocks' ? 'props.rocks' : `props.${source.key}.${i}`, kind: 'source', load: 'placement',
    url: `/assets/models/${source.url}/${source.url}_lod.glb`, aliases: authored.propMaterials, part: i, anisotropy: 8,
    anisotropyMaps: ['map', 'normalMap', 'roughnessMap', 'aoMap'] });
  const hull = (shape: typeof shapes[number]) => ({ kind: 'hull', x: 0, y: 0, z: 0, points: shape.hull });
  models.push({ key: `props.${source.key}`, id: `pine-hollow/${source.id}`, name: source.name, category: 'nature', pipeline: 'cc0',
    surface: source.surface, file: 'data/propScenes.generated.json', assembly: 'parts', defaults: source.key === 'rocks' ? { shape: 0, solid: true } : {},
    variants: source.key === 'rocks' ? shapes.map((_shape, i) => ({ id: String.fromCodePoint(97 + i), label: `Rock ${String.fromCodePoint(65 + i)}`, params: { shape: i } })) : [],
    choices: source.key === 'rocks' ? shapes.flatMap((shape, i) => [true, false].map(solid => ({ id: `${i}-${String(solid)}`, params: { shape: i, solid }, size: [1, 1, 1],
      draws: [draw(shape, i)], colliders: solid ? [hull(shape)] : [] }))) : [{ id: 'only', params: {}, size: [1, 1, 1], draws: shapes.map(draw),
      colliders: source.key === 'log' ? [authored.propShapes.log.capsule] : shapes.map(hull) }] });
}
const pose = ([x = 0, y = 0, z = 0, qx = 0, qy = 0, qz = 0, qw = 1, scale = 1]: readonly number[]) => ({ x, y, z,
  matrix: new Matrix4().compose(new Vector3(x, y, z), new Quaternion(qx, qy, qz, qw), new Vector3(scale, scale, scale)).elements.map(value => value === 0 ? 0 : value) });
const scatterCull = { far: { phone: 220, desktop: 700 }, keepNear: 40, minAngular: { phone: 0.004, desktop: 0.0012 }, view: 'forest', bounds: 'sphere' };
placements.push({ id: 'props.rocks', model: 'props.rocks', draw: 'batched', sortObjects: false, cull: scatterCull,
  poses: scatter.rocks.map(([shape, solid, ...rest]) => ({ ...pose(rest), params: { shape, solid: solid === 1 }, variant: String.fromCodePoint(97 + (shape ?? 0)) })),
  piece: { id: 'props', split: Math.max(1, Math.ceil(scatter.rocks.filter(row => row[1] === 1).length / 2)) } },
{ id: 'props.stumps', model: 'props.stumps', draw: 'instanced', cull: scatterCull, poses: scatter.stumps.map(pose), piece: { id: 'props-stumps' } },
{ id: 'props.log', model: 'props.log', draw: 'instanced', cull: scatterCull, poses: scatter.logs.map(pose), piece: { id: 'props-wood' } });

export const SCENE_MODELS = parseWorldSceneModels({ product: 'pine-hollow', models });
export const SCENE_PLACEMENTS = placements.map(parseWorldScenePlacement);
function placementReference(row: (typeof SCENE_PLACEMENTS)[number]) {
  return { id: row.id, file: `scenes/placements/${row.id}.json`, ...(row.tier === undefined ? {} : { tier: row.tier }) };
}
export const MODEL_SCENES = parseWorldScenes({ version: 1, catalogue: 'models/world-scenes.json', batches: CRAG_BATCH_ROWS, welds: CABIN_WELDS, libraries: [CRAG_LIBRARY, TIMBER_LIBRARY, ...CABIN_LIBRARIES,
  { id: 'heroes', kind: 'owned', models: heroes.blobs.map(row => ({ id: row.name.slice('models/heroes/'.length, -'.glb'.length), file: row.name })) },
  { id: 'props', kind: 'owned', models: props.geometry },
], materials, placements: SCENE_PLACEMENTS.map(placementReference), steps: [] });
export const MODEL_BLOBS = [...heroes.blobs, ...props.blobs, ...CRAG_MODEL_BLOBS, ...TIMBER_BLOBS, ...CABIN_BLOBS];
