import { ENTRY_LANE_DEPTH } from '../world/entryLanes';

/** Native ground admission uses the shipping capsule across every entry lane. */
export const ENTRY_WALK = { lanes: 23, walk: ENTRY_LANE_DEPTH, start: 249.55, maxTicks: 600 } as const;
