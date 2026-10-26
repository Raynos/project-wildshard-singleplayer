import { skyIsleProps } from './isleProps';
import { skyWorldTileRows } from './worldTileBytes';

/** One authored metadata bank for the scene and declaration; native assets remain owned by their producer. */
export const SKY_WORLD_TILE_ROWS = skyWorldTileRows(skyIsleProps());
