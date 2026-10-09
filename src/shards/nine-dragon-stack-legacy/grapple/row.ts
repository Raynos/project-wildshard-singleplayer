import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { JIAN_ROW } from '../vm/jianRow';

/** Node-safe authored Tool metadata; scene installation belongs to FeiZhua. */
export const FEI_ZHUA_ROW: EquipmentRow = {
  id: 'tool.fei-zhua',
  ui: { ...JIAN_ROW.ui, name: 'Fei Zhua', icon: 'grapple' },
  meta: { name: 'tool.fei-zhua', icon: 'grapple', blurb: 'Lock a hook, then jump', category: 'Grapple' },
};
