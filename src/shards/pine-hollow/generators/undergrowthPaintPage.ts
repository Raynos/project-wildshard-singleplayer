/**
 * The second bake page of bake-pine-painted.mjs: bundled on its own and run on a blank page in headless Chromium, it paints
 * the forest floor's six textures (./undergrowthPaint.ts rows, from the level's seed) that the ground cover used to paint
 * on a canvas at every launch, and encodes each one (WebP; its alpha plane stays lossless).
 * No game, no level, no shard runtime is loaded.
 */
import { paintCanvas, type CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';
import type { PaintedBake } from './paintedPage';
import { FERN_PAINT, LITTER_PAINT, MOSS_PAINT, REED_PAINT, SHRUB_PAINT, STONE_PAINT } from './undergrowthPaint';

const ROWS: Readonly<Record<string, CanvasAtlasRow>> = { ferns: FERN_PAINT, shrubs: SHRUB_PAINT, litter: LITTER_PAINT, stones: STONE_PAINT, moss: MOSS_PAINT, reeds: REED_PAINT };

/** Paint every ground-cover kind's texture from the level's `seed`, keyed by kind. */
function bakePineUndergrowth(seed: number): Record<string, PaintedBake> {
  return Object.fromEntries(Object.entries(ROWS).map(([kind, row]) => {
    const canvas = paintCanvas(row, { SEED: seed });
    return [kind, { dataUrl: canvas.toDataURL('image/webp', 0.92), width: canvas.width, height: canvas.height }];
  }));
}

Object.assign(window, { bakePineUndergrowth });
