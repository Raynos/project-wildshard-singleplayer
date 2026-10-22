import { SocketRigCreature } from '@wildshard/game/models/socketRigCreature';
import authoredLook from '../../data/antlerKingLook.json' with { type: 'json' };

/**
 * The Antler King, Pine Hollow's boss (PINE-HOLLOW-REMASTER PH-C2 / PH-M3, E322 F-M1: Jake picked B): his own upright hull
 * (Hunyuan3D-2, `public/assets/pine-hollow/creatures/antler-king-rig[.phone].rigged.glb`) on the shared limb rig, drawn ×2.6
 * by the fight in a bark-dark, moss-shouldered coat (../data/antlerKingLook.json `KING_COAT`). His species is the hull book's
 * derived row (generators/nativeView.ts `SPECIES_LOOKS.derived`); his lanterns, amber ribcage and core are the fight's socket
 * rig rows (combat/roaming.json), which dress the live copy and the card alike. The fight spawns him at night in the King's
 * clearing; nothing here draws him in the world.
 */
export const ANTLER_KING = new SocketRigCreature({
  model: { id: 'pine-hollow/antler-king', pipeline: ['hunyuan', 'code'], file: 'src/shards/pine-hollow/models/antlerKing.ts', surface: 'wood' },
  product: 'pine-hollow', sockets: 'combat/roaming.json', kind: 'antler-king', coat: authoredLook.KING_COAT,
});
