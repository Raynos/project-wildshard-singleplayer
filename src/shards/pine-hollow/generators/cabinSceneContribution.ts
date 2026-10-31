/** Product rows over the completed cabin bake. The author-only graph book keeps
 * bundled declarations free of file I/O; the product still emits individual graphs. */
import { Matrix4 } from 'three';
import { defineNamedRows, type NamedRows } from '@wildshard/sdk/formatJsonSchema';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { nameCompactBlobs } from '@wildshard/sdk/bake/compactGlb';
import { worldSceneWeldRows as parseWorldSceneWeld, worldScenePlacement as parseWorldScenePlacement } from '@wildshard/sdk/worldScenes';
import { cabinSceneBake } from './bake-cabin-scenes.mjs';
import { pineCabins } from './bake-pine-cabins.mjs';
import logKit from '../data/logKit.json' with { type: 'json' };
import { timberWorld } from './timberWorldRows';
import { HEARTH_LOOKS } from './hearthLook';
import { cabinLiving, cabinSites } from './cabinLivingContribution';
import { perSources, type PineSources } from './pineSources';
import { HAMLET } from './layout';

const cabinPacking = new WeakMap<PineSources, typeof nameCompactBlobs>();
/** The owning build may lend an exact packer; standalone source bakes keep
 * the original path. Registration does no work or change producer order. */
export function lendCabinPacking(sources: PineSources, pack: typeof nameCompactBlobs): void {
  cabinPacking.set(sources, pack);
}

type WorldSceneWeld = ReturnType<typeof parseWorldSceneWeld>;

const text = { kind: 'string' } as const, number = { kind: 'number' } as const;
const words = { kind: 'array', item: number } as const, contacts = { kind: 'array', item: { kind: 'unknown' } } as const;
const registration = { kind: 'variant', key: 'kind', options: [
  { kind: 'object', mode: 'strip', entries: { kind: { kind: 'literal', value: 'building' }, id: text, part: text, boxWords: words, colliders: contacts, floors: contacts } },
  { kind: 'object', mode: 'strip', entries: { kind: { kind: 'literal', value: 'prop' }, prop: { kind: 'picklist', values: ['crate', 'barrel', 'bucket', 'hatchet'] }, hamlet: { kind: 'boolean' }, part: text, matrices: { kind: 'array', item: words }, boxWords: words } },
  { kind: 'object', mode: 'strip', entries: { kind: { kind: 'literal', value: 'drawn' }, id: text, which: { kind: 'picklist', values: ['firePitObj', 'lanternObj'] }, part: text, matrixBits: words, boxWords: words } },
] } as const;
const tierShape = { kind: 'picklist', values: ['phone', 'desktop'] } as const;
/** The source-owned scene grammar, independent of the scene file reader. */
const cabinSceneShape = { kind: 'object', mode: 'strip', entries: {
  blobs: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { name: text, kind: { kind: 'picklist', values: ['glb', 'json'] }, source: text } } },
  geometry: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { id: text, library: text, file: text, segments: { kind: 'exact-optional', item: { kind: 'array', item: text } }, attributes: { kind: 'record', key: text, value: text } } } },
  worlds: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { tier: tierShape, shadow: { kind: 'boolean' }, file: text, registrations: { kind: 'array', item: registration } } } },
  specimens: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { tier: tierShape, shadow: { kind: 'boolean' }, key: text, choice: text, file: text } } },
  graphs: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { file: text, graph: { kind: 'unknown' } } } },
  sourceMaterials: { kind: 'array', item: { kind: 'object', mode: 'strip', entries: { id: text, url: text, part: number } } },
} } as const;
/** One parser/wire contract compiled from the complete native source grammar. */
export const CABIN_SCENE_ROWS: Pick<NamedRows<CabinSceneRows>, 'schema' | 'jsonSchema' | 'parse'> = defineNamedRows(cabinSceneShape);
interface CabinSceneRows {
  blobs: { name: string; kind: 'glb' | 'json'; source: string }[];
  geometry: { id: string; library: string; file: string; segments?: string[]; attributes: Record<string, string> }[];
  worlds: { tier: 'phone' | 'desktop'; shadow: boolean; file: string; registrations: (
    { kind: 'building'; id: string; part: string; boxWords: number[]; colliders: unknown[]; floors: unknown[] } |
    { kind: 'prop'; prop: 'crate' | 'barrel' | 'bucket' | 'hatchet'; hamlet: boolean; part: string; matrices: number[][]; boxWords: number[] } |
    { kind: 'drawn'; id: string; which: 'firePitObj' | 'lanternObj'; part: string; matrixBits: number[]; boxWords: number[] }
  )[] }[];
  specimens: { tier: 'phone' | 'desktop'; shadow: boolean; key: string; choice: string; file: string }[];
  graphs: { file: string; graph: unknown }[];
  sourceMaterials: { id: string; url: string; part: number }[];
}
const slot = (id: string): string => id.startsWith('materials.') ? id.slice('materials.'.length) : id;
const floatValues = (values: readonly number[]): number[] => Array.from(new Float32Array(Uint32Array.from(values).buffer));
const doubleValues = (values: readonly number[]): number[] => Array.from(new Float64Array(Uint32Array.from(values).buffer));
const pose = (matrix: readonly number[]) => ({ x: matrix[12], y: matrix[13], z: matrix[14], matrix });
const propIds = { crate: 'wooden-crate', barrel: 'wine-barrel', bucket: 'wooden-bucket', hatchet: 'hatchet' };
function sourceGraph(metadata: CabinSceneRows, file: string): WorldSceneWeld {
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

/** The rows `cabinScene` makes. */
export interface CabinScene {
  readonly CABIN_PLACEMENTS: ReturnType<typeof parseWorldScenePlacement>[];
  readonly CABIN_JSON_BLOBS: ReturnType<typeof nameBlob>[];
  readonly CABIN_WELDS: { id: string; file: { knob: string; false: { phone: string; desktop: string; }; true: { phone: string; desktop: string; }; }; late: { at: [number, number] }; }[];
  /** I2: independent specimen documents and late shell shapes; actual living/placement demand stays authoritative. */
  readonly CABIN_LATE: { hash: string; at: [number, number] }[];
  readonly CABIN_LIBRARIES: { id: string; kind: "owned"; models: { id: string; file: string; attributes: Record<string, string>; }[]; }[];
  readonly CABIN_RAW_MODELS: NamedBlob[];
  readonly CABIN_PACKED_MODELS: NamedBlob[];
  readonly CABIN_MATERIALS: unknown[];
  readonly CABIN_MODEL_ROWS: unknown[];
}
/** D65: the cabin scene rows over the cabin bake (its grid comes from the program's sources), made once per sources;
 *  GR8: the scene and living rows and shapes are the program's bake (bake-cabin-scenes.mjs, bake-cabin-living.mjs). */
export const cabinScene: (sources: PineSources) => Promise<CabinScene> = perSources(async (sources: PineSources): Promise<CabinScene> => {
  const bake = await cabinSceneBake(sources), metadata = CABIN_SCENE_ROWS.parse(bake.rows), living = await cabinLiving(sources);
  const cabins = pineCabins(sources).rows;
  const authored = timberWorld(sources);
  const CABIN_PLACEMENTS: ReturnType<typeof parseWorldScenePlacement>[] = [];
  const CABIN_JSON_BLOBS: ReturnType<typeof nameBlob>[] = [...living.CABIN_LIVING_BLOBS, nameBlob('world/building-sites.json', 'json', new TextEncoder().encode(JSON.stringify(cabinSites(sources))))];
  const encode = (file: string, row: unknown) => nameBlob(file, 'json', new TextEncoder().encode(JSON.stringify(row)));
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
    const row = sourceGraph(metadata, world.file);
    CABIN_JSON_BLOBS.push(encode(world.file, parseWorldSceneWeld({ ...row, id: 'cabins.shells', resources: living.cabinLivingResources(world.tier, world.shadow), placements,
      sets: [{ id: 'pine-hollow/mill-hamlet', name: 'Mill hamlet', file: 'data/cabinScenes.generated.json', place: 'pine-hollow/hamlet', members: hamlet }] })));
  }
  for (const specimen of metadata.specimens) CABIN_JSON_BLOBS.push(encode(specimen.file, sourceGraph(metadata, specimen.file)));
  const worldFile = (tier: 'phone' | 'desktop', shadow: boolean): string => {
    const row = metadata.worlds.find(entry => entry.tier === tier && entry.shadow === shadow);
    if (row === undefined) throw new Error('Missing cabin world topology'); return row.file;
  };
  // I2: the cabins build after the player has control. None of them shows from the spawn (a probe hid the whole weld at
  // four headings on the phone: only wind motion changed), so they never pop in where the player starts
  const CABIN_WELDS: { id: string; file: { knob: string; false: { phone: string; desktop: string; }; true: { phone: string; desktop: string; }; }; late: { at: [number, number] }; }[] = [{ id: 'cabins.shells', file: { knob: 'pine.cabinDetailShadows',
    false: { phone: worldFile('phone', false), desktop: worldFile('desktop', false) }, true: { phone: worldFile('phone', true), desktop: worldFile('desktop', true) } }, late: { at: [HAMLET.x, HAMLET.z] } }];
  const CABIN_LIBRARIES: { id: string; kind: "owned"; models: { id: string; file: string; attributes: Record<string, string>; }[]; }[] = [...living.CABIN_LIVING_LIBRARIES, ...[...new Set(metadata.geometry.map(row => row.library))].map(id => ({ id, kind: 'owned' as const,
    models: metadata.geometry.filter(row => row.library === id).map(({ library: _library, ...row }) => row) }))];
  // GR8: the stored shapes' GLBs, built in memory: raw for the map assembly, meshopt-named for the output (as their
  // `meshopt: true` sources were)
  const shapes: [string, Uint8Array][] = [...metadata.blobs.filter(row => row.kind === 'glb').map((row): [string, Uint8Array] => {
    const bytes = bake.glbs.get(row.source);
    if (bytes === undefined) throw new Error(`Missing baked cabin shape: ${row.source}`);
    return [row.name, bytes];
  }), ...living.CABIN_LIVING_SHAPES];
  const CABIN_RAW_MODELS: NamedBlob[] = shapes.map(([name, bytes]) => nameBlob(name, 'glb', bytes));
  // iPhone downloads I3: the shipped shapes in phone geometry when that serves fewer bytes (nameCompactBlob: 16-bit grid
  // positions, 8-bit normals and colours, the owned-geometry intake baking the grid back), else the meshopt pick
  const CABIN_PACKED_MODELS: NamedBlob[] = await (cabinPacking.get(sources) ?? nameCompactBlobs)(shapes);
  // the living libraries' models name shared shape files too: those are the resources' files, read at intake
  const livingFiles = new Set([...living.CABIN_LIVING_SHAPES.map(([name]) => name), ...living.CABIN_LIVING_LIBRARIES.flatMap(library => library.models.map(model => model.file))]);
  const resident = new Set(CABIN_PACKED_MODELS.filter(blob => blob.file.name !== undefined && livingFiles.has(blob.file.name)).map(blob => blob.file.hash));
  const CABIN_LATE = [...new Set([...CABIN_PACKED_MODELS.map(blob => blob.file.hash).filter(hash => !resident.has(hash)),
    ...CABIN_JSON_BLOBS.filter(blob => blob.file.name?.startsWith('scenes/cabins/') === true).map(blob => blob.file.hash)])]
    .map(hash => ({ hash, at: [HAMLET.x, HAMLET.z] as [number, number] }));
  const CABIN_MATERIALS: unknown[] = metadata.sourceMaterials.map(row => ({ id: slot(row.id), kind: 'source', load: 'placement', url: row.url,
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
  const CABIN_MODEL_ROWS: unknown[] = [];
  for (const family of families) {
    const building = 'building' in family, prop = Object.entries(propIds).find(([, id]) => id === family.key)?.[0];
    const boxRow = prop === undefined ? undefined : Object.entries(logKit.PROP_BOXES).find(([id]) => id === prop)?.[1];
    const colliders = boxRow === undefined || boxRow === null ? [] : [{ kind: 'box', x: 0, y: boxRow.h / 2, z: 0, hx: boxRow.hw, hy: boxRow.h / 2, hz: boxRow.hd, surface: 'wood' }];
    const choices = family.key === 'log-cabin' ? variants : [{ id: 'only', params: building ? { site: 0 } : {} }];
    CABIN_MODEL_ROWS.push({ key: family.key, id: `pine-hollow/${family.key}`, name: family.name, file: 'data/cabinScenes.generated.json',
      load: 'demand', category: building ? 'buildings' : 'props', pipeline: building ? 'code' : 'cc0', ...(building || prop !== undefined ? { surface: 'wood' } : {}),
      defaults: building ? { site: 0 } : {}, variants: family.key === 'log-cabin' ? variants : [], assembly: 'scene',
      choices: choices.map(choice => ({ id: choice.id, params: choice.params, size: [1, 1, 1], draws: [], colliders,
        scene: { knob: 'pine.cabinDetailShadows',
          false: { phone: specimenFile(family.key, choice.id, 'phone', false), desktop: specimenFile(family.key, choice.id, 'desktop', false) },
          true: { phone: specimenFile(family.key, choice.id, 'phone', true), desktop: specimenFile(family.key, choice.id, 'desktop', true) } } })) });
  }
  return { CABIN_PLACEMENTS, CABIN_JSON_BLOBS, CABIN_WELDS, CABIN_LATE, CABIN_LIBRARIES, CABIN_RAW_MODELS, CABIN_PACKED_MODELS, CABIN_MATERIALS, CABIN_MODEL_ROWS };
});
