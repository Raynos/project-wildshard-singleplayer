import { paintCanvasAtlas as platformPaintCanvasAtlas, paintSteps as platformPaintSteps, type CanvasAtlasRow as PlatformCanvasAtlasRow, type CanvasSegment as PlatformCanvasSegment, type CanvasStep as PlatformCanvasStep } from '@wildshard/game/systems/looks/canvasAtlas';

/** One path segment: move, line or arc (angles in half turns). */
export type CanvasSegment = PlatformCanvasSegment;
/** A 2D-canvas draw step as data. */
export type CanvasStep = PlatformCanvasStep;
/** A canvas atlas as data: its authored size and its steps. */
export type CanvasAtlasRow = PlatformCanvasAtlasRow;
/** Paints an atlas row on a new canvas and returns a mipmapped sRGB texture (SHARD-PLATFORM M3, canvas atlas). */
export const paintCanvasAtlas: typeof platformPaintCanvasAtlas = platformPaintCanvasAtlas;
/** Replays draw steps on an existing 2D context. */
export const paintSteps: typeof platformPaintSteps = platformPaintSteps;
