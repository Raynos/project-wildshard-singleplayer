/**
 * Pine Hollow's rain as data (PH-L10, E322 F-L5; SHARD-PLATFORM M3): the sizes of the SDK rain system's pieces
 * (sdk/looks/rainPresentation — the curtain with the canopy's drips, the puddles, the splashes at the feet, the drops on
 * the lens) and the curtain's, the splashes' and the lens drops' SF59 material graphs (`RAIN_GRAPHS`, the shardfile's
 * look.materials; `PINE_RAIN_PROGRAMS` their ids). The cave's hood is the bear cave's mouth in its own frame (lx across,
 * lz into the rock; the mouth faces −lz): half width, from, to, height over the mouth's ground — the arch's opening is
 * 2.6 × 4.8 m (caveArch.ts `openCaveArch`); the cover map takes over at lz ≈ 1.5.
 */

/** The rain's sizes per tier: the cover map's texels, the streaks, the splash and lens-drop slots, the puddles. */
export const PINE_RAIN = {
  coverN: 256,
  streaks: { phone: 3200, desktop: 6000 },
  splashes: { phone: 64, desktop: 96 },
  lensDrops: { phone: 14, desktop: 20 },
  puddles: { trail: { phone: 55, desktop: 90 }, open: { phone: 36, desktop: 60 }, seg: 14, rings: [[0, 0.05], [0.55, 0.04], [1.0, 0.004], [1.12, -0.1], [1.35, -0.42]] },
} as const;

/** The bear cave's hood, where no rain falls (its frame is the layout's BEAR_CAVE). */
export const PINE_CAVE_HOOD = { hw: 3.2, lz0: -1.4, lz1: 4.5, up: 5.6 } as const;

/** the look.materials ids the rain's graphs are worn under (the curtain, the splashes at the feet, the drops on the lens)
 *  and the numeric channel group that turns their params (generators/rainChannels.ts) */
export const PINE_RAIN_PROGRAMS = { rain: 'pine-rain-curtain', splash: 'pine-rain-splash', lens: 'pine-rain-lens', channels: 'pine.rain' } as const;
