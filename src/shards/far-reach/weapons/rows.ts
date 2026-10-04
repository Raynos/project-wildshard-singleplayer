import type { EquipmentRow } from '@wildshard/engine';
import { STRINGS } from '../strings';
import { CUES } from '../audio/cues';

export const FAN_ROW: EquipmentRow = { id: 'weapon.far-fan', legacySlot: 'far-fan', cues: CUES,
  ui: { name: STRINGS.fan, icon: 'sword', touch: 'melee', inputContext: 'far.fan', lockOn: true, melee: true, tracers: false, swapIcon: '◠' },
  meta: { name: STRINGS.fan, icon: 'sword', blurb: STRINGS.fanBlurb, category: 'weapon' } };
