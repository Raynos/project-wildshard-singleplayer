import { ConeFan as PlatformConeFan, coneFanPose as platformConeFanPose, coneFanType as platformConeFanType, type ConeFanMotion as PlatformConeFanMotion, type ConeFanMoveView as PlatformConeFanMoveView, type ConeFanOptions as PlatformConeFanOptions, type ConeFanParts as PlatformConeFanParts, type ConeFanPose as PlatformConeFanPose, type ConeFanType as PlatformConeFanType, type ConeFanView as PlatformConeFanView } from '@wildshard/game/systems/items/coneFan';

/** A viewmodel offset (metres, radians). */
export type ConeFanPose = PlatformConeFanPose;
/** A cone fan's three moves. */
export type ConeFanMotion = PlatformConeFanMotion;
/** One move as eased key poses over its duration. */
export type ConeFanMoveView = PlatformConeFanMoveView;
/** The cone fan's view as rows: hold, spring, charge, moves, breath, draw, pendant. */
export type ConeFanView = PlatformConeFanView;
/** The viewmodel's parts a cone fan moves: the root and a pendant. */
export type ConeFanParts = PlatformConeFanParts;
/** A cone fan's construction: row, strikes (`@wildshard/sdk/items/coneStrikes`), view, gust action and parts builder. */
export type ConeFanOptions<P extends ConeFanParts> = PlatformConeFanOptions<P>;
/** The constructor a row binds. */
export type ConeFanType<P extends ConeFanParts> = PlatformConeFanType<P>;
/** A move's pose part-way through, eased between its keys. */
export const coneFanPose: typeof platformConeFanPose = platformConeFanPose;
/** A held cone fan: arc slash, held heavy and cone gust with a row-driven viewmodel (SHARD-PLATFORM M3). */
export const ConeFan: typeof PlatformConeFan = PlatformConeFan;
/** A built cone fan. */
export type ConeFanWeapon<P extends ConeFanParts = ConeFanParts> = PlatformConeFan<P>;
/** Bind a shard's row (row, strikes, view, gust action, parts) to the family: data and a model, never a subclass. */
export const coneFanType: typeof platformConeFanType = platformConeFanType;
