import STRINGS from '../../data/strings.json' with { type: 'json' };
import cueData from '../../data/cues.json' with { type: 'json' };

const CUES = cueData as Record<keyof typeof cueData, `cue.${string}`>;

/** Native fan identity and existing cue/UI presentation as ordinary authored data. */
export const FAN_PRESENTATION = { cues: CUES, ui: { touch: 'melee', lockOn: true, melee: true, tracers: false } } as const;
export const FAN_ROW = { id: 'weapon.far-reach.fan', legacySlot: 'far-fan', cues: CUES,
  ui: { name: STRINGS.fan, icon: 'sword', touch: 'melee', inputContext: 'far.fan', lockOn: true, melee: true, tracers: false, swapIcon: '◠' },
  meta: { name: STRINGS.fan, icon: 'sword', blurb: STRINGS.fanBlurb, category: 'weapon' } } as const;
