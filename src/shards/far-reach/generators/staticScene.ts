import type { PrivateScene, WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { fixedWorld, skyFixedWorldValues, type SkyFixedWorldValues } from './fixedWorld';
import type { SkyPlacements } from './placements';
import { WORLD_PLACEMENT_INPUTS, skyWorldPlacementValues } from './worldPlacementBytes';

type Placed = SkyPlacements['standalone'];
/** Decorative model matrices and hierarchy are author data; live look materials remain owned ports. */
function recipe(placed: Placed, keels: SkyPlacements['keels'], standalone: boolean, values: SkyFixedWorldValues): { readonly recipe: WorldSceneRecipe; readonly models: readonly string[]; readonly bindings: readonly { readonly piece: string; readonly part: string; readonly baked?: string }[]; readonly fixed: ReturnType<typeof fixedWorld> } {
  const nodes: PrivateScene['nodes'] = [
    { kind: 'group', id: 'decorations', children: ['sky-isles', 'trees', 'dressing', 'falls'] },
    { kind: 'group', id: 'sky-isles', name: 'far.sky-isles', children: ['isles', 'keels'] },
    { kind: 'group', id: 'isles', children: [] },
    { kind: 'group', id: 'keels', name: 'far.isle-keels', children: [] },
    { kind: 'group', id: 'trees', name: 'far.trees', children: [] },
    { kind: 'object', id: 'dressing', source: 'dressing-source', missing: 'refuse', children: [] },
    { kind: 'group', id: 'falls', children: ['fall-sheet'] },
    { kind: 'mesh', id: 'fall-sheet', geometry: 'fall', material: 'falls', instances: placed.falls.length / 16,
      matrices: placed.falls, missing: 'empty', children: [] },
  ];
  const materials: PrivateScene['materials'] = [{ kind: 'port', id: 'falls', source: 'falls' }], models = new Set<string>();
  for (const [parent, rows, look] of [
    ['isles', placed.isles, 'sky-isle'], ['keels', keels, 'sky-isle-keel'], ['trees', placed.trees, 'tree-bark'],
  ] as const) {
    const group = nodes.find(node => node.id === parent);
    if (group === undefined) throw new Error('Missing static model group');
    for (const { model, m } of rows) {
      if (m.length === 0) continue;
      models.add(model);
      const id = `${parent}.${model}`, material = `${look}:${model}`;
      nodes.push({ kind: 'mesh', id, name: parent === 'trees' ? `far.trees.${model}` : `far.sky-isles.${model}`,
        geometry: `hero-${model}`, material, instances: m.length / 16, matrices: m, missing: 'omit', children: [] });
      group.children.push(id); materials.push({ kind: 'port', id: material, source: material });
    }
  }
  const fixed = fixedWorld(standalone, values);
  for (const model of fixed.models) models.add(model);
  return { fixed, recipe: { scene: { version: 1, root: 'decorations', nodes, materials, textures: [] },
    imports: [{ id: 'dressing-source', kind: 'baked', piece: 'dressing' }] }, models: [...models], bindings: [
      { piece: 'far.sky-isles', part: 'sky-isles' }, { piece: 'far.pines', part: 'trees' },
      { piece: 'far.dressing', part: 'dressing', baked: 'dressing-source' },
    ] };
}
/** Standalone and regional scenes share the same prepared model frames and original matrix rows. */
export function skyStaticScenes(placements: SkyPlacements, values: SkyFixedWorldValues = skyFixedWorldValues()): { readonly half: number; readonly standalone: ReturnType<typeof recipe>; readonly cell: ReturnType<typeof recipe> } {
  return { half: placements.half, standalone: recipe(placements.standalone, placements.keels, true, values), cell: recipe(placements.cell, placements.keels, false, values) };
}

/** Retained driver intake: declared native models replace the generated placement dependency. */
export async function skyStaticSceneBytes(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const inputs = new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, read(name)]));
  const { placements } = await skyWorldPlacementValues(inputs);
  return new TextEncoder().encode(`${JSON.stringify(skyStaticScenes(placements))}\n`);
}
