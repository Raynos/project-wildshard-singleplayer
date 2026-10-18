import { parseWorldScene } from '@wildshard/format/clientChannels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { nameBlob } from '@wildshard/sdk/blobs';
import scenes from '../data/restScenes.generated.json' with { type: 'json' };
import pieces from '../assets/pieces.generated.json' with { type: 'json' };
import world from '../data/worldBakes.generated.json' with { type: 'json' };
import { SIGNAL_SOURCE_LIBRARIES, SIGNAL_SOURCE_BLOBS } from './sceneSources';
import { SIGNAL_SKIRT_BLOBS, SIGNAL_SKIRT_LIBRARY, SIGNAL_SKIRT_STEPS } from './skirtScenes';

const json = (name: string, value: unknown) => nameBlob(name, 'json', new TextEncoder().encode(JSON.stringify(value)));
export const SIGNAL_SCENE_BLOBS = [...SIGNAL_SOURCE_BLOBS, ...SIGNAL_SKIRT_BLOBS];
const steps: unknown[] = [], effects: { readonly part: string; readonly pool: string | null; readonly rows: unknown }[] = [];
/** Original order, native hierarchy and fields. Sources remain the existing
 * model libraries and kind bakes; this only declares their assembly bindings. */
const definitions = [
  ['tower', 'sunscar.tower', scenes.bindings.tower, world.tower.colliders],
  ['caravan', 'sunscar.caravan', scenes.bindings.caravan, world.caravan.colliders],
  ['well', 'sunscar.well', scenes.bindings.well, world.well.colliders],
  ['rocks', 'sunscar.rocks', null, world.rocks.colliders],
  ['dressing', 'sunscar.dressing', null, world.dressing.colliders],
  ...scenes.bindings.braziers.map((row, index) => { const baked = world.braziers.braziers[index]; if (baked === undefined) throw new Error('Missing original brazier'); return [`brazier.${String(index)}`, `sunscar.brazier.${String(index)}`, row, baked.colliders] as const; }),
] as const;
for (const [id, piece, source, colliders] of definitions) {
  const file = `world/scenes/${id}.json`;
  const recipe = source === null ? parseWorldScene({ scene: { version: 1, root: 'root', nodes: [
    { id: 'root', kind: 'group', children: ['baked'] }, { id: 'baked', kind: 'object', source: 'baked', missing: 'refuse' },
  ], materials: [] }, imports: [{ id: 'baked', kind: 'baked', piece: id }] }) : parseWorldScene(source.recipe);
  // Optional source assets are not supported: admission requires every original
  // primitive, model and painted source before this recipe can be constructed.
  for (const node of recipe.scene.nodes) if (node.kind === 'object' || node.kind === 'anchor') node.missing = 'refuse';
  SIGNAL_SCENE_BLOBS.push(json(file, recipe));
  const metadata = pieces.find(row => row.id === piece);
  if (metadata === undefined) throw new Error('Missing original place registration');
  const publish = Object.fromEntries(Object.entries(source?.fields ?? {}).filter(([name]) => name !== 'root')
    .map(([name, binding]) => [name, binding.kind === 'colliders' ? { ...binding, part: piece } : binding] as const));
  for (const [from, to] of [['brazierAt', 'brazier-at'], ['lampAt', 'lamp-at'], ['bowlAt', 'bowl-at'], ['glowAt', 'glow-at']]) {
    if (from !== undefined && to !== undefined && publish[from] !== undefined) publish[to] = publish[from];
  }
  for (const node of recipe.scene.nodes) if (node.id !== recipe.scene.root && !(node.id in publish)) Object.assign(publish, {
    [node.id]: { kind: node.kind === 'mesh' ? 'mesh' : node.kind === 'group' ? 'group' : 'object', part: node.id },
  });
  for (const effect of [...source?.lamps ?? [], ...source?.fires ?? []]) effects.push({ ...effect, part: `${id}.${effect.part}` });
  steps.push({ id, scene: file, lights: source?.lights ?? [], publish,
    geometry: Object.fromEntries(recipe.scene.nodes.flatMap(node => node.kind === 'mesh' ? [[node.geometry, { library: 'models', model: node.geometry }]] : [])),
    models: Object.fromEntries(recipe.imports.flatMap(row => row.kind === 'model' ? [[row.model, { library: 'models', model: row.model }]] : [])),
    baked: Object.fromEntries(recipe.imports.flatMap(row => row.kind === 'baked' ? [[row.piece, { library: 'bakes', model: row.piece }]] : [])),
    collectMaterials: [...new Set(recipe.imports.flatMap(row => row.kind === 'baked' && row.materials !== undefined ? [row.materials] : []))],
    registry: [{ id: metadata.id, name: metadata.name, file: metadata.file, category: metadata.category, surface: metadata.surface, part: recipe.scene.root, colliders }],
  });
}
SIGNAL_SCENE_BLOBS.push(json('world/places-effects.json', effects));
export const SIGNAL_WORLD_SCENES = parseWorldScenes({ version: 1, libraries: [...SIGNAL_SOURCE_LIBRARIES, SIGNAL_SKIRT_LIBRARY],
  materials: [{ id: 'sand', kind: 'look', look: 'pbr' }], steps: [...SIGNAL_SKIRT_STEPS, ...steps] });
