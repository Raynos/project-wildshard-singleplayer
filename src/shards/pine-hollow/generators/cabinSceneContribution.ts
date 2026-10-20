/** Product rows over the completed cabin bake. The author-only graph book keeps
 * bundled declarations free of file I/O; the product still emits individual graphs. */
import { Matrix4 } from 'three';
import * as v from 'valibot';
import { nameBlob } from '@wildshard/sdk/blobs';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { WorldSceneWeldSchema, parseWorldSceneWeld, type WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import baked from '../data/cabinScenes.generated.json' with { type: 'json' };
import cabins from '../data/cabins.json' with { type: 'json' };
import logKit from '../data/logKit.json' with { type: 'json' };
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { HEARTH_LOOKS } from './hearthLook';
import { CABIN_LIVING_LIBRARIES, CABIN_LIVING_BLOBS, CABIN_SITES, CabinSitesSchema, cabinLivingResources } from './cabinLivingContribution';

const text = v.string(), words = v.array(v.number()), contacts = v.array(v.unknown());
const registration = v.variant('kind', [
  v.object({ kind: v.literal('building'), id: text, part: text, boxWords: words, colliders: contacts, floors: contacts }),
  v.object({ kind: v.literal('prop'), prop: v.picklist(['crate', 'barrel', 'bucket', 'hatchet']), hamlet: v.boolean(), part: text, matrices: v.array(words), boxWords: words }),
  v.object({ kind: v.literal('drawn'), id: text, which: v.picklist(['firePitObj', 'lanternObj']), part: text, matrixBits: words, boxWords: words }),
]);
const metadata = v.parse(v.object({
  blobs: v.array(v.object({ name: text, kind: v.picklist(['glb', 'json']), source: text })),
  geometry: v.array(v.object({ id: text, library: text, file: text, segments: v.exactOptional(v.array(text)), attributes: v.record(text, text) })),
  worlds: v.array(v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), file: text, registrations: v.array(registration) })),
  specimens: v.array(v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), key: text, choice: text, file: text })),
  graphs: v.array(v.object({ file: text, graph: v.unknown() })),
  sourceMaterials: v.array(v.object({ id: text, url: text, part: v.number() })),
}), baked);
const slot = (id: string): string => id.startsWith('materials.') ? id.slice('materials.'.length) : id;
const floatValues = (values: readonly number[]): number[] => Array.from(new Float32Array(Uint32Array.from(values).buffer));
const doubleValues = (values: readonly number[]): number[] => Array.from(new Float64Array(Uint32Array.from(values).buffer));
const pose = (matrix: readonly number[]) => ({ x: matrix[12], y: matrix[13], z: matrix[14], matrix });
const propIds = { crate: 'wooden-crate', barrel: 'wine-barrel', bucket: 'wooden-bucket', hatchet: 'hatchet' };
function sourceGraph(file: string): WorldSceneWeld {
  const source = metadata.blobs.find(row => row.name === file && row.kind === 'json');
  if (source === undefined || !source.source.startsWith('assets/cabin-scenes/') || source.source.split('/').includes('..')) throw new Error(`Missing cabin graph: ${file}`);
  const graph = metadata.graphs.find(entry => entry.file === file);
  if (graph === undefined) throw new Error(`Missing authored cabin graph: ${file}`);
  const row = parseWorldSceneWeld(graph.graph);
  const normalized = structuredClone(row);
  for (const node of normalized.nodes) if ('material' in node) node.material = slot(node.material);
  for (const material of normalized.materials) {
    material.id = slot(material.id);
    if (material.source !== undefined) material.source.material = slot(material.source.material);
  }
  if (normalized.nodes.some(node => 'material' in node && node.material === 'cabin.glow') && !normalized.materials.some(material => material.id === 'cabin.glow')) normalized.materials.unshift({
    id: 'cabin.glow', kind: 'basic', source: { material: 'cabin.glow-map', maps: ['map'] }, properties: { color: 0xff7a1a, transparent: true, depthWrite: false }, blending: 2, fog: false, sky: false,
  });
  return normalized;
}

export const CABIN_PLACEMENTS: ReturnType<typeof parseWorldScenePlacement>[] = [];
export const CABIN_JSON_BLOBS: ReturnType<typeof nameBlob>[] = [...CABIN_LIVING_BLOBS, nameBlob('world/building-sites.json', 'json', new TextEncoder().encode(JSON.stringify(CABIN_SITES)), { jsonSchema: namedJsonSchema(CabinSitesSchema) })];
const encode = (file: string, row: unknown) => nameBlob(file, 'json', new TextEncoder().encode(JSON.stringify(row)), { jsonSchema: namedJsonSchema(WorldSceneWeldSchema) });
for (const world of metadata.worlds) {
  const prefix = `cabins.${world.tier}.${String(world.shadow)}`, placements: string[] = [], hamlet: string[] = [];
  for (const [index, row] of world.registrations.entries()) {
    const id = `${prefix}.${String(index)}`; placements.push(id);
    const boxes = floatValues(row.boxWords);
    let input: unknown;
    if (row.kind === 'building') {
      const building = cabins.buildings.find(entry => entry.id === row.id);
      if (building === undefined) throw new Error(`Missing cabin site: ${row.id}`);
      const frame = new Matrix4().makeRotationY(building.rot); frame.setPosition(building.at[0], building.at[1], building.at[2]);
      const variant = ['hollow', 'east', 'ridge'][building.index];
      input = { id, model: building.hamlet ? building.id : 'log-cabin', draw: 'merged',
        drawnInto: { part: building.hamlet ? 'cabins.cluster' : row.part, boxes },
        poses: [{ ...pose(frame.elements), ...(building.hamlet ? {} : { variant }) }], colliders: row.colliders,
        piece: { id: building.hamlet ? `pine-hollow/${building.id}` : building.id, solidFloor: true, floorPolicy: 'first', floors: row.floors } };
      if (building.hamlet) hamlet.push(id);
    } else if (row.kind === 'prop') {
      const model = propIds[row.prop];
      input = { id, model, draw: 'instanced', drawnInto: { part: row.part, boxes },
        poses: row.matrices.map(matrix => pose(doubleValues(matrix))),
        piece: { id: `pine-hollow/${model}${row.hamlet ? '#hamlet' : ''}` } };
      if (row.hamlet) hamlet.push(id);
    } else {
      const model = row.which === 'firePitObj' ? 'stone-fire-pit' : 'porch-lantern';
      input = { id, model, draw: 'single', drawnInto: { part: row.part, boxes }, poses: [pose(doubleValues(row.matrixBits))], colliders: [], piece: { id: `pine-hollow/${model}@${row.id}` } };
      if (cabins.buildings.find(building => building.id === row.id)?.hamlet) hamlet.push(id);
    }
    CABIN_PLACEMENTS.push(parseWorldScenePlacement(input));
  }
  const row = sourceGraph(world.file);
  CABIN_JSON_BLOBS.push(encode(world.file, parseWorldSceneWeld({ ...row, id: 'cabins.shells', resources: cabinLivingResources(world.tier, world.shadow), placements,
    sets: [{ id: 'pine-hollow/mill-hamlet', name: 'Mill hamlet', file: 'data/cabinScenes.generated.json', place: 'pine-hollow/hamlet', members: hamlet }] })));
}
for (const specimen of metadata.specimens) CABIN_JSON_BLOBS.push(encode(specimen.file, sourceGraph(specimen.file)));
const worldFile = (tier: 'phone' | 'desktop', shadow: boolean): string => {
  const row = metadata.worlds.find(entry => entry.tier === tier && entry.shadow === shadow);
  if (row === undefined) throw new Error('Missing cabin world topology'); return row.file;
};
export const CABIN_WELDS = [{ id: 'cabins.shells', file: { knob: 'pine.cabinDetailShadows',
  false: { phone: worldFile('phone', false), desktop: worldFile('desktop', false) }, true: { phone: worldFile('phone', true), desktop: worldFile('desktop', true) } } }];
export const CABIN_LIBRARIES = [...CABIN_LIVING_LIBRARIES, ...[...new Set(metadata.geometry.map(row => row.library))].map(id => ({ id, kind: 'owned' as const,
  models: metadata.geometry.filter(row => row.library === id).map(({ library: _library, ...row }) => row) }))];
export const CABIN_BLOBS = metadata.blobs.filter(row => row.kind === 'glb');
export const CABIN_MATERIALS: unknown[] = metadata.sourceMaterials.map(row => ({ id: slot(row.id), kind: 'source', load: 'placement', url: row.url,
  aliases: authored.propMaterials, part: row.part, ...(row.id.includes('.pit.') ? { publishObject: 'cabins.source.pit' } : row.id.includes('.lantern.') ? { publishObject: 'cabins.source.lantern' } : {}), ...(row.id.includes('.prop.') ? { anisotropy: 8, anisotropyMaps: ['map', 'normalMap', 'roughnessMap', 'aoMap'] } : {}) }));
for (const id of ['flame', 'ember', 'smoke'] as const) CABIN_MATERIALS.push({ id: `cabin.${id}`, kind: 'look', look: HEARTH_LOOKS[id] });
CABIN_MATERIALS.push({ id: 'cabin.glow-map', kind: 'surface', properties: {}, map: { appearance: 'look/cover-appearance.json', texture: 'glow' } });

const families = [
  { key: 'log-cabin', name: 'Log cabin', building: true }, { key: 'hunting-lodge', name: 'Hunting lodge', building: true },
  { key: 'trader-stall', name: "Trader's stall", building: true }, { key: 'millers-house', name: "Miller's house", building: true },
  { key: 'watermill', name: 'Watermill', building: true }, { key: 'hamlet-shed', name: 'Hamlet shed', building: true },
  { key: 'wooden-crate', name: 'Wooden crate' }, { key: 'wine-barrel', name: 'Wine barrel' }, { key: 'wooden-bucket', name: 'Wooden bucket' },
  { key: 'hatchet', name: 'Hatchet' }, { key: 'stone-fire-pit', name: 'Stone fire pit' }, { key: 'porch-lantern', name: 'Porch lantern' },
];
const variants = [{ id: 'hollow', label: "The ranger's (the Hollow)", params: { site: 0 } }, { id: 'east', label: 'East', params: { site: 1 } }, { id: 'ridge', label: 'Ridge', params: { site: 2 } }];
const specimenFile = (key: string, choice: string, tier: 'phone' | 'desktop', shadow: boolean) => {
  const row = metadata.specimens.find(entry => entry.key === key && entry.choice === choice && entry.tier === tier && entry.shadow === shadow);
  if (row === undefined) throw new Error(`Missing complete cabin specimen: ${key}/${choice}/${tier}/${String(shadow)}`); return { file: row.file };
};
export const CABIN_MODEL_ROWS: unknown[] = [];
for (const family of families) {
  const building = 'building' in family, prop = Object.entries(propIds).find(([, id]) => id === family.key)?.[0];
  const boxRow = prop === undefined ? undefined : Object.entries(logKit.PROP_BOXES).find(([id]) => id === prop)?.[1];
  const colliders = boxRow === undefined || boxRow === null ? [] : [{ kind: 'box', x: 0, y: boxRow.h / 2, z: 0, hx: boxRow.hw, hy: boxRow.h / 2, hz: boxRow.hd, surface: 'wood' }];
  const choices = family.key === 'log-cabin' ? variants : [{ id: 'only', params: building ? { site: 0 } : {} }];
  CABIN_MODEL_ROWS.push({ key: family.key, id: `pine-hollow/${family.key}`, name: family.name, file: 'data/cabinScenes.generated.json',
    category: building ? 'buildings' : 'props', pipeline: building ? 'code' : 'cc0', ...(building || prop !== undefined ? { surface: 'wood' } : {}),
    defaults: building ? { site: 0 } : {}, variants: family.key === 'log-cabin' ? variants : [], assembly: 'scene',
    choices: choices.map(choice => ({ id: choice.id, params: choice.params, size: [1, 1, 1], draws: [], colliders,
      scene: { knob: 'pine.cabinDetailShadows',
        false: { phone: specimenFile(family.key, choice.id, 'phone', false), desktop: specimenFile(family.key, choice.id, 'desktop', false) },
        true: { phone: specimenFile(family.key, choice.id, 'phone', true), desktop: specimenFile(family.key, choice.id, 'desktop', true) } } })) });
}
