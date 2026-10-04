import type { EquipmentRow } from '@wildshard/engine';
import { STRINGS } from '../strings';
import { CUES } from '../audio/cues';

export const WHIP_ROW: EquipmentRow = { id: 'weapon.template-whip', legacySlot: 'template-whip',
  cues: CUES,
  ui: { name: STRINGS.whip, icon: 'sword', touch: 'melee', inputContext: 'template.whip', lockOn: true, melee: true, tracers: false, swapIcon: '〰' },
  meta: { name: STRINGS.whip, icon: 'sword', blurb: STRINGS.whipBlurb, category: 'weapon' } };
export const LANTERN_ROW: EquipmentRow = { id: 'tool.template-lantern',
  ui: { name: STRINGS.lantern, icon: 'glyph', touch: 'melee', lockOn: false, melee: false, tracers: false, swapIcon: '' },
  meta: { name: STRINGS.lantern, icon: 'glyph', blurb: STRINGS.lanternBlurb, category: 'tool' } };
