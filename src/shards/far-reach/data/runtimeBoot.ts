import { STRINGS } from './strings';
import { GUST_ICON, SWING_ICON } from './icons';

/** Entry bounds and the fan's authored input, resolved by the shared boot host. */
export const SKY_RUNTIME_BOOT = {
  bounds: { x0: -250, x1: 250, z0: -250, z1: 250, floor: -8 },
  input: {
    hiddenMode: 'board',
    definition: { id: 'far.fan', actions: ['attack', 'heavy', 'lock', 'far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON } } } },
    description: { rows: [{ group: 'combat', id: 'far.gust', label: STRINGS.gustBinding, actions: ['far.gust'] }] },
  },
} as const;
