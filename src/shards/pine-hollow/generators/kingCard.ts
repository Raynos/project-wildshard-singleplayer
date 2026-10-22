import * as v from 'valibot';
import { SocketRigCreatureSchema } from '@wildshard/format/socketRigCreature';
import authoredLook from '../data/antlerKingLook.json' with { type: 'json' };

/** The original King card and coat. The existing socket rig host dresses its specimen and live body. */
export const ANTLER_KING_CARD = v.parse(SocketRigCreatureSchema, {
  model: { id: 'pine-hollow/antler-king', pipeline: ['hunyuan', 'code'], file: 'src/shards/pine-hollow/generators/kingCard.ts', surface: 'wood' },
  product: 'pine-hollow', sockets: 'combat/roaming.json', kind: 'antler-king', coat: authoredLook.KING_COAT,
});
