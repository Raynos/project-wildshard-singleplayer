import cues from '../../data/cues.json' with { type: 'json' };
import { WHIP_ITEM } from './items';

// JSON preserves the cue values but widens their TypeScript string types.
const cue = (value: string): `cue.${string}` => {
  if (!/^cue\.[a-z][a-zA-Z0-9.-]*$/u.test(value)) throw new Error('Invalid authored whip cue');
  return `cue.${value.slice(4)}`;
};
const CUES = { fire: cue(cues.fire), heavy: cue(cues.heavy), impact: cue(cues.impact), reload: cue(cues.reload) };

/** The native whip's existing identity, cues and sword glyph; its controller stays trusted. */
export const WHIP_ROW = { id: WHIP_ITEM.id, cues: CUES,
  ui: { name: WHIP_ITEM.ui.name, icon: WHIP_ITEM.ui.icon, touch: 'melee', inputContext: WHIP_ITEM.context, lockOn: true, melee: true, tracers: false, swapIcon: WHIP_ITEM.ui.swapIcon },
  meta: { name: WHIP_ITEM.ui.name, icon: WHIP_ITEM.ui.icon, blurb: WHIP_ITEM.ui.blurb, category: 'weapon' } } as const;
