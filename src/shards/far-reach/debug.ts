import type { ShardContext } from '@wildshard/game/shard/context';
import { runtimeVariantEnabled } from '@wildshard/game/shard/runtimeVariant';

// SF49-g (E435; G99 / G102): Sky Reach's four switchback entries (world/entries.ts), default off until the walk, the parity
// and the quiet frame floor are green; then the row and the off path go (G112).
const DEBUG_ROWS = [{ id: 'farReachEntries', group: 'loading', label: 'Sky Reach entries',
  choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-12-30', note: 'E435 SF49-g: four plank switchback ramps from the islands to road-level landings at the edge midpoints (G102).' }] as const;

/** Register the row; true when it is on (a reload row: read once as the world builds). */
export function farReachEntriesOn(ctx: Pick<ShardContext, 'debugRow'>): boolean { return runtimeVariantEnabled(ctx, DEBUG_ROWS[0]); }
