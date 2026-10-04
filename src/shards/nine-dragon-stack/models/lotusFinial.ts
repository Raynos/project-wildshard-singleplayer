/**
 * The lotus-bud finial (E281; E306 / E315 second pass): the carved stone bud on every post of Lantern Square's
 * balustrade over the Well — a petal collar turned out over the post's cap, a neck, the bud swelling and closing to a
 * point, one ruled lathe of eight faces (../world/square.ts `lotusBud`). The balustrade draws each into the square's kit
 * (one merged mesh, the neon spill baked in), so a bud costs no draw of its own; it records where each stands (a post
 * that carries a TRELLIS lion keeps only its cap block) and build.ts registers them there (`place` with `drawnInto`).
 * Built here alone, its foot on the origin, for the Model Explorer.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { Kit } from '../world/kit';
import { lotusBud } from '../world/square';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/lotusFinial.ts';

export const lotusFinial = defineModel({
  id: 'nine-dragon-stack/lotus-finial', name: 'Lotus-bud finial', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => [{ geometry: ctx.once('nds:lotus-finial', () => { const k = new Kit(); lotusBud(k, 0, 0, 0); return k.build(); }), material: need(ndLook(ctx).mat, 'the Jiehua program') }],
});
