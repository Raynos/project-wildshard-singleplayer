import type { PrivateScene, WorldSceneRecipe } from '@wildshard/format/clientChannels';
import PLACEMENTS from '../data/placements.json' with { type: 'json' };

type Placed = typeof PLACEMENTS.standalone;
/** Decorative model matrices and hierarchy are author data; live look materials remain owned ports. */
function recipe(placed: Placed): { readonly recipe: WorldSceneRecipe; readonly models: readonly string[]; readonly bindings: readonly { readonly piece: string; readonly part: string; readonly baked?: string }[] } {
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
    ['isles', placed.isles, 'sky-isle'], ['keels', PLACEMENTS.keels, 'sky-isle-keel'], ['trees', placed.trees, 'tree-bark'],
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
  return { recipe: { scene: { version: 1, root: 'decorations', nodes, materials, textures: [] },
    imports: [{ id: 'dressing-source', kind: 'baked', piece: 'dressing' }] }, models: [...models], bindings: [
      { piece: 'far.sky-isles', part: 'sky-isles' }, { piece: 'far.pines', part: 'trees' },
      { piece: 'far.dressing', part: 'dressing', baked: 'dressing-source' },
    ] };
}
/** Standalone and regional scenes share the same prepared model frames and original matrix rows. */
export function skyStaticScenes(): { readonly half: number; readonly standalone: ReturnType<typeof recipe>; readonly cell: ReturnType<typeof recipe> } {
  return { half: PLACEMENTS.half, standalone: recipe(PLACEMENTS.standalone), cell: recipe(PLACEMENTS.cell) };
}
