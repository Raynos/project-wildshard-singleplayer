import { paintCanvas as platformPaintCanvas, paintCanvasAtlas as platformPaintCanvasAtlas, paintSteps as platformPaintSteps, type CanvasAtlasRow as PlatformCanvasAtlasRow, type CanvasCall as PlatformCanvasCall, type CanvasExpr as PlatformCanvasExpr, type CanvasSegment as PlatformCanvasSegment, type CanvasStep as PlatformCanvasStep } from '@wildshard/game/systems/looks/canvasAtlas';

/** One path segment: move, line or arc (angles in half turns). */
export type CanvasSegment = PlatformCanvasSegment;
/** A number, or an expression string evaluated in the painter's scope. */
export type CanvasExpr = PlatformCanvasExpr;
/** A canvas call a `call` step makes. */
export type CanvasCall = PlatformCanvasCall;
/** A 2D-canvas draw step as data. */
export type CanvasStep = PlatformCanvasStep;
/** A canvas atlas as data: its authored size and its steps. */
export type CanvasAtlasRow = PlatformCanvasAtlasRow;
/** Paints an atlas row on a new canvas and returns a mipmapped sRGB texture (SHARD-PLATFORM M3, canvas atlas). */
export const paintCanvasAtlas: typeof platformPaintCanvasAtlas = platformPaintCanvasAtlas;
/** Paints a row (expressions seeded by `vars`) on a new canvas of its size and returns the canvas. */
export const paintCanvas: typeof platformPaintCanvas = platformPaintCanvas;
/** Replays draw steps on an existing 2D context. */
export const paintSteps: typeof platformPaintSteps = platformPaintSteps;
