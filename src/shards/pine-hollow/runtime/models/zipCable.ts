/**
 * Pine Hollow's baked code parts as rows (E315 M2, G465), each one merged mesh baked offline (../generators/codeParts.ts).
 *
 * THE ZIP-LINE CABLE (PINE-HOLLOW-REMASTER PH-B3): the steel cable, a sagging chord (≈ 1.2 % of its span) from
 * the lookout's launch gantry to the landing's — a thin iron tube in the cabins' iron, baked offline between the two
 * anchors (../generators/codeParts.ts). Its own space: from its origin (the top end) to the bottom end. Placed once at
 * the top anchor (src/shards/pine-hollow/world/landmarks.ts).
 *
 * THE TOKEN SHELF (PH-C8's last piece): a pine display rack with the eight carved tokens in a row — once all eight are
 * found it stands on the ranger's mantel (the "Whittled Down" achievement's cabin side), on the shared
 * `lowPolyLookMaterial` (the tokens' own pickup material, no new program): the rack (a plank, a slotted back rail, two end
 * posts) and the pickup's `carvedToken` eight times, on edge, leaning back a touch. Its own space: the origin on the mantel
 * top under the rack's centre, +Z out into the room. No shadow, no light. The quest places it on the ranger's mantel and
 * shows it (src/shards/pine-hollow/quest/tokenShelf.ts).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { timberMats } from '../world/timber';
import { codePart, loadCodeParts, type CodePartName } from '../world/codeParts';

/** a row: its model, its baked part; `shelf` wears the pickups' low-poly material (wood, receives shadow), else the cabins' iron */
function codeModel(r: { readonly id: CodePartName; readonly name: string; readonly shelf: boolean }): ModelDef<Record<string, never>> {
  return defineModel<Record<string, never>>({
    id: `pine-hollow/${r.id}`, name: r.name, category: 'props', pipeline: 'code', file: 'src/shards/pine-hollow/runtime/models/zipCable.ts', ...(r.shelf ? { surface: 'wood' } : {}),
    defaults: {}, prepare: loadCodeParts,
    build: (ctx) => [{ geometry: codePart(r.id), material: r.shelf ? lowPolyLookMaterial(ctx.sky) : timberMats(ctx).iron, receiveShadow: r.shelf }],
  });
}

export const zipCable = codeModel({ id: 'zip-cable', name: 'Zip-line cable', shelf: false });
export const tokenShelf = codeModel({ id: 'token-shelf', name: 'Token shelf', shelf: true });
