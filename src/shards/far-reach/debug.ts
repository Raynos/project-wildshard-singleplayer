import type { ShardContext } from '@wildshard/game/shard/context';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';

// SF49-g (E435; G99 / G183): Sky Reach's four Rising Islet entries (world/risingIslet.ts), default off until the way up works
// (G194): the walk, the parity and the quiet frame floor green; then the row and the off path go (G112).
const DEBUG_ROWS = [{ id: 'farReachEntries', group: 'loading', label: 'Sky Reach entries',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-12-30', note: 'E435 SF49-g: at each edge midpoint a road-level islet rises on chains to a gate isle, rope-bridged to an island (G183).' }] as const;

/** Register the row; true when it is on (a reload row: read once as the world builds). */
export function farReachEntriesOn(ctx: Pick<ShardContext, 'debugRow'>): boolean { return runtimeVariantEnabled(ctx, DEBUG_ROWS[0]); }
