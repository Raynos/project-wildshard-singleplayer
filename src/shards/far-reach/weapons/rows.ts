import type { EquipmentRow } from '#engine';
import { STRINGS } from '../strings';
import { CUES } from '../audio/cues';

export const FAN_ROW: EquipmentRow = { id: 'weapon.war-fan', legacySlot: 'war-fan', cues: CUES,
  ui: { name: STRINGS.fan, icon: 'sword', touch: 'melee', inputContext: 'far.fan', lockOn: true, melee: true, tracers: false, swapIcon: '⌒' },
  meta: { name: STRINGS.fan, icon: 'sword', blurb: STRINGS.fanBlurb, category: 'weapon' } };
