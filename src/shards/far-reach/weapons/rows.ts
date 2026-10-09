import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { STRINGS } from '../data/strings';
import { CUES } from '../data/cues';

export const FAN_ROW: EquipmentRow = { id: 'weapon.far-reach.fan', legacySlot: 'far-fan', cues: CUES,
  ui: { name: STRINGS.fan, icon: 'sword', touch: 'melee', inputContext: 'far.fan', lockOn: true, melee: true, tracers: false, swapIcon: '◠' },
  meta: { name: STRINGS.fan, icon: 'sword', blurb: STRINGS.fanBlurb, category: 'weapon' } };
