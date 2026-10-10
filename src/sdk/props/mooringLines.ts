import { MooringLines as PlatformMooringLines, type MooringLinesRow as PlatformMooringLinesRow, type MooringPost as PlatformMooringPost } from '@wildshard/game/systems/props/mooringLines';

/** Mooring lines' numbers as data (SHARD-PLATFORM M3): colour, post height, sag and the tube. */
export type MooringLinesRow = PlatformMooringLinesRow;
/** A post a mooring line is tied to (world xz). */
export type MooringPost = PlatformMooringPost;
/** A moored hull's lines: one static world-space mesh whose cleat ends lift with the hull's heave and pitch. */
export const MooringLines: typeof PlatformMooringLines = PlatformMooringLines;
/** A hull's mooring lines (the class's instances). */
export type MooringLinesSet = PlatformMooringLines;
