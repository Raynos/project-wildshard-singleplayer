import { SKY_ITEMS } from './items';
import cueData from '../../data/cues.json' with { type: 'json' };

const CUES = cueData as Record<keyof typeof cueData, `cue.${string}`>;

/** Native fan identity and existing cue/UI presentation as ordinary authored data. */
export const FAN_PRESENTATION = { cues: CUES, ui: { touch: 'melee', lockOn: true, melee: true, tracers: false } } as const;
const item = SKY_ITEMS.rows[0];
export const FAN_ROW = { id: item.id, cues: CUES,
  ui: { name: item.ui.name, icon: item.ui.icon, touch: 'melee', inputContext: item.context, lockOn: true, melee: true, tracers: false, swapIcon: item.ui.swapIcon },
  meta: { name: item.ui.name, icon: item.ui.icon, blurb: item.ui.blurb, category: 'weapon' } } as const;
