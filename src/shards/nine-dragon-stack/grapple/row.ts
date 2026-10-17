import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';

/** Node-safe authored Tool metadata; scene installation belongs to FeiZhua. */
export const FEI_ZHUA_ROW: EquipmentRow = {
  id: 'tool.fei-zhua',
  ui: { ...SWORD_WOOD.ui, name: 'Fei Zhua', icon: 'grapple' },
  meta: { name: 'tool.fei-zhua', icon: 'grapple', blurb: 'Lock a hook, then jump', category: 'Grapple' },
};
