import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { loadProp, propScan } from './mossyBoulder';

export const loadTreeStump = (ctx: ModelContext): Promise<void> => loadProp(ctx, 'stumps', 'tree_stump_01');
/** The scan's original stump parts, each with its authored support-point hull. */
export const treeStump = defineModel<Record<string, never>>({
  id: 'pine-hollow/tree-stump', name: 'Tree stump', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/treeStump.ts', surface: 'wood', defaults: {},
  build: ctx => propScan(ctx, 'stumps').parts.map(p => p.draw),
  colliders: (_, ctx) => propScan(ctx, 'stumps').parts.map(p => ({ kind: 'hull', x: 0, y: 0, z: 0, points: p.hull })),
});
