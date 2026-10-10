import { HeldTool as PlatformHeldTool, heldToolSpecimen as platformHeldToolSpecimen, loadHeldToolFile as platformLoadHeldToolFile, parseHeldToolFile as platformParseHeldToolFile, type HeldToolBeat as PlatformHeldToolBeat, type HeldToolFile as PlatformHeldToolFile, type HeldToolRow as PlatformHeldToolRow, type HeldToolStroke as PlatformHeldToolStroke } from '@wildshard/game/systems/kit/heldTool';

/** A beat's clock: its length, rise-in, cuts and drop-out (SHARD-PLATFORM M3, the kit system). */
export type HeldToolBeat = PlatformHeldToolBeat;
/** One stroke's direction and wrist turn while drawing. */
export type HeldToolStroke = PlatformHeldToolStroke;
/** A held tool's look and motion (a shard's data row): its GLB, stand-in parts, hold, low and strokes. */
export type HeldToolRow = PlatformHeldToolRow;
/** A held tool's file: its one mesh as float geometry and its atlas. */
export type HeldToolFile = PlatformHeldToolFile;
/** Reads a held tool's GLB scene: its first mesh as float geometry and its atlas. */
export const parseHeldToolFile: typeof platformParseHeldToolFile = platformParseHeldToolFile;
/** Fetches and parses a held tool's GLB. */
export const loadHeldToolFile: typeof platformLoadHeldToolFile = platformLoadHeldToolFile;
/** A first-person tool held through a timed beat: rises in, strokes on each cut, drops out. */
export const HeldTool: typeof PlatformHeldTool = PlatformHeldTool;
/** A held tool (the instance type). */
export type HeldToolView = PlatformHeldTool;
/** The Model Explorer's specimen of a held tool: the stand-in, then its file. */
export const heldToolSpecimen: typeof platformHeldToolSpecimen = platformHeldToolSpecimen;
