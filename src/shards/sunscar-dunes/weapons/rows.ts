import type { EquipmentRow } from '#engine';
import { STRINGS } from '../strings';
import { CUES } from '../audio/cues';

export const WHIP_ROW: EquipmentRow = { id: 'weapon.signal-bullwhip', legacySlot: 'signal-bullwhip',
  cues: CUES,
  ui: { name: STRINGS.whip, icon: 'sword', touch: 'melee', inputContext: 'sunscar.whip', lockOn: true, melee: true, tracers: false, swapIcon: '〰' },
  meta: { name: STRINGS.whip, icon: 'sword', blurb: STRINGS.whipBlurb, category: 'weapon' } };
