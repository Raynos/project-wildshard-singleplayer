/**
 * The token shelf (E315 M2; PINE-HOLLOW-REMASTER PH-C8's last piece): a pine display rack with the eight carved tokens in
 * a row — once all eight are found it stands on the ranger's mantel (the "Whittled Down" achievement's cabin side). Baked
 * offline (../generators/codeParts.ts) as ONE merged mesh on the shared `lowPolyLookMaterial` (the tokens' own pickup material, no new program): the rack
 * (a plank, a slotted back rail, two end posts) and the pickup's `carvedToken` eight times, on edge, leaning back a touch.
 * Its own space: the origin on the mantel top under the rack's centre, +Z out into the room. No shadow, no light. The
 * quest places it on the ranger's mantel and shows it (src/shards/pine-hollow/quest/tokenShelf.ts).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { codePart, loadCodeParts } from '../world/codeParts';

export const tokenShelf = defineModel<Record<string, never>>({
  id: 'pine-hollow/token-shelf', name: 'Token shelf', category: 'props', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/tokenShelf.ts', surface: 'wood',
  defaults: {}, prepare: loadCodeParts,
  build: (ctx) => [{ geometry: ctx.once('pine-hollow/token-shelf', () => codePart('token-shelf')), material: lowPolyLookMaterial(ctx.sky), receiveShadow: true }],
});
