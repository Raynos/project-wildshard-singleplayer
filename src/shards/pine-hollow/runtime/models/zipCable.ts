/**
 * The zip-line cable (E315 M2; PINE-HOLLOW-REMASTER PH-B3): the steel cable, a sagging chord (≈ 1.2 % of its span) from
 * the lookout's launch gantry to the landing's — a thin iron tube in the cabins' iron, baked offline between the two
 * anchors (../generators/codeParts.ts). Its own space: from its origin (the top end) to the bottom end. Placed once at
 * the top anchor (src/shards/pine-hollow/world/landmarks.ts).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { timberMats } from '../../world/timber';
import { codePart, loadCodeParts } from '../../world/codeParts';

export const zipCable = defineModel<Record<string, never>>({
  id: 'pine-hollow/zip-cable', name: 'Zip-line cable', category: 'props', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/zipCable.ts',
  defaults: {}, prepare: loadCodeParts,
  build: (ctx) => [{ geometry: codePart('zip-cable'), material: timberMats(ctx).iron }],
});
