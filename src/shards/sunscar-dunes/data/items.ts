import { STRINGS } from './strings';

/** The whip's numbers' tags: what the lash's hits carry into the combat pipeline. */
const TAGS = ['actor.player', 'weapon.sunscar-whip', 'dmg.melee'] as const;

/**
 * The bullwhip as a declared item row (validated with the whole shardfile by shard.config.ts's parseShardfile) (SHARD-PLATFORM SF50-p / M3): the slot, its input context, the HUD name and the
 * numbers (reach, width, damage, cooldown, charge) are data the platform validates and installs
 * (`bindRuntimeItems`); the trusted runtime resolves its own family `sunscar-dunes.whip` (weapons/Bullwhip.ts reads its
 * crack from this row). The view recipe names the runtime's own model (weapons/whipModel.ts).
 */
export const WHIP_ITEMS = { version: 1,
  rows: [{ id: 'weapon.sunscar-whip', kind: 'weapon', family: 'sunscar-dunes.whip', slot: 'declared.weapon.sunscar-whip', context: 'sunscar.whip',
    ui: { name: STRINGS.whip, icon: 'sword', swapIcon: '〰', blurb: STRINGS.whipBlurb },
    view: { recipe: 'sunscar-dunes.whip', colour: '#5a3a24', position: [0.1, -0.095, -0.5], rotation: [0, 0, 0] }, hook: null,
    light: { id: 'sunscar.whip.light', damage: 18, cooldown: 0.45, range: 7, width: 0.9, tags: [...TAGS], effect: null },
    heavy: { id: 'sunscar.whip.heavy', damage: 16, cooldown: 0.9, range: 8, width: 0.9, tags: [...TAGS], effect: null },
    charge: 0.6 }],
  contexts: [{ id: 'sunscar.whip', keysFrom: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], touch: 'melee', lockable: true }],
  loadout: { primary: 'weapon.sunscar-whip', secondary: null, tools: [] },
} as const;
/** The one declared weapon row. */
export const WHIP_ITEM = WHIP_ITEMS.rows[0];
/**
 * The lash's own timing (seconds) and reactions, read by the platform's lash runtime (`@wildshard/game/systems/items/lash`)
 * in the browser whip and the headless one alike: the 0.12 s unroll, the heavy's second lash at 0.32 s, the 0.42 s show,
 * the second lash's stagger, and the first lash's 16 m/s yank on a creature of 40 hit points or less.
 */
export const WHIP_TIMING = { unroll: 0.12, second: 0.32, show: 0.42, stagger: 0.8, pull: 16, pullMaxHp: 40 } as const;
/** The move ids the lash's hits carry: the light crack and the double crack's two lashes. */
export const WHIP_MOVES = { light: 'sunscar.whip.crack', first: 'sunscar.whip.double.1', second: 'sunscar.whip.double.2' } as const;
