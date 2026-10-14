import { CUES } from './cues';
import { WHIP_ITEM } from './items';

/** The native whip's existing identity, cues and sword glyph; its controller stays trusted. */
export const WHIP_ROW = { id: WHIP_ITEM.id, legacySlot: 'sunscar-whip', cues: CUES,
  ui: { name: WHIP_ITEM.ui.name, icon: 'sword', touch: 'melee', inputContext: WHIP_ITEM.context, lockOn: true, melee: true, tracers: false, swapIcon: WHIP_ITEM.ui.swapIcon },
  meta: { name: WHIP_ITEM.ui.name, icon: 'sword', blurb: WHIP_ITEM.ui.blurb, category: 'weapon' } } as const;
