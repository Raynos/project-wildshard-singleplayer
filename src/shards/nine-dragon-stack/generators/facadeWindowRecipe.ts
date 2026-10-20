import { parseWorldScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { facadeWindowPackets } from './facadeWindowPackets';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';

/** Extend the existing dressing/cards recipes; two draws fit dressing's original instance cap. */
export function addWindowNodes(input: WorldSceneRecipe, indices: readonly number[]): WorldSceneRecipe {
  const selected = facadeWindowPackets().filter((_, i) => indices.includes(i));
  return parseWorldScene({ ...input, scene: { ...input.scene,
    materials: [...input.scene.materials, { kind: 'port', id: 'windows', source: 'windows' }],
    nodes: [...input.scene.nodes.map(node => node.kind === 'group' && node.id === input.scene.root
      ? { ...node, children: [...node.children, ...selected.map(row => row.id)] } : node),
    ...selected.map(row => ({ kind: 'mesh', id: row.id, name: 'facade-windows', geometry: `window-quad-${row.id}`, material: 'windows',
      instances: row.count, missing: 'omit' }))],
  } });
}

/** Distinct geometry ports keep the three mutable application channels independent. */
export function windowStep(indices: readonly number[]): Pick<WorldScenesSection['steps'][number], 'geometry' | 'materials' | 'instanceAttributes' | 'publish'> {
  const rows = facadeWindowPackets().filter((_, i) => indices.includes(i));
  return { geometry: Object.fromEntries(rows.map(row => [`window-quad-${row.id}`, { library: 'shapes', model: 'window-quad' }])),
    materials: { windows: 'windows' }, instanceAttributes: rows.flatMap(row => row.attributes),
    publish: Object.fromEntries(rows.map(row => [row.id, { kind: 'object' as const, part: row.id }])) };
}
