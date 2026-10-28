/**
 * The second bake page of bake-pine-painted.mjs: bundled on its own and run on a blank page in headless Chromium, it paints
 * the forest floor's six textures (./undergrowthPaint.ts rows, from the level's seed) that the ground cover used to paint
 * on a canvas at every launch, and encodes each one (WebP; its alpha plane stays lossless).
 * No game, no level, no shard runtime is loaded.
 */
import { paintSteps, type CanvasAtlasRow } from '@wildshard/sdk/bake/canvasAtlas';
import { sendPaintedCanvas, type PaintedBake } from './paintedBytes';
import { FERN_PAINT, LITTER_PAINT, MOSS_PAINT, REED_PAINT, SHRUB_PAINT, STONE_PAINT } from './undergrowthPaint';

const ROWS: Readonly<Record<string, CanvasAtlasRow>> = { ferns: FERN_PAINT, shrubs: SHRUB_PAINT, litter: LITTER_PAINT, stones: STONE_PAINT, moss: MOSS_PAINT, reeds: REED_PAINT };

/** Paint every ground-cover kind's texture from the level's `seed`, keyed by kind. */
export async function bakePineUndergrowth(seed: number, byteUrl: string): Promise<Record<string, PaintedBake>> {
  const out: Record<string, PaintedBake> = {};
  for (const [kind, row] of Object.entries(ROWS)) {
    const canvas = document.createElement('canvas');
    canvas.width = row.w; canvas.height = row.h;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('2d canvas unavailable');
    paintSteps(context, row.steps, { SEED: seed });
    out[kind] = await sendPaintedCanvas(kind, canvas, 'image/webp', byteUrl, 0.92);
  }
  return out;
}

