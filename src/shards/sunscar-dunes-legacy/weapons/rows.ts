import type { EquipmentIcon, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { CUES } from '../data/cues';
import { WHIP_ITEM } from '../data/items';

/** The declared item icons this runtime draws (its HUD has the sword glyph for the whip). */
export function whipIcon(name: string): EquipmentIcon {
  if (name !== 'sword') throw new Error(`Signal Dunes has no item icon ${name}`);
  return name;
}

/**
 * The whip's equipment row, read from its declared item row (data/items.ts). It keeps the pre-format weapon slot
 * `sunscar-whip`, so a current save's held weapon carries over, and the whip's cues.
 */
export const WHIP_ROW: EquipmentRow = { id: WHIP_ITEM.id, legacySlot: 'sunscar-whip',
  cues: CUES,
  ui: { name: WHIP_ITEM.ui.name, icon: whipIcon(WHIP_ITEM.ui.icon), touch: 'melee', inputContext: WHIP_ITEM.context, lockOn: true, melee: true, tracers: false, swapIcon: WHIP_ITEM.ui.swapIcon },
  meta: { name: WHIP_ITEM.ui.name, icon: whipIcon(WHIP_ITEM.ui.icon), blurb: WHIP_ITEM.ui.blurb, category: 'weapon' } };
