/**
 * The kokpar marker post (E306 / E315 M3): a weathered larch post 1.25 m tall ringing the kokpar field's trodden oval
 * (src/shards/nalati-grasslands/world/Bowl.ts sets 34; every fourth carries a pennant — the shard's cloth, not the model). Placed on the
 * ground (`at.y`), sunk 0.3 m. Painted into its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Walk-through.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { v3 } from '../world/paint';
import { pole } from '@wildshard/engine/world/geometryKit';
import { PC } from '../world/props';
import { painted, type Paint } from '../world/painted';

const paint: Paint<object> = (kit, at) => {
  kit.add(pole(v3(at.x, at.y - 0.3, at.z), v3(at.x, at.y + 1.25, at.z), 0.06, 0.05, 6), PC.woodGrey, { foot: 0.7 });
  return {};
};

export const kokparPost = defineModel<object>({
  id: 'nalati-grasslands/kokpar-post', name: 'Kokpar marker post', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/kokparPost.ts', surface: 'wood',
  defaults: {},
  build: painted(paint, { seed: 0x60ba }),
});
