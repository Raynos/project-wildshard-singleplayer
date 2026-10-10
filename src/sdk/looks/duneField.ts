import { duneField as platformDuneField, type DuneCrestLine as PlatformDuneCrestLine, type DuneFieldRow as PlatformDuneFieldRow, type DuneLandformCrest as PlatformDuneLandformCrest, type DuneMound as PlatformDuneMound, type DuneSpot as PlatformDuneSpot } from '@wildshard/game/systems/looks/duneField';

/** An authored crest line on a dune field. */
export type DuneCrestLine = PlatformDuneCrestLine;
/** An authored polyline crest on a dune field. */
export type DuneLandformCrest = PlatformDuneLandformCrest;
/** A cosine mound on a dune field. */
export type DuneMound = PlatformDuneMound;
/** A flat spot levelled to its own dune height. */
export type DuneSpot = PlatformDuneSpot;
/** A crescent dune field as rows: wind, wave, warp, amplitude, damping, basin and the authored landforms (SHARD-PLATFORM M3). */
export type DuneFieldRow = PlatformDuneFieldRow;
/** A crescent dune field's terrain height function from its rows. */
export const duneField: typeof platformDuneField = platformDuneField;
