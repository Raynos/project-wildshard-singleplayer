import KEEPSAKES from '../data/keepsakes.json' with { type: 'json' };
import { DRIFTWOOD_EFFECTS, DRIFTWOOD_COIN_VALUES, GOODS, DRIFTWOOD_PLAYER_GRANTS, DRIFTWOOD_WORN_GRANTS, DRIFTWOOD_WEAPON_GRANTS } from './economy';
import { DRIFTWOOD_FINDS } from './finds';
import { DRIFTWOOD_INTERACT } from '../data/interactables';

const flags = (input: readonly string[] | { readonly prefix: string; readonly count: number }): string[] => 'prefix' in input
  ? Array.from({ length: input.count }, (_, i) => `${input.prefix}${i + 1}`) : [...input];
/** Build the original flag ranges and world-space chart once; the page only filters current saved flags. */
export const DRIFTWOOD_LOOT = {
  id: 'driftwood.loot', gear: 'purse.coins', finds: null, marks: null, charted: false, chime: 'cue.loot.chime',
  economy: { tables: [
    { id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each', rows: Object.entries(DRIFTWOOD_COIN_VALUES).map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } },
    { id: 'loot.driftwood.trophies', domain: 'trophies', table: { mode: 'each', rows: Object.entries(KEEPSAKES.trophies).map(([item, row]) => ({ item, weight: 1, match: { kind: row.kind, ...(row.variant === null ? {} : { variant: row.variant }), unowned: true } })) } },
  ], effects: DRIFTWOOD_EFFECTS, goods: GOODS,
    grants: { player: DRIFTWOOD_PLAYER_GRANTS, worn: DRIFTWOOD_WORN_GRANTS, weapons: DRIFTWOOD_WEAPON_GRANTS },
    finds: { ...DRIFTWOOD_FINDS, counters: DRIFTWOOD_FINDS.counters.map(row => ({ ...row, flags: flags(row.flags) })),
      glass: { ...DRIFTWOOD_FINDS.glass, flags: flags(DRIFTWOOD_FINDS.glass.flags) } },
    marks: DRIFTWOOD_INTERACT.rows.flatMap(row => {
      if (row.kind !== 'pickup' || row.look !== 'seaglass' || row.at.poi !== 'world') return [];
      const flag = row.sets?.[0];
      return flag === undefined ? [] : [{ flag, x: row.at.x, z: row.at.z, color: row.color ?? '#7df0d0' }];
    }) },
};
