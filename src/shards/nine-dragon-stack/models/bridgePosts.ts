/**
 * The stone crossings' posts (dome B2, E169; E346): what stands along the arched stone bridges and the gate bridges over
 * the Yamen Well (../world/wellParts.ts). Both are drawn into their crossing's kit (one merged mesh per region, the
 * neon spill baked in), so a post costs no draw of its own; the world records each where it stands and build.ts
 * registers them there (`place` with `drawnInto`). Neither collides: the deck's rail walls hold the walker in
 * (well-bridges.ts `deckColliders`). Built here alone, their foot on the origin, for the Model Explorer:
 *  - the lotus-capped post of the carved balustrade (`lotusPost`): a 26 cm stone post under a lotus cap and bud, every
 *    ~1.9 m along both edges of every stone and gate bridge; the far crossings (~100 m from the rim) leave the cap off;
 *  - the stone lamp post (`lampPostStone`) at each end of a crossing's balustrades: a lotus-capped stone post with an iron
 *    crook reaching out over the deck's edge (+z here; the copies on a bridge's north edge are turned); its paper
 *    lantern is one of the fragment's paper lanterns.
 */
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { Kit } from '../world/kit';
import { lampPostStone, lotusPost } from '../world/wellParts';
import { ndLook, need } from '../world/modelLook';

const FILE = 'src/shards/nine-dragon-stack/models/bridgePosts.ts';

function kit(ctx: ModelContext, key: string, draw: (k: Kit) => void): readonly ModelPart[] {
  const geometry = ctx.once(`nds:bridge-post:${key}`, () => { const k = new Kit(); draw(k); return k.build(); });
  return [{ geometry, material: need(ndLook(ctx).mat, 'the Jiehua program') }];
}

export interface LotusPostParams { readonly capped: boolean }

export const lotusPostModel = defineModel<LotusPostParams>({
  id: 'nine-dragon-stack/lotus-post', name: 'Lotus-capped balustrade post', category: 'props', pipeline: 'code', file: FILE, defaults: { capped: true },
  variants: [{ id: 'lotus', label: 'Lotus cap', params: { capped: true } }, { id: 'bare', label: 'Far crossings (no cap)', params: { capped: false } }],
  build: (ctx, p) => kit(ctx, `lotus:${String(p.capped)}`, (k) => { lotusPost(k, 0, 0, 0, p.capped); }),
});

export const lampPostModel = defineModel({
  id: 'nine-dragon-stack/lamp-post', name: 'Stone lamp post', category: 'props', pipeline: 'code', file: FILE, defaults: {},
  build: (ctx) => kit(ctx, 'lamp', (k) => { lampPostStone(k, 0, 0, 0, 1); }),
});
