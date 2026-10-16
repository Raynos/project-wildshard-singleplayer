import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { loadProp, propScan } from './mossyBoulder';

export const loadFallenLog = (ctx: ModelContext): Promise<void> => loadProp(ctx, 'log', 'dead_tree_trunk');
/** The scan's original log parts and single own-space capsule. */
export const fallenLog = defineModel<Record<string, never>>({
  id: 'pine-hollow/fallen-log', name: 'Fallen log', category: 'nature', pipeline: 'cc0',
  file: 'src/shards/pine-hollow/models/fallenLog.ts', surface: 'wood', defaults: {},
  build: ctx => propScan(ctx, 'log').parts.map(p => p.draw), colliders: (_, ctx) => [propScan(ctx, 'log').capsule],
});
