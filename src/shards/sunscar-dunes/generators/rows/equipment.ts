import cues from '../../data/cues.json' with { type: 'json' };
import { WHIP_ITEM } from './items';

// JSON preserves the cue values but widens their TypeScript string types.
const cue = (value: string): `cue.${string}` => {
  if (!/^cue\.[a-z][a-zA-Z0-9.-]*$/u.test(value)) throw new Error('Invalid authored whip cue');
  return `cue.${value.slice(4)}`;
};
const CUES = { fire: cue(cues.fire), heavy: cue(cues.heavy), impact: cue(cues.impact), reload: cue(cues.reload) };

/** The native whip's existing identity, cues and sword glyph; its controller stays trusted. */
export const WHIP_ROW: { readonly id: "weapon.sunscar-whip"; readonly cues: { fire: `cue.${string}`; heavy: `cue.${string}`; impact: `cue.${string}`; reload: `cue.${string}`; }; readonly ui: { readonly name: string; readonly icon: "sword"; readonly touch: "melee"; readonly inputContext: "sunscar.whip"; readonly lockOn: true; readonly melee: true; readonly tracers: false; readonly swapIcon: "〰"; }; readonly meta: { readonly name: string; readonly icon: "sword"; readonly blurb: string; readonly category: "weapon"; }; } = { id: WHIP_ITEM.id, cues: CUES,
  ui: { name: WHIP_ITEM.ui.name, icon: WHIP_ITEM.ui.icon, touch: 'melee', inputContext: WHIP_ITEM.context, lockOn: true, melee: true, tracers: false, swapIcon: WHIP_ITEM.ui.swapIcon },
  meta: { name: WHIP_ITEM.ui.name, icon: WHIP_ITEM.ui.icon, blurb: WHIP_ITEM.ui.blurb, category: 'weapon' } } as const;
