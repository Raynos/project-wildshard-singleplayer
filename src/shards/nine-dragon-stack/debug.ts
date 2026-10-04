import type { ShardContext } from '@wildshard/game/shard/context';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';

// SF51-g (E435): the four Jiehua stone landing decks at y = 0 on the edge midpoints (world/entries.ts), a look change for
// Jake's board; default off, read at boot (reload: the row's service applies the saved pick through `change` as it
// registers). Retires when Jake picks: the row and the losing path go together.
const DEBUG_ROWS = [{ id: 'nineDragonEntries', group: 'look', label: 'Nine Dragon entries',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-12-30', note: 'E435 SF51-g: four 8 x 16 m stone landing decks at road height on the edge midpoints, closed by end walls (the climb is SF51-p).' }] as const;

/** Register the row; true when it is on (a reload row: read once as the world builds). */
export function ndEntriesEnabled(ctx: Pick<ShardContext, 'debugRow'>): boolean { return runtimeVariantEnabled(ctx, DEBUG_ROWS[0]); }
