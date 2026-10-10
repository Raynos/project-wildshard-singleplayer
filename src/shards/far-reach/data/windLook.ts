import type { GustRow, UpdraftRow } from '@wildshard/sdk/looks/windFx';

/**
 * Sky Reach's visible wind (style bible §7, loop 3; drawn by @wildshard/sdk/looks/windFx): the fan's GUST, a cone of
 * streaks with tumbling petals, and the updraft's column, a soft spiral of streaks with rising leaves up the ramp.
 */

/** The GUST: how many streaks and petals, how long they live, how far they fly; warm streaks and blossom petals. */
export const GUST_FX: GustRow = {
  streaks: 30, petals: 14, life: 0.6, speed: 20, start: 1.0, spread: 1.7,
  tint: 0xeaf8ff, warm: 0xffe6c4, petalColours: [0xffd4dc, 0xfff1e0, 0xffc6a8, 0xf5b8d0],
  streakName: 'far.gust.streaks', petalName: 'far.gust.petals',
};

/** The updraft's spiral round the ramp. Round 2 (council: the streaks crossing the glass ramp read as cracks): fewer,
 *  fainter, wider round the ramp. */
export const UPDRAFT_FX: UpdraftRow = {
  streaks: 24, leaves: 14, radius: 3.3, turns: 6, rate: 0.1,
  tint: 0xcdeeff, leafColours: [0xb9c868, 0xd9c060, 0x93b552, 0xf0d488],
  streakName: 'far.updraft.streaks', leafName: 'far.updraft.leaves',
};
