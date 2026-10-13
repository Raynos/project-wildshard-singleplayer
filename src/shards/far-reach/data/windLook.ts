
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

/** A gust's rows: how many streaks and petals, how long they live, how far they fly; the colours and the meshes' names. */
export interface GustRow {
  readonly streaks: number;
  readonly petals: number;
  readonly life: number;
  readonly speed: number;
  readonly start: number;
  readonly spread: number;
  /** a streak's tint (sRGB hex), and the warm one's (drawn by about 3 in 10) */
  readonly tint: number;
  readonly warm: number;
  /** the petals' colours (sRGB hex), in turn */
  readonly petalColours: readonly number[];
  readonly streakName: string;
  readonly petalName: string;
}

/** An updraft's rows: its streaks and leaves round a helix of `radius` with `turns` turns, climbing at `rate` per second. */
export interface UpdraftRow {
  readonly streaks: number;
  readonly leaves: number;
  readonly radius: number;
  readonly turns: number;
  readonly rate: number;
  /** the streaks' tint (sRGB hex) */
  readonly tint: number;
  /** the leaves' colours (sRGB hex), in turn */
  readonly leafColours: readonly number[];
  readonly streakName: string;
  readonly leafName: string;
}
