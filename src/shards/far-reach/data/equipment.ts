import { STRINGS } from './strings';
import { CUES } from './cues';

/** Native fan identity and existing cue/UI presentation as ordinary authored data. */
export const FAN_PRESENTATION = { cues: CUES, ui: { touch: 'melee', lockOn: true, melee: true, tracers: false } } as const;
export const FAN_ROW = { id: 'weapon.far-reach.fan', legacySlot: 'far-fan', cues: CUES,
  ui: { name: STRINGS.fan, icon: 'sword', touch: 'melee', inputContext: 'far.fan', lockOn: true, melee: true, tracers: false, swapIcon: '◠' },
  meta: { name: STRINGS.fan, icon: 'sword', blurb: STRINGS.fanBlurb, category: 'weapon' } } as const;
