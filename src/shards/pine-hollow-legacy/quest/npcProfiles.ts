import type { NpcRigProfile } from '@wildshard/game/systems/npc/npcRig';
import type { NpcKind } from '../models/people';
/** Pine's NPC hulls use the same kit skeleton; only Hale carries a lantern. */
export const NPC_RIGS: Readonly<Record<NpcKind, NpcRigProfile>> = {
  ranger: { id: 'pine.ranger', lantern: true },
  trader: { id: 'pine.trader', lantern: false },
  miller: { id: 'pine.miller', lantern: false },
};
