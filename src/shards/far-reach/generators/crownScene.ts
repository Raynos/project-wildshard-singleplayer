import { parseWorldScene, type PrivateScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import STONES from '../data/crownInstances.generated.json' with { type: 'json' };
import { CROWN, DAIS } from '../data/layout';

/** Prepared carved stones and dais retain their authored world frames and painted material ports. */
export function crownSceneSource(): Uint8Array {
  const models = [
    { id: 'stone0', model: 'crown-stone', look: null },
    { id: 'stone1', model: 'crown-stone-b', look: null },
    { id: 'dais', model: 'crown-dais', look: 'crown-dais' },
  ];
  const nodes: PrivateScene['nodes'] = [
    { kind: 'group', id: 'crown', name: 'far.crown.arena', children: ['bake', 'stone0', 'stone1', 'dais'] },
    { kind: 'object', id: 'bake', source: 'bake', missing: 'refuse', children: [] },
  ];
  for (const [index, matrices] of STONES.entries()) nodes.push({
    kind: 'mesh', id: `stone${index}`, name: `far.crown.stone-${index}`, geometry: `stone${index}`, material: `stone${index}`,
    instances: matrices.length / 16, matrices, missing: 'omit', children: [],
  });
  nodes.push({ kind: 'mesh', id: 'dais', name: 'far.crown.dais', geometry: 'dais', material: 'dais',
    position: [DAIS.x, CROWN.y - 0.08, DAIS.z], missing: 'omit', children: [] });
  const recipe: WorldSceneRecipe = { scene: { version: 1, root: 'crown', nodes, textures: [],
    materials: models.map(row => ({ kind: 'port', id: row.id, source: row.id })) }, imports: [{ kind: 'baked', id: 'bake', piece: 'crown' }] };
  parseWorldScene(recipe);
  return new TextEncoder().encode(`/** Crown assembly and borrowed collider binding, generated from authored placement rows. */\nexport const CROWN_SCENE = ${JSON.stringify({ recipe, models, bindings: { colliders: { kind: 'colliders', part: 'bake' } } })} as const;\n`);
}
