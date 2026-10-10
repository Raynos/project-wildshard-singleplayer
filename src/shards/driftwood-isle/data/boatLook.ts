// SHARD-PLATFORM M3 (look-family rows): the sailboat's mooring lines to the pier's bollards (world/Boat.ts builds them
// through @wildshard/sdk/props/mooringLines). The boat itself is models/boat.ts.
import type { MooringLinesRow } from '@wildshard/sdk/props/mooringLines';

/** Hemp-coloured lines tied 1.9 m over the still water, sagging 35 cm: 8-segment tubes 3 cm thick, 4 sides. */
export const BOAT_MOORING: MooringLinesRow = { color: '#d2bd85', postAbove: 1.9, sag: 0.35, segments: 8, radius: 0.03, radial: 4 };
