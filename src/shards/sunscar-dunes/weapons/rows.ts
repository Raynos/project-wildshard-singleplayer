import type { EquipmentRow } from '#engine';
import { STRINGS } from '../strings';
import { CUES } from '../audio/cues';

/** The bullwhip: a custom melee weapon on the baseline ATTACK disc (tap = crack, hold-release = double crack). */
export const WHIP_ROW: EquipmentRow = { id: 'weapon.sunscar-whip', legacySlot: 'sunscar-whip', cues: CUES,
  ui: { name: STRINGS.whip, icon: 'sword', touch: 'melee', inputContext: 'sunscar.whip', lockOn: true, melee: true, tracers: false, swapIcon: '〰' },
  meta: { name: STRINGS.whip, icon: 'sword', blurb: STRINGS.whipBlurb, category: 'weapon' } };
